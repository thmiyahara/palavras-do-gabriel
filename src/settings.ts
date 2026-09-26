export type Lang = 'pt' | 'en' | 'ja';
/** What the language switcher offers: one language, or all three in sequence. */
export type LangChoice = Lang | 'all';

export const LANGS: readonly Lang[] = ['pt', 'en', 'ja'];
export const BCP47: Record<Lang, string> = { pt: 'pt-BR', en: 'en-US', ja: 'ja-JP' };

const LANG_KEY = 'pg.lang';
const CAT_KEY = 'pg.cat';

export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode or storage blocked: the app still works, just without memory */
  }
}

function isChoice(v: string | null): v is LangChoice {
  return v === 'pt' || v === 'en' || v === 'ja' || v === 'all';
}

type Listener = (lang: LangChoice) => void;
const listeners = new Set<Listener>();

let current: LangChoice = (() => {
  const saved = readPref(LANG_KEY);
  return isChoice(saved) ? saved : 'pt';
})();

export const getLang = (): LangChoice => current;

export function setLang(lang: LangChoice): void {
  if (lang === current) return;
  current = lang;
  writePref(LANG_KEY, lang);
  listeners.forEach((fn) => fn(lang));
}

export function onLangChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Language for the UI chrome (tabs, chips): Portuguese when "all" is selected. */
export const uiLang = (): Lang => (current === 'all' ? 'pt' : current);

export const getCategory = (): string => readPref(CAT_KEY) ?? 'animals';
export const setCategory = (id: string): void => writePref(CAT_KEY, id);
