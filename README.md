# DESQ

DESQ is a browser-based presentation editor for creating, editing, and sharing presentations in HTML and PowerPoint formats.

For LLM-authored HTML presentations, see [AGENTS.md](AGENTS.md). It documents the current import contract and links to the proposed interaction API and a standalone quiz example.

Development and production asset preparation syncs this guide and its linked references into `editor-vuejs/public/`, making them available at `/AGENTS.md`, `/docs/html-slide-interactions.md` and `/examples/html-slides/quiz.html`. To refresh these public copies directly, run `node scripts/prepare-authoring-assets.mjs`. Edit the source guides and example, rather than their generated public copies.

## Install and develop

Install Node.js 20.19 or later in the 20.x series, or Node.js 22.12 or later, with npm. From the repository root, run:

```bash
npm ci
node editor-vanjs/scripts/build.mjs --publish
npm run dev
```

The build command prepares the standalone editor and player files used by HTML export. The development server prepares its remaining player assets and prints its local URL, normally `https://localhost:6173/`. Open that URL in your browser, then choose **Workspace** to create or open a file. Press `Ctrl+C` in the terminal to stop the server.

Run the standalone editor build command again after changing its source files. The required compiled packages are included in the repository and installed by `npm ci`.

## License

DESQ application code is licensed under the GNU Affero General Public License
version 3.0 only (`AGPL-3.0-only`). See [LICENSE](LICENSE) for the full terms.

Third-party dependencies, vendored assets, and bundled core packages retain their
own license terms. See [NOTICE.txt](NOTICE.txt) and
[OPEN_SOURCE_PROJECTS.md](OPEN_SOURCE_PROJECTS.md) for third-party notices.
