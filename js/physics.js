import { state, saveState } from './state.js';
import { VEHICLE_CONFIG, INITIAL_CENTER } from './config.js';
import { setup3DVehicleLayer } from './three-manager.js';
import { trackEvent } from './analytics.js';
import { haptics } from './haptics.js';

let lastCollisionTrackTime = 0;

export function updatePhysics(dtFinal, map) {
    const config = VEHICLE_CONFIG[state.activeVehicle];

    if (!state.isInputFocused) {
        // Reset Logic (STARO.js style)
        if (state.keys['r']) {
            if (!state.isTeleporting) {
                const isShiftReset = state.keys['shift'];
                const [lng, lat] = isShiftReset ? INITIAL_CENTER : state.currentHome;
                const targetResetBearing = 107;

                state.velocity = 0;
                state.isTeleporting = true;
                state.isCameraAnimating = true;
                state.teleportStartTime = Date.now();
                state.teleportDuration = isShiftReset ? 4500 : 2500;
                state.teleportStart = [state.lng, state.lat];
                state.teleportEnd = [lng, lat];

                map.flyTo({
                    center: [lng, lat],
                    zoom: 18,
                    pitch: 65,
                    bearing: targetResetBearing,
                    duration: state.teleportDuration
                });

                trackEvent('vehicle_reset', {
                    is_global: isShiftReset,
                    generalized_location: "REDACTED" // Prevent PII leakage
                });

                map.once('moveend', () => {
                    if (isShiftReset) state.currentHome = [...INITIAL_CENTER];
                    state.isCameraAnimating = false;
                    state.isTeleporting = false;
                    setup3DVehicleLayer(map);
                    saveState();
                });
            }
        }

        // Disable other controls while teleporting
        if (state.isTeleporting) return;

        const isSDown = state.keys['s'] || state.keys['arrowdown'];
        const isWDown = state.keys['w'] || state.keys['arrowup'];

        if (isWDown) {
            if (state.velocity < 0) {
                state.velocity += config.brake * 1.5 * dtFinal;
                if (state.velocity >= 0) { state.velocity = 0; state.stopTime = performance.now(); state.wKeyReleasedSinceStop = false; }
            } else {
                const timeSinceStop = performance.now() - state.stopTime;
                if (state.wKeyReleasedSinceStop || timeSinceStop > 500) state.velocity += config.power * dtFinal;
                else state.velocity = 0;
            }
        } else if (isSDown) {
            if (state.velocity > 0) {
                state.velocity -= config.brake * dtFinal;
                if (state.velocity <= 0) { state.velocity = 0; state.stopTime = performance.now(); state.sKeyReleasedSinceStop = false; }
            } else {
                const timeSinceStop = performance.now() - state.stopTime;
                if (state.sKeyReleasedSinceStop || timeSinceStop > 500) state.velocity -= (config.power * 0.6) * dtFinal;
                else state.velocity = 0;
            }
        } else {
            state.velocity *= Math.pow(state.activeVehicle === 'god' ? 0.999 : 0.998, dtFinal);
            if (Math.abs(state.velocity) < 0.0001) state.velocity = 0;
        }

        if (Math.abs(state.velocity) < 0.01 && state.keys[' '] && isWDown) {
            state.isCharging = true;
            state.velocity = 0;
            state.chargeLevel = Math.min(state.chargeLevel + 0.015 * dtFinal, 1);
        } else {
            if (state.isCharging && !state.keys[' ']) {
                state.velocity = config.maxSpeed * 0.75;
                state.isCharging = false;
            } else if (!state.keys[' ']) {
                state.isCharging = false;
                state.chargeLevel = 0;
            }
        }

        state.velocity = Math.max(-config.maxSpeed / 2.5, Math.min(config.maxSpeed, state.velocity));

        const inputDir = (state.keys['a'] || state.keys['arrowleft'] ? -1 : 0) + (state.keys['d'] || state.keys['arrowright'] ? 1 : 0);
        const steeringSmooth = Math.min(config.steeringWeight * dtFinal, 0.3);
        state.steeringAngle += (inputDir * config.turnRate - state.steeringAngle) * steeringSmooth;

        if (Math.abs(state.velocity) > 0.0001) {
            const isDrifting = state.keys[' '];
            let damping = 1 / (1 + Math.abs(state.velocity) * 8);
            let turnPower = 5;
            let slipGrip = 0.15;

            if (state.activeVehicle === 'god') {
                damping = 1 / (1 + Math.abs(state.velocity) * 4);
                turnPower = 9;
                slipGrip = 0.08;
            } else if (isDrifting) {
                damping = 1;
                turnPower = 9;
                slipGrip = 0.04;
                state.velocity *= Math.pow(0.9995, dtFinal);
            }

            const turnDir = state.velocity > 0 ? 1 : -0.7;
            const bearingChange = (Math.sqrt(Math.abs(state.velocity)) * state.steeringAngle * turnPower * damping * turnDir) * dtFinal;
            state.bearing += bearingChange;
            const diff = state.bearing - state.travelBearing;
            state.travelBearing += diff * slipGrip * dtFinal;

            const rad = (state.travelBearing) * (Math.PI / 180);
            const latRad = state.lat * (Math.PI / 180);
            const projectionFactor = 1 / Math.cos(latRad);
            const nextLng = state.lng + Math.sin(rad) * state.velocity * 0.0001 * projectionFactor * dtFinal;
            const nextLat = state.lat + Math.cos(rad) * state.velocity * 0.0001 * dtFinal;

            // Optimized Collision Detection
            let collisionOccurred = false;
            let isAlreadyInside = false;
            state.collisionCheckFrame = (state.collisionCheckFrame || 0) + 1;

            if (state.collisionsEnabled && state.activeVehicle !== 'god' && Math.abs(state.velocity) > 0.01) {
                // 1. Building Collisions (Throttled for performance)
                if (state.collisionCheckFrame % 2 === 0) {
                    const currentP = map.project([state.lng, state.lat]);
                    const nextP = map.project([nextLng, nextLat]);

                    // Simple distance check to skip query if movement is micro
                    const distSq = Math.pow(nextP.x - currentP.x, 2) + Math.pow(nextP.y - currentP.y, 2);
                    if (distSq > 0.1) {
                        const combinedBbox = [[Math.min(currentP.x, nextP.x) - 14, Math.min(currentP.y, nextP.y) - 14], [Math.max(currentP.x, nextP.x) + 14, Math.max(currentP.y, nextP.y) + 14]];

                        let collisions = [];
                        try {
                            const layers = ['3d-buildings', 'building'].filter(l => map.getLayer(l));
                            if (layers.length > 0) collisions = map.queryRenderedFeatures(combinedBbox, { layers });
                        } catch (e) { }

                        if (collisions.length > 0) {
                            try {
                                const layers = ['3d-buildings', 'building'].filter(l => map.getLayer(l));
                                isAlreadyInside = layers.length > 0 && map.queryRenderedFeatures([[currentP.x - 8, currentP.y - 8], [currentP.x + 8, currentP.y + 8]], { layers }).length > 0;
                            } catch (e) { }

                            if (!isAlreadyInside) {
                                collisionOccurred = true;
                                const bounceDirection = state.velocity > 0 ? -1 : 1;
                                state.velocity = -state.velocity * 0.02;
                                const rad = (state.bearing) * (Math.PI / 180);
                                state.lng += Math.sin(rad) * bounceDirection * 0.00002;
                                state.lat += Math.cos(rad) * bounceDirection * 0.00002;
                                state.crashShake = Math.min(10, state.crashShake + Math.abs(state.velocity) * 1000);

                                // Haptic feedback for collision
                                const collisionIntensity = Math.abs(state.velocity) > 0.5 ? 'strong' : 'medium';
                                haptics.impact(collisionIntensity);
                            }
                        }
                    }
                }

                // 2. Multiplayer Player Collisions (High Precision)
                const myMc = mapboxgl.MercatorCoordinate.fromLngLat([state.lng, state.lat], 0);
                const meterScale = mapboxgl.MercatorCoordinate.fromLngLat([state.lng, state.lat], 0).meterInMercatorCoordinateUnits();

                Object.values(state.otherPlayers).forEach(p => {
                    if (!p.lng || !p.lat) return;
                    const pMc = mapboxgl.MercatorCoordinate.fromLngLat([p.lng, p.lat], 0);
                    const dx = (pMc.x - myMc.x) / meterScale;
                    const dy = (pMc.y - myMc.y) / meterScale;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    const collisionThreshold = state.activeVehicle === 'car' ? 5.0 : 8.5;
                    if (dist < collisionThreshold) {
                        collisionOccurred = true;
                        isAlreadyInside = false; // Always bounce for players
                    }
                });

                if (collisionOccurred && !isAlreadyInside) {
                    const now = Date.now();
                    if (now - lastCollisionTrackTime > 5000) {
                        trackEvent('vehicle_collision', {
                            vehicle: state.activeVehicle,
                            velocity: Math.abs(state.velocity).toFixed(2)
                        });
                        lastCollisionTrackTime = now;
                    }

                    const bounceDirection = state.velocity > 0 ? -1 : 1;
                    state.velocity = -state.velocity * 0.4;
                    const rad = (state.bearing) * (Math.PI / 180);
                    state.lng += Math.sin(rad) * bounceDirection * 0.00001;
                    state.lat += Math.cos(rad) * bounceDirection * 0.00001;

                    // Haptic feedback for multiplayer collision
                    haptics.impact('strong');
                    state.isCharging = false; state.chargeLevel = 0; state.crashShake = 15;
                }
            }

            if (!collisionOccurred) {
                state.lng = nextLng; state.lat = nextLat;
            }
        }
    }
}

export function updateCamera(dtFinal, map) {
    const isDrivingNow = Math.abs(state.velocity) > 0.02;
    const timeSinceLastMove = Date.now() - state.lastCameraManualMove;
    const shouldAutoReturn = !state.isDragging && (timeSinceLastMove > 5000 || (isDrivingNow && timeSinceLastMove > 1000));

    if (shouldAutoReturn) {
        state.mouseRotation += (0 - state.mouseRotation) * 0.05 * dtFinal;
        let maxPitch = 70;
        if (state.activeVehicle === 'truck' || state.activeVehicle === 'bus') maxPitch = 68;
        const targetPitch = Math.min(65 + (state.chargeLevel * 10) + Math.abs(state.velocity) * 12, maxPitch);
        state.currentPitch += (targetPitch - state.currentPitch) * 0.08 * dtFinal;
    }

    let targetCamBearing = state.bearing + (state.velocity < -0.01 ? 180 : 0) + state.mouseRotation;
    let diff = targetCamBearing - state.camBearing;
    while (diff < -180) diff += 360;
    while (diff > 180) diff -= 360;

    if (Math.abs(diff) > 0.01 || Math.abs(state.velocity) > 0.001 || state.isDragging) {
        state.camBearing += diff * 0.12 * dtFinal;
    } else {
        state.camBearing = targetCamBearing;
    }

    const shakeX = (Math.random() - 0.5) * state.crashShake;
    const shakeY = (Math.random() - 0.5) * state.crashShake;

    if (state.isCameraAnimating) {
        const center = map.getCenter();
        state.lng = center.lng;
        state.lat = center.lat;
        state.camBearing = map.getBearing();
        state.bearing = map.getBearing();
        state.travelBearing = map.getBearing();
        state.currentPitch = map.getPitch();
    } else {
        map.setCenter([state.lng, state.lat]);
        map.setBearing(state.camBearing + shakeX);
        map.setPitch(state.currentPitch + shakeY);
    }

    if (!state.isCharging && state.chargeLevel > 0) {
        state.chargeLevel *= Math.pow(0.98, dtFinal);
    }
    if (state.crashShake > 0) {
        state.crashShake *= Math.pow(0.85, dtFinal);
    }
}

