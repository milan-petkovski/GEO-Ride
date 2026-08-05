import test from 'node:test';
import assert from 'node:assert/strict';
import {
    sanitizePlayerPayload,
    getRoomTopic,
    cleanupInactivePlayers,
    renderActivePlayers,
    updateOtherPlayers,
    initMultiplayer,
    stopMultiplayerTimers
} from '../js/multiplayer.js';

import { state } from '../js/state.js';

test('sanitizePlayerPayload - valid payload parsing', () => {
    const raw = { id: 'player1', lng: 20.45, lat: 44.81, bearing: 180, v: 50, vehicle: 'sports' };
    const res = sanitizePlayerPayload(raw);
    assert.deepEqual(res, {
        id: 'player1',
        lng: 20.45,
        lat: 44.81,
        bearing: 180,
        v: 50,
        vehicle: 'sports'
    });
});

test('sanitizePlayerPayload - normalizes bearing angles over 360 and negative angles', () => {
    const rawOver = { id: 'player1', lng: 0, lat: 0, bearing: 450, v: 10, vehicle: 'car' };
    assert.strictEqual(sanitizePlayerPayload(rawOver).bearing, 90);

    const rawNeg = { id: 'player1', lng: 0, lat: 0, bearing: -90, v: 10, vehicle: 'car' };
    assert.strictEqual(sanitizePlayerPayload(rawNeg).bearing, 270);
});

test('sanitizePlayerPayload - caps extreme velocity bounds', () => {
    const rawHigh = { id: 'p1', lng: 0, lat: 0, bearing: 0, v: 9999, vehicle: 'car' };
    assert.strictEqual(sanitizePlayerPayload(rawHigh).v, 300);

    const rawLow = { id: 'p1', lng: 0, lat: 0, bearing: 0, v: -9999, vehicle: 'car' };
    assert.strictEqual(sanitizePlayerPayload(rawLow).v, -300);
});

test('sanitizePlayerPayload - filters disallowed vehicle types back to default car', () => {
    const rawInvalidVehicle = { id: 'p1', lng: 0, lat: 0, bearing: 0, v: 10, vehicle: '<script>alert(1)</script>' };
    assert.strictEqual(sanitizePlayerPayload(rawInvalidVehicle).vehicle, 'car');
});

test('sanitizePlayerPayload - returns null for malformed or out-of-bounds coordinates', () => {
    assert.strictEqual(sanitizePlayerPayload(null), null);
    assert.strictEqual(sanitizePlayerPayload({ id: 'p1', lng: 999, lat: 0, bearing: 0, v: 0, vehicle: 'car' }), null);
    assert.strictEqual(sanitizePlayerPayload({ id: 'p1', lng: 0, lat: -999, bearing: 0, v: 0, vehicle: 'car' }), null);
    assert.strictEqual(sanitizePlayerPayload({ id: 'p1', lng: NaN, lat: 0, bearing: 0, v: 0, vehicle: 'car' }), null);
});

test('getRoomTopic - sanitizes room code inputs into MQTT topic paths', () => {
    assert.strictEqual(getRoomTopic(''), 'georide/global/pro');
    assert.strictEqual(getRoomTopic('  VIP_Room_123! '), 'georide/room/vip_room_123');
    assert.strictEqual(getRoomTopic(null), 'georide/global/pro');
});

test('cleanupInactivePlayers - purges stale players and calls marker removal', () => {
    let removedId = null;
    const now = 100000;
    const otherPlayers = {
        activePlayer: { lastSeen: 95000 },
        stalePlayer: {
            lastSeen: 50000,
            marker2d: {
                remove() {
                    removedId = 'stalePlayer';
                }
            }
        }
    };

    cleanupInactivePlayers(
        otherPlayers,
        (p) => {
            if (p.marker2d) p.marker2d.remove();
        },
        30000,
        now
    );

    assert.strictEqual(otherPlayers.stalePlayer, undefined);
    assert.notStrictEqual(otherPlayers.activePlayer, undefined);
    assert.strictEqual(removedId, 'stalePlayer');
});

test('renderActivePlayers builds HUD player list elements cleanly', () => {
    const mockList = {
        textContent: '',
        children: [],
        appendChild(child) {
            this.children.push(child);
        }
    };

    const origDoc = globalThis.document;
    globalThis.document = {
        getElementById(id) {
            return id === 'mp-players-list' ? mockList : null;
        },
        createElement(_tag) {
            return {
                className: '',
                textContent: '',
                append(...nodes) {
                    this.nodes = nodes;
                }
            };
        }
    };

    globalThis.window = globalThis.window || {};
    delete globalThis.window.lastPlayerIdList;

    state.otherPlayers = {
        peer2: { vehicle: 'sports' }
    };

    renderActivePlayers();
    assert.strictEqual(mockList.children.length, 2);

    globalThis.document = origDoc;
});

test('updateOtherPlayers calculates dead reckoning position movement', () => {
    let setLngLatCalled = null;

    const mockMap = {};
    const origMapboxgl = globalThis.mapboxgl;

    globalThis.mapboxgl = {
        Marker: class {
            constructor() {}
            setLngLat(coords) {
                setLngLatCalled = coords;
                return this;
            }
            setRotation() {
                return this;
            }
            addTo() {
                return this;
            }
        }
    };

    state.otherPlayers = {
        remotePlayer: {
            lng: 20.0,
            lat: 44.0,
            bearing: 0,
            velocity: 100,
            targetLng: 20.01,
            targetLat: 44.01,
            targetBearing: 10,
            vehicle: 'car'
        }
    };

    const origDoc = globalThis.document;
    globalThis.document = {
        createElement() {
            return { dataset: {}, style: {} };
        }
    };

    updateOtherPlayers(1.0, mockMap);

    const p = state.otherPlayers.remotePlayer;
    assert.notStrictEqual(p.lat, 44.0);
    assert.notStrictEqual(p.lng, 20.0);

    globalThis.document = origDoc;
    globalThis.mapboxgl = origMapboxgl;
});

test('initMultiplayer initializes MQTT client, handlers, room join and disconnect actions', () => {
    let connectedOptions = null;
    let subscribedTopic = null;

    class MockMQTTClient {
        constructor(host, port, id) {
            this.host = host;
            this.port = port;
            this.id = id;
            this.isConnected = () => true;
        }
        connect(options) {
            connectedOptions = options;
            if (options && options.onSuccess) options.onSuccess();
        }
        subscribe(topic) {
            subscribedTopic = topic;
        }
        send() {}
        disconnect() {}
    }

    class MockMQTTMessage {
        constructor(payload) {
            this.payloadString = payload;
        }
    }

    const origWindow = globalThis.window;
    const origDoc = globalThis.document;

    const mockButtons = {};
    const createMockElement = (id) => ({
        id,
        textContent: '',
        style: {},
        value: 'alpha_room',
        classList: { add() {}, remove() {} },
        addEventListener() {}
    });

    globalThis.window = globalThis.window || {};
    delete globalThis.window.mpInitialized;

    globalThis.window.Paho = {
        MQTT: {
            Client: MockMQTTClient,
            Message: MockMQTTMessage
        }
    };
    globalThis.window.navigator = { clipboard: { writeText() {} } };

    globalThis.document = {
        getElementById(id) {
            if (!mockButtons[id]) mockButtons[id] = createMockElement(id);
            return mockButtons[id];
        },
        createElement(_tag) {
            return {
                className: '',
                textContent: '',
                dataset: {},
                style: {},
                append(...nodes) {
                    this.nodes = nodes;
                }
            };
        }
    };

    initMultiplayer();

    // Trigger Join Button Click
    if (mockButtons['join-mp-btn'] && mockButtons['join-mp-btn'].onclick) {
        mockButtons['join-mp-btn'].onclick();
    }

    assert.strictEqual(subscribedTopic, 'georide/room/alpha_room');

    // Trigger Disconnect Button Click
    if (mockButtons['disconnect-mp-btn'] && mockButtons['disconnect-mp-btn'].onclick) {
        mockButtons['disconnect-mp-btn'].onclick();
    }

    stopMultiplayerTimers();

    globalThis.window = origWindow;
    globalThis.document = origDoc;
});
