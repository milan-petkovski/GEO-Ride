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

test('updateSkidMarks handles drifting, burnout, fading, and max marks capping', () => {
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

    state.keys = { ' ': true };
    state.velocity = 0.5;
    state.activeVehicle = 'bus';
    state.isCharging = true;
    state.lng = 20.45;
    state.lat = 44.81;
    state.bearing = 45;
    state.lastSkidPos = { right: { lng: 20.44, lat: 44.8 }, left: { lng: 20.441, lat: 44.801 } };
    state.skidMarks = [];
    state.skidUpdateFrame = 4;
    state.performance = { eliteEnd: false, lowEnd: true };

    updateSkidMarks(mockMap);
    assert.strictEqual(state.skidMarks.length, 2);
    assert.strictEqual(setDataCalled?.type, 'FeatureCollection');

    // Test clearing skidmarks when life decays to 0
    state.keys[' '] = false;
    state.velocity = 0;
    state.isCharging = false;
    state.skidMarks.forEach((m) => (m.properties.life = 0.001));

    updateSkidMarks(mockMap);
    assert.strictEqual(state.skidMarks.length, 0);
    assert.strictEqual(state.lastSkidPos, null);
});

test('addSkidMarksLayer manipulates Mapbox layers safely', async () => {
    let addedLayer = null;
    let addedSource = null;

    const mockMap = {
        getStyle() {
            return {
                layers: [
                    { id: 'road-label', type: 'symbol', layout: { 'text-field': 'name' } },
                    { id: 'poi-label', type: 'symbol', layout: { 'text-field': 'name' } }
                ]
            };
        },
        getLayer(id) {
            return id === 'road-label' ? {} : null;
        },
        getSource(id) {
            return id === 'skid-marks' ? null : {};
        },
        removeLayer() {},
        addSource(id, src) {
            addedSource = { id, src };
        },
        addLayer(layer, beforeId) {
            addedLayer = { layer, beforeId };
        },
        setLayoutProperty() {}
    };

    const { addSkidMarksLayer } = await import('../js/utils.js');

    addSkidMarksLayer(mockMap);

    assert.strictEqual(addedSource?.id, 'skid-marks');
    assert.strictEqual(addedLayer?.layer?.id, 'skid-marks-layer');
});

test('setup3DVehicleLayer instantiates 3D custom layer on Mapbox map', async () => {
    let addedLayer = null;

    const mockMap = {
        getLayer(id) {
            return id === '3d-vehicle-layer' ? null : null;
        },
        addLayer(layer) {
            addedLayer = layer;
        }
    };

    state.is3D = true;
    state.activeVehicle = 'car';

    const { setup3DVehicleLayer } = await import('../js/three-manager.js');
    setup3DVehicleLayer(mockMap);

    assert.strictEqual(addedLayer?.id, '3d-vehicle-layer');
    assert.strictEqual(addedLayer?.type, 'custom');
});

test('threeLayer onAdd, buildVehicle across all vehicle types, and render loop execution', async () => {
    class MockMesh {
        constructor() {
            this.position = { set() {}, x: 0, y: 0, z: 0 };
            this.rotation = { x: 0, y: 0, z: 0 };
            this.scale = { set() {}, x: 1, y: 1, z: 1 };
            this.children = [];
            this.visible = true;
        }
        add(child) {
            this.children.push(child);
        }
        remove(child) {
            const idx = this.children.indexOf(child);
            if (idx >= 0) this.children.splice(idx, 1);
        }
    }

    class MockGroup extends MockMesh {}

    globalThis.mapboxgl = globalThis.mapboxgl || {};
    globalThis.mapboxgl.MercatorCoordinate = {
        fromLngLat() {
            return {
                x: 0.5,
                y: 0.5,
                z: 0.0,
                meterInMercatorCoordinateUnits() {
                    return 0.000001;
                }
            };
        }
    };

    globalThis.window = globalThis.window || {};
    globalThis.window.THREE = {
        Camera: class {},
        Scene: class extends MockMesh {},
        Group: MockGroup,
        Mesh: MockMesh,
        Matrix4: class {
            makeRotationX() {
                return this;
            }
            makeRotationY() {
                return this;
            }
            makeRotationZ() {
                return this;
            }
            makeTranslation() {
                return this;
            }
            makeScale() {
                return this;
            }
            scale() {
                return this;
            }
            multiply() {
                return this;
            }
            fromArray() {
                return this;
            }
        },
        Vector3: class {
            set() {
                return this;
            }
        },
        Vector2: class {
            set() {
                return this;
            }
        },
        Color: class {
            set() {
                return this;
            }
        },
        AmbientLight: class {},
        DirectionalLight: class {
            constructor() {
                this.position = {
                    set() {
                        return { normalize() {} };
                    }
                };
            }
        },
        CircleGeometry: class {
            dispose() {}
        },
        RingGeometry: class {
            dispose() {}
        },
        BoxGeometry: class {
            dispose() {}
        },
        CylinderGeometry: class {
            dispose() {}
        },
        SphereGeometry: class {
            dispose() {}
        },
        PlaneGeometry: class {
            dispose() {}
        },
        ShapeGeometry: class {
            dispose() {}
        },
        BufferGeometry: class {
            dispose() {}
        },
        MeshBasicMaterial: class {
            dispose() {}
        },
        MeshStandardMaterial: class {
            dispose() {}
        },
        TextureLoader: class {
            load() {
                return { dispose() {} };
            }
        },
        WebGLRenderer: class {
            constructor() {
                this.autoClear = false;
            }
            resetState() {}
            render() {}
        },
        DoubleSide: 2
    };

    let addedLayer = null;
    const mockMap = {
        getCanvas() {
            return {};
        },
        getLayer(id) {
            return id === '3d-vehicle-layer' ? null : null;
        },
        addLayer(layer) {
            addedLayer = layer;
        },
        triggerRepaint() {}
    };

    state.is3D = true;
    state.activeVehicle = 'car';
    state.performance = { eliteEnd: true, lowEnd: false };

    const { setup3DVehicleLayer } = await import('../js/three-manager.js');
    setup3DVehicleLayer(mockMap);

    assert.notStrictEqual(addedLayer, null);
    if (addedLayer && typeof addedLayer.onAdd === 'function') {
        addedLayer.onAdd(mockMap, {});

        // Test building all vehicle types
        addedLayer.buildVehicle('car');
        addedLayer.buildVehicle('truck');
        addedLayer.buildVehicle('bus');
        addedLayer.buildVehicle('god');

        // Test render loop
        if (typeof addedLayer.render === 'function') {
            state.otherPlayers = {
                p1: { lng: 20.45, lat: 44.81, bearing: 90, vehicle: 'sports' }
            };
            state.isTeleporting = true;
            state.teleportProgress = 0.5;

            addedLayer.render({}, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        }
    }
});
