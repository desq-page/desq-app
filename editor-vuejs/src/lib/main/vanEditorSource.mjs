import { loadSlideFromDexie, fetchTheme } from 'shared-vuejs/api/dbutils';
import { getMediaRecordFromOPFS, getMediaRecordsFromOPFS, getFontRecordFromOPFS } from 'shared-vuejs/api/opfs';
import { optimizedVideo } from 'shared-vuejs/api/optimized-video';
import { fileDataURL } from '../../../../editor-vanjs/src/document.mjs';
import { mediaMime } from 'shared-vuejs/api/edlib-common-export-single-page-package';
import { addVanChartPreviews, hasVanCharts } from './vanChartPreview.mjs';

// Same record loaders as the Vue editor. This bridge contains metadata and
// functions, not a materialized copy of every slide/media object in the deck.
export function createVanEditorSource(file) {
  const { themes, tblStyles, layouts = [], slides, ...metadata } = file;
  const header = { version:1, file:{ ...metadata, slides }, slides:slides.map(item => ({...item,name:item.title || item.name || 'Slide'})),
    layouts:layouts.filter(item=>item.parentid), masters:layouts.filter(item=>!item.parentid), tableStyles:tblStyles || [] };
  return {
    getHeader:async () => structuredClone(header),
    async loadRecord(kind, id) {
      if (kind === 'theme') return themes?.[id] || fetchTheme(file.id,id);
      const list = kind === 'slide' ? header.slides : kind === 'layout' ? header.layouts : header.masters;
      const record = {...list.find(item=>item.id===id), ...await loadSlideFromDexie(file.id,id,{slide:'slides',layout:'slideLayouts',master:'slideMasters'}[kind])};
      if (!hasVanCharts(record.shapes)) return record;
      const layout = kind === 'slide' ? header.layouts.find(item => item.id === record.layoutid) : record;
      const masterId = kind === 'master' ? id : layout?.parentid;
      const master = masterId ? { ...header.masters.find(item => item.id === masterId), ...await loadSlideFromDexie(file.id, masterId, 'slideMasters') } : undefined;
      const theme = master?.theme ? (themes?.[master.theme]?.data?.theme?.themeElements || themes?.[master.theme] || await fetchTheme(file.id, master.theme)) : undefined;
      return addVanChartPreviews(record, theme, master);
    },
    async loadAsset(target) {
      if (/^(?:data:|blob:|https?:|file:)/i.test(target)) return target;
      const mediaName = target.replace(/^(?:ppt\/)?media\//,'');
      if (!target.startsWith('fonts/')) {
        const optimized = await optimizedVideo(file.id, mediaName);
        if (optimized) return fileDataURL(new Blob([optimized], { type: 'video/mp4' }));
      }
      const record = target.startsWith('fonts/')
        ? await getFontRecordFromOPFS(file.id,target.slice(6))
        : await getMediaRecordFromOPFS(file.id,mediaName);
      return fileDataURL(new Blob([record.data], {type:mediaMime(target)}));
    },
    themeKeys:async () => [...new Set([...Object.keys(themes || {}), ...header.masters.map(master=>master.theme).filter(Boolean)])],
    async assetKeys() {
      const records = await getMediaRecordsFromOPFS(file.id);
      const keys = [];
      for (const record of records) {
        if (/\.(?:json|html)$/i.test(record.name)) continue;
        const name=record.name.replace(/^(?:ppt\/)?media\//,'');
        keys.push(record.name,name,`media/${name}`,`ppt/media/${name}`);
      }
      for (const font of file.fonts || []) if (font.type === 'local' && font.name) keys.push('fonts/'+font.name);
      return [...new Set(keys)];
    },
  };
}
