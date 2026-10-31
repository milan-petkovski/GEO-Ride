/**
 * @file multiplayer.js
 * @description Real-time multiplayer synchronization engine over MQTT (HiveMQ broker/Paho WebSockets), featuring payload sanitization, client-side rate-limiting, and remote player marker rendering.
 */

import { state } from './state.js';
import { VEHICLE_CONFIG } from './config.js';
import { updateToggleStates, showToast } from './ui.js';
import { setup3DVehicleLayer, setupVehicleMarker } from './three-manager.js';
import { trackEvent } from './analytics.js';
import { MpClient } from './mp-client.js';
import { createBuffer, pushSample, sampleBuffer, INTERP_DELAY_MS } from './mp-interp.js';
import { FLAG_DRIFT, FLAG_BRAKE, FLAG_FLASH, FLAG_TELEPORT } from './mp-protocol.js';

let client;
let currentTopic = 'georide/global/pro';
let myId = 'p_' + Math.random().toString(36).substr(2, 4);
let lastSent = { lng: 0, lat: 0, bearing: 0, velocity: 0, vehicle: '' };
let isManualDisconnect = false;

/** Game server WebSocket URL. When empty (or unreachable) the legacy MQTT transport is used. */
const MP_URL =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_MP_URL) ||
    (typeof process !== 'undefined' && process.env && process.env.VITE_MP_URL) ||
    '';

/** @type {MpClient|null} */
let mpClient = null;
let serverSyncTimer = null;
let lastUpload = { lng: 0, lat: 0, bearing: 0, speed: 0, steer: 0, flags: 0, vehicle: '', at: 0 };

const Paho = typeof window !== 'undefined' ? window.Paho : null;

function getPaho() {
    return typeof window !== 'undefined' && window.Paho ? window.Paho : Paho;
}

// Rate limiting & validation state
const playerMessageTimes = new Map();
let broadcastTimer = null;
let cleanupTimer = null;

/**
 * Stops multiplayer timers and disconnects MQTT client (useful for teardown and unit tests).
 * @returns {void}
 */
export function stopMultiplayerTimers() {
    isManualDisconnect = true;
    stopServerClient();
    if (typeof window !== 'undefined') {
        window.mpInitialized = false;
        if (window.reconnectTimeout) {
            clearTimeout(window.reconnectTimeout);
            window.reconnectTimeout = null;
        }
    }
    if (broadcastTimer) {
        clearInterval(broadcastTimer);
        broadcastTimer = null;
    }
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
    }
    if (client) {
        try {
            client.onConnectionLost = null;
            client.onMessageArrived = null;
            if (client.isConnected && client.isConnected()) client.disconnect();
        } catch (_e) {}
        client = null;
    }
}

/**
 * Returns active MQTT client instance.
 * @returns {Object|null}
 */
export function getMqttClient() {
    return client;
}

/**
 * @typedef {Object} PlayerPayload
 * @property {string} id - Unique peer player ID string.
 * @property {number} lng - Longitude coordinate in valid range [-180, 180].
 * @property {number} lat - Latitude coordinate in valid range [-90, 90].
 * @property {number} bearing - Heading angle normalized in range [0, 360).
 * @property {number} v - Vehicle velocity scalar.
 * @property {string} vehicle - Drivable vehicle type string.
 */

/**
 * Validates and sanitizes raw incoming MQTT payload objects against XSS vectors and malformed values.
 * @param {*} raw - Raw unparsed or parsed message object.
 * @returns {PlayerPayload|null} Sanitized player payload or null if invalid.
 */
export function sanitizePlayerPayload(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const { id, lng, lat, bearing, v, vehicle } = raw;
    if (typeof id !== 'string' || id.length < 2 || id.length > 64) return null;
    if (typeof lng !== 'number' || isNaN(lng) || lng < -180 || lng > 180) return null;
    if (typeof lat !== 'number' || isNaN(lat) || lat < -90 || lat > 90) return null;
    if (typeof bearing !== 'number' || isNaN(bearing)) return null;

    const sanitizedV = typeof v === 'number' && !isNaN(v) ? Math.max(-300, Math.min(300, v)) : 0;
    const allowedVehicles = ['car', 'sports', 'truck', 'bus', 'cyber', 'supercar', 'suv', 'taxi', 'police'];
    const sanitizedVehicle = allowedVehicles.includes(vehicle) ? vehicle : 'car';

    return {
        id,
        lng,
        lat,
        bearing: ((bearing % 360) + 360) % 360,
        v: sanitizedV,
        vehicle: sanitizedVehicle
    };
}

/**
 * Purges inactive multiplayer players from local state dictionary if no updates arrive within maxAgeMs.
 * @param {Object} otherPlayers - Map of player records.
 * @param {Function} [removeCallback] - Cleanup callback function.
 * @param {number} [maxAgeMs=30000] - Expiration threshold in ms.
 * @param {number} [now=Date.now()] - Timestamp reference.
 * @returns {void}
 */
export function cleanupInactivePlayers(otherPlayers, removeCallback, maxAgeMs = 30000, now = Date.now()) {
    if (!otherPlayers) return;
    Object.keys(otherPlayers).forEach((id) => {
        if (now - otherPlayers[id].lastSeen > maxAgeMs) {
            if (typeof removeCallback === 'function') {
                removeCallback(otherPlayers[id]);
            }
            playerMessageTimes.delete(id);
            delete otherPlayers[id];
        }
    });
}

/**
 * Formats a sanitized room code string into a deterministic MQTT topic path.
 * @param {string} roomCode - Raw input room code.
 * @returns {string} Sanitized topic path string.
 */
export function getRoomTopic(roomCode) {
    if (!roomCode || typeof roomCode !== 'string') return 'georide/global/pro';
    const sanitized = roomCode
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '');
    return sanitized ? 'georide/room/' + sanitized : 'georide/global/pro';
}

/**
 * Returns the active game server client, if the WebSocket transport is in use.
 * @returns {MpClient|null}
 */
export function getMpClient() {
    return mpClient;
}

/**
 * Captures the local vehicle state in wire format, including drift, brake and light flags.
 * @param {Object} [st=state] - Game state object.
 * @returns {{lng:number,lat:number,bearing:number,speed:number,steer:number,flags:number,vehicle:string}}
 */
export function collectLocalState(st = state) {
    let flags = 0;
    if (st.isDrifting) flags |= FLAG_DRIFT;
    if (st.keys && (st.keys.s || st.keys[' ']) && st.velocity > 0.02) flags |= FLAG_BRAKE;
    if (st.headlightFlashActive) flags |= FLAG_FLASH;
    return {
        lng: st.lng,
        lat: st.lat,
        bearing: st.bearing,
        speed: st.velocity || 0,
        steer: st.steeringAngle || 0,
        flags,
        vehicle: st.activeVehicle
    };
}

/**
 * Decides whether a new state packet is worth sending (movement, orientation, flags) or a heartbeat is due.
 * @param {Object} cur - Current local state.
 * @param {Object} last - Previously uploaded state with an `at` timestamp.
 * @param {number} now - Current time in milliseconds.
 * @returns {boolean}
 */
export function shouldUpload(cur, last, now) {
    if (!last.at) return true;
    if (now - last.at >= 500) return true;
    return (
        Math.abs(cur.lng - last.lng) > 1e-7 ||
        Math.abs(cur.lat - last.lat) > 1e-7 ||
        Math.abs(cur.bearing - last.bearing) > 0.1 ||
        Math.abs(cur.speed - last.speed) > 0.0005 ||
        cur.flags !== last.flags ||
        cur.vehicle !== last.vehicle
    );
}

function startServerSync() {
    stopServerSync();
    lastUpload = { lng: 0, lat: 0, bearing: 0, speed: 0, steer: 0, flags: 0, vehicle: '', at: 0 };
    serverSyncTimer = setInterval(() => {
        if (!mpClient || !mpClient.isOpen) return;
        const now = Date.now();
        const cur = collectLocalState();
        if (!shouldUpload(cur, lastUpload, now)) return;

        // A jump of more than about 50 m between packets is a teleport or reset: tell peers to snap, not slide.
        const jump =
            !lastUpload.at ||
            Math.hypot(cur.lat - lastUpload.lat, (cur.lng - lastUpload.lng) * Math.cos((cur.lat * Math.PI) / 180)) >
                0.0005;
        const flags = cur.flags | (jump || state.isTeleporting ? FLAG_TELEPORT : 0);
        if (mpClient.sendState({ ...cur, flags })) lastUpload = { ...cur, at: now };
    }, 50);
}

function stopServerSync() {
    if (serverSyncTimer) clearInterval(serverSyncTimer);
    serverSyncTimer = null;
}

/**
 * Closes the game server connection and stops state uploads.
 * @returns {void}
 */
export function stopServerClient() {
    stopServerSync();
    if (mpClient) {
        const c = mpClient;
        mpClient = null;
        c.close();
    }
}

/**
 * Creates or updates a remote player record backed by a snapshot buffer.
 * @param {number} slot - Server assigned player slot.
 * @param {{name?:string,vehicle?:string}} [info]
 * @returns {Object} Remote player record.
 */
export function ensureRemote(slot, info = {}) {
    const id = 's' + slot;
    let p = state.otherPlayers[id];
    if (!p) {
        p = {
            id,
            slot,
            name: info.name || 'P' + slot,
            vehicle: info.vehicle || 'car',
            lng: 0,
            lat: 0,
            bearing: 0,
            velocity: 0,
            flags: 0,
            positioned: false,
            buf: createBuffer(),
            lastSeen: Date.now()
        };
        state.otherPlayers[id] = p;
    } else {
        if (info.name) p.name = info.name;
        if (info.vehicle) p.vehicle = info.vehicle;
    }
    return p;
}

/**
 * Removes a remote player and its map marker.
 * @param {number} slot
 * @returns {void}
 */
export function removeRemote(slot) {
    const id = 's' + slot;
    const p = state.otherPlayers[id];
    if (p && p.marker2d && typeof p.marker2d.remove === 'function') p.marker2d.remove();
    delete state.otherPlayers[id];
}

/**
 * Feeds a decoded server snapshot into the per player interpolation buffers.
 * @param {{time:number, players:Array<Object>}} snap
 * @returns {void}
 */
export function applySnapshot(snap) {
    const received = Date.now();
    for (const rec of snap.players) {
        const p = ensureRemote(rec.slot);
        pushSample(p.buf, {
            time: snap.time,
            lng: rec.lng,
            lat: rec.lat,
            bearing: rec.bearing,
            speed: rec.speed,
            steer: rec.steer,
            flags: rec.flags,
            teleport: (rec.flags & FLAG_TELEPORT) !== 0
        });
        p.vehicle = rec.vehicle;
        p.velocity = rec.speed;
        p.flags = rec.flags;
        p.lastSeen = received;
        if (!p.positioned) {
            p.lng = rec.lng;
            p.lat = rec.lat;
            p.bearing = rec.bearing;
            p.positioned = true;
        }
    }
}

/**
 * Initializes multiplayer event handlers, MQTT client connection, and HUD UI elements.
 * @returns {void}
 */
export function initMultiplayer() {
    if (window.mpInitialized) return;
    window.mpInitialized = true;

    const myPeerIdEl = document.getElementById('my-peer-id');
    const mobileMyPeerIdEl = document.getElementById('mobile-my-peer-id');

    const copyBtn = document.getElementById('copy-id-btn');
    const mobileCopyBtn = document.getElementById('mobile-copy-id-btn');

    const joinBtn = document.getElementById('join-mp-btn');
    const mobileJoinBtn = document.getElementById('mobile-join-mp-btn');

    const joinInput = document.getElementById('join-peer-id');
    const mobileJoinInput = document.getElementById('mobile-join-peer-id');

    const disconnectBtn = document.getElementById('disconnect-mp-btn');
    const mobileDisconnectBtn = document.getElementById('mobile-disconnect-mp-btn');

    const mpStatusDot = document.getElementById('mp-status-dot');
    const statusLabel = document.getElementById('mp-connection-status');
    const mobileStatusLabel = document.getElementById('mobile-mp-connection-status');

    const mpPlayersList = document.getElementById('mp-players-list');
    const mobileMpPlayersList = document.getElementById('mobile-mp-players-list');

    if (myPeerIdEl) myPeerIdEl.textContent = myId.toUpperCase();
    if (mobileMyPeerIdEl) mobileMyPeerIdEl.textContent = myId.toUpperCase();

    const paho = getPaho();
    if (paho && paho.MQTT) {
        client = new paho.MQTT.Client('broker.hivemq.com', 8884, 'georide_' + myId);
    }

    if (!client) return;

    client.onConnectionLost = (responseObject) => {
        console.log('MQTT Connection Lost:', responseObject.errorMessage);
        mpStatusDot?.classList.remove('online');
        if (!isManualDisconnect) {
            setTimeout(() => {
                if (!isManualDisconnect) client.connect({ onSuccess: onConnect, useSSL: true });
            }, 3000);
        }
    };

    client.onMessageArrived = (message) => {
        try {
            const rawData = JSON.parse(message.payloadString);
            const data = sanitizePlayerPayload(rawData);
            if (!data || data.id === myId) return;

            // Rate-limiting check per sender (max 20 messages / sec)
            const now = Date.now();
            const lastMsgTime = playerMessageTimes.get(data.id) || 0;
            if (now - lastMsgTime < 45) return;
            playerMessageTimes.set(data.id, now);

            if (!state.otherPlayers[data.id]) {
                state.otherPlayers[data.id] = {
                    lng: data.lng,
                    lat: data.lat,
                    bearing: data.bearing,
                    vehicle: data.vehicle,
                    targetLng: data.lng,
                    targetLat: data.lat,
                    targetBearing: data.bearing,
                    lastSeen: now
                };
            } else {
                const p = state.otherPlayers[data.id];
                p.targetLng = data.lng;
                p.targetLat = data.lat;
                p.targetBearing = data.bearing;
                p.velocity = data.v;
                p.vehicle = data.vehicle;
                p.lastSeen = now;
            }
            renderActivePlayers();
        } catch (_e) {}
    };

    function onConnect() {
        console.log('MQTT Connected to:', currentTopic);
        mpStatusDot?.classList.add('online');
        client.subscribe(currentTopic);
        if (disconnectBtn) disconnectBtn.style.display = 'block';
        if (mobileDisconnectBtn) mobileDisconnectBtn.style.display = 'block';
        renderActivePlayers();
        startSyncTimers();
    }

    function startSyncTimers() {
        if (!broadcastTimer) {
            broadcastTimer = setInterval(() => {
                if (client && client.isConnected && client.isConnected()) {
                    // FIX: Only send if data changed significantly
                    const changed =
                        Math.abs(state.lng - lastSent.lng) > 0.000001 ||
                        Math.abs(state.lat - lastSent.lat) > 0.000001 ||
                        Math.abs(state.bearing - lastSent.bearing) > 0.1 ||
                        state.activeVehicle !== lastSent.vehicle;

                    if (changed) {
                        const paho = getPaho();
                        if (paho && paho.MQTT) {
                            const message = new paho.MQTT.Message(
                                JSON.stringify({
                                    id: myId,
                                    lng: state.lng,
                                    lat: state.lat,
                                    bearing: state.bearing,
                                    v: state.velocity,
                                    vehicle: state.activeVehicle,
                                    t: Date.now()
                                })
                            );
                            message.destinationName = currentTopic;
                            client.send(message);
                        }

                        lastSent = {
                            lng: state.lng,
                            lat: state.lat,
                            bearing: state.bearing,
                            velocity: state.velocity,
                            vehicle: state.activeVehicle
                        };
                    }
                }
            }, 100); // Increased interval slightly to 100ms for better stability
        }

        if (!cleanupTimer) {
            cleanupTimer = setInterval(() => {
                cleanupInactivePlayers(state.otherPlayers, (player) => {
                    if (player.marker2d) player.marker2d.remove();
                });
                renderActivePlayers();
            }, 5000);
        }
    }

    const applyMpSettings = () => {
        state.is3D = false;
        state.is3DBuildings = false;
        state.collisionsEnabled = false;
        updateToggleStates();
        setup3DVehicleLayer(window.map);
        setupVehicleMarker(window.map);
    };

    const setJoinButtonsText = (text, background = '') => {
        [joinBtn, mobileJoinBtn].forEach((btn) => {
            if (!btn) return;
            btn.textContent = text;
            btn.style.background = background;
        });
    };

    const setStatusText = (text, color) => {
        [statusLabel, mobileStatusLabel].forEach((el) => {
            if (!el) return;
            el.textContent = text;
            el.style.color = color;
        });
    };

    const showConnectedUI = (label) => {
        [joinBtn, joinInput, mobileJoinBtn, mobileJoinInput].forEach((el) => {
            if (el) el.style.display = 'none';
        });
        [disconnectBtn, mobileDisconnectBtn, mpPlayersList, mobileMpPlayersList].forEach((el) => {
            if (el) el.style.display = 'block';
        });
        setStatusText(label, '#00ff88');
    };

    /**
     * Joins a room on the GEO Ride game server. Falls back to the legacy MQTT transport when the server
     * cannot be reached before the first welcome message.
     */
    const joinViaServer = (targetCode, fallback) => {
        stopServerClient();
        setJoinButtonsText('CONNECTING...');
        let welcomed = false;
        let roomLabel = targetCode.toUpperCase();

        const client = new MpClient(MP_URL, {
            onStatus: (status) => {
                if (mpClient !== client) return;
                if (status === 'online') mpStatusDot?.classList.add('online');
                else mpStatusDot?.classList.remove('online');

                if (status === 'reconnecting') setStatusText('RECONNECTING...', '#ffb800');
                if (status === 'failed') {
                    stopServerClient();
                    if (!welcomed) {
                        fallback();
                    } else {
                        handleDisconnect();
                        if (typeof showToast === 'function') {
                            showToast('CONNECTION LOST', 'The multiplayer server is not reachable. Please rejoin.');
                        }
                    }
                }
            },
            onWelcome: (msg) => {
                welcomed = true;
                Object.keys(state.otherPlayers).forEach((id) => {
                    if (state.otherPlayers[id].slot) removeRemote(state.otherPlayers[id].slot);
                });
                msg.players.forEach((pl) => ensureRemote(pl.slot, pl));
                roomLabel = String(msg.room || targetCode).toUpperCase();
                showConnectedUI('CONNECTED TO: ' + roomLabel);
                applyMpSettings();
                startServerSync();
                renderActivePlayers();
                trackEvent('multiplayer_room_connect', { room: msg.room, transport: 'ws' });
            },
            onJoined: (msg) => {
                ensureRemote(msg.slot, msg);
                renderActivePlayers();
            },
            onLeft: (msg) => {
                removeRemote(msg.slot);
                renderActivePlayers();
            },
            onSnapshot: applySnapshot,
            onLatency: (rtt) => {
                if (welcomed) setStatusText(`CONNECTED TO: ${roomLabel} (${Math.round(rtt)} ms)`, '#00ff88');
            },
            onFull: (cap) => {
                setJoinButtonsText('JOIN ROOM');
                stopServerClient();
                if (typeof showToast === 'function') {
                    showToast('ROOM FULL', `This room has reached its limit of ${cap} players.`);
                }
            },
            onError: (code) => {
                if (code === 'server_busy' && typeof showToast === 'function') {
                    showToast('SERVER BUSY', 'Multiplayer is very busy right now. Please try again shortly.');
                }
            }
        });

        mpClient = client;
        const email = typeof localStorage !== 'undefined' ? localStorage.getItem('geo_ride_pro_email') : null;
        client.connect({ room: targetCode, name: myId.toUpperCase(), vehicle: state.activeVehicle, email });
    };

    const handleJoin = (targetCode, _activeBtn) => {
        isManualDisconnect = false;
        const cleanCode = targetCode && targetCode.trim() !== '' ? targetCode.trim().toLowerCase() : 'public';
        trackEvent('multiplayer_join', {
            room_type: cleanCode === 'public' ? 'public_lobby' : 'custom_room',
            vehicle: state.activeVehicle
        });

        const startMqtt = () => {
            if (joinBtn) joinBtn.textContent = 'CONNECTING...';
            if (mobileJoinBtn) mobileJoinBtn.textContent = 'CONNECTING...';

            // CRITICAL: Cleanup old client to prevent memory leaks
            if (client) {
                try {
                    client.onConnectionLost = null;
                    client.onMessageArrived = null;
                    if (client.isConnected()) client.disconnect();
                } catch (_e) {}
                client = null;
            }

            // Create fresh client
            const paho = getPaho();
            if (paho && paho.MQTT) {
                client = new paho.MQTT.Client(
                    'broker.hivemq.com',
                    8884,
                    'georide_' + myId + '_' + Date.now().toString(36)
                );
            }

            client.onConnectionLost = (responseObject) => {
                console.log('MQTT Connection Lost:', responseObject.errorMessage);
                mpStatusDot?.classList.remove('online');
                if (!isManualDisconnect) {
                    if (window.reconnectTimeout) clearTimeout(window.reconnectTimeout);
                    window.reconnectTimeout = setTimeout(() => {
                        if (!isManualDisconnect && client)
                            client.connect({
                                onSuccess: onConnectSuccess,
                                onFailure: onConnectFailure,
                                useSSL: true
                            });
                    }, 3000);
                }
            };

            client.onMessageArrived = (message) => {
                try {
                    const rawData = JSON.parse(message.payloadString);
                    const data = sanitizePlayerPayload(rawData);
                    if (!data || data.id === myId) return;

                    const now = Date.now();
                    const lastMsgTime = playerMessageTimes.get(data.id) || 0;
                    if (now - lastMsgTime < 45) return;
                    playerMessageTimes.set(data.id, now);

                    if (!state.otherPlayers[data.id]) {
                        state.otherPlayers[data.id] = {
                            lng: data.lng,
                            lat: data.lat,
                            bearing: data.bearing,
                            vehicle: data.vehicle,
                            targetLng: data.lng,
                            targetLat: data.lat,
                            targetBearing: data.bearing,
                            lastSeen: now
                        };
                    } else {
                        const p = state.otherPlayers[data.id];
                        p.targetLng = data.lng;
                        p.targetLat = data.lat;
                        p.targetBearing = data.bearing;
                        p.velocity = data.v;
                        p.vehicle = data.vehicle;
                        p.lastSeen = now;
                    }
                    renderActivePlayers();
                } catch (_e) {}
            };

            const onConnectSuccess = () => {
                console.log('MQTT Connected to:', cleanCode);
                mpStatusDot?.classList.add('online');

                if (joinBtn) joinBtn.style.display = 'none';
                if (joinInput) joinInput.style.display = 'none';
                if (mobileJoinBtn) mobileJoinBtn.style.display = 'none';
                if (mobileJoinInput) mobileJoinInput.style.display = 'none';

                if (statusLabel) {
                    statusLabel.textContent = 'CONNECTED TO: ' + cleanCode.toUpperCase();
                    statusLabel.style.color = '#00ff88';
                }
                if (mobileStatusLabel) {
                    mobileStatusLabel.textContent = 'CONNECTED TO: ' + cleanCode.toUpperCase();
                    mobileStatusLabel.style.color = '#00ff88';
                }

                if (disconnectBtn) disconnectBtn.style.display = 'block';
                if (mobileDisconnectBtn) mobileDisconnectBtn.style.display = 'block';

                if (mpPlayersList) mpPlayersList.style.display = 'block';
                if (mobileMpPlayersList) mobileMpPlayersList.style.display = 'block';

                currentTopic = getRoomTopic(cleanCode);
                client.subscribe(currentTopic);
                startSyncTimers();
                renderActivePlayers();

                trackEvent('multiplayer_room_connect', { room: cleanCode });
            };

            const onConnectFailure = (err) => {
                console.error('MQTT Connect Failure:', err);
                if (joinBtn) {
                    joinBtn.textContent = 'ERROR';
                    joinBtn.style.background = '#ff0055';
                }
                if (mobileJoinBtn) {
                    mobileJoinBtn.textContent = 'ERROR';
                    mobileJoinBtn.style.background = '#ff0055';
                }
                setTimeout(() => {
                    if (joinBtn) {
                        joinBtn.textContent = 'JOIN ROOM';
                        joinBtn.style.background = '';
                    }
                    if (mobileJoinBtn) {
                        mobileJoinBtn.textContent = 'JOIN ROOM';
                        mobileJoinBtn.style.background = '';
                    }
                }, 3000);
            };

            client.connect({
                onSuccess: onConnectSuccess,
                onFailure: onConnectFailure,
                useSSL: true,
                timeout: 10,
                keepAliveInterval: 30
            });

            applyMpSettings();
        };

        if (MP_URL && typeof WebSocket !== 'undefined') {
            joinViaServer(cleanCode, startMqtt);
        } else {
            startMqtt();
        }
    };

    if (joinBtn) {
        joinBtn.onclick = () => {
            const targetCode = joinInput.value.trim().toLowerCase();
            handleJoin(targetCode, joinBtn);
        };
    }
    if (mobileJoinBtn) {
        mobileJoinBtn.onclick = () => {
            const targetCode = mobileJoinInput.value.trim().toLowerCase();
            handleJoin(targetCode, mobileJoinBtn);
        };
    }

    const handleDisconnect = () => {
        isManualDisconnect = true;
        stopServerClient();
        playerMessageTimes.clear();
        if (client && client.isConnected && client.isConnected()) client.disconnect();

        if (broadcastTimer) {
            clearInterval(broadcastTimer);
            broadcastTimer = null;
        }
        if (cleanupTimer) {
            clearInterval(cleanupTimer);
            cleanupTimer = null;
        }

        trackEvent('multiplayer_room_disconnect', { room: currentTopic.replace('georide/room/', '') });

        if (disconnectBtn) disconnectBtn.style.display = 'none';
        if (mobileDisconnectBtn) mobileDisconnectBtn.style.display = 'none';

        if (statusLabel) {
            statusLabel.textContent = 'NOT CONNECTED';
            statusLabel.style.color = '#ff4b4b';
        }
        if (mobileStatusLabel) {
            mobileStatusLabel.textContent = 'NOT CONNECTED';
            mobileStatusLabel.style.color = '#ff4b4b';
        }

        if (mpPlayersList) mpPlayersList.style.display = 'none';
        if (mobileMpPlayersList) mobileMpPlayersList.style.display = 'none';

        if (joinInput) {
            joinInput.style.display = 'block';
            joinInput.disabled = false;
            joinInput.style.opacity = '1';
            joinInput.value = '';
        }
        if (mobileJoinInput) {
            mobileJoinInput.style.display = 'block';
            mobileJoinInput.disabled = false;
            mobileJoinInput.style.opacity = '1';
            mobileJoinInput.value = '';
        }

        if (joinBtn) {
            joinBtn.style.display = 'block';
            joinBtn.disabled = false;
            joinBtn.textContent = 'JOIN ROOM';
            joinBtn.style.background = '';
            joinBtn.style.opacity = '1';
            joinBtn.style.cursor = 'pointer';
        }
        if (mobileJoinBtn) {
            mobileJoinBtn.style.display = 'block';
            mobileJoinBtn.disabled = false;
            mobileJoinBtn.textContent = 'JOIN ROOM';
            mobileJoinBtn.style.background = '';
            mobileJoinBtn.style.opacity = '1';
            mobileJoinBtn.style.cursor = 'pointer';
        }

        Object.keys(state.otherPlayers).forEach((id) => {
            if (state.otherPlayers[id].marker2d && typeof state.otherPlayers[id].marker2d.remove === 'function') {
                state.otherPlayers[id].marker2d.remove();
            }
            delete state.otherPlayers[id];
        });
        renderActivePlayers();
    };

    if (disconnectBtn) disconnectBtn.onclick = handleDisconnect;
    if (mobileDisconnectBtn) mobileDisconnectBtn.onclick = handleDisconnect;

    const handleCopy = (btn) => {
        navigator.clipboard.writeText(myId.toUpperCase());
        trackEvent('multiplayer_copy_peer_id');
        btn.textContent = 'OK';
        setTimeout(() => {
            btn.textContent = 'COPY';
        }, 1000);
    };
    if (copyBtn) copyBtn.onclick = () => handleCopy(copyBtn);
    if (mobileCopyBtn) mobileCopyBtn.onclick = () => handleCopy(mobileCopyBtn);

    // Prevent inputs from triggering panel close when clicked or typed
    const preventPropagationEvents = ['click', 'keydown', 'keyup', 'keypress', 'focus', 'mousedown'];
    if (joinInput) {
        preventPropagationEvents.forEach((evt) => {
            joinInput.addEventListener(evt, (e) => {
                e.stopPropagation();
            }); // Bubbling phase - after panel stopPropagation
        });
    }
    if (mobileJoinInput) {
        preventPropagationEvents.forEach((evt) => {
            mobileJoinInput.addEventListener(evt, (e) => {
                e.stopPropagation();
            }); // Bubbling phase - after panel stopPropagation
        });
    }
}

/**
 * Re-renders HUD peer player listing cards in desktop and mobile panels.
 * @returns {void}
 */
export function renderActivePlayers() {
    const mpPlayersList = document.getElementById('mp-players-list');
    const mobileMpPlayersList = document.getElementById('mobile-mp-players-list');
    if (!mpPlayersList && !mobileMpPlayersList) return;

    // Build the list of player data
    const activePlayers = [
        { id: myId, vehicle: state.activeVehicle, isSelf: true },
        ...Object.keys(state.otherPlayers).map((id) => ({
            id,
            name: state.otherPlayers[id].name,
            vehicle: state.otherPlayers[id].vehicle,
            isSelf: false
        }))
    ];

    // Optimize: Only update DOM if the player count or IDs changed
    const currentIdList = activePlayers
        .map((p) => p.id + (p.name || ''))
        .sort()
        .join(',');
    if (typeof window !== 'undefined') {
        if (window.lastPlayerIdList === currentIdList) return;
        window.lastPlayerIdList = currentIdList;
    }

    const buildList = (el) => {
        if (!el) return;
        el.textContent = '';
        activePlayers.forEach((p) => {
            const entry = document.createElement('div');
            entry.className = `mp-player-entry ${p.isSelf ? 'mp-player-self' : ''}`;

            const idSpan = document.createElement('span');
            idSpan.className = 'mp-player-id';
            idSpan.textContent = (p.name || p.id).toUpperCase();

            const vehicleSpan = document.createElement('span');
            vehicleSpan.className = 'mp-player-vehicle';
            vehicleSpan.textContent = p.isSelf ? 'YOU' : p.vehicle.toUpperCase();

            entry.append(idSpan, vehicleSpan);
            el.appendChild(entry);
        });
    };

    buildList(mpPlayersList);
    buildList(mobileMpPlayersList);
}

/**
 * Updates positions and rotations of remote peer player markers on Mapbox map.
 * @param {number} dtFinal - Delta time frame multiplier.
 * @param {Object} map - Mapbox GL JS map instance.
 * @returns {void}
 */
export function updateOtherPlayers(dtFinal, map) {
    if (typeof document === 'undefined') return;
    Object.keys(state.otherPlayers).forEach((id) => {
        const p = state.otherPlayers[id];

        if (p.buf && mpClient) {
            // Game server transport: render slightly in the past between real samples (no rubber banding).
            if (!p.positioned) return;
            const s = sampleBuffer(p.buf, mpClient.serverNow() - INTERP_DELAY_MS);
            if (s) {
                p.lng = s.lng;
                p.lat = s.lat;
                p.bearing = s.bearing;
                p.flags = s.flags;
            }
        } else {
            if (p.velocity && Math.abs(p.velocity) > 0.0001) {
                const rad = p.bearing * (Math.PI / 180);
                const latRad = p.lat * (Math.PI / 180);
                const projectionFactor = 1 / Math.cos(latRad);
                p.lng += Math.sin(rad) * p.velocity * 0.0001 * projectionFactor * dtFinal;
                p.lat += Math.cos(rad) * p.velocity * 0.0001 * dtFinal;
            }

            const lerpFactor = 0.18 * dtFinal;
            if (p.targetLng != null) {
                p.lng += (p.targetLng - p.lng) * lerpFactor;
                p.lat += (p.targetLat - p.lat) * lerpFactor;
                let bDiff = p.targetBearing - p.bearing;
                while (bDiff < -180) bDiff += 360;
                while (bDiff > 180) bDiff -= 360;
                p.bearing += bDiff * lerpFactor;
            }
        }

        const peerName = String(p.name || p.id || 'PILOT')
            .toUpperCase()
            .slice(0, 14);
        const vehKey = VEHICLE_CONFIG[p.vehicle] ? p.vehicle : 'car';
        const config = VEHICLE_CONFIG[vehKey];

        if (!p.marker2d) {
            const el = document.createElement('div');
            el.className = `other-player-marker peer-${vehKey}`;
            el.dataset.vehicle = vehKey;
            el.dataset.peerName = peerName;
            if (el.style && typeof el.style.setProperty === 'function') {
                el.style.setProperty('--peer-bearing', `${-(p.bearing || 0)}deg`);
            }
            el.innerHTML = `
                <div class="mp-nametag">
                    <span class="mp-nametag-dot"></span>
                    <span class="mp-nametag-name">${peerName}</span>
                    <span class="mp-nametag-veh">${vehKey.toUpperCase()}</span>
                </div>
                <div class="other-player-vehicle">${config.svg}</div>
            `;
            p.marker2d = new mapboxgl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' })
                .setLngLat([p.lng, p.lat])
                .setRotation(p.bearing)
                .addTo(map);
        } else {
            // Update marker icon or callsign if vehicle type or name changed
            const el = p.marker2d.getElement();
            if (el && (el.dataset.vehicle !== vehKey || el.dataset.peerName !== peerName)) {
                el.className = `other-player-marker peer-${vehKey}`;
                el.dataset.vehicle = vehKey;
                el.dataset.peerName = peerName;
                el.innerHTML = `
                    <div class="mp-nametag">
                        <span class="mp-nametag-dot"></span>
                        <span class="mp-nametag-name">${peerName}</span>
                        <span class="mp-nametag-veh">${vehKey.toUpperCase()}</span>
                    </div>
                    <div class="other-player-vehicle">${config.svg}</div>
                `;
            }
            if (el && el.style && typeof el.style.setProperty === 'function') {
                el.style.setProperty('--peer-bearing', `${-(p.bearing || 0)}deg`);
            }
            p.marker2d.setLngLat([p.lng, p.lat]);
            p.marker2d.setRotation(p.bearing);
        }
    });
}
