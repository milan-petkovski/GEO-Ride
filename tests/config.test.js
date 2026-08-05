import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_CENTER, INITIAL_ZOOM, VEHICLE_CONFIG, PERFORMANCE_PROFILE, AIR_DRAG_FACTOR } from '../js/config.js';

test('config - verifies initial center and zoom constants', () => {
    assert.strictEqual(Array.isArray(INITIAL_CENTER), true);
    assert.strictEqual(INITIAL_CENTER.length, 2);
    assert.strictEqual(typeof INITIAL_CENTER[0], 'number');
    assert.strictEqual(typeof INITIAL_CENTER[1], 'number');
    assert.strictEqual(INITIAL_ZOOM, 18);
});

test('config - vehicle specifications integrity', () => {
    const requiredKeys = ['car', 'truck', 'bus', 'god'];
    requiredKeys.forEach((key) => {
        assert.strictEqual(key in VEHICLE_CONFIG, true);
        const spec = VEHICLE_CONFIG[key];
        assert.strictEqual(typeof spec.power, 'number');
        assert.strictEqual(typeof spec.brake, 'number');
        assert.strictEqual(typeof spec.maxSpeed, 'number');
        assert.strictEqual(typeof spec.svg, 'string');
    });
});

test('config - performance profile structure', () => {
    assert.strictEqual(typeof PERFORMANCE_PROFILE, 'object');
    assert.strictEqual(typeof PERFORMANCE_PROFILE.tier, 'string');
    assert.strictEqual(typeof PERFORMANCE_PROFILE.lowEnd, 'boolean');
    assert.strictEqual(typeof PERFORMANCE_PROFILE.cores, 'number');
});

test('config - named physics constants present', () => {
    assert.strictEqual(typeof AIR_DRAG_FACTOR, 'number');
    assert.strictEqual(AIR_DRAG_FACTOR > 0 && AIR_DRAG_FACTOR < 1, true);
});
