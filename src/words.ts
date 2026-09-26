import data from '../data/words.json';
import type { Lang } from './settings';

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
  emoji: string;
  pt: Translation;
  en: Translation;
  ja: Translation;
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

export const byCategory = (cat: string): Word[] => WORDS.filter((w) => w.cat === cat);
export const categoryOf = (id: string): Category | undefined => CATEGORIES.find((c) => c.id === id);

const BASE = import.meta.env.BASE_URL;

export const imgUrl = (id: string): string => `${BASE}img/${id}.png`;

export const audioUrl = (lang: Lang, id: string, kind: 'w' | 'q' = 'w'): string =>
  `${BASE}audio/${lang}/${kind === 'q' ? 'q_' : ''}${id}.mp3`;

/** Text handed to the Web Speech fallback when an MP3 cannot be played. */
export const speechText = (w: Word, lang: Lang, kind: 'w' | 'q' = 'w'): string =>
  kind === 'q' ? w[lang].q : (w[lang].tts ?? w[lang].w);
