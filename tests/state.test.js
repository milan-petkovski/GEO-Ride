import test from 'node:test';
import assert from 'node:assert/strict';
import { state, loadState, saveState, subscribeState, setStateKey } from '../js/state.js';

// Mock localStorage for Node test environment
if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (k) => store.get(k) || null,
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear()
    };
}

test('state default properties', () => {
    assert.strictEqual(typeof state.lng, 'number');
    assert.strictEqual(typeof state.lat, 'number');
    assert.strictEqual(state.activeVehicle, 'car');
    assert.strictEqual(state.unit, 'km');
});

test('state observer subscription pattern', () => {
    let notified = false;
    let receivedVal = null;

    const unsubscribe = subscribeState('activeVehicle', (val) => {
        notified = true;
        receivedVal = val;
    });

    setStateKey('activeVehicle', 'truck');
    assert.strictEqual(notified, true);
    assert.strictEqual(receivedVal, 'truck');
    assert.strictEqual(state.activeVehicle, 'truck');

    // Test unsubscribe
    notified = false;
    unsubscribe();
    setStateKey('activeVehicle', 'car');
    assert.strictEqual(notified, false);
    assert.strictEqual(state.activeVehicle, 'car');
});

test('saveState and loadState with validation', () => {
    localStorage.clear();

    setStateKey('activeVehicle', 'bus');
    setStateKey('unit', 'mi');
    setStateKey('masterVolume', 0.8);
    saveState();

    // Reset state values
    state.activeVehicle = 'car';
    state.unit = 'km';
    state.masterVolume = 0.5;

    loadState();

    assert.strictEqual(state.activeVehicle, 'bus');
    assert.strictEqual(state.unit, 'mi');
    assert.strictEqual(state.masterVolume, 0.8);
});

test('loadState fallback handling for corrupted JSON', () => {
    localStorage.setItem('geo_ride_state', '{ invalid json ...');

    // Should not throw, should retain defaults
    assert.doesNotThrow(() => {
        loadState();
    });
});
