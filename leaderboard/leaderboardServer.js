const express = require('express');
const fs = require('fs');
const path = require('path');

const SCORES_FILE = path.join(__dirname, 'scores.json');
const MAX_STORED_SCORES = 100;
const TOP_N = 10;

// Validation bounds
const MIN_TIME = 5.0;
const MAX_TIME = 600.0;
const NAME_PATTERN = /^[A-Z0-9]{1,3}$/;

// Rate limiting
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 5;
const rateLimits = new Map();

function checkRateLimit(ip) {
    const now = Date.now();
    const entry = rateLimits.get(ip);

    if (!entry || now > entry.resetTime) {
        rateLimits.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return true;
    }

    if (entry.count >= RATE_LIMIT_MAX) {
        return false;
    }

    entry.count++;
    return true;
}

function loadScores() {
    try {
        if (!fs.existsSync(SCORES_FILE)) return [];
        const data = fs.readFileSync(SCORES_FILE, 'utf8');
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveScores(scores) {
    // Sort by time ascending (lower is better), keep top N stored
    scores.sort((a, b) => a.time - b.time);
    scores = scores.slice(0, MAX_STORED_SCORES);
    fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2));
    return scores;
}

function getTopScores(scores) {
    return scores.sort((a, b) => a.time - b.time).slice(0, TOP_N);
}

function createLeaderboardRouter() {
    const router = express.Router();
    router.use(express.json({ limit: '1kb' }));

    // GET /api/leaderboard — return top 10 scores
    router.get('/', (req, res) => {
        const scores = loadScores();
        res.json(getTopScores(scores));
    });

    // POST /api/leaderboard — submit a new score
    router.post('/', (req, res) => {
        // Rate limit
        if (!checkRateLimit(req.ip)) {
            return res.status(429).json({ error: 'Too many submissions. Try again in a minute.' });
        }

        let { name, time } = req.body;

        // Validate name
        if (typeof name !== 'string') {
            return res.status(400).json({ error: 'Name is required.' });
        }
        name = name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 3);
        if (!NAME_PATTERN.test(name)) {
            return res.status(400).json({ error: 'Name must be 1-3 alphanumeric characters.' });
        }

        // Validate time
        time = parseFloat(time);
        if (isNaN(time) || time < MIN_TIME || time > MAX_TIME) {
            return res.status(400).json({ error: `Time must be between ${MIN_TIME} and ${MAX_TIME} seconds.` });
        }

        // Round to 2 decimal places
        time = Math.round(time * 100) / 100;

        // Load, add, save
        const scores = loadScores();
        scores.push({ name, time, date: new Date().toISOString() });
        const saved = saveScores(scores);

        res.status(201).json(getTopScores(saved));
    });

    return router;
}

module.exports = { createLeaderboardRouter };
