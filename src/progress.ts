// Trail progress: what the child knows, per word and per language, with spaced review.
// Each language is its own trail (own stages, stars and sessions). Stored in localStorage 'pg.trail'.
import { LANGS, readPref, writePref, type Lang } from './settings';

const KEY = 'pg.trail';
export const MASTERED_AT = 3; // three correct answers in a row = mastered in that language

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Review intervals by streak: after the 1st hit 1 h, then 1, 3, 7 and 14 days. */
const INTERVALS = [HOUR, DAY, 3 * DAY, 7 * DAY, 14 * DAY];

export interface Entry {
  streak: number;
  ok: number;
  bad: number;
  last: number;
  due: number;
}

export interface StageProgress {
  stars: 0 | 1 | 2 | 3;
  plays: number;
}

interface TrailState {
  words: Record<string, Partial<Record<Lang, Entry>>>;
  stages: Record<string, StageProgress>; // key: `${lang}:${stageId}`
  sessions: Partial<Record<Lang, number>>;
}

const fresh = (): TrailState => ({ words: {}, stages: {}, sessions: {} });

function load(): TrailState {
  try {
    const raw = readPref(KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw) as Partial<TrailState> & { sessions?: unknown };
    const sessions = parsed.sessions && typeof parsed.sessions === 'object' ? (parsed.sessions as TrailState['sessions']) : {};
    // Stage keys from the old shared trail (no language prefix) are dropped.
    const stages = Object.fromEntries(Object.entries(parsed.stages ?? {}).filter(([k]) => k.includes(':')));
    return { words: parsed.words ?? {}, stages, sessions };
  } catch {
    return fresh();
  }
}

let state = load();
const save = (): void => writePref(KEY, JSON.stringify(state));

// ---------- per word / language ----------
export const entry = (id: string, lang: Lang): Entry | undefined => state.words[id]?.[lang];

export const isMastered = (id: string, lang: Lang): boolean => (entry(id, lang)?.streak ?? 0) >= MASTERED_AT;

export function record(id: string, lang: Lang, correct: boolean, now = Date.now()): Entry {
  const e = state.words[id]?.[lang] ?? { streak: 0, ok: 0, bad: 0, last: 0, due: 0 };
  if (correct) {
    e.streak += 1;
    e.ok += 1;
    e.due = now + INTERVALS[Math.min(e.streak, INTERVALS.length) - 1];
  } else {
    e.streak = 0;
    e.bad += 1;
    e.due = now;
  }
  e.last = now;
  (state.words[id] ??= {})[lang] = e;
  save();
  return e;
}

/** Among `ids`, the words already seen in `lang` whose review is due, most overdue first. */
export function dueWords(ids: readonly string[], lang: Lang, now = Date.now()): string[] {
  return ids
    .map((id) => ({ id, e: entry(id, lang) }))
    .filter((x): x is { id: string; e: Entry } => !!x.e && x.e.due <= now)
    .sort((a, b) => a.e.due - b.e.due)
    .map((x) => x.id);
}

export const masteredCount = (ids: readonly string[], lang: Lang): number =>
  ids.filter((id) => isMastered(id, lang)).length;

// ---------- stages (per language) ----------
const key = (lang: Lang, id: string): string => `${lang}:${id}`;

export const stage = (lang: Lang, id: string): StageProgress => state.stages[key(lang, id)] ?? { stars: 0, plays: 0 };

export function finishStage(lang: Lang, id: string, stars: 1 | 2 | 3): StageProgress {
  const s = stage(lang, id);
  const next: StageProgress = { stars: Math.max(s.stars, stars) as 1 | 2 | 3, plays: s.plays + 1 };
  state.stages[key(lang, id)] = next;
  state.sessions[lang] = (state.sessions[lang] ?? 0) + 1;
  save();
  return next;
}

export function countReviewSession(lang: Lang): void {
  state.sessions[lang] = (state.sessions[lang] ?? 0) + 1;
  save();
}

export const sessions = (lang: Lang): number => state.sessions[lang] ?? 0;

/** Erases one language's trail (its stages and its word entries); the others are untouched. */
export function reset(lang: Lang): void {
  for (const k of Object.keys(state.stages)) if (k.startsWith(`${lang}:`)) delete state.stages[k];
  for (const id of Object.keys(state.words)) delete state.words[id][lang];
  delete state.sessions[lang];
  save();
}

export const trailLangs = (): readonly Lang[] => LANGS;
