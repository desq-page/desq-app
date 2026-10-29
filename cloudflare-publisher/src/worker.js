import { agentRequest } from './agent.js';
export { AgentSession } from './agent.js';

const MAX_FILES = 400;
const MAX_PUBLICATIONS = 3;
const PUBLICATION_LIMIT_MESSAGE = "You can publish up to 3 documents per Google account. Unpublish an existing document before publishing another.";
const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const MAX_PUBLICATION_BYTES = 250 * 1024 * 1024;
let googleKeys;
let keysExpireAt = 0;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function requireValue(condition, status, message) {
  if (!condition) throw new HttpError(status, message);
}
function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
function slugValue(value) {
  requireValue(/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(value), 400, "Invalid file name");
  return value;
}
function assetPath(value) {
  requireValue(typeof value === "string" && value.length <= 512 &&
    !/[\\%?#\u0000-\u001f]/.test(value) &&
    value.split("/").every(part => part && part !== "." && part !== ".." && !part.startsWith("_")),
    400, "Invalid asset path");
  return value;
}
function manifestKey(userId, slug) { return `_private/published/${userId}/${slug}.json`; }
function uploadKey(userId, slug, revision) { return `_private/uploads/${userId}/${slug}/${revision}.json`; }
function contentPrefix(manifest) {
  return `${manifest.username}/${manifest.slug}/_revisions/${manifest.revision}/`;
}
async function readJson(bucket, key) {
  const object = await bucket.get(key);
  return object ? { object, value: await object.json() } : null;
}
async function checkPublicationLimit(bucket, userId, key) {
  if (await bucket.head(key)) return;
  const page = await bucket.list({ prefix: `_private/published/${userId}/`, limit: MAX_PUBLICATIONS });
  requireValue(page.objects.length < MAX_PUBLICATIONS, 403, PUBLICATION_LIMIT_MESSAGE);
}

// Serialize new publication commits across Worker instances for this account.
async function withPublicationLock(bucket, userId, action) {
  const key = `_private/publication-locks/${userId}.json`;
  const existing = await readJson(bucket, key);
  requireValue(!existing || existing.value.expires <= Date.now(), 409,
    "Another publication is finishing. Please try again shortly.");
  const condition = (etag) => new Headers(etag
    ? { "If-Match": `"${etag}"` } : { "If-None-Match": "*" });
  const lock = await bucket.put(key, JSON.stringify({ expires: Date.now() + 60000 }), {
    onlyIf: condition(existing?.object.etag),
  });
  requireValue(lock, 409, "Another publication is finishing. Please try again shortly.");
  try { return await action(); }
  finally {
    await bucket.put(key, JSON.stringify({ expires: 0 }), { onlyIf: condition(lock.etag) });
  }
}
async function boundedBody(request, limit) {
  const length = Number(request.headers.get("Content-Length"));
  requireValue(!length || length <= limit, 413, "Upload is too large");
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new HttpError(413, "Upload is too large");
    }
    chunks.push(value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}
function decodeBase64Url(value) {
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
}
async function googleUser(request, env) {
  const token = request.headers.get("Authorization")?.match(/^Bearer ([^ ]+)$/)?.[1];
  requireValue(token && token.length < 10000, 401, "Sign in with Google to publish");
  try {
    const parts = token.split(".");
    requireValue(parts.length === 3, 401, "Invalid Google token");
    const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
    const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
    requireValue(header.alg === "RS256" && typeof header.kid === "string", 401, "Invalid Google token");
    if (!googleKeys || Date.now() >= keysExpireAt || !googleKeys.some(key => key.kid === header.kid)) {
      const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
      requireValue(response.ok, 503, "Google sign-in verification is unavailable");
      googleKeys = (await response.json()).keys;
      const maxAge = Number(response.headers.get("Cache-Control")?.match(/max-age=(\d+)/)?.[1] || 300);
      keysExpireAt = Date.now() + Math.min(maxAge, 86400) * 1000;
    }
    const jwk = googleKeys.find(key => key.kid === header.kid);
    requireValue(jwk, 401, "Invalid Google signing key");
    const key = await crypto.subtle.importKey("jwk", jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key,
      decodeBase64Url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    const now = Date.now() / 1000;
    requireValue(valid && claims.aud === env.GOOGLE_CLIENT_ID &&
      (!claims.azp || claims.azp === env.GOOGLE_CLIENT_ID) &&
      ["accounts.google.com", "https://accounts.google.com"].includes(claims.iss) &&
      typeof claims.exp === "number" && claims.exp > now &&
      typeof claims.iat === "number" && claims.iat <= now + 60 &&
      typeof claims.sub === "string" && /^\d{1,64}$/.test(claims.sub),
      401, "Google sign-in expired or is invalid; sign in again");
    const username = await accountUsername(env.CONTENT, claims.sub, claims.email, claims.email_verified);
    return { userId: claims.sub, username, name: claims.name || "Google user" };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, "Invalid Google token");
  }
}
async function accountUsername(bucket, userId, email, emailVerified) {
  requireValue(emailVerified === true && typeof email === "string" && email.includes("@"),
    401, "Google must provide a verified email address to publish");
  const username = email.slice(0, email.indexOf("@"));
  requireValue(/^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/.test(username),
    400, "Your email username cannot be used as a publication folder");
  requireValue(!reservedUsernames.has(username.toLowerCase()), 409,
    "Your email username is reserved for a Savanna site address");
  const profileKey = `_private/users/${userId}.json`;
  const aliasKey = `_private/usernames/${username}.json`;
  const alias = await readJson(bucket, aliasKey);
  requireValue(!alias || alias.value.userId === userId, 409,
    "This email username is already used by another Google account");
  if (!alias) {
    const claimed = await bucket.put(aliasKey, JSON.stringify({ userId }),
      { onlyIf: new Headers({ "If-None-Match": "*" }) });
    if (!claimed) {
      const owner = await readJson(bucket, aliasKey);
      requireValue(owner?.value.userId === userId, 409,
        "This email username is already used by another Google account");
    }
  }
  await bucket.put(profileKey, JSON.stringify({ username }));
  return username;
}
function publicationInfo(manifest, env, currentUsername) {
  const { userId, slug, fileId, title, slides, size, timestamp } = manifest;
  const username = currentUsername || manifest.username || userId;
  return { userId, username, slug, fileId, title, slides, size, timestamp,
    url: `${env.PUBLIC_ORIGIN}/${encodeURIComponent(username)}/${slug}` };
}
async function api(request, env, url, ctx) {
  const user = await googleUser(request, env);
  if (url.pathname === "/api/me" && request.method === "GET") return json(user);
  if (url.pathname === "/api/files" && request.method === "GET") {
    const files = [];
    let cursor = url.searchParams.get("cursor") || undefined;
    do {
      const page = await env.CONTENT.list({ prefix: `_private/published/${user.userId}/`, cursor, limit: 100 });
      for (const item of page.objects) {
        const record = await readJson(env.CONTENT, item.key);
        if (record) files.push(publicationInfo(record.value, env, user.username));
      }
      cursor = page.truncated ? page.cursor : undefined;
      // Paginate the response to keep Worker subrequests bounded.
      if (cursor) return json({ files, cursor });
    } while (cursor);
    return json({ files });
  }
  const match = url.pathname.match(/^\/api\/files\/([^/]+)(?:\/uploads(?:\/([a-f0-9-]+)(?:\/(assets|commit))?)?)?$/);
  requireValue(match, 404, "Endpoint not found");
  const slug = slugValue(match[1]);
  const key = manifestKey(user.userId, slug);
  if (request.method === "DELETE" && url.pathname === `/api/files/${slug}`) {
    const existing = await readJson(env.CONTENT, key);
    await env.CONTENT.delete(key);
    if (existing) ctx.waitUntil(removeRevision(env.CONTENT, existing.value));
    return json({ deleted: true });
  }
  if (request.method === "POST" && url.pathname === `/api/files/${slug}/uploads`) {
    await checkPublicationLimit(env.CONTENT, user.userId, key);
    let body;
    try { body = JSON.parse(new TextDecoder().decode(await boundedBody(request, 256 * 1024))); }
    catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(400, "Invalid publication manifest");
    }
    requireValue(body && typeof body === "object", 400, "Invalid publication manifest");
    requireValue(typeof body.fileId === "string" && body.fileId.length > 0 && body.fileId.length <= 128,
      400, "Missing file ID");
    requireValue(Array.isArray(body.files) && body.files.length > 0 && body.files.length <= MAX_FILES,
      400, `A publication must contain 1–${MAX_FILES} assets`);
    const paths = new Set();
    let size = 0;
    const files = body.files.map(file => {
      requireValue(file && typeof file === "object", 400, "Invalid asset manifest");
      const path = assetPath(file.path);
      requireValue(!paths.has(path), 400, "Duplicate asset path");
      paths.add(path);
      requireValue(Number.isSafeInteger(file.size) && file.size >= 0 && file.size <= MAX_ASSET_BYTES,
        413, "An asset exceeds the 25 MiB limit");
      size += file.size;
      return { path, size: file.size };
    });
    requireValue(paths.has("index.html"), 400, "Publication needs index.html");
    requireValue(size <= MAX_PUBLICATION_BYTES, 413, "Publication exceeds 250 MiB");
    const existing = await readJson(env.CONTENT, key);
    requireValue(!existing || existing.value.fileId === body.fileId, 409, "URL already belongs to another file");
    const revision = crypto.randomUUID();
    const manifest = { ...user, slug, revision, fileId: body.fileId,
      title: String(body.title || slug).slice(0, 200), slides: Number(body.slides) || 0,
      files, size, timestamp: Date.now(), expires: Date.now() + 3600000,
      previousEtag: existing?.object.etag || null,
      previousManifest: existing ? { userId: existing.value.userId, slug: existing.value.slug,
        username: existing.value.username,
        revision: existing.value.revision, files: existing.value.files } : null };
    await env.CONTENT.put(uploadKey(user.userId, slug, revision), JSON.stringify(manifest));
    return json({ revision }, 201);
  }
  const revision = match[2];
  requireValue(revision && /^[a-f0-9-]{36}$/.test(revision), 404, "Upload not found");
  const upload = await readJson(env.CONTENT, uploadKey(user.userId, slug, revision));
  requireValue(upload && upload.value.expires > Date.now(), 410, "Upload expired; publish again");
  const manifest = upload.value;
  const prefix = contentPrefix(manifest);
  if (request.method === "PUT" && match[3] === "assets") {
    const path = assetPath(url.searchParams.get("path"));
    const file = manifest.files.find(item => item.path === path);
    requireValue(file, 400, "Asset is not part of this upload");
    const body = await boundedBody(request, MAX_ASSET_BYTES);
    requireValue(body.byteLength === file.size, 400, "Asset size does not match manifest");
    await env.CONTENT.put(prefix + path, body, { httpMetadata: { contentType: contentType(path, body) } });
    return json({ uploaded: path });
  }
  if (request.method === "POST" && match[3] === "commit") {
    for (const file of manifest.files) {
      const asset = await env.CONTENT.head(prefix + file.path);
      requireValue(asset?.size === file.size, 409, "Upload incomplete; previous publication is unchanged");
    }
    // Conditional put makes the completed revision visible in one operation.
    const { previousManifest, previousEtag, expires, ...published } = manifest;
    const saved = await withPublicationLock(env.CONTENT, user.userId, async () => {
      await checkPublicationLimit(env.CONTENT, user.userId, key);
      return env.CONTENT.put(key, JSON.stringify(published), {
        onlyIf: new Headers(manifest.previousEtag
          ? { "If-Match": `"${manifest.previousEtag}"` }
          : { "If-None-Match": "*" }),
      });
    });
    requireValue(saved, 409, "Publication changed during upload; publish again");
    ctx.waitUntil(env.CONTENT.delete(uploadKey(user.userId, slug, revision)));
    if (previousManifest) ctx.waitUntil(removeRevision(env.CONTENT, previousManifest));
    return json(publicationInfo(manifest, env));
  }
  throw new HttpError(405, "Method not allowed");
}
async function removeRevision(bucket, manifest) {
  const prefix = contentPrefix(manifest);
  await bucket.delete(manifest.files.map(file => prefix + file.path));
}
function contentType(path, body) {
  // Imported images can be converted to WebP while retaining .png/.jpg names.
  if (body && /\.(png|jpe?g|gif|webp)$/i.test(path)) {
    const magic = new TextDecoder().decode(body.subarray(0, 12));
    if (magic.startsWith("RIFF") && magic.endsWith("WEBP")) return "image/webp";
    if (body[0] === 0x89 && body[1] === 0x50 && body[2] === 0x4e && body[3] === 0x47) return "image/png";
    if (body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return "image/jpeg";
    if (magic.startsWith("GIF8")) return "image/gif";
  }
  // Optimized videos retain their original URL, including .mov/.avi names.
  if (body && /\.(mp4|m4v|mov|avi)$/i.test(path) && body.length >= 12) {
    const header = new TextDecoder().decode(body.subarray(4, 12));
    if (header.startsWith("ftyp")) return header.slice(4) === "qt  " ? "video/quicktime" : "video/mp4";
  }
  const ext = path.split(".").pop().toLowerCase();
  return ({ html: "text/html; charset=utf-8", css: "text/css; charset=utf-8",
    js: "application/javascript; charset=utf-8", json: "application/json", webmanifest: "application/manifest+json",
    svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    webp: "image/webp", avif: "image/avif", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf",
    otf: "font/otf", mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", avi: "video/x-msvideo", webm: "video/webm", mp3: "audio/mpeg", wav: "audio/wav",
    pdf: "application/pdf" })[ext] || "application/octet-stream";
}
async function publicContent(request, env, url) {
  requireValue(["GET", "HEAD"].includes(request.method), 405, "Method not allowed");
  const match = url.pathname.match(/^\/([^/]+)\/([a-z0-9-]+)(?:\/(.*))?$/);
  requireValue(match, 404, "Invalid publication URL. Expected /username/file-name/");
  const [, encodedUsername, slug, relative] = match;
  const username = decodeURIComponent(encodedUsername);
  const alias = await readJson(env.CONTENT, `_private/usernames/${username}.json`);
  const userId = alias?.value.userId;
  requireValue(userId, 404, "Publication account not found. Open Publish and sign in again to register your email username.");
  const record = await readJson(env.CONTENT, manifestKey(userId, slugValue(slug)));
  requireValue(record, 404, "Published document not found for this account. Publish the document again.");
  if (relative === undefined) {
    url.pathname += "/"; // Relative player and media URLs need the folder base.
    return Response.redirect(url.toString(), 308);
  }
  const path = assetPath(decodeURIComponent(relative || "index.html"));
  requireValue(record.value.files.some(file => file.path === path), 404, "Asset not found");
  const key = contentPrefix(record.value) + path;
  const object = await env.CONTENT.get(key, { range: request.headers });
  requireValue(object, 404, "Asset not found");
  const headers = new Headers({ "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*", "Accept-Ranges": "bytes", ETag: object.httpEtag });
  object.writeHttpMetadata(headers);
  // User-authored HTML and SVG must not share the editor's security origin.
  if (/\.(html|svg)$/i.test(path)) {
    headers.set("Content-Security-Policy", "sandbox allow-scripts allow-forms allow-popups allow-downloads");
    headers.set("Referrer-Policy", "no-referrer");
  }
  if (request.headers.get("If-None-Match") === object.httpEtag) return new Response(null, { status: 304, headers });
  let status = 200;
  if (object.range && object.range.length > 0) {
    status = 206;
    headers.set("Content-Range", `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
    headers.set("Content-Length", String(object.range.length));
  } else headers.set("Content-Length", String(object.size));
  return new Response(request.method === "HEAD" ? null : object.body, { status, headers });
}
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/agent' || url.pathname.startsWith('/api/agent/')) return agentRequest(request, env);
    const isApi = url.pathname.startsWith("/api/");
    const origin = request.headers.get("Origin");
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).includes(origin);
    let response;
    try {
      if (isApi) {
        requireValue(url.origin === env.API_ORIGIN, 404, "Endpoint not found");
        requireValue(!origin || allowed, 403, "Editor origin is not allowed");
        if (request.method === "OPTIONS") response = new Response(null, { status: 204 });
        else response = await api(request, env, url, ctx);
      } else {
        requireValue(url.origin === env.PUBLIC_ORIGIN, 404, "Publication host does not match PUBLIC_ORIGIN");
        if (/^\/edit\/[^/]+\/?$/.test(url.pathname)) {
          requireValue(["GET", "HEAD"].includes(request.method), 405, "Method not allowed");
          console.log({ timestamp: new Date().toISOString() });
          // HEAD records SPA navigation without downloading the editor HTML again.
          response = request.method === "HEAD"
            ? new Response(null, { status: 204 })
            : await env.ASSETS.fetch(request);
          response = new Response(response.body, response);
          response.headers.set("Cache-Control", "no-store");
        } else if (url.pathname === '/powerpoint-addin') {
          requireValue(['GET', 'HEAD'].includes(request.method), 405, 'Method not allowed');
          url.pathname += '/';
          response = Response.redirect(url.toString(), 308);
        } else if (url.pathname.startsWith('/powerpoint-addin/') && !(env.APP_LARGE_ASSET_PATHS || '').split(',').includes(url.pathname)) {
          requireValue(['GET', 'HEAD'].includes(request.method), 405, 'Method not allowed');
          response = await env.ASSETS.fetch(request);
        } else if (isPublishedPath(url.pathname)) {
          // Missing publications must return 404, never the editor SPA shell.
          response = await publicContent(request, env, url);
        } else if ((env.APP_LARGE_ASSET_PATHS || "").split(",").includes(url.pathname)) {
          requireValue(["GET", "HEAD"].includes(request.method), 405, "Method not allowed");
          const object = await env.APP_FILES.get(url.pathname.slice(1));
          requireValue(object, 404, "Application asset not found");
          const headers = new Headers({ "Cache-Control": "public, max-age=3600", ETag: object.httpEtag,
            "X-Content-Type-Options": "nosniff" });
          object.writeHttpMetadata(headers);
          response = new Response(request.method === "HEAD" ? null : object.body, { headers });
        } else {
          requireValue(["GET", "HEAD"].includes(request.method), 405, "Method not allowed");
          response = await env.ASSETS.fetch(request);
        }
      }
    } catch (error) {
      if (!(error instanceof HttpError)) console.error("Publisher request failed", error.name);
      response = json({ error: error instanceof HttpError ? error.message : "Publishing service failed" },
        error instanceof HttpError ? error.status : 500);
    }
    if (isApi && allowed) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Vary", "Origin");
      response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
      response.headers.set("Access-Control-Max-Age", "600");
    }
    return response;
  },
};
import { reservedUsernames, isPublishedPath } from "shared-vuejs/api/lib-published-path";
