// Port of native_objects/chartex.py: cache-backed native extended chart parts.
const uri = "http://schemas.microsoft.com/office/drawing/2014/chartex";
const n = (v) => {
  if (typeof v !== "number" || !Number.isFinite(v))
    throw Error("ChartEx values must be finite numbers.");
  return v;
};
const values = (p) => {
  const a = p.values || p.series?.[0]?.values;
  if (!Array.isArray(a) || !a.length || a.length > 10000)
    throw Error("ChartEx requires bounded nonempty values.");
  return a.map(n);
};
const lvl = (vs) => ({
  $_ptCount: vs.length,
  "cx:pt": vs.map((v, i) => ({ $_idx: i, text: String(v) })),
});
const num = (vs, type) => ({
  $_type: type,
  "cx:lvl": { ...lvl(vs), $_formatCode: "General" },
});
const str = (levels) => ({
  $_type: "cat",
  "cx:lvl": [...levels].reverse().map(lvl),
});
const v = (value) => ({ $_val: value });
export function compileChartEx(payload, type) {
  let datasets = [],
    series = [],
    preview;
  const name =
    typeof payload.title === "object"
      ? payload.title.text
      : payload.title || payload.name || type;
  const tx = (text) => ({ "cx:txData": { "cx:v": String(text) } });
  const base = (layout, id, text) => ({
    $_layoutId: layout,
    $_uniqueId: `{00000000-0000-4000-8000-${String(id + 1).padStart(12, "0")}}`,
    "cx:tx": tx(text),
    "cx:dataId": v(id),
  });
  const categories = (p, length) => {
    const cats =
      p.categories || Array.from({ length }, (_, i) => String(i + 1));
    if (!Array.isArray(cats) || cats.length !== length)
      throw Error("ChartEx categories must match values.");
    return cats.map(String);
  };
  if (type === "box_whisker") {
    if (!Array.isArray(payload.series) || !payload.series.length)
      throw Error("Box whisker needs series.");
    datasets = payload.series.map((s, i) => {
      const vs = values(s),
        cats =
          s.categories || Array(vs.length).fill(s.name || `Series ${i + 1}`);
      if (cats.length !== vs.length)
        throw Error("Box whisker categories must match samples.");
      series.push({
        ...base("boxWhisker", i, s.name || `Series ${i + 1}`),
        "cx:layoutPr": {
          "cx:visibility": { $_meanMarker: 1, $_outliers: 1 },
          "cx:statistics": { $_quartileMethod: "exclusive" },
        },
      });
      return { $_id: i, "cx:strDim": str([cats]), "cx:numDim": num(vs, "val") };
    });
    const stats = payload.series.map((s) => {
      const sorted = [...values(s)].sort((a, b) => a - b);
      const q = (p) => sorted[Math.floor((sorted.length - 1) * p)];
      return [sorted[0], q(0.25), q(0.5), q(0.75), sorted.at(-1)];
    });
    preview = {
      xAxis: {
        type: "category",
        data: payload.series.map((s, i) => s.name || `Series ${i + 1}`),
      },
      yAxis: { type: "value" },
      series: [{ type: "boxplot", data: stats }],
    };
  } else {
    const vs = values(payload),
      cats = categories(payload, vs.length),
      hierarchy = ["treemap", "sunburst"].includes(type);
    let levels = payload.levels || [cats];
    if (hierarchy) {
      if (
        !Array.isArray(levels) ||
        !levels.length ||
        levels.some((l) => !Array.isArray(l) || l.length !== vs.length)
      )
        throw Error("ChartEx hierarchy levels must match values.");
      if (vs.some((v) => v < 0))
        throw Error("Hierarchy values must be nonnegative.");
    }
    datasets = [
      {
        $_id: 0,
        ...(type === "histogram"
          ? {}
          : { "cx:strDim": str(hierarchy ? levels : [cats]) }),
        "cx:numDim": num(vs, hierarchy ? "size" : "val"),
      },
    ];
    const layout =
      type === "histogram" || type === "pareto" ? "clusteredColumn" : type;
    const s = base(layout, 0, name);
    if (type === "histogram")
      s["cx:layoutPr"] = { "cx:binning": { $_intervalClosed: "r" } };
    if (type === "pareto") {
      s["cx:layoutPr"] = { "cx:aggregation": {} };
      s["cx:axisId"] = v(1);
      series.push({
        ...base("paretoLine", 1, name),
        $_ownerIdx: 0,
        "cx:axisId": v(2),
      });
      delete series[0]["cx:dataId"];
    }
    if (type === "waterfall") {
      const indices = payload.subtotals || payload.subtotal_indices || [];
      if (
        !Array.isArray(indices) ||
        new Set(indices).size !== indices.length ||
        indices.some((i) => !Number.isInteger(i) || i < 0 || i >= vs.length)
      )
        throw Error("Invalid waterfall subtotal indices.");
      s["cx:layoutPr"] = { "cx:subtotals": { "cx:idx": indices.map(v) } };
    }
    if (type === "treemap")
      s["cx:layoutPr"] = {
        "cx:parentLabelLayout": v(payload.parent_labels || "overlapping"),
      };
    if (type !== "histogram")
      s["cx:dataLabels"] = {
        $_pos:
          type === "sunburst" ? "ctr" : type === "treemap" ? "inEnd" : "outEnd",
        "cx:visibility": {
          $_seriesName: 0,
          $_categoryName: hierarchy ? 1 : 0,
          $_value: 1,
        },
      };
    series.unshift(s);
    if (hierarchy) {
      const tree = [];
      for (let i = 0; i < vs.length; i++) {
        let children = tree;
        for (let l = 0; l < levels.length; l++) {
          const label = String(levels[l][i]);
          let entry = children.find((x) => x.name === label);
          if (!entry) {
            entry = {
              name: label,
              ...(l === levels.length - 1 ? { value: 0 } : { children: [] }),
            };
            children.push(entry);
          }
          if (l === levels.length - 1) entry.value += vs[i];
          else children = entry.children;
        }
      }
      preview = { series: [{ type, data: tree }] };
    } else if (type === "funnel")
      preview = {
        series: [
          {
            type: "funnel",
            data: vs.map((value, i) => ({ name: cats[i], value })),
          },
        ],
      };
    else if (type === "histogram") {
      const min = Math.min(...vs),
        max = Math.max(...vs),
        count = Math.max(1, Math.ceil(Math.sqrt(vs.length))),
        step = (max - min || 1) / count,
        bins = Array(count).fill(0);
      for (const value of vs)
        bins[Math.min(count - 1, Math.floor((value - min) / step))]++;
      preview = {
        xAxis: {
          type: "category",
          data: bins.map((_, i) => String(min + i * step)),
        },
        yAxis: { type: "value" },
        series: [{ type: "bar", data: bins }],
      };
    } else
      preview = {
        xAxis: { type: "category", data: cats },
        yAxis: { type: "value" },
        series: [{ type: "bar", data: vs }],
      };
  }
  const axes = ["sunburst", "treemap"].includes(type)
    ? []
    : type === "funnel"
      ? [
          {
            $_id: 1,
            "cx:catScaling": { $_gapWidth: 0.06 },
            "cx:tickLabels": {},
          },
        ]
      : [
          {
            $_id: 0,
            "cx:catScaling": {
              $_gapWidth:
                type === "box_whisker" ? 1 : type === "waterfall" ? 0.5 : 0,
            },
            "cx:tickLabels": {},
          },
          {
            $_id: 1,
            "cx:valScaling": {},
            "cx:majorGridlines": {},
            "cx:tickLabels": {},
          },
          ...(type === "pareto"
            ? [
                {
                  $_id: 2,
                  "cx:valScaling": { $_max: 1, $_min: 0 },
                  "cx:units": { $_unit: "percentage" },
                  "cx:tickLabels": {},
                },
              ]
            : []),
        ];
  const chartWorkbookRows = [[]];
  let column = 0;
  const col = (index) => {
    let out = "";
    for (let i = index + 1; i > 0; i = Math.floor((i - 1) / 26))
      out = String.fromCharCode(65 + ((i - 1) % 26)) + out;
    return out;
  };
  for (const data of datasets) {
    for (const key of ["cx:strDim", "cx:numDim"]) {
      const dim = data[key];
      if (!dim) continue;
      const levels = Array.isArray(dim["cx:lvl"])
        ? [...dim["cx:lvl"]].reverse()
        : [dim["cx:lvl"]];
      const start = column;
      let count = 0;
      for (const level of levels) {
        chartWorkbookRows[0][column] =
          key === "cx:strDim" ? `Category ${column + 1}` : name;
        for (const point of level["cx:pt"]) {
          const index = point.$_idx;
          chartWorkbookRows[index + 1] ||= [];
          chartWorkbookRows[index + 1][column] =
            key === "cx:numDim" ? Number(point.text) : point.text;
          count = Math.max(count, index + 1);
        }
        column++;
      }
      data[key] = {
        $_type: dim.$_type,
        "cx:f": `Sheet1!$${col(start)}$2:$${col(column - 1)}$${count + 1}`,
        "cx:lvl": dim["cx:lvl"],
      };
    }
  }
  series = series.map((s) =>
    Object.fromEntries(
      [
        "$_layoutId",
        "$_uniqueId",
        "$_ownerIdx",
        "cx:tx",
        "cx:dataLabels",
        "cx:dataId",
        "cx:layoutPr",
        "cx:axisId",
      ]
        .filter((k) => k in s)
        .map((k) => [k, s[k]]),
    ),
  );
  const chartJson = {
    "cx:chartSpace": {
      "$_xmlns:cx": uri,
      "$_xmlns:a": "http://schemas.openxmlformats.org/drawingml/2006/main",
      "$_xmlns:r":
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "cx:chartData": { "cx:data": datasets },
      "cx:chart": {
        ...(payload.title
          ? {
              "cx:title": {
                $_pos: "t",
                $_align: "ctr",
                $_overlay: 0,
                "cx:tx": tx(name),
              },
            }
          : {}),
        "cx:plotArea": {
          "cx:plotAreaRegion": { "cx:series": series },
          "cx:axis": axes,
        },
        ...(payload.legend === false
          ? {}
          : { "cx:legend": { $_pos: "b", $_align: "ctr", $_overlay: 0 } }),
      },
    },
  };
  return {
    type: "chart",
    $_otag: "graphicFrame",
    chartWorkbookRows,
    graphic: { graphicData: { $_uri: uri, "c:chart": { chartJson } } },
    chartData: { animation: false, ...preview },
  };
}
