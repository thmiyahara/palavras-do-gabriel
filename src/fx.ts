// Little visual rewards: sparkles, pops, shakes and confetti. All CSS-driven.
const SPARKLES = ['✨', '⭐', '💫', '🌟'];
const SILLY_SPARKLES = ['😂', '🤪', '🎉', '💥', '🍌', '🐷'];
const COLORS = ['#ff6b6b', '#ffd166', '#06d6a0', '#118ab2', '#c77dff', '#ff9f1c'];

export function sparkleBurst(host: HTMLElement, count = 10, silly = false): void {
  const set = silly ? SILLY_SPARKLES : SPARKLES;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.className = 'sparkle';
    s.textContent = set[i % set.length];
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const dist = 60 + Math.random() * 50;
    s.style.setProperty('--dx', `${Math.round(Math.cos(angle) * dist)}px`);
    s.style.setProperty('--dy', `${Math.round(Math.sin(angle) * dist)}px`);
    s.style.animationDelay = `${Math.round(Math.random() * 120)}ms`;
    s.addEventListener('animationend', () => s.remove(), { once: true });
    host.appendChild(s);
  }
}

function replay(el: HTMLElement, cls: string, ms: number): void {
  el.classList.remove(cls);
  void el.offsetWidth; // forces a reflow so the animation restarts
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

export const pop = (el: HTMLElement): void => replay(el, 'pop', 650);
export const shake = (el: HTMLElement): void => replay(el, 'shake', 450);

const SILLY_MOVES: [string, number][] = [
  ['spin', 800],
  ['jelly', 700],
  ['jump', 700],
  ['wiggle', 700],
];

/** One random silly move (spin, jelly squish, jump, wiggle). */
export function sillyMove(el: HTMLElement): void {
  const [cls, ms] = SILLY_MOVES[Math.floor(Math.random() * SILLY_MOVES.length)];
  replay(el, cls, ms);
}

export const spin = (el: HTMLElement): void => replay(el, 'spin', 800);

// ---------- synthesized "boing" (no audio file needed) ----------
let ctx: AudioContext | null = null;

/** Cartoon spring sound. Must first be called from a user gesture (creates the AudioContext). */
export function boing(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(700, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.28);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.34);
  } catch {
    /* no Web Audio: silently skip */
  }
}

export function confetti(count = 30): void {
  const layer = document.createElement('div');
  layer.className = 'confetti';
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    p.style.left = `${(Math.random() * 100).toFixed(1)}%`;
    p.style.background = COLORS[i % COLORS.length];
    p.style.animationDuration = `${(1.4 + Math.random() * 0.8).toFixed(2)}s`;
    p.style.animationDelay = `${(Math.random() * 0.4).toFixed(2)}s`;
    p.style.setProperty('--r', `${Math.round(Math.random() * 360)}deg`);
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 2800);
}

export function bigCelebration(): void {
  confetti(60);
  const o = document.createElement('div');
  o.className = 'celebrate';
  o.textContent = '🎉';
  document.body.appendChild(o);
  setTimeout(() => o.remove(), 1500);
}
