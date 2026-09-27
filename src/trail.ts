// Trail: a guided path of stages (5 words each). A session presents the words, trains them
// with quiz rounds in the child's current language for each word, reviews older words that
// are due, and awards up to 3 stars. Progress lives in progress.ts.
import * as audio from './audio';
import { pictureOf } from './explore';
import * as fx from './fx';
import * as progress from './progress';
import { distractors, optionCount, promptBar, runRound, shuffle } from './round';
import { LANGS, LEVELS, type Lang, type Level } from './settings';
import { flagNode, h, t } from './ui';
import { CATEGORIES, WORDS, imgUrl, uiLabel, wordsFor, type Category, type Word } from './words';

const STAGE_SIZE = 5;
const TRAIN_QUESTIONS = 8;
const MAX_QUESTIONS = 12;
const REVIEW_QUESTIONS = 3;
const REVIEW_EVERY = 3; // every 3rd session is a review session (when enough words are due)

export interface Stage {
  id: string;
  level: Level;
  cat: Category;
  n: number;
  words: Word[];
}

/** Deterministic list of stages: level 1→4, categories in order, 5 words each. */
export function buildStages(): Stage[] {
  const stages: Stage[] = [];
  for (const level of LEVELS) {
    for (const cat of CATEGORIES) {
      const words = wordsFor(cat.id, level).filter((w) => !w.custom || level === 1);
      if (!words.length) continue;
      const chunks: Word[][] = [];
      for (let i = 0; i < words.length; i += STAGE_SIZE) chunks.push(words.slice(i, i + STAGE_SIZE));
      if (chunks.length > 1 && chunks[chunks.length - 1].length < 3) {
        const tail = chunks.pop()!;
        chunks[chunks.length - 1].push(...tail);
      }
      chunks.forEach((chunk, n) => stages.push({ id: `${level}-${cat.id}-${n + 1}`, level, cat, n: n + 1, words: chunk }));
    }
  }
  return stages;
}

const isUnlocked = (stages: Stage[], i: number): boolean => i === 0 || progress.stage(stages[i - 1].id).stars >= 1;

const isComplete = (s: Stage): boolean =>
  progress.getTargets().every((lang) => s.words.every((w) => progress.isMastered(w.id, lang)));

const litFlags = (s: Stage): Lang[] =>
  progress.getTargets().filter((lang) => s.words.every((w) => progress.isMastered(w.id, lang)));

function currentIndex(stages: Stage[]): number {
  const i = stages.findIndex((s, idx) => isUnlocked(stages, idx) && !isComplete(s));
  return i === -1 ? stages.length - 1 : i;
}

// ---------------------------------------------------------------------------
export function renderTrail(root: HTMLElement): () => void {
  let cancel: (() => void) | null = null;
  let timer = 0;

  const stop = (): void => {
    clearTimeout(timer);
    cancel?.();
    cancel = null;
    audio.stop();
  };

  showMap();
  return stop;

  // ---------- map ----------
  function showMap(): void {
    stop();
    root.replaceChildren();
    const stages = buildStages();
    const cur = currentIndex(stages);
    const curStage = stages[cur];
    const ids = WORDS.map((w) => w.id);
    const targets = progress.getTargets();

    const summary = h(
      'div',
      { class: 'trail-summary' },
      h('span', {}, `${t('mastered')}: `),
      ...targets.map((lang) => h('span', { class: 'trail-count' }, flagNode(lang), ` ${progress.masteredCount(ids, lang)}`)),
      h('span', { class: 'trail-total' }, ` / ${ids.length}`),
    );

    const due = progress.dueWords(stages.slice(0, cur).flatMap((s) => s.words.map((w) => w.id)));
    const reviewTurn = (progress.sessions() + 1) % REVIEW_EVERY === 0 && due.length >= REVIEW_QUESTIONS;

    const playBtn = h(
      'button',
      { class: 'start trail-play', type: 'button', onclick: () => (reviewTurn ? startReview(due) : startStage(curStage)) },
      `▶ ${reviewTurn ? t('review') : t('play')}`,
      h('small', {}, reviewTurn ? `${due.length} ${t('review').toLowerCase()}` : stageName(curStage)),
    );

    const settingsBtn = h('button', { class: 'trail-gear', type: 'button', 'aria-label': t('settings'), onclick: showSettings }, '⚙️');

    const map = h('ol', { class: 'trail-map' });
    let lastLevel: Level | null = null;
    stages.forEach((s, i) => {
      if (s.level !== lastLevel) {
        lastLevel = s.level;
        map.append(h('li', { class: 'trail-level' }, `${t('level')} ${'★'.repeat(s.level)}`));
      }
      const unlocked = isUnlocked(stages, i);
      const complete = isComplete(s);
      const st = progress.stage(s.id);
      const node = h(
        'button',
        {
          class: ['trail-node', unlocked ? '' : 'locked', complete ? 'complete' : '', i === cur ? 'current' : ''].filter(Boolean).join(' '),
          type: 'button',
          'aria-label': `${stageName(s)} — ${st.stars}★`,
          onclick: () => {
            if (!unlocked) {
              fx.shake(node);
              return;
            }
            startStage(s);
          },
        },
        h('img', { src: imgUrl(s.cat.icon), alt: '', draggable: 'false' }),
        h('span', { class: 'trail-stars' }, '★'.repeat(st.stars) + '☆'.repeat(3 - st.stars)),
        h('span', { class: 'trail-flags' }, ...targets.map((lang) => h('span', { class: litFlags(s).includes(lang) ? 'lit' : 'dim' }, flagNode(lang)))),
        unlocked ? null : h('span', { class: 'trail-lock' }, '🔒'),
        complete ? h('span', { class: 'trail-trophy' }, '🏆') : null,
      );
      map.append(h('li', { class: i % 2 ? 'right' : 'left' }, node, h('span', { class: 'trail-name' }, uiLabel(s.cat) + (s.n > 1 ? ` ${s.n}` : ''))));
    });

    root.append(h('div', { class: 'trail-top' }, playBtn, settingsBtn), summary, map);
    requestAnimationFrame(() => map.querySelector('.current')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }

  function stageName(s: Stage): string {
    return `${uiLabel(s.cat)}${s.n > 1 ? ` ${s.n}` : ''} · ${'★'.repeat(s.level)}`;
  }

  // ---------- settings (grown-up) ----------
  function showSettings(): void {
    const targets = new Set(progress.getTargets());
    const toggles = LANGS.map((lang) =>
      h(
        'button',
        {
          class: 'lang',
          type: 'button',
          'aria-pressed': String(targets.has(lang)),
          onclick: (e: Event) => {
            const btn = e.currentTarget as HTMLButtonElement;
            if (targets.has(lang)) {
              if (targets.size === 1) return; // keep at least one
              targets.delete(lang);
            } else {
              targets.add(lang);
            }
            btn.setAttribute('aria-pressed', String(targets.has(lang)));
            progress.setTargets([...targets]);
          },
        },
        flagNode(lang),
      ),
    );
    const overlay = h(
      'div',
      { class: 'p-overlay' },
      h(
        'div',
        { class: 'p-box', role: 'dialog', 'aria-modal': 'true' },
        h('h2', { class: 'p-title' }, t('trailLangs')),
        h('div', { class: 'langs' }, ...toggles),
        h(
          'div',
          { class: 'p-actions' },
          h(
            'button',
            {
              class: 'p-btn p-delete',
              type: 'button',
              onclick: () => {
                if (confirm(t('confirmRestart'))) {
                  progress.reset();
                  overlay.remove();
                  showMap();
                }
              },
            },
            t('restart'),
          ),
          h('button', { class: 'p-btn p-save', type: 'button', onclick: () => { overlay.remove(); showMap(); } }, 'OK'),
        ),
      ),
    );
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        showMap();
      }
    });
    document.body.append(overlay);
  }

  // ---------- a stage session: present → train → review → result ----------
  function startStage(s: Stage): void {
    stop();
    const misses = { total: 0 };
    present(s, 0, () => train(s, misses, () => review(s, () => result(s, misses))));
  }

  function present(s: Stage, i: number, onDone: () => void): void {
    const w = s.words[i];
    const lang = progress.langFor(w.id);
    root.replaceChildren();
    const big = h(
      'button',
      { class: 'card present-card', type: 'button', style: { '--tint': s.cat.tint }, onclick: () => { fx.pop(big); fx.sparkleBurst(big); void audio.playWord(w.id, lang); } },
      pictureOf(w),
      h('span', { class: 'label present-label', lang: lang === 'ja' ? 'ja' : lang === 'pt' ? 'pt-BR' : 'en' }, flagNode(lang), ` ${w[lang].w}`),
    );
    const nextBtn = h(
      'button',
      { class: 'start', type: 'button', onclick: () => (i + 1 < s.words.length ? present(s, i + 1, onDone) : onDone()) },
      i + 1 < s.words.length ? `${t('next')} →` : `${t('nowPoint')} →`,
    );
    root.append(
      h('h2', { class: 'trail-title' }, `${t('newWords')} · ${i + 1}/${s.words.length}`),
      big,
      nextBtn,
    );
    void audio.playWord(w.id, lang); // inside the tap that got us here (iOS)
  }

  function train(s: Stage, misses: { total: number }, onDone: () => void): void {
    const queue = shuffle(s.words);
    while (queue.length < TRAIN_QUESTIONS) queue.push(...shuffle(s.words).slice(0, TRAIN_QUESTIONS - queue.length));
    const stages = buildStages();
    const earlier = stages.slice(0, stages.findIndex((x) => x.id === s.id)).flatMap((x) => x.words);
    askQueue(queue, [s.words, earlier, WORDS], t('nowPoint'), misses, true, onDone);
  }

  function review(s: Stage, onDone: () => void): void {
    const stages = buildStages();
    const earlier = stages.slice(0, stages.findIndex((x) => x.id === s.id)).flatMap((x) => x.words);
    const due = progress.dueWords(earlier.map((w) => w.id)).slice(0, REVIEW_QUESTIONS);
    if (!due.length) {
      onDone();
      return;
    }
    const queue = due.map((id) => earlier.find((w) => w.id === id)!);
    askQueue(queue, [earlier, WORDS], t('review'), { total: 0 }, false, onDone);
  }

  /** Asks the queue one by one; a missed word is asked again later (up to MAX_QUESTIONS). */
  function askQueue(
    queue: Word[],
    pools: readonly (readonly Word[])[],
    title: string,
    misses: { total: number },
    requeue: boolean,
    onDone: () => void,
  ): void {
    let asked = 0;
    const prompt = promptBar();
    const options = h('div', { class: 'options' });
    const counter = h('span', { class: 'trail-counter' });
    root.replaceChildren(h('h2', { class: 'trail-title' }, title, counter), prompt.el, options);

    const next = (): void => {
      const target = queue.shift();
      if (!target) {
        onDone();
        return;
      }
      asked++;
      counter.textContent = ` ${asked}`;
      const lang = progress.langFor(target.id);
      const others = distractors(target, optionCount() - 1, pools);
      prompt.set(target, lang, 'name', target[lang].q);
      cancel = runRound(options, { target, options: shuffle([target, ...others]), lang, mode: 'name' }, (r) => {
        progress.record(target.id, lang, r.misses === 0);
        misses.total += r.misses;
        if (r.misses > 0 && requeue && asked + queue.length < MAX_QUESTIONS) queue.push(target);
        timer = window.setTimeout(next, 150);
      });
    };
    next();
  }

  function result(s: Stage, misses: { total: number }): void {
    const stars: 1 | 2 | 3 = misses.total === 0 ? 3 : misses.total <= 2 ? 2 : 1;
    const before = litFlags(s);
    progress.finishStage(s.id, stars);
    const after = litFlags(s).filter((l) => !before.includes(l));
    root.replaceChildren(
      h('h2', { class: 'trail-title' }, t('greatJob')),
      h('div', { class: 'trail-result-stars' }, '★'.repeat(stars) + '☆'.repeat(3 - stars)),
      h('p', { class: 'trail-result-name' }, stageName(s)),
      h('div', { class: 'trail-newflags', hidden: after.length === 0 }, ...after.map((l) => h('span', { class: 'lit' }, flagNode(l)))),
      h(
        'div',
        { class: 'trail-result-actions' },
        h('button', { class: 'start', type: 'button', onclick: () => startStage(s) }, `↻ ${t('again')}`),
        h('button', { class: 'start trail-map-btn', type: 'button', onclick: showMap }, `🗺️ ${t('map')}`),
      ),
    );
    if (stars === 3) fx.bigCelebration();
    else fx.confetti(40);
  }

  // ---------- review-only session ----------
  function startReview(dueIds: string[]): void {
    stop();
    const words = dueIds.map((id) => WORDS.find((w) => w.id === id)!).slice(0, TRAIN_QUESTIONS);
    askQueue(words, [WORDS], t('review'), { total: 0 }, false, () => {
      progress.countReviewSession();
      root.replaceChildren(
        h('h2', { class: 'trail-title' }, t('reviewDone')),
        h('div', { class: 'trail-result-stars' }, '🎉'),
        h('div', { class: 'trail-result-actions' }, h('button', { class: 'start trail-map-btn', type: 'button', onclick: showMap }, `🗺️ ${t('map')}`)),
      );
      fx.confetti(40);
    });
  }
}
