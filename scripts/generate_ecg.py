#!/usr/bin/env python3
"""Generate realistic ECG data using NeuroKit2 for the portfolio website demo.

Produces a JSON file with:
- Multiple ECG segments at different heart rates (resting, elevated, recovery)
- Cleaned signal, R-peak locations, P/Q/S/T wave markers
- Instantaneous heart rate, signal quality, cardiac phases
"""

import json
import neurokit2 as nk
import numpy as np

SAMPLING_RATE = 250
OUTPUT_PATH = "../public/assets/ecg_data.json"


def generate_segment(duration, heart_rate, noise_level, label, seed):
    """Generate and process one ECG segment.

    Strategy: simulate a clean ECG, then add realistic noise artifacts
    (powerline interference, baseline wander, high-frequency EMG noise)
    to create the 'raw' signal.  NeuroKit2's ecg_process() then cleans
    it up, producing a visibly improved 'clean' trace.
    """
    rng = np.random.default_rng(seed)

    # 1. Generate base ECG with minimal simulator noise
    ecg_base = nk.ecg_simulate(
        duration=duration,
        sampling_rate=SAMPLING_RATE,
        heart_rate=heart_rate,
        noise=0.005,          # very small — just enough for natural variation
        method="ecgsyn",
        random_state=seed,
    )

    # 2. Build realistic noise to add on top
    n_samples = len(ecg_base)
    t = np.arange(n_samples) / SAMPLING_RATE

    # Powerline interference (60 Hz mains hum)
    powerline = 0.12 * noise_level * np.sin(2 * np.pi * 60 * t)

    # Baseline wander (slow drift, ~0.3 Hz)
    wander = 0.25 * noise_level * np.sin(2 * np.pi * 0.3 * t + rng.uniform(0, 2 * np.pi))
    wander += 0.12 * noise_level * np.sin(2 * np.pi * 0.1 * t + rng.uniform(0, 2 * np.pi))

    # High-frequency EMG / electrode noise
    hf_noise = noise_level * 0.15 * rng.standard_normal(n_samples)

    # Combine into noisy raw signal
    ecg_raw = ecg_base + powerline + wander + hf_noise

    # 3. Process the noisy signal — NeuroKit2 will bandpass-filter, remove
    #    baseline wander, and detect peaks on the cleaned version.
    signals, info = nk.ecg_process(ecg_raw, sampling_rate=SAMPLING_RATE)

    r_peaks = info["ECG_R_Peaks"].tolist()

    # Extract PQRST wave peak indices (where column == 1)
    def extract_indices(col_name):
        if col_name in signals.columns:
            return list(signals.index[signals[col_name] == 1].tolist())
        return []

    # Compute R-R intervals in ms
    rr_intervals = []
    if len(r_peaks) > 1:
        rr_intervals = [
            round((r_peaks[i] - r_peaks[i - 1]) / SAMPLING_RATE * 1000)
            for i in range(1, len(r_peaks))
        ]

    # Downsample signals to reduce JSON size: keep every point (250 Hz is fine
    # for smooth rendering at 60fps over 4-second windows)
    clean = signals["ECG_Clean"].values
    raw = signals["ECG_Raw"].values
    hr = signals["ECG_Rate"].values
    quality = signals["ECG_Quality"].values

    return {
        "label": label,
        "duration": duration,
        "target_hr": heart_rate,
        "sampling_rate": SAMPLING_RATE,
        "num_samples": len(clean),
        "signal_clean": np.round(clean, 4).tolist(),
        "signal_raw": np.round(raw, 4).tolist(),
        "heart_rate": np.round(np.nan_to_num(hr, nan=heart_rate), 1).tolist(),
        "quality": np.round(np.nan_to_num(quality, nan=0.0), 3).tolist(),
        "r_peaks": r_peaks,
        "p_peaks": extract_indices("ECG_P_Peaks"),
        "q_peaks": extract_indices("ECG_Q_Peaks"),
        "s_peaks": extract_indices("ECG_S_Peaks"),
        "t_peaks": extract_indices("ECG_T_Peaks"),
        "rr_intervals_ms": rr_intervals,
        "mean_hr": round(float(np.nanmean(hr)), 1) if len(hr) > 0 else heart_rate,
        "mean_quality": round(float(np.nanmean(quality)), 3),
    }


def main():
    segments = [
        generate_segment(20, 68, 1.0, "Normal Sinus Rhythm", seed=42),
        generate_segment(20, 95, 1.5, "Elevated Heart Rate", seed=123),
        generate_segment(20, 55, 1.0, "Resting / Bradycardia", seed=77),
    ]

    output = {
        "version": 1,
        "generator": "NeuroKit2 v0.2.13 (ECGSYN)",
        "sampling_rate": SAMPLING_RATE,
        "segments": segments,
    }

    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f)

    total_samples = sum(s["num_samples"] for s in segments)
    total_peaks = sum(len(s["r_peaks"]) for s in segments)
    print(f"Generated {len(segments)} segments, {total_samples} total samples, {total_peaks} R-peaks")

    import os
    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"Output: {OUTPUT_PATH} ({size_kb:.0f} KB)")


if __name__ == "__main__":
    main()
