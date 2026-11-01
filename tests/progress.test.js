import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../js/state.js';
import {
    ACHIEVEMENTS,
    CHALLENGE_CATALOG,
    achievementProgress,
    currentStreak,
    ensurePeriods,
    evaluate,
    exportCloudPayload,
    getModel,
    getScorePayload,
    getSnapshot,
    isoWeekKey,
    levelFromXp,
    mergeCloudPayload,
    msUntilNextDay,
    msUntilNextWeek,
    onProgressEvent,
    resetProgressForTests,
    tick,
    titleForLevel,
    trackDriftBank,
    trackFrame,
    trackPhoto,
    trackSpot,
    utcDayKey,
    xpForLevel
} from '../js/progress.js';

function freshPlayer(isPro = false) {
    state.isPro = isPro;
    resetProgressForTests();
    const events = [];
    onProgressEvent((e) => events.push(e));
    return events;
}

test('levelFromXp and xpForLevel are consistent and monotonic', () => {
    assert.equal(levelFromXp(0).level, 1);
    let prev = 0;
    for (let l = 1; l <= 100; l++) {
        const need = xpForLevel(l);
        assert.ok(need >= prev);
        prev = need;
        assert.equal(levelFromXp(need).level, l);
        if (l > 1) assert.equal(levelFromXp(need - 1).level, l - 1);
    }
    assert.equal(levelFromXp(1e9).level, 100);
    assert.equal(levelFromXp(1e9).pct, 100);
    assert.equal(titleForLevel(1), 'Rookie');
    assert.equal(titleForLevel(10), 'Drifter');
    assert.equal(titleForLevel(100), 'GEO Immortal');
});

test('period keys match server format and reset timers are positive', () => {
    const t = Date.UTC(2026, 10, 1, 12, 0, 0);
    assert.equal(utcDayKey(t), '2026-11-01');
    assert.match(isoWeekKey(t), /^\d{4}-W\d{2}$/);
    assert.equal(isoWeekKey(Date.UTC(2026, 0, 1)), '2026-W01');
    assert.equal(isoWeekKey(Date.UTC(2021, 0, 3)), '2020-W53');
    assert.ok(msUntilNextDay(t) > 0 && msUntilNextDay(t) <= 86400000);
    assert.ok(msUntilNextWeek(t) > 0 && msUntilNextWeek(t) <= 7 * 86400000);
});

test('daily and weekly challenges are deterministic with unique metrics and a pro bonus', () => {
    freshPlayer();
    const a = getSnapshot(Date.UTC(2026, 10, 1, 8));
    resetProgressForTests();
    ensurePeriods(Date.UTC(2026, 10, 1, 8));
    const b = getSnapshot(Date.UTC(2026, 10, 1, 8));
    assert.deepEqual(
        a.daily.items.map((i) => i.id),
        b.daily.items.map((i) => i.id)
    );
    for (const scope of ['daily', 'weekly']) {
        const items = a[scope].items;
        assert.equal(items.length, 4);
        assert.equal(items.filter((i) => i.bonus).length, 1);
        assert.equal(new Set(items.map((i) => i.metric)).size, 4);
        items.forEach((i) => {
            assert.ok(i.target > 0 && i.xp > 0);
            assert.ok(CHALLENGE_CATALOG.some((c) => c.metric === i.metric));
        });
    }
});

test('banking drifts grants xp, updates stats and scores payload', () => {
    const events = freshPlayer();
    trackDriftBank(8000, 3);
    const snap = getSnapshot();
    assert.equal(snap.stats.totalDrift, 8000);
    assert.equal(snap.stats.bestCombo, 8000);
    assert.equal(snap.stats.banks, 1);
    assert.ok(snap.xp > 0);
    assert.ok(events.some((e) => e.type === 'xp'));
    assert.ok(events.some((e) => e.type === 'achievement' && e.def.id === 'first_drift'));
    const payload = getScorePayload();
    assert.ok(payload.find((p) => p.board === 'drift' && p.period === 'all' && p.score === 8000));
    assert.ok(payload.find((p) => p.board === 'daily' && p.score === 8000));
    assert.ok(payload.find((p) => p.board === 'weekly' && p.score === 8000));
    assert.ok(!payload.find((p) => p.board === 'speed'));
});

test('god mode distance and speed never count toward road records', () => {
    freshPlayer(true);
    trackFrame(0.01, 900, 'god', true);
    trackFrame(0.01, 120, 'car', false);
    const s = getModel().stats;
    assert.equal(s.godTopSpeed, 900);
    assert.equal(s.topSpeed, 120);
    assert.ok(Math.abs(s.godKm - 0.01) < 1e-9);
    assert.ok(Math.abs(s.distanceKm - 0.01) < 1e-9);
    const payload = getScorePayload();
    const speedEntry = payload.find((p) => p.board === 'speed');
    assert.equal(speedEntry.score, 900);
});

test('free players cannot claim the pro bonus challenge or pro achievements, pro players can', () => {
    const events = freshPlayer(false);
    const bonus = getModel().daily.items.find((i) => i.bonus);
    bonus.target = 1;
    const metric = bonus.metric;
    // Satisfy the bonus metric directly through the daily counters.
    const c = getModel().daily.counters;
    if (metric === 'spots') c.spots.push('A');
    else if (metric === 'playMinutes') c.playSeconds = 600;
    else c[metric] = 5;
    evaluate();
    assert.equal(bonus.status, 'ready');
    assert.ok(events.some((e) => e.type === 'proReady' && e.kind === 'challenge'));

    const proAch = ACHIEVEMENTS.find((x) => x.id === 'pro_marathon');
    getModel().stats.distanceKm = 5000;
    evaluate();
    assert.equal(getModel().unlocked[proAch.id], undefined);
    assert.ok(events.some((e) => e.type === 'proReady' && e.kind === 'achievement'));
    assert.equal(getSnapshot().achievements.find((x) => x.id === proAch.id).status, 'pro_ready');

    state.isPro = true;
    evaluate();
    assert.equal(bonus.status, 'claimed');
    assert.ok(getModel().unlocked[proAch.id]);
    assert.equal(achievementProgress(proAch).pct, 100);
    state.isPro = false;
});

test('completing a daily challenge starts a streak and pro xp is boosted', () => {
    freshPlayer(false);
    const easy = getModel().daily.items[0];
    const c = getModel().daily.counters;
    const fill = (item) => {
        if (item.metric === 'spots') for (let i = 0; i < item.target; i++) c.spots.push(`S${i}`);
        else if (item.metric === 'playMinutes') c.playSeconds = item.target * 60;
        else c[item.metric] = item.target;
    };
    fill(easy);
    evaluate();
    assert.equal(easy.status, 'claimed');
    assert.equal(getSnapshot().streak, 1);
    assert.equal(getModel().stats.dailyDone, 1);

    freshPlayer(false);
    const freeMult = getSnapshot().multiplier;
    state.isPro = true;
    assert.ok(getSnapshot().multiplier > freeMult * 1.4);
    state.isPro = false;
});

test('streak freeze only applies to pro players once per week', () => {
    freshPlayer(true);
    const m = getModel();
    const now = Date.UTC(2026, 10, 4, 12);
    m.streak = { count: 5, last: utcDayKey(now - 2 * 86400000), freezeWeek: '' };
    assert.equal(currentStreak(now), 5);
    m.streak.freezeWeek = isoWeekKey(now);
    assert.equal(currentStreak(now), 0);
    state.isPro = false;
    m.streak.freezeWeek = '';
    assert.equal(currentStreak(now), 0);
    m.streak.last = utcDayKey(now - 86400000);
    assert.equal(currentStreak(now), 5);
});

test('spots and photos are tracked, tick counts only active driving time', () => {
    freshPlayer();
    trackSpot('Tokyo');
    trackSpot('Tokyo');
    trackSpot('Monaco');
    trackPhoto();
    const s = getModel().stats;
    assert.deepEqual(s.spots, ['Tokyo', 'Monaco']);
    assert.equal(s.photos, 1);

    const before = s.playSeconds;
    tick(true); // no recent movement, so no time counted
    assert.equal(s.playSeconds, before);
    trackFrame(0.001, 80, 'car', false);
    tick(true);
    assert.equal(s.playSeconds, before + 1);
    tick(false);
    assert.equal(s.playSeconds, before + 1);
});

test('cloud payload export and smart merge preserves highest stats across devices', () => {
    freshPlayer();
    const m = getModel();
    m.xp = 1200;
    m.stats.km = 45;
    m.stats.bestDrift = 1800;
    m.stats.spots = ['Tokyo'];
    m.unlocked = { first_km: 1000 };

    const remotePayload = {
        xp: 3500,
        country: 'RS',
        stats: {
            km: 120,
            bestDrift: 900,
            topSpeed: 290,
            spots: ['Monaco', 'Belgrade'],
            vehicleKm: { car: 80 }
        },
        unlocked: { speed_200: 2000 },
        streak: { count: 4, last: '2026-11-01', freezeWeek: '' },
        prefs: {
            playerName: 'Milan_RS',
            activeVehicle: 'truck',
            unit: 'km'
        }
    };

    const merged = mergeCloudPayload(remotePayload, '11111111-2222-4333-8444-555555555555');
    assert.ok(merged.model.xp >= 3500);
    assert.equal(merged.model.stats.km, 120);
    assert.equal(merged.model.stats.bestDrift, 1800);
    assert.equal(merged.model.stats.topSpeed, 290);
    assert.equal(merged.model.stats.vehicleKm.car, 80);
    assert.deepEqual(merged.model.stats.spots.sort(), ['Belgrade', 'Monaco', 'Tokyo']);
    assert.ok(merged.model.unlocked.first_km);
    assert.ok(merged.model.unlocked.speed_200);
    assert.equal(merged.prefs.playerName, 'Milan_RS');
    assert.equal(getModel().playerId, '11111111-2222-4333-8444-555555555555');
});
