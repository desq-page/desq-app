import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { videoSettings, MAX_VIDEO_BYTES, MIN_VIDEO_BYTES } from '../shared-vuejs/src/edlib/common/media/video-policy.mjs';

test('video policy preserves aspect ratio, avoids upscaling, and budgets audio', () => {
  assert.deepEqual(videoSettings(1920,1080,60),{width:1280,height:720,bitrate:2_000_000});
  assert.deepEqual(videoSettings(640,360,60),{width:640,height:360,bitrate:2_000_000});
  const portrait = videoSettings(1080,1920,300,128000);
  assert.equal(portrait.height,720);
  assert.equal(portrait.width,404);
  assert.ok((portrait.bitrate+128000)*300/8 < MAX_VIDEO_BYTES);
  assert.throws(() => videoSettings(1280,720,2000,128000),/too long/);
  assert.throws(() => videoSettings(0,720,60),/Invalid/);
});

for (const name of ['video.mp4', 'video.m4v', 'video.M4V', 'video.mov', 'video.MOV', 'video.avi', 'video.AVI']) {
test(`${name}: preserves originals, deduplicates jobs, caches results and rejects stale/larger copies`, async () => {
  const result = await build({entryPoints:['shared-vuejs/src/edlib/common/media/video-optimization.ts'],bundle:true,format:'esm',platform:'browser',write:false,
    plugins:[{name:'opfs',setup(b){
      b.onResolve({filter:/\/db\/opfs$/},() => ({path:'opfs',namespace:'mock'}));
      b.onLoad({filter:/.*/,namespace:'mock'},() => ({contents:`
        export const getFileFromOPFS = path => globalThis.videoTest.get(path);
        export const getMediaRecordsFromOPFS = async () => [{name:${JSON.stringify(name)}}];
        export const saveToOPFS = (path,data) => globalThis.videoTest.save(path,data);
      `}));
    }}]});
  const module = await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text.replaceAll('import.meta.url', JSON.stringify(import.meta.url))).toString('base64'));
  const saved = new Map();
  let original = new File([new Uint8Array(MIN_VIDEO_BYTES+1)],name,{lastModified:10});
  let encodes=0,mode='smaller',terminated=0;
  const old = Object.fromEntries(['Worker','VideoEncoder','document','videoTest'].map(key => [key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  Object.defineProperty(globalThis,'VideoEncoder',{configurable:true,value:class {}});
  Object.defineProperty(globalThis,'Worker',{configurable:true,value:class {
    postMessage() { encodes++; if(mode==='cancel'){setImmediate(() => cancelButton.onclick());return;} setImmediate(() => this.onmessage({data:{result:new Blob([new Uint8Array(mode==='smaller'?100:original.size+1)])}})); }
    terminate(){terminated++;}
  }});
  let cancelButton;
  const element = tag => {const node={style:{},setAttribute(){},append(){},remove(){}};if(tag==='button')cancelButton=node;return node;};
  globalThis.document = {createElement:element,body:{append(){}}};
  globalThis.videoTest = {
    async get(path){if(path.endsWith('/ppt/media/' + name))return original;if(!saved.has(path))throw Error('missing');return saved.get(path);},
    async save(path,data){saved.set(path,new File([data],path));},
  };
  try {
    const job=module.optimizeDeckVideos('deck');
    assert.equal(job,module.optimizeDeckVideos('deck'));
    await job;
    assert.equal(encodes,1);
    assert.equal(terminated,1);
    assert.equal((await module.optimizedVideo('deck',name)).size,100);
    assert.equal(original.size,MIN_VIDEO_BYTES+1);
    assert.ok([...saved.keys()].every(path => path.includes('/_optimized/')));
    await module.optimizeDeckVideos('deck');
    assert.equal(encodes,1);
    original=new File([original],name,{lastModified:11});
    assert.equal(await module.optimizedVideo('deck',name),undefined);
    mode='larger';
    await module.optimizeDeckVideos('deck');
    assert.equal(encodes,2);
    assert.equal(await module.optimizedVideo('deck',name),undefined);
    mode='cancel';
    await module.optimizeDeckVideos('deck');
    assert.equal(encodes,3);
    assert.equal(terminated,3);
    assert.equal(await module.optimizedVideo('deck',name),undefined);
    mode='smaller';
    const first=module.optimizeDeckVideos('deck');
    // Let the active scan read the existing upload, then replace it mid-encode.
    await new Promise(resolve => setImmediate(resolve));
    original=new File([original],name,{lastModified:12});
    const rescanned=module.optimizeDeckVideos('deck',true);
    assert.equal(first,rescanned,'export waits for queued uploads as part of the same job');
    await Promise.all([first,rescanned]);
    assert.equal(encodes,5,'a video uploaded during encoding gets a subsequent scan');
    assert.equal((await module.optimizedVideo('deck',name)).size,100);

  } finally {
    for(const [key,descriptor] of Object.entries(old)) {
      if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
    }
  }
});

}

test('published optimized videos use MP4 MIME regardless of original extension', async () => {
  const {readFile} = await import('node:fs/promises');
  const vm = await import('node:vm');
  const source = await readFile('cloudflare-publisher/src/worker.js','utf8');
  const fn = source.slice(source.indexOf('function contentType('),source.indexOf('async function publicContent('));
  const contentType = vm.runInNewContext(fn+';contentType',{TextDecoder});
  const mp4 = new TextEncoder().encode('\0\0\0\x18ftypisom');
  const mov = new TextEncoder().encode('\0\0\0\x18ftypqt  ');
  for(const name of ['video.mp4','video.m4v','video.mov','video.avi','video.AVI']) {
    assert.equal(contentType(name,mp4),'video/mp4');
  }
  assert.equal(contentType('video.mov',mov),'video/quicktime');
  assert.equal(contentType('video.avi',new TextEncoder().encode('RIFF1234AVI ')),'video/x-msvideo');
});
