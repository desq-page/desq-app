import { ref } from "vue";
import catalog from "./catalog.json";

const storageKey = "desq.editor.language";
export const languages = [
  { code: "en", name: "English" },
  { code: "zh-Hans", name: "简体中文" },
  { code: "vi", name: "Tiếng Việt" },
  { code: "id", name: "Bahasa Indonesia" },
] as const;

type Language = typeof languages[number]["code"];
const translationIndex = { en: -1, "zh-Hans": 0, vi: 1, id: 2 };

function savedLanguage(): Language {
  try {
    return languages.find(({ code }) => code === localStorage.getItem(storageKey))?.code ?? "en";
  } catch {
    return "en";
  }
}

export const language = ref<Language>(savedLanguage());
document.documentElement.lang = language.value;

export function setLanguage(code: Language) {
  language.value = code;
  document.documentElement.lang = code;
  try {
    localStorage.setItem(storageKey, code);
  } catch {
    // Keep the selection for this session when storage is unavailable.
  }
}

export function translate(source: string | undefined): string {
  if (!source) return "";
  return (catalog as Record<string, string[]>)[source]?.[translationIndex[language.value]] ?? source;
}

export function translateProgress(message: string | undefined): string {
  if (!message) return "";
  const pdf = /^Importing PDF page (\d+) of (\d+)…$/.exec(message);
  if (pdf) {
    return translate("Importing PDF page {page} of {total}…")
      .replace("{page}", pdf[1]).replace("{total}", pdf[2]);
  }
  const importFormat = /^Importing (Publisher|Word|HTML)\.\.\.$/.exec(message);
  if (importFormat) return translate("Importing {format}...").replace("{format}", importFormat[1]);
  const saveFormat = /^Saving (Publisher|Word|HTML) slides\.\.\.$/.exec(message);
  if (saveFormat) return translate("Saving {format} slides...").replace("{format}", saveFormat[1]);
  return translate(message);
}
