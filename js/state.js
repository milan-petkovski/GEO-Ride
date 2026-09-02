/**
 * @file state.js
 * @description Centralized reactive state store for GEO Ride simulator, managing vehicle physics state, user preferences, camera parameters, and event subscriptions.
 */

import { INITIAL_CENTER, PERFORMANCE_PROFILE } from './config.js';

/**
 * @typedef {Object} UserPreferences
 * @property {boolean} collisionsEnabled - Whether building collisions are active.
 * @property {boolean} is3D - Whether 3D camera mode is enabled.
 * @property {boolean} is3DBuildings - Whether 3D extruded buildings layer is enabled.
 */

/**
 * @typedef {Object} GeoRideState
 * @property {number} lng - Current vehicle longitude.
 * @property {number} lat - Current vehicle latitude.
 * @property {number} bearing - Current vehicle heading angle in degrees (0-360).
 * @property {number} travelBearing - Direction of momentum/velocity vector.
 * @property {number} camBearing - Camera orbit bearing angle.
 * @property {number} velocity - Current vehicle velocity in km/h.
 * @property {number} steeringAngle - Current front wheel steering angle.
 * @property {Record<string, boolean>} keys - Active key input state dictionary.
 * @property {string} activeVehicle - Currently selected vehicle ('car', 'truck', 'bus', 'god').
 * @property {string} unit - Measurement unit ('km' or 'mi').
 * @property {string} mapStyle - Mapbox style identifier ('standard', 'streets-v12', 'satellite-v9', etc.).
 * @property {string} lightPreset - Environment lighting preset ('realtime', 'day', 'night', 'dusk', 'dawn').
 * @property {string} controlsMode - Steering tilt sensitivity mode ('tilt' or 'off').
 * @property {number} masterVolume - Master audio volume scalar (0.0 - 1.0).
 * @property {boolean} isInputFocused - True when text input fields are focused.
 * @property {boolean} godMode - True when ghost vehicle mode is active.
 * @property {number} lastTime - Timestamp of previous render frame.
 * @property {number} stopTime - Duration stopped in ms.
 * @property {boolean} sKeyReleasedSinceStop - Flag tracking brake key release state.
 * @property {boolean} wKeyReleasedSinceStop - Flag tracking accel key release state.
 * @property {number} chargeLevel - Launch control burnout charge percentage (0-100).
 * @property {boolean} isCharging - True during launch control charge sequence.
 * @property {number} currentPitch - Current camera pitch angle in degrees.
 * @property {number} crashShake - Crash camera shake intensity scalar.
 * @property {boolean} collisionsEnabled - Collision detection toggle.
 * @property {boolean} is3D - 3D mode active state.
 * @property {boolean} is3DBuildings - 3D building extrusion active state.
 * @property {UserPreferences} userPrefs - User persistent preferences object.
 * @property {number[]} currentHome - Default home spawn location coordinates [lng, lat].
 * @property {Array} skidMarks - Active skidmark line segment paths.
 * @property {Object} otherPlayers - Map of remote multiplayer player states.
 * @property {Object} performance - Hardware profile settings.
 */

/** @type {GeoRideState} */
export const state = {
    lng: INITIAL_CENTER[0],
    lat: INITIAL_CENTER[1],
    bearing: 107,
    travelBearing: 107,
    camBearing: 107,
    velocity: 0,
    steeringAngle: 0,
    keys: {},
    activeVehicle: 'car',
    unit: 'km',
    mapStyle: 'standard',
    lightPreset: 'realtime',
    controlsMode: 'tilt',
    masterVolume: 0.5,
    isInputFocused: false,
    godMode: false,
    lastTime: performance.now(),
    stopTime: 0,
    sKeyReleasedSinceStop: true,
    wKeyReleasedSinceStop: true,
    chargeLevel: 0,
    isCharging: false,
    currentPitch: 65,
    crashShake: 0,
    collisionsEnabled: true,
    is3D: true,
    is3DBuildings: true,
    userPrefs: { collisionsEnabled: true, is3D: true, is3DBuildings: true },
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
    lastSaveTime: 0,
    isPro: false
};

/** @type {Map<string, Set<Function>>} */
const stateListeners = new Map();

/**
 * Subscribe a listener callback to state change events for a given key.
 * @param {string} key - State property key to observe (or '*' for all state changes).
 * @param {Function} callback - Callback function receiving (newValue, oldValue, key).
 * @returns {Function} Unsubscribe cleanup function.
 */
export function subscribeState(key, callback) {
    if (!stateListeners.has(key)) {
        stateListeners.set(key, new Set());
    }
    stateListeners.get(key).add(callback);
    return () => {
        const keySet = stateListeners.get(key);
        if (keySet) {
            keySet.delete(callback);
        }
    };
}

/**
 * Mutate a state property and notify registered event observers.
 * @param {string} key - Property key on state object to update.
 * @param {*} value - New value to assign.
 */
export function setStateKey(key, value) {
    const oldValue = state[key];
    state[key] = value;

    const specificListeners = stateListeners.get(key);
    if (specificListeners) {
        specificListeners.forEach((fn) => fn(value, oldValue, key));
    }

    const wildcardListeners = stateListeners.get('*');
    if (wildcardListeners) {
        wildcardListeners.forEach((fn) => fn(value, oldValue, key));
    }
}

/**
 * Persists user state settings to local storage.
 * @returns {void}
 */
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
            controlsMode: state.controlsMode,
            masterVolume: state.masterVolume,
            userPrefs: state.userPrefs
        };
        localStorage.setItem('geo_ride_state', JSON.stringify(dataToSave));
    } catch (e) {
        console.warn('Could not save state', e);
    }
}

/**
 * Restores user state settings from local storage with range & fallback validation.
 * @returns {void}
 */
export function loadState() {
    try {
        const saved = localStorage.getItem('geo_ride_state');
        if (!saved) return;

        const parsed = JSON.parse(saved);
        if (!parsed || typeof parsed !== 'object') return;

        // Strict Type & Range Validation
        const validateNum = (val, def) => (typeof val === 'number' && !isNaN(val) ? val : def);
        const validateStr = (val, allowed, def) => (typeof val === 'string' && allowed.includes(val) ? val : def);
        const validateBool = (val, def) => (typeof val === 'boolean' ? val : def);

        setStateKey('lng', validateNum(parsed.lng, INITIAL_CENTER[0]));
        setStateKey('lat', validateNum(parsed.lat, INITIAL_CENTER[1]));
        setStateKey('activeVehicle', validateStr(parsed.activeVehicle, ['car', 'truck', 'bus', 'god'], 'car'));
        setStateKey('unit', validateStr(parsed.unit, ['km', 'mi'], 'km'));
        setStateKey('collisionsEnabled', validateBool(parsed.collisionsEnabled, true));
        setStateKey('is3D', validateBool(parsed.is3D, true));
        setStateKey('is3DBuildings', validateBool(parsed.is3DBuildings, true));

        state.userPrefs = parsed.userPrefs || {
            collisionsEnabled: state.collisionsEnabled,
            is3D: state.is3D,
            is3DBuildings: state.is3DBuildings
        };

        setStateKey(
            'mapStyle',
            validateStr(
                parsed.mapStyle,
                ['streets-v12', 'satellite-v9', 'satellite-streets-v12', 'standard'],
                'standard'
            )
        );
        setStateKey(
            'lightPreset',
            validateStr(parsed.lightPreset, ['realtime', 'day', 'night', 'dusk', 'dawn'], 'realtime')
        );
        setStateKey('controlsMode', validateStr(parsed.controlsMode, ['tilt', 'off'], 'tilt'));
        setStateKey(
            'masterVolume',
            typeof parsed.masterVolume === 'number' && !isNaN(parsed.masterVolume)
                ? Math.max(0, Math.min(1, parsed.masterVolume))
                : 0.5
        );

        state.currentHome = [state.lng, state.lat];
        state.isPro = typeof localStorage !== 'undefined' ? localStorage.getItem('geo_ride_pro_active') === 'true' : false;
        if (!state.isPro && state.activeVehicle === 'god') {
            state.activeVehicle = 'car';
            state.godMode = false;
        }
    } catch (e) {
        console.warn('Security Alert: State corruption detected or load failure', e);
    }
}

/**
 * Updates Pro subscription status and persists to localStorage.
 * @param {boolean} active - Pro status flag.
 * @returns {void}
 */
export function setProStatus(active) {
    state.isPro = !!active;
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('geo_ride_pro_active', state.isPro ? 'true' : 'false');
    }
    setStateKey('isPro', state.isPro);
}
