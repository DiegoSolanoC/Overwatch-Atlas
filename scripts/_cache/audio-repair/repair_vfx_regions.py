#!/usr/bin/env python3
"""
Targeted repair: replace VFX-contaminated spans in the flythrough with
aligned clean main-menu audio. Default focus ~33-46s; also flags other
high-frequency residual spikes that look like SFX.
"""
from __future__ import annotations

import json
import subprocess
import wave
from pathlib import Path

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parent
FULL_PATH = ROOT / "full.wav"
CLEAN_PATH = ROOT / "clean.wav"
OUT_WAV = ROOT / "repaired.wav"
OUT_MP3 = ROOT / "repaired.mp3"
REPORT = ROOT / "repair_report.json"

# From prior chroma+waveform alignment
FULL_START_S = 6.627270833333333


def load_wav_stereo(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as wf:
        sr = wf.getframerate()
        nch = wf.getnchannels()
        sw = wf.getsampwidth()
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


def highband_energy(mono: np.ndarray, sr: int, lo_hz: float = 4000.0) -> float:
    # 4th-order Butterworth highpass residual energy
    b, a = signal.butter(4, lo_hz / (sr * 0.5), btype="high")
    filtered = signal.filtfilt(b, a, mono)
    return float(np.mean(filtered**2))


def scan_hf_residual(
    full_mono: np.ndarray,
    clean_mono: np.ndarray,
    sr: int,
    full_start_s: float,
    hop_s: float = 0.25,
    win_s: float = 1.0,
) -> list[dict]:
    hop = int(hop_s * sr)
    win = int(win_s * sr)
    cover_a = max(0, int(full_start_s * sr))
    cover_b = min(len(full_mono), int(full_start_s * sr) + len(clean_mono))
    rows = []
    for i in range(cover_a, max(cover_a + 1, cover_b - win), hop):
        ci = i - int(full_start_s * sr)
        if ci < 0 or ci + win > len(clean_mono):
            continue
        fwin = full_mono[i : i + win]
        cwin = clean_mono[ci : ci + win]
        gain = float(np.dot(fwin, cwin) / (np.dot(cwin, cwin) + 1e-12))
        if not np.isfinite(gain) or gain <= 0.05 or gain > 8:
            gain = 1.0
        resid = fwin - gain * cwin
        hf = highband_energy(resid, sr, 3500.0)
        full_hf = highband_energy(fwin, sr, 3500.0)
        corr = float(np.corrcoef(fwin, cwin)[0, 1])
        rows.append(
            {
                "t": round(i / sr, 3),
                "hf_resid": round(hf, 8),
                "hf_full": round(full_hf, 8),
                "hf_ratio": round(hf / (full_hf + 1e-12), 4),
                "corr": round(corr, 4),
                "gain": round(gain, 4),
            }
        )
    return rows


def collapse(times: list[float], gap: float = 0.6) -> list[tuple[float, float]]:
    if not times:
        return []
    times = sorted(times)
    out = []
    start = prev = times[0]
    for t in times[1:]:
        if t - prev > gap:
            out.append((start, prev))
            start = t
        prev = t
    out.append((start, prev))
    return out


def merge_regions(regions: list[tuple[float, float]], pad: float = 0.25) -> list[list[float]]:
    if not regions:
        return []
    expanded = sorted((max(0.0, a - pad), b + pad) for a, b in regions)
    merged: list[list[float]] = []
    for a, b in expanded:
        if not merged or a > merged[-1][1] + 0.1:
            merged.append([a, b])
        else:
            merged[-1][1] = max(merged[-1][1], b)
    return merged


def crossfade_replace(
    full_st: np.ndarray,
    clean_st: np.ndarray,
    sr: int,
    full_start_s: float,
    replace_start_s: float,
    replace_end_s: float,
    fade_s: float = 0.18,
) -> np.ndarray:
    out = full_st.copy()
    a = max(0, int(replace_start_s * sr))
    b = min(len(out), int(replace_end_s * sr))
    ca = int((a / sr - full_start_s) * sr)
    cb = ca + (b - a)
    if ca < 0:
        a -= ca
        ca = 0
    if cb > len(clean_st):
        overflow = cb - len(clean_st)
        b -= overflow
        cb = len(clean_st)
    if b <= a or cb <= ca:
        return out

    seg_full = out[a:b]
    seg_clean = clean_st[ca:cb]
    mid0 = int(0.2 * len(seg_full))
    mid1 = int(0.8 * len(seg_full))
    f_m = seg_full[mid0:mid1].mean(axis=1)
    c_m = seg_clean[mid0:mid1].mean(axis=1)
    gain = float(np.dot(f_m, c_m) / (np.dot(c_m, c_m) + 1e-12))
    if not np.isfinite(gain) or gain <= 0.05 or gain > 8:
        gain = 1.0
    patched = seg_clean * gain

    fade = min(int(fade_s * sr), max(1, (b - a) // 4))
    if fade > 1:
        ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)[:, None]
        patched[:fade] = seg_full[:fade] * (1.0 - ramp) + patched[:fade] * ramp
        patched[-fade:] = patched[-fade:] * (1.0 - ramp) + seg_full[-fade:] * ramp

    out[a:b] = patched
    return out


def main() -> None:
    full_st, sr = load_wav_stereo(FULL_PATH)
    clean_st, _ = load_wav_stereo(CLEAN_PATH)
    full_mono = full_st.mean(axis=1)
    clean_mono = clean_st.mean(axis=1)
    cover_a = FULL_START_S
    cover_b = FULL_START_S + len(clean_mono) / sr
    print(f"align: clean[0] -> full@{FULL_START_S:.4f}s covers [{cover_a:.2f},{cover_b:.2f}]")

    hf_rows = scan_hf_residual(full_mono, clean_mono, sr, FULL_START_S)
    hf_vals = np.array([r["hf_resid"] for r in hf_rows], dtype=np.float64)
    median = float(np.median(hf_vals))
    p75 = float(np.percentile(hf_vals, 75))
    p90 = float(np.percentile(hf_vals, 90))
    # Spike = clearly above typical mix difference
    thresh = max(p75 * 1.8, median * 2.5)
    print(f"HF residual median={median:.6g} p75={p75:.6g} p90={p90:.6g} thresh={thresh:.6g}")

    spike_times = [r["t"] for r in hf_rows if r["hf_resid"] >= thresh and 8.0 <= r["t"] <= 65.0]
    auto_regions = collapse(spike_times, gap=0.7)
    print("Auto HF spike regions:")
    for a, b in auto_regions:
        print(f"  {a:.2f}-{b:.2f}s")

    # User-reported VFX window (primary)
    user_region = (max(cover_a, 32.5), min(cover_b, 46.5))
    regions = merge_regions([user_region, *auto_regions], pad=0.2)
    # Clamp to coverage and avoid the musically-diverging tail (>62s)
    regions = [
        [max(cover_a + 0.3, a), min(min(cover_b - 0.3, 62.0), b)]
        for a, b in regions
        if min(min(cover_b - 0.3, 62.0), b) - max(cover_a + 0.3, a) > 0.4
    ]

    print("Final replace regions:")
    for a, b in regions:
        print(f"  {a:.2f}-{b:.2f}s ({b - a:.2f}s)")

    repaired = full_st
    for a, b in regions:
        repaired = crossfade_replace(repaired, clean_st, sr, FULL_START_S, a, b, fade_s=0.2)

    write_wav_stereo(OUT_WAV, repaired, sr)
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(OUT_WAV), "-codec:a", "libmp3lame", "-q:a", "2", str(OUT_MP3)],
        check=True,
        capture_output=True,
    )
    print(f"Wrote {OUT_WAV}")
    print(f"Wrote {OUT_MP3}")

    report = {
        "full_start_s": FULL_START_S,
        "coverage": [cover_a, cover_b],
        "hf_median": median,
        "hf_thresh": thresh,
        "auto_hf_regions": auto_regions,
        "user_region": user_region,
        "replace_regions": regions,
        "hf_curve": hf_rows,
        "outputs": [str(OUT_WAV), str(OUT_MP3)],
    }
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Wrote {REPORT}")


if __name__ == "__main__":
    main()
