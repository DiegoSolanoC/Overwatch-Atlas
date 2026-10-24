#!/usr/bin/env python3
"""
Prepend intro_long's part-1 (with its longer natural tail) onto repaired.
Keep the full repaired start from 0. During the tail decay, crossfade:
intro fades out while repaired fades in — no silence gap, no abrupt cut.
"""
from __future__ import annotations

import json
import subprocess
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
INTRO_LONG = ROOT / "intro_long.wav"
REPAIRED = ROOT / "repaired.wav"
OUT_WAV = ROOT / "repaired_full.wav"
OUT_MP3 = ROOT / "repaired_full.mp3"
REPORT = ROOT / "prepend_report.json"

# From analysis of intro_long:
# - part1 body ends / decay begins ~20.5–21.2s
# - quiet valley before abridged half ~22.2–22.5s
# - part2 energy returns ~22.7s — must not include that
TAIL_START_S = 20.55  # when longer tail decay begins → full starts rising
INTRO_END_S = 22.35  # end of tail, before abridged half
GAIN = 1.20  # slight level match toward flythrough


def load_wav_stereo(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as wf:
        sr = wf.getframerate()
        nch = wf.getnchannels()
        raw = wf.readframes(wf.getnframes())
    data = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    if nch > 1:
        data = data.reshape(-1, nch)
    else:
        data = np.repeat(data.reshape(-1, 1), 2, axis=1)
    return data, sr


def write_wav_stereo(path: Path, stereo: np.ndarray, sr: int) -> None:
    pcm = (np.clip(stereo, -1.0, 1.0) * 32767.0).astype(np.int16)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm.tobytes())


def rms(x: np.ndarray) -> float:
    return float(np.sqrt(np.mean(x**2) + 1e-12))


def main() -> None:
    intro_st, sr = load_wav_stereo(INTRO_LONG)
    repaired_st, _ = load_wav_stereo(REPAIRED)

    tail_start = TAIL_START_S
    intro_end = INTRO_END_S
    assert intro_end > tail_start

    intro = intro_st[: int(intro_end * sr)].copy()
    repaired = repaired_st.copy()  # keep full original start

    # Level-match intro body to repaired opening
    body = intro[int(8 * sr) : int(16 * sr)].mean(axis=1)
    rep0 = repaired[: int(8 * sr)].mean(axis=1)
    gain = rms(rep0) / (rms(body) + 1e-12)
    gain = float(np.clip(gain, 0.4, 2.5))
    # Blend toward configured gain so we don't overdrive
    gain = float(np.clip(0.5 * (gain + GAIN), 0.5, 2.0))
    intro *= gain

    pre_len = int(tail_start * sr)
    xfade_len = int((intro_end - tail_start) * sr)
    xfade_len = min(xfade_len, len(intro) - pre_len, len(repaired))

    intro_pre = intro[:pre_len]
    intro_tail = intro[pre_len : pre_len + xfade_len]
    rep_head = repaired[:xfade_len]
    rep_rest = repaired[xfade_len:]

    # Equal-power crossfade over the longer tail
    t = np.linspace(0.0, 1.0, xfade_len, dtype=np.float32)[:, None]
    # Cosine smoothstep for a more musical handoff
    t = t * t * (3.0 - 2.0 * t)
    blended = intro_tail * np.cos(t * np.pi * 0.5) + rep_head * np.sin(t * np.pi * 0.5)

    out = np.concatenate([intro_pre, blended, rep_rest], axis=0)

    write_wav_stereo(OUT_WAV, out, sr)
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(OUT_WAV), "-codec:a", "libmp3lame", "-q:a", "2", str(OUT_MP3)],
        check=True,
        capture_output=True,
    )

    report = {
        "source": "intro_long.wav (rdhRY9WEOy4)",
        "tail_start_s": tail_start,
        "intro_end_s": intro_end,
        "xfade_s": xfade_len / sr,
        "gain": gain,
        "repaired_kept_from": 0.0,
        "out_duration": len(out) / sr,
        "layout": (
            f"intro[0-{tail_start:.2f}] + "
            f"crossfade({xfade_len/sr:.2f}s) + "
            f"repaired[{xfade_len/sr:.2f}-end]"
        ),
        "outputs": [str(OUT_WAV), str(OUT_MP3)],
    }
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"Wrote {OUT_WAV}")
    print(f"Wrote {OUT_MP3}")


if __name__ == "__main__":
    main()
