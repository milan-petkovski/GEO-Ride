/**
 * @file leaderboard.js
 * @description Global, European and per-country leaderboards backed by Supabase RPC functions
 * and enriched with a deterministic smart-seed pilot pool so rankings are always bustling and competitive.
 */

import { state } from './state.js';
import { georideRpc, isBackendConfigured } from './supabase-georide.js';
import { getScorePayload, getIdentity, noteLeaderboardRank, isoWeekKey, utcDayKey } from './progress.js';

export const BOARDS = [
    { id: 'daily', label: 'Today', unit: 'PTS', hint: 'Drift points banked today' },
    { id: 'weekly', label: 'This Week', unit: 'PTS', hint: 'Drift points banked this week' },
    { id: 'drift', label: 'Best Drift', unit: 'PTS', hint: 'Highest single drift ever' },
    { id: 'speed', label: 'Top Speed', unit: 'KM/H', hint: 'Fastest run (max 250 road, 1,000 God Mode)' }
];

export const SCOPES = [
    { id: 'global', label: 'Global' },
    { id: 'europe', label: 'Europe' },
    { id: 'country', label: 'My Country' }
];

export const FREE_ROWS = 10;
export const PRO_ROWS = 100;

const SUBMIT_MIN_INTERVAL_MS = 30000;
const CACHE_TTL_MS = 45000;

let lastSubmitAt = 0;
let lastSubmitSignature = '';
let submitInFlight = false;
const cache = new Map();

export const EUROPEAN_COUNTRIES = new Set([
    'RS',
    'DE',
    'FR',
    'IT',
    'ES',
    'GB',
    'NL',
    'SE',
    'NO',
    'FI',
    'PL',
    'AT',
    'CH',
    'BE',
    'CZ',
    'PT',
    'GR',
    'HR',
    'BA',
    'ME',
    'SI',
    'HU',
    'RO',
    'BG',
    'SK',
    'IE',
    'DK'
]);

export const SEED_PILOTS = [
    ['ApexDrifter', 'DE', 48, true, 0.96],
    ['Tokyo_Ghost', 'JP', 56, true, 0.94],
    ['Stefan_011', 'RS', 42, true, 0.91],
    ['Pierre_Vitesse', 'FR', 38, false, 0.88],
    ['Marco_Monza', 'IT', 45, true, 0.86],
    ['NeonRider', 'US', 52, true, 0.84],
    ['SilverstoneAce', 'GB', 36, false, 0.82],
    ['Nikola_BG', 'RS', 35, true, 0.8],
    ['Nordic_Slide', 'SE', 39, true, 0.78],
    ['Carlos_Drift', 'ES', 31, false, 0.76],
    ['DutchFlyer', 'NL', 28, false, 0.74],
    ['Vuk_NS', 'RS', 30, false, 0.72],
    ['Klaus_Autobahn', 'DE', 43, true, 0.7],
    ['Takumi_R', 'JP', 50, true, 0.68],
    ['Luka_Bgd', 'RS', 27, false, 0.64],
    ['AlpineRacer', 'CH', 34, true, 0.58]
].map(([name, country, level, is_pro, skill]) => ({ name, country, level, is_pro, skill }));

function hashSeed(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function calculateSeedScore(pilot, board, period) {
    const seed = hashSeed(`${board}|${period}|${pilot.name}`);
    const jitter = (seed % 1000) / 1000;
    const factor = (pilot.skill * 0.72 + 0.28) * (0.86 + jitter * 0.26);

    switch (board) {
        case 'daily':
            return Math.round((24000 + factor * 145000) / 50) * 50;
        case 'weekly':
            return Math.round((95000 + factor * 640000) / 100) * 100;
        case 'drift':
            return Math.round((16000 + factor * 165000) / 50) * 50;
        case 'speed':
            return pilot.is_pro
                ? Math.min(1000, Math.round(760 + factor * 240))
                : Math.min(250, Math.round(180 + factor * 70));
        default:
            return Math.round(factor * 10000);
    }
}

export function blendWithSeedPilots({ board, scope, country, period, realEntries = [], me = null, limit = FREE_ROWS }) {
    const targetCountry = country || 'RS';
    let candidates = SEED_PILOTS;

    if (scope === 'country') {
        candidates = SEED_PILOTS.filter((p) => p.country === targetCountry);
        if (candidates.length < 10) {
            const fallbackCountry = [
                ['Pilot_' + targetCountry, targetCountry, 31, true, 0.75],
                ['Racer_' + targetCountry, targetCountry, 25, false, 0.62],
                ['Turbo_' + targetCountry, targetCountry, 20, false, 0.48],
                ['Apex_' + targetCountry, targetCountry, 16, false, 0.35]
            ].map(([name, c, level, is_pro, skill]) => ({ name, country: c, level, is_pro, skill }));
            candidates = [...candidates, ...fallbackCountry];
        }
    } else if (scope === 'europe') {
        candidates = SEED_PILOTS.filter((p) => EUROPEAN_COUNTRIES.has(p.country));
    }

    const realNames = new Set(realEntries.map((e) => (e.name || '').trim().toLowerCase()));
    const myName = (state.playerName || 'Pilot').trim().toLowerCase();

    const seededEntries = candidates
        .filter((p) => !realNames.has(p.name.toLowerCase()) && p.name.toLowerCase() !== myName)
        .map((p) => ({
            name: p.name,
            country: p.country,
            level: p.level,
            is_pro: p.is_pro,
            score: calculateSeedScore(p, board, period),
            is_me: false
        }));

    let pool = realEntries.map((e) => ({
        ...e,
        is_me: Boolean(e.is_me)
    }));

    // If player has a recorded score on this board and is not yet in pool, inject them
    const alreadyHasMe = pool.some((e) => e.is_me);
    if (!alreadyHasMe) {
        const myScores = getScorePayload();
        const found = myScores.find((s) => s.board === board);
        if (found && found.score > 0) {
            const identity = getIdentity();
            pool.push({
                name: state.playerName || 'Pilot',
                country: identity.country || null,
                level: identity.level || 1,
                is_pro: Boolean(state.isPro),
                score: found.score,
                is_me: true
            });
        }
    }

    // Add seeded entries
    pool.push(...seededEntries);

    // Sort descending by score
    pool.sort((a, b) => b.score - a.score);

    // Compute ranks
    pool.forEach((entry, idx) => {
        entry.rank = idx + 1;
    });

    // Resolve player's rank entry
    let resolvedMe = pool.find((e) => e.is_me) || me;
    if (resolvedMe) {
        resolvedMe = {
            rank: resolvedMe.rank,
            name: resolvedMe.name,
            score: resolvedMe.score,
            level: resolvedMe.level,
            country: resolvedMe.country,
            is_pro: resolvedMe.is_pro
        };
        if (scope === 'global') {
            noteLeaderboardRank(resolvedMe.rank);
        }
    }

    const totalEstimate = Math.max(pool.length, 130 + (hashSeed(`${board}|${period}|total`) % 42));

    return {
        entries: pool.slice(0, limit),
        me: resolvedMe,
        total: totalEstimate,
        offline: false
    };
}

export function periodForBoard(boardId, now = Date.now()) {
    if (boardId === 'daily') return utcDayKey(now);
    if (boardId === 'weekly') return isoWeekKey(now);
    return 'all';
}

export function isLeaderboardAvailable() {
    return true;
}

/**
 * Uploads the latest personal bests. Throttled and skipped when nothing changed.
 * @param {{force?: boolean}} [opts]
 * @returns {Promise<boolean>} True when a submission was sent successfully.
 */
export async function submitProgress({ force = false } = {}) {
    if (!isBackendConfigured() || submitInFlight) return false;
    const scores = getScorePayload();
    if (!scores.length) return false;

    const signature = JSON.stringify(scores);
    const now = Date.now();
    if (!force && (signature === lastSubmitSignature || now - lastSubmitAt < SUBMIT_MIN_INTERVAL_MS)) return false;

    const identity = getIdentity();
    let email = null;
    try {
        email = typeof localStorage !== 'undefined' ? localStorage.getItem('geo_ride_pro_email') : null;
    } catch {
        email = null;
    }

    submitInFlight = true;
    try {
        const result = await georideRpc('georide_submit_score', {
            p_player: identity.playerId,
            p_name: state.playerName || 'Pilot',
            p_country: identity.country || null,
            p_email: state.isPro ? email : null,
            p_level: identity.level,
            p_xp: identity.xp,
            p_scores: scores
        });
        lastSubmitAt = Date.now();
        if (result && result.ok) {
            lastSubmitSignature = signature;
            cache.clear();
            return true;
        }
        return false;
    } catch (err) {
        console.warn('Leaderboard submit failed:', err.message);
        lastSubmitAt = Date.now();
        return false;
    } finally {
        submitInFlight = false;
    }
}

/**
 * Fetches a leaderboard slice with seamless fallback to realistic seed pilots.
 * @param {{board: string, scope: string, limit?: number}} params
 * @returns {Promise<{entries: Array, me: object|null, total: number, offline?: boolean}>}
 */
export async function fetchLeaderboard({ board, scope, limit = FREE_ROWS }) {
    const identity = getIdentity();
    const effectiveScope = scope === 'country' && !identity.country ? 'global' : scope;
    const period = periodForBoard(board);
    const key = `${board}|${period}|${effectiveScope}|${identity.country}|${limit}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

    let rawEntries = [];
    let rawMe = null;

    if (isBackendConfigured()) {
        try {
            const data = await georideRpc('georide_leaderboard', {
                p_board: board,
                p_period: period,
                p_scope: effectiveScope,
                p_country: identity.country || null,
                p_player: identity.playerId,
                p_limit: limit
            });
            rawEntries = Array.isArray(data?.entries) ? data.entries : [];
            rawMe = data?.me || null;
        } catch (err) {
            console.warn('Leaderboard fetch fallback to seeds:', err.message);
        }
    }

    const blended = blendWithSeedPilots({
        board,
        scope: effectiveScope,
        country: identity.country,
        period,
        realEntries: rawEntries,
        me: rawMe,
        limit
    });

    cache.set(key, { at: Date.now(), data: blended });
    return blended;
}
