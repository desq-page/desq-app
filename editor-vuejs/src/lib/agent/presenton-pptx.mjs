import {buildPptxContentSchema} from './pptx-content-schema.mjs';
import {PRESENTON_PPTX_FILES,parsedPresentonTemplate,cachePresentonTemplate,pptxLayoutReference} from './presenton-pptx-cache.mjs';
export {PRESENTON_PPTX_FILES,parsedPresentonTemplate,pptxLayoutReference} from './presenton-pptx-cache.mjs';

// Keep parsed reference data only. Pending/aborted requests are never cached.
export async function loadPresentonTemplate(family, {signal,fetchImpl=fetch,parseSource,onProgress}={}) {
  signal?.throwIfAborted();
  if (parsedPresentonTemplate(family)) return parsedPresentonTemplate(family);
  const entry = PRESENTON_PPTX_FILES.find(item=>item.id===family);
  if (!entry) throw Error('Unknown Built-in PPTX family.');
  onProgress?.(`Loading ${family.replace('presenton-','')} PPTX template…`);
  const base=import.meta.env?.BASE_URL || '/';
  const response=await fetchImpl(`${base}${entry.file}`,{signal,credentials:'same-origin'});
  if (!response.ok) throw Error(`Could not load Built-in PPTX (${response.status}).`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length!==entry.bytes) throw Error('Built-in PPTX asset is incomplete. Reload the app and try again.');
  if(globalThis.crypto?.subtle) {
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
    if(digest!==entry.sha256)throw Error('Built-in PPTX asset does not match the catalogue. Reload the app and try again.');
  }
  signal?.throwIfAborted();
  parseSource ||= (await import('./source-intake.mjs')).officeSource;
  const source=await parseSource({name:entry.file.split('/').pop(),arrayBuffer:async()=>bytes.buffer},{id:family,signal});
  const metadata=source.design.templateManifest;
  if(metadata?.family!==family || metadata.layouts?.length!==entry.slides)throw Error('Invalid Built-in PPTX metadata.');
  const slides=source.blocks.filter(block=>block.kind==='slide');
  if(slides.length!==entry.slides || slides.some((slide,i)=>slide.design?.layout?.id!==metadata.layouts[i].id))throw Error('Built-in PPTX slide order does not match its catalogue.');
  const template={bytes,family,name:metadata.name,file:entry.file,width:source.design.width,height:source.design.height,
    layouts:slides.map(block=>({id:block.design.layout.id,page:block.page,description:block.design.layout.description,
      slots:block.design.layout.slots,warnings:block.design.layout.warnings,objects:block.design.objects}))};
  for(const layout of template.layouts)layout.contentSchema=buildPptxContentSchema(layout).schema;
  signal?.throwIfAborted();
  cachePresentonTemplate(family,template);
  return template;
}

export async function preparePresentonContext(selection,options={}) {
  if(!selection || selection==='freeform')return undefined;
  const families=selection==='presenton-auto'?PRESENTON_PPTX_FILES.filter(entry=>entry.id==='builtin-ocean').map(entry=>entry.id):[selection];
  // Sequential parsing bounds memory and permits cancellation between families.
  const templates=[];
  for(const family of families)templates.push(await loadPresentonTemplate(family,options));
  return {format:'pptx',role:'native-template-base',instruction:'Use this native PPTX as the base; fill exact placeholder IDs and retain master/layout inheritance. Replace every sample claim, text and image placeholder with user content. Missing original assets and adapted elements are reported per layout.',
    families:templates.map(template=>({id:template.family,name:template.name,file:template.file,canvas:[template.width,template.height],
      layouts:template.layouts.map(layout=>({id:layout.id,page:layout.page,description:layout.description.slice(0,200)})),
      examples:[template.layouts[0],template.layouts[Math.floor(template.layouts.length/2)],template.layouts.at(-1)].map(layout=>pptxLayoutReference(template.family,layout.id,{maxObjects:selection==='presenton-auto'?5:12}))}))};
}
