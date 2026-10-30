import {buildPptxContentSchema,applyPptxContent} from '../editor-vuejs/src/lib/agent/pptx-content-schema.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ZipReader,Uint8ArrayReader,TextWriter} from '@zip.js/zip.js';
import {XMLValidator} from 'fast-xml-parser';
import {PRESENTON_PPTX_FILES,loadPresentonTemplate,preparePresentonContext} from '../editor-vuejs/src/lib/agent/presenton-pptx.mjs';
import {builtinTemplateFamilies} from './lib/builtin-template-scene.mjs';
import {compactModelContext} from '../editor-vuejs/src/lib/agent/agent-plan.mjs';
import {buildProviderPlan} from '../editor-vuejs/src/lib/agent/provider-request.mjs';

test('all native PPTX families contain 12 ordered editable layouts with original slot identities and native charts/tables',async()=>{
 let count=0,charts=0,tables=0;
 for(const entry of PRESENTON_PPTX_FILES){
  const bytes=fs.readFileSync('editor-vuejs/public/'+entry.file);
  assert.equal(bytes.length,entry.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
  const reader=new ZipReader(new Uint8ArrayReader(new Uint8Array(bytes)),{useWebWorkers:false});
  try{
   const parts=await reader.getEntries(),read=async name=>parts.find(p=>p.filename===name).getData(new TextWriter(),{useWebWorkers:false});
   const metadata=JSON.parse(await read('ppt/presenton.json'));
   const original=builtinTemplateFamilies().find(f=>f.id===entry.id);
   assert.equal(metadata.family,entry.id);assert.equal(metadata.layouts.length,original.layouts.length);
   for(const [i,layout]of metadata.layouts.entries()){
    assert.equal(layout.id,original.layouts[i].id);
    const built=buildPptxContentSchema(layout),content={};
    assert.equal(new Set(built.bindings.map(b=>JSON.stringify(b.path))).size,built.bindings.length,`${entry.id}/${layout.id}: colliding schema paths`);
    for(const binding of built.bindings){
     let node=content;for(let j=0;j<binding.path.length-1;j++){const part=binding.path[j];node[part]??=typeof binding.path[j+1]==='number'?[]:{};node=node[part];}
     node[binding.path.at(-1)]=binding.kind==='image'?{query:'Source photo',alt:'Evidence'}:binding.kind==='table'?{rows:[['Evidence']]}:binding.kind==='chart'?{categories:['A'],series:[{name:'Source',values:[1]}]}:binding.kind==='text-list'?['Facts '+binding.id]:'Facts '+binding.id;
    }
    const filled=applyPptxContent(layout,content);
    assert.deepEqual(filled.map(f=>f.id),layout.slots.filter(s=>s.placeholderId!==undefined).map(s=>String(s.placeholderId)));

    const xml=await read(`ppt/slides/slide${i+1}.xml`);assert.equal(XMLValidator.validate(xml),true);
    assert.match(xml,/<p:sp>/);assert.match(xml,/<a:t>/);assert.match(xml,/<p:ph\b/);
    assert.equal(layout.slots.find(slot=>slot.placeholderType==='title')?.placeholderId,'0');
    const layoutXML=await read(layout.layoutPart);assert.equal(XMLValidator.validate(layoutXML),true);
    assert.match(await read(`ppt/slides/_rels/slide${i+1}.xml.rels`),new RegExp(layout.layoutPart));assert.ok(xml.includes(`name="${layout.id}"`));
    for(const slot of layout.slots.filter(s=>['text','text-list','image'].includes(s.kind)))assert.ok(xml.includes(`name="${slot.name}"`),`${entry.id} lost ${slot.name}`);
   }
   for(const part of parts.filter(p=>/^ppt\/(?:.*\/)?charts\/chart\d+\.xml$/.test(p.filename))){assert.equal(XMLValidator.validate(await read(part.filename)),true);charts++;}
   for(const part of parts.filter(p=>/^ppt\/slides\/slide\d+\.xml$/.test(p.filename))){const xml=await read(part.filename);tables+=(xml.match(/<a:tbl>/g)||[]).length;}
   count+=metadata.layouts.length;
  }finally{await reader.close();}
 }
 assert.equal(count,12);assert.equal(PRESENTON_PPTX_FILES.length,1);
});


test('failed or cancelled PPTX loads never populate cache',async()=>{
 await assert.rejects(loadPresentonTemplate('builtin-ocean',{fetchImpl:async()=>new Response('bad')}),/incomplete/);
 const controller=new AbortController();controller.abort();
 await assert.rejects(loadPresentonTemplate('builtin-ocean',{signal:controller.signal}),{name:'AbortError'});
 assert.equal(await preparePresentonContext('freeform'),undefined);
});

test('cloud transport includes parsed PPTX design separately from factual sources',()=>{
 const pptxTemplateContext={format:'pptx',role:'design-reference-only',families:[{id:'builtin-ocean',examples:[{objects:[{name:'field:title',box:[40,60,500,90],fontSize:48}]}]}]};
 const context=compactModelContext({document:{},page:{shapes:[]},slideAuthoring:'html',htmlTemplate:'builtin-ocean',pptxTemplateContext});
 assert.deepEqual(context.pptxTemplateContext,pptxTemplateContext);
 for(const provider of ['chatgpt','gemini']){
  const request=buildProviderPlan(provider,{model:'test',command:'Create a deck',context}).request;
  assert.match(JSON.stringify(request),/PPTX TEMPLATE WORKFLOW/);assert.match(JSON.stringify(request),/field:title/);
 }
});


test('native placeholder export preserves explicit index zero and title indices', async()=>{
 const {exportNativeHTMLText}=await import('./html-native-export-fixture.mjs');
 const shapes=['title','body'].map((type,index)=>({id:'ph-'+index,name:'Placeholder',type:'text',$_otag:'sp',ph:{$_type:type,$_idx:index===0?'0':'12'},txBody:{bodyPr:{},p:[{r:[{t:'Generated content',rPr:{$_sz:2400}}]}]}}));
 const result=exportNativeHTMLText(shapes);
 assert.equal(result[0].nvSpPr.nvPr.ph.$_idx,'0');
 assert.equal(result[0].nvSpPr.nvPr.ph.$_type,'title');
 assert.equal(result[1].nvSpPr.nvPr.ph.$_idx,'12');
 assert.ok(!result[0].spPr.xfrm,'Inheriting placeholders must not acquire local geometry.');
});

test('Presenton generation cannot silently fall back to redrawing HTML',async()=>{
 const {preflightDeckPlan}=await import('../editor-vuejs/src/lib/agent/deck-preflight.mjs');
 assert.throws(()=>preflightDeckPlan({calls:[{name:'desq_create_deck',arguments:{slides:[{layout:'html',html:'<section>redrawn</section>'}]}}]},
   {pptxTemplateContext:{role:'native-template-base'},slideTask:{mode:'create'}}),/native PPTX template as the base/);
});

test('native generation honours an explicitly selected family',async()=>{
 const {preflightDeckPlan}=await import('../editor-vuejs/src/lib/agent/deck-preflight.mjs');
 assert.throws(()=>preflightDeckPlan({calls:[{name:'desq_create_deck',arguments:{slides:[{layout:'pptx',templateSelection:{family:'presenton-dynamic',layout:'anything'},templateFields:[{id:'2',text:'Supplied content'}]}]}}]},
   {htmlTemplate:'builtin-ocean',pptxTemplateContext:{role:'native-template-base'},slideTask:{mode:'create'}}),/selected Presenton family/);
});

test('native page import resolves chart relationships before mapping shapes',async()=>{
 const {transform}=await import('esbuild');
 const source=fs.readFileSync('shared-vuejs/src/edlib/pptx/import/import-txml.ts','utf8');
 const helper=source.slice(source.indexOf('function resolvePartTarget('),source.indexOf('\nasync function attachShapeMediaRefs'));
 const parser=source.slice(source.indexOf('export async function parseTemplatePage(')).replace('export async function','async function');
 const code=(await transform(helper+'\n'+parser,{loader:'ts',format:'cjs'})).code;
 const shape={graphic:{graphicData:{'c:chart':{'$_r:id':'chartRel'}}}};
 const root={cSld:{spTree:{sp:[shape]}}};
 const bytes=new Uint8Array([1]);
 const uzip={'ppt/slides/slide.xml':bytes,'ppt/slides/_rels/slide.xml.rels':bytes,'ppt/charts/chart_unique.xml':bytes};
 const rels={Relationships:{Relationship:[{$_Id:'chartRel',$_Type:'test/chart',$_Target:'/ppt/charts/chart_unique.xml'}]}};
 let mapped=false;
 const parse=new Function('loadUzipData','nodeAsArray','addIdToParaAndRuns','mapShapeInfo','getShapeNodeIndexes','toEngineElementType','attachShapeMediaRefs','putSlideToDexie',code+';return parseTemplatePage;')(
  path=>path.endsWith('.rels')?rels:{sld:root},v=>Array.isArray(v)?v:[v],()=>{},(_id,node,_unused,zip)=>{
   assert.equal(node.graphic.graphicData['c:chart'].$_target,'chart_unique.xml');
   assert.equal(zip['ppt/charts/chart_unique.xml'],bytes);mapped=true;return {};
  },()=>[0],()=> 'chart',async()=>{},async()=>{});
 await parse('ppt/slides/slide.xml',uzip,'file');
 assert.equal(mapped,true);
});


test('a named built-in PPTX template cannot be replaced by another family',async()=>{
 const {preflightDeckPlan}=await import('../editor-vuejs/src/lib/agent/deck-preflight.mjs');
 assert.throws(()=>preflightDeckPlan({calls:[{name:'desq_create_deck',arguments:{slides:[{layout:'pptx',templateSelection:{family:'presenton-dynamic',layout:'anything'},templateFields:[{id:'0',text:'Facts'}]}]}}]},
  {htmlTemplate:'builtin-ocean',pptxTemplateContext:{role:'native-template-base'},slideTask:{mode:'create'}}),/selected Presenton family/);
});

test('native text fitting accepts advisory limit overruns and preserves actual overflow',async()=>{
 const {fitNativeTemplateText}=await import('../editor-vuejs/src/lib/agent/native-template-text.mjs');
 const full='A longer title that should fit its actual placeholder';
 assert.deepEqual(fitNativeTemplateText(full,{}, {maxLength:27,measureFits:()=>true}),{text:full});
 const fitted=fitNativeTemplateText(full,{}, {maxLength:27,measureFits:text=>[...text].length<=27});
 assert.equal(fitted.original,full);assert.equal(fitted.text,full);
 const unicode=fitNativeTemplateText('🌎'.repeat(30),{},{measureFits:text=>[...text].length<=10});
 assert.equal([...unicode.text].length,30);assert.ok(!unicode.text.includes('\uFFFD'));
});

test('native model responses accept prose, fences, stop markers and identical echoes',async()=>{
 const {parseNativeTemplateResponse:parse}=await import('../editor-vuejs/src/lib/agent/native-template-plan.mjs');
 const value={layoutId:'cover',fields:[{id:'0',text:'Quoted "title", braces {inside}, slash \\ and emoji 🌎'},{id:'1',rows:[['A','B']],series:[{name:'Data',values:[1,2]}]}]};
 const json=JSON.stringify(value);
 for(const reply of [json,json+' Done.', 'Here is your slide:\n```json\n'+json+'\n```\n<end_of_turn>',json+'\n'+json])assert.deepEqual(parse(reply),value);
 assert.throws(()=>parse(json+'\n'+JSON.stringify({...value,layoutId:'comparison'})),/conflicting/);
 assert.throws(()=>parse(json.slice(0,-5)),/usable native template fields/);
 assert.throws(()=>parse('console.log("no JSON")'),/usable native template fields/);
 assert.throws(()=>parse('{"layoutId":"cover","fields":{}}'),/usable native template fields/);
});

test('native templates scale uniformly to presentation size and centre different aspect ratios',async()=>{
 const {nativeTemplateTransform}=await import('../editor-vuejs/src/lib/agent/native-template-size.mjs');
 assert.deepEqual(nativeTemplateTransform({width:1280,height:720},{width:960,height:540}),{scale:.75,x:0,y:0});
 assert.deepEqual(nativeTemplateTransform({width:1280,height:720},{width:1024,height:768}),{scale:.8,x:0,y:96*9525});
 assert.throws(()=>nativeTemplateTransform({width:1280,height:720},{width:0,height:720}),/dimensions/);
});

test('extra native image requests become described placeholders without failing the slide',async()=>{
 const {limitNativeTemplateImages}=await import('../editor-vuejs/src/lib/agent/native-template-plan.mjs');
 const fields=[{id:'0',text:'Source facts'},...Array.from({length:3},(_,i)=>({id:String(1001+i),query:'Source photo '+i,alt:'Description '+i}))];
 const limited=limitNativeTemplateImages(fields,2);
 assert.equal(limited.filter(f=>f.query).length,2);
 assert.deepEqual(limited[3],{id:'1003',alt:'Description 2'});
 assert.equal(fields[3].query,'Source photo 2');
 assert.equal(limitNativeTemplateImages(fields,0).filter(f=>f.query).length,0);
 assert.equal(limitNativeTemplateImages([{id:'1001',query:'Photo keywords'}],0)[0].alt,'Photo keywords');
});

test('native placeholder names resolve to exact IDs without guessing repeated fields',async()=>{
 const {normalizeNativeTemplateFields:normalize}=await import('../editor-vuejs/src/lib/agent/native-template-plan.mjs');
 const layout={id:'timeline',slots:[{placeholderId:'0',field:'title',name:'field:root:title'},{placeholderId:'2',field:'top_date_marker',name:'field:component2.0:top_date_marker'},{placeholderId:'3',field:'step_heading',name:'field:step1:step_heading'},{placeholderId:'4',field:'step_heading',name:'field:step2:step_heading'}]};
 const fields=[{id:'top_date_marker',text:'2026'},{id:0,text:'Title'},{id:'field:step2:step_heading',text:'Step 2'}];
 assert.deepEqual(normalize(fields,layout).map(f=>f.id),['2','0','4']);
 assert.equal(fields[0].id,'top_date_marker');
 assert.throws(()=>normalize([{id:'step_heading',text:'Unclear'}],layout),/ambiguous.*3, 4/);
 assert.throws(()=>normalize([{id:'invented',text:'Unclear'}],layout),/Unknown placeholder/);
});


test('native overflow tries one concise rewrite and otherwise inserts all original content',async()=>{
 const {rephraseNativeTemplateText}=await import('../editor-vuejs/src/lib/agent/native-template-text.mjs');
 const text='The project served 42 customers during the reporting period.';
 const options={measureFits:value=>value.length<=25};let calls=0;
 const result=await rephraseNativeTemplateText(text,{}, {...options,rewriteText:async()=>{calls++;return 'Served 42 customers.';}});
 assert.equal(calls,1);assert.equal(result.text,'Served 42 customers.');assert.equal(result.original,text);assert.equal(result.rephrased,true);
 for(const rewriteText of [async()=>text,async()=>text+' More.',async()=>{throw Error('Offline');},async()=> 'Served customers.',async()=> '42 customers…']){
  const fallback=await rephraseNativeTemplateText(text,{}, {...options,rewriteText});assert.equal(fallback.text,text);assert.ok(!fallback.rephrased);
 }
 let unnecessary=false;assert.equal((await rephraseNativeTemplateText('Fits',{}, {...options,rewriteText:()=>{unnecessary=true;}})).text,'Fits');assert.equal(unnecessary,false);
 const controller=new AbortController();controller.abort();await assert.rejects(rephraseNativeTemplateText(text,{}, {...options,rewriteText:async()=>'',signal:controller.signal}),{name:'AbortError'});
});

test('cloud providers build a text-only concise rewrite request',async()=>{
 const {buildProviderRewrite}=await import('../editor-vuejs/src/lib/agent/provider-request.mjs');
 for(const provider of ['chatgpt','gemini']){
  const request=buildProviderRewrite(provider,{model:'test',text:'Original source facts',maxLength:20,box:{width:400,height:100}}).request;
  assert.match(JSON.stringify(request),/Preserve meaning/);assert.match(JSON.stringify(request),/Original source facts/);
 }
});


test('cloud template generation selects layouts then fills the exact parsed PPTX content schema',async t=>{
 const {cachePresentonTemplate,parsedPresentonTemplate}=await import('../editor-vuejs/src/lib/agent/presenton-pptx-cache.mjs');
 const {createChatGPTAgent}=await import('../editor-vuejs/src/lib/agent/chatgpt-agent.mjs');
 const {createGeminiAgent}=await import('../editor-vuejs/src/lib/agent/gemini-agent.mjs');
 const {createEditorTools}=await import('../editor-vuejs/src/lib/agent/editor-tools.mjs');
 const previous=parsedPresentonTemplate('builtin-ocean');t.after(()=>cachePresentonTemplate('builtin-ocean',previous));
 const layout={id:'cover',description:'Opening',slots:[{placeholderId:'0',field:'title',kind:'text'},{placeholderId:'1',field:'body',kind:'text'}],objects:[]};
 cachePresentonTemplate('builtin-ocean',{name:'Built-in Ocean',family:'builtin-ocean',layouts:[layout]});
 const context={document:{fileId:'f'},page:{pageId:'p'},htmlTemplate:'builtin-ocean',slideTask:{mode:'create',count:1},sourceContext:{evidence:'Source facts'},pptxTemplateContext:{role:'native-template-base',families:[{id:'builtin-ocean',name:'Ocean',layouts:[{id:'cover',description:'Opening'}]}]}};
 for(const create of [createChatGPTAgent,createGeminiAgent]){
  const calls=[];let fills=0;
  const agent=create('test',async(path,{body})=>{calls.push(path);
   if(path==='template-outline'){assert.equal(body.context.officeColorSchemes.length,24);return {text:JSON.stringify({family:'builtin-ocean',colorScheme:'blue',slides:[{title:'Source title',layoutId:'cover',contentBrief:'Source facts'}]})};}
   assert.equal(path,'template-content');assert.equal(body.schema.properties.title.type,'string');assert.deepEqual(body.sourceContext,{evidence:'Source facts'});
   fills++;return {text:JSON.stringify(fills===1?{invented:'Bad'}:{title:'Source title',body:'Source facts'})};
  });
  const plan=await agent.plan('Create one slide',createEditorTools({}).listTools(),context);
  assert.deepEqual(calls,['template-outline','template-content','template-content']);
  assert.equal(plan.calls[0].arguments.colorScheme,'blue');assert.equal(plan.metrics.repairCalls,1);assert.equal(plan.metrics.workflow,'pptx-content-schema');
  assert.deepEqual(plan.calls[0].arguments.slides[0].templateFields,[{id:'0',text:'Source title'},{id:'1',text:'Source facts'}]);agent.dispose();
 }
});

test('PPTX schemas reject unknown properties and repeated-item overflow without clipping text',()=>{
 const layout={id:'test',slots:[{placeholderId:'0',field:'title',kind:'text',maxLength:5},{placeholderId:'1',field:'items.0.label',kind:'text'},{placeholderId:'2',field:'items.1.label',kind:'text'}]};
 const schema=buildPptxContentSchema(layout).schema;assert.equal(schema.properties.items.maxItems,2);
 assert.equal(applyPptxContent(layout,{title:'A complete longer title'})[0].text,'A complete longer title');
 assert.throws(()=>applyPptxContent(layout,{unexpected:'text'}),/Unknown content field/);
 assert.throws(()=>applyPptxContent(layout,{items:[{label:'One'},{label:'Two'},{label:'Three'}]}),/capacity/);
});

test('one native template supports the Office color collection with theme-linked artwork',async()=>{
 const {PPTX_TEMPLATE_CHOICES}=await import('../editor-vuejs/src/lib/agent/presenton-templates.mjs');
 const {OFFICE_COLOR_SCHEMES}=await import('../editor-vuejs/src/lib/agent/office-color-schemes.mjs');
 const {applyBuiltinTemplateTheme}=await import('../editor-vuejs/src/lib/agent/builtin-template-theme.mjs');
 assert.equal(PPTX_TEMPLATE_CHOICES.length,1);assert.equal(OFFICE_COLOR_SCHEMES.length,24);
 assert.deepEqual(fs.readdirSync('editor-vuejs/public/templates/builtin').filter(n=>/^builtin.*\.pptx$/.test(n)),['builtin.pptx']);
 for(const theme of OFFICE_COLOR_SCHEMES){
  assert.equal(Object.keys(theme.colors).length,12);assert.ok(Object.values(theme.colors).every(c=>/^[A-F0-9]{6}$/.test(c)));
  const path='ppt/slideLayouts/layout.xml',themePath='ppt/theme/theme.xml';
  const parts={[path]:new TextEncoder().encode('<p:sldLayout><p:sp><a:srgbClr val="087F8C"/><a:srgbClr val="FFFFFF"/><p:ph idx="0"/></p:sp></p:sldLayout>'),[themePath]:new TextEncoder().encode('<a:theme name="Old"><a:clrScheme name="Old"><a:accent1><a:srgbClr val="156082"/></a:accent1></a:clrScheme></a:theme>')};
  applyBuiltinTemplateTheme(parts,theme.id);
  const result=new TextDecoder().decode(parts[path]),xml=new TextDecoder().decode(parts[themePath]);
  assert.ok(result.includes('schemeClr val="accent1"'));assert.ok(!result.includes('srgbClr'));assert.ok(result.includes('idx="0"'));
  assert.ok(xml.includes('val="'+theme.colors.accent1+'"'));assert.ok(xml.includes('name="'+theme.name+'"'));
 }
 const nested='ppt/slideMasters/theme/theme2.xml',nestedParts={[nested]:new TextEncoder().encode('<a:theme><a:clrScheme><a:accent1><a:srgbClr val="156082"/></a:accent1></a:clrScheme></a:theme>')};
 applyBuiltinTemplateTheme(nestedParts,'blue');assert.ok(new TextDecoder().decode(nestedParts[nested]).includes('0F6FC6'));
 assert.throws(()=>applyBuiltinTemplateTheme({},'unknown'),/Unknown Office/);
});

test('generation packs surplus repeated text into existing placeholders without losing facts',()=>{
 const layout={id:'test',slots:[{placeholderId:'1',field:'items.0.label',kind:'text'},{placeholderId:'2',field:'items.1.label',kind:'text'}]};
 const content={items:[{label:'One'},{label:'Two'},{label:'Three'},{label:'Four'}]};
 assert.deepEqual(applyPptxContent(layout,content,{packOverflowText:true}),[{id:'1',text:'One'},{id:'2',text:'Two\n\nThree\n\nFour'}]);
 assert.equal(content.items.length,4);
 assert.throws(()=>applyPptxContent(layout,{items:{label:'One'}},{packOverflowText:true}),/must be an array/);
 assert.throws(()=>applyPptxContent(layout,{items:[{label:'One'},{label:'Two'},{invented:'Three'}]},{packOverflowText:true}),/Unknown content field/);
 const table={id:'table',slots:[{placeholderId:'1',field:'table',kind:'table',maxColumns:2}]};
 assert.throws(()=>applyPptxContent(table,{table:{rows:[['One','Two','Three']]}},{packOverflowText:true}),/maximum 2, received 3/);
});

test('retired Presenton families cannot be loaded or advertised',async()=>{
 assert.deepEqual(PRESENTON_PPTX_FILES.map(entry=>entry.id),['builtin-ocean']);
 assert.equal(fs.existsSync('editor-vuejs/public/templates/presenton'),false);
 await assert.rejects(loadPresentonTemplate('presenton-modern'),/Unknown/);
});
