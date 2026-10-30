import test from "node:test";
import assert from "node:assert/strict";
import {
  PRESENTON_TEMPLATES, PPTX_TEMPLATE_CHOICES,
  presentonFamilyCatalogue, presentonCandidateReference, presentonLayoutCandidates,
  htmlTemplateReference,
} from "../editor-vuejs/src/lib/agent/presenton-templates.mjs";
import { buildProviderPlan } from "../editor-vuejs/src/lib/agent/provider-request.mjs";
import { editorPlanInstructions } from "../editor-vuejs/src/lib/agent/plan-instructions.mjs";
import {
  createEditorTools,
  validateArguments,
} from "../editor-vuejs/src/lib/agent/editor-tools.mjs";
import { deckSchema } from "../editor-vuejs/src/lib/agent/deck-schema.mjs";
import { compactModelContext } from "../editor-vuejs/src/lib/agent/agent-plan.mjs";
import { buildAgentTask } from "../editor-vuejs/src/lib/agent/agent-task.mjs";
const context = {
  slideAuthoring: "html",
  htmlTemplate: "builtin-ocean",
  document: { fileId: "file" },
  page: { pageId: "page", shapes: [], shapeCount: 0 },
};
test("HTML transport is exposed for both providers without conflicting SVG instructions", () => {
  const instructions = editorPlanInstructions(
    createEditorTools({}).listTools(),
    { slideAuthoring: "html" },
  );
  const tools = JSON.parse(instructions.split("Tool schemas: ")[1]);
  const slide = tools.find((t) => t.name === "desq_create_deck").inputSchema
    .properties.slides.items;
  assert.deepEqual(slide.properties.layout.enum, ["html"]);
  assert.ok(slide.required.includes("html"));
  assert.ok(!slide.properties.svg && !slide.properties.elements);
  for (const provider of ["chatgpt", "gemini"]) {
    const body = buildProviderPlan(provider, {
      model: "test",
      command: "Create a deck",
      context,
    });
    const prompt =
      provider === "chatgpt"
        ? body.request.instructions
        : body.request.systemInstruction.parts[0].text;
    assert.match(prompt, /HTML SLIDE TRANSPORT/);
    assert.match(prompt, /Built-in.*visual system/);
    assert.match(prompt, /photo-story/);
    assert.ok(
      !prompt.includes("DESQ TRANSPORT OVERRIDE:") &&
        !prompt.includes("complete SVG for EVERY slide"),
    );
  }
  assert.equal(compactModelContext(context).slideAuthoring, "html");
  assert.equal(compactModelContext(context).htmlTemplate, "builtin-ocean");
  assert.match(
    buildAgentTask({
      mode: "create",
      topic: "HTML",
      count: 2,
      effort: "quick",
      slideAuthoring: "html",
    }).prompt,
    /2 layout=html slides/,
  );
  assert.match(
    buildAgentTask({
      mode: "edit",
      command: "Simplify",
      slideAuthoring: "html",
    }).prompt,
    /ONE layout=html slide/,
  );
});
test("only built-in definitions link to packaged PPTX assets", () => {
  assert.equal(PRESENTON_TEMPLATES.length, 1);
  assert.equal(PRESENTON_TEMPLATES.reduce((sum,t)=>sum+t.layouts.length,0),12);
  for (const family of PRESENTON_TEMPLATES) {
    assert.match(family.pptx, /templates\/builtin\/.*\.pptx$/);
    for (const layout of family.layouts) assert.match(htmlTemplateReference(family.id,layout.id), /PPTX layout reference/);
  }
  assert.throws(() => htmlTemplateReference("missing"), /Unknown/);
});
test("HTML slides use the existing deck schema and bounded transport", () => {
  const deck = {
    title: "HTML",
    audience: "Readers",
    objective: "Explain",
    slides: [
      {
        title: "One",
        purpose: "Explain",
        layout: "html",
        html: "<section>Native text</section>",
      },
    ],
  };
  validateArguments(deckSchema, deck);
  assert.throws(
    () =>
      validateArguments(deckSchema, {
        ...deck,
        slides: [{ ...deck.slides[0], html: "x".repeat(80001) }],
      }),
    /allowed length/,
  );
});

test("CSS shadow parsing preserves colors, offsets and layered/inset distinctions", async () => {
  const { parseHTMLBoxShadows } = await import(
    "../editor-vuejs/src/lib/agent/html-slides.mjs"
  );
  assert.deepEqual(parseHTMLBoxShadows("rgba(0, 0, 0, 0.2) 0px 8px 20px 0px"), [
    {
      color: "rgba(0, 0, 0, 0.2)",
      dx: 0,
      dy: 8,
      blur: 20,
      spread: 0,
      inset: false,
    },
  ]);
  const layers = parseHTMLBoxShadows(
    "rgb(0, 0, 0) 0px 8px 20px -4px, rgba(0, 0, 0, 0.1) 0px 1px 2px 0px inset",
  );
  assert.equal(layers.length, 2);
  assert.equal(layers[0].spread, -4);
  assert.equal(layers[1].inset, true);
  assert.deepEqual(parseHTMLBoxShadows("none"), []);
});

test("CSS generated content decodes literal strings, escapes and attributes without treating content as markup", async () => {
  const { generatedContentText } = await import(
    "../editor-vuejs/src/lib/agent/html-slides.mjs"
  );
  assert.equal(generatedContentText('"Hello" " world"'), "Hello world");
  assert.equal(generatedContentText('"\\2022 "'), "•");
  assert.equal(generatedContentText('"<b>Text</b>"'), "<b>Text</b>");
  assert.equal(
    generatedContentText("attr(data-label)", (name) =>
      name === "data-label" ? "Label" : "",
    ),
    "Label",
  );
  assert.equal(generatedContentText('""'), "");
  assert.throws(
    () => generatedContentText("counter(step)"),
    /generated-content expression/,
  );
});


test('all families are discoverable while page prompts keep template details bounded',()=>{
  const catalogue=presentonFamilyCatalogue();
  for(const family of PPTX_TEMPLATE_CHOICES){
    assert.ok(catalogue.includes(family.id));
    for(const kind of ['editorial','comparison','process','statistics','grid','image','closing']){
      const reference=presentonCandidateReference(family.id,kind);
      assert.ok(reference.length < 6000,`${family.id} reference too long`);
      for(const layout of family.layouts)assert.ok(reference.includes(layout.id));
      assert.equal(presentonLayoutCandidates(family.id,kind).length,3);
      assert.ok(!reference.includes('<script')&&!reference.includes('https://'));
    }
  }
});
