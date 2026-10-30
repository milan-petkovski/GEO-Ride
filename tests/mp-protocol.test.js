import test from 'node:test';
import assert from 'node:assert/strict';
import {
    MSG_STATE,
    FLAG_DRIFT,
    FLAG_TELEPORT,
    STATE_PACKET_BYTES,
    encodeState,
    decodeState,
    encodeSnapshotRecord,
    buildSnapshot,
    decodeSnapshot,
    sanitizeRoomCode,
    sanitizePlayerName,
    vehicleToId,
    idToVehicle
} from '../js/mp-protocol.js';

const sample = {
    seq: 70000,
    lng: 20.4633123,
    lat: 44.8176456,
    bearing: 359.5,
    speed: 0.4167,
    steer: -0.8,
    flags: FLAG_DRIFT | FLAG_TELEPORT,
    vehicle: 'truck'
};

test('encodeState produces an 18 byte packet and decodeState restores values with centimetre precision', () => {
    const buf = encodeState(sample);
    assert.strictEqual(buf.byteLength, STATE_PACKET_BYTES);
    assert.strictEqual(new DataView(buf).getUint8(0), MSG_STATE);

    const out = decodeState(buf);
    assert.strictEqual(out.seq, 70000 & 0xffff);
    assert.ok(Math.abs(out.lng - sample.lng) < 1e-7);
    assert.ok(Math.abs(out.lat - sample.lat) < 1e-7);
    assert.ok(Math.abs(out.bearing - sample.bearing) < 0.01);
    assert.ok(Math.abs(out.speed - sample.speed) < 0.0001);
    assert.ok(Math.abs(out.steer - sample.steer) < 0.03);
    assert.strictEqual(out.flags, FLAG_DRIFT | FLAG_TELEPORT);
    assert.strictEqual(out.vehicle, 'truck');
});

test('decodeState rejects malformed, wrong sized and out of range packets', () => {
    assert.strictEqual(decodeState(null), null);
    assert.strictEqual(decodeState(new ArrayBuffer(5)), null);
    const wrongType = new Uint8Array(STATE_PACKET_BYTES);
    wrongType[0] = 9;
    assert.strictEqual(decodeState(wrongType), null);

    // Longitude beyond 180 degrees cannot be produced by encodeState (it clamps) so craft it manually.
    const bad = new DataView(encodeState(sample));
    bad.setInt32(3, 2000000000);
    assert.strictEqual(decodeState(bad.buffer), null);
});

test('encodeState clamps extreme input instead of overflowing', () => {
    const out = decodeState(encodeState({ ...sample, lng: 999, lat: -999, speed: 50, steer: 99, bearing: -90 }));
    assert.strictEqual(out.lng, 180);
    assert.strictEqual(out.lat, -90);
    assert.ok(out.speed <= 3.2);
    assert.ok(out.steer <= 3.01);
    assert.ok(Math.abs(out.bearing - 270) < 0.01);
});

test('snapshot builds and decodes multiple player records with slots', () => {
    const recs = [
        encodeSnapshotRecord(3, { ...sample, seq: 1 }),
        encodeSnapshotRecord(9, { ...sample, seq: 2, vehicle: 'bus' })
    ];
    const snap = decodeSnapshot(buildSnapshot(1234567.5, recs));
    assert.strictEqual(snap.time, 1234567.5);
    assert.strictEqual(snap.players.length, 2);
    assert.strictEqual(snap.players[0].slot, 3);
    assert.strictEqual(snap.players[1].slot, 9);
    assert.strictEqual(snap.players[1].vehicle, 'bus');
});

test('decodeSnapshot rejects truncated or inconsistent messages', () => {
    const good = buildSnapshot(1, [encodeSnapshotRecord(1, sample)]);
    assert.strictEqual(decodeSnapshot(good.slice(0, good.length - 3)), null);
    assert.strictEqual(decodeSnapshot(new ArrayBuffer(3)), null);
    assert.strictEqual(decodeSnapshot('text'), null);
});

test('sanitizers normalize room codes, names and vehicle ids', () => {
    assert.strictEqual(sanitizeRoomCode('  My Room!! 42 '), 'myroom42');
    assert.strictEqual(sanitizeRoomCode(5), '');
    assert.strictEqual(sanitizeRoomCode('x'.repeat(100)).length, 24);
    assert.strictEqual(sanitizePlayerName('<script>Bob</script>'), 'scriptBobscript');
    assert.strictEqual(sanitizePlayerName(null), '');
    assert.strictEqual(vehicleToId('unknown'), 0);
    assert.strictEqual(idToVehicle(99), 'car');
    assert.strictEqual(idToVehicle(vehicleToId('god')), 'god');
});
