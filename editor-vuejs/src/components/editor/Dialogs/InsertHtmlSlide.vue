<template>
  <NModal v-model:show="open" preset="card" :title="translate('Insert HTML Slide')"
    :mask-closable="!busy" :close-on-esc="!busy" :closable="!busy"
    style="width: 760px; max-width: calc(100vw - 32px)">
    <div :class="$style.form" @pointerdown.stop @pointerup.stop @keydown.stop @keyup.stop @paste.stop>
      <label for="html-slide-brief">{{ translate('What should the slide show?') }}</label>
      <NInput id="html-slide-brief" v-model:value="brief" :placeholder="translate('Optional slide brief')" />
      <label for="html-slide-prompt">{{ translate('Generated prompt') }}</label>
      <textarea id="html-slide-prompt" rows="6" readonly :value="prompt" />
      <div>
        <NButton :disabled="loadingContext || !context" @click="copyPrompt">{{ translate('Copy prompt') }}</NButton>
      </div>
      <label for="html-slide-source">{{ translate('Paste or upload the generated HTML') }}</label>
      <textarea id="html-slide-source" v-model="html" rows="7" :disabled="busy" spellcheck="false" />
      <div :class="$style.actions">
        <input ref="fileInput" type="file" accept=".html,.htm,text/html" hidden @change="readHtml" />
        <NButton :disabled="busy" @click="fileInput?.click()">{{ translate('Upload HTML') }}</NButton>
        <NButton type="primary" :loading="busy" :disabled="busy || !html.trim()" @click="insert">
          {{ translate('Insert Slide') }}
        </NButton>
      </div>
      <div>{{ translate('Double-click text to edit it. Press Enter or click away to save. Use Preview or Present to try the interactive controls.') }}</div>
      <div v-if="status" role="status">{{ translate(status) }}</div>
    </div>
  </NModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NButton, NInput, NModal } from 'naive-ui';
import { translate } from '@/lib/i18n';
import { getFileInfo, getInfoUseGrid, getSlideInfo, getSlidesMasterView, getTheme } from 'shared-vuejs/editor';
import { loadSlideFromDexie, saveDexie } from 'shared-vuejs/api/dbutils';
import { pasteSlide, selectSlide } from 'shared-vuejs/api/slide';
import { flushPendingTextSave, hideEditor } from 'shared-vuejs/api/updateText';
import { genId, nodeAsArray } from 'shared-vuejs/api/utility';
import { getRunText } from 'shared-vuejs/api/lib-text-run-text';
import { mapStyleThemeColor } from 'shared-vuejs/api/colorUtils';

const open = defineModel<boolean>('show', { required: true });
const busy = ref(false), loadingContext = ref(false);
const brief = ref(''), html = ref(''), status = ref(''), context = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const maxHtmlLength = 2_000_000;

const prompt = computed(() => [
  'Create one self-contained HTML slide using the deck dimensions, theme, and context below.',
  'Return a complete HTML document with inline CSS, inline JavaScript, and any required assets embedded. Fit the full slide in the viewport. Keep visible text in ordinary HTML elements so it stays editable.',
  'Make the slide interactive. Choose an interaction that helps explain the topic, such as tabs that switch information panels, a quiz with immediate feedback, or a slider that updates a chart. Include at least one visible, clearly labeled control and wire it up so using it changes what the audience sees. Include a reset control when the interaction has multiple steps.',
  'Write the initial view and controls directly in the HTML. Use native buttons or form controls with keyboard support. Keep all behavior inside this slide. For custom click targets, use a button or call event.stopPropagation() so the presentation stays on the slide. Use no external libraries, network requests, or parent-window APIs. Return only the HTML.',
  brief.value.trim() && `Slide brief: ${brief.value.trim()}`,
  context.value,
].filter(Boolean).join('\n\n'));

function shapeText(shape: any): string[] {
  const ownText = nodeAsArray(shape.txBody?.p).map(para => nodeAsArray(para.r).map(getRunText).join('')).join('\n');
  const tableText = nodeAsArray(shape.graphic?.graphicData?.tbl?.tr)
    .flatMap(row => nodeAsArray(row.tc).flatMap(shapeText));
  let htmlText = '';
  if (typeof shape.htmlSlide === 'string') {
    const doc = new DOMParser().parseFromString(shape.htmlSlide, 'text/html');
    doc.querySelectorAll('script, style, template, noscript').forEach(node => node.remove());
    htmlText = doc.body.textContent || '';
  }
  return [ownText, htmlText, ...tableText, ...(shape.children || []).flatMap(shapeText)].filter(text => text.trim());
}

watch(open, async (show, _, onCleanup) => {
  if (!show) return;
  let active = true;
  onCleanup(() => { active = false; });
  status.value = '';
  context.value = '';
  const file = getFileInfo();
  if (!file?.id) return;
  loadingContext.value = true;
  try {
    await flushPendingTextSave();
    const current = getSlideInfo();
    const theme = getTheme();
    const colors = Object.entries(theme?.clrScheme || {}).flatMap(([slot, entry]: [string, any]) => {
      const color = entry?.uniClr && mapStyleThemeColor(entry.uniClr, theme, null);
      return color ? [`${slot}: ${color}`] : [];
    });
    const slides = await Promise.all(file.slides.map(({ id }, index) => {
      return Promise.resolve(id === current?.id ? current : loadSlideFromDexie(file.id, id, 'slides'))
        .then(slide => {
          const text = (slide?.shapes || []).flatMap(shapeText).join('\n');
          return text && `Slide ${index + 1}:\n${text}`;
        });
    }));
    if (active) context.value = [
      `Deck dimensions: ${file.width} × ${file.height} pixels.`,
      colors.length && `Theme colors: ${colors.join(', ')}.`,
      slides.some(Boolean) && `Existing deck text:\n${slides.filter(Boolean).join('\n\n')}`,
    ].filter(Boolean).join('\n\n');
  } catch {
    if (active) status.value = 'Could not read the presentation context.';
  } finally {
    if (active) loadingContext.value = false;
  }
}, { immediate: true });

async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(prompt.value);
    status.value = 'Prompt copied.';
  } catch {
    status.value = 'Select and copy the prompt above.';
  }
}

async function readHtml(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  busy.value = true;
  try {
    if (file.size > maxHtmlLength * 4) throw new Error('Choose an HTML file under 8 MB.');
    const text = await file.text();
    if (text.length > maxHtmlLength) throw new Error('HTML must be under 2 million characters.');
    html.value = text;
    status.value = '';
  } catch (error) {
    status.value = error.message;
  } finally {
    busy.value = false;
  }
}

async function insert() {
  const file = getFileInfo();
  const slide = getSlideInfo();
  const layoutid = slide?.layoutid || file?.layouts?.[0]?.id;
  if (!file?.id || !slide?.id || !layoutid || getSlidesMasterView() || getInfoUseGrid() ||
    ['docx', 'xlsx', 'pdf'].includes(file.sourceFormat)) {
    status.value = 'Open a presentation slide to insert HTML.';
    return;
  }

  const source = html.value.trim().replace(/^```(?:html)?\s*\r?\n([\s\S]*?)\r?\n```$/i, '$1');
  if (!/^<(?:!doctype\s+html|!--|[a-z][\w-]*(?=[\s/>]))/i.test(source) || source.length > maxHtmlLength) {
    status.value = 'Enter valid HTML under 2 million characters.';
    return;
  }

  busy.value = true;
  status.value = '';
  try {
    await flushPendingTextSave();
    hideEditor();
    await flushPendingTextSave();
    if (getFileInfo()?.id !== file.id || getSlideInfo()?.id !== slide.id) throw new Error('The active presentation or slide changed.');
    const id = await pasteSlide({
      id: slide.id,
      fileId: file.id,
      layoutid,
      name: 'HTML Slide',
      showMaster: '0',
      transition: { advClick: 1 },
      shapes: [{
        id: genId(), name: 'HTML Slide', type: 'rect', $_otag: 'sp', noFill: {}, locked: true,
        x: 0, y: 0, w: file.width, h: file.height, htmlSlide: source,
      }],
    }, file.id);
    await saveDexie({ skipGenerateThumb: true });
    await selectSlide(id);
    html.value = '';
    brief.value = '';
    open.value = false;
  } catch (error) {
    status.value = error.message;
  } finally {
    busy.value = false;
  }
}
</script>

<style module>
.form { display: grid; gap: 10px; max-height: 75dvh; overflow: auto; }
.form label { font-weight: 600; }
.form textarea { width: 100%; box-sizing: border-box; resize: vertical; font: inherit; padding: 8px; }
.actions { display: flex; justify-content: space-between; gap: 12px; }
</style>
