/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLISH_TARGET?: "docker" | "server" | "cloudflare";
  readonly VITE_CLOUDFLARE_PUBLISH_API?: string;
  readonly VITE_CLOUDFLARE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_EDITOR_AGENT_ORIGINS?: string;
}
