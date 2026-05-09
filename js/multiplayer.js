import { state } from './state.js';
import { VEHICLE_CONFIG } from './config.js';
import { updateToggleStates } from './ui.js';
import { setup3DVehicleLayer, setupVehicleMarker } from './three-manager.js';

let client;
let currentTopic = "georide/global/pro";
let myId = 'p_' + Math.random().toString(36).substr(2, 4);
let lastSent = { lng: 0, lat: 0, bearing: 0, velocity: 0, vehicle: '' };
let isManualDisconnect = false;

const Paho = window.Paho;

export function initMultiplayer() {
    if (window.mpInitialized) return;
    window.mpInitialized = true;

    const myPeerIdEl = document.getElementById('my-peer-id');
    const copyBtn = document.getElementById('copy-id-btn');
    const joinBtn = document.getElementById('join-mp-btn');
    const joinInput = document.getElementById('join-peer-id');
    const disconnectBtn = document.getElementById('disconnect-mp-btn');
    const mpStatusDot = document.getElementById('mp-status-dot');
    const statusLabel = document.getElementById('mp-connection-status');
    const mpPlayersList = document.getElementById('mp-players-list');

    if (myPeerIdEl) myPeerIdEl.textContent = myId.toUpperCase();

    client = new Paho.MQTT.Client("broker.hivemq.com", 8884, "georide_" + myId);

    client.onConnectionLost = (responseObject) => {
        console.log("MQTT Connection Lost:", responseObject.errorMessage);
        mpStatusDot?.classList.remove('online');
        if (!isManualDisconnect) {
            setTimeout(() => {
                if (!isManualDisconnect) client.connect({ onSuccess: onConnect, useSSL: true });
            }, 3000);
        }
    };

    client.onMessageArrived = (message) => {
        try {
            const data = JSON.parse(message.payloadString);
            if (data.id === myId) return;

            if (!state.otherPlayers[data.id]) {
                state.otherPlayers[data.id] = {
                    lng: data.lng,
                    lat: data.lat,
                    bearing: data.bearing,
                    vehicle: data.vehicle || 'car',
                    targetLng: data.lng,
                    targetLat: data.lat,
                    targetBearing: data.bearing,
                    lastSeen: Date.now()
                };
            } else {
                const p = state.otherPlayers[data.id];
                p.targetLng = data.lng;
                p.targetLat = data.lat;
                p.targetBearing = data.bearing;
                p.velocity = data.v || 0;
                p.vehicle = data.vehicle || 'car';
                p.lastSeen = Date.now();
            }
            renderActivePlayers();
        } catch (e) { }
    };

    function onConnect() {
        console.log("MQTT Connected to:", currentTopic);
        mpStatusDot?.classList.add('online');
        client.subscribe(currentTopic);
        if (disconnectBtn) disconnectBtn.style.display = 'block';
        renderActivePlayers();
        startSyncTimers();
    }

    let broadcastTimer = null;
    let cleanupTimer = null;

    function startSyncTimers() {
        if (!broadcastTimer) {
            broadcastTimer = setInterval(() => {
                if (client && client.isConnected && client.isConnected()) {
                    // FIX: Only send if data changed significantly
                    const changed = Math.abs(state.lng - lastSent.lng) > 0.000001 || 
                                    Math.abs(state.lat - lastSent.lat) > 0.000001 || 
                                    Math.abs(state.bearing - lastSent.bearing) > 0.1 ||
                                    state.activeVehicle !== lastSent.vehicle;

                    if (changed) {
                        const message = new Paho.MQTT.Message(JSON.stringify({
                            id: myId,
                            lng: state.lng,
                            lat: state.lat,
                            bearing: state.bearing,
                            v: state.velocity,
                            vehicle: state.activeVehicle,
                            t: Date.now()
                        }));
                        message.destinationName = currentTopic;
                        client.send(message);
                        
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
                const now = Date.now();
                Object.keys(state.otherPlayers).forEach(id => {
                    if (now - state.otherPlayers[id].lastSeen > 30000) {
                        const p = state.otherPlayers[id];
                        if (p.marker2d) p.marker2d.remove();
                        delete state.otherPlayers[id];
                    }
                });
                renderActivePlayers();
            }, 5000);
        }
    }

    if (joinBtn) {
        joinBtn.onclick = () => {
            const targetCode = joinInput.value.trim().toLowerCase();
            isManualDisconnect = false;
            if (targetCode) {
                joinBtn.textContent = 'CONNECTING...';
                
                // CRITICAL: Cleanup old client to prevent memory leaks
                if (client) {
                    try {
                        client.onConnectionLost = null;
                        client.onMessageArrived = null;
                        if (client.isConnected()) client.disconnect();
                    } catch (e) {}
                    client = null;
                }

                // Create fresh client
                client = new Paho.MQTT.Client("broker.hivemq.com", 8884, "georide_" + myId + "_" + Date.now().toString(36));

                client.onConnectionLost = (responseObject) => {
                    console.log("MQTT Connection Lost:", responseObject.errorMessage);
                    mpStatusDot?.classList.remove('online');
                    if (!isManualDisconnect) {
                        if (window.reconnectTimeout) clearTimeout(window.reconnectTimeout);
                        window.reconnectTimeout = setTimeout(() => {
                            if (!isManualDisconnect && client) client.connect({ onSuccess: onConnectSuccess, onFailure: onConnectFailure, useSSL: true });
                        }, 3000);
                    }
                };

                client.onMessageArrived = (message) => {
                    try {
                        const data = JSON.parse(message.payloadString);
                        if (data.id === myId) return;
                        if (!state.otherPlayers[data.id]) {
                            state.otherPlayers[data.id] = {
                                lng: data.lng, lat: data.lat, bearing: data.bearing,
                                vehicle: data.vehicle || 'car', targetLng: data.lng,
                                targetLat: data.lat, targetBearing: data.bearing, lastSeen: Date.now()
                            };
                        } else {
                            const p = state.otherPlayers[data.id];
                            p.targetLng = data.lng; p.targetLat = data.lat; p.targetBearing = data.bearing;
                            p.velocity = data.v || 0; p.vehicle = data.vehicle || 'car'; p.lastSeen = Date.now();
                        }
                        renderActivePlayers();
                    } catch (e) { }
                };

                const onConnectSuccess = () => {
                    console.log("MQTT Connected to:", targetCode);
                    mpStatusDot?.classList.add('online');
                    
                    joinBtn.style.display = 'none';
                    joinInput.style.display = 'none';

                    if (statusLabel) {
                        statusLabel.textContent = 'CONNECTED TO: ' + targetCode.toUpperCase();
                        statusLabel.style.color = '#00ff88';
                    }
                    if (disconnectBtn) disconnectBtn.style.display = 'block';
                    if (mpPlayersList) mpPlayersList.style.display = 'block';
                    
                    currentTopic = "georide/room/" + targetCode;
                    client.subscribe(currentTopic);
                    startSyncTimers();
                    renderActivePlayers();
                };

                const onConnectFailure = (err) => {
                    console.error("MQTT Connect Failure:", err);
                    joinBtn.textContent = 'ERROR';
                    joinBtn.style.background = '#ff0055';
                    setTimeout(() => { joinBtn.textContent = 'JOIN ROOM'; joinBtn.style.background = ''; }, 3000);
                };

                client.connect({ 
                    onSuccess: onConnectSuccess, 
                    onFailure: onConnectFailure, 
                    useSSL: true,
                    timeout: 10,
                    keepAliveInterval: 30
                });

                // MP Settings
                state.is3D = false;
                state.is3DBuildings = false;
                state.collisionsEnabled = false;
                updateToggleStates();
                setup3DVehicleLayer(window.map);
                setupVehicleMarker(window.map);
            }
        };

        joinInput.oninput = null; // No longer needed
    }

    if (disconnectBtn) {
        disconnectBtn.onclick = () => {
            isManualDisconnect = true;
            if (client && client.isConnected && client.isConnected()) client.disconnect();
            
            if (broadcastTimer) { clearInterval(broadcastTimer); broadcastTimer = null; }
            if (cleanupTimer) { clearInterval(cleanupTimer); cleanupTimer = null; }
            
            disconnectBtn.style.display = 'none';
            if (statusLabel) {
                statusLabel.textContent = 'NOT CONNECTED';
                statusLabel.style.color = '#ff4b4b';
            }
            if (mpPlayersList) mpPlayersList.style.display = 'none';
            
            joinInput.style.display = 'block';
            joinInput.disabled = false;
            joinInput.style.opacity = '1';
            joinInput.value = '';
            
            joinBtn.style.display = 'block';
            joinBtn.disabled = false;
            joinBtn.textContent = 'JOIN ROOM';
            joinBtn.style.background = '';
            joinBtn.style.opacity = '1';
            joinBtn.style.cursor = 'pointer';
            
            Object.keys(state.otherPlayers).forEach(id => {
                if (state.otherPlayers[id].marker2d) state.otherPlayers[id].marker2d.remove();
                delete state.otherPlayers[id];
            });
            renderActivePlayers();
        };
    }

    if (copyBtn) {
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(myId.toUpperCase());
            copyBtn.textContent = 'OK';
            setTimeout(() => { copyBtn.textContent = 'COPY'; }, 1000);
        };
    }
}

export function renderActivePlayers() {
    const mpPlayersList = document.getElementById('mp-players-list');
    if (!mpPlayersList) return;

    const activePlayers = [{ id: myId, vehicle: state.activeVehicle, isSelf: true }, 
        ...Object.keys(state.otherPlayers).map(id => ({ id, vehicle: state.otherPlayers[id].vehicle, isSelf: false }))];

    mpPlayersList.innerHTML = activePlayers.map(p => {
        const label = p.isSelf ? 'YOU' : p.vehicle.toUpperCase();
        return `<div class="mp-player-entry ${p.isSelf ? 'mp-player-self' : ''}"><span class="mp-player-id">${p.id.toUpperCase()}</span><span class="mp-player-vehicle">${label}</span></div>`;
    }).join('');
}

export function updateOtherPlayers(dtFinal, map) {
    Object.keys(state.otherPlayers).forEach(id => {
        const p = state.otherPlayers[id];

        if (p.velocity && Math.abs(p.velocity) > 0.0001) {
            const rad = (p.bearing) * (Math.PI / 180);
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

        if (!p.marker2d) {
            const config = VEHICLE_CONFIG[p.vehicle || 'car'];
            const el = document.createElement('div');
            el.className = 'other-player-marker';
            el.dataset.vehicle = p.vehicle || 'car';
            el.innerHTML = config.svg;
            p.marker2d = new mapboxgl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' })
                .setLngLat([p.lng, p.lat]).setRotation(p.bearing).addTo(map);
        } else {
            // Update marker icon if vehicle type changed
            const el = p.marker2d.getElement();
            if (el.dataset.vehicle !== p.vehicle) {
                const config = VEHICLE_CONFIG[p.vehicle || 'car'];
                el.innerHTML = config.svg;
                el.dataset.vehicle = p.vehicle;
            }
            p.marker2d.setLngLat([p.lng, p.lat]);
            p.marker2d.setRotation(p.bearing);
        }
    });
}
