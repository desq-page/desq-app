import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const publicRoot = new URL('../editor-vuejs/public/', import.meta.url);
export const authoringAssetPaths = ['AGENTS.md', 'docs/html-slide-interactions.md', 'docs/local-scripting.md', 'examples/html-slides/local-quiz.html', 'examples/html-slides/quiz.html'];

// The repository guides are authoritative; public copies are generated assets.
export async function prepareAuthoringAssets(target = publicRoot) {
  for (const path of authoringAssetPaths) {
    const source = new URL('../' + path, import.meta.url), destination = new URL(path, target);
    const content = await readFile(source);
    const existing = await readFile(destination).catch(error => {
      if (error.code !== 'ENOENT') throw error;
      return null;
    });
    if (existing?.equals(content)) continue;
    await mkdir(new URL('.', destination), {recursive:true});
    await writeFile(destination, content);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await prepareAuthoringAssets();
