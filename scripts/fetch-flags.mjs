// Downloads the three flag SVGs (Twemoji, CC-BY 4.0) used by the language switcher.
// Emoji flags do not render on Windows, so the app ships its own images.
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/';
const FLAGS = { pt: '1f1e7-1f1f7', en: '1f1fa-1f1f8', ja: '1f1ef-1f1f5' };

for (const [lang, code] of Object.entries(FLAGS)) {
  const res = await fetch(`${BASE}${code}.svg`);
  if (!res.ok) throw new Error(`${lang}: HTTP ${res.status}`);
  await writeFile(resolve(root, `public/img/flag-${lang}.svg`), await res.text());
  console.log('ok', lang);
}
await writeFile(
  resolve(root, 'public/img/LICENSE-twemoji.txt'),
  'Flag images (flag-*.svg) are from Twemoji (https://github.com/jdecked/twemoji),\nlicensed under CC-BY 4.0: https://creativecommons.org/licenses/by/4.0/\n',
);
