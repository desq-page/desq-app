import { createPackageEntries } from "shared-vuejs/api/export-zip";
import { exportFile } from "shared-vuejs/api/html";
import { saveDexie } from "shared-vuejs/api/dbutils";
import { genPlayerIndexName } from "shared-vuejs/api/slideUtils";

export const cloudflareApiOrigin = (import.meta.env.VITE_CLOUDFLARE_PUBLISH_API ||
  "https://publish-api.desq.page").replace(/\/$/, "");
export const cloudflarePublicOrigin = (import.meta.env.VITE_CLOUDFLARE_PUBLIC_ORIGIN ||
  "https://desq.page").replace(/\/$/, "");
export const cloudflareGoogleClientId = import.meta.env.VITE_CLOUDFLARE_GOOGLE_CLIENT_ID || "519623835982-3oo1a0hka006t79o3j1qqk0u1vsm5de7.apps.googleusercontent.com";

export type PublishedCloudflareFile = {
  userId: string; username: string; slug: string; fileId: string; title: string;
  slides: number; size: number; timestamp: number; url: string;
};

export async function cloudflareRequest(token: string, path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${cloudflareApiOrigin}/api${path}`, {
    ...options, headers, credentials: "omit",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Publishing failed (${response.status})`);
  return data;
}

export async function listCloudflareFiles(token: string): Promise<PublishedCloudflareFile[]> {
  const files: PublishedCloudflareFile[] = [];
  let cursor = "";
  do {
    const page = await cloudflareRequest(token, `/files${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
    files.push(...page.files);
    cursor = page.cursor || "";
  } while (cursor);
  return files.sort((a, b) => b.timestamp - a.timestamp);
}

export async function publishToCloudflare(token: string, slug: string, file: any,
  progress: (message: string) => void): Promise<PublishedCloudflareFile> {
  progress("Preparing HTML...");
  await saveDexie();
  await exportFile(file.id); // Regenerate every slide; do not publish stale cached HTML.
  const pageNames = new Set(file.slides.map((_, index) => genPlayerIndexName(index + 1)));
  const entries = (await createPackageEntries(file.id, true)).filter(entry =>
    !/^index\d*\.html$/i.test(entry.name) || pageNames.has(entry.name));
  const assets = await Promise.all(entries.map(async entry => ({
    path: entry.name,
    blob: entry.input instanceof Blob ? entry.input : new Blob([entry.input]),
  })));
  const { revision } = await cloudflareRequest(token, `/files/${slug}/uploads`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileId: file.id, title: file.title, slides: file.slides.length,
      files: assets.map(asset => ({ path: asset.path, size: asset.blob.size })) }),
  });
  for (let index = 0; index < assets.length; index++) {
    progress(`Uploading ${index + 1} of ${assets.length} assets...`);
    const asset = assets[index];
    await cloudflareRequest(token,
      `/files/${slug}/uploads/${revision}/assets?path=${encodeURIComponent(asset.path)}`,
      { method: "PUT", body: asset.blob });
  }
  progress("Publishing...");
  return cloudflareRequest(token, `/files/${slug}/uploads/${revision}/commit`, { method: "POST" });
}
