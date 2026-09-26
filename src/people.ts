// Extra people added by the grown-up (aunt, cousin, the family dog...): a name, a photo and an
// optional voice recording of the name. Stored ONLY on this device (IndexedDB), never uploaded.
import type { Word } from './words';

const DB_NAME = 'pg-people';
const STORE = 'people';
const MAX_RECORD_MS = 4000;

export interface Person {
  id: string;
  name: string;
  photo: string; // data URL
  voice?: Blob; // recording of the name
}

const people = new Map<string, Person>();
const voiceUrls = new Map<string, string>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function load(): Promise<void> {
  try {
    const db = await openDb();
    const all = await request(db.transaction(STORE).objectStore(STORE).getAll());
    for (const p of all as Person[]) people.set(p.id, p);
  } catch {
    /* storage unavailable: no custom people this session */
  }
}

async function persist(p: Person): Promise<void> {
  people.set(p.id, p);
  const old = voiceUrls.get(p.id);
  if (old) URL.revokeObjectURL(old);
  voiceUrls.delete(p.id);
  try {
    const db = await openDb();
    await request(db.transaction(STORE, 'readwrite').objectStore(STORE).put(p));
  } catch {
    /* kept in memory only */
  }
}

export const isCustom = (id: string): boolean => id.startsWith('p_');
export const get = (id: string): Person | undefined => people.get(id);
export const all = (): Person[] => [...people.values()];

export async function save(p: Omit<Person, 'id'> & { id?: string }): Promise<Person> {
  const person: Person = { ...p, id: p.id ?? `p_${Date.now().toString(36)}` };
  await persist(person);
  return person;
}

export async function remove(id: string): Promise<void> {
  people.delete(id);
  try {
    const db = await openDb();
    await request(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id));
  } catch {
    /* ignore */
  }
}

/** Playable URL of the recorded name, if any. */
export function voiceUrl(id: string): string | undefined {
  const p = people.get(id);
  if (!p?.voice) return undefined;
  let url = voiceUrls.get(id);
  if (!url) {
    url = URL.createObjectURL(p.voice);
    voiceUrls.set(id, url);
  }
  return url;
}

/** The people as words of the "family" category, shown at every level. */
export function asWords(): Word[] {
  return all().map((p) => ({
    id: p.id,
    cat: 'family',
    level: 1,
    emoji: '',
    custom: true,
    pt: { w: p.name, q: `Cadê ${p.name}?` },
    en: { w: p.name, q: `Where is ${p.name}?` },
    ja: { w: p.name, q: `${p.name}はどこ？` },
  }));
}

// ---------- microphone ----------
export const canRecord = (): boolean =>
  typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

/** Records up to 4 s from the microphone; resolves with the audio blob when stopped. */
export async function record(onStop: () => void): Promise<{ stop: () => void; done: Promise<Blob | null> }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const type = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  const done = new Promise<Blob | null>((resolve) => {
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      onStop();
      resolve(chunks.length ? new Blob(chunks, { type: rec.mimeType }) : null);
    };
  });
  rec.start();
  const timer = setTimeout(() => rec.state !== 'inactive' && rec.stop(), MAX_RECORD_MS);
  return {
    stop: () => {
      clearTimeout(timer);
      if (rec.state !== 'inactive') rec.stop();
    },
    done,
  };
}
