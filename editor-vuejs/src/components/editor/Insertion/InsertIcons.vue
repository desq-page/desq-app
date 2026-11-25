<template>
  <DialogBase title="Icons" :icon="Star24Regular">
    <div class="icon-picker">
      <NInput v-model:value="query" clearable :placeholder="translate('Search icons')"
        :input-props="{ 'aria-label': translate('Search icons') }" />
      <NSelect v-model:value="prefix" filterable :options="collectionOptions"
        :placeholder="translate('Icon set')" :aria-label="translate('Icon set')" />
      <p v-if="collection?.license" class="icon-license">
        {{ collection.author?.name }}
        <a v-if="licenseUrl" :href="licenseUrl" target="_blank" rel="noopener noreferrer">
          {{ collection.license.title }}
        </a>
        <span v-else>{{ collection.license.title }}</span>
      </p>
      <p v-if="loading" role="status">{{ translate('Loading icons…') }}</p>
      <div v-else-if="loadFailed" role="status">
        <p>{{ translate('Could not load icons.') }}</p>
        <NButton size="small" @click="retry++">{{ translate('Try again') }}</NButton>
      </div>
      <p v-else-if="!icons.length" role="status">{{ translate('No icons found.') }}</p>
      <template v-else>
        <div class="icon-grid" :aria-label="translate('Icons')" role="group">
          <NButton v-for="icon in visibleIcons" :key="icon" class="icon-button"
            :title="icon" :aria-label="icon" :disabled="!!inserting"
            :loading="inserting === icon" @click="insertIcon(icon)">
            <img v-if="previews[icon]" :src="previews[icon]" width="24" height="24" alt="" />
            <span v-else aria-hidden="true">{{ previews[icon] === null ? "–" : "…" }}</span>
          </NButton>
        </div>
        <div v-if="previewFailed" role="status">
          <p>{{ translate('Some icon previews could not load.') }}</p>
          <NButton size="small" @click="previewRetry++">{{ translate('Try again') }}</NButton>
        </div>
        <NButton v-if="icons.length > limit" size="small" @click="limit += PAGE_SIZE">
          {{ translate('Show more') }}
        </NButton>
      </template>
      <p v-if="insertError" role="alert">{{ translate(insertError) }}</p>
    </div>
  </DialogBase>
</template>

<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from "vue";
import { NButton, NInput, NSelect } from "naive-ui";
import { Star24Regular } from "@vicons/fluent";
import { getIconData } from "@iconify/utils/lib/icon-set/get-icon";
import { iconToSVG } from "@iconify/utils/lib/svg/build";
import { iconToHTML } from "@iconify/utils/lib/svg/html";
import { replaceIDs } from "@iconify/utils/lib/svg/id";
import DOMPurify from "dompurify";
import { addShapeRaw } from "shared-vuejs/api/draw";
import { saveDexie } from "shared-vuejs/api/dbutils";
import { activeSlideHeight, activeSlideWidth } from "shared-vuejs/api/slide";
import { saveBlobToCacheAPI } from "shared-vuejs/api/upload";
import { genId } from "shared-vuejs/api/utility";
import { getFileInfo, getSlideInfo } from "shared-vuejs/editor";
import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import { piniaInfo } from "@/lib/common/store";
import { translate } from "@/lib/i18n";

interface CollectionInfo {
  name: string;
  author?: { name: string };
  license?: { title: string; url?: string };
  samples?: string[];
}

type IconSet = Parameters<typeof getIconData>[0];

const ASSETS = `${import.meta.env.BASE_URL}iconify`;
const ICONIFY_API = "https://api.iconify.design";
const FEATURED_SETS = ["lucide", "tabler", "heroicons", "mdi"];
const PAGE_SIZE = 36;
const MAX_CACHED_SETS = 12;
const iconName = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const query = ref("");
const prefix = ref("");
const collections = shallowRef<Record<string, CollectionInfo>>({});
const searchCollections = new Map<string, CollectionInfo>();
const cachedSets = new Map<string, Promise<IconSet>>();
const previews = ref<Record<string, string | null>>({});
const previewRetry = ref(0);
const icons = shallowRef<string[]>([]);
const limit = ref(PAGE_SIZE);
const loading = ref(true);
const loadFailed = ref(false);
const retry = ref(0);
const inserting = ref("");
const insertError = ref("");
const insertionController = new AbortController();
onScopeDispose(() => insertionController.abort());

const collection = computed(() => collections.value[prefix.value]);
const licenseUrl = computed(() => {
  const url = collection.value?.license?.url;
  return url && /^https?:\/\//i.test(url) ? url : "";
});
const collectionOptions = computed(() => [
  { label: translate("All icon sets"), value: "" },
  ...Object.entries(collections.value)
    .map(([id, { name }]) => ({ label: name, value: id }))
    .sort((a, b) => a.label.localeCompare(b.label)),
]);
const visibleIcons = computed(() => icons.value.slice(0, limit.value));
const previewFailed = computed(() => visibleIcons.value.some(icon => previews.value[icon] === null));

async function fetchAsset(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Icon request returned ${response.status}`);
  return response;
}

function loadSet(set: string): Promise<IconSet> {
  const cached = cachedSets.get(set);
  cachedSets.delete(set);
  const pending = cached ?? fetchAsset(`${ASSETS}/sets/${set}.json.gz`)
    .then(async response => {
      // Fetch decodes Content-Encoding automatically. Some hosts serve the gzip file as raw bytes.
      const bytes = new Uint8Array(await response.arrayBuffer());
      const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
      const body = isGzip
        ? new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))
        : bytes;
      const data: IconSet = await new Response(body).json();
      if (data.prefix !== set || !data.icons) throw new Error("Invalid Iconify collection");
      return data;
    })
    .catch(error => {
      if (cachedSets.get(set) === pending) cachedSets.delete(set);
      throw error;
    });
  cachedSets.set(set, pending);
  if (cachedSets.size > MAX_CACHED_SETS) {
    const oldest = cachedSets.keys().next().value;
    if (oldest) cachedSets.delete(oldest);
  }
  return pending;
}

async function buildIcon(icon: string, color: string, signal?: AbortSignal) {
  const [set, name] = icon.split(":");
  if (Object.hasOwn(collections.value, set)) {
    const data = getIconData(await loadSet(set), name);
    if (data) {
      const { body, attributes } = iconToSVG(data);
      return iconToHTML(replaceIDs(body).replace(/currentColor/gi, color), attributes);
    }
  }
  const response = await fetchAsset(
    `${ICONIFY_API}/${set}/${name}.svg?color=${encodeURIComponent(color)}`, signal,
  );
  return response.text();
}

watch([visibleIcons, previewRetry], ([visible], _, onCleanup) => {
  const controller = new AbortController();
  const { signal } = controller;
  onCleanup(() => controller.abort());
  previews.value = Object.fromEntries(visible.filter(icon => previews.value[icon])
    .map(icon => [icon, previews.value[icon]]));
  for (const icon of visible) {
    if (previews.value[icon]) continue;
    buildIcon(icon, "#536678", signal).then(svg => {
      if (!signal.aborted) previews.value[icon] = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }).catch(() => {
      if (!signal.aborted) previews.value[icon] = null;
    });
  }
});

async function findIcons(set: string, search: string, signal: AbortSignal) {
  if (search) {
    const query = new URLSearchParams({ query: search, limit: "128" });
    if (set) query.set("prefixes", set);
    const response = await fetchAsset(`${ICONIFY_API}/search?${query}`, signal);
    const result: { icons: string[]; collections?: Record<string, CollectionInfo> } = await response.json();
    if (signal.aborted) return [];
    for (const [id, info] of Object.entries(result.collections ?? {})) searchCollections.set(id, info);
    return result.icons.filter(icon => {
      const [resultSet, name, extra] = icon.split(":");
      return extra === undefined && iconName.test(resultSet) && (!set || resultSet === set)
        && iconName.test(name ?? "");
    });
  }

  if (set) {
    const { icons, aliases } = await loadSet(set);
    return [...Object.keys(icons), ...Object.keys(aliases ?? {})].sort()
      .map(name => `${set}:${name}`);
  }

  return FEATURED_SETS.flatMap(id => (collections.value[id]?.samples ?? [])
    .map(name => `${id}:${name}`));
}

watch([prefix, query, retry], ([set, input], previous, onCleanup) => {
  const controller = new AbortController();
  const { signal } = controller;
  const search = input.trim().toLowerCase();
  const delay = previous?.[0] === set && previous?.[1] !== input && search ? 200 : 0;
  const timer = setTimeout(async () => {
    try {
      if (!Object.keys(collections.value).length) {
        const response = await fetchAsset(`${ASSETS}/collections.json`, signal);
        const catalog = await response.json();
        if (signal.aborted) return;
        collections.value = catalog;
      }
      const matches = await findIcons(set, search, signal);
      if (!signal.aborted) icons.value = matches;
    } catch {
      if (!signal.aborted) loadFailed.value = true;
    } finally {
      if (!signal.aborted) loading.value = false;
    }
  }, delay);

  loading.value = true;
  loadFailed.value = false;
  limit.value = PAGE_SIZE;
  onCleanup(() => {
    clearTimeout(timer);
    controller.abort();
  });
}, { immediate: true });

async function insertIcon(icon: string) {
  const file = getFileInfo();
  const slideId = getSlideInfo()?.id;
  if (inserting.value || !file?.id || !slideId || piniaInfo().useGrid) return;

  inserting.value = icon;
  insertError.value = "";
  const { signal } = insertionController;
  let inserted = false;
  try {
    const text = await buildIcon(icon, "#172923", signal);
    if (signal.aborted) return;
    if (getFileInfo()?.id !== file.id || getSlideInfo()?.id !== slideId || piniaInfo().useGrid) {
      insertError.value = "The active slide changed. Select the icon again to insert it.";
      return;
    }

    const sanitized = DOMPurify.sanitize(text, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ["style", "a", "image"],
      FORBID_ATTR: ["style", "href", "xlink:href"],
    });
    const svg = new DOMParser().parseFromString(sanitized, "image/svg+xml").documentElement;
    const [, , width, height] = (svg.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
    if (svg.localName !== "svg" || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error("Invalid icon SVG");
    }
    for (const element of [svg, ...svg.querySelectorAll("*")]) {
      for (const attr of element.getAttributeNames()) {
        const value = element.getAttribute(attr) ?? "";
        if (/url\s*\(/i.test(value) && !/^url\(\s*#[\w:.-]+\s*\)$/.test(value)) element.removeAttribute(attr);
      }
    }

    const [set, name] = icon.split(":");
    const info = collections.value[set] ?? searchCollections.get(set);
    const description = svg.ownerDocument.createElementNS(svg.namespaceURI, "desc");
    description.textContent = [icon, info?.name, info?.author?.name, info?.license?.title, info?.license?.url]
      .filter(Boolean).join(" · ");
    svg.prepend(description);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));

    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const target = await saveBlobToCacheAPI(blob, `${genId()}.svg`, blob.type, file.id, width, height);
    if (signal.aborted) return;
    if (getFileInfo()?.id !== file.id || getSlideInfo()?.id !== slideId || piniaInfo().useGrid) {
      insertError.value = "The active slide changed. Select the icon again to insert it.";
      return;
    }
    if (!target) throw new Error("Could not store icon SVG");

    const slideWidth = activeSlideWidth(file);
    const slideHeight = activeSlideHeight(file);
    const size = Math.min(160, slideWidth / 3, slideHeight / 3);
    const scale = size / Math.max(width, height);
    const w = width * scale;
    const h = height * scale;
    addShapeRaw({
      $_otag: "pic",
      type: "svg",
      name: name.replaceAll("-", " "),
      x: (slideWidth - w) / 2,
      y: (slideHeight - h) / 2,
      w,
      h,
      blipFill: {
        blip: { $_target: target, $_w: width, $_h: height },
        srcRect: {},
        stretch: { fillRect: {} },
      },
    });
    inserted = true;
    await saveDexie();
  } catch {
    if (!signal.aborted) {
      insertError.value = inserted
        ? "Icon inserted, but the presentation could not be saved."
        : "Could not insert the icon. Please try again.";
    }
  } finally {
    inserting.value = "";
  }
}
</script>

<style scoped>
.icon-picker {
  display: grid;
  gap: 10px;
  padding: 12px 0;
}

.icon-picker p {
  margin: 0;
}

.icon-license {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  font-size: 12px;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
  gap: 6px;
}

.icon-button {
  height: 44px;
  padding: 0;
}

.icon-button img {
  display: block;
  object-fit: contain;
}
</style>
