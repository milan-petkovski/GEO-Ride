import test from 'node:test';
import assert from 'node:assert/strict';

process.env.VITE_SUPABASE_URL = 'https://example-project.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';

const { state } = await import('../js/state.js');
const progress = await import('../js/progress.js');
const lb = await import('../js/leaderboard.js');

function mockFetch(handler) {
    const calls = [];
    globalThis.fetch = async (url, opts) => {
        const body = JSON.parse(opts.body);
        calls.push({ url, body });
        return { ok: true, json: async () => handler(url, body) };
    };
    return calls;
}

test('periodForBoard maps boards to server period keys', () => {
    const t = Date.UTC(2026, 10, 1);
    assert.equal(lb.periodForBoard('daily', t), '2026-11-01');
    assert.match(lb.periodForBoard('weekly', t), /^\d{4}-W\d{2}$/);
    assert.equal(lb.periodForBoard('drift'), 'all');
    assert.equal(lb.periodForBoard('speed'), 'all');
});

test('submitProgress sends bests, withholds email for free players and skips unchanged payloads', async () => {
    state.isPro = false;
    state.playerName = 'Tester';
    progress.resetProgressForTests();
    progress.trackDriftBank(7000, 2);

    const calls = mockFetch(() => ({ ok: true, saved: 3, is_pro: false }));
    assert.equal(await lb.submitProgress({ force: true }), true);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /rpc\/georide_submit_score$/);
    assert.equal(calls[0].body.p_name, 'Tester');
    assert.equal(calls[0].body.p_email, null);
    assert.ok(calls[0].body.p_scores.some((s) => s.board === 'drift' && s.score === 7000));

    // Same payload and inside the throttle window: nothing is sent.
    assert.equal(await lb.submitProgress(), false);
    assert.equal(calls.length, 1);
});

test('fetchLeaderboard normalizes data, blends with seeds, caches responses and falls back to global without a country', async () => {
    progress.resetProgressForTests();
    progress.setCountry('');
    const calls = mockFetch(() => ({
        entries: [{ rank: 1, name: 'RealPlayerA', score: 250000, is_me: false }],
        me: null,
        total: 1
    }));
    const first = await lb.fetchLeaderboard({ board: 'drift', scope: 'country', limit: 10 });
    assert.equal(first.entries.length, 10);
    assert.ok(
        first.entries.some((e) => e.name === 'RealPlayerA'),
        'Real player must be included in blended entries'
    );
    assert.equal(calls[0].body.p_scope, 'global');
    await lb.fetchLeaderboard({ board: 'drift', scope: 'country', limit: 10 });
    assert.equal(calls.length, 1, 'second call served from cache');

    // When backend returns error, seamlessly fall back to realistic seed pilots
    globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
    const fallback = await lb.fetchLeaderboard({ board: 'speed', scope: 'global', limit: 10 });
    assert.equal(fallback.entries.length, 10, 'Fallback generates full seed roster');
    assert.equal(fallback.offline, false);
    assert.ok(fallback.total >= 10);
    fallback.entries.forEach((e) => {
        assert.ok(e.score <= 1000, `Top speed score ${e.score} must not exceed 1000 km/h`);
        if (!e.is_pro) {
            assert.ok(e.score <= 250, `Non-pro top speed score ${e.score} must not exceed 250 km/h`);
        }
    });
});
