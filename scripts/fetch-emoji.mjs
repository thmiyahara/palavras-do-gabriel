// Downloads the Microsoft Fluent Emoji 3D PNG for every word in data/words.json
// into public/img/<id>.png. Idempotent: existing files are skipped.
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/img');
const HOSTS = [
  'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/',
  'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/',
];

const data = JSON.parse(await readFile(resolve(root, 'data/words.json'), 'utf8'));
await mkdir(outDir, { recursive: true });

const exists = (p) => access(p).then(() => true, () => false);
const snake = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

// Plain emoji live in <Name>/3D/, skin-tone emoji in <Name>/Default/3D/.
// File names are the folder name in lowercase with spaces as underscores; names with
// a hyphen (T-Rex, T-shirt) may keep it, so both spellings are tried.
function candidates(folder) {
  const f = encodeURIComponent(folder);
  const names = [...new Set([snake(folder), folder.toLowerCase().replace(/ /g, '_')])];
  return names.flatMap((s) => [`assets/${f}/3D/${s}_3d.png`, `assets/${f}/Default/3D/${s}_3d_default.png`]);
}

async function fetchFirst(paths) {
  let lastErr;
  for (const host of HOSTS) {
    for (const p of paths) {
      try {
        const res = await fetch(host + p);
        if (res.ok) return Buffer.from(await res.arrayBuffer());
        if (res.status !== 404) lastErr = new Error(`${res.status} ${host + p}`);
      } catch (e) {
        lastErr = e;
      }
    }
  }
  throw lastErr ?? new Error('not found: ' + paths.join(' | '));
}

const failures = [];
let done = 0;
let skipped = 0;
const queue = [...data.words];

async function worker() {
  while (queue.length) {
    const w = queue.shift();
    const out = resolve(outDir, `${w.id}.png`);
    if (await exists(out)) { skipped++; continue; }
    try {
      await writeFile(out, await fetchFirst(candidates(w.emoji)));
      done++;
      console.log(`ok   ${w.id.padEnd(12)} ${w.emoji}`);
    } catch (e) {
      failures.push(w.id);
      console.error(`FAIL ${w.id.padEnd(12)} ${w.emoji}: ${e.message}`);
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));

const lic = resolve(outDir, 'LICENSE-fluent-emoji.txt');
if (!(await exists(lic))) {
  try { await writeFile(lic, await fetchFirst(['LICENSE'])); } catch (e) { console.error('LICENSE:', e.message); }
}

console.log(`\n${done} downloaded, ${skipped} skipped, ${failures.length} failed`);
if (failures.length) { console.error('Missing:', failures.join(', ')); process.exit(1); }
