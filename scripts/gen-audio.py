"""Generate one MP3 per word and per quiz question, per language, with edge-tts.

Output: public/audio/<lang>/<id>.mp3 (the word) and public/audio/<lang>/q_<id>.mp3
(the "Where is the ...?" question). Existing files are skipped, so re-running only
fills in what is missing. Run `python -m pip install -U edge-tts` first.
"""
import asyncio
import json
import sys
from pathlib import Path

import edge_tts

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "audio"
VOICES = {
    "pt": "pt-BR-FranciscaNeural",
    "en": "en-US-JennyNeural",
    "ja": "ja-JP-NanamiNeural",
}
RATE = "-10%"  # a little slower for small ears
CONCURRENCY = 3
RETRIES = 3


def jobs(data):
    for w in data["words"]:
        for lang, voice in VOICES.items():
            entry = w[lang]
            word_text = entry.get("tts") or entry["w"]
            yield OUT / lang / f"{w['id']}.mp3", word_text, voice
            yield OUT / lang / f"q_{w['id']}.mp3", entry["q"], voice


async def generate(sem, path, text, voice, failures):
    if path.exists() and path.stat().st_size > 0:
        return "skipped"
    async with sem:
        last = None
        for attempt in range(RETRIES):
            try:
                await edge_tts.Communicate(text, voice, rate=RATE).save(str(path))
                print(f"ok   {path.relative_to(ROOT).as_posix()}  <- {text}")
                return "made"
            except Exception as exc:  # noqa: BLE001 - report and retry
                last = exc
                if path.exists():
                    path.unlink()
                await asyncio.sleep(2 * 2**attempt)
        failures.append((path.relative_to(ROOT).as_posix(), repr(last)))
        return "failed"


async def main():
    data = json.loads((ROOT / "data" / "words.json").read_text(encoding="utf-8"))
    for lang in VOICES:
        (OUT / lang).mkdir(parents=True, exist_ok=True)
    sem = asyncio.Semaphore(CONCURRENCY)
    failures = []
    results = await asyncio.gather(*(generate(sem, *job, failures) for job in jobs(data)))
    made = results.count("made")
    skipped = results.count("skipped")
    print(f"\n{made} generated, {skipped} skipped, {len(failures)} failed")
    for path, err in failures:
        print("FAIL", path, err)
    sys.exit(1 if failures else 0)


asyncio.run(main())
