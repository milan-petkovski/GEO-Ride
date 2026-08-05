import test from 'node:test';
import assert from 'node:assert/strict';

// Pure physics helper calculations for unit testing
function calculateAcceleration(currentSpeed, isAccelerating, isBraking, dt, config) {
    let speed = currentSpeed;
    const accel = config.accel || 1.2;
    const brake = config.brake || 2.0;
    const drag = config.drag || 0.98;
    const maxSpeed = config.maxSpeed || 80;

    if (isAccelerating) {
        speed += accel * dt;
        if (speed > maxSpeed) speed = maxSpeed;
    } else if (isBraking) {
        speed -= brake * dt;
        if (speed < -maxSpeed / 3) speed = -maxSpeed / 3;
    } else {
        speed *= Math.pow(drag, dt);
    }
    return speed;
}

function calculateSteering(currentBearing, isLeft, isRight, speed, dt, steerSensitivity = 1.5) {
    if (Math.abs(speed) < 0.01) return currentBearing;
    let bearing = currentBearing;
    const direction = speed < 0 ? -1 : 1;
    if (isLeft) bearing -= steerSensitivity * direction * dt * 10;
    if (isRight) bearing += steerSensitivity * direction * dt * 10;
    return ((bearing % 360) + 360) % 360;
}

test('physics acceleration logic', () => {
    const config = { accel: 2.0, brake: 3.0, maxSpeed: 100, drag: 0.95 };

    // Test accelerating from 0
    let speed = calculateAcceleration(0, true, false, 1.0, config);
    assert.strictEqual(speed, 2.0);

    // Test max speed capping
    speed = calculateAcceleration(99, true, false, 2.0, config);
    assert.strictEqual(speed, 100);
});

test('physics braking logic', () => {
    const config = { accel: 2.0, brake: 3.0, maxSpeed: 100, drag: 0.95 };

    // Test braking when moving forward
    const speed = calculateAcceleration(10, false, true, 1.0, config);
    assert.strictEqual(speed, 7.0);
});

test('physics steering logic', () => {
    // Steering right while moving forward
    let bearing = calculateSteering(0, false, true, 50, 1.0);
    assert.strictEqual(bearing, 15);

    // Steering left while reversing should invert steering direction relative to movement
    bearing = calculateSteering(0, true, false, -20, 1.0);
    assert.strictEqual(bearing, 15);
});
