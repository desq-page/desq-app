import { FILL_TEMPLATES,FILL_PALETTES,FILL_LIMITS,fillTemplateHTML,measureFilledTemplate } from './template-fill.mjs';
import { parseToolPlan,compactModelContext } from './agent-plan.mjs';
import { preflightDeckPlan } from './deck-preflight.mjs';

import { parseTemplateResponse as parse, TEMPLATE_FIELDS_PROMPT } from './template-fill-response.mjs';

export function validateTemplateContent(value,{template,palette,onWarning=()=>{}}={}) {
  const data={title:value.title,kicker:value.kicker,subtitle:value.subtitle,imageQuery:value.imageQuery,imageAlt:value.imageAlt,items:value.items,templateId:template&&template!=='auto'?template:value.templateId,paletteId:palette&&palette!=='auto'?palette:value.paletteId};
  const layout=FILL_TEMPLATES.find(t=>t.id===data.templateId);
  if(!layout)throw Error('Choose a known templateId.');
  if(!FILL_PALETTES[data.paletteId])throw Error('Choose a known paletteId.');
  for(const field of ['title','kicker','subtitle','imageQuery','imageAlt']) {
    if(data[field]===undefined)data[field]='';
    if(typeof data[field]!=='string'||data[field].length>2000)throw Error(`${field} must be a short plain string.`);
  }
  if(!data.title.trim())throw Error('Provide a meaningful title.');
  if(data.items==null)data.items=[];
  if(!Array.isArray(data.items))throw Error('items must be an array of content objects.');
  data.items=Array.from(data.items).map(item=>{
    if(!item||typeof item!=='object')throw Error('Each item needs label, text and optional value strings.');
    const result={};for(const key of ['label','text','value']){result[key]=item[key]??'';if(typeof result[key]!=='string'||result[key].length>2000)throw Error(`items.${key} must be a short string.`);}return result;
  });
  const itemText=item=>[[item.value,item.label].filter(part=>part.trim()).join(' '),item.text].filter(part=>part.trim()).join(': ');
  if(data.items.length!==layout.items)onWarning(`${layout.id}: fitted ${data.items.length} supplied points into ${layout.items} item slots; retained supplied content.`);
  // Narrative templates have one explanation slot; preserve model-written points there.
  if(layout.items===0&&data.items.length){
    data.subtitle=[data.subtitle,...data.items.map(itemText)].filter(part=>part.trim()).join('\n');
    data.items=[];
  }
  if(layout.items>0){
    if(data.items.length>layout.items){
      const extra=data.items.splice(layout.items);
      const last=data.items.at(-1);
      last.text=[last.text,...extra.map(itemText)].filter(part=>part.trim()).join('\n');
    }
    // Empty slots do not invent facts, numbers or calls to action.
    while(data.items.length<layout.items)data.items.push({label:'',text:'',value:''});
  }
  if(!['cover','photo-story','photo-left','editorial','closing'].includes(layout.id)&&data.subtitle.trim()){data.items[0].text=`${data.subtitle}\n${data.items[0].text}`;data.subtitle='';}
  if(layout.id!=='metrics')for(const item of data.items)if(item.value.trim()){item.label=`${item.value} ${item.label}`.trim();item.value='';}
  if(layout.photo&&!data.imageQuery.trim())data.imageQuery=data.title.split(/\s+/).slice(0,4).join(' ').slice(0,100);
  data.imageQuery=data.imageQuery.slice(0,160);data.imageAlt=data.imageAlt.slice(0,200);
  return data;
}
export async function planTemplateFill({command,tools,context,generate,isStopped=()=>false,onProgress,onPreview,modelLabel='Local model'}) {
  if(!command?.trim()||command.length>4000)throw Error('Enter a slide request within 4000 characters.');
  const count=context.slideTask?.mode==='edit'?1:context.slideTask?.count??1;
  if(!Number.isInteger(count)||count<1||count>20)throw Error('Invalid slide count.');
  const check=()=>{if(isStopped())throw Error('Local model stopped. No slides were inserted.');};
  const metrics={workflow:'template-fill',source:'model',inferenceMs:0,inputTokens:0,repairCalls:0,shortenedFields:[],warnings:[]};
  async function infer(system,data,budget=1024){check();const response=await generate([{role:'system',content:system},{role:'user',content:JSON.stringify(data)}],{maxNewTokens:budget});check();metrics.inferenceMs+=response.metrics?.inferenceMs||0;metrics.inputTokens+=response.metrics?.inputTokens||0;return response.text;}
  const slides=[];
  let palette=context.fillPalette||'auto',photos=0;
  const template=context.fillTemplate||'auto';
  const languageInstruction="Write all visible slide content in the same language as the user’s topic/source material, unless the user explicitly requests another language. For mixed-language requests, follow the main topic/source language. Keep that language across slides and corrections; do not default to English. This includes titles, kickers, explanations, item labels and imageAlt. Keep template IDs, palette IDs and field keys unchanged. imageQuery may use English search keywords when useful for photo retrieval.";
  const contentPrompt=`${languageInstruction} Fill a fixed presentation template. Return ONLY a JSON object: {"templateId":"photo-story","paletteId":"ocean","title":"Short meaningful title","kicker":"Optional short category","subtitle":"Actual concise explanation","items":[],"imageQuery":"solar panels","imageAlt":"Rooftop solar panels"}. Never return HTML, SVG, CSS, coordinates, tool calls or commentary. Choose a template suited to the slide's information and vary the layouts across a deck. Consult previousSlides and prefer a different suitable layout from the preceding slide; repeat only when the content requires it. Use agenda for an overview, timeline for milestones, spotlight for one key idea, and comparison for alternatives. Use photo-story, photo-left or closing when a picture helps; native visual layouts suit comparisons/processes. Write factual content; never invent numbers, evidence or quotations. Metrics may only use supplied values. items contains exactly the chosen template's item count; each item is {"label":"short heading","text":"concise explanation","value":"supplied metric, if applicable"}. Use subtitle only for cover, photo-story, photo-left, editorial and closing; other explanations belong in items. Use the supplied character limits; fit the slots rather than writing an essay. Return imageQuery as 2–4 subject keywords for photo templates. This application inserts content; you do not perform editor actions.`;
  for(let index=0;index<count;index++) {
    let data,error;
    for(let attempt=0;attempt<2;attempt++) {
      onProgress?.(`${modelLabel}: filling slide ${index+1} of ${count}${attempt?' (content correction)':''}…`);
      if(attempt)metrics.repairCalls++;
      const text=await infer(attempt ? `${languageInstruction} ${TEMPLATE_FIELDS_PROMPT}` : contentPrompt,{request:command,slideNumber:index+1,totalSlides:count,
        templates:template==='auto'?FILL_TEMPLATES:FILL_TEMPLATES.filter(t=>t.id===template),
        palettes:palette==='auto'?Object.entries(FILL_PALETTES).map(([id,p])=>({id,background:p.background,foreground:p.foreground,accent:p.accent})): [palette],
        requiredTemplate:template,requiredPalette:palette,limits:FILL_LIMITS,
        previousSlides:slides.map(s=>({title:s.title,template:s.templateSelection.layout})),
        ...(context.slideTask?.mode==='edit'?{currentSlide:compactModelContext(context).page}:{}),...(error?{correction:error}:{})},attempt ? 1536 : 1024);
      try {data=validateTemplateContent(parse(text),{template,palette,onWarning:warning=>{
        metrics.warnings.push(`Slide ${index+1}: ${warning}`);
        console.warn('[Desq Template Fill content]',{slide:index+1,warning});
      }});break;}
      catch(failure){console.warn('[Desq Template Fill format]',{slide:index+1,attempt:attempt+1,error:failure.message,responsePreview:String(text).slice(0,240),responseCharacters:String(text).length});if(attempt)throw Error(`Slide ${index+1}: ${failure.message} No slides were inserted.`);error=failure.message;}
    }
    if(palette==='auto')palette=data.paletteId;
    const original={...data,items:data.items.map(item=>({...item}))};
    const imagesAllowed=photos<8;
    let originalHTML=fillTemplateHTML(data,{imagesAllowed}),proof=measureFilledTemplate(originalHTML);
    if(proof.overflows.length) {
      onProgress?.(`${modelLabel}: shortening ${proof.overflows.length} overflowing field(s) on slide ${index+1}…`);
      metrics.repairCalls++;
      const shortened=await infer('Shorten ONLY the supplied overflowing fields, preserving facts, language and meaning. Return ONLY {"fields":{"title":"shorter text","items.0.text":"shorter explanation"}} using the exact supplied field names. Do not change templates, colors, other fields or geometry. Aim for half the original length. No HTML, CSS or tool calls.',{fields:proof.overflows},512);
      try {
        const fields=parse(shortened).fields;
        if(!fields||typeof fields!=='object'||Array.isArray(fields))throw Error('Invalid field rewrite.');
        for(const item of proof.overflows){const value=fields[item.field];if(typeof value!=='string'||value.length>item.text.length||!value.trim())continue;const path=item.field.split('.');let owner=data;for(const key of path.slice(0,-1))owner=owner[key];owner[path.at(-1)]=value;}
      } catch {metrics.warnings.push(`Slide ${index+1}: used local text fitting after an invalid field rewrite.`);}
      check();proof=measureFilledTemplate(fillTemplateHTML(data,{imagesAllowed}));
    }
    const changed=Object.keys(original).some(key=>key!=='items'&&original[key]!==data[key])||JSON.stringify(original.items)!==JSON.stringify(data.items)||proof.overflows.length>0;
    const overflowContent=changed?{text:JSON.stringify(original,null,2),html:originalHTML}:undefined;
    if(proof.overflows.length){metrics.shortenedFields.push(...proof.overflows.map(item=>`Slide ${index+1}: ${item.field}`));metrics.warnings.push(`Slide ${index+1}: some text was shortened to fit; full original content is available from Download full content.`);}
    const layout=FILL_TEMPLATES.find(t=>t.id===data.templateId);
    if(layout.photo){if(imagesAllowed)photos++;else metrics.warnings.push(`Slide ${index+1}: kept a described photo placeholder because the deck image budget is exhausted.`);}
    slides.push({title:data.title.slice(0,120),purpose:'Communicate the requested topic',layout:'html',html:proof.html,
      templateSelection:{family:'curated-fill',layout:data.templateId,modelSelectedLayout:template==='auto',hostReflowed:false},...(overflowContent?{overflowContent}:{})});
  }
  const plan=parseToolPlan(JSON.stringify({message:`Prepared ${slides.length} editable slides with fixed templates and the ${palette} palette.${metrics.warnings.length?' '+metrics.warnings.join(' '):''}`,calls:[{name:'desq_create_deck',arguments:{title:slides[0].title,generationModel:modelLabel,audience:'The requested audience',objective:'Explain the requested topic',design:{...FILL_PALETTES[palette],fontFamily:'Arial'},slides}}]}),tools,{...context,slideAuthoring:'html'});
  const proof=preflightDeckPlan(plan,{...context,slideAuthoring:'html'});check();onPreview?.(proof.previews);
  return {...plan,metrics};
}
