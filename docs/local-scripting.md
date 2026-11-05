# Local JavaScript for HTML slides

DESQ stores editable JavaScript modules and button bindings in the document. Open **Add-Ins → Local JavaScript** to edit code, choose an exported function and JSON arguments, then **Save and bind selected shape**. Saving and thumbnails do not execute these modules. Play the HTML presentation to run them.

`checkAnswer`, `restartGame` and other game functions are user code. They are not DESQ APIs. The host API is the `ctx` argument passed to the selected function:

```js
export async function checkAnswer(ctx, isCorrect) {
  ctx.state.set('score', (ctx.state.get('score') || 0) + (isCorrect ? 1 : 0));
  await ctx.shapes.hide('quiz-popup');
  await ctx.slides.goto(isCorrect ? 'slide-win' : 'slide-lose');
}
```

Use exported function declarations (`export function` or `export async function`). Modules can import other stored modules by ID (`import {helper} from 'helpers'`). There are no remote imports. Each click gets a fresh JavaScript VM; use `ctx.state`, rather than module globals, for state that persists between clicks. State starts from the document's initial JSON state on each playback and is not written back to the editor.

## Host API v1

Await host actions in sequence. Navigation must be the last host action in a function.

| API | Behavior |
| --- | --- |
| `ctx.state.get(name)` | Read playback JSON state |
| `ctx.state.set(name, value)` | Store a JSON value for later clicks |
| `await ctx.shapes.show(id)` / `hide(id)` | Change shape/group visibility; referenced shapes on unloaded slides update when they load |
| `await ctx.shapes.text(id, value)` | Replace the contents of one text box with plain text; rich formatting is flattened |
| `await ctx.shapes.move(id, x, y)` | Set a translation offset in slide coordinates, not an absolute position; each offset must be within ±10,000 |
| `await ctx.shapes.style(id, styles)` | Set `opacity` (0–1), `color`, `fill`, `stroke`, or `backgroundColor`; colors accept simple names, hex and rgb/rgba |
| `await ctx.animations.play(id)` | Replay existing native effects for a shape on the current slide (or an effect ID); this does not compile arbitrary JavaScript into animations |
| `await ctx.wait(milliseconds)` | Wait 0–10,000 ms |
| `await ctx.slides.goto(id)` | Jump to a slide, including a hidden destination |

Imported HTML element/slide IDs are retained as aliases and mapped to native IDs. The dialog lists aliases and native IDs. New code written in the editor can use the listed native IDs. Shape changes affect playback only. Reopening playback starts clean. Pending scripts are cancelled on navigation and stopping playback; repeated clicks while a handler runs are ignored.

The runtime uses QuickJS inside a dedicated Worker. User modules have no browser DOM, `window`, `fetch`, editor storage, network, or timer APIs. Use `ctx.wait`, not `setTimeout`. Each invocation has a 15-second wall-clock deadline, a 500-ms CPU budget per execution turn, 16 MiB VM memory and at most 128 host calls. A failed handler reports a console error and a `desq-script-error` browser event; it does not advance the slide.

## Authoring downloadable HTML

Deliver one downloadable, self-contained UTF-8 `.html` file. Follow [AGENTS.md](../AGENTS.md) for slide boundaries, fonts, editable artwork, animations, morph continuity and interactive app/game design. Preserve a working standalone browser controller as well as the import declarations.

Prefer explicit modules and button bindings:

```html
<section class="slide active" data-desq-slide id="slide-question">
  <button id="answer-correct" data-desq-module="game"
    data-desq-run="checkAnswer" data-desq-args="[true]">Correct choice</button>
  <button id="answer-wrong" data-desq-module="game"
    data-desq-run="checkAnswer" data-desq-args="[false]">Wrong choice</button>
  <div id="quiz-popup" style="display:none">Feedback</div>
</section>
<section class="slide" data-desq-slide id="slide-win">You won!</section>
<section class="slide" data-desq-slide id="slide-lose">Try again</section>
<script type="application/desq-script" data-module="game">
export async function checkAnswer(ctx, correct) {
  await ctx.shapes.show('quiz-popup');
  await ctx.wait(600);
  await ctx.slides.goto(correct ? 'slide-win' : 'slide-lose');
}
</script>
```

This declaration alone does not run in an ordinary browser. Include a small standalone controller that loads these same modules and passes a browser implementation of `ctx`. See the complete [local quiz example](../examples/html-slides/local-quiz.html). Never put both a direct `data-desq-goto` and a script binding on the same control. Use document-global unique element and slide IDs. Keep hidden feedback as authored DOM with an ID; it is imported as editable geometry and initially hidden in playback.

For a simple unconditional jump, keep using `data-desq-goto="slide-id"` or a sole literal `goToSlide('slide-id')` handler. Those become ordinary native slide hyperlinks and can work in PowerPoint without scripting.

## Existing onclick HTML

The importer stores inline `onclick` bodies as generated exported functions and retains parseable top-level function declarations and simple literal/function variable declarations. The original inline script text is also stored for reference. This extraction does not execute the code in the editor.

A narrow compatibility facade recognizes `document.getElementById(id).classList.add/remove('show'/'visible')`, visibility/display assignments, simple style assignments, and `.slide` class-based navigation. This covers the imported Tom and Jerry popup/answer/restart pattern. It is not a general DOM implementation. Arbitrary selectors, listeners, timers, DOM construction, closure state and external scripts need to be rewritten using `ctx`. Unsupported operations fail during playback; preserving source does not guarantee that every imported game will run unchanged.

Only button/shape click bindings are implemented. Lifecycle events, general event listeners, a visual sequence editor, and automatic translation of arbitrary JavaScript into PowerPoint animations are outside v1. Existing native animations and slide transitions remain available independently.

## Save and export

- **DESQ document / HTML export:** preserves modules, bindings, aliases and initial state. The HTML player runs the scripts. They remain editable after reimport of DESQ's document-bearing HTML format.
- **PPTX export:** stores the versioned project in `customXml/desq-scripting.xml`, with a presentation relationship and content-type entry. Shape extensions preserve `@run:<binding-id>` / `@set:LET(name,literal)` links and stable shape identities. Slide aliases map to the final slide part names. DESQ restores them on import.
- **PowerPoint:** does not execute this JavaScript. Native direct slide hyperlinks and native animations are separate. Other applications may remove custom XML/extensions when resaving, so test the actual round-trip you intend to use.

The persisted project has `version:1`, `modules:[{id,source,refs,slides}]`, `bindings:[{id,module,function,args}]`, `state:{}` and `initialHidden:[]`. Alias maps contain arrays of native IDs because one authored element may compile to multiple editable objects. `@run:` contains a binding ID, not executable JavaScript or a function-call expression. The legacy `@set:` bridge only accepts `LET(identifier, JSON-literal)`; arbitrary formulas are not evaluated.
