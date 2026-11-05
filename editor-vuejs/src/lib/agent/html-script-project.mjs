import {validateScriptProject} from 'shared-vuejs/api/scripting';
import {compileMotion} from './ppt-master-motion.mjs';

// Recognize a direct call to a legacy popup handler with a literal DOM target.
function popupTarget(module, binding) {
  if (!module?.legacy) return;
  const call = new RegExp(`export function ${binding.function}\\(ctx\\)\\{return \\(function\\(\\)\\{\\s*([\\w$]+)\\(\\)\\s*;?\\s*\\}\\).call\\(null\\);\\}`).exec(module.source);
  if (!call || !/^\w+$/.test(call[1])) return;
  return new RegExp(`function ${call[1]}\\(\\)\\s*\\{\\s*const (\\w+)\\s*=\\s*document\\.getElementById\\(['"]([\\w-]+)['"]\\);\\s*\\1\\.classList\\.add\\(['"]show['"]\\);`).exec(module.source)?.[2];
}

function addPopupTriggers(project, pages) {
  const hidden = new Set(project.initialHidden);
  for (const page of pages) {
    const flatten = shapes => shapes.flatMap(shape => [shape, ...flatten(shape.children || [])]);
    const shapes = flatten(page.shapes);
    for (const binding of project.bindings) {
      const module = project.modules.find(candidate => candidate.id === binding.module);
      const alias = popupTarget(module, binding);
      if (!alias) continue;
      const [id, extra] = module.refs[alias] || [];
      if (!id || extra || !hidden.has(id)) continue;
      const popup = shapes.find(shape => shape.id === id);
      const trigger = shapes.find(shape => shape.link === '@run:' + binding.id);
      if (!popup || !trigger) continue;
      page.timing ||= {m: [], i: []};
      page.timing.i ||= [];
      if (page.timing.i.some(sequence => sequence.ef.some(effect => effect.sh === id && effect.trs === trigger.id))) continue;
      const entrance = page.timing.m?.find(effect => effect.sh === id && effect.customName === 'Custom Entrance');
      if (entrance) {
        page.timing.m = page.timing.m.filter(effect => effect !== entrance);
        page.timing.i.push({ef: [{...entrance, trs: trigger.id, tr: 1, dl: 0}]});
        continue;
      }
      const target = {...popup, name: 'popup-target'};
      const control = {...trigger, name: 'popup-trigger'};
      const config = {groups: {'popup-target': {effects: [{
        effect: 'custom_entrance', duration: .5, trigger: 'on-click', trigger_shape: control.name,
        property_frames: {opacity: [{t: 0, v: 0}, {t: 1, v: 1}]},
      }]}}};
      const {timing} = compileMotion(config, [target, control]);
      page.timing.i.push(...timing.i);
    }
  }
}

export {collectScriptBindings} from './html-slide-links.mjs';
export function resolveImportedScriptProject(input,pages,slideIds){
  if(!input)return null;
  const project=validateScriptProject(input),references=new Map();
  const visit=(shapes,ancestors=new Set())=>{
    for(const shape of shapes){
      const tokens=(shape.sourceIds||[]).filter(id=>/^desq-html-script-ref-\d+$/.test(id));
      for(const token of tokens)if(!ancestors.has(token)){if(!references.has(token))references.set(token,[]);references.get(token).push(shape.id);}
      if(shape.children)visit(shape.children,new Set([...ancestors,...tokens]));
    }
  };pages.forEach(page=>visit(page.shapes));
  for(const module of project.modules){
    for(const [name,ids]of Object.entries(module.refs))module.refs[name]=[...new Set(ids.flatMap(id=>references.get(id)||(!id.startsWith('desq-html-script-ref-')?[id]:[])))];
    for(const [name,ids]of Object.entries(module.slides))module.slides[name]=ids.map(id=>id.startsWith('html-slide:')?slideIds[Number(id.slice(11))]:id).filter(Boolean);
  }
  project.initialHidden=[...new Set(project.initialHidden.flatMap(id=>references.get(id)||[id]))];
  addPopupTriggers(project, pages);
  return validateScriptProject(project);
}
