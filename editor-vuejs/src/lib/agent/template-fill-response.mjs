// Parse data only. Never eval model code or mount returned markup.
const object = value => value && typeof value === 'object' && !Array.isArray(value);
export function parseTemplateResponse(response) {
  if(typeof response!=='string'||response.length>40000)throw Error('Model response is empty or too large.');
  const text=response.trim().replace(/^\uFEFF/,'');
  const clean=text.replace(/^```(?:json|markdown|md|text)?\s*/i,'').replace(/\s*```$/,'').trim();
  try{const parsed=JSON.parse(clean);if(object(parsed))return parsed;}catch{}
  // Scan complete JSON objects surrounded by prose/fences, respecting braces and
  // escaped quotes inside string values. Do not accept an arbitrary prose reply.
  const candidates=[];
  let start=-1,depth=0,quoted=false,escaped=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(start<0){if(ch==='{'){start=i;depth=1;quoted=false;escaped=false;}continue;}
    if(quoted){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;continue;}
    if(ch==='"'){quoted=true;continue;}
    if(ch==='{')depth++;
    if(ch==='}'&&!--depth){
      try{const value=JSON.parse(text.slice(start,i+1));if(object(value)&&(typeof value.title==='string'||object(value.fields)))candidates.push(value);}catch{}
      start=-1;
    }
  }
  if(candidates.length===1)return candidates[0];
  if(candidates.length>1)throw Error('Model returned multiple content objects; return exactly one slide.');
  const values=new Map();let current;
  for(const raw of clean.split(/\r?\n/)){
    const line=raw.trim().replace(/^(?:[-*]\s+|>\s*)/, '').replace(/\*\*/g,'');
    const match=line.match(/^(templateId|template|paletteId|palette|title|kicker|subtitle|imageQuery|image\s+(?:query|keywords)|imageAlt|image\s+alt|items\.([0-3])\.(label|text|value))\s*:\s*(.*)$/i);
    if(match){
      const key=match[1].toLowerCase().replace(/\s+/g,'');
      current=({template:'templateId',templateid:'templateId',palette:'paletteId',paletteid:'paletteId',imagequery:'imageQuery',imagekeywords:'imageQuery',imagealt:'imageAlt'})[key]||key;
      const value=match[4].replace(/^(['"])([\s\S]*)\1$/,'$2');
      values.set(current,value==='|'||value==='>'?'':value);
    }else if(current&&line&&!/^```|^#{1,6}\s/.test(line))values.set(current,`${values.get(current)}\n${line}`.trim());
  }
  if(!values.has('title')||![...values.keys()].some(key=>['subtitle','templateId','paletteId'].includes(key)||key.startsWith('items.'))){
    const html=/^(?:```html\b|<!doctype\b|<html\b|<section\b)/i.test(text);
    throw Error(html?'Model returned HTML instead of template content fields.':'Model did not return usable template fields.');
  }
  const result={items:[]};
  for(const [key,value] of values){
    const match=key.match(/^items\.([0-3])\.(label|text|value)$/);
    if(match){const index=Number(match[1]);result.items[index]??={label:'',text:'',value:''};result.items[index][match[2]]=value;}
    else result[key]=value;
  }
  return result;
}
export const TEMPLATE_FIELDS_PROMPT = `Fill ONE fixed presentation slide using plain text key/value lines, not JSON or HTML. Use these exact keys:
templateId: a supplied template ID
paletteId: a supplied palette ID
title: short actual slide title
kicker: short category
subtitle: actual explanation (blank if the template uses items)
imageQuery: 2 to 4 photo subject keywords
imageAlt: descriptive image caption
For a template with items, add exactly its required count using ZERO-BASED indices:
items.0.label: short heading
items.0.text: concise explanation
items.0.value: supplied metric only, otherwise blank
Continue items.1..., items.2..., items.3... only as required. For zero-item templates omit all items.* lines. Keep one value per line. Follow the required template and palette when supplied. Never write HTML, CSS, SVG, code, editor commands or conversational explanations. Do not invent facts or numbers. Return actual content, not descriptions of what you would write.`;
