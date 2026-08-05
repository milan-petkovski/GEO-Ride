import test from 'node:test';
import assert from 'node:assert/strict';
import {
    INITIAL_CENTER,
    INITIAL_ZOOM,
    VEHICLE_CONFIG,
    PERFORMANCE_PROFILE,
    AIR_DRAG_FACTOR,
    detectPerformanceProfile
} from '../js/config.js';

test('config - verifies initial center and zoom constants', () => {
    assert.strictEqual(Array.isArray(INITIAL_CENTER), true);
    assert.strictEqual(INITIAL_CENTER.length, 2);
    assert.strictEqual(typeof INITIAL_CENTER[0], 'number');
    assert.strictEqual(typeof INITIAL_CENTER[1], 'number');
    assert.strictEqual(INITIAL_ZOOM, 18);
});

test('config - vehicle specifications integrity', () => {
    const requiredKeys = ['car', 'truck', 'bus', 'god'];
    requiredKeys.forEach((key) => {
        assert.strictEqual(key in VEHICLE_CONFIG, true);
        const spec = VEHICLE_CONFIG[key];
        assert.strictEqual(typeof spec.power, 'number');
        assert.strictEqual(typeof spec.brake, 'number');
        assert.strictEqual(typeof spec.maxSpeed, 'number');
        assert.strictEqual(typeof spec.svg, 'string');
    });
});

test('config - performance profile structure', () => {
    assert.strictEqual(typeof PERFORMANCE_PROFILE, 'object');
    assert.strictEqual(typeof PERFORMANCE_PROFILE.tier, 'string');
    assert.strictEqual(typeof PERFORMANCE_PROFILE.lowEnd, 'boolean');
    assert.strictEqual(typeof PERFORMANCE_PROFILE.cores, 'number');
});

test('config - named physics constants present', () => {
    assert.strictEqual(typeof AIR_DRAG_FACTOR, 'number');
    assert.strictEqual(AIR_DRAG_FACTOR > 0 && AIR_DRAG_FACTOR < 1, true);
});

test('detectPerformanceProfile - evaluates low-end tier for low memory or low cores', () => {
    const profileLow = detectPerformanceProfile(
        { innerWidth: 1024, innerHeight: 768 },
        { deviceMemory: 2, hardwareConcurrency: 2, connection: { effectiveType: '4g' } },
        null
    );
    assert.strictEqual(profileLow.tier, 'low');
    assert.strictEqual(profileLow.lowEnd, true);
    assert.strictEqual(profileLow.eliteEnd, false);
});

test('detectPerformanceProfile - evaluates elite tier for high-end hardware', () => {
    const mockDoc = {
        createElement: () => ({
            getContext: () => ({
                getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 1, UNMASKED_VENDOR_WEBGL: 2 }),
                getParameter: (param) => (param === 1 ? 'NVIDIA GeForce RTX 4090' : 'NVIDIA')
            })
        })
    };
    const profileElite = detectPerformanceProfile(
        { innerWidth: 1920, innerHeight: 1080 },
        { deviceMemory: 16, hardwareConcurrency: 16, connection: { effectiveType: '4g' } },
        mockDoc
    );
    assert.strictEqual(profileElite.tier, 'elite');
    assert.strictEqual(profileElite.eliteEnd, true);
    assert.strictEqual(profileElite.gpu.isLowEndGpu, false);
});

test('detectPerformanceProfile - detects low-end GPU integrated graphics', () => {
    const mockDoc = {
        createElement: () => ({
            getContext: () => ({
                getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 1, UNMASKED_VENDOR_WEBGL: 2 }),
                getParameter: () => 'Intel HD Graphics 620'
            })
        })
    };
    const profile = detectPerformanceProfile(
        { innerWidth: 1280, innerHeight: 800 },
        { deviceMemory: 8, hardwareConcurrency: 8 },
        mockDoc
    );
    assert.strictEqual(profile.gpu.isLowEndGpu, true);
    assert.strictEqual(profile.tier, 'low');
});

test('detectPerformanceProfile - handles saveData, slow connection, reduced motion and WebGL errors gracefully', () => {
    const mockDocError = {
        createElement: () => {
            throw new Error('Canvas not supported');
        }
    };
    const profile = detectPerformanceProfile(
        {
            innerWidth: 500,
            innerHeight: 800,
            matchMedia: () => ({ matches: true }),
            ontouchstart: true
        },
        {
            deviceMemory: 8,
            hardwareConcurrency: 4,
            maxTouchPoints: 5,
            connection: { saveData: true, effectiveType: '2g' }
        },
        mockDocError
    );
    assert.strictEqual(profile.isSlowConn, true);
    assert.strictEqual(profile.reducedMotion, true);
    assert.strictEqual(profile.touchDevice, true);
    assert.strictEqual(profile.gpu.renderer, 'Error');
    assert.strictEqual(profile.tier, 'low');
});
