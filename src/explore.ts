// Explore screen: pick a level and a category, tap a picture, hear its name (or its sound).
import * as audio from './audio';
import * as fx from './fx';
import * as photos from './photos';
import { getCategory, getLang, getLevel, getMode, isSilly, setCategory, type Lang, type Mode } from './settings';
import { categoryChips, h, levelSwitcher, t } from './ui';
import { categoriesFor, categoryOf, imgUrl, wordsFor, type Word } from './words';

export function renderExplore(root: HTMLElement): () => void {
  root.replaceChildren();
  const level = getLevel();
  const mode = getMode();
  // In sound mode only categories with at least one sound are offered.
  const cats = categoriesFor(level, mode === 'sound');
  let cat = cats.some((c) => c.id === getCategory()) ? getCategory() : cats[0].id;
  let editing = false; // "Fotos" mode: taps pick a family photo instead of speaking

  const grid = h('div', { class: 'grid', 'data-lang': getLang(), 'data-mode': mode });
  const photoBtn = h('button', { class: 'photo-btn', type: 'button', 'aria-pressed': 'false', onclick: toggleEditing }, '📷 ', t('photos'));
  const hint = h('p', { class: 'photo-hint', hidden: true }, t('photosHint'));
  let chips = categoryChips(cat, select, false, cats);
  root.append(levelSwitcher(), chips, photoBtn, hint, grid);
  fill();

  function select(id: string): void {
    cat = id;
    setCategory(id);
    editing = false;
    const fresh = categoryChips(cat, select, false, cats);
    chips.replaceWith(fresh);
    chips = fresh;
    fill();
  }

  function toggleEditing(): void {
    editing = !editing;
    fill();
  }

  function fill(): void {
    const family = wordsFor(cat, level).some((w) => photos.canHavePhoto(w.id));
    photoBtn.hidden = !family || mode === 'sound';
    if (photoBtn.hidden) editing = false;
    photoBtn.setAttribute('aria-pressed', String(editing));
    hint.hidden = !editing;
    grid.classList.toggle('editing', editing);
    const tint = categoryOf(cat)?.tint ?? '#ffffff';
    grid.replaceChildren(...wordsFor(cat, level).map((w) => card(w, tint, mode, editing ? fill : null)));
  }

  return () => audio.stop();
}

/** Picture of a word: the family photo when the grown-up chose one, else the drawing. */
export function pictureOf(w: Word): HTMLElement {
  const photo = photos.photoOf(w.id);
  return h('img', { class: photo ? 'photo' : null, src: photo ?? imgUrl(w.id), alt: '', draggable: 'false' });
}

function card(w: Word, tint: string, mode: Mode, onPhotoChange: (() => void) | null): HTMLElement {
  const editable = !!onPhotoChange && photos.canHavePhoto(w.id);
  const muted = (mode === 'sound' && !w.sound) || (!!onPhotoChange && !editable);
  const label = (lang: Lang): string => (mode === 'sound' ? (w.sound?.[lang] ?? '') : w[lang].w);
  const sub = mode === 'sound' ? '' : [w.ja.kanji, w.ja.romaji].filter(Boolean).join(' · ');
  const el = h(
    'button',
    {
      class: ['card', muted ? 'muted' : '', editable ? 'editable' : ''].filter(Boolean).join(' '),
      type: 'button',
      style: { '--tint': tint },
      disabled: muted,
      'aria-disabled': muted ? 'true' : null,
    },
    pictureOf(w),
    h(
      'span',
      { class: 'label' },
      h('span', { class: 'l-pt', lang: 'pt-BR' }, label('pt')),
      h('span', { class: 'l-en', lang: 'en' }, label('en')),
      h('span', { class: 'l-ja', lang: 'ja' }, h('span', { class: 'kana' }, label('ja')), h('span', { class: 'sub' }, sub)),
    ),
  );
  if (muted) return el; // nothing to play: dimmed and silent

  if (editable) {
    el.append(h('span', { class: 'badge' }, '📷'));
    el.addEventListener('click', async () => {
      const file = await photos.pick(); // opens camera / gallery
      if (!file) return;
      await photos.setPhoto(w.id, file);
      onPhotoChange();
    });
    if (photos.photoOf(w.id)) {
      const remove = h(
        'button',
        {
          class: 'remove-photo',
          type: 'button',
          'aria-label': t('removePhoto'),
          onclick: async (e: Event) => {
            e.stopPropagation();
            await photos.removePhoto(w.id);
            onPhotoChange();
          },
        },
        '✕',
      );
      el.append(remove);
    }
    return el;
  }

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
