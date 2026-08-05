/**
 * @file haptics.js
 * @description Vibration Feedback API wrapper for GEO Ride, providing tactile feedback patterns for crashes, drifting, braking, and UI button selections.
 */

import { playCrashSound } from './audio.js';
import { state } from './state.js';

export const haptics = {
    /**
     * Safely get navigator object if available in global environment
     */
    getNav() {
        if (typeof globalThis !== 'undefined' && globalThis.navigator) return globalThis.navigator;
        if (typeof navigator !== 'undefined') return navigator;
        return null;
    },

    /**
     * Check if device supports haptic feedback
     */
    isSupported() {
        const nav = this.getNav();
        return !!(nav && (nav.vibrate || nav.mozVibrate || nav.webkitVibrate || nav.msVibrate));
    },

    /**
     * Get vibration function based on browser support
     */
    getVibrationFunction() {
        const nav = this.getNav();
        if (!nav) return null;
        if (nav.vibrate) return nav.vibrate.bind(nav);
        if (nav.mozVibrate) return nav.mozVibrate.bind(nav);
        if (nav.webkitVibrate) return nav.webkitVibrate.bind(nav);
        if (nav.msVibrate) return nav.msVibrate.bind(nav);
        return null;
    },

    /**
     * Light tap - quick short vibration
     * Used for button presses, UI interactions
     */
    tap() {
        if (!this.isSupported()) return;
        const vibrate = this.getVibrationFunction();
        if (vibrate) vibrate(30);
    },

    /**
     * Double tap - two quick vibrations
     * Used for special actions, drift activation
     */
    doubleTap() {
        if (!this.isSupported()) return;
        const vibrate = this.getVibrationFunction();
        if (vibrate) vibrate([40, 30, 40]);
    },

    /**
     * Success feedback - ascending vibration pattern
     * Used for successful actions, collisions, gear changes
     */
    success() {
        if (!this.isSupported()) return;
        const vibrate = this.getVibrationFunction();
        if (vibrate) vibrate([30, 20, 60]);
    },

    /**
     * Warning feedback - medium vibration
     * Used for warnings, low speed alerts
     */
    warning() {
        if (!this.isSupported()) return;
        const vibrate = this.getVibrationFunction();
        if (vibrate) vibrate([60, 30, 60]);
    },

    /**
     * Error feedback - long strong vibration
     * Used for crashes, collisions, errors
     */
    error() {
        if (!this.isSupported()) return;
        const vibrate = this.getVibrationFunction();
        if (vibrate) vibrate([100, 50, 100]);
    },

    /**
     * Acceleration feedback - repeating medium vibrations
     * Used when pressing accelerator
     */
    accelerate() {
        if (!this.isSupported()) return;
        const vibrate = this.getVibrationFunction();
        if (vibrate) vibrate([40]);
    },

    /**
     * Deceleration feedback - longer vibration
     * Used when pressing brake
     */
    brake() {
        if (!this.isSupported()) return;
        const vibrate = this.getVibrationFunction();
        if (vibrate) vibrate([60]);
    },

    /**
     * Drift activation - triple quick taps
     * Used when initiating drift
     */
    drift() {
        if (!this.isSupported()) return;
        const vibrate = this.getVibrationFunction();
        if (vibrate) vibrate([30, 20, 30, 20, 30]);
    },

    /**
     * Impact feedback - sharp strong vibration
     * Used for collisions with objects
     */
    impact(intensity = 'medium') {
        let crashVol = intensity === 'strong' ? 1.0 : intensity === 'medium' ? 0.6 : 0.3;
        const masterVol = state.masterVolume !== undefined ? state.masterVolume : 1.0;
        playCrashSound(crashVol, masterVol);
        if (!this.isSupported()) return;
        const vibrate = this.getVibrationFunction();
        if (!vibrate) return;

        const patterns = {
            light: [40],
            medium: [80],
            strong: [150]
        };

        const pattern = patterns[intensity] || patterns.medium;
        vibrate(pattern);
    },

    /**
     * UI interaction - light feedback for buttons
     * Used for menu navigation, settings changes
     */
    select() {
        if (!this.isSupported()) return;
        const vibrate = this.getVibrationFunction();
        if (vibrate) vibrate([20]);
    },

    /**
     * Stop any ongoing vibration
     */
    stop() {
        if (!this.isSupported()) return;
        const vibrate = this.getVibrationFunction();
        if (vibrate) vibrate(0);
    },

    /**
     * Custom vibration pattern
     * @param {number|number[]} pattern - Single duration or array of durations
     */
    custom(pattern) {
        if (!this.isSupported()) return;
        const vibrate = this.getVibrationFunction();
        if (vibrate) vibrate(pattern);
    }
};

export default haptics;
