import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanMap, addSkidMarksLayer } from '../js/utils.js';

test('cleanMap handles null or invalid map object safely', () => {
    assert.doesNotThrow(() => cleanMap(null));
    assert.doesNotThrow(() => cleanMap({}));
});

test('cleanMap hides target symbol layers', () => {
    const hiddenLayers = [];
    const mockMap = {
        getStyle() {
            return {
                layers: [
                    { id: 'poi-label', type: 'symbol' },
                    { id: 'road-line', type: 'line' },
                    { id: 'transit-station', type: 'symbol' }
                ]
            };
        },
        setLayoutProperty(id, prop, val) {
            if (prop === 'visibility' && val === 'none') {
                hiddenLayers.push(id);
            }
        }
    };

    cleanMap(mockMap);
    assert.strictEqual(hiddenLayers.length, 2);
    assert.deepStrictEqual(hiddenLayers, ['poi-label', 'transit-station']);
});

test('addSkidMarksLayer creates source and layer on map', () => {
    const addedSources = [];
    const addedLayers = [];

    const mockMap = {
        getSource(id) {
            return addedSources.find((s) => s.id === id);
        },
        getLayer(id) {
            return addedLayers.find((l) => l.id === id);
        },
        addSource(id, conf) {
            addedSources.push({ id, ...conf });
        },
        addLayer(conf) {
            addedLayers.push(conf);
        }
    };

    addSkidMarksLayer(mockMap);
    assert.strictEqual(addedSources.length, 1);
    assert.strictEqual(addedSources[0].id, 'skid-marks');
    assert.strictEqual(addedLayers.length, 1);
    assert.strictEqual(addedLayers[0].id, 'skid-marks-layer');
});
