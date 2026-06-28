import { state, saveState } from './state.js';
import { VEHICLE_CONFIG, INITIAL_CENTER } from './config.js';
import { setup3DVehicleLayer, setupVehicleMarker } from './three-manager.js';
import { trackEvent } from './analytics.js';
import { haptics } from './haptics.js';
import { initMultiplayer } from './multiplayer.js';

let activeMap = null;
let isManualPresetMenuOpen = false;

function syncMapInteractions(map) {
    if (!map) return;
    const settingsPanel = document.getElementById('settings-panel');
    const isSettingsOpen = settingsPanel?.classList.contains('active');

    if (isSettingsOpen) {
        map.dragPan?.disable();
        map.scrollZoom?.disable();
        map.doubleClickZoom?.disable();
        map.touchZoomRotate?.disable();
        map.keyboard?.disable();
    } else {
        map.dragPan?.enable();
        map.scrollZoom?.enable();
        map.doubleClickZoom?.enable();
        map.touchZoomRotate?.enable();
        map.keyboard?.enable();
    }
}

export function initUI(map) {
    activeMap = map;
    isManualPresetMenuOpen = state.lightPreset !== 'realtime';



    const settingsBtn = document.getElementById('settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const mpBtn = document.getElementById('mp-btn');
    const mpDropdown = document.getElementById('mp-dropdown');
    const searchBox = document.querySelector('.search-box');
    const searchInput = document.getElementById('location-search');
    const searchBtn = document.getElementById('search-btn');

    // Prevent map interactions while panels are open, BUT let inputs work normally
    const mapPanels = [settingsPanel, mpDropdown];
    mapPanels.forEach(panel => {
        if (!panel) return;
        ['wheel', 'touchstart', 'touchmove', 'touchend', 'pointerdown', 'click', 'dblclick'].forEach(evtType => {
            panel.addEventListener(evtType, (e) => e.stopPropagation(), { passive: false });
        });
    });

    settingsBtn.onclick = (e) => {
        if (settingsPanel && settingsPanel.contains(e.target)) return;
        
        e.preventDefault();
        e.stopPropagation();
        if (mpDropdown) mpDropdown.classList.remove('active');
        if (searchBox) searchBox.classList.remove('expanded');
        settingsPanel.classList.toggle('active');
        syncMapInteractions(map);
        if (haptics) haptics.tap();
        try {
            if (typeof initMultiplayer === 'function') initMultiplayer();
        } catch (err) {
            console.error(err);
        }
    };

    // Settings close button (X)
    const settingsCloseBtn = document.getElementById('settings-close-btn');
    if (settingsCloseBtn) {
        const closeSettings = (e) => {
            e.preventDefault();
            e.stopPropagation();
            settingsPanel.classList.remove('active');
            syncMapInteractions(map);
            if (haptics) haptics.tap();
        };

        settingsCloseBtn.addEventListener('click', closeSettings);
        settingsCloseBtn.addEventListener('touchstart', closeSettings, { passive: false });
    }

    document.addEventListener('click', (e) => {
        if (window.innerWidth > 1024) {
            if (settingsPanel?.classList.contains('active') && !settingsPanel.contains(e.target) && e.target !== settingsBtn && !settingsBtn.contains(e.target)) {
                settingsPanel.classList.remove('active');
                syncMapInteractions(map);
            }
        }

        if (mpDropdown?.classList.contains('active') && !mpDropdown.contains(e.target) && e.target !== mpBtn && !mpBtn.contains(e.target)) {
            mpDropdown.classList.remove('active');
        }

        if (searchBox?.classList.contains('expanded') && !searchBox.contains(e.target)) {
            searchBox.classList.remove('expanded');
        }
    });

    // Toggle Handlers
    document.querySelectorAll('.style-toggle button').forEach(btn => {
        btn.onclick = () => {
            state.mapStyle = btn.dataset.style;
            if (state.mapStyle === 'standard') {
                state.is3DBuildings = true;
                state.collisionsEnabled = false; // Standard map has no building collisions
                isManualPresetMenuOpen = state.lightPreset !== 'realtime';
            } else if (state.mapStyle === 'satellite-v9') {
                state.is3DBuildings = false;
                state.collisionsEnabled = false;
            } else {
                // Restore from user preferences
                state.is3DBuildings = state.userPrefs.is3DBuildings;
                state.collisionsEnabled = state.userPrefs.collisionsEnabled;
            }
            map.setStyle(`mapbox://styles/mapbox/${state.mapStyle}`);
            updateToggleStates();
            saveState();
            trackEvent('change_map_style', { style: state.mapStyle });
            haptics.select();
        };
    });

    document.querySelectorAll('.light-toggle button').forEach(btn => {
        btn.onclick = () => {
            if (btn.id === 'btn-manual-trigger') {
                isManualPresetMenuOpen = true;
            } else if (btn.id === 'btn-realtime') {
                state.lightPreset = 'realtime';
                isManualPresetMenuOpen = false;
            } else {
                state.lightPreset = btn.dataset.preset;
            }
            applyLightPreset(map);
            updateToggleStates();
            saveState();
            trackEvent('change_light_preset', { preset: state.lightPreset });
            haptics.select();
        };
    });

    const btnLightBack = document.getElementById('btn-light-back');
    if (btnLightBack) {
        btnLightBack.onclick = () => {
            isManualPresetMenuOpen = false;
            updateToggleStates();
            haptics.select();
        };
    }

    document.querySelectorAll('.unit-toggle button').forEach(btn => {
        btn.onclick = () => {
            state.unit = btn.dataset.unit;
            updateToggleStates();
            saveState();
            trackEvent('change_units', { unit: state.unit });
            haptics.select();
        };
    });

    document.querySelectorAll('.vehicle-toggle button').forEach(btn => {
        btn.onclick = () => {
            state.activeVehicle = btn.dataset.vehicle;
            if (state.activeVehicle === 'god') {
                state.godMode = true;
                state.collisionsEnabled = false;
                state.is3D = false;
                state.is3DBuildings = false;
            } else {
                state.godMode = false;
                state.is3D = state.userPrefs.is3D;
                if (state.mapStyle === 'satellite-v9') {
                    state.collisionsEnabled = false;
                    state.is3DBuildings = false;
                } else if (state.mapStyle === 'standard') {
                    state.collisionsEnabled = false;
                    state.is3DBuildings = true;
                } else {
                    state.collisionsEnabled = state.userPrefs.collisionsEnabled;
                    state.is3DBuildings = state.userPrefs.is3DBuildings;
                }
            }
            setup3DVehicleLayer(map);
            setupVehicleMarker(map);
            updateToggleStates();
            saveState();
            trackEvent('select_vehicle', { vehicle: state.activeVehicle });
            haptics.success();
        };
    });

    document.querySelectorAll('.d3v-toggle button').forEach(btn => {
        btn.onclick = () => {
            if (state.activeVehicle === 'god') return;
            state.is3D = btn.dataset.d3v === 'on';
            state.userPrefs.is3D = state.is3D; // Save to user preferences
            setup3DVehicleLayer(map);
            setupVehicleMarker(map);
            updateToggleStates();
            saveState();
            haptics.select();
        };
    });

    document.querySelectorAll('.d3b-toggle button').forEach(btn => {
        btn.onclick = () => {
            if (state.activeVehicle === 'god' || state.mapStyle === 'standard' || state.mapStyle === 'satellite-v9') return;
            state.is3DBuildings = btn.dataset.d3b === 'on';
            state.collisionsEnabled = state.is3DBuildings;
            // Record to user preferences
            state.userPrefs.is3DBuildings = state.is3DBuildings;
            state.userPrefs.collisionsEnabled = state.collisionsEnabled;
            add3DBuildings(map);
            updateToggleStates();
            saveState();
            haptics.select();
        };
    });

    document.querySelectorAll('.collision-toggle button').forEach(btn => {
        btn.onclick = () => {
            if (state.activeVehicle === 'god') return;
            state.collisionsEnabled = btn.dataset.collision === 'on';
            state.userPrefs.collisionsEnabled = state.collisionsEnabled; // Save to user preferences
            updateToggleStates();
            saveState();
            haptics.select();
        };
    });

    document.querySelectorAll('.god-toggle button').forEach(btn => {
        btn.onclick = () => {
            state.godMode = btn.dataset.god === 'on';
            if (state.godMode) {
                state.activeVehicle = 'god';
                state.collisionsEnabled = false;
                state.is3D = false;
                state.is3DBuildings = false;
            } else {
                state.activeVehicle = 'car';
                if (state.mapStyle === 'satellite-v9') {
                    state.collisionsEnabled = false;
                    state.is3D = true;
                    state.is3DBuildings = false;
                } else if (state.mapStyle === 'standard') {
                    state.collisionsEnabled = false;
                    state.is3D = true;
                    state.is3DBuildings = true;
                } else {
                    state.collisionsEnabled = true;
                    state.is3D = true;
                    state.is3DBuildings = true;
                }
            }
            setup3DVehicleLayer(map);
            setupVehicleMarker(map);
            updateToggleStates();
            saveState();
            haptics.select();
            trackEvent('toggle_god_mode', { enabled: state.godMode });
        };
    });

    // Mobile controls toggle click handler
    document.querySelectorAll('.controls-toggle button').forEach(btn => {
        btn.onclick = () => {
            state.controlsMode = btn.dataset.controls;
            updateToggleStates();
            saveState();
            if (typeof window.applyControlsMode === 'function') {
                window.applyControlsMode();
            }
            trackEvent('change_controls_mode', { mode: state.controlsMode });
        };
    });

    // Volume Slider Handler
    const volumeSlider = document.getElementById('master-volume');
    if (volumeSlider) {
        // Initialize slider visually once
        volumeSlider.value = state.masterVolume !== undefined ? state.masterVolume : 0.5;
        
        volumeSlider.addEventListener('input', (e) => {
            state.masterVolume = parseFloat(e.target.value);
            updateToggleStates();
            saveState();
        });
    }

    // Search logic
    async function performSearch(inputField) {
        if (!inputField) return;
        const query = inputField.value; if (!query) return;
        try {
            const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}`);
            const data = await response.json();
            if (data.features && data.features.length > 0) {
                const [lng, lat] = data.features[0].center;
                // START TELEPORT ANIMATION (STARO.js style)
                if (state.isTeleporting) return;
                state.velocity = 0;
                state.isTeleporting = true;
                state.isCameraAnimating = true;
                state.teleportStartTime = Date.now();
                state.teleportDuration = 3500;
                state.teleportStart = [state.lng, state.lat];
                state.teleportEnd = [lng, lat];
                setup3DVehicleLayer(map);

                // Auto-close settings dashboard on mobile or desktop if open
                settingsPanel.classList.remove('active');

                // Give it a moment to animate the shrinking/ball expansion at the start
                setTimeout(() => {
                    state.currentHome = [lng, lat];
                    const targetZoom = Math.max(map.getZoom(), 17);

                    map.flyTo({
                        center: [lng, lat],
                        zoom: targetZoom,
                        pitch: state.currentPitch,
                        essential: true,
                        duration: state.teleportDuration
                    });

                    map.once('moveend', () => {
                        state.isCameraAnimating = false;
                        state.isTeleporting = false;
                        setup3DVehicleLayer(map);
                        saveState();
                        trackEvent('teleport_complete', { location: query });
                    });
                }, 600); // 600ms delay to see the vehicle shrink and ball grow
                trackEvent('search_location', { query: query });
                inputField.value = ''; inputField.blur(); searchBox.classList.remove('expanded');
                state.isInputFocused = false;
            }
        } catch (err) { console.error("Search error:", err); }
    }

    // Search Interaction (Desktop)
    searchBox.onclick = (e) => {
        e.stopPropagation();
        if (!searchBox.classList.contains('expanded')) {
            if (settingsPanel) settingsPanel.classList.remove('active');
            if (mpDropdown) mpDropdown.classList.remove('active');
            searchBox.classList.add('expanded');
            setTimeout(() => searchInput.focus(), 50);
            state.isInputFocused = true;
            haptics.tap();
        }
    };

    searchBtn.onclick = (e) => {
        if (searchBox.classList.contains('expanded')) {
            e.stopPropagation();
            performSearch(searchInput);
            haptics.success();
        }
    };

    searchInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
            performSearch(searchInput);
        }
    };

    // Search Interaction (Mobile Settings Dashboard)
    const mobileSearchInput = document.getElementById('mobile-location-search');
    const mobileSearchBtn = document.getElementById('mobile-search-btn');
    if (mobileSearchBtn && mobileSearchInput) {
        mobileSearchBtn.onclick = (e) => {
            e.stopPropagation();
            performSearch(mobileSearchInput);
            haptics.success();
        };
        mobileSearchInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                performSearch(mobileSearchInput);
                haptics.success();
            }
        };
    }

    window.addEventListener('click', (e) => {
        if (!searchBox.contains(e.target)) {
            searchInput.blur();
            state.isInputFocused = false;
            searchBox.classList.remove('expanded');
        }
    });

    // Font Loading Logic
    if (document.fonts) {
        document.fonts.ready.then(() => {
            document.querySelector('.loading-content')?.classList.add('fonts-ready');
        });
    } else {
        // Fallback
        setTimeout(() => {
            document.querySelector('.loading-content')?.classList.add('fonts-ready');
        }, 500);
    }
    // Add tracking to external links
    document.querySelector('.coffee-btn')?.addEventListener('click', () => {
        trackEvent('click_coffee_btn');
        haptics.tap();
    });

    document.querySelector('.author-link')?.addEventListener('click', () => {
        trackEvent('click_author_link');
        haptics.tap();
    });

    document.getElementById('join-mp-btn')?.addEventListener('click', () => {
        const peerId = document.getElementById('join-peer-id')?.value;
        trackEvent('multiplayer_join_attempt', { peer_id_length: peerId?.length });
        haptics.success();
    });

    // Donation Popup Event Listeners
    const donationPopup = document.getElementById('donation-popup');
    const closeDonationBtn = document.getElementById('donation-close-btn');
    const donatePaypalBtn = document.getElementById('donation-paypal-btn');

    if (donationPopup && closeDonationBtn) {
        closeDonationBtn.addEventListener('click', () => {
            donationPopup.classList.remove('show');
            if (haptics) haptics.tap();
        });
    }
    if (donatePaypalBtn) {
        donatePaypalBtn.addEventListener('click', () => {
            donationPopup.classList.remove('show');
            localStorage.setItem('geo-ride-donation-dismissed', 'true');
            if (haptics) haptics.success();
        });
    }
}


export function closeAllPanels() {
    document.getElementById('settings-panel')?.classList.remove('active');
    document.getElementById('mp-dropdown')?.classList.remove('active');
    document.querySelector('.search-box')?.classList.remove('expanded');
    state.isInputFocused = false;
    document.getElementById('location-search')?.blur();
    syncMapInteractions(activeMap);
}

export function updateToggleStates() {
    const unitLabel = document.getElementById('unit-label');
    const isGodVehicle = state.activeVehicle === 'god';
    const isStandard = state.mapStyle === 'standard';

    // Show/hide God Mode vehicle button in the vehicle-toggle group
    const vehicleGodBtn = document.getElementById('vehicle-god-btn');
    if (vehicleGodBtn) {
        if (state.godMode || isGodVehicle) {
            vehicleGodBtn.style.display = 'block';
        } else {
            vehicleGodBtn.style.display = 'none';
        }
    }

    // Show/hide COLLISIONS settings section on WOW map or Satellite map
    const collisionSettingsSection = document.getElementById('collision-settings-section');
    if (collisionSettingsSection) {
        if (isStandard || state.mapStyle === 'satellite-v9') {
            collisionSettingsSection.style.display = 'none';
        } else {
            collisionSettingsSection.style.display = 'flex';
        }
    }

    document.querySelectorAll('.collision-toggle button, .d3v-toggle button, .d3b-toggle button').forEach(b => {
        b.classList.remove('active');
        b.classList.remove('disabled-btn');

        if (isGodVehicle) {
            if (b.dataset.collision === 'off' || b.dataset.d3v === 'off' || b.dataset.d3b === 'off') b.classList.add('active');
            if (b.dataset.collision === 'on' || b.dataset.d3v === 'on' || b.dataset.d3b === 'on') b.classList.add('disabled-btn');
        } else if (isStandard && b.dataset.d3b) {
            // For standard style, 3D buildings are always ON and cannot be toggled
            if (b.dataset.d3b === 'on') b.classList.add('active');
            if (b.dataset.d3b === 'off') b.classList.add('disabled-btn');
        } else if (state.mapStyle === 'satellite-v9' && b.dataset.d3b) {
            // For satellite style, 3D buildings are always OFF and cannot be toggled
            if (b.dataset.d3b === 'off') b.classList.add('active');
            if (b.dataset.d3b === 'on') b.classList.add('disabled-btn');
        } else {
            if (b.dataset.collision === 'on' && state.collisionsEnabled) b.classList.add('active');
            if (b.dataset.collision === 'off' && !state.collisionsEnabled) b.classList.add('active');
            if (b.dataset.d3v === 'on' && state.is3D) b.classList.add('active');
            if (b.dataset.d3v === 'off' && !state.is3D) b.classList.add('active');
            if (b.dataset.d3b === 'on' && state.is3DBuildings) b.classList.add('active');
            if (b.dataset.d3b === 'off' && !state.is3DBuildings) b.classList.add('active');
        }
    });

    document.querySelectorAll('.vehicle-toggle button').forEach(b => b.classList.toggle('active', b.dataset.vehicle === state.activeVehicle));
    document.querySelectorAll('.unit-toggle button').forEach(b => b.classList.toggle('active', b.dataset.unit === state.unit));
    document.querySelectorAll('.god-toggle button').forEach(b => b.classList.toggle('active', b.dataset.god === (state.godMode ? 'on' : 'off')));
    if (unitLabel) unitLabel.textContent = state.unit === 'km' ? 'KM/H' : 'MPH';
    document.querySelectorAll('.style-toggle button').forEach(b => b.classList.toggle('active', b.dataset.style === state.mapStyle));
    document.querySelectorAll('.controls-toggle button').forEach(b => b.classList.toggle('active', b.dataset.controls === state.controlsMode));

    // Dynamic display of standard lighting preset section
    const lightPresetSection = document.getElementById('light-preset-section');
    if (lightPresetSection) {
        lightPresetSection.style.display = state.mapStyle === 'standard' ? 'flex' : 'none';
    }

    // Toggle lighting group views & back button
    const lightMainGroup = document.getElementById('light-main-group');
    const lightManualGroup = document.getElementById('light-manual-group');
    if (lightMainGroup && lightManualGroup) {
        if (isManualPresetMenuOpen) {
            lightMainGroup.style.display = 'none';
            lightManualGroup.style.display = 'flex';
        } else {
            lightMainGroup.style.display = 'flex';
            lightManualGroup.style.display = 'none';
        }
    }

    // Toggle active state of light preset buttons
    document.querySelectorAll('.light-toggle button').forEach(b => {
        if (b.id === 'btn-realtime') {
            b.classList.toggle('active', state.lightPreset === 'realtime');
        } else if (b.id === 'btn-manual-trigger') {
            b.classList.toggle('active', state.lightPreset !== 'realtime');
        } else {
            b.classList.toggle('active', b.dataset.preset === state.lightPreset);
        }
    });

    // Update Volume Slider Label visually
    const volumeSliderUI = document.getElementById('master-volume');
    const volumeLabelUI = document.getElementById('volume-label');
    if (volumeSliderUI && volumeLabelUI) {
        volumeSliderUI.value = state.masterVolume !== undefined ? state.masterVolume : 0.5;
        volumeLabelUI.textContent = Math.round(volumeSliderUI.value * 100) + '%';
        if (volumeSliderUI.value <= 0) volumeLabelUI.textContent = 'MUTED';
    }
}

export function add3DBuildings(map) {
    if (!state.is3DBuildings || state.mapStyle === 'standard') {
        if (map.getLayer('3d-buildings')) map.removeLayer('3d-buildings');
        return;
    }
    if (!map.getLayer('3d-buildings')) {
        map.addLayer({
            'id': '3d-buildings',
            'source': 'composite',
            'source-layer': 'building',
            'filter': ['==', 'extrude', 'true'],
            'type': 'fill-extrusion',
            'minzoom': 15,
            'paint': {
                'fill-extrusion-color': '#222',
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': ['get', 'min_height'],
                'fill-extrusion-opacity': 0.8
            }
        });
    }
}

export function getRealTimePreset() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 7) {
        return 'dawn';
    } else if (hour >= 7 && hour < 18) {
        return 'day';
    } else if (hour >= 18 && hour < 20) {
        return 'dusk';
    } else {
        return 'night';
    }
}

export function applyLightPreset(map) {
    if (!map || state.mapStyle !== 'standard') return;
    let targetPreset = state.lightPreset;
    if (targetPreset === 'realtime') {
        targetPreset = getRealTimePreset();
    }
    try {
        map.setConfigProperty('basemap', 'lightPreset', targetPreset);
    } catch (e) {
        console.warn("Could not set lightPreset:", e);
    }
}

export function triggerDonationPopup() {
    const isDismissed = localStorage.getItem('geo-ride-donation-dismissed');
    if (isDismissed === 'true') return;

    const donationPopup = document.getElementById('donation-popup');
    if (donationPopup) {
        donationPopup.classList.add('show');
        
        // Auto-hide popup after 20 seconds of inactivity (so it doesn't stay permanently)
        setTimeout(() => {
            donationPopup.classList.remove('show');
        }, 20000);
    }
}

