import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ClockSync,
    angleDelta,
    createBuffer,
    pushSample,
    sampleBuffer,
    BUFFER_SIZE,
    MAX_EXTRAPOLATION_MS
} from '../js/mp-interp.js';

function linearBuffer() {
    const buf = createBuffer();
    for (let t = 0; t <= 150; t += 50) {
        pushSample(buf, { time: t, lng: t * 1e-5, lat: 44 + t * 2e-5, bearing: 90, speed: 0.1, steer: 0, flags: 0 });
    }
    return buf;
}

test('angleDelta returns the shortest signed rotation', () => {
    assert.strictEqual(angleDelta(350, 10), 20);
    assert.strictEqual(angleDelta(10, 350), -20);
    assert.strictEqual(angleDelta(0, 180), 180);
    assert.strictEqual(angleDelta(90, 90), 0);
});

test('ClockSync computes the server offset from a symmetric ping', () => {
    const clock = new ClockSync();
    // Server clock runs 4000 ms ahead, one way latency 20 ms.
    clock.addSample(1000, 5020, 1040);
    assert.strictEqual(clock.offset, 4000);
    assert.strictEqual(clock.rtt, 40);
    assert.strictEqual(clock.serverNow(2000), 6000);
    assert.strictEqual(clock.synced, true);
});

test('ClockSync ignores latency spikes by preferring low RTT samples', () => {
    const clock = new ClockSync();
    clock.addSample(0, 4020, 40);
    clock.addSample(100, 4120, 140);
    clock.addSample(200, 4520, 1200); // congested sample with a skewed offset
    clock.addSample(300, 4320, 340);
    assert.ok(Math.abs(clock.offset - 4000) <= 20);
    assert.strictEqual(clock.rtt, 40);
});

test('sampleBuffer interpolates exactly on a straight constant velocity path', () => {
    const s = sampleBuffer(linearBuffer(), 75);
    assert.ok(Math.abs(s.lng - 75e-5) < 1e-9);
    assert.ok(Math.abs(s.lat - (44 + 75 * 2e-5)) < 1e-9);
    assert.strictEqual(s.extrapolated, false);
});

test('sampleBuffer interpolates bearing along the shortest arc across north', () => {
    const buf = createBuffer();
    pushSample(buf, { time: 0, lng: 0, lat: 0, bearing: 350, speed: 0, steer: 0, flags: 0 });
    pushSample(buf, { time: 100, lng: 0, lat: 0, bearing: 10, speed: 0, steer: 0, flags: 0 });
    pushSample(buf, { time: 200, lng: 0, lat: 0, bearing: 30, speed: 0, steer: 0, flags: 0 });
    const s = sampleBuffer(buf, 50);
    assert.ok(Math.abs(s.bearing - 0) < 0.001 || Math.abs(s.bearing - 360) < 0.001);
});

test('sampleBuffer extrapolates late packets but caps the time and distance', () => {
    const buf = linearBuffer();
    const near = sampleBuffer(buf, 200);
    assert.strictEqual(near.extrapolated, true);
    assert.ok(near.lng > 150e-5);

    const far = sampleBuffer(buf, 150 + 60000);
    const maxTravel = 1e-5 * MAX_EXTRAPOLATION_MS;
    assert.ok(far.lng - 150e-5 <= maxTravel + 1e-9);
});

test('sampleBuffer holds the first pose when render time precedes all samples', () => {
    const s = sampleBuffer(linearBuffer(), -500);
    assert.strictEqual(s.lng, 0);
});

test('pushSample drops reordered duplicates, bounds the size and clears on teleport', () => {
    const buf = createBuffer();
    pushSample(buf, { time: 100, lng: 1, lat: 1, bearing: 0 });
    pushSample(buf, { time: 90, lng: 2, lat: 2, bearing: 0 }); // older, ignored
    pushSample(buf, { time: 100, lng: 3, lat: 3, bearing: 0 }); // duplicate, ignored
    assert.strictEqual(buf.samples.length, 1);

    for (let i = 1; i <= BUFFER_SIZE + 5; i++) pushSample(buf, { time: 100 + i, lng: i, lat: i, bearing: 0 });
    assert.strictEqual(buf.samples.length, BUFFER_SIZE);

    pushSample(buf, { time: 5000, lng: 50, lat: 50, bearing: 0, teleport: true });
    assert.strictEqual(buf.samples.length, 1);
    assert.strictEqual(sampleBuffer(buf, 5000).lng, 50);
});

test('sampleBuffer returns null for an empty buffer', () => {
    assert.strictEqual(sampleBuffer(createBuffer(), 10), null);
});
