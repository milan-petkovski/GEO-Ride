/**
 * @file physics.js
 * @description Vehicle physics engine for GEO Ride, handling acceleration, braking, drifting, steering, collision detection, and camera tracking.
 */

import { state, saveState } from './state.js';
import { VEHICLE_CONFIG, INITIAL_CENTER, INITIAL_ZOOM, AIR_DRAG_FACTOR } from './config.js';

import { setup3DVehicleLayer } from './three-manager.js';
import { trackEvent } from './analytics.js';
import { haptics } from './haptics.js';

let lastCollisionTrackTime = 0;

// Off-thread Web Worker initialization for physics trajectory pre-computation
let physicsWorker = null;
if (typeof window !== 'undefined' && typeof window.Worker !== 'undefined') {
    try {
        physicsWorker = new Worker(new URL('./physics.worker.js', import.meta.url), { type: 'module' });
        physicsWorker.onmessage = (e) => {
            if (e.data && e.data.type === 'TRAJECTORY_RESULT') {
                state.predictedTrajectory = e.data.payload.trajectory;
            }
        };
    } catch (_e) {
        // Fallback gracefully if workers are disabled
    }
}

/**
 * Dispatches trajectory prediction calculation to the dedicated Web Worker.
 * @param {number} dtFinal - Delta time frame multiplier.
 * @returns {void}
 */
export function requestOffthreadTrajectory(dtFinal) {
    if (physicsWorker && Math.abs(state.velocity) > 0.02) {
        physicsWorker.postMessage({
            type: 'COMPUTE_TRAJECTORY',
            payload: {
                lng: state.lng,
                lat: state.lat,
                bearing: state.bearing,
                velocity: state.velocity,
                dt: dtFinal,
                steps: 10
            }
        });
    }
}

/**
 * Triggers an animated camera flyTo and position teleport to home (R) or global default Belgrade Waterfront (Shift+R).
 * @param {boolean} isShiftReset - When true, resets to INITIAL_CENTER (Belgrade Waterfront).
 * @param {Object} map - Mapbox GL JS map instance.
 * @returns {void}
 */
export function triggerVehicleReset(isShiftReset, map) {
    if (!map || state.isTeleporting) return;
    const [lng, lat] = isShiftReset ? [...INITIAL_CENTER] : [...state.currentHome];
    const targetResetBearing = 107;

    state.velocity = 0;
    state.isTeleporting = true;
    state.isCameraAnimating = true;
    state.teleportStartTime = Date.now();
    state.teleportDuration = isShiftReset ? 3500 : 2500;
    state.teleportStart = [state.lng, state.lat];
    state.teleportEnd = [lng, lat];

    // Immediately move vehicle position to destination
    state.lng = lng;
    state.lat = lat;
    state.bearing = targetResetBearing;
    state.travelBearing = targetResetBearing;
    if (isShiftReset) {
        state.currentHome = [...INITIAL_CENTER];
    }

    map.flyTo({
        center: [lng, lat],
        zoom: INITIAL_ZOOM,
        pitch: 65,
        bearing: targetResetBearing,
        duration: state.teleportDuration
    });

    trackEvent('vehicle_reset', {
        is_global: isShiftReset,
        generalized_location: 'REDACTED' // Prevent PII leakage
    });

    // Fallback: release teleport state even if moveend never fires
    const resetFallback = setTimeout(() => {
        state.isCameraAnimating = false;
        state.isTeleporting = false;
        setup3DVehicleLayer(map);
        saveState();
    }, state.teleportDuration + 400);

    map.once('moveend', () => {
        clearTimeout(resetFallback);
        state.isCameraAnimating = false;
        state.isTeleporting = false;
        setup3DVehicleLayer(map);
        saveState();
    });
}

/**
 * Updates vehicle position, velocity, heading, drifting, and collision responses for the current frame step.
 * @param {number} dtFinal - Delta time frame multiplier.
 * @param {Object} map - Mapbox GL JS map instance.
 * @returns {void}
 */
export function updatePhysics(dtFinal, map) {
    const config = VEHICLE_CONFIG[state.activeVehicle];
    requestOffthreadTrajectory(dtFinal);

    // Disable other controls while teleporting
    if (state.isTeleporting) return;

    const isSDown = state.keys['s'] || state.keys['arrowdown'];
    const isWDown = state.keys['w'] || state.keys['arrowup'];

    if (isWDown) {
        if (state.velocity < 0) {
            // Braking while in reverse
            state.velocity += config.brake * 1.5 * dtFinal;
            if (state.velocity > 0) state.velocity = 0;
        } else {
            // Smooth forward acceleration
            state.velocity += config.power * dtFinal;
        }
    } else if (isSDown) {
        if (state.velocity > 0) {
            // Braking while moving forward
            state.velocity -= config.brake * dtFinal;
            if (state.velocity < 0) state.velocity = 0;
        } else {
            // Smooth reverse acceleration
            state.velocity -= config.power * 0.6 * dtFinal;
        }
    } else {
        state.velocity *= Math.pow(state.activeVehicle === 'god' ? 0.999 : AIR_DRAG_FACTOR, dtFinal);
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

    const inputDir =
        (state.keys['a'] || state.keys['arrowleft'] ? -1 : 0) + (state.keys['d'] || state.keys['arrowright'] ? 1 : 0);
    const steeringSmooth = Math.min(config.steeringWeight * dtFinal, 0.3);
    state.steeringAngle += (inputDir * config.turnRate - state.steeringAngle) * steeringSmooth;

    if (Math.abs(state.velocity) > 0.0001) {
        const isDrifting = state.keys[' '];
        // High-speed steering stability without speed choking
        let damping = 1 / (1 + Math.abs(state.velocity) * 4.5);
        let turnPower = 5.5;
        let slipGrip = 0.28;

        if (state.activeVehicle === 'god') {
            damping = 1 / (1 + Math.abs(state.velocity) * 2.5);
            turnPower = 9;
            slipGrip = 0.15;
        } else if (isDrifting) {
            damping = 1;
            turnPower = 9;
            slipGrip = 0.05;
            state.velocity *= Math.pow(0.9995, dtFinal);
        }

        const turnDir = state.velocity > 0 ? 1 : -0.7;
        const bearingChange =
            Math.sqrt(Math.abs(state.velocity)) * state.steeringAngle * turnPower * damping * turnDir * dtFinal;
        state.bearing += bearingChange;
        const diff = state.bearing - state.travelBearing;
        state.travelBearing += diff * slipGrip * dtFinal;

        const rad = state.travelBearing * (Math.PI / 180);
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
                    // Tightened forward collision probe (3px radius at next vehicle nose) to prevent false clipping during turns
                    const combinedBbox = [
                        [nextP.x - 3, nextP.y - 3],
                        [nextP.x + 3, nextP.y + 3]
                    ];

                    let collisions = [];
                    try {
                        const layers = ['3d-buildings', 'building'].filter((l) => map.getLayer(l));
                        if (layers.length > 0) collisions = map.queryRenderedFeatures(combinedBbox, { layers });
                    } catch (_e) {}

                    if (collisions.length > 0) {
                        try {
                            const layers = ['3d-buildings', 'building'].filter((l) => map.getLayer(l));
                            isAlreadyInside =
                                layers.length > 0 &&
                                map.queryRenderedFeatures(
                                    [
                                        [currentP.x - 3, currentP.y - 3],
                                        [currentP.x + 3, currentP.y + 3]
                                    ],
                                    { layers }
                                ).length > 0;
                        } catch (_e) {}

                        if (!isAlreadyInside) {
                            collisionOccurred = true;
                            const bounceDirection = state.velocity > 0 ? -1 : 1;
                            state.velocity = -state.velocity * 0.02;
                            const rad = state.bearing * (Math.PI / 180);
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
            if (typeof mapboxgl !== 'undefined') {
                const myMc = mapboxgl.MercatorCoordinate.fromLngLat([state.lng, state.lat], 0);
                const meterScale = mapboxgl.MercatorCoordinate.fromLngLat(
                    [state.lng, state.lat],
                    0
                ).meterInMercatorCoordinateUnits();

                Object.values(state.otherPlayers).forEach((p) => {
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
            }

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
                const rad = state.bearing * (Math.PI / 180);
                state.lng += Math.sin(rad) * bounceDirection * 0.00001;
                state.lat += Math.cos(rad) * bounceDirection * 0.00001;

                // Haptic feedback for multiplayer collision
                haptics.impact('strong');
                state.isCharging = false;
                state.chargeLevel = 0;
                state.crashShake = 15;
            }
        }
        if (!collisionOccurred) {
            state.lng = nextLng;
            state.lat = nextLat;
        }
    }
}

/**
 * Smoothly updates orbit camera bearing, pitch, and camera shake relative to vehicle velocity and mouse drag.
 * @param {number} dtFinal - Delta time frame multiplier.
 * @param {Object} map - Mapbox GL JS map instance.
 * @returns {void}
 */
export function updateCamera(dtFinal, map) {
    const isDrivingNow = Math.abs(state.velocity) > 0.02;
    const timeSinceLastMove = Date.now() - state.lastCameraManualMove;
    const shouldAutoReturn =
        !state.isDragging && (timeSinceLastMove > 5000 || (isDrivingNow && timeSinceLastMove > 1000));

    if (shouldAutoReturn) {
        state.mouseRotation += (0 - state.mouseRotation) * 0.05 * dtFinal;
        let maxPitch = 70;
        if (state.activeVehicle === 'truck' || state.activeVehicle === 'bus') maxPitch = 68;
        const targetPitch = Math.min(65 + state.chargeLevel * 10 + Math.abs(state.velocity) * 12, maxPitch);
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
