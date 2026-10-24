#!/usr/bin/env python3
"""
Prepend intro missing piece (0 to ~21.5s, before abridged half) onto the
start of repaired.wav. Chroma says the intro tail continues into
repaired ~0-6s — crossfade there for a smooth handoff.
"""
from __future__ import annotations

import json
import subprocess
import wave
from pathlib import Path

import librosa
import numpy as np

ROOT = Path(__file__).resolve().parent
INTRO = ROOT / "intro.wav"
REPAIRED = ROOT / "repaired.wav"
OUT_WAV = ROOT / "repaired_full.wav"
OUT_MP3 = ROOT / "repaired_full.mp3"
REPORT = ROOT / "prepend_report.json"

# From v2 analysis:
# - part2 (abridged) starts ~21.5-22s in intro (scores jump at 22+)
# - intro tail [cut-6, cut] matches repaired @ ~0.09s (score ~0.90)
#   => cut maps to repaired ~6.09s
CUT_S = 21.42
REPAIRED_JOIN_S = 6.093
FADE_S = 0.55


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
    intro_st, sr = load_wav_stereo(INTRO)
    repaired_st, _ = load_wav_stereo(REPAIRED)

    cut = CUT_S
    join = REPAIRED_JOIN_S
    fade = int(FADE_S * sr)

    intro_piece = intro_st[: int(cut * sr)].copy()
    join_samp = int(join * sr)
    fade = min(fade, join_samp, len(intro_piece) // 4)

    # Level-match intro tail to repaired around join
    intro_tail_m = intro_piece[-int(2.5 * sr) :].mean(axis=1)
    rep_m = repaired_st[join_samp : join_samp + int(2.5 * sr)].mean(axis=1)
    gain = rms(rep_m) / (rms(intro_tail_m) + 1e-12)
    gain = float(np.clip(gain, 0.35, 3.0))
    intro_piece *= gain
    print(f"cut={cut:.3f}s join=repaired@{join:.3f}s fade={fade/sr:.3f}s gain={gain:.3f}")

    intro_pre = intro_piece[:-fade]
    intro_tail = intro_piece[-fade:]
    rep_head = repaired_st[join_samp - fade : join_samp]
    rep_rest = repaired_st[join_samp:]

    ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)[:, None]
    # Equal-power-ish crossfade
    blended = intro_tail * np.sqrt(1.0 - ramp) + rep_head * np.sqrt(ramp)

    out = np.concatenate([intro_pre, blended, rep_rest], axis=0)
    print(
        f"out={len(out)/sr:.3f}s "
        f"(intro {len(intro_pre)/sr:.2f} + xfade {fade/sr:.2f} + repaired {len(rep_rest)/sr:.2f})"
    )

    write_wav_stereo(OUT_WAV, out, sr)
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(OUT_WAV), "-codec:a", "libmp3lame", "-q:a", "2", str(OUT_MP3)],
        check=True,
        capture_output=True,
    )

    # Quick verify: chroma continuity across the join
    asr = 22050
    hop = 512
    y, _ = librosa.load(str(OUT_WAV), sr=asr, mono=True)
    # Join in output is at len(intro_pre)/sr + fade/(2*sr) roughly mid-fade
    join_out_s = len(intro_pre) / sr + (fade / sr) * 0.5
    C = librosa.feature.chroma_cqt(y=y, sr=asr, hop_length=hop)
    C /= np.linalg.norm(C, axis=0, keepdims=True) + 1e-12
    mid = int(join_out_s * asr / hop)
    # similarity of frames just before vs after join
    pre = C[:, mid - 8 : mid].mean(axis=1)
    post = C[:, mid : mid + 8].mean(axis=1)
    sim = float(np.dot(pre, post) / ((np.linalg.norm(pre) + 1e-12) * (np.linalg.norm(post) + 1e-12)))
    print(f"chroma continuity across join ~ {sim:.3f}")

    report = {
        "cut_s": cut,
        "repaired_join_s": join,
        "fade_s": fade / sr,
        "gain": gain,
        "join_out_s": join_out_s,
        "chroma_continuity": sim,
        "out_duration": len(out) / sr,
        "dropped_repaired_head_s": join,
        "outputs": [str(OUT_WAV), str(OUT_MP3)],
        "notes": (
            "Intro part1 cut before abridged half (~21.4s). "
            "Crossfades into repaired at ~6.1s where intro tail musically continues "
            "(skips flythrough cold-open 0-6s that the missing piece replaces)."
        ),
    }
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Wrote {OUT_WAV}")
    print(f"Wrote {OUT_MP3}")


if __name__ == "__main__":
    main()
