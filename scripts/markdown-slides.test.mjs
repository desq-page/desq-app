import test from "node:test";
import assert from "node:assert/strict";
import {
  parseMarkdownSlides,
  markdownContent,
  markdownVisualRequest,
  markdownPageSVG,
} from "../editor-vuejs/src/lib/agent/markdown-slides.mjs";
import {
  compileDeck,
  deckImageRequests,
} from "../editor-vuejs/src/lib/agent/deck-compiler.mjs";
import { planLocalMarkdown } from "../editor-vuejs/src/lib/agent/local-markdown.mjs";
import {
  createEditorTools,
  validateArguments,
} from "../editor-vuejs/src/lib/agent/editor-tools.mjs";
import { deckSchema } from "../editor-vuejs/src/lib/agent/deck-schema.mjs";
const document = { fileId: "file", width: 1280, height: 720 };
const context = {
  slideAuthoring: "markdown",
  slideTask: { mode: "create", count: 2 },
  authoringEffort: "quick",
  document,
  page: { pageId: "page", shapes: [], shapeCount: 0 },
};
const tools = createEditorTools({}).listTools();
const text =
  "# Energy\n> Accent: #087F8C\n\n## Slide 1: Solar power\n> Diagram: process: Capture -> Convert -> Use\n\nSolar panels convert light into electricity.\n- **Panels** capture sunlight\n- Inverters deliver usable power\n\n## Slide 2: Comparison\n| Technology | Source |\n| --- | --- |\n| Solar | Sunlight |\n| Wind | Wind |";
let id = 0;
const options = {
  width: 1280,
  height: 720,
  genId: () => String(++id),
  geometry: (p, w, h) => ({ d: `R0,0,${w},${h}` }),
};
const spec = (source) => ({
  ...parseMarkdownSlides(source, { count: 2 }),
  audience: "Readers",
  objective: "Explain energy",
});
test("Markdown slides, inline emphasis, a native table and process geometry compile without browser HTML layout", () => {
  const deck = spec(text);
  validateArguments(deckSchema, deck);
  const compiled = compileDeck(deck, options);
  assert.equal(compiled.pages.length, 2);
  assert.ok(
    compiled.pages.every(
      (page) => page.agentMetadata.engine === "markdown-native",
    ),
  );
  assert.ok(
    compiled.pages[0].shapes.some((shape) =>
      shape.txBody?.p.some((p) => p.r.some((r) => r.rPr.$_b)),
    ),
  );
  assert.ok(compiled.pages[1].shapes.some((shape) => shape.type === "table"));
  assert.equal(markdownVisualRequest(deck.slides[0].markdown), null);
  assert.match(markdownPageSVG(deck.slides[0]), /Capture/);
  assert.ok(
    !compiled.pages.some((page) =>
      page.shapes.some((shape) =>
        ["html", "iframe", "svg"].includes(shape.type),
      ),
    ),
  );
});
test("ordinary heading and separator variants preserve exact counts; malformed rosters fail clearly", () => {
  assert.equal(
    parseMarkdownSlides("## One\nContent\n---\n## Two\nContent", { count: 2 })
      .slides.length,
    2,
  );
  assert.equal(
    parseMarkdownSlides("# Deck\n## One\nContent\n## Two\nContent", {
      count: 2,
    }).slides.length,
    2,
  );
  assert.equal(
    parseMarkdownSlides("```markdown\n# One\nContent\n```", { count: 1 }).slides
      .length,
    1,
  );
  assert.throws(
    () => parseMarkdownSlides("# One\nContent", { count: 2 }),
    /exactly 2/,
  );
});
test("suggested images stay asset queries and Markdown/HTML text cannot become executable content", () => {
  const deck = spec(
    text.replace(
      "> Diagram: process: Capture -> Convert -> Use",
      "![Rooftop solar panels](https://example.com/fake.png)",
    ),
  );
  const requests = deckImageRequests(deck);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].image.query, "Rooftop solar panels");
  assert.ok(!markdownPageSVG(deck.slides[0]).includes("https://example.com"));
  const svg = markdownPageSVG({
    title: "Literal",
    markdown: "# Literal\n<script>alert(1)</script>",
  });
  assert.match(svg, /&lt;script&gt;/);
});
test("unknown visual suggestions trigger a bounded model elaboration then a complete native plan", async () => {
  const requests = [];
  const source = text.replace(
    "> Diagram: process: Capture -> Convert -> Use",
    "> Visual: A solar cell cross section",
  );
  const plan = await planLocalMarkdown({
    command: "Create two energy slides",
    tools,
    context,
    modelLabel: "Gemma 4 E4B",
    generate: async (messages) => {
      const data = JSON.parse(messages[1].content);
      requests.push(data);
      return {
        text: data.suggestion
          ? "> Diagram: process: Sunlight -> Cell -> Electricity"
          : source,
        metrics: { inferenceMs: 10, inputTokens: 50 },
      };
    },
  });
  assert.equal(requests.length, 2);
  assert.equal(plan.metrics.elaboratedVisuals, 1);
  assert.equal(plan.calls[0].arguments.slides.length, 2);
  assert.match(plan.calls[0].arguments.slides[0].markdown, /Sunlight -> Cell/);
});
test("failed visual elaboration retains editable descriptions and warnings instead of stopping the deck", async () => {
  let calls = 0;
  const source = text.replace(
    "> Diagram: process: Capture -> Convert -> Use",
    "> Visual: A complex solar cell cross section",
  );
  const plan = await planLocalMarkdown({
    command: "Create two slides",
    tools,
    context,
    generate: async () => ({
      text: ++calls === 1 ? source : "Cannot draw this",
    }),
  });
  assert.equal(calls, 3);
  assert.equal(plan.metrics.elaboratedVisuals, 0);
  assert.ok(
    plan.metrics.warnings.some((w) =>
      w.includes("keeping its editable description"),
    ),
  );
  assert.equal(plan.calls[0].arguments.slides.length, 2);
});
test("unsafe visual SVG never reaches native insertion; cancellation is not swallowed as a warning", async () => {
  let calls = 0;
  const source = text.replace(
    "> Diagram: process: Capture -> Convert -> Use",
    "> Visual: A solar diagram",
  );
  const plan = await planLocalMarkdown({
    command: "Create two slides",
    tools,
    context,
    generate: async () => ({
      text:
        ++calls === 1
          ? source
          : '```svg\n<svg viewBox="0 0 1280 720"><script/></svg>\n```',
    }),
  });
  assert.equal(plan.calls[0].arguments.slides[0].visualSVG, undefined);
  let stopped = false;
  await assert.rejects(
    planLocalMarkdown({
      command: "Create two slides",
      tools,
      context,
      isStopped: () => stopped,
      generate: async () => {
        stopped = true;
        return { text };
      },
    }),
    /stopped/,
  );
});

test("Markdown-generated text passes through the real editable PowerPoint text serializer", async () => {
  const { exportNativeHTMLText } = await import(
    "./html-native-export-fixture.mjs"
  );
  const native = compileDeck(spec(text), options);
  const exported = exportNativeHTMLText(
    native.pages[0].shapes.filter((s) => s.txBody),
  );
  const content = exported
    .flatMap((shape) =>
      shape["p:txBody"].p.flatMap((p) => p.r.map((r) => r.t || "")),
    )
    .join(" ");
  assert.match(content, /Solar power/);
  assert.match(content, /Panels/);
  assert.match(content, /Capture/);
});

test("complex style and diagram-like image suggestions are elaborated into native palette and geometry", async () => {
  const source = text.replace(
    "> Diagram: process: Capture -> Convert -> Use",
    "> Style: watercolor texture\n> Image: diagram of a solar cell",
  );
  const requests = [];
  const plan = await planLocalMarkdown({
    command: "Create two slides",
    tools,
    context,
    generate: async (messages) => {
      const data = JSON.parse(messages[1].content);
      requests.push(data);
      if (data.suggestion?.includes("watercolor"))
        return {
          text: "> Style: clean\n> Background: #F4F9FC\n> Foreground: #172B4D\n> Accent: #087F8C\n> Font: Arial",
        };
      if (data.suggestion)
        return { text: "> Diagram: process: Sunlight -> Cell -> Power" };
      return { text: source };
    },
  });
  assert.equal(requests.length, 3);
  assert.equal(plan.metrics.elaboratedStyles, 1);
  assert.equal(plan.metrics.elaboratedVisuals, 1);
  assert.equal(deckImageRequests(plan.calls[0].arguments).length, 0);
  const compiled = compileDeck(plan.calls[0].arguments, options);
  assert.ok(
    compiled.pages[0].shapes.some((shape) =>
      shape.txBody?.p.some((p) => p.r.some((r) => r.t?.includes("Sunlight"))),
    ),
  );
});
