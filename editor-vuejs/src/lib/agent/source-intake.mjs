import {sourceBundle,textFromModel} from './source-bundle.mjs';
import {htmlSource} from './source-html.mjs';
export {htmlSource} from './source-html.mjs';
let sequence=0;
const nodes=(root,name)=>Array.from(root.getElementsByTagNameNS('*',name));
function xml(text){const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('Malformed source XML.');return doc;}
export async function pdfSource(file,{id=`source-${Date.now().toString(36)}-${++sequence}-${Math.random().toString(36).slice(2,8)}`,signal,pdfjs}={}) {
  if(!pdfjs){const [library,{default:workerUrl}]=await Promise.all([import('pdfjs-dist'),import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);pdfjs=library;pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;}
  const data=new Uint8Array(await file.arrayBuffer());
  signal?.throwIfAborted();
  const task=pdfjs.getDocument({data,isEvalSupported:false});
  const abort=()=>{Promise.resolve(task.destroy()).catch(()=>{});};signal?.addEventListener('abort',abort,{once:true});
  const blocks=[],pages=[],warnings=[];
  try{
    const document=await task.promise;
    for(let pageNumber=1;pageNumber<=document.numPages;pageNumber++){
      signal?.throwIfAborted();
      const page=await document.getPage(pageNumber),viewport=page.getViewport({scale:1});
      const content=await page.getTextContent();
      const items=content.items.filter(item=>typeof item.str==='string'&&item.str.trim());
      pages.push({page:pageNumber,width:viewport.width,height:viewport.height,rotation:viewport.rotation,fonts:Object.values(content.styles||{}).map(s=>({family:s.fontFamily,ascent:s.ascent,descent:s.descent}))});
      if(!items.length)warnings.push(`PDF page ${pageNumber} has no extractable text and needs OCR. No text was inferred from its image.`);
      let text='';
      const evidence=[];
      for(const item of items){text+=item.str+(item.hasEOL?'\n':' ');evidence.push({text:item.str,transform:item.transform,width:item.width,height:item.height,font:item.fontName});}
      if(page.getOperatorList){
        const operators=await page.getOperatorList();
        const imageOps=[pdfjs.OPS?.paintImageXObject,pdfjs.OPS?.paintInlineImageXObject].filter(value=>value!==undefined);
        const images=operators.fnArray.flatMap((fn,index)=>imageOps.includes(fn)?[{operation:fn,resource:typeof operators.argsArray[index]?.[0]==='string'?operators.argsArray[index][0]:undefined}]:[]);
        pages.at(-1).images=images;
      }
      blocks.push({kind:'page',page:pageNumber,heading:`Page ${pageNumber}`,text:text.trim(),evidence});page.cleanup();
    }
    return sourceBundle({id,name:file.name,kind:'pdf',blocks,design:{pages},warnings});
  }finally{signal?.removeEventListener('abort',abort);await task.destroy();}
}
function chartEvidence(document) {
  const values=root=>nodes(root,'pt').map(pt=>({index:Number(pt.getAttribute('idx')),value:nodes(pt,'v')[0]?.textContent||''}));
  return nodes(document,'ser').map(series=>{
    const read=name=>{const part=nodes(series,name)[0];return part?values(part):[];};
    return {name:nodes(series,'tx').map(tx=>nodes(tx,'v').map(v=>v.textContent).join(' ')).join(' '),categories:read('cat'),values:read('val'),x:read('xVal'),y:read('yVal'),sizes:read('bubbleSize')};
  });
}
// Compact editable geometry from the actual PPTX slide XML, for template selection.
export function pptxSlideDesign(raw) {
  return [...nodes(raw,'sp'),...nodes(raw,'pic'),...nodes(raw,'graphicFrame')].map(shape=>{
    const nv=nodes(shape,'cNvPr')[0], transform=nodes(shape,'xfrm')[0];
    const off=transform&&nodes(transform,'off')[0], ext=transform&&nodes(transform,'ext')[0];
    const text=nodes(shape,'t').map(n=>n.textContent).join('');
    const style=nodes(shape,'rPr')[0]||nodes(shape,'defRPr')[0];
    return {name:nv?.getAttribute('name'),kind:shape.localName==='pic'?'image':nodes(shape,'chart').length?'chart':nodes(shape,'tbl').length?'table':text?'text':'shape',
      x:Number(off?.getAttribute('x'))/9525,y:Number(off?.getAttribute('y'))/9525,width:Number(ext?.getAttribute('cx'))/9525,height:Number(ext?.getAttribute('cy'))/9525,
      rotation:Number(transform?.getAttribute('rot'))/60000,
      ...(style?{fontSize:Number(style.getAttribute('sz'))/75,fontWeight:style.getAttribute('b')==='1'?'700':'400',fontStyle:style.getAttribute('i')==='1'?'italic':'normal',fontFamily:nodes(style,'latin')[0]?.getAttribute('typeface'),letterSpacing:Number(style.getAttribute('spc'))/75,lineHeight:Number(nodes(shape,'spcPct')[0]?.getAttribute('val'))/100000}:{}),
      colors:[...new Set(nodes(shape,'srgbClr').map(n=>'#'+n.getAttribute('val')))],sampleText:text};
  });
}

export async function officeSource(file,{id=`source-${Date.now().toString(36)}-${++sequence}-${Math.random().toString(36).slice(2,8)}`,signal,parseDocx,parsePptx,onProgress=()=>{}}={}) {
  signal?.throwIfAborted();
  const zip=await import('@zip.js/zip.js');const reader=new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await file.arrayBuffer())),{useWebWorkers:false});
  try{
    const entries=await reader.getEntries();
    if(entries.some(e=>e.uncompressedSize>100000000)||entries.reduce((sum,e)=>sum+(e.uncompressedSize||0),0)>250000000)throw Error('Source package is too large to extract.');
    const read=async path=>{onProgress(`Reading ${path}`);signal?.throwIfAborted();const entry=entries.find(e=>e.filename===path);return entry?new TextDecoder().decode(await entry.getData(new zip.Uint8ArrayWriter(),{useWebWorkers:false,useCompressionStream:false})):'';};
    const assets=[];
    for(const entry of entries.filter(e=>!e.directory&&/^(?:word|ppt)\/media\//.test(e.filename))){
      signal?.throwIfAborted();const data=await entry.getData(new zip.Uint8ArrayWriter(),{useWebWorkers:false,useCompressionStream:false});assets.push({id:`${id}:A${assets.length+1}`,path:entry.filename,name:entry.filename.split('/').pop(),kind:'embedded-media',bytes:data.length,data});
    }
    if(/\.docx$/i.test(file.name)){
      parseDocx ||= (await import('shared-vuejs/api/edlib-docx-convert')).parseDocumentXml;
      const charts={};for(const entry of entries.filter(e=>/^word\/charts\/chart[^/]+\.xml$/.test(e.filename)))charts[entry.filename]=await read(entry.filename);
      const doc=parseDocx(await read('word/document.xml'),await read('word/styles.xml'),await read('word/_rels/document.xml.rels'),await read('word/numbering.xml'),await read('word/theme/theme1.xml'),{},charts);
      const blocks=doc.paragraphs.map((p,index)=>({kind:'paragraph',heading:`Paragraph ${index+1}`,text:textFromModel(p),evidence:p}));
      for(const object of doc.objects||[])blocks.push({kind:object.chartData?'chart':'object',text:object.chartData?JSON.stringify(object.chartData):textFromModel(object.shape),evidence:object});
      return sourceBundle({id,name:file.name,kind:'docx',blocks,assets,design:{width:doc.width,height:doc.height,margins:doc.margins,relationships:doc.relationships},warnings:doc.warnings||[]});
    }
    if (!parsePptx) { const {xml2json}=await import('shared-vuejs/api/lib-FXP-FXPutils'); parsePptx=(path,parts)=>xml2json(new TextDecoder().decode(parts[path])); }
    const presentation=xml(await read('ppt/presentation.xml'));
    const size=nodes(presentation,'sldSz')[0],themeText=await read('ppt/theme/theme1.xml');
    const theme=themeText?xml(themeText):null;
    const fonts=theme?nodes(theme,'latin').map(n=>n.getAttribute('typeface')):[];
    const colors=theme?nodes(theme,'srgbClr').map(n=>n.getAttribute('val')):[];
    const relText=await read('ppt/_rels/presentation.xml.rels'),rels=relText?nodes(xml(relText),'Relationship'):[];
    const paths=nodes(presentation,'sldId').map(n=>rels.find(r=>r.getAttribute('Id')===n.getAttribute('r:id'))?.getAttribute('Target')).filter(Boolean).map(path=>path.startsWith('/')?path.slice(1):'ppt/'+path.replace(/^\.\//,''));
    const templateText=await read('ppt/presenton.json');
    const templateManifest=templateText?JSON.parse(templateText):undefined;
    const blocks=[];
    for(const [index,path] of paths.entries()){
      const text=await read(path),bytes=new TextEncoder().encode(text),data=parsePptx(path,{[path]:bytes});
      const raw=xml(text),paragraphs=nodes(raw,'p').map(p=>nodes(p,'t').map(t=>t.textContent).join('')).filter(Boolean);
      blocks.push({kind:'slide',page:index+1,heading:paragraphs[0]||`Slide ${index+1}`,text:paragraphs.join('\n'),evidence:data,design:{objects:pptxSlideDesign(templateManifest?.layouts?.[index]?.layoutPart?xml(await read(templateManifest.layouts[index].layoutPart)):raw),layout:templateManifest?.layouts?.[index]}});
    }
    for(const entry of entries.filter(e=>/^ppt\/(?:(?:.*\/)?charts\/chart[^/]+|diagrams\/data[^/]+|notesSlides\/notesSlide\d+)\.xml$/.test(e.filename))){const text=await read(entry.filename);blocks.push({kind:entry.filename.includes('charts')?'chart':entry.filename.includes('notes')?'notes':'diagram',heading:entry.filename,text:entry.filename.includes('charts')?JSON.stringify(chartEvidence(xml(text))):nodes(xml(text),'t').map(n=>n.textContent).join('\n'),evidence:{path:entry.filename,xml:text}});}
    const supportingParts = {};
    for (const entry of entries.filter(e=>/^(?:ppt\/(?:slideLayouts|slideMasters|theme)\/.*\.xml|ppt\/.*\.rels)$/.test(e.filename))) supportingParts[entry.filename]=await read(entry.filename);
    return sourceBundle({id,name:file.name,kind:'pptx',blocks,assets,design:{width:Number(size?.getAttribute('cx'))/9525,height:Number(size?.getAttribute('cy'))/9525,fonts:[...new Set(fonts)],colors:[...new Set(colors)],themeXml:themeText,supportingParts,...(templateManifest?{templateManifest}:{})},warnings:[]});
  }finally{await reader.close();}
}
export async function ingestSource(file,options={}){
  if(file.size>50000000)throw Error('Source files must be under 50 MB.');
  const ext=file.name.split('.').pop().toLowerCase();
  let source;
  if(ext==='pdf')source=await pdfSource(file,options);
  else if(['docx','pptx'].includes(ext))source=await officeSource(file,options);
  else if(['html','htm'].includes(ext))source=htmlSource(await file.text(),{...options,name:file.name});
  else if(['md','txt'].includes(ext))source=sourceBundle({id:`source-${Date.now().toString(36)}-${++sequence}-${Math.random().toString(36).slice(2,8)}`,name:file.name,kind:ext,blocks:[{kind:'text',text:await file.text()}]});
  else throw Error('Choose PDF, DOCX, PPTX, HTML, Markdown or text sources.');
  options.signal?.throwIfAborted();
  if(!source.blocks.some(block=>block.text?.trim()))source.warnings.push('No readable source text was extracted. Supply OCR text or another source before generating.');
  source.assets.push({id:`${source.id}:original`,name:file.name,kind:'original-source',bytes:file.size,data:new Uint8Array(await file.arrayBuffer())});
  return source;
}

// Same-origin host transport avoids third-party browser CORS restrictions.
export async function ingestUrl(value, {signal, fetchImpl = fetch} = {}) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Error('Enter an HTTP or HTTPS article URL.');
  const response = await fetchImpl('/api/agent/sources/url', {method:'POST', signal, credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url:url.href})});
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Could not retrieve HTML source.');
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(result.html)?.[1]?.replace(/<[^>]+>/g,'').trim() || new URL(result.url).hostname;
  const source = htmlSource(result.html, {name:title, origin:result.url});
  if (!source.blocks.length) throw Error('The page did not contain readable article text.');
  source.assets = source.assets.map(asset => { try { return {...asset,url:asset.url ? new URL(asset.url,result.url).href : undefined}; } catch { return {...asset,url:undefined}; } });
  source.assets.push({id:`${source.id}:original`,name:'source.html',kind:'original',data:new TextEncoder().encode(result.html)});
  return source;
}
