<template>
  <NModal v-model:show="open" preset="card" :title="translate('Insert HTML Slide')"
    :mask-closable="!busy" :close-on-esc="!busy" :closable="!busy"
    style="width: 760px; max-width: calc(100vw - 32px)">
    <div :class="$style.form" @pointerdown.stop @pointerup.stop @keydown.stop @keyup.stop @paste.stop>
      <label for="html-slide-brief">{{ translate('What should the slide show?') }}</label>
      <NInput id="html-slide-brief" v-model:value="brief" :placeholder="translate('Describe your app, game or presentation, its audience, content and how it should work…')" />
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
      <div>{{ translate('Right-click text and choose Edit text. Press Enter or click away to save.') }}</div>
      <div>{{ translate('Right-click an image, SVG, or image placeholder and choose Change image. PNG, JPEG, WebP, GIF, and SVG files are supported.') }}</div>
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
const maxTitleLength = 160;

const prompt = computed(() => [
  'Create one self-contained HTML slide using the deck dimensions, theme, and context below.',
  'Read and follow the Insert HTML Slide guide at https://desq.page/docs/insert-html-slide.html before writing the slide. If you cannot access the guide, ask me to provide it.',
  'Return only the HTML.',
  brief.value.trim() && `Slide brief: ${brief.value.trim()}`,
  context.value,
].filter(Boolean).join('\n').replace(/\n(?:[^\S\n]*\n)+/g, '\n'));

function slideTitle(slide: any): string {
  const titleShape = slide?.shapes?.find(shape =>
    ['title', 'ctrTitle'].includes(shape.ph?.$_type ?? shape.ph));
  const placeholderText = nodeAsArray(titleShape?.txBody?.p)
    .map(para => nodeAsArray(para.r).map(getRunText).join('')).join(' ');
  const title = (placeholderText.trim() || slide?.title || '').replace(/\s+/g, ' ').trim();
  return title.length > maxTitleLength ? title.slice(0, maxTitleLength - 1) + '…' : title;
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
    const currentIndex = file.slides.findIndex(({ id }) => id === current?.id);
    const firstIndex = Math.max(0, currentIndex - 2);
    const previousTitles = await Promise.all(
      file.slides.slice(firstIndex, Math.max(0, currentIndex)).map(async ({ id }, index) => {
        const slide = await loadSlideFromDexie(file.id, id, 'slides');
        const title = slideTitle(slide) || slideTitle(file.slides[firstIndex + index]);
        return title && `Slide ${firstIndex + index + 1}: ${JSON.stringify(title)}`;
      }),
    );
    const currentTitle = slideTitle(current) || slideTitle(file.slides[currentIndex]);
    if (active) context.value = [
      `Deck dimensions: ${file.width} × ${file.height} pixels.`,
      colors.length && `Theme colors: ${colors.join(', ')}.`,
      currentTitle && `Current slide title: ${JSON.stringify(currentTitle)}`,
      previousTitles.some(Boolean) && `Previous slide titles:\n${previousTitles.filter(Boolean).join('\n')}`,
    ].filter(Boolean).join('\n');
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
