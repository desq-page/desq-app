import test from 'node:test';
import assert from 'node:assert/strict';
import {copyShapeAnimations,pasteShapeAnimations,remapShapeIds,applyShapeIds,shapeIds} from '../shared-vuejs/src/edlib/main/clipboard-animations.mjs';

test('copies all selected effects in timeline order and remaps grouped shapes, triggers and animation groups', () => {
 const shapes=[{id:'group',children:[{id:'child',parentid:'group'}]},{id:'button'}];
 const source={m:[
  {sh:'child',grp:0,p:1,paraGroup:'paragraphs',tr:1,du:2,dl:.2,rp:3,rv:1,bh:[{ty:'motion',cm:'M0 0 L1 1'}]},
  {sh:'other'},
  {sh:'group',grp:2,tr:0,du:.4},
  {sh:'child',p:2,paraGroup:'paragraphs',bh:[{ty:'set',v:1}]},
 ],i:[{custom:'kept',ef:[{sh:'group',trs:'button',smid:'child',smartArtGroup:'smart',smartArtBase:{sh:'group'},bh:[{ty:'alpha'}]},{sh:'other',trs:'button'}]}]};
 const copied=copyShapeAnimations(source,shapes);
 assert.deepEqual(copied.m.map(e=>e.sh),['child','group','child']);
 assert.equal(copied.i[0].ef.length,1);
 const cloned=structuredClone(shapes),map=new Map();let seq=0;
 const gen=()=>`new${++seq}`;
 cloned.forEach(s=>remapShapeIds(s,map,gen));cloned.forEach(s=>applyShapeIds(s,map));
 assert.equal(cloned[0].children[0].parentid,cloned[0].id);
 assert.equal(shapes[0].children[0].id,'child');
 const previous={m:[{sh:'existing'}],i:[],extra:'preserved'};
 const pasted=pasteShapeAnimations(previous,[{effs:copied}],map,shapeIds(cloned),gen);
 assert.equal(pasted.extra,'preserved');assert.equal(previous.m.length,1);
 assert.deepEqual(pasted.m.slice(1).map(e=>e.sh),[map.get('child'),map.get('group'),map.get('child')]);
 assert.equal(pasted.m[1].du,2);assert.equal(pasted.m[1].dl,.2);assert.equal(pasted.m[1].rp,3);assert.equal(pasted.m[1].rv,1);
 assert.equal(pasted.m[1].paraGroup,pasted.m[3].paraGroup);assert.notEqual(pasted.m[1].paraGroup,'paragraphs');
 const interactive=pasted.i[0].ef[0];
 assert.equal(interactive.trs,map.get('button'));assert.equal(interactive.smid,map.get('child'));
 assert.equal(interactive.smartArtBase.sh,map.get('group'));assert.notEqual(interactive.smartArtGroup,'smart');
 pasted.m[1].bh[0].cm='changed';assert.equal(source.m[0].bh[0].cm,'M0 0 L1 1');
 const again=pasteShapeAnimations(previous,[{effs:copied}],map,shapeIds(cloned),gen);
 assert.notEqual(again.m[1].paraGroup,pasted.m[1].paraGroup);
});

test('preserves existing and variable triggers; missing cross-slide triggers become main effects',()=>{
 const effs={m:[],i:[{ef:[{sh:'shape',trs:'external'}]},{ef:[{sh:'shape',trs:'var:score'}]}]};
 const map=new Map([['shape','new']]);
 let result=pasteShapeAnimations({},[{effs}],map,new Set(['new','external']),()=> 'id');
 assert.equal(result.i[0].ef[0].trs,'external');assert.equal(result.i[1].ef[0].trs,'var:score');
 result=pasteShapeAnimations({},[{effs}],map,new Set(['new']),()=> 'id');
 assert.equal(result.m[0].sh,'new');assert.equal(result.m[0].trs,undefined);
 assert.equal(result.i[0].ef[0].trs,'var:score');
 assert.deepEqual(pasteShapeAnimations({m:[]},[{effs:[]}],map,new Set(),()=> 'id'),{m:[],i:[]});
});

test('actual copy/paste and repeated duplicate keep source shapes intact and save remapped effects',async()=>{
 const ts=(await import('typescript')).default;
 const {readFile}=await import('node:fs/promises');
 const source=await readFile('shared-vuejs/src/edlib/main/clipboard.ts','utf8');
 const ast=ts.createSourceFile('clipboard.ts',source,ts.ScriptTarget.Latest,true);
 const functions=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&['copyShape','processPasteShape'].includes(n.name?.text)).map(n=>n.getText(ast).replace(/^export /,'')).join('\n');
 let seq=0,saves=0;
 const original={id:'old',name:'Box',x:0,y:0,children:[{id:'child',parentid:'old'}]};
 const slide={shapes:[original],timing:{m:[{sh:'old',du:1,bh:[{ty:'alpha'}]},{sh:'child',du:2}],i:[]}};
 const deps={ue:{},vSelect:{selShps:['old'],selGrpShps:[]},vSlides:{slideId:'slide'},vStaticSlides:{fileInfo:{id:'deck'},slideInfo:slide},
  vShapes:{getShapeDeep:()=>original,getShapeIndex:()=>0,addShape:s=>slide.shapes.push(s),updateAnim:t=>slide.timing=t},
  writeCopyToClipboard:async()=>{},showMessage:()=>{},genId:()=>`id${++seq}`,sleep:async()=>{},deselectAll:()=>{},addHandle:()=>{},saveDexie:async()=>{saves++;},
  copyShapeAnimations,shapeIds,remapShapeIds,applyShapeIds,pasteShapeAnimations,
 };
 const api=new Function(...Object.keys(deps),ts.transpile(functions)+';return {copyShape,processPasteShape};')(...Object.values(deps));
 const clipboard=await api.copyShape(undefined,true,true);
 const first=await api.processPasteShape(clipboard);
 assert.equal(saves,1);assert.equal(original.x,0);assert.equal(original.children[0].id,'child');
 assert.equal(slide.timing.m[2].sh,first[0]);assert.equal(slide.timing.m[3].sh,slide.shapes[1].children[0].id);
 assert.equal(slide.shapes[1].children[0].parentid,first[0]);
 const second=await api.processPasteShape(clipboard);
 assert.notEqual(first[0],second[0]);assert.equal(slide.timing.m[4].sh,second[0]);
 assert.equal(slide.shapes[1].x,10);assert.equal(slide.shapes[2].x,20);assert.equal(original.x,0);
 slide.timing.m[2].bh[0].ty='changed';assert.equal(slide.timing.m[0].bh[0].ty,'alpha');
});
