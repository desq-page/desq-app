import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse, compileScript, compileStyle } from '@vue/compiler-sfc';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { transform } from 'esbuild';

const require = createRequire(import.meta.url);
const filename = fileURLToPath(new URL('../editor-vuejs/src/pages/HomePage.vue', import.meta.url));
let cachedSource;
let cachedPage;

// Vue runs here in Node, never on the landing page. Generate static markup
// from the existing component so copy, links and styling have one source.
export async function renderHomePage() {
  const source = await fs.readFile(filename, 'utf8');
  if (source === cachedSource) return cachedPage;
  const id = 'data-v-savanna-static-home';
  const { descriptor, errors } = parse(source, { filename });
  if (errors.length) throw errors[0];
  const script = compileScript(descriptor, {
    id, inlineTemplate: true, templateOptions: { ssr: true },
  });
  const compiled = await transform(script.content, { loader: 'ts', format: 'esm' });
  const code = compiled.code.replace(/from (["'])(vue(?:\/server-renderer)?)\1/g,
    (_, quote, module) => `from ${quote}${pathToFileURL(require.resolve(module)).href}${quote}`);
  const { default: component } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  component.__scopeId = id;
  const html = await renderToString(createSSRApp(component));
  const css = descriptor.styles.map(style => {
    const result = compileStyle({ filename, source: style.content, id, scoped: style.scoped });
    if (result.errors.length) throw result.errors[0];
    return result.code;
  }).join('\n');
  cachedSource = source;
  cachedPage = { html, css };
  return cachedPage;
}

export function staticHomePagePlugin() {
  return {
    name: 'savanna-static-home',
    generateBundle(_options, bundle) {
      const targets = ['/src/main.js', '/src/pages/DashboardWorkspace.vue',
        '/src/pages/DashboardPage.vue', '/src/pages/DashboardFiles.vue'];
      const files = new Set();
      const visit = filename => {
        if (files.has(filename)) return;
        const chunk = bundle[filename];
        if (chunk?.type !== 'chunk') return;
        files.add(filename);
        for (const dependency of chunk.imports || []) visit(dependency);
        for (const css of chunk.viteMetadata?.importedCss || []) files.add(css);
      };
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        const modules = [chunk.facadeModuleId, ...Object.keys(chunk.modules || {})];
        if (modules.some(id => targets.some(target => id?.replaceAll('\\', '/').split('?')[0].endsWith(target)))) visit(chunk.fileName);
      }
      this.emitFile({ type: 'asset', fileName: 'dashboard-preload.json',
        source: JSON.stringify([...files].sort()) });
    },
    transformIndexHtml: {
      order: 'pre',
      async handler(html) {
        const page = await renderHomePage();
        return html.replace('<!-- static-home-content -->', () => page.html)
          .replace('<!-- static-home-style -->', () => `<style id="static-home-style">html, body { margin: 0; padding: 0; }\n${page.css}</style>`);
      },
    },
  };
}
