// ============================================
// NAVBAR
// ============================================
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
});

// Mobile menu toggle
const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
const navLinks = document.querySelector('.nav-links');

if (mobileMenuToggle && navLinks) {
    mobileMenuToggle.addEventListener('click', () => {
        const isExpanded = mobileMenuToggle.getAttribute('aria-expanded') === 'true';
        mobileMenuToggle.setAttribute('aria-expanded', !isExpanded);
        navLinks.classList.toggle('active');
    });

    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenuToggle.setAttribute('aria-expanded', 'false');
            navLinks.classList.remove('active');
        });
    });

    document.addEventListener('click', (e) => {
        if (!navbar.contains(e.target) && navLinks.classList.contains('active')) {
            mobileMenuToggle.setAttribute('aria-expanded', 'false');
            navLinks.classList.remove('active');
        }
    });
}

// ============================================
// DARK MODE
// ============================================
const darkModeToggle = document.getElementById('darkModeToggle');

function setDarkMode(enabled) {
    document.body.classList.toggle('dark-mode', enabled);
    localStorage.setItem('darkMode', enabled ? 'true' : 'false');
}

if (darkModeToggle) {
    const stored = localStorage.getItem('darkMode');
    if (stored === 'true') {
        setDarkMode(true);
    }
    darkModeToggle.addEventListener('click', () => {
        setDarkMode(!document.body.classList.contains('dark-mode'));
    });
}

// ============================================
// DEMO TABS
// ============================================
document.querySelectorAll('.demo-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.demo-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.demo-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const panel = document.getElementById('demo-' + tab.dataset.tab);
        if (panel) panel.classList.add('active');
        if (tab.dataset.tab === 'ecg' && ecgData && !ecgRunning) startECG();
    });
});

// ============================================
// ECG SIGNAL VISUALIZATION (NeuroKit2 data)
// ============================================
const ecgCanvas = document.getElementById('ecgCanvas');
let ecgCtx = null;
let ecgData = null;
let ecgSegment = null;
let ecgRunning = false;
let ecgPaused = false;
let ecgAnimId = null;
let ecgOffset = 0;
let ecgLastTime = 0;

const ECG_WINDOW_SEC = 4;

async function loadECGData() {
    try {
        const resp = await fetch('/assets/ecg_data.json');
        ecgData = await resp.json();
        setECGSegment(0);
        startECG();
    } catch (err) {
        console.error('Failed to load ECG data:', err);
        const statusEl = document.getElementById('ecgStatus');
        if (statusEl) statusEl.textContent = 'Data unavailable';
    }
}

function setECGSegment(idx) {
    ecgSegment = ecgData.segments[idx];
    ecgOffset = 0;
    ecgLastTime = 0;
    updateECGStats(0);
}

function updateECGStats(centerSample) {
    if (!ecgSegment) return;
    const bpmEl = document.getElementById('ecgBPM');
    const rrEl = document.getElementById('ecgRR');
    const qualEl = document.getElementById('ecgQuality');
    const statusEl = document.getElementById('ecgStatus');

    const hr = ecgSegment.heart_rate;
    const idx = Math.min(Math.floor(centerSample), hr.length - 1);
    const currentHR = Math.round(hr[Math.max(0, idx)]);

    if (bpmEl) bpmEl.textContent = currentHR;

    // Find the nearest R-R interval
    const peaks = ecgSegment.r_peaks;
    let nearestRR = '—';
    for (let i = 1; i < peaks.length; i++) {
        if (peaks[i] >= centerSample - ecgSegment.sampling_rate * 2) {
            nearestRR = Math.round((peaks[i] - peaks[i - 1]) / ecgSegment.sampling_rate * 1000);
            break;
        }
    }
    if (rrEl) rrEl.textContent = nearestRR;

    // Quality
    const q = ecgSegment.quality;
    const qIdx = Math.min(Math.floor(centerSample), q.length - 1);
    const currentQ = q[Math.max(0, qIdx)];
    if (qualEl) qualEl.textContent = currentQ >= 0.9 ? 'Excellent' : currentQ >= 0.7 ? 'Good' : 'Fair';

    // Status
    if (statusEl) {
        if (currentHR < 60) statusEl.textContent = 'Bradycardia';
        else if (currentHR > 100) statusEl.textContent = 'Tachycardia';
        else statusEl.textContent = 'Normal Sinus';
    }
}

function drawECG(timestamp) {
    if (!ecgRunning || !ecgCtx || !ecgSegment) return;

    if (!ecgPaused) {
        if (ecgLastTime === 0) ecgLastTime = timestamp;
        const dt = (timestamp - ecgLastTime) / 1000;
        ecgLastTime = timestamp;
        ecgOffset += dt * ecgSegment.sampling_rate;
        if (ecgOffset >= ecgSegment.num_samples) ecgOffset = 0;
    } else {
        ecgLastTime = timestamp;
    }

    const sr = ecgSegment.sampling_rate;
    const windowSamples = ECG_WINDOW_SEC * sr;
    const startIdx = Math.floor(ecgOffset);

    const dpr = window.devicePixelRatio || 1;
    const w = ecgCanvas.width / dpr;
    const h = ecgCanvas.height / dpr;

    const isDark = document.body.classList.contains('dark-mode');
    const bgColor = isDark ? '#0f1419' : '#ffffff';
    const gridColor = isDark ? '#1a2030' : '#f0f0f0';
    const gridMajor = isDark ? '#222a38' : '#e0e0e0';
    const traceColor = isDark ? '#34d399' : '#1a6b38';
    const rawColor = isDark ? '#6b7280' : '#9ca3af';
    const peakColor = isDark ? '#f87171' : '#dc2626';
    const pColor = isDark ? '#60a5fa' : '#3b82f6';
    const tColor = isDark ? '#fbbf24' : '#d97706';
    const qsColor = isDark ? '#a78bfa' : '#7c3aed';
    const textColor = isDark ? '#6b7280' : '#999';

    // Background
    ecgCtx.fillStyle = bgColor;
    ecgCtx.fillRect(0, 0, w, h);

    // Grid
    const gridSpacing = 20;
    ecgCtx.lineWidth = 0.5;
    for (let x = 0; x < w; x += gridSpacing) {
        ecgCtx.strokeStyle = (x % (gridSpacing * 5) === 0) ? gridMajor : gridColor;
        ecgCtx.beginPath();
        ecgCtx.moveTo(x, 0);
        ecgCtx.lineTo(x, h);
        ecgCtx.stroke();
    }
    for (let y = 0; y < h; y += gridSpacing) {
        ecgCtx.strokeStyle = (y % (gridSpacing * 5) === 0) ? gridMajor : gridColor;
        ecgCtx.beginPath();
        ecgCtx.moveTo(0, y);
        ecgCtx.lineTo(w, y);
        ecgCtx.stroke();
    }

    const showRaw = document.getElementById('ecgShowRaw')?.checked;
    const showPeaks = document.getElementById('ecgPeaks')?.checked;
    const showWaves = document.getElementById('ecgWaves')?.checked;

    const clean = ecgSegment.signal_clean;
    const raw = ecgSegment.signal_raw;
    const yCenter = h * 0.5;
    const yScale = h * 0.32;
    const xStep = w / windowSamples;

    function getSample(arr, i) {
        const idx = (startIdx + i) % arr.length;
        return arr[idx];
    }

    // Draw raw signal (faded, behind)
    if (showRaw) {
        ecgCtx.strokeStyle = rawColor;
        ecgCtx.lineWidth = 1;
        ecgCtx.beginPath();
        for (let i = 0; i < windowSamples; i++) {
            const x = i * xStep;
            const y = yCenter - getSample(raw, i) * yScale;
            if (i === 0) ecgCtx.moveTo(x, y); else ecgCtx.lineTo(x, y);
        }
        ecgCtx.stroke();
    }

    // Draw cleaned signal
    ecgCtx.strokeStyle = traceColor;
    ecgCtx.lineWidth = 1.5;
    ecgCtx.lineJoin = 'round';
    ecgCtx.beginPath();
    for (let i = 0; i < windowSamples; i++) {
        const x = i * xStep;
        const y = yCenter - getSample(clean, i) * yScale;
        if (i === 0) ecgCtx.moveTo(x, y); else ecgCtx.lineTo(x, y);
    }
    ecgCtx.stroke();

    // Helper: draw markers for a set of peak indices
    function drawMarkers(peakArray, color, label, yOff) {
        ecgCtx.fillStyle = color;
        ecgCtx.font = '9px Inter, sans-serif';
        ecgCtx.textAlign = 'center';
        for (const pk of peakArray) {
            const rel = pk - startIdx;
            const wrapped = ((rel % clean.length) + clean.length) % clean.length;
            if (wrapped >= 0 && wrapped < windowSamples) {
                const x = wrapped * xStep;
                const y = yCenter - clean[pk % clean.length] * yScale;
                ecgCtx.beginPath();
                ecgCtx.arc(x, y + yOff, 3, 0, Math.PI * 2);
                ecgCtx.fill();
                if (label) ecgCtx.fillText(label, x, y + yOff - 7);
            }
        }
    }

    // R-peaks
    if (showPeaks) {
        drawMarkers(ecgSegment.r_peaks, peakColor, null, -6);

        // R-R intervals between visible peaks
        ecgCtx.font = '10px Inter, sans-serif';
        ecgCtx.fillStyle = textColor;
        ecgCtx.textAlign = 'center';
        const peaks = ecgSegment.r_peaks;
        for (let i = 1; i < peaks.length; i++) {
            const r1 = ((peaks[i - 1] - startIdx) % clean.length + clean.length) % clean.length;
            const r2 = ((peaks[i] - startIdx) % clean.length + clean.length) % clean.length;
            if (r1 >= 0 && r1 < windowSamples && r2 > r1 && r2 < windowSamples) {
                const x1 = r1 * xStep;
                const x2 = r2 * xStep;
                const rrMs = Math.round((peaks[i] - peaks[i - 1]) / sr * 1000);
                ecgCtx.fillText(rrMs + 'ms', (x1 + x2) / 2, 14);
            }
        }
    }

    // PQST wave markers
    if (showWaves) {
        drawMarkers(ecgSegment.p_peaks, pColor, 'P', -6);
        drawMarkers(ecgSegment.q_peaks, qsColor, 'Q', 6);
        drawMarkers(ecgSegment.s_peaks, qsColor, 'S', 6);
        drawMarkers(ecgSegment.t_peaks, tColor, 'T', -6);
    }

    // Scale labels
    ecgCtx.font = '10px Inter, sans-serif';
    ecgCtx.fillStyle = textColor;
    ecgCtx.textAlign = 'left';
    ecgCtx.fillText('25mm/s  10mm/mV', 6, h - 6);
    ecgCtx.textAlign = 'right';
    ecgCtx.fillText(ecgSegment.label, w - 6, h - 6);

    // Update stats
    updateECGStats(startIdx + windowSamples / 2);

    ecgAnimId = requestAnimationFrame(drawECG);
}

function resizeECGCanvas() {
    if (!ecgCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = ecgCanvas.getBoundingClientRect();
    ecgCanvas.width = rect.width * dpr;
    ecgCanvas.height = rect.height * dpr;
    ecgCtx = ecgCanvas.getContext('2d');
    ecgCtx.scale(dpr, dpr);
}

function startECG() {
    if (ecgRunning) return;
    resizeECGCanvas();
    ecgRunning = true;
    ecgPaused = false;
    ecgLastTime = 0;
    ecgAnimId = requestAnimationFrame(drawECG);
}

function stopECG() {
    ecgRunning = false;
    if (ecgAnimId) cancelAnimationFrame(ecgAnimId);
}

// ECG Controls
const ecgPlayPause = document.getElementById('ecgPlayPause');
const ecgResetBtn = document.getElementById('ecgReset');
const ecgSegmentSelect = document.getElementById('ecgSegment');

if (ecgPlayPause) {
    ecgPlayPause.addEventListener('click', () => {
        ecgPaused = !ecgPaused;
        ecgPlayPause.textContent = ecgPaused ? 'Play' : 'Pause';
    });
}

if (ecgResetBtn) {
    ecgResetBtn.addEventListener('click', () => {
        ecgOffset = 0;
        ecgLastTime = 0;
        ecgPaused = false;
        if (ecgPlayPause) ecgPlayPause.textContent = 'Pause';
    });
}

if (ecgSegmentSelect) {
    ecgSegmentSelect.addEventListener('change', () => {
        if (!ecgData) return;
        setECGSegment(parseInt(ecgSegmentSelect.value));
        ecgPaused = false;
        if (ecgPlayPause) ecgPlayPause.textContent = 'Pause';
    });
}

window.addEventListener('resize', () => {
    if (ecgRunning) resizeECGCanvas();
});

// Load ECG data and start
if (ecgCanvas) {
    loadECGData();
}

// ============================================
// PLATFORMER EMBED DETECTION
// ============================================
(function () {
    const frame = document.getElementById('platformerFrame');
    const fallback = document.getElementById('platformerFallback');
    const fsBtn = document.getElementById('platformerFullscreen');
    if (!frame) return;

    fetch('/games/platformer/index.html', { method: 'HEAD' })
        .then(resp => {
            if (resp.ok) {
                frame.style.display = 'block';
                if (fallback) fallback.style.display = 'none';
                if (fsBtn) fsBtn.style.display = 'inline-block';
            }
        })
        .catch(() => {});

    if (fsBtn) {
        fsBtn.addEventListener('click', () => {
            const embed = document.getElementById('platformerEmbed');
            if (embed.requestFullscreen) embed.requestFullscreen();
            else if (embed.webkitRequestFullscreen) embed.webkitRequestFullscreen();
        });
    }
})();

// ============================================
// SMOOTH SCROLL
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = anchor.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const navbarHeight = document.querySelector('.navbar').offsetHeight;
                const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - navbarHeight;
                window.scrollTo({ top: targetPosition, behavior: 'smooth' });
            }
        });
    });
});
