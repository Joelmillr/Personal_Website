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


PADDING_SEC = 3


def generate_segment(duration, heart_rate, noise_level, label, seed):
    """Generate and process one ECG segment.

    Strategy: simulate a longer ECG than needed, add noise, process with
    NeuroKit2, then trim the padded edges.  The padding absorbs the
    bandpass filter's transient so the kept region has clean == raw in
    shape (just denoised).
    """
    rng = np.random.default_rng(seed)
    padded_duration = duration + 2 * PADDING_SEC
    pad_samples = PADDING_SEC * SAMPLING_RATE

    # 1. Generate base ECG with minimal simulator noise
    ecg_base = nk.ecg_simulate(
        duration=padded_duration,
        sampling_rate=SAMPLING_RATE,
        heart_rate=heart_rate,
        noise=0.005,
        method="ecgsyn",
        random_state=seed,
    )

    # 2. Build realistic noise to add on top
    n_samples = len(ecg_base)
    t = np.arange(n_samples) / SAMPLING_RATE

    powerline = 0.06 * noise_level * np.sin(2 * np.pi * 60 * t)
    hf_noise = noise_level * 0.05 * rng.standard_normal(n_samples)
    ecg_raw = ecg_base + powerline + hf_noise

    # 3. Process the full padded signal
    signals, info = nk.ecg_process(ecg_raw, sampling_rate=SAMPLING_RATE)

    # 4. Trim padding from both ends to remove filter edge effects
    end = len(signals) - pad_samples
    signals = signals.iloc[pad_samples:end].reset_index(drop=True)

    r_peaks = [int(p - pad_samples) for p in info["ECG_R_Peaks"] if pad_samples <= p < end]

    def extract_indices(col_name):
        if col_name in signals.columns:
            return list(signals.index[signals[col_name] == 1].tolist())
        return []

    rr_intervals = []
    if len(r_peaks) > 1:
        rr_intervals = [
            round((r_peaks[i] - r_peaks[i - 1]) / SAMPLING_RATE * 1000)
            for i in range(1, len(r_peaks))
        ]

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
