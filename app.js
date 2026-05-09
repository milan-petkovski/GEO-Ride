// Configuration
const MAPBOX_TOKEN = '%%MAPBOX_TOKEN%%';
const INITIAL_CENTER = [20.451589, 44.806769]; // Belgrade
const INITIAL_ZOOM = 18;

// Custom Premium SVGs
const CAR_SVG = `<svg width="60" height="110" viewBox="0 0 60 110" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 25C5 15 15 5 30 5C45 5 55 15 55 25V85C55 95 45 105 30 105C15 105 5 95 5 85V25Z" fill="#1A1A1A" stroke="#00F2FF" stroke-width="2"/><path d="M10 35C10 30 15 25 30 25C45 25 50 30 50 35V50H10V35Z" fill="#00F2FF" fill-opacity="0.2" stroke="#00F2FF" stroke-width="1"/><path d="M12 75H48V85C48 90 40 95 30 95C20 95 12 90 12 85V75Z" fill="#00F2FF" fill-opacity="0.1" stroke="#00F2FF" stroke-width="0.5"/><rect x="10" y="12" width="10" height="6" rx="2" fill="white"/><rect x="40" y="12" width="10" height="6" rx="2" fill="white"/></svg>`;
const TRUCK_SVG = `<svg width="80" height="180" viewBox="0 0 80 180" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="60" height="160" rx="4" fill="#111" stroke="#00F2FF" stroke-width="2"/><rect x="12" y="12" width="56" height="50" rx="3" fill="#222" stroke="#00F2FF" stroke-width="1"/><rect x="18" y="18" width="44" height="15" rx="2" fill="#00F2FF" fill-opacity="0.3"/><rect x="15" y="65" width="50" height="100" rx="2" fill="#0A0A0A" stroke="#333"/></svg>`;
const BUS_SVG = `<svg width="80" height="200" viewBox="0 0 80 200" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="60" height="180" rx="5" fill="#151515" stroke="#00F2FF" stroke-width="2"/><rect x="15" y="20" width="50" height="20" rx="2" fill="#00F2FF" fill-opacity="0.2"/><rect x="15" y="50" width="50" height="25" rx="2" fill="#00F2FF" fill-opacity="0.1"/><rect x="15" y="85" width="50" height="25" rx="2" fill="#00F2FF" fill-opacity="0.1"/><rect x="15" y="120" width="50" height="25" rx="2" fill="#00F2FF" fill-opacity="0.1"/><rect x="15" y="155" width="50" height="20" rx="2" fill="#00F2FF" fill-opacity="0.1"/></svg>`;
const GOD_SVG = `<svg width="70" height="130" viewBox="0 0 70 130" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M35 5C15 5 5 25 5 45V105C5 115 15 125 35 125C55 125 65 115 65 105V45C65 25 55 5 35 5Z" fill="#0A0A0A" stroke="#FF00E5" stroke-width="2.5"/><path d="M10 50C10 35 20 20 35 20C50 20 60 35 60 50V70H10V50Z" fill="#FF00E5" fill-opacity="0.3"/><rect x="15" y="10" width="10" height="4" rx="2" fill="#FF00E5"><animate attributeName="opacity" values="0.4;1;0.4" dur="0.5s" repeatCount="indefinite"/></rect><rect x="45" y="10" width="10" height="4" rx="2" fill="#FF00E5"><animate attributeName="opacity" values="0.4;1;0.4" dur="0.5s" repeatCount="indefinite"/></rect><path d="M5 80H65" stroke="#FF00E5" stroke-width="1" stroke-dasharray="4 2"/><path d="M10 110L60 110" stroke="#FF00E5" stroke-width="3" stroke-opacity="0.6"/></svg>`;

const VEHICLE_CONFIG = {
    car: { power: 0.0008, brake: 0.003, maxSpeed: 0.4, turnRate: 0.8, steeringWeight: 0.05, size: 0.9, svg: CAR_SVG },
    truck: { power: 0.0004, brake: 0.0015, maxSpeed: 0.25, turnRate: 0.5, steeringWeight: 0.02, size: 0.7, svg: TRUCK_SVG },
    bus: { power: 0.00035, brake: 0.0012, maxSpeed: 0.25, turnRate: 1.0, steeringWeight: 0.015, size: 0.65, svg: BUS_SVG },
    god: { power: 0.04, brake: 0.08, maxSpeed: 1.667, turnRate: 2.2, steeringWeight: 0.1, size: 1.1, svg: GOD_SVG }
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

let state = {
    lng: INITIAL_CENTER[0], lat: INITIAL_CENTER[1],
    bearing: 0, travelBearing: 0, camBearing: 0,
    velocity: 0, steeringAngle: 0,
    keys: {}, activeVehicle: 'car', unit: 'km', isInputFocused: false, godMode: false,
    lastTime: performance.now(),
    stopTime: 0, sKeyReleasedSinceStop: true, wKeyReleasedSinceStop: true,
    chargeLevel: 0, isCharging: false, currentPitch: 60,
    crashShake: 0, collisionsEnabled: true, is3D: true,
    currentHome: [...INITIAL_CENTER], // Dynamic spawn point
    skidMarks: [],
    lastSkidPos: null,
    skidUpdateFrame: 0,
    otherPlayers: {}, // ID -> {lng, lat, bearing, vehicle, model}
    collisionCheckFrame: 0,
    performance: PERFORMANCE_PROFILE
};

mapboxgl.accessToken = MAPBOX_TOKEN;
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: INITIAL_CENTER,
    zoom: 18,
    pitch: 60,
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
        inner.style.transition = 'transform 0.1s ease-out';
        
        el.appendChild(inner);
        
        vehicleMarker = new mapboxgl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' })
            .setLngLat([state.lng, state.lat]).setRotation(state.bearing).addTo(map);
    }
}
function setup3DVehicleLayer() {
    if (map.getLayer('3d-vehicle-layer')) map.removeLayer('3d-vehicle-layer');
    if (!state.is3D || state.activeVehicle === 'god') return;

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

            if (type === 'car' || type === 'god') {
                // Body
                const bodyGeom = new THREE.BoxGeometry(1.8, 0.8, 4);
                const bodyMat = new THREE.MeshStandardMaterial({ color: primaryColor, roughness: 0.2, metalness: 0.9 });
                const body = new THREE.Mesh(bodyGeom, bodyMat);
                body.position.y = 0.6;
                this.vehicleGroup.add(body);

                // Cabin
                const cabinGeom = new THREE.BoxGeometry(1.5, 0.7, 2);
                const cabinMat = new THREE.MeshStandardMaterial({ color: accentColor, transparent: true, opacity: 0.5, roughness: 0, metalness: 1 });
                const cabin = new THREE.Mesh(cabinGeom, cabinMat);
                cabin.position.y = 1.3;
                cabin.position.z = -0.2;
                this.vehicleGroup.add(cabin);

                // Spoiler
                const spoilerPostGeom = new THREE.BoxGeometry(0.1, 0.4, 0.1);
                const spoilerTopGeom = new THREE.BoxGeometry(1.8, 0.1, 0.6);
                const spoilerMat = new THREE.MeshStandardMaterial({ color: primaryColor });
                const lp = new THREE.Mesh(spoilerPostGeom, spoilerMat); lp.position.set(-0.6, 1.2, -1.8); this.vehicleGroup.add(lp);
                const rp = new THREE.Mesh(spoilerPostGeom, spoilerMat); rp.position.set(0.6, 1.2, -1.8); this.vehicleGroup.add(rp);
                const top = new THREE.Mesh(spoilerTopGeom, spoilerMat); top.position.set(0, 1.4, -1.8); this.vehicleGroup.add(top);

                if (type !== 'god') {
                    // Wheels
                    const wheelGeom = new THREE.CylinderGeometry(0.45, 0.45, 0.3, wheelSegments);
                    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x050505 });
                    [[-0.9, 0.45, 1.2], [0.9, 0.45, 1.2], [-0.9, 0.45, -1.2], [0.9, 0.45, -1.2]].forEach(pos => {
                        const w = new THREE.Mesh(wheelGeom, wheelMat); w.rotation.z = Math.PI / 2; w.position.set(...pos);
                        this.vehicleGroup.add(w); this.wheels.push(w);
                    });
                }
            } else if (type === 'truck') {
                const bodyGeom = new THREE.BoxGeometry(2.2, 2.5, 6);
                const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
                const body = new THREE.Mesh(bodyGeom, bodyMat); body.position.set(0, 1.8, -1); this.vehicleGroup.add(body);

                const cabGeom = new THREE.BoxGeometry(2.2, 1.8, 2);
                const cab = new THREE.Mesh(cabGeom, bodyMat); cab.position.set(0, 1.4, 2.8); this.vehicleGroup.add(cab);

                const glassGeom = new THREE.BoxGeometry(2, 0.8, 0.1);
                const glassMat = new THREE.MeshStandardMaterial({ color: 0x00F2FF, transparent: true, opacity: 0.5 });
                const glass = new THREE.Mesh(glassGeom, glassMat); glass.position.set(0, 1.8, 3.8); this.vehicleGroup.add(glass);

                const wheelGeom = new THREE.CylinderGeometry(0.6, 0.6, 0.4, wheelSegments);
                const wheelMat = new THREE.MeshStandardMaterial({ color: 0x050505 });
                [[-1, 0.6, 3], [1, 0.6, 3], [-1, 0.6, -1], [1, 0.6, -1], [-1, 0.6, -3], [1, 0.6, -3]].forEach(pos => {
                    const w = new THREE.Mesh(wheelGeom, wheelMat); w.rotation.z = Math.PI / 2; w.position.set(...pos);
                    this.vehicleGroup.add(w); this.wheels.push(w);
                });
            } else if (type === 'bus') {
                const bodyGeom = new THREE.BoxGeometry(2.2, 2.4, 8);
                const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
                const body = new THREE.Mesh(bodyGeom, bodyMat); body.position.set(0, 1.6, 0); this.vehicleGroup.add(body);

                const glassGeom = new THREE.BoxGeometry(2.3, 0.8, 7.5);
                const glassMat = new THREE.MeshStandardMaterial({ color: 0x00F2FF, transparent: true, opacity: 0.3 });
                const glass = new THREE.Mesh(glassGeom, glassMat); glass.position.set(0, 1.8, 0); this.vehicleGroup.add(glass);

                const wheelGeom = new THREE.CylinderGeometry(0.6, 0.6, 0.4, wheelSegments);
                const wheelMat = new THREE.MeshStandardMaterial({ color: 0x050505 });
                [[-1, 0.6, 3], [1, 0.6, 3], [-1, 0.6, -3], [1, 0.6, -3]].forEach(pos => {
                    const w = new THREE.Mesh(wheelGeom, wheelMat); w.rotation.z = Math.PI / 2; w.position.set(...pos);
                    this.vehicleGroup.add(w); this.wheels.push(w);
                });
            }

            // Common Lights
            const headlightGeom = new THREE.BoxGeometry(0.5, 0.2, 0.1);
            const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2 });
            const lH = new THREE.Mesh(headlightGeom, headlightMat); lH.position.set(-0.7, 0.8, type === 'bus' ? 4 : type === 'truck' ? 3.8 : 2); this.vehicleGroup.add(lH);
            const rH = new THREE.Mesh(headlightGeom, headlightMat); rH.position.set(0.7, 0.8, type === 'bus' ? 4 : type === 'truck' ? 3.8 : 2); this.vehicleGroup.add(rH);

            // Brake Lights
            const brakeGeom = new THREE.BoxGeometry(0.6, 0.2, 0.1);
            this.brakeMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff0000, emissiveIntensity: 0 });
            const lB = new THREE.Mesh(brakeGeom, this.brakeMat); lB.position.set(-0.7, 0.8, type === 'bus' ? -4 : type === 'truck' ? -4 : -2); this.vehicleGroup.add(lB);
            const rB = new THREE.Mesh(brakeGeom, this.brakeMat); rB.position.set(0.7, 0.8, type === 'bus' ? -4 : type === 'truck' ? -4 : -2); this.vehicleGroup.add(rB);

            // Underglow (Soft Circle instead of Box)
            if (!lowEnd) {
                const glowGeom = new THREE.CircleGeometry(type === 'bus' ? 4 : type === 'truck' ? 3.5 : 2.5, 32);
                const glowMat = new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.05, side: THREE.DoubleSide });
                const glow = new THREE.Mesh(glowGeom, glowMat); glow.rotation.x = Math.PI / 2; glow.position.y = 0.02;
                this.vehicleGroup.add(glow);
            }
        },
        render: function (gl, matrix) {
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

            // Body Roll (Tilt in turns) - Dynamic based on steering
            const targetRoll = state.steeringAngle * 0.25 * Math.min(Math.abs(state.velocity) * 10, 1);
            this.vehicleGroup.rotation.z += (targetRoll - this.vehicleGroup.rotation.z) * 0.15;

            // Pitch (Lean on accel/brake)
            const targetPitch = -state.velocity * 0.15;
            this.vehicleGroup.rotation.x += (targetPitch - this.vehicleGroup.rotation.x) * 0.15;

            // Wheel Spin
            const wheelSpeed = state.velocity * 2;
            for (let i = 0; i < this.wheels.length; i++) this.wheels[i].rotation.x += wheelSpeed;

            // Update Position using cached MercatorCoord if possible, but fromLngLat is fast enough if optimized
            const coord = mapboxgl.MercatorCoordinate.fromLngLat([state.lng, state.lat], 0);
            modelTransform.translateX = coord.x;
            modelTransform.translateY = coord.y;
            modelTransform.translateZ = coord.z;

            this.renderer.resetState();
            
            // Render Other Players BEFORE the main scene render
            this.renderOtherPlayers();
            
            this.renderer.render(this.scene, this.camera);
            this.map.triggerRepaint();
        },
        renderOtherPlayers: function() {
            Object.keys(state.otherPlayers).forEach(id => {
                const p = state.otherPlayers[id];
                
                // Interpolation (LERP) with Deadzone
                const dLng = p.targetLng - p.lng;
                const dLat = p.targetLat - p.lat;
                
                if (Math.abs(dLng) > 0.0000001) p.lng += dLng * 0.2;
                else p.lng = p.targetLng;
                
                if (Math.abs(dLat) > 0.0000001) p.lat += dLat * 0.2;
                else p.lat = p.targetLat;
                
                // Angle Interpolation (Faster)
                let diff = (p.targetBearing - p.bearing) % 360;
                if (diff < -180) diff += 360;
                if (diff > 180) diff -= 360;
                p.bearing += diff * 0.25;

                if (!p.model || p.currentVehicle !== p.vehicle) {
                    if (p.model) this.othersGroup.remove(p.model);
                    const group = new THREE.Group();
                    let color = 0x00F2FF; 
                    let size = [1.8, 0.8, 4];
                    if (p.vehicle === 'truck') { color = 0xffaa00; size = [2.2, 1.2, 6]; }
                    if (p.vehicle === 'bus') { color = 0x00ff88; size = [2.5, 1.5, 10]; }
                    if (p.vehicle === 'bike') { color = 0xff0055; size = [0.8, 0.6, 2]; }
                    
                    // High-visibility basic material (no lights needed)
                    const body = new THREE.Mesh(
                        new THREE.BoxGeometry(...size),
                        new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9 })
                    );
                    body.position.y = size[1]/2;
                    group.add(body);
                    
                    // Add a small neon "core" for extra visibility
                    const core = new THREE.Mesh(
                        new THREE.BoxGeometry(size[0]*0.8, size[1]*0.8, size[2]*0.8),
                        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
                    );
                    group.add(core);

                    this.othersGroup.add(group);
                    p.model = group;
                    p.currentVehicle = p.vehicle;
                }
                
                const coord = mapboxgl.MercatorCoordinate.fromLngLat([p.lng, p.lat], 0);
                
                // --- ROBUST 3D POSITIONING ---
                const meterScale = modelTransform.scale;
                
                p.model.position.set(
                    (coord.x - modelTransform.translateX) / meterScale,
                    (coord.z - modelTransform.translateZ) / meterScale + 0.1, // Small lift
                    (coord.y - modelTransform.translateY) / meterScale
                );
                
                p.model.rotation.y = -(p.bearing * Math.PI / 180) + Math.PI;
                p.model.updateMatrix();
                p.model.visible = true;
                
                // Ensure visibility with emissive boost
                p.model.traverse(node => {
                    if (node.isMesh) {
                        node.material.emissiveIntensity = 0.5;
                        node.material.needsUpdate = true;
                    }
                });

                if (!p.marker2d) {
                    const el = document.createElement('div');
                    el.className = 'other-player-shadow';
                    el.style.width = '20px'; el.style.height = '20px';
                    el.style.background = 'rgba(0, 242, 255, 0.6)';
                    el.style.borderRadius = '50%';
                    el.style.boxShadow = '0 0 15px #00F2FF';
                    p.marker2d = new mapboxgl.Marker(el).setLngLat([p.lng, p.lat]).addTo(map);
                } else {
                    p.marker2d.setLngLat([p.lng, p.lat]);
                }
            });
        }
    };

    map.addLayer(threeLayer);
}

function add3DBuildings() {
    if (!state.is3D) {
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

map.on('load', () => {
    setProgress(30);
    setup3DVehicleLayer();
    setProgress(60);
    add3DBuildings();
    addSkidMarksLayer();
    cleanMap();

    setProgress(100); setTimeout(() => { loadingOverlay.style.opacity = '0'; loadingOverlay.style.pointerEvents = 'none'; setTimeout(() => loadingOverlay.style.display = 'none', 1200); }, 500);
    state.lastTime = performance.now();
    requestAnimationFrame(update);
});

map.on('style.load', () => {
    setup3DVehicleLayer();
    add3DBuildings();
    addSkidMarksLayer();
    cleanMap();
});

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

            // High-Precision Collision Detection with a cheaper escape check
            if (state.collisionsEnabled && state.activeVehicle !== 'god' && Math.abs(state.velocity) > 0.01) {
                const nextP = map.project([nextLng, nextLat]);
                const currentP = map.project([state.lng, state.lat]);

                // Create a single bbox that covers current and next position for efficiency
                const minX = Math.min(currentP.x, nextP.x) - 14;
                const minY = Math.min(currentP.y, nextP.y) - 14;
                const maxX = Math.max(currentP.x, nextP.x) + 14;
                const maxY = Math.max(currentP.y, nextP.y) + 14;
                const combinedBbox = [[minX, minY], [maxX, maxY]];

                let collisions = [];
                try {
                    const layers = ['3d-buildings', 'building'].filter(l => map.getLayer(l));
                    if (layers.length > 0) {
                        collisions = map.queryRenderedFeatures(combinedBbox, { layers });
                    }
                } catch (e) { }

                if (collisions.length > 0) {
                    const currentBbox = [[currentP.x - 8, currentP.y - 8], [currentP.x + 8, currentP.y + 8]];
                    let isAlreadyInside = false;

                    try {
                        const layers = ['3d-buildings', 'building'].filter(l => map.getLayer(l));
                        isAlreadyInside = layers.length > 0 && map.queryRenderedFeatures(currentBbox, { layers }).length > 0;
                    } catch (e) { }

                    if (isAlreadyInside) {
                        state.lng = nextLng;
                        state.lat = nextLat;
                    } else if (state.velocity > 0) {
                        // If not already inside and moving forward -> CRASH
                        state.velocity = -0.01;
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
                state.lng = nextLng;
                state.lat = nextLat;
            }

            // Multiplayer Collision (Simple Circle Collision)
            Object.values(state.otherPlayers).forEach(p => {
                const dx = state.lng - p.lng;
                const dy = state.lat - p.lat;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const threshold = 0.00004; // Collision distance approx 4m
                
                if (dist < threshold) {
                    // Bounce back (Fixed: units were way too large before)
                    const pushFactor = 0.00001; 
                    const pushX = (dx / dist) * pushFactor;
                    const pushY = (dy / dist) * pushFactor;
                    state.velocity *= -0.4; // Bounce and lose speed
                    state.lng += pushX;
                    state.lat += pushY;
                    state.crashShake = 1.2;
                    spawnDebris(state.lng, state.lat);
                }
            });
        } else {
            state.velocity *= Math.pow(0.998, dtFinal);
        }

        let targetCamBearing = state.bearing + (state.velocity < -0.01 ? 180 : 0);
        let diff = targetCamBearing - state.camBearing;
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;
        state.camBearing += diff * 0.1 * dtFinal;

        // Refined camera pitch (Base 60, Max 70 for normal, Max 65 for God)
        const basePitch = 60;
        const velocityPitchCap = state.activeVehicle === 'god' ? 5 : 10;
        const chargingLean = state.chargeLevel * 10;
        const velocityPitch = Math.min(Math.abs(state.velocity) * 15, velocityPitchCap); 
        const targetPitch = basePitch + chargingLean + velocityPitch; 
        
        // Lerp the pitch for ultimate smoothness
        state.currentPitch += (targetPitch - state.currentPitch) * 0.04 * dtFinal;

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
            state.chargeLevel *= Math.pow(0.98, dtFinal);
            if (state.chargeLevel < 0.001) state.chargeLevel = 0;
        }

        // Rapid decay for crash shake
        if (state.crashShake > 0) {
            state.crashShake *= Math.pow(0.85, dtFinal);
            if (state.crashShake < 0.1) state.crashShake = 0;
        }

        let speedVal = Math.abs(state.velocity) * 600;
        if (state.unit === 'mi') speedVal *= 0.621371;
        speedEl.textContent = (state.velocity < -0.0001 ? '-' : '') + Math.floor(speedVal);

    // Global Vehicle Sync (Handles both 2D and 3D mode logic)
    if (vehicleMarker && (!state.is3D || state.activeVehicle === 'god')) {
        vehicleMarker.setLngLat([state.lng, state.lat]);
        vehicleMarker.setRotation(state.bearing);
        
        const inner = vehicleMarker.getElement().querySelector('.vehicle-marker');
        const config = VEHICLE_CONFIG[state.activeVehicle];
        
        if (inner) {
            if (state.isCharging) {
                const s = (Math.random() - 0.5) * state.chargeLevel * 10;
                inner.style.transform = `scale(${config.size * 1.2}) translate(${s}px, ${s}px)`;
            } else {
                inner.style.transform = `scale(${config.size * 1.2})`;
            }
        }
    }

        // Update Skid Marks
        updateSkidMarks(dtFinal);

        requestAnimationFrame(update);
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
    settingsBtn.onclick = (e) => { e.stopPropagation(); settingsPanel.classList.toggle('active'); };
    document.onclick = (e) => { if (!settingsPanel.contains(e.target) && e.target !== settingsBtn) settingsPanel.classList.remove('active'); };
    document.querySelectorAll('.style-toggle button').forEach(btn => { btn.onclick = () => { document.querySelector('.style-toggle button.active').classList.remove('active'); btn.classList.add('active'); map.setStyle(`mapbox://styles/mapbox/${btn.dataset.style}`); }; });
    document.querySelectorAll('.vehicle-toggle button').forEach(btn => { btn.onclick = () => { document.querySelector('.vehicle-toggle button.active').classList.remove('active'); btn.classList.add('active'); state.activeVehicle = btn.dataset.vehicle; setup3DVehicleLayer(); setupVehicleMarker(); }; });
    document.querySelectorAll('.unit-toggle button').forEach(btn => { btn.onclick = () => { document.querySelector('.unit-toggle button.active').classList.remove('active'); btn.classList.add('active'); state.unit = btn.dataset.unit; unitLabel.textContent = state.unit === 'km' ? 'KM/H' : 'MPH'; }; });
    document.querySelectorAll('.d3-toggle button').forEach(btn => { 
        btn.onclick = () => { 
            document.querySelector('.d3-toggle button.active').classList.remove('active'); 
            btn.classList.add('active'); 
            state.is3D = btn.dataset.d3 === 'on'; 
            
            // Auto-toggle collisions based on 3D mode
            state.collisionsEnabled = state.is3D;
            const collisionButtons = document.querySelectorAll('.collision-toggle button');
            collisionButtons.forEach(b => {
                b.classList.toggle('active', b.dataset.collision === (state.is3D ? 'on' : 'off'));
            });

            setup3DVehicleLayer(); 
            setupVehicleMarker(); 
            add3DBuildings(); 
        }; 
    });

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
                    godBtn.onclick = () => { document.querySelector('.vehicle-toggle button.active').classList.remove('active'); godBtn.classList.add('active'); state.activeVehicle = 'god'; if (threeLayer) { map.removeLayer('3d-vehicle-layer'); setup3DVehicleLayer(); } setupVehicleMarker(); };
                    vehicleToggle.appendChild(godBtn);
                }
                state.activeVehicle = 'god';
                document.querySelectorAll('.vehicle-toggle button').forEach(b => b.classList.remove('active'));
                document.querySelector('[data-vehicle="god"]').classList.add('active');
                if (threeLayer) { map.removeLayer('3d-vehicle-layer'); setup3DVehicleLayer(); }
                setupVehicleMarker();
            } else {
                const godBtn = document.querySelector('[data-vehicle="god"]');
                if (godBtn) godBtn.remove();
                if (state.activeVehicle === 'god') {
                    state.activeVehicle = 'car';
                    document.querySelectorAll('.vehicle-toggle button').forEach(b => b.classList.remove('active'));
                    document.querySelector('[data-vehicle="car"]').classList.add('active');
                    if (threeLayer) { map.removeLayer('3d-vehicle-layer'); setup3DVehicleLayer(); }
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
    window.addEventListener('mousemove', (e) => {
        if (!enableCustomCursor) return;
        cursorState.targetX = e.clientX;
        cursorState.targetY = e.clientY;
        cursorState.lastMove = Date.now();
        cursorState.hasMoved = true;

        // Building detection removed for maximum performance while driving
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
        const mpDropdown = document.getElementById('mp-dropdown');
        const mpBtn = document.getElementById('mp-btn');
        const copyBtn = document.getElementById('copy-id-btn');
        const joinBtn = document.getElementById('join-mp-btn');
        const joinInput = document.getElementById('join-peer-id');
        const mpStatusDot = document.getElementById('mp-status-dot');

        if (myPeerIdEl) myPeerIdEl.textContent = myId.toUpperCase();

        // --- MQTT SETUP ---
        const client = new Paho.MQTT.Client("broker.hivemq.com", 8000, "georide_" + myId);
        let currentTopic = "georide/global/pro";

        client.onConnectionLost = (responseObject) => {
            console.log("MQTT Connection Lost:", responseObject.errorMessage);
            mpStatusDot?.classList.remove('online');
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
                    p.targetLng = data.lng;
                    p.targetLat = data.lat;
                    p.targetBearing = data.bearing;
                    p.vehicle = data.vehicle || 'car';
                    p.lastSeen = Date.now();
                }
            } catch (e) {}
        };

        function onConnect() {
            console.log("MQTT Connected to:", currentTopic);
            mpStatusDot?.classList.add('online');
            client.subscribe(currentTopic);
        }

        client.connect({ onSuccess: onConnect, useSSL: false });

        if (joinBtn) {
            const handleJoin = (e) => {
                if (e) e.preventDefault();
                const targetCode = joinInput.value.trim().toLowerCase();
                if (targetCode) {
                    client.unsubscribe(currentTopic);
                    currentTopic = `georide/room/${targetCode}`;
                    client.subscribe(currentTopic);
                    joinBtn.textContent = 'LINKED: ' + targetCode.toUpperCase();
                    joinBtn.style.background = '#00ff88';
                    
                    setTimeout(() => { 
                        mpDropdown.classList.remove('active');
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

        // ESC to Close Popup
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mpDropdown.classList.contains('active')) {
                mpDropdown.classList.remove('active');
            }
        });

        // Broadcast Loop (500ms - No rate limits on MQTT!)
        setInterval(() => {
            if (client.isConnected()) {
                const message = new Paho.MQTT.Message(JSON.stringify({
                    id: myId, 
                    lng: state.lng, 
                    lat: state.lat, 
                    bearing: state.bearing,
                    vehicle: state.activeVehicle
                }));
                message.destinationName = currentTopic;
                client.send(message);
            }
        }, 500);

        // UI Handlers
        if (copyBtn) copyBtn.onclick = () => {
            navigator.clipboard.writeText(myId.toUpperCase());
            copyBtn.textContent = 'OK';
            setTimeout(() => { copyBtn.textContent = 'COPY'; }, 1000);
        };
        if (mpBtn) mpBtn.onclick = (e) => {
            if (e) e.preventDefault();
            mpDropdown.classList.toggle('active');
        };

        // Cleanup
        setInterval(() => {
            const now = Date.now();
            Object.keys(state.otherPlayers).forEach(id => {
                if (now - state.otherPlayers[id].lastSeen > 10000) {
                    const p = state.otherPlayers[id];
                    if (p.model) threeLayer.othersGroup.remove(p.model);
                    if (p.marker2d) p.marker2d.remove();
                    delete state.otherPlayers[id];
                }
            });
        }, 5000);
    }

    setTimeout(initMultiplayer, 1000);
}
