// Service Worker Handling
if ('serviceWorker' in navigator) {
    if (window.location.hostname === 'localhost') {
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
    } else {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW failed:', err));
        });
    }
}

import { state, loadState, saveState } from './js/state.js';
import { INITIAL_CENTER } from './js/config.js';
import { initUI, updateToggleStates, add3DBuildings } from './js/ui.js';
import { initControls } from './js/controls.js';
import { setup3DVehicleLayer, setupVehicleMarker, getVehicleMarker, updateSkidMarks } from './js/three-manager.js';
import { initMultiplayer, updateOtherPlayers } from './js/multiplayer.js';
import { updatePhysics, updateCamera } from './js/physics.js';
import { cleanMap, setProgress, addSkidMarksLayer } from './js/utils.js';
import { trackEvent, trackWebVitals } from './js/analytics.js';

// Initialize Analytics & Performance Monitoring
trackWebVitals();
trackEvent('session_start', {
    platform: 'web',
    version: '2026.1.0',
    resolution: `${window.innerWidth}x${window.innerHeight}`
});


// Load initial state
loadState();

// Mapbox token initialization
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || import.meta.env.MAPBOX_TOKEN;

const map = new mapboxgl.Map({
    container: 'map',
    style: `mapbox://styles/mapbox/${state.mapStyle}`,
    center: [state.lng, state.lat],
    zoom: 18,
    pitch: 65,
    bearing: 0,
    interactive: false,
    pixelRatio: state.performance.lowEnd ? 1 : Math.min(window.devicePixelRatio || 1, 1.3),
    antialias: !state.performance.lowEnd
});

// Expose globally
window.map = map;
window.THREE = THREE;

let currentProgress = 0;
let targetProgress = 0;

function smoothProgress() {
    if (currentProgress < targetProgress) {
        const alpha = (targetProgress >= 100) ? 0.45 : 0.35;
        currentProgress += (targetProgress - currentProgress) * alpha;
        if (targetProgress >= 100 && 100 - currentProgress < 0.05) currentProgress = 100;
        setProgress(currentProgress);
    }
    if (currentProgress < 100) requestAnimationFrame(smoothProgress);
}

function startLoading() {
    const startTime = performance.now();
    const duration = 1000;
    smoothProgress();
    // Ensure the loading overlay blocks input while we are actively loading
    const overlayEl = document.getElementById('loading-overlay');
    if (overlayEl) overlayEl.classList.add('blocking');

    const tick = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min((elapsed / duration) * 100, 100);
        targetProgress = progress;
        if (progress < 100) requestAnimationFrame(tick);
        else finishLoading();
    };
    requestAnimationFrame(tick);
}

function finishLoading() {
    setProgress(100);
    setTimeout(() => {
        const overlayEl = document.getElementById('loading-overlay');
        if (overlayEl) {
            overlayEl.classList.add('fade-out');
            // remove blocking so pointer-events follow .fade-out (which sets none)
            overlayEl.classList.remove('blocking');
        }
        setTimeout(() => {
            if (overlayEl) overlayEl.style.display = 'none';
            state.lastTime = performance.now();
            state.loopStarted = true;
            requestAnimationFrame(update);
        }, 200);
    }, 50);
}

map.on('load', () => {
    cleanMap(map);
    add3DBuildings(map);
    setup3DVehicleLayer(map);
    setupVehicleMarker(map);
    addSkidMarksLayer(map);
    updateToggleStates();
    startLoading();

    // Apply standard preset if active on load
    if (state.mapStyle === 'standard') {
        try {
            map.setConfigProperty('basemap', 'lightPreset', state.lightPreset || 'day');
        } catch (e) {
            console.warn("Could not set standard preset on load:", e);
        }
    }
});

map.on('style.load', () => {
    cleanMap(map);
    add3DBuildings(map);
    setup3DVehicleLayer(map);
    setupVehicleMarker(map);
    addSkidMarksLayer(map);

    // Apply standard preset if active on style load
    if (state.mapStyle === 'standard') {
        try {
            map.setConfigProperty('basemap', 'lightPreset', state.lightPreset || 'day');
        } catch (e) {
            console.warn("Could not set standard preset on style load:", e);
        }
    }
});

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
            document.getElementById('speed').textContent = (speedVal > 0 && state.velocity < -0.0001 ? '-' : '') + speedVal;
            state.lastHUDUpdateSpeed = speedVal;
        }
    }

    requestAnimationFrame(update);
}

// Initialize components
initUI(map);
initControls();

// Disable Right-Click
document.addEventListener('contextmenu', e => e.preventDefault());

document.getElementById('mp-btn').onclick = (e) => {
    const mpDropdown = document.getElementById('mp-dropdown');
    if (mpDropdown && mpDropdown.contains(e.target)) return;

    e.stopPropagation();
    if (!window.mpInitialized) {
        initMultiplayer();
        if (mpDropdown) mpDropdown.classList.add('active');
        trackEvent('multiplayer_init');
    } else {
        const isActive = mpDropdown.classList.toggle('active');
        trackEvent('multiplayer_toggle', { active: isActive });
    }
};