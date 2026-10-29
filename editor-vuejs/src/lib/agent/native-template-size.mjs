const A='http://schemas.openxmlformats.org/drawingml/2006/main';
const P='http://schemas.openxmlformats.org/presentationml/2006/main';
export function nativeTemplateTransform(source,target=source){
 const values=[source?.width,source?.height,target?.width,target?.height].map(Number);
 if(values.some(v=>!Number.isFinite(v)||v<=0))throw Error('Presentation dimensions must be positive numbers.');
 const [sw,sh,tw,th]=values,scale=Math.min(tw/sw,th/sh);
 return {scale,x:(tw-sw*scale)*9525/2,y:(th-sh*scale)*9525/2};
}
// Scale the native parts together, retaining placeholder IDs and inheritance.
// A different aspect ratio is centred rather than stretching shapes or text.
export function resizeNativeTemplateParts(parts,source,target){
 const {scale,x,y}=nativeTemplateTransform(source,target);
 if(scale===1&&x===0&&y===0)return;
 const scaleAttrs=(node,attrs)=>{for(const attr of attrs)if(node.hasAttribute(attr)){const value=Number(node.getAttribute(attr));if(Number.isFinite(value))node.setAttribute(attr,String(Math.round(value*scale)));}};
 for(const path of Object.keys(parts)){
  if(!/^ppt\/(?:slides|slideLayouts|slideMasters|charts|theme)\/[^/]+\.xml$/.test(path))continue;
  const doc=new DOMParser().parseFromString(new TextDecoder().decode(parts[path]),'application/xml');
  if(doc.getElementsByTagName('parsererror').length)throw Error('Invalid native template XML during resizing.');
  for(const node of Array.from(doc.getElementsByTagName('*'))){
   if(node.namespaceURI!==A&&node.namespaceURI!==P)continue;
   const tag=node.localName;
   if(['off','chOff'].includes(tag)){
    scaleAttrs(node,['x','y']);
    const xfrm=node.parentNode;
    const owner=xfrm?.parentNode?.localName==='graphicFrame'?xfrm.parentNode:xfrm?.parentNode?.parentNode;
    if(tag==='off'&&xfrm?.localName==='xfrm'&&owner?.parentNode?.localName==='spTree'){
     node.setAttribute('x',String(Math.round(Number(node.getAttribute('x'))+x)));
     node.setAttribute('y',String(Math.round(Number(node.getAttribute('y'))+y)));
    }
   }else if(['ext','chExt'].includes(tag))scaleAttrs(node,['cx','cy']);
   else if(['rPr','defRPr','endParaRPr'].includes(tag))scaleAttrs(node,['sz','spc','kern']);
   else if(tag==='bodyPr')scaleAttrs(node,['lIns','rIns','tIns','bIns','spcCol']);
   else if(tag==='pPr')scaleAttrs(node,['marL','marR','indent','defTabSz']);
   else if(tag==='ln'||tag==='gridCol')scaleAttrs(node,['w']);
   else if(tag==='tr')scaleAttrs(node,['h']);
   else if(tag==='tcPr')scaleAttrs(node,['marL','marR','marT','marB']);
   else if(tag==='spcPts'||tag==='buSzPts')scaleAttrs(node,['val']);
   else if(tag==='tab')scaleAttrs(node,['pos']);
  }
  parts[path]=new TextEncoder().encode(new XMLSerializer().serializeToString(doc));
 }
}
