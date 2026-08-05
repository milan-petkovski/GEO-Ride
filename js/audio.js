let ctx = null;
let engineOsc = null;
let engineFilter = null;
let engineGain = null;
let driftNoise = null;
let driftFilter = null;
let driftSqueal = null;
let driftGain = null;
let isInitialized = false;

// Generate white noise for tire skidding
function createNoiseBuffer() {
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    return buffer;
}

export function initAudio() {
    if (isInitialized) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        ctx = new AudioContext();
        
        // 1. Engine Simulator
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'triangle'; // Default
        
        engineFilter = ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 150; // Deep muffled hum
        
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        
        engineOsc.connect(engineFilter);
        engineFilter.connect(engineGain);
        engineGain.connect(ctx.destination);
        engineOsc.start();
        
        // 2. Tire Drift Simulator
        driftNoise = ctx.createBufferSource();
        driftNoise.buffer = createNoiseBuffer();
        driftNoise.loop = true;
        
        driftFilter = ctx.createBiquadFilter();
        driftFilter.type = 'highpass';
        driftFilter.frequency.value = 800; // Remove bass, keep asphalt scratch
        
        driftSqueal = ctx.createBiquadFilter();
        driftSqueal.type = 'lowpass';
        driftSqueal.frequency.value = 1500; // Cut off harsh high frequencies
        driftSqueal.Q.value = 0; // No resonance
        
        driftGain = ctx.createGain();
        driftGain.gain.value = 0;
        
        driftNoise.connect(driftFilter);
        driftFilter.connect(driftSqueal);
        driftSqueal.connect(driftGain);
        driftGain.connect(ctx.destination);
        driftNoise.start();
        
        isInitialized = true;
    } catch (e) {
        console.warn('Web Audio initialization failed:', e);
    }
}

// Auto-initialize on first user interaction
const unlockAudio = () => {
    initAudio();
    if (ctx && ctx.state === 'suspended') {
        ctx.resume();
    }
    document.removeEventListener('keydown', unlockAudio);
    document.removeEventListener('pointerdown', unlockAudio);
};
if (typeof document !== 'undefined') {
    document.addEventListener('keydown', unlockAudio);
    document.addEventListener('pointerdown', unlockAudio);
}

export function updateAudio(state) {
    if (!isInitialized || !ctx || ctx.state !== 'running') return;
    
    const absVel = Math.abs(state.velocity);
    let baseFreq = 50;
    let volMult = 1.0;
    
    // Vehicle-specific acoustic profiles
    if (state.activeVehicle === 'truck') { 
        engineOsc.type = 'square'; // Rattling diesel sound
        baseFreq = 25; volMult = 1.3; 
        engineFilter.frequency.value = 100 + (absVel * 60); // Muffled heavy bass
    }
    else if (state.activeVehicle === 'bus') { 
        engineOsc.type = 'triangle'; // Smooth heavy electric/diesel hum
        baseFreq = 30; volMult = 1.4; 
        engineFilter.frequency.value = 150 + (absVel * 100);
    }
    else if (state.activeVehicle === 'god') { 
        engineOsc.type = 'sine'; // Sci-Fi hum
        baseFreq = 150; volMult = 0.15; // Barely perceptible whisper
        engineFilter.frequency.value = 1000 + (absVel * 1000); // Fully open filter
    }
    else { // Car
        engineOsc.type = 'sawtooth'; // Throaty V6 engine growl
        baseFreq = 40; volMult = 1.0;
        engineFilter.frequency.value = 120 + (absVel * 300); // Opens up into a roar at high speeds
    }
    
    let revFreq = state.isCharging ? state.chargeLevel * 100 : 0;
    const targetFreq = baseFreq + (absVel * 450) + revFreq;
    
    // Smooth frequency interpolation
    const currentFreq = engineOsc.frequency.value;
    engineOsc.frequency.value += (targetFreq - currentFreq) * 0.15;
    
    // Volume dynamics (Recalibrated so 50% slider = current level + a bit more)
    const masterVol = state.masterVolume !== undefined ? state.masterVolume : 0.5;
    let targetVol = 0.01 * volMult * masterVol; // Base idle
    if (absVel > 0.01 || state.isCharging) {
        targetVol = Math.min(0.02 + (absVel * 0.06), 0.15) * volMult * masterVol; // Max volume 0.15 at 100% slider
    }
    const currentVol = engineGain.gain.value;
    engineGain.gain.value += (targetVol - currentVol) * 0.1;
    
    // Drift dynamics (Soft hiss instead of screech)
    const isDriftingNow = state.keys[' '] && absVel > 0.05 && state.activeVehicle !== 'god';
    const targetDriftVol = isDriftingNow ? Math.min(absVel * 0.05, 0.04) * masterVol : 0; // Halved the volume of the screech
    
    // Slight modulation for dynamic feel
    if (isDriftingNow && driftSqueal) {
        driftSqueal.frequency.value = 1200 + (absVel * 800);
    }
    
    const currentDriftVol = driftGain.gain.value;
    driftGain.gain.value += (targetDriftVol - currentDriftVol) * 0.2;
}

export function playCrashSound(intensity, masterVolume = 0.5) {
    if (!isInitialized || !ctx || masterVolume <= 0) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine'; // Soft thud instead of harsh square wave
    osc.frequency.setValueAtTime(60, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.3);
    const vol = Math.min(intensity * 0.25, 0.35) * masterVolume; // Apply master volume
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
}
