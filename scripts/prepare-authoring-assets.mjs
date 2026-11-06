import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Marked, Renderer} from 'marked';

const publicRoot = new URL('../editor-vuejs/public/', import.meta.url);
export const authoringAssetPaths = ['AGENTS.md', 'docs/html-slide-interactions.md', 'docs/local-scripting.md', 'examples/html-slides/local-quiz.html', 'examples/html-slides/quiz.html'];

const renderer = new Renderer();
renderer.link = function (token) {
  const href = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(token.href)
    ? token.href
    : token.href.replace(/\.md(?=[?#]|$)/i, '.html');
  return Renderer.prototype.link.call(this, {...token, href});
};
const markdown = new Marked({renderer});

async function publish(destination, content) {
  const existing = await readFile(destination).catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return null;
  });
  if (existing?.equals(content)) return;
  await mkdir(new URL('.', destination), {recursive:true});
  await writeFile(destination, content);
}

// The repository guides are authoritative; public copies are generated assets.
export async function prepareAuthoringAssets(target = publicRoot) {
  for (const path of authoringAssetPaths) {
    const source = new URL('../' + path, import.meta.url);
    const content = await readFile(source);
    await publish(new URL(path, target), content);
    if (!path.endsWith('.md')) continue;
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DESQ authoring guide</title>
</head>
<body>
<main>
${markdown.parse(content.toString('utf8'))}</main>
</body>
</html>
`;
    await publish(new URL(path.replace(/\.md$/, '.html'), target), Buffer.from(html));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await prepareAuthoringAssets();
