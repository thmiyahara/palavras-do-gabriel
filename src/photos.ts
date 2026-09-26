// Family photos chosen by the grown-up, stored ONLY on this device (IndexedDB).
// Nothing is uploaded: the site is public, the photos never leave the phone.
const DB_NAME = 'pg-photos';
const STORE = 'photos';
const MAX_SIDE = 512;

/** Words that may get a photo instead of the drawing. */
export const PHOTO_IDS: ReadonlySet<string> = new Set(['mommy', 'daddy', 'baby', 'grandma', 'grandpa', 'boy', 'girl']);
export const canHavePhoto = (id: string): boolean => PHOTO_IDS.has(id);

const cache = new Map<string, string>(); // id -> data URL

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
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

/** Loads every stored photo into memory. Safe to call when IndexedDB is unavailable. */
export async function load(): Promise<void> {
  try {
    const db = await openDb();
    const store = db.transaction(STORE).objectStore(STORE);
    const [keys, values] = await Promise.all([request(store.getAllKeys()), request(store.getAll())]);
    keys.forEach((k, i) => cache.set(String(k), values[i] as string));
  } catch {
    /* private mode or old browser: photos simply stay off */
  }
}

export const photoOf = (id: string): string | undefined => cache.get(id);

/** Shrinks and center-crops the picked image to a square JPEG data URL. */
export function shrinkToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const out = Math.min(MAX_SIDE, side);
      const canvas = document.createElement('canvas');
      canvas.width = out;
      canvas.height = out;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('no canvas'));
        return;
      }
      const sx = (img.naturalWidth - side) / 2;
      const sy = (img.naturalHeight - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('cannot read image'));
    };
    img.src = url;
  });
}

export async function setPhoto(id: string, file: File): Promise<void> {
  const dataUrl = await shrinkToDataUrl(file);
  cache.set(id, dataUrl);
  try {
    const db = await openDb();
    await request(db.transaction(STORE, 'readwrite').objectStore(STORE).put(dataUrl, id));
  } catch {
    /* kept in memory for this session only */
  }
}

export async function removePhoto(id: string): Promise<void> {
  cache.delete(id);
  try {
    const db = await openDb();
    await request(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id));
  } catch {
    /* ignore */
  }
}

/** Opens the camera / gallery picker. Must be called inside a user gesture. */
export function pick(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.click();
  });
}
