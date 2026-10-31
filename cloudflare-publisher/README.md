# Desq Cloudflare production deployment

The main production build and published user content are hosted on Cloudflare.
The repository defaults to `VITE_PUBLISH_TARGET=cloudflare`; the publishing backend
is fixed at development/build time. The publish dialog has no backend selector.

The same Worker hosts:

| URL | Content |
| --- | --- |
| `https://desq.page/` | Main editor production build, Workers Static Assets |
| `https://desq.page/powerpoint-addin/` | PowerPoint add-in and its static assets |
| `https://desq.page/api/agent/*` | Shared Gemini/OpenAI agent API; private per-browser Durable Object sessions |
| `https://desq.page/edit/{fileId}` | Editor SPA route |
| `https://desq.page/{username}/{file-name}/...` | Published HTML/assets, private R2 |
| `https://publish-api.desq.page/api/...` | Google-authenticated publishing API |

`ASSETS` binds `editor-vuejs/dist`. The Worker runs first so user folders and API
requests never fall through to the editor SPA. Missing publications return 404.
Large bundled application files (currently two ONNX models) go in the private
`desq-app-assets` R2 bucket and retain their original application URLs. The
build script detects files above 25 MiB and generates `.assetsignore` plus
`wrangler.generated.json` to keep them outside the Workers static-asset upload.
See [Workers Static Assets configuration](https://developers.cloudflare.com/workers/static-assets/binding/).

The Cloudflare build first rebuilds the sibling `desq-core` project and stages its compiled shared library and player into the installed packages for both the app and add-in. It then builds the app and the sibling `desq-officejs` project, copying the add-in output into `editor-vuejs/dist/powerpoint-addin/` before asset scanning and deployment. Install dependencies in all three projects first. Set `DESQ_CORE_DIR` or `DESQ_OFFICEJS_DIR` if the checkouts are elsewhere; the build fails if either is unavailable. Staging replaces the installed package outputs without changing release archives or lockfiles; run `npm ci` in a consumer to restore its packaged versions. The `powerpoint-addin` namespace is reserved for this application, so it cannot also be a published-content username.

Cloudflare publishing does not require the Node server or a socket connection.
The Cloudflare build skips the legacy Docker login/sync requests. Editing files
still uses this browser's Dexie/OPFS storage; publishing uploads HTML output,
not an editable document sync service.

## Agent hosting

The editor calls Gemini directly from the browser with the user’s own API key. Gemini traffic and keys bypass the Worker, avoiding dependence on Cloudflare’s outbound location. The Worker retains legacy Gemini endpoints and hosts the OpenAI adapter using `nodejs_compat`; no Node
companion or upstream proxy is required. `wrangler.jsonc` declares the
`AGENT_SESSIONS` SQLite Durable Object binding and migration. Deploy the Worker
and editor together so the panel can discover the server's authentication mode.
Users provide their own Gemini or OpenAI API keys unless approved ChatGPT plan OAuth is configured. Do not set a global provider
key on the hosted Worker. Sessions use HttpOnly Secure cookies and private
Durable Object storage, expire after eight hours, and survive Worker cold starts.
Disconnect clears the provider credential. Gemini's browser key persistence
remains an explicit device preference described in the Agent panel.

ChatGPT plan OAuth is available in local Vite development through an automatic
loopback callback. The documented OSS flow cannot use a public website callback;
hosted OpenAI defaults to API keys with separate API billing. For an OpenAI-approved website client with ChatGPT plan usage, configure `OPENAI_OAUTH_CLIENT_ID`, `OPENAI_OAUTH_PLAN_ENABLED=true`, and the registered HTTPS `/api/agent/chatgpt/callback` redirect. Store a confidential client's `OPENAI_OAUTH_CLIENT_SECRET` using Wrangler secrets. See
[agent hosting details](../editor-vuejs/docs/editor-agent.md#shared-agent-host).

## Editor telemetry

Direct editor visits reach the Worker as GET `/edit/{fileId}` requests.
Opening a cached file from the Dashboard uses browser navigation rather than
Vue Router navigation, producing a real GET request for the editor page.
Navigation within the Cloudflare app, including development mode, sends a best-effort HEAD to
the same URL with no request body, credentials, or referrer. Initial navigation
also sends HEAD, ensuring a request when the editor shell is served locally.
A direct visit can therefore produce both GET and HEAD log entries.
GET serves the editor HTML; HEAD returns
204 without downloading HTML or fetching a document. Both disable caching so
subsequent visits reach the Worker.

The Worker logs only a server-generated `timestamp`. Cloudflare request logs
also contain the URL, including its file ID, and may contain technical request
metadata. No document content, file names, or user IDs are included in the
client telemetry request. Neither request accesses account or document storage.
In development, HEAD requests reach the local development server for either
server.

Wrangler observability is enabled with full sampling. View events in the
Worker's Observability logs by filtering for `/edit/`. Deploy both the
editor assets and Worker with `npm run deploy:app` in this directory to enable
the client hook, endpoint, and updated Terms & Privacy page together.

## Build-time backend configuration

Cloudflare is the frontend's default production backend. The legacy nginx/Express
deployment has been removed. Configure public frontend settings in local environment
files using `editor-vuejs/.env.cloudflare.example` as a template. Keep actual
server-side credentials in Wrangler secrets, never frontend `VITE_*` variables.

## URLs and storage

The public username is copied exactly from the verified Google email address’s
local part: `john.smith@gmail.com` becomes `john.smith`. Dots, underscores,
hyphens, plus signs, and letter case are preserved. No suffix is added.
Reserved site names or a username already claimed by another Google account
are rejected. Google `sub` remains the private ownership identifier (`userId`).

```text
Public link: https://desq.page/{username}/{file-name}
R2 assets:  {username}/{file-name}/_revisions/{revision}/index.html
            {username}/{file-name}/_revisions/{revision}/player.js
            {username}/{file-name}/_revisions/{revision}/player.css
            {username}/{file-name}/_revisions/{revision}/media/...
            {username}/{file-name}/_revisions/{revision}/fonts/...
```

The Worker resolves the public folder to its current revision. The link redirects
to a trailing slash so HTML-relative asset links work. Every file has its own
player, HTML pages, media and fonts; filenames do not collide across users or files.
Metadata lives in `_private/`, which the public handler cannot serve.

Username mappings are stored in the `CONTENT` R2 bucket (`desq-published`):
`_private/users/{userId}.json` contains `{ "username": "john.smith" }`, and
`_private/usernames/{username}.json` contains `{ "userId": "..." }`.
Publication manifests, uploads, and quota locks remain keyed by the verified
Google user ID under `_private/`. Asset revisions use username folders only;
old numeric asset folders are not supported and can be deleted from R2.

Ownership comes exclusively from a server-verified Google token; callers cannot
supply another owner ID. The Worker verifies Google's signature, issuer, audience
and expiry. See [Google's verification guidance](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).
Sign-in credentials are cached in browser local storage to survive page refreshes,
revalidated by the API on restore, and removed on sign-out or failed restoration.
They expire with the Google ID token;
sign in again when asked. No Google client secret is needed for this GIS flow.

## Deploy

1. Add `desq.page` to your Cloudflare account. Enable R2.
2. Create a Google OAuth **Web application** client. Add your editor's exact
   JavaScript origin `https://desq.page` and, for local work,
   `https://localhost:6173`. Configure/publish the OAuth consent screen as appropriate.
3. In `wrangler.jsonc`, set `GOOGLE_CLIENT_ID` and `ALLOWED_ORIGINS` to the client ID
   and the actual editor origins. The API and public domains are separate origins.
4. Copy the values in `editor-vuejs/.env.cloudflare.example` into the editor's
   `.env.production.local` (or `.env.local` for development). Use the same Google
   client ID as the Worker. `VITE_CLOUDFLARE_PUBLIC_ORIGIN` controls the URLs
   displayed by the publish dialog and must match the Worker `PUBLIC_ORIGIN`. The
   main domain uses Cloudflare mode.
5. Install dependencies once (the player has its own package):

   ```sh
   # From the repository root
   npm install
   npm --prefix player install
   npm --prefix cloudflare-publisher install
   ```

   Then provision/deploy from `cloudflare-publisher`:

   ```sh
   cd cloudflare-publisher
   npx wrangler login
   npx wrangler r2 bucket create desq-published
   npx wrangler r2 bucket create desq-app-assets
   npm run deploy
   ```

   From the repository root, use `npm run deploy:cloudflare` (or
   `npm --prefix cloudflare-publisher run deploy`). `npm run deploy` by itself
   must be run inside `cloudflare-publisher`; the root package has no `deploy` script.

   Wrangler registers the two Worker custom domains in the configured Cloudflare
   zone. Review any existing DNS/origin setup before deploying these domains.
   See [Worker custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
   and [R2 Worker bindings](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).
   `npm run deploy` builds the player and production editor, uploads large app
   files to R2, then deploys the Worker and the main static build together.
6. Open `https://desq.page`, open Publish to Web, sign in with Google, choose a lowercase
   file name, and publish. Use the listed public link to view or share the result.

Both R2 buckets must stay private; do not enable an R2 public domain or r2.dev access. The Worker
is the public gateway and prevents direct access to metadata and incomplete uploads.

## Local Worker development

### Faster redeployments

After the initial full deployment, choose the command for your change:

| Change | Command from repository root |
| --- | --- |
| Worker code or configuration only | `npm run deploy:cloudflare:worker` |
| Editor/player changes, unchanged ONNX models | `npm run deploy:cloudflare:app` |
| Initial deployment or changed ONNX models | `npm run deploy:cloudflare` |

The Worker command reuses `editor-vuejs/dist` and regenerates the deployment
configuration and asset exclusions. It skips both builds and the large R2
uploads, so ONNX files are neither copied by a build nor uploaded again.
Wrangler still processes the existing static asset bundle when deploying.
The app command rebuilds the player, refreshes the packaged shared library from
the current sources, and builds the editor. It skips the large R2 uploads.
Both require a previous build and the ONNX files to already exist in R2.
Inside `cloudflare-publisher`, the corresponding commands are
`npm run deploy:worker`, `npm run deploy:app`, and `npm run deploy`.

Set `API_ORIGIN` and `PUBLIC_ORIGIN` to `http://localhost:8787` in `.dev.vars`, set
`GOOGLE_CLIENT_ID`, and allow the local editor origin in `ALLOWED_ORIGINS`.
Run `npm run build` once, then `npm run dev`; point the editor's `VITE_CLOUDFLARE_PUBLISH_API` at that local
origin. Restart Vite after changing its environment variables. Local Wrangler uses
local R2 storage; avoid mixing local and production data.

## Publication behavior and limits

- Every publish regenerates HTML, then uploads each asset separately. A conditional
  manifest write switches the public URL only after all assets exist with the
  expected size. Failed or conflicting uploads leave the previous publication intact.
- Publishing a different editor file at an occupied file name returns a conflict.
  Changing a file name creates a second publication; use Unpublish to remove the old one.
- Unpublish removes the public manifest and deletes its current revision in the
  background. Successful updates also delete the previous revision in the background.
- Failed uploads are private and expire after one hour, but their R2 objects remain.
  Administrators should periodically remove expired `_private/uploads/` records and
  their referenced draft revisions. Do **not** apply a blanket lifecycle deletion to
  all `_revisions/` objects: active publications live there too.
- Current limits: 400 assets, 25 MiB per asset, 250 MiB total per publication.
  Use a Workers plan with sufficient subrequests for this limit: commit performs
  one R2 head request per asset. Larger media need a separate multipart upload flow.
- Public objects use `Cache-Control: no-cache`, ETags and byte ranges so updates and
  unpublishing are observed without waiting for a long CDN cache expiry.
- Published HTML/SVG is served with CSP sandbox isolation and public asset CORS.
  Pages can run scripts, but do not inherit the editor/API security origin. Features
  needing origin storage, service workers or unrestricted navigation require review
  before changing that sandbox policy.

## API

All API calls use `Authorization: Bearer <Google ID token>` on `publish-api.desq.page`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/me` | Verified user ID, public username and display name |
| GET | `/api/files?cursor=...` | Owner's published files, paginated |
| POST | `/api/files/{slug}/uploads` | Start an upload with file metadata and asset sizes |
| PUT | `/api/files/{slug}/uploads/{revision}/assets?path=...` | Upload one declared asset |
| POST | `/api/files/{slug}/uploads/{revision}/commit` | Verify and publish the complete revision |
| DELETE | `/api/files/{slug}` | Unpublish an owned file |

Published user routes only accept GET/HEAD and serve declared assets of the current
revision. Other routes serve the editor build. Neither route exposes private
metadata or draft revisions. Published HTML retains its CSP sandbox isolation
even though the editor and public content share `desq.page`; the editor service
worker bypasses published user folders.

## Backend source layout

The provider/OAuth service modules are in `src/agent/`. `src/agent.js` wraps them
in a Cloudflare Durable Object. `src/agent/node.mjs` and `oauth-store.mjs` are
local-development adapters used by Vite and tests; no separate Node server is
built or deployed in production. Never put provider API keys or OAuth client
secrets in `vars` or frontend code. Configure actual server-side secrets with
Wrangler secrets and keep development credentials in ignored local files.
