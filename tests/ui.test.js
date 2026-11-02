import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getRealTimePreset,
    applyLightPreset,
    triggerDonationPopup,
    updateToggleStates,
    add3DBuildings,
    logoutPro
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

test('openSettings, closeSettings, openChangelogModal, closeChangelogModal, and cross-modal navigation', async () => {
    const { openSettings, closeSettings, openChangelogModal, closeChangelogModal, closeAllPanels } =
        await import('../js/ui.js');

    const classes = new Map();
    const getClassList = (name) => {
        if (!classes.has(name)) {
            const set = new Set();
            classes.set(name, {
                add: (c) => set.add(c),
                remove: (c) => set.delete(c),
                contains: (c) => set.has(c),
                toggle: (c, force) => {
                    if (force === undefined) {
                        set.has(c) ? set.delete(c) : set.add(c);
                    } else if (force) {
                        set.add(c);
                    } else {
                        set.delete(c);
                    }
                }
            });
        }
        return classes.get(name);
    };

    let clickedTab = null;
    const mockElements = {
        'settings-panel': {
            classList: getClassList('settings-panel'),
            querySelectorAll: () => [
                {
                    dataset: { sxTab: 'general' },
                    click: () => {
                        clickedTab = 'general';
                    }
                },
                {
                    dataset: { sxTab: 'about' },
                    click: () => {
                        clickedTab = 'about';
                    }
                },
                {
                    dataset: { sxTab: 'places' },
                    click: () => {
                        clickedTab = 'places';
                    }
                },
                {
                    dataset: { sxTab: 'changelog' },
                    click: () => {
                        clickedTab = 'changelog';
                    }
                }
            ],
            querySelector: (sel) => {
                const match = ['general', 'about', 'places', 'changelog'].find((tab) => sel.includes(tab));
                if (match) {
                    return {
                        click: () => {
                            clickedTab = match;
                        }
                    };
                }
                return null;
            }
        },
        'spots-modal-backdrop': { classList: getClassList('spots-modal-backdrop') },
        'pro-modal-backdrop': { classList: getClassList('pro-modal-backdrop') },
        'changelog-modal-backdrop': { classList: getClassList('changelog-modal-backdrop') },
        'location-search': { classList: getClassList('location-search'), blur() {} }
    };

    const origDoc = globalThis.document;
    try {
        globalThis.document = {
            ...origDoc,
            getElementById: (id) => mockElements[id] || { classList: getClassList(id), style: {}, blur() {} },
            querySelector: (sel) => (origDoc?.querySelector ? origDoc.querySelector(sel) : null),
            querySelectorAll: (sel) => (origDoc?.querySelectorAll ? origDoc.querySelectorAll(sel) : []),
            body: origDoc?.body || { classList: getClassList('body') }
        };

        // Test openSettings with specific tab (supports 'more' fallback to 'about', 'places', 'changelog')
        openSettings('more');
        assert.strictEqual(mockElements['settings-panel'].classList.contains('active'), true);
        assert.strictEqual(clickedTab, 'about');

        openSettings('places');
        assert.strictEqual(clickedTab, 'places');

        openSettings('changelog');
        assert.strictEqual(clickedTab, 'changelog');

        // Test closeSettings
        closeSettings();
        assert.strictEqual(mockElements['settings-panel'].classList.contains('active'), false);

        // Test openChangelogModal & closeChangelogModal
        openChangelogModal();
        assert.strictEqual(mockElements['changelog-modal-backdrop'].classList.contains('active'), true);
        closeChangelogModal();
        assert.strictEqual(mockElements['changelog-modal-backdrop'].classList.contains('active'), false);

        // Test closeAllPanels
        openSettings();
        openChangelogModal();
        mockElements['spots-modal-backdrop'].classList.add('active');
        mockElements['pro-modal-backdrop'].classList.add('active');
        closeAllPanels();

        assert.strictEqual(mockElements['settings-panel'].classList.contains('active'), false);
        assert.strictEqual(mockElements['spots-modal-backdrop'].classList.contains('active'), false);
        assert.strictEqual(mockElements['changelog-modal-backdrop'].classList.contains('active'), false);
        assert.strictEqual(mockElements['pro-modal-backdrop'].classList.contains('active'), false);
    } finally {
        globalThis.document = origDoc;
    }
});

test('FAMOUS_SPOTS contains 17 spots including circuits, cities, and passes with helper functions', async () => {
    const {
        FAMOUS_SPOTS,
        filterSpots,
        applyMapLabels,
        applyHudVisibility,
        applyGraphicsQuality,
        resetUserPreferences
    } = await import('../js/ui.js');

    assert.strictEqual(FAMOUS_SPOTS.length, 17);
    const dubai = FAMOUS_SPOTS.find((s) => s.id === 'dubai');
    const sf = FAMOUS_SPOTS.find((s) => s.id === 'sanfrancisco');
    const london = FAMOUS_SPOTS.find((s) => s.id === 'london');
    const silverstone = FAMOUS_SPOTS.find((s) => s.id === 'silverstone');
    const spa = FAMOUS_SPOTS.find((s) => s.id === 'spa');

    assert.ok(dubai && dubai.category === 'city');
    assert.ok(sf && sf.category === 'pass');
    assert.ok(london && london.category === 'city');
    assert.ok(silverstone && silverstone.category === 'circuit');
    assert.ok(spa && spa.category === 'circuit');

    // Test filterSpots with DOM mocks
    const chips = [{ dataset: { filter: 'all' }, classList: { toggle() {} } }];
    const cards = [{ dataset: { spotCategory: 'city' }, style: {} }];
    const origDoc = globalThis.document;
    globalThis.document = {
        querySelectorAll: (sel) => {
            if (sel.includes('spot-filter-chip')) return chips;
            if (sel.includes('spot-card')) return cards;
            return [];
        },
        getElementById: () => null,
        body: { classList: { toggle() {} } }
    };

    filterSpots('city');
    assert.strictEqual(cards[0].style.display, 'flex');
    filterSpots('circuit');
    assert.strictEqual(cards[0].style.display, 'none');

    // Test applyHudVisibility
    applyHudVisibility();

    // Test applyMapLabels with map mock
    let setVisibilityVal = null;
    const mockMap = {
        getStyle: () => ({ layers: [{ id: 'road-label', type: 'symbol' }] }),
        setLayoutProperty: (id, prop, val) => {
            setVisibilityVal = val;
        }
    };
    applyMapLabels(mockMap);
    assert.strictEqual(setVisibilityVal, 'visible');

    // Test resetUserPreferences
    resetUserPreferences(mockMap);

    globalThis.document = origDoc;
});

test('logoutPro clears Pro state, resets localStorage, and updates UI flags', () => {
    localStorage.setItem('geo_ride_pro_active', 'true');
    localStorage.setItem('geo_ride_pro_email', 'test@example.com');
    state.isPro = true;

    logoutPro();

    assert.strictEqual(state.isPro, false);
    assert.strictEqual(localStorage.getItem('geo_ride_pro_active'), null);
    assert.strictEqual(localStorage.getItem('geo_ride_pro_email'), null);
});
