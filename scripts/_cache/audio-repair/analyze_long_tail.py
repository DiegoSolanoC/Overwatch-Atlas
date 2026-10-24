#!/usr/bin/env python3
"""Compare intro.wav vs intro_long.wav to find extended tail and part-2 boundary."""
from __future__ import annotations

import json
from pathlib import Path

import librosa
import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parent


def mono(path: Path, sr: int = 22050) -> np.ndarray:
    y, _ = librosa.load(str(path), sr=sr, mono=True)
    return y.astype(np.float32)


def envelope(y: np.ndarray, sr: int, hop: int = 512) -> tuple[np.ndarray, np.ndarray]:
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop)[0]
    times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)
    return times, rms


def chroma(y: np.ndarray, sr: int, hop: int = 512) -> np.ndarray:
    C = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)
    C /= np.linalg.norm(C, axis=0, keepdims=True) + 1e-12
    return C.astype(np.float32)


def best_lag(ref: np.ndarray, query: np.ndarray) -> tuple[int, float]:
    q = query - query.mean()
    r = ref - ref.mean()
    corr = signal.fftconvolve(r, q[::-1], mode="valid")
    denom = np.linalg.norm(q) * np.sqrt(
        np.convolve(r**2, np.ones(len(q), dtype=np.float32), mode="valid")
    ) + 1e-12
    corr = corr / denom
    i = int(np.argmax(corr))
    return i, float(corr[i])


def main() -> None:
    sr = 22050
    short = mono(ROOT / "intro.wav", sr)
    long = mono(ROOT / "intro_long.wav", sr)
    print(f"short={len(short)/sr:.3f}s long={len(long)/sr:.3f}s")

    # Align long to short using first 15s of short
    q = short[: int(15 * sr)]
    lag, score = best_lag(long, q)
    offset = lag / sr  # short[0] corresponds to long[offset]
    print(f"short[0] -> long@{offset:.3f}s corr={score:.3f}")

    # Where short cut (21.42) lands in long
    short_cut = 21.42
    long_at_short_cut = offset + short_cut
    print(f"short cut 21.42s -> long@{long_at_short_cut:.3f}s")

    # Envelope of long around that region
    times, rms = envelope(long, sr)
    print("\nLong RMS around 18-35s:")
    for t, e in zip(times, rms):
        if 18 <= t <= 35:
            bar = "#" * int(min(40, e * 400))
            print(f"  {t:5.2f}s {e:.4f} {bar}")

    # Find where part2 of short (from 22s) matches in long
    hop = 512
    Cs = chroma(short, sr, hop)
    Cl = chroma(long, sr, hop)
    # short part2 window
    for start in [22.0, 23.0, 24.0]:
        i0 = int(start * sr / hop)
        i1 = int((start + 6) * sr / hop)
        qC = Cs[:, i0:i1]
        best_i, best_s = 0, -1.0
        for i in range(0, Cl.shape[1] - qC.shape[1] + 1, 2):
            s = float(np.mean(np.sum(Cl[:, i : i + qC.shape[1]] * qC, axis=0)))
            if s > best_s:
                best_s = s
                best_i = i
        print(f"short part2@{start:.0f}s -> long@{best_i*hop/sr:.3f}s chroma={best_s:.3f}")

    # Tail extension: compare energy of long after long_at_short_cut vs short after cut
    # Also find onset of decay in long after the main body of part1
    # Look for local max near 20-24 then sustained decay
    region = [(t, e) for t, e in zip(times, rms) if 18 <= t <= 32]
    peak_t, peak_e = max(region, key=lambda x: x[1])
    print(f"\npeak in 18-32s: t={peak_t:.2f} e={peak_e:.4f}")

    # Find when rms drops below 25% of peak after peak (tail underway)
    thresh = peak_e * 0.35
    tail_start = None
    for t, e in region:
        if t >= peak_t and e <= thresh:
            tail_start = t
            break
    print(f"tail_start (rms<=35% peak): {tail_start}")

    # When nearly silent
    quiet = peak_e * 0.08
    tail_end = None
    for t, e in region:
        if tail_start and t >= tail_start and e <= quiet:
            tail_end = t
            break
    if tail_end is None:
        # search further
        for t, e in zip(times, rms):
            if tail_start and t >= tail_start and e <= quiet:
                tail_end = t
                break
    print(f"tail_end (rms<=8% peak): {tail_end}")

    out = {
        "offset_short0_in_long": offset,
        "align_corr": score,
        "long_at_short_cut": long_at_short_cut,
        "peak_t": peak_t,
        "tail_start": tail_start,
        "tail_end": tail_end,
    }
    (ROOT / "long_tail_analysis.json").write_text(json.dumps(out, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
