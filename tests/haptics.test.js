import test from 'node:test';
import assert from 'node:assert/strict';
import { haptics } from '../js/haptics.js';

test('haptics isSupported returns boolean', () => {
    const supported = haptics.isSupported();
    assert.strictEqual(typeof supported, 'boolean');
});

test('haptics functions handle non-supported devices safely', () => {
    assert.doesNotThrow(() => haptics.tap());
    assert.doesNotThrow(() => haptics.doubleTap());
    assert.doesNotThrow(() => haptics.success());
    assert.doesNotThrow(() => haptics.warning());
    assert.doesNotThrow(() => haptics.error());
    assert.doesNotThrow(() => haptics.accelerate());
    assert.doesNotThrow(() => haptics.brake());
    assert.doesNotThrow(() => haptics.drift());
    assert.doesNotThrow(() => haptics.impact('light'));
    assert.doesNotThrow(() => haptics.impact('strong'));
    assert.doesNotThrow(() => haptics.select());
    assert.doesNotThrow(() => haptics.stop());
    assert.doesNotThrow(() => haptics.custom([50, 50]));
});

test('haptics vendor prefix detection and vibration pattern delivery', () => {
    let vibratedPattern = null;
    const mockVibrate = (pattern) => {
        vibratedPattern = pattern;
    };

    const origNav = globalThis.navigator;
    const prefixes = ['vibrate', 'mozVibrate', 'webkitVibrate', 'msVibrate'];

    prefixes.forEach((pref) => {
        vibratedPattern = null;
        Object.defineProperty(globalThis, 'navigator', {
            value: { [pref]: mockVibrate },
            configurable: true,
            writable: true
        });

        assert.strictEqual(haptics.isSupported(), true);
        assert.strictEqual(typeof haptics.getVibrationFunction(), 'function');

        haptics.tap();
        assert.strictEqual(vibratedPattern, 30);

        haptics.doubleTap();
        assert.deepEqual(vibratedPattern, [40, 30, 40]);

        haptics.success();
        assert.deepEqual(vibratedPattern, [30, 20, 60]);

        haptics.warning();
        assert.deepEqual(vibratedPattern, [60, 30, 60]);

        haptics.error();
        assert.deepEqual(vibratedPattern, [100, 50, 100]);

        haptics.accelerate();
        assert.deepEqual(vibratedPattern, [40]);

        haptics.brake();
        assert.deepEqual(vibratedPattern, [60]);

        haptics.drift();
        assert.deepEqual(vibratedPattern, [30, 20, 30, 20, 30]);

        haptics.impact('medium');
        assert.deepEqual(vibratedPattern, [80]);

        haptics.select();
        assert.deepEqual(vibratedPattern, [20]);

        haptics.stop();
        assert.strictEqual(vibratedPattern, 0);

        haptics.custom([10, 20, 30]);
        assert.deepEqual(vibratedPattern, [10, 20, 30]);
    });

    Object.defineProperty(globalThis, 'navigator', {
        value: origNav,
        configurable: true,
        writable: true
    });
});
