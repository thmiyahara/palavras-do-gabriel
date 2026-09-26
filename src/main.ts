import './style.css';
import { registerSW } from 'virtual:pwa-register';
import * as audio from './audio';
import { renderExplore } from './explore';
import { renderQuiz } from './quiz';
import { isSilly, onSettingsChange } from './settings';
import { h, langSwitcher, sillyToggle, t } from './ui';

registerSW({ immediate: true });

// Always start at the top; the browser would otherwise restore an old scroll position.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const app = document.getElementById('app')!;
const header = h('header', { class: 'topbar' });
const screen = h('main', { class: 'screen' });
app.append(header, screen);

// First touch anywhere wakes up the speech engines (iOS needs a gesture).
document.addEventListener('pointerdown', () => audio.unlock(), { once: true, capture: true });

type Route = 'explore' | 'quiz';
const routeOf = (): Route => (location.hash === '#/quiz' ? 'quiz' : 'explore');
let dispose: (() => void) | null = null;

function renderHeader(route: Route): void {
  const tab = (r: Route, icon: string, label: string): HTMLElement =>
    h(
      'a',
      { class: 'tab', href: `#/${r}`, 'aria-current': route === r ? 'page' : null },
      h('span', { class: 'tab-icon' }, icon),
      h('span', {}, label),
    );
  header.replaceChildren(
    h('nav', { class: 'tabs' }, tab('explore', '🧸', t('explore')), tab('quiz', '🎯', t('quiz'))),
    h('div', { class: 'controls' }, langSwitcher(), sillyToggle()),
  );
}

function render(): void {
  dispose?.();
  dispose = null;
  document.body.classList.toggle('silly', isSilly());
  const route = routeOf();
  renderHeader(route);
  dispose = route === 'quiz' ? renderQuiz(screen) : renderExplore(screen);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);
onSettingsChange(render);
render();
