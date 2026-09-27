// Free quiz: "Cadê o cachorro?" — hear a word, tap the right picture. Category and level chosen by hand.
import * as audio from './audio';
import * as fx from './fx';
import { LANGS, addProgress, getLang, getLevel, getMode, readPref, writePref, type Lang } from './settings';
import { distractors, optionCount, pick, promptBar, runRound, shuffle } from './round';
import { categoryChips, h, levelSwitcher, t } from './ui';
import { WORDS, categoriesFor, wordsFor, type Word } from './words';

const CAT_KEY = 'pg.quizcat';
const STARS = 5;

export function renderQuiz(root: HTMLElement): () => void {
  root.replaceChildren();
  const level = getLevel();
  const mode = getMode();
  const bySound = mode === 'sound'; // "Who makes this sound?" — only words that have one
  const cats = categoriesFor(level, bySound);
  let cat = readPref(CAT_KEY) ?? 'all';
  if (cat !== 'all' && !cats.some((c) => c.id === cat)) cat = 'all';
  let prevId: string | null = null;
  let streak = 0;
  let started = false;
  let langIdx = 0;
  let cancelRound: (() => void) | null = null;
  let timer = 0;

  const prompt = promptBar();
  prompt.el.hidden = true;
  const stars = h(
    'div',
    { class: 'stars', 'aria-hidden': 'true', hidden: true },
    ...Array.from({ length: STARS }, () => h('span', {}, '☆')),
  );
  const options = h('div', { class: 'options' });
  const startBtn = h('button', { class: 'start', type: 'button', onclick: () => newRound() }, `▶ ${t('start')}`);
  let chips = categoryChips(cat, select, true, cats);
  root.append(levelSwitcher(), chips, prompt.el, stars, options, startBtn);

  function select(id: string): void {
    cat = id;
    writePref(CAT_KEY, id);
    const fresh = categoryChips(cat, select, true, cats);
    chips.replaceWith(fresh);
    chips = fresh;
    if (started) newRound();
  }

  function newRound(): void {
    clearTimeout(timer);
    cancelRound?.();
    startBtn.remove();
    prompt.el.hidden = false;
    stars.hidden = false;
    started = true;

    const choice = getLang();
    const lang: Lang = choice === 'all' ? LANGS[langIdx++ % LANGS.length] : choice;

    const pool = wordsFor(cat, level, bySound);
    const fresh = pool.filter((w) => w.id !== prevId);
    const target = pick(fresh.length ? fresh : pool);
    prevId = target.id;

    const others = distractors(target, optionCount() - 1, [
      pool,
      wordsFor('all', level, bySound),
      bySound ? WORDS.filter((w) => !!w.sound) : WORDS,
    ]);
    prompt.set(target, lang, mode, bySound ? t('whichSound') : target[lang].q);
    cancelRound = runRound(options, { target, options: shuffle([target, ...others]), lang, mode }, ({ misses }) => {
      streak++;
      if (level !== 'all') addProgress(level);
      const full = streak % STARS === 0;
      paintStars(full ? STARS : streak % STARS);
      if (full) fx.bigCelebration();
      void misses;
      timer = window.setTimeout(
        () => {
          if (full) paintStars(0);
          newRound();
        },
        full ? 900 : 100,
      );
    });
  }

  function paintStars(n: number): void {
    Array.from(stars.children).forEach((s, i) => {
      s.textContent = i < n ? '★' : '☆';
    });
  }

  return () => {
    clearTimeout(timer);
    cancelRound?.();
    audio.stop();
  };
}

export type { Word };
