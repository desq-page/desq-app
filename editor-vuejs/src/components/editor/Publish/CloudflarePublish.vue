<template>
  <NFlex vertical>
    <div v-if="!cloudflareGoogleClientId">
      Google sign-in for Cloudflare publishing has not been configured.
    </div>
    <div v-else-if="restoringSession">Restoring Google sign-in...</div>
    <template v-else-if="!user">
      <div>Sign in with Google to publish to {{ cloudflarePublicHost }}.</div>
      <GoogleLogin :client-id="cloudflareGoogleClientId" :auto-login="false"
        :callback="signIn" :error="() => error = 'Google sign-in failed. Please try again.'" />
    </template>
    <template v-else>
      <NFlex justify="space-between" align="center">
        <span>Signed in as {{ user.name }}</span>
        <NButton size="small" :disabled="busy" @click="signOut">Sign out</NButton>
      </NFlex>
      <span>{{ files.length }} / 3 publications used. Each Google account can publish up to 3 documents.</span>
      <label for="cloudflare-file-name">File name</label>
      <NInput id="cloudflare-file-name" v-model:value="slug" :disabled="busy"
        placeholder="my-presentation" />
      <span>{{ cloudflarePublicOrigin }}/{{ encodeURIComponent(user.username) }}/{{ slug || 'file-name' }}</span>
      <NButton type="primary" :disabled="disabled || busy || !validSlug" :loading="busy" @click="publish">
        {{ currentPublication ? 'Update' : 'Publish' }}
      </NButton>
      <span v-if="progress">{{ progress }}</span>
      <div v-for="file in files" :key="file.slug" style="margin-top: 12px">
        <a :href="file.url" target="_blank" rel="noopener noreferrer">{{ file.title || file.slug }}</a>
        <NFlex style="margin-top: 6px">
          <NButton size="small" @click="copyLink(file.url)">Copy link</NButton>
          <NButton size="small" :disabled="busy" @click="unpublish(file)">Unpublish</NButton>
        </NFlex>
      </div>
    </template>
    <span v-if="error" role="alert" style="color: #d03050">{{ error }}</span>
  </NFlex>
</template>

<script setup lang="ts">
import { updateFile, getFileInfo } from "shared-vuejs/editor";

import { computed, onMounted, ref } from "vue";
import { GoogleLogin } from "vue3-google-login";
import { NButton, NFlex, NInput, useDialog } from "naive-ui";
import { cloudflareGoogleClientId, cloudflarePublicOrigin, cloudflareRequest, listCloudflareFiles, publishToCloudflare,
  type PublishedCloudflareFile } from "@/lib/cloudflare-publish";

import { saveDexie } from "shared-vuejs/api/dbutils";

defineProps<{ disabled?: boolean }>();
const dialog = useDialog();
const cloudflarePublicHost = new URL(cloudflarePublicOrigin).host;
// Cache the short-lived credential for refreshes; the API validates it on restore.
const sessionKey = `desq-publish-google:${cloudflareGoogleClientId}`;
const restoringSession = ref(false);
const token = ref("");
const user = ref<{ userId: string; username: string; name: string } | null>(null);
const files = ref<PublishedCloudflareFile[]>([]);
const slug = ref(getFileInfo()?.publish?.cloudflare?.slug ||
  (getFileInfo()?.title || "presentation").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80));
const validSlug = computed(() => /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(slug.value));
const currentPublication = computed(() => files.value.find(file =>
  file.fileId === getFileInfo()?.id && file.slug === slug.value));
const error = ref("");
const progress = ref("");
const busy = ref(false);

function cacheCredential(credential: string) {
  try {
    if (credential) localStorage.setItem(sessionKey, credential);
    else localStorage.removeItem(sessionKey);
  } catch { /* Sign-in still works when browser storage is unavailable. */ }
}

onMounted(async () => {
  if (!cloudflareGoogleClientId) return;
  let credential = "";
  try { credential = localStorage.getItem(sessionKey) || ""; } catch { return; }
  if (!credential) return;
  restoringSession.value = true;
  try { await signIn({ credential }); }
  finally { restoringSession.value = false; }
});

async function signIn(response: { credential?: string }) {
  error.value = "";
  try {
    if (!response.credential) throw new Error("Google did not return a sign-in credential");
    token.value = response.credential;
    user.value = await cloudflareRequest(token.value, "/me");
    files.value = await listCloudflareFiles(token.value);
    cacheCredential(token.value);
  } catch (cause) {
    signOut();
    error.value = cause instanceof Error ? cause.message : "Sign-in failed";
  }
}
function signOut() {
  cacheCredential("");
  token.value = "";
  user.value = null;
  files.value = [];
  progress.value = "";
}
async function publish() {
  if (busy.value || !validSlug.value) return;
  if (files.value.length >= 3 && !files.value.some(file => file.slug === slug.value)) {
    progress.value = "";
    error.value = "You can publish up to 3 documents per Google account. Unpublish an existing document before publishing another.";
    return;
  }
  const file = getFileInfo();
  busy.value = true;
  error.value = "";
  try {
    const published = await publishToCloudflare(token.value, slug.value, file, message => progress.value = message);
    if (getFileInfo()?.id === file.id) {
      updateFile({ publish: { ...getFileInfo().publish, cloudflare: published } });
      await saveDexie();
    }
    files.value = await listCloudflareFiles(token.value);
    progress.value = "Published";
  } catch (cause) {
    progress.value = "";
    error.value = cause instanceof Error ? cause.message : "Publishing failed";
  } finally { busy.value = false; }
}
async function copyLink(url: string) {
  try { await navigator.clipboard.writeText(url); }
  catch { error.value = "Unable to copy the link"; }
}
function unpublish(file: PublishedCloudflareFile) {
  dialog.warning({ title: "Unpublish", content: `Remove ${file.title || file.slug} from ${cloudflarePublicHost}?`,
    positiveText: "Unpublish", negativeText: "Cancel", onPositiveClick: async () => {
      busy.value = true;
      error.value = "";
      try {
        await cloudflareRequest(token.value, `/files/${file.slug}`, { method: "DELETE" });
        if (getFileInfo()?.id === file.fileId &&
          getFileInfo()?.publish?.cloudflare?.slug === file.slug) {
          updateFile({ publish: { ...getFileInfo().publish, cloudflare: null } });
          await saveDexie();
        }
        files.value = await listCloudflareFiles(token.value);
      } catch (cause) {
        error.value = cause instanceof Error ? cause.message : "Unpublish failed";
      } finally { busy.value = false; }
    } });
}
</script>
