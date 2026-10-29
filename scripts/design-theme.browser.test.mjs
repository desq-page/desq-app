import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runBrowserFixture} from './browser-fixture.mjs';
const chrome=['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium'].find(existsSync);
test('master design composes palettes, fonts, variants and backgrounds without changing geometry or other masters',{skip:!chrome,timeout:60000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'savanna-design-'));
 try{
  await build({stdin:{resolveDir:resolve('.'),contents:`
import {buildMasterDesignPatch} from './shared-vuejs/src/edlib/pptx/design-theme.mjs';
import {OFFICE_COLOR_SCHEMES} from './editor-vuejs/src/lib/agent/office-color-schemes.mjs';
import {ZipReader,Uint8ArrayReader,Uint8ArrayWriter} from '@zip.js/zip.js';
const check=(v,m)=>{if(!v)throw Error(m)},decode=b=>new TextDecoder().decode(b);
(async()=>{
 const bytes=Uint8Array.from(atob(${JSON.stringify(readFileSync('editor-vuejs/public/templates/builtin/builtin.pptx').toString('base64'))}),c=>c.charCodeAt(0));
 const reader=new ZipReader(new Uint8ArrayReader(bytes)),archive={};
 for(const entry of await reader.getEntries())if(!entry.directory)archive[entry.filename]=await entry.getData(new Uint8ArrayWriter());
 await reader.close();
 archive['ppt/slideMasters/otherMaster.xml']=archive['ppt/slideMasters/slideMaster1.xml'];
 archive['ppt/slideMasters/_rels/otherMaster.xml.rels']=archive['ppt/slideMasters/_rels/slideMaster1.xml.rels'];
 const original={...archive},geometry=xml=>Array.from(new DOMParser().parseFromString(xml,'application/xml').getElementsByTagNameNS('*','xfrm')).map(n=>[n.localName,...Array.from(n.attributes).filter(a=>!a.name.startsWith('xmlns')).map(a=>[a.name,a.value]),...Array.from(n.children).map(c=>[c.localName,...Array.from(c.attributes).filter(a=>!a.name.startsWith('xmlns')).map(a=>[a.name,a.value])])]).map(v=>JSON.stringify(v)).join(''),placeholders=xml=>Array.from(new DOMParser().parseFromString(xml,'application/xml').getElementsByTagNameNS('*','ph')).map(n=>[n.localName,...Array.from(n.attributes).filter(a=>!a.name.startsWith('xmlns')).map(a=>[a.name,a.value]),...Array.from(n.children).map(c=>[c.localName,...Array.from(c.attributes).filter(a=>!a.name.startsWith('xmlns')).map(a=>[a.name,a.value])])]).map(v=>JSON.stringify(v)).join('');
 let state={},last;const apply=change=>{last=buildMasterDesignPatch(archive,{masterId:'slideMaster1',state,change});Object.assign(archive,last.parts);state=last.state;};
 const blue=OFFICE_COLOR_SCHEMES.find(c=>c.id==='blue');
 apply({colorId:blue.id,colorsName:blue.name,colors:blue.colors});
 const backgroundRole=bytes=>new DOMParser().parseFromString(decode(bytes),'application/xml').getElementsByTagNameNS('*','bg')[0]?.getElementsByTagNameNS('*','schemeClr')[0]?.getAttribute('val');
 check(backgroundRole(archive['ppt/slideMasters/slideMaster1.xml'])===backgroundRole(original['ppt/slideMasters/slideMaster1.xml']),'palette replaced existing master background');
 apply({fontId:'georgia-arial'});apply({variant:'dark'});apply({background:'accent2'});
 const theme=decode(archive[last.themePath]),master=decode(archive['ppt/slideMasters/slideMaster1.xml']);
 check(theme.includes('typeface="Georgia"')&&theme.includes('typeface="Arial"'),'font pair missing');
 check(theme.includes(blue.colors.accent1),'palette lost after font/background changes');
 check(master.includes('val="accent2"'),'background not applied');
 check(state.colorId==='blue'&&state.fontId==='georgia-arial'&&state.variant==='dark'&&state.background==='accent2','combined state lost');
 check(last.layoutPaths.length===18,'master layouts not resolved');
 for(const path of ['ppt/slideMasters/slideMaster1.xml',...last.layoutPaths]){check(geometry(decode(archive[path]))===geometry(decode(original[path])),'geometry changed: '+path);check(placeholders(decode(archive[path]))===placeholders(decode(original[path])),'placeholder identity changed: '+path);}
 for(const path of Object.keys(original).filter(p=>p.includes('otherMaster')||p.includes('/theme/')))check(decode(original[path])===decode(archive[path]),'unrelated master/theme changed: '+path);
 check(decode(archive['ppt/slideMasters/_rels/slideMaster1.xml.rels']).includes('/'+last.themePath),'master private theme relationship missing');
 apply({background:'auto'});check(decode(archive['ppt/slideMasters/slideMaster1.xml']).includes('val="dk2"'),'auto background did not follow dark variant');
 document.body.innerHTML='<pre id="result">PASS</pre>';
})().catch(e=>document.body.innerHTML='<pre id="result">'+e.stack+'</pre>');`},bundle:true,format:'esm',outfile:join(dir,'fixture.js'),logLevel:'silent'});
  writeFileSync(join(dir,'index.html'),'<script type="module" src="fixture.js"></script>');
  const output=await runBrowserFixture(chrome,pathToFileURL(join(dir,'index.html')).href,join(dir,'profile'));
  assert.match(output,/<pre id="result">PASS<\/pre>/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
