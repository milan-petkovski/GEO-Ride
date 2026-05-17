import { state } from './state.js';
import { closeAllPanels } from './ui.js';
import { haptics } from './haptics.js';

let kbdElements = null;

export function initControls() {
    kbdElements = document.querySelectorAll('kbd');
    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (e.ctrlKey || e.metaKey) return;

        const drivingKeys = ['w', 'a', 's', 'd', ' ', 'r', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', 'escape'];
        if (!drivingKeys.includes(key)) return;

        if (key === 'escape') { closeAllPanels(); return; }
        if (key === 'shift') state.keys['shift'] = true;
        if (key === 'tab') { e.preventDefault(); return; }

        if (state.isInputFocused) return;

        closeAllPanels();
        document.body.classList.add('hide-cursor');

        state.keys[key] = true;
        updateKbdHUD(key, true);
    });

    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        state.keys[key] = false;
        if (key === 'shift') state.keys['shift'] = false;

        if (!state.loopStarted) return;
        if (key === 's' || key === 'arrowdown') state.sKeyReleasedSinceStop = true;
        if (key === 'w' || key === 'arrowup') state.wKeyReleasedSinceStop = true;

        updateKbdHUD(key, false);
    });

    window.addEventListener('blur', () => {
        state.keys = {};
        document.querySelectorAll('kbd').forEach(k => k.classList.remove('pressed'));
        state.velocity *= 0.8;
    });

    window.addEventListener('mousedown', (e) => {
        if (!state.isInputFocused) {
            document.body.classList.add('hide-cursor');
        }
        if (e.button === 0 && !state.isInputFocused) {
            if (e.target.closest('.ui-container') || e.target.closest('.settings-panel') || e.target.closest('.mp-dropdown')) {
                document.body.classList.remove('hide-cursor');
                return;
            }
            state.isDragging = true;
            state.lastMouseX = e.clientX;
            state.lastMouseY = e.clientY;
        }
    });

    window.addEventListener('mouseup', () => {
        state.isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
        const dx = Math.abs(e.clientX - (state.lastMouseX || 0));
        const dy = Math.abs(e.clientY - (state.lastMouseY || 0));

        if (!state.isDragging && (dx > 5 || dy > 5)) {
            document.body.classList.remove('hide-cursor');
        }

        if (state.isDragging) {
            document.body.classList.add('hide-cursor');
            const moveX = e.clientX - state.lastMouseX;
            const moveY = e.clientY - state.lastMouseY;
            state.mouseRotation += moveX * 0.5;
            state.currentPitch = Math.max(5, Math.min(80, state.currentPitch - moveY * 0.5));
            state.lastMouseX = e.clientX;
            state.lastMouseY = e.clientY;
            state.lastCameraManualMove = Date.now();
        }
    });

    // Initialize premium mobile touch controls
    initTouchControls();

    // Initialize orientation change handler
    initOrientationHandler();
}

function initTouchControls() {
    const btnGas = document.getElementById('touch-gas');
    const btnBrake = document.getElementById('touch-brake');
    const btnDrift = document.getElementById('touch-drift');
    const btnReset = document.getElementById('touch-reset');
    const headerReset = document.getElementById('header-reset-btn');

    const setupTouchBtn = (btn, key, alternativeKey = null) => {
        if (!btn) return;

        const handleStart = (e) => {
            e.preventDefault();
            e.stopPropagation();
            btn.classList.add('active');
            state.keys[key] = true;
            if (alternativeKey) state.keys[alternativeKey] = true;
            updateKbdHUD(key, true);

            // Haptic feedback for different actions
            if (key === 'w' || key === 'arrowup') {
                haptics.accelerate();
            } else if (key === 's' || key === 'arrowdown') {
                haptics.brake();
            } else if (key === ' ') {
                haptics.drift();
            } else if (key === 'r') {
                haptics.success();
            } else {
                haptics.tap();
            }
        };

        const handleEnd = (e) => {
            e.preventDefault();
            e.stopPropagation();
            btn.classList.remove('active');
            state.keys[key] = false;
            if (alternativeKey) state.keys[alternativeKey] = false;

            // Release hooks for stopped states
            if (!state.loopStarted) return;
            if (key === 's') state.sKeyReleasedSinceStop = true;
            if (key === 'w') state.wKeyReleasedSinceStop = true;

            updateKbdHUD(key, false);
        };

        btn.addEventListener('touchstart', handleStart, { passive: false });
        btn.addEventListener('touchend', handleEnd, { passive: false });
        btn.addEventListener('touchcancel', handleEnd, { passive: false });
    };

    setupTouchBtn(btnGas, 'w', 'arrowup');
    setupTouchBtn(btnBrake, 's', 'arrowdown');
    setupTouchBtn(btnDrift, ' ');
    setupTouchBtn(btnReset, 'r');
    setupTouchBtn(headerReset, 'r');

    // Drag-to-look touch rotation for mobile device map interactions
    window.addEventListener('touchstart', (e) => {
        if (state.isInputFocused) return;

        // Skip touch dragging if we touched any UI or touch button
        if (e.target.closest('.touch-btn') || e.target.closest('.ui-container') || e.target.closest('.settings-panel') || e.target.closest('.mp-dropdown')) {
            return;
        }

        if (e.touches.length === 1) {
            state.isDragging = true;
            const touch = e.touches[0];
            state.lastMouseX = touch.clientX;
            state.lastMouseY = touch.clientY;
        }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (state.isDragging && e.touches.length === 1) {
            const touch = e.touches[0];
            const moveX = touch.clientX - state.lastMouseX;
            const moveY = touch.clientY - state.lastMouseY;

            state.mouseRotation += moveX * 0.5;
            state.currentPitch = Math.max(5, Math.min(80, state.currentPitch - moveY * 0.5));
            state.lastMouseX = touch.clientX;
            state.lastMouseY = touch.clientY;
            state.lastCameraManualMove = Date.now();
        }
    }, { passive: true });

    window.addEventListener('touchend', () => {
        state.isDragging = false;
    }, { passive: true });

    // Gyroscope/Accelerometer Sensor Permission Request on User Gesture
    let tiltPermissionRequested = false;
    const requestTiltPermission = () => {
        if (tiltPermissionRequested) return;

        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        tiltPermissionRequested = true;
                        window.addEventListener('deviceorientation', handleDeviceOrientation);
                    }
                })
                .catch(err => console.warn('Gyroscope permission error:', err));
        } else {
            tiltPermissionRequested = true;
            window.addEventListener('deviceorientation', handleDeviceOrientation);
        }
    };

    document.body.addEventListener('touchstart', requestTiltPermission, { once: true });
    document.body.addEventListener('click', requestTiltPermission, { once: true });

    // Expose dynamic toggle state updater
    window.applyControlsMode = () => {
        const touchContainer = document.getElementById('touch-controls');
        if (!touchContainer) return;

        // Touch controls are strictly hidden on PC/desktop viewports (> 1024px)
        const isMobileOrTablet = window.innerWidth <= 1024;

        if (state.controlsMode === 'off' || !isMobileOrTablet) {
            touchContainer.style.setProperty('display', 'none', 'important');
        } else {
            touchContainer.style.setProperty('display', 'flex', 'important');
        }
    };

    // Apply saved mode immediately and bind to resize event
    window.applyControlsMode();
    window.addEventListener('resize', window.applyControlsMode);
}

function handleDeviceOrientation(e) {
    if (state.isInputFocused || state.controlsMode !== 'tilt') {
        state.keys.a = false;
        state.keys.arrowleft = false;
        state.keys.d = false;
        state.keys.arrowright = false;
        return;
    }

    let tilt = 0;
    const isLandscape = window.innerHeight < window.innerWidth;

    if (isLandscape) {
        tilt = e.beta;
        if (window.orientation === -90) {
            tilt = -tilt;
        }
    } else {
        tilt = e.gamma;
    }

    // High fidelity deadzone and sensitivity
    const deadzone = 5;

    if (Math.abs(tilt) > deadzone) {
        if (tilt < 0) {
            state.keys.a = true;
            state.keys.arrowleft = true;
            state.keys.d = false;
            state.keys.arrowright = false;
        } else {
            state.keys.d = true;
            state.keys.arrowright = true;
            state.keys.a = false;
            state.keys.arrowleft = false;
        }
    } else {
        state.keys.a = false;
        state.keys.arrowleft = false;
        state.keys.d = false;
        state.keys.arrowright = false;
    }
}


function updateKbdHUD(key, pressed) {
    if (!kbdElements) return;
    if (state.isTeleporting) {
        kbdElements.forEach(k => k.classList.remove('pressed'));
        return;
    }
    let searchKey = key === ' ' ? 'space' : key;
    if (key === 'arrowup') searchKey = 'w';
    if (key === 'arrowdown') searchKey = 's';
    if (key === 'arrowleft') searchKey = 'a';
    if (key === 'arrowright') searchKey = 'd';

    kbdElements.forEach(k => {
        if (k.textContent.trim().toLowerCase() === searchKey) {
            if (pressed) k.classList.add('pressed');
            else k.classList.remove('pressed');
        }
    });
}

/**
 * Handle device orientation changes (portrait/landscape)
 * Reorients UI and touch controls appropriately
 */
function initOrientationHandler() {
    // Handle initial orientation
    updateOrientationLayout();

    // Listen for orientation changes
    window.addEventListener('orientationchange', () => {
        // Give browser time to measure new dimensions
        setTimeout(updateOrientationLayout, 100);
    });

    // Also listen for resize events (covers window resizing on desktop and orientation changes)
    window.addEventListener('resize', updateOrientationLayout);
}

function updateOrientationLayout() {
    const isLandscape = window.innerHeight < window.innerWidth;
    const isMobile = window.innerWidth <= 1024;
    const isTablet = window.innerWidth > 768 && window.innerWidth <= 1024;

    // Update HTML data attributes for CSS media queries
    document.documentElement.setAttribute('data-orientation', isLandscape ? 'landscape' : 'portrait');
    document.documentElement.setAttribute('data-device-type', isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop');

    // Adjust UI layout based on orientation
    if (isMobile) {
        // Mobile/Tablet specific layout adjustments
        const uiContainer = document.querySelector('.ui-container');
        const centerControls = document.querySelector('.center-controls');
        const touchControls = document.getElementById('touch-controls');
        const speedContainer = document.querySelector('.speed-container');

        if (uiContainer) {
            if (isLandscape) {
                // Landscape: reduce padding for more space
                uiContainer.style.padding = '0.8rem 1rem 0.8rem 1rem';
            } else {
                // Portrait: normal padding
                uiContainer.style.padding = '1.2rem';
            }
        }

        // Ensure touch controls are visible if enabled
        if (touchControls && state.controlsMode !== 'off') {
            touchControls.style.display = 'flex';
        }

        // Adjust speedometer position for landscape
        if (speedContainer) {
            if (isLandscape) {
                speedContainer.style.bottom = '10px';
            } else {
                speedContainer.style.bottom = '25px';
            }
        }

        // Close any open panels on orientation change if not typing
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            closeAllPanels();
        }
    }

    // Trigger layout recalculation
    window.dispatchEvent(new CustomEvent('orientationUpdated', {
        detail: { isLandscape, isMobile, isTablet }
    }));
}
