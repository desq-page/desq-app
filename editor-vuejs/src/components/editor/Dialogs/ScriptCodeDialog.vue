<template>
  <NModal :show="show" preset="card" title="Local JavaScript" style="width: min(1000px, 94vw)" :mask-closable="false" @update:show="emit('update:show', $event)">
    <p>Edit your own functions, such as checkAnswer. The ctx API controls slide objects. Code runs in the HTML player; PPTX stores it for reimport.</p>
    <NSpace align="center">
      <NSelect v-model:value="moduleId" :options="project.modules.map(m => ({label:m.id,value:m.id}))" style="width:260px" />
      <NButton @click="addModule">Add module</NButton>
      <NButton tag="a" href="https://desq.page/docs/local-scripting.md" target="_blank">API guide</NButton>
    </NSpace>
    <NInput v-if="currentModule" v-model:value="currentModule.source" type="textarea" :autosize="{minRows:14,maxRows:24}" spellcheck="false" style="margin:12px 0;font-family:monospace" aria-label="JavaScript module source" />
    <p>Selected shape: {{ selectedId || 'Select a shape before opening this dialog to bind a button.' }}</p>
    <NSpace align="center">
      <NSelect v-model:value="functionName" :options="functions.map(value => ({label:value,value}))" placeholder="Exported function" style="width:260px" />
      <NInput v-model:value="argsText" placeholder="JSON arguments, e.g. [true]" style="width:300px" aria-label="Function arguments" />
    </NSpace>
    <details style="margin:12px 0"><summary>Shape and slide references</summary><pre style="max-height:180px;overflow:auto;white-space:pre-wrap">{{ referenceText }}</pre></details>
    <p v-if="error" role="alert" style="color:#d03050">{{ error }}</p>
    <p v-if="status" role="status">{{ status }}</p>
    <template #footer><NSpace justify="end">
      <NButton :disabled="!selectedId" @click="unbind">Remove selected binding</NButton>
      <NButton @click="save(false)">Save code</NButton>
      <NButton type="primary" :disabled="!selectedId" @click="save(true)">Save and bind selected shape</NButton>
      <NButton @click="emit('update:show',false)">Close</NButton>
    </NSpace></template>
  </NModal>
</template>

<script setup lang="ts">
import {computed,ref} from 'vue';
import {NModal,NButton,NInput,NSelect,NSpace} from 'naive-ui';
import {getFileInfo,getSlideInfo,getShapeDeep,updateFile,updateShape} from 'shared-vuejs/editor';
import {saveDexie} from 'shared-vuejs/api/dbutils';
import {genId} from 'shared-vuejs/api/utility';
import {validateScriptProject,moduleExports} from 'shared-vuejs/api/scripting';
import {piniaSelect} from '@/lib/common/store';

defineProps<{show:boolean}>();
const emit=defineEmits(['update:show']);
const fileId=getFileInfo().id,slideId=getSlideInfo().id;
const selectedId=piniaSelect().selShpFormat?.id;
const project=ref(validateScriptProject((getFileInfo() as any).scripting));
const error=ref(''),status=ref(''),argsText=ref('[]');
const existing=selectedId ? project.value.bindings.find(b=>'@run:'+b.id===getShapeDeep(selectedId)?.link) : undefined;
const moduleId=ref(existing?.module || project.value.modules[0]?.id || '');
const functionName=ref(existing?.function || 'onClick');
if(existing)argsText.value=JSON.stringify(existing.args);
const currentModule=computed(()=>project.value.modules.find(m=>m.id===moduleId.value));
const functions=computed(()=>{try{return moduleExports(currentModule.value?.source||'')}catch{return []}});
function addModule(){
  const id='module-'+genId();project.value.modules.push({id,source:'export async function onClick(ctx) {\n  ctx.state.set("clicks", (ctx.state.get("clicks") || 0) + 1);\n  // await ctx.shapes.show("shape-id");\n}\n',refs:{},slides:{}});moduleId.value=id;functionName.value='onClick';
}
if(!project.value.modules.length)addModule();
const referenceText=computed(()=>{
  const list=(shapes,depth=0)=>shapes.flatMap(s=>[' '.repeat(depth)+s.id+' — '+(s.name||s.type||'shape'),...list(s.children||[],depth+2)]);
  return 'Current slide shapes:\n'+list(getSlideInfo().shapes||[]).join('\n')+'\n\nSlides:\n'+getFileInfo().slides.map(s=>s.id+' — '+(s.name||s.title||'')).join('\n')+'\n\nImported aliases:\n'+JSON.stringify({shapes:currentModule.value?.refs,slides:currentModule.value?.slides},null,2);
});
function checkTarget(){if(getFileInfo().id!==fileId||getSlideInfo().id!==slideId)throw Error('The document or slide changed. Reopen Local JavaScript.');}
async function save(bind){
  error.value='';status.value='';
  try{
    checkTarget();const next=JSON.parse(JSON.stringify(project.value));
    let shape;
    if(bind){
      shape=getShapeDeep(selectedId);if(!shape)throw Error('The selected shape no longer exists.');
      if(!moduleExports(currentModule.value.source).includes(functionName.value))throw Error('Choose an exported function.');
      const args=JSON.parse(argsText.value);if(!Array.isArray(args))throw Error('Arguments must be a JSON array.');
      const old=next.bindings.find(b=>'@run:'+b.id===shape.link);
      const binding={id:old?.id||'click-'+genId(),module:moduleId.value,function:functionName.value,args};
      next.bindings=next.bindings.filter(b=>b.id!==binding.id);next.bindings.push(binding);
      shape={...shape,link:'@run:'+binding.id};
    }
    const validated=validateScriptProject(next);
    updateFile({scripting:validated} as any);if(shape)updateShape(shape);
    await saveDexie();project.value=validated;status.value=bind?'Code saved and button bound.':'Code saved.';
  }catch(e){error.value=e.message||String(e);}
}
async function unbind(){try{checkTarget();const shape=getShapeDeep(selectedId);if(shape?.link?.startsWith('@run:')){updateShape({...shape,link:''});await saveDexie();status.value='Button binding removed.';}}catch(e){error.value=e.message||String(e);}}
</script>
