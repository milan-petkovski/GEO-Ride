/**
 * @file progress.js
 * @description Player progression engine for GEO Ride: XP and levels, lifetime stats, daily and weekly
 * challenges, streaks and achievements. Pure logic with localStorage persistence, no DOM access.
 */

import { state } from './state.js';

const STORAGE_KEY = 'geo_ride_progress_v1';
const MAX_LEVEL = 100;
const PRO_XP_MULTIPLIER = 1.5;
const MAX_SPOTS_STORED = 120;

const rdn = typeof Intl !== 'undefined' && Intl.DisplayNames ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
export const COUNTRIES =
    'RS,HR,BA,ME,MK,SI,AL,BG,RO,HU,GR,TR,AT,DE,CH,IT,FR,ES,PT,GB,IE,NL,BE,LU,DK,SE,NO,FI,IS,PL,CZ,SK,UA,LT,LV,EE,US,CA,MX,BR,AR,CL,CO,JP,KR,CN,IN,ID,PH,TH,VN,AU,NZ,AE,SA,EG,ZA,NG,MA'
        .split(',')
        .map((c) => [c, rdn ? rdn.of(c) : c]);

/* --------------------------------------------------------------------------
   Utilities
   -------------------------------------------------------------------------- */

export function formatNumber(n) {
    return Math.round(Number(n) || 0).toLocaleString('en-US');
}

/**
 * Belgrade time calculation for reset periods.
 * Resets at midnight (00:00 Europe/Belgrade).
 * Note: Never mention timezone details on the user-facing UI.
 */
function getBelgradeShiftedDate(now = Date.now()) {
    const shifted = new Date(now);
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Belgrade',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(shifted);

    const get = (type) => parts.find((p) => p.type === type)?.value || '00';
    const year = Number(get('year'));
    const month = Number(get('month'));
    const day = Number(get('day'));
    const hour = Number(get('hour')) % 24;
    const minute = Number(get('minute'));
    const second = Number(get('second'));

    return { year, month, day, hour, minute, second };
}

/** @returns {string} Period day key (shifts at 23:00 Europe/Belgrade). */
export function utcDayKey(now = Date.now()) {
    const b = getBelgradeShiftedDate(now);
    return `${b.year}-${String(b.month).padStart(2, '0')}-${String(b.day).padStart(2, '0')}`;
}

/** @returns {string} Period week key (shifts at Sunday 23:00 Europe/Belgrade). */
export function isoWeekKey(now = Date.now()) {
    const b = getBelgradeShiftedDate(now);
    const date = new Date(Date.UTC(b.year, b.month - 1, b.day));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
    const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function dayNumber(key) {
    return Math.floor(Date.parse(`${key}T00:00:00Z`) / 86400000);
}

/** Milliseconds until the next daily reset (23:00 Europe/Belgrade). */
export function msUntilNextDay(now = Date.now()) {
    const b = getBelgradeShiftedDate(now);
    const msToday = (b.hour * 3600 + b.minute * 60 + b.second) * 1000 + (now % 1000);
    return Math.max(1000, 86400000 - msToday);
}

/** Milliseconds until the next weekly reset (Sunday 23:00 Europe/Belgrade). */
export function msUntilNextWeek(now = Date.now()) {
    const b = getBelgradeShiftedDate(now);
    const date = new Date(Date.UTC(b.year, b.month - 1, b.day));
    const dow = date.getUTCDay() || 7; // 1 (Mon) to 7 (Sun)
    const daysUntilNext = 8 - dow;
    const msToday = (b.hour * 3600 + b.minute * 60 + b.second) * 1000 + (now % 1000);
    return Math.max(1000, daysUntilNext * 86400000 - msToday);
}

function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function seededShuffle(list, seedKey) {
    const rand = mulberry32(hashString(seedKey));
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function uuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

/* --------------------------------------------------------------------------
   Levels and XP
   -------------------------------------------------------------------------- */

/** Cumulative XP required to reach a given level. */
export function xpForLevel(level) {
    const l = Math.max(1, Math.min(level, MAX_LEVEL));
    return 250 * (l - 1) + 150 * (l - 1) * (l - 1);
}

export function levelFromXp(xp) {
    const safe = Math.max(0, Number(xp) || 0);
    let level = 1;
    while (level < MAX_LEVEL && safe >= xpForLevel(level + 1)) level++;
    const floor = xpForLevel(level);
    const next = level >= MAX_LEVEL ? floor : xpForLevel(level + 1);
    const span = Math.max(1, next - floor);
    const into = safe - floor;
    return {
        level,
        into,
        needed: span,
        pct: level >= MAX_LEVEL ? 100 : Math.min(100, Math.floor((into / span) * 100))
    };
}

const TITLES = [
    [1, 'Rookie'],
    [5, 'Street Driver'],
    [10, 'Drifter'],
    [25, 'Terrain Scout'],
    [50, 'Grand Master'],
    [75, 'Supreme Pilot'],
    [100, 'GEO Immortal']
];

export function titleForLevel(level) {
    let title = TITLES[0][1];
    for (const [min, name] of TITLES) {
        if (level >= min) title = name;
    }
    return title;
}

/* --------------------------------------------------------------------------
   Challenge catalog
   -------------------------------------------------------------------------- */

/** @typedef {'sum'|'max'|'set'} CounterMode */

export const CHALLENGE_CATALOG = [
    {
        metric: 'driftPoints',
        mode: 'sum',
        daily: [5000, 15000, 40000],
        weekly: [40000, 120000, 300000],
        label: (t) => `Bank ${formatNumber(t)} drift points`
    },
    {
        metric: 'bestCombo',
        mode: 'max',
        daily: [2000, 6000, 15000],
        weekly: [8000, 20000, 50000],
        label: (t) => `Land one drift worth ${formatNumber(t)} points`
    },
    {
        metric: 'banks',
        mode: 'sum',
        daily: [3, 8, 15],
        weekly: [20, 50, 100],
        label: (t) => `Bank ${t} drifts`
    },
    {
        metric: 'distanceKm',
        mode: 'sum',
        daily: [3, 8, 20],
        weekly: [25, 60, 150],
        label: (t) => `Drive ${t} km`
    },
    {
        metric: 'topSpeed',
        mode: 'max',
        daily: [120, 180, 230],
        weekly: [150, 200, 245],
        label: (t) => `Reach ${t} km/h in a road vehicle`
    },
    {
        metric: 'spots',
        mode: 'set',
        daily: [1, 3, 5],
        weekly: [3, 8, 15],
        label: (t) => `Visit ${t} different location${t === 1 ? '' : 's'}`,
        easyOnly: true
    },
    {
        metric: 'playMinutes',
        mode: 'sum',
        daily: [10, 25, 45],
        weekly: [60, 150, 300],
        label: (t) => `Drive actively for ${t} minutes`
    },
    {
        metric: 'photos',
        mode: 'sum',
        daily: [1, 3, 5],
        weekly: [3, 8, 15],
        label: (t) => `Capture ${t} photo${t === 1 ? '' : 's'} in Photo Mode`,
        easyOnly: true
    },
    {
        metric: 'highMultiplier',
        mode: 'sum',
        daily: [1, 3, 6],
        weekly: [5, 15, 30],
        label: (t) => `Land ${t} drift${t === 1 ? '' : 's'} with x3+ multiplier`
    },
    {
        metric: 'speedDistanceKm',
        mode: 'sum',
        daily: [2, 5, 12],
        weekly: [15, 40, 100],
        label: (t) => `Drive ${t} km at over 120 km/h`
    },
    {
        metric: 'cleanDistanceKm',
        mode: 'sum',
        daily: [2, 5, 10],
        weekly: [10, 25, 60],
        label: (t) => `Drive ${t} km continuously without crashing or resetting`
    },
    {
        metric: 'truckKm',
        mode: 'sum',
        daily: [2, 5, 12],
        weekly: [10, 25, 60],
        label: (t) => `Drive ${t} km in the Heavy Truck`
    },
    {
        metric: 'busKm',
        mode: 'sum',
        daily: [2, 5, 12],
        weekly: [10, 25, 60],
        label: (t) => `Drive ${t} km in the City Bus`
    },
    {
        metric: 'nightMinutes',
        mode: 'sum',
        daily: [3, 8, 18],
        weekly: [15, 40, 90],
        label: (t) => `Cruise under night sky for ${t} minutes`
    },
    {
        metric: 'rainMinutes',
        mode: 'sum',
        daily: [3, 8, 18],
        weekly: [15, 40, 90],
        label: (t) => `Drive in rain or storm conditions for ${t} minutes`
    },
    {
        metric: 'radioMinutes',
        mode: 'sum',
        daily: [5, 15, 30],
        weekly: [25, 60, 150],
        label: (t) => `Listen to web radio soundtrack for ${t} minutes while driving`
    }
];

const CHALLENGE_XP = {
    daily: [40, 90, 160],
    weekly: [250, 500, 900],
    bonus: { daily: 300, weekly: 1500 }
};

function buildPeriodItems(scope, key) {
    const order = seededShuffle(CHALLENGE_CATALOG, `${scope}:${key}`);
    const hardPool = order.filter((c) => !c.easyOnly);
    const items = [];
    const used = new Set();

    const pick = (pool) => {
        const found = pool.find((c) => !used.has(c.metric)) || order.find((c) => !used.has(c.metric));
        if (found) used.add(found.metric);
        return found;
    };

    const slots = [
        { tier: 0, pool: order },
        { tier: 1, pool: order },
        { tier: 2, pool: hardPool }
    ];

    slots.forEach(({ tier, pool }) => {
        const def = pick(pool);
        if (!def) return;
        items.push({
            id: `${scope}:${key}:${def.metric}:${tier}`,
            metric: def.metric,
            tier,
            target: def[scope][tier],
            xp: CHALLENGE_XP[scope][tier],
            bonus: false,
            status: 'active'
        });
    });

    const bonusDef = pick(hardPool);
    if (bonusDef) {
        const raw = bonusDef[scope][2] * 1.5;
        const target = raw >= 100 ? Math.round(raw / 50) * 50 : Math.round(raw);
        items.push({
            id: `${scope}:${key}:${bonusDef.metric}:bonus`,
            metric: bonusDef.metric,
            tier: 3,
            target,
            xp: CHALLENGE_XP.bonus[scope],
            bonus: true,
            status: 'active'
        });
    }
    return items;
}

export function describeChallenge(item) {
    const def = CHALLENGE_CATALOG.find((c) => c.metric === item.metric);
    return def ? def.label(item.target) : item.metric;
}

/* --------------------------------------------------------------------------
   Achievements
   -------------------------------------------------------------------------- */

const ACHIEVEMENT_GROUPS = {
    drift: 'Drift',
    speed: 'Speed',
    distance: 'Distance',
    explore: 'Explore',
    habit: 'Commitment',
    elite: 'Elite'
};

const a = (id, group, name, desc, tier, metric, target, xp) => ({ id, group, name, desc, tier, metric, target, xp });

export const ACHIEVEMENTS = [
    // Drift (Free)
    a('first_drift', 'drift', 'First Slide', 'Bank your first drift.', 'free', 'banks', 1, 50),
    a('drift_10k', 'drift', 'Tire Burner', 'Bank 10,000 total drift points.', 'free', 'totalDrift', 10000, 80),
    a('drift_50k', 'drift', 'Smoke Artisan', 'Bank 50,000 total drift points.', 'free', 'totalDrift', 50000, 150),
    a('drift_100k', 'drift', 'Smoke Machine', 'Bank 100,000 total drift points.', 'free', 'totalDrift', 100000, 200),
    a('drift_500k', 'drift', 'Asphalt Shredder', 'Bank 500,000 total drift points.', 'free', 'totalDrift', 500000, 400),
    a('drift_1m', 'drift', 'Drift King', 'Bank 1,000,000 total drift points.', 'free', 'totalDrift', 1000000, 600),
    a('combo_2k', 'drift', 'Angle Master', 'Land a single drift worth 2,000.', 'free', 'bestCombo', 2000, 60),
    a('combo_5k', 'drift', 'Chain Starter', 'Land a single drift worth 5,000.', 'free', 'bestCombo', 5000, 100),
    a('combo_15k', 'drift', 'Tandem Spirit', 'Land a single drift worth 15,000.', 'free', 'bestCombo', 15000, 180),
    a('combo_25k', 'drift', 'Combo Artist', 'Land a single drift worth 25,000.', 'free', 'bestCombo', 25000, 250),
    a('combo_50k', 'drift', 'Slide Virtuoso', 'Land a single drift worth 50,000.', 'free', 'bestCombo', 50000, 450),
    a('combo_100k', 'drift', 'Perfect Line', 'Land a single drift worth 100,000.', 'free', 'bestCombo', 100000, 700),
    a('bank_25', 'drift', 'Corner Carver', 'Bank 25 drifts.', 'free', 'banks', 25, 120),
    a('bank_100', 'drift', 'Consistent Slider', 'Bank 100 drifts.', 'free', 'banks', 100, 300),
    a('bank_250', 'drift', 'Drift Veteran', 'Bank 250 drifts.', 'free', 'banks', 250, 500),
    a('multi_3', 'drift', 'High Momentum', 'Land a drift with x3 multiplier.', 'free', 'multiplier3Count', 1, 100),
    a('multi_5', 'drift', 'Max Boost', 'Land a drift with x5 multiplier.', 'free', 'multiplier5Count', 1, 250),

    // Speed (Free)
    a('speed_100', 'speed', 'Warming Up', 'Reach 100 km/h.', 'free', 'topSpeed', 100, 40),
    a('speed_140', 'speed', 'Cruising Pace', 'Reach 140 km/h.', 'free', 'topSpeed', 140, 80),
    a('speed_180', 'speed', 'Highway Hero', 'Reach 180 km/h.', 'free', 'topSpeed', 180, 150),
    a('speed_210', 'speed', 'Fast Lane', 'Reach 210 km/h.', 'free', 'topSpeed', 210, 250),
    a('speed_240', 'speed', 'Redline', 'Reach 240 km/h in a road vehicle.', 'free', 'topSpeed', 240, 400),
    a('speed_dist_5', 'speed', 'Speed Runner', 'Drive 5 km at over 120 km/h.', 'free', 'speedDistanceKm', 5, 150),
    a('speed_dist_25', 'speed', 'Velocity Hunter', 'Drive 25 km at over 120 km/h.', 'free', 'speedDistanceKm', 25, 400),

    // Distance & Vehicles (Free)
    a('dist_5', 'distance', 'Local Driver', 'Drive 5 km in total.', 'free', 'distanceKm', 5, 40),
    a('dist_10', 'distance', 'Short Trip', 'Drive 10 km in total.', 'free', 'distanceKm', 10, 60),
    a('dist_25', 'distance', 'Scenic Route', 'Drive 25 km in total.', 'free', 'distanceKm', 25, 120),
    a('dist_50', 'distance', 'Commuter', 'Drive 50 km in total.', 'free', 'distanceKm', 50, 180),
    a('dist_100', 'distance', 'Road Tripper', 'Drive 100 km in total.', 'free', 'distanceKm', 100, 250),
    a('dist_250', 'distance', 'Cross Country', 'Drive 250 km in total.', 'free', 'distanceKm', 250, 450),
    a('dist_500', 'distance', 'Long Hauler', 'Drive 500 km in total.', 'free', 'distanceKm', 500, 600),
    a(
        'time_30m',
        'distance',
        'Getting Hooked',
        'Drive actively for 30 minutes in total.',
        'free',
        'playHours',
        0.5,
        80
    ),
    a('time_1h', 'distance', 'Settled In', 'Drive actively for 1 hour in total.', 'free', 'playHours', 1, 150),
    a('time_5h', 'distance', 'Road Warrior', 'Drive actively for 5 hours in total.', 'free', 'playHours', 5, 450),
    a('time_10h', 'distance', 'Devoted Driver', 'Drive actively for 10 hours in total.', 'free', 'playHours', 10, 700),
    a(
        'clean_5',
        'distance',
        'Smooth Operator',
        'Drive 5 km without crash or reset.',
        'free',
        'cleanDistanceKm',
        5,
        150
    ),
    a('truck_10', 'distance', 'Heavy Hauler', 'Drive 10 km in the Heavy Truck.', 'free', 'truckKm', 10, 200),
    a('bus_10', 'distance', 'Public Transit', 'Drive 10 km in the City Bus.', 'free', 'busKm', 10, 200),

    // Explore & Atmosphere (Free)
    a('spots_1', 'explore', 'First Stop', 'Visit your first location.', 'free', 'spotCount', 1, 30),
    a('spots_5', 'explore', 'Explorer', 'Visit 5 different locations.', 'free', 'spotCount', 5, 100),
    a('spots_10', 'explore', 'Navigator', 'Visit 10 different locations.', 'free', 'spotCount', 10, 200),
    a('spots_15', 'explore', 'Globe Trotter', 'Visit 15 different locations.', 'free', 'spotCount', 15, 350),
    a('spots_25', 'explore', 'World Traveler', 'Visit 25 different locations.', 'free', 'spotCount', 25, 500),
    a('photo_1', 'explore', 'Snapshot', 'Capture your first photo.', 'free', 'photos', 1, 40),
    a('photo_5', 'explore', 'Sightseer', 'Capture 5 photos in Photo Mode.', 'free', 'photos', 5, 100),
    a('photo_10', 'explore', 'Photographer', 'Capture 10 photos in Photo Mode.', 'free', 'photos', 10, 200),
    a('night_15m', 'explore', 'Night Owl', 'Cruise for 15 minutes under night sky.', 'free', 'nightMinutes', 15, 150),
    a('rain_15m', 'explore', 'Storm Chaser', 'Drive for 15 minutes in rain or storm.', 'free', 'rainMinutes', 15, 150),
    a(
        'radio_30m',
        'explore',
        'Soundtrack Drive',
        'Drive with radio playing for 30 minutes.',
        'free',
        'radioMinutes',
        30,
        150
    ),

    // Commitment (Free)
    a('daily_1', 'habit', 'Daily Driver', 'Complete a daily challenge.', 'free', 'dailyDone', 1, 60),
    a('daily_5', 'habit', 'Steady Pilot', 'Complete 5 daily challenges.', 'free', 'dailyDone', 5, 150),
    a('daily_10', 'habit', 'Dedicated Pilot', 'Complete 10 daily challenges.', 'free', 'dailyDone', 10, 250),
    a('daily_25', 'habit', 'Routine Racer', 'Complete 25 daily challenges.', 'free', 'dailyDone', 25, 500),
    a('weekly_1', 'habit', 'Weekly Warrior', 'Complete a weekly challenge.', 'free', 'weeklyDone', 1, 150),
    a('weekly_5', 'habit', 'Monthly Hero', 'Complete 5 weekly challenges.', 'free', 'weeklyDone', 5, 400),
    a('weekly_10', 'habit', 'Season Regular', 'Complete 10 weekly challenges.', 'free', 'weeklyDone', 10, 700),
    a('streak_3', 'habit', 'On a Roll', 'Reach a 3 day streak.', 'free', 'bestStreak', 3, 120),
    a('streak_5', 'habit', 'Consistency', 'Reach a 5 day streak.', 'free', 'bestStreak', 5, 200),
    a('streak_7', 'habit', 'Week Unbroken', 'Reach a 7 day streak.', 'free', 'bestStreak', 7, 350),
    a('level_5', 'habit', 'Next Tier', 'Reach level 5.', 'free', 'level', 5, 100),
    a('level_10', 'habit', 'Rising Star', 'Reach level 10.', 'free', 'level', 10, 200),
    a('level_25', 'habit', 'Veteran', 'Reach level 25.', 'free', 'level', 25, 600),

    // Elite (Pro Exclusive)
    a('pro_founder', 'elite', 'Pro Founder', 'Join GEO Ride Pro.', 'pro', 'isProFlag', 1, 500),
    a('pro_ghost', 'elite', 'Ghost Rider', 'Drive 20 km in God Mode.', 'pro', 'godKm', 20, 600),
    a('pro_hyper', 'elite', 'Hyperspace', 'Reach 800 km/h in God Mode.', 'pro', 'godTopSpeed', 800, 900),
    a('pro_speed_1500', 'elite', 'Warp Drive', 'Reach 1,000 km/h in God Mode.', 'pro', 'godTopSpeed', 1000, 1200),
    a('pro_million', 'elite', 'Million Club', 'Bank 5,000,000 total drift points.', 'pro', 'totalDrift', 5000000, 1200),
    a(
        'pro_drift_10m',
        'elite',
        'Drift Deity',
        'Bank 10,000,000 total drift points.',
        'pro',
        'totalDrift',
        10000000,
        1800
    ),
    a('pro_combo', 'elite', 'Combo God', 'Land a single drift worth 250,000.', 'pro', 'bestCombo', 250000, 1200),
    a('pro_marathon', 'elite', 'Iron Marathon', 'Drive 2,000 km in total.', 'pro', 'distanceKm', 2000, 1000),
    a('pro_dist_5000', 'elite', 'Earth Orbit', 'Drive 5,000 km in total.', 'pro', 'distanceKm', 5000, 2000),
    a('pro_world', 'elite', 'World Tour', 'Visit 40 different locations.', 'pro', 'spotCount', 40, 1000),
    a('pro_photo', 'elite', 'Elite Photographer', 'Capture 50 photos.', 'pro', 'photos', 50, 700),
    a('pro_streak', 'elite', 'Titanium Streak', 'Reach a 14 day streak.', 'pro', 'bestStreak', 14, 1000),
    a('pro_streak_30', 'elite', 'Diamond Streak', 'Reach a 30 day streak.', 'pro', 'bestStreak', 30, 2000),
    a('pro_dynasty', 'elite', 'Daily Dynasty', 'Complete 100 daily challenges.', 'pro', 'dailyDone', 100, 1500),
    a('pro_clean_25', 'elite', 'Untouchable', 'Drive 25 km without crash or reset.', 'pro', 'cleanDistanceKm', 25, 800),
    a('pro_level', 'elite', 'Grand Master', 'Reach level 50.', 'pro', 'level', 50, 1500),
    a('pro_level_75', 'elite', 'Supreme Pilot', 'Reach level 75.', 'pro', 'level', 75, 2200),
    a('pro_level_100', 'elite', 'GEO Immortal', 'Reach level 100.', 'pro', 'level', 100, 3000),
    a('pro_top10', 'elite', 'Hall of Fame', 'Reach the top 10 on any leaderboard.', 'pro', 'topRank10', 1, 1500)
];

export { ACHIEVEMENT_GROUPS };

/* --------------------------------------------------------------------------
   Persistent model
   -------------------------------------------------------------------------- */

function emptyStats() {
    return {
        totalDrift: 0,
        bestCombo: 0,
        banks: 0,
        topSpeed: 0,
        godTopSpeed: 0,
        distanceKm: 0,
        godKm: 0,
        playSeconds: 0,
        sessions: 0,
        photos: 0,
        spots: [],
        dailyDone: 0,
        weeklyDone: 0,
        bestStreak: 0,
        bestRank: 0,
        vehicleKm: { car: 0, truck: 0, bus: 0 },
        multiplier3Count: 0,
        multiplier5Count: 0,
        speedDistanceKm: 0,
        cleanDistanceKm: 0,
        nightSeconds: 0,
        rainSeconds: 0,
        radioSeconds: 0
    };
}

function emptyCounters() {
    return {
        driftPoints: 0,
        bestCombo: 0,
        banks: 0,
        distanceKm: 0,
        topSpeed: 0,
        spots: [],
        playSeconds: 0,
        photos: 0,
        highMultiplier: 0,
        speedDistanceKm: 0,
        cleanDistanceKm: 0,
        truckKm: 0,
        busKm: 0,
        nightSeconds: 0,
        rainSeconds: 0,
        radioSeconds: 0
    };
}

function createModel() {
    return {
        version: 1,
        playerId: uuid(),
        country: '',
        xp: 0,
        stats: emptyStats(),
        unlocked: {},
        notified: {},
        streak: { count: 0, last: '', freezeWeek: '' },
        daily: null,
        weekly: null,
        migrated: false,
        createdAt: Date.now()
    };
}

/** @type {ReturnType<typeof createModel>} */
let model = createModel();
let dirty = false;
let lastMoveAt = 0;
const listeners = new Set();

export function onProgressEvent(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

function emit(event) {
    listeners.forEach((fn) => {
        try {
            fn(event);
        } catch (err) {
            console.warn('Progress listener error:', err);
        }
    });
}

function isProNow() {
    return !!state.isPro;
}

export function guessCountry() {
    try {
        const locale = (typeof navigator !== 'undefined' && (navigator.language || navigator.languages?.[0])) || '';
        const region = locale.split('-')[1];
        if (region && COUNTRIES.some(([cc]) => cc === region.toUpperCase())) return region.toUpperCase();
    } catch {
        /* ignore */
    }
    return '';
}

export function loadProgress() {
    let parsed = null;
    try {
        if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) parsed = JSON.parse(raw);
        }
    } catch {
        parsed = null;
    }

    model = createModel();
    if (parsed && typeof parsed === 'object') {
        const fresh = createModel();
        model = {
            ...fresh,
            ...parsed,
            stats: {
                ...fresh.stats,
                ...(parsed.stats || {}),
                vehicleKm: { ...fresh.stats.vehicleKm, ...(parsed.stats?.vehicleKm || {}) },
                spots: Array.isArray(parsed.stats?.spots) ? parsed.stats.spots.slice(0, MAX_SPOTS_STORED) : []
            },
            unlocked: parsed.unlocked && typeof parsed.unlocked === 'object' ? parsed.unlocked : {},
            notified: parsed.notified && typeof parsed.notified === 'object' ? parsed.notified : {},
            streak: { ...fresh.streak, ...(parsed.streak || {}) },
            playerId:
                typeof parsed.playerId === 'string' && parsed.playerId.length >= 32 ? parsed.playerId : fresh.playerId
        };
    }

    if (!model.country) model.country = guessCountry();

    if (!model.migrated) {
        const s = model.stats;
        s.totalDrift = Math.max(s.totalDrift, Number(state.driftScore) || 0);
        s.distanceKm = Math.max(s.distanceKm, Number(state.totalDistanceKm) || 0);
        const legacySpeed = Number(state.topSpeedRecord) || 0;
        if (legacySpeed > 0 && legacySpeed <= 1000) {
            const k = legacySpeed <= 250 ? 'topSpeed' : 'godTopSpeed';
            s[k] = Math.max(s[k], legacySpeed);
        }
        model.migrated = true;
        dirty = true;
    }

    model.stats.sessions += 1;
    ensurePeriods();
    dirty = true;
    saveProgress();
    return model;
}

export function saveProgress() {
    if (!dirty) return;
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
        }
        dirty = false;
    } catch (err) {
        console.warn('Progress save failed:', err.message);
    }
}

/** Test helper: replace the in-memory model. */
export function resetProgressForTests() {
    model = createModel();
    dirty = false;
    lastMoveAt = 0;
    listeners.clear();
    ensurePeriods();
}

export function getModel() {
    return model;
}

/* --------------------------------------------------------------------------
   Periods (daily and weekly)
   -------------------------------------------------------------------------- */

export function ensurePeriods(now = Date.now()) {
    const dayKey = utcDayKey(now);
    const weekKey = isoWeekKey(now);
    if (!model.daily || model.daily.key !== dayKey) {
        model.daily = { key: dayKey, counters: emptyCounters(), items: buildPeriodItems('daily', dayKey) };
        dirty = true;
    }
    if (!model.weekly || model.weekly.key !== weekKey) {
        model.weekly = { key: weekKey, counters: emptyCounters(), items: buildPeriodItems('weekly', weekKey) };
        dirty = true;
    }
}

function counterValue(counters, metric) {
    if (metric === 'spots') return counters.spots?.length || 0;
    if (metric === 'playMinutes') return Math.floor((counters.playSeconds || 0) / 60) || counters.playMinutes || 0;
    if (metric === 'nightMinutes') return Math.floor((counters.nightSeconds || 0) / 60) || counters.nightMinutes || 0;
    if (metric === 'rainMinutes') return Math.floor((counters.rainSeconds || 0) / 60) || counters.rainMinutes || 0;
    if (metric === 'radioMinutes') return Math.floor((counters.radioSeconds || 0) / 60) || counters.radioMinutes || 0;
    if (metric === 'distanceKm') return Math.floor(counters.distanceKm || 0);
    if (metric === 'speedDistanceKm') return Math.floor(counters.speedDistanceKm || 0);
    if (metric === 'cleanDistanceKm') return Math.floor(counters.cleanDistanceKm || 0);
    if (metric === 'truckKm') return Math.floor(counters.truckKm || 0);
    if (metric === 'busKm') return Math.floor(counters.busKm || 0);
    return counters[metric] || 0;
}

export function challengeProgress(item, scope) {
    const period = scope === 'weekly' ? model.weekly : model.daily;
    const value = counterValue(period.counters, item.metric);
    return {
        value: Math.min(value, item.target),
        raw: value,
        pct: Math.min(100, Math.floor((value / item.target) * 100))
    };
}

/* --------------------------------------------------------------------------
   XP and streak
   -------------------------------------------------------------------------- */

export function currentStreak(now = Date.now()) {
    const { count, last, freezeWeek } = model.streak;
    if (!last || !count) return 0;
    const gap = dayNumber(utcDayKey(now)) - dayNumber(last);
    if (gap <= 1) return count;
    if (gap === 2 && isProNow() && freezeWeek !== isoWeekKey(now)) return count;
    return 0;
}

export function xpMultiplier(now = Date.now()) {
    const streakBonus = 1 + Math.min(currentStreak(now), 10) * 0.03;
    return (isProNow() ? PRO_XP_MULTIPLIER : 1) * streakBonus;
}

function grantXp(base, reason, { raw = false } = {}) {
    const amount = Math.max(0, Math.round(raw ? base : base * xpMultiplier()));
    if (!amount) return 0;
    const before = levelFromXp(model.xp).level;
    model.xp += amount;
    const after = levelFromXp(model.xp).level;
    dirty = true;
    emit({ type: 'xp', amount, reason });
    if (after > before) {
        emit({ type: 'level', level: after, title: titleForLevel(after) });
    }
    return amount;
}

function registerActiveDay(now) {
    const today = utcDayKey(now);
    const streak = model.streak;
    if (streak.last === today) return;
    if (!streak.last) {
        streak.count = 1;
    } else {
        const gap = dayNumber(today) - dayNumber(streak.last);
        if (gap === 1) {
            streak.count += 1;
        } else if (gap === 2 && isProNow() && streak.freezeWeek !== isoWeekKey(now)) {
            streak.freezeWeek = isoWeekKey(now);
            streak.count += 1;
            emit({ type: 'freeze' });
        } else {
            streak.count = 1;
        }
    }
    streak.last = today;
    model.stats.bestStreak = Math.max(model.stats.bestStreak, streak.count);
    dirty = true;
    emit({ type: 'streak', count: streak.count });
}

/* --------------------------------------------------------------------------
   Evaluation
   -------------------------------------------------------------------------- */

function evaluateChallenges(scope, now) {
    const period = scope === 'weekly' ? model.weekly : model.daily;
    period.items.forEach((item) => {
        if (item.status === 'claimed') return;
        const { raw } = challengeProgress(item, scope);
        const complete = raw >= item.target;
        if (!complete) return;

        if (item.bonus && !isProNow()) {
            if (item.status !== 'ready') {
                item.status = 'ready';
                dirty = true;
            }
            const key = `challenge:${item.id}`;
            if (!model.notified[key]) {
                model.notified[key] = true;
                emit({ type: 'proReady', kind: 'challenge', name: describeChallenge(item) });
            }
            return;
        }

        item.status = 'claimed';
        dirty = true;
        const awarded = grantXp(item.xp, `${scope}_challenge`);
        if (scope === 'daily') {
            model.stats.dailyDone += 1;
            registerActiveDay(now);
        } else {
            model.stats.weeklyDone += 1;
        }
        emit({ type: 'challenge', scope, item, xp: awarded, bonus: item.bonus });
    });
}

function metricValue(metric) {
    const s = model.stats;
    switch (metric) {
        case 'playHours':
            return s.playSeconds / 3600;
        case 'spotCount':
            return s.spots.length;
        case 'level':
            return levelFromXp(model.xp).level;
        case 'isProFlag':
            return isProNow() ? 1 : 0;
        case 'topRank10':
            return s.bestRank > 0 && s.bestRank <= 10 ? 1 : 0;
        case 'nightMinutes':
            return Math.floor((s.nightSeconds || 0) / 60);
        case 'rainMinutes':
            return Math.floor((s.rainSeconds || 0) / 60);
        case 'radioMinutes':
            return Math.floor((s.radioSeconds || 0) / 60);
        case 'truckKm':
            return Math.floor(s.vehicleKm?.truck || 0);
        case 'busKm':
            return Math.floor(s.vehicleKm?.bus || 0);
        case 'speedDistanceKm':
            return Math.floor(s.speedDistanceKm || 0);
        case 'cleanDistanceKm':
            return Math.floor(s.cleanDistanceKm || 0);
        case 'multiplier3Count':
            return Number(s.multiplier3Count) || 0;
        case 'multiplier5Count':
            return Number(s.multiplier5Count) || 0;
        default:
            return Number(s[metric]) || 0;
    }
}

export function achievementProgress(def) {
    const value = metricValue(def.metric);
    return {
        value: Math.min(value, def.target),
        raw: value,
        pct: Math.min(100, Math.floor((value / def.target) * 100))
    };
}

function evaluateAchievements() {
    ACHIEVEMENTS.forEach((def) => {
        if (model.unlocked[def.id]) return;
        const { raw } = achievementProgress(def);
        if (raw < def.target) return;

        if (def.tier === 'pro' && !isProNow()) {
            const key = `ach:${def.id}`;
            if (!model.notified[key]) {
                model.notified[key] = true;
                dirty = true;
                emit({ type: 'proReady', kind: 'achievement', name: def.name });
            }
            return;
        }

        model.unlocked[def.id] = Date.now();
        dirty = true;
        const awarded = grantXp(def.xp, 'achievement');
        emit({ type: 'achievement', def, xp: awarded });
    });
}

/** Re-evaluates all challenges and achievements. Safe to call often. */
export function evaluate(now = Date.now()) {
    ensurePeriods(now);
    evaluateChallenges('daily', now);
    evaluateChallenges('weekly', now);
    // Level based achievements depend on XP gained above, so evaluate achievements last.
    evaluateAchievements();
}

/* --------------------------------------------------------------------------
   Event tracking API
   -------------------------------------------------------------------------- */

function bothPeriods(fn) {
    fn(model.daily.counters);
    fn(model.weekly.counters);
}

export function trackDriftBank(points, multiplier = 1) {
    const earned = Math.max(0, Math.floor(points));
    if (!earned) return;
    ensurePeriods();
    const s = model.stats;
    s.totalDrift += earned;
    s.banks += 1;
    s.bestCombo = Math.max(s.bestCombo, earned);
    if (multiplier >= 3) {
        s.multiplier3Count = (s.multiplier3Count || 0) + 1;
    }
    if (multiplier >= 5) {
        s.multiplier5Count = (s.multiplier5Count || 0) + 1;
    }
    bothPeriods((c) => {
        c.driftPoints += earned;
        c.banks += 1;
        c.bestCombo = Math.max(c.bestCombo, earned);
        if (multiplier >= 3) {
            c.highMultiplier = (c.highMultiplier || 0) + 1;
        }
    });
    dirty = true;
    grantXp(Math.min(30, 4 + Math.floor(earned / 1500) + Math.floor(multiplier)), 'drift');
    evaluate();
}

/**
 * Cheap per-frame hook. Only accumulates counters; heavy evaluation happens in tick().
 * @param {number} km - Distance covered this frame in kilometers.
 * @param {number} kmh - Current speed in km/h.
 * @param {string} vehicle - Active vehicle id.
 * @param {boolean} god - True while the God Mode ghost vehicle is active.
 */
export function trackFrame(km, kmh, vehicle, god) {
    if (!model.daily) return;
    const s = model.stats;
    if (kmh > 5) lastMoveAt = Date.now();

    if (km > 0) {
        if (god) {
            s.godKm += km;
        } else {
            s.distanceKm += km;
            if (s.vehicleKm[vehicle] !== undefined) s.vehicleKm[vehicle] += km;
            s.cleanDistanceKm = (s.cleanDistanceKm || 0) + km;
            if (kmh >= 120) {
                s.speedDistanceKm = (s.speedDistanceKm || 0) + km;
            }
            bothPeriods((c) => {
                c.distanceKm += km;
                c.cleanDistanceKm = (c.cleanDistanceKm || 0) + km;
                if (kmh >= 120) {
                    c.speedDistanceKm = (c.speedDistanceKm || 0) + km;
                }
                if (vehicle === 'truck') {
                    c.truckKm = (c.truckKm || 0) + km;
                } else if (vehicle === 'bus') {
                    c.busKm = (c.busKm || 0) + km;
                }
            });
        }
        dirty = true;
    }

    const lim = god ? 1000 : 250;
    const v = Math.min(lim, kmh);
    const key = god ? 'godTopSpeed' : 'topSpeed';
    if (v > s[key]) {
        s[key] = v;
        dirty = true;
    }
    if (!god)
        bothPeriods((c) => {
            if (v > c.topSpeed) c.topSpeed = v;
        });
}

export function trackSpot(name) {
    const clean = String(name || '')
        .trim()
        .slice(0, 60);
    if (!clean) return;
    ensurePeriods();
    const s = model.stats;
    const isNewLifetime = !s.spots.includes(clean);
    if (isNewLifetime && s.spots.length < MAX_SPOTS_STORED) s.spots.push(clean);
    let isNewToday = false;
    bothPeriods((c) => {
        if (!c.spots.includes(clean)) {
            c.spots.push(clean);
            if (c === model.daily.counters) isNewToday = true;
        }
    });
    dirty = true;
    if (isNewLifetime) grantXp(12, 'new_location');
    else if (isNewToday) grantXp(3, 'location');
    evaluate();
}

export function trackPhoto() {
    ensurePeriods();
    model.stats.photos += 1;
    bothPeriods((c) => {
        c.photos += 1;
    });
    dirty = true;
    grantXp(6, 'photo');
    evaluate();
}

/** Called once per second by the UI. Counts active driving time and evaluates progress. */
export function tick(isRunning, now = Date.now()) {
    ensurePeriods(now);
    const active = isRunning && now - lastMoveAt < 20000;
    if (active) {
        model.stats.playSeconds += 1;
        bothPeriods((c) => {
            c.playSeconds += 1;
        });

        // Atmospheric & audio counters
        if (state.lightPreset === 'night' || state.lightPreset === 'dusk') {
            model.stats.nightSeconds = (model.stats.nightSeconds || 0) + 1;
            bothPeriods((c) => {
                c.nightSeconds = (c.nightSeconds || 0) + 1;
            });
        }
        if (state.isRaining || state.weatherPreset === 'rain' || state.weatherPreset === 'storm') {
            model.stats.rainSeconds = (model.stats.rainSeconds || 0) + 1;
            bothPeriods((c) => {
                c.rainSeconds = (c.rainSeconds || 0) + 1;
            });
        }
        if (state.isRadioPlaying || state.radioPlaying) {
            model.stats.radioSeconds = (model.stats.radioSeconds || 0) + 1;
            bothPeriods((c) => {
                c.radioSeconds = (c.radioSeconds || 0) + 1;
            });
        }

        dirty = true;
        if (model.stats.playSeconds % 60 === 0) grantXp(5, 'play_time');
    }
    evaluate(now);
    saveProgress();
}

export function trackReset() {
    if (!model?.stats) return;
    model.stats.cleanDistanceKm = 0;
    if (model.daily?.counters) model.daily.counters.cleanDistanceKm = 0;
    if (model.weekly?.counters) model.weekly.counters.cleanDistanceKm = 0;
    dirty = true;
}

export function noteLeaderboardRank(rank) {
    if (!rank || rank < 1) return;
    const s = model.stats;
    if (!s.bestRank || rank < s.bestRank) {
        s.bestRank = rank;
        dirty = true;
        evaluate();
    }
}

export function setCountry(code) {
    const cc = String(code || '').toUpperCase();
    model.country = COUNTRIES.some(([c]) => c === cc) ? cc : '';
    dirty = true;
    saveProgress();
}

/* --------------------------------------------------------------------------
   Read models for UI and network
   -------------------------------------------------------------------------- */

export function getScorePayload(now = Date.now()) {
    ensurePeriods(now);
    const s = model.stats;
    const speedScore = Math.max(Math.min(250, s.topSpeed || 0), Math.min(1000, s.godTopSpeed || 0));
    const rows = [
        { board: 'drift', period: 'all', score: s.bestCombo },
        { board: 'speed', period: 'all', score: speedScore },
        { board: 'daily', period: model.daily.key, score: model.daily.counters.driftPoints },
        { board: 'weekly', period: model.weekly.key, score: model.weekly.counters.driftPoints }
    ];
    return rows.filter((r) => r.score > 0).map((r) => ({ ...r, score: Math.floor(r.score) }));
}

export function getIdentity() {
    return {
        playerId: model.playerId,
        country: model.country,
        level: levelFromXp(model.xp).level,
        xp: Math.floor(model.xp)
    };
}

export function getSnapshot(now = Date.now()) {
    ensurePeriods(now);
    const lvl = levelFromXp(model.xp);
    const mapItems = (scope) =>
        (scope === 'weekly' ? model.weekly : model.daily).items.map((item) => ({
            ...item,
            label: describeChallenge(item),
            progress: challengeProgress(item, scope)
        }));
    const achievements = ACHIEVEMENTS.map((def) => {
        const prog = achievementProgress(def);
        const unlocked = !!model.unlocked[def.id];
        let status = 'locked';
        if (unlocked) status = 'unlocked';
        else if (prog.raw >= def.target && def.tier === 'pro') status = 'pro_ready';
        return { ...def, progress: prog, unlockedAt: model.unlocked[def.id] || 0, status };
    });
    return {
        playerId: model.playerId,
        country: model.country,
        xp: Math.floor(model.xp),
        level: lvl,
        title: titleForLevel(lvl.level),
        multiplier: xpMultiplier(now),
        streak: currentStreak(now),
        bestStreak: model.stats.bestStreak,
        stats: model.stats,
        daily: { key: model.daily.key, items: mapItems('daily'), resetsInMs: msUntilNextDay(now) },
        weekly: { key: model.weekly.key, items: mapItems('weekly'), resetsInMs: msUntilNextWeek(now) },
        achievements,
        unlockedCount: achievements.filter((x) => x.status === 'unlocked').length,
        isPro: isProNow()
    };
}
