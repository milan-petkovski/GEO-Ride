import { state, saveState } from './state.js';
import { VEHICLE_CONFIG, INITIAL_CENTER } from './config.js';
import { setup3DVehicleLayer, setupVehicleMarker } from './three-manager.js';
import { trackEvent } from './analytics.js';
import { haptics } from './haptics.js';
import { initMultiplayer } from './multiplayer.js';

let activeMap = null;

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
            map.setStyle(`mapbox://styles/mapbox/${state.mapStyle}`);
            updateToggleStates();
            saveState();
            trackEvent('change_map_style', { style: state.mapStyle });
            haptics.select();
        };
    });

    document.querySelectorAll('.light-toggle button').forEach(btn => {
        btn.onclick = () => {
            state.lightPreset = btn.dataset.preset;
            if (state.mapStyle === 'standard') {
                try {
                    map.setConfigProperty('basemap', 'lightPreset', state.lightPreset);
                } catch (e) {
                    console.warn("Could not set lightPreset:", e);
                }
            }
            updateToggleStates();
            saveState();
            trackEvent('change_light_preset', { preset: state.lightPreset });
            haptics.select();
        };
    });

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
                state.collisionsEnabled = false;
                state.is3D = false;
                state.is3DBuildings = false;
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
            if (state.activeVehicle === 'god' && btn.dataset.d3v === 'on') return;
            state.is3D = btn.dataset.d3v === 'on';
            setup3DVehicleLayer(map);
            setupVehicleMarker(map);
            updateToggleStates();
            saveState();
            haptics.select();
        };
    });

    document.querySelectorAll('.d3b-toggle button').forEach(btn => {
        btn.onclick = () => {
            state.is3DBuildings = btn.dataset.d3b === 'on';
            state.collisionsEnabled = state.is3DBuildings;
            add3DBuildings(map);
            updateToggleStates();
            saveState();
            haptics.select();
        };
    });

    document.querySelectorAll('.collision-toggle button').forEach(btn => {
        btn.onclick = () => {
            if (state.activeVehicle === 'god' && btn.dataset.collision === 'on') return;
            state.collisionsEnabled = btn.dataset.collision === 'on';
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
                state.collisionsEnabled = true;
                state.is3D = true;
                state.is3DBuildings = true;
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
            }
        } catch (err) { console.error("Search error:", err); }
    }

    // Search Interaction (Desktop)
    searchBox.onclick = (e) => {
        e.stopPropagation();
        if (!searchBox.classList.contains('expanded')) {
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

    document.querySelectorAll('.collision-toggle button, .d3v-toggle button, .d3b-toggle button').forEach(b => {
        b.classList.remove('active');
        b.classList.remove('disabled-btn');

        if (isGodVehicle) {
            if (b.dataset.collision === 'off' || b.dataset.d3v === 'off' || b.dataset.d3b === 'off') b.classList.add('active');
            if (b.dataset.collision === 'on' || b.dataset.d3v === 'on' || b.dataset.d3b === 'on') b.classList.add('disabled-btn');
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
    document.querySelectorAll('.light-toggle button').forEach(b => b.classList.toggle('active', b.dataset.preset === state.lightPreset));
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

