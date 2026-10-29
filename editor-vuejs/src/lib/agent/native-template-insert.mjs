import {prepareNativeTemplateDeck,mergeNativeTemplatePackage} from './native-template-deck.mjs';

export async function createNativeTemplateDeck(spec,{fileId,pageId,file,signal,onProgress,genId,prepare,checkTarget,resolveImage,pasteSlide,selectSlide,saveDexie,updateFile,updateSlide,getFileInfo,getSlideInfo,rebuildThumbnails,removeStarter,starterId,replaceCurrent=false,sourceBundles=[],prepareFonts,rewriteText,builtinTheme}={}){
 if(replaceCurrent)throw Error('Native template replacement is not available for this action; edit the existing placeholders directly.');
 const prepared=await prepareNativeTemplateDeck(spec,{signal,genId,resolveImage,onProgress,rewriteText,builtinTheme,targetSize:{width:file.width,height:file.height}});
 checkTarget();signal?.throwIfAborted();await prepare();
 const {getPptxArchive,installPptxTemplateParts}=await import('shared-vuejs/api/pptxArchive');
 const archive=await getPptxArchive(fileId);if(!archive)throw Error('The current presentation package is unavailable.');
 const parts=mergeNativeTemplatePackage(prepared,archive);
 onProgress?.('Importing native template masters and layouts…');
 const installed=await installPptxTemplateParts(fileId,parts,prepared.sources.map(source=>source.path));
 checkTarget();signal?.throwIfAborted();
 const ids=[],warnings=[...prepared.warnings];
 if(prepareFonts)warnings.push(...await prepareFonts(fileId,[...installed.layoutPages,...installed.pages],onProgress));
 const sourceReferences=[];
 if(sourceBundles.length){const {saveToOPFS}=await import('shared-vuejs/api/opfs');
   for(const source of sourceBundles){signal?.throwIfAborted();const base=`pptx/${encodeURIComponent(fileId)}/_internal/agent-sources/${encodeURIComponent(source.id)}`;
     for(const asset of source.assets)if(asset.data)await saveToOPFS(`${base}/${encodeURIComponent(asset.id)}.bin`,asset.data);
     const manifest={...source,assets:source.assets.map(({data,blob,...asset})=>asset)};
     await saveToOPFS(`${base}/manifest.json`,new TextEncoder().encode(JSON.stringify(manifest)));sourceReferences.push({id:source.id,name:source.name,kind:source.kind,manifest:`${base}/manifest.json`,warnings:source.warnings});
   }
 }
 checkTarget();signal?.throwIfAborted();
 updateFile({layouts:[...(getFileInfo().layouts||[]),...installed.layouts]});
 try{
  for(const [index,source]of prepared.sources.entries()){
   signal?.throwIfAborted();
   if(getFileInfo()?.id!==fileId)throw Error('The open presentation changed.');
   if(getSlideInfo()?.id!==(ids.at(-1)||pageId))throw Error('The selected slide changed before insertion.');
   const page={...installed.pages[index],name:source.name,layoutid:source.layoutid,showMaster:'1',
     agentMetadata:{version:4,engine:'pptx-template-native',deckTitle:spec.title,purpose:source.purpose,templateSelection:source.selection,...(source.overflowContent?{overflowContent:source.overflowContent}:{}),sourceBundles:sourceReferences,imageCredits:prepared.imageCredits.filter(c=>c.slide===index+1)}};
   onProgress?.(`Inserting native template slide ${index+1} of ${prepared.sources.length}…`);
   // Template selections can come from Vue reactive state. Snapshot the complete
   // JSON slide so nested proxies never reach IndexedDB (or enter editor state).
   const id=await pasteSlide(JSON.parse(JSON.stringify(page)),fileId);ids.push(id);
   await saveDexie({skipGenerateThumb:true});await selectSlide(id);
  }
  await removeStarter(fileId,starterId,ids,warnings,onProgress);
 }catch(error){throw Error(`Inserted ${ids.length}/${prepared.sources.length} native template slides. Inserted slides remain editable; use Undo to remove them. ${error.message}`);}
 finally{await rebuildThumbnails(fileId,ids,warnings,onProgress);}
 return {title:spec.title,pageIds:ids,slideCount:ids.length,imageCount:prepared.imageCount,placeholderCount:prepared.placeholderCount,shapeCount:installed.pages.reduce((sum,p)=>sum+(p.shapes?.length||0),0),warnings};
}
