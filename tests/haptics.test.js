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
    assert.doesNotThrow(() => haptics.impact('strong'));
    assert.doesNotThrow(() => haptics.stop());
});
