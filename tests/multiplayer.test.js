import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePlayerPayload, cleanupInactivePlayers, getRoomTopic } from '../js/multiplayer.js';

test('sanitizePlayerPayload - valid payload', () => {
    const raw = {
        id: 'p_1234',
        lng: 20.45,
        lat: 44.81,
        bearing: 180,
        v: 45.5,
        vehicle: 'sports'
    };
    const sanitized = sanitizePlayerPayload(raw);
    assert.notStrictEqual(sanitized, null);
    assert.strictEqual(sanitized.id, 'p_1234');
    assert.strictEqual(sanitized.lng, 20.45);
    assert.strictEqual(sanitized.lat, 44.81);
    assert.strictEqual(sanitized.bearing, 180);
    assert.strictEqual(sanitized.v, 45.5);
    assert.strictEqual(sanitized.vehicle, 'sports');
});

test('sanitizePlayerPayload - invalid coordinates and malformed payload', () => {
    assert.strictEqual(sanitizePlayerPayload(null), null);
    assert.strictEqual(sanitizePlayerPayload('invalid'), null);
    assert.strictEqual(sanitizePlayerPayload({ id: 'x', lng: 999, lat: 44.81 }), null); // Out of bounds lng
    assert.strictEqual(sanitizePlayerPayload({ id: 'x', lng: 20.45, lat: -100 }), null); // Out of bounds lat
});

test('getRoomTopic - topic formatting and sanitization', () => {
    assert.strictEqual(getRoomTopic(null), 'georide/global/pro');
    assert.strictEqual(getRoomTopic(''), 'georide/global/pro');
    assert.strictEqual(getRoomTopic('ROOM123'), 'georide/room/room123');
    assert.strictEqual(getRoomTopic('   my_room!!  '), 'georide/room/my_room');
});

test('cleanupInactivePlayers - removes stale players', () => {
    const now = 100000;
    const players = {
        active: { lastSeen: now - 5000 },
        stale: { lastSeen: now - 35000, marker2d: { removed: false, remove() { this.removed = true; } } }
    };

    const removedList = [];
    cleanupInactivePlayers(players, (p) => {
        if (p.marker2d) p.marker2d.remove();
        removedList.push(p);
    }, 30000, now);

    assert.strictEqual(Object.keys(players).length, 1);
    assert.strictEqual('active' in players, true);
    assert.strictEqual('stale' in players, false);
    assert.strictEqual(removedList.length, 1);
    assert.strictEqual(removedList[0].marker2d.removed, true);
});
