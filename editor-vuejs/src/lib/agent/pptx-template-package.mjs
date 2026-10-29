// Package transformations preserve native shape identities and relationship IDs.
export const xmlEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[c]);
export const decodeXML=bytes=>new TextDecoder().decode(bytes);
export const encodeXML=text=>new TextEncoder().encode(text);
export function drawingNodes(xml){
 const start=xml.indexOf('>',xml.indexOf('<p:spTree'))+1,end=xml.indexOf('</p:spTree>',start);
 if(!start||end<0)return [];
 const body=xml.slice(start,end),tokens=[...body.matchAll(/<\/?p:(sp|pic|grpSp|graphicFrame|cxnSp)\b[^>]*>/g)],stack=[],result=[];
 for(const token of tokens){if(token[0].startsWith('</')){const node=stack.pop();if(node&&!stack.length)result.push(body.slice(node.start,token.index+token[0].length));}else if(token[0].endsWith('/>')){if(!stack.length)result.push(token[0]);}else stack.push({start:token.index});}
 return result;
}
const groupHeader='<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>';
const namespaces='xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const relationNS='http://schemas.openxmlformats.org/package/2006/relationships';
const officeNS='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export function nodeIdentity(node){return {id:node.match(/<p:cNvPr\b[^>]*\bid="([^"]+)"/)?.[1],name:node.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1]};}
export function markPlaceholder(node,slot){
 const ph=`<p:ph type="${slot.placeholderType}" idx="${slot.placeholderId}"/>`;
 return node.replace(/<p:nvPr\s*\/>/,`<p:nvPr>${ph}</p:nvPr>`).replace(/<p:nvPr>(?!<p:ph)([\s\S]*?)<\/p:nvPr>/,`<p:nvPr>${ph}$1</p:nvPr>`);
}
export function masterizePresentonParts(parts,metadata){
 const result={...parts},masterPath='ppt/slideMasters/slideMaster1.xml',masterRels='ppt/slideMasters/_rels/slideMaster1.xml.rels';
 let master=decodeXML(result[masterPath]),rels=decodeXML(result[masterRels]),types=decodeXML(result['[Content_Types].xml']);
 const ids=[];
 const slideXMLs=metadata.layouts.map(layout=>decodeXML(parts[`ppt/slides/slide${layout.page}.xml`]));
 const backgrounds=slideXMLs.map(xml=>xml.match(/<p:bg\b[^>]*>[\s\S]*?<\/p:bg>/)?.[0]||'');
 const sharedBackground=backgrounds[0]&&backgrounds.every(bg=>bg===backgrounds[0])?backgrounds[0]:undefined;
 const fullBackground=xml=>drawingNodes(xml).filter(node=>!nodeIdentity(node).name?.startsWith('field:')&&/<a:off[^>]*x="0"[^>]*y="0"/.test(node)&&/<a:ext[^>]*cx="12192000"[^>]*cy="6858000"/.test(node));
 const backgroundKey=node=>node.match(/<p:spPr\b[^>]*>[\s\S]*?<\/p:spPr>/)?.[0];
 const sharedShapes=fullBackground(slideXMLs[0]).filter(node=>slideXMLs.every(xml=>fullBackground(xml).some(candidate=>backgroundKey(candidate)===backgroundKey(node))));
 if(sharedBackground)master=master.replace(/<p:bg\b[^>]*>[\s\S]*?<\/p:bg>/,sharedBackground);
 if(sharedShapes.length)master=master.replace('</p:spTree>',sharedShapes.join('')+'</p:spTree>');

 for(const layout of metadata.layouts){
  const slidePath=`ppt/slides/slide${layout.page}.xml`,slide=decodeXML(parts[slidePath]);
  const layoutPath=`ppt/slideLayouts/slideLayoutPresenton${layout.page}.xml`,relPath=`ppt/slideLayouts/_rels/slideLayoutPresenton${layout.page}.xml.rels`;
  const slots=new Map(layout.slots.map(slot=>[xmlEscape(slot.name),slot]));
  const nodes=drawingNodes(slide),layoutNodes=[],content=[];
  const textSlots=layout.slots.filter(slot=>['text','text-list'].includes(slot.kind));
  const titleSlot=textSlots.find(slot=>/^(?:main|primary|cover|slide|stack)_(?:title|heading)$|^(?:title|heading)$/.test(slot.field))||textSlots.find(slot=>/title|heading|headline/.test(slot.field))||textSlots[0];
  const counts={body:0,pic:1000,chart:2000,tbl:3000};
  for(const node of nodes){const identity=nodeIdentity(node),slot=slots.get(identity.name);
   if(!slot){if(!sharedShapes.some(bg=>backgroundKey(bg)===backgroundKey(node)))layoutNodes.push(node);continue;}
   slot.placeholderType=slot.kind==='image'?'pic':slot.kind==='chart'?'chart':slot.kind==='table'?'tbl':slot===titleSlot?'title':'body';
   // The JSON sources have no native placeholder IDs. Assign stable semantic
   // ranges once in the library; generation copies these exact indices unchanged.
   slot.placeholderId=slot.placeholderType==='title'?'0':String(++counts[slot.placeholderType]);
   let placeholder=markPlaceholder(node,slot);
   // Ordinary text boxes did not inherit the master's default body bullets before
   // conversion. Keep that appearance when turning them into native placeholders.
   placeholder=placeholder.replace(/<a:pPr\b[^>]*(?:\/>|>[\s\S]*?<\/a:pPr>)/g,pPr=>{
     if(/<a:bu(?:Char|AutoNum|None)\b/.test(pPr))return pPr;
     if(pPr.endsWith('/>'))return pPr.slice(0,-2)+'><a:buNone/></a:pPr>';
     return pPr.includes('<a:defRPr')?pPr.replace('<a:defRPr','<a:buNone/><a:defRPr'):pPr.replace('</a:pPr>','<a:buNone/></a:pPr>');
   });
   if(slot.kind==='chart'||slot.kind==='table'){
     // A layout carries an empty object placeholder, not a chart/table instance
     // with sample data. The native payload belongs only to the slide instance.
     const nv=placeholder.match(/<p:cNvPr\b[^>]*(?:\/>|>[\s\S]*?<\/p:cNvPr>)/)?.[0]||`<p:cNvPr id="${identity.id}" name="${identity.name}"/>`;
     const transform=placeholder.match(/<p:xfrm\b[^>]*>([\s\S]*?)<\/p:xfrm>/)?.[1]||'';
     layoutNodes.push(`<p:sp><p:nvSpPr>${nv}<p:cNvSpPr/><p:nvPr><p:ph type="${slot.placeholderType}" idx="${slot.placeholderId}"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm>${transform}</a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:buNone/></a:pPr></a:p></p:txBody></p:sp>`);
   }else layoutNodes.push(placeholder);
   // Local text content inherits layout geometry and formatting. Chart/table frames
   // retain their native payload and relationships; filling validates their supplied data.
   content.push(slot.kind==='text'||slot.kind==='text-list'||slot.kind==='image'
     ? placeholder.replace(/<p:spPr\b[^>]*>[\s\S]*?<\/p:spPr>/,'<p:spPr/>').replace(/<a:(?:rPr|defRPr|endParaRPr)\b[^>]*(?:\/>|>[\s\S]*?<\/a:(?:rPr|defRPr|endParaRPr)>)/g,'').replace(/<a:pPr\b[^>]*>[\s\S]*?<\/a:pPr>/g,slot.kind==='text-list'?'<a:pPr/>':'<a:pPr><a:buNone/></a:pPr>')
     : placeholder);
  }
  const bg=sharedBackground?'':slide.match(/<p:bg\b[^>]*>[\s\S]*?<\/p:bg>/)?.[0]||'';
  result[layoutPath]=encodeXML(`<?xml version="1.0" encoding="utf-8"?><p:sldLayout ${namespaces} type="cust" preserve="1"><p:cSld name="${xmlEscape(layout.id)}">${bg}<p:spTree>${groupHeader}${layoutNodes.join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`);
  const sourceRelPath=`ppt/slides/_rels/slide${layout.page}.xml.rels`;
  let sourceRels=decodeXML(parts[sourceRelPath]);
  const retained=[...sourceRels.matchAll(/<Relationship\b[^>]*\/>/g)].map(m=>m[0]).filter(r=>!/(?:\/slideLayout|\/notesSlide)"/.test(r));
  result[relPath]=encodeXML(`<Relationships xmlns="${relationNS}">${retained.join('')}<Relationship Id="rIdMaster" Type="${officeNS}/slideMaster" Target="/${masterPath}"/></Relationships>`);
  sourceRels=sourceRels.replace(/(<Relationship\b(?=[^>]*Type="[^\"]*\/slideLayout")(?=[^>]*Target=")[^>]*Target=")[^"]*(")/,`$1/${layoutPath}$2`);
  result[sourceRelPath]=encodeXML(sourceRels);
  result[slidePath]=encodeXML(`<?xml version="1.0" encoding="utf-8"?><p:sld ${namespaces} showMasterSp="1"><p:cSld name="${xmlEscape(layout.id)}"><p:spTree>${groupHeader}${content.join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
  const rid=`rIdPresenton${layout.page}`;ids.push(`<p:sldLayoutId id="${2147484000+layout.page}" r:id="${rid}" xmlns:r="${officeNS}"/>`);
  rels=rels.replace('</Relationships>',`<Relationship Id="${rid}" Type="${officeNS}/slideLayout" Target="/${layoutPath}"/></Relationships>`);
  types=types.replace('</Types>',`<Override PartName="/${layoutPath}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/></Types>`);
  layout.layoutPart=layoutPath;
 }
 master=master.replace('</p:sldLayoutIdLst>',ids.join('')+'</p:sldLayoutIdLst>');
 result[masterPath]=encodeXML(master);result[masterRels]=encodeXML(rels);result['[Content_Types].xml']=encodeXML(types);
 result['ppt/presenton.json']=encodeXML(JSON.stringify(metadata));return result;
}
