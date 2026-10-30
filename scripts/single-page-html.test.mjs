import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parse} from 'parse5';
import {buildSinglePageHtml} from '../shared-vuejs/src/edlib/common/export/single-page-package.mjs';
import {packDocumentAssets,unpackDocumentAssets} from '../editor-vanjs/src/document.mjs';
import {build} from 'esbuild';
const playerJs='window.player={initSinglePage(){}}; // </script>';
const slides=['<h1>First & slide</h1>','<video src="media/clip.mp4"></video>'];
const fixture=()=>buildSinglePageHtml({title:'Deck <name>.pptx',playerJs,
 playerCss:'body{color:black}',slides,
 config:{slides:[{title:'</script><script>alert(1)</script>'}]},
 assets:[{name:'media/clip.mp4',input:new Uint8Array([0,1,2,250,255])},{name:'fonts/font.woff',input:new Uint8Array([3,4,5])}]});
function nodes(root){return [root,...(root.childNodes||[]).flatMap(nodes)];}
async function inflateBlob(html,id){
 const payload=html.match(new RegExp(`id="${id}">([^<]+)<`))[1];
 const binary=Uint8Array.from(atob(payload),c=>c.charCodeAt(0));
 return new Response(new Blob([binary]).stream().pipeThrough(new DecompressionStream('gzip'))).blob();
}
async function inflate(html,id){ return (await inflateBlob(html,id)).text(); }
async function documentData(html){return JSON.parse(await inflate(html,'player-document'));}
async function decode(html,meta){
 const raw=Buffer.from(html.match(new RegExp(`id="${meta.id}">([^<]*)<`))[1],'base64');
 return meta.compression==='gzip'?new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).blob():new Blob([raw]);
}
async function mediaRecords(html){return Promise.all((await documentData(html)).assets.map(async meta=>({...meta,blob:await decode(html,meta)})));}
test('single-page HTML stores slides, CSS, config, and player in compressed inert blocks',async()=>{
 const html=await fixture();const tree=nodes(parse(html));
 assert.equal(tree.filter(n=>n.tagName==='code').length,0);
 assert.equal(tree.filter(n=>['h1','video'].includes(n.tagName)).length,0);
 assert.equal(tree.filter(n=>n.tagName==='script'&&!n.attrs.some(a=>a.name==='type')).length,1);
 assert.ok(!tree.some(n=>n.tagName==='script'&&n.attrs.some(a=>a.name==='src')));
 const document=JSON.parse(await inflate(html,'player-document'));
 assert.equal(document.version,3);
 assert.deepEqual(await Promise.all(document.slides.map(async meta=>(await decode(html,meta)).text())),slides);
 assert.equal(document.playerCss,'body{color:black}');
 assert.equal(document.config.slides[0].title,'</script><script>alert(1)</script>');
 assert.equal(await inflate(html,'player-runtime'),playerJs);
});
test('compressed media inflates losslessly with MIME information',async()=>{
 const json=await mediaRecords(await fixture());
 assert.deepEqual(json.map(({name,mime})=>[name,mime]),[['media/clip.mp4','video/mp4']]);
 assert.deepEqual([...new Uint8Array(await json[0].blob.arrayBuffer())],[0,1,2,250,255]);
});
test('repeated slide markup is compressed rather than expanded by HTML escaping',async()=>{
 const content='<div class="shape" style="position:absolute"><svg><path d="M0 0 L10 10"/></svg>&</div>'.repeat(2000);
 const html=await buildSinglePageHtml({title:'Large',playerJs:'',playerCss:'',slides:[content,content],assets:[],config:{slides:[{},{}]}});
 assert.ok(html.length<content.length/10,`${html.length} should be much smaller than ${content.length}`);
 assert.equal(await (await decode(html,(await documentData(html)).slides[1])).text(),content);
});

test('single-page exports omit font binaries and font-face rules while retaining text font families',async()=>{
 const html=await buildSinglePageHtml({title:'Fonts',playerJs:'',
  playerCss:'@font-face {font-family: Carlito;src:url(/fonts/Carlito.woff2)} body{font-family:Carlito,Arial,sans-serif}',
  fontCss:'@font-face{font-family:Custom;src:url(fonts/custom.woff)}',
  slides:['<style>@font-face{font-family:Custom;src:url(fonts/custom.woff)}</style><p style="font-family:Custom,serif">Text</p>'],
  assets:[{name:'/fonts/Carlito.woff2',input:'font'},{name:'fonts/custom.woff',input:'font'},{name:'media/odd.bin',mime:'font/ttf',input:'font'},
    {name:'media/image.png',input:new Uint8Array([1,2,3])}],config:{slides:[{}]}});
 const document=JSON.parse(await inflate(html,'player-document'));
 assert.ok(!document.playerCss.includes('@font-face'));
 assert.ok(document.playerCss.includes('font-family:Carlito,Arial,sans-serif'));
 const slide=await (await decode(html,document.slides[0])).text();
 assert.ok(!slide.includes('@font-face'));
 assert.ok(slide.includes('font-family:Custom,serif'));
 assert.equal(document.fontCss,undefined);
 assert.deepEqual((await mediaRecords(html)).map(asset=>asset.name),['media/image.png']);
});

test('each media payload encodes raw bytes once and gzip is used only when smaller',async()=>{
 const compressed='repeated plain media data '.repeat(1000);
 const bytes=new Uint8Array([0,255,17,128,42]);
 const html=await buildSinglePageHtml({title:'Assets',playerJs:'',playerCss:'',slides:['x'],
  assets:[{name:'media/one.svg',input:compressed},{name:'media/two.png',input:bytes}],config:{slides:[{}]}});
 const meta=await documentData(html);
 assert.equal(meta.assets[0].compression,'gzip');assert.equal(meta.assets[1].compression,'none');
 assert.equal(html.match(/id="player-asset-1">([^<]+)</)[1],Buffer.from(bytes).toString('base64'));
 assert.equal(await (await decode(html,meta.assets[0])).text(),compressed);
});

test('single-page HTML contains the same recoverable document payload as editable HTML',async()=>{
 const image='data:image/jpeg;base64,AQID';
 const original={version:1,file:{id:'deck',name:'</script><script>bad()</script>',width:100,height:100},
  slides:[{id:'slide',shapes:[{id:'image',blipFill:{blip:{$_target:'image.jpeg'}}}],timing:{id:'animation'}}],
  layouts:[],masters:[],themes:{theme:{name:'Theme'}},assets:{'image.jpeg':image,'ppt/media/image.jpeg':image}};
 const html=await buildSinglePageHtml({title:'Deck',playerJs,playerCss:'',slides:['x'],assets:[],config:{slides:[{}]},editableDocument:packDocumentAssets(original)});
 const match=html.match(/<script type="application\/json" id="desq-document">([\s\S]*?)<\/script>/);
 assert.ok(match);assert.ok(!html.includes('<script>bad()'));
 assert.deepEqual(unpackDocumentAssets(JSON.parse(match[1])),original);
 assert.equal((await documentData(html)).version,3,'presentation playback payload remains intact');
});

test('single-page export obtains the document after saving and includes it in the download',async()=>{
 const result=await build({entryPoints:['shared-vuejs/src/edlib/common/export/single-page-html.ts'],bundle:true,platform:'node',format:'esm',write:false,
  plugins:[{name:'fixture',setup(builder){
   builder.onResolve({filter:/.*/},args=>args.kind==='entry-point'||args.path.endsWith('single-page-package.mjs')?undefined:{path:args.path,namespace:'mock'});
   builder.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:`
    export const flushPendingTextSave=async()=>globalThis.singleFixture.calls.push('flush');
    export const saveDexie=async()=>globalThis.singleFixture.calls.push('save');
    export const exportFile=async()=>globalThis.singleFixture.calls.push('render');
    export const prepareExportFile=async()=>globalThis.singleFixture.file;
    export const createPackageEntries=async()=>[{name:'index.html',input:'page'},{name:'player.js',input:'player'},{name:'player.css',input:'body{}'}];
    export const downloadFile=async(blob,name)=>globalThis.singleFixture.download={blob,name};
    export const showProgress=()=>{};
    export const vStaticSlides={fileInfo:{id:'deck'}};
   `}));
  }}]});
 const previousDOMParser=globalThis.DOMParser,previousDocument=globalThis.document;
 const file={id:'deck',name:'Deck.pptx',width:100,height:100,slides:[{id:'s1',shapes:[]}]};
 globalThis.singleFixture={calls:[],file};
 globalThis.DOMParser=class{parseFromString(){return {getElementById:()=>({innerHTML:'slide'})}}};
 globalThis.document={createElement:()=>({content:{querySelectorAll:()=>[]}})};
 try{
  const exporter=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
  await exporter.exportSinglePageHtml({prepareDocument:async(id,prepared)=>{
   assert.equal(id,'deck');assert.equal(prepared,file);assert.deepEqual(globalThis.singleFixture.calls,['flush','save','render']);
   return packDocumentAssets({version:1,file,slides:file.slides,assets:{}});
  }});
  const html=await globalThis.singleFixture.download.blob.text();
  assert.match(html,/id="desq-document"/);assert.equal(globalThis.singleFixture.download.name,'Deck.pptx.html');
 }finally{globalThis.DOMParser=previousDOMParser;globalThis.document=previousDocument;delete globalThis.singleFixture;}
});
