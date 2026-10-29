// PPT Master native chart payload -> editable OOXML chart part and editor preview.
import { editorColor } from "./colors.mjs";
import { compileChartEx } from "./ppt-master-chartex.mjs";
import { excelColumn } from "shared-vuejs/api/edlib-pptx-export-chart-workbook";
import chartAliases from "./data/ppt-master-chart-types.mjs";
const number = (v, name) => {
  if (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > 1e15)
    throw Error(`Chart ${name} must be finite numeric data.`);
  return v;
};
const val = (v) => ({ $_val: v });
const points = (values, numeric) => ({
  "c:ptCount": val(values.length),
  "c:pt": values.flatMap((v, i) =>
    v === null
      ? []
      : [{ $_idx: i, "c:v": String(numeric ? number(v, "point") : v) }],
  ),
  ...(numeric ? { "c:formatCode": "General" } : {}),
});
const fill = (color) => ({
  "a:solidFill": { "a:srgbClr": val(editorColor(color).uniClr.$_val) },
});
const colors = [
  "#4472C4",
  "#ED7D31",
  "#A5A5A5",
  "#FFC000",
  "#5B9BD5",
  "#70AD47",
];
const title = (text) => ({
  "c:tx": {
    "c:rich": {
      "a:bodyPr": {},
      "a:lstStyle": {},
      "a:p": { "a:r": { "a:t": String(text) } },
    },
  },
  "c:overlay": val(0),
});
const compact = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export function compileNativeChart(payload) {
  let type = compact(payload.type || payload.chart_type || "column"),
    grouping = payload.grouping;
  if (type.startsWith("3d")) type = "threed" + type.slice(2);
  if (type.startsWith("100percentstacked"))
    type = type.slice(17) + "stacked100";
  if (type.startsWith("percentstacked")) type = type.slice(14) + "stacked100";
  const alias = chartAliases[type];
  grouping ??= alias?.[1];
  const aliasStyle = alias?.[2];
  if (alias?.[0] === "stock" && !payload.series)
    payload = {
      ...payload,
      categories: payload.categories || payload.dates,
      series: ["open", "high", "low", "close"].map((name) => ({
        name,
        values: payload[name],
      })),
    };
  const extended = {
    boxandwhisker: "box_whisker",
    boxplot: "box_whisker",
    boxwhisker: "box_whisker",
    funnel: "funnel",
    funnelchart: "funnel",
    histogram: "histogram",
    histogramchart: "histogram",
    pareto: "pareto",
    paretochart: "pareto",
    sunburst: "sunburst",
    sunburstchart: "sunburst",
    treemap: "treemap",
    treemapchart: "treemap",
    waterfall: "waterfall",
    waterfallchart: "waterfall",
    box_whisker: "box_whisker",
  }[alias?.[0] || type];
  if (extended) return compileChartEx(payload, extended);
  if (type.includes("stacked100") || type.endsWith("100"))
    grouping = "percentStacked";
  else if (type.includes("stacked")) grouping = "stacked";
  const kind = alias
    ? alias[0] === "of_pie"
      ? "ofPie"
      : alias[0]
    : type.startsWith("column")
      ? "column"
      : type.startsWith("bar") && !type.startsWith("barof")
        ? "bar"
        : type.startsWith("line")
          ? "line"
          : type.startsWith("area")
            ? "area"
            : type.startsWith("scatter") || type === "xy"
              ? "scatter"
              : type.startsWith("radar")
                ? "radar"
                : { donut: "doughnut", pieofpie: "ofPie", barofpie: "ofPie" }[
                    type
                  ] || type;
  const allowed = [
    "column",
    "bar",
    "line",
    "area",
    "pie",
    "doughnut",
    "scatter",
    "bubble",
    "radar",
    "stock",
    "surface",
    "surface3d",
    "column3d",
    "bar3d",
    "pie3d",
    "line3d",
    "area3d",
    "ofPie",
    "combo",
  ];
  if (!allowed.includes(kind))
    throw Error(
      `Chart type ${type} needs the ChartEx/source-package bridge; it will not be flattened to another chart type.`,
    );
  const series = payload.series;
  if (!Array.isArray(series) || !series.length || series.length > 100)
    throw Error("Chart requires 1..100 data series.");
  const categories = payload.categories || [];
  if (categories.length > 1000) throw Error("Too many chart categories.");
  const xy = ["scatter", "bubble"].includes(kind),
    pie = ["pie", "doughnut", "pie3d", "ofPie"].includes(kind);
  if (!xy && !categories.length)
    throw Error("Category charts require categories.");
  if (pie && series.length !== 1)
    throw Error("Pie/doughnut requires exactly one series.");
  const axisIds = [val(100001), val(100002)],
    plot = { "c:layout": {} },
    preview = [],
    workbookRows = xy
      ? []
      : [
          ["Category", ...series.map((s, i) => s.name || `Series ${i + 1}`)],
          ...categories.map((c, j) => [
            c,
            ...series.map((s) => (s.values || s.data)?.[j] ?? null),
          ]),
        ];
  const plots = new Map();
  for (const [i, s] of series.entries()) {
    const chartKind =
      kind === "combo" ? compact(s.type || s.chart_type || "column") : kind;
    if (
      kind === "combo" &&
      !["bar", "column", "line", "area", "scatter"].includes(chartKind)
    )
      throw Error("Invalid combo series type.");
    const tagKind =
      chartKind === "column"
        ? "bar"
        : chartKind === "column3d"
          ? "bar3D"
          : chartKind === "bar3d"
            ? "bar3D"
            : chartKind.endsWith("3d")
              ? chartKind.slice(0, -2) + "3D"
              : chartKind;
    const key = `c:${tagKind}Chart`;
    let chart = plots.get(key);
    if (!chart) {
      chart = {
        ...(chartKind === "bar" || chartKind === "column" || tagKind === "bar3D"
          ? {
              "c:barDir": val(chartKind.startsWith("bar") ? "bar" : "col"),
              "c:grouping": val(grouping || "clustered"),
            }
          : {
              ...(["line", "area", "line3d", "area3d"].includes(chartKind)
                ? { "c:grouping": val(grouping || "standard") }
                : { "c:varyColors": val(pie ? 1 : 0) }),
            }),
        "c:ser": [],
        ...(pie ? {} : { "c:axId": axisIds }),
      };
      if (chartKind === "scatter")
        chart["c:scatterStyle"] = val(
          payload.scatter_style || aliasStyle || "lineMarker",
        );
      if (chartKind === "radar")
        chart["c:radarStyle"] = val(
          (payload.radar_style || aliasStyle) === "filled"
            ? "filled"
            : "marker",
        );
      if (chartKind === "doughnut") {
        const hole = payload.hole_size ?? 75;
        if (!Number.isInteger(hole) || hole < 10 || hole > 90)
          throw Error("Doughnut hole_size must be 10..90.");
        chart["c:holeSize"] = val(hole);
      }
      if (chartKind === "ofPie")
        chart["c:ofPieType"] = val(type === "barofpie" ? "bar" : "pie");
      if (payload.gap_width !== undefined)
        chart["c:gapWidth"] = val(number(payload.gap_width, "gap_width"));
      if (payload.overlap !== undefined)
        chart["c:overlap"] = val(number(payload.overlap, "overlap"));
      plots.set(key, chart);
    }
    const values = s.values || s.data,
      pointData = s.points;
    let xs, ys, sizes;
    if (xy || chartKind === "scatter") {
      if (Array.isArray(pointData)) {
        xs = pointData.map((p) => (Array.isArray(p) ? p[0] : p.x));
        ys = pointData.map((p) => (Array.isArray(p) ? p[1] : p.y));
        sizes = pointData.map((p) => (Array.isArray(p) ? p[2] : p.size));
      } else {
        xs = s.x_values || s.x;
        ys = s.y_values || s.y || values;
        sizes = s.sizes || s.bubble_sizes;
      }
      if (
        !Array.isArray(xs) ||
        !Array.isArray(ys) ||
        xs.length !== ys.length ||
        !xs.length
      )
        throw Error("XY chart requires matching x/y values.");
    } else if (!Array.isArray(values) || values.length !== categories.length)
      throw Error("Chart values must match categories.");
    if (
      pie &&
      (values.some((v) => v === null || number(v, "pie value") < 0) ||
        !values.some((v) => v > 0))
    )
      throw Error(
        "Pie data must have a positive total and nonnegative values.",
      );
    const color = s.color || payload.colors?.[i] || colors[i % colors.length];
    const native = {
      "c:idx": val(i),
      "c:order": val(i),
      "c:tx": { "c:v": String(s.name || `Series ${i + 1}`) },
      "c:spPr": {
        ...fill(color),
        ...(["line", "scatter", "radar", "line3d"].includes(chartKind)
          ? {
              "a:ln": {
                $_w: Math.round(
                  (s.line_width ?? payload.line_width ?? 3) * 9525,
                ),
                ...fill(color),
              },
            }
          : {}),
      },
      ...(xs
        ? {
            "c:xVal": { "c:numLit": points(xs, true) },
            "c:yVal": { "c:numLit": points(ys, true) },
          }
        : {
            "c:cat": { "c:strLit": points(categories, false) },
            "c:val": { "c:numLit": points(values, true) },
          }),
    };
    const reference = (vs, col, numeric) => ({
      [numeric ? "c:numRef" : "c:strRef"]: {
        "c:f": `Sheet1!$${excelColumn(col)}$2:$${excelColumn(col)}$${vs.length + 1}`,
        [numeric ? "c:numCache" : "c:strCache"]: points(vs, numeric),
      },
    });
    if (!xs) {
      native["c:cat"] = reference(categories, 0, false);
      native["c:val"] = reference(values, i + 1, true);
    } else if (xy) {
      const start = (kind === "bubble" ? 3 : 2) * i;
      workbookRows[0] ||= [];
      Object.assign(workbookRows[0], {
        [start]: `${s.name || "Series"} X`,
        [start + 1]: `${s.name || "Series"} Y`,
      });
      xs.forEach((x, j) => {
        workbookRows[j + 1] ||= [];
        workbookRows[j + 1][start] = x;
        workbookRows[j + 1][start + 1] = ys[j];
      });
      native["c:xVal"] = reference(xs, start, true);
      native["c:yVal"] = reference(ys, start + 1, true);
      if (kind === "bubble") {
        workbookRows[0][start + 2] = `${s.name || "Series"} Size`;
        sizes?.forEach((v, j) => (workbookRows[j + 1][start + 2] = v));
      }
    }
    if (chartKind === "bubble") {
      if (
        !Array.isArray(sizes) ||
        sizes.length !== xs.length ||
        sizes.some((v) => number(v, "bubble size") < 0)
      )
        throw Error("Bubble sizes must match x/y data and be nonnegative.");
      native["c:bubbleSize"] = { "c:numLit": points(sizes, true) };
    }
    const pointColors = s.point_colors;
    if (pointColors) {
      if (pointColors.length !== (xs || values).length)
        throw Error("Point color count mismatch.");
      native["c:dPt"] = pointColors.flatMap((c, idx) =>
        c ? [{ "c:idx": val(idx), "c:spPr": fill(c) }] : [],
      );
    }
    if (s.marker || payload.marker || chartKind === "line") {
      native["c:marker"] = {
        "c:symbol": val(
          s.marker ||
            payload.marker ||
            (aliasStyle === "line" ? "none" : "circle"),
        ),
        ...(s.marker_size || payload.marker_size
          ? {
              "c:size": val(
                Math.round((s.marker_size || payload.marker_size) * 0.75),
              ),
            }
          : {}),
      };
    }
    if (pie && aliasStyle === "exploded")
      native["c:explosion"] = val(payload.explosion ?? 25);
    if (payload.smooth !== undefined)
      native["c:smooth"] = val(payload.smooth ? 1 : 0);
    chart["c:ser"].push(
      Object.fromEntries(
        [
          "c:idx",
          "c:order",
          "c:tx",
          "c:spPr",
          "c:marker",
          "c:explosion",
          "c:dPt",
          "c:dLbls",
          "c:cat",
          "c:xVal",
          "c:val",
          "c:yVal",
          "c:bubbleSize",
          "c:smooth",
        ]
          .filter((k) => k in native)
          .map((k) => [k, native[k]]),
      ),
    );
    const eType = pie
      ? "pie"
      : chartKind === "scatter" || chartKind === "bubble"
        ? "scatter"
        : ["bar", "column", "column3d", "bar3d"].includes(chartKind)
          ? "bar"
          : chartKind === "radar"
            ? "radar"
            : "line";
    preview.push({
      name: s.name || `Series ${i + 1}`,
      type: eType,
      ...(grouping?.includes("Stacked") || grouping === "stacked"
        ? { stack: "total" }
        : {}),
      ...(chartKind === "area" ? { areaStyle: {} } : {}),
      ...(chartKind === "doughnut"
        ? { radius: [`${payload.hole_size ?? 75}%`, "90%"] }
        : {}),
      data: xs
        ? xs.map((x, j) => [x, ys[j], ...(sizes ? [sizes[j]] : [])])
        : pie
          ? values.map((v, j) => ({ name: categories[j], value: v }))
          : values,
    });
  }
  Object.assign(plot, Object.fromEntries(plots));
  if (!pie) {
    for (const [index, role] of (xy
      ? ["x", "y"]
      : ["category", "value"]
    ).entries()) {
      const config = payload.axes?.[role] || {},
        valueAxis = xy || index === 1,
        id = axisIds[index],
        other = axisIds[1 - index];
      const scale = {
        "c:orientation": val(config.reverse ? "maxMin" : "minMax"),
      };
      for (const field of ["min", "max", "log_base"])
        if (config[field] !== undefined)
          scale["c:" + (field === "log_base" ? "logBase" : field)] = val(
            number(config[field], field),
          );
      const axis = {
        "c:axId": id,
        "c:scaling": scale,
        "c:delete": val(config.visible === false ? 1 : 0),
        "c:axPos": val(
          { bottom: "b", top: "t", left: "l", right: "r" }[config.position] ||
            (kind === "bar" ? (index ? "b" : "l") : index ? "l" : "b"),
        ),
        "c:crossAx": other,
        "c:crosses": val("autoZero"),
        "c:numFmt": {
          $_formatCode: config.number_format || "General",
          $_sourceLinked: 0,
        },
        "c:tickLblPos": val(
          config.label_position === "none"
            ? "none"
            : config.label_position === "next_to"
              ? "nextTo"
              : config.label_position || "nextTo",
        ),
      };
      if (config.title) axis["c:title"] = title(config.title);
      if (config.major_gridlines) axis["c:majorGridlines"] = {};
      if (valueAxis)
        axis["c:crossBetween"] = val(config.cross_between || "between");
      const key = "c:" + (valueAxis ? "valAx" : "catAx");
      plot[key] = plot[key]
        ? [...(Array.isArray(plot[key]) ? plot[key] : [plot[key]]), axis]
        : axis;
    }
  }
  if (payload.data_labels) {
    const labels =
      typeof payload.data_labels === "object" ? payload.data_labels : {};
    for (const chart of plots.values())
      chart["c:dLbls"] = {
        "c:showVal": val(labels.show_value === false ? 0 : 1),
        "c:showCatName": val(labels.show_category ? 1 : 0),
        "c:showSerName": val(labels.show_series ? 1 : 0),
        "c:showPercent": val(labels.show_percent ? 1 : 0),
        ...(labels.position
          ? {
              "c:dLblPos": val(
                {
                  above: "t",
                  center: "ctr",
                  outside_end: "outEnd",
                  inside_end: "inEnd",
                  inside_base: "inBase",
                }[labels.position] || labels.position,
              ),
            }
          : {}),
      };
  }
  const chart = {
    "c:plotArea": plot,
    "c:plotVisOnly": val(1),
    "c:dispBlanksAs": val(payload.display_blanks_as || "gap"),
    ...(payload.title
      ? { "c:title": title(payload.title) }
      : { "c:autoTitleDeleted": val(1) }),
    ...(payload.legend === false
      ? {}
      : {
          "c:legend": {
            "c:legendPos": val(
              typeof payload.legend === "object"
                ? { bottom: "b", top: "t", left: "l", right: "r" }[
                    payload.legend.position
                  ] || "b"
                : "b",
            ),
            "c:overlay": val(0),
          },
        }),
  };
  const chartJson = {
    "c:chartSpace": {
      "$_xmlns:c": "http://schemas.openxmlformats.org/drawingml/2006/chart",
      "$_xmlns:a": "http://schemas.openxmlformats.org/drawingml/2006/main",
      "$_xmlns:r":
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "c:chart": chart,
    },
  };
  return {
    type: "chart",
    $_otag: "graphicFrame",
    chartWorkbookRows: workbookRows,
    graphic: {
      graphicData: {
        $_uri: "http://schemas.openxmlformats.org/drawingml/2006/chart",
        "c:chart": { chartJson },
      },
    },
    chartData: {
      animation: false,
      color: payload.colors || colors,
      ...(payload.title ? { title: { text: payload.title } } : {}),
      legend: { show: payload.legend !== false },
      ...(pie
        ? {}
        : {
            xAxis: {
              type: xy ? "value" : "category",
              data: xy ? undefined : categories,
            },
            yAxis: { type: "value" },
          }),
      series: preview,
    },
  };
}
