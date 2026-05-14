import { state, saveState } from './state.js';
import { VEHICLE_CONFIG, INITIAL_CENTER } from './config.js';
import { setup3DVehicleLayer, setupVehicleMarker } from './three-manager.js';
import { trackEvent } from './analytics.js';


export function initUI(map) {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const mpBtn = document.getElementById('mp-btn');
    const mpDropdown = document.getElementById('mp-dropdown');
    const searchBox = document.querySelector('.search-box');
    const searchInput = document.getElementById('location-search');
    const searchBtn = document.getElementById('search-btn');

    settingsBtn.onclick = (e) => {
        e.stopPropagation();
        mpDropdown?.classList.remove('active');
        searchBox?.classList.remove('expanded');
        settingsPanel.classList.toggle('active');
    };

    document.onclick = (e) => {
        if (!settingsPanel.contains(e.target) && e.target !== settingsBtn &&
            !mpDropdown.contains(e.target) && e.target !== mpBtn &&
            !searchBox.contains(e.target)) {
            closeAllPanels();
        }
    };

    // Toggle Handlers
    document.querySelectorAll('.style-toggle button').forEach(btn => {
        btn.onclick = () => {
            state.mapStyle = btn.dataset.style;
            map.setStyle(`mapbox://styles/mapbox/${state.mapStyle}`);
            updateToggleStates();
            saveState();
            trackEvent('change_map_style', { style: state.mapStyle });
        };
    });

    document.querySelectorAll('.unit-toggle button').forEach(btn => {
        btn.onclick = () => {
            state.unit = btn.dataset.unit;
            updateToggleStates();
            saveState();
            trackEvent('change_units', { unit: state.unit });
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
        };
    });

    document.querySelectorAll('.d3b-toggle button').forEach(btn => {
        btn.onclick = () => {
            state.is3DBuildings = btn.dataset.d3b === 'on';
            state.collisionsEnabled = state.is3DBuildings;
            add3DBuildings(map);
            updateToggleStates();
            saveState();
        };
    });

    document.querySelectorAll('.collision-toggle button').forEach(btn => {
        btn.onclick = () => {
            if (state.activeVehicle === 'god' && btn.dataset.collision === 'on') return;
            state.collisionsEnabled = btn.dataset.collision === 'on';
            updateToggleStates();
            saveState();
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
            trackEvent('toggle_god_mode', { enabled: state.godMode });
        };
    });

    // Search logic
    async function performSearch() {
        const query = searchInput.value; if (!query) return;
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
                searchInput.value = ''; searchInput.blur(); searchBox.classList.remove('expanded');
            }
        } catch (err) { console.error("Search error:", err); }
    }

    // Search Interaction
    searchBox.onclick = (e) => {
        e.stopPropagation();
        if (!searchBox.classList.contains('expanded')) {
            searchBox.classList.add('expanded');
            setTimeout(() => searchInput.focus(), 50);
            state.isInputFocused = true;
        }
    };

    searchBtn.onclick = (e) => {
        if (searchBox.classList.contains('expanded')) {
            e.stopPropagation();
            performSearch();
        }
    };

    searchInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    };

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
    });

    document.querySelector('.author-link')?.addEventListener('click', () => {
        trackEvent('click_author_link');
    });

    document.getElementById('join-mp-btn')?.addEventListener('click', () => {
        const peerId = document.getElementById('join-peer-id')?.value;
        trackEvent('multiplayer_join_attempt', { peer_id_length: peerId?.length });
    });
}


export function closeAllPanels() {
    document.getElementById('settings-panel')?.classList.remove('active');
    document.getElementById('mp-dropdown')?.classList.remove('active');
    document.querySelector('.search-box')?.classList.remove('expanded');
    state.isInputFocused = false;
    document.getElementById('location-search')?.blur();
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
}

export function add3DBuildings(map) {
    if (!state.is3DBuildings) {
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

