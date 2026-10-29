import { DECK_PALETTES, legibleInk } from './deck-design.mjs';
import { htmlToSVG } from './html-slides.mjs';

export const FILL_PALETTES = Object.freeze({ ...DECK_PALETTES,
  midnight:{background:'#101D35',foreground:'#F5F7FC',accent:'#69D7C5',secondary:'#F9B86E',muted:'#BDCADA',surface:'#20314C',dark:'#101D35'},
  terracotta:{background:'#F8F0E8',foreground:'#382C28',accent:'#A4412B',secondary:'#436D64',muted:'#6D5A51',surface:'#EDE0D3',dark:'#382C28'},
});
export const FILL_TEMPLATES = Object.freeze([
  {id:'cover',name:'Bold opening',description:'Large headline with an accent panel and circular motif.',items:0,photo:false},
  {id:'photo-story',name:'Photo story',description:'Large landscape picture on the right; headline and explanation on the left.',items:0,photo:true},
  {id:'editorial',name:'Editorial statement',description:'A strong statement, supporting explanation and a contrasting takeaway band.',items:1,photo:false},
  {id:'comparison',name:'Two-way comparison',description:'Two equal panels for contrasting options with aligned headings and text.',items:2,photo:false},
  {id:'three-cards',name:'Three ideas',description:'Three distinct modules with numbered markers, labels and concise explanations.',items:3,photo:false},
  {id:'process',name:'Four-step process',description:'Four connected numbered stages with labels and explanations.',items:4,photo:false},
  {id:'metrics',name:'Three key metrics',description:'Three large supplied values with labels and explanatory captions; never invent numbers.',items:3,photo:false},
  {id:'closing',name:'Closing with a picture',description:'A clear final action beside a portrait picture, with an accent footer.',items:1,photo:true},
  {id:'photo-left',name:'Photo-led story',description:'Tall picture on the left with an oversized headline and explanation on the right.',items:0,photo:true},
  {id:'agenda',name:'Three-part agenda',description:'A contrasting title panel beside three stacked numbered topics and explanations.',items:3,photo:false},
  {id:'timeline',name:'Three milestones',description:'Three staggered milestones along a vertical timeline; labels may contain supplied dates.',items:3,photo:false},
  {id:'spotlight',name:'Idea spotlight',description:'An oversized central statement with a contrasting supporting takeaway panel.',items:1,photo:false},
]);
export const FILL_LIMITS = Object.freeze({title:70,kicker:30,subtitle:240,'items.*.label':40,'items.*.text':160,'items.*.value':14,imageQuery:100,imageAlt:160});
const esc = value => String(value || '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
export function fillTemplateHTML(data,{imagesAllowed=true}={}) {
  const template=FILL_TEMPLATES.find(t=>t.id===data.templateId);
  if(!template)throw Error('Unknown fill template.');
  const p=FILL_PALETTES[data.paletteId];
  if(!p)throw Error('Unknown fill palette.');
  const box=(x,y,w,h,fill,r=0)=>`<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:${fill};border-radius:${r}px"></div>`;
  const text=(key,x,y,w,h,size=26,color=p.foreground,bold=false)=>`<div data-fill-field="${key}" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;overflow:hidden;font-size:${size}px;line-height:1.2;color:${color};font-weight:${bold?700:400};overflow-wrap:anywhere;white-space:pre-wrap">${esc(key.split('.').reduce((v,k)=>v?.[k],data))}</div>`;
  const circle=(x,y,size,fill)=>`<svg viewBox="0 0 100 100" style="position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px"><circle cx="50" cy="50" r="49" fill="${fill}"/></svg>`;
  const photo=(x,y,w,h)=>imagesAllowed?`<img data-query="${esc(data.imageQuery)}" alt="${esc(data.imageAlt||data.title)}" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;object-fit:cover;border-radius:18px">`:`${box(x,y,w,h,p.surface,18)}<div style="position:absolute;left:${x+24}px;top:${y+h/2-30}px;width:${w-48}px;font-size:22px;color:${p.foreground}">Photo: ${esc(data.imageAlt||data.title)}</div>`;
  const heading=()=>text('kicker',64,34,1100,30,20,p.accent,true)+text('title',64,86,1152,110,44,p.foreground,true);
  const item=(i,x,y,w,h)=>text(`items.${i}.label`,x,y,w,64,28,p.foreground,true)+text(`items.${i}.text`,x,y+84,w,h-84,24);
  let body='';
  if(template.id==='cover')body=box(850,0,430,720,p.accent)+circle(930,100,230,legibleInk(p.accent))+box(64,88,96,8,p.accent)+text('kicker',64,42,720,32,22,p.accent,true)+text('title',64,152,720,220,60,p.foreground,true)+text('subtitle',64,410,690,180,28,p.muted);
  if(template.id==='photo-story')body=box(0,0,16,720,p.accent)+text('kicker',64,44,580,32,20,p.accent,true)+text('title',64,112,554,166,44,p.foreground,true)+text('subtitle',64,320,554,270,27,p.muted)+photo(682,70,534,586);
  if(template.id==='editorial')body=heading()+text('subtitle',64,224,1072,186,34)+box(64,474,1152,166,p.accent,16)+text('items.0.label',96,500,1088,44,28,legibleInk(p.accent),true)+text('items.0.text',96,558,1088,62,24,legibleInk(p.accent));
  if(template.id==='comparison')body=heading()+[0,1].map(i=>box(64+i*592,226,560,414,p.surface,18)+box(64+i*592,226,560,8,i?p.secondary:p.accent)+item(i,96+i*592,270,496,320)).join('');
  if(template.id==='three-cards')body=heading()+[0,1,2].map(i=>box(64+i*394,230,364,410,p.surface,18)+circle(88+i*394,254,62,i===1?p.secondary:p.accent)+`<div style="position:absolute;left:${106+i*394}px;top:266px;font-size:28px;font-weight:700;color:${legibleInk(i===1?p.secondary:p.accent)}">${i+1}</div>`+item(i,88+i*394,344,316,264)).join('');
  if(template.id==='process')body=heading()+box(146,282,980,4,p.accent)+[0,1,2,3].map(i=>circle(150+i*292,248,72,p.accent)+`<div style="position:absolute;left:${176+i*292}px;top:266px;font-size:28px;font-weight:700;color:${legibleInk(p.accent)}">${i+1}</div>`+item(i,64+i*292,360,264,270)).join('');
  if(template.id==='metrics')body=heading()+[0,1,2].map(i=>box(64+i*394,230,364,410,p.surface,18)+text(`items.${i}.value`,88+i*394,270,316,110,64,p.accent,true)+item(i,88+i*394,406,316,214)).join('');
  if(template.id==='closing')body=photo(64,64,450,572)+text('kicker',570,64,646,32,20,p.accent,true)+text('title',570,130,646,166,46,p.foreground,true)+text('subtitle',570,336,646,156,27,p.muted)+box(570,508,646,128,p.accent,14)+text('items.0.label',594,526,598,38,26,legibleInk(p.accent),true)+text('items.0.text',594,574,598,48,20,legibleInk(p.accent));
  if(template.id==='photo-left')body=photo(40,40,500,640)+box(580,70,96,8,p.accent)+text('kicker',580,108,636,32,20,p.accent,true)+text('title',580,180,636,200,48,p.foreground,true)+text('subtitle',580,430,636,210,27,p.muted);
  if(template.id==='agenda')body=box(0,0,456,720,p.accent)+text('kicker',48,64,360,32,20,legibleInk(p.accent),true)+text('title',48,150,360,360,46,legibleInk(p.accent),true)+[0,1,2].map(i=>circle(496,72+i*210,56,p.secondary)+`<div style="position:absolute;left:515px;top:${84+i*210}px;font-size:26px;color:${legibleInk(p.secondary)}">${i+1}</div>`+text(`items.${i}.label`,580,64+i*210,620,48,28,p.foreground,true)+text(`items.${i}.text`,580,126+i*210,620,104,24)).join('');
  if(template.id==='timeline')body=heading()+box(104,252,4,378,p.accent)+[0,1,2].map(i=>circle(86,252+i*136,40,p.accent)+box(150,230+i*136,1066,120,p.surface,12)+text(`items.${i}.label`,174,248+i*136,290,80,27,p.accent,true)+text(`items.${i}.text`,500,250+i*136,692,78,24)).join('');
  if(template.id==='spotlight')body=box(64,52,96,8,p.accent)+text('kicker',64,88,1152,32,20,p.accent,true)+text('title',64,170,1152,200,60,p.foreground,true)+box(64,448,1152,208,p.accent,18)+text('items.0.label',96,476,1088,56,30,legibleInk(p.accent),true)+text('items.0.text',96,554,1088,78,26,legibleInk(p.accent));
  return `<section style="position:relative;width:1280px;height:720px;background:${p.background};font-family:Arial;color:${p.foreground}">${body}</section>`;
}

// Only text changes during fitting. Font sizes, shapes and placeholder geometry
// are fixed. Capture overflowing field names for a targeted content-only rewrite.
export function measureFilledTemplate(html) {
  let result;
  htmlToSVG(html,{prepareLayout(page){
    const overflows=[];
    for(const el of page.querySelectorAll('[data-fill-field]')) {
      const fits=()=>el.scrollHeight<=el.clientHeight+1 && el.scrollWidth<=el.clientWidth+1;
      if(fits())continue;
      const original=el.textContent;
      overflows.push({field:el.getAttribute('data-fill-field'),text:original});
      let low=0,high=original.length;
      while(low<high){const mid=Math.ceil((low+high)/2);el.textContent=original.slice(0,mid).replace(/[\uD800-\uDBFF]$/,'')+'…';if(fits())low=mid;else high=mid-1;}
      let cut=original.slice(0,low).replace(/[\uD800-\uDBFF]$/,'');
      const word=cut.lastIndexOf(' ');if(word>cut.length*.65)cut=cut.slice(0,word);
      el.textContent=cut+'…';
    }
    result={html:page.outerHTML,overflows};
  }});
  return result;
}
