/**
 * Haptics Module - Vibration Feedback API
 * Provides haptic feedback for various game actions
 * Supports both Vibration API and fallbacks for different browsers
 */

export const haptics = {
  /**
   * Check if device supports haptic feedback
   */
  isSupported() {
    return !!(
      navigator.vibrate ||
      navigator.mozVibrate ||
      navigator.webkitVibrate ||
      navigator.msVibrate
    );
  },

  /**
   * Get vibration function based on browser support
   */
  getVibrationFunction() {
    if (navigator.vibrate) return navigator.vibrate.bind(navigator);
    if (navigator.mozVibrate) return navigator.mozVibrate.bind(navigator);
    if (navigator.webkitVibrate) return navigator.webkitVibrate.bind(navigator);
    if (navigator.msVibrate) return navigator.msVibrate.bind(navigator);
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
