export type Lang = 'pt' | 'en' | 'ja';
/** What the language switcher offers: one language, or all three in sequence. */
export type LangChoice = Lang | 'all';

export type Level = 1 | 2 | 3;
/** What the level switcher offers: one level, or every word. */
export type LevelChoice = Level | 'all';

export const LANGS: readonly Lang[] = ['pt', 'en', 'ja'];
export const LEVELS: readonly Level[] = [1, 2, 3];
export const BCP47: Record<Lang, string> = { pt: 'pt-BR', en: 'en-US', ja: 'ja-JP' };

/** Correct quiz answers at a level needed to earn its medal. */
export const MEDAL_AT = 25;

const LANG_KEY = 'pg.lang';
const LEVEL_KEY = 'pg.level';
const CAT_KEY = 'pg.cat';
const PROGRESS_KEY = 'pg.progress';

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

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = (): void => listeners.forEach((fn) => fn());

/** Runs `fn` whenever the language or the level changes. */
export function onSettingsChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------- language ----------
function isLangChoice(v: string | null): v is LangChoice {
  return v === 'pt' || v === 'en' || v === 'ja' || v === 'all';
}

let lang: LangChoice = (() => {
  const saved = readPref(LANG_KEY);
  return isLangChoice(saved) ? saved : 'pt';
})();

export const getLang = (): LangChoice => lang;

export function setLang(next: LangChoice): void {
  if (next === lang) return;
  lang = next;
  writePref(LANG_KEY, next);
  emit();
}

/** Language for the UI chrome (tabs, chips): Portuguese when "all" is selected. */
export const uiLang = (): Lang => (lang === 'all' ? 'pt' : lang);

// ---------- level ----------
function parseLevel(v: string | null): LevelChoice {
  if (v === 'all') return 'all';
  const n = Number(v);
  return n === 1 || n === 2 || n === 3 ? n : 1;
}

let level: LevelChoice = parseLevel(readPref(LEVEL_KEY));

export const getLevel = (): LevelChoice => level;

export function setLevel(next: LevelChoice): void {
  if (next === level) return;
  level = next;
  writePref(LEVEL_KEY, String(next));
  emit();
}

// ---------- category + quiz progress ----------
export const getCategory = (): string => readPref(CAT_KEY) ?? 'animals';
export const setCategory = (id: string): void => writePref(CAT_KEY, id);

/** Correct quiz answers per level, e.g. { "1": 12, "2": 3 }. */
export function getProgress(): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(readPref(PROGRESS_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function addProgress(lv: Level): number {
  const p = getProgress();
  p[lv] = (p[lv] ?? 0) + 1;
  writePref(PROGRESS_KEY, JSON.stringify(p));
  return p[lv];
}
