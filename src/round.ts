// One quiz round: a prompt bar ("Cadê o cachorro?") and picture-only option cards.
// Shared by the free Quiz and by the Trail.
import * as audio from './audio';
import { pictureOf } from './explore';
import * as fx from './fx';
import { BCP47, isSilly, type Lang, type Mode } from './settings';
import { flagNode, h, t } from './ui';
import { categoryOf, type Word } from './words';

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** How many pictures fit comfortably: 4 on tablets / landscape, 3 on phones. */
export const optionCount = (): number => (matchMedia('(min-width: 700px)').matches ? 4 : 3);

/** Picks `n` distractors for `target`, trying each pool in order (no repeats). */
export function distractors(target: Word, n: number, pools: readonly (readonly Word[])[]): Word[] {
  const used = new Set<string>([target.id]);
  const out: Word[] = [];
  for (const pool of pools) {
    for (const w of shuffle(pool)) {
      if (out.length >= n) return out;
      if (used.has(w.id)) continue;
      used.add(w.id);
      out.push(w);
    }
  }
  return out;
}

export interface PromptBar {
  el: HTMLElement;
  set(target: Word, lang: Lang, mode: Mode, text: string): void;
}

/** 🔊 repeat button + flag + question text. */
export function promptBar(): PromptBar {
  let current: { id: string; lang: Lang; mode: Mode } | null = null;
  const repeat = h(
    'button',
    {
      class: 'q-repeat',
      type: 'button',
      'aria-label': t('repeat'),
      onclick: () => {
        if (current) void audio.playQuestion(current.id, current.lang, current.mode);
      },
    },
    '🔊',
  );
  const flag = h('span', { class: 'q-flag' });
  const text = h('span', { class: 'q-text' });
  const el = h('div', { class: 'prompt' }, repeat, h('div', { class: 'q-body' }, flag, text));
  return {
    el,
    set(target, lang, mode, question) {
      current = { id: target.id, lang, mode };
      flag.replaceChildren(flagNode(lang));
      text.textContent = question;
      text.lang = BCP47[lang];
    },
  };
}

export interface RoundSpec {
  target: Word;
  options: Word[]; // includes the target, already shuffled
  lang: Lang;
  mode: Mode;
}

export interface RoundResult {
  misses: number; // wrong taps before the right one
}

/**
 * Renders the option cards into `container` and plays the question (call inside a tap when
 * possible). Wrong tap: shake + dim, question replays. Right tap: celebration, then `onDone`.
 * Returns a cancel function that stops the pending "next" timer.
 */
export function runRound(container: HTMLElement, spec: RoundSpec, onDone: (r: RoundResult) => void): () => void {
  const { target, lang, mode } = spec;
  let misses = 0;
  let locked = false;
  let timer = 0;

  const cards = spec.options.map((w) => {
    const el = h(
      'button',
      {
        class: 'card option',
        type: 'button',
        'data-id': w.id,
        'aria-label': w[lang].w,
        style: { '--tint': categoryOf(w.cat)?.tint ?? '#ffffff' },
      },
      pictureOf(w),
    );
    el.addEventListener('click', () => answer(w, el));
    return el;
  });
  container.replaceChildren(...cards);
  void audio.playQuestion(target.id, lang, mode);

  function dimOthers(): void {
    for (const c of cards) {
      if (c.dataset.id !== target.id) {
        c.classList.add('dim');
        c.disabled = true;
      }
    }
  }

  function answer(w: Word, el: HTMLButtonElement): void {
    if (locked) return;
    if (w.id === target.id) {
      locked = true;
      if (isSilly()) {
        fx.sillyMove(el);
        fx.boing();
      } else {
        fx.pop(el);
      }
      fx.sparkleBurst(el, 14, isSilly());
      el.classList.add('glow');
      dimOthers();
      fx.confetti(misses === 0 ? 30 : 16);
      void audio.playWord(target.id, lang, mode);
      timer = window.setTimeout(() => onDone({ misses }), 1600);
    } else {
      misses++;
      fx.shake(el);
      el.classList.add('dim');
      el.disabled = true;
      if (misses >= 2) dimOthers(); // after two misses only the right one is left
      void audio.playQuestion(target.id, lang, mode);
    }
  }

  return () => clearTimeout(timer);
}
