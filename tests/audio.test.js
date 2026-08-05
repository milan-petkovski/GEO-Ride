import test from 'node:test';
import assert from 'node:assert/strict';
import { initAudio, updateAudio, playCrashSound } from '../js/audio.js';

function createMockAudioContext() {
    return class MockAudioContext {
        constructor() {
            this.state = 'running';
            this.sampleRate = 44100;
            this.currentTime = 0;
            this.destination = {};
        }
        createOscillator() {
            return {
                type: 'sine',
                frequency: { value: 440, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
                connect() {},
                start() {},
                stop() {}
            };
        }
        createGain() {
            return {
                gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
                connect() {}
            };
        }
        createBiquadFilter() {
            return {
                type: 'lowpass',
                frequency: { value: 350 },
                Q: { value: 1 },
                connect() {}
            };
        }
        createBufferSource() {
            return {
                buffer: null,
                loop: false,
                connect() {},
                start() {}
            };
        }
        createBuffer() {
            return {
                getChannelData: () => new Float32Array(100)
            };
        }
        resume() {
            this.state = 'running';
        }
    };
}

test('initAudio & updateAudio across vehicle acoustic profiles', () => {
    const origWindow = globalThis.window;
    globalThis.window = globalThis.window || {};
    globalThis.window.AudioContext = createMockAudioContext();

    initAudio();

    const mockStateCar = {
        velocity: 0.5,
        activeVehicle: 'car',
        isCharging: false,
        masterVolume: 0.8,
        keys: { ' ': false }
    };
    assert.doesNotThrow(() => updateAudio(mockStateCar));

    const mockStateTruck = {
        velocity: 0.3,
        activeVehicle: 'truck',
        isCharging: true,
        chargeLevel: 0.5,
        masterVolume: 0.5,
        keys: { ' ': true }
    };
    assert.doesNotThrow(() => updateAudio(mockStateTruck));

    const mockStateBus = {
        velocity: 0.4,
        activeVehicle: 'bus',
        isCharging: false,
        masterVolume: 0.5,
        keys: { ' ': false }
    };
    assert.doesNotThrow(() => updateAudio(mockStateBus));

    const mockStateGod = {
        velocity: 0.8,
        activeVehicle: 'god',
        isCharging: false,
        masterVolume: 0.5,
        keys: { ' ': true }
    };
    assert.doesNotThrow(() => updateAudio(mockStateGod));

    assert.doesNotThrow(() => playCrashSound(0.8, 0.5));

    globalThis.window = origWindow;
});
