// Quiz screen: "Cadê o cachorro?" — hear a word, tap the right picture.
import * as audio from './audio';
import * as fx from './fx';
import { BCP47, LANGS, getLang, readPref, writePref, type Lang } from './settings';
import { categoryChips, flagNode, h, t } from './ui';
import { WORDS, byCategory, categoryOf, imgUrl, type Word } from './words';

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
  let cat = readPref(CAT_KEY) ?? 'all';
  if (cat !== 'all' && !categoryOf(cat)) cat = 'all';
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
  let chips = categoryChips(cat, select, true);
  root.append(chips, prompt, stars, options, startBtn);

  function select(id: string): void {
    cat = id;
    writePref(CAT_KEY, id);
    const fresh = categoryChips(cat, select, true);
    chips.replaceWith(fresh);
    chips = fresh;
    if (target) newRound();
  }

  const pool = (): Word[] => (cat === 'all' ? WORDS : byCategory(cat));

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

    const p = pool();
    const fresh = p.filter((w) => w.id !== prevId);
    const chosen = pick(fresh.length ? fresh : p);
    target = chosen;
    prevId = chosen.id;

    const others = shuffle(p.filter((w) => w.id !== chosen.id)).slice(0, n - 1);
    if (others.length < n - 1) {
      const used = new Set([chosen.id, ...others.map((w) => w.id)]);
      others.push(...shuffle(WORDS.filter((w) => !used.has(w.id))).slice(0, n - 1 - others.length));
    }

    options.replaceChildren(...shuffle([chosen, ...others]).map(optionCard));
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
