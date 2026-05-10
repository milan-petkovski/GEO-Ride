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

// Load initial state
loadState();

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
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

// Expose map globally for some modules
window.map = map;

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
        document.getElementById('loading-overlay').classList.add('fade-out');
        setTimeout(() => {
            document.getElementById('loading-overlay').style.display = 'none';
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
});

map.on('style.load', () => {
    cleanMap(map);
    add3DBuildings(map);
    setup3DVehicleLayer(map);
    setupVehicleMarker(map);
    addSkidMarksLayer(map);
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
            document.getElementById('speed').textContent = (state.velocity < -0.0001 ? '-' : '') + speedVal;
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
    e.stopPropagation();
    if (!window.mpInitialized) {
        initMultiplayer();
        document.getElementById('mp-dropdown').classList.add('active');
    } else {
        document.getElementById('mp-dropdown').classList.toggle('active');
    }
};
