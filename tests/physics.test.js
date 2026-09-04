import test from 'node:test';
import assert from 'node:assert/strict';
import { updatePhysics, triggerVehicleReset, updateCamera, requestOffthreadTrajectory } from '../js/physics.js';
import { state } from '../js/state.js';
import { VEHICLE_CONFIG, INITIAL_CENTER, AIR_DRAG_FACTOR } from '../js/config.js';

// Mock localStorage for Node test environment
if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (k) => store.get(k) || null,
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear()
    };
}

function resetTestState() {
    state.lng = 20.4573;
    state.lat = 44.8176;
    state.velocity = 0;
    state.bearing = 0;
    state.travelBearing = 0;
    state.steeringAngle = 0;
    state.activeVehicle = 'car';
    state.currentHome = [...INITIAL_CENTER];
    state.keys = {};
    state.isCharging = false;
    state.chargeLevel = 0;
    state.isTeleporting = false;
    state.isCameraAnimating = false;
    state.isDragging = false;
    state.mouseRotation = 0;
    state.camBearing = 0;
    state.currentPitch = 65;
    state.crashShake = 0;
    state.lastCameraManualMove = Date.now();
    state.collisionsEnabled = true;
    state.collisionCheckFrame = 0;
    state.otherPlayers = {};
    state.predictedTrajectory = [];
}

function createMockMap(overrides = {}) {
    let moveEndCallback = null;
    return {
        project(coords) {
            return { x: coords[0] * 100, y: coords[1] * 100 };
        },
        getLayer(id) {
            return id === '3d-buildings' ? {} : null;
        },
        addLayer() {},
        removeLayer() {},
        getSource() {
            return null;
        },
        addSource() {},
        removeSource() {},
        queryRenderedFeatures() {
            return [];
        },
        flyTo(opts) {
            this.lastFlyTo = opts;
        },
        once(evt, cb) {
            if (evt === 'moveend') moveEndCallback = cb;
        },
        triggerMoveEnd() {
            if (moveEndCallback) moveEndCallback();
        },
        getCenter() {
            return { lng: 20.4573, lat: 44.8176 };
        },
        getBearing() {
            return 107;
        },
        getPitch() {
            return 65;
        },
        setCenter(c) {
            this.lastCenter = c;
        },
        setBearing(b) {
            this.lastBearing = b;
        },
        setPitch(p) {
            this.lastPitch = p;
        },
        ...overrides
    };
}

test('updatePhysics - forward acceleration and max speed capping with real VEHICLE_CONFIG', () => {
    resetTestState();
    const config = VEHICLE_CONFIG.car;
    const mockMap = createMockMap();

    // Accelerating forward with 'w'
    state.keys['w'] = true;
    updatePhysics(1.0, mockMap);
    assert.strictEqual(state.velocity, config.power);

    // Accelerating forward with 'arrowup'
    delete state.keys['w'];
    state.keys['arrowup'] = true;
    updatePhysics(1.0, mockMap);
    assert.strictEqual(state.velocity, config.power * 2);

    // Acceleration reaches and caps at maxSpeed
    state.velocity = config.maxSpeed - config.power / 2;
    updatePhysics(1.0, mockMap);
    assert.strictEqual(state.velocity, config.maxSpeed);

    // Over maxSpeed is clamped down
    state.velocity = config.maxSpeed + 10;
    updatePhysics(1.0, mockMap);
    assert.strictEqual(state.velocity, config.maxSpeed);
});

test('updatePhysics - forward braking and reverse acceleration', () => {
    resetTestState();
    const config = VEHICLE_CONFIG.car;
    const mockMap = createMockMap();

    // Braking when moving forward
    state.velocity = config.brake * 2;
    state.keys['s'] = true;
    updatePhysics(1.0, mockMap);
    assert.strictEqual(state.velocity, config.brake);

    // Braking stops at zero (does not overshoot into reverse in one frame)
    updatePhysics(1.5, mockMap);
    assert.strictEqual(state.velocity, 0);

    // Accelerating in reverse from 0
    updatePhysics(1.0, mockMap);
    const expectedReverse = -config.power * 0.6;
    assert.ok(Math.abs(state.velocity - expectedReverse) < 0.00001);

    // Reversing speed is capped at -maxSpeed / 2.5
    state.velocity = -config.maxSpeed;
    updatePhysics(1.0, mockMap);
    assert.strictEqual(state.velocity, -config.maxSpeed / 2.5);

    // Braking while in reverse with 'w'
    state.keys = { w: true };
    state.velocity = -config.brake;
    updatePhysics(1.0, mockMap);
    assert.strictEqual(state.velocity, 0);
});

test('updatePhysics - natural air drag and coasting decay', () => {
    resetTestState();
    const mockMap = createMockMap();

    // Regular vehicle drag
    state.velocity = 0.2;
    updatePhysics(1.0, mockMap);
    assert.ok(Math.abs(state.velocity - 0.2 * AIR_DRAG_FACTOR) < 0.0001);

    // God mode minimal drag
    state.activeVehicle = 'god';
    state.velocity = 0.2;
    updatePhysics(1.0, mockMap);
    assert.ok(Math.abs(state.velocity - 0.2 * 0.999) < 0.0001);

    // Snap to 0 when velocity < 0.0001
    state.activeVehicle = 'car';
    state.velocity = 0.00005;
    updatePhysics(1.0, mockMap);
    assert.strictEqual(state.velocity, 0);
});

test('updatePhysics - burnout and boost charge launch mechanic', () => {
    resetTestState();
    const config = VEHICLE_CONFIG.car;
    const mockMap = createMockMap();

    // Hold space and 'w' while stationary to charge boost
    state.velocity = 0.005;
    state.keys = { ' ': true, w: true };
    updatePhysics(1.0, mockMap);

    assert.strictEqual(state.isCharging, true);
    assert.strictEqual(state.velocity, 0);
    assert.strictEqual(state.chargeLevel, 0.015);

    // Charge level caps at 1.0
    state.chargeLevel = 0.99;
    updatePhysics(1.0, mockMap);
    assert.strictEqual(state.chargeLevel, 1.0);

    // Release space key to launch
    delete state.keys[' '];
    updatePhysics(1.0, mockMap);
    assert.strictEqual(state.isCharging, false);
    assert.strictEqual(state.velocity, config.maxSpeed * 0.75);

    // Releasing space without charging resets charge level
    state.chargeLevel = 0.5;
    state.isCharging = false;
    delete state.keys[' '];
    updatePhysics(1.0, mockMap);
    assert.strictEqual(state.chargeLevel, 0);
});

test('updatePhysics - steering angle and drift dynamics', () => {
    resetTestState();
    const config = VEHICLE_CONFIG.car;
    const mockMap = createMockMap();

    // Steer left with 'a'
    state.keys['a'] = true;
    updatePhysics(1.0, mockMap);
    assert.ok(state.steeringAngle < 0);

    // Steer right with 'd'
    state.keys = { d: true };
    updatePhysics(1.0, mockMap);
    assert.ok(state.steeringAngle > -config.turnRate);

    // Turning while moving forward modifies bearing and travelBearing
    state.velocity = 0.1;
    state.bearing = 90;
    state.travelBearing = 90;
    state.steeringAngle = 0.5;
    const initialLng = state.lng;
    const initialLat = state.lat;

    updatePhysics(1.0, mockMap);
    assert.ok(state.bearing > 90);
    assert.notStrictEqual(state.travelBearing, 90);
    assert.notStrictEqual(state.lng, initialLng);
    assert.notStrictEqual(state.lat, initialLat);

    // Drift mode (space key while moving forward)
    state.keys = { ' ': true };
    state.velocity = 0.2;
    const velBeforeDrift = state.velocity;
    updatePhysics(1.0, mockMap);
    // Slight drift velocity dampening
    assert.ok(state.velocity < velBeforeDrift);

    // God mode steering dynamics
    state.activeVehicle = 'god';
    state.velocity = 0.2;
    state.steeringAngle = 0.5;
    updatePhysics(1.0, mockMap);
    assert.ok(typeof state.bearing === 'number');
});

test('updatePhysics - collision detection against buildings and bounce physics', () => {
    resetTestState();
    state.velocity = 0.1;
    state.bearing = 90;
    state.collisionCheckFrame = 1; // Next frame will be frame 2 (% 2 === 0)

    let queryCount = 0;
    const mockMapWithCollision = createMockMap({
        project(coords) {
            return { x: coords[0] * 100000, y: coords[1] * 100000 };
        },
        getLayer(id) {
            return id === '3d-buildings' ? {} : null;
        },
        queryRenderedFeatures() {
            queryCount++;
            // First call combines bbox at next position, returns collision
            // Second call checks if already inside at current position, returns empty
            return queryCount === 1 ? [{ id: 'bldg-1' }] : [];
        }
    });

    updatePhysics(1.0, mockMapWithCollision);

    // Collision should trigger crash shake and post-collision velocity dampening
    assert.strictEqual(state.crashShake, 15);
    assert.ok(state.velocity < 0.01);
});

test('updatePhysics - multiplayer collision detection and distance threshold', () => {
    resetTestState();
    state.velocity = 0.1;
    state.activeVehicle = 'car';
    state.collisionCheckFrame = 1;

    // Setup global mock mapboxgl for MercatorCoordinate distance calculation
    globalThis.mapboxgl = {
        MercatorCoordinate: {
            fromLngLat(coords) {
                return {
                    x: coords[0] * 0.001,
                    y: coords[1] * 0.001,
                    meterInMercatorCoordinateUnits() {
                        return 0.0001; // Scaled so delta corresponds to meter distance
                    }
                };
            }
        }
    };

    const mockMap = createMockMap();

    // Place another player within 5.0 meters threshold
    state.otherPlayers = {
        'player-2': {
            lng: state.lng + 0.0001,
            lat: state.lat + 0.0001
        }
    };

    updatePhysics(1.0, mockMap);

    // Velocity should bounce back from player collision
    assert.ok(state.velocity < 0);
    assert.strictEqual(state.crashShake, 15);

    delete globalThis.mapboxgl;
});

test('updatePhysics - skips calculations during active teleportation', () => {
    resetTestState();
    state.isTeleporting = true;
    state.keys = { w: true };
    const mockMap = createMockMap();

    updatePhysics(1.0, mockMap);
    assert.strictEqual(state.velocity, 0);
});

test('triggerVehicleReset - resets vehicle to home or initial center with camera animation', () => {
    resetTestState();
    let flyToOpts = null;
    let moveEndHandler = null;

    const mockMap = createMockMap({
        flyTo(opts) {
            flyToOpts = opts;
        },
        once(evt, cb) {
            if (evt === 'moveend') moveEndHandler = cb;
        }
    });

    // 1. Reset to home (Shift=false)
    state.currentHome = [20.46, 44.82];
    state.velocity = 0.3;
    triggerVehicleReset(false, mockMap);

    assert.strictEqual(state.velocity, 0);
    assert.strictEqual(state.isTeleporting, true);
    assert.strictEqual(state.isCameraAnimating, true);
    assert.strictEqual(state.lng, 20.46);
    assert.strictEqual(state.lat, 44.82);
    assert.strictEqual(state.bearing, 107);
    assert.strictEqual(flyToOpts.duration, 2500);
    assert.deepStrictEqual(flyToOpts.center, [20.46, 44.82]);

    // Moveend handler cleans up teleporting flags
    assert.ok(typeof moveEndHandler === 'function');
    moveEndHandler();
    assert.strictEqual(state.isCameraAnimating, false);
    assert.strictEqual(state.isTeleporting, false);

    // 2. Global reset (Shift=true) resets to INITIAL_CENTER
    triggerVehicleReset(true, mockMap);
    assert.strictEqual(flyToOpts.duration, 3500);
    assert.deepStrictEqual(flyToOpts.center, [...INITIAL_CENTER]);
    assert.deepStrictEqual(state.currentHome, [...INITIAL_CENTER]);

    // 3. Re-trigger while already teleporting returns early
    flyToOpts = null;
    triggerVehicleReset(false, mockMap);
    assert.strictEqual(flyToOpts, null);

    // 4. Null map returns early
    state.isTeleporting = false;
    assert.doesNotThrow(() => triggerVehicleReset(false, null));
});

test('updateCamera - auto-return, pitch tracking, and camera lerp', () => {
    resetTestState();
    let updatedCenter = null;
    let updatedBearing = null;
    let updatedPitch = null;

    const mockMap = {
        setCenter(c) {
            updatedCenter = c;
        },
        setBearing(b) {
            updatedBearing = b;
        },
        setPitch(p) {
            updatedPitch = p;
        },
        getCenter() {
            return { lng: 20.4573, lat: 44.8176 };
        },
        getBearing() {
            return 100;
        },
        getPitch() {
            return 60;
        }
    };

    // Idle camera auto-return after 5000ms
    state.lastCameraManualMove = Date.now() - 6000;
    state.mouseRotation = 10;
    state.currentPitch = 60;
    state.velocity = 0;

    updateCamera(1.0, mockMap);

    assert.ok(state.mouseRotation < 10); // Interpolating back to 0
    assert.deepStrictEqual(updatedCenter, [state.lng, state.lat]);
    assert.ok(typeof updatedBearing === 'number');
    assert.ok(typeof updatedPitch === 'number');

    // Driving camera auto-return after 1000ms
    state.lastCameraManualMove = Date.now() - 1500;
    state.velocity = 0.2;
    state.activeVehicle = 'truck';
    updateCamera(1.0, mockMap);
    assert.ok(state.currentPitch <= 68); // Max pitch cap for trucks

    // Camera animating syncs coordinates from map
    state.isCameraAnimating = true;
    updateCamera(1.0, mockMap);
    assert.strictEqual(state.lng, 20.4573);
    assert.strictEqual(state.lat, 44.8176);
    assert.strictEqual(state.camBearing, 100);
    assert.strictEqual(state.currentPitch, 60);

    // Crash shake and charge level decay
    state.isCameraAnimating = false;
    state.crashShake = 10;
    state.chargeLevel = 0.8;
    updateCamera(1.0, mockMap);
    assert.ok(state.crashShake < 10);
    assert.ok(state.chargeLevel < 0.8);
});

test('requestOffthreadTrajectory - handles null worker gracefully without throwing', () => {
    resetTestState();
    state.velocity = 0.5;
    assert.doesNotThrow(() => {
        requestOffthreadTrajectory(1.0);
    });
});
