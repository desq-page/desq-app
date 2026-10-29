import {buildPptxContentSchema} from './pptx-content-schema.mjs';
import manifest from './templates/manifest.json' with {type:'json'};
const loaded = new Map();
export const PRESENTON_PPTX_FILES = manifest.families;
export function parsedPresentonTemplate(family) { return loaded.get(family); }

export function cachePresentonTemplate(family,template) { loaded.set(family,template); }

export function pptxLayoutReference(family,layoutId,{maxObjects=12}={}) {
  const template=loaded.get(family),layout=template?.layouts.find(item=>item.id===layoutId);
  if(!layout)return undefined;
  const slots=new Map(layout.slots.map(slot=>[slot.name,slot]));
  // Prefer editable fields; omit sample copy and chart values so references cannot become facts.
  const relevant=[...layout.objects.filter(object=>slots.has(object.name)),...layout.objects.filter(object=>!slots.has(object.name))];
  return {id:layout.id,page:layout.page,contentSchema:layout.contentSchema||buildPptxContentSchema(layout).schema,fields:layout.slots.filter(slot=>slot.placeholderId).map(slot=>({id:slot.placeholderId,name:slot.field,kind:slot.kind,maxLength:slot.maxLength,maxRows:slot.maxRows,maxColumns:slot.maxColumns,chartType:slot.chartType})),canvas:[template.width,template.height],
    objects:relevant.slice(0,maxObjects).map(object=>({name:object.name?.slice(0,100),kind:slots.get(object.name)?.kind||object.kind,
      box:[object.x,object.y,object.width,object.height].map(v=>Math.round(v*10)/10),
      ...(object.fontSize?{fontSize:Math.round(object.fontSize*10)/10,fontFamily:object.fontFamily,...(object.lineHeight?{lineHeight:object.lineHeight}:{}),...(object.letterSpacing?{letterSpacing:object.letterSpacing}:{})}:{}),
      colors:object.colors.slice(0,3),...(slots.get(object.name)?.maxLength?{maxLength:slots.get(object.name).maxLength}:{})})),
    omittedObjects:Math.max(0,layout.objects.length-maxObjects),
    limitations:{missingAssets:layout.warnings.filter(w=>w.includes('asset not bundled')).length,
      adaptedElements:layout.warnings.filter(w=>!w.includes('asset not bundled')).length}};
}

