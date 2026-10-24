#!/usr/bin/env python3
"""Chroma-based alignment of Lena Raine Creator (clean) into Grímsvötn flythrough mix."""
from __future__ import annotations

import json
import wave
from pathlib import Path

import librosa
import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parent
FULL_PATH = ROOT / "full.wav"
CLEAN_PATH = ROOT / "clean.wav"


def load_mono(path: Path, sr: int = 22050) -> tuple[np.ndarray, int]:
    y, _ = librosa.load(str(path), sr=sr, mono=True)
    return y.astype(np.float32), sr


def chroma_seq(y: np.ndarray, sr: int, hop: int = 512) -> np.ndarray:
    # CQT chroma is more robust to additive noise than STFT chroma for music
    C = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop, n_chroma=12, bins_per_octave=36)
    # L2-normalize frames
    norms = np.linalg.norm(C, axis=0, keepdims=True) + 1e-12
    return (C / norms).astype(np.float32)


def sliding_chroma_corr(
    full_c: np.ndarray, clean_c: np.ndarray, coarse_step: int = 4
) -> tuple[int, float, np.ndarray]:
    """
    Find where FULL best sits inside CLEAN via mean framewise cosine similarity.
    Coarse search then refine nearby.
    """
    n_full = full_c.shape[1]
    n_clean = clean_c.shape[1]
    if n_clean < n_full:
        raise SystemExit("Unexpected: clean shorter than full in chroma frames")

    # Vectorized-ish coarse: evaluate every coarse_step offset
    coarse_idx = np.arange(0, n_clean - n_full + 1, coarse_step, dtype=np.int32)
    coarse_scores = np.empty(len(coarse_idx), dtype=np.float32)
    f = full_c
    for j, i in enumerate(coarse_idx):
        c = clean_c[:, i : i + n_full]
        coarse_scores[j] = np.mean(np.sum(f * c, axis=0))
    best_j = int(np.argmax(coarse_scores))
    center = int(coarse_idx[best_j])

    # Fine refine ±coarse_step around top few peaks
    top = np.argsort(coarse_scores)[::-1][:5]
    candidates = set()
    for j in top:
        c0 = int(coarse_idx[j])
        for i in range(max(0, c0 - coarse_step), min(n_clean - n_full + 1, c0 + coarse_step + 1)):
            candidates.add(i)

    best_i, best_s = center, float(coarse_scores[best_j])
    for i in candidates:
        c = clean_c[:, i : i + n_full]
        s = float(np.mean(np.sum(f * c, axis=0)))
        if s > best_s:
            best_s = s
            best_i = i

    # Build dense-ish score curve at coarse resolution for reporting
    scores = np.full(n_clean - n_full + 1, np.nan, dtype=np.float32)
    scores[coarse_idx] = coarse_scores
    scores[best_i] = best_s
    return best_i, best_s, scores


def local_window_search(
    full_c: np.ndarray,
    clean_c: np.ndarray,
    full_start_frame: int,
    full_end_frame: int,
    hop_frames: int = 1,
) -> tuple[int, float]:
    """Find best clean start for a subwindow of full."""
    win = full_c[:, full_start_frame:full_end_frame]
    wlen = win.shape[1]
    best_i, best_s = 0, -1.0
    for i in range(0, clean_c.shape[1] - wlen + 1, hop_frames):
        c = clean_c[:, i : i + wlen]
        s = float(np.mean(np.sum(win * c, axis=0)))
        if s > best_s:
            best_s = s
            best_i = i
    return best_i, best_s


def main() -> None:
    print("Loading…")
    full, sr = load_mono(FULL_PATH, 22050)
    clean, _ = load_mono(CLEAN_PATH, 22050)
    hop = 512
    print(f"full={len(full)/sr:.2f}s clean={len(clean)/sr:.2f}s")

    print("Computing chroma…")
    full_c = chroma_seq(full, sr, hop)
    clean_c = chroma_seq(clean, sr, hop)
    print(f"chroma frames full={full_c.shape[1]} clean={clean_c.shape[1]}")

    print("Global alignment (full inside clean)…")
    best_frame, best_score, scores = sliding_chroma_corr(full_c, clean_c)
    offset_s = best_frame * hop / sr
    print(f"best: clean starts matching full at clean t={offset_s:.3f}s  score={best_score:.4f}")

    # Also try matching just the 33-46s region
    f0 = int(33.0 * sr / hop)
    f1 = int(46.0 * sr / hop)
    local_i, local_s = local_window_search(full_c, clean_c, f0, f1, hop_frames=2)
    local_offset = local_i * hop / sr
    print(f"local 33-46s: clean@{local_offset:.3f}s score={local_s:.4f}  implying offset={local_offset-33:.3f}")

    # Try a few other windows
    for a, b in [(5, 20), (20, 33), (46, 60), (60, 80), (0, 15)]:
        i0 = int(a * sr / hop)
        i1 = int(b * sr / hop)
        if i1 > full_c.shape[1]:
            continue
        li, ls = local_window_search(full_c, clean_c, i0, i1, hop_frames=2)
        print(f"  window full[{a}-{b}]s -> clean@{li*hop/sr:.3f}s score={ls:.4f} offset={li*hop/sr - a:.3f}")

    # Top global score peaks (in case of octave/loop ambiguity)
    order = np.argsort(scores)[::-1][:8]
    print("Top global peaks:")
    for idx in order:
        print(f"  clean@{idx*hop/sr:.3f}s score={scores[idx]:.4f}")

    # Framewise similarity under best global offset — find low-similarity spans (VFX)
    n = full_c.shape[1]
    aligned = clean_c[:, best_frame : best_frame + n]
    if aligned.shape[1] < n:
        aligned = np.pad(aligned, ((0, 0), (0, n - aligned.shape[1])))
    frame_sim = np.sum(full_c * aligned[:, :n], axis=0)
    # Smooth
    kernel = np.ones(int(1.0 * sr / hop), dtype=np.float32)
    kernel /= kernel.sum()
    smooth = np.convolve(frame_sim, kernel, mode="same")

    low = []
    for i, s in enumerate(smooth):
        t = i * hop / sr
        if s < 0.55:
            low.append({"t": round(float(t), 3), "sim": round(float(s), 4)})

    # Collapse contiguous low regions
    regions = []
    if low:
        start = low[0]["t"]
        prev = low[0]["t"]
        worst = low[0]["sim"]
        for row in low[1:]:
            if row["t"] - prev > 0.6:
                regions.append({"start": start, "end": prev + hop / sr, "min_sim": worst})
                start = row["t"]
                worst = row["sim"]
            else:
                worst = min(worst, row["sim"])
            prev = row["t"]
        regions.append({"start": start, "end": prev + hop / sr, "min_sim": worst})

    print("\nLow chroma-similarity regions (possible VFX / mix divergence):")
    for r in regions:
        print(f"  {r['start']:.2f}-{r['end']:.2f}s min_sim={r['min_sim']:.3f}")

    out = {
        "sr_analysis": sr,
        "hop": hop,
        "global_offset_clean_start_for_full0": offset_s,
        "global_score": best_score,
        "local_33_46": {"clean_t": local_offset, "score": local_s},
        "low_sim_regions": regions,
        "top_peaks": [{"clean_t": float(i * hop / sr), "score": float(scores[i])} for i in order],
    }
    (ROOT / "chroma_align.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
    np.save(ROOT / "chroma_scores.npy", scores)
    np.save(ROOT / "chroma_frame_sim.npy", smooth)
    print(f"Wrote chroma_align.json")


if __name__ == "__main__":
    main()
