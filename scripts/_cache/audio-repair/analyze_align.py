#!/usr/bin/env python3
"""Align clean portion to full mix and locate VFX-noisy regions."""
from __future__ import annotations

import json
import wave
from pathlib import Path

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parent
FULL_PATH = ROOT / "full.wav"
CLEAN_PATH = ROOT / "clean.wav"


def load_wav(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as wf:
        sr = wf.getframerate()
        nch = wf.getnchannels()
        sw = wf.getsampwidth()
        nframes = wf.getnframes()
        raw = wf.readframes(nframes)
    if sw == 2:
        data = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    elif sw == 4:
        data = np.frombuffer(raw, dtype=np.int32).astype(np.float32) / 2147483648.0
    else:
        raise ValueError(f"Unsupported sample width {sw}")
    if nch > 1:
        data = data.reshape(-1, nch)
    else:
        data = data.reshape(-1, 1)
    return data, sr


def to_mono(stereo: np.ndarray) -> np.ndarray:
    return stereo.mean(axis=1)


def downsample(mono: np.ndarray, sr: int, target_sr: int = 8000) -> tuple[np.ndarray, int]:
    if sr == target_sr:
        return mono, sr
    # polyphase resample
    g = np.gcd(sr, target_sr)
    up = target_sr // g
    down = sr // g
    return signal.resample_poly(mono, up, down).astype(np.float32), target_sr


def best_lag_via_fft(ref: np.ndarray, query: np.ndarray) -> tuple[int, float]:
    """Return lag (in samples of ref) where query best matches ref, and peak corr."""
    # Normalize
    a = ref - ref.mean()
    b = query - query.mean()
    a = a / (np.linalg.norm(a) + 1e-12)
    b = b / (np.linalg.norm(b) + 1e-12)
    n = len(a) + len(b) - 1
    nfft = 1 << int(np.ceil(np.log2(n)))
    fa = np.fft.rfft(a, nfft)
    fb = np.fft.rfft(b, nfft)
    corr = np.fft.irfft(fa * np.conj(fb), nfft)
    # corr[i] = sum a[i+k]*b[k]  => lag of query start in ref is i when i < len(a)
    # For positive lag (query starts later in ref): indices 0..len(a)-1
    # For negative lag: wrap from end
    peak = int(np.argmax(np.abs(corr[:n])))
    score = float(corr[peak])
    if peak >= len(a):
        # negative lag: query starts before ref
        lag = peak - nfft
    else:
        lag = peak
    # Prefer interpreting within [-len(b), len(a)]
    if lag > len(a):
        lag -= nfft
    return lag, score


def sliding_corr(ref: np.ndarray, query: np.ndarray, hop: int) -> tuple[np.ndarray, np.ndarray]:
    """For each hop in ref, corr of query-length window. Returns times (sample), scores."""
    q = query - query.mean()
    qn = np.linalg.norm(q) + 1e-12
    scores = []
    positions = []
    for start in range(0, max(1, len(ref) - len(query)), hop):
        w = ref[start : start + len(query)]
        w = w - w.mean()
        score = float(np.dot(w, q) / ((np.linalg.norm(w) + 1e-12) * qn))
        scores.append(score)
        positions.append(start)
    return np.array(positions), np.array(scores)


def main() -> None:
    full_st, sr = load_wav(FULL_PATH)
    clean_st, sr2 = load_wav(CLEAN_PATH)
    assert sr == sr2 == 48000
    full = to_mono(full_st)
    clean = to_mono(clean_st)
    print(f"full: {len(full)/sr:.3f}s  clean: {len(clean)/sr:.3f}s  sr={sr}")

    # Downsample for coarse alignment
    full_ds, dsr = downsample(full, sr, 8000)
    clean_ds, _ = downsample(clean, sr, 8000)

    # Try matching clean as a whole into full (clean is longer, so try windows of clean)
    # User said clean is a PORTION — but file is longer. Maybe clean includes more intro/outro
    # or different arrangement. Search overlapping windows of clean against full.

    # Strategy: take overlapping 20s chunks of clean, find best match in full
    chunk_s = 20.0
    hop_s = 5.0
    chunk = int(chunk_s * dsr)
    hop = int(hop_s * dsr)
    matches = []
    for cstart in range(0, max(1, len(clean_ds) - chunk), hop):
        q = clean_ds[cstart : cstart + chunk]
        if len(q) < chunk // 2:
            continue
        # sliding corr against full
        pos, scores = sliding_corr(full_ds, q, hop=int(0.25 * dsr))
        if len(scores) == 0:
            continue
        bi = int(np.argmax(scores))
        matches.append(
            {
                "clean_start_s": cstart / dsr,
                "full_start_s": pos[bi] / dsr,
                "corr": float(scores[bi]),
                "offset_full_minus_clean": pos[bi] / dsr - cstart / dsr,
            }
        )

    matches.sort(key=lambda m: -m["corr"])
    print("\nTop clean->full chunk matches:")
    for m in matches[:12]:
        print(
            f"  clean@{m['clean_start_s']:.1f}s <-> full@{m['full_start_s']:.1f}s "
            f"corr={m['corr']:.3f} offset={m['offset_full_minus_clean']:.3f}s"
        )

    # Also: take the noisy region of FULL (33-46s) and find it in CLEAN
    noisy_start = 33.0
    noisy_end = 46.0
    ns = int(noisy_start * dsr)
    ne = int(noisy_end * dsr)
    noisy_q = full_ds[ns:ne]
    pos, scores = sliding_corr(clean_ds, noisy_q, hop=int(0.125 * dsr))
    bi = int(np.argmax(scores))
    clean_match_start = pos[bi] / dsr
    print(
        f"\nNoisy full[{noisy_start}-{noisy_end}]s best match in clean @ {clean_match_start:.3f}s "
        f"corr={scores[bi]:.3f}"
    )

    # Refine at full sample rate around that offset
    offset_s = clean_match_start - noisy_start  # clean_time = full_time + offset
    # Actually: clean starts matching at clean_match_start when full is at noisy_start
    # so clean_t = full_t + (clean_match_start - noisy_start)
    clean_minus_full = clean_match_start - noisy_start
    print(f"coarse: clean_time ≈ full_time + {clean_minus_full:.3f}s")

    # Fine-tune with a quieter-looking subwindow if possible — use 20-30s of full (before VFX)
    # and 40-50s (after) as well
    refine_windows = [(20.0, 30.0), (50.0, 60.0), (10.0, 20.0), (33.0, 46.0)]
    fine = []
    for a, b in refine_windows:
        if b > len(full) / sr:
            continue
        fa = int(a * sr)
        fb = int(b * sr)
        q = full[fa:fb]
        # search in clean around expected
        expect = a + clean_minus_full
        search_a = max(0, int((expect - 3.0) * sr))
        search_b = min(len(clean), int((expect + 3.0 + (b - a)) * sr))
        region = clean[search_a:search_b]
        if len(region) < len(q):
            continue
        # correlate
        qn = q - q.mean()
        rn = region - region.mean()
        corr = signal.fftconvolve(rn, qn[::-1], mode="valid")
        corr /= (np.linalg.norm(qn) * np.sqrt(np.convolve(rn**2, np.ones(len(qn)), mode="valid")) + 1e-12)
        peak = int(np.argmax(corr))
        clean_s = (search_a + peak) / sr
        fine.append(
            {
                "full_window": [a, b],
                "clean_start": clean_s,
                "offset": clean_s - a,
                "corr": float(corr[peak]),
            }
        )
        print(
            f"  refine full[{a}-{b}] → clean@{clean_s:.3f}s offset={clean_s-a:.3f}s corr={corr[peak]:.3f}"
        )

    if fine:
        # robust offset: median of high-corr windows excluding noisy if others exist
        good = [f for f in fine if f["corr"] > 0.5 and f["full_window"] != [33.0, 46.0]]
        use = good if good else fine
        offsets = [f["offset"] for f in use]
        offset = float(np.median(offsets))
    else:
        offset = clean_minus_full

    print(f"\nChosen offset (clean = full + {offset:.4f}s)")

    # Residual scan: where full differs from aligned clean (high residual = VFX / mismatch)
    # Align clean onto full timeline
    # full[t] corresponds to clean[t + offset]
    # For each hop, compute normalized residual energy in overlapping region
    hop = int(0.25 * sr)
    win = int(1.0 * sr)
    residual_curve = []
    for i in range(0, len(full) - win, hop):
        ct = i / sr + offset
        ci = int(ct * sr)
        if ci < 0 or ci + win > len(clean):
            residual_curve.append({"t": i / sr, "resid": None, "corr": None})
            continue
        fwin = full[i : i + win]
        cwin = clean[ci : ci + win]
        # gain-match clean to full
        denom = np.dot(cwin, cwin) + 1e-12
        gain = float(np.dot(fwin, cwin) / denom)
        resid = fwin - gain * cwin
        # relative residual
        f_e = float(np.mean(fwin**2) + 1e-12)
        r_e = float(np.mean(resid**2))
        corr = float(np.corrcoef(fwin, cwin)[0, 1])
        residual_curve.append(
            {
                "t": round(i / sr, 3),
                "resid": round(r_e / f_e, 4),
                "corr": round(corr, 4),
                "gain": round(gain, 4),
            }
        )

    # Print high-residual regions
    print("\nHigh residual / low corr windows (possible VFX):")
    for row in residual_curve:
        if row["resid"] is None:
            continue
        if row["resid"] >= 0.15 or (row["corr"] is not None and row["corr"] < 0.85):
            print(f"  t={row['t']:.2f}s resid={row['resid']:.3f} corr={row['corr']:.3f} gain={row['gain']}")

    out = {
        "sr": sr,
        "full_duration": len(full) / sr,
        "clean_duration": len(clean) / sr,
        "offset_clean_minus_full": offset,
        "noisy_hint": [noisy_start, noisy_end],
        "fine": fine,
        "residual_curve": residual_curve,
        "top_chunk_matches": matches[:20],
    }
    (ROOT / "align_report.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"\nWrote {ROOT / 'align_report.json'}")


if __name__ == "__main__":
    main()
