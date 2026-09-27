// Trail progress: what the child knows, per word and per language, with spaced review.
// Stored in localStorage 'pg.trail' on this device.
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
  targets: Lang[];
  words: Record<string, Partial<Record<Lang, Entry>>>;
  stages: Record<string, StageProgress>;
  sessions: number;
}

function fresh(): TrailState {
  return { targets: [...LANGS], words: {}, stages: {}, sessions: 0 };
}

function load(): TrailState {
  try {
    const raw = readPref(KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw) as Partial<TrailState>;
    const targets = (parsed.targets ?? []).filter((l): l is Lang => LANGS.includes(l as Lang));
    return {
      targets: targets.length ? targets : [...LANGS],
      words: parsed.words ?? {},
      stages: parsed.stages ?? {},
      sessions: parsed.sessions ?? 0,
    };
  } catch {
    return fresh();
  }
}

let state = load();
const save = (): void => writePref(KEY, JSON.stringify(state));

// ---------- target languages (the "ladder" order) ----------
export const getTargets = (): Lang[] => [...state.targets];

export function setTargets(langs: Lang[]): void {
  const ordered = LANGS.filter((l) => langs.includes(l));
  if (!ordered.length) return;
  state.targets = ordered;
  save();
}

// ---------- per word / language ----------
export const entry = (id: string, lang: Lang): Entry | undefined => state.words[id]?.[lang];

export const isMastered = (id: string, lang: Lang): boolean => (entry(id, lang)?.streak ?? 0) >= MASTERED_AT;

/** Language to ask a word in: the first target not yet mastered; when all are, any target (review). */
export function langFor(id: string): Lang {
  const targets = state.targets;
  return targets.find((l) => !isMastered(id, l)) ?? targets[Math.floor(Math.random() * targets.length)];
}

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

/** Among `ids`, the words already seen whose review is due, most overdue first. */
export function dueWords(ids: readonly string[], now = Date.now()): string[] {
  return ids
    .map((id) => ({ id, e: entry(id, langFor(id)) }))
    .filter((x): x is { id: string; e: Entry } => !!x.e && x.e.due <= now)
    .sort((a, b) => a.e.due - b.e.due)
    .map((x) => x.id);
}

export const masteredCount = (ids: readonly string[], lang: Lang): number =>
  ids.filter((id) => isMastered(id, lang)).length;

// ---------- stages ----------
export const stage = (id: string): StageProgress => state.stages[id] ?? { stars: 0, plays: 0 };

export function finishStage(id: string, stars: 1 | 2 | 3): StageProgress {
  const s = stage(id);
  const next: StageProgress = { stars: Math.max(s.stars, stars) as 1 | 2 | 3, plays: s.plays + 1 };
  state.stages[id] = next;
  state.sessions += 1;
  save();
  return next;
}

export function countReviewSession(): void {
  state.sessions += 1;
  save();
}

export const sessions = (): number => state.sessions;

export function reset(): void {
  state = { ...fresh(), targets: state.targets };
  save();
}
