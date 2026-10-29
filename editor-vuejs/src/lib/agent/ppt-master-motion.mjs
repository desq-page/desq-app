// PPT Master's authored native preset records -> Savanna's existing timing importer.
import { XMLParser, XMLBuilder } from "fast-xml-parser";
import presets from "./data/ppt-master-animations.mjs";
import { processAnimation } from "shared-vuejs/api/edlib-pptx-pptx-anim-core";
import transitions from "shared-vuejs/api/edlib-pptx-pptMasterTransitions";
const registry = new Map(presets.map((p) => [p.key, p]));
const aliases = {
  appear: "entrance_appear",
  fade: "entrance_fade",
  fly: "entrance_fly",
  zoom: "entrance_zoom",
  wipe: "entrance_wipe",
  cut: "entrance_appear",
};
const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "$_",
  removeNSPrefix: true,
  parseTagValue: false,
});
const sourceParser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: false,
});
const sourceBuilder = new XMLBuilder({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  suppressEmptyNode: true,
});
function optionRow(preset, options) {
  let xml = preset.row_xml;
  const supplied = options || {};
  for (const [name, spec] of Object.entries(preset.effect_options)) {
    const value = supplied[name] ?? spec.default;
    if (spec.required && value === undefined)
      throw Error(`Animation ${preset.key} requires ${name}.`);
    if (value === undefined) continue;
    if (spec.type === "enum") {
      const variant = spec.values[String(value)];
      if (typeof variant !== "string")
        throw Error(`Invalid animation ${name}=${value}.`);
      xml = variant;
    } else if (
      spec.type === "number" &&
      (typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < spec.minimum ||
        value > spec.maximum)
    )
      throw Error(`Animation ${name} outside preset bounds.`);
    else if (spec.type === "boolean" && typeof value !== "boolean")
      throw Error(`Animation ${name} must be boolean.`);
    else if (
      spec.type === "string" &&
      (typeof value !== "string" || !value.trim() || value.length > 100)
    )
      throw Error(`Animation ${name} requires a font name.`);
  }
  for (const name of Object.keys(supplied))
    if (!preset.effect_options[name])
      throw Error(`Animation ${preset.key} has no option ${name}.`);
  const nodes = sourceParser.parse(xml.replace(/\bns\d+:/g, "p:"));
  const visit = (n, callback) => {
    const key = Object.keys(n).find((k) => k !== ":@");
    callback(n, key);
    for (const child of n[key] || [])
      if (!("#text" in child)) visit(child, callback);
  };
  for (const [name, spec] of Object.entries(preset.effect_options)) {
    const value = supplied[name] ?? spec.default;
    if (value === undefined || spec.type === "enum") continue;
    for (const root of nodes)
      visit(root, (node, key) => {
        const a = node[":@"] || {};
        if (
          name === "color" &&
          ["a:srgbClr", "a:schemeClr", "a:sysClr", "a:prstClr"].includes(key)
        ) {
          const color = String(value);
          if (!/^theme:[\w]+$|^#[0-9a-f]{6}$/i.test(color))
            throw Error("Animation color requires #RRGGBB or theme:slot.");
          delete node[key];
          node[color.startsWith("theme:") ? "a:schemeClr" : "a:srgbClr"] = [];
          node[":@"] = {
            val: color.startsWith("theme:") ? color.slice(6) : color.slice(1),
          };
        }
        if (
          name === "amount" &&
          preset.key === "emphasis_spin" &&
          key === "p:animRot"
        )
          a.by = Math.round(value * 60000);
        if (name === "relative" && key === "p:animMotion")
          a.pathEditMode = value ? "relative" : "fixed";
        if (name === "size" && key === "p:animScale") {
          const child = node[key].find((c) => "p:to" in c);
          if (child)
            child[":@"] = {
              x: Math.round(value * 1000),
              y: Math.round(value * 1000),
            };
          else
            node[key].push({
              "p:to": [],
              ":@": {
                x: Math.round(value * 1000),
                y: Math.round(value * 1000),
              },
            });
        }
        if (
          (name === "font_name" ||
            (name === "amount" && preset.key === "emphasis_transparency")) &&
          key === "p:strVal"
        )
          a.val = name === "font_name" ? value : 1 - value;
      });
  }
  return sourceBuilder.build(nodes);
}
const behaviorTags = new Set([
  "set",
  "anim",
  "animEffect",
  "animRot",
  "animScale",
  "animClr",
  "animMotion",
  "cmd",
]);
function object(nodes) {
  const out = {};
  for (const n of nodes) {
    const name = Object.keys(n).find((k) => k !== ":@");
    if (name === "#text") continue;
    const a = n[":@"] || {},
      children = n[name] || [],
      text = children
        .filter((c) => "#text" in c)
        .map((c) => c["#text"])
        .join("");
    const key = behaviorTags.has(name) ? "uniAnim" : name;
    let value =
      children.some((c) => !("#text" in c)) || Object.keys(a).length
        ? {
            ...a,
            ...object(children),
            ...(behaviorTags.has(name) ? { $_otag: name } : {}),
          }
        : text;
    if (key in out)
      out[key] = Array.isArray(out[key])
        ? [...out[key], value]
        : [out[key], value];
    else out[key] = value;
  }
  return out;
}
const seconds = (v, fallback) => {
  const n = v ?? fallback;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 86400)
    throw Error("Motion time must be finite seconds in 0..86400.");
  return n;
};
export function compileMotion(config, shapes, { width, height } = {}) {
  if (!config) return {};
  const timing = { m: [], i: [] };
  const groups = { ...(config.groups || {}) };
  const defaults = config.animation || {};
  if (defaults.effect && defaults.effect !== "none")
    for (const shape of shapes) {
      const target = shape.sourceIds?.[0] || shape.name;
      if (
        !/^(background|bg|footer|header|logo|watermark|page[-_]?number)$/i.test(
          target,
        ) &&
        !(target in groups)
      )
        groups[target] = {};
    }
  for (const [target, entry] of Object.entries(groups)) {
    const targets = shapes.filter(
      (s) => s.sourceIds?.includes(target) || s.name === target,
    );
    if (!targets.length)
      throw Error(`Animation target ${target} does not exist.`);
    for (const spec of Array.isArray(entry.effects) ? entry.effects : [entry]) {
      const options = { ...defaults, ...spec },
        effect = options.effect || "none";
      if (effect === "none") continue;
      const preset = registry.get(aliases[effect] || effect);
      if (!preset) throw Error(`Unknown PPT Master animation: ${effect}`);
      let xml = optionRow(preset, options.effect_options);
      for (const [targetIndex, shape] of targets.entries()) {
        const row = object(parser.parse(xml)).cTn;
        const defaultDuration = preset.default_duration_ms || 1;
        const duration = seconds(options.duration, defaultDuration / 1000),
          delay = seconds(options.delay, 0);
        const scale = preset.duration_scalable
          ? (duration * 1000) / defaultDuration
          : 1;
        const patch = (n) => {
          if (!n || typeof n !== "object") return;
          if (n.$_spid !== undefined) n.$_spid = shape.id;
          if (n.$_dur !== undefined && Number.isFinite(Number(n.$_dur)))
            n.$_dur = String(Math.max(1, Math.round(Number(n.$_dur) * scale)));
          for (const v of Object.values(n))
            if (v && typeof v === "object") {
              if (Array.isArray(v)) v.forEach(patch);
              else patch(v);
            }
        };
        patch(row);
        row.stCondLst = { cond: { $_delay: Math.round(delay * 1000) } };
        const trigger = options.trigger || "after-previous";
        if (!["on-click", "with-previous", "after-previous"].includes(trigger))
          throw Error("Unknown animation trigger.");
        row.$_nodeType = {
          "on-click": "clickEffect",
          "with-previous": "withEffect",
          "after-previous": "afterEffect",
        }[trigger];
        if (options.repeat_count !== undefined) {
          if (
            options.repeat_count !== "indefinite" &&
            (!Number.isFinite(options.repeat_count) ||
              options.repeat_count <= 0)
          )
            throw Error("Invalid animation repeat count.");
          row.$_repeatCount =
            options.repeat_count === "indefinite"
              ? "indefinite"
              : options.repeat_count * 1000;
        }
        if (options.auto_reverse !== undefined)
          row.$_autoRev = options.auto_reverse ? 1 : 0;
        if (options.rewind) row.$_fill = "remove";
        const effectGroup = { cTn: { childTnLst: { par: { cTn: row } } } };
        const sequence = { cTn: { childTnLst: { par: [effectGroup] } } };
        const main = {
          cTn: { $_nodeType: "mainSeq", childTnLst: { par: [sequence] } },
        };
        const content = {
          sld: {
            cSld: { shapes: shapes.map((s) => ({ ...s, pptxShapeId: s.id })) },
            timing: { tnLst: { par: { cTn: { childTnLst: { seq: main } } } } },
          },
        };
        const result = processAnimation(content, "sld", {
          slideId: "agent",
          slideSize: { width, height },
          resolveThemeColor: (clr) =>
            ({
              accent1: "4472C4",
              accent2: "ED7D31",
              accent3: "A5A5A5",
              accent4: "FFC000",
              accent5: "5B9BD5",
              accent6: "70AD47",
              tx1: "000000",
              bg1: "FFFFFF",
            })[clr.$_val],
        });
        if (result.m.length !== 1)
          throw Error(`Native animation ${effect} did not compile.`);
        const converted = result.m[0];
        if (targetIndex) converted.tr = 2;
        converted.nativeTiming = {
          rowXml: xml,
          defaultDurationMs: defaultDuration,
        };
        converted.ac = options.accelerate ?? converted.ac;
        converted.dc = options.decelerate ?? converted.dc;
        converted.be = options.bounce_end ?? converted.be;
        for (const name of ["ac", "dc", "be"])
          if (
            converted[name] !== undefined &&
            (!Number.isFinite(converted[name]) ||
              converted[name] < 0 ||
              converted[name] > 1)
          )
            throw Error("Animation easing must be in 0..1.");
        if (options.trigger_shape) {
          const triggerShape = shapes.find(
            (s) =>
              s.sourceIds?.includes(options.trigger_shape) ||
              s.name === options.trigger_shape,
          );
          if (!triggerShape) throw Error("Missing animation trigger shape.");
          converted.trs = triggerShape.id;
          let group = timing.i.find((g) => g.ef[0]?.trs === converted.trs);
          if (!group) {
            group = { ef: [] };
            timing.i.push(group);
          }
          group.ef.push(converted);
        } else timing.m.push(converted);
      }
    }
  }
  const transition = { advClick: 1 };
  if (config.transition) {
    const t = config.transition;
    if (t.effect !== "none") {
      const key =
        {
          randomBar: "random_bars",
          checker: "checkerboard",
          pull: "uncover",
          ferris: "ferris_wheel",
          flythrough: "fly_through",
        }[t.effect] || t.effect;
      const spec = transitions[key];
      if (!spec) throw Error(`Unknown native transition ${t.effect}.`);
      const attrs = { ...spec.attrs },
        o = t.effect_options || {};
      if (o.direction) {
        const direction = {
          left: "l",
          right: "r",
          up: "u",
          down: "d",
          up_left: "lu",
          up_right: "ru",
          down_left: "ld",
          down_right: "rd",
          in: "in",
          out: "out",
          clockwise: "cw",
          counterclockwise: "ccw",
        }[o.direction];
        if (!direction) throw Error("Invalid transition direction.");
        attrs.dir = direction;
      }
      if (o.orientation) {
        if (!["horizontal", "vertical"].includes(o.orientation))
          throw Error("Invalid transition orientation.");
        attrs.orient = o.orientation === "vertical" ? "vert" : "horz";
      }
      if (o.morph_by) {
        attrs.option = {
          object: "byObject",
          word: "byWord",
          character: "byChar",
        }[o.morph_by];
        if (!attrs.option) throw Error("Invalid Morph mode.");
      }
      if (o.spokes !== undefined) {
        if (![1, 2, 3, 4, 8].includes(o.spokes))
          throw Error("Invalid wheel spokes.");
        attrs.spokes = o.spokes;
      }
      if (o.through_black !== undefined)
        attrs.thruBlk = o.through_black ? 1 : 0;
      transition.ef = spec.attrs?.prst || spec.element;
      transition.nativeKey = key;
      transition.nativeAttrs = attrs;
      Object.assign(transition, attrs);
    }
    transition.dur = seconds(t.duration, 0.4);
    if (t.advance_after !== undefined)
      transition.advTm = seconds(t.advance_after, 0);
    if (t.advance_click !== undefined)
      transition.advClick = t.advance_click ? 1 : 0;
  }
  return { timing, transition };
}
export const animationNames = Object.freeze(presets.map((p) => p.key));
export const transitionNames = Object.freeze(Object.keys(transitions));
