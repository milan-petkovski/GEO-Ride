/**
 * @file ui.js
 * @description HUD UI manager for GEO Ride, controlling settings panels, vehicle selector tabs, map styles, speedometer display, and user interaction synchronization.
 */

import { state, saveState, setProStatus } from './state.js';
import { setup3DVehicleLayer, setupVehicleMarker } from './three-manager.js';
import { trackEvent } from './analytics.js';
import { haptics } from './haptics.js';
import { initMultiplayer } from './multiplayer.js';
import { checkProStatusByEmail, fetchGeoRidePlans } from './supabase-georide.js';

let activeMap = null;
let isManualPresetMenuOpen = false;

export const FAMOUS_SPOTS = [
    {
        id: 'tokyo',
        name: 'Tokyo Shuto Expressway',
        country: 'Japan',
        desc: 'Futuristic highway above Tokyo Bay with illuminated skyscrapers and high-speed bends.',
        coords: [139.7563, 35.6329],
        bearing: 160
    },
    {
        id: 'nurburgring',
        name: 'Nürburgring Nordschleife',
        country: 'Germany',
        desc: 'The Green Hell: world-famous legendary race track through dense forests and elevations.',
        coords: [6.9475, 50.3341],
        bearing: 45
    },
    {
        id: 'stelvio',
        name: 'Stelvio Pass',
        country: 'Italy',
        desc: 'Dramatic Alpine switchbacks and climbing hairpins at 2,757m altitude.',
        coords: [10.4533, 46.5286],
        bearing: 110
    },
    {
        id: 'monaco',
        name: 'Monaco GP Circuit',
        country: 'Monaco',
        desc: 'Tight harbor streets, famous Casino hairpin, and seaside Formula 1 tunnel.',
        coords: [7.4206, 43.7347],
        bearing: 210
    },
    {
        id: 'mulholland',
        name: 'Mulholland Drive',
        country: 'Los Angeles, USA',
        desc: 'Legendary scenic ridge highway overlooking the dazzling lights of Hollywood.',
        coords: [-118.4485, 34.1278],
        bearing: 90
    },
    {
        id: 'paris',
        name: 'Arc de Triomphe',
        country: 'Paris, France',
        desc: 'The ultimate giant 12-lane chaotic roundabout leading directly down the Champs-Élysées.',
        coords: [2.295, 48.8738],
        bearing: 135
    },
    {
        id: 'belgrade',
        name: 'Belgrade Waterfront',
        country: 'Serbia',
        desc: 'Home base: Modern riverside boulevards and wide urban curves along the Sava.',
        coords: [20.449425, 44.809684],
        bearing: 107
    }
];

export function teleportToCoordinates(lng, lat, locationName = 'Custom Location', targetBearing = 107) {
    if (!activeMap || state.isTeleporting) return;
    state.velocity = 0;
    state.isTeleporting = true;
    state.isCameraAnimating = true;
    state.teleportStartTime = Date.now();
    state.teleportDuration = 3200;
    state.teleportStart = [state.lng, state.lat];
    state.teleportEnd = [lng, lat];
    setup3DVehicleLayer(activeMap);

    const settingsPanel = document.getElementById('settings-panel');
    if (settingsPanel) settingsPanel.classList.remove('active');
    const spotsModal = document.getElementById('spots-modal-backdrop');
    if (spotsModal) spotsModal.classList.remove('active');

    setTimeout(() => {
        state.lng = lng;
        state.lat = lat;
        state.bearing = targetBearing;
        state.travelBearing = targetBearing;
        state.currentHome = [lng, lat];
        const targetZoom = Math.max(activeMap.getZoom(), 17.5);

        activeMap.flyTo({
            center: [lng, lat],
            zoom: targetZoom,
            pitch: state.cameraMode === 'hood' ? 78 : state.cameraMode === 'wide' ? 52 : 65,
            bearing: targetBearing,
            essential: true,
            duration: state.teleportDuration
        });

        activeMap.once('moveend', () => {
            state.isCameraAnimating = false;
            state.isTeleporting = false;
            setup3DVehicleLayer(activeMap);
            saveState();
            showToast('ARRIVED AT SPOT', locationName);
            trackEvent('teleport_spot', { location: locationName });
        });
    }, 500);
}

export function updateDriftHUD() {
    if (typeof document === 'undefined') return;
    const driftHud = document.getElementById('drift-hud');
    const driftPointsEl = document.getElementById('drift-points');
    const driftMultiEl = document.getElementById('drift-multiplier');
    if (!driftHud || !driftPointsEl) return;

    if (state.isDrifting && state.currentDriftPoints > 3) {
        driftHud.classList.add('active');
        driftPointsEl.textContent = '+' + state.currentDriftPoints.toLocaleString();
        if (driftMultiEl) {
            driftMultiEl.textContent = 'x' + (state.driftMultiplier || 1);
            driftMultiEl.className = 'drift-multiplier-pill mult-' + (state.driftMultiplier || 1);
        }
    } else if (!state.isDrifting) {
        driftHud.classList.remove('active');
    }
}

let lastSpeedTrapAlertTime = 0;
let lastSpeedTrapAlertKmh = 120;
export function checkSpeedTrap(speedKmh) {
    const now = Date.now();
    if (speedKmh < 120 || now - lastSpeedTrapAlertTime < 45000) return;
    if (speedKmh >= lastSpeedTrapAlertKmh + 25) {
        lastSpeedTrapAlertKmh = Math.floor(speedKmh / 10) * 10;
        lastSpeedTrapAlertTime = now;
        showToast('SPEED RADAR', `Top speed logged: ${speedKmh} KM/H!`, { isPro: true, duration: 4000 });
        if (haptics) haptics.impact('medium');
    }
}

if (typeof window !== 'undefined') {
    window.onDriftComplete = (banked, multiplier) => {
        import('./audio.js').then(({ playDriftBankSound }) => playDriftBankSound(state.masterVolume));
        showToast('DRIFT BANKED!', `+${banked.toLocaleString()} PTS (x${multiplier})`, { isPro: true });
        const totalScoreEl = document.getElementById('total-drift-score');
        if (totalScoreEl) totalScoreEl.textContent = (state.driftScore || 0).toLocaleString();
    };
}

/**
 * Synchronizes map panning/zooming interactions based on active HUD panel states.
 * @param {Object} map - Mapbox GL JS map instance.
 * @returns {void}
 */
function syncMapInteractions(map) {
    if (!map) return;
    const settingsPanel = document.getElementById('settings-panel');
    const proModal = document.getElementById('pro-modal-backdrop');
    const spotsModal = document.getElementById('spots-modal-backdrop');
    const isSettingsOpen = settingsPanel?.classList.contains('active');
    const isProModalOpen = proModal?.classList.contains('active');
    const isSpotsOpen = spotsModal?.classList.contains('active');

    if (isSettingsOpen || isProModalOpen || isSpotsOpen) {
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

    // Prevent map interactions while panels/modals are open, BUT let inputs work normally
    const mapPanels = [settingsPanel, mpDropdown, document.querySelector('.pro-modal')];
    mapPanels.forEach((panel) => {
        if (!panel) return;
        [
            'wheel',
            'touchstart',
            'touchmove',
            'touchend',
            'pointerdown',
            'click',
            'dblclick',
            'keydown',
            'keyup',
            'keypress',
            'mousedown'
        ].forEach((evtType) => {
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
            if (
                settingsPanel?.classList.contains('active') &&
                !settingsPanel.contains(e.target) &&
                e.target !== settingsBtn &&
                !settingsBtn.contains(e.target)
            ) {
                settingsPanel.classList.remove('active');
                syncMapInteractions(map);
            }
        }

        if (
            mpDropdown?.classList.contains('active') &&
            !mpDropdown.contains(e.target) &&
            e.target !== mpBtn &&
            !mpBtn.contains(e.target)
        ) {
            mpDropdown.classList.remove('active');
        }

        if (searchBox?.classList.contains('expanded') && !searchBox.contains(e.target)) {
            searchBox.classList.remove('expanded');
        }
    });

    const dismissPortraitBtn = document.getElementById('dismiss-portrait-hint');
    if (dismissPortraitBtn) {
        dismissPortraitBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('portrait-orientation-hint')?.classList.add('dismissed');
        };
    }

    // Toggle Handlers
    document.querySelectorAll('.style-toggle button').forEach((btn) => {
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

    document.querySelectorAll('.light-toggle button').forEach((btn) => {
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

    document.querySelectorAll('.unit-toggle button').forEach((btn) => {
        btn.onclick = () => {
            state.unit = btn.dataset.unit;
            updateToggleStates();
            saveState();
            trackEvent('change_units', { unit: state.unit });
            haptics.select();
        };
    });

    document.querySelectorAll('.vehicle-toggle button').forEach((btn) => {
        btn.onclick = () => {
            const requestedVehicle = btn.dataset.vehicle;
            if (requestedVehicle === 'god' && !state.isPro) {
                openProModal();
                showToast(
                    'PRO VEHICLE LOCKED',
                    'God Mode is exclusive to GEO Ride Pro subscribers. Upgrade now to fly at unlimited speed!',
                    {
                        isPro: true,
                        actionText: 'Upgrade',
                        onAction: openProModal
                    }
                );
                if (haptics) haptics.tap();
                return;
            }

            state.activeVehicle = requestedVehicle;
            if (state.activeVehicle === 'god') {
                state.godMode = true;
                state.collisionsEnabled = false;
                state.is3D = false;
                state.is3DBuildings = false;
                showToast('GOD MODE ACTIVATED', 'Flying with unlimited speed & zero collisions!', { isPro: true });
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

    document.querySelectorAll('.d3v-toggle button').forEach((btn) => {
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

    document.querySelectorAll('.d3b-toggle button').forEach((btn) => {
        btn.onclick = () => {
            if (state.activeVehicle === 'god' || state.mapStyle === 'standard' || state.mapStyle === 'satellite-v9')
                return;
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

    document.querySelectorAll('.collision-toggle button').forEach((btn) => {
        btn.onclick = () => {
            if (state.activeVehicle === 'god') return;
            state.collisionsEnabled = btn.dataset.collision === 'on';
            state.userPrefs.collisionsEnabled = state.collisionsEnabled; // Save to user preferences
            updateToggleStates();
            saveState();
            haptics.select();
        };
    });

    document.querySelectorAll('.god-toggle button').forEach((btn) => {
        btn.onclick = () => {
            const requestedGod = btn.dataset.god === 'on';
            if (requestedGod && !state.isPro) {
                openProModal();
                showToast(
                    'PRO FEATURE LOCKED',
                    'God Mode requires GEO Ride Pro. Upgrade now to fly with unlimited speed!',
                    {
                        isPro: true,
                        actionText: 'Upgrade',
                        onAction: openProModal
                    }
                );
                if (haptics) haptics.tap();
                return;
            }

            state.godMode = requestedGod;
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
    document.querySelectorAll('.controls-toggle button').forEach((btn) => {
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

    // In-memory location search cache to prevent redundant Mapbox Geocoding API calls
    const locationSearchCache = new Map();

    // Search logic
    async function performSearch(inputField) {
        if (!inputField) return;
        const query = (inputField.value || '').trim();
        if (query.length < 2) return;
        try {
            const cacheKey = query.toLowerCase();
            let coords = locationSearchCache.get(cacheKey);

            if (!coords) {
                const response = await fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?types=place,locality,address,poi&limit=3&access_token=${mapboxgl.accessToken}`
                );
                const data = await response.json();
                if (data.features && data.features.length > 0) {
                    coords = data.features[0].center;
                    locationSearchCache.set(cacheKey, coords);
                }
            }

            if (coords && Array.isArray(coords) && coords.length >= 2) {
                const [lng, lat] = coords;
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
                if (settingsPanel) settingsPanel.classList.remove('active');

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
                inputField.value = '';
                inputField.blur();
                searchBox.classList.remove('expanded');
                state.isInputFocused = false;
            }
        } catch (err) {
            console.error('Search error:', err);
        }
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

    // Pro Modal Event Listeners
    const proOpenBtn = document.getElementById('pro-open-btn');
    const proModalClose = document.getElementById('pro-modal-close');
    const proModalBackdrop = document.getElementById('pro-modal-backdrop');

    if (proOpenBtn) {
        proOpenBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openProModal();
            if (haptics) haptics.tap();
        });
    }

    if (proModalClose) {
        proModalClose.addEventListener('click', () => {
            closeProModal();
            if (haptics) haptics.tap();
        });
    }

    if (proModalBackdrop) {
        proModalBackdrop.addEventListener('click', (e) => {
            if (e.target === proModalBackdrop) {
                closeProModal();
            }
        });
    }

    document.getElementById('pro-modal-monthly-btn')?.addEventListener('click', () => {
        trackEvent('pro_checkout_click', { plan: 'monthly', price: 4.99 });
        if (haptics) haptics.success();
    });

    document.getElementById('pro-modal-yearly-btn')?.addEventListener('click', () => {
        trackEvent('pro_checkout_click', { plan: 'yearly', price: 2.99 });
        if (haptics) haptics.success();
    });

    // Famous Spots Modal Listeners
    const spotsBtn = document.getElementById('spots-btn');
    const spotsBackdrop = document.getElementById('spots-modal-backdrop');
    const spotsClose = document.getElementById('spots-modal-close');

    if (spotsBtn && spotsBackdrop) {
        spotsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            spotsBackdrop.classList.add('active');
            syncMapInteractions(map);
            if (haptics) haptics.tap();
        });
    }

    if (spotsClose && spotsBackdrop) {
        spotsClose.addEventListener('click', () => {
            spotsBackdrop.classList.remove('active');
            syncMapInteractions(map);
            if (haptics) haptics.tap();
        });
    }

    if (spotsBackdrop) {
        spotsBackdrop.addEventListener('click', (e) => {
            if (e.target === spotsBackdrop) {
                spotsBackdrop.classList.remove('active');
                syncMapInteractions(map);
            }
        });

        // Wire spot cards
        if (typeof spotsBackdrop.querySelectorAll === 'function') {
            spotsBackdrop.querySelectorAll('.spot-card').forEach((card) => {
                if (typeof card.addEventListener === 'function') {
                    card.addEventListener('click', () => {
                        const spotId = card.getAttribute?.('data-spot-id');
                        const spot = FAMOUS_SPOTS.find((s) => s.id === spotId);
                        if (spot) {
                            teleportToCoordinates(spot.coords[0], spot.coords[1], spot.name, spot.bearing);
                            if (haptics) haptics.success();
                        }
                    });
                }
            });
        }
    }

    // Camera Mode Toggle Button Listener
    const cameraToggleBtn = document.getElementById('camera-toggle-btn');
    if (cameraToggleBtn) {
        cameraToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            import('./controls.js').then(({ cycleCameraMode }) => cycleCameraMode());
        });
    }

    // Radio HUD Widget Listeners
    const radioPlayBtn = document.getElementById('radio-play-btn');
    const radioNextBtn = document.getElementById('radio-next-btn');
    if (radioPlayBtn) {
        radioPlayBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            import('./audio.js').then(({ toggleRadio }) => toggleRadio());
            if (haptics) haptics.tap();
        });
    }
    if (radioNextBtn) {
        radioNextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            import('./audio.js').then(({ nextRadioStation }) => nextRadioStation());
            if (haptics) haptics.select();
        });
    }

    if (typeof window !== 'undefined') {
        window.onRadioStateUpdate = (radioState) => {
            const pill = document.getElementById('radio-widget');
            const titleEl = document.getElementById('radio-station-title');
            const playIcon = document.getElementById('radio-play-icon');
            if (pill) {
                if (radioState.isActive) pill.classList.add('playing');
                else pill.classList.remove('playing');
            }
            if (titleEl && radioState.station) {
                titleEl.textContent = radioState.station.name;
            }
            if (playIcon) {
                playIcon.innerHTML = radioState.isActive
                    ? `<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>`
                    : `<polygon points="5 3 19 12 5 21 5 3"></polygon>`;
            }
        };
    }

    // Pro Activation key handler
    const proKeyInput = document.getElementById('pro-key-input');
    const proActivateBtn = document.getElementById('pro-activate-btn');
    const proStatusEl = document.getElementById('pro-activation-status');

    const showActivationStatus = (msg, type = 'info') => {
        if (!proStatusEl) return;
        proStatusEl.style.display = 'flex';
        let color = '#00f2ff';
        let icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;

        if (type === 'success') {
            color = '#22c55e';
            icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        } else if (type === 'error') {
            color = '#ef4444';
            icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
        } else if (type === 'loading') {
            color = '#c470f0';
            icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;animation:spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>`;
        }

        proStatusEl.style.color = color;
        proStatusEl.innerHTML = `${icon} <span>${msg}</span>`;
    };

    if (proActivateBtn && proKeyInput) {
        const handleActivation = async () => {
            const val = proKeyInput.value.trim().toLowerCase();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!val || !emailRegex.test(val)) {
                showActivationStatus('Please enter a valid order email address.', 'error');
                showToast('EMAIL REQUIRED', 'Please enter the email address used during purchase.');
                return;
            }

            // Supabase verification via Milan Web Portal
            proActivateBtn.disabled = true;
            const originalText = proActivateBtn.textContent;
            proActivateBtn.textContent = 'CHECKING...';
            showActivationStatus('Checking subscription status in database...', 'loading');

            try {
                const res = await checkProStatusByEmail(val);
                if (res && res.is_pro) {
                    setProStatus(true);
                    updateToggleStates();
                    localStorage.setItem('geo_ride_pro_email', val);
                    const planTitle = res.plan_name || 'GEO Ride Pro';
                    showActivationStatus(`Active Plan Found: ${planTitle}! Activated.`, 'success');
                    showToast('PRO VERIFIED!', `Active plan: ${planTitle}. God Mode unlocked!`, { isPro: true });
                    trackEvent('pro_activated_manually', { method: 'supabase', plan: res.plan_id });
                    if (haptics) haptics.success();
                    setTimeout(() => closeProModal(), 1400);
                } else {
                    showActivationStatus('No active Pro plan found for this email address.', 'error');
                    showToast(
                        'NO ACTIVE PLAN',
                        'No active subscription found for this email. Check your receipt or choose a plan below.'
                    );
                }
            } catch (err) {
                console.error('Pro activation error:', err);
                showActivationStatus('Connection error. Could not verify subscription.', 'error');
                showToast('VERIFICATION ERROR', 'Could not reach server to verify email. Please try again.');
            } finally {
                proActivateBtn.disabled = false;
                proActivateBtn.textContent = originalText;
            }
        };

        proActivateBtn.addEventListener('click', handleActivation);
        proKeyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleActivation();
        });
    }

    // Start periodic smart game notifications
    initGameNotifications();
}

export function closeAllPanels() {
    document.getElementById('settings-panel')?.classList.remove('active');
    document.getElementById('mp-dropdown')?.classList.remove('active');
    document.querySelector('.search-box')?.classList.remove('expanded');
    closeProModal();
    state.isInputFocused = false;
    document.getElementById('location-search')?.blur();
    syncMapInteractions(activeMap);
}

export function updateToggleStates() {
    if (typeof document === 'undefined') return;
    const unitLabel = document.getElementById('unit-label');

    const isGodVehicle = state.activeVehicle === 'god';
    const isStandard = state.mapStyle === 'standard';

    // Show/hide and style God Mode vehicle button in the vehicle-toggle group
    const vehicleGodBtn = document.getElementById('vehicle-god-btn');
    if (vehicleGodBtn) {
        vehicleGodBtn.style.display = 'inline-flex';
        const badge =
            typeof vehicleGodBtn.querySelector === 'function' ? vehicleGodBtn.querySelector('.pro-badge-pill') : null;
        if (badge) {
            badge.style.display = state.isPro ? 'none' : 'inline-flex';
        }
    }

    // Reflect Pro HUD status via CSS class + structured inner HTML
    const proOpenBtn = document.getElementById('pro-open-btn');
    if (proOpenBtn) {
        if (state.isPro) {
            proOpenBtn.classList?.add('is-active');
            proOpenBtn.title = 'GEO Ride Pro Active';
            proOpenBtn.setAttribute?.('aria-label', 'GEO Ride Pro Active');
            proOpenBtn.innerHTML = `
                <span class="pro-btn-shimmer"></span>
                <span class="pro-btn-inner">
                    <svg class="pro-crown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M2 20h20M5 20L3 8l5 4 4-7 4 7 5-4-2 12z"></path>
                    </svg>
                    <span class="pro-btn-label">ACTIVE</span>
                </span>
            `;
        } else {
            proOpenBtn.classList?.remove('is-active');
            proOpenBtn.title = 'Unlock GEO Ride Pro';
            proOpenBtn.setAttribute?.('aria-label', 'Unlock GEO Ride Pro');
            proOpenBtn.innerHTML = `
                <span class="pro-btn-shimmer"></span>
                <span class="pro-btn-inner">
                    <svg class="pro-crown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M2 20h20M5 20L3 8l5 4 4-7 4 7 5-4-2 12z"></path>
                    </svg>
                    <span class="pro-btn-label">PRO</span>
                </span>
            `;
        }
    }

    // Show/hide PRO badge on God Mode toggle in Settings
    const godOnBtn = document.getElementById('god-on-btn');
    if (godOnBtn) {
        const badge = typeof godOnBtn.querySelector === 'function' ? godOnBtn.querySelector('.pro-badge-pill') : null;
        if (badge) {
            badge.style.display = state.isPro ? 'none' : 'inline-flex';
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

    document.querySelectorAll('.collision-toggle button, .d3v-toggle button, .d3b-toggle button').forEach((b) => {
        b.classList.remove('active');
        b.classList.remove('disabled-btn');

        if (isGodVehicle) {
            if (b.dataset.collision === 'off' || b.dataset.d3v === 'off' || b.dataset.d3b === 'off')
                b.classList.add('active');
            if (b.dataset.collision === 'on' || b.dataset.d3v === 'on' || b.dataset.d3b === 'on')
                b.classList.add('disabled-btn');
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

    document
        .querySelectorAll('.vehicle-toggle button')
        .forEach((b) => b.classList.toggle('active', b.dataset.vehicle === state.activeVehicle));
    document
        .querySelectorAll('.unit-toggle button')
        .forEach((b) => b.classList.toggle('active', b.dataset.unit === state.unit));
    document
        .querySelectorAll('.god-toggle button')
        .forEach((b) => b.classList.toggle('active', b.dataset.god === (state.godMode ? 'on' : 'off')));
    if (unitLabel) unitLabel.textContent = state.unit === 'km' ? 'KM/H' : 'MPH';
    document
        .querySelectorAll('.style-toggle button')
        .forEach((b) => b.classList.toggle('active', b.dataset.style === state.mapStyle));
    document
        .querySelectorAll('.controls-toggle button')
        .forEach((b) => b.classList.toggle('active', b.dataset.controls === state.controlsMode));

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
    document.querySelectorAll('.light-toggle button').forEach((b) => {
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
            id: '3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            filter: ['==', 'extrude', 'true'],
            type: 'fill-extrusion',
            minzoom: 15,
            paint: {
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
        console.warn('Could not set lightPreset:', e);
    }
}

export function triggerDonationPopup() {
    if (typeof document === 'undefined') return;
    const isDismissed =
        typeof localStorage !== 'undefined' ? localStorage.getItem('geo-ride-donation-dismissed') : null;
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

export function openProModal() {
    if (typeof document === 'undefined') return;
    const backdrop = document.getElementById('pro-modal-backdrop');
    if (backdrop) {
        backdrop.classList.add('active');
        state.isInputFocused = true;
        if (document.body && document.body.classList) {
            document.body.classList.remove('hide-cursor');
        }
        syncMapInteractions(activeMap);
        const proKeyInput = document.getElementById('pro-key-input');
        const proStatusEl = document.getElementById('pro-activation-status');
        if (proStatusEl) {
            if (state.isPro) {
                const savedEmail = localStorage.getItem('geo_ride_pro_email');
                proStatusEl.style.display = 'flex';
                proStatusEl.style.color = '#22c55e';
                proStatusEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>Pro Subscription Active${savedEmail ? ` (${savedEmail})` : ''}</span>`;
            } else {
                proStatusEl.style.display = 'none';
                proStatusEl.innerHTML = '';
            }
        }
        if (proKeyInput && typeof proKeyInput.focus === 'function') {
            setTimeout(() => proKeyInput.focus(), 120);
        }

        // Dynamically fetch and sync latest plans & checkout URLs from Supabase
        fetchGeoRidePlans()
            .then((plans) => {
                if (!plans || !Array.isArray(plans)) return;
                const monthlyPlan = plans.find((p) => p.plan_id === 'pro_monthly');
                const yearlyPlan = plans.find((p) => p.plan_id === 'pro_yearly');

                const monthlyBtn = document.getElementById('pro-modal-monthly-btn');
                if (monthlyBtn && monthlyPlan) {
                    if (monthlyPlan.checkout_url) monthlyBtn.href = monthlyPlan.checkout_url;
                    const priceEl = monthlyBtn.querySelector('.pro-plan-price');
                    if (priceEl && monthlyPlan.price_usd) {
                        priceEl.innerHTML = `$${monthlyPlan.price_usd.toFixed(2)} <span>/ mo</span>`;
                    }
                }

                const yearlyBtn = document.getElementById('pro-modal-yearly-btn');
                if (yearlyBtn && yearlyPlan) {
                    if (yearlyPlan.checkout_url) yearlyBtn.href = yearlyPlan.checkout_url;
                    const priceEl = yearlyBtn.querySelector('.pro-plan-price');
                    if (priceEl && yearlyPlan.price_usd) {
                        priceEl.innerHTML = `$${yearlyPlan.price_usd.toFixed(2)} <span>/ mo</span>`;
                    }
                }
            })
            .catch(() => {});

        trackEvent('pro_modal_open', { source: 'game_hud' });
    }
}

export function closeProModal() {
    if (typeof document === 'undefined') return;
    const backdrop = document.getElementById('pro-modal-backdrop');
    if (backdrop) {
        backdrop.classList.remove('active');
        const proKeyInput = document.getElementById('pro-key-input');
        if (proKeyInput && document.activeElement === proKeyInput) {
            proKeyInput.blur();
        }
        state.isInputFocused = false;
        state.keys = {};
        syncMapInteractions(activeMap);
    }
}

export function showToast(title, message, options = {}) {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-msg${options.isPro ? ' toast-pro' : ''}`;
    toast.innerHTML = `
        <div class="toast-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="${options.isPro ? '#c470f0' : '#00f2ff'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;">
                ${
                    options.isPro
                        ? '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>'
                        : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>'
                }
            </svg>
        </div>
        <div class="toast-body">
            <div class="toast-title">${title}</div>
            <div class="toast-text">${message}</div>
            ${options.actionText ? `<button class="toast-action-btn">${options.actionText}</button>` : ''}
        </div>
        <button class="toast-close-btn" aria-label="Close">&times;</button>
    `;

    const closeBtn = typeof toast.querySelector === 'function' ? toast.querySelector('.toast-close-btn') : null;
    const dismiss = () => {
        toast.classList?.add('hide');
        setTimeout(() => toast.remove?.(), 350);
    };
    if (closeBtn) closeBtn.onclick = dismiss;

    if (options.actionText && options.onAction && typeof toast.querySelector === 'function') {
        const actionBtn = toast.querySelector('.toast-action-btn');
        if (actionBtn) {
            actionBtn.onclick = () => {
                options.onAction();
                dismiss();
            };
        }
    }

    if (typeof container.appendChild === 'function') {
        container.appendChild(toast);
    }

    const duration = options.duration || 6500;
    const toastTimer = setTimeout(() => {
        if (toast.parentElement) dismiss();
    }, duration);
    if (toastTimer && typeof toastTimer.unref === 'function') toastTimer.unref();
}

let notificationsInitialized = false;
export function initGameNotifications() {
    if (notificationsInitialized || typeof window === 'undefined') return;
    notificationsInitialized = true;

    // 1. Welcome Toast after 3.5 seconds
    const t1 = setTimeout(() => {
        showToast('WELCOME TO GEO RIDE', 'Type any address or city in Search to teleport anywhere on Earth!');
    }, 3500);
    if (t1 && typeof t1.unref === 'function') t1.unref();

    // 2. Pro Upgrade prompt after 65 seconds
    const t2 = setTimeout(() => {
        showToast('UNLOCK GEO RIDE PRO', 'Get God Mode ghost vehicle with zero speed limits and private rooms!', {
            isPro: true,
            actionText: 'Upgrade',
            onAction: openProModal
        });
    }, 65000);
    if (t2 && typeof t2.unref === 'function') t2.unref();

    // 3. Rotating periodic tips every 140 seconds
    const tips = [
        {
            title: 'MULTIPLAYER READY',
            msg: 'Share your player code with friends to cruise together in real-time!',
            options: {}
        },
        {
            title: '4 MAP STYLES',
            msg: 'Switch between Satellite, Hybrid, 3D Buildings and 2D Streets in Settings.',
            options: {}
        },
        {
            title: 'GEO RIDE PRO',
            msg: 'Support development and unlock exclusive Pro multiplayer rooms and God Mode!',
            options: { isPro: true, actionText: 'See Pro', onAction: openProModal }
        },
        {
            title: 'DRIFT & BURNOUT',
            msg: 'Hold Spacebar to charge launch control or drift around corners above 35 km/h!',
            options: {}
        }
    ];

    let tipIndex = 0;
    const tipsInterval = setInterval(() => {
        const tip = tips[tipIndex % tips.length];
        showToast(tip.title, tip.msg, tip.options);
        tipIndex++;
    }, 140000);
    if (tipsInterval && typeof tipsInterval.unref === 'function') {
        tipsInterval.unref();
    }
}
