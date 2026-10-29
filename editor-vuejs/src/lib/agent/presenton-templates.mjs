import builtins from "./templates/builtin-catalogue.json" with {type:"json"};
import {pptxLayoutReference,parsedPresentonTemplate,PRESENTON_PPTX_FILES} from './presenton-pptx-cache.mjs';
// Legacy export names and the auto ID remain compatible with saved agent selections.
// The runtime catalogue contains only project-authored built-in layouts.
export const PRESENTON_TEMPLATES = builtins.map(family=>({...family,pptx:PRESENTON_PPTX_FILES.find(entry=>entry.id===family.id)?.file}));
export const PPTX_TEMPLATE_CHOICES=PRESENTON_TEMPLATES.filter(family=>family.id==='builtin-ocean').map(family=>family.id==='builtin-ocean'?{...family,name:'Built-in',description:'Twelve editable layouts with a selectable theme color.'}:family);
export const PRESENTON_AUTO = 'presenton-auto';
export function presentonFamilyCatalogue() {
  return PPTX_TEMPLATE_CHOICES.map(t => `${t.id}: ${t.description.slice(0, 135)} (${t.layouts.length} layouts)`).join('\n');
}
const layoutWords = {
  editorial: /cover|title|intro|hero|statement|opening/i,
  comparison: /compar|versus|side.by.side|two.column|matrix/i,
  process: /process|steps|timeline|sequence|roadmap|journey|flow/i,
  statistics: /metric|statistic|chart|data|dashboard|kpi|graph/i,
  grid: /grid|cards|feature|modules|benefits|services/i,
  image: /image|photo|visual|picture/i,
  closing: /closing|thank|contact|conclusion|summary|next.steps/i,
};
export function presentonLayoutCandidates(template, kind = 'editorial', index = 0, {usedLayouts=[]} = {}) {
  if (!template || template === 'freeform') return [];
  const family = PRESENTON_TEMPLATES.find(t => t.id === template);
  if (!family) throw Error('Unknown Built-in template family.');
  const pattern = layoutWords[kind] || layoutWords.editorial;
  return family.layouts.map((layout, i) => ({layout, score:
    (pattern.test(layout.id) ? 3 : 0) + (pattern.test(layout.description) ? 2 : 0) - usedLayouts.filter(id=>id===layout.id).length*2,
    order:(i-index+family.layouts.length)%family.layouts.length}))
    .sort((a,b)=>b.score-a.score || a.order-b.order).slice(0,3).map(item=>item.layout);
}
export function presentonCandidateReference(template, kind, index = 0, options = {}) {
  const family = PRESENTON_TEMPLATES.find(t=>t.id===template);
  if (!family) return '';
  return `${family.name.replace('Built-in · ', '')} design references. Choose ONE layout ID from this family and put data-presenton-layout="chosen ID" on the section. Adapt geometry to fit the supplied content, shared palette and readable type. Decorative textures are not supplied: use native backgrounds/shapes. Use editable SVG for diagrams, and only real user data for charts/tables; never copy sample claims. Keep a real <img data-query="2 to 4 subject keywords" alt="descriptive caption"> for a photo slot; a colored rectangle or text labelled image is not a picture. Omit icons/textures rather than treating them as photos. References come from parsed PPTX slides; preserve the supplied field geometry and typography when it fits. All family layout IDs (you may choose any): ${family.layouts.map(l=>l.id).join(', ')}. Three suggested compositions:\n` +
    JSON.stringify(presentonLayoutCandidates(template,kind,index,options).map(l=>({id:l.id,description:l.description, ...(parsedPresentonTemplate(template)?{pptx:pptxLayoutReference(template,l.id,{maxObjects:5})}:{status:'PPTX not loaded'})})));
}
export function htmlTemplateReference(template, layoutId, index = 0) {
  if (!template || template === 'freeform') return '';
  if (template === PRESENTON_AUTO) return presentonFamilyCatalogue();
  const family=PRESENTON_TEMPLATES.find(item=>item.id===template);
  if (!family) throw Error('Unknown HTML template.');
  const layout=family.layouts.find(item=>item.id===layoutId)||family.layouts[index%family.layouts.length];
  return `Built-in PPTX layout reference: ${layout.id}. ${layout.description}\n${JSON.stringify(pptxLayoutReference(template,layout.id)||{status:'PPTX not loaded'})}\nReplace all sample text and image queries with the supplied content. Keep template geometry, fonts and palette where content fits; never copy sample claims.`;
}

export function htmlTemplateDeckReference(template) {
  if (!template || template === "freeform") return "";
  if (template === PRESENTON_AUTO) return `Choose the most suitable Built-in family for this topic and use its visual style consistently. Family catalogue:\n${presentonFamilyCatalogue()}\nSelected layout references by family:\n` +
    PPTX_TEMPLATE_CHOICES.map(t=>`${t.id}: `+presentonLayoutCandidates(t.id,'grid').slice(0,2).map(l=>`${l.id}: ${l.description.slice(0,150)}`).join(' | ')).join('\n');
  const collection = PRESENTON_TEMPLATES.find((t) => t.id === template);
  if (!collection) throw Error("Unknown HTML template.");
  return `Use this Built-in family's visual system consistently; adapt content and keep native editability.\n${collection.description}\n` +
    collection.layouts.map(l=>`${l.id}: ${l.description}`).join('\n');
}
