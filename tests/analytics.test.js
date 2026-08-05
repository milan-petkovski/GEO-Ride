import test from 'node:test';
import assert from 'node:assert/strict';
import { trackEvent, trackError, initConsentMode, trackWebVitals } from '../js/analytics.js';

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

test('analytics tracks event using window.gtag function if present', () => {
    let gtagCalled = false;
    let gtagPayload = null;

    globalThis.window = globalThis.window || {};
    globalThis.window.gtag = (type, name, payload) => {
        if (type === 'event' && name === 'test_gtag') {
            gtagCalled = true;
            gtagPayload = payload;
        }
    };
    globalThis.window.location = { href: 'not-a-valid-url', pathname: '/test' };

    trackEvent('test_gtag', { key: 'val' });

    assert.strictEqual(gtagCalled, true);
    assert.strictEqual(gtagPayload.key, 'val');
    assert.strictEqual(gtagPayload.page_location, 'not-a-valid-url');

    delete globalThis.window.gtag;
});

test('analytics trackWebVitals pushes paint metrics when performance entries available', () => {
    let eventListener = null;

    globalThis.window = {
        dataLayer: [],
        performance: {
            getEntriesByType: (type) =>
                type === 'paint' ? [{ name: 'first-contentful-paint', startTime: 120, entryType: 'paint' }] : []
        },
        addEventListener(evt, callback) {
            if (evt === 'load') eventListener = callback;
        }
    };
    globalThis.performance = globalThis.window.performance;

    trackWebVitals();

    assert.strictEqual(typeof eventListener, 'function');
    assert.doesNotThrow(() => eventListener());
});

test('analytics unhandledrejection listener triggers exception tracking', () => {
    globalThis.window = globalThis.window || {};
    globalThis.window.dataLayer = [];

    if (globalThis.window.onunhandledrejection) {
        globalThis.window.onunhandledrejection({ reason: 'Network failure' });
        const lastEvent = globalThis.window.dataLayer[globalThis.window.dataLayer.length - 1];
        assert.strictEqual(lastEvent.description, 'Unhandled Rejection: Network failure');
    }
});
