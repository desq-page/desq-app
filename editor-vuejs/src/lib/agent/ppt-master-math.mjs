// Browser implementation of PPT Master's native LaTeX -> Office Math pipeline.
// Vocabulary comes from formula_profile.py (Hugo He, MIT). Unknown syntax fails closed.
import profile from "./data/ppt-master-math-profile.mjs";
const symbols = Object.assign(
  {},
  ...[
    "GREEK_SYMBOLS",
    "BINARY_SYMBOLS",
    "RELATION_SYMBOLS",
    "ARROW_SYMBOLS",
    "DOT_SYMBOLS",
    "MISC_SYMBOLS",
    "DELIMITER_COMMANDS",
  ].map((k) => profile[k]),
);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
const tag = (name, body = "", attrs = {}) =>
  `<${name}${Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${esc(v)}"`)
    .join("")}>${body}</${name}>`;
const m = (name, body = "", attrs = {}) =>
  tag(
    "m:" + name,
    body,
    Object.fromEntries(
      Object.entries(attrs).map(([k, v]) => [
        k.includes(":") ? k : "m:" + k,
        v,
      ]),
    ),
  );
const node = (omml, mathML) => ({ omml, mathML });
const join = (items) =>
  node(items.map((x) => x.omml).join(""), items.map((x) => x.mathML).join(""));
const text = (s) =>
  node(m("r", m("t", esc(s), { "xml:space": "preserve" })), tag("mi", esc(s)));
const arg = (name, n) => m(name, n.omml);
function wrapped(name, n) {
  return node(m(name, arg("e", n)), n.mathML);
}
class Parser {
  constructor(source) {
    this.source = source;
    this.i = 0;
    this.depth = 0;
    this.nodes = 0;
  }
  fail(message) {
    throw Error(`Native formula: ${message} at ${this.i}.`);
  }
  space() {
    while (/\s/.test(this.source[this.i] || "") && this.i < this.source.length)
      this.i++;
  }
  command() {
    this.i++;
    const match = /^[A-Za-z]+\*?/.exec(this.source.slice(this.i));
    if (match) {
      this.i += match[0].length;
      return match[0];
    }
    return this.source[this.i++];
  }
  rawGroup() {
    this.space();
    if (this.source[this.i++] !== "{") this.fail("expected argument");
    let depth = 1,
      out = "";
    while (this.i < this.source.length) {
      const c = this.source[this.i++];
      if (c === "{") depth++;
      if (c === "}" && !--depth) return out;
      out += c;
    }
    this.fail("unclosed argument");
  }
  group() {
    this.space();
    if (this.source[this.i] === "{") {
      this.i++;
      const n = this.sequence("}");
      if (this.source[this.i++] !== "}") this.fail("unclosed group");
      return n;
    }
    return this.atom();
  }
  sequence(end) {
    if (++this.depth > 128) this.fail("nesting exceeds 128");
    const list = [];
    while (this.i < this.source.length) {
      this.space();
      if (end && this.source.startsWith(end, this.i)) break;
      if (this.i >= this.source.length) break;
      if (this.source[this.i] === "}") this.fail("unexpected closing brace");
      let n = this.atom();
      if (++this.nodes > 100000) this.fail("node limit exceeded");
      let sub, sup;
      this.space();
      if (this.source.startsWith("\\limits", this.i)) this.i += 7;
      else if (this.source.startsWith("\\nolimits", this.i)) this.i += 9;
      this.space();
      while (["_", "^"].includes(this.source[this.i])) {
        const mark = this.source[this.i++];
        if (mark === "_" ? sub : sup) this.fail("duplicate script");
        const v = this.group();
        if (mark === "_") sub = v;
        else sup = v;
        this.space();
      }
      if (n.nary) {
        const body =
          this.i < this.source.length && this.source[this.i] !== "}"
            ? this.completeAtom()
            : join([]);
        n = node(
          m(
            "nary",
            m(
              "naryPr",
              m("chr", "", { val: n.nary }) +
                m("subHide", "", { val: sub ? 0 : 1 }) +
                m("supHide", "", { val: sup ? 0 : 1 }),
            ) +
              arg("sub", sub || join([])) +
              arg("sup", sup || join([])) +
              arg("e", body),
          ),
          tag(
            "munderover",
            tag("mo", esc(n.nary)) +
              (sub?.mathML || "<mrow/>") +
              (sup?.mathML || "<mrow/>"),
          ) + body.mathML,
        );
      } else if (sub || sup) {
        const kind = sub && sup ? "sSubSup" : sub ? "sSub" : "sSup";
        n = node(
          m(
            kind,
            arg("e", n) +
              (sub ? arg("sub", sub) : "") +
              (sup ? arg("sup", sup) : ""),
          ),
          tag(
            sub && sup ? "msubsup" : sub ? "msub" : "msup",
            tag("mrow", n.mathML) +
              (sub ? tag("mrow", sub.mathML) : "") +
              (sup ? tag("mrow", sup.mathML) : ""),
          ),
        );
      }
      list.push(n);
    }
    this.depth--;
    return join(list);
  }
  completeAtom() {
    let n = this.group();
    let sub, sup;
    this.space();
    while (["_", "^"].includes(this.source[this.i])) {
      const mark = this.source[this.i++],
        value = this.group();
      if (mark === "_") sub = value;
      else sup = value;
      this.space();
    }
    if (sub || sup)
      n = node(
        m(
          sub && sup ? "sSubSup" : sub ? "sSub" : "sSup",
          arg("e", n) +
            (sub ? arg("sub", sub) : "") +
            (sup ? arg("sup", sup) : ""),
        ),
        tag(
          sub && sup ? "msubsup" : sub ? "msub" : "msup",
          tag("mrow", n.mathML) +
            (sub ? tag("mrow", sub.mathML) : "") +
            (sup ? tag("mrow", sup.mathML) : ""),
        ),
      );
    return n;
  }
  delimiter() {
    this.space();
    return this.source[this.i] === "\\"
      ? symbols[this.command()] || this.source[this.i - 1]
      : this.source[this.i++];
  }
  atom() {
    this.space();
    const c = this.source[this.i++];
    if (c === undefined) this.fail("missing operand");
    if (c === "{") {
      const n = this.sequence("}");
      if (this.source[this.i++] !== "}") this.fail("unclosed group");
      return n;
    }
    if (c !== "\\") {
      if (["^", "_", "&"].includes(c)) this.fail("unexpected " + c);
      return text(c === "-" ? "−" : c);
    }
    this.i--;
    const cmd = this.command();
    if (symbols[cmd]) return text(symbols[cmd]);
    if (profile.NARY_COMMANDS[cmd])
      return {
        ...text(profile.NARY_COMMANDS[cmd]),
        nary: profile.NARY_COMMANDS[cmd],
      };
    if (
      [
        "frac",
        "dfrac",
        "tfrac",
        "cfrac",
        "ifrac",
        "binom",
        "dbinom",
        "tbinom",
      ].includes(cmd)
    ) {
      const a = this.group(),
        b = this.group(),
        binom = cmd.includes("binom");
      const f = node(
        m(
          "f",
          (binom || cmd === "ifrac"
            ? m("fPr", m("type", "", { val: binom ? "noBar" : "skw" }))
            : "") +
            arg("num", a) +
            arg("den", b),
        ),
        tag(
          "mfrac",
          tag("mrow", a.mathML) + tag("mrow", b.mathML),
          binom ? { linethickness: 0 } : {},
        ),
      );
      return binom
        ? node(
            m(
              "d",
              m(
                "dPr",
                m("begChr", "", { val: "(" }) + m("endChr", "", { val: ")" }),
              ) + arg("e", f),
            ),
            tag("mrow", "<mo>(</mo>" + f.mathML + "<mo>)</mo>"),
          )
        : f;
    }
    if (cmd === "sqrt") {
      let degree;
      this.space();
      if (this.source[this.i] === "[") {
        this.i++;
        degree = this.sequence("]");
        this.i++;
      }
      const a = this.group();
      return node(
        m(
          "rad",
          m("radPr", m("degHide", "", { val: degree ? 0 : 1 })) +
            arg("deg", degree || join([])) +
            arg("e", a),
        ),
        degree
          ? tag("mroot", tag("mrow", a.mathML) + tag("mrow", degree.mathML))
          : tag("msqrt", a.mathML),
      );
    }
    if (cmd === "left") {
      const left = this.delimiter(),
        body = this.sequence("\\right");
      if (!this.source.startsWith("\\right", this.i))
        this.fail("missing right delimiter");
      this.i += 6;
      const right = this.delimiter();
      return node(
        m(
          "d",
          m(
            "dPr",
            m("begChr", "", { val: left === "." ? "" : left }) +
              m("endChr", "", { val: right === "." ? "" : right }),
          ) + arg("e", body),
        ),
        tag(
          "mrow",
          tag("mo", esc(left === "." ? "" : left)) +
            body.mathML +
            tag("mo", esc(right === "." ? "" : right)),
        ),
      );
    }
    if (profile.ACCENT_COMMANDS[cmd]) {
      const a = this.group(),
        accent = profile.ACCENT_COMMANDS[cmd];
      return node(
        m("acc", m("accPr", m("chr", "", { val: accent })) + arg("e", a)),
        tag("mover", tag("mrow", a.mathML) + tag("mo", esc(accent))),
      );
    }
    if (
      [
        "overline",
        "underline",
        "overbrace",
        "underbrace",
        "overrightarrow",
        "overleftarrow",
      ].includes(cmd)
    ) {
      const a = this.group(),
        under = cmd.startsWith("under"),
        chr = cmd.includes("brace")
          ? under
            ? "⏟"
            : "⏞"
          : cmd.includes("arrow")
            ? cmd.includes("left")
              ? "←"
              : "→"
            : "̅";
      return node(
        m(
          cmd.includes("line") ? "bar" : "groupChr",
          m(
            cmd.includes("line") ? "barPr" : "groupChrPr",
            m("pos", "", { val: under ? "bot" : "top" }) +
              (!cmd.includes("line") ? m("chr", "", { val: chr }) : ""),
          ) + arg("e", a),
        ),
        tag(under ? "munder" : "mover", tag("mrow", a.mathML) + tag("mo", chr)),
      );
    }
    if (["overset", "underset", "stackrel"].includes(cmd)) {
      const label = this.group(),
        a = this.group(),
        under = cmd === "underset";
      return node(
        m(under ? "limLow" : "limUpp", arg("e", a) + arg("lim", label)),
        tag(
          under ? "munder" : "mover",
          tag("mrow", a.mathML) + tag("mrow", label.mathML),
        ),
      );
    }
    if (cmd === "begin") {
      const env = this.rawGroup();
      if (
        ![
          "matrix",
          "pmatrix",
          "bmatrix",
          "Bmatrix",
          "vmatrix",
          "Vmatrix",
          "smallmatrix",
          "cases",
          "aligned",
          "align",
          "align*",
          "gathered",
          "gather",
          "gather*",
          "array",
          "eqnarray",
        ].includes(env)
      )
        this.fail("unknown environment " + env);
      if (env === "array") this.rawGroup();
      const end = `\\end{${env}}`,
        at = this.source.indexOf(end, this.i);
      if (at < 0) this.fail("unclosed environment");
      const raw = this.source.slice(this.i, at);
      this.i = at + end.length;
      const rows = raw
        .split(/\\\\(?:\[[^\]]*\])?/)
        .map((row) =>
          row.split("&").map((cell) => new Parser(cell).sequence()),
        );
      const matrix = node(
        m(
          "m",
          rows
            .map((row) => m("mr", row.map((c) => arg("e", c)).join("")))
            .join(""),
        ),
        tag(
          "mtable",
          rows
            .map((row) =>
              tag("mtr", row.map((c) => tag("mtd", c.mathML)).join("")),
            )
            .join(""),
        ),
      );
      const pair = {
        pmatrix: ["(", ")"],
        bmatrix: ["[", "]"],
        Bmatrix: ["{", "}"],
        vmatrix: ["|", "|"],
        Vmatrix: ["‖", "‖"],
        cases: ["{", ""],
      }[env];
      return pair
        ? node(
            m(
              "d",
              m(
                "dPr",
                m("begChr", "", { val: pair[0] }) +
                  m("endChr", "", { val: pair[1] }),
              ) + arg("e", matrix),
            ),
            tag(
              "mrow",
              tag("mo", pair[0]) + matrix.mathML + tag("mo", pair[1]),
            ),
          )
        : matrix;
    }
    const style = {
      mathrm: "p",
      mathbf: "b",
      mathit: "i",
      boldsymbol: "bi",
      bm: "bi",
      mathsf: "p",
      mathtt: "p",
      mathbb: "p",
      mathcal: "p",
      mathscr: "p",
      mathfrak: "p",
    }[cmd];
    if (style) {
      const a = this.group(),
        script = {
          mathsf: "sans-serif",
          mathtt: "monospace",
          mathbb: "double-struck",
          mathcal: "script",
          mathscr: "script",
          mathfrak: "fraktur",
        }[cmd];
      return node(
        a.omml.replace(
          /<m:r>/g,
          () =>
            "<m:r>" +
            m(
              "rPr",
              m("sty", "", { val: style }) +
                (script ? m("scr", "", { val: script }) : ""),
            ),
        ),
        tag("mstyle", a.mathML, {
          mathvariant:
            script ||
            { p: "normal", b: "bold", i: "italic", bi: "bold-italic" }[style],
        }),
      );
    }
    if (
      [
        "text",
        "textrm",
        "textnormal",
        "textbf",
        "textit",
        "mbox",
        "hbox",
        "operatorname",
      ].includes(cmd)
    ) {
      const value = this.rawGroup();
      return node(
        m("r", m("rPr", m("nor", "", { val: 1 })) + m("t", esc(value))),
        tag("mtext", esc(value)),
      );
    }
    if (
      [
        "sin",
        "cos",
        "tan",
        "cot",
        "sec",
        "csc",
        "arcsin",
        "arccos",
        "arctan",
        "sinh",
        "cosh",
        "tanh",
        "log",
        "ln",
        "exp",
        "lim",
        "min",
        "max",
        "det",
        "gcd",
        "sup",
        "inf",
      ].includes(cmd)
    )
      return node(
        m("r", m("rPr", m("sty", "", { val: "p" })) + m("t", cmd)),
        tag("mi", cmd, { mathvariant: "normal" }),
      );
    if (
      [
        "boxed",
        "fbox",
        "framebox",
        "cancel",
        "bcancel",
        "xcancel",
        "phantom",
        "hphantom",
        "vphantom",
      ].includes(cmd)
    ) {
      const a = this.group();
      const props =
        cmd === "cancel"
          ? m("borderBoxPr", m("strikeBLTR", "", { val: 1 }))
          : cmd === "bcancel"
            ? m("borderBoxPr", m("strikeTLBR", "", { val: 1 }))
            : cmd === "xcancel"
              ? m(
                  "borderBoxPr",
                  m("strikeBLTR", "", { val: 1 }) +
                    m("strikeTLBR", "", { val: 1 }),
                )
              : "";
      return node(
        m(cmd.includes("phantom") ? "phant" : "borderBox", props + arg("e", a)),
        cmd.includes("phantom") ? tag("mphantom", a.mathML) : a.mathML,
      );
    }
    if (cmd === "bra" || cmd === "ket") {
      const a = this.group(),
        pair = cmd === "bra" ? ["⟨", "|"] : ["|", "⟩"];
      return node(
        m(
          "d",
          m(
            "dPr",
            m("begChr", "", { val: pair[0] }) +
              m("endChr", "", { val: pair[1] }),
          ) + arg("e", a),
        ),
        tag("mrow", tag("mo", pair[0]) + a.mathML + tag("mo", pair[1])),
      );
    }
    if (cmd === "substack" || cmd === "eqalign") {
      const raw = this.rawGroup().replace(/\\cr\b/g, "\\\\");
      return new Parser(`\\begin{aligned}${raw}\\end{aligned}`).sequence();
    }
    if (cmd === "pmod" || cmd === "mod") {
      const a = this.group(),
        content = join([text("mod "), a]);
      return cmd === "mod"
        ? content
        : node(
            m(
              "d",
              m(
                "dPr",
                m("begChr", "", { val: "(" }) + m("endChr", "", { val: ")" }),
              ) + arg("e", content),
            ),
            tag("mrow", "<mo>(</mo>" + content.mathML + "<mo>)</mo>"),
          );
    }
    if (cmd === "not") {
      const a = this.group();
      return node(
        m("acc", m("accPr", m("chr", "", { val: "̸" })) + arg("e", a)),
        tag("menclose", a.mathML, { notation: "updiagonalstrike" }),
      );
    }
    if (["color", "textcolor"].includes(cmd)) {
      const color = this.rawGroup(),
        hex = profile.COLOR_NAMES[color] || color.replace(/^#/, "");
      if (!/^[0-9a-f]{6}$/i.test(hex)) this.fail("invalid math color");
      const a = this.group();
      return node(
        a.omml.replace(
          /<m:r>/g,
          () =>
            "<m:r>" +
            tag(
              "a:rPr",
              tag("a:solidFill", tag("a:srgbClr", "", { val: hex })),
            ),
        ),
        tag("mstyle", a.mathML, { mathcolor: "#" + hex }),
      );
    }
    if (
      cmd in profile.SPACING_COMMANDS ||
      [",", ";", ":", "!", "quad", "qquad", " "].includes(cmd)
    )
      return text(cmd === "!" ? "" : " ");
    if (
      [
        "displaystyle",
        "textstyle",
        "scriptstyle",
        "scriptscriptstyle",
        "limits",
        "nolimits",
        "relax",
      ].includes(cmd)
    )
      return join([]);
    if (["{", "}", "%", "$", "#", "_", "&", "|"].includes(cmd))
      return text(cmd);
    this.fail("unsupported command \\" + cmd);
  }
}
export function compileLatex(latex, { display = true } = {}) {
  if (typeof latex !== "string" || !latex.trim() || latex.length > 65536)
    throw Error(
      "Native formula requires nonempty LaTeX up to 65536 characters.",
    );
  const p = new Parser(expandMacros(latex.replace(/^\$\$?|\$\$?$/g, ""))),
    n = p.sequence();
  const math = m("oMath", n.omml);
  return { omml: display ? m("oMathPara", math) : math, mathML: n.mathML };
}
function expandMacros(source) {
  const macros = new Map();
  let output = "",
    i = 0;
  const group = () => {
    while (/\s/.test(source[i] || "") && i < source.length) i++;
    if (source[i++] !== "{")
      throw Error("Native formula macro requires a braced argument.");
    let depth = 1,
      value = "";
    while (i < source.length) {
      const c = source[i++];
      if (c === "\\") {
        value += c + (source[i++] || "");
        continue;
      }
      if (c === "{") depth++;
      if (c === "}" && !--depth) return value;
      value += c;
    }
    throw Error("Unclosed formula macro.");
  };
  while (i < source.length) {
    const definition = /^\\(newcommand|renewcommand|def)\b/.exec(
      source.slice(i),
    );
    if (!definition) {
      output += source[i++];
      continue;
    }
    i += definition[0].length;
    while (/\s/.test(source[i] || "") && i < source.length) i++;
    let name,
      count = 0;
    if (definition[1] === "def") {
      const match = /^\\([a-zA-Z]+)/.exec(source.slice(i));
      if (!match) throw Error("Invalid formula macro name.");
      name = match[1];
      i += match[0].length;
      while (/^#\d/.test(source.slice(i))) {
        const next = Number(source[i + 1]);
        if (next !== count + 1)
          throw Error("Macro parameters must be consecutive.");
        count++;
        i += 2;
      }
    } else {
      const value =
        source[i] === "{" ? group() : /^\\[A-Za-z]+/.exec(source.slice(i))?.[0];
      if (!value || !/^\\[A-Za-z]+$/.test(value))
        throw Error("Invalid formula macro name.");
      name = value.slice(1);
      if (source[i - 1] !== "}") i += value.length;
      while (/\s/.test(source[i] || "") && i < source.length) i++;
      if (source[i] === "[") {
        const close = source.indexOf("]", i);
        if (close < 0) throw Error("Unclosed macro arity.");
        count = Number(source.slice(i + 1, close));
        if (!Number.isInteger(count) || count < 0 || count > 9)
          throw Error("Macro arity must be 0..9.");
        i = close + 1;
      }
    }
    const body = group();
    if (definition[1] === "newcommand" && macros.has(name))
      throw Error("Duplicate formula macro.");
    macros.set(name, { body, count });
  }
  let expansions = 0;
  source = output;
  while (true) {
    let changed = false;
    output = "";
    i = 0;
    while (i < source.length) {
      const match = /^\\([a-zA-Z]+)/.exec(source.slice(i)),
        macro = match && macros.get(match[1]);
      if (!macro) {
        output += source[i++];
        continue;
      }
      if (++expansions > 500)
        throw Error("Formula macro expansion limit exceeded.");
      changed = true;
      i += match[0].length;
      const args = Array.from({ length: macro.count }, () => group());
      output += macro.body.replace(
        /#([1-9])/g,
        (_, n) => args[Number(n) - 1] ?? "",
      );
      if (output.length > 1048576) throw Error("Expanded formula is too long.");
    }
    if (!changed) return output;
    source = output;
  }
}
