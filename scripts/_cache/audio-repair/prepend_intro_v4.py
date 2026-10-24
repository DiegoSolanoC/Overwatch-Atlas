#!/usr/bin/env python3
"""
Tag the missing intro piece onto the front of repaired.wav.
Keep the full original repaired start (from 0). Softly fade the intro
out and the repaired in, with a short silence gap between them.
"""
from __future__ import annotations

import json
import subprocess
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
INTRO = ROOT / "intro.wav"
REPAIRED = ROOT / "repaired.wav"
OUT_WAV = ROOT / "repaired_full.wav"
OUT_MP3 = ROOT / "repaired_full.mp3"
REPORT = ROOT / "prepend_report.json"

CUT_S = 21.42  # before abridged half
FADE_OUT_S = 0.85  # soften intro ending
FADE_IN_S = 0.65  # soften repaired opening
GAP_S = 0.45  # small silence between pieces
GAIN = 1.33  # prior RMS match to flythrough body


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


def main() -> None:
    intro_st, sr = load_wav_stereo(INTRO)
    repaired_st, _ = load_wav_stereo(REPAIRED)

    intro = intro_st[: int(CUT_S * sr)].copy() * GAIN
    repaired = repaired_st.copy()  # keep full original start

    fade_out = min(int(FADE_OUT_S * sr), len(intro) // 3)
    fade_in = min(int(FADE_IN_S * sr), len(repaired) // 8)
    gap = int(GAP_S * sr)

    # Fade intro to silence at its end (no eating into repaired)
    if fade_out > 1:
        ramp = np.linspace(1.0, 0.0, fade_out, dtype=np.float32)[:, None]
        # equal-power-ish settle into silence
        intro[-fade_out:] *= np.sqrt(ramp)

    # Fade repaired in from silence at its start (still keeps the material)
    if fade_in > 1:
        ramp = np.linspace(0.0, 1.0, fade_in, dtype=np.float32)[:, None]
        repaired[:fade_in] *= np.sqrt(ramp)

    silence = np.zeros((gap, repaired.shape[1]), dtype=np.float32)
    out = np.concatenate([intro, silence, repaired], axis=0)

    write_wav_stereo(OUT_WAV, out, sr)
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(OUT_WAV), "-codec:a", "libmp3lame", "-q:a", "2", str(OUT_MP3)],
        check=True,
        capture_output=True,
    )

    report = {
        "cut_s": CUT_S,
        "fade_out_s": fade_out / sr,
        "fade_in_s": fade_in / sr,
        "gap_s": gap / sr,
        "gain": GAIN,
        "intro_s": len(intro) / sr,
        "repaired_s": len(repaired) / sr,
        "out_duration": len(out) / sr,
        "mode": "prepend_full_start_with_silence_gap",
        "outputs": [str(OUT_WAV), str(OUT_MP3)],
    }
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(
        f"intro {len(intro)/sr:.2f}s + silence {gap/sr:.2f}s + repaired {len(repaired)/sr:.2f}s "
        f"= {len(out)/sr:.2f}s"
    )
    print(f"Wrote {OUT_WAV}")
    print(f"Wrote {OUT_MP3}")


if __name__ == "__main__":
    main()
