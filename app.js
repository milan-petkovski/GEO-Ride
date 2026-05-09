// Configuration
const MAPBOX_TOKEN = '%%MAPBOX_TOKEN%%';
const INITIAL_CENTER = [20.251391, 44.831868]; // Belgrade
const INITIAL_ZOOM = 18;

// Custom Premium SVGs
const CAR_SVG = `<svg width="60" height="110" viewBox="0 0 60 110" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 25C10 15 15 5 30 5C45 5 50 15 50 25V85C50 95 45 105 30 105C15 105 10 95 10 85V25Z" fill="#0A0A0A" stroke="#00F2FF" stroke-width="2.5"/><path d="M15 35L30 25L45 35V55H15V35Z" fill="#00F2FF" fill-opacity="0.3" stroke="#00F2FF" stroke-width="1"/><rect x="15" y="85" width="30" height="12" rx="2" fill="#00F2FF" fill-opacity="0.1"/><rect x="14" y="14" width="8" height="3" rx="1" fill="white" fill-opacity="0.9"/><rect x="38" y="14" width="8" height="3" rx="1" fill="white" fill-opacity="0.9"/></svg>`;
const TRUCK_SVG = `<svg width="80" height="180" viewBox="0 0 80 180" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 15L70 15V175C70 180 65 185 40 185C15 185 10 180 10 175V15Z" fill="#0A0A0A" stroke="#00F2FF" stroke-width="2.5"/><rect x="10" y="10" width="60" height="40" rx="4" fill="#111" stroke="#00F2FF" stroke-width="1.5"/><path d="M15 15L65 15V25H15V15Z" fill="#00F2FF" fill-opacity="0.4"/><rect x="15" y="55" width="50" height="110" rx="2" fill="#151515" stroke="#333"/></svg>`;
const BUS_SVG = `<svg width="80" height="200" viewBox="0 0 80 200" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 20C10 12 18 10 40 10C62 10 70 12 70 20V180C70 188 62 190 40 190C18 190 10 188 10 180V20Z" fill="#111" stroke="#00F2FF" stroke-width="2.5"/><path d="M15 25C15 18 25 15 40 15C55 15 65 18 65 25V45H15V25Z" fill="#00F2FF" fill-opacity="0.4"/><rect x="15" y="55" width="50" height="30" rx="2" fill="#00F2FF" fill-opacity="0.15"/><rect x="15" y="95" width="50" height="30" rx="2" fill="#00F2FF" fill-opacity="0.15"/><rect x="15" y="135" width="50" height="30" rx="2" fill="#00F2FF" fill-opacity="0.15"/><rect x="25" y="175" width="30" height="5" rx="1" fill="#00F2FF" fill-opacity="0.3"/></svg>`;
const GOD_SVG = `<svg width="70" height="130" viewBox="0 0 70 130" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M35 5C15 5 5 25 5 45V105C5 115 15 125 35 125C55 125 65 115 65 105V45C65 25 55 5 35 5Z" fill="#0A0A0A" stroke="#FF00E5" stroke-width="2.5"/><path d="M10 50C10 35 20 20 35 20C50 20 60 35 60 50V70H10V50Z" fill="#FF00E5" fill-opacity="0.3"/><rect x="15" y="10" width="10" height="4" rx="2" fill="#FF00E5"><animate attributeName="opacity" values="0.4;1;0.4" dur="0.5s" repeatCount="indefinite"/></rect><rect x="45" y="10" width="10" height="4" rx="2" fill="#FF00E5"><animate attributeName="opacity" values="0.4;1;0.4" dur="0.5s" repeatCount="indefinite"/></rect><path d="M5 80H65" stroke="#FF00E5" stroke-width="1" stroke-dasharray="4 2"/><path d="M10 110L60 110" stroke="#FF00E5" stroke-width="3" stroke-opacity="0.6"/></svg>`;

const VEHICLE_CONFIG = {
    car: { power: 0.0009, brake: 0.004, maxSpeed: 0.4167, turnRate: 0.8, steeringWeight: 0.05, size: 0.9, svg: CAR_SVG },
    truck: { power: 0.00045, brake: 0.002, maxSpeed: 0.25, turnRate: 0.5, steeringWeight: 0.02, size: 0.7, svg: TRUCK_SVG },
    bus: { power: 0.00035, brake: 0.0015, maxSpeed: 0.2, turnRate: 1.0, steeringWeight: 0.015, size: 0.65, svg: BUS_SVG },
    god: { power: 0.04, brake: 0.08, maxSpeed: 1.667, turnRate: 2.2, steeringWeight: 0.1, size: 1, svg: GOD_SVG }
};

const PERFORMANCE_PROFILE = (() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const deviceMemory = navigator.deviceMemory || 8;
    const hardwareConcurrency = navigator.hardwareConcurrency || 8;
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = !!(connection && connection.saveData);
    const touchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const compactViewport = Math.min(window.innerWidth, window.innerHeight) <= 900;
    const lowEnd = saveData || reducedMotion || (deviceMemory <= 4 && hardwareConcurrency <= 6) || (compactViewport && hardwareConcurrency <= 6) || (touchDevice && hardwareConcurrency <= 4);

    return {
        lowEnd,
        touchDevice,
        reducedMotion,
        deviceMemory,
        hardwareConcurrency,
        saveData
    };
})();

document.documentElement.classList.toggle('geo-performance-low', PERFORMANCE_PROFILE.lowEnd);
document.documentElement.classList.toggle('geo-reduced-motion', PERFORMANCE_PROFILE.reducedMotion);

function saveState() {
    try {
        const dataToSave = {
            lng: state.lng,
            lat: state.lat,
            activeVehicle: state.activeVehicle,
            unit: state.unit,
            collisionsEnabled: state.collisionsEnabled,
            is3D: state.is3D,
            is3DBuildings: state.is3DBuildings,
            mapStyle: state.mapStyle
        };
        localStorage.setItem('geo_ride_state', JSON.stringify(dataToSave));
    } catch (e) {
        console.warn('Could not save state', e);
    }
}

function loadState() {
    try {
        const saved = localStorage.getItem('geo_ride_state');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Apply loaded values to the initial state
            return {
                lng: parsed.lng ?? INITIAL_CENTER[0],
                lat: parsed.lat ?? INITIAL_CENTER[1],
                activeVehicle: parsed.activeVehicle ?? 'car',
                unit: parsed.unit ?? 'km',
                collisionsEnabled: parsed.collisionsEnabled ?? true,
                is3D: parsed.is3D ?? true,
                is3DBuildings: parsed.is3DBuildings ?? true,
                mapStyle: parsed.mapStyle ?? 'streets-v12'
            };
        }
    } catch (e) {
        console.warn('Could not load state', e);
    }
    return null;
}

const loaded = loadState();

let state = {
    lng: loaded?.lng ?? INITIAL_CENTER[0], 
    lat: loaded?.lat ?? INITIAL_CENTER[1],
    bearing: 0, travelBearing: 0, camBearing: 0,
    velocity: 0, steeringAngle: 0,
    keys: {}, activeVehicle: loaded?.activeVehicle ?? 'car', 
    unit: loaded?.unit ?? 'km', 
    mapStyle: loaded?.mapStyle ?? 'streets-v12',
    isInputFocused: false, godMode: false,
    lastTime: performance.now(),
    stopTime: 0, sKeyReleasedSinceStop: true, wKeyReleasedSinceStop: true,
    chargeLevel: 0, isCharging: false, currentPitch: 65,
    crashShake: 0, collisionsEnabled: loaded?.collisionsEnabled ?? true, 
    is3D: loaded?.is3D ?? true, is3DBuildings: loaded?.is3DBuildings ?? true,
    currentHome: [loaded?.lng ?? INITIAL_CENTER[0], loaded?.lat ?? INITIAL_CENTER[1]],
    skidMarks: [],
    lastSkidPos: null,
    skidUpdateFrame: 0,
    otherPlayers: {}, // ID -> {lng, lat, bearing, vehicle, model}
    collisionCheckFrame: 0,
    performance: PERFORMANCE_PROFILE,
    mouseRotation: 0,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    lastCameraManualMove: 0,
    isCameraAnimating: false,
    isTeleporting: false,
    teleportProgress: 0,
    teleportStartTime: 0,
    teleportDuration: 3500,
    loopStarted: false,
    lastSaveTime: 0
};

mapboxgl.accessToken = MAPBOX_TOKEN;
const map = new mapboxgl.Map({
    container: 'map',
    style: `mapbox://styles/mapbox/${state.mapStyle}`,
    center: [state.lng, state.lat],
    zoom: 18,
    pitch: 65, 
    bearing: 0,
    antialias: !PERFORMANCE_PROFILE.lowEnd,
    optimizeForTerrain: !PERFORMANCE_PROFILE.lowEnd,
    localIdeographFontFamily: "'Outfit', sans-serif",
    performanceMetrics: false,
    trackResize: true,
    preserveDrawingBuffer: false,
    fadeDuration: 0,
    pixelRatio: PERFORMANCE_PROFILE.lowEnd ? 1 : Math.min(window.devicePixelRatio || 1, 1.3),
    interactive: false // Disable pan, zoom, rotate via mouse/touch
});

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();

    // ESC to Close All Popups (Always active)
    if (key === 'escape') {
        closeAllPanels();
        return;
    }

    // Track shift key for special combinations like Shift + R
    if (key === 'shift') {
        state.keys['shift'] = true;
    }

    // Completely disable Tab navigation globally
    if (key === 'tab') {
        e.preventDefault();
        return;
    }

    // Block driving logic until loading is finished (but allow key registration)
    if (state.isInputFocused) return;

    // Close all panels when driving keys are pressed
    const drivingKeys = ['w', 'a', 's', 'd', ' ', 'r', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
    if (drivingKeys.includes(key)) {
        closeAllPanels();
        // Hide cursor when driving
        document.documentElement.classList.add('geo-hide-cursor');
    }

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

    if (!state.loopStarted) return;
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

window.addEventListener('blur', () => {
    // Safety: Reset all keys when window loses focus (e.g., switching tabs)
    state.keys = {};
    kbdElements.forEach(k => k.classList.remove('pressed'));
    // Small braking force for safety
    state.velocity *= 0.8;
});

// Show cursor when mouse moves
window.addEventListener('mousemove', () => {
    document.documentElement.classList.remove('geo-hide-cursor');
});



const speedEl = document.getElementById('speed');
const unitLabel = document.getElementById('unit-label');
const loadingOverlay = document.getElementById('loading-overlay');
const progressBar = document.getElementById('progress-bar');
const searchInput = document.getElementById('location-search');
const searchBtn = document.getElementById('search-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const mpDropdown = document.getElementById('mp-dropdown');
const mpBtn = document.getElementById('mp-btn');
const searchBox = document.querySelector('.search-box');
const kbdElements = document.querySelectorAll('kbd');
const collisionButtons = document.querySelectorAll('.collision-toggle button');
const godButtons = document.querySelectorAll('.god-toggle button');

function closeAllPanels() {
    settingsPanel?.classList.remove('active');
    mpDropdown?.classList.remove('active');
    searchBox?.classList.remove('expanded');
    if (state) state.isInputFocused = false;
    if (searchInput) searchInput.blur();
}

const loadingPercentage = document.getElementById('loading-percentage');

function setProgress(p) {
    const clamped = Math.max(0, Math.min(p, 100));
    if (progressBar) {
        progressBar.style.transform = `scaleX(${(clamped / 100).toFixed(3)})`;
        progressBar.style.transformOrigin = 'left';
    }
    if (loadingPercentage) {
        loadingPercentage.textContent = `${Math.round(clamped)}%`;
    }
}

// Initial Kickstart handled by smoothProgress()

let threeLayer;
let vehicleMarker;

function setupVehicleMarker() {
    if (vehicleMarker) vehicleMarker.remove();

    // Show 2D marker if in 2D mode OR if it's God mode (which is always 2D)
    if (!state.is3D || state.activeVehicle === 'god') {
        const config = VEHICLE_CONFIG[state.activeVehicle];
        const el = document.createElement('div');
        el.className = 'marker-container';

        const inner = document.createElement('div');
        inner.className = `vehicle-marker ${state.activeVehicle}-2d`;
        inner.innerHTML = config.svg;
        inner.style.transform = `scale(${config.size * 1.2})`;
        inner.style.transition = 'transform 0.1s ease-out';

        el.appendChild(inner);

        vehicleMarker = new mapboxgl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' })
            .setLngLat([state.lng, state.lat]).setRotation(state.bearing).addTo(map);
    }
}
function setup3DVehicleLayer() {
    // If 3D is OFF or we are in God Mode, ensure the layer is gone and return
    if (!state.is3D || state.activeVehicle === 'god') {
        if (map.getLayer('3d-vehicle-layer')) map.removeLayer('3d-vehicle-layer');
        return;
    }

    // If layer already exists, just rebuild the model for the new vehicle type
    if (map.getLayer('3d-vehicle-layer')) {
        if (threeLayer && threeLayer.buildVehicle) threeLayer.buildVehicle(state.activeVehicle);
        return;
    }

    const modelOrigin = [state.lng, state.lat];
    const modelAltitude = 0;
    const modelRotate = [Math.PI / 2, 0, 0];

    const modelAsMercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat(modelOrigin, modelAltitude);

    const modelTransform = {
        translateX: modelAsMercatorCoordinate.x,
        translateY: modelAsMercatorCoordinate.y,
        translateZ: modelAsMercatorCoordinate.z,
        rotateX: modelRotate[0],
        rotateY: modelRotate[1],
        rotateZ: modelRotate[2],
        scale: modelAsMercatorCoordinate.meterInMercatorCoordinateUnits()
    };

    const THREE = window.THREE;

    threeLayer = {
        id: '3d-vehicle-layer',
        type: 'custom',
        renderingMode: '3d',
        onAdd: function (map, gl) {
            this.camera = new THREE.Camera();
            this.scene = new THREE.Scene();

            // Optimization: Reuse objects to avoid GC pressure
            this.matrix = new THREE.Matrix4();
            this.translation = new THREE.Matrix4();
            this.scaleVec = new THREE.Vector3();
            this.rotation = new THREE.Matrix4();

            // Lighting
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            this.scene.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(0, -70, 100).normalize();
            this.scene.add(directionalLight);

            // Create Vehicle Group
            this.vehicleGroup = new THREE.Group();
            this.scene.add(this.vehicleGroup);

            // Create Other Players Group
            this.othersGroup = new THREE.Group();
            this.scene.add(this.othersGroup);

            this.buildVehicle(state.activeVehicle);

            this.map = map;
            this.renderer = new THREE.WebGLRenderer({
                canvas: map.getCanvas(),
                context: gl,
                antialias: false,
                powerPreference: "high-performance"
            });

            this.renderer.autoClear = false;
        },
        buildVehicle: function (type) {
            // Clear existing
            while (this.vehicleGroup.children.length > 0) {
                this.vehicleGroup.remove(this.vehicleGroup.children[0]);
            }
            this.wheels = [];

            if (type === 'god') return; // Don't build 3D for God

            const THREE = window.THREE;
            const primaryColor = 0x333333;
            const accentColor = 0x00F2FF;
            const lowEnd = state.performance.lowEnd;
            const wheelSegments = lowEnd ? 8 : 12;

            // Teleport Sphere (Visible only during search)
            const teleSphereGeom = new THREE.SphereGeometry(1.2, 32, 32);
            const teleSphereMat = new THREE.MeshStandardMaterial({
                color: 0x00F2FF,
                emissive: 0x00F2FF,
                emissiveIntensity: 5,
                transparent: true,
                opacity: 0.8
            });
            this.teleSphere = new THREE.Mesh(teleSphereGeom, teleSphereMat);
            this.teleSphere.name = 'teleportSphere';
            this.teleSphere.visible = true; // Visibility handled in render
            this.vehicleGroup.add(this.teleSphere);

            if (type === 'car' || type === 'god') {

                const mainMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.8 });
                const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 2 });
                const glassMat = new THREE.MeshStandardMaterial({ color: 0x00F2FF, transparent: true, opacity: 0.5 });
                const loader = new THREE.TextureLoader();
                const logoTex = loader.load('favicon.png');

                // 1. Elongated Supercar Body
                const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 4.5), mainMat);
                body.position.y = 0.4;
                this.vehicleGroup.add(body);

                // 2. Tapered Fenders
                const fenderGeom = new THREE.BoxGeometry(0.3, 0.55, 1.3);
                [[-0.9, 0.45, 1.4], [0.9, 0.45, 1.4], [-0.9, 0.45, -1.5], [0.9, 0.45, -1.5]].forEach(pos => {
                    const f = new THREE.Mesh(fenderGeom, mainMat);
                    f.position.set(...pos);
                    this.vehicleGroup.add(f);
                });

                // 3. Aerodynamic Front
                const hood = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 1.6), mainMat);
                hood.position.set(0, 0.55, 1.45);
                hood.rotation.x = -0.25;
                this.vehicleGroup.add(hood);

                // 4. Cockpit (Swept back glass)
                const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 2.2), glassMat);
                cabin.position.set(0, 0.8, -0.2);
                this.vehicleGroup.add(cabin);

                const roof = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 1.9), mainMat);
                roof.position.set(0, 1.1, -0.2);
                this.vehicleGroup.add(roof);

                // 5. Lighting (Headlights & Signature Rear Light Bar)
                const headlightGeom = new THREE.BoxGeometry(0.5, 0.05, 0.1);
                [[-0.6, 0.5, 2.26], [0.6, 0.5, 2.26]].forEach(pos => {
                    const light = new THREE.Mesh(headlightGeom, accentMat);
                    light.position.set(...pos);
                    this.vehicleGroup.add(light);
                });

                // Rear Light Bar (Tesla style)
                const lightBar = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 3 }));
                lightBar.position.set(0, 0.6, -2.26);
                this.vehicleGroup.add(lightBar);

                // 6. Branding
                const logo = new THREE.Mesh(
                    new THREE.PlaneGeometry(1.3, 1.3),
                    new THREE.MeshStandardMaterial({
                        map: logoTex,
                        transparent: true,
                        side: THREE.DoubleSide,
                        alphaTest: 0.05
                    })
                );
                logo.position.set(0, 0.8, 1.6);
                logo.rotation.x = -Math.PI / 2 - 0.25;
                logo.rotation.z = 0; // Reset rotation (180 deg turn from previous state)
                this.vehicleGroup.add(logo);




                if (type !== 'god') {
                    const wheelGeom = new THREE.CylinderGeometry(0.45, 0.45, 0.35, wheelSegments);
                    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x050505 });
                    const rimMat = new THREE.MeshStandardMaterial({ color: accentColor, metalness: 1, roughness: 0.2 });

                    [[-0.9, 0.45, 1.4], [0.9, 0.45, 1.4], [-0.9, 0.45, -1.5], [0.9, 0.45, -1.5]].forEach(pos => {
                        const wGroup = new THREE.Group();
                        const w = new THREE.Mesh(wheelGeom, wheelMat);
                        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.36, wheelSegments), rimMat);
                        w.rotation.z = Math.PI / 2; rim.rotation.z = Math.PI / 2;
                        wGroup.add(w); wGroup.add(rim);
                        wGroup.position.set(...pos);
                        this.vehicleGroup.add(wGroup); this.wheels.push(wGroup);
                    });
                }




            } else if (type === 'truck') {
                const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.7 });
                const loader = new THREE.TextureLoader();
                const logoTex = loader.load('favicon.png');

                // 1. Trailer Body
                const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.5, 6), bodyMat);
                body.position.set(0, 1.8, -1);
                this.vehicleGroup.add(body);

                // 2. Logos (Square planes)
                const logoGeom = new THREE.PlaneGeometry(2.2, 2.2);
                const logoMat = new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, alphaTest: 0.05 });
                [[-1.105, 1.8, -1, -Math.PI / 2], [1.105, 1.8, -1, Math.PI / 2]].forEach(pos => {
                    const logo = new THREE.Mesh(logoGeom, logoMat);
                    logo.position.set(pos[0], pos[1], pos[2]);
                    logo.rotation.y = pos[3];
                    this.vehicleGroup.add(logo);
                });

                // 3. Cabin & Fenders
                const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 2), bodyMat);
                cab.position.set(0, 1.4, 2.8);
                this.vehicleGroup.add(cab);

                const fender = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 2.2), new THREE.MeshStandardMaterial({ color: 0x050505 }));
                fender.position.set(0, 0.8, 2.8);
                this.vehicleGroup.add(fender);

                // 4. Doors & Handles (Improved)
                const doorGeom = new THREE.BoxGeometry(0.06, 1.3, 1.1);
                const doorMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.2 });
                const windowGeom = new THREE.BoxGeometry(0.07, 0.6, 0.8);
                const windowMat = new THREE.MeshStandardMaterial({ color: 0x00F2FF, transparent: true, opacity: 0.3 });
                const handleGeom = new THREE.BoxGeometry(0.1, 0.05, 0.15);
                const handleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 });
                [[-1.1, 1.45, 2.8], [1.1, 1.45, 2.8]].forEach(pos => {
                    const door = new THREE.Mesh(doorGeom, doorMat);
                    door.position.set(...pos);
                    this.vehicleGroup.add(door);

                    // Side Window
                    const sWindow = new THREE.Mesh(windowGeom, windowMat);
                    sWindow.position.set(pos[0] * 1.01, 1.7, pos[2] + 0.1);
                    this.vehicleGroup.add(sWindow);

                    // Handle - MOVED BACK (Closer to trailer)
                    const handle = new THREE.Mesh(handleGeom, handleMat);
                    handle.position.set(pos[0] * 1.05, 1.4, pos[2] - 0.35);
                    this.vehicleGroup.add(handle);

                    const step = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.7), new THREE.MeshStandardMaterial({ color: 0xaaaaaa }));
                    step.position.set(pos[0] * 0.9, 0.6, pos[2]);
                    this.vehicleGroup.add(step);
                });


                // 5. Rear Doors
                const rearDoorGeom = new THREE.BoxGeometry(1.0, 2.2, 0.05);
                const rearDoorMat = new THREE.MeshStandardMaterial({ color: 0x080808 });
                [[-0.55, 1.8, -4.01], [0.55, 1.8, -4.01]].forEach(pos => {
                    const door = new THREE.Mesh(rearDoorGeom, rearDoorMat);
                    door.position.set(...pos);
                    this.vehicleGroup.add(door);
                    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.0, 0.06), new THREE.MeshStandardMaterial({ color: 0x444444 }));
                    bar.position.set(pos[0], 1.8, -4.02);
                    this.vehicleGroup.add(bar);
                });

                // 6. Exhausts
                const pipeGeom = new THREE.CylinderGeometry(0.1, 0.1, 3.0, 12);
                const pipeMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0 });
                [[-0.9, 2.2, 1.8], [0.9, 2.2, 1.8]].forEach(pos => {
                    const pipe = new THREE.Mesh(pipeGeom, pipeMat);
                    pipe.position.set(...pos);
                    this.vehicleGroup.add(pipe);
                });

                // 7. Windshield & Lights
                const glass = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x00F2FF, transparent: true, opacity: 0.6, emissive: 0x00F2FF, emissiveIntensity: 0.2 }));
                glass.position.set(0, 1.8, 3.8);
                this.vehicleGroup.add(glass);

                const headlightGeom = new THREE.BoxGeometry(0.5, 0.2, 0.1);
                const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2 });
                [[-0.8, 0.9, 3.9], [0.8, 0.9, 3.9]].forEach(pos => {
                    const light = new THREE.Mesh(headlightGeom, headlightMat);
                    light.position.set(...pos);
                    this.vehicleGroup.add(light);
                });

                // 8. Wheels
                const wheelGeom = new THREE.CylinderGeometry(0.6, 0.6, 0.4, wheelSegments);
                const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
                const rimGeom = new THREE.CylinderGeometry(0.4, 0.4, 0.42, wheelSegments);
                const rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1, roughness: 0.2 });
                [[-1.0, 0.6, 3], [1.0, 0.6, 3], [-1.0, 0.6, -1], [1.0, 0.6, -1], [-1.0, 0.6, -3], [1.0, 0.6, -3]].forEach(pos => {
                    const wGroup = new THREE.Group();
                    const w = new THREE.Mesh(wheelGeom, wheelMat);
                    const rim = new THREE.Mesh(rimGeom, rimMat);
                    w.rotation.z = Math.PI / 2; rim.rotation.z = Math.PI / 2;
                    wGroup.add(w); wGroup.add(rim);
                    wGroup.position.set(...pos);
                    this.vehicleGroup.add(wGroup); this.wheels.push(wGroup);
                });


            } else if (type === 'bus') {
                const bodyMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.3, metalness: 0.5 });
                const loader = new THREE.TextureLoader();
                const logoTex = loader.load('favicon.png');

                // 1. Main Body
                const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 8), bodyMat);
                body.position.set(0, 1.6, 0);
                this.vehicleGroup.add(body);

                // 2. Windows (Panoramic side windows - SWAPPED SIDES)
                const glassMat = new THREE.MeshStandardMaterial({ color: 0x00F2FF, transparent: true, opacity: 0.4, emissive: 0x00F2FF, emissiveIntensity: 0.1 });

                // Right Side (Full panoramic now)
                const rightWin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 7.2), glassMat);
                rightWin.position.set(1.1, 1.9, 0);
                this.vehicleGroup.add(rightWin);

                // Left Side (Split between doors)
                [[0, 1.9, 1.5], [0, 1.9, -1.5]].forEach(pos => {
                    const lw = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 1.8), glassMat);
                    lw.position.set(-1.1, pos[1], pos[2]);
                    this.vehicleGroup.add(lw);
                });

                // 3. Front Windshield & Rear Window
                const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.2, 0.1), glassMat);
                windshield.position.set(0, 1.8, 4.05);
                this.vehicleGroup.add(windshield);

                const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.8, 0.1), glassMat);
                rearWindow.position.set(0, 1.8, -4.05);
                this.vehicleGroup.add(rearWindow);

                // 4. Three Doors (Left side now)
                const doorGeom = new THREE.BoxGeometry(0.1, 1.8, 0.8);
                const doorMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
                [3, 0, -3].forEach(z => {
                    const door = new THREE.Mesh(doorGeom, doorMat);
                    door.position.set(-1.1, 1.2, z);
                    this.vehicleGroup.add(door);
                    const dGlass = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.6), glassMat);
                    dGlass.position.set(-1.1, 1.4, z);
                    this.vehicleGroup.add(dGlass);
                });

                // 5. Roof AC / Ventilation Unit (White)
                const acGeom = new THREE.BoxGeometry(1.4, 0.3, 2.5);
                const acMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
                const ac = new THREE.Mesh(acGeom, acMat);
                ac.position.set(0, 2.9, 1);
                this.vehicleGroup.add(ac);

                // 6. Logos (Symmetric lower branding - RE-SIZED)
                const logoGeom = new THREE.PlaneGeometry(1.1, 1.1);
                const logoMat = new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, alphaTest: 0.05 });

                // Left side logos (below windows)
                [[-1.105, 0.95, 1.5, -Math.PI / 2], [-1.105, 0.95, -1.5, -Math.PI / 2]].forEach(pos => {
                    const logo = new THREE.Mesh(logoGeom, logoMat);
                    logo.position.set(pos[0], pos[1], pos[2]);
                    logo.rotation.y = pos[3];
                    this.vehicleGroup.add(logo);
                });

                // Right side logos (below windows)
                [[1.105, 0.95, 1.5, Math.PI / 2], [1.105, 0.95, -1.5, Math.PI / 2]].forEach(pos => {
                    const logo = new THREE.Mesh(logoGeom, logoMat);
                    logo.position.set(pos[0], pos[1], pos[2]);
                    logo.rotation.y = pos[3];
                    this.vehicleGroup.add(logo);
                });



                // 7. Wheels with Chrome Rims
                const wheelGeom = new THREE.CylinderGeometry(0.6, 0.6, 0.4, wheelSegments);
                const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
                const rimGeom = new THREE.CylinderGeometry(0.4, 0.4, 0.42, wheelSegments);
                const rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1, roughness: 0.2 });

                [[-1, 0.6, 3], [1, 0.6, 3], [-1, 0.6, -3], [1, 0.6, -3]].forEach(pos => {
                    const wGroup = new THREE.Group();
                    const w = new THREE.Mesh(wheelGeom, wheelMat);
                    const rim = new THREE.Mesh(rimGeom, rimMat);
                    w.rotation.z = Math.PI / 2; rim.rotation.z = Math.PI / 2;
                    wGroup.add(w); wGroup.add(rim);
                    wGroup.position.set(...pos);
                    this.vehicleGroup.add(wGroup); this.wheels.push(wGroup);
                });

                // Bus Headlights
                const headlightGeom = new THREE.BoxGeometry(0.6, 0.3, 0.1);
                const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2 });
                [[-0.7, 0.6, 4.05], [0.7, 0.6, 4.05]].forEach(pos => {
                    const light = new THREE.Mesh(headlightGeom, headlightMat);
                    light.position.set(...pos);
                    this.vehicleGroup.add(light);
                });
            }




            // Brake Lights
            const brakeGeom = new THREE.BoxGeometry(0.6, 0.2, 0.1);
            this.brakeMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff0000, emissiveIntensity: 0 });
            const lB = new THREE.Mesh(brakeGeom, this.brakeMat); lB.position.set(-0.7, 0.8, type === 'bus' ? -4 : type === 'truck' ? -4 : -2); this.vehicleGroup.add(lB);
            const rB = new THREE.Mesh(brakeGeom, this.brakeMat); rB.position.set(0.7, 0.8, type === 'bus' ? -4 : type === 'truck' ? -4 : -2); this.vehicleGroup.add(rB);



        },
        render: function (gl, matrix) {
            // Update position in real-time
            const mc = mapboxgl.MercatorCoordinate.fromLngLat([state.lng, state.lat], 0);
            modelTransform.translateX = mc.x;
            modelTransform.translateY = mc.y;
            modelTransform.translateZ = mc.z;

            // Smooth Transition Animation
            const targetProg = state.isTeleporting ? 1 : 0;
            state.teleportProgress += (targetProg - state.teleportProgress) * 0.15;
            if (Math.abs(targetProg - state.teleportProgress) < 0.01) state.teleportProgress = targetProg;

            // Visibility & Scale Logic
            this.vehicleGroup.children.forEach(child => {
                if (child.name === 'teleportSphere') {
                    child.visible = state.teleportProgress > 0.05;
                    const s = state.teleportProgress * (1 + Math.sin(Date.now() * 0.01) * 0.1);
                    child.scale.set(s, s, s);
                } else {
                    const s = 1 - state.teleportProgress;
                    child.scale.set(s, s, s);
                    child.visible = s > 0.05;
                }
            });

            // Interactive Brake Lights
            if (this.brakeMat) {
                const isBraking = state.keys['s'];
                this.brakeMat.emissiveIntensity = isBraking ? 4 : 0.4;
                this.brakeMat.color.setHex(isBraking ? 0xff0000 : 0x550000);
            }

            // No allocations here!
            this.matrix.fromArray(matrix);

            this.scaleVec.set(modelTransform.scale * 5.0, -modelTransform.scale * 5.0, modelTransform.scale * 5.0);

            this.translation.makeTranslation(modelTransform.translateX, modelTransform.translateY, modelTransform.translateZ)
                .scale(this.scaleVec)
                .multiply(this.rotation.makeRotationX(modelTransform.rotateX))
                .multiply(this.rotation.makeRotationY(modelTransform.rotateY))
                .multiply(this.rotation.makeRotationZ(modelTransform.rotateZ));

            this.camera.projectionMatrix = this.matrix.multiply(this.translation);

            if (typeof Peer !== 'undefined') { /* PeerJS init */ }

            // Mapbox bearing is clockwise, Three.js rotation is counter-clockwise
            // 0 bearing is North (Up). Added Math.PI to flip 180 degrees.
            const angleRad = -(state.bearing) * (Math.PI / 180) + Math.PI;
            this.vehicleGroup.rotation.y = angleRad;

            // Body Roll (Tilt in turns) - Dynamic based on steering - reduced multiplier from 0.25 to 0.15
            const targetRoll = state.steeringAngle * 0.15 * Math.min(Math.abs(state.velocity) * 10, 1);
            this.vehicleGroup.rotation.z += (targetRoll - this.vehicleGroup.rotation.z) * 0.12;

            // Pitch (Lean on accel/brake) - reduced from 0.15 to 0.1 - increased smoothing from 0.15 to 0.2
            const targetPitch = -state.velocity * 0.1;
            this.vehicleGroup.rotation.x += (targetPitch - this.vehicleGroup.rotation.x) * 0.2;

            // Wheel Spin
            const wheelSpeed = state.velocity * 2;
            for (let i = 0; i < this.wheels.length; i++) this.wheels[i].rotation.x += wheelSpeed;

            // Update Position using MercatorCoord
            // Apply Arc Altitude if teleporting
            let altitude = 0;
            if (state.isTeleporting) {
                // Calculate parabolic arc (luk)
                const progress = Math.max(0, Math.min(1, (Date.now() - state.teleportStartTime) / state.teleportDuration));
                altitude = Math.sin(progress * Math.PI) * 800; // Peak at 800 meters
                
                // Show sphere, hide vehicle parts
                if (this.teleSphere) {
                    this.teleSphere.visible = true;
                    this.teleSphere.scale.set(1 + Math.sin(progress * Math.PI) * 2, 1 + Math.sin(progress * Math.PI) * 2, 1 + Math.sin(progress * Math.PI) * 2);
                }
            } else {
                if (this.teleSphere) this.teleSphere.visible = false;
            }

            const coord = mapboxgl.MercatorCoordinate.fromLngLat([state.lng, state.lat], altitude);
            modelTransform.translateX = coord.x;
            modelTransform.translateY = coord.y;
            modelTransform.translateZ = coord.z;

            this.renderer.resetState();

            // Render Other Players BEFORE the main scene render
            this.renderOtherPlayers();

            this.renderer.render(this.scene, this.camera);
            this.map.triggerRepaint();
        },
        renderOtherPlayers: function () {
            Object.keys(state.otherPlayers).forEach(id => {
                const p = state.otherPlayers[id];
                if (!p.model || p.currentVehicle !== p.vehicle) {
                    if (p.model) this.othersGroup.remove(p.model);
                    const group = new THREE.Group();
                    let color = 0x00F2FF;
                    let size = [1.8, 0.8, 4];
                    if (p.vehicle === 'truck') { color = 0xffaa00; size = [2.2, 1.2, 6]; }
                    if (p.vehicle === 'bus') { color = 0x00ff88; size = [2.5, 1.5, 10]; }
                    if (p.vehicle === 'bike') { color = 0xff0055; size = [0.8, 0.6, 2]; }

                    const body = new THREE.Mesh(
                        new THREE.BoxGeometry(...size),
                        new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9 })
                    );
                    body.position.y = size[1] / 2;
                    group.add(body);

                    const core = new THREE.Mesh(
                        new THREE.BoxGeometry(size[0] * 0.8, size[1] * 0.8, size[2] * 0.8),
                        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
                    );
                    group.add(core);

                    this.othersGroup.add(group);
                    p.model = group;
                    p.currentVehicle = p.vehicle;
                }

                const coord = mapboxgl.MercatorCoordinate.fromLngLat([p.lng, p.lat], 0);
                const meterScale = modelTransform.scale;

                p.model.position.set(
                    (coord.x - modelTransform.translateX) / meterScale,
                    (coord.z - modelTransform.translateZ) / meterScale + 0.1,
                    (coord.y - modelTransform.translateY) / meterScale
                );

                p.model.rotation.y = -(p.bearing * Math.PI / 180) + Math.PI;
                p.model.updateMatrix();
                p.model.visible = true;
            });
        }
    };

    map.addLayer(threeLayer);
}

function add3DBuildings() {
    if (!state.is3DBuildings) {
        if (map.getLayer('3d-buildings')) map.removeLayer('3d-buildings');
        return;
    }
    if (!map.getLayer('3d-buildings')) {
        map.addLayer({
            'id': '3d-buildings',
            'source': 'composite',
            'source-layer': 'building',
            'filter': ['==', 'extrude', 'true'],
            'type': 'fill-extrusion',
            'minzoom': 15,
            'paint': {
                'fill-extrusion-color': '#222',
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': ['get', 'min_height'],
                'fill-extrusion-opacity': 0.8
            }
        });
    }
}

function addSkidMarksLayer() {
    if (!map.getSource('skid-marks')) {
        map.addSource('skid-marks', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
    }
    if (!map.getLayer('skid-marks-layer')) {
        map.addLayer({
            id: 'skid-marks-layer',
            type: 'line',
            source: 'skid-marks',
            paint: {
                'line-color': '#111',
                'line-width': 5,
                'line-opacity': ['get', 'opacity']
            }
        });
    }
}

function cleanMap() {
    const style = map.getStyle();
    if (!style) return;

    style.layers.forEach(layer => {
        // Remove POIs, businesses, and transit labels for a clean driving look
        if (layer.type === 'symbol' &&
            (layer.id.includes('poi') ||
                layer.id.includes('transit') ||
                layer.id.includes('business') ||
                layer.id.includes('place-label'))) {
            map.setLayoutProperty(layer.id, 'visibility', 'none');
        }
    });
}

let currentProgress = 0;
let targetProgress = 0;
let mapReady = false;

function smoothProgress() {
    if (currentProgress < targetProgress) {
        // Use faster catch-up when target is 100 to avoid asymptotic stalls
        const alpha = (targetProgress >= 100) ? 0.45 : 0.35;
        currentProgress += (targetProgress - currentProgress) * alpha;
        // Avoid tiny fractional stalls: nudge if very close
        if (targetProgress >= 100 && 100 - currentProgress < 0.05) currentProgress = 100;
    setProgress(currentProgress);
    }
    if (currentProgress < 100) {
        requestAnimationFrame(smoothProgress);
    }
}
smoothProgress();

const startFakeLoading = () => {
    const startTime = performance.now();
    const duration = 1000; // Increased to 1000ms so it's actually visible and premium

    const tick = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min((elapsed / duration) * 100, 100);
        
        targetProgress = progress;
        
        if (progress < 100) {
            requestAnimationFrame(tick);
        } else {
            targetProgress = 100;
            finishLoading();
        }
    };
    requestAnimationFrame(tick);
};

// Start loading IMMEDIATELY, don't wait for font events which cause "stalls"
startFakeLoading();

document.fonts.ready.then(() => {
    document.querySelector('.loading-content').classList.add('fonts-ready');
});

function finishLoading() {
    setProgress(100);
    setTimeout(() => {
        loadingOverlay.classList.add('fade-out');
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
            if (!state.loopStarted) {
                state.lastTime = performance.now(); // Initialize timer right before starting loop
                state.loopStarted = true;
                requestAnimationFrame(update);
            }
        }, 200); // Instant removal
    }, 50);
}

map.on('style.load', () => {
    setup3DVehicleLayer();
    setupVehicleMarker();
    add3DBuildings();
    addSkidMarksLayer();
    cleanMap();
});

map.on('load', () => {
    mapReady = true;
    setupVehicleMarker();
    addSkidMarksLayer();
    cleanMap();
    state.lastTime = performance.now();

    map.jumpTo({
        center: [state.lng, state.lat],
        bearing: state.camBearing,
        pitch: state.currentPitch
    });
});

function update(time) {
    const currentTime = time || performance.now();

    // Stabilize Delta Time - smooth filtering to prevent jerky movement
    let rawDt = (currentTime - state.lastTime) / 16.667;
    state.lastTime = currentTime;
    // Clamp to 0.6-1.4 instead of 0.5-2.0 for much smoother motion
    const dtFinal = isNaN(rawDt) ? 1 : Math.min(Math.max(rawDt, 0.6), 1.4);

    if (!state.loopStarted) {
        state.lastTime = currentTime;
        requestAnimationFrame(update);
        return;
    }

    if (state.isCameraAnimating) {
        const center = map.getCenter();
        state.lng = center.lng;
        state.lat = center.lat;
    }

    const config = VEHICLE_CONFIG[state.activeVehicle];

    if (!state.isInputFocused) {
        if (state.keys['r']) {
            if (!state.isTeleporting) {
                // Shift + R: Reset to Belgrade (Initial Center)
                // Regular R: Reset to currentHome
                const isShiftReset = state.keys['shift'];
                const [lng, lat] = isShiftReset ? INITIAL_CENTER : state.currentHome;
                
                state.velocity = 0;
                state.isTeleporting = true;
                state.isCameraAnimating = true;
                state.teleportStartTime = Date.now();
                state.teleportDuration = isShiftReset ? 4500 : 2500; // Longer flight for global reset
                
                map.flyTo({
                    center: [lng, lat],
                    zoom: 18,
                    pitch: 65,
                    bearing: 0,
                    duration: state.teleportDuration
                });

                map.once('moveend', () => {
                    state.lng = lng; state.lat = lat;
                    if (isShiftReset) state.currentHome = [...INITIAL_CENTER]; // Update home if global reset
                    state.isCameraAnimating = false;
                    state.isTeleporting = false;
                    setup3DVehicleLayer();
                    saveState();
                });
            }
        }

        const isSDown = state.keys['s'] || state.keys['arrowdown'];
        const isWDown = state.keys['w'] || state.keys['arrowup'];

        if (isWDown) {
            if (state.velocity < 0) {
                state.velocity += config.brake * 1.5 * dtFinal;
                if (state.velocity >= 0) { state.velocity = 0; state.stopTime = currentTime; state.wKeyReleasedSinceStop = false; }
            } else {
                const timeSinceStop = currentTime - state.stopTime;
                if (state.wKeyReleasedSinceStop || timeSinceStop > 500) state.velocity += config.power * dtFinal;
                else state.velocity = 0;
            }
        } else if (isSDown) {
            if (state.velocity > 0) {
                state.velocity -= config.brake * dtFinal;
                if (state.velocity <= 0) { state.velocity = 0; state.stopTime = currentTime; state.sKeyReleasedSinceStop = false; }
            } else {
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
        // Smooth steering with adaptive weight based on vehicle - clamp dtFinal influence
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

            // High-Precision Collision Detection
            if (state.collisionsEnabled && state.activeVehicle !== 'god' && Math.abs(state.velocity) > 0.01) {
                const nextP = map.project([nextLng, nextLat]);
                const currentP = map.project([state.lng, state.lat]);
                const combinedBbox = [[Math.min(currentP.x, nextP.x) - 14, Math.min(currentP.y, nextP.y) - 14], [Math.max(currentP.x, nextP.x) + 14, Math.max(currentP.y, nextP.y) + 14]];

                let collisions = [];
                try {
                    const layers = ['3d-buildings', 'building'].filter(l => map.getLayer(l));
                    if (layers.length > 0) collisions = map.queryRenderedFeatures(combinedBbox, { layers });
                } catch (e) { }

                if (collisions.length > 0) {
                    let isAlreadyInside = false;
                    try {
                        const layers = ['3d-buildings', 'building'].filter(l => map.getLayer(l));
                        isAlreadyInside = layers.length > 0 && map.queryRenderedFeatures([[currentP.x - 8, currentP.y - 8], [currentP.x + 8, currentP.y + 8]], { layers }).length > 0;
                    } catch (e) { }

                    if (isAlreadyInside) {
                        state.lng = nextLng; state.lat = nextLat;
                    } else {
                        const bounceDirection = state.velocity > 0 ? -1 : 1;
                        state.velocity = -state.velocity * 0.02;
                        const rad = (state.bearing) * (Math.PI / 180);
                        state.lng += Math.sin(rad) * bounceDirection * 0.000005;
                        state.lat += Math.cos(rad) * bounceDirection * 0.000005;
                        state.isCharging = false; state.chargeLevel = 0; state.crashShake = 12;
                        spawnDebris(nextLng, nextLat);
                    }
                } else {
                    state.lng = nextLng; state.lat = nextLat;
                }
            } else {
                state.lng = nextLng; state.lat = nextLat;
            }

            // Multiplayer Collision
            Object.values(state.otherPlayers).forEach(p => {
                const dx = state.lng - p.lng;
                const dy = state.lat - p.lat;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0.000001 && dist < 0.00004) {
                    const pushFactor = 0.00001;
                    state.velocity *= -0.005;
                    state.lng += (dx / dist) * pushFactor;
                    state.lat += (dy / dist) * pushFactor;
                    state.crashShake = 0;
                }
            });
        }
    }

    // --- ALWAYS UPDATE (Visuals & MP) ---
    if (Math.abs(state.velocity) < 0.00001) state.velocity = 0;

    // Camera return logic: 5 seconds delay OR 1s if driving
    const isDrivingNow = Math.abs(state.velocity) > 0.02;
    const timeSinceLastMove = Date.now() - state.lastCameraManualMove;
    const shouldAutoReturn = !state.isDragging && (timeSinceLastMove > 5000 || (isDrivingNow && timeSinceLastMove > 1000));

    if (shouldAutoReturn) {
        state.mouseRotation += (0 - state.mouseRotation) * 0.05 * dtFinal;
        // Max pitch 75 for all vehicles, with per-vehicle adjustments
        let maxPitch = 75;
        if (state.activeVehicle === 'truck') maxPitch = 72;
        if (state.activeVehicle === 'bus') maxPitch = 70;
        if (state.activeVehicle === 'god') maxPitch = 75;

        const targetPitch = Math.min(65 + (state.chargeLevel * 10) + Math.abs(state.velocity) * 12, maxPitch);
        // Increased pitch smoothing from 0.05 to 0.08 to reduce jitter
        state.currentPitch += (targetPitch - state.currentPitch) * 0.08 * dtFinal;
    }

    let targetCamBearing = state.bearing + (state.velocity < -0.01 ? 180 : 0) + state.mouseRotation;
    let diff = targetCamBearing - state.camBearing;
    while (diff < -180) diff += 360;
    while (diff > 180) diff -= 360;

    // Smoother bearing transition (0.12 instead of 0.22)
    if (Math.abs(diff) > 0.01 || Math.abs(state.velocity) > 0.001 || state.isDragging) {
        state.camBearing += diff * 0.12 * dtFinal;
    } else {
        state.camBearing = targetCamBearing;
    }

    const shakeX = (Math.random() - 0.5) * state.crashShake;
    const shakeY = (Math.random() - 0.5) * state.crashShake;

    if (!state.isCameraAnimating) {
        // Use smooth camera updates to avoid jittering
        // Instead of jumpTo with duration 0, use direct map method calls for smoother interpolation
        map.setCenter([state.lng, state.lat]);
        map.setBearing(state.camBearing + shakeX);
        map.setPitch(state.currentPitch + shakeY);
    }

    if (!state.isCharging && state.chargeLevel > 0) {
        state.chargeLevel *= Math.pow(0.98, dtFinal);
        if (state.chargeLevel < 0.001) state.chargeLevel = 0;
    }

    if (state.crashShake > 0) {
        state.crashShake *= Math.pow(0.85, dtFinal);
        if (state.crashShake < 0.1) state.crashShake = 0;
    }

    // Auto-save location periodically (every 5 seconds)
    if (currentTime - state.lastSaveTime > 5000) {
        saveState();
        state.lastSaveTime = currentTime;
    }

    let speedVal = Math.abs(state.velocity) * 600;
    if (state.unit === 'mi') speedVal *= 0.621371;
    speedEl.textContent = (state.velocity < -0.0001 ? '-' : '') + Math.floor(speedVal);

    if (vehicleMarker) {
        vehicleMarker.setLngLat([state.lng, state.lat]);

        const inner = vehicleMarker.getElement().querySelector('.vehicle-marker');
        if (inner) {
            if (state.isTeleporting) {
                inner.innerHTML = `<div style="width:24px;height:24px;background:#00F2FF;border-radius:50%;box-shadow:0 0 20px #00F2FF, 0 0 40px rgba(0,242,255,0.5);border:2px solid #fff;animation: pulse 1s infinite alternate;"></div>`;
                inner.style.transform = 'scale(1.5)';
            } else if (!state.is3D || state.activeVehicle === 'god') {
                const config = VEHICLE_CONFIG[state.activeVehicle];
                inner.innerHTML = config.svg;
                vehicleMarker.setRotation(state.bearing);
                if (state.isCharging) {
                    const s = (Math.random() - 0.5) * state.chargeLevel * 10;
                    inner.style.transform = `scale(${config.size * 1.2}) translate(${s}px, ${s}px)`;
                } else {
                    inner.style.transform = `scale(${config.size * 1.2})`;
                }
            } else {
                // In 3D, hide 2D SVG
                inner.innerHTML = '';
            }
        }
    }


    updateOtherPlayers(dtFinal);
    updateSkidMarks(dtFinal);
    requestAnimationFrame(update);
}

function updateOtherPlayers(dtFinal) {
    Object.keys(state.otherPlayers).forEach(id => {
        const p = state.otherPlayers[id];

        // 1. Dead Reckoning (Prediction)
        // Project movement based on last known velocity and bearing while waiting for next server tick
        if (p.velocity && Math.abs(p.velocity) > 0.0001) {
            const rad = (p.bearing) * (Math.PI / 180);
            const latRad = p.lat * (Math.PI / 180);
            const projectionFactor = 1 / Math.cos(latRad);
            p.lng += Math.sin(rad) * p.velocity * 0.0001 * projectionFactor * dtFinal;
            p.lat += Math.cos(rad) * p.velocity * 0.0001 * dtFinal;
        }

        // 2. Interpolation (Smooth Correction)
        // Lerp towards the latest target from the server to correct prediction drift smoothly
        const lerpFactor = 0.18 * dtFinal;
        if (p.targetLng != null) {
            p.lng += (p.targetLng - p.lng) * lerpFactor;
            p.lat += (p.targetLat - p.lat) * lerpFactor;

            let bDiff = p.targetBearing - p.bearing;
            while (bDiff < -180) bDiff += 360;
            while (bDiff > 180) bDiff -= 360;
            p.bearing += bDiff * lerpFactor;
        }

        // 2D Marker Update (Enhanced with SVGs)
        if (!p.marker2d) {
            const config = VEHICLE_CONFIG[p.vehicle || 'car'];
            const el = document.createElement('div');
            el.className = 'other-player-marker';
            el.style.width = '30px';
            el.style.height = '30px';
            el.innerHTML = config.svg;

            // Add a small neon glow underneath
            const glow = document.createElement('div');
            glow.style.position = 'absolute';
            glow.style.top = '50%'; glow.style.left = '50%';
            glow.style.width = '40px'; glow.style.height = '40px';
            glow.style.background = 'radial-gradient(circle, rgba(0, 242, 255, 0.4) 0%, transparent 70%)';
            glow.style.transform = 'translate(-50%, -50%)';
            glow.style.zIndex = '-1';
            el.appendChild(glow);

            p.marker2d = new mapboxgl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' })
                .setLngLat([p.lng, p.lat])
                .setRotation(p.bearing)
                .addTo(map);
        } else {
            p.marker2d.setLngLat([p.lng, p.lat]);
            p.marker2d.setRotation(p.bearing);

            // Update SVG if vehicle type changed
            const inner = p.marker2d.getElement();
            if (p.lastVehicle !== p.vehicle) {
                const config = VEHICLE_CONFIG[p.vehicle || 'car'];
                inner.innerHTML = config.svg;
                p.lastVehicle = p.vehicle;
            }
        }
    });
}

function updateSkidMarks(dt) {
    const isDrifting = state.keys[' '] && Math.abs(state.velocity) > 0.05 && state.activeVehicle !== 'god';
    const isBurnout = state.isCharging && state.activeVehicle !== 'god';
    const shouldMark = isDrifting || isBurnout;

    if (shouldMark) {
        if (state.lastSkidPos) {
            // Create two tracks (left and right wheels)
            const angle = (state.bearing) * (Math.PI / 180);
            const offset = 0.000018;

            const createTrack = (side) => {
                const dx = Math.cos(angle) * offset * side;
                const dy = -Math.sin(angle) * offset * side;

                // Add jitter for burnout burnout look
                const jitterX = isBurnout ? (Math.random() - 0.5) * 0.00001 : 0;
                const jitterY = isBurnout ? (Math.random() - 0.5) * 0.00001 : 0;

                return {
                    type: 'Feature',
                    properties: { opacity: isBurnout ? 0.3 : 0.4, life: isBurnout ? 2.0 : 3.0 },
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [state.lastSkidPos.lng + dx + jitterX, state.lastSkidPos.lat + dy + jitterY],
                            [state.lng + dx, state.lat + dy]
                        ]
                    }
                };
            };

            state.skidMarks.push(createTrack(1), createTrack(-1));
        }
        state.lastSkidPos = { lng: state.lng, lat: state.lat };
    } else {
        state.lastSkidPos = null;
    }

    // Fade and filter
    let needsUpdate = isDrifting || state.skidMarks.length > 0;

    if (state.skidMarks.length > 0) {
        state.skidMarks.forEach(m => {
            m.properties.life -= 0.01 * dt;
            m.properties.opacity = Math.max(0, m.properties.life * 0.4);
        });

        state.skidMarks = state.skidMarks.filter(m => m.properties.life > 0);
        const maxSkidMarks = state.performance.lowEnd ? 300 : 1000;
        if (state.skidMarks.length > maxSkidMarks) state.skidMarks = state.skidMarks.slice(-maxSkidMarks);

        state.skidUpdateFrame++;
        const updateEvery = state.performance.lowEnd ? 6 : 3;
        if (needsUpdate && state.skidUpdateFrame % updateEvery === 0) {
            map.getSource('skid-marks').setData({
                type: 'FeatureCollection',
                features: state.skidMarks
            });
        }
    }
}

// Logic
settingsBtn.onclick = (e) => { e.stopPropagation(); mpDropdown?.classList.remove('active'); searchBox?.classList.remove('expanded'); settingsPanel.classList.toggle('active'); };
// Top-level mp button handler: ensure init on first click, toggle afterwards
if (mpBtn) mpBtn.addEventListener('click', (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!window.mpInitialized) {
        initMultiplayer();
        // ensure dropdown opens on first click after init
        try { mpDropdown.classList.toggle('active'); } catch (err) { }
        return;
    }
    mpDropdown.classList.toggle('active');
});
document.onclick = (e) => {
    if (!settingsPanel.contains(e.target) && e.target !== settingsBtn &&
        !mpDropdown.contains(e.target) && e.target !== mpBtn &&
        !searchBox.contains(e.target)) {
        closeAllPanels();
    }
};
document.querySelectorAll('.style-toggle button').forEach(btn => { btn.onclick = () => { state.mapStyle = btn.dataset.style; map.setStyle(`mapbox://styles/mapbox/${state.mapStyle}`); updateToggleStates(); saveState(); }; });
document.querySelectorAll('.unit-toggle button').forEach(btn => { btn.onclick = () => { state.unit = btn.dataset.unit; updateToggleStates(); saveState(); }; });

function updateToggleStates() {
    const isGodVehicle = state.activeVehicle === 'god';

    document.querySelectorAll('.collision-toggle button, .d3v-toggle button, .d3b-toggle button').forEach(b => {
        b.classList.remove('active');
        b.classList.remove('disabled-btn');

        // Force OFF if God Vehicle
        if (isGodVehicle) {
            if (b.dataset.collision === 'off' || b.dataset.d3v === 'off' || b.dataset.d3b === 'off') b.classList.add('active');
            if (b.dataset.collision === 'on' || b.dataset.d3v === 'on' || b.dataset.d3b === 'on') b.classList.add('disabled-btn');
        } else {
            // Normal handling
            if (b.dataset.collision === 'on' && state.collisionsEnabled) b.classList.add('active');
            if (b.dataset.collision === 'off' && !state.collisionsEnabled) b.classList.add('active');

            if (b.dataset.d3v === 'on' && state.is3D) b.classList.add('active');
            if (b.dataset.d3v === 'off' && !state.is3D) b.classList.add('active');

            if (b.dataset.d3b === 'on' && state.is3DBuildings) b.classList.add('active');
            if (b.dataset.d3b === 'off' && !state.is3DBuildings) b.classList.add('active');
        }
    });

    // God Toggle Sync
    document.querySelectorAll('.god-toggle button').forEach(b => {
        b.classList.toggle('active', b.dataset.god === (state.godMode ? 'on' : 'off'));
    });

    // Vehicle Toggle Sync
    document.querySelectorAll('.vehicle-toggle button').forEach(b => {
        b.classList.toggle('active', b.dataset.vehicle === state.activeVehicle);
    });

    // Unit Toggle Sync
    document.querySelectorAll('.unit-toggle button').forEach(b => {
        b.classList.toggle('active', b.dataset.unit === state.unit);
    });
    unitLabel.textContent = state.unit === 'km' ? 'KM/H' : 'MPH';

    // Style Toggle Sync
    document.querySelectorAll('.style-toggle button').forEach(b => {
        b.classList.toggle('active', b.dataset.style === state.mapStyle);
    });
}

document.querySelectorAll('.vehicle-toggle button').forEach(btn => {
    btn.onclick = () => {
        document.querySelector('.vehicle-toggle button.active').classList.remove('active');
        btn.classList.add('active');
        state.activeVehicle = btn.dataset.vehicle;

        if (state.activeVehicle === 'god') {
            state.collisionsEnabled = false;
            state.is3D = false;
            state.is3DBuildings = false;
        }

        setup3DVehicleLayer();
        setupVehicleMarker();
        updateToggleStates();
        saveState();
    };
});

document.querySelectorAll('.d3v-toggle button').forEach(btn => {
    btn.onclick = () => {
        if (state.activeVehicle === 'god' && btn.dataset.d3v === 'on') return;
        state.is3D = btn.dataset.d3v === 'on';
        setup3DVehicleLayer();
        setupVehicleMarker();
        updateToggleStates();
        saveState();
    };
});

document.querySelectorAll('.d3b-toggle button').forEach(btn => {
    btn.onclick = () => {
        state.is3DBuildings = btn.dataset.d3b === 'on';
        state.collisionsEnabled = state.is3DBuildings;
        add3DBuildings();
        updateToggleStates();
        saveState();
    };
});

document.querySelectorAll('.collision-toggle button').forEach(btn => {
    btn.onclick = () => {
        if (state.activeVehicle === 'god' && btn.dataset.collision === 'on') return;
        state.collisionsEnabled = btn.dataset.collision === 'on';
        updateToggleStates();
        saveState();
    };
});

document.querySelectorAll('.god-toggle button').forEach(btn => {
    btn.onclick = () => {
        state.godMode = btn.dataset.god === 'on';

        if (state.godMode) {
            state.activeVehicle = 'god';
            state.collisionsEnabled = false;
            state.is3D = false;
            state.is3DBuildings = false;

            if (!document.querySelector('[data-vehicle="god"]')) {
                const vehicleToggle = document.querySelector('.vehicle-toggle');
                const godBtn = document.createElement('button');
                godBtn.dataset.vehicle = 'god'; godBtn.textContent = 'GOD';
                godBtn.style.color = '#FF00E5'; godBtn.style.textShadow = '0 0 5px #FF00E5';
                godBtn.onclick = () => {
                    state.activeVehicle = 'god';
                    state.collisionsEnabled = false;
                    state.is3D = false;
                    state.is3DBuildings = false;
                    setup3DVehicleLayer(); setupVehicleMarker(); updateToggleStates();
                };
                vehicleToggle.appendChild(godBtn);
            }
            document.querySelectorAll('.vehicle-toggle button').forEach(b => b.classList.toggle('active', b.dataset.vehicle === 'god'));
        } else {
            state.activeVehicle = 'car';
            state.collisionsEnabled = true;
            state.is3DBuildings = true;
            const godBtn = document.querySelector('[data-vehicle="god"]');
            if (godBtn) godBtn.remove();
            document.querySelectorAll('.vehicle-toggle button').forEach(b => b.classList.toggle('active', b.dataset.vehicle === 'car'));
        }

        setup3DVehicleLayer();
        setupVehicleMarker();
        add3DBuildings();
        updateToggleStates();
        saveState();
    };
});

// Handle initial state sync when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    updateToggleStates();
});

async function performSearch() {
    const query = searchInput.value; if (!query) return;
    try {
        const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}`);
        const data = await response.json();
        if (data.features && data.features.length > 0) {
            const [lng, lat] = data.features[0].center;

            // START TELEPORT ANIMATION
            state.velocity = 0;
            state.isTeleporting = true;
            state.isCameraAnimating = true;
            state.teleportStartTime = Date.now();
            state.teleportDuration = 3500;
            setup3DVehicleLayer();

            // Give it a moment to animate the shrinking/ball expansion at the start
            setTimeout(() => {
                state.currentHome = [lng, lat];
                state.lng = lng; state.lat = lat;

                const targetZoom = Math.max(map.getZoom(), 17);
                map.flyTo({
                    center: [lng, lat],
                    zoom: targetZoom,
                    pitch: state.currentPitch,
                    essential: true,
                    duration: state.teleportDuration
                });

                map.once('moveend', () => {
                    state.isCameraAnimating = false;
                    state.isTeleporting = false;
                    setup3DVehicleLayer();
                    saveState();
                });
            }, 600); // 600ms delay to see the vehicle shrink and ball grow

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
const enableCustomCursor = !state.performance.lowEnd && !state.performance.touchDevice;
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
    if (!enableCustomCursor) {
        customCursor.style.display = 'none';
        return;
    }

    let lastCursorUpdate = performance.now();
    function loop() {
        const now = performance.now();
        const dt = (now - lastCursorUpdate) / 16.667;
        lastCursorUpdate = now;
        const dtFinal = Math.min(dt, 2);

        // Position Lerp (0.15 for smooth heavy feel)
        cursorState.currX += (cursorState.targetX - cursorState.currX) * (1 - Math.pow(1 - 0.15, dtFinal));
        cursorState.currY += (cursorState.targetY - cursorState.currY) * (1 - Math.pow(1 - 0.15, dtFinal));

        // Scale & Opacity Lerp
        cursorState.currScale += (cursorState.targetScale - cursorState.currScale) * (1 - Math.pow(1 - 0.15, dtFinal));
        cursorState.currOpacity += (cursorState.targetOpacity - cursorState.currOpacity) * (1 - Math.pow(1 - 0.1, dtFinal));

        // Idle Check
        if (cursorState.hasMoved && Date.now() - cursorState.lastMove > 3000 && !state.isInputFocused) {
            cursorState.targetOpacity = 0;
        } else if (cursorState.hasMoved) {
            cursorState.targetOpacity = 1;
        }

        // Apply Class instead of manual styles for performance
        customCursor.className = cursorState.type;

        customCursor.style.left = `${cursorState.currX}px`;
        customCursor.style.top = `${cursorState.currY}px`;
        customCursor.style.opacity = cursorState.currOpacity;
        customCursor.style.transform = `translate(-50%, -50%) scale(${cursorState.currScale})`;

        if (cursorState.type === 'ui') cursorState.targetScale = 1.8;
        else if (cursorState.type === 'typing') cursorState.targetScale = 1;
        else cursorState.targetScale = 1;

        requestAnimationFrame(loop);
    }
    loop();
}

let lastBuildingCheck = 0;
window.addEventListener('mousedown', (e) => {
    if (e.button === 0 && !state.isInputFocused) {
        if (e.target.closest('.ui-container') || e.target.closest('.settings-panel') || e.target.closest('.mp-dropdown')) return;
        state.isDragging = true;
        state.lastMouseX = e.clientX;
        state.lastMouseY = e.clientY;
    }
});

window.addEventListener('mouseup', () => {
    if (state.isDragging) {
        state.isDragging = false;
        // Don't save pitch/bearing anymore as requested
    }
});

window.addEventListener('mousemove', (e) => {
    if (state.isDragging) {
        const dx = e.clientX - state.lastMouseX;
        const dy = e.clientY - state.lastMouseY;
        state.mouseRotation += dx * 0.5;
        state.currentPitch = Math.max(5, Math.min(80, state.currentPitch - dy * 0.5));
        state.lastMouseX = e.clientX;
        state.lastMouseY = e.clientY;
        state.lastCameraManualMove = Date.now();
    }

    if (!enableCustomCursor) return;
    cursorState.targetX = e.clientX;
    cursorState.targetY = e.clientY;
    cursorState.lastMove = Date.now();
    cursorState.hasMoved = true;
});

// State Management
if (enableCustomCursor) {
    document.querySelectorAll('button, a, .toggle-group, kbd, .settings-main-btn, .coffee-btn, .copyright-notice a').forEach(el => {
        el.addEventListener('mouseenter', () => { cursorState.type = 'ui'; });
        el.addEventListener('mouseleave', () => { cursorState.type = 'default'; });
    });

    searchInput.addEventListener('mouseenter', () => { cursorState.type = 'typing'; customCursor.classList.add('typing'); });
    searchInput.addEventListener('mouseleave', () => { cursorState.type = 'default'; customCursor.classList.remove('typing'); });
}

function spawnDebris(lng, lat) {
    const debrisCount = state.performance.lowEnd ? 2 : 5;

    for (let i = 0; i < debrisCount; i++) {
        const el = document.createElement('div');
        el.className = 'debris';
        if (!state.performance.lowEnd) {
            el.style.animation = `debris-spin ${0.5 + Math.random()}s linear infinite`;
        }
        el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';

        const marker = new mapboxgl.Marker(el)
            .setLngLat([lng, lat])
            .addTo(map);

        const vx = (Math.random() - 0.5) * 0.0005;
        const vy = (Math.random() - 0.5) * 0.0005;
        let opacity = 1;
        let curLng = lng;
        let curLat = lat;

        let lastDebrisUpdate = performance.now();
        const animateDebris = () => {
            const now = performance.now();
            const dt = (now - lastDebrisUpdate) / 16.667;
            lastDebrisUpdate = now;
            const dtFinal = Math.min(dt, 2);

            curLng += vx * dtFinal;
            curLat += vy * dtFinal;
            opacity -= 0.02 * dtFinal;

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

// Multiplayer Engine (Universal SSE via Ntfy)
function initMultiplayer() {
    if (window.mpInitialized) return;
    window.mpInitialized = true;

    const myId = 'p_' + Math.random().toString(36).substr(2, 4);
    const myPeerIdEl = document.getElementById('my-peer-id');
    const copyBtn = document.getElementById('copy-id-btn');
    const joinBtn = document.getElementById('join-mp-btn');
    const joinInput = document.getElementById('join-peer-id');
    const disconnectBtn = document.getElementById('disconnect-mp-btn');
    const mpStatusDot = document.getElementById('mp-status-dot');
    const mpPlayersList = document.getElementById('mp-players-list');
    let broadcastTimer = null;
    let cleanupTimer = null;

    if (myPeerIdEl) myPeerIdEl.textContent = myId.toUpperCase();

    function renderActivePlayers() {
        if (!mpPlayersList) return;

        const activePlayers = [{
            id: myId,
            vehicle: state.activeVehicle,
            isSelf: true
        }, ...Object.keys(state.otherPlayers)
            .filter(id => state.otherPlayers[id] && Date.now() - state.otherPlayers[id].lastSeen <= 30000)
            .sort()
            .map(id => ({
                id,
                vehicle: state.otherPlayers[id]?.vehicle || 'car',
                isSelf: false
            }))];

        if (activePlayers.length === 0) {
            mpPlayersList.innerHTML = '<div class="mp-player-entry mp-player-empty">NO ACTIVE PLAYERS</div>';
            return;
        }

        mpPlayersList.innerHTML = activePlayers.map(player => {
            const vehicle = (player.vehicle || 'car').toUpperCase();
            const selfClass = player.isSelf ? ' mp-player-self' : '';
            const label = player.isSelf ? 'YOU' : vehicle;
            return `<div class="mp-player-entry${selfClass}"><span class="mp-player-id">${player.id.toUpperCase()}</span><span class="mp-player-vehicle">${label}</span></div>`;
        }).join('');
    }

    // --- MQTT SETUP ---
    // --- MQTT SETUP (Secure port 8884 for SSL) ---
    const client = new Paho.MQTT.Client("broker.hivemq.com", 8884, "georide_" + myId);
    let currentTopic = "georide/global/pro";

    client.onConnectionLost = (responseObject) => {
        console.log("MQTT Connection Lost:", responseObject.errorMessage);
        mpStatusDot?.classList.remove('online');
        if (broadcastTimer) {
            clearInterval(broadcastTimer);
            broadcastTimer = null;
        }
        if (cleanupTimer) {
            clearInterval(cleanupTimer);
            cleanupTimer = null;
        }
        setTimeout(() => client.connect({ onSuccess: onConnect, useSSL: false }), 3000);
    };

    client.onMessageArrived = (message) => {
        try {
            const data = JSON.parse(message.payloadString);
            if (data.id === myId) return;

            if (!state.otherPlayers[data.id]) {
                // First time seeing this player: jump to position immediately to avoid teleporting from 0,0
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
                // Update targets for interpolation, don't snap current position
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

    function startSyncTimers() {
        if (!broadcastTimer) {
            broadcastTimer = setInterval(() => {
                if (client.isConnected()) {
                    const message = new Paho.MQTT.Message(JSON.stringify({
                        id: myId,
                        lng: state.lng,
                        lat: state.lat,
                        bearing: state.bearing,
                        v: state.velocity, // Include velocity for Dead Reckoning
                        vehicle: state.activeVehicle,
                        t: Date.now()
                    }));
                    message.destinationName = currentTopic;
                    client.send(message);
                }
            }, 50);
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

    // client.connect removed from here to prevent auto-connect

    if (joinBtn) {
        const handleJoin = (e) => {
            if (e) e.preventDefault();
            const targetCode = joinInput.value.trim().toLowerCase();
            if (targetCode) {
                const startConnection = () => {
                    client.unsubscribe(currentTopic);
                    currentTopic = "georide/room/" + targetCode;
                    client.subscribe(currentTopic);
                    console.log("Joined room:", currentTopic);
                };

                if (!client.isConnected()) {
                    client.connect({
                        onSuccess: () => {
                            onConnect();
                            startConnection();
                        },
                        useSSL: true,
                        keepAliveInterval: 60
                    });
                } else {
                    startConnection();
                    if (disconnectBtn) disconnectBtn.style.display = 'block';
                }

                mpDropdown.classList.remove('active');
                joinInput.blur(); // Release keyboard focus

                // FORCE 2D for Multiplayer stability
                state.is3D = false;
                state.is3DBuildings = false;
                // Disable collisions while in multiplayer by default
                state.collisionsEnabled = false;

                updateToggleStates();
                setup3DVehicleLayer();
                setupVehicleMarker();
                add3DBuildings();

                // Refined Safe Spawn: Wait 500ms for other players' data to arrive
                setTimeout(() => {
                    // Keep every client on the same coordinates; do not shift locally on join.
                    map.jumpTo({ center: [state.lng, state.lat] });
                }, 600);

                // Sync UI Buttons
                updateToggleStates();

                joinBtn.textContent = 'LINKED: ' + targetCode.toUpperCase();
                joinBtn.style.background = '#00ff88';

                setTimeout(() => {
                    joinBtn.textContent = 'CONNECT';
                    joinBtn.style.background = '';
                }, 800);
            }
        };

        joinBtn.onclick = handleJoin;
        joinInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleJoin();
            }
        };
    }

    // Broadcast and cleanup loops are started/restarted through startSyncTimers().
    startSyncTimers();

    // UI Handlers
    if (copyBtn) copyBtn.onclick = () => {
        navigator.clipboard.writeText(myId.toUpperCase());
        copyBtn.textContent = 'OK';
        setTimeout(() => { copyBtn.textContent = 'COPY'; }, 1000);
    };
    // NOTE: mpBtn click handler is attached at top-level to avoid duplicate handlers.

    // Disconnect button (leave multiplayer)
    if (disconnectBtn) disconnectBtn.onclick = (e) => {
        if (e) e.preventDefault();
        try {
            if (client && client.isConnected && client.isConnected()) {
                if (currentTopic) client.unsubscribe(currentTopic);
                client.disconnect();
            }
        } catch (err) { /* ignore */ }

        if (broadcastTimer) {
            clearInterval(broadcastTimer);
            broadcastTimer = null;
        }
        if (cleanupTimer) {
            clearInterval(cleanupTimer);
            cleanupTimer = null;
        }

        // Close UI
        mpDropdown?.classList.remove('active');

        // Reset multiplayer state
        window.mpInitialized = false;

        // Remove other players markers and clear list
        Object.keys(state.otherPlayers).forEach(id => {
            const p = state.otherPlayers[id];
            if (p.marker2d) p.marker2d.remove();
            delete state.otherPlayers[id];
        });
        renderActivePlayers();

        // Restore 3D and collisions
        state.is3D = true;
        state.is3DBuildings = true;
        state.collisionsEnabled = true;
        updateToggleStates();
        setup3DVehicleLayer();
        setupVehicleMarker();
        add3DBuildings();

        // Restore camera to default driving view
        map.jumpTo({ center: [state.lng, state.lat], zoom: 18, pitch: state.currentPitch || 65 });
    };

}

// Multiplayer will be initialized on first button click
