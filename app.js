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
import { initUI, updateToggleStates, add3DBuildings, applyLightPreset } from './js/ui.js';
import { initControls } from './js/controls.js';
import { setup3DVehicleLayer, setupVehicleMarker, getVehicleMarker, updateSkidMarks } from './js/three-manager.js';
import { initMultiplayer, updateOtherPlayers } from './js/multiplayer.js';
import { updatePhysics, updateCamera } from './js/physics.js';
import { cleanMap, setProgress, addSkidMarksLayer } from './js/utils.js';
import { trackEvent, trackWebVitals } from './js/analytics.js';
import { checkDiscovery } from './js/discovery.js';
import { updateAudio } from './js/audio.js';

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
        : (state.performance.lowEnd ? 1.0 : Math.min(window.devicePixelRatio || 1, 1.3)),
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

let isMapFullyLoaded = false;
map.once('idle', () => {
    isMapFullyLoaded = true;
});
// Safety fallback after 3 seconds in case network is slow or offline
setTimeout(() => {
    isMapFullyLoaded = true;
}, 3000);

function finishLoading() {
    if (!isMapFullyLoaded) {
        setTimeout(finishLoading, 50);
        return;
    }
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

let isInitialMapLoad = true;

map.on('load', () => {
    isInitialMapLoad = false;
    cleanMap(map);
    add3DBuildings(map);
    setup3DVehicleLayer(map);
    setupVehicleMarker(map);
    addSkidMarksLayer(map);
    updateToggleStates();
    startLoading();

    // Apply standard preset if active on load
    applyLightPreset(map);
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