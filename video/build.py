"""Builds video/covex-demo.mp4 from the Figma cards, the live recording and the voiceover.

  - cards (video/cards/*.png, designed in Figma) and the live scenes, in script order
  - live frames: 2880x1620 screencast frames, zoomed in post with eased crops (no
    upscaling up to 1.5x, so text stays sharp), cursor + click ripple drawn at 30 fps
  - highlights: the element the voice is naming glows in the accent colour (its real,
    sampled boundingBox and corner radius) while the rest dims 40%; 200 ms fades
  - voiceover clips placed at each scene start; captions burned in (aligned to the
    voice's word timings); background music ducked under the voice
  - also writes docs/media/covex-highlight.gif (15 s)

    python video/tts.py && npx tsx video/record.ts && python video/build.py [path/to/music.mp3]
"""
import bisect
import json
import math
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "out"
FPS = 30
W, H = 1920, 1080
CARD_PAD = {"title": 1.5, "problem": 1.4, "end": 2.2}
LEAD = 0.35  # voice starts this long after a segment starts
MUSIC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "assets" / "music.mp3"

script = json.loads((ROOT / "script.json").read_text(encoding="utf-8"))
timings = json.loads((OUT / "vo" / "timings.json").read_text(encoding="utf-8"))
ev = json.loads((OUT / "events.json").read_text(encoding="utf-8"))
# spliced scenes recorded separately (ONLY=<scene> npx tsx video/record.ts): merge them in.
# Timestamps are absolute, so recordings made at different times never overlap.
for extra in sorted(OUT.glob("events-*.json")):
    e2 = json.loads(extra.read_text(encoding="utf-8"))
    for key in ("frames", "switches", "scenes", "zooms", "highlights", "cueLog"):
        ev.setdefault(key, []).extend(e2.get(key, []))
    ev["cursor"]["moves"].extend(e2["cursor"]["moves"])
    ev["cursor"]["clicks"].extend(e2["cursor"]["clicks"])
    print(f"merged {extra.name}: scenes {[x['id'] for x in e2['scenes']]}")
DSF = ev["dsf"]
switches = sorted(ev.get("switches", []), key=lambda x: x["t"])
swt = [x["t"] for x in switches]


def tab_at(ts: float) -> int:
    i = bisect.bisect_right(swt, ts) - 1
    return switches[i]["tab"] if i >= 0 else 1


# frames per tab (only the tab on screen is shown)
by_tab = {}
for f_ in ev["frames"]:
    by_tab.setdefault(f_.get("tab", 1), []).append(f_)
for lst in by_tab.values():
    lst.sort(key=lambda f_: f_["t"])
tab_times = {k: [f_["t"] for f_ in v] for k, v in by_tab.items()}
live = {s["id"]: s for s in ev["scenes"]}


def ease(k: float) -> float:
    k = max(0.0, min(1.0, k))
    return 4 * k**3 if k < 0.5 else 1 - (-2 * k + 2) ** 3 / 2


# ── timeline ──────────────────────────────────────────────────────────────────
segments = []  # {id, kind, start, dur, card?/t0?}
t = 0.0
for s in script["scenes"]:
    if s["kind"] == "card":
        # silent cards (the thumbnail opening) hold for a fixed time
        dur = s["hold"] if "hold" in s else timings[s["id"]]["duration"] + CARD_PAD[s["id"]]
        segments.append({"id": s["id"], "kind": "card", "start": t, "dur": dur, "card": ROOT / "cards" / s["card"]})
    else:
        sc = live[s["id"]]
        dur = sc["t1"] - sc["t0"]
        segments.append({"id": s["id"], "kind": "live", "start": t, "dur": dur, "t0": sc["t0"]})
    t += dur
TOTAL = t
print(f"total {TOTAL:.1f}s ({int(TOTAL // 60)}:{TOTAL % 60:04.1f})")
live_segs = [s for s in segments if s["kind"] == "live"]
LIVE_START, LIVE_END = live_segs[0]["start"], live_segs[-1]["start"] + live_segs[-1]["dur"]

# ── cursor sprite (white arrow, soft shadow), drawn in output pixels ───────
CS = DSF  # css px → source px
arrow = [(5, 3), (5, 22), (10, 17.5), (13.5, 25), (17, 23.4), (13.6, 16), (20.5, 16)]


def make_sprite(scale: float):
    """Arrow sprite at `scale` output px per css px (the cursor grows with the zoom)."""
    size = int(40 * scale) + 8
    spr = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sh = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pts = [(x * scale + 4, y * scale + 4) for x, y in arrow]
    ImageDraw.Draw(sh).polygon([(x + scale, y + 2 * scale) for x, y in pts], fill=(0, 0, 0, 150))
    sh = sh.filter(ImageFilter.GaussianBlur(2 * scale))
    ImageDraw.Draw(spr).polygon(pts, fill=(255, 255, 255, 255), outline=(17, 17, 17, 255), width=max(1, round(1.3 * scale)))
    return Image.alpha_composite(sh, spr), (5 * scale + 4, 3 * scale + 4)


sprites = {}


def sprite_for(scale: float):
    key = round(scale, 2)
    if key not in sprites:
        sprites[key] = make_sprite(key)
    return sprites[key]


moves = sorted(ev["cursor"]["moves"], key=lambda m: m["t0"])
mstarts = [m["t0"] for m in moves]
clicks = ev["cursor"]["clicks"]


def cursor_at(ts: float):
    i = bisect.bisect_right(mstarts, ts) - 1
    if i < 0:
        return moves[0]["from"] if moves else {"x": 960, "y": 540}
    m = moves[i]
    k = (ts - m["t0"]) / (m["ms"] / 1000)
    if k >= 1:
        return m["to"]
    e = ease(k)
    return {"x": m["from"]["x"] + (m["to"]["x"] - m["from"]["x"]) * e, "y": m["from"]["y"] + (m["to"]["y"] - m["from"]["y"]) * e}


def draw_cursor(img: Image.Image, ts: float, box):
    """Draw the ripple + cursor on the output frame; `box` is the css crop window."""
    bx, by, bw, bh = box
    k_out = W / bw  # output px per css px
    to_out = lambda x, y: ((x - bx) * k_out, (y - by) * k_out)
    for c in clicks:
        age = ts - c["t"]
        if 0 <= age <= 0.55:
            k = ease(age / 0.55)
            r = 22 * k_out * (0.3 + 1.05 * k)
            a = int(255 * (1 - k))
            size = int(r * 2 + 12)
            patch = Image.new("RGBA", (size, size), (0, 0, 0, 0))
            pd = ImageDraw.Draw(patch)
            o = size / 2
            pd.ellipse((o - r, o - r, o + r, o + r), fill=(62, 230, 200, int(a * 0.18)), outline=(62, 230, 200, a), width=max(2, int(3 * k_out)))
            cx, cy = to_out(c["x"], c["y"])
            img.alpha_composite(patch, (int(cx - o), int(cy - o)))
    p = cursor_at(ts)
    spr, hot = sprite_for(k_out)
    px, py = to_out(p["x"], p["y"])
    img.alpha_composite(spr, (int(px - hot[0]), int(py - hot[1])))


# ── zoom ──────────────────────────────────────────────────────────────────────
ZIN, ZOUT, ZMAX = 0.75, 0.6, 1.5


def zoom_box(ts: float):
    """Crop window in css px (x, y, w, h)."""
    full = (0.0, 0.0, float(W), float(H))
    for z in ev["zooms"]:
        if z["t0"] <= ts <= z["t1"] + ZOUT:
            p = ease((ts - z["t0"]) / ZIN) if ts <= z["t1"] else 1 - ease((ts - z["t1"]) / ZOUT)
            s = max(1.0, min(ZMAX, W / z["w"], H / z["h"]))
            cw, ch = W / s, H / s
            cx, cy = z["x"] + z["w"] / 2, z["y"] + z["h"] / 2
            x = min(max(cx - cw / 2, 0), W - cw)
            y = min(max(cy - ch / 2, 0), H - ch)
            return tuple(f + (g - f) * p for f, g in zip(full, (x, y, cw, ch)))
    return full


# ── highlights: glow + dim, from the element's sampled boxes ─────────────────
HL = ev.get("highlights", [])
for h in HL:
    if not h["t1"]:
        h["t1"] = h["samples"][-1]["t"] if h["samples"] else h["t0"]
    h["st"] = [smp["t"] for smp in h["samples"]]
HL_FADE, DIM, ACCENT = 0.2, 0.40, (62, 230, 200)


def highlight_at(ts: float):
    """(box css, radius, alpha) of the highlight showing at ts, or None. One at a time: the latest wins."""
    best = None
    for h in HL:
        if not h["samples"] or ts < h["t0"] or ts > h["t1"] + HL_FADE:
            continue
        a = min(1.0, (ts - h["t0"]) / HL_FADE)
        if ts > h["t1"]:
            a = min(a, 1 - (ts - h["t1"]) / HL_FADE)
        i = max(0, bisect.bisect_right(h["st"], ts) - 1)
        smp = h["samples"][i]
        cand = ((smp["x"], smp["y"], smp["w"], smp["h"]), h["radius"], max(0.0, a), h["t0"])
        if best is None or cand[3] > best[3]:
            best = cand
    return best


def draw_highlight(img: Image.Image, ts: float, box) -> Image.Image:
    found = highlight_at(ts)
    if not found:
        return img
    (ex, ey, ew, eh), radius, a, _ = found
    bx, by, bw, bh = box
    k = W / bw
    pad = 6
    x0, y0 = (ex - pad - bx) * k, (ey - pad - by) * k
    x1, y1 = (ex + ew + pad - bx) * k, (ey + eh + pad - by) * k
    r = (radius + pad) * k
    # dim everything outside the element (rounded to its corners)
    mask = Image.new("L", (W, H), 255)
    ImageDraw.Draw(mask).rounded_rectangle((x0, y0, x1, y1), radius=r, fill=0)
    arr = np.asarray(img, dtype=np.float32)
    m = np.asarray(mask, dtype=np.float32)[..., None] / 255.0
    arr = arr[..., :3] * (1 - DIM * a * m)
    out = Image.fromarray(arr.clip(0, 255).astype(np.uint8), "RGB").convert("RGBA")
    # glow: blurred halo + crisp edge, gentle pulse
    pulse = 0.82 + 0.18 * math.sin(2 * math.pi * ts / 1.4)
    g = int(26 * k) + 4
    px0, py0 = int(max(0, x0 - g)), int(max(0, y0 - g))
    px1, py1 = int(min(W, x1 + g)), int(min(H, y1 + g))
    if px1 - px0 < 4 or py1 - py0 < 4:
        return out
    halo = Image.new("RGBA", (px1 - px0, py1 - py0), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    rect = (x0 - px0, y0 - py0, x1 - px0, y1 - py0)
    hd.rounded_rectangle(rect, radius=r, outline=ACCENT + (int(170 * a * pulse),), width=max(4, int(9 * k)))
    halo = halo.filter(ImageFilter.GaussianBlur(10 * k))
    edge = Image.new("RGBA", halo.size, (0, 0, 0, 0))
    ImageDraw.Draw(edge).rounded_rectangle(rect, radius=r, outline=ACCENT + (int(235 * a),), width=max(2, int(2.2 * k)))
    out.alpha_composite(Image.alpha_composite(halo, edge), (px0, py0))
    return out


# ── frames ────────────────────────────────────────────────────────────────────
cache = {"file": None, "img": None}


def source(ts: float) -> Image.Image:
    tab = tab_at(ts)
    lst, tt = by_tab.get(tab) or by_tab[1], tab_times.get(tab) or tab_times[1]
    i = max(0, bisect.bisect_right(tt, ts) - 1)
    f = lst[i]["file"]
    if cache["file"] != f:
        path = OUT / f if "/" in f else OUT / "frames" / f
        cache["file"], cache["img"] = f, Image.open(path).convert("RGB")
    return cache["img"]


cards = {}


def fade(img: Image.Image, k: float) -> Image.Image:
    return img if k >= 1 else Image.blend(Image.new("RGB", img.size, (0, 0, 0)), img, max(0.0, k))


def render(tout: float) -> Image.Image:
    seg = next(s for s in segments if s["start"] <= tout < s["start"] + s["dur"]) if tout < TOTAL else segments[-1]
    local = tout - seg["start"]
    if seg["kind"] == "card":
        if seg["id"] not in cards:
            cards[seg["id"]] = Image.open(seg["card"]).convert("RGB").resize((W, H))
        # the very first frames are the thumbnail itself: no fade in from black
        k = min(1.0 if seg is segments[0] else local / 0.4, (seg["dur"] - local) / 0.4, 1.0)
        return fade(cards[seg["id"]], k)
    ts = seg["t0"] + local
    box = zoom_box(ts)
    x, y, w, h = box
    out = source(ts).resize((W, H), Image.LANCZOS, box=(x * CS, y * CS, (x + w) * CS, (y + h) * CS), reducing_gap=2.0)
    out = draw_highlight(out, ts, box) if highlight_at(ts) else out.convert("RGBA")
    draw_cursor(out, ts, box)
    k = min((tout - LIVE_START) / 0.4, (LIVE_END - tout) / 0.4, 1.0)
    return fade(out.convert("RGB"), k)


def write_silent(path: Path):
    n = int(math.ceil(TOTAL * FPS))
    ff = subprocess.Popen(
        ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", str(path)],
        stdin=subprocess.PIPE,
    )
    for i in range(n):
        ff.stdin.write(render(i / FPS).tobytes())
        if i % 300 == 0:
            print(f"  frame {i}/{n}", flush=True)
    ff.stdin.close()
    ff.wait()


# ── captions (ASS), aligned to the voice's word timings ──────────────────────
def norm(w: str) -> str:
    return re.sub(r"[^a-z0-9]", "", w.lower())


def ass_time(s: float) -> str:
    h, rem = divmod(max(0.0, s), 3600)
    m, sec = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{sec:05.2f}"


def captions(path: Path):
    lines = []
    for seg in segments:
        sc = next(s for s in script["scenes"] if s["id"] == seg["id"])
        if not sc.get("vo"):
            continue
        tokens = sc["vo"].split()
        words = timings[seg["id"]]["words"]
        # give each script token (with its punctuation) the time of the spoken word it starts with
        times, wi = [], 0
        for tok in tokens:
            nt = norm(tok)
            t_ = None
            while wi < len(words):
                nw = norm(words[wi]["w"])
                wi += 1
                if nw and (nt.startswith(nw) or nw.startswith(nt)):
                    t_ = words[wi - 1]["t"]
                    break
            times.append(t_ if t_ is not None else (times[-1] if times else 0.0))
        base = seg["start"] + LEAD
        end_of_voice = base + timings[seg["id"]]["duration"]
        chunk, start = [], None
        for i, tok in enumerate(tokens):
            if not chunk:
                start = times[i]
            chunk.append(tok)
            text = " ".join(chunk)
            last = i == len(tokens) - 1
            if last or len(text) >= 34 or (re.search(r"[.?!:]$", tok) and len(text) >= 12):
                nxt = times[i + 1] if not last else (end_of_voice - base)
                lines.append((base + start, min(base + nxt, end_of_voice + 0.2), text))
                chunk = []
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Segoe UI Semibold,46,&H00FFFFFF,&H00FFFFFF,&H00000000,&H55000000,0,0,0,0,100,100,0,0,3,14,0,2,80,80,64,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    body = "\n".join(f"Dialogue: 0,{ass_time(a)},{ass_time(b)},Cap,,0,0,0,,{txt}" for a, b, txt in lines)
    path.write_text(header + body + "\n", encoding="utf-8")
    print(f"captions: {len(lines)} lines")


# ── audio + mux ───────────────────────────────────────────────────────────────
def mux(silent: Path, ass: Path, final: Path):
    inputs, filters, labels = ["-i", str(silent)], [], []
    voiced = [seg for seg in segments if seg["id"] in timings]
    for n, seg in enumerate(voiced, start=1):
        inputs += ["-i", str(OUT / "vo" / f"{seg['id']}.mp3")]
        ms = int((seg["start"] + LEAD) * 1000)
        filters.append(f"[{n}:a]aresample=48000,adelay={ms}|{ms},apad[v{n}]")
        labels.append(f"[v{n}]")
    filters.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0:duration=longest,atrim=0:{TOTAL:.3f},asplit=2[vo][sc]")
    m = len(voiced) + 1
    if MUSIC.exists():
        inputs += ["-i", str(MUSIC)]
        filters.append(
            f"[{m}:a]aresample=48000,atrim=0:{TOTAL:.3f},afade=t=in:d=1.5,afade=t=out:st={TOTAL - 3.5:.3f}:d=3.5,volume=0.30[mu];"
            f"[mu][sc]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=450[duck];"
            f"[vo][duck]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]"
        )
    else:
        filters.append("[vo]anull[a]")
        print("no music file: voice only")
    # subtitles filter path: relative, run from OUT
    cmd = ["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", ";".join(filters), "-map", "0:v", "-map", "[a]",
           "-vf", f"subtitles={ass.name}", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-t", f"{TOTAL:.3f}", str(final)]
    subprocess.run(cmd, check=True, cwd=OUT)


def gif(final: Path, start: float, dur: float, path: Path):
    f = f"trim=start={start:.2f}:duration={dur:.2f},setpts=PTS-STARTPTS,fps=12,scale=800:-1:flags=lanczos"
    pal = OUT / "pal.png"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(final), "-vf", f + ",palettegen=max_colors=160:stats_mode=diff", str(pal)], check=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(final), "-i", str(pal), "-lavfi", f + " [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle", str(path)], check=True)


if __name__ == "__main__":
    silent, ass = OUT / "silent.mp4", OUT / "captions.ass"
    final = ROOT / "covex-demo.mp4"
    write_silent(silent)
    captions(ass)
    mux(silent.resolve(), ass, final.resolve())
    search = next(s for s in segments if s["id"] == "search")
    gif(final, search["start"] + 2.0, 15.0, ROOT.parent / "docs" / "media" / "covex-highlight.gif")
    print(f"wrote {final} and docs/media/covex-highlight.gif")
