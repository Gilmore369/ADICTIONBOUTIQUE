from __future__ import annotations

import math
import os
import random
import wave
from array import array
from pathlib import Path

SAMPLE_RATE = 44100
OUT_DIR = Path("public/videos/sfx")


def write_wav(path: Path, samples: list[float]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = array("h")
    for sample in samples:
        pcm.append(max(-32767, min(32767, int(sample * 32767))))

    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(pcm.tobytes())


def sine(freq: float, t: float) -> float:
    return math.sin(2 * math.pi * freq * t)


def make_whoosh(duration: float = 0.55) -> list[float]:
    total = int(duration * SAMPLE_RATE)
    random.seed(42)
    samples: list[float] = []
    for i in range(total):
        t = i / SAMPLE_RATE
        progress = i / total
        envelope = math.sin(progress * math.pi) ** 1.8
        sweep = sine(160 + 900 * progress, t) * 0.08
        noise = (random.random() * 2 - 1) * 0.16 * envelope
        samples.append((noise + sweep) * envelope)
    return samples


def make_click(duration: float = 0.11) -> list[float]:
    total = int(duration * SAMPLE_RATE)
    samples: list[float] = []
    for i in range(total):
        t = i / SAMPLE_RATE
        envelope = math.exp(-55 * t)
        samples.append((sine(1300, t) * 0.35 + sine(2700, t) * 0.12) * envelope)
    return samples


def make_success(duration: float = 0.72) -> list[float]:
    total = int(duration * SAMPLE_RATE)
    samples: list[float] = []
    notes = [(659.25, 0.0), (880.0, 0.16), (1174.66, 0.34)]
    for i in range(total):
        t = i / SAMPLE_RATE
        value = 0.0
        for freq, start in notes:
            if t >= start:
                local = t - start
                value += sine(freq, local) * math.exp(-5.8 * local) * 0.22
        samples.append(value)
    return samples


def make_cash(duration: float = 0.5) -> list[float]:
    total = int(duration * SAMPLE_RATE)
    random.seed(7)
    samples: list[float] = []
    for i in range(total):
        t = i / SAMPLE_RATE
        progress = i / total
        envelope = math.exp(-4.8 * progress)
        jingle = sine(1320, t) * 0.12 + sine(1760, t) * 0.09
        ticks = (random.random() * 2 - 1) * 0.08
        samples.append((jingle + ticks) * envelope)
    return samples


def make_bg(duration: float = 120.0) -> list[float]:
    total = int(duration * SAMPLE_RATE)
    samples: list[float] = []
    root_notes = [110.0, 146.83, 164.81, 130.81]
    for i in range(total):
        t = i / SAMPLE_RATE
        bar = int(t / 6.0) % len(root_notes)
        root = root_notes[bar]
        slow = 0.5 + 0.5 * sine(0.06, t)
        pad = (
            sine(root, t) * 0.08
            + sine(root * 1.5, t) * 0.035
            + sine(root * 2.0, t) * 0.025
            + sine(root * 4.0, t) * 0.012
        )
        pulse = (sine(2.0, t) > 0.94) * 0.035 * math.exp(-12 * (t % 0.5))
        samples.append((pad * slow + pulse) * 0.42)
    return samples


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    write_wav(OUT_DIR / "whoosh.wav", make_whoosh())
    write_wav(OUT_DIR / "click.wav", make_click())
    write_wav(OUT_DIR / "success.wav", make_success())
    write_wav(OUT_DIR / "cash.wav", make_cash())
    write_wav(OUT_DIR / "bg-bed.wav", make_bg())


if __name__ == "__main__":
    main()
