import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getThreeLayer,
    getVehicleMarker,
    disposeMesh,
    setupVehicleMarker,
    updateSkidMarks
} from '../js/three-manager.js';
import { state } from '../js/state.js';

test('three-manager getters return initial state', () => {
    assert.strictEqual(getThreeLayer(), undefined);
    assert.strictEqual(getVehicleMarker(), undefined);
});

test('disposeMesh safely handles null or mesh objects with geometries and materials', () => {
    let geomDisposed = false;
    let matDisposed = false;
    let textureDisposed = false;

    const fakeMesh = {
        geometry: {
            dispose() {
                geomDisposed = true;
            }
        },
        material: {
            map: {
                dispose() {
                    textureDisposed = true;
                }
            },
            dispose() {
                matDisposed = true;
            }
        },
        children: []
    };

    assert.doesNotThrow(() => {
        disposeMesh(fakeMesh);
    });

    assert.strictEqual(geomDisposed, true);
    assert.strictEqual(matDisposed, true);
    assert.strictEqual(textureDisposed, true);
});

test('disposeMesh recursively cleans up nested array of materials and children nodes', () => {
    let childGeomDisposed = false;

    const parentNode = {
        material: [{ dispose() {} }, { dispose() {} }],
        children: [
            {
                geometry: {
                    dispose() {
                        childGeomDisposed = true;
                    }
                },
                children: []
            }
        ],
        remove(child) {
            const idx = this.children.indexOf(child);
            if (idx >= 0) this.children.splice(idx, 1);
        }
    };

    disposeMesh(parentNode);
    assert.strictEqual(childGeomDisposed, true);
    assert.strictEqual(parentNode.children.length, 0);
});

test('setupVehicleMarker creates or updates Mapbox Marker on 2D mode', () => {
    let setLngLatCalled = false;
    let setRotationCalled = false;

    const mockMap = {};
    const origMapboxgl = globalThis.mapboxgl;

    globalThis.mapboxgl = {
        Marker: class {
            constructor(options) {
                this.options = options;
            }
            setLngLat(coords) {
                setLngLatCalled = coords;
                return this;
            }
            setRotation(rot) {
                setRotationCalled = rot;
                return this;
            }
            addTo(map) {
                assert.strictEqual(map, mockMap);
                return this;
            }
        }
    };

    const origDoc = globalThis.document;
    globalThis.document = {
        createElement() {
            return {
                style: {},
                appendChild() {}
            };
        }
    };

    state.is3D = false;
    state.lng = 20.45;
    state.lat = 44.81;
    state.bearing = 90;
    state.activeVehicle = 'car';

    setupVehicleMarker(mockMap);

    assert.deepEqual(setLngLatCalled, [20.45, 44.81]);
    assert.strictEqual(setRotationCalled, 90);

    globalThis.document = origDoc;

    globalThis.mapboxgl = origMapboxgl;
});

test('updateSkidMarks updates skidmark source data when active', () => {
    let setDataCalled = null;

    const mockMap = {
        getSource(id) {
            if (id === 'skid-marks') {
                return {
                    setData(data) {
                        setDataCalled = data;
                    }
                };
            }
            return null;
        }
    };

    state.isSkidding = true;
    state.lng = 20.45;
    state.skidMarks = [
        {
            properties: { life: 1.0, opacity: 0.8 },
            geometry: {
                type: 'LineString',
                coordinates: [
                    [20.44, 44.8],
                    [20.45, 44.81]
                ]
            }
        }
    ];
    state.skidUpdateFrame = 4;

    updateSkidMarks(mockMap);
    assert.strictEqual(setDataCalled?.type, 'FeatureCollection');
});
