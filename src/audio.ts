// Plays the pre-recorded MP3 clips through ONE shared <audio> element.
// iOS only allows playback started synchronously inside a user gesture; once this
// element has played from a tap, later programmatic plays on it are allowed too.
import { BCP47, LANGS, isSilly, type Lang } from './settings';
import * as speech from './speech';
import { audioUrl, getWord, speechText } from './words';

const el = new Audio();
el.preload = 'auto';

let token = 0; // bumps on every new request so stale clips are ignored
let current: { abort: () => void } | null = null;
let primed = false;

/** Call from the first user gesture of the session. */
export function unlock(): void {
  if (primed) return;
  primed = true;
  speech.prime();
}

/** Silly mode: faster playback without pitch correction = chipmunk voice. */
function applyVoice(): void {
  const chipmunk = isSilly();
  el.playbackRate = chipmunk ? 1.45 : 1;
  const anyEl = el as HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean };
  anyEl.preservesPitch = !chipmunk;
  anyEl.webkitPreservesPitch = !chipmunk;
}

function playClip(url: string, fallbackText: string, lang: Lang, myToken: number): Promise<void> {
  current?.abort();
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = (): void => {
      el.removeEventListener('ended', onEnd);
      el.removeEventListener('error', onErr);
      if (current?.abort === abort) current = null;
    };
    const onEnd = (): void => {
      if (settled) return;
      settled = true;
      finish();
      resolve();
    };
    const onErr = (): void => {
      if (settled) return;
      settled = true;
      finish();
      if (myToken !== token) {
        resolve();
        return;
      }
      speech.speak(fallbackText, BCP47[lang]).then(resolve);
    };
    const abort = (): void => {
      if (settled) return;
      settled = true;
      finish();
      resolve();
    };
    current = { abort };
    el.addEventListener('ended', onEnd);
    el.addEventListener('error', onErr);
    el.src = url;
    applyVoice();
    const p = el.play(); // synchronous: keeps the user-gesture chain intact
    if (p) p.catch(onErr);
  });
}

const pause = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** The word, then its onomatopoeia when it has one ("cachorro" … "au au!"). */
async function wordThenSound(id: string, lang: Lang, myToken: number): Promise<void> {
  const w = getWord(id);
  await playClip(audioUrl(lang, id), speechText(w, lang), lang, myToken);
  if (!w.sound || myToken !== token) return;
  await pause(200);
  if (myToken !== token) return;
  await playClip(audioUrl(lang, id, 's'), w.sound[lang], lang, myToken);
}

export function playWord(id: string, lang: Lang): Promise<void> {
  return wordThenSound(id, lang, ++token);
}

export function playQuestion(id: string, lang: Lang): Promise<void> {
  const w = getWord(id);
  return playClip(audioUrl(lang, id, 'q'), speechText(w, lang, 'q'), lang, ++token);
}

/** Plays pt → en → ja. `onLang` runs before each clip (and with null at the end). */
export async function playSequence(id: string, onLang?: (lang: Lang | null) => void): Promise<void> {
  const myToken = ++token;
  try {
    for (const lang of LANGS) {
      if (myToken !== token) return;
      onLang?.(lang);
      await wordThenSound(id, lang, myToken);
      if (myToken !== token) return;
      await pause(250);
    }
  } finally {
    onLang?.(null);
  }
}

export function stop(): void {
  token++;
  current?.abort();
  el.pause();
}
