import { isDockerBackend } from "shared-vuejs/api/backend-config";

export function logEditorOpen(path) {
  if (import.meta.env.PROD && isDockerBackend) return;
  void fetch(path, {
    method: "HEAD",
    cache: "no-store",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    keepalive: true,
  }).catch(() => {});
}
