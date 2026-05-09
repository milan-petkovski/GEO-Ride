import { INITIAL_CENTER, PERFORMANCE_PROFILE } from './config.js';

export const state = {
    lng: INITIAL_CENTER[0],
    lat: INITIAL_CENTER[1],
    bearing: 0, travelBearing: 0, camBearing: 0,
    velocity: 0, steeringAngle: 0,
    keys: {}, activeVehicle: 'car',
    unit: 'km',
    mapStyle: 'streets-v12',
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
            mapStyle: state.mapStyle
        };
        localStorage.setItem('geo_ride_state', JSON.stringify(dataToSave));
    } catch (e) {
        console.warn('Could not save state', e);
    }
}

export function loadState() {
    try {
        const saved = localStorage.getItem('geo_ride_state');
        if (saved) {
            const parsed = JSON.parse(saved);
            state.lng = parsed.lng ?? INITIAL_CENTER[0];
            state.lat = parsed.lat ?? INITIAL_CENTER[1];
            state.activeVehicle = parsed.activeVehicle ?? 'car';
            state.unit = parsed.unit ?? 'km';
            state.collisionsEnabled = parsed.collisionsEnabled ?? true;
            state.is3D = parsed.is3D ?? true;
            state.is3DBuildings = parsed.is3DBuildings ?? true;
            state.mapStyle = parsed.mapStyle ?? 'streets-v12';
            state.currentHome = [state.lng, state.lat];
        }
    } catch (e) {
        console.warn('Could not load state', e);
    }
}
