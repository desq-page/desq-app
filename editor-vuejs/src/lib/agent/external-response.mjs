import {compileDeck,deckImageRequests} from './deck-compiler.mjs';
import {generatedFontFamilies,loadGeneratedGoogleFonts} from './generated-fonts.mjs';
import {canvasTextMeasurer} from './deck-text.mjs';
import {resolveSlideImage} from './generated-slide.mjs';

export const isHtmlResponse = text => /^(?:```(?:html)?\s*)?(?:<!doctype\s+html|<html\b)/i.test(text.trim());

// Dashboard generation does not load or mutate an editor document first.
export async function createExternalResponseFile(source, deck, {signal,onProgress=()=>{}}={}) {
 signal?.throwIfAborted();
 const {importEditableHtml,importEditableDocument}=await import('shared-vuejs/api/document-import-importEditableHtml');
 if(isHtmlResponse(source)) {
  onProgress('Rendering the HTML and creating a new presentation…');
  return importEditableHtml(new File([source],'AI presentation.html',{type:'text/html'}));
 }
 const {blankDocument}=await import('shared-vuejs/api/document-model');
 const {genId}=await import('shared-vuejs/api/utility');
 const {getPrstInfo}=await import('shared-vuejs/api/shapeImportUtils');
 const doc=blankDocument(),assets=new Map(),used=new Set();
 const context=document.createElement('canvas').getContext('2d');
 const options={width:1280,height:720,genId,geometry:getPrstInfo,allowTextOverflow:true,...(context?{measureText:canvasTextMeasurer(context)}:{})};
 const draft=compileDeck(deck,options);
 const families=generatedFontFamilies(draft.pages);
 onProgress('Loading presentation fonts…');await loadGeneratedGoogleFonts(families);signal?.throwIfAborted();
 for(const {key,image} of deckImageRequests(deck)) {
  onProgress('Preparing presentation images…');
  const asset=await resolveSlideImage(image,{signal,used,language:deck.language,placeholderOnFailure:true,onProgress});
  signal?.throwIfAborted();
  if(asset.placeholder){assets.set(key,asset);continue;}
  const url=URL.createObjectURL(asset.blob);
  try {
   const image=new Image();image.src=url;await image.decode();
   const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(asset.blob);});
   const name=`ai-image-${genId()}.${asset.blob.type.split('/')[1]?.replace('svg+xml','svg')||'png'}`;
   doc.assets[name]={data,w:image.naturalWidth,h:image.naturalHeight};
   assets.set(key,{...asset,media:{name,w:image.naturalWidth,h:image.naturalHeight}});
  }finally{URL.revokeObjectURL(url);}
 }
 const compiled=compileDeck(deck,{...options,assets});signal?.throwIfAborted();
 doc.file.name=deck.title;doc.file.fonts=families.map(family=>({family,type:'google'}));
 doc.slides=compiled.pages.map(page=>({...page,id:genId(),fileId:doc.file.id}));
 doc.file.slides=doc.slides.map(({id,name,layoutid,transition})=>({id,name,layoutid,transition}));
 onProgress('Saving the new presentation…');
 return importEditableDocument(doc,{fileName:deck.title});
}
