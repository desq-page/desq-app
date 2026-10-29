<template>
  <div class="design-suggestions" role="group" aria-label="Design suggestions">
    <button
      v-for="sample in samples"
      :key="sample.id"
      type="button"
      class="design-suggestion"
      :class="{ selected: isSelected(sample) }"
      :disabled="disabled"
      :title="`${sample.name}: apply colors, fonts and background to this master and its layouts`"
      :aria-label="`Apply ${sample.name} design`"
      :aria-pressed="isSelected(sample)"
      @click="applySample(sample)"
    >
      <span class="design-preview" :style="previewStyle(sample)" aria-hidden="true">
        <span class="preview-accent"></span>
        <span class="preview-title">Aa</span>
        <span class="preview-line"></span>
        <span class="preview-line short"></span>
      </span>
      <span class="design-name">{{ sample.name }}</span>
    </button>
  </div>
  <span class="design-divider" aria-hidden="true"></span>
  <ToolbarItemDropdown caption="Variants" :icon="SlideLayout24Regular" :options="variants" :disabled="disabled" :tooltip="scope" />
  <ToolbarItemDropdown caption="Colors" :icon="TextColor24Filled" :options="colors" :disabled="disabled" :tooltip="scope" />
  <ToolbarItemDropdown caption="Fonts" :icon="TextT24Filled" :options="fonts" :disabled="disabled" :tooltip="scope" />
  <ToolbarItemDropdown caption="Background" :icon="Image24Regular" :options="backgrounds" :disabled="disabled" :tooltip="scope" />
  <span v-if="busy" role="status" style="font-size:12px">Applying theme…</span>
</template>
<script setup lang="ts">
import {computed,h,ref} from 'vue';
import {SlideLayout24Regular,TextColor24Filled,TextT24Filled,Image24Regular} from '@vicons/fluent';
import ToolbarItemDropdown from './ToolbarItemDropdown.vue';
import {applyMasterDesignChange,getMasterDesignContext,DESIGN_VARIANTS,DESIGN_FONTS,DESIGN_BACKGROUNDS} from 'shared-vuejs/api/master';
import {showError} from 'shared-vuejs/api/utils';
import {piniaSlides} from '@/lib/common/store';
import {OFFICE_COLOR_SCHEMES} from '@/lib/agent/office-color-schemes.mjs';
const variantChoices=DESIGN_VARIANTS,fontChoices=DESIGN_FONTS,backgroundChoices=DESIGN_BACKGROUNDS;
const busy=ref(false),revision=ref(0);
const context=computed(()=>{piniaSlides().slideId;piniaSlides().sldState;revision.value;return getMasterDesignContext();});
const disabled=computed(()=>busy.value||!context.value.supported);
const scope='Changes the current slide’s master and all slides using that master. Other masters stay unchanged.';
const samples = [
  {id:'savanna',name:'DESQ',colorId:'green',fontId:'office',variant:'light',background:'auto'},
  {id:'studio',name:'Studio',colorId:'office',fontId:'office',variant:'light',background:'auto'},
  {id:'editorial',name:'Editorial',colorId:'paper',fontId:'georgia-arial',variant:'light',background:'lt2'},
  {id:'midnight',name:'Midnight',colorId:'blue',fontId:'trebuchet',variant:'dark',background:'auto'},
  {id:'bold',name:'Bold',colorId:'orange-red',fontId:'arial',variant:'accent',background:'auto'},
];
function isSelected(sample:any){const state=context.value.state;return state.colorId===sample.colorId&&state.fontId===sample.fontId&&state.variant===sample.variant&&state.background===sample.background;}
function previewStyle(sample:any){
  const colors=OFFICE_COLOR_SCHEMES.find(item=>item.id===sample.colorId)!.colors;
  const role=sample.background==='auto'?({light:'lt1',dark:'dk2',accent:'accent1'} as any)[sample.variant]:sample.background;
  const dark=sample.variant==='dark'||sample.variant==='accent';
  return {'--preview-bg':'#'+colors[role],'--preview-ink':'#'+colors[dark?'lt1':'dk2'],'--preview-accent':'#'+colors[sample.variant==='accent'?'accent2':'accent1'],'--preview-font':sample.fontId==='georgia-arial'?'Georgia, serif':'Arial, sans-serif'};
}
function applySample(sample:any){const scheme=OFFICE_COLOR_SCHEMES.find(item=>item.id===sample.colorId);if(scheme)apply({variant:sample.variant,background:sample.background,fontId:sample.fontId,colorId:scheme.id,colorsName:scheme.name,colors:scheme.colors});}
async function apply(change:any){if(disabled.value)return;busy.value=true;try{await applyMasterDesignChange(change);revision.value++;}catch(error){showError(error instanceof Error?error.message:String(error));}finally{busy.value=false;}}
const variants=computed(()=>variantChoices.map(item=>({key:item.id,label:(item.id===(context.value.state.variant||'light')?'✓ ':'')+item.name,onClick:()=>apply({variant:item.id})})));
const fonts=computed(()=>fontChoices.map(item=>({key:item.id,label:(item.id===context.value.state.fontId?'✓ ':'')+item.name,onClick:()=>apply({fontId:item.id})})));
const backgrounds=computed(()=>backgroundChoices.map(item=>({key:item.id,label:(item.id===(context.value.state.background||'auto')?'✓ ':'')+item.name,onClick:()=>apply({background:item.id})})));
const swatchRoles=['dk2','lt2','accent1','accent2','accent3','accent4','accent5','accent6'];
function paletteLabel(item:any,selected:boolean){
  return h('span',{style:{display:'inline-flex',alignItems:'center',gap:'10px'}},[
    h('span',{'aria-hidden':'true',style:{display:'inline-flex',border:'1px solid #888',flexShrink:0}},
      swatchRoles.map(role=>h('span',{key:role,style:{display:'block',width:'13px',height:'14px',backgroundColor:'#'+item.colors[role]}}))),
    h('span',[(selected?'✓ ':'')+item.name]),
  ]);
}
const colors=computed(()=>{const selected=context.value.state.colorId||OFFICE_COLOR_SCHEMES.find(item=>item.name===context.value.themeName)?.id;return OFFICE_COLOR_SCHEMES.map(item=>({key:item.id,label:()=>paletteLabel(item,selected===item.id),onClick:()=>apply({colorId:item.id,colorsName:item.name,colors:item.colors})}));});
</script>

<style scoped>
.design-suggestions { display: flex; gap: 3px; align-items: center; }
.design-suggestion { padding: 2px; border: 1px solid transparent; border-radius: 4px; background: transparent; color: inherit; cursor: pointer; }
.design-suggestion:hover, .design-suggestion:focus-visible { background: #d3fad4; outline: none; }
.design-suggestion.selected { border-color: #729b35; }
.design-suggestion:disabled { opacity: .45; cursor: default; }
.design-preview { display: block; position: relative; overflow: hidden; width: 56px; height: 32px; box-sizing: border-box; border: 1px solid #ccc; background: var(--preview-bg); color: var(--preview-ink); text-align: left; }
.preview-accent { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--preview-accent); }
.preview-title { position: absolute; left: 9px; top: 2px; font: bold 10px var(--preview-font); }
.preview-line { position: absolute; left: 9px; top: 18px; width: 30px; height: 2px; background: currentColor; opacity: .55; }
.preview-line.short { top: 23px; width: 20px; }
.design-name { display: block; font-size: 9px; line-height: 13px; }
.design-divider { height: 38px; border-left: 1px solid #ddd; margin: 0 7px; }
</style>
