#!/usr/bin/env python3
"""
Align clean main-menu Grímsvötn audio into the flythrough mix and splice
clean audio over VFX-noisy regions (esp. ~33-46s).
"""
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
OUT_WAV = ROOT / "repaired.wav"
OUT_MP3 = ROOT / "repaired.mp3"
REPORT = ROOT / "repair_report.json"


def load_wav_stereo(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as wf:
        sr = wf.getframerate()
        nch = wf.getnchannels()
        sw = wf.getsampwidth()
        raw = wf.readframes(wf.getnframes())
    if sw != 2:
        raise ValueError(f"expected 16-bit wav, got width={sw}")
    data = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    if nch > 1:
        data = data.reshape(-1, nch)
    else:
        data = data.reshape(-1, 1)
        data = np.repeat(data, 2, axis=1)
    return data, sr


def write_wav_stereo(path: Path, stereo: np.ndarray, sr: int) -> None:
    clipped = np.clip(stereo, -1.0, 1.0)
    pcm = (clipped * 32767.0).astype(np.int16)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm.tobytes())


def chroma_seq(y: np.ndarray, sr: int, hop: int = 512) -> np.ndarray:
    C = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop, n_chroma=12, bins_per_octave=36)
    norms = np.linalg.norm(C, axis=0, keepdims=True) + 1e-12
    return (C / norms).astype(np.float32)


def find_clean_in_full(full_c: np.ndarray, clean_c: np.ndarray, coarse_step: int = 2) -> tuple[int, float, np.ndarray]:
    """Slide CLEAN chroma across FULL; return best start frame in FULL."""
    n_full = full_c.shape[1]
    n_clean = clean_c.shape[1]
    if n_full < n_clean:
        raise SystemExit("full shorter than clean — unexpected for this pair")

    coarse_idx = np.arange(0, n_full - n_clean + 1, coarse_step, dtype=np.int32)
    coarse_scores = np.empty(len(coarse_idx), dtype=np.float32)
    c = clean_c
    for j, i in enumerate(coarse_idx):
        f = full_c[:, i : i + n_clean]
        coarse_scores[j] = np.mean(np.sum(f * c, axis=0))
    best_j = int(np.argmax(coarse_scores))
    center = int(coarse_idx[best_j])

    top = np.argsort(coarse_scores)[::-1][:8]
    candidates = set()
    for j in top:
        c0 = int(coarse_idx[j])
        for i in range(max(0, c0 - coarse_step), min(n_full - n_clean + 1, c0 + coarse_step + 1)):
            candidates.add(i)

    best_i, best_s = center, float(coarse_scores[best_j])
    for i in candidates:
        f = full_c[:, i : i + n_clean]
        s = float(np.mean(np.sum(f * c, axis=0)))
        if s > best_s:
            best_s = s
            best_i = i

    scores = np.full(n_full - n_clean + 1, np.nan, dtype=np.float32)
    scores[coarse_idx] = coarse_scores
    scores[best_i] = best_s
    return best_i, best_s, scores


def refine_offset_waveform(
    full_mono: np.ndarray,
    clean_mono: np.ndarray,
    sr: int,
    coarse_full_start_s: float,
    search_radius_s: float = 1.5,
) -> tuple[float, float]:
    """Subsample-accurate lag via normalized cross-correlation around coarse offset."""
    # Use a mid section of clean (avoid edges) for refinement
    clean_a = int(5.0 * sr)
    clean_b = int(min(len(clean_mono), 25.0 * sr))
    if clean_b - clean_a < sr:
        clean_a = 0
        clean_b = len(clean_mono)
    q = clean_mono[clean_a:clean_b]
    expect_full = coarse_full_start_s + clean_a / sr
    search_a = max(0, int((expect_full - search_radius_s) * sr))
    search_b = min(len(full_mono), int((expect_full + search_radius_s) * sr) + len(q))
    region = full_mono[search_a:search_b]
    if len(region) < len(q):
        return coarse_full_start_s, 0.0

    qn = q - q.mean()
    rn = region - region.mean()
    corr = signal.fftconvolve(rn, qn[::-1], mode="valid")
    denom = np.linalg.norm(qn) * np.sqrt(
        np.convolve(rn**2, np.ones(len(qn), dtype=np.float32), mode="valid")
    ) + 1e-12
    corr = corr / denom
    peak = int(np.argmax(corr))
    # peak is where q starts in region → full time of clean[0]
    full_start_s = (search_a + peak - clean_a) / sr
    return full_start_s, float(corr[peak])


def framewise_similarity(
    full_c: np.ndarray, clean_c: np.ndarray, full_start_frame: int
) -> np.ndarray:
    n = clean_c.shape[1]
    end = min(full_c.shape[1], full_start_frame + n)
    use = end - full_start_frame
    f = full_c[:, full_start_frame:end]
    c = clean_c[:, :use]
    return np.sum(f * c, axis=0)


def residual_curve(
    full_mono: np.ndarray,
    clean_mono: np.ndarray,
    sr: int,
    full_start_s: float,
    hop_s: float = 0.25,
    win_s: float = 1.0,
) -> list[dict]:
    hop = int(hop_s * sr)
    win = int(win_s * sr)
    out = []
    # Only over the overlap region
    overlap_start = max(0, int(full_start_s * sr))
    overlap_end = min(len(full_mono), int(full_start_s * sr) + len(clean_mono))
    for i in range(overlap_start, max(overlap_start + 1, overlap_end - win), hop):
        ci = i - int(full_start_s * sr)
        if ci < 0 or ci + win > len(clean_mono):
            continue
        fwin = full_mono[i : i + win]
        cwin = clean_mono[ci : ci + win]
        gain = float(np.dot(fwin, cwin) / (np.dot(cwin, cwin) + 1e-12))
        resid = fwin - gain * cwin
        f_e = float(np.mean(fwin**2) + 1e-12)
        r_e = float(np.mean(resid**2))
        corr = float(np.corrcoef(fwin, cwin)[0, 1])
        out.append(
            {
                "t": round(i / sr, 3),
                "resid": round(r_e / f_e, 4),
                "corr": round(corr, 4),
                "gain": round(gain, 4),
            }
        )
    return out


def collapse_regions(times: list[float], gap: float = 0.6) -> list[tuple[float, float]]:
    if not times:
        return []
    times = sorted(times)
    regions = []
    start = prev = times[0]
    for t in times[1:]:
        if t - prev > gap:
            regions.append((start, prev))
            start = t
        prev = t
    regions.append((start, prev))
    return regions


def crossfade_replace(
    full_st: np.ndarray,
    clean_st: np.ndarray,
    sr: int,
    full_start_s: float,
    replace_start_s: float,
    replace_end_s: float,
    fade_s: float = 0.12,
) -> np.ndarray:
    """
    Replace full[replace_start:replace_end] with aligned clean, gain-matched, with fades.
    full_start_s = where clean[0] lands on the full timeline.
    """
    out = full_st.copy()
    a = max(0, int(replace_start_s * sr))
    b = min(len(out), int(replace_end_s * sr))
    if b <= a:
        return out

    ca = int((a / sr - full_start_s) * sr)
    cb = ca + (b - a)
    if ca < 0 or cb > len(clean_st):
        # clamp to available clean
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
    # mono gain match on mid 60% to avoid fade edges
    mid0 = int(0.2 * len(seg_full))
    mid1 = int(0.8 * len(seg_full))
    f_m = seg_full[mid0:mid1].mean(axis=1)
    c_m = seg_clean[mid0:mid1].mean(axis=1)
    gain = float(np.dot(f_m, c_m) / (np.dot(c_m, c_m) + 1e-12))
    # Prefer gains near 1; clamp wild estimates
    if not np.isfinite(gain) or gain <= 0.05 or gain > 8.0:
        gain = 1.0
    patched = seg_clean * gain

    fade = min(int(fade_s * sr), (b - a) // 4)
    if fade > 0:
        ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)[:, None]
        patched[:fade] = seg_full[:fade] * (1.0 - ramp) + patched[:fade] * ramp
        patched[-fade:] = patched[-fade:] * (1.0 - ramp) + seg_full[-fade:] * ramp

    out[a:b] = patched
    return out


def main() -> None:
    print("Loading stereo wavs…")
    full_st, sr = load_wav_stereo(FULL_PATH)
    clean_st, sr2 = load_wav_stereo(CLEAN_PATH)
    assert sr == sr2
    full_mono = full_st.mean(axis=1)
    clean_mono = clean_st.mean(axis=1)
    print(f"full={len(full_mono)/sr:.3f}s clean={len(clean_mono)/sr:.3f}s sr={sr}")

    print("Chroma alignment (clean inside full)…")
    analysis_sr = 22050
    full_a, _ = librosa.load(str(FULL_PATH), sr=analysis_sr, mono=True)
    clean_a, _ = librosa.load(str(CLEAN_PATH), sr=analysis_sr, mono=True)
    hop = 512
    full_c = chroma_seq(full_a, analysis_sr, hop)
    clean_c = chroma_seq(clean_a, analysis_sr, hop)
    best_frame, best_score, scores = find_clean_in_full(full_c, clean_c, coarse_step=2)
    coarse_s = best_frame * hop / analysis_sr
    print(f"coarse: clean[0] -> full@{coarse_s:.3f}s chroma_score={best_score:.4f}")

    # Top peaks
    valid = np.where(~np.isnan(scores))[0]
    order = valid[np.argsort(scores[valid])[::-1][:6]]
    for i in order:
        print(f"  peak full@{i*hop/analysis_sr:.3f}s score={scores[i]:.4f}")

    print("Waveform refine…")
    fine_s, fine_corr = refine_offset_waveform(full_mono, clean_mono, sr, coarse_s)
    print(f"fine: clean[0] -> full@{fine_s:.4f}s corr={fine_corr:.4f}")

    # Also specifically match the noisy hint window of full into clean
    # (in case global offset is wrong but 33-46 aligns differently — unlikely)
    noisy_a, noisy_b = 33.0, 46.0
    print(f"Residual scan over overlap (hint {noisy_a}-{noisy_b}s)…")
    resid = residual_curve(full_mono, clean_mono, sr, fine_s)

    # Mark high residual
    high = [r for r in resid if r["resid"] >= 0.12 or r["corr"] < 0.75]
    high_times = [r["t"] for r in high]
    noisy_regions = collapse_regions(high_times, gap=0.75)
    # Expand a bit and merge with user hint if overlapping overlap
    expanded = []
    for a, b in noisy_regions:
        expanded.append((max(fine_s, a - 0.35), min(fine_s + len(clean_mono) / sr, b + 0.35 + 0.25)))

    # Always include user-hinted band if it overlaps the clean coverage
    cover_a = fine_s
    cover_b = fine_s + len(clean_mono) / sr
    hint_a = max(cover_a, noisy_a - 0.5)
    hint_b = min(cover_b, noisy_b + 0.5)
    if hint_b > hint_a:
        expanded.append((hint_a, hint_b))

    # Merge overlapping expanded regions
    expanded.sort()
    merged: list[list[float]] = []
    for a, b in expanded:
        if not merged or a > merged[-1][1] + 0.15:
            merged.append([a, b])
        else:
            merged[-1][1] = max(merged[-1][1], b)

    print(f"clean covers full [{cover_a:.2f}, {cover_b:.2f}]s")
    print("Replace regions:")
    for a, b in merged:
        print(f"  {a:.2f}-{b:.2f}s ({b-a:.2f}s)")

    # Framewise chroma sim under alignment for report
    sim = framewise_similarity(full_c, clean_c, best_frame)
    kernel = np.ones(max(1, int(1.0 * analysis_sr / hop)), dtype=np.float32)
    kernel /= kernel.sum()
    smooth = np.convolve(sim, kernel, mode="same")

    print("Splicing…")
    repaired = full_st
    for a, b in merged:
        repaired = crossfade_replace(repaired, clean_st, sr, fine_s, a, b, fade_s=0.15)

    write_wav_stereo(OUT_WAV, repaired, sr)
    print(f"Wrote {OUT_WAV}")

    # Also mp3 for easy preview
    import subprocess

    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(OUT_WAV),
            "-codec:a",
            "libmp3lame",
            "-q:a",
            "2",
            str(OUT_MP3),
        ],
        check=True,
        capture_output=True,
    )
    print(f"Wrote {OUT_MP3}")

    report = {
        "full_duration": len(full_mono) / sr,
        "clean_duration": len(clean_mono) / sr,
        "chroma_offset_full_s": coarse_s,
        "chroma_score": best_score,
        "fine_offset_full_s": fine_s,
        "fine_corr": fine_corr,
        "clean_coverage_on_full": [cover_a, cover_b],
        "replace_regions": merged,
        "high_residual_samples": high[:40],
        "residual_curve": resid,
        "outputs": [str(OUT_WAV), str(OUT_MP3)],
    }
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    np.save(ROOT / "align_scores.npy", scores)
    np.save(ROOT / "frame_sim.npy", smooth)
    print(f"Wrote {REPORT}")


if __name__ == "__main__":
    main()
