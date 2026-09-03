/**
 * @file controls.js
 * @description Input handler for GEO Ride, managing keyboard bindings, touch/tilt controls, mouse orbit dragging, and UI visual key feedback.
 */

import { state } from './state.js';
import { closeAllPanels } from './ui.js';
import { haptics } from './haptics.js';
import { triggerVehicleReset } from './physics.js';

let kbdElements = null;

/**
 * Initializes keyboard, mouse, and touch event listeners for vehicle control and camera navigation.
 * @returns {void}
 */
export function initControls() {
    kbdElements = document.querySelectorAll('kbd');
    window.addEventListener('keydown', (e) => {
        // Prevent default Spacebar behavior (scrolling / clicking focused buttons) unless typing in input
        if (e.code === 'Space' && document.activeElement && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            if (document.activeElement.tagName === 'BUTTON') {
                document.activeElement.blur(); // Remove focus from the button
            }
        }

        const key = e.key.toLowerCase();
        if (e.ctrlKey || e.metaKey) return;

        // Track shift state unconditionally whenever any key is pressed with Shift
        if (e.shiftKey || key === 'shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
            state.keys['shift'] = true;
        }

        const drivingKeys = [
            'w',
            'a',
            's',
            'd',
            ' ',
            'r',
            'arrowup',
            'arrowdown',
            'arrowleft',
            'arrowright',
            'shift',
            'escape',
            'tab'
        ];

        // Also check by physical code to prevent keyboard layout or multi-key conflicts
        let mappedKey = key;
        if (e.code === 'KeyW' || e.code === 'ArrowUp') mappedKey = 'w';
        else if (e.code === 'KeyA' || e.code === 'ArrowLeft') mappedKey = 'a';
        else if (e.code === 'KeyS' || e.code === 'ArrowDown') mappedKey = 's';
        else if (e.code === 'KeyD' || e.code === 'ArrowRight') mappedKey = 'd';
        else if (e.code === 'KeyR') mappedKey = 'r';
        else if (e.code === 'Space') mappedKey = ' ';
        else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') mappedKey = 'shift';

        if (!drivingKeys.includes(mappedKey) && !drivingKeys.includes(key)) return;

        if (key === 'escape' || mappedKey === 'escape') {
            closeAllPanels();
            return;
        }

        const isProModalOpen = document.getElementById('pro-modal-backdrop')?.classList.contains('active');
        if (
            isProModalOpen ||
            state.isInputFocused ||
            document.activeElement?.tagName === 'INPUT' ||
            document.activeElement?.tagName === 'TEXTAREA'
        ) {
            return;
        }

        if (key === 'tab') {
            e.preventDefault();
            return;
        }

        if (mappedKey === 'r') {
            const isShiftReset = !!(e.shiftKey || state.keys['shift'] || state.keys['Shift']);
            if (typeof window !== 'undefined' && window.map) {
                triggerVehicleReset(isShiftReset, window.map);
            }
        }

        // Close panels without calling .blur() (which triggers window.blur and clears state.keys)
        document.getElementById('settings-panel')?.classList.remove('active');
        document.getElementById('mp-dropdown')?.classList.remove('active');
        document.querySelector('.search-box')?.classList.remove('expanded');
        document.body.classList.add('hide-cursor');

        state.keys[mappedKey] = true;
        state.keys[key] = true;
        state.physicalKeysActive = true;
        updateKbdHUD(mappedKey, true);
    });

    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        let mappedKey = key;
        if (e.code === 'KeyW' || e.code === 'ArrowUp') mappedKey = 'w';
        else if (e.code === 'KeyA' || e.code === 'ArrowLeft') mappedKey = 'a';
        else if (e.code === 'KeyS' || e.code === 'ArrowDown') mappedKey = 's';
        else if (e.code === 'KeyD' || e.code === 'ArrowRight') mappedKey = 'd';
        else if (e.code === 'KeyR') mappedKey = 'r';
        else if (e.code === 'Space') mappedKey = ' ';
        else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') mappedKey = 'shift';

        state.keys[mappedKey] = false;
        state.keys[key] = false;
        if (mappedKey === 'shift' || key === 'shift') state.keys['shift'] = false;

        const drivingKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright', ' '];
        const anyActive = drivingKeys.some((k) => !!state.keys[k]);
        if (!anyActive) {
            state.physicalKeysActive = false;
        }

        if (!state.loopStarted) return;
        if (key === 's' || key === 'arrowdown') state.sKeyReleasedSinceStop = true;
        if (key === 'w' || key === 'arrowup') state.wKeyReleasedSinceStop = true;

        updateKbdHUD(key, false);
    });

    window.addEventListener('blur', () => {
        state.keys = {};
        state.physicalKeysActive = false;
        document.querySelectorAll('kbd').forEach((k) => k.classList.remove('pressed'));
        state.velocity *= 0.8;
    });

    window.addEventListener('mousedown', (e) => {
        if (!state.isInputFocused) {
            document.body.classList.add('hide-cursor');
        }
        if (e.button === 0 && !state.isInputFocused) {
            if (
                e.target.closest('.ui-container') ||
                e.target.closest('.settings-panel') ||
                e.target.closest('.mp-dropdown')
            ) {
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

    const handleResetAction = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (headerReset) headerReset.classList.add('active');
        if (btnReset) btnReset.classList.add('active');
        setTimeout(() => {
            if (headerReset) headerReset.classList.remove('active');
            if (btnReset) btnReset.classList.remove('active');
        }, 300);
        haptics.success();
        const mapInstance = typeof window !== 'undefined' && window.map ? window.map : null;
        if (mapInstance) {
            triggerVehicleReset(false, mapInstance);
        }
    };

    if (headerReset) {
        headerReset.addEventListener('click', handleResetAction);
        headerReset.addEventListener(
            'touchend',
            (e) => {
                e.preventDefault();
                handleResetAction(e);
            },
            { passive: false }
        );
    }
    if (btnReset) {
        btnReset.addEventListener('click', handleResetAction);
        btnReset.addEventListener(
            'touchend',
            (e) => {
                e.preventDefault();
                handleResetAction(e);
            },
            { passive: false }
        );
    }

    setupTouchBtn(btnGas, 'w', 'arrowup');
    setupTouchBtn(btnBrake, 's', 'arrowdown');
    setupTouchBtn(btnDrift, ' ');

    // Drag-to-look touch rotation for mobile device map interactions
    window.addEventListener(
        'touchstart',
        (e) => {
            if (state.isInputFocused) return;

            // Skip touch dragging if we touched any UI or touch button
            if (
                e.target.closest('.touch-btn') ||
                e.target.closest('.ui-container') ||
                e.target.closest('.settings-panel') ||
                e.target.closest('.mp-dropdown')
            ) {
                return;
            }

            if (e.touches.length === 1) {
                state.isDragging = true;
                const touch = e.touches[0];
                state.lastMouseX = touch.clientX;
                state.lastMouseY = touch.clientY;
            }
        },
        { passive: true }
    );

    window.addEventListener(
        'touchmove',
        (e) => {
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
        },
        { passive: true }
    );

    window.addEventListener(
        'touchend',
        () => {
            state.isDragging = false;
        },
        { passive: true }
    );

    // Gyroscope/Accelerometer Sensor Permission Request on User Gesture
    let tiltPermissionRequested = false;
    const requestTiltPermission = () => {
        if (tiltPermissionRequested) return;

        if (
            typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function'
        ) {
            DeviceOrientationEvent.requestPermission()
                .then((permissionState) => {
                    if (permissionState === 'granted') {
                        tiltPermissionRequested = true;
                        window.addEventListener('deviceorientation', handleDeviceOrientation);
                    }
                })
                .catch((err) => console.warn('Gyroscope permission error:', err));
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
    if (state.isInputFocused || state.controlsMode !== 'tilt') return;
    // Strictly disable tilt on desktop devices or when physical keyboard is being used
    if (window.innerWidth > 1024 || state.physicalKeysActive) return;

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
        if (!state.physicalKeysActive) {
            state.keys.a = false;
            state.keys.arrowleft = false;
            state.keys.d = false;
            state.keys.arrowright = false;
        }
    }
}

function updateKbdHUD(key, pressed) {
    if (!kbdElements) return;
    if (state.isTeleporting) {
        kbdElements.forEach((k) => k.classList.remove('pressed'));
        return;
    }
    let searchKey = key === ' ' ? 'space' : key;
    if (key === 'arrowup') searchKey = 'w';
    if (key === 'arrowdown') searchKey = 's';
    if (key === 'arrowleft') searchKey = 'a';
    if (key === 'arrowright') searchKey = 'd';

    kbdElements.forEach((k) => {
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
    window.dispatchEvent(
        new CustomEvent('orientationUpdated', {
            detail: { isLandscape, isMobile, isTablet }
        })
    );
}

/**
 * Polls connected Gamepads (Xbox, PlayStation, standard USB/Bluetooth controllers)
 * and updates state.keys appropriately.
 */
export function pollGamepad() {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
    const gamepads = navigator.getGamepads();
    if (!gamepads) return;

    let activePad = null;
    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && gamepads[i].connected) {
            activePad = gamepads[i];
            break;
        }
    }
    if (!activePad) return;

    const deadzone = 0.15;
    // Left stick X axis or D-pad left/right
    const axisX = activePad.axes[0] || 0;
    const dpadLeft = activePad.buttons[14]?.pressed;
    const dpadRight = activePad.buttons[15]?.pressed;
    const dpadUp = activePad.buttons[12]?.pressed;
    const dpadDown = activePad.buttons[13]?.pressed;

    // Steer left
    if (axisX < -deadzone || dpadLeft) {
        state.keys['a'] = true;
        state.keys['arrowleft'] = true;
        state.keys['d'] = false;
        state.keys['arrowright'] = false;
        updateKbdHUD('a', true);
        updateKbdHUD('d', false);
    } else if (axisX > deadzone || dpadRight) {
        state.keys['d'] = true;
        state.keys['arrowright'] = true;
        state.keys['a'] = false;
        state.keys['arrowleft'] = false;
        updateKbdHUD('d', true);
        updateKbdHUD('a', false);
    } else if (!state.physicalKeysActive) {
        state.keys['a'] = false;
        state.keys['arrowleft'] = false;
        state.keys['d'] = false;
        state.keys['arrowright'] = false;
        updateKbdHUD('a', false);
        updateKbdHUD('d', false);
    }

    // RT (button 7) or A (button 0) for Gas
    const rtVal =
        typeof activePad.buttons[7]?.value === 'number'
            ? activePad.buttons[7].value
            : activePad.buttons[7]?.pressed
              ? 1
              : 0;
    const aBtn = activePad.buttons[0]?.pressed;
    const isGas = rtVal > 0.1 || aBtn || dpadUp;

    if (isGas) {
        state.keys['w'] = true;
        state.keys['arrowup'] = true;
        updateKbdHUD('w', true);
    } else if (!state.physicalKeysActive) {
        state.keys['w'] = false;
        state.keys['arrowup'] = false;
        updateKbdHUD('w', false);
    }

    // LT (button 6) or B (button 1) or X (button 2) for Brake / Reverse
    const ltVal =
        typeof activePad.buttons[6]?.value === 'number'
            ? activePad.buttons[6].value
            : activePad.buttons[6]?.pressed
              ? 1
              : 0;
    const bBtn = activePad.buttons[1]?.pressed || activePad.buttons[2]?.pressed;
    const isBrake = ltVal > 0.1 || bBtn || dpadDown;

    if (isBrake) {
        state.keys['s'] = true;
        state.keys['arrowdown'] = true;
        updateKbdHUD('s', true);
    } else if (!state.physicalKeysActive) {
        state.keys['s'] = false;
        state.keys['arrowdown'] = false;
        updateKbdHUD('s', false);
    }

    // RB (button 5) or Handbrake / Drift (button 3 / Y)
    const isDrift = activePad.buttons[5]?.pressed || activePad.buttons[3]?.pressed;
    if (isDrift) {
        state.keys[' '] = true;
        updateKbdHUD(' ', true);
    } else if (!state.physicalKeysActive) {
        state.keys[' '] = false;
        updateKbdHUD(' ', false);
    }

    // Reset button (button 8 / 9: select / start)
    if (activePad.buttons[8]?.pressed || activePad.buttons[9]?.pressed) {
        state.keys['r'] = true;
        updateKbdHUD('r', true);
    } else if (!state.physicalKeysActive) {
        state.keys['r'] = false;
        updateKbdHUD('r', false);
    }
}
