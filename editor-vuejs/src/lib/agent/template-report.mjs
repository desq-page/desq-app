import {officeColorScheme} from './office-color-schemes.mjs';
import {PRESENTON_TEMPLATES} from './presenton-templates.mjs';
import {FILL_TEMPLATES} from './template-fill.mjs';

// Report stored evidence; never infer a family from the visible colours or shapes.
export function templateUsage(selection) {
  if(!selection)return undefined;
  const fixed=selection.family==='curated-fill';
  const family=PRESENTON_TEMPLATES.find(item=>item.id===selection.family);
  const layout=fixed?FILL_TEMPLATES.find(item=>item.id===selection.layout):family?.layouts.find(item=>item.id===selection.layout);
  const notes=[];
  if(!fixed&&selection.modelSelectedLayout===false)notes.push('Layout reference chosen by the app; the model did not report a valid layout ID.');
  if(selection.hostReflowed)notes.push('Composition adapted by the app to fit content or restore a photo.');
  return {family:fixed?'Built-in fixed layouts':selection.family==='builtin-ocean'?'Built-in · '+officeColorScheme(selection.theme).name:family?.name||selection.family,
    layout:fixed?layout?.name||selection.layout:selection.layout,
    familyId:selection.family,layoutId:selection.layout,notes};
}
export function deckTemplateUsage(slides=[]) {
  return slides.map((slide,index)=>({slide:index+1,title:slide.title,...(templateUsage(slide.templateSelection)||{family:'Freeform / unreported',layout:'No template ID recorded',notes:[]})}));
}
