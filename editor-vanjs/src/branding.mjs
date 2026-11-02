// Embedded SVG keeps the DESQ mark available in exported, offline editors.
export const desqLogoSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#123d37"/><path d="M13 12h16v40H13z" fill="#c9f56a"/><path d="M35 12a20 20 0 0 1 0 40z" fill="#42dfb3"/></svg>';
export const desqLogoURL = `data:image/svg+xml,${encodeURIComponent(desqLogoSVG)}`;
export function installEditorBranding() {
  let icon = document.head.querySelector('link[rel="icon"]');
  if (!icon) { icon = document.createElement('link'); icon.rel = 'icon'; document.head.append(icon); }
  icon.type = 'image/svg+xml'; icon.href = desqLogoURL;
}
