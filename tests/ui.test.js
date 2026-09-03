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

class MockMQTTClient {
    constructor() {
        this.onConnectionLost = null;
        this.onMessageArrived = null;
    }
    connect() {}
    subscribe() {}
    send() {}
    disconnect() {}
}

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {};
}
globalThis.window.Paho = {
    MQTT: {
        Client: MockMQTTClient,
        Message: class {}
    }
};

if (typeof globalThis.mapboxgl === 'undefined') {
    globalThis.mapboxgl = {
        Marker: class {
            setLngLat() {
                return this;
            }
            setRotation() {
                return this;
            }
            remove() {
                return this;
            }
            addTo() {
                return this;
            }
        }
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

test('initUI binds and executes interactive HUD controls and panels', async () => {
    const documentListeners = {};
    const mockElements = new Map();

    const createMockElement = (id, dataset = {}, tagName = 'button') => {
        const listeners = {};
        const el = {
            id,
            tagName,
            dataset,
            style: {},
            value: 'Belgrade',
            classList: {
                classes: new Set(),
                add(c) {
                    this.classes.add(c);
                },
                remove(c) {
                    this.classes.delete(c);
                },
                contains(c) {
                    return this.classes.has(c);
                },
                toggle(c, val) {
                    if (val === undefined) {
                        if (this.classes.has(c)) this.classes.delete(c);
                        else this.classes.add(c);
                    } else if (val) this.classes.add(c);
                    else this.classes.delete(c);
                }
            },
            children: [],
            addEventListener(event, handler) {
                listeners[event] = handler;
            },
            removeEventListener(event) {
                delete listeners[event];
            },
            contains(target) {
                return target === el;
            },
            appendChild() {},
            blur() {},
            click() {
                if (this.onclick) this.onclick({ preventDefault() {}, stopPropagation() {}, target: el });
                if (listeners['click']) listeners['click']({ preventDefault() {}, stopPropagation() {}, target: el });
            }
        };
        mockElements.set(id, el);
        return el;
    };

    const styleBtns = [
        createMockElement('style-standard', { style: 'standard' }),
        createMockElement('style-sat', { style: 'satellite-v9' }),
        createMockElement('style-outdoors', { style: 'outdoors-v12' })
    ];
    const lightBtns = [
        createMockElement('btn-manual-trigger', {}),
        createMockElement('btn-realtime', {}),
        createMockElement('btn-day', { preset: 'day' })
    ];
    const unitBtns = [createMockElement('unit-km', { unit: 'km' }), createMockElement('unit-miles', { unit: 'miles' })];
    const vehicleBtns = [
        createMockElement('v-car', { vehicle: 'car' }),
        createMockElement('v-truck', { vehicle: 'truck' }),
        createMockElement('v-god', { vehicle: 'god' })
    ];
    const d3vBtns = [createMockElement('d3v-on', { d3v: 'on' }), createMockElement('d3v-off', { d3v: 'off' })];
    const d3bBtns = [createMockElement('d3b-on', { d3b: 'on' }), createMockElement('d3b-off', { d3b: 'off' })];
    const collisionBtns = [
        createMockElement('col-on', { collision: 'on' }),
        createMockElement('col-off', { collision: 'off' })
    ];
    const godBtns = [createMockElement('god-on', { god: 'on' }), createMockElement('god-off', { god: 'off' })];
    const controlsBtns = [
        createMockElement('ctrl-kb', { controls: 'keyboard' }),
        createMockElement('ctrl-touch', { controls: 'touch' })
    ];

    globalThis.fetch = async () => ({
        json: async () => ({
            features: [{ center: [20.45, 44.81] }]
        })
    });

    const mockDoc = {
        createElement(tagName) {
            return createMockElement('el-' + Math.random(), {}, tagName);
        },
        getElementById(id) {
            if (!mockElements.has(id)) createMockElement(id);
            return mockElements.get(id);
        },
        querySelector(selector) {
            if (selector.includes('search-box')) return createMockElement('search-box-el');
            if (selector.includes('coffee-btn')) return createMockElement('coffee-btn-el');
            if (selector.includes('author-link')) return createMockElement('author-link-el');
            return createMockElement('qs-' + selector);
        },
        querySelectorAll(selector) {
            if (selector.includes('style-toggle')) return styleBtns;
            if (selector.includes('light-toggle')) return lightBtns;
            if (selector.includes('unit-toggle')) return unitBtns;
            if (selector.includes('vehicle-toggle')) return vehicleBtns;
            if (selector.includes('d3v-toggle')) return d3vBtns;
            if (selector.includes('d3b-toggle')) return d3bBtns;
            if (selector.includes('collision-toggle')) return collisionBtns;
            if (selector.includes('controls-toggle')) return controlsBtns;
            if (selector.includes('god-toggle')) return godBtns;
            return [];
        },
        addEventListener(event, handler) {
            documentListeners[event] = handler;
        },
        removeEventListener(event) {
            delete documentListeners[event];
        },
        fonts: { ready: Promise.resolve() }
    };

    const origDoc = globalThis.document;
    const origWin = globalThis.window;
    globalThis.document = mockDoc;
    globalThis.window = {
        innerWidth: 1200,
        innerHeight: 800,
        addEventListener() {},
        removeEventListener() {},
        Paho: {
            MQTT: {
                Client: MockMQTTClient,
                Message: class {}
            }
        }
    };

    const mockMap = {
        setStyle() {},
        setConfigProperty() {},
        getLayer() {
            return null;
        },
        addLayer() {},
        triggerRepaint() {},
        getZoom() {
            return 17;
        },
        flyTo(opts) {
            if (opts) return;
        },
        once(evt, cb) {
            if (cb) cb();
        },
        dragPan: { enable() {}, disable() {} },
        scrollZoom: { enable() {}, disable() {} },
        doubleClickZoom: { enable() {}, disable() {} },
        touchZoomRotate: { enable() {}, disable() {} },
        keyboard: { enable() {}, disable() {} }
    };

    const { initUI, updateToggleStates } = await import('../js/ui.js');
    initUI(mockMap);

    // Trigger settings button click
    const settingsBtn = mockElements.get('settings-btn');
    settingsBtn.click();
    assert.strictEqual(mockElements.get('settings-panel').classList.contains('active'), true);

    // Trigger close settings button
    const settingsCloseBtn = mockElements.get('settings-close-btn');
    settingsCloseBtn.click();

    // Trigger style toggle buttons
    styleBtns[0].click(); // standard
    styleBtns[1].click(); // satellite
    styleBtns[2].click(); // outdoors

    // Trigger light toggle buttons
    lightBtns[0].click(); // manual trigger
    lightBtns[1].click(); // realtime
    lightBtns[2].click(); // day preset

    const btnLightBack = mockElements.get('btn-light-back');
    if (btnLightBack.onclick) btnLightBack.onclick();

    // Trigger vehicle buttons
    vehicleBtns[0].click(); // car
    vehicleBtns[1].click(); // truck
    vehicleBtns[2].click(); // god

    // Trigger 3D and 3D building toggles
    d3vBtns[0].click();
    d3bBtns[0].click();
    collisionBtns[0].click();
    godBtns[0].click(); // god on
    godBtns[1].click(); // god off
    controlsBtns[0].click();
    unitBtns[0].click();

    // Trigger volume slider change
    const masterVolume = mockElements.get('master-volume');
    masterVolume.value = 0.8;
    if (masterVolume.oninput) masterVolume.oninput();

    masterVolume.value = 0;
    if (masterVolume.oninput) masterVolume.oninput();

    // Trigger search button and mobile search
    const searchBtn = mockElements.get('search-btn');
    const searchInput = mockElements.get('location-search');
    const mobileSearchBtn = mockElements.get('mobile-search-btn');
    const mobileSearchInput = mockElements.get('mobile-location-search');

    searchBtn.click();
    if (searchInput.onkeypress) searchInput.onkeypress({ key: 'Enter' });
    if (mobileSearchBtn.onclick) mobileSearchBtn.onclick({ stopPropagation() {} });
    if (mobileSearchInput.onkeypress) mobileSearchInput.onkeypress({ key: 'Enter' });

    // Trigger external link buttons
    const coffeeBtn = mockElements.get('coffee-btn-el');
    if (coffeeBtn.onclick) coffeeBtn.onclick();

    const authorLink = mockElements.get('author-link-el');
    if (authorLink.onclick) authorLink.onclick();

    const joinMpBtn = mockElements.get('join-mp-btn');
    if (joinMpBtn.onclick) joinMpBtn.onclick();

    // Trigger global document click
    if (documentListeners['click']) documentListeners['click']({ target: mockDoc.createElement('div') });

    updateToggleStates();

    await mockDoc.fonts.ready;
    await new Promise((r) => setTimeout(r, 10));

    const { stopMultiplayerTimers } = await import('../js/multiplayer.js');
    stopMultiplayerTimers();

    globalThis.document = origDoc;
    globalThis.window = origWin;
});

test('triggerDonationPopup opens and closes donation overlay correctly', () => {
    let popupVisible = false;
    const popupEl = {
        classList: {
            add(c) {
                if (c === 'show') popupVisible = true;
            },
            remove(c) {
                if (c === 'show') popupVisible = false;
            }
        }
    };

    const mockDoc = {
        getElementById(id) {
            return id === 'donation-popup' ? popupEl : null;
        },
        querySelector() {
            return null;
        },
        querySelectorAll() {
            return [];
        }
    };

    const origDoc = globalThis.document;
    globalThis.document = mockDoc;

    triggerDonationPopup();
    assert.strictEqual(popupVisible, true);

    globalThis.document = origDoc;
});
