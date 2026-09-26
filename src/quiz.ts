// Quiz screen: "Cadê o cachorro?" — hear a word, tap the right picture.
import * as audio from './audio';
import * as fx from './fx';
import { BCP47, LANGS, addProgress, getLang, getLevel, readPref, writePref, type Lang } from './settings';
import { categoryChips, flagNode, h, levelSwitcher, t } from './ui';
import { WORDS, categoriesFor, categoryOf, imgUrl, wordsFor, type Word } from './words';

const CAT_KEY = 'pg.quizcat';
const STARS = 5;

function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function renderQuiz(root: HTMLElement): () => void {
  root.replaceChildren();
  const level = getLevel();
  const cats = categoriesFor(level);
  let cat = readPref(CAT_KEY) ?? 'all';
  if (cat !== 'all' && !cats.some((c) => c.id === cat)) cat = 'all';
  let prevId: string | null = null;
  let streak = 0;
  let misses = 0;
  let locked = true;
  let langIdx = 0;
  let roundLang: Lang = 'pt';
  let target: Word | null = null;
  let timer = 0;

  const repeatBtn = h(
    'button',
    {
      class: 'q-repeat',
      type: 'button',
      'aria-label': t('repeat'),
      onclick: () => {
        if (target) void audio.playQuestion(target.id, roundLang);
      },
    },
    '🔊',
  );
  const flag = h('span', { class: 'q-flag' });
  const text = h('span', { class: 'q-text' });
  const prompt = h('div', { class: 'prompt', hidden: true }, repeatBtn, h('div', { class: 'q-body' }, flag, text));
  const stars = h(
    'div',
    { class: 'stars', 'aria-hidden': 'true', hidden: true },
    ...Array.from({ length: STARS }, () => h('span', {}, '☆')),
  );
  const options = h('div', { class: 'options' });
  const startBtn = h('button', { class: 'start', type: 'button', onclick: () => newRound() }, `▶ ${t('start')}`);
  let chips = categoryChips(cat, select, true, cats);
  root.append(levelSwitcher(), chips, prompt, stars, options, startBtn);

  function select(id: string): void {
    cat = id;
    writePref(CAT_KEY, id);
    const fresh = categoryChips(cat, select, true, cats);
    chips.replaceWith(fresh);
    chips = fresh;
    if (target) newRound();
  }

  /** Distractors: same category and level first, then same level, then anything. */
  function distractors(chosen: Word, n: number): Word[] {
    const used = new Set<string>([chosen.id]);
    const out: Word[] = [];
    const take = (pool: Word[]): void => {
      for (const w of shuffle(pool)) {
        if (out.length >= n) return;
        if (used.has(w.id)) continue;
        used.add(w.id);
        out.push(w);
      }
    };
    take(wordsFor(cat, level));
    if (out.length < n) take(wordsFor('all', level));
    if (out.length < n) take(WORDS);
    return out;
  }

  function newRound(): void {
    clearTimeout(timer);
    startBtn.remove();
    prompt.hidden = false;
    stars.hidden = false;
    locked = false;
    misses = 0;

    const choice = getLang();
    roundLang = choice === 'all' ? LANGS[langIdx++ % LANGS.length] : choice;
    const n = matchMedia('(min-width: 700px)').matches ? 4 : 3;

    const pool = wordsFor(cat, level);
    const fresh = pool.filter((w) => w.id !== prevId);
    const chosen = pick(fresh.length ? fresh : pool);
    target = chosen;
    prevId = chosen.id;

    options.replaceChildren(...shuffle([chosen, ...distractors(chosen, n - 1)]).map(optionCard));
    flag.replaceChildren(flagNode(roundLang));
    text.textContent = chosen[roundLang].q;
    text.lang = BCP47[roundLang];
    void audio.playQuestion(chosen.id, roundLang);
  }

  function optionCard(w: Word): HTMLButtonElement {
    const el = h(
      'button',
      {
        class: 'card option',
        type: 'button',
        'data-id': w.id,
        'aria-label': w[roundLang].w,
        style: { '--tint': categoryOf(w.cat)?.tint ?? '#ffffff' },
      },
      h('img', { src: imgUrl(w.id), alt: '', draggable: 'false' }),
    );
    el.addEventListener('click', () => answer(w, el));
    return el;
  }

  function answer(w: Word, el: HTMLButtonElement): void {
    if (locked || !target) return;
    const tid = target.id;
    if (w.id === tid) {
      locked = true;
      streak++;
      if (level !== 'all') addProgress(level);
      fx.pop(el);
      fx.sparkleBurst(el, 14);
      el.classList.add('glow');
      dimOthers(tid);
      void audio.playWord(tid, roundLang);
      const full = streak % STARS === 0;
      paintStars(full ? STARS : streak % STARS);
      if (full) fx.bigCelebration();
      else fx.confetti(30);
      timer = window.setTimeout(
        () => {
          if (full) paintStars(0);
          newRound();
        },
        full ? 2200 : 1600,
      );
    } else {
      misses++;
      fx.shake(el);
      el.classList.add('dim');
      el.disabled = true;
      if (misses >= 2) dimOthers(tid); // after two misses only the right one is left
      void audio.playQuestion(tid, roundLang);
    }
  }

  function dimOthers(keepId: string): void {
    for (const o of Array.from(options.children) as HTMLButtonElement[]) {
      if (o.dataset.id !== keepId) {
        o.classList.add('dim');
        o.disabled = true;
      }
    }
  }

  function paintStars(n: number): void {
    Array.from(stars.children).forEach((s, i) => {
      s.textContent = i < n ? '★' : '☆';
    });
  }

  return () => {
    clearTimeout(timer);
    audio.stop();
  };
}
