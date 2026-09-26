// Explore screen: pick a level and a category, tap a picture, hear its name (or its sound).
import * as audio from './audio';
import * as fx from './fx';
import { getCategory, getLang, getLevel, getMode, isSilly, setCategory, type Lang, type Mode } from './settings';
import { categoryChips, h, levelSwitcher } from './ui';
import { categoriesFor, categoryOf, imgUrl, wordsFor, type Word } from './words';

export function renderExplore(root: HTMLElement): () => void {
  root.replaceChildren();
  const level = getLevel();
  const mode = getMode();
  // In sound mode only categories with at least one sound are offered.
  const cats = categoriesFor(level, mode === 'sound');
  let cat = cats.some((c) => c.id === getCategory()) ? getCategory() : cats[0].id;

  const grid = h('div', { class: 'grid', 'data-lang': getLang(), 'data-mode': mode });
  let chips = categoryChips(cat, select, false, cats);
  root.append(levelSwitcher(), chips, grid);
  fill();

  function select(id: string): void {
    cat = id;
    setCategory(id);
    const fresh = categoryChips(cat, select, false, cats);
    chips.replaceWith(fresh);
    chips = fresh;
    fill();
  }

  function fill(): void {
    const tint = categoryOf(cat)?.tint ?? '#ffffff';
    grid.replaceChildren(...wordsFor(cat, level).map((w) => card(w, tint, mode)));
  }

  return () => audio.stop();
}

function card(w: Word, tint: string, mode: Mode): HTMLElement {
  const muted = mode === 'sound' && !w.sound;
  const label = (lang: Lang): string => (mode === 'sound' ? (w.sound?.[lang] ?? '') : w[lang].w);
  const sub = mode === 'sound' ? '' : [w.ja.kanji, w.ja.romaji].filter(Boolean).join(' · ');
  const el = h(
    'button',
    { class: muted ? 'card muted' : 'card', type: 'button', style: { '--tint': tint }, disabled: muted, 'aria-disabled': muted ? 'true' : null },
    h('img', { src: imgUrl(w.id), alt: '', draggable: 'false' }),
    h(
      'span',
      { class: 'label' },
      h('span', { class: 'l-pt', lang: 'pt-BR' }, label('pt')),
      h('span', { class: 'l-en', lang: 'en' }, label('en')),
      h('span', { class: 'l-ja', lang: 'ja' }, h('span', { class: 'kana' }, label('ja')), h('span', { class: 'sub' }, sub)),
    ),
  );
  if (muted) return el; // no sound to play: dimmed and silent

  let seq = 0;
  let taps = 0;
  let lastTap = 0;
  el.addEventListener('click', () => {
    // Three quick taps on the same card = a surprise spin with a "boing".
    const now = Date.now();
    taps = now - lastTap < 700 ? taps + 1 : 1;
    lastTap = now;
    const silly = isSilly();
    if (taps >= 3) {
      taps = 0;
      fx.spin(el);
      fx.boing();
      fx.sparkleBurst(el, 14, true);
    } else if (silly) {
      fx.sillyMove(el);
      fx.boing();
      fx.sparkleBurst(el, 10, true);
    } else {
      fx.pop(el);
      fx.sparkleBurst(el);
    }
    const lang = getLang();
    if (lang === 'all') {
      const mine = ++seq;
      void audio.playSequence(w.id, mode, (l: Lang | null) => {
        if (mine !== seq) return;
        if (l) el.dataset.speaking = l;
        else delete el.dataset.speaking;
      });
    } else {
      void audio.playWord(w.id, lang, mode);
    }
  });
  return el;
}
