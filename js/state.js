import { INITIAL_CENTER, PERFORMANCE_PROFILE } from './config.js';

export const state = {
    lng: INITIAL_CENTER[0],
    lat: INITIAL_CENTER[1],
    bearing: 0, travelBearing: 0, camBearing: 0,
    velocity: 0, steeringAngle: 0,
    keys: {}, activeVehicle: 'car',
    unit: 'km',
    mapStyle: 'satellite-streets-v12',
    lightPreset: 'day',
    controlsMode: 'tilt',
    isInputFocused: false, godMode: false,
    lastTime: performance.now(),
    stopTime: 0, sKeyReleasedSinceStop: true, wKeyReleasedSinceStop: true,
    chargeLevel: 0, isCharging: false, currentPitch: 65,
    crashShake: 0, collisionsEnabled: true,
    is3D: true, is3DBuildings: true,
    currentHome: [...INITIAL_CENTER],
    skidMarks: [],
    lastSkidPoints: null,
    teleportStart: null,
    teleportEnd: null,
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

export function saveState() {
    try {
        const dataToSave = {
            lng: state.lng,
            lat: state.lat,
            activeVehicle: state.activeVehicle,
            unit: state.unit,
            collisionsEnabled: state.collisionsEnabled,
            is3D: state.is3D,
            is3DBuildings: state.is3DBuildings,
            mapStyle: state.mapStyle,
            lightPreset: state.lightPreset,
            controlsMode: state.controlsMode
        };
        localStorage.setItem('geo_ride_state', JSON.stringify(dataToSave));
    } catch (e) {
        console.warn('Could not save state', e);
    }
}

export function loadState() {
    try {
        const saved = localStorage.getItem('geo_ride_state');
        if (!saved) return;
        
        const parsed = JSON.parse(saved);
        if (!parsed || typeof parsed !== 'object') return;

        // Strict Type & Range Validation
        const validateNum = (val, def) => (typeof val === 'number' && !isNaN(val)) ? val : def;
        const validateStr = (val, allowed, def) => (typeof val === 'string' && allowed.includes(val)) ? val : def;
        const validateBool = (val, def) => (typeof val === 'boolean') ? val : def;

        state.lng = validateNum(parsed.lng, INITIAL_CENTER[0]);
        state.lat = validateNum(parsed.lat, INITIAL_CENTER[1]);
        state.activeVehicle = validateStr(parsed.activeVehicle, ['car', 'truck', 'bus', 'god'], 'car');
        state.unit = validateStr(parsed.unit, ['km', 'mi'], 'km');
        state.collisionsEnabled = validateBool(parsed.collisionsEnabled, true);
        state.is3D = validateBool(parsed.is3D, true);
        state.is3DBuildings = validateBool(parsed.is3DBuildings, true);
        state.mapStyle = validateStr(parsed.mapStyle, ['streets-v12', 'satellite-v9', 'satellite-streets-v12', 'standard'], 'streets-v12');
        state.lightPreset = validateStr(parsed.lightPreset, ['day', 'night', 'dusk', 'dawn'], 'day');
        state.controlsMode = validateStr(parsed.controlsMode, ['tilt', 'off'], 'tilt');
        
        state.currentHome = [state.lng, state.lat];
    } catch (e) {
        console.warn('Security Alert: State corruption detected or load failure', e);
    }
}
