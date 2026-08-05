import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getRealTimePreset,
    applyLightPreset,
    triggerDonationPopup,
    updateToggleStates,
    add3DBuildings
} from '../js/ui.js';
import { state } from '../js/state.js';

if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (k) => store.get(k) || null,
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear()
    };
}

test('getRealTimePreset evaluates time ranges accurately', () => {
    const preset = getRealTimePreset();
    assert.strictEqual(['dawn', 'day', 'dusk', 'night'].includes(preset), true);
});

test('applyLightPreset calls setConfigProperty with correct parameters when map style is standard', () => {
    let calledProperty = null;
    let calledValue = null;

    const mockMap = {
        setConfigProperty(component, property, value) {
            calledProperty = property;
            calledValue = value;
        }
    };

    state.mapStyle = 'standard';
    state.lightPreset = 'day';
    applyLightPreset(mockMap);

    assert.strictEqual(calledProperty, 'lightPreset');
    assert.strictEqual(calledValue, 'day');
});

test('applyLightPreset handles realtime preset fallback accurately', () => {
    let calledValue = null;
    const mockMap = {
        setConfigProperty(_comp, _prop, value) {
            calledValue = value;
        }
    };

    state.mapStyle = 'standard';
    state.lightPreset = 'realtime';
    applyLightPreset(mockMap);

    assert.strictEqual(['dawn', 'day', 'dusk', 'night'].includes(calledValue), true);
});

test('updateToggleStates updates DOM button active classes based on state flags', () => {
    const mockElements = {};
    const d3vBtn = {
        dataset: { d3v: 'on' },
        classList: {
            add: (c) => (d3vBtn.active = c === 'active'),
            remove: (c) => {
                if (c === 'active') d3vBtn.active = false;
            },
            toggle: (c, val) => {
                if (c === 'active') d3vBtn.active = val;
            }
        }
    };

    const mockDocument = {
        getElementById(id) {
            if (!mockElements[id]) {
                mockElements[id] = {
                    style: {},
                    classList: { add() {}, remove() {}, toggle() {} }
                };
            }
            return mockElements[id];
        },
        querySelectorAll(selector) {
            if (selector.includes('d3v')) return [d3vBtn];
            return [];
        }
    };

    const origDoc = globalThis.document;
    globalThis.document = mockDocument;

    state.is3D = true;
    state.mapStyle = 'outdoors-v12';

    updateToggleStates();

    assert.strictEqual(d3vBtn.active, true);

    globalThis.document = origDoc;
});

test('add3DBuildings inserts 3d-buildings layer before label layer', () => {
    let addedLayer = null;

    const mockMap = {
        getStyle() {
            return {
                layers: [
                    { id: 'road' },
                    { id: 'building', type: 'fill' },
                    { type: 'symbol', layout: { 'text-field': 'label' }, id: 'composite-label' }
                ]
            };
        },
        getLayer(id) {
            return id === '3d-buildings' ? null : {};
        },
        addLayer(layer) {
            addedLayer = layer;
        }
    };

    state.is3DBuildings = true;
    state.mapStyle = 'satellite-v9';

    add3DBuildings(mockMap);
    assert.strictEqual(addedLayer?.id, '3d-buildings');

    assert.strictEqual(addedLayer?.type, 'fill-extrusion');
});

test('triggerDonationPopup does not throw in Node environment', () => {
    assert.doesNotThrow(() => triggerDonationPopup());
});
