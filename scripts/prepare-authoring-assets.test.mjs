import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {prepareAuthoringAssets,authoringAssetPaths} from './prepare-authoring-assets.mjs';
import {AUTHORING_GUIDE_URL,buildHtmlAuthoringPrompt} from '../editor-vuejs/src/lib/agent/html-authoring-prompt.mjs';

test('published authoring assets match their sources and include linked local references', async t=>{
  const directory=await mkdtemp(join(tmpdir(),'desq-authoring-assets-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const target=pathToFileURL(directory+sep);
  await prepareAuthoringAssets(target);
  for(const path of authoringAssetPaths){
    const published=new URL(path,target);
    assert.equal(await readFile(published,'utf8'),await readFile(new URL('../'+path,import.meta.url),'utf8'));
    if(path.endsWith('.md')){
      const text=await readFile(published,'utf8');
      for(const [,link] of text.matchAll(/\]\(([^)]+)\)/g)){
        if(/^https?:|^#/.test(link))continue;
        assert.ok((await stat(new URL(link,published))).isFile(),`Unpublished reference: ${link}`);
      }
    }
  }
  await writeFile(new URL('AGENTS.md',target),'stale guide');
  await prepareAuthoringAssets(target);
  assert.equal(await readFile(new URL('AGENTS.md',target),'utf8'),await readFile(new URL('../AGENTS.md',import.meta.url),'utf8'));
});

test('HTML authoring prompts reference the public contract without embedding its body',()=>{
  assert.equal(buildHtmlAuthoringPrompt('  '),'');
  const prompt=buildHtmlAuthoringPrompt('  Build a branching geography game.  ');
  assert.ok(prompt.includes(AUTHORING_GUIDE_URL));
  assert.ok(prompt.includes('https://desq.page/docs/html-slide-interactions.md'));
  assert.ok(prompt.endsWith('Build a branching geography game.'));
  assert.match(prompt,/downloadable UTF-8 \.html/);
  assert.match(prompt,/animations and morph/);
  assert.ok(!prompt.includes('## Required delivery'));
});
