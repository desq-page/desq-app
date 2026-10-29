// Compile the existing fixed-layout definitions into editable native PPTX scenes.
import {parseFragment} from 'parse5';
import {FILL_TEMPLATES,FILL_PALETTES,FILL_LIMITS,fillTemplateHTML} from '../../editor-vuejs/src/lib/agent/template-fill.mjs';
export function builtinTemplateFamilies(){
 return Object.entries(FILL_PALETTES).filter(([id])=>id==='ocean').map(([paletteId,palette])=>({
  id:`builtin-${paletteId}`,fileName:'builtin',name:'Built-in',
  description:`Twelve coordinated editable layouts: opening, photo story, comparison, ideas, process, metrics, agenda, timeline and closing. Selectable theme colors.`,palette,
  layouts:FILL_TEMPLATES.map(layout=>({...layout,scene:scene(layout,paletteId)})),
 }));
}
function scene(layout,paletteId){
 const data={templateId:layout.id,paletteId,kicker:'SECTION',title:layout.name,subtitle:'Supporting explanation',imageQuery:'Template photo',imageAlt:'Photo placeholder',items:Array.from({length:layout.items},(_,i)=>({label:`Item ${i+1}`,text:'Supporting detail',value:'42'}))};
 const doc=parseFragment(fillTemplateHTML(data)),objects=[],slots=[];
 const visit=node=>{
  const attrs=Object.fromEntries((node.attrs||[]).map(a=>[a.name,a.value]));
  const style=Object.fromEntries((attrs.style||'').split(';').filter(Boolean).map(s=>{const i=s.indexOf(':');return [s.slice(0,i),s.slice(i+1)];}));
  const num=(key,fallback=0)=>parseFloat(style[key])||fallback;
  if(style.position==='absolute'){
   const field=attrs['data-fill-field'],name=field?`field:${field}`:node.tagName==='img'?'field:image':`design:${objects.length}`;
   const text=(node.childNodes||[]).filter(c=>c.nodeName==='#text').map(c=>c.value).join('');
   const size=num('font-size',26),base={name,x:num('left'),y:num('top'),width:num('width',Math.max(24,text.length*size)),height:num('height',size*1.3)};
   if(field||text){
    objects.push({...base,kind:'text',text,font:{family:'Arial',size,color:style.color||'#172923',bold:style['font-weight']==='700',line_height:1.2}});
    if(field)slots.push({name,field,kind:'text',maxLength:FILL_LIMITS[field.replace(/\.\d+\./,'.*.')]||FILL_LIMITS[field]||160});
   }else if(node.tagName==='img'){
    objects.push({...base,kind:'image-placeholder',text:'Photo placeholder',decorative:false});slots.push({name,field:'image',kind:'image'});
   }else if(node.tagName==='svg'){
    const circle=node.childNodes.find(c=>c.tagName==='circle');const fill=circle?.attrs.find(a=>a.name==='fill')?.value;
    objects.push({...base,kind:'shape',geometry:'ellipse',fill:{color:fill}});
   }else if(style.background)objects.push({...base,kind:'shape',geometry:num('border-radius')?'roundRect':'rect',fill:{color:style.background}});
  }
  if(node.tagName!=='svg')for(const child of node.childNodes||[])visit(child);
 };
 visit(doc);return {id:layout.id,description:layout.description,objects,slots,warnings:[]};
}
