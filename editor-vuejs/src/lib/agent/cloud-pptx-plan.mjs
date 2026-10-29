import {officeColorCatalogue,officeColorScheme} from './office-color-schemes.mjs';
import {buildPptxContentSchema,applyPptxContent,parsePptxContentResponse} from './pptx-content-schema.mjs';
import {parsedPresentonTemplate} from './presenton-pptx-cache.mjs';
import {parseToolPlan,compactModelContext} from './agent-plan.mjs';
import {validateNativeTemplateDeck,limitNativeTemplateImages} from './native-template-plan.mjs';
export async function planCloudPptxTemplate({request,model,command,tools,context,signal,onProgress,modelLabel}){
 const compact=compactModelContext(context),families=context.pptxTemplateContext.families.map(({id,name,layouts})=>({id,name,layouts}));
 const metrics={workflow:'pptx-content-schema',inferenceMs:0,inputTokens:0,planningCalls:0,repairCalls:0};
 const ask=async(path,body)=>{signal?.throwIfAborted();const response=await request(path,{signal,onProgress,body:{model,...body}});signal?.throwIfAborted();metrics.planningCalls++;metrics.inferenceMs+=response.inferenceMs||0;metrics.inputTokens+=response.inputTokens||0;return response.text;};
 onProgress?.('Planning content and selecting native PPTX layouts…');
 let outline,error;
 for(let attempt=0;attempt<2;attempt++){
  const text=await ask('template-outline',{command,context:{families,officeColorSchemes:officeColorCatalogue(),sourceContext:compact.sourceContext,slideTask:context.slideTask,selectedFamily:context.htmlTemplate},...(error?{correction:error}:{})});
  try{
   outline=parsePptxContentResponse(text);
   const family=families.find(f=>f.id===outline.family);
   if(!family)throw Error('Choose one supplied template family.');
   if(context.htmlTemplate&&context.htmlTemplate!=='presenton-auto'&&context.htmlTemplate!==outline.family)throw Error('Use the explicitly selected template family.');
   if(!Array.isArray(outline.slides)||!outline.slides.length||outline.slides.length>20)throw Error('Return 1–20 slides.');
   if(Number.isInteger(context.slideTask?.count)&&outline.slides.length!==context.slideTask.count)throw Error(`Return exactly ${context.slideTask.count} slides.`);
   for(const slide of outline.slides){if(!family.layouts.some(l=>l.id===slide.layoutId))throw Error('Every slide must select a layoutId in the chosen family.');if(typeof slide.title!=='string'||!slide.title.trim()||slide.title.length>120)throw Error('Each slide needs a title of at most 120 characters.');if(typeof slide.contentBrief!=='string')throw Error('Each slide needs a factual contentBrief.');}
   break;
  }catch(failure){if(attempt)throw failure;error=failure.message;metrics.repairCalls++;}
 }
 let template=parsedPresentonTemplate(outline.family);
 if(!template)template=await (await import('./presenton-pptx.mjs')).loadPresentonTemplate(outline.family,{signal,onProgress});
 const slides=[];
 for(const [index,direction]of outline.slides.entries()){
  const layout=template.layouts.find(l=>l.id===direction.layoutId),schema=layout.contentSchema||buildPptxContentSchema(layout).schema;
  const imageBudget=/\b(?:text[- ]only|no (?:images|photos|pictures))\b/i.test(command)?0:Math.max(0,8-slides.reduce((n,s)=>n+s.templateFields.filter(f=>f.query).length,0));
  let correction;
  for(let attempt=0;attempt<2;attempt++){
   onProgress?.(`Filling ${template.name}: slide ${index+1} of ${outline.slides.length} from its PPTX schema…`);
   const response=await ask('template-content',{command,title:direction.title,contentBrief:direction.contentBrief,sourceContext:compact.sourceContext,schema,imageBudget,...(correction?{correction}:{})});
   try{
    const content=parsePptxContentResponse(response),fields=limitNativeTemplateImages(applyPptxContent(layout,content,{packOverflowText:true}),imageBudget);
    const slide={title:direction.title,purpose:typeof direction.purpose==='string'?direction.purpose.slice(0,300)||'Explain the topic':'Explain the topic',layout:'pptx',templateSelection:{family:outline.family,layout:layout.id,modelSelectedLayout:true,hostReflowed:false},templateFields:fields};
    validateNativeTemplateDeck({slides:[slide]});slides.push(slide);break;
   }catch(failure){if(attempt)throw Error(`Slide ${index+1}: ${failure.message} No slides inserted.`);correction=failure.message;metrics.repairCalls++;}
  }
 }
 const deck={colorScheme:officeColorScheme(outline.colorScheme).id,title:typeof outline.title==='string'?outline.title.slice(0,160)||slides[0].title:slides[0].title,audience:typeof outline.audience==='string'?outline.audience.slice(0,200)||'Requested audience':'Requested audience',objective:typeof outline.objective==='string'?outline.objective.slice(0,300)||'Explain the requested topic':'Explain the requested topic',generationModel:modelLabel||model,slides};
 const plan=parseToolPlan(JSON.stringify({message:`Prepared ${slides.length} slides by filling content schemas from ${template.name}.`,calls:[{name:'savanna_create_deck',arguments:deck}]}),tools,context);
 return {...plan,metrics};
}
