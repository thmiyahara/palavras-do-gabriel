import {
  BCP47,
  MEDAL_AT,
  getLang,
  getLevel,
  getProgress,
  isSilly,
  setLang,
  setLevel,
  setSilly,
  uiLang,
  type Lang,
  type LangChoice,
  type LevelChoice,
} from './settings';
import { CATEGORIES, imgUrl, type Category } from './words';

type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, unknown>;

/** Tiny DOM builder: h('button', { class: 'x', onclick }, 'label'). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') {
      el.className = String(value);
    } else if (key === 'style' && typeof value === 'object') {
      for (const [prop, v] of Object.entries(value as Record<string, string>)) el.style.setProperty(prop, v);
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (value === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key, String(value));
    }
  }
  for (const c of children) {
    if (c == null || c === false) continue;
    el.append(typeof c === 'number' ? String(c) : c);
  }
  return el;
}

const T = {
  explore: { pt: 'Explorar', en: 'Explore', ja: 'あそぶ' },
  quiz: { pt: 'Quiz', en: 'Quiz', ja: 'クイズ' },
  start: { pt: 'Começar', en: 'Start', ja: 'スタート' },
  all: { pt: 'Tudo', en: 'All', ja: 'ぜんぶ' },
  repeat: { pt: 'Repetir', en: 'Repeat', ja: 'もういちど' },
  language: { pt: 'Idioma', en: 'Language', ja: 'ことば' },
  level: { pt: 'Nível', en: 'Level', ja: 'レベル' },
  allLevels: { pt: 'Todos', en: 'All', ja: 'ぜんぶ' },
  silly: { pt: 'Modo bobo', en: 'Silly mode', ja: 'おふざけモード' },
} satisfies Record<string, Record<Lang, string>>;

export const t = (key: keyof typeof T): string => T[key][uiLang()];

const LANG_TITLE: Record<LangChoice, string> = {
  pt: 'Português',
  en: 'English',
  ja: '日本語',
  all: 'Português + English + 日本語',
};

/** Flag as an image (emoji flags do not render on Windows); a globe for "all". */
export function flagNode(lang: LangChoice): Node {
  if (lang === 'all') return h('span', { class: 'flag-all' }, '🌐');
  return h('img', { class: 'flag', src: `${import.meta.env.BASE_URL}img/flag-${lang}.svg`, alt: '', draggable: 'false' });
}

export function langSwitcher(): HTMLElement {
  const current = getLang();
  const choices: LangChoice[] = ['pt', 'en', 'ja', 'all'];
  return h(
    'div',
    { class: 'langs', role: 'group', 'aria-label': t('language') },
    ...choices.map((c) =>
      h(
        'button',
        {
          class: 'lang',
          type: 'button',
          title: LANG_TITLE[c],
          'aria-label': LANG_TITLE[c],
          'aria-pressed': String(current === c),
          onclick: () => setLang(c),
        },
        flagNode(c),
      ),
    ),
  );
}

/** 🤪 toggle: chipmunk voice + wobbly cards. */
export function sillyToggle(): HTMLElement {
  return h(
    'button',
    {
      class: 'silly-btn',
      type: 'button',
      title: t('silly'),
      'aria-label': t('silly'),
      'aria-pressed': String(isSilly()),
      onclick: () => setSilly(!isSilly()),
    },
    '🤪',
  );
}

/** Row of difficulty levels (★, ★★, ★★★, all). A medal appears once the quiz level is mastered. */
export function levelSwitcher(): HTMLElement {
  const current = getLevel();
  const progress = getProgress();
  const choices: LevelChoice[] = [1, 2, 3, 4, 'all'];
  return h(
    'div',
    { class: 'levels', role: 'group', 'aria-label': t('level') },
    h('span', { class: 'levels-label' }, t('level')),
    ...choices.map((c) => {
      const earned = c !== 'all' && (progress[c] ?? 0) >= MEDAL_AT;
      return h(
        'button',
        {
          class: c === 'all' ? 'level level-all' : 'level',
          type: 'button',
          'aria-label': c === 'all' ? t('allLevels') : `${t('level')} ${c}`,
          'aria-pressed': String(current === c),
          onclick: () => setLevel(c),
        },
        c === 'all' ? t('allLevels') : '★'.repeat(c),
        earned ? h('span', { class: 'medal', 'aria-label': '🏅' }, '🏅') : null,
      );
    }),
  );
}

/** Horizontal row of category buttons; `withAll` adds a "Tudo" chip with id "all". */
export function categoryChips(
  current: string,
  onSelect: (id: string) => void,
  withAll = false,
  categories: readonly Category[] = CATEGORIES,
): HTMLElement {
  const lang = uiLang();
  const chip = (id: string, icon: Node, label: string, tint: string): HTMLElement =>
    h(
      'button',
      {
        class: 'chip',
        type: 'button',
        'aria-label': label,
        'aria-pressed': String(current === id),
        style: { '--tint': tint },
        onclick: () => onSelect(id),
      },
      icon,
      h('span', { lang: BCP47[lang] }, label),
    );

  const wrap = h('div', { class: 'chips' });
  if (withAll) wrap.append(chip('all', h('span', { class: 'chip-all' }, '✨'), t('all'), '#ffffff'));
  for (const c of categories) {
    wrap.append(chip(c.id, h('img', { src: imgUrl(c.icon), alt: '', draggable: 'false' }), c.label[lang], c.tint));
  }
  // Center the active chip horizontally without touching the page's vertical scroll.
  requestAnimationFrame(() => {
    const active = wrap.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (active) wrap.scrollLeft = active.offsetLeft - (wrap.clientWidth - active.offsetWidth) / 2;
  });
  return wrap;
}
