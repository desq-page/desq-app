// importScripts('https://unpkg.com/dexie@3.2.2/dist/dexie.js');

import { db, setupDB } from "shared-vuejs/api/db";
import { optimizedVideo } from "shared-vuejs/api/optimized-video";
import { getFileFromOPFS } from "shared-vuejs/api/opfs";

setupDB();

// self.addEventListener("install", async function (event) {
//   self.skipWaiting();
// });

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("message", async (msg) => {
  console.log("message", msg);
  const clients = await self.clients.matchAll({ type: "window" });
  for (const client of clients) {
    client.postMessage(msg);
  }

  if (msg.data.action == "skipWaiting") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", function (e) {
  // Only editor resources live in OPFS. Let the browser handle page navigation,
  // static assets, published content, and API/network failures normally.
  const requestUrl = new URL(e.request.url);
  if (requestUrl.origin !== self.location.origin || !requestUrl.pathname.startsWith("/res/")) return;
  e.respondWith(
    (async () => {
      let url = e.request.url;
      if (url.includes("?")) {
        // bust cache
        url = url.split("?")[0];
      }
      const path = url.substring(url.indexOf("res/")).split("/");
      const fileId = path[1];
      let name = path[3] || path[2]; // image pattern may only have 3 parts
      if (url?.endsWith(".json") /*|| url?.endsWith(".html")*/) {
        name = path[2];
      }
      let data;
      const decodedFileId = decodeURIComponent(fileId);
      const decodedName = decodeURIComponent(name);
      if (decodedName === "webfont.css") {
        try {
          const file = await getFileFromOPFS(`pptx/${encodeURIComponent(decodedFileId)}/_internal/webfont.css`);
          return responseWithFile(e.request, url, file);
        } catch {
          return new Response("Font stylesheet not found", { status: 404 });
        }
      } else if (url.endsWith(".html") && /^index(?:\d+)?\.html$/i.test(decodedName)) {
        try {
          const internalPath = `pptx/${encodeURIComponent(decodedFileId)}/_internal/${encodeURIComponent(decodedName)}`;
          const file = await getFileFromOPFS(internalPath);
          return responseWithFile(e.request, url, file);
        } catch {
          // Read cached Dexie HTML from older packages during migration.
          data = await db?.get("assets", [decodedFileId, decodedName, "html"]);
          if (!data) return new Response("HTML page not found", { status: 404 });
        }
      } else if (url.includes("fonts/")) {
        try {
          const fontPath = path.slice(3).map(decodeURIComponent).join("/");
          const file = await getFileFromOPFS(`pptx/${encodeURIComponent(decodedFileId)}/ppt/fonts/${fontPath}`);
          return responseWithFile(e.request, url, file);
        } catch {
          return new Response("Font not found", { status: 404 });
        }
      } else if (url.includes("media/")) {
        const mediaPath = path.slice(3).map(decodeURIComponent).join("/");
        const basename = mediaPath.split("/").pop() || decodedName;
        const isThumbnail = basename.startsWith("thumb-");
        try {
          const opfsPath = isThumbnail
            ? `thumbnails/${encodeURIComponent(decodedFileId)}/${encodeURIComponent(basename)}`
            : `pptx/${encodeURIComponent(decodedFileId)}/${mediaPath.startsWith("ppt/") ? mediaPath : `ppt/media/${mediaPath || decodedName}`}`;
          const optimized = isThumbnail ? undefined : await optimizedVideo(decodedFileId, mediaPath || decodedName);
          const file = optimized || await getFileFromOPFS(opfsPath);
          return responseWithFile(e.request, url, file, optimized ? "video/mp4" : undefined);
        } catch {
          if (isThumbnail) {
            const transparentGif = new Uint8Array([71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 0, 255, 0, 44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 0, 59]);
            return responseWithHeaders(url, transparentGif);
          }
          return new Response("Media not found", { status: 404 });
        }
      } else if (url.endsWith(".html")) {
        data = await db?.get("assets", [
          decodedFileId,
          decodedName,
          "html",
        ]);
      }
      if (!data && url.includes("thumb-")) {
        // const transparentGif = new Uint8Array(
        //   await fetch("/images/transparent.gif").then((response) =>
        //     response.arrayBuffer(),
        //   ),
        // );
        const transparentGif = new Uint8Array([
          71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 0, 255, 0, 44, 0, 0, 0, 0, 1, 0,
          1, 0, 0, 2, 0, 59,
        ]);

        data = {
          data: transparentGif,
        };
      }

      let extraHeaders = {};
      if (data?.w && data?.h) {
        extraHeaders = {
          "Image-Width": data.w,
          "Image-Height": data.h,
        };
      }
      return responseWithHeaders(url, data?.data, extraHeaders);

    })(),
  ); // end e.respondWith
});

function responseWithHeaders(url, data, extraHeaders = null) {
  // if (response.status == 204) return response;
  // const newHeaders = new Headers(response.headers);
  // // newHeaders.append("Cache-Control", "public, must-revalidate, max-age=604800");
  // newHeaders.append("Content-Encoding", "gzip");
  let headers = {};
  if (url.endsWith(".png")) {
    headers["Content-Type"] = "image/png";
  } else if (url.endsWith(".jpg") || url.endsWith(".jpeg")) {
    headers["Content-Type"] = "image/jpeg";
  } else if (url.endsWith(".webp")) {
    headers["Content-Type"] = "image/webp";
  } else if (url.endsWith(".glb")) {
    headers["Content-Type"] = "model/gltf-binary";
  } else if (url.endsWith(".svg")) {
    headers["Content-Type"] = "image/svg+xml";
  } else if (url.endsWith(".mp4")) {
    headers["Content-Type"] = "video/mp4";
  } else if (url.endsWith(".m4v")) {
    headers["Content-Type"] = "video/x-m4v";
  } else if (url.endsWith(".mov")) {
    headers["Content-Type"] = "video/quicktime";
  } else if (url.endsWith(".wmv")) {
    headers["Content-Type"] = "video/x-ms-wmv";
  } else if (url.endsWith(".avi")) {
    headers["Content-Type"] = "video/x-msvideo";
  } else if (url.endsWith(".webm")) {
    headers["Content-Type"] = "video/webm";
  } else if (url.endsWith(".mp3")) {
    headers["Content-Type"] = "audio/mpeg";
  } else if (url.endsWith(".m4a")) {
    headers["Content-Type"] = "audio/mp4";
  } else if (url.endsWith(".wav")) {
    headers["Content-Type"] = "audio/wav";
  } else if (url.endsWith(".aac")) {
    headers["Content-Type"] = "audio/aac";
  } else if (url.endsWith(".ogg")) {
    headers["Content-Type"] = "audio/ogg";
  } else if (url.endsWith(".tif") || url.endsWith(".tiff")) {
    headers["Content-Type"] = "image/tiff";
  } else if (url.endsWith(".gif")) {
    headers["Content-Type"] = "image/gif";
  } else if (url.endsWith(".bmp")) {
    headers["Content-Type"] = "image/bmp";
  } else if (url.endsWith(".emf")) {
    headers["Content-Type"] = "image/x-emf";
  } else if (url.endsWith(".wmf")) {
    headers["Content-Type"] = "image/x-wmf";
  } else if (url.endsWith(".css")) {
    headers["Content-Type"] = "text/css";
  } else if (url.endsWith(".woff")) {
    headers["Content-Type"] = "font/woff";
  } else if (url.endsWith(".woff2")) {
    headers["Content-Type"] = "font/woff2";
  } else if (url.endsWith(".ttf")) {
    headers["Content-Type"] = "font/ttf";
  } else if (url.endsWith(".otf")) {
    headers["Content-Type"] = "font/otf";
  } else if (url.endsWith(".html")) {
    headers["Content-Type"] = "text/html";
  } else {
    headers["Content-Type"] = "application/octet-stream";
  }

  headers["Content-Length"] = data?.length || 0;

  if (extraHeaders) {
    headers = {
      ...headers,
      ...extraHeaders,
    };
  }

  return new Response(data, {
    headers: new Headers(headers),
  });
}

function responseWithFile(request, url, file, mime) {
  const contentType = mime || responseWithHeaders(url, new Uint8Array(0)).headers.get("Content-Type");
  const range = request.headers.get("Range");
  const headers = new Headers({
    "Content-Type": contentType || "application/octet-stream",
    "Accept-Ranges": "bytes",
  });
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) return new Response(null, { status: 416 });
    const start = match[1] ? Number(match[1]) : Math.max(0, file.size - Number(match[2]));
    const end = match[2] && match[1] ? Math.min(Number(match[2]), file.size - 1) : file.size - 1;
    if (start >= file.size || start > end) {
      headers.set("Content-Range", `bytes */${file.size}`);
      return new Response(null, { status: 416, headers });
    }
    const body = file.slice(start, end + 1, contentType || undefined);
    headers.set("Content-Length", String(end - start + 1));
    headers.set("Content-Range", `bytes ${start}-${end}/${file.size}`);
    return new Response(body, { status: 206, headers });
  }
  headers.set("Content-Length", String(file.size));
  return new Response(file, { headers });
}
