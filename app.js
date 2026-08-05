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

import { state, loadState, saveState } from './js/state.js';
import { initUI, updateToggleStates, add3DBuildings, applyLightPreset, triggerDonationPopup } from './js/ui.js';
import { initControls } from './js/controls.js';
import { setup3DVehicleLayer, setupVehicleMarker, getVehicleMarker, updateSkidMarks } from './js/three-manager.js';
import { initMultiplayer, updateOtherPlayers } from './js/multiplayer.js';
import { updatePhysics, updateCamera } from './js/physics.js';
import { cleanMap, addSkidMarksLayer } from './js/utils.js';
import { trackEvent, trackWebVitals } from './js/analytics.js';
import { checkDiscovery } from './js/discovery.js';
import { updateAudio } from './js/audio.js';

// Global Production Error Boundary Handler
window.addEventListener('error', (event) => {
    console.error('GEO Ride Global Error:', event.error || event.message);
    trackEvent('app_error', { message: event.message, filename: event.filename, lineno: event.lineno });
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('GEO Ride Unhandled Promise Rejection:', event.reason);
    trackEvent('app_unhandled_rejection', { reason: String(event.reason) });
});

// Initialize Analytics & Performance Monitoring
trackWebVitals();
trackEvent('session_start', {
    platform: 'web',
    version: '2026.1.0',
    resolution: `${window.innerWidth}x${window.innerHeight}`
});

// Load initial state
loadState();

// Apply performance classes to document root based on calculated hardware capabilities
if (state.performance && state.performance.lowEnd) {
    document.documentElement.classList.add('geo-performance-low');
}
if (state.performance && state.performance.reducedMotion) {
    document.documentElement.classList.add('geo-reduced-motion');
}

// Mapbox token initialization
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || import.meta.env.MAPBOX_TOKEN;

const map = new mapboxgl.Map({
    container: 'map',
    style: `mapbox://styles/mapbox/${state.mapStyle}`,
    center: [state.lng, state.lat],
    zoom: 18,
    pitch: 65,
    bearing: state.bearing,
    interactive: false,
    pixelRatio: state.performance.eliteEnd
        ? Math.min(window.devicePixelRatio || 1, 2.0)
        : state.performance.lowEnd
          ? 1.0
          : Math.min(window.devicePixelRatio || 1, 1.3),
    antialias: !state.performance.lowEnd
});

// Expose globally
window.map = map;
window.THREE = THREE;

// Instantly update progress target to 60% since app.js has loaded
if (window.setLoadingTarget) {
    window.setLoadingTarget(60);
}

let loadedDataCount = 0;
map.on('data', (e) => {
    if (e.isSourceLoaded) {
        loadedDataCount++;
        if (window.setLoadingTarget) {
            window.setLoadingTarget(Math.min(95, 60 + loadedDataCount * 4));
        }
    }
});

let isMapFullyLoaded = false;
map.once('idle', () => {
    isMapFullyLoaded = true;
    if (window.setLoadingTarget) window.setLoadingTarget(100);
});
// Safety fallback after 3 seconds in case network is slow or offline
setTimeout(() => {
    isMapFullyLoaded = true;
    if (window.setLoadingTarget) window.setLoadingTarget(100);
}, 3000);

/**
 * Finalizes loading sequence, hides loading overlay banner, and launches requestAnimationFrame update loop.
 * @returns {void}
 */
function finishLoading() {
    // Wait until Mapbox reports idle AND the smooth percentage animation reaches 100%
    if (!isMapFullyLoaded || (window.currentLoadingPct !== undefined && window.currentLoadingPct < 100)) {
        setTimeout(finishLoading, 50);
        return;
    }
    if (window.loadingSimInterval) clearInterval(window.loadingSimInterval);
    if (window.loadingTipInterval) clearInterval(window.loadingTipInterval);
    const overlayEl = document.getElementById('loading-overlay');
    if (overlayEl) {
        overlayEl.classList.add('fade-out');
    }
    setTimeout(() => {
        if (overlayEl) overlayEl.style.display = 'none';
        state.lastTime = performance.now();
        state.loopStarted = true;
        requestAnimationFrame(update);

        // Show PayPal donation popup at specific milestones (2m, 10m, 30m, 1h)
        const donationMilestones = [120000, 600000, 1800000, 3600000];
        donationMilestones.forEach((delay) => {
            setTimeout(triggerDonationPopup, delay);
        });
    }, 600); // Wait for the 0.6s css transition to finish
}

let isInitialMapLoad = true;

map.on('load', () => {
    isInitialMapLoad = false;
    if (window.setLoadingTarget) window.setLoadingTarget(85);
    cleanMap(map);
    add3DBuildings(map);
    setup3DVehicleLayer(map);
    setupVehicleMarker(map);
    addSkidMarksLayer(map);
    updateToggleStates();
    if (window.setLoadingTarget) window.setLoadingTarget(95);

    // Apply standard preset if active on load
    applyLightPreset(map);

    finishLoading();
});

map.on('style.load', () => {
    if (isInitialMapLoad) return;
    cleanMap(map);
    add3DBuildings(map);
    setup3DVehicleLayer(map);
    setupVehicleMarker(map);
    addSkidMarksLayer(map);

    // Apply standard preset if active on style load
    applyLightPreset(map);
});

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

        // Periodic Save
        if (currentTime - state.lastSaveTime > 5000) {
            saveState();
            state.lastSaveTime = currentTime;
        }

        // HUD Update (Only if speed changed)
        let speedVal = Math.floor(Math.abs(state.velocity) * 600);
        if (state.unit === 'mi') speedVal = Math.floor(speedVal * 0.621371);

        if (speedVal !== state.lastHUDUpdateSpeed) {
            document.getElementById('speed').textContent =
                (speedVal > 0 && state.velocity < -0.0001 ? '-' : '') + speedVal;
            state.lastHUDUpdateSpeed = speedVal;
        }
    }

    requestAnimationFrame(update);
}

// Initialize components
initUI(map);
initControls();

// Disable Right-Click
document.addEventListener('contextmenu', (e) => e.preventDefault());

document.getElementById('mp-btn').onclick = (e) => {
    const mpDropdown = document.getElementById('mp-dropdown');
    if (mpDropdown && mpDropdown.contains(e.target)) return;

    e.stopPropagation();

    // Enforce Exclusivity: Close other popups
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsPanel && settingsPanel.classList.contains('active')) {
        settingsPanel.classList.remove('active');
        // Re-enable map interactions that were disabled by settings
        if (window.map) {
            window.map.dragPan?.enable();
            window.map.scrollZoom?.enable();
            window.map.doubleClickZoom?.enable();
            window.map.touchZoomRotate?.enable();
            window.map.keyboard?.enable();
        }
    }
    const searchBox = document.querySelector('.search-box');
    if (searchBox) searchBox.classList.remove('expanded');

    if (!window.mpInitialized) {
        initMultiplayer();
        if (mpDropdown) mpDropdown.classList.add('active');
        trackEvent('multiplayer_init');
    } else {
        const isActive = mpDropdown.classList.toggle('active');
        trackEvent('multiplayer_toggle', { active: isActive });
    }
};
