// Web Speech API fallback, used only when an MP3 clip is missing or cannot play.

const synth: SpeechSynthesis | null = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
let voices: SpeechSynthesisVoice[] = [];

function refresh(): void {
  if (synth) voices = synth.getVoices();
}

if (synth) {
  refresh();
  // Chrome/Edge/Firefox load the voice list asynchronously.
  synth.addEventListener('voiceschanged', refresh);
}

export const available = (): boolean => !!synth;

const norm = (tag: string): string => tag.replace('_', '-').toLowerCase();

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const want = norm(lang);
  const prefix = want.slice(0, 2);
  return (
    voices.find((v) => norm(v.lang) === want && v.localService) ??
    voices.find((v) => norm(v.lang) === want) ??
    voices.find((v) => norm(v.lang).startsWith(prefix))
  );
}

/** Must run inside a user gesture: wakes speech synthesis up on iOS with a silent utterance. */
export function prime(): void {
  if (!synth) return;
  refresh();
  try {
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    synth.speak(u);
  } catch {
    /* ignore */
  }
}

export function speak(text: string, lang: string): Promise<void> {
  return new Promise((resolve) => {
    if (!synth) {
      resolve();
      return;
    }
    if (synth.speaking || synth.pending) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.85;
    u.pitch = 1.1;
    const voice = pickVoice(lang);
    if (voice) u.voice = voice;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
    // Some engines never fire onend; never leave the caller hanging.
    setTimeout(resolve, 5000);
  });
}
