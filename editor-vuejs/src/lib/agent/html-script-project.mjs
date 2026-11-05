import {validateScriptProject} from 'shared-vuejs/api/scripting';

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
  return validateScriptProject(project);
}
