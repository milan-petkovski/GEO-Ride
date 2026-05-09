import { state } from './state.js';
import { closeAllPanels } from './ui.js';

let kbdElements = null;

export function initControls() {
    kbdElements = document.querySelectorAll('kbd');
    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (e.ctrlKey || e.metaKey) return;

        if (key === 'escape') { closeAllPanels(); return; }
        if (key === 'shift') state.keys['shift'] = true;
        if (key === 'tab') { e.preventDefault(); return; }

        if (state.isInputFocused) return;

        const drivingKeys = ['w', 'a', 's', 'd', ' ', 'r', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
        if (drivingKeys.includes(key)) {
            closeAllPanels();
            document.body.classList.add('hide-cursor');
        }

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
