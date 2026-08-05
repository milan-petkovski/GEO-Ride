import test from 'node:test';
import assert from 'node:assert/strict';
import { trackEvent, trackError, initConsentMode } from '../js/analytics.js';

test('analytics dataLayer initializes and tracks custom events with sanitized location metadata', () => {
    globalThis.window = globalThis.window || {};
    globalThis.window.dataLayer = [];
    globalThis.window.location = { href: 'https://georide.milanwebportal.com/map?token=secret#section' };

    trackEvent('vehicle_select', { vehicle: 'cyber' });

    assert.strictEqual(globalThis.window.dataLayer.length > 0, true);
    const lastEvent = globalThis.window.dataLayer[globalThis.window.dataLayer.length - 1];

    assert.strictEqual(lastEvent.event, 'vehicle_select');
    assert.strictEqual(lastEvent.vehicle, 'cyber');
    assert.strictEqual(lastEvent.page_location, 'https://georide.milanwebportal.com/map');
});

test('analytics trackError formats JavaScript runtime error events cleanly', () => {
    globalThis.window = globalThis.window || {};
    globalThis.window.dataLayer = [];

    trackError('Uncaught ReferenceError: foo is not defined', 'app.js', 42, 10);

    const errorEvent = globalThis.window.dataLayer[globalThis.window.dataLayer.length - 1];
    assert.strictEqual(errorEvent.event, 'exception');
    assert.strictEqual(errorEvent.description, 'Uncaught ReferenceError: foo is not defined at app.js:42:10');
});

test('analytics initConsentMode pushes default analytics consent settings', () => {
    globalThis.window = globalThis.window || {};
    globalThis.window.dataLayer = [];

    initConsentMode();

    const consentEvent = globalThis.window.dataLayer.find((e) => e[0] === 'consent' && e[1] === 'default');
    assert.notStrictEqual(consentEvent, undefined);
    assert.strictEqual(consentEvent[2].analytics_storage, 'granted');
});
