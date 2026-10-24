#!/usr/bin/env python3
"""
Prepend 0-~22s missing piece from intro.wav onto repaired.wav.
Use the intro's second half (abridged song) to locate the true cut
and to smooth the join into the repaired flythrough mix.
"""
from __future__ import annotations

import json
import subprocess
import wave
from pathlib import Path

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parent
INTRO = ROOT / "intro.wav"
REPAIRED = ROOT / "repaired.wav"
OUT_WAV = ROOT / "repaired_full.wav"
OUT_MP3 = ROOT / "repaired_full.mp3"
REPORT = ROOT / "prepend_report.json"


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


def mono(x: np.ndarray) -> np.ndarray:
    return x.mean(axis=1)


def best_match(ref: np.ndarray, query: np.ndarray) -> tuple[int, float]:
    """Return lag (query start in ref) and peak normalized corr."""
    if len(ref) < len(query):
        return 0, -1.0
    q = query - query.mean()
    r = ref - ref.mean()
    corr = signal.fftconvolve(r, q[::-1], mode="valid")
    denom = np.linalg.norm(q) * np.sqrt(
        np.convolve(r**2, np.ones(len(q), dtype=np.float32), mode="valid")
    ) + 1e-12
    corr = corr / denom
    peak = int(np.argmax(corr))
    return peak, float(corr[peak])


def find_part2_start(
    intro_m: np.ndarray,
    repaired_m: np.ndarray,
    sr: int,
    search_lo_s: float = 18.0,
    search_hi_s: float = 26.0,
) -> tuple[float, float, float]:
    """
    Find where intro's second half (abridged song) begins by matching
    short windows of intro around ~22s into the start of repaired.
    Returns (intro_cut_s, repaired_match_s, corr).
    """
    # Probe: take repaired[0:8s] as fingerprint of "current song start"
    # and also repaired[4:12], [6:14] since clean theme lands ~6.6s
    probes = [(0.0, 8.0), (4.0, 12.0), (6.0, 14.0), (6.5, 14.5)]
    best = None
    for pa, pb in probes:
        q = repaired_m[int(pa * sr) : int(pb * sr)]
        # Search this query inside intro[search_lo:search_hi + query_len]
        region_a = int(search_lo_s * sr)
        region_b = min(len(intro_m), int(search_hi_s * sr) + len(q))
        region = intro_m[region_a:region_b]
        if len(region) < len(q):
            continue
        lag, score = best_match(region, q)
        intro_t = (region_a + lag) / sr
        # The cut is where this matched phrase begins in intro
        cand = (intro_t, pa, score, pb - pa)
        print(f"  probe repaired[{pa}-{pb}] -> intro@{intro_t:.3f}s corr={score:.3f}")
        if best is None or score > best[2]:
            best = cand
    assert best is not None
    return best[0], best[1], best[2]


def gain_match(target: np.ndarray, source: np.ndarray) -> float:
    """Scalar gain so source ≈ target (mono)."""
    t = target.mean(axis=1) if target.ndim == 2 else target
    s = source.mean(axis=1) if source.ndim == 2 else source
    n = min(len(t), len(s))
    t = t[:n]
    s = s[:n]
    g = float(np.dot(t, s) / (np.dot(s, s) + 1e-12))
    if not np.isfinite(g) or g <= 0.05 or g > 8:
        return 1.0
    return g


def main() -> None:
    intro_st, sr = load_wav_stereo(INTRO)
    repaired_st, sr2 = load_wav_stereo(REPAIRED)
    assert sr == sr2
    intro_m = mono(intro_st)
    repaired_m = mono(repaired_st)
    print(f"intro={len(intro_m)/sr:.3f}s repaired={len(repaired_m)/sr:.3f}s")

    print("Locating intro part-2 (abridged song) vs repaired…")
    part2_intro_s, repaired_anchor_s, part2_corr = find_part2_start(intro_m, repaired_m, sr)
    print(
        f"part2 starts ~ intro@{part2_intro_s:.3f}s matching repaired@{repaired_anchor_s:.3f}s "
        f"(corr={part2_corr:.3f})"
    )

    # Cut slightly before part2 begins so we don't leak into the abridged half.
    # Also respect user's ~22s hint: use min(part2_detect, 22.0) with a small guard.
    user_hint = 22.0
    if part2_corr >= 0.55:
        cut_s = min(part2_intro_s - 0.05, user_hint)
    else:
        cut_s = user_hint
        print("WARNING: weak part2 match; falling back to 22.0s cut")
    cut_s = max(18.0, min(cut_s, 22.0))
    print(f"intro cut at {cut_s:.3f}s")

    # Smooth join: find best overlap between end of intro-part1 and start of repaired.
    # Take last N seconds of the piece we're keeping and match into repaired head.
    overlap_probe_s = 4.0
    probe = intro_m[int((cut_s - overlap_probe_s) * sr) : int(cut_s * sr)]
    # Search in first 12s of repaired (theme entry ~6.6s)
    search = repaired_m[: int(12.0 * sr)]
    lag, join_corr = best_match(search, probe)
    # lag = where (cut - overlap_probe) lands in repaired
    repaired_join_s = lag / sr + overlap_probe_s  # where cut_s should meet repaired
    print(
        f"join: intro end ~ overlaps repaired head; "
        f"cut maps to repaired@{repaired_join_s:.3f}s corr={join_corr:.3f}"
    )

    # If join corr is weak, just hard-prepend at repaired 0 with a short crossfade
    # from silence/intro into repaired[0].
    fade_s = 0.35
    intro_piece = intro_st[: int(cut_s * sr)].copy()

    # Level-match intro piece tail to repaired head around the join
    if join_corr >= 0.45 and 0.0 <= repaired_join_s <= 8.0:
        # Crossfade: keep intro until cut, blend into repaired starting at repaired_join - fade
        # Output = intro[0:cut-fade] + crossfade(intro[cut-fade:cut], repaired[join-fade:join]) + repaired[join:]
        fade = int(fade_s * sr)
        join_sample = int(repaired_join_s * sr)
        fade = min(fade, join_sample, len(intro_piece) // 4)

        intro_pre = intro_piece[:-fade] if fade > 0 else intro_piece
        intro_tail = intro_piece[-fade:] if fade > 0 else intro_piece[:0]
        rep_head = repaired_st[join_sample - fade : join_sample] if fade > 0 else repaired_st[:0]
        rep_rest = repaired_st[join_sample:]

        g = gain_match(rep_head if fade > 0 else repaired_st[: int(2 * sr)], intro_tail if fade > 0 else intro_piece[-int(2 * sr) :])
        # Also apply gentle overall gain from a longer window
        g2 = gain_match(
            repaired_st[max(0, join_sample) : join_sample + int(3 * sr)],
            intro_piece[-int(3 * sr) :],
        )
        gain = float(np.clip(0.5 * (g + g2), 0.25, 4.0))
        print(f"intro gain vs repaired join: {gain:.3f}")
        intro_pre = intro_pre * gain
        intro_tail = intro_tail * gain

        if fade > 0:
            ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)[:, None]
            blended = intro_tail * (1.0 - ramp) + rep_head * ramp
            out = np.concatenate([intro_pre, blended, rep_rest], axis=0)
            mode = "crossfade_into_repaired_join"
        else:
            out = np.concatenate([intro_pre, rep_rest], axis=0)
            mode = "hard_join"
        drop_repaired_s = repaired_join_s
    else:
        # Simple prepend with short crossfade at repaired[0]
        print("Using simple prepend + head crossfade")
        fade = int(0.4 * sr)
        g = gain_match(repaired_st[: int(3 * sr)], intro_piece[-int(3 * sr) :])
        gain = float(np.clip(g, 0.25, 4.0))
        print(f"intro gain: {gain:.3f}")
        intro_piece *= gain
        ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)[:, None]
        blended = intro_piece[-fade:] * (1.0 - ramp) + repaired_st[:fade] * ramp
        out = np.concatenate([intro_piece[:-fade], blended, repaired_st[fade:]], axis=0)
        mode = "prepend_crossfade"
        drop_repaired_s = 0.0
        join_corr = float(join_corr)

    write_wav_stereo(OUT_WAV, out, sr)
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(OUT_WAV), "-codec:a", "libmp3lame", "-q:a", "2", str(OUT_MP3)],
        check=True,
        capture_output=True,
    )
    print(f"Wrote {OUT_WAV} ({len(out)/sr:.3f}s)")
    print(f"Wrote {OUT_MP3}")

    report = {
        "intro_duration": len(intro_m) / sr,
        "repaired_duration": len(repaired_m) / sr,
        "part2_intro_s": part2_intro_s,
        "part2_corr": part2_corr,
        "repaired_anchor_s": repaired_anchor_s,
        "cut_s": cut_s,
        "join_corr": join_corr,
        "repaired_join_s": repaired_join_s if mode.startswith("crossfade") else 0.0,
        "drop_repaired_head_s": drop_repaired_s,
        "mode": mode,
        "out_duration": len(out) / sr,
        "outputs": [str(OUT_WAV), str(OUT_MP3)],
    }
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
