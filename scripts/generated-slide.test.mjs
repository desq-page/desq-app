import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGeneratedSlide, resolveSlideImage } from '../editor-vuejs/src/lib/agent/generated-slide.mjs';
import { parseToolPlan } from '../editor-vuejs/src/lib/agent/local-agent.mjs';
import { createEditorTools } from '../editor-vuejs/src/lib/agent/editor-tools.mjs';

let sequence = 0;
const options = { width: 1280, height: 720, genId: () => `shape-${++sequence}` };
const image = { query: 'solar panels', alt: 'Solar panels collecting sunlight' };
const asset = { media: { name: 'solar.webp', w: 800, h: 600 }, title: 'Solar panels', author: 'Example photographer',
  license: 'CC BY-SA 4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Solar_panels.jpg' };

test('slide layouts keep editable title, body, bullets, embedded images and credits inside the page', () => {
  for (const [width, height] of [[1280, 720], [960, 720], [720, 960]]) {
    const shapes = buildGeneratedSlide({ title: 'Solar energy', subtitle: 'Renewable electricity', body: 'Photovoltaic cells convert sunlight to electricity.',
      bullets: ['Lower operating emissions', 'Useful on rooftops'], images: [image], theme: 'dark' }, { ...options, width, height, assets: [asset] });
    for (const shape of shapes) {
      assert.ok(shape.x >= 0 && shape.y >= 0);
      assert.ok(shape.x + shape.w <= width + 0.001 && shape.y + shape.h <= height + 0.001, shape.name);
    }
    assert.equal(new Set(shapes.map(shape => shape.id)).size, shapes.length);
    const picture = shapes.find(shape => shape.type === 'image');
    assert.equal(picture.blipFill.blip.$_target, 'solar.webp');
    assert.equal(picture.name, image.alt);
    assert.equal(picture.imageSource.license, asset.license);
    assert.ok(shapes.find(shape => shape.name === 'Image credits').txBody.p[0].r[0].t.includes(asset.sourceUrl));
    const bullets = shapes.filter(shape => shape.name === 'Slide bullets');
    assert.equal(bullets.length, 1);
    assert.deepEqual(bullets[0].txBody.p.map(p => p.r[0].t), ['Lower operating emissions', 'Useful on rooftops']);
    assert.ok(bullets[0].txBody.p.every(p => p.pPr.buChar.$_char === '•'));
  }
});

test('oversized content and unresolved images fail before insertion', () => {
  assert.throws(() => buildGeneratedSlide({ title: 'Too much', bullets: Array(8).fill('a'.repeat(220)), images: [image] }, { ...options, assets: [asset] }), /does not fit/);
  assert.throws(() => buildGeneratedSlide({ title: 'Missing image', images: [image] }, options), /Resolve every image/);
  assert.throws(() => buildGeneratedSlide({ title: 'Bad size' }, { ...options, width: NaN }), /unsupported slide size/);
});

test('a complete slide plan binds the captured page and forbids dependent extra calls', () => {
  const tools = createEditorTools({}).listTools(), context = { document: { fileId: 'file' }, page: { pageId: 'page' } };
  const call = { name: 'savanna_create_slide', arguments: { title: 'Solar energy', bullets: ['Renewable power'], images: [image] } };
  const plan = parseToolPlan(JSON.stringify({ calls: [call] }), tools, context);
  assert.equal(plan.calls[0].arguments.fileId, 'file'); assert.equal(plan.calls[0].arguments.pageId, 'page');
  assert.throws(() => parseToolPlan(JSON.stringify({ calls: [call, { name: 'savanna_add_text', arguments: { text: 'extra' } }] }), tools, context), /one creation call/);
});

function commonsResult(overrides = {}) {
  return { query: { pages: { 1: { index: 1, title: 'File:Solar.jpg', imageinfo: [{ mime: 'image/jpeg',
    url: 'https://upload.wikimedia.org/original.jpg', thumburl: 'https://upload.wikimedia.org/thumb.jpg',
    descriptionurl: asset.sourceUrl, extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: '<a href="https://example.org">Photographer</a>' } }, ...overrides }] } } } };
}

test('images resolve to licensed raster bytes and plain-text attribution without model-authored URLs', async () => {
  const urls = [];
  const resolved = await resolveSlideImage(image, { fetchImpl: async (url, request) => {
    urls.push(url); assert.equal(request.credentials, 'omit');
    if (url.startsWith('https://commons.wikimedia.org/w/api.php?')) return Response.json(commonsResult());
    assert.equal(url, 'https://upload.wikimedia.org/thumb.jpg');
    return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } });
  } });
  assert.equal(resolved.author, 'Photographer'); assert.equal(resolved.blob.size, 3); assert.equal(urls.length, 2);
  assert.equal(resolved.sourceUrl, asset.sourceUrl);
});

test('unsafe URLs, nonfree licenses and invalid image responses are rejected', async () => {
  for (const overrides of [{ thumburl: 'https://127.0.0.1/private' }, { thumburl: 'https://upload.wikimedia.org@evil.example/photo' },
    { mime: 'image/svg+xml' }, { extmetadata: { LicenseShortName: { value: 'All rights reserved' }, Artist: { value: 'Artist' } } }]) {
    let calls = 0;
    await assert.rejects(resolveSlideImage(image, { fetchImpl: async () => { calls++; return Response.json(commonsResult(overrides)); } }), /No usable licensed image/);
    assert.equal(calls, 1);
  }
  await assert.rejects(resolveSlideImage(image, { fetchImpl: async url => url.includes('/w/api.php?')
    ? Response.json(commonsResult()) : new Response('<html>not an image</html>', { headers: { 'content-type': 'text/html' } }) }), /No usable licensed image/);
});

test('empty sentence search asks for keywords and retries Wikimedia before image generation', async () => {
  const description = { query: 'A photograph showing solar panels collecting sunlight on a rooftop', alt: 'Rooftop solar panels' };
  const queries = [], progress = []; let rewrites = 0, generated = 0;
  const result = await resolveSlideImage(description, {
    imageKeywords: async (image, options) => { rewrites++; assert.deepEqual(image, description); return 'rooftop solar panels'; },
    generateImage: async () => { generated++; throw new Error('Should not generate'); },
    onProgress: message => progress.push(message),
    fetchImpl: async url => {
      if (url.includes('/w/api.php?')) {
        const query = new URL(url).searchParams.get('gsrsearch'); queries.push(query);
        return Response.json(queries.length === 1 ? {} : commonsResult());
      }
      return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } });
    },
  });
  assert.equal(rewrites, 1); assert.equal(generated, 0);
  assert.deepEqual(queries, ['solar panels sunlight rooftop', 'rooftop solar panels']);
  assert.equal(result.license, 'CC BY-SA 4.0');
  assert.equal(result.sourceUrl, asset.sourceUrl);
  assert.ok(progress.some(message => message.includes('rooftop solar panels')));
});

test('empty keyword retry falls back to generation with the original description only once', async () => {
  const description = { query: 'A photo of panels collecting solar energy', alt: 'Solar panels' };
  let rewrites = 0, searches = 0, generations = 0;
  const result = await resolveSlideImage(description, {
    fetchImpl: async () => { searches++; return Response.json({}); },
    imageKeywords: async () => { rewrites++; return 'solar panels'; },
    generateImage: async image => { generations++; assert.deepEqual(image, description); return { ...asset, blob: new Blob(['image'], { type: 'image/png' }) }; },
  });
  assert.equal(searches, 2); assert.equal(rewrites, 1); assert.equal(generations, 1);
  assert.equal(result.blob.type, 'image/png');
});

test('successful search and search HTTP errors do not invoke keyword rewriting', async () => {
  for (const successful of [true, false]) {
    let rewrites = 0;
    const operation = resolveSlideImage(image, {
      fetchImpl: async url => !successful ? new Response('', { status: 503 }) : url.includes('/w/api.php?')
        ? Response.json(commonsResult()) : new Response('image', { headers: { 'content-type': 'image/jpeg' } }),
      imageKeywords: async () => { rewrites++; return 'solar panels'; },
    });
    if (successful) await operation; else await assert.rejects(operation, /search failed/);
    assert.equal(rewrites, 0);
  }
});

test('cancellation while rewriting prevents a second search or generation', async () => {
  const controller = new AbortController(); let searches = 0, generations = 0;
  await assert.rejects(resolveSlideImage(image, {
    signal: controller.signal,
    fetchImpl: async () => { searches++; return Response.json({}); },
    imageKeywords: async () => { controller.abort(); return 'rooftop solar'; },
    generateImage: async () => { generations++; },
  }));
  assert.equal(searches, 1); assert.equal(generations, 0);
});

test('unchanged or unusable keyword output never loops or replaces the generation description', async () => {
  for (const rewrite of [async () => image.query, async () => 'This is a long sentence explaining what the image should show in the presentation', async () => { throw new Error('Model unavailable'); }]) {
    let searches = 0, generations = 0;
    await resolveSlideImage(image, {
      fetchImpl: async () => { searches++; return Response.json({}); }, imageKeywords: rewrite,
      generateImage: async original => { generations++; assert.deepEqual(original, image); return { blob: new Blob(['image'], { type: 'image/png' }) }; },
    });
    assert.equal(searches, 1); assert.equal(generations, 1);
  }
});

test('failed image captions include the original and retry keywords actually sent to Wikimedia', async () => {
  const descriptor={query:'A photograph of Ba Dinh Square in Hanoi',alt:'Ba Dinh Square'};
  const queries=[];
  const result=await resolveSlideImage(descriptor,{
    placeholderOnFailure:true,
    fetchImpl:async url=>{queries.push(new URL(url).searchParams.get('gsrsearch'));return Response.json({});},
    imageKeywords:async()=> 'Ba Dinh Square',
    generateImage:async()=>{throw Error('Generation unavailable');},
  });
  assert.equal(result.placeholder,true);
  assert.deepEqual(result.searchQueries,queries);
  assert.deepEqual(queries,['Ba Dinh Square Hanoi','Ba Dinh Square']);
  const shapes=buildGeneratedSlide({title:'A place',images:[descriptor]}, {...options,assets:[result]});
  const text=shapes.flatMap(shape=>shape.txBody?.p.flatMap(p=>p.r.map(r=>r.t))||[]).join('\n');
  assert.ok(text.includes('Search keywords: '+queries[0]));
  assert.ok(text.includes('Retry keywords: '+queries[1]));
});

test('image searches remove sentence boilerplate and bound keyword phrases', async () => {
  const {compactImageQuery,imageKeywords}=await import('../editor-vuejs/src/lib/agent/image-keywords.mjs');
  assert.equal(compactImageQuery('A beautiful photograph of Ba Dinh Square in Hanoi'),'Ba Dinh Square Hanoi');
  assert.equal(compactImageQuery('A realistic image showing solar panels on a rooftop'),'solar panels rooftop');
  assert.equal(compactImageQuery('Statue of Liberty, New York'),'Statue Liberty New York');
  assert.equal(compactImageQuery('one two three four five six seven eight').split(' ').length,6);
  assert.equal(imageKeywords('rooftop solar panels'),'rooftop solar panels');
  for(const text of ['A photograph of solar panels','An image showing a solar rooftop','This is a beautiful place.','one two three four five six seven'])
    assert.throws(()=>imageKeywords(text),/short image-search keywords/);
});

test('Vietnamese keyword retry preserves diacritics and uses the same terms as a manual Commons search', async () => {
  const queries=[],progress=[];
  const descriptor={query:'Vietnamese pink blossoms Tet',alt:'Hoa đào ngày Tết'};
  const result=await resolveSlideImage(descriptor,{
    language:'vi', onProgress:message=>progress.push(message),
    imageKeywords:async(image,options)=>{assert.equal(options.language,'vi');return 'hoa đào';},
    fetchImpl:async url=>{
      if(url.includes('/w/api.php?')){
        const params=new URL(url).searchParams;queries.push(params.get('gsrsearch'));
        assert.equal(params.get('gsrlimit'),'20');
        return Response.json(queries.length===1?{}:commonsResult());
      }
      return new Response('image',{headers:{'content-type':'image/jpeg'}});
    },
  });
  assert.deepEqual(queries,['Vietnamese pink blossoms Tet','hoa đào']);
  assert.ok(result.blob.size);
  assert.ok(progress.some(message=>message.includes('1 file result(s)')));
  const {compactImageQuery}=await import('../editor-vuejs/src/lib/agent/image-keywords.mjs');
  assert.equal(compactImageQuery('hoa đào'.normalize('NFD')),'hoa đào');
});

test('one failed Wikimedia download does not hide a later usable result', async () => {
  const first=commonsResult().query.pages[1];
  const second=structuredClone(first);second.index=2;second.imageinfo[0].thumburl='https://upload.wikimedia.org/working.jpg';
  const result=await resolveSlideImage(image,{fetchImpl:async url=>{
    if(url.includes('/w/api.php?'))return Response.json({query:{pages:{1:first,2:second}}});
    if(url.endsWith('/thumb.jpg'))throw Error('Network failure');
    return new Response('image',{headers:{'content-type':'image/jpeg'}});
  }});
  assert.ok(result.blob.size);
});

test('Commons thumbnail CDN images are accepted while lookalike hosts remain rejected', async () => {
  const thumburl='https://thumb.wikimedia.org/wikipedia/commons/thumb/6/64/Hoa_mai.jpg/960px-Hoa_mai.jpg?utm_source=commons.wikimedia.org';
  const result=await resolveSlideImage({query:'hoa mai',alt:'Hoa mai'}, {fetchImpl:async url=>{
    if(url.includes('/w/api.php?'))return Response.json(commonsResult({thumburl}));
    assert.equal(url,thumburl);
    return new Response('image',{headers:{'content-type':'image/jpeg'}});
  }});
  assert.ok(result.blob.size);
  for(const unsafe of ['https://thumb.wikimedia.org.evil.example/photo.jpg','https://thumb.wikimedia.org@evil.example/photo.jpg','http://thumb.wikimedia.org/photo.jpg']){
    let downloads=0;
    await assert.rejects(resolveSlideImage(image,{fetchImpl:async url=>{
      if(url.includes('/w/api.php?'))return Response.json(commonsResult({thumburl:unsafe}));
      downloads++;return new Response('image');
    }}),/No usable licensed image/);
    assert.equal(downloads,0);
  }
});

test('Wikimedia selection starts at a random result and still skips unusable candidates', async () => {
  for (const rejectSecond of [false,true]) {
    const first=commonsResult().query.pages[1];
    const second=structuredClone(first);second.index=2;second.title='File:Second.jpg';
    second.imageinfo[0].url='https://upload.wikimedia.org/second-original.jpg';
    second.imageinfo[0].thumburl='https://thumb.wikimedia.org/second.jpg';
    const downloads=[];
    const result=await resolveSlideImage(image,{random:()=>0,fetchImpl:async url=>{
      if(url.includes('/w/api.php?'))return Response.json({query:{pages:{1:first,2:second}}});
      downloads.push(url);
      if(rejectSecond && url.endsWith('/second.jpg'))return new Response('',{status:404});
      return new Response('image',{headers:{'content-type':'image/jpeg'}});
    }});
    assert.equal(downloads[0],'https://thumb.wikimedia.org/second.jpg');
    assert.equal(result.title,rejectSecond?'Solar.jpg':'Second.jpg');
    assert.equal(downloads.length,rejectSecond?2:1);
  }
});

test('visual relevance rejects peach fruit and inserts a matching blossom image', async () => {
  const first=commonsResult().query.pages[1];first.title='File:Peach fruit.jpg';
  const second=structuredClone(first);second.index=2;second.title='File:Peach blossom.jpg';second.imageinfo[0].url='https://upload.wikimedia.org/blossom-original.jpg';second.imageinfo[0].thumburl='https://thumb.wikimedia.org/blossom.jpg';
  const checked=[],used=new Set();
  const result=await resolveSlideImage({query:'hoa đào',alt:'Peach blossoms, not fruit'}, {used,random:()=>.999,
    fetchImpl:async url=>url.includes('/w/api.php?')?Response.json({query:{pages:{1:first,2:second}}}):new Response(url.endsWith('/blossom.jpg')?'blossoms':'fruit',{headers:{'content-type':'image/jpeg'}}),
    imageMatches:async candidate=>{if(!candidate.blob)return {matches:null,reason:'Inconclusive filename'};checked.push(await candidate.blob.text());assert.equal(candidate.query,'hoa đào');return {matches:checked.at(-1)==='blossoms',reason:'Visible subject check'};},
  });
  assert.deepEqual(checked,['fruit','blossoms']);
  assert.equal(result.title,'Peach blossom.jpg');
  assert.equal(result.imageMatch.matches,true);
  assert.deepEqual([...used],['https://upload.wikimedia.org/blossom-original.jpg']);
});

test('visual checking is bounded and an unavailable checker never inserts an unchecked search image', async () => {
  for(const unavailable of [false,true]) {
    const pages={};for(let i=1;i<=8;i++){const page=commonsResult().query.pages[1];page.index=i;page.imageinfo[0].url=`https://upload.wikimedia.org/${i}.jpg`;pages[i]=page;}
    let checks=0;
    const result=await resolveSlideImage({query:'hoa đào',alt:'Peach blossoms'},{placeholderOnFailure:true,
      fetchImpl:async url=>url.includes('/w/api.php?')?Response.json({query:{pages}}):new Response('fruit',{headers:{'content-type':'image/jpeg'}}),
      imageMatches:async candidate=>{if(!candidate.blob)return {matches:null,reason:'Inconclusive filename'};checks++;if(unavailable)throw Error('Vision unavailable');return {matches:false,reason:'Fruit'};},
      imageKeywords:async()=> 'peach blossoms',
    });
    assert.equal(result.placeholder,true);
    assert.equal(checks,unavailable?1:4);
  }
});

test('clear subject metadata accepts an image without a visual request', async () => {
  const calls=[];
  const data=commonsResult();data.query.pages[1].title='File:Hoa dao.jpg';
  Object.assign(data.query.pages[1].imageinfo[0].extmetadata,{ImageDescription:{value:'<p>Pink peach blossoms for Tết.</p>'},Categories:{value:'Peach flowers|Tet'}});
  const result=await resolveSlideImage({query:'hoa đào',alt:'Peach blossoms'}, {
    fetchImpl:async url=>url.includes('/w/api.php?')?Response.json(data):new Response('image',{headers:{'content-type':'image/jpeg'}}),
    imageMatches:async candidate=>{
      calls.push(candidate);assert.equal(candidate.blob,undefined);
      assert.equal(candidate.metadata.ImageDescription,'Pink peach blossoms for Tết.');
      return {matches:true,reason:'Description explicitly identifies peach blossoms'};
    },
  });
  assert.equal(calls.length,1);assert.equal(result.imageMatch.source,'metadata');
});

test('clear metadata mismatches are rejected before downloading pixels', async () => {
  let downloads=0,visual=0;
  const result=await resolveSlideImage({query:'hoa đào',alt:'Peach blossoms'},{placeholderOnFailure:true,
    fetchImpl:async url=>{if(url.includes('/w/api.php?'))return Response.json(commonsResult());downloads++;return new Response('image');},
    imageMatches:async candidate=>{if(candidate.blob)visual++;return {matches:false,reason:'Metadata identifies peach fruit'};},
  });
  assert.equal(result.placeholder,true);assert.equal(downloads,0);assert.equal(visual,0);
});

test('uncertain, missing or failed metadata assessments fall back to visual checking', async () => {
  for(const mode of ['unknown','failed']){
    const phases=[];
    const result=await resolveSlideImage({query:'hoa đào',alt:'Peach blossoms'},{
      fetchImpl:async url=>url.includes('/w/api.php?')?Response.json(commonsResult()):new Response('blossom image',{headers:{'content-type':'image/jpeg'}}),
      imageMatches:async candidate=>{
        phases.push(candidate.blob?'visual':'metadata');
        if(!candidate.blob){if(mode==='failed')throw Error('Metadata unavailable');return {matches:null,reason:'Generic filename'};}
        return {matches:true,reason:'Visible peach blossoms'};
      },
    });
    assert.deepEqual(phases,['metadata','visual']);assert.equal(result.imageMatch.source,'visual');
  }
});

test('researched photo candidates reuse the normal download and attribution checks', async () => {
  const calls=[];
  const resolved=await resolveSlideImage(image,{
    researchImages:[{query:image.query,page:commonsResult().query.pages[1]}],
    fetchImpl:async url=>{calls.push(url);assert.equal(url,'https://upload.wikimedia.org/thumb.jpg');return new Response(new Uint8Array([1]),{headers:{'content-type':'image/jpeg'}});},
  });
  assert.equal(calls.length,1);assert.equal(resolved.author,'Photographer');assert.equal(resolved.license,'CC BY-SA 4.0');
});

test('embedded source images are used locally without an external search',async()=>{
 const sourceAsset={id:'source:A1',name:'evidence.png',data:new Uint8Array([1,2,3])};
 const resolved=await resolveSlideImage({query:'source:A1',alt:'Source figure'},{sourceAssets:[sourceAsset],fetchImpl:async()=>{throw Error('Source images must not require web search');}});
 assert.equal(resolved.blob.size,3);assert.equal(resolved.blob.type,'image/png');assert.equal(resolved.license,'User-provided source');
});
