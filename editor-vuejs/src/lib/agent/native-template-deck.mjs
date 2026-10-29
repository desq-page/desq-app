import {applyBuiltinTemplateTheme} from './builtin-template-theme.mjs';
import {resizeNativeTemplateParts,nativeTemplateTransform} from './native-template-size.mjs';
import {rephraseNativeTemplateText} from './native-template-text.mjs';
import {loadPresentonTemplate} from './presenton-pptx.mjs';
import {validateNativeTemplateDeck} from './native-template-plan.mjs';
import {xmlEscape as esc,encodeXML,decodeXML} from './pptx-template-package.mjs';
import {chartWorkbook,excelColumn} from 'shared-vuejs/api/edlib-pptx-export-chart-workbook';
const P='http://schemas.openxmlformats.org/presentationml/2006/main',A='http://schemas.openxmlformats.org/drawingml/2006/main',R='http://schemas.openxmlformats.org/officeDocument/2006/relationships',C='http://schemas.openxmlformats.org/drawingml/2006/chart';
const relNS='http://schemas.openxmlformats.org/package/2006/relationships';
const list=(root,ns,name)=>Array.from(root.getElementsByTagNameNS(ns,name));
const parse=xml=>{const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('Invalid native template XML.');return doc;};
const serialize=doc=>new XMLSerializer().serializeToString(doc);
const fileIdFromPath=path=>path.split('/').pop().replace('.xml','');
const relPath=path=>path.replace(/^(.*)\/(.*)$/,'$1/_rels/$2.rels');
const ownerPath=path=>path.replace('/_rels/','/').replace(/\.rels$/,'');
const resolvePart=(owner,target)=>new URL(target,'https://package.invalid/'+owner).pathname.slice(1);
const textBody=(text,bullets=false)=>`<p:txBody xmlns:p="${P}" xmlns:a="${A}"><a:bodyPr/><a:lstStyle/>${String(text??'').split('\n').map(line=>`<a:p>${bullets?'':'<a:pPr><a:buNone/></a:pPr>'}<a:r><a:t xml:space="preserve">${esc(line)}</a:t></a:r></a:p>`).join('')}</p:txBody>`;
const imported=(doc,xml)=>doc.importNode(parse(xml).documentElement,true);
const setText=(shape,text,bullets=false)=>{const old=list(shape,P,'txBody')[0];const node=imported(shape.ownerDocument,textBody(text,bullets));if(old)old.replaceWith(node);else shape.appendChild(node);};
const relationshipDoc=xml=>parse(xml||`<Relationships xmlns="${relNS}"/>`);
function addRelationship(doc,id,type,target){const el=doc.createElementNS(relNS,'Relationship');el.setAttribute('Id',id);el.setAttribute('Type',R+'/'+type);el.setAttribute('Target',target);doc.documentElement.appendChild(el);return el;}
function fillChart(xml,field){
 const doc=parse(xml),old=list(doc,C,'ser');
 // Original chart and axis titles are sample copy, not facts for the new deck.
 for(const title of list(doc,C,'title'))title.remove();
 if(!old.length||!field.categories?.length||!field.series?.length)throw Error('Native chart placeholders require supplied categories and series.');
 if(field.series.some(s=>s.values.length!==field.categories.length))throw Error('Chart series must match category count.');
 const parent=old[0].parentNode,next=old.at(-1).nextSibling;
 for(const [i,series]of field.series.entries()){
  const node=old[Math.min(i,old.length-1)].cloneNode(true);
  for(const key of ['idx','order'])list(node,C,key)[0]?.setAttribute('val',String(i));
  const replace=(name,xml)=>{const before=list(node,C,name)[0],value=imported(doc,`<c:${name} xmlns:c="${C}">${xml}</c:${name}>`);if(before)before.replaceWith(value);else node.appendChild(value);};
  replace('tx',`<c:v>${esc(series.name)}</c:v>`);
  const cat=field.categories.map((v,i)=>`<c:pt idx="${i}"><c:v>${esc(v)}</c:v></c:pt>`).join('');
  const values=series.values.map((v,i)=>`<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('');
  if(list(node,C,'xVal').length){if(field.categories.some(v=>!Number.isFinite(Number(v))))throw Error('Scatter charts require numeric categories.');replace('xVal',`<c:numLit><c:ptCount val="${field.categories.length}"/>${cat}</c:numLit>`);replace('yVal',`<c:numLit><c:ptCount val="${series.values.length}"/>${values}</c:numLit>`);}
  else {replace('cat',`<c:strRef><c:f>Sheet1!$A$2:$A$${field.categories.length+1}</c:f><c:strCache><c:ptCount val="${field.categories.length}"/>${cat}</c:strCache></c:strRef>`);const col=excelColumn(i+1);replace('val',`<c:numRef><c:f>Sheet1!$${col}$2:$${col}$${field.categories.length+1}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${series.values.length}"/>${values}</c:numCache></c:numRef>`);}
  parent.insertBefore(node,next);
 }
 old.forEach(node=>node.remove());return serialize(doc);
}

// Prepare all native parts in memory. Import happens only after validation/assets succeed.
export async function prepareNativeTemplateDeck(spec,{signal,genId,resolveImage,onProgress,targetSize,rewriteText,builtinTheme}={}){
 validateNativeTemplateDeck(spec);
 const template=await loadPresentonTemplate(spec.slides[0].templateSelection.family,{signal,onProgress});
 if(targetSize)nativeTemplateTransform(template,targetSize);
 validateNativeTemplateDeck(spec); // Recheck field IDs after a previously uncached family loads.
 const {ZipReader,Uint8ArrayReader,Uint8ArrayWriter}=await import('@zip.js/zip.js');
 const reader=new ZipReader(new Uint8ArrayReader(template.bytes),{useWebWorkers:false});const original={};
 try{for(const entry of await reader.getEntries()){signal?.throwIfAborted();if(!entry.directory)original[entry.filename]=await entry.getData(new Uint8ArrayWriter(),{useWebWorkers:false,useCompressionStream:false});}}finally{await reader.close();}
 const prefix='agent'+genId().replace(/[^a-zA-Z0-9]/g,''),mapping=new Map(),parts={},sources=[],warnings=[],imageCredits=[];
 for(const path of Object.keys(original))if(path.startsWith('ppt/')&&!/^ppt\/(?:slides\/slide\d+\.xml|slides\/_rels\/slide\d+\.xml.rels|notesSlides\/|notesMasters\/|presentation.xml|_rels\/presentation.xml.rels|presenton.json)/.test(path)){
  let mapped=path.replace(/([^/]+?)(\.[^/.]+)$/,(all,name,ext)=>`${name}_${prefix}${ext}`);
  const assetFolder=path.match(/\/(charts|theme)\/[^/]+\.xml$/)?.[1];
  if(assetFolder)mapped='ppt/'+assetFolder+'/'+mapped.split('/').pop();
  mapping.set(path,mapped);
 }
 // Relationship filenames follow the mapped owner part, not an independent rename.
 for(const path of [...mapping.keys()].filter(p=>p.endsWith('.rels'))){const owner=mapping.get(ownerPath(path));if(owner)mapping.set(path,relPath(owner));}
 for(const [old,path]of mapping){
  let bytes=original[old];
  if(old.endsWith('.rels')){const doc=relationshipDoc(decodeXML(bytes));for(const rel of list(doc,relNS,'Relationship'))if(rel.getAttribute('TargetMode')!=='External'){const target=resolvePart(ownerPath(old),rel.getAttribute('Target'));if(mapping.has(target))rel.setAttribute('Target','/'+mapping.get(target));}bytes=encodeXML(serialize(doc));}
  if(/^ppt\/slideMasters\/[^/]+\.xml$/.test(old)){const doc=parse(decodeXML(bytes));list(doc,P,'cSld')[0]?.setAttribute('name',template.name);bytes=encodeXML(serialize(doc));}
  parts[path]=bytes;
 }
 let imageCount=0,placeholderCount=0;
 for(const [index,slide]of spec.slides.entries()){
  signal?.throwIfAborted();const layout=template.layouts.find(l=>l.id===slide.templateSelection.layout);
  const overflowFields=[];
  const slotMap=new Map(layout.slots.filter(s=>s.placeholderId).map(s=>[s.placeholderId,s])),fields=new Map(slide.templateFields.map(f=>[f.id,f]));
  const baseId='slide'+prefix+'_'+index,sourcePath=`ppt/slides/${baseId}.xml`,oldPath=`ppt/slides/slide${layout.page}.xml`;
  const doc=parse(decodeXML(original[oldPath])),relations=relationshipDoc(decodeXML(original[relPath(oldPath)]));
  for(const rel of list(relations,relNS,'Relationship')){if(rel.getAttribute('Type').endsWith('/notesSlide')){rel.remove();continue;}if(rel.getAttribute('TargetMode')!=='External'){const target=resolvePart(oldPath,rel.getAttribute('Target'));if(mapping.has(target))rel.setAttribute('Target','/'+mapping.get(target));}}
  for(const shape of [...list(doc,P,'sp'),...list(doc,P,'pic'),...list(doc,P,'graphicFrame')]){
   const ph=list(shape,P,'ph')[0];if(!ph)continue;
   const id=ph.getAttribute('idx')||'0',slot=slotMap.get(id),field=fields.get(id);
   if(!slot)throw Error(`Template ${layout.id} has an unknown placeholder ${id}.`);
   if(slot.kind==='image'){
    if(!field?.query){
     setText(shape,field?.alt||'');
     if(field?.alt){placeholderCount++;warnings.push(`Slide ${index+1}: image budget reached; described placeholder retained (${field.alt}).`);}
     continue;
    }
    if(imageCount>=8){placeholderCount++;setText(shape,field.alt||field.query);warnings.push(`Slide ${index+1}: image budget reached; described placeholder retained (${field.query}).`);continue;}
    imageCount++;
    const asset=await resolveImage?.({query:field.query,alt:field.alt||field.query});
    if(!asset?.media){placeholderCount++;setText(shape,field.alt||field.query);warnings.push(`Slide ${index+1}: image placeholder retained (${field.query}).`);continue;}
    const nv=list(shape,P,'cNvPr')[0],rid='rIdImage'+id;
    const pic=imported(doc,`<p:pic xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}"><p:nvPicPr><p:cNvPr id="${esc(nv.getAttribute('id'))}" name="${esc(nv.getAttribute('name'))}"/><p:cNvPicPr/><p:nvPr><p:ph type="pic" idx="${esc(id)}"/></p:nvPr></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr/></p:pic>`);
    shape.replaceWith(pic);addRelationship(relations,rid,'image','../media/'+asset.media.name);
    if(asset.sourceUrl||asset.author)imageCredits.push({slide:index+1,title:asset.title,author:asset.author,license:asset.license,url:asset.sourceUrl});
   }else if(slot.kind==='chart'){
    if(!field?.series?.length){shape.remove();continue;}
    const ref=list(shape,C,'chart')[0],rid=ref.getAttributeNS(R,'id'),rel=list(relations,relNS,'Relationship').find(r=>r.getAttribute('Id')===rid);
    const target=resolvePart(sourcePath,rel.getAttribute('Target')),chartPath=target.replace(/\.xml$/,`_${index}.xml`);
    const chart=fillChart(decodeXML(parts[target]),field);
    parts[chartPath]=encodeXML(chart);rel.setAttribute('Target','/'+chartPath);
    const workbookPath=`ppt/embeddings/${prefix}_${index}_${id}.xlsx`,chartDoc=parse(chart);
    for(const external of list(chartDoc,C,'externalData'))external.remove();
    const external=chartDoc.createElementNS(C,'c:externalData');external.setAttributeNS(R,'r:id','rIdWorkbook');chartDoc.documentElement.insertBefore(external,list(chartDoc,C,'printSettings')[0]||null);parts[chartPath]=encodeXML(serialize(chartDoc));
    parts[workbookPath]=await chartWorkbook([['Category',...field.series.map(s=>s.name)],...field.categories.map((cat,i)=>[cat,...field.series.map(s=>s.values[i])])]);
    const chartRels=relationshipDoc();addRelationship(chartRels,'rIdWorkbook','package','/'+workbookPath);parts[relPath(chartPath)]=encodeXML(serialize(chartRels));
   }else if(slot.kind==='table'){
    if(!field?.rows?.length){shape.remove();continue;}
    const rows=list(shape,A,'tr');if(field.rows.length>rows.length||field.rows.some((row,i)=>row.length>list(rows[i],A,'tc').length))throw Error('Table data exceeds the native template cell capacity. Choose another layout.');
    rows.forEach((row,i)=>list(row,A,'tc').forEach((cell,j)=>{
      const body=list(cell,A,'txBody')[0],paragraph=list(body,A,'p')[0]?.cloneNode(true)||doc.createElementNS(A,'a:p');
      const firstRun=list(paragraph,A,'r')[0]?.cloneNode(true)||doc.createElementNS(A,'a:r');
      for(const child of Array.from(paragraph.children))if(child.localName!=='pPr')child.remove();
      for(const child of Array.from(firstRun.children))if(child.localName!=='rPr')child.remove();
      const text=doc.createElementNS(A,'a:t');text.textContent=field.rows[i]?.[j]||'';firstRun.appendChild(text);paragraph.appendChild(firstRun);
      for(const child of list(body,A,'p'))child.remove();body.appendChild(paragraph);
    }));
   }else {
    const fitted=await rephraseNativeTemplateText(field?.text,layout.objects.find(object=>object.name===slot.name),{maxLength:slot.maxLength,rewriteText,signal,onProgress});
    setText(shape,fitted.text,slot.kind==='text-list'&&!!fitted.text);
    if(fitted.original){overflowFields.push({id,name:slot.field,text:fitted.original});warnings.push(`Slide ${index+1}: placeholder ${id} ${fitted.rephrased?'was rephrased to fit; original text is retained in slide metadata':'keeps its full original text because it could not be rephrased to fit'}.`);}
   }
  }
  // Attribution stays on the slide when a generated photo is added.
  const credits=imageCredits.filter(c=>c.slide===index+1);
  if(credits.length){const tree=list(doc,P,'spTree')[0],label=credits.map(c=>[c.title,c.author,c.license,c.url].filter(Boolean).join(' / ')).join(' · ');tree.appendChild(imported(doc,`<p:sp xmlns:p="${P}" xmlns:a="${A}"><p:nvSpPr><p:cNvPr id="900000" name="Image credits"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="152400" y="6610350"/><a:ext cx="11887200" cy="247650"/></a:xfrm><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="525"/><a:t>${esc(label)}</a:t></a:r></a:p></p:txBody></p:sp>`));}
  parts[sourcePath]=encodeXML(serialize(doc));parts[relPath(sourcePath)]=encodeXML(serialize(relations));
  sources.push({path:sourcePath,name:slide.title,selection:template.family==='builtin-ocean'?{...slide.templateSelection,theme:spec.colorScheme||builtinTheme||'office'}:slide.templateSelection,layoutid:fileIdFromPath(resolvePart(sourcePath,list(relations,relNS,'Relationship').find(r=>r.getAttribute('Type').endsWith('/slideLayout')).getAttribute('Target'))),purpose:slide.purpose,...(overflowFields.length?{overflowContent:{text:slide.templateFields.filter(f=>typeof f.text==='string').map(f=>f.text).join('\n\n'),fields:overflowFields}}:{})});
 }
 if(template.family==='builtin-ocean')applyBuiltinTemplateTheme(parts,spec.colorScheme||builtinTheme||'office');
 if(targetSize)resizeNativeTemplateParts(parts,template,targetSize);
 return {parts,sources,warnings,imageCount,placeholderCount,imageCredits,prefix,sourceTypes:original['[Content_Types].xml'],mapping};
}

export function mergeNativeTemplatePackage(prepared,archive){
 const parts={...prepared.parts},types=parse(decodeXML(archive['[Content_Types].xml'])),sourceTypes=parse(decodeXML(prepared.sourceTypes));
 const typeNS='http://schemas.openxmlformats.org/package/2006/content-types',known=new Set(list(types,typeNS,'Override').map(n=>n.getAttribute('PartName')));
 const sourceTypeMap=new Map(list(sourceTypes,typeNS,'Override').map(n=>[n.getAttribute('PartName').slice(1),n.getAttribute('ContentType')]));
 const reverse=new Map([...prepared.mapping].map(([a,b])=>[b,a]));
 for(const path of Object.keys(parts).filter(path=>path.endsWith('.xml'))){
  if(known.has('/'+path))continue;
  const type=sourceTypeMap.get(reverse.get(path))||(path.startsWith('ppt/slides/')&& !path.includes('/charts/')?'application/vnd.openxmlformats-officedocument.presentationml.slide+xml':path.includes('/charts/')?'application/vnd.openxmlformats-officedocument.drawingml.chart+xml':undefined);
  if(!type)continue;const node=types.createElementNS(typeNS,'Override');node.setAttribute('PartName','/'+path);node.setAttribute('ContentType',type);types.documentElement.appendChild(node);
 }
 for(const ext of ['xlsx'])if(!list(types,typeNS,'Default').some(n=>n.getAttribute('Extension')===ext)){const node=types.createElementNS(typeNS,'Default');node.setAttribute('Extension',ext);node.setAttribute('ContentType','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');types.documentElement.appendChild(node);}
 const presentation=parse(decodeXML(archive['ppt/presentation.xml'])),rels=relationshipDoc(decodeXML(archive['ppt/_rels/presentation.xml.rels']));
 let masters=list(presentation,P,'sldMasterIdLst')[0];if(!masters){masters=presentation.createElementNS(P,'p:sldMasterIdLst');presentation.documentElement.insertBefore(masters,presentation.documentElement.firstChild);}
 let id=Math.max(2147483647,...list(masters,P,'sldMasterId').map(n=>Number(n.getAttribute('id'))));
 for(const path of Object.keys(parts).filter(p=>/^ppt\/slideMasters\/[^/]+\.xml$/.test(p))){const rid='rId_'+prepared.prefix+'_'+(++id);addRelationship(rels,rid,'slideMaster','/'+path);const node=presentation.createElementNS(P,'p:sldMasterId');node.setAttribute('id',String(id));node.setAttributeNS(R,'r:id',rid);masters.appendChild(node);}
 parts['[Content_Types].xml']=encodeXML(serialize(types));parts['ppt/presentation.xml']=encodeXML(serialize(presentation));parts['ppt/_rels/presentation.xml.rels']=encodeXML(serialize(rels));return parts;
}

