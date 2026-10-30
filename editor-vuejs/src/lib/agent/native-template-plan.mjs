import {buildPptxContentSchema,applyPptxContent,PPTX_CONTENT_INSTRUCTIONS} from './pptx-content-schema.mjs';
import {normalizeTemplateImageField} from './native-template-fields.mjs';
import {PRESENTON_TEMPLATES,presentonLayoutCandidates} from './presenton-templates.mjs';
import {parsedPresentonTemplate} from './presenton-pptx-cache.mjs';
import {parseToolPlan} from './agent-plan.mjs';
// Extract data only; commentary and model stop markers are never executed.
export function parseNativeTemplateResponse(response){
 if(typeof response!=='string'||!response.trim()||response.length>100000)throw Error('Model response is empty or too large. Return one slide JSON object.');
 const isSlide=value=>value&&typeof value==='object'&&!Array.isArray(value)&&typeof value.layoutId==='string'&&(Array.isArray(value.fields)||(value.content&&typeof value.content==='object'&&!Array.isArray(value.content)));
 try{const value=JSON.parse(response.trim());if(isSlide(value))return value;}catch{}
 const candidates=new Map();
 let start=-1,depth=0,quoted=false,escaped=false;
 for(let i=0;i<response.length;i++){
  const ch=response[i];
  if(start<0){if(ch==='{'){start=i;depth=1;quoted=false;escaped=false;}continue;}
  if(quoted){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;continue;}
  if(ch==='"'){quoted=true;continue;}
  if(ch==='{')depth++;
  if(ch==='}'&&!--depth){
   try{const value=JSON.parse(response.slice(start,i+1));if(isSlide(value))candidates.set(JSON.stringify(value),value);}catch{}
   start=-1;
  }
 }
 if(candidates.size===1)return candidates.values().next().value;
 if(candidates.size>1)throw Error('Model returned conflicting slide objects. Return exactly one slide JSON object.');
 throw Error('Model did not return usable native template fields. Return JSON with layoutId and fields.');
}
export function limitNativeTemplateImages(fields,budget){
 let remaining=Math.max(0,Math.floor(Number(budget)||0));
 return fields.map(field=>{
  if(!field.query)return field;
  if(remaining>0){remaining--;return field;}
  return {id:field.id,alt:field.alt||field.query};
 });
}
export function normalizeNativeTemplateFields(fields,layout){
 const slots=layout.slots.filter(slot=>slot.placeholderId!==undefined);
 return fields.map(raw=>{
  const field=normalizeTemplateImageField(raw);
  const {name,...content}=field;
  const id=String(field.id??name??'').trim();
  const exact=slots.find(slot=>String(slot.placeholderId)===id);
  if(exact)return {...content,id:String(exact.placeholderId)};
  const named=slots.filter(slot=>slot.name===id);
  const matches=named.length?named:slots.filter(slot=>slot.field===id);
  if(matches.length===1)return {...content,id:String(matches[0].placeholderId)};
  if(matches.length>1)throw Error(`Field name ${id} is ambiguous in ${layout.id}. Use one of these exact placeholder IDs: ${matches.map(slot=>slot.placeholderId).join(', ')}.`);
  throw Error(`Unknown placeholder ID ${id} in ${layout.id}. Use the supplied placeholder IDs or unique field names.`);
 });
}
export function nativePlaceholderFields(layout){
 return layout.slots.filter(slot=>slot.placeholderId).map(slot=>({id:slot.placeholderId,name:slot.field,sourceName:slot.name,kind:slot.kind,maxLength:slot.maxLength,maxRows:slot.maxRows,maxColumns:slot.maxColumns,chartType:slot.chartType}));
}
export function validateNativeTemplateDeck(deck){
 const families=new Set();
 for(const slide of deck.slides){
  if(slide.layout!=='pptx'||!slide.templateSelection||!Array.isArray(slide.templateFields))throw Error('Presenton slides require layout=pptx, templateSelection and templateFields.');
  if(slide.html||slide.svg||slide.body||slide.elements?.length)throw Error('Fill native template placeholders only; do not supply redrawn HTML, SVG or elements.');
  if(!slide.templateFields.some(field=>field.text?.trim()||field.query?.trim()||field.alt?.trim()||field.rows?.flat().some(value=>value.trim())||field.series?.length))throw Error('Fill at least one native placeholder with usable content.');
  const {family,layout}=slide.templateSelection;
  families.add(family);
  if(!PRESENTON_TEMPLATES.find(t=>t.id===family)?.layouts.some(l=>l.id===layout))throw Error('Unknown native Presenton layout.');
  const reference=parsedPresentonTemplate(family)?.layouts.find(l=>l.id===layout);
  if(reference)slide.templateFields=normalizeNativeTemplateFields(slide.templateFields,reference);
  const ids=new Set();
  for(const field of slide.templateFields){
   if(ids.has(field.id))throw Error('A placeholder ID was filled more than once.');ids.add(field.id);
   if(reference){const slot=reference.slots.find(slot=>slot.placeholderId===field.id);
     if(!slot)throw Error(`Unknown placeholder ID ${field.id} in ${layout}.`);
   }
  }
 }
 if(families.size!==1)throw Error('Choose one Presenton family for the whole deck.');
}
export async function planNativeTemplate({command,tools,context,generate,brief,metrics,onProgress,modelLabel,isStopped=()=>false}){
 const template=parsedPresentonTemplate(brief.template),slides=[];
 for(const [index,direction]of brief.slides.entries()){
  if(isStopped())throw Error('Local model stopped.');
  const imageBudget=/\b(?:text[- ]only|no (?:images|photos|pictures))\b/i.test(command)?0:Math.max(0,8-slides.reduce((sum,slide)=>sum+slide.templateFields.filter(field=>field.query).length,0));
  const candidates=presentonLayoutCandidates(brief.template,direction.layout,index,{usedLayouts:slides.map(s=>s.templateSelection.layout)}).map(item=>template.layouts.find(l=>l.id===item.id));
  while(candidates.length>1&&JSON.stringify(candidates.map(layout=>layout.contentSchema||buildPptxContentSchema(layout).schema)).length>10000)candidates.pop();
  let error;
  for(let attempt=0;attempt<2;attempt++){
   onProgress?.(`${template.name}: filling native placeholders for slide ${index+1} of ${brief.slides.length}…`);
   const response=await generate([{role:'system',content:PPTX_CONTENT_INSTRUCTIONS+' Choose one supplied layoutId. Return {"layoutId":"chosen ID","content":{...matching schema fields...}}.'},
    {role:'user',content:JSON.stringify({request:command,slideNumber:index+1,totalSlides:brief.slides.length,title:direction.title,imageBudget,layouts:candidates.map(layout=>({id:layout.id,description:layout.description,schema:layout.contentSchema||buildPptxContentSchema(layout).schema})),previousLayouts:slides.map(s=>s.templateSelection.layout),...(error?{correction:error}:{})})}],{maxNewTokens:4096});
   if(isStopped())throw Error('Local model stopped.');
   metrics.inferenceMs+=response.metrics?.inferenceMs||0;metrics.inputTokens+=response.metrics?.inputTokens||0;
   try{
    const result=parseNativeTemplateResponse(response.text);
    if(!candidates.some(l=>l.id===result.layoutId))throw Error('Choose a supplied layout ID and fill its content schema.');
    const selected=candidates.find(layout=>layout.id===result.layoutId);
    if(result.content)result.fields=applyPptxContent(selected,result.content,{packOverflowText:true});
    result.fields=normalizeNativeTemplateFields(result.fields,template.layouts.find(layout=>layout.id===result.layoutId));
    result.fields=limitNativeTemplateImages(result.fields,imageBudget);
    const slide={title:direction.title,purpose:'Explain the requested topic using native template placeholders',layout:'pptx',templateSelection:{family:brief.template,layout:result.layoutId,modelSelectedLayout:true,hostReflowed:false},templateFields:result.fields};
    validateNativeTemplateDeck({slides:[slide]});slides.push(slide);break;
   }catch(failure){if(attempt)throw Error(`Slide ${index+1}: ${failure.message} No slides inserted.`);error=failure.message;metrics.repairCalls++;}
  }
 }
 const plan=parseToolPlan(JSON.stringify({message:`Prepared ${slides.length} slides using ${template.name} as the native PPTX base, retaining master/layout links and placeholder IDs.`,calls:[{name:'desq_create_deck',arguments:{title:slides[0].title,colorScheme:brief.officeColorScheme||'office',generationModel:modelLabel,audience:'The requested audience',objective:'Explain the requested topic',slides}}]}),tools,context);
 return {...plan,metrics:{...metrics,workflow:'pptx-content-schema',designBrief:brief}};
}
