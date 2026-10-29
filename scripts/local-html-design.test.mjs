import test from 'node:test';
import assert from 'node:assert/strict';
import { localDesignBrief } from '../editor-vuejs/src/lib/agent/local-html-design.mjs';
import { contrastRatio } from '../editor-vuejs/src/lib/agent/deck-design.mjs';

test('short shared brief preserves content titles, palettes and suitable layouts', () => {
  const brief = localDesignBrief('Theme: Clean energy\nPalette: forest\nSlide 1: Solar reduces reliance on fossil fuels | comparison\nSlide 2: From sunlight to power | process', 'Solar power', 2);
  assert.equal(brief.fallback, false);
  assert.equal(brief.slides[1].layout, 'process');
  assert.match(brief.slides[0].title, /Solar/);
  assert.equal(brief.design.accent, '#287453');
});

test('brief uses bounded fallback without an extra model call and repairs palette contrast', () => {
  const brief = localDesignBrief('Colors: #FFFFFF #EEEEEE #FFFFFE\nSlide 1: A useful title | unsupported\nSlide 99: Ignore me | grid', 'Solar energy', 3);
  assert.equal(brief.fallback, true);
  assert.equal(brief.slides.length, 3);
  assert.ok(brief.slides.every(slide => slide.title.length <= 100));
  assert.ok(contrastRatio(brief.design.background, brief.design.foreground) >= 4.5);
  assert.ok(contrastRatio(brief.design.background, brief.design.accent) >= 3);
  assert.equal(brief.slides[2].layout, 'closing');
});


test('Legacy Auto stays within the one active built-in template', () => {
  const brief=localDesignBrief('Template: builtin-ocean\nPalette: ocean\nSlide 1: A strong opening | editorial','Product launch',1,{template:'presenton-auto'});
  assert.equal(brief.template,'builtin-ocean');
  assert.equal(brief.templateFallback,false);
  assert.equal(brief.design.background,'#F7FAFC');
  const manual=localDesignBrief('Template: presenton-dynamic\nSlide 1: Public policy | editorial','Policy',1,{template:'builtin-ocean'});
  assert.equal(manual.template,'builtin-ocean');
  const invalid=localDesignBrief('Template: presenton-invented\nSlide 1: Useful | editorial','Topic',1,{template:'presenton-auto'});
  assert.equal(invalid.template,'builtin-ocean');
  assert.equal(invalid.templateFallback,true);
});

import {presentonLayoutCandidates} from '../editor-vuejs/src/lib/agent/presenton-templates.mjs';
import {templateUsage,deckTemplateUsage} from '../editor-vuejs/src/lib/agent/template-report.mjs';

test('used layouts are deprioritized without leaving the chosen Presenton family',()=>{
 const first=presentonLayoutCandidates('builtin-ocean','editorial',0)[0];
 const candidates=presentonLayoutCandidates('builtin-ocean','editorial',0,{usedLayouts:[first.id,first.id,first.id]});
 assert.notEqual(candidates[0].id,first.id);
 assert.equal(candidates.length,3);
});

test('template reporting distinguishes built-in layouts, model choices and host adaptation',()=>{
 assert.equal(templateUsage({family:'curated-fill',layout:'comparison'}).family,'Built-in fixed layouts');
 const choice=templateUsage({family:'builtin-ocean',layout:'cover',modelSelectedLayout:false,hostReflowed:true});
 assert.equal(choice.family,'Built-in · Office');assert.equal(choice.layout,'cover');
 assert.equal(choice.notes.length,2);assert.match(choice.notes[0],/did not report/);
 const model=templateUsage({family:'builtin-ocean',layout:'cover',modelSelectedLayout:true,hostReflowed:false});
 assert.deepEqual(model.notes,[]);
 assert.equal(templateUsage(undefined),undefined);
 const rows=deckTemplateUsage([{title:'A',templateSelection:{family:'curated-fill',layout:'cover'}},{title:'B'}]);
 assert.equal(rows[0].slide,1);assert.equal(rows[0].layout,'Bold opening');assert.equal(rows[1].family,'Freeform / unreported');
});

test('native brief picks an Office scheme automatically from its ID or display name',()=>{
 for(const choice of ['blue-green','Blue Green']){
  const brief=localDesignBrief('OfficeColors: '+choice+'\nSlide 1: Facts | editorial','Topic',1,{template:'builtin-ocean'});
  assert.equal(brief.officeColorScheme,'blue-green');
 }
 assert.equal(localDesignBrief('OfficeColors: invented\nSlide 1: Facts | editorial','Topic',1,{template:'builtin-ocean'}).officeColorScheme,'office');
});
