import {applyBuiltinTemplateTheme} from '../editor-vuejs/src/lib/agent/builtin-template-theme.mjs';
// Run with the bundled artifact-tool runtime to regenerate the built-in family.
// No upstream code executes and no external photos/fonts/textures are downloaded.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {ZipReader,Uint8ArrayReader,Uint8ArrayWriter,ZipWriter,TextReader} from '@zip.js/zip.js';
import {masterizePresentonParts} from '../editor-vuejs/src/lib/agent/pptx-template-package.mjs';
import {builtinTemplateFamilies} from './lib/builtin-template-scene.mjs';
const runtimeModules=process.env.ARTIFACT_NODE_MODULES;
if(!runtimeModules)throw Error('Set ARTIFACT_NODE_MODULES to the bundled workspace Node packages.');
const require=createRequire(path.join(runtimeModules,'package.json'));
const {Presentation,PresentationFile}=await import(pathToFileURL(require.resolve('@oai/artifact-tool')));
const output='editor-vuejs/public/templates/builtin';
const metadataOutput='editor-vuejs/src/lib/agent/templates';
await fs.mkdir(metadataOutput,{recursive:true});
await fs.mkdir(output,{recursive:true});
await fs.mkdir('.tmp/builtin-templates',{recursive:true});
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[c]);
const color=(c,fallback='none')=> /^#[0-9a-f]{6}$/i.test(c||'')?c:fallback;
const paint=fill=>fill?.color ? `${color(fill.color)}${fill.opacity!==undefined ? '/'+Math.round(Math.max(0,Math.min(1,fill.opacity))*100) : ''}` : 'none';
const font=(f={})=>({fontSize:Math.max(1,Number(f.size)||20),typeface:f.family||'Arial',color:color(f.color,'#172923'),bold:!!f.bold,italic:!!f.italic});
function addText(slide,obj) {
 const shape=slide.shapes.add({name:obj.name,geometry:'textbox',position:{left:obj.x,top:obj.y,width:obj.width,height:obj.height,rotation:obj.rotation},fill:'none',line:{fill:'none',width:0}});
 const runs=list=>(list||[]).map(r=>({run:r.text||'',style:{fontSize:`${r.font?.size||obj.font?.size||20}px`,typeface:r.font?.family||obj.font?.family||'Arial',color:color(r.font?.color||obj.font?.color,'#172923'),bold:!!(r.font?.bold??obj.font?.bold),italic:!!r.font?.italic}}));
 shape.text=obj.paragraphs?obj.paragraphs.map(p=>({runs:runs(p.runs),...(p.bullet?{bulletCharacter:p.bullet}:{})})):obj.runs?.length?[{runs:runs(obj.runs)}]:obj.text||'';
 shape.text.style={...font(obj.font),alignment:obj.alignment?.horizontal||'left',verticalAlignment:obj.alignment?.vertical==='middle'?'middle':'top'};
 shape.text.insets=0;
}
function buildSlide(deck,scene,background) {
 const slide=deck.slides.add();
 slide.background.fill=color(background,'#FFFFFF');
 for(const obj of scene.objects) {
   const position={left:obj.x,top:obj.y,width:obj.width,height:obj.height,rotation:obj.rotation,horizontalFlip:obj.flipH,verticalFlip:obj.flipV};
   if(obj.kind==='text') {addText(slide,obj);continue;}
   if(obj.kind==='chart') {
     const c=obj.chart,type={donut:'doughnut',horizontal_bar:'bar',horizontal_stacked_bar:'bar',stacked_bar:'bar'}[c.chart_type]||c.chart_type;
     const series=(c.series||[]).map((s,i)=>({name:s.name||`Series ${i+1}`,values:s.values.map(v=>Number(v)||0),fill:color(c.colors?.[i],'#2979B8'),...(type==='scatter'?{xValues:(c.categories||[]).map(Number)}:{})}));
     slide.charts.add(type,{position,categories:c.categories||[],series,hasLegend:!!c.legend,
       ...(type==='bar'?{barOptions:{direction:c.chart_type?.includes('horizontal')?'bar':'column',grouping:c.chart_type?.includes('stacked')?'stacked':'clustered'}}:{}),
       chartFill:'none',plotAreaFill:'none',titleTextStyle:{fontFamily:'Arial',fontSize:18,color:color(c.text_color,'#172923')}});continue;
   }
   if(obj.kind==='table') {
     const t=obj.table, cells=[t.columns||[],...(t.rows||[])];
     const cols=Math.max(1,...cells.map(row=>row.length));
     const table=slide.tables.add({rows:cells.length,columns:cols,left:obj.x,top:obj.y,width:obj.width,height:obj.height,values:cells.map(row=>Array.from({length:cols},(_,i)=>(row[i]?.runs||[]).map(r=>r.text||'').join('')))});
     cells.forEach((row,r)=>row.forEach((c,col)=>{const cell=table.getCell(r,col);cell.fill=color(c.color?.color,'#FFFFFF');cell.text.style=font(c.font);}));continue;
   }
   const placeholder=obj.kind==='image-placeholder';
   const config={name:obj.name,geometry:placeholder?'rect':obj.geometry,position,
      fill:placeholder?'none':paint(obj.fill),line:{fill:placeholder?(obj.decorative?'none':'#AAB4BF'):color(obj.stroke?.color),width:placeholder?(obj.decorative?0:1):obj.stroke?.width||0}};
   if(obj.geometry==='custom')config.customPaths=[{width:obj.width,height:obj.height,commands:[{moveTo:obj.points[0]},...obj.points.slice(1).map(point=>({lineTo:point})),...(obj.closed?[{close:{}}]:[])]}];
   const shape=slide.shapes.add(config);
   if(placeholder && !obj.decorative) {shape.text=obj.text;shape.text.style={typeface:'Arial',fontSize:Math.min(18,Math.max(6,obj.height/4)),color:'#526170'};shape.text.insets=4;}
 }
 return slide;
}
const manifest={version:1,families:[]};
const builtins=builtinTemplateFamilies();
for(const builtin of builtins) {
 const name=builtin.fileName,template=builtin,bytes=Buffer.from(JSON.stringify(builtin)),familyId=builtin.id;
 const deck=Presentation.create({slideSize:{width:1280,height:720}}),scenes=template.layouts.map(l=>l.scene);
 for(const scene of scenes)buildSlide(deck,scene,template.palette?.background||template.theme?.colors?.background);
 const metadata={version:1,upstream:'desq',license:'Project source',family:familyId,name:template.name,description:template.description,sourceSHA256:createHash('sha256').update(bytes).digest('hex'),layouts:scenes.map((scene,i)=>({id:scene.id,page:i+1,description:scene.description,slots:scene.slots,warnings:scene.warnings}))};
 if(builtin){metadata.upstream='desq';metadata.license='Project source';delete metadata.sourceCommit;}
 // Every rendered content fragment gets an addressable native placeholder.
 for(const [index,scene]of scenes.entries()){
   const slots=metadata.layouts[index].slots;
   for(const object of scene.objects){
     if(!['text','chart','table','image-placeholder'].includes(object.kind))continue;
     if(!object.name.startsWith('field:')&&!['chart','table'].includes(object.kind))continue;
     let slot=slots.find(slot=>slot.name===object.name);
     if(!slot){slot={name:object.name,field:object.name.split(':').at(-1)};slots.push(slot);}
     slot.kind=object.kind==='image-placeholder'?'image':object.kind==='text'&&slot.kind==='text-list'?'text-list':object.kind;
     if(object.kind==='chart')slot.chartType=object.chart.chart_type;
     if(object.kind==='table'){slot.maxRows=1+(object.table.rows||[]).length;slot.maxColumns=(object.table.columns||[]).length;}
   }
   metadata.layouts[index].slots=slots.filter(slot=>scene.objects.some(o=>o.name===slot.name&&['text','chart','table','image-placeholder'].includes(o.kind)));
 }
 const draft=`.tmp/builtin-templates/${name}.draft.pptx`;
 await (await PresentationFile.exportPptx(deck)).save(draft);
 const archive=new ZipReader(new Uint8ArrayReader(new Uint8Array(await fs.readFile(draft))),{useWebWorkers:false});
 const zip=new ZipWriter(new Uint8ArrayWriter(),{useWebWorkers:false});
 const packageParts={};
 for(const entry of await archive.getEntries()) {
   if(entry.directory)continue;
   let data=await entry.getData(new Uint8ArrayWriter(),{useWebWorkers:false});
   const match=entry.filename.match(/^ppt\/slides\/slide(\d+)\.xml$/);
   if(match){let xml=new TextDecoder().decode(data);const scene=scenes[Number(match[1])-1];xml=xml.replace(/<p:cSld(?:\s[^>]*)?>/,`<p:cSld name="${esc(scene.id)}">`);
     xml=xml.replace(/<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/g,frame=>{
       const x=Number(frame.match(/<a:off[^>]* x="([^"]+)"/)?.[1])/9525,y=Number(frame.match(/<a:off[^>]* y="([^"]+)"/)?.[1])/9525;
       const kind=frame.includes('<a:tbl>')?'table':'chart';
       const obj=scene.objects.find(o=>o.kind===kind&&Math.abs(o.x-x)<.1&&Math.abs(o.y-y)<.1);
       return obj?frame.replace(/(<p:cNvPr\b[^>]*\bname=")[^"]*(")/,`$1${esc(obj.name)}$2`):frame;
     });
     const textObjects=new Map(scene.objects.filter(o=>o.kind==='text').map(o=>[esc(o.name),o]));
     xml=xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g,shape=>{
       const name=shape.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1],obj=textObjects.get(name);
       if(!obj)return shape;
       if(obj.font?.line_height)shape=shape.replace(/<a:pPr\b[^>]*>/g,tag=>tag.endsWith('/>')?tag.slice(0,-2)+`><a:lnSpc><a:spcPct val="${Math.round(obj.font.line_height*100000)}"/></a:lnSpc></a:pPr>`:tag+`<a:lnSpc><a:spcPct val="${Math.round(obj.font.line_height*100000)}"/></a:lnSpc>`);
       if(obj.font?.letter_spacing)shape=shape.replace(/<a:rPr\b([^>]*?)(\/?)>/g,(_,attrs,slash)=>`<a:rPr${attrs} spc="${Math.round(obj.font.letter_spacing*75)}"${slash}>`);
       return shape;
     });
     data=new TextEncoder().encode(xml);}
   if(entry.filename==='[Content_Types].xml')data=new TextEncoder().encode(new TextDecoder().decode(data).replace('</Types>','<Default Extension="json" ContentType="application/json"/></Types>'));
   packageParts[entry.filename]=data;
 }
 const nativeParts=masterizePresentonParts(packageParts,metadata);
 applyBuiltinTemplateTheme(nativeParts,'office');
 for(const [part,data]of Object.entries(nativeParts))await zip.add(part,new Uint8ArrayReader(data));
 const pptx=await zip.close();await archive.close();
 await fs.writeFile(`${output}/${name}.pptx`,pptx);
 manifest.families.push({id:familyId,file:`templates/builtin/${name}.pptx`,slides:scenes.length,sha256:createHash('sha256').update(pptx).digest('hex'),bytes:pptx.length});
 console.log(`${name}: ${scenes.length} slides, ${pptx.length} bytes`);
}
await fs.writeFile(`${metadataOutput}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');

await fs.writeFile(`${metadataOutput}/builtin-catalogue.json`,JSON.stringify(builtins.map(({id,name,description,palette,layouts})=>({id,name,description,palette,layouts:layouts.map(({id,description})=>({id,description}))})),null,2)+'\n');

// Remove retired generated palette packages; themes now share one built-in base.
for(const file of await fs.readdir(output))if(/^builtin-[a-z]+\.pptx$/.test(file))await fs.unlink(path.join(output,file));
