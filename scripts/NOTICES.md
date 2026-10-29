# Third-party notices

Run `npm run notices` after installing dependencies to regenerate:

Maintain acknowledgements for locally adapted or inspirational upstream code in `scripts/local-open-source-credits.json`; these entries are included on every regeneration, even though they are absent from npm lockfiles.

- `NOTICE.txt`: project inventory and original supplied license/copyright texts.
- `OPEN_SOURCE_PROJECTS.md`: readable project, version, and declared license list.
- `editor-vuejs/public/NOTICE.txt`: the same notice served at `/NOTICE.txt`.

The editor's `build`, `build:docker`, and `build:dev` commands regenerate these files before Vite copies public assets into `editor-vuejs/dist`. Cloudflare's build invokes the editor build and therefore includes the notice too.

The generator follows runtime dependency trees in the root and player lockfiles, including the editor and server workspaces, installed peer dependencies, and optional dependencies. It excludes development-only roots, but includes dependencies declared as runtime dependencies even if they are tooling or are later removed by tree shaking. It also preserves supplied notices in vendored source and public assets, including Photopea UDOC and mini-van-plate.

The `METADATA GAPS` section identifies packages without standalone license files. The generator does not infer licenses for unidentified vendored assets, fetch missing licenses, or substitute generic license templates for original copyright notices. Review these gaps and any separately distributed fonts, models, or assets before release. Package declarations and this inventory alone do not establish fulfillment of every license obligation.
