# Editor agents and WebMCP

## Shared agent host

Run only `npm run dev` for development. Vite hosts both
`/api/agent/chatgpt/*` and `/api/agent/gemini/*` directly in its process;
there are no provider proxy targets or separate agent-server commands.
Restart Vite after changing server code. `vite preview` also includes the host.

Production agent services live in `cloudflare-publisher/src/agent/`. The local
Fetch/Vite adapter stays there for development and preview only. There is no
separate production Node server or agent-host bundle.

Cloudflare hosts the same API on `PUBLIC_ORIGIN`, alongside editor static assets.
The `AGENT_SESSIONS` Durable Object binding isolates each browser session with a
random HttpOnly Secure cookie. Credentials and model catalogs persist in private
Durable Object storage across cold starts, expire after eight hours, and are
cleared by disconnect. Controllers and pending work are never persisted. Publish
APIs continue to use the separate publishing API hostname.

ChatGPT / OpenAI is the default provider. Locally, ChatGPT retains account/plan OAuth. Vite starts a loopback callback
listener only when sign-in begins, selecting an available port automatically;
there is no dependency on port 1455. Only the callback uses that listener.
OpenAI's OSS plan sign-in requires HTTP 127.0.0.1 and the unchanged
`/auth/callback` path. Without an approved hosted OAuth client, Node/Workers expose OpenAI API-key
connection with separate API billing; website identity login alone does
not authorize ChatGPT-plan inference. The panel reads the server's authentication
mode. Hosted users supply their own OpenAI or Gemini keys; the server never sends
keys back to the browser. The OpenAI key input clears after connection.
Gemini's existing browser preference/automatic reconnect remains supported.

### Production ChatGPT sign-in

Node and Cloudflare support a registered HTTPS OAuth callback at
`https://your-editor.example/api/agent/chatgpt/callback`. This is a separate
integration from local dynamic registration. OpenAI must issue a website client
and approve that client for **ChatGPT plan usage**. Identity-only approval does
not authorize agent inference. Live authorization cannot be validated without
that approval and the issued client configuration.

Configure the server environment (Cloudflare: Worker variables/secrets):

```text
PUBLIC_ORIGIN=https://your-editor.example
OPENAI_OAUTH_CLIENT_ID=<issued website client ID>
OPENAI_OAUTH_PLAN_ENABLED=true
OPENAI_OAUTH_REDIRECT_URI=https://your-editor.example/api/agent/chatgpt/callback
```

Set `OPENAI_OAUTH_PLAN_ENABLED=true` only after OpenAI has enabled plan usage
for this client. The redirect URL must exactly match its OpenAI registration.
For a confidential client provisioned with `client_secret_basic`, put
`OPENAI_OAUTH_CLIENT_SECRET` in the server's secret manager. Omit it for a
registered public client. No OAuth secret belongs in a `VITE_` variable.
The client must permit the plan scopes `resource.invoke` and
`chatgpt.tokens.use.direct` plus identity and offline access.

When configured, the panel offers **Continue with ChatGPT** instead of an API-key
field. The backend uses PKCE, nonce, signature/issuer/audience checks and a
one-time state tied to the initiating browser cookie. Only the callback bypasses
normal same-origin agent request headers. OAuth cookies use SameSite=Lax so
OpenAI's top-level redirect carries the browser session. The callback rejects
missing/mismatched cookies and tokens lacking plan authorization. Tokens and
client secrets remain on the backend; refresh and revocation authenticate the
registered client. Node persists OAuth sessions in the protected credential
directory; use one instance or sticky sessions and persistent storage. Cloudflare
keeps each browser's state in its Durable Object with the existing eight-hour
expiry. Restart/redeploy after configuration changes.

Official documentation: [website OAuth](https://developers.openai.com/siwc/website)
and [eligibility and plan usage](https://developers.openai.com/siwc/quickstart).

Local Node/Vite ChatGPT OAuth connections are remembered for 30 days, renewed
with use. The host ID, issued client registration and latest rotating credentials
are saved under the ignored `.chatgpt-agent/` directory. The directory is owner-only
(`0700`), with atomic owner-only (`0600`) credential files bound to the host and
configured editor origins. Only the original browser cookie can resume that
connection; no browser adopts a saved account merely because it uses the same
local server. Credentials, identity hints and registration survive restarts;
pending authorization codes, PKCE state, catalogs and provider API keys are not
persisted in these files. Refresh tokens are saved immediately after rotation.
Transient refresh failures preserve the refresh token for retry; rejected grants
remove credentials while retaining registration for reauthorization.

Disconnect revokes the latest refresh token and removes local tokens before
responding, but retains the issued client ID and verified account identity for
returning sign-in. The login endpoint accepts `newAccount:true` only after
sign-out to explicitly start a different registration. Existing connections need
one sign-in after upgrading to this persistence implementation. Programmatic Node
hosts can override `credentialDirectory` or set `persistOAuth:false`; hosted
API-key and Cloudflare persistence behavior is unchanged.

The standalone provider launch/restart scripts have been removed. Provider tests
exercise the shared modules directly.
Run `npm run test:agent-host` for shared routing, OAuth, isolation, persistence,
request limits, inference and image generation checks.

## Browser-owned generation

The browser builds provider requests from the tool schemas, current slide context,
Quick/Detailed selection and bundled PPT Master references. It also owns model
catalog pagination and display filtering, progress/elapsed-time updates, provider
stream and JSON decoding, completion/refusal checks, image prompts, image-byte
validation and provenance, layout validation, corrections/reviews and editor writes.
The local model imports the same frontend reference module.

OpenAI uses the host as a credential proxy. Gemini uses direct browser requests. The legacy Gemini host endpoints remain for compatibility. `/plan` and `/image` accept a bounded
`{model, request}` envelope containing the browser-built provider payload. They
inject credentials, enforce the fixed provider destination and allowed fields,
check the session's permitted model set, and relay raw bytes with cancellation,
server timeouts and size limits. Catalog endpoints return raw catalog entries;
the browser follows Gemini pages and chooses which models to display. Provider
error responses are sanitized before crossing the proxy. OAuth discovery, PKCE,
identity verification, token refresh/revocation, credentials, session isolation and
origin checks remain server-side. No prompt, slide compiler, reference corpus or
image output parser is bundled into the host.

Both browser and host must use the current protocol version. Rebuild/restart the
host and refresh the editor together after this migration. Browser clients reject
stale response versions before consuming generated output. Provider API keys are
never embedded in prompt/request-building modules or server responses.

## Wikimedia image lookup

Image descriptions are searched on Wikimedia Commons first. If no usable licensed
raster image is found, the connected ChatGPT/Gemini model (or local Qwen worker)
rewrites the description into short search keywords. The browser retries Commons
once with those keywords before falling back to image generation or a described
placeholder. It does not rewrite on HTTP/network errors, repeat an unchanged
query, or loop on unusable model output. Original descriptions remain the source
for alt text, generation prompts and placeholders; Commons license, attribution,
download limits and deduplication checks apply to both searches. Keyword requests
use the existing guarded text proxy; no image-search logic moves to the server.

## Deck design workflow

The active Gemini/ChatGPT workflow now uses pinned PPT Master design references
and complete model-authored SVG pages compiled into native Savanna objects.
It bypasses the preset layout menu and shape quotas. See the
[port contract and compatibility limits](ppt-master-port.md). The agent server must
report protocol version `ppt-master-browser-v5` in `X-Editor-Agent-Version`. The following preset-based workflow
remains for backward compatibility:

Gemini and ChatGPT plan a thesis, narrative and per-slide visual concepts before
authoring the deck. The native compiler offers 14 layouts, five coordinated
palettes, per-slide tone/variant controls, and editable process, relationship,
comparison, timeline and metric compositions. Chat includes collapsible layout
proofs for the first six slides; images/charts/tables are shown schematically.

Before insertion, a valid draft gets one cloud design review using its storyboard
and compiled scene summaries. An invalid draft instead gets one correction pass.
Contrast, readability and repeated compositions are checked locally. The final
plan must validate and a design review cannot change the slide count. Repeated
basic geometry or no informational native carriers triggers a final composition
repair, then blocks insertion if unresolved. Explicit uniform-layout and text-only
requests keep their intended exceptions. Other style findings remain warnings.
This is geometry/content review, not vision inspection of the final rendering.
Decks use up to three planning requests; ordinary edits still use one.
The companion and browser verify authoring version `native-composition-v3`;
an older companion must be restarted before its output can execute.
See [the native feature map](ppt-master-savanna.md) for authoring controls.

## Image generation fallback

The embedded Gemini/ChatGPT agent searches Wikimedia Commons first. If search
fails or no usable raster passes the licensing/attribution checks, it generates
one image with the connected provider, then inserts it through the same native
picture path. It applies to both single slides and decks. Chat shows generation
progress; pictures carry provider/model provenance and an AI-generated label,
not a fabricated Wikimedia license. Failed image requests produce editable placeholders with the requested image
description as a visible caption and warnings in the result. Cancellation still
prevents insertion. Provider image usage limits/charges apply.

ChatGPT uses the Responses image-generation tool with the selected model and
current signed-in account or hosted API key. Tool access is provider/account dependent; a chat
model working does not guarantee image-tool access. Gemini uses the saved API
key with `gemini-2.5-flash-image` by default; the browser transport uses the same default in development and production.
ChatGPT image operations require the updated host endpoints. Standalone WebMCP
calls without a host image generator and local Qwen use placeholders when search fails.

Development needs only `npm run dev`; restart Vite after provider server changes.

## Generate a complete deck

Gemini and ChatGPT can now create 2–20 editable slides with a shared design,
audience/objective, varied compositions, rich text, AutoShapes, images, native
tables and bar/line/pie charts. Try “Create an 8-slide deck about solar energy for
business leaders, with a comparison and implementation timeline.” Pages are
inserted after the current slide; existing content is preserved. Layout and
data checks run before insertion; cloud models get one correction attempt for a
bad deck draft. Chat shows insertion progress. Each page has normal Undo.

See [PPT Master → Savanna mapping](ppt-master-savanna.md) for the architecture,
supported native fields, limits, and PowerPoint features not yet exposed by the
generator. Full PPT Master feature parity is not claimed.

## Agent chat

The toolbar's Agent button opens a docked task pane using the editor's standard
pane layout, resizing the canvas. On narrow screens it uses the existing bottom
pane layout. Switching panes or closing Agent preserves the connection and chat.
The Agent panel keeps a visible conversation with user messages and agent replies,
including explanations returned with successful editor operations. Execution
details are expandable under each reply; errors and stopped requests stay in the
transcript. Model connection settings collapse once connected. Closing the panel
preserves the conversation in memory; reloading the editor or choosing Clear chat
clears it. Recent conversation (up to 12 turns, 2,000 characters each) accompanies
the current document context for follow-up requests. API keys and execution
diagnostics are excluded from this conversation context.

## Generate an editable slide from a topic

With Gemini or ChatGPT connected, try: **Create a slide about solar energy with
a title, three concise bullet points, and a photo of solar panels.** The model
drafts the actual content and calls `savanna_create_slide`. This command creates
one complete page after the current slide and selects it. Titles, subtitle,
optional body text and bullets are editable text shapes, with automatic layout
and text sizing to the presentation's dimensions. Light and dark themes are
supported. All bullets share one text shape, with one native bullet paragraph per
item. Images are embedded document media, not external hotlinks.

The command accepts `title`, optional `subtitle`/`body`, up to eight `bullets`,
up to two `images` containing `query` and `alt`, and optional `theme` (`light` or
`dark`). Standard captured file/page IDs guard insertion. Use one create-slide
call alone in a plan: it already populates, saves, selects and thumbnails the
new page, so later calls cannot accidentally target the original slide. One
slide per request is supported. This command requires a presentation, not a Word,
spreadsheet or PDF document.

When images are requested, the editor searches Wikimedia Commons using the model's
descriptions. It accepts raster photos with available author/source metadata and
CC0, Public Domain, CC BY or CC BY-SA licenses. It downloads bounded image bytes,
stores them through the editor's existing image pipeline and adds visible source,
author and license credits. It does not generate AI images or accept invented
image URLs. Image requests use public Commons endpoints without editor cookies.
An unavailable image or content that cannot fit stops insertion with a specific
error; request a more specific image query or a text-only slide to retry.

The slide is composed before insertion, then persisted through the same public
`pasteSlide`/save path as Duplicate Page. The file-level insertion uses normal
Undo and leaves the original slide's content intact. Stop cancels image preparation;
once insertion commits, use Undo. Thumbnail refresh failures are reported as warnings
on the saved slide rather than reporting that the entire insertion failed.
Agent saves persist XML and document state without awaiting automatic raster
previews. Explicit thumbnail rendering rejects decode/encoding failures and has a
15-second deadline, so a failed preview cannot leave deck insertion pending forever.
Progress distinguishes saving, opening and preview refresh for each page.

The shared command schema is exposed to Gemini, ChatGPT and WebMCP. Local
Qwen 4B uses staged SVG authoring instead of command selection. Run `npm run test:generated-slide`
and `npm run test:editor-agent` for layout, image, schema and adapter regressions.

## Gemini API connection

Choose **Gemini** in Agent Box, enter your own key from
[Google AI Studio](https://aistudio.google.com/apikey), and click **Connect Gemini**.
The browser calls `https://generativelanguage.googleapis.com/v1beta` directly for
model discovery, slide plans, image-search keywords and generated images.
Gemini no longer depends on the editor’s `/api/agent/gemini` routes or Cloudflare
session location. Google sees the browser network’s outbound location. Local
and production editors use the same direct transport. No shared application
key or Gemini web account login is used.

The key is sent only to Google in the `x-goog-api-key` header, never in URLs,
prompts, editor server requests or exported slides. Requests omit cookies.
Connection credentials stay in browser memory by default. Check **Remember key
on this browser** to also save the key and selected model in localStorage for
this editor origin. Existing saved keys retain automatic reconnect. Other
scripts running on the same origin can read localStorage. The password field
clears when connecting. Stop keeps the connection; **Forget key and disconnect**
clears its memory and saved key and cancels requests. It does not revoke the key
in Google AI Studio. Private browsing or disabled storage may prevent persistence;
a save failure does not discard a successful live connection.

Connect fetches the current model catalog, including pagination, and offers Gemini
models supporting `generateContent`, excluding specialized image/audio/computer-use
models. The panel prefers the first listed Flash model; choose another model
between commands without disconnecting. Listing a model is not proof that your
key's quota or permissions allow successful generation with it.

Gemini receives the same compact document context and plan instructions as ChatGPT,
with the same argument validation, captured selection/document binding, and normal
Undo execution path. This provider uses JSON output from `generateContent`; it
does not use local Qwen inference. Only a completed
`STOP` candidate is accepted; safety blocks, output limits, malformed plans and
unknown tools never produce edits. The panel reports provider inference duration
and input tokens so you can compare the same requests across models. Restore the
same document and selection between comparison trials using Undo.

This is a local development connection. A hosted deployment needs an authenticated
backend with proper per-user credential storage before exposing this provider.
Run `npm run test:gemini-agent` for the mocked API and validation regression checks.
Actual intent quality and live key/model access require an interactive trial.

Google documentation: [API keys](https://ai.google.dev/gemini-api/docs/api-key),
[models](https://ai.google.dev/api/models), and
[content generation](https://ai.google.dev/api/generate-content).

## ChatGPT account connection

For local development, run `npm run dev`. In the Agent panel choose
**ChatGPT / OpenAI**, then **Continue with ChatGPT**. Complete authorization in
the browser popup. The panel fetches available models. No API key is required for
this local account connection. On hosted Node/Cloudflare deployments the same
provider offers an **OpenAI API key** field and **Connect OpenAI** instead.

Commands and limited document context are sent to OpenAI, including up to 12
shapes with 240 text characters each. ChatGPT returns a bounded editor plan;
the client binds the captured document/selection and validates every call before
executing through the same editor registry. Existing Undo behavior applies.
The server waits for a completed Responses stream, so failed, incomplete, or
interrupted inference never supplies a plan for execution. Stop cancels a pending
request but does not undo edits already applied.

OAuth uses state, nonce, PKCE, verified OpenID identity, and the granted ChatGPT
plan scope. Access/refresh/ID tokens stay in companion memory, outside browser
storage. Sessions last at most eight hours; restarting the companion requires
sign-in again. Only a stable, non-secret host ID is saved under the ignored
`.chatgpt-agent/` folder. Disconnect clears the local session and attempts remote
refresh-token revocation. Closing the panel or stopping inference does not sign
out. Account model access and ChatGPT plan limits still apply.

This is a local integration, not a deployed website login: the current OpenAI
flow documents open-source and locally hosted apps and requires a loopback
callback. Paid/remotely hosted distribution must arrange the appropriate OpenAI
access and authentication setup before enabling it; do not forward a public
deployment's proxy to a developer's companion.

References: [registration and sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in),
[models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference),
and [preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).
Run `npm run test:chatgpt-agent` for OAuth, session isolation, stream completion,
model catalog, refresh, revocation, and editor-plan validation checks using a
mock identity provider. Real account authorization must be verified interactively.

## Local model connection

Select **Qwen3.5 4B · experimental deck authoring** and click **Load local model**.
Qwen runs in a dedicated WebGPU worker using the optimized text-only ONNX export:
<https://huggingface.co/onnx-community/Qwen3.5-4B-ONNX-OPT>.
It uses q4f16 when shader-f16 is supported, otherwise q4. Weights are downloaded
on first use and cached by Transformers.js when supported. GPU memory must also
accommodate activations, buffers and KV cache. Hardware compatibility and design
quality remain experimental; mocked regressions do not establish real GPU quality.

Local mode creates new slides/decks through the PPT Master native compiler.
Existing-slide editing remains available through Gemini, OpenAI and WebMCP.
The old local command router, direct-command handlers, embedding model, retrieval
worker, vector index and smaller Qwen exports have been removed.

The local pipeline supplies bounded upstream design prose directly. It first
requests a JSON storyboard with a shared design, then generates exactly one
complete SVG page per inference. Each page compiles and validates before proceeding;
an invalid page gets one repair. A separate review receives compact compiled
geometry/content summaries and requests targeted page revisions. Invalid review
JSON gets one repair. Only after all pages validate does the client return one
validated savanna_create_deck call, preserving the roster and captured document.
The same compiler retains native text, shapes, images and Savanna metadata.

Example: **Create a simple three-slide Hello World deck with a cover, an
explanation and a closing. Make it colorful with images.** The default is eight
pages for a deck or one for a single-slide request; maximum 20. User-requested
counts and language are part of the storyboard instructions. Design quality and
instruction following still depend on Qwen; they need real browser evaluation.

There is no tool catalogue in Qwen's prompts. Its output budget is 2048 tokens for
the storyboard, 4096 per SVG page and 1536 for review, with an 8192-token input
cap per request. Oversized context is rejected rather than silently dropping
instructions. Input tensors are disposed after measurement. Text-only inference
uses one WASM thread inside the dedicated worker. Runtime memory/device traps
terminate the worker; load again to start a fresh runtime.

Qwen does not generate raster images. Image descriptions use Wikimedia search;
missing/failed images become editable labeled placeholders. Search descriptions
are sent to Wikimedia; local text inference itself sends no document content to
a model server. Stop terminates pending inference; no partially authored deck is
inserted. Already inserted pages use the editor's normal Undo history. The panel
shows stage progress, total inference time, input tokens and composition proofs.

## Native WebMCP

When available, tools register with `document.modelContext.registerTool`, using an
AbortSignal to remove them when the editor unmounts. The adapter also recognizes
the earlier `navigator.modelContext` API. This is an evolving browser API, not a
remote MCP HTTP server. Registration is feature-detected; the editor and embedded
agent bridge continue working without native browser support.

Current specification: <https://webmachinelearning.github.io/webmcp/>.
Native WebMCP requires a secure context and may require browser feature/permissions
configuration. An embedding host may need an iframe `allow="tools"` policy, depending
on the browser version. Cross-origin native discovery uses `getTools({ fromOrigins:
['https://editor.example'] })` on the embedding document, then `executeTool(tool,
arguments)`; its result is a JSON string. Browser-provided agents discover registered
tools through their browser integration.

## Embedded agents

The shared library remains closed. `src/lib/agent/editor-adapter.ts` imports only
declared public package exports. The same tool registry drives WebMCP, the local
model panel, and the embedding interface.

A same-origin parent can use:

```js
const agent = iframe.contentWindow.savannaAgent;
const tools = agent.listTools();
const document = await agent.executeTool('savanna_get_document', {});
await agent.executeTool('savanna_rename_document', {
  fileId: document.result.fileId,
  name: 'Project plan',
});
```

For a cross-origin host, set an exact comma-separated origin allowlist at build time:

```dotenv
VITE_EDITOR_AGENT_ORIGINS=https://host.example,https://another-host.example
```

HTTPS origins are required, with HTTP localhost allowed for development. Paths,
wildcards, and arbitrary HTTP origins are rejected. The configured origins are
also supplied to native WebMCP's `exposedTo` option. Default access is same-origin.
Fallback messages are accepted only from the editor iframe's immediate parent.

The parent can implement a request/response client without native WebMCP:

```js
const editorOrigin = 'https://editor.example';
function editorRequest(method, extra = {}) {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', receive);
      reject(new Error('Editor agent request timed out'));
    }, 30000);
    function receive(event) {
      if (event.origin !== editorOrigin || event.source !== iframe.contentWindow ||
          event.data?.protocol !== 'savanna-agent-v1' || event.data.id !== id) return;
      clearTimeout(timer);
      window.removeEventListener('message', receive);
      resolve(event.data);
    }
    window.addEventListener('message', receive);
    iframe.contentWindow.postMessage({
      protocol: 'savanna-agent-v1', id, method, ...extra,
    }, editorOrigin);
  });
}
const tools = await editorRequest('listTools');
const document = await editorRequest('executeTool', {
  name: 'savanna_get_document', arguments: {},
});
if (!document.ok) throw new Error(document.error);
const renamed = await editorRequest('executeTool', {
  name: 'savanna_rename_document',
  arguments: { fileId: document.result.fileId, name: 'Project plan' },
});
```

Tool schemas are returned by `listTools`; do not hardcode shape or page IDs. Read
`savanna_get_document` and `savanna_get_page` first. Edits require the expected
file/page IDs and reject a request if the user changed documents or pages.
Executions serialize and errors return `{ ok: false, error }`. Commands are
available only when the route's document and current page are loaded.

## Local models

Qwen3.5 4B is the only local model. Its deck workflow uses upstream design
references directly; it has no embedding/retrieval dependency. Run
`node --test scripts/local-deck.test.mjs scripts/editor-agent-worker.test.mjs`
for staged generation, validation, review, cancellation and worker-budget checks.

## AutoShapes

`savanna_add_autoshape` exposes all 173 named presets from the editor's public
AutoShapes palette: basic shapes, stars, arrows, callouts, flowchart shapes, math
symbols, banners, action buttons and connectors. Its schema is derived from the
shared palette catalog rather than a separately maintained three-shape list.
The adapter uses public `getPrstInfo` geometry at the requested dimensions and
preserves serializable transforms and text margins. Open shapes retain no-fill
behavior and use the requested color for their stroke. Changes use normal Undo.
Default geometry is 200x120 at 100,100; circles require equal dimensions.

Use preset IDs such as `star5`, `star12`, `roundRect`, `heart`, `rightArrow`,
`wedgeRectCallout`, `flowChartDecision`, or `curvedConnector3`. Existing `oval`,
`rectangle`, and `triangle` calls remain supported; `star` means `star5`.
Gemini/OpenAI and WebMCP can call these tools. Freeform and scribble tools require drawn points and are
not named presets; they are not exposed as fake AutoShapes.

Regression tests exercise every palette preset at landscape and portrait aspect
ratios with the actual shared geometry formulas. This also covers five repaired
palette geometry cases: On-Page Connector, Sort, Filter, Start and Stop.

## Relative selected-shape moves

Gemini, OpenAI and external WebMCP clients can use savanna_move_shape_by with
dx/dy and an optional shapeId. Positive dy moves down; positive dx moves right.
An omitted axis is zero. An omitted shapeId requires exactly one selected shape.
The adapter computes coordinates after pending text saves, validates the target
and saves through normal Undo. Locked/linked/anchored targets and destinations
outside allowed bounds are rejected. Local Qwen mode only creates new slides.

## Testing local deck generation

Start with a one-slide request, then the three-page Hello World case. Evaluate
content quality, composition variety, readability, image placeholders, memory
usage and generation time on the target browser/GPU. This workflow is covered by
mocked worker/authoring tests; Qwen 4B has not been validated on this session's
actual GPU. Stop and reload after runtime failures. Use Undo between trials.

## Expanding agent coverage from public library exports

The consumed-import inventory is generated with `npm run inventory:editor-agent`:
see `agent-api-inventory.md` for a readable list and `agent-api-inventory.json` for
source usages and the current agent schemas. This inventories every static named,
default, namespace, type and side-effect import plus literal dynamic module imports
from shared-vuejs in editor source. It does not automatically publish them as tools.
Many exported values are getters, constants, classes, rendering helpers, DOM/event
handlers, or low-level operations with implicit selection/save requirements.

To expose an editor capability, add a descriptive JSON schema and adapter method
mapping to the definitions in `editor-tools.mjs`, implement that method in
`editor-adapter.ts` using public shared-library exports. Define target selection,
units, defaults, save/Undo behavior,
and any unsupported targets in the tool description. Then run the inventory
and regression suite. This registry feeds WebMCP and the cloud agents. New tools
are discoverable through listTools. Local Qwen only returns a deck creation call.

`savanna_format_text` formats all text in a plain, unlinked textbox. It accepts
fontSize (the numeric size used by the editor's toolbar), fontFamily, bold, italic,
underline, and textColor. Omit shapeId for one selected textbox; local plans bind
that selection from the captured context. It preserves content, paragraph
alignment, unrelated run styles, and box geometry. It formats the whole textbox,
not a caret or selected substring, and does not promise auto-resizing the box.
Examples: `Set the selected text size to 32`, `Make the selected textbox bold`,
and `Change the title font to Arial`. These use Gemini/OpenAI or external WebMCP clients.

Paragraph insertion uses `savanna_insert_text` on the single selected textbox (or an explicit shape ID). “Insert a disclaimer after last paragraph” appends new paragraphs inside that box; it does not create a textbox or replace its existing content. An optional one-based `afterParagraph` targets another paragraph. Existing runs and paragraph formatting are preserved, and new paragraphs inherit the preceding paragraph's style. Linked document frames and groups are unsupported; a single editable table cell is supported. If drafting needs more context, the model should ask for it.

When the caret is inside a plain textbox, the agent saves its position before focus moves to the command panel. “Add text” and “insert text” use `savanna_insert_text_at_cursor` at that position through the native editor text/history path. Explicit paragraph placement uses the paragraph insertion tool; an explicit new textbox request creates a box. The saved cursor is bound to its document/page and checked again before insertion; changed or rebuilt text requires placing the cursor again. Text-range replacement and linked frames are not supported by this cursor action; a text range inserts after its end and a single table cell is supported.

Text-target precedence: for add/insert text, a caret inserts at its saved position; selected text inserts after the selection without replacing it; a selected shape with `txBody` or a single table cell receives appended paragraphs when there is no caret. Only an explicit new/another textbox request creates a separate textbox while a text target is selected. Multiple selected text shapes or cells require choosing one target. Locked, anchored, linked frames and merged continuation cells remain protected.

Empty text-capable AutoShapes are valid selected text targets even before they have a `txBody`. Inserting text initialises their text body and preserves geometry and fill. Lines and polygons are excluded.

## Agent thumbnail rebuilding

Generated deck pages are inserted and persisted before a final sequential
thumbnail pass. The agent waits for that pass to finish and reports progress for
each preview. It renders stored pages by explicit slide ID without navigating
away from the selected page. Each agent thumbnail may take up to 60 seconds;
ordinary editor previews retain their existing deadlines. A failed preview adds
a warning and does not prevent the remaining previews from rebuilding. If deck
insertion stops partway, committed pages still receive a thumbnail pass. Changing
to another document stops the pass so previews cannot be written into that file.
