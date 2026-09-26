import data from '../data/words.json';
import type { Lang, Level, LevelChoice } from './settings';

export interface Translation {
  /** The word as displayed (kana for Japanese). */
  w: string;
  /** The quiz question, e.g. "Cadê o cachorro?". */
  q: string;
  kanji?: string;
  romaji?: string;
  /** Optional override of the text sent to text-to-speech. */
  tts?: string;
}

export interface Word {
  id: string;
  cat: string;
  /** 1 = first words (≤ 2 y), 2 = 2–3 y, 3 = 3–4 y, 4 = 4–5 y. */
  level: Level;
  emoji: string;
  pt: Translation;
  en: Translation;
  ja: Translation;
  /** Optional onomatopoeia per language ("au au!", "woof woof!", "ワンワン！"). */
  sound?: Record<Lang, string>;
}

export interface Category {
  id: string;
  icon: string;
  tint: string;
  label: Record<Lang, string>;
}

export const WORDS = data.words as unknown as Word[];
export const CATEGORIES = data.categories as unknown as Category[];

const byId = new Map(WORDS.map((w) => [w.id, w]));

export function getWord(id: string): Word {
  const w = byId.get(id);
  if (!w) throw new Error(`unknown word: ${id}`);
  return w;
}

export const categoryOf = (id: string): Category | undefined => CATEGORIES.find((c) => c.id === id);

const atLevel = (w: Word, level: LevelChoice): boolean => level === 'all' || w.level === level;

/** Words of one category (or 'all') at one level (or 'all'); `withSound` keeps only words that have a sound. */
export const wordsFor = (cat: string, level: LevelChoice, withSound = false): Word[] =>
  WORDS.filter((w) => (cat === 'all' || w.cat === cat) && atLevel(w, level) && (!withSound || !!w.sound));

/** Categories that have at least one matching word, in display order. */
export const categoriesFor = (level: LevelChoice, withSound = false): Category[] =>
  CATEGORIES.filter((c) => wordsFor(c.id, level, withSound).length > 0);

const BASE = import.meta.env.BASE_URL;

export const imgUrl = (id: string): string => `${BASE}img/${id}.png`;

const PREFIX = { w: '', q: 'q_', s: 's_' } as const;

export const audioUrl = (lang: Lang, id: string, kind: 'w' | 'q' | 's' = 'w'): string =>
  `${BASE}audio/${lang}/${PREFIX[kind]}${id}.mp3`;

/** Text handed to the Web Speech fallback when an MP3 cannot be played. */
export const speechText = (w: Word, lang: Lang, kind: 'w' | 'q' = 'w'): string =>
  kind === 'q' ? w[lang].q : (w[lang].tts ?? w[lang].w);
