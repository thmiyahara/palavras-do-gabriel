// Plays the pre-recorded MP3 clips through ONE shared <audio> element.
// iOS only allows playback started synchronously inside a user gesture; once this
// element has played from a tap, later programmatic plays on it are allowed too.
import * as people from './people';
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

/** Silly mode voices: playback speed without pitch correction. Fast = chipmunk, slow = giant. */
interface SillyVoice {
  rate: number;
  speechRate: number;
  speechPitch: number;
}
const SILLY_VOICES: readonly SillyVoice[] = [
  { rate: 1.45, speechRate: 1.3, speechPitch: 2 }, // fininha (esquilo)
  { rate: 0.7, speechRate: 0.7, speechPitch: 0.4 }, // grossa (gigante)
];
let sillyVoice: SillyVoice = SILLY_VOICES[0];

/** Picks a silly voice for the next tap (kept for the whole word, including the 🌐 sequence). */
function chooseVoice(): void {
  if (isSilly()) sillyVoice = SILLY_VOICES[Math.floor(Math.random() * SILLY_VOICES.length)];
}

function applyVoice(): void {
  const silly = isSilly();
  el.playbackRate = silly ? sillyVoice.rate : 1;
  const anyEl = el as HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean };
  anyEl.preservesPitch = !silly;
  anyEl.webkitPreservesPitch = !silly;
}

/** Web Speech fallback with the same silliness. */
function say(text: string, lang: Lang): Promise<void> {
  return isSilly()
    ? speech.speak(text, BCP47[lang], { rate: sillyVoice.speechRate, pitch: sillyVoice.speechPitch })
    : speech.speak(text, BCP47[lang]);
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
      say(fallbackText, lang).then(resolve);
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

/** What a tap plays: the name of the thing, or its sound ("au au!"). */
export type Kind = 'name' | 'sound';

/** People added on the device have no MP3: play the recording, else the device voice. */
function playCustom(id: string, text: string, lang: Lang, myToken: number): Promise<void> {
  const url = people.voiceUrl(id);
  if (url) return playClip(url, text, lang, myToken);
  return say(text, lang);
}

function playOne(id: string, lang: Lang, kind: Kind, myToken: number): Promise<void> {
  const w = getWord(id);
  if (kind === 'sound') {
    if (!w.sound) return Promise.resolve(); // silent: the card is muted in the UI
    return playClip(audioUrl(lang, id, 's'), w.sound[lang], lang, myToken);
  }
  if (w.custom) return playCustom(id, w[lang].w, lang, myToken);
  return playClip(audioUrl(lang, id), speechText(w, lang), lang, myToken);
}

export function playWord(id: string, lang: Lang, kind: Kind = 'name'): Promise<void> {
  chooseVoice();
  return playOne(id, lang, kind, ++token);
}

export function playQuestion(id: string, lang: Lang, kind: Kind = 'name'): Promise<void> {
  chooseVoice();
  if (kind === 'sound') return playOne(id, lang, 'sound', ++token);
  const w = getWord(id);
  if (w.custom) {
    // "Cadê Ana?" by the device voice; if it cannot speak, the recording alone still works.
    const myToken = ++token;
    current?.abort();
    return speech.available() ? say(w[lang].q, lang) : playCustom(id, w[lang].w, lang, myToken);
  }
  return playClip(audioUrl(lang, id, 'q'), speechText(w, lang, 'q'), lang, ++token);
}

/** Plays pt → en → ja. `onLang` runs before each clip (and with null at the end). */
export async function playSequence(id: string, kind: Kind = 'name', onLang?: (lang: Lang | null) => void): Promise<void> {
  chooseVoice();
  const myToken = ++token;
  try {
    for (const lang of LANGS) {
      if (myToken !== token) return;
      onLang?.(lang);
      await playOne(id, lang, kind, myToken);
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
