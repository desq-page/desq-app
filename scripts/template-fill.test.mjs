import test from 'node:test';
import assert from 'node:assert/strict';
import { FILL_TEMPLATES,FILL_PALETTES,fillTemplateHTML } from '../editor-vuejs/src/lib/agent/template-fill.mjs';
import { validateTemplateContent } from '../editor-vuejs/src/lib/agent/local-template-fill.mjs';

test('fixed templates escape content and use host-owned geometry',()=>{
  for(const template of FILL_TEMPLATES)for(const paletteId of Object.keys(FILL_PALETTES)){
    const data={templateId:template.id,paletteId,title:'<script>not code</script>',kicker:'Category',subtitle:'A concise explanation.',items:Array.from({length:template.items},()=>({label:'Label',text:'Explanation',value:'42'})),imageQuery:'solar panels',imageAlt:'Solar panels'};
    const html=fillTemplateHTML(data);
    assert.match(html,/width:1280px;height:720px/);
    assert.ok(!html.includes('<script>'));
    assert.equal(/<img/.test(html),template.photo);
    assert.match(html,/data-fill-field="title"/);
  }
});

test('content validation reconciles slot counts and respects manual choices without model geometry',()=>{
  const value={templateId:'cover',paletteId:'ocean',title:'Useful title',items:[],html:'<script>bad</script>'};
  assert.equal(validateTemplateContent(value,{template:'photo-story',palette:'midnight'}).templateId,'photo-story');
  assert.ok(!('html' in validateTemplateContent(value))); 
  assert.equal(validateTemplateContent(value,{template:'photo-story',palette:'midnight'}).paletteId,'midnight');
  assert.equal(validateTemplateContent({...value,templateId:'process'}).items.length,4);
  assert.throws(()=>validateTemplateContent({...value,templateId:'invented'}),/known template/);
});

import { parseTemplateResponse } from '../editor-vuejs/src/lib/agent/template-fill-response.mjs';

test('narrative templates preserve extra points in the explanation, including manual layout overrides',()=>{
  const input={templateId:'comparison',paletteId:'forest',title:'Clean energy',subtitle:'Overview',imageQuery:'solar panels',items:[{label:'Adoption',value:'42%',text:'Supplied figure'},{label:'Benefits',text:'Lower emissions'}]};
  for(const template of ['photo-story','cover']){
    const result=validateTemplateContent(input,{template});
    assert.deepEqual(result.items,[]);
    assert.equal(result.subtitle,'Overview\n42% Adoption: Supplied figure\nBenefits: Lower emissions');
    assert.equal(result.imageQuery,'solar panels');
    assert.match(fillTemplateHTML(result),/Lower emissions/);
  }
  assert.equal(input.items.length,2);
});

test('zero-item templates accept omitted items but still validate supplied point content',()=>{
  const input={templateId:'photo-story',paletteId:'ocean',title:'Solar energy'};
  assert.deepEqual(validateTemplateContent(input).items,[]);
  assert.deepEqual(validateTemplateContent({...input,items:null}).items,[]);
  assert.throws(()=>validateTemplateContent({...input,items:[{text:{html:'bad'}}]}),/short string/);
  assert.throws(()=>validateTemplateContent({...input,items:new Array(1)}),/Each item/);
});

test('template parser recovers a single wrapped JSON object without misreading quoted braces',()=>{
  const original={templateId:'cover',paletteId:'forest',title:'A {clear} \"title\"',subtitle:'Actual content',items:[]};
  assert.deepEqual(parseTemplateResponse('Here is your slide:\n```json\n'+JSON.stringify(original)+'\n```\n'),original);
  assert.deepEqual(parseTemplateResponse('```json\n'+JSON.stringify(original)+'\n```'),original);
  assert.throws(()=>parseTemplateResponse(JSON.stringify(original)+'\n'+JSON.stringify(original)),/multiple/);
});

test('plain Markdown content fields retain multiline text and zero-based item slots',()=>{
  const text='**templateId:** comparison\n**paletteId:** forest\n**title:** A clear comparison\nitems.0.label: First\nitems.0.text: |\n  First explanation\n  with detail\nitems.1.label: Second\nitems.1.text: Second explanation';
  const value=validateTemplateContent(parseTemplateResponse(text));
  assert.equal(value.title,'A clear comparison');
  assert.equal(value.items[0].text,'First explanation\nwith detail');
  assert.equal(value.items[1].label,'Second');
});

test('conversational replies, HTML, truncated JSON and sparse items cannot become slides',()=>{
  assert.throws(()=>parseTemplateResponse('I can help you create a slide.'),/usable template fields/);
  assert.throws(()=>parseTemplateResponse('<section><h1>Not data</h1></section>'),/HTML instead/);
  assert.throws(()=>parseTemplateResponse('{"title":"unfinished'),/usable template fields/);
  const sparse=parseTemplateResponse('templateId: comparison\npaletteId: ocean\ntitle: Missing first item\nitems.1.label: Second');
  assert.throws(()=>validateTemplateContent(sparse),/Each item/);
});

 test('closing accepts missing or extra points without losing supplied content or inventing a CTA',()=>{
  const base={templateId:'closing',paletteId:'forest',title:'下一步',subtitle:'继续采用清洁能源。'};
  for(const items of [undefined,[],null]){
    const warnings=[];
    const data=validateTemplateContent({...base,items},{onWarning:w=>warnings.push(w)});
    assert.deepEqual(data.items,[{label:'',text:'',value:''}]);
    assert.equal(data.subtitle,base.subtitle);assert.equal(warnings.length,1);
  }
  const points=[{label:'行动',text:'安装太阳能电池板。'},{label:'成本',value:'42',text:'用户提供的数字。'},{label:'影响',text:'减少排放。'}];
  const data=validateTemplateContent({...base,items:points});
  assert.equal(data.items.length,1);
  assert.equal(data.items[0].text,'安装太阳能电池板。\n42 成本: 用户提供的数字。\n影响: 减少排放。');
  assert.equal(points.length,3);
  assert.match(fillTemplateHTML(data),/减少排放/);
});

test('all fixed layouts reconcile fewer and extra points while preserving values and text',()=>{
  for(const layout of FILL_TEMPLATES){
    const items=Array.from({length:layout.items+2},(_,i)=>({label:'Point '+i,text:'Detail '+i,value:'Value '+i}));
    const data=validateTemplateContent({templateId:layout.id,paletteId:'ocean',title:'Topic',items});
    assert.equal(data.items.length,layout.items);
    const serialized=JSON.stringify(data);
    for(let i=0;i<items.length;i++)for(const key of ['label','text','value'])assert.ok(serialized.includes(items[i][key]));
  }
});
