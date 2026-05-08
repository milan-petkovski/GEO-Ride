// Configuration
const MAPBOX_TOKEN = '%%MAPBOX_TOKEN%%';
const INITIAL_CENTER = [20.4489, 44.7866]; // Belgrade
const INITIAL_ZOOM = 18;

// Custom Premium SVGs
const CAR_SVG = `<svg width="60" height="110" viewBox="0 0 60 110" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 25C5 15 15 5 30 5C45 5 55 15 55 25V85C55 95 45 105 30 105C15 105 5 95 5 85V25Z" fill="#1A1A1A" stroke="#00F2FF" stroke-width="2"/><path d="M10 35C10 30 15 25 30 25C45 25 50 30 50 35V50H10V35Z" fill="#00F2FF" fill-opacity="0.2" stroke="#00F2FF" stroke-width="1"/><path d="M12 75H48V85C48 90 40 95 30 95C20 95 12 90 12 85V75Z" fill="#00F2FF" fill-opacity="0.1" stroke="#00F2FF" stroke-width="0.5"/><rect x="10" y="12" width="10" height="6" rx="2" fill="white"/><rect x="40" y="12" width="10" height="6" rx="2" fill="white"/></svg>`;
const TRUCK_SVG = `<svg width="80" height="180" viewBox="0 0 80 180" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="60" height="160" rx="4" fill="#111" stroke="#00F2FF" stroke-width="2"/><rect x="12" y="12" width="56" height="50" rx="3" fill="#222" stroke="#00F2FF" stroke-width="1"/><rect x="18" y="18" width="44" height="15" rx="2" fill="#00F2FF" fill-opacity="0.3"/><rect x="15" y="65" width="50" height="100" rx="2" fill="#0A0A0A" stroke="#333"/></svg>`;
const BUS_SVG = `<svg width="80" height="200" viewBox="0 0 80 200" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="60" height="180" rx="5" fill="#151515" stroke="#00F2FF" stroke-width="2"/><rect x="15" y="20" width="50" height="20" rx="2" fill="#00F2FF" fill-opacity="0.2"/><rect x="15" y="50" width="50" height="25" rx="2" fill="#00F2FF" fill-opacity="0.1"/><rect x="15" y="85" width="50" height="25" rx="2" fill="#00F2FF" fill-opacity="0.1"/><rect x="15" y="120" width="50" height="25" rx="2" fill="#00F2FF" fill-opacity="0.1"/><rect x="15" y="155" width="50" height="20" rx="2" fill="#00F2FF" fill-opacity="0.1"/></svg>`;
const GOD_SVG = `<svg width="70" height="130" viewBox="0 0 70 130" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M35 5C15 5 5 25 5 45V105C5 115 15 125 35 125C55 125 65 115 65 105V45C65 25 55 5 35 5Z" fill="#0A0A0A" stroke="#FF00E5" stroke-width="2.5"/><path d="M10 50C10 35 20 20 35 20C50 20 60 35 60 50V70H10V50Z" fill="#FF00E5" fill-opacity="0.3"/><rect x="15" y="10" width="10" height="4" rx="2" fill="#FF00E5"><animate attributeName="opacity" values="0.4;1;0.4" dur="0.5s" repeatCount="indefinite"/></rect><rect x="45" y="10" width="10" height="4" rx="2" fill="#FF00E5"><animate attributeName="opacity" values="0.4;1;0.4" dur="0.5s" repeatCount="indefinite"/></rect><path d="M5 80H65" stroke="#FF00E5" stroke-width="1" stroke-dasharray="4 2"/><path d="M10 110L60 110" stroke="#FF00E5" stroke-width="3" stroke-opacity="0.6"/></svg>`;

const VEHICLE_CONFIG = {
    car: { power: 0.0007, brake: 0.003, maxSpeed: 0.38, turnRate: 0.8, steeringWeight: 0.05, size: 0.9, svg: CAR_SVG },
    truck: { power: 0.0003, brake: 0.0015, maxSpeed: 0.22, turnRate: 0.5, steeringWeight: 0.02, size: 0.7, svg: TRUCK_SVG },
    bus: { power: 0.00025, brake: 0.0012, maxSpeed: 0.18, turnRate: 1.0, steeringWeight: 0.015, size: 0.65, svg: BUS_SVG },
    god: { power: 0.04, brake: 0.08, maxSpeed: 1.667, turnRate: 2.2, steeringWeight: 0.1, size: 1.1, svg: GOD_SVG }
};

let state = { 
    lng: INITIAL_CENTER[0], lat: INITIAL_CENTER[1], 
    bearing: 0, travelBearing: 0, camBearing: 0,
    velocity: 0, steeringAngle: 0, 
    keys: {}, activeVehicle: 'car', unit: 'km', isInputFocused: false, godMode: false,
    lastTime: performance.now(),
    stopTime: 0, sKeyReleasedSinceStop: true, wKeyReleasedSinceStop: true,
    chargeLevel: 0, isCharging: false, currentPitch: 60,
    crashShake: 0, collisionsEnabled: true,
    currentHome: [...INITIAL_CENTER] // Dynamic spawn point
};

mapboxgl.accessToken = MAPBOX_TOKEN;
const map = new mapboxgl.Map({ 
    container: 'map', 
    style: 'mapbox://styles/mapbox/streets-v12', 
    center: INITIAL_CENTER, 
    zoom: 18, 
    pitch: 60, 
    bearing: 0, 
    antialias: true, 
    optimizeForTerrain: true,
    interactive: false // Disable pan, zoom, rotate via mouse/touch
});

window.addEventListener('keydown', (e) => { 
    if (state.isInputFocused) return; 
    const key = e.key.toLowerCase();
    state.keys[key] = true; 

    // HUD Highlight
    let searchKey = key === ' ' ? 'space' : key;
    if (key === 'arrowup') searchKey = 'w';
    if (key === 'arrowdown') searchKey = 's';
    if (key === 'arrowleft') searchKey = 'a';
    if (key === 'arrowright') searchKey = 'd';

    kbdElements.forEach(k => {
        if (k.textContent.trim().toLowerCase() === searchKey) k.classList.add('pressed');
    });
});

window.addEventListener('keyup', (e) => { 
    const key = e.key.toLowerCase();
    state.keys[key] = false; 
    if (key === 's' || key === 'arrowdown') state.sKeyReleasedSinceStop = true;
    if (key === 'w' || key === 'arrowup') state.wKeyReleasedSinceStop = true;

    // HUD Reset
    let searchKey = key === ' ' ? 'space' : key;
    if (key === 'arrowup') searchKey = 'w';
    if (key === 'arrowdown') searchKey = 's';
    if (key === 'arrowleft') searchKey = 'a';
    if (key === 'arrowright') searchKey = 'd';

    kbdElements.forEach(k => {
        if (k.textContent.trim().toLowerCase() === searchKey) k.classList.remove('pressed');
    });
});

const speedEl = document.getElementById('speed');
const unitLabel = document.getElementById('unit-label');
const loadingOverlay = document.getElementById('loading-overlay');
const progressBar = document.getElementById('progress-bar');
const searchInput = document.getElementById('location-search');
const searchBtn = document.getElementById('search-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const searchBox = document.querySelector('.search-box');
const kbdElements = document.querySelectorAll('kbd');
const collisionButtons = document.querySelectorAll('.collision-toggle button');
const godButtons = document.querySelectorAll('.god-toggle button');

function setProgress(p) { if (progressBar) progressBar.style.transform = `scaleX(${p / 100})`; }

let vehicleMarker;
function setupVehicleMarker() {
    if (vehicleMarker) vehicleMarker.remove();
    const config = VEHICLE_CONFIG[state.activeVehicle];
    const el = document.createElement('div');
    el.className = 'vehicle-marker';
    el.innerHTML = config.svg;
    
    // Automatic size extraction from SVG or config
    el.style.width = 'auto';
    el.style.height = 'auto';
    el.style.transform = `scale(${config.size})`;
    el.style.transformOrigin = 'center center';
    
    vehicleMarker = new mapboxgl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' })
        .setLngLat([state.lng, state.lat]).setRotation(state.bearing).addTo(map);
    
    // Force immediate position sync
    setTimeout(() => el.classList.add('visible'), 100);
}

map.on('load', () => {
    setProgress(30); setupVehicleMarker(); setProgress(60);
    if (!map.getLayer('3d-buildings')) { map.addLayer({ 'id': '3d-buildings', 'source': 'composite', 'source-layer': 'building', 'filter': ['==', 'extrude', 'true'], 'type': 'fill-extrusion', 'minzoom': 15, 'paint': { 'fill-extrusion-color': '#222', 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': ['get', 'min_height'], 'fill-extrusion-opacity': 0.8 } }); }
    setProgress(100); setTimeout(() => { loadingOverlay.style.opacity = '0'; loadingOverlay.style.pointerEvents = 'none'; setTimeout(() => loadingOverlay.style.display = 'none', 1200); }, 500);
    state.lastTime = performance.now();
    requestAnimationFrame(update);
});

map.on('style.load', () => { setupVehicleMarker(); });

function update(time) {
    const currentTime = time || performance.now();
    const dt = (currentTime - state.lastTime) / 16.667; 
    state.lastTime = currentTime;
    const dtFinal = isNaN(dt) ? 1 : Math.min(dt, 2); 

    const config = VEHICLE_CONFIG[state.activeVehicle];
    
    if (!state.isInputFocused) {
        if (state.keys['r']) { 
            state.lng = state.currentHome[0];
            state.lat = state.currentHome[1];
            state.velocity = 0; 
            state.steeringAngle = 0; 
            state.bearing = 0; 
            state.travelBearing = 0; 
            state.camBearing = 0; 
            map.jumpTo({ center: state.currentHome, zoom: 18, pitch: 60, bearing: 0 }); 
        }
        
        const isSDown = state.keys['s'] || state.keys['arrowdown'];
        const isWDown = state.keys['w'] || state.keys['arrowup'];

        if (isWDown) {
            if (state.velocity < -0.001) {
                state.velocity += config.brake * 1.5 * dtFinal;
                if (state.velocity >= -0.001) { state.velocity = 0; state.stopTime = currentTime; state.wKeyReleasedSinceStop = false; }
            } else if (state.velocity >= 0) {
                const timeSinceStop = currentTime - state.stopTime;
                if (state.wKeyReleasedSinceStop || timeSinceStop > 500) state.velocity += config.power * dtFinal;
                else state.velocity = 0;
            }
        } else if (isSDown) {
            if (state.velocity > 0.001) {
                state.velocity -= config.brake * dtFinal;
                if (state.velocity <= 0.001) { state.velocity = 0; state.stopTime = currentTime; state.sKeyReleasedSinceStop = false; }
            } else if (state.velocity <= 0) {
                const timeSinceStop = currentTime - state.stopTime;
                if (state.sKeyReleasedSinceStop || timeSinceStop > 500) state.velocity -= (config.power * 0.6) * dtFinal;
                else state.velocity = 0;
            }
        } else {
            state.velocity *= Math.pow(state.activeVehicle === 'god' ? 0.999 : 0.998, dtFinal);
            if (Math.abs(state.velocity) < 0.0001) state.velocity = 0;
        }
        
        if (Math.abs(state.velocity) < 0.01 && state.keys[' '] && isWDown) {
            state.isCharging = true;
            state.velocity = 0; // Force stop while charging
            state.chargeLevel = Math.min(state.chargeLevel + 0.015 * dtFinal, 1);
            speedEl.style.color = '#00F2FF';
            speedEl.style.textShadow = `0 0 25px #00F2FF`;
        } else {
            if (state.isCharging && !state.keys[' ']) {
                // LAUNCH! (Massive acceleration boost, but respect maxSpeed)
                // We give it an immediate 'kick' based on charge level
                state.velocity = config.maxSpeed * 0.75; 
                state.isCharging = false;
                // state.chargeLevel = 0; // Handled by decay
                speedEl.style.color = ''; 
                speedEl.style.textShadow = '';
            } else if (!state.keys[' ']) {
                state.isCharging = false;
                state.chargeLevel = 0;
            }
        }

        state.velocity = Math.max(-config.maxSpeed / 2.5, Math.min(config.maxSpeed, state.velocity));
        
        const inputDir = (state.keys['a'] || state.keys['arrowleft'] ? -1 : 0) + (state.keys['d'] || state.keys['arrowright'] ? 1 : 0);
        state.steeringAngle += (inputDir * config.turnRate - state.steeringAngle) * (config.steeringWeight * dtFinal);
        
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
        }
        
        const rad = (state.travelBearing) * (Math.PI / 180);
        const latRad = state.lat * (Math.PI / 180);
        const projectionFactor = 1 / Math.cos(latRad);
        const nextLng = state.lng + Math.sin(rad) * state.velocity * 0.0001 * projectionFactor * dtFinal;
        const nextLat = state.lat + Math.cos(rad) * state.velocity * 0.0001 * dtFinal;

        // High-Precision Collision Detection (Swept Path)
        if (state.collisionsEnabled && state.activeVehicle !== 'god' && Math.abs(state.velocity) > 0.01) {
            const midLng = (state.lng + nextLng) / 2;
            const midLat = (state.lat + nextLat) / 2;
            
            const checkPoints = [
                map.project([midLng, midLat]),
                map.project([nextLng, nextLat])
            ];
            
            let collisionFound = false;
            // Only check collision if moving forward
            if (state.velocity > 0) {
                for (const p of checkPoints) {
                    const bbox = [[p.x - 14, p.y - 14], [p.x + 14, p.y + 14]];
                    let collisions = [];
                    try {
                        if (map.getLayer('3d-buildings') || map.getLayer('building')) {
                            collisions = map.queryRenderedFeatures(bbox, { layers: ['3d-buildings', 'building'].filter(l => map.getLayer(l)) });
                        }
                    } catch (e) {
                        console.warn("Collision query failed:", e);
                    }
                    if (collisions.length > 0) {
                        collisionFound = true;
                        break;
                    }
                }
            }
            
            if (collisionFound) {
                // CRASH!
                state.velocity = -0.001; // Tiny micro-bounce to prevent getting stuck
                state.isCharging = false;
                state.chargeLevel = 0;
                state.crashShake = 15; 
                spawnDebris(nextLng, nextLat);
            } else {
                state.lng = nextLng;
                state.lat = nextLat;
            }
        } else {
            state.lng = nextLng;
            state.lat = nextLat;
        }
    } else {
        state.velocity *= Math.pow(0.998, dtFinal);
    }

    let targetCamBearing = state.bearing + (state.velocity < -0.01 ? 180 : 0);
    let diff = targetCamBearing - state.camBearing;
    while (diff < -180) diff += 360;
    while (diff > 180) diff -= 360;
    state.camBearing += diff * 0.1 * dtFinal;

    if (vehicleMarker) {
        vehicleMarker.setLngLat([state.lng, state.lat]);
        vehicleMarker.setRotation(state.bearing);
        const markerEl = vehicleMarker.getElement();
        
        if (state.isCharging) {
            const shake = (Math.random() - 0.5) * state.chargeLevel * 10;
            markerEl.style.transform = `scale(${config.size}) translate(${shake}px, ${shake}px)`;
        } else if (state.keys[' '] && state.activeVehicle !== 'god') {
            const tilt = state.steeringAngle * 10;
            markerEl.style.transform = `scale(${config.size}) skewX(${tilt}deg)`;
        } else if (Math.abs(state.velocity) < 0.001) {
            // Subtle Idle Vibration
            const idleShake = (Math.sin(currentTime * 0.05) * 0.15);
            markerEl.style.transform = `scale(${config.size}) translateY(${idleShake}px)`;
        } else {
            markerEl.style.transform = `scale(${config.size})`;
        }
    }
    
    // Smooth target pitch calculation
    const chargingLean = state.chargeLevel * 15;
    const velocityPitch = (Math.abs(state.velocity) * 25 / (state.activeVehicle === 'god' ? 5 : 1));
    const targetPitch = 60 + chargingLean + velocityPitch;
    
    // Lerp the pitch for ultimate smoothness
    state.currentPitch += (targetPitch - state.currentPitch) * 0.03 * dtFinal;
    
    // Impact Shake Logic
    const shakeX = (Math.random() - 0.5) * state.crashShake;
    const shakeY = (Math.random() - 0.5) * state.crashShake;
    
    map.jumpTo({ 
        center: [state.lng, state.lat], 
        bearing: state.camBearing + shakeX,
        pitch: state.currentPitch + shakeY
    });
    
    // Ultra-smooth slow decay for charge level
    if (!state.isCharging && state.chargeLevel > 0) {
        state.chargeLevel *= 0.98; 
        if (state.chargeLevel < 0.001) state.chargeLevel = 0;
    }

    // Rapid decay for crash shake
    if (state.crashShake > 0) {
        state.crashShake *= 0.85;
        if (state.crashShake < 0.1) state.crashShake = 0;
    }
    
    let speedVal = Math.abs(state.velocity) * 600;
    if (state.unit === 'mi') speedVal *= 0.621371;
    speedEl.textContent = (state.velocity < -0.0001 ? '-' : '') + Math.floor(speedVal);
    requestAnimationFrame(update);
}

// Logic
settingsBtn.onclick = (e) => { e.stopPropagation(); settingsPanel.classList.toggle('active'); };
document.onclick = (e) => { if (!settingsPanel.contains(e.target) && e.target !== settingsBtn) settingsPanel.classList.remove('active'); };
document.querySelectorAll('.style-toggle button').forEach(btn => { btn.onclick = () => { document.querySelector('.style-toggle button.active').classList.remove('active'); btn.classList.add('active'); map.setStyle(`mapbox://styles/mapbox/${btn.dataset.style}`); }; });
document.querySelectorAll('.vehicle-toggle button').forEach(btn => { btn.onclick = () => { document.querySelector('.vehicle-toggle button.active').classList.remove('active'); btn.classList.add('active'); state.activeVehicle = btn.dataset.vehicle; setupVehicleMarker(); }; });
document.querySelectorAll('.unit-toggle button').forEach(btn => { btn.onclick = () => { document.querySelector('.unit-toggle button.active').classList.remove('active'); btn.classList.add('active'); state.unit = btn.dataset.unit; unitLabel.textContent = state.unit === 'km' ? 'KM/H' : 'MPH'; }; });

// God Mode Logic
document.querySelectorAll('.collision-toggle button').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.collision-toggle button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.collisionsEnabled = btn.dataset.collision === 'on';
    };
});

document.querySelectorAll('.god-toggle button').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.god-toggle button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.godMode = btn.dataset.god === 'on'; 
        
        // Sync collisions with GOD MODE
        if (state.godMode) {
            state.collisionsEnabled = false;
        } else {
            state.collisionsEnabled = true;
        }

        // Update UI buttons
        document.querySelectorAll('.collision-toggle button').forEach(b => {
            b.classList.remove('active');
            if (state.collisionsEnabled && b.dataset.collision === 'on') b.classList.add('active');
            if (!state.collisionsEnabled && b.dataset.collision === 'off') b.classList.add('active');
        });
        
        const vehicleToggle = document.querySelector('.vehicle-toggle');
        if (state.godMode) {
            if (!document.querySelector('[data-vehicle="god"]')) {
                const godBtn = document.createElement('button');
                godBtn.dataset.vehicle = 'god'; godBtn.textContent = 'GOD';
                godBtn.style.color = '#FF00E5'; godBtn.style.textShadow = '0 0 5px #FF00E5';
                godBtn.onclick = () => { document.querySelector('.vehicle-toggle button.active').classList.remove('active'); godBtn.classList.add('active'); state.activeVehicle = 'god'; setupVehicleMarker(); };
                vehicleToggle.appendChild(godBtn);
            }
            state.activeVehicle = 'god';
            document.querySelectorAll('.vehicle-toggle button').forEach(b => b.classList.remove('active'));
            document.querySelector('[data-vehicle="god"]').classList.add('active');
            setupVehicleMarker();
        } else {
            const godBtn = document.querySelector('[data-vehicle="god"]');
            if (godBtn) godBtn.remove();
            if (state.activeVehicle === 'god') {
                state.activeVehicle = 'car';
                document.querySelectorAll('.vehicle-toggle button').forEach(b => b.classList.remove('active'));
                document.querySelector('[data-vehicle="car"]').classList.add('active');
                setupVehicleMarker();
            }
        }
    }; 
});

async function performSearch() {
    const query = searchInput.value; if (!query) return;
    try {
        const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}`);
        const data = await response.json();
        if (data.features && data.features.length > 0) {
            const [lng, lat] = data.features[0].center; 
            state.lng = lng; state.lat = lat; state.velocity = 0;
            state.currentHome = [lng, lat]; // Update spawn point to new location
            map.flyTo({ center: [lng, lat], zoom: 18, pitch: 60, essential: true });
            searchInput.value = ''; searchInput.blur(); searchBox.classList.remove('expanded');
        }
    } catch (err) { console.error("Search error:", err); }
}
searchBtn.onclick = performSearch;
searchBox.onmouseenter = () => searchBox.classList.add('expanded');
searchBox.onmouseleave = () => { if (!state.isInputFocused) searchBox.classList.remove('expanded'); };
searchInput.onfocus = () => { state.isInputFocused = true; state.keys = {}; searchBox.classList.add('expanded'); };
searchInput.onblur = () => { state.isInputFocused = false; if (!searchInput.value) searchBox.classList.remove('expanded'); };
searchInput.onkeypress = (e) => { if (e.key === 'Enter') performSearch(); };
// Ultimate Physics Cursor Engine
const customCursor = document.getElementById('custom-cursor');
let cursorState = {
    currX: window.innerWidth / 2, currY: window.innerHeight / 2, 
    targetX: window.innerWidth / 2, targetY: window.innerHeight / 2,
    currScale: 1, targetScale: 1,
    currOpacity: 0, targetOpacity: 0,
    isIdle: true, lastMove: Date.now(),
    type: 'default',
    hasMoved: false
};

function initCursor() {
    function loop() {
        // Position Lerp (0.15 for smooth heavy feel)
        cursorState.currX += (cursorState.targetX - cursorState.currX) * 0.15;
        cursorState.currY += (cursorState.targetY - cursorState.currY) * 0.15;
        
        // Scale & Opacity Lerp
        cursorState.currScale += (cursorState.targetScale - cursorState.currScale) * 0.15;
        cursorState.currOpacity += (cursorState.targetOpacity - cursorState.currOpacity) * 0.1;

        // Idle Check
        if (cursorState.hasMoved && Date.now() - cursorState.lastMove > 3000 && !state.isInputFocused) {
            cursorState.targetOpacity = 0;
        } else if (cursorState.hasMoved) {
            cursorState.targetOpacity = 1;
        }

        // Apply Styles
        customCursor.style.left = `${cursorState.currX}px`;
        customCursor.style.top = `${cursorState.currY}px`;
        customCursor.style.opacity = cursorState.currOpacity;
        customCursor.style.transform = `translate(-50%, -50%) scale(${cursorState.currScale})`;
        
        // Dynamic Colors & States
        if (cursorState.type === 'building') {
            customCursor.style.borderColor = 'var(--primary)';
            customCursor.style.backgroundColor = 'rgba(0, 242, 255, 0.1)';
            cursorState.targetScale = 1.5;
        } else if (cursorState.type === 'ui') {
            customCursor.style.borderColor = '#fff';
            customCursor.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            cursorState.targetScale = 2.2;
        } else if (cursorState.type === 'typing') {
            customCursor.style.borderColor = 'var(--primary)';
            customCursor.style.backgroundColor = 'rgba(0, 242, 255, 0.3)';
            cursorState.targetScale = 1;
        } else {
            customCursor.style.borderColor = 'rgba(255, 255, 255, 0.9)';
            customCursor.style.backgroundColor = 'transparent';
            cursorState.targetScale = 1;
        }

        requestAnimationFrame(loop);
    }
    loop();
}

window.addEventListener('mousemove', (e) => {
    cursorState.targetX = e.clientX;
    cursorState.targetY = e.clientY;
    cursorState.lastMove = Date.now();
    cursorState.hasMoved = true;
    
    // Robust Building Detection (10px buffer)
    const point = map.project(map.unproject([e.clientX, e.clientY])); // Sync with map point
    const bbox = [[e.clientX - 10, e.clientY - 10], [e.clientX + 10, e.clientY + 10]];
    let features = [];
    try {
        if (map.getLayer('3d-buildings') || map.getLayer('building')) {
            features = map.queryRenderedFeatures(bbox, { layers: ['3d-buildings', 'building'].filter(l => map.getLayer(l)) });
        }
    } catch (e) {
        // Silently fail for mouse hover features
    }
    
    if (cursorState.type !== 'ui' && cursorState.type !== 'typing') {
        cursorState.type = features.length > 0 ? 'building' : 'default';
    }
});

// State Management
document.querySelectorAll('button, a, .toggle-group, kbd, .settings-main-btn, .coffee-btn').forEach(el => {
    el.addEventListener('mouseenter', () => { cursorState.type = 'ui'; });
    el.addEventListener('mouseleave', () => { cursorState.type = 'default'; });
});

searchInput.addEventListener('mouseenter', () => { cursorState.type = 'typing'; customCursor.classList.add('typing'); });
searchInput.addEventListener('mouseleave', () => { cursorState.type = 'default'; customCursor.classList.remove('typing'); });

function spawnDebris(lng, lat) {
    for (let i = 0; i < 5; i++) {
        const el = document.createElement('div');
        el.className = 'debris';
        el.style.animation = `debris-spin ${0.5 + Math.random()}s linear infinite`;
        el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        
        const marker = new mapboxgl.Marker(el)
            .setLngLat([lng, lat])
            .addTo(map);
            
        const vx = (Math.random() - 0.5) * 0.0005;
        const vy = (Math.random() - 0.5) * 0.0005;
        let opacity = 1;
        let curLng = lng;
        let curLat = lat;
        
        const animateDebris = () => {
            curLng += vx;
            curLat += vy;
            opacity -= 0.02;
            
            if (opacity > 0) {
                marker.setLngLat([curLng, curLat]);
                el.style.opacity = opacity;
                requestAnimationFrame(animateDebris);
            } else {
                marker.remove();
            }
        };
        requestAnimationFrame(animateDebris);
    }
}

initCursor();
