#!/usr/bin/env python3
"""Find where intro_long's part-1 tail extends past the short intro cut."""
from __future__ import annotations

import wave
from pathlib import Path

import librosa
import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parent
SR = 48000


def load_stereo(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as wf:
        assert wf.getframerate() == SR
        nch = wf.getnchannels()
        raw = wf.readframes(wf.getnframes())
    data = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    if nch > 1:
        return data.reshape(-1, nch)
    return np.repeat(data.reshape(-1, 1), 2, axis=1)


def mono(x: np.ndarray) -> np.ndarray:
    return x.mean(axis=1)


def align(short_m: np.ndarray, long_m: np.ndarray) -> float:
    # Use mid body 5-15s of short for alignment into long
    q = short_m[int(5 * SR) : int(15 * SR)]
    r = long_m
    qn = q - q.mean()
    rn = r - r.mean()
    corr = signal.fftconvolve(rn, qn[::-1], mode="valid")
    denom = np.linalg.norm(qn) * np.sqrt(
        np.convolve(rn**2, np.ones(len(qn), dtype=np.float32), mode="valid")
    ) + 1e-12
    corr = corr / denom
    peak = int(np.argmax(corr))
    # peak is where short[5s] starts in long => short[0] at peak - 5s
    short0 = (peak / SR) - 5.0
    print(f"align corr={corr[peak]:.3f} short[0]->long@{short0:.3f}s")
    return short0


def rms_curve(m: np.ndarray, hop: int = 1024) -> tuple[np.ndarray, np.ndarray]:
    n = 2048
    vals = []
    times = []
    for i in range(0, len(m) - n, hop):
        vals.append(float(np.sqrt(np.mean(m[i : i + n] ** 2))))
        times.append(i / SR)
    return np.array(times), np.array(vals)


def main() -> None:
    short = load_stereo(ROOT / "intro.wav")
    long = load_stereo(ROOT / "intro_long.wav")
    short_m = mono(short)
    long_m = mono(long)

    off = align(short_m, long_m)  # short[t] ~= long[t+off]

    # Chroma: find part2 start in long by matching short[22:30]
    asr = 22050
    hop = 512
    s_a, _ = librosa.load(str(ROOT / "intro.wav"), sr=asr, mono=True)
    l_a, _ = librosa.load(str(ROOT / "intro_long.wav"), sr=asr, mono=True)
    Cs = librosa.feature.chroma_cqt(y=s_a, sr=asr, hop_length=hop)
    Cl = librosa.feature.chroma_cqt(y=l_a, sr=asr, hop_length=hop)
    Cs /= np.linalg.norm(Cs, axis=0, keepdims=True) + 1e-12
    Cl /= np.linalg.norm(Cl, axis=0, keepdims=True) + 1e-12

    q = Cs[:, int(22 * asr / hop) : int(30 * asr / hop)]
    best_i, best_s = 0, -1.0
    for i in range(0, Cl.shape[1] - q.shape[1] + 1, 1):
        sc = float(np.mean(np.sum(Cl[:, i : i + q.shape[1]] * q, axis=0)))
        if sc > best_s:
            best_s = sc
            best_i = i
    part2_long = best_i * hop / asr
    print(f"part2 of short@22s matches long@{part2_long:.3f}s chroma={best_s:.3f}")

    # Also find where short[18:21.4] (end of part1 body) matches in long
    q2 = Cs[:, int(18 * asr / hop) : int(21.4 * asr / hop)]
    best_i2, best_s2 = 0, -1.0
    for i in range(0, Cl.shape[1] - q2.shape[1] + 1, 1):
        sc = float(np.mean(np.sum(Cl[:, i : i + q2.shape[1]] * q2, axis=0)))
        if sc > best_s2:
            best_s2 = sc
            best_i2 = i
    body_end_long = best_i2 * hop / asr + (21.4 - 18.0)
    print(f"short part1 end@21.4 matches to long body-end@{body_end_long:.3f}s chroma={best_s2:.3f}")

    # Print RMS of both aligned near the boundary
    print("\nAligned RMS (short timebase):")
    print("  t_short | short_rms | long_rms (at t+off)")
    for t in np.arange(18.0, 28.0, 0.25):
        si = int(t * SR)
        li = int((t + off) * SR)
        if si + 2048 > len(short_m) or li + 2048 > len(long_m):
            continue
        sr_ = float(np.sqrt(np.mean(short_m[si : si + 2048] ** 2)))
        lr_ = float(np.sqrt(np.mean(long_m[li : li + 2048] ** 2)))
        mark = ""
        if abs(t - 21.42) < 0.13:
            mark = " <- short cut"
        if abs((t + off) - part2_long) < 0.15:
            mark += " <- long part2?"
        print(f"  {t:5.2f} | {sr_:.4f} | {lr_:.4f}{mark}")

    # On long alone: RMS from 20-32
    print("\nLong-only RMS 20-32s:")
    times, rms = rms_curve(long_m)
    for t, e in zip(times, rms):
        if 20 <= t <= 32 and abs(t * 4 - round(t * 4)) < 0.01:  # ~0.25s steps roughly
            pass
    for t in np.arange(20.0, 32.0, 0.25):
        i = int(t * SR)
        e = float(np.sqrt(np.mean(long_m[i : i + 2048] ** 2)))
        flag = ""
        if abs(t - part2_long) < 0.15:
            flag = " PART2"
        if abs(t - body_end_long) < 0.15:
            flag = " BODY_END"
        print(f"  {t:5.2f}s {e:.4f}{flag}")

    print("\nSUGGEST:")
    print(f"  Use long[0 : part2={part2_long:.2f}s] as prepend (includes longer tail before part2)")
    print(f"  Or long[0 : body_end={body_end_long:.2f}s] if part2 detect is early")
    # Tail = from shortly before part2 back to when energy starts decaying from body
    # Find max rms in [body_end-3, part2]
    lo = max(0, int((part2_long - 6) * SR))
    hi = int(part2_long * SR)
    seg = long_m[lo:hi]
    # sliding rms
    best_t, best_e = part2_long, 0
    for i in range(0, len(seg) - 2048, 512):
        e = float(np.sqrt(np.mean(seg[i : i + 2048] ** 2)))
        if e > best_e:
            best_e = e
            best_t = (lo + i) / SR
    print(f"  local peak before part2: {best_t:.2f}s e={best_e:.4f}")
    # decay onset: first time after peak rms falls to 70% while still before part2
    decay = None
    for i in range(int(best_t * SR), hi, 512):
        e = float(np.sqrt(np.mean(long_m[i : i + 2048] ** 2)))
        if e <= best_e * 0.7:
            decay = i / SR
            break
    print(f"  decay onset (~70% of peak): {decay}")


if __name__ == "__main__":
    main()
