#!/usr/bin/env python3
"""
Prepend intro 0-~22s onto repaired using chroma to locate part-2 boundary
and to find the smoothest join into the repaired track.
"""
from __future__ import annotations

import json
import subprocess
import wave
from pathlib import Path

import librosa
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


def chroma(y: np.ndarray, sr: int, hop: int = 512) -> np.ndarray:
    C = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop, n_chroma=12, bins_per_octave=36)
    n = np.linalg.norm(C, axis=0, keepdims=True) + 1e-12
    return (C / n).astype(np.float32)


def slide_query_over_ref(ref_c: np.ndarray, query_c: np.ndarray, step: int = 1) -> tuple[int, float]:
    qlen = query_c.shape[1]
    best_i, best_s = 0, -1.0
    for i in range(0, ref_c.shape[1] - qlen + 1, step):
        s = float(np.mean(np.sum(ref_c[:, i : i + qlen] * query_c, axis=0)))
        if s > best_s:
            best_s = s
            best_i = i
    # refine
    for i in range(max(0, best_i - step), min(ref_c.shape[1] - qlen + 1, best_i + step + 1)):
        s = float(np.mean(np.sum(ref_c[:, i : i + qlen] * query_c, axis=0)))
        if s > best_s:
            best_s = s
            best_i = i
    return best_i, best_s


def rms(x: np.ndarray) -> float:
    return float(np.sqrt(np.mean(x**2) + 1e-12))


def main() -> None:
    intro_st, sr = load_wav_stereo(INTRO)
    repaired_st, _ = load_wav_stereo(REPAIRED)
    print(f"intro={len(intro_st)/sr:.3f}s repaired={len(repaired_st)/sr:.3f}s")

    asr = 22050
    hop = 512
    intro_a, _ = librosa.load(str(INTRO), sr=asr, mono=True)
    repaired_a, _ = librosa.load(str(REPAIRED), sr=asr, mono=True)
    intro_c = chroma(intro_a, asr, hop)
    repaired_c = chroma(repaired_a, asr, hop)

    # 1) Find where intro's second half lives in repaired:
    #    take intro windows starting near 22s and slide over repaired.
    print("Matching intro part-2 windows into repaired…")
    part2_votes = []
    for start_s in np.arange(20.0, 28.0, 0.5):
        end_s = start_s + 8.0
        if end_s * asr > len(intro_a):
            break
        i0 = int(start_s * asr / hop)
        i1 = int(end_s * asr / hop)
        q = intro_c[:, i0:i1]
        fi, sc = slide_query_over_ref(repaired_c, q, step=2)
        part2_votes.append(
            {
                "intro_start": float(start_s),
                "repaired_start": fi * hop / asr,
                "score": sc,
            }
        )
        print(f"  intro[{start_s:.1f}-{end_s:.1f}] -> repaired@{fi*hop/asr:.3f}s score={sc:.3f}")

    part2_votes.sort(key=lambda r: -r["score"])
    best_p2 = part2_votes[0]
    print(
        f"best part2: intro@{best_p2['intro_start']:.2f}s ~= repaired@{best_p2['repaired_start']:.2f}s "
        f"score={best_p2['score']:.3f}"
    )

    # 2) Find clean cut: earliest intro time near 22 where part2 material begins.
    #    Use: among high-scoring votes (>= 0.85 * best), take the minimum intro_start.
    strong = [r for r in part2_votes if r["score"] >= best_p2["score"] * 0.92]
    if strong:
        cut_detect = min(r["intro_start"] for r in strong)
    else:
        cut_detect = best_p2["intro_start"]
    # User said 0-22; don't include second half — cut at detect, capped at 22.
    cut_s = min(22.0, cut_detect)
    # If detect is after 22, still cut at 22. If detect is before 22, cut at detect
    # so we don't leak part2.
    if cut_detect < 22.0:
        cut_s = cut_detect
    else:
        cut_s = 22.0
    # Small guard before detected part2 onset
    if best_p2["score"] >= 0.55 and cut_detect <= 24.0:
        cut_s = min(cut_s, cut_detect - 0.08)
    cut_s = float(np.clip(cut_s, 19.0, 22.0))
    print(f"cut_s={cut_s:.3f}s (detect={cut_detect:.3f})")

    # 3) Join: match the END of intro-part1 into repaired using chroma.
    #    Take last 6s before cut, find in repaired.
    tail_len = 6.0
    t0 = max(0.0, cut_s - tail_len)
    i0 = int(t0 * asr / hop)
    i1 = int(cut_s * asr / hop)
    q = intro_c[:, i0:i1]
    # Prefer matching into the early repaired region (first 20s)
    early = repaired_c[:, : int(20.0 * asr / hop)]
    fi, sc = slide_query_over_ref(early, q, step=1)
    # fi is where intro[t0] lands in repaired → cut lands at fi + tail_len
    repaired_at_cut = fi * hop / asr + (cut_s - t0)
    print(f"tail chroma: intro[{t0:.2f}-{cut_s:.2f}] -> repaired@{fi*hop/asr:.3f}s score={sc:.3f}")
    print(f"implies cut joins at repaired@{repaired_at_cut:.3f}s")

    # Also try matching start of part2 (intro[cut:cut+6]) which should equal some repaired point
    # — used as secondary cue for join continuity.
    p2_i0 = int(cut_s * asr / hop)
    p2_i1 = min(intro_c.shape[1], int((cut_s + 6.0) * asr / hop))
    if p2_i1 - p2_i0 > 10:
        fi2, sc2 = slide_query_over_ref(repaired_c, intro_c[:, p2_i0:p2_i1], step=2)
        print(f"part2 head intro[{cut_s:.2f}-{cut_s+6:.2f}] -> repaired@{fi2*hop/asr:.3f}s score={sc2:.3f}")
    else:
        fi2, sc2 = 0, -1.0

    # Decide join point on repaired:
    # Prefer: if part2 head matches well, join there (musical continuity).
    # Else if tail match is good, join at repaired_at_cut.
    # Else prepend at 0.
    fade_s = 0.5
    intro_piece = intro_st[: int(cut_s * sr)].copy()

    if sc2 >= 0.7:
        join_s = fi2 * hop / asr
        mode = "join_at_part2_match"
        join_score = sc2
    elif sc >= 0.65:
        join_s = max(0.0, repaired_at_cut)
        mode = "join_at_tail_match"
        join_score = sc
    else:
        # Fallback: if part2 best vote points near repaired theme entry (~6.6),
        # join there when cutting at part2 boundary.
        join_s = float(best_p2["repaired_start"]) if best_p2["score"] >= 0.55 else 0.0
        mode = "join_at_part2_vote" if best_p2["score"] >= 0.55 else "prepend_zero"
        join_score = best_p2["score"]

    # If join would skip too much of repaired head (>3s) and score is mediocre, prefer 0
    if join_s > 3.0 and join_score < 0.75:
        print(f"join@{join_s:.2f} score={join_score:.3f} mediocre — also considering prepend@0")

    print(f"mode={mode} join_s={join_s:.3f} score={join_score:.3f}")

    # Gain match: compare intro tail loudness to repaired around join
    fade = int(fade_s * sr)
    join_samp = int(join_s * sr)
    fade = min(fade, max(1, join_samp), len(intro_piece) // 5, int(1.0 * sr))

    # RMS gain on ~2s windows
    intro_tail_m = intro_piece[-int(2.0 * sr) :].mean(axis=1)
    rep_win = repaired_st[join_samp : join_samp + int(2.0 * sr)].mean(axis=1)
    if len(rep_win) < sr:
        rep_win = repaired_st[: int(2.0 * sr)].mean(axis=1)
    gain = rms(rep_win) / (rms(intro_tail_m) + 1e-12)
    gain = float(np.clip(gain, 0.3, 3.5))
    print(f"gain={gain:.3f}")
    intro_piece *= gain

    if join_samp <= 0 or fade < 8:
        # Pure prepend with short crossfade into repaired[0]
        fade = int(0.45 * sr)
        ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)[:, None]
        blended = intro_piece[-fade:] * (1.0 - ramp) + repaired_st[:fade] * ramp
        out = np.concatenate([intro_piece[:-fade], blended, repaired_st[fade:]], axis=0)
        mode = "prepend_zero_xfade"
        drop_s = 0.0
    else:
        intro_pre = intro_piece[:-fade]
        intro_tail = intro_piece[-fade:]
        rep_head = repaired_st[join_samp - fade : join_samp]
        rep_rest = repaired_st[join_samp:]
        # If join_samp < fade, pad
        if len(rep_head) < fade:
            pad = fade - len(rep_head)
            rep_head = np.vstack([repaired_st[:1].repeat(pad, axis=0) * 0, rep_head])
        ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)[:, None]
        blended = intro_tail * (1.0 - ramp) + rep_head * ramp
        out = np.concatenate([intro_pre, blended, rep_rest], axis=0)
        drop_s = join_s

    write_wav_stereo(OUT_WAV, out, sr)
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(OUT_WAV), "-codec:a", "libmp3lame", "-q:a", "2", str(OUT_MP3)],
        check=True,
        capture_output=True,
    )

    report = {
        "cut_s": cut_s,
        "cut_detect": cut_detect,
        "best_part2": best_p2,
        "part2_votes_top": part2_votes[:6],
        "mode": mode,
        "join_s": join_s,
        "join_score": join_score,
        "gain": gain,
        "drop_repaired_head_s": drop_s,
        "out_duration": len(out) / sr,
        "outputs": [str(OUT_WAV), str(OUT_MP3)],
    }
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Wrote {OUT_WAV} ({len(out)/sr:.3f}s)")
    print(f"Wrote {OUT_MP3}")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
