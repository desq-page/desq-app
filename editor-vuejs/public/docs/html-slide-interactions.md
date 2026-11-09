# Current implementation: local JavaScript

Use [the shipped local scripting API](local-scripting.md) for editable game/app logic, button bindings, state, shape changes, existing animations and navigation. The HTML author chooses the exported game handler names and binds them with `data-desq-run`. Scripts run in the HTML player; PPTX preserves them for reimport. The declarative manifest described below remains a separate proposal and must not be treated as the shipped scripting format.

# Proposed public HTML interaction contract

**Status: direct slide navigation implemented; manifest/animation-trigger API proposed.** `data-desq-goto` and sole literal `goToSlide('slide-id')` calls now map to native links. The accompanying quiz's direct navigation is supported; its manifest-driven hint remains a standalone prototype. No host SDK is installed by the example.

The objective is a single declaration that an HTML runtime can execute and an importer can map to editable slide hyperlinks and native animation triggers. The importer must not reverse-engineer arbitrary JavaScript.

## Existing building blocks and gaps

Slide markers already work. The native document/player have slide-link and shape-trigger concepts. Native timing export supports interactive sequences in `timing.i`.

The direct-jump bridge extracts declared destinations or sole literal calls before capture removes event attributes and scripts. It preserves the button's native geometry through grouping, resolves destinations to native slide IDs, and writes internal PowerPoint slide relationships. It does not interpret custom wrapper functions, variables or branching JavaScript. Anchors are still unwrapped. Manifest parsing, general element-identity transport, hidden-state capture and animation-trigger mapping remain to be implemented.

Consequently, direct destination attributes preserve navigation, but adding proposed trigger/manifest fields alone will not preserve the rest of a game's behavior.

## Authoring surface to implement

Use HTML attributes for simple navigation and JSON for animation/event sequences. Keep the surface declarative, versioned, renderer-independent and available to any LLM without a build system.

| Declaration | Meaning | Status |
| --- | --- | --- |
| `section.slide[data-desq-slide][id]` | Slide identity and boundary | Supported today |
| An ordinary DOM `id` on a button/shape | Authored element identity | Browser-supported; complete native identity mapping pending |
| `data-desq-goto="slide-win"` | Jump to the slide with that authored ID | Supported |
| `data-desq-trigger="hint"` | Start the named interaction binding on click/keyboard activation | Proposed |
| `script#desq-interactions[type="application/json"]` | Versioned interaction manifest | Proposed |
| `data-desq-initial="hidden"` | Element begins hidden in playback but remains an editable authored object | Proposed |

Choose either `data-desq-goto` or `data-desq-trigger` on one control. A control with both is invalid. All referenced IDs are document-global and unique; they are not slide numbers. A runtime may change generated native IDs, but must retain the authored-ID mapping.

A legacy handler can also be imported when its entire body is a literal call such as `goToSlide('slide-win')` or `return gotoSlide("slide-win");`. No handler is evaluated to discover its destination. Calls to custom game handlers, expressions, multi-statement handlers and callbacks registered with `addEventListener` are outside this direct-navigation subset. Declare `data-desq-goto` on each source button instead. Missing and conflicting explicit targets are errors.

An actual HTML anchor with a same-document `href` can also represent a direct jump in a future adapter. If an adapter supports both forms, conflicting destinations must be rejected, not guessed.

## Manifest v1 proposal

```json
{
  "version": 1,
  "entrySlide": "slide-intro",
  "animations": [
    {
      "id": "hint-appear",
      "slide": "slide-question",
      "target": "hint-text",
      "effect": "appear",
      "durationMs": 0
    }
  ],
  "bindings": [
    {
      "id": "hint",
      "slide": "slide-question",
      "actions": [{"type": "play", "animation": "hint-appear"}]
    }
  ]
}
```

The matching authoring markup is:

```html
<button type="button" id="answer-hanoi" data-desq-goto="slide-win">Hanoi</button>
<button type="button" id="hint-button" data-desq-trigger="hint">Show hint</button>
<p id="hint-text" data-desq-initial="hidden">The city's name begins with H.</p>
```

Every `data-desq-trigger` references one binding. Each binding identifies its containing slide. Its source controls must belong to that slide. Each animation identifies an element on the same slide; v1 has no cross-slide animation target.

Proposed actions:

| Action | Fields | Execution |
| --- | --- | --- |
| `goto` | `slide` | Navigate to a declared slide; finish this sequence |
| `play` | `animation` | Play the declared animation; await completion |
| `show` / `hide` | `target` | Change playback visibility of an element on the current slide |
| `wait` | `durationMs` | Await a bounded delay, cancellable on navigation |

Actions execute in array order. No JavaScript expressions, selectors, URLs, variable names, functions or `eval` fields are accepted. Start with `appear`/`fade` in an implementation's animation allowlist; add effect types only when both standalone and native mappings exist. The bundled example implements `appear` only and validates that restriction.

Keep the first implementation intentionally finite: slide jumps, explicit feedback and animation triggers. Scores, conditional expressions, storage, audio/video and physics are outside v1. Branch a quiz by giving different answer controls different declared destinations.

## Playback semantics

- Execute a binding on a real button activation, not a click anywhere on the slide. Native button Enter/Space behavior must work.
- Lock that binding while its action sequence is running. Do not run it twice on a double click.
- Cancel pending waits/animations when navigating. A stale timer from the previous slide must never redirect the user.
- Reset a slide's declared initial visibility on entry. An ordinary restart button can navigate to `entrySlide`; more persistent game state would require a separately specified reset action.
- Reduced motion may reduce animation duration to zero; it must not suppress the outcome or navigation.
- During editor capture, materialize all authored states as editable objects, including initially hidden targets. Apply `data-desq-initial` as playback metadata, not by permanently dropping objects with zero opacity.
- Editing mode should show/select objects without running game actions. Playback mode executes the graph.

## Native mapping plan

1. Direct jumps already parse inert HTML before capture/sanitization. Add JSON manifest parsing and validate version, IDs, dimensions, action/effect allowlists and all references. Suggested v1 bounds: 20 slides, 200 bindings/animations, 16 actions per binding, 60,000 ms per duration, and 64 KiB manifest text. These are proposed manifest limits, not existing parser guarantees.
2. Build an authored-slide-ID → imported-slide-ID map, plus an authored-element-ID → native-shape/group-ID map. Preserve mappings in document metadata through save/reopen. Retain all hidden-state objects for editing.
3. Transport source element identities through SVG measurement and native grouping. A painted button and its label must form one hit target. Preserve discontiguous targets explicitly; do not guess by caption text or nearest geometry.
4. Direct jumps now resolve to `@sld:<native-id>` after native IDs are assigned, including inserted decks. The mapping is separate from the SVG compiler's external-hyperlink allowlist. PPTX serialization writes an internal slide relationship and action. Retain this behavior when extending the manifest adapter.
5. Map same-slide `play` bindings to native interactive timing groups, using the source button's native ID as the trigger (`trs`) and target objects as effect targets. Keep these out of the ordinary slide-click sequence. Preserve group remapping.
6. Either implement sequences such as `show → wait → goto` consistently in the player/export adapter or reject them with a precise unsupported-action report. Do not silently turn them into immediate jumps. Native PowerPoint may require a narrower supported subset than standalone HTML.
7. Keep only validated data in the native document. The existing opaque capture sandbox remains separate from the editor; the editor never receives executable imported script handlers.
8. Publish a schema/validator and a small versioned runtime only after these semantics are implemented. Let both the example and importer consume the same validator; do not maintain conflicting schema copies or tell authors an unshipped SDK exists.

## Acceptance criteria before calling this public API supported

- Business-deck import behavior remains unchanged.
- All correct/wrong answer branches and restart destinations work in the standalone file, imported DESQ player, and saved/reopened HTML.
- Same-slide reveal stays on the current slide; it triggers from the specified button, not from an unrelated click.
- Hidden feedback remains editable and can be replayed after leaving/re-entering the slide.
- Button hit areas include their labels; grouping and native ID regeneration do not break references.
- Missing/duplicate IDs, unknown versions/actions, invalid numbers and unsafe targets fail validation.
- Thumbnail generation succeeds before any manual edit and never runs navigation actions.
- PowerPoint export is tested for internal slide links and shape-triggered effects independently. Unsupported sequences are reported.

## References

- [Frontend Slides skill](https://github.com/zarazhangrui/frontend-slides/blob/main/SKILL.md) and [template](https://github.com/zarazhangrui/frontend-slides/blob/main/html-template.md): business-deck composition and fixed-stage HTML architecture.
- [Standalone quiz example](../examples/html-slides/quiz.html): executable browser prototype of this proposal, with explicit status comments in its source.
