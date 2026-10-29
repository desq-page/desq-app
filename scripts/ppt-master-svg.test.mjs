import test from "node:test";
import { SVGPathData } from "svg-pathdata";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  compilePageSVG,
  parseTransform,
  multiply,
} from "../editor-vuejs/src/lib/agent/ppt-master-svg.mjs";
import {
  compileDeck,
  deckImageRequests,
} from "../editor-vuejs/src/lib/agent/deck-compiler.mjs";
import { deckSchema } from "../editor-vuejs/src/lib/agent/deck-schema.mjs";
import { validateArguments } from "../editor-vuejs/src/lib/agent/editor-tools.mjs";
import { pptMasterReferences } from "./ppt-master-reference.mjs";
import { createHash } from "node:crypto";
import {
  evaluateFormula,
  formulaContext,
  completePresetAdjustments,
} from "../editor-vuejs/src/lib/agent/ppt-master-formula.mjs";
import presetDefaults from "../editor-vuejs/src/lib/agent/data/ppt-master-adjustments.mjs";
import { preflightDeckPlan } from "../editor-vuejs/src/lib/agent/deck-preflight.mjs";
import { nativeShapeStyle } from "../editor-vuejs/src/lib/agent/ppt-master-native.mjs";
let id = 0;
const options = {
  width: 1280,
  height: 720,
  genId: () => `svg-${++id}`,
  geometry: (p, w, h) => ({ d: `R0,0,${w},${h}` }),
};
const fixture = (name) =>
  readFileSync(`third_party/ppt-master/fixtures/${name}.svg`, "utf8");
const wrap = (body) => `<svg viewBox="0 0 1280 720">${body}</svg>`;

test("preserved native shape-style DrawingML maps directly to Savanna JSON", () => {
  const xml =
    '<p:style xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:lnRef idx="2"><a:schemeClr val="accent1"><a:alpha val="50000"/></a:schemeClr></a:lnRef><a:fillRef idx="1"><a:srgbClr val="FF0000"/></a:fillRef><a:effectRef idx="0"><a:schemeClr val="accent2"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr val="tx1"/></a:fontRef></p:style>';
  const encoded = Buffer.from(xml).toString("base64"),
    style = nativeShapeStyle(encoded);
  assert.equal(style.lnRef.$_idx, "2");
  assert.equal(style.lnRef.uniClr.$_otag, "schemeClr");
  assert.equal(style.lnRef.uniClr.alpha.$_val, "50000");
  const shape = compilePageSVG(
    wrap(`<rect width="100" height="100" data-pptx-shape-style="${encoded}"/>`),
    options,
  ).shapes[0];
  assert.deepEqual(shape.style, style);
  assert.throws(
    () =>
      nativeShapeStyle(
        Buffer.from(
          '<p:style xmlns:p="x" xmlns:r="y"><a r:id="rId1"/></p:style>',
        ).toString("base64"),
      ),
    /relationship/,
  );
});

test("upstream formula operators and all 187 preset adjustment defaults evaluate without code execution", () => {
  const context = formulaContext(200, 100);
  const cases = [
    ["val wd2", 100],
    ["*/ w 3 2", 300],
    ["+- w h 50", 250],
    ["+/ w h 2", 150],
    ["?: -1 7 9", 9],
    ["abs -7", 7],
    ["at2 0 1", 5400000],
    ["cat2 10 0 1", 0],
    ["cos 10 cd2", -10],
    ["max w h", 200],
    ["min w h", 100],
    ["mod 3 4 0", 5],
    ["pin 0 15 10", 10],
    ["sat2 10 0 1", 10],
    ["sin 10 cd4", 10],
    ["sqrt 49", 7],
    ["tan 10 cd8", 10],
    ["*/ w 1 0", 0],
  ];
  for (const [formula, expected] of cases)
    assert.ok(
      Math.abs(evaluateFormula(formula, context) - expected) < 1e-7,
      formula,
    );
  assert.equal(Object.keys(presetDefaults).length, 187);
  for (const name of Object.keys(presetDefaults))
    assert.ok(
      completePresetAdjustments(name, {}).every((g) =>
        /^val -?\d+$/.test(g.$_fmla),
      ),
    );
  assert.throws(() => evaluateFormula("eval alert(1)", context));
  assert.throws(
    () => completePresetAdjustments("roundRect", { unknown: "val 3" }),
    /no adjustment/,
  );
  const guides = completePresetAdjustments("round2SameRect", {
    adj2: "*/ adj1 1 2",
  });
  assert.equal(guides[0].$_name, "adj1");
  assert.equal(guides[1].$_name, "adj2");
});

test("gradient text and effects pass the preflight reviewer without solid-fill-only assumptions", () => {
  const svg = wrap(
    '<defs><radialGradient id="r"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#123456"/></radialGradient></defs><rect width="1280" height="720" fill="#ffffff"/><text x="50" y="100" fill="url(#r)">A gradient title</text>',
  );
  const proof = preflightDeckPlan(
    {
      calls: [
        {
          name: "savanna_create_deck",
          arguments: {
            title: "Gradient",
            audience: "Everyone",
            objective: "Test native paints",
            slides: [
              { title: "Title", purpose: "Explain", layout: "svg", svg },
            ],
          },
        },
      ],
    },
    { document: { width: 1280, height: 720 } },
  );
  assert.equal(proof.compiled.pages.length, 1);
  assert.equal(proof.previews.length, 1);
  assert.ok(proof.previews[0].url.includes("radialGradient"));
});

test("hyperlinks, non-scaling strokes and hidden objects retain upstream presentation semantics", () => {
  const svg = wrap(
    '<a href="https://example.com"><text x="40" y="80">A link</text><rect x="40" y="100" width="200" height="80"/></a><g transform="scale(2)"><line x1="10" y1="200" x2="200" y2="200" stroke="#000000" stroke-width="3" vector-effect="non-scaling-stroke"/></g><g display="none"><image href="https://example.com/unused.png"/></g>',
  );
  const result = compilePageSVG(svg, options).shapes;
  assert.equal(
    result[0].txBody.p[0].r[0].rPr.hlinkClick.$_target,
    "https://example.com",
  );
  assert.equal(result[1].link, "https://example.com");
  assert.equal(result[2].ln.$_w, 3 * 9525);
  assert.equal(
    deckImageRequests({ slides: [{ layout: "svg", svg }] }).length,
    0,
  );
  assert.throws(
    () =>
      compilePageSVG(
        wrap(
          '<a href="javascript:alert(1)"><text x="0" y="0">Unsafe</text></a>',
        ),
        options,
      ),
    /unsafe hyperlink/,
  );
});

test("vendored upstream references and fixtures match their pinned provenance manifest", () => {
  const files = JSON.parse(
    readFileSync("third_party/ppt-master/FILES.json", "utf8"),
  );
  for (const entry of files) {
    const content = readFileSync(
      `third_party/ppt-master/${entry.file}`,
      "utf8",
    ).replaceAll("\r\n", "\n");
    assert.equal(
      createHash("sha256").update(content).digest("hex"),
      entry.sha256LF,
      entry.file,
    );
  }
  assert.match(
    readFileSync("third_party/ppt-master/LICENSE", "utf8"),
    /Copyright \(c\) 2025-2026 Hugo He/,
  );
});

test("unmodified upstream editorial, Swiss and Memphis pages become native ordered objects without layout substitution", () => {
  for (const name of ["editorial", "swiss-minimal", "memphis"]) {
    const source = fixture(name),
      result = compilePageSVG(source, options);
    assert.ok(result.shapes.length > 10);
    assert.equal(result.shapes[0].w, 1280);
    assert.equal(result.shapes[0].h, 720);
    assert.ok(
      result.shapes.every((s) => s.$_otag === "sp" && !s.svg && !s.blipFill),
    );
    const texts = result.shapes
      .filter((s) => s.txBody)
      .map((s) => s.txBody.p.flatMap((p) => p.r.map((r) => r.t)).join(""));
    assert.ok(texts.some((t) => t.includes("Lorem")));
    assert.ok(result.shapes.some((s) => s.type === "path" && s.d));
  }
});
test("ported matrix multiplication preserves SVG transform order and path curves/arc extents", () => {
  assert.deepEqual(
    parseTransform("translate(10 20) scale(2)"),
    [2, 0, 0, 2, 10, 20],
  );
  assert.deepEqual(
    multiply([1, 0, 0, 1, 10, 20], [2, 0, 0, 3, 0, 0]),
    [2, 0, 0, 3, 10, 20],
  );
  const result = compilePageSVG(
    wrap(
      '<g transform="translate(10 20) scale(2)"><rect x="5" y="10" width="30" height="40"/></g>',
    ),
    options,
  ).shapes[0];
  assert.equal(result.x, 20);
  assert.equal(result.y, 40);
  assert.equal(result.w, 60);
  assert.equal(result.h, 80);
  const arc = compilePageSVG(
    wrap('<circle cx="100" cy="120" r="30"/>'),
    options,
  ).shapes[0];
  assert.ok(Math.abs(arc.x - 70) < 0.01 && Math.abs(arc.w - 60) < 0.01);
  assert.match(arc.d, /C/);
  assert.throws(() => parseTransform("translate(2) garbage"), /Invalid/);
});
test("upstream geometry/style conventions retain inline geometry, inherited paint, opacity and text emphasis", () => {
  const result = compilePageSVG(
    wrap(
      '<g fill="#abc" opacity="0.5"><rect style="x:10px;y:20px;width:100px;height:50px" opacity="0.5"/><text x="20" y="120" font-size="40" font-family="Georgia, serif" letter-spacing="2">Hello <tspan font-weight="bold" fill="#123456">World</tspan></text></g>',
    ),
    options,
  );
  assert.equal(result.shapes[0].x, 10);
  assert.equal(result.shapes[0].solidFill.uniClr.$_val, "AABBCC");
  assert.equal(result.shapes[0].solidFill.uniClr.alpha.$_val, 25000);
  const runs = result.shapes[1].txBody.p[0].r;
  assert.equal(runs.length, 2);
  assert.equal(runs[0].rPr.$_sz, 3000);
  assert.equal(runs[1].rPr.$_b, 1);
  assert.equal(runs[0].rPr.latin.$_typeface, "Georgia");
  assert.equal(runs[0].rPr.$_spc, 150);
});
test("gradient stops and local uses produce editable objects with bounded recursion", () => {
  const source = wrap(
    '<defs><linearGradient id="g"><stop offset="0" stop-color="#123456"/><stop offset="100%" stop-color="#abcdef"/></linearGradient><g id="icon"><rect width="20" height="30" fill="#ff0000"/></g></defs><rect width="1280" height="720" fill="url(#g)"/><use href="#icon" x="50" y="60"/>',
  );
  const shapes = compilePageSVG(source, options).shapes;
  assert.equal(shapes[0].gradFill.gsLst.gs[1].$_pos, 100000);
  assert.equal(shapes[1].x, 50);
  assert.equal(shapes[1].y, 60);
  assert.throws(
    () =>
      compilePageSVG(
        wrap(
          '<defs><g id="loop"><use href="#loop"/></g></defs><use href="#loop"/>',
        ),
        options,
      ),
    /limit/,
  );
});
test("unsafe or unsupported SVG branches fail explicitly before any insertion", () => {
  for (const source of [
    "<script>alert(1)</script>",
    "<foreignObject/>",
    '<rect width="10" height="10" onclick="alert(1)"/>',
    '<use href="https://example.com/x.svg"/>',
    '<rect width="10" height="10" filter="url(#f)"/>',
    '<text transform="matrix(1 0 1 1 0 0)" x="20" y="30">Sheared</text>',
    '<rect width="10" height="10" mask="url(#mask)"/>',
  ])
    assert.throws(() => compilePageSVG(wrap(source), options));
  assert.throws(() => compilePageSVG("<!DOCTYPE svg><svg/>", options));
});
test("SVG decks retain complete page authority and image descriptions through native compilation", () => {
  const svg = wrap(
    '<rect width="1280" height="720" fill="#ffffff"/><text x="40" y="80">Free page title</text><image x="50" y="150" width="400" height="300" data-query="A sunrise" aria-label="Sunrise"/>',
  );
  const deck = {
    title: "SVG deck",
    audience: "Leaders",
    objective: "Explain",
    slides: [
      { title: "One", purpose: "Introduce", layout: "svg", svg },
      {
        title: "Two",
        purpose: "Explain",
        layout: "svg",
        svg: fixture("memphis"),
      },
    ],
  };
  validateArguments(deckSchema, deck);
  const requests = deckImageRequests(deck);
  assert.deepEqual(requests, [
    { key: "0:svg:0", image: { query: "A sunrise", alt: "Sunrise" } },
  ]);
  const compiled = compileDeck(deck, options);
  assert.equal(compiled.pages[0].agentMetadata.engine, "ppt-master-svg");
  assert.ok(
    !compiled.pages[0].shapes.some(
      (s) => s.name === "Accent rule" || s.name === "Page number",
    ),
  );
  assert.ok(
    compiled.pages[0].shapes.some(
      (s) => s.imagePlaceholder?.description === "A sunrise",
    ),
  );
  assert.ok(pptMasterReferences.includes("Page Expression Core"));
  assert.ok(pptMasterReferences.includes('layout="svg"'));
});

test("upstream soft-rounded and glassmorphism effects map to native shadow/glow JSON", () => {
  const soft = compilePageSVG(fixture("soft-rounded"), options).shapes;
  const shadow = soft.find((s) => s.effectLst?.outerShdw).effectLst.outerShdw;
  assert.equal(shadow.$_blurRad, 56 * 9525);
  assert.equal(shadow.$_dist, 20 * 9525);
  assert.equal(shadow.$_dir, 90 * 60000);
  assert.equal(shadow.uniClr.$_val, "1D4ED8");
  assert.equal(shadow.uniClr.alpha.$_val, 12000);
  const glass = compilePageSVG(fixture("glassmorphism"), options).shapes;
  assert.ok(glass.some((s) => s.effectLst?.glow?.$_rad === 44 * 9525));
  assert.ok(
    glass.some((s) => s.gradFill?.gsLst.gs.some((gs) => gs.uniClr.alpha)),
  );
});

test("radial fills and gradient text keep DrawingML path focus and run-level paints", () => {
  const result = compilePageSVG(
    wrap(
      '<defs><radialGradient id="r" cx="50%" cy="50%" fx="25%" fy="50%"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></radialGradient></defs><rect width="1280" height="720" fill="url(#r)"/><text x="100" y="120" fill="url(#r)">Gradient text</text>',
    ),
    options,
  ).shapes;
  assert.deepEqual(result[0].gradFill.path, {
    $_path: "circle",
    fillToRect: { $_l: 25000, $_t: 50000, $_r: 75000, $_b: 50000 },
  });
  assert.equal(result[1].txBody.p[0].r[0].rPr.gradFill.path.$_path, "circle");
});

test("rotated/reflected text, positioned spans and native preset adjustments retain their transforms", () => {
  const result = compilePageSVG(
    wrap(
      '<text x="100" y="100" font-size="20" transform="rotate(90 100 100)">Hello</text><text x="30" y="200"><tspan x="40" dy="20">First</tspan><tspan x="40" dy="30">Second</tspan></text><rect x="20" y="30" width="100" height="60" data-pptx-prst="roundRect" data-pptx-av-adj="val 25000" transform="rotate(30 70 60)"/>',
    ),
    options,
  ).shapes;
  assert.ok(Math.abs(result[0].rot - 90) < 1e-8);
  assert.ok(Math.abs(result[0].x - (100+result[0].svgTextBaselineOffset-15-result[0].w/2)) < 1e-8);
  assert.ok(Math.abs(result[0].y - 117.5) < 1e-8);
  assert.equal(result[1].txBody.p[0].r[0].t, "First");
  assert.equal(result[1].txBody.p[1].r[0].t, "Second");
  assert.equal(result[1].txBody.p[0].pPr.lnSpc.spcPts.$_val, 2250);
  const preset = result[2];
  assert.equal(preset.prstGeom.$_prst, "roundRect");
  assert.equal(preset.prstGeom.avLst.gd[0].$_fmla, "val 25000");
  assert.ok(Math.abs(preset.rot - 30) < 1e-8);
});

test("picture clipping and slice crop map to native picture geometry and source rectangle", () => {
  const svg = wrap(
    '<defs><clipPath id="clip" clipPathUnits="objectBoundingBox"><ellipse cx=".5" cy=".5" rx=".5" ry=".5"/></clipPath></defs><image x="100" y="150" width="200" height="200" clip-path="url(#clip)" preserveAspectRatio="xMidYMid slice" data-query="Portrait" aria-label="Portrait" transform="rotate(15 200 250)"/>',
  );
  const assets = new Map([
    [
      "0:svg:0",
      {
        media: { name: "portrait.png", w: 800, h: 400 },
        title: "Portrait",
        author: "Artist",
        license: "CC0",
      },
    ],
  ]);
  const picture = compilePageSVG(svg, { ...options, assets }).shapes[0];
  assert.equal(picture.prstGeom.$_prst, "ellipse");
  assert.ok(picture.d);
  assert.ok(Math.abs(picture.rot - 15) < 1e-8);
  assert.deepEqual(picture.blipFill.srcRect, {
    $_l: 25000,
    $_r: 25000,
    $_t: 0,
    $_b: 0,
  });
  assert.equal(picture.blipFill.blip.$_target, "portrait.png");
});

test("native pattern fills, dash patterns, arrowheads and RGBA alpha survive conversion", () => {
  const svg = wrap(
    '<defs><pattern id="pat" data-pptx-pattern="diagCross" data-pptx-fg="#ff0000" data-pptx-bg="#ffffff"/><marker id="arrow" markerWidth="3" markerHeight="3"><path d="M0 0L6 3L0 6Z"/></marker></defs><rect width="100" height="100" fill="url(#pat)"/><line x1="50" y1="200" x2="300" y2="200" stroke="rgba(0,128,255,0.5)" stroke-width="2" stroke-dasharray="8 4 2 4" marker-end="url(#arrow)"/>',
  );
  const result = compilePageSVG(svg, options).shapes;
  assert.equal(result[0].pattFill.$_prst, "diagCross");
  assert.equal(result[0].pattFill.fgClr.uniClr.$_val, "FF0000");
  assert.equal(result[1].ln.prstDash.$_val, "lgDashDot");
  assert.equal(result[1].ln.tailEnd.$_type, "triangle");
  assert.equal(result[1].ln.tailEnd.$_w, "med");
  assert.equal(result[1].ln.solidFill.uniClr.alpha.$_val, 50000);
});

test("arbitrary SVG masks remain an explicit upstream-contract restriction", () => {
  assert.throws(
    () =>
      compilePageSVG(
        wrap('<rect width="100" height="100" mask="url(#x)"/>'),
        options,
      ),
    /PPT Master's SVG contract rejects arbitrary masks/,
  );
});

 test('partial picture presets retain local offsets, curves and picture frame', () => {
  const assets=new Map([['0:svg:0',{media:{name:'portrait.png',w:800,h:400}}]]);
  for(const [contour,units,bounds] of [
    ['<rect x="130" y="170" width="80" height="60"/>','userSpaceOnUse',[30,20,110,80]],
    ['<ellipse cx="50%" cy="50%" rx="25%" ry="20%"/>','objectBoundingBox',[50,60,150,140]],
    ['<rect x="120" y="170" width="80" height="60" rx="20" ry="10"/>','userSpaceOnUse',[20,20,100,80]],
    ['<rect x="80" y="130" width="80" height="60"/>','userSpaceOnUse',[0,0,60,40]],
  ]) {
    const svg=wrap(`<defs><clipPath id="c" clipPathUnits="${units}">${contour}</clipPath></defs><image x="100" y="150" width="200" height="200" preserveAspectRatio="none" clip-path="url(#c)" data-query="Portrait" aria-label="Portrait"/>`);
    const result=compilePageSVG(svg,{...options,assets}),picture=result.shapes[0];
    assert.equal(picture.type,'image',result.warnings.join());assert.equal(picture.prstGeom,undefined);
    assert.deepEqual([picture.x,picture.y,picture.w,picture.h],[100,150,200,200]);
    const b=new SVGPathData(picture.d).getBounds();
    [b.minX,b.minY,b.maxX,b.maxY].forEach((v,i)=>assert.ok(Math.abs(v-bounds[i])<.001,`${v} != ${bounds[i]}`));
    if(contour.includes('ellipse')||contour.includes('rx='))assert.match(picture.d,/C/);
  }
});

test('bad image clips and arbitrary URLs become described placeholders without losing other content',()=>{
  for(const attributes of ['clip-path="url(#missing)" data-query="Portrait" aria-label="Portrait"','href="https://example.com/x.png"']){
    const result=compilePageSVG(wrap(`<image x="20" y="30" width="200" height="100" ${attributes}/><text x="40" y="300">Still here</text>`),options);
    assert.equal(result.shapes.filter(s=>s.imagePlaceholder).length,1);
    assert.ok(result.shapes.some(s=>s.txBody?.p.some(p=>p.r?.some(r=>r.t==='Still here'))));
    assert.equal(result.warnings.length,1);
  }
});

test('invalid image descriptions do not shift subsequent image asset keys',()=>{
  const svg=wrap('<image href="https://example.com/a.png"/><image x="20" y="30" width="200" height="100" data-query="Valid subject" aria-label="Subject"/>');
  const spec={slides:[{layout:'svg',svg}]};
  assert.deepEqual(deckImageRequests(spec).map(r=>r.key),['0:svg:1']);
});

test('model-authored comments and standard XML headers compile without becoming page objects', () => {
  const body = '<rect x="80" y="160" width="200" height="100" fill="#087F8C"/><text x="80" y="100">Title</text>';
  const plain = compilePageSVG(wrap(body), options).shapes;
  const commented = compilePageSVG('<?xml version="1.0" encoding="UTF-8"?>\n<!-- A slide -->\n' + wrap('<!-- Header -->' + body + '<!-- Footer -->'), options).shapes;
  assert.equal(commented.length, plain.length);
  assert.equal(commented[1].txBody.p[0].r[0].t, 'Title');
  assert.equal(commented[0].x, plain[0].x);
  assert.equal(commented[0].w, plain[0].w);
});

test('SVG validation distinguishes limits and declarations and still rejects malformed comments', () => {
  assert.throws(() => compilePageSVG(wrap(' '.repeat(80000)), options), /too large.*maximum 80,000/);
  assert.throws(() => compilePageSVG('<!DOCTYPE svg><svg/>', options), /DOCTYPE or ENTITY/);
  assert.throws(() => compilePageSVG('<?xml-stylesheet href="external.css"?>' + wrap(''), options), /processing instructions/);
  assert.throws(() => compilePageSVG(wrap('<!-- bad -- comment -->'), options), /Malformed page SVG/);
  const shape = compilePageSVG(wrap('<text x="80" y="100"><![CDATA[Literal <!-- marker -->]]></text>'), options).shapes[0];
  assert.equal(shape.txBody.p[0].r[0].t, 'Literal <!-- marker -->');
});

test('SVG image placeholders show the exact attempted Wikimedia queries in their caption', () => {
  const searchQueries=['Ba Dinh Square panoramic view','Ba Dinh Hanoi'];
  const page=compilePageSVG(wrap('<image x="837" y="193" width="387" height="325" data-query="Ba Dinh Square panoramic view" aria-label="Ba Dinh Square"/>'),{
    ...options,assets:new Map([['0:svg:0',{placeholder:true,searchQueries}]]),
  });
  const text=page.shapes.flatMap(shape=>shape.txBody?.p.flatMap(p=>p.r.map(r=>r.t))||[]).join(' ');
  assert.match(text,/Search keywords: Ba Dinh Square panoramic view/);
  assert.match(text,/Retry keywords: Ba Dinh Hanoi/);
  assert.deepEqual(page.shapes.find(shape=>shape.imagePlaceholder).imagePlaceholder.searchQueries,searchQueries);
});

test('image search descriptions take precedence over redundant model-authored hrefs', () => {
  for(const href of ['href="https://example.com/placeholder.jpg"','xlink:href="data:image/png;base64,AAAA"','href="javascript:alert(1)"']){
    const svg=wrap(`<image x="20" y="30" width="200" height="100" ${href} data-query="hoa mai hoa đào tết" aria-label="Tet blossoms"/>`);
    const requests=deckImageRequests({slides:[{layout:'svg',svg}]});
    assert.deepEqual(requests,[{key:'0:svg:0',image:{query:'hoa mai hoa đào tết',alt:'Tet blossoms'}}]);
    const result=compilePageSVG(svg,{...options,assets:new Map([['0:svg:0',{media:{name:'resolved.webp',w:800,h:600},author:'Photographer',license:'CC0',sourceUrl:'https://commons.wikimedia.org/wiki/File:Flowers.jpg'}]])});
    const picture=result.shapes.find(shape=>shape.type==='image');
    assert.equal(picture.blipFill.blip.$_target,'resolved.webp');
    assert.equal(result.shapes.some(shape=>shape.imagePlaceholder),false);
    assert.equal(result.warnings.some(message=>message.includes('URLs are not accepted')),false);
  }
});
