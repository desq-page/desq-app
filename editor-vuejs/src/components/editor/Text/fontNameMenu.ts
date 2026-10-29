import { ref } from "vue";
import { LogoGoogle } from "@vicons/carbon";
import { DeviceLaptop, FileUpload, Palette, History } from "@vicons/tabler";

export function createSystemFontSource(
  queryFonts = () => (window as any).queryLocalFonts?.bind(window),
  queryPermission = () => window.navigator?.permissions?.query({ name: "local-fonts" as PermissionName }),
) {
  const installed = ref<string[]>([]);
  const querying = ref(false);
  const installedLoaded = ref(false);
  const installedMessage = ref("");
  async function requestInstalled() {
    if (querying.value || installedLoaded.value) return;
    const query = queryFonts();
    if (typeof query !== "function") {
      installedMessage.value = "System font access is unavailable in this browser";
      return;
    }
    querying.value = true;
    installedMessage.value = "";
    try {
      // Call directly from the menu click to preserve browser user activation.
      const fonts = await query();
      installed.value = [...new Set<string>(fonts.map(font => font.family).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
      installedLoaded.value = true;
      if (!installed.value.length) installedMessage.value = "No installed fonts were returned";
    } catch (error) {
      installedMessage.value = error?.name === "NotAllowedError"
        ? "System font access was denied. Allow it in your browser settings."
        : "Unable to access system fonts. Try again.";
    } finally {
      querying.value = false;
    }
  }

  async function loadIfGranted() {
    try {
      const permission = await queryPermission();
      if (permission?.state === "granted") await requestInstalled();
    } catch {
      // Unsupported permission queries must never fall back to prompting.
    }
  }

  return { families: installed, loading: querying, loaded: installedLoaded, message: installedMessage,
    request: requestInstalled, loadIfGranted };

}

export const systemFontSource = createSystemFontSource();


type RecentFontType = "system" | "google" | "uploaded";
type RecentFont = { family: string; type?: RecentFontType };
const RECENT_FONT_KEY = "editor-recent-font-families";
function readRecentFonts(): RecentFont[] {
  try {
    const fonts = JSON.parse(window.localStorage?.getItem(RECENT_FONT_KEY) || "[]");
    if (!Array.isArray(fonts)) return [];
    const unique = new Map<string, RecentFont>();
    for (const value of fonts) {
      const font = typeof value === "string" ? { family: value } : value;
      if (typeof font?.family !== "string" || !font.family.trim() || unique.has(font.family)) continue;
      unique.set(font.family, { family: font.family,
        ...(["system", "google", "uploaded"].includes(font.type) ? { type: font.type } : {}) });
    }
    return [...unique.values()].slice(0, 10);
  } catch { return []; }
}
export const recentFontFamilies = ref<RecentFont[]>(readRecentFonts());

export function rememberFontFamily(family: string, type?: RecentFontType) {
  if (!family?.trim()) return;
  const previous = recentFontFamilies.value.find(font => font.family === family);
  recentFontFamilies.value = [{ family, type: type || previous?.type },
    ...recentFontFamilies.value.filter(font => font.family !== family)].slice(0, 10);
  try { window.localStorage?.setItem(RECENT_FONT_KEY, JSON.stringify(recentFontFamilies.value)); } catch { /* Optional preference storage. */ }
}

export function themeFontFamilies(theme) {
  const scheme = (theme?.theme?.themeElements || theme?.themeElements || theme)?.fontScheme;
  return [["majorFont", "Headings"], ["minorFont", "Body"]].flatMap(([key, role]) => {
    const family = scheme?.[key]?.latin?.$_typeface;
    return family ? [{ family, role }] : [];
  });
}

export function createFontNameMenu({ getFonts, getThemeFonts = () => [], applyFont, loadUploadedFont, loadGoogleFont, openPanel, systemFonts = systemFontSource }) {
  function fontType(family): RecentFontType {
    const fonts = getFonts() || [];
    if (fonts.some(font => font.family === family && font.type === "local" && font.name)) return "uploaded";
    if (fonts.some(font => font.family === family && font.type === "google")) return "google";
    return "system";
  }
  function selectFont(family, type: RecentFontType = fontType(family)) {
    if (type === "uploaded") {
      const uploaded = (getFonts() || []).find(font => font.family === family && font.type === "local" && font.name);
      if (uploaded) loadUploadedFont(uploaded);
    } else if (type === "google") loadGoogleFont(family);
    rememberFontFamily(family, type);
    applyFont(family);
  }
  const fontOption = (source, family, label = family, type?: RecentFontType) => ({
    label, key: `${source}:${family}:${label}`, onClick: () => selectFont(family, type),
  });
  function options() {
    const theme = getThemeFonts() || [];
    return [
      { type: "group", label: "Theme Fonts", key: "theme-fonts", icon: Palette, children: theme.length
        ? theme.map(font => fontOption("theme", font.family, `${font.family} (${font.role})`))
        : [{ label: "No theme fonts", key: "empty-theme-fonts", disabled: true }],
      },
      { type: "group", label: "Recent Fonts", key: "recent-fonts", icon: History, children: recentFontFamilies.value.length
        ? recentFontFamilies.value.map(font => {
          const type = font.type || fontType(font.family);
          const label = { system: "System", google: "Google", uploaded: "Uploaded" }[type];
          return fontOption("recent", font.family, `${font.family} (${label})`, type);
        })
        : [{ label: "No recent fonts", key: "empty-recent-fonts", disabled: true }],
      },
      { type: "divider", key: "font-panels-divider" },
      { label: "Google Fonts…", key: "google-fonts", icon: LogoGoogle, onClick: () => openPanel("googlefonts") },
      { label: "Uploaded Fonts…", key: "uploaded-fonts", icon: FileUpload, onClick: () => openPanel("localfonts") },
      { label: "System Fonts (restricted)…", key: "system-fonts", icon: DeviceLaptop, onClick: () => openPanel("systemfonts") },
    ];
  }
  return { options };
}
