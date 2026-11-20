"""Voiceover: one MP3 per scene with edge-tts (free Microsoft neural voices), plus
word timings for the captions. Writes video/out/vo/<scene>.mp3 and video/out/vo/timings.json.

    python video/tts.py
"""
import asyncio
import json
import subprocess
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "out" / "vo"


def duration(path: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)], capture_output=True, text=True)
    return float(r.stdout.strip())


async def synth(text: str, voice: str, rate: str, mp3: Path):
    """The free service sometimes returns no audio; retry with backoff."""
    for attempt in range(6):
        try:
            return await synth_once(text, voice, rate, mp3)
        except edge_tts.exceptions.NoAudioReceived:
            await asyncio.sleep(2 + attempt * 3)
    raise RuntimeError(f"edge-tts gave no audio after retries: {mp3.name}")


async def synth_once(text: str, voice: str, rate: str, mp3: Path):
    words = []
    com = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    with open(mp3, "wb") as f:
        async for chunk in com.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                # offsets are in 100-ns units
                words.append({"t": chunk["offset"] / 1e7, "d": chunk["duration"] / 1e7, "w": chunk["text"]})
    return words


async def main():
    script = json.loads((ROOT / "script.json").read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    tpath = OUT / "timings.json"
    old = json.loads(tpath.read_text(encoding="utf-8")) if tpath.exists() else {}
    timings = {}
    total = 0.0
    for s in script["scenes"]:
        if not s.get("vo"):
            continue  # silent card (the thumbnail opening)
        mp3 = OUT / f"{s['id']}.mp3"
        prev = old.get(s["id"])
        # keep a clip whose text hasn't changed: re-synthesising can shift word timings
        # and break the sync of a recording made against them
        if prev and prev.get("vo") == s["vo"] and mp3.exists():
            timings[s["id"]] = prev
            total += prev["duration"]
            print(f"{s['id']:9} {prev['duration']:6.2f}s  (unchanged)")
            continue
        words = await synth(s["vo"], script["voice"], script["rate"], mp3)
        d = duration(mp3)
        timings[s["id"]] = {"duration": d, "words": words, "vo": s["vo"]}
        total += d
        print(f"{s['id']:9} {d:6.2f}s  {len(words)} words")
    (OUT / "timings.json").write_text(json.dumps(timings, indent=1), encoding="utf-8")
    print(f"voice total {total:.1f}s")


asyncio.run(main())
