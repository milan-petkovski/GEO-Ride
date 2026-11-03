/**
 * @file app.js
 * @description Main application orchestrator for GEO Ride, initializing Mapbox GL JS map, Three.js custom layer, audio engine, controls, and main animation loop.
 */

// Service Worker Handling
if ('serviceWorker' in navigator) {
    if (window.location.hostname === 'localhost') {
        navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    } else {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch((err) => console.log('SW failed:', err));
        });
    }
}

import { state, loadState, saveState, setProStatus } from './js/state.js';
import { INITIAL_ZOOM } from './js/config.js';
import {
    initUI,
    updateToggleStates,
    add3DBuildings,
    applyLightPreset,
    triggerDonationPopup,
    showToast,
    updateDriftHUD,
    checkSpeedTrap,
    demoteProToFree
} from './js/ui.js';
import { initControls, pollGamepad } from './js/controls.js';
import { setup3DVehicleLayer, setupVehicleMarker, getVehicleMarker, updateSkidMarks } from './js/three-manager.js';
import { updateOtherPlayers } from './js/multiplayer.js';
import { updatePhysics, updateCamera } from './js/physics.js';
import { cleanMap, addSkidMarksLayer, setupTerrain } from './js/utils.js';
import { trackEvent, trackWebVitals, trackAIReferral, trackErrorOnce } from './js/analytics.js';
import { checkDiscovery } from './js/discovery.js';
import { updateAudio } from './js/audio.js';

// Once-per-session analytics guards
let playClickAt = 0;
let firstDriveTracked = false;
let playtimeScheduled = false;
const firedPlaytime = new Set();

// Global Production Error Boundary Handler
window.addEventListener('error', (event) => {
    console.error('GEO Ride Global Error:', event.error || event.message);
    trackErrorOnce('app_error', ` at ${event.filename}:${event.lineno}`);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('GEO Ride Unhandled Promise Rejection:', event.reason);
    trackErrorOnce('app_unhandled_rejection', String(event.reason));
});

// Initialize Analytics & Performance Monitoring
trackWebVitals();
trackAIReferral();
trackEvent('session_start', {
    platform: 'web',
    version: '1.2.1',
    resolution: `${window.innerWidth}x${window.innerHeight}`
});

// Load initial state
loadState();

// Parse and prioritize URL parameters for direct spawning from landing page
const urlParams = new URLSearchParams(window.location.search);
const paramLat = parseFloat(urlParams.get('lat'));
const paramLng = parseFloat(urlParams.get('lng'));
const paramZoom = parseFloat(urlParams.get('zoom'));
const paramPlace = urlParams.get('place');
const paramVehicle = urlParams.get('vehicle');

if (!isNaN(paramLat) && !isNaN(paramLng) && paramLat >= -90 && paramLat <= 90 && paramLng >= -180 && paramLng <= 180) {
    state.lat = paramLat;
    state.lng = paramLng;
    state.currentHome = [paramLng, paramLat];
    if (paramPlace) {
        import('./js/discovery.js')
            .then(({ discoveryCache }) => {
                const gridKey = `${paramLat.toFixed(2)},${paramLng.toFixed(2)}`;
                discoveryCache.set(gridKey, { cityName: paramPlace, countryName: '' });
            })
            .catch(() => {});
    }
}

if (paramVehicle && ['car', 'truck', 'bus', 'god'].includes(paramVehicle)) {
    state.activeVehicle = paramVehicle;
}

// Automatic Pro activation from Fungies redirect / URL parameters
// Strictly verified against Supabase before granting Pro privileges
try {
    const proParam = urlParams.get('pro');
    const orderId = urlParams.get('order_id') || urlParams.get('checkout_id');
    const customerEmail = (urlParams.get('email') || urlParams.get('customer_email') || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
        customerEmail &&
        emailRegex.test(customerEmail) &&
        (proParam === 'success' || proParam === 'active' || orderId)
    ) {
        import('./js/supabase-georide.js')
            .then(
                ({
                    activateProSession,
                    broadcastProSessionActivation,
                    startProSessionWatcher,
                    isBackendConfigured
                }) => {
                    if (!isBackendConfigured()) return;
                    activateProSession(customerEmail)
                        .then((res) => {
                            if (res && res.is_pro) {
                                setProStatus(true);
                                localStorage.setItem('geo_ride_pro_email', customerEmail);
                                if (res.session_token) {
                                    localStorage.setItem('geo_ride_pro_session_token', res.session_token);
                                    broadcastProSessionActivation(customerEmail, res.session_token);
                                    startProSessionWatcher(customerEmail, res.session_token, demoteProToFree);
                                }
                                updateToggleStates();
                                showToast(
                                    'PRO ACTIVATED!',
                                    'Thank you for upgrading! God Mode & VIP rooms are unlocked.',
                                    { isPro: true }
                                );
                                trackEvent('pro_activated_redirect', { order_id: orderId || 'verified' });
                            } else {
                                demoteProToFree('no_active_plan');
                            }
                        })
                        .catch(() => {});
                }
            )
            .catch(() => {});
    } else if (state.isPro) {
        // Re-verify existing localStorage Pro flag against Supabase single active session
        const savedEmail = (localStorage.getItem('geo_ride_pro_email') || '').trim().toLowerCase();
        const savedToken = localStorage.getItem('geo_ride_pro_session_token');
        import('./js/supabase-georide.js')
            .then(({ verifyProSession, activateProSession, startProSessionWatcher, isBackendConfigured }) => {
                if (!isBackendConfigured()) return;
                if (!savedEmail || !emailRegex.test(savedEmail)) {
                    demoteProToFree('invalid');
                    return;
                }
                if (!savedToken) {
                    activateProSession(savedEmail)
                        .then((res) => {
                            if (res && res.is_pro && res.session_token) {
                                localStorage.setItem('geo_ride_pro_session_token', res.session_token);
                                startProSessionWatcher(savedEmail, res.session_token, demoteProToFree);
                            } else if (res && !res.is_pro) {
                                demoteProToFree('expired');
                            }
                        })
                        .catch(() => {});
                    return;
                }
                verifyProSession(savedEmail, savedToken)
                    .then((res) => {
                        if (res && res.status !== 'error') {
                            if (!res.is_pro || res.reason === 'session_superseded') {
                                demoteProToFree(res.reason === 'session_superseded' ? 'superseded' : 'expired');
                            } else {
                                startProSessionWatcher(savedEmail, savedToken, demoteProToFree);
                            }
                        }
                    })
                    .catch(() => {});
            })
            .catch(() => {});
    }

    // Clean query params from address bar regardless
    if (proParam || orderId) {
        const cleanPath = window.location.pathname;
        window.history.replaceState({}, document.title, cleanPath);
    }
} catch (_e) {}

// Apply performance classes to document root based on calculated hardware capabilities
if (state.performance && state.performance.lowEnd) {
    document.documentElement.classList.add('geo-performance-low');
}
if (state.performance && state.performance.reducedMotion) {
    document.documentElement.classList.add('geo-reduced-motion');
}

// Mapbox token initialization
const mapboxToken = (import.meta.env.VITE_MAPBOX_TOKEN || import.meta.env.MAPBOX_TOKEN || '').trim();
if (!mapboxToken) {
    console.warn('GEO Ride: VITE_MAPBOX_TOKEN is missing. Please check your .env configuration.');
}
mapboxgl.accessToken = mapboxToken;

// Singleton Map Reference Pattern: strictly prevents duplicate Mapbox Map Loads across re-renders/evaluations
const mapRef = {
    get current() {
        return window.__geoRideMapInstance || null;
    },
    set current(instance) {
        window.__geoRideMapInstance = instance;
    }
};

let map = mapRef.current;
const isReusedInstance = Boolean(map);

if (!map) {
    map = new mapboxgl.Map({
        container: 'map',
        style: `mapbox://styles/mapbox/${state.mapStyle}`,
        center: [state.lng, state.lat],
        zoom: !isNaN(paramZoom) && paramZoom >= 1 && paramZoom <= 22 ? paramZoom : INITIAL_ZOOM,
        pitch: 65,
        bearing: state.bearing,
        interactive: false,
        attributionControl: false,
        maxTileCacheSize: state.performance.lowEnd ? 50 : 120,
        fadeDuration: 100,
        crossSourceCollisions: false,
        collectResourceTiming: false,
        pixelRatio: state.performance.eliteEnd
            ? Math.min(window.devicePixelRatio || 1, 2.0)
            : state.performance.lowEnd
              ? 1.0
              : Math.min(window.devicePixelRatio || 1, 1.3),
        antialias: !state.performance.lowEnd
    });

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
    mapRef.current = map;
}

// Expose globally
window.map = map;
window.THREE = typeof THREE !== 'undefined' ? THREE : window.THREE;

// Instantly update progress target to 60% since app.js has loaded
if (window.setLoadingTarget) {
    window.setLoadingTarget(60);
}

let isMapFullyLoaded = false;
let isInitialMapLoad = true;
const reachedDistanceMilestones = new Set();

/**
 * Finalizes loading sequence, hides loading overlay banner, and launches requestAnimationFrame update loop.
 * @returns {void}
 */
function finishLoading() {
    // Wait until Mapbox reports idle or fallback triggered AND the smooth percentage animation reaches 100%
    if (!isMapFullyLoaded || (window.currentLoadingPct !== undefined && window.currentLoadingPct < 99)) {
        setTimeout(finishLoading, 30);
        return;
    }
    if (window.loadingSimInterval) clearInterval(window.loadingSimInterval);
    if (window.loadingTipInterval) clearInterval(window.loadingTipInterval);
    const overlayEl = document.getElementById('loading-overlay');
    if (overlayEl) {
        overlayEl.classList.add('fade-out');
        overlayEl.classList.add('hidden');
    }
    setTimeout(() => {
        if (overlayEl) overlayEl.style.display = 'none';
        state.lastTime = performance.now();
        state.loopStarted = true;
        playClickAt = performance.now();
        trackEvent('play_click', {
            vehicle: state.activeVehicle,
            map_style: state.mapStyle,
            graphics_quality: state.graphicsQuality || 'ultra'
        });
        requestAnimationFrame(update);

        // Initial load location discovery banner (runs for both free and pro players)
        checkDiscovery(state.lng, state.lat, true);

        // Show PayPal donation popup at specific milestones (2m, 10m, 30m, 1h)
        const donationMilestones = [120000, 600000, 1800000, 3600000];
        donationMilestones.forEach((delay) => {
            setTimeout(triggerDonationPopup, delay);
        });

        // Track user retention & playtime milestones (1m, 5m, 15m, 30m, 60m)
        const PLAYTIME_MILESTONES = [
            { min: 1, delay: 60000 },
            { min: 5, delay: 300000 },
            { min: 15, delay: 900000 },
            { min: 30, delay: 1800000 },
            { min: 60, delay: 3600000 }
        ];
        if (playtimeScheduled) return;
        playtimeScheduled = true;
        PLAYTIME_MILESTONES.forEach(({ min, delay }) => {
            setTimeout(() => {
                if (state.loopStarted && !document.hidden && !firedPlaytime.has(min)) {
                    firedPlaytime.add(min);
                    trackEvent('playtime_milestone', {
                        minutes: min,
                        vehicle: state.activeVehicle,
                        map_style: state.mapStyle
                    });
                }
            }, delay);
        });
    }, 600); // Wait for the 0.6s css transition to finish
}

// Attach map loading and style listeners strictly once per map instance
if (!isReusedInstance) {
    let loadedDataCount = 0;
    map.on('data', (e) => {
        if (e.isSourceLoaded) {
            loadedDataCount++;
            if (window.setLoadingTarget) {
                window.setLoadingTarget(Math.min(95, 60 + loadedDataCount * 4));
            }
        }
    });

    map.once('idle', () => {
        isMapFullyLoaded = true;
        if (window.setLoadingTarget) window.setLoadingTarget(100);
    });
    // Swift fallback after 1.2s so the user never gets stuck waiting if satellite tiles are streaming
    setTimeout(() => {
        isMapFullyLoaded = true;
        if (window.setLoadingTarget) window.setLoadingTarget(100);
    }, 1200);

    map.on('load', () => {
        isInitialMapLoad = false;
        if (window.setLoadingTarget) window.setLoadingTarget(85);
        cleanMap(map);
        setupTerrain(map);
        add3DBuildings(map);
        setup3DVehicleLayer(map);
        setupVehicleMarker(map);
        addSkidMarksLayer(map);
        updateToggleStates();
        if (window.setLoadingTarget) window.setLoadingTarget(95);

        // Apply standard preset if active on load
        applyLightPreset(map);

        finishLoading();

        // Accessibility: Mapbox renders its attribution button dynamically - patch aria-label
        const attribBtn = document.querySelector('.mapboxgl-ctrl-attrib-button');
        if (attribBtn) attribBtn.setAttribute('aria-label', 'Toggle map attribution');
    });

    map.on('style.load', () => {
        if (isInitialMapLoad) return;
        cleanMap(map);
        setupTerrain(map);
        add3DBuildings(map);
        setup3DVehicleLayer(map);
        setupVehicleMarker(map);
        addSkidMarksLayer(map);

        // Apply standard preset if active on style load
        applyLightPreset(map);
    });
}

/**
 * Main application animation frame step updating physics, camera, multiplayer, skidmarks, and HUD stats.
 * @param {number} time - High-resolution timestamp from requestAnimationFrame.
 * @returns {void}
 */
function update(time) {
    const currentTime = time || performance.now();
    let rawDt = (currentTime - state.lastTime) / 16.667;
    state.lastTime = currentTime;
    const dtFinal = isNaN(rawDt) ? 1 : Math.min(Math.max(rawDt, 0.6), 1.4);

    if (state.loopStarted) {
        // While settings panel or pilot hub is open, pause heavy 3D redraw and physics to ensure buttery smooth 60fps scrolling
        if (state.isSettingsOpen || state.isProfileOpen) {
            updateAudio(state);
            requestAnimationFrame(update);
            return;
        }

        // In Photo Mode, pause physics update to freeze car motion while maintaining 3D rendering
        if (state.isPhotoMode) {
            updateAudio(state);
            map.triggerRepaint();
            requestAnimationFrame(update);
            return;
        }

        pollGamepad();
        updatePhysics(dtFinal, map);
        updateCamera(dtFinal, map);
        updateOtherPlayers(dtFinal, map);
        updateSkidMarks(map);

        // Check for new cities/locations
        if (!state.isTeleporting) {
            checkDiscovery(state.lng, state.lat);
        }

        // Update dynamic 3D audio engine
        updateAudio(state);

        // Update real-time drift score HUD
        updateDriftHUD();

        // Marker Sync
        const vehicleMarker = getVehicleMarker();
        if (vehicleMarker) {
            vehicleMarker.setLngLat([state.lng, state.lat]);
            const el = vehicleMarker.getElement();
            if (state.is3D || state.isTeleporting) {
                el.style.display = 'none';
            } else {
                el.style.display = 'block';
                const inner = el.querySelector('.vehicle-marker');
                if (inner) vehicleMarker.setRotation(state.bearing);
            }
        }

        // Periodic Save & Distance Milestones
        if (currentTime - state.lastSaveTime > 5000) {
            saveState();
            state.lastSaveTime = currentTime;

            const totalKm = state.totalDistanceKm || 0;
            [1, 5, 10, 25, 50, 100].forEach((km) => {
                if (totalKm >= km && !reachedDistanceMilestones.has(km)) {
                    reachedDistanceMilestones.add(km);
                    trackEvent('distance_milestone', {
                        km_reached: km,
                        vehicle: state.activeVehicle
                    });
                }
            });
        }

        // HUD Update (Only if speed changed)
        let speedVal = Math.floor(Math.abs(state.velocity) * 600);
        if (state.unit === 'mi') speedVal = Math.floor(speedVal * 0.621371);
        if (speedVal > 9999) speedVal = 9999;

        if (speedVal !== state.lastHUDUpdateSpeed) {
            document.getElementById('speed').textContent =
                (speedVal > 0 && state.velocity < -0.0001 ? '-' : '') + speedVal;
            state.lastHUDUpdateSpeed = speedVal;
        }
        checkSpeedTrap(speedVal);
        if (!firstDriveTracked && speedVal >= 3) {
            firstDriveTracked = true;
            trackEvent('first_drive', {
                seconds_since_load: Math.round(performance.now() / 1000),
                seconds_since_play: playClickAt ? Math.round((performance.now() - playClickAt) / 1000) : undefined,
                vehicle: state.activeVehicle
            });
        }
    }

    requestAnimationFrame(update);
}

// Initialize components strictly once per session
if (!isReusedInstance) {
    initUI(map);
    initControls();

    // Disable Right-Click
    document.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Vite HMR protection: Keep existing map instance across hot module reloads without creating new Map Loads
if (import.meta.hot) {
    import.meta.hot.accept();
}
