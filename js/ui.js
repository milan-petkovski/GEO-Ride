/**
 * @file ui.js
 * @description HUD UI manager for GEO Ride, controlling settings panels, vehicle selector tabs, map styles, speedometer display, and user interaction synchronization.
 */

import { state, saveState, loadState, setProStatus, subscribeState } from './state.js';
import {
    loadProgress,
    saveProgress,
    tick as progressTick,
    evaluate as evaluateProgress,
    getSnapshot as getProgressSnapshot,
    onProgressEvent,
    describeChallenge,
    trackDriftBank,
    trackSpot,
    trackPhoto
} from './progress.js';
import { submitProgress, cloudSync } from './leaderboard.js';
import { setup3DVehicleLayer, setupVehicleMarker, getThreeLayer } from './three-manager.js';
import { trackEvent } from './analytics.js';
import { haptics } from './haptics.js';
import { initMultiplayer } from './multiplayer.js';
import { checkProStatusByEmail, fetchGeoRidePlans } from './supabase-georide.js';
import { INITIAL_CENTER, VEHICLE_CONFIG } from './config.js';
import { setupTerrain } from './utils.js';
import {
    toggleRadio,
    nextRadioStation,
    setRadioStation,
    playDriftBankSound,
    playDriftFailSound,
    pauseAudioForPhoto,
    resumeAudioFromPhoto
} from './audio.js';
import { showDiscoveryCinematic } from './discovery.js';

let activeMap = null;
let isManualPresetMenuOpen = false;
let lastSettingsTab = null;

export const FAMOUS_SPOTS = [
    {
        id: 'tokyo',
        name: 'Tokyo Shuto Expressway (Tokyo Drift)',
        country: 'Japan',
        category: 'city',
        desc: 'Birthplace of midnight highway racing, Wangan battles, and iconic Tokyo Drift culture.',
        coords: [139.7563, 35.6329],
        bearing: 160
    },
    {
        id: 'monaco',
        name: 'Monaco GP Marina Circuit',
        country: 'Monaco',
        category: 'circuit',
        desc: 'The crown jewel of Formula 1: Casino Square, tight superyacht chicanes, and seaside tunnel.',
        coords: [7.4206, 43.7347],
        bearing: 210
    },
    {
        id: 'nurburgring',
        name: 'Nürburgring Nordschleife (The Green Hell)',
        country: 'Germany',
        category: 'circuit',
        desc: 'The Green Hell: world-famous 20.8 km proving ground carved into the Eifel mountains.',
        coords: [6.9475, 50.3341],
        bearing: 45
    },
    {
        id: 'silverstone',
        name: 'Silverstone Grand Prix Circuit',
        country: 'UK',
        category: 'circuit',
        desc: 'Home of British motorsport: iconic high-speed sweeps through Maggotts and Becketts.',
        coords: [-1.0169, 52.0786],
        bearing: 45
    },
    {
        id: 'spa',
        name: 'Circuit de Spa-Francorchamps (Eau Rouge)',
        country: 'Belgium',
        category: 'circuit',
        desc: 'Legendary Ardennes circuit featuring the breathtaking uphill compression of Eau Rouge.',
        coords: [5.9714, 50.4372],
        bearing: 120
    },
    {
        id: 'lagunaseca',
        name: 'Laguna Seca Raceway (The Corkscrew)',
        country: 'California, USA',
        category: 'circuit',
        desc: 'Home of the Corkscrew: a dramatic blind 5.5-story elevation drop down rolling hills.',
        coords: [-121.758, 36.5843],
        bearing: 210
    },
    {
        id: 'stelvio',
        name: 'Stelvio Pass (Passo dello Stelvio)',
        country: 'Italy',
        category: 'pass',
        desc: 'Dramatic Alpine pass with 48 numbered hairpins climbing to 2,757m altitude.',
        coords: [10.4533, 46.5286],
        bearing: 110
    },
    {
        id: 'transfagarasan',
        name: 'Transfăgărășan Mountain Highway',
        country: 'Romania',
        category: 'pass',
        desc: 'Crowned Top Gear best road in the world: endless Carpathian mountain hairpins and glacial drops.',
        coords: [24.6167, 45.5992],
        bearing: 180
    },
    {
        id: 'tailofthedragon',
        name: 'Tail of the Dragon (318 Mountain Curves)',
        country: 'Tennessee, USA',
        category: 'pass',
        desc: '318 intense mountain switchbacks packed into 11 miles of deep Great Smoky forest.',
        coords: [-83.9208, 35.5186],
        bearing: 140
    },
    {
        id: 'sanfrancisco',
        name: 'San Francisco Lombard Street Hairpins',
        country: 'San Francisco, USA',
        category: 'pass',
        desc: 'The world crookedest street: eight tight switchbacks descending a 27% steep grade.',
        coords: [-122.4187, 37.8021],
        bearing: 270
    },
    {
        id: 'mulholland',
        name: 'Mulholland Drive Canyon Ridge',
        country: 'Los Angeles, USA',
        category: 'pass',
        desc: 'Legendary canyon ridgeline highway overlooking the dazzling lights of Hollywood.',
        coords: [-118.4485, 34.1278],
        bearing: 90
    },
    {
        id: 'paris',
        name: 'Arc de Triomphe & Champs-Élysées',
        country: 'Paris, France',
        category: 'city',
        desc: 'The ultimate 12-avenue chaotic roundabout circle leading down the Champs-Élysées.',
        coords: [2.295, 48.8738],
        bearing: 135
    },
    {
        id: 'london',
        name: 'Westminster & Big Ben Thames Route',
        country: 'London, UK',
        category: 'city',
        desc: 'Historic Thames riverfront boulevard passing the Houses of Parliament and Big Ben.',
        coords: [-0.1246, 51.5007],
        bearing: 180
    },
    {
        id: 'dubai',
        name: 'Dubai Sheikh Zayed 14-Lane Skyline',
        country: 'Dubai, UAE',
        category: 'city',
        desc: 'Futuristic 14-lane high-speed expressway flanked by world-record super-skyscrapers.',
        coords: [55.2708, 25.2048],
        bearing: 45
    },
    {
        id: 'miami',
        name: 'Miami Ocean Drive & South Beach',
        country: 'Florida, USA',
        category: 'city',
        desc: 'Iconic Art Deco beachfront boulevard, neon hotels, and Atlantic coastal cruising.',
        coords: [-80.13, 25.7825],
        bearing: 180
    },
    {
        id: 'berlin',
        name: 'Berlin Autobahn & Tiergarten',
        country: 'Germany',
        category: 'city',
        desc: 'Historic boulevards past the Brandenburg Gate and unrestricted high-speed speedways.',
        coords: [13.3777, 52.5163],
        bearing: 90
    },
    {
        id: 'belgrade',
        name: 'Belgrade Waterfront (GEO Ride HQ)',
        country: 'Serbia',
        category: 'city',
        desc: 'Home base: Modern riverside boulevards and wide sweeping urban curves along the Sava.',
        coords: [20.449425, 44.809684],
        bearing: 107
    }
];

export function teleportToCoordinates(
    lng,
    lat,
    locationName = 'Custom Location',
    targetBearing = 107,
    countryName = ''
) {
    if (!activeMap || state.isTeleporting) return;
    state.velocity = 0;
    state.isTeleporting = true;
    if (locationName !== 'Custom Location') trackSpot(locationName);
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
    syncMapInteractions(activeMap);

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
            trackEvent('teleport_spot', { location: locationName });
            trackEvent('track_select', { location: locationName, country: countryName || '' });

            // Always display the arrived location cinematic overlay!
            let city = locationName;
            let country = countryName || '';
            if (!country && locationName.includes(',')) {
                const parts = locationName.split(',').map((s) => s.trim());
                city = parts[0];
                country = parts.slice(1).join(', ');
            }
            showDiscoveryCinematic(city.toUpperCase(), country.toUpperCase(), 'ARRIVED AT');
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
        if (
            driftHud.classList.contains('failed-shatter') ||
            driftHud.classList.contains('shatter') ||
            driftHud.classList.contains('shatter-done')
        ) {
            driftHud.classList.remove('failed-shatter', 'shatter', 'shatter-done');
            driftHud.querySelectorAll('.drift-shard').forEach((s) => s.remove());
            const driftBadge = driftHud.querySelector('.drift-badge');
            if (driftBadge) driftBadge.textContent = 'DRIFT';
        }
        driftHud.classList.add('active');
        driftPointsEl.textContent = '+' + state.currentDriftPoints.toLocaleString();
        if (driftMultiEl) {
            driftMultiEl.textContent = 'x' + (state.driftMultiplier || 1);
            driftMultiEl.className = 'drift-multiplier-pill mult-' + (state.driftMultiplier || 1);
        }
    } else if (
        !state.isDrifting &&
        !driftHud.classList.contains('failed-shatter') &&
        !driftHud.classList.contains('shatter')
    ) {
        driftHud.classList.remove('active');
    }
}

let speedRunPeak = 0;
let speedRunStartTime = 0;
let speedRunStableFrames = 0;
let lastSpeedTrapAlertTime = 0;
let lastAlertedSpeed = 0;

export function checkSpeedTrap(speedVal) {
    if (typeof document === 'undefined') return;
    const unit = state.unit === 'mi' ? 'MPH' : 'KM/H';
    const minTriggerSpeed = state.unit === 'mi' ? 75 : 120;
    const now = Date.now();

    // If driving below high-speed threshold, reset the active speed burst tracker
    if (speedVal < minTriggerSpeed) {
        speedRunPeak = 0;
        speedRunStableFrames = 0;
        speedRunStartTime = 0;
        return;
    }

    // Vehicle top speed calculation
    const rawMaxSpeed = VEHICLE_CONFIG[state.activeVehicle]?.maxSpeed || 0.4167;
    let maxVehicleSpeed = Math.floor(rawMaxSpeed * 600);
    if (state.unit === 'mi') maxVehicleSpeed = Math.floor(maxVehicleSpeed * 0.621371);
    const isAtTopSpeed = speedVal >= maxVehicleSpeed - 1;

    // Track peak speed of current high-speed run
    if (speedVal > speedRunPeak) {
        speedRunPeak = speedVal;
        speedRunStableFrames = 0;
        if (!speedRunStartTime) speedRunStartTime = now;
    } else if (speedVal === speedRunPeak) {
        speedRunStableFrames++;
    }

    // If an active SPEED RADAR toast is already visible on screen,
    // and the player accelerates even faster, update the toast immediately in real time!
    const existingRadarToast = document.querySelector('#toast-container .toast-msg.toast-radar:not(.hide)');
    if (existingRadarToast && speedVal > lastAlertedSpeed) {
        lastAlertedSpeed = speedVal;
        let radarMsg = `${speedVal} ${unit}`;
        if (isAtTopSpeed) {
            radarMsg += ' • MAX SPEED';
        } else if (speedVal >= (state.topSpeedRecord || 0)) {
            radarMsg += ' • NEW RECORD';
        }
        showToast('SPEED RADAR', radarMsg, { duration: 2500 });
        return;
    }

    // Cooldown check (15 seconds between separate speed radar triggers unless beating current top speed)
    if (now - lastSpeedTrapAlertTime < 15000 && speedVal <= lastAlertedSpeed) {
        return;
    }

    // Trigger conditions:
    // 1. Car reaches max vehicle speed (e.g. 250 KM/H) and holds for 8+ frames (~130ms)
    // 2. High speed stabilized for 30+ frames (~500ms)
    // 3. Player peaked and started decelerating (dropped 4+ below peak)
    const reachedMax = isAtTopSpeed && speedRunStableFrames >= 8;
    const stabilized = speedRunStableFrames >= 30;
    const deceleratingFromPeak = speedRunPeak >= minTriggerSpeed + 15 && speedVal <= speedRunPeak - 4;

    if (reachedMax || stabilized || deceleratingFromPeak) {
        const clockedSpeed = reachedMax ? speedVal : speedRunPeak;

        // Prevent duplicate alerts for the exact same clocked speed in quick succession
        if (clockedSpeed <= lastAlertedSpeed && now - lastSpeedTrapAlertTime < 20000) {
            return;
        }

        lastAlertedSpeed = clockedSpeed;
        lastSpeedTrapAlertTime = now;
        speedRunPeak = speedVal;
        speedRunStableFrames = 0;

        let radarMsg = `${clockedSpeed} ${unit}`;
        if (clockedSpeed >= maxVehicleSpeed - 1) {
            radarMsg += ' • MAX SPEED';
        } else if (clockedSpeed >= (state.topSpeedRecord || 0)) {
            radarMsg += ' • NEW RECORD';
        }

        showToast('SPEED RADAR', radarMsg, { duration: 2500 });
        trackEvent('speed_radar_clocked', {
            speed: clockedSpeed,
            unit,
            vehicle: state.activeVehicle
        });
        if (haptics) haptics.impact('medium');
    }
}

if (typeof window !== 'undefined') {
    window.onDriftComplete = (banked, multiplier) => {
        playDriftBankSound(state.masterVolume);
        trackDriftBank(banked, multiplier);
        submitProgress();
        showToast('DRIFT BANKED', `+${banked.toLocaleString()} PTS (x${multiplier})`, { duration: 2500 });
        const totalScoreEl = document.getElementById('total-drift-score');
        if (totalScoreEl) totalScoreEl.textContent = (state.driftScore || 0).toLocaleString();
        trackEvent('drift_banked', {
            points: banked,
            multiplier: multiplier,
            total_score: state.driftScore || 0
        });
    };

    window.onDriftFail = (lostPoints, _multiplier = 1, reason = 'under_1000') => {
        if (typeof document === 'undefined') return;
        const driftHud = document.getElementById('drift-hud');
        const driftContent = driftHud?.querySelector('.drift-hud-content');
        const driftBadge = driftHud?.querySelector('.drift-badge');
        if (!driftHud || !driftContent) return;

        driftHud.classList.remove('shatter-done');
        driftHud.classList.add('active', 'failed-shatter', 'shatter');

        if (driftBadge) {
            driftBadge.textContent = 'FAILED';
        }

        // Crisp audio & haptic shatter feedback
        playDriftFailSound(state.masterVolume);
        if (haptics) haptics.impact('heavy');

        driftContent.querySelectorAll('.drift-shard').forEach((s) => s.remove());

        trackEvent('drift_shattered', {
            points: lostPoints,
            reason: reason
        });

        // Crisp fail animation & clean fast exit - when finished, add shatter-done (display: none !important)
        setTimeout(() => {
            driftHud.classList.add('shatter-done');
            driftHud.classList.remove('active');
            driftContent.querySelectorAll('.drift-shard').forEach((s) => s.remove());
        }, 1050);
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
    const changelogModal = document.getElementById('changelog-modal-backdrop');
    const isSettingsOpen = settingsPanel?.classList.contains('active');
    const isProModalOpen = proModal?.classList.contains('active');
    const isSpotsOpen = spotsModal?.classList.contains('active');
    const isChangelogOpen = changelogModal?.classList.contains('active');

    if (isSettingsOpen || isProModalOpen || isSpotsOpen || isChangelogOpen) {
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

function initHiddenUiEdgeTrigger() {
    const edgeTrigger = document.getElementById('hidden-ui-edge-trigger');
    const settingsWrapper = document.querySelector('.settings-wrapper');
    if (edgeTrigger && settingsWrapper) {
        let edgeTimeout = null;
        const revealSettings = (durationMs = 2600) => {
            clearTimeout(edgeTimeout);
            settingsWrapper.classList?.add('edge-revealed');
            edgeTrigger.classList?.add('edge-active');
            if (durationMs > 0) {
                edgeTimeout = setTimeout(() => {
                    settingsWrapper.classList?.remove('edge-revealed');
                    edgeTrigger.classList?.remove('edge-active');
                }, durationMs);
            }
        };
        const hideSettings = () => {
            clearTimeout(edgeTimeout);
            edgeTimeout = setTimeout(() => {
                settingsWrapper.classList?.remove('edge-revealed');
                edgeTrigger.classList?.remove('edge-active');
            }, 650);
        };
        edgeTrigger.addEventListener?.('mouseenter', () => revealSettings(0));
        edgeTrigger.addEventListener?.('mouseleave', hideSettings);
        edgeTrigger.addEventListener?.('click', (e) => {
            e?.stopPropagation?.();
            if (settingsWrapper.classList?.contains('edge-revealed')) {
                openSettings();
            } else {
                revealSettings(3500);
            }
        });
        edgeTrigger.addEventListener?.(
            'touchstart',
            () => {
                revealSettings(3800);
            },
            { passive: true }
        );
        settingsWrapper.addEventListener?.('mouseenter', () => revealSettings(0));
        settingsWrapper.addEventListener?.('mouseleave', hideSettings);
    }

    // Restore session-dismissed portrait orientation hint if previously closed
    try {
        if (
            typeof sessionStorage !== 'undefined' &&
            sessionStorage.getItem('georide_portrait_hint_dismissed') === '1'
        ) {
            document.body?.classList?.add('portrait-hint-dismissed');
            document.getElementById('portrait-orientation-hint')?.classList?.add('dismissed');
        }
    } catch (_e) {}
}

export function initUI(map) {
    activeMap = map;
    isManualPresetMenuOpen = state.lightPreset !== 'realtime';
    applyHudVisibility();
    if (map) applyMapLabels(map);
    applyGraphicsQuality(map);
    initHiddenUiEdgeTrigger();
    initProgressUI();

    const settingsBtn = document.getElementById('settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const searchBox = document.querySelector('.search-box');
    const searchInput = document.getElementById('location-search');
    const searchBtn = document.getElementById('search-btn');

    // Prevent map interactions while panels/modals are open, BUT let inputs work normally
    const mapPanels = [settingsPanel, document.querySelector('.pro-modal')];
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

    const setSettingsOpen = (open) => {
        if (!settingsPanel) return;
        const willBeOpen = !!open;
        if (state.isSettingsOpen !== willBeOpen) {
            trackEvent(willBeOpen ? 'settings_open' : 'settings_close');
            if (!willBeOpen) {
                cloudSync().catch(() => {});
            }
        }
        state.isSettingsOpen = willBeOpen;
        if (willBeOpen) {
            state.velocity = 0;
            state.keys = {};
            const activeTabBtn =
                typeof settingsPanel.querySelector === 'function'
                    ? settingsPanel.querySelector('.sx-tab.active')
                    : null;
            if (!activeTabBtn || activeTabBtn.dataset?.sxTab === 'career') {
                loadProfileModule()
                    .then((mod) => {
                        mod.initSettingsPilotHub(settingsPanel);
                        mod.renderSettingsCareerTab();
                    })
                    .catch(() => {});
            }
        }
        settingsPanel.classList.toggle('active', willBeOpen);
        syncMapInteractions(map);
    };

    settingsBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (searchBox) searchBox.classList.remove('expanded');
        setSettingsOpen(!settingsPanel.classList.contains('active'));
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
            setSettingsOpen(false);
            if (haptics) haptics.tap();
        };

        settingsCloseBtn.addEventListener('click', closeSettings);
        settingsCloseBtn.addEventListener('touchstart', closeSettings, { passive: false });
    }

    if (settingsPanel) {
        // Backdrop click and Escape (keydown never reaches window from inside the panel)
        settingsPanel.addEventListener('click', (e) => {
            if (e.target === settingsPanel) setSettingsOpen(false);
        });
        settingsPanel.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                setSettingsOpen(false);
                settingsBtn.focus?.();
            }
        });

        // Tabs
        const hasQuery = typeof settingsPanel.querySelectorAll === 'function';
        const tabButtons = hasQuery ? Array.from(settingsPanel.querySelectorAll('[data-sx-tab]')) : [];
        const tabPanes = hasQuery ? Array.from(settingsPanel.querySelectorAll('[data-sx-pane]')) : [];
        const activateTab = (name, focus = false) => {
            tabButtons.forEach((b) => {
                const on = b.dataset.sxTab === name;
                b.classList.toggle('active', on);
                b.setAttribute('aria-selected', on ? 'true' : 'false');
                b.tabIndex = on ? 0 : -1;
                if (on && focus) b.focus();
            });
            tabPanes.forEach((p) => {
                const on = p.dataset.sxPane === name;
                p.classList.toggle('active', on);
                p.hidden = !on;
            });
            const searchBar = settingsPanel.querySelector('.sx-searchbar');
            if (searchBar) {
                searchBar.hidden = ['places', 'about', 'changelog', 'career'].includes(name);
            }
            if (name === 'career') {
                loadProfileModule()
                    .then((mod) => {
                        mod.initSettingsPilotHub(settingsPanel);
                        mod.renderSettingsCareerTab();
                    })
                    .catch((err) => console.error('Failed to render Pilot Hub tab:', err));
            }
            const body = settingsPanel.querySelector('.sx-body');
            if (body) body.scrollTop = 0;
            if (name) {
                trackEvent('settings_tab_view', { tab: name });
            }
        };
        tabButtons.forEach((btn, idx) => {
            btn.addEventListener('click', () => {
                if (searchInput && searchInput.value) {
                    searchInput.value = '';
                    runSettingsSearch('');
                }
                activateTab(btn.dataset.sxTab);
                btn.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' });
                if (haptics) haptics.select();
            });
            btn.addEventListener('keydown', (e) => {
                const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
                if (!(e.key in keys)) return;
                e.preventDefault();
                if (searchInput && searchInput.value) {
                    searchInput.value = '';
                    runSettingsSearch('');
                }
                const next = tabButtons[(idx + keys[e.key] + tabButtons.length) % tabButtons.length];
                activateTab(next.dataset.sxTab, true);
            });
        });

        // Settings search (filters cards across the main option tabs)
        const searchInput = document.getElementById('settings-search');
        const searchEmpty = document.getElementById('settings-search-empty');
        const SEARCHABLE = ['general', 'driving', 'controls', 'map', 'multiplayer'];
        let settingsSearchDebounce = null;
        const runSettingsSearch = (raw) => {
            const q = raw.trim().toLowerCase();
            if (q.length >= 2) {
                clearTimeout(settingsSearchDebounce);
                settingsSearchDebounce = setTimeout(() => {
                    trackEvent('search_settings', { query: q });
                }, 600);
            }
            if (!q) {
                tabPanes.forEach((p) => {
                    p.classList.remove('sx-search-match');
                    Array.from(p.children).forEach((c) => (c.style.display = ''));
                });
                const current = tabButtons.find((b) => b.classList.contains('active'));
                activateTab(current ? current.dataset.sxTab : 'general');
                if (searchEmpty) searchEmpty.hidden = true;
                return;
            }
            let total = 0;
            tabPanes.forEach((p) => {
                if (!SEARCHABLE.includes(p.dataset.sxPane)) {
                    p.hidden = true;
                    p.classList.remove('sx-search-match');
                    return;
                }
                let matches = 0;
                Array.from(p.children).forEach((card) => {
                    const hit = (card.textContent || '').toLowerCase().includes(q);
                    card.style.display = hit ? '' : 'none';
                    if (hit) matches++;
                });
                p.hidden = matches === 0;
                p.classList.toggle('sx-search-match', matches > 0);
                total += matches;
            });
            if (searchEmpty) searchEmpty.hidden = total > 0;
        };
        searchInput?.addEventListener('input', () => runSettingsSearch(searchInput.value));
        searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && searchInput.value) {
                e.stopPropagation();
                searchInput.value = '';
                runSettingsSearch('');
            }
        });

        // Shortcuts to other tabs & modals inside Settings
        document.getElementById('settings-head-pro-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            lastSettingsTab = settingsPanel.querySelector('.sx-tab.active')?.dataset.sxTab || null;
            setSettingsOpen(false);
            openProModal();
            if (haptics) haptics.tap();
        });
        document.getElementById('settings-pro-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            lastSettingsTab = settingsPanel.querySelector('.sx-tab.active')?.dataset.sxTab || null;
            setSettingsOpen(false);
            openProModal();
            if (haptics) haptics.tap();
        });

        document.getElementById('sx-sidebar-pro-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            lastSettingsTab = settingsPanel.querySelector('.sx-tab.active')?.dataset.sxTab || null;
            setSettingsOpen(false);
            openProModal();
            if (haptics) haptics.tap();
        });

        document.getElementById('settings-spots-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            activateTab('places');
            trackEvent('spots_modal_open');
            if (haptics) haptics.tap();
        });

        const handleOpenChangelog = (e) => {
            e.stopPropagation();
            activateTab('changelog');
            trackEvent('changelog_open');
            if (haptics) haptics.tap();
        };
        document.getElementById('settings-changelog-btn')?.addEventListener('click', handleOpenChangelog);
        document.getElementById('settings-changelog-pill')?.addEventListener('click', handleOpenChangelog);

        // Auto-sync changelog version into header pill from latest entry
        const syncLatestChangelogVersion = () => {
            if (typeof settingsPanel?.querySelector !== 'function') return;
            const latestEl = settingsPanel.querySelector('.changelog-entry .changelog-version');
            if (latestEl) {
                const latestText = latestEl.textContent.trim();
                const pill = document.getElementById('settings-changelog-pill');
                if (pill) pill.textContent = `${latestText} • CHANGELOG`;
            }
        };
        syncLatestChangelogVersion();

        // Spot cards in Settings places tab (teleport & auto-close settings)
        if (hasQuery) {
            settingsPanel.querySelectorAll('.spot-card').forEach((card) => {
                card.addEventListener('click', () => {
                    const spotId = card.getAttribute('data-spot-id');
                    const spot = FAMOUS_SPOTS.find((s) => s.id === spotId);
                    if (spot) {
                        setSettingsOpen(false);
                        teleportToCoordinates(spot.coords[0], spot.coords[1], spot.name, spot.bearing, spot.country);
                        if (haptics) haptics.success();
                    }
                });
            });
        }
    }

    document.addEventListener('click', (e) => {
        if (searchBox?.classList.contains('expanded') && !searchBox.contains(e.target)) {
            searchBox.classList.remove('expanded');
        }
    });

    const dismissPortraitBtn = document.getElementById('dismiss-portrait-hint');
    const portraitHintBanner = document.getElementById('portrait-orientation-hint');
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('geo_portrait_hint_dismissed') === 'true') {
        document.body.classList.add('portrait-hint-dismissed');
        portraitHintBanner?.classList.add('dismissed');
        portraitHintBanner?.style.setProperty('display', 'none', 'important');
    }
    if (dismissPortraitBtn) {
        const dismissHint = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            document.body.classList.add('portrait-hint-dismissed');
            trackEvent('dismiss_portrait_hint');
            if (portraitHintBanner) {
                portraitHintBanner.classList.add('dismissed');
                portraitHintBanner.style.setProperty('display', 'none', 'important');
                try {
                    sessionStorage.setItem('geo_portrait_hint_dismissed', 'true');
                } catch (_) {}
            }
        };
        dismissPortraitBtn.addEventListener('click', dismissHint);
        dismissPortraitBtn.addEventListener('pointerdown', dismissHint);
        dismissPortraitBtn.addEventListener('touchend', dismissHint);
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
                lastSettingsTab = document.querySelector('#settings-panel .sx-tab.active')?.dataset.sxTab || 'driving';
                const panel = document.getElementById('settings-panel');
                if (panel) panel.classList.remove('active');
                state.isSettingsOpen = false;
                openProModal();
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
            trackEvent('toggle_3d_vehicle', { enabled: state.is3D });
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
            trackEvent('toggle_3d_buildings', { enabled: state.is3DBuildings });
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
            trackEvent('toggle_collisions', { enabled: state.collisionsEnabled });
            haptics.select();
        };
    });

    document.querySelectorAll('.god-toggle button').forEach((btn) => {
        btn.onclick = () => {
            const requestedGod = btn.dataset.god === 'on';
            if (requestedGod && !state.isPro) {
                openProModal();
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

        let volumeDebounce = null;
        volumeSlider.addEventListener('input', (e) => {
            state.masterVolume = parseFloat(e.target.value);
            updateToggleStates();
            saveState();
            clearTimeout(volumeDebounce);
            volumeDebounce = setTimeout(() => {
                trackEvent('change_volume', { volume: Math.round(state.masterVolume * 100) });
            }, 600);
        });
    }

    // Haptics vibration toggle
    document.querySelectorAll('.haptics-toggle button').forEach((btn) => {
        btn.onclick = () => {
            state.hapticsEnabled = btn.dataset.haptics === 'on';
            updateToggleStates();
            saveState();
            trackEvent('toggle_haptics', { enabled: state.hapticsEnabled });
            if (state.hapticsEnabled) haptics.success();
        };
    });

    // Body roll suspension toggle
    document.querySelectorAll('.bodyroll-toggle button').forEach((btn) => {
        btn.onclick = () => {
            state.bodyRollEnabled = btn.dataset.bodyroll === 'on';
            updateToggleStates();
            saveState();
            trackEvent('toggle_body_roll', { enabled: state.bodyRollEnabled });
            haptics.select();
        };
    });

    // Skidmarks toggle
    document.querySelectorAll('.skidmarks-toggle button').forEach((btn) => {
        btn.onclick = () => {
            state.skidMarksEnabled = btn.dataset.skidmarks === 'on';
            if (!state.skidMarksEnabled) state.skidMarks = [];
            updateToggleStates();
            saveState();
            trackEvent('toggle_skidmarks', { enabled: state.skidMarksEnabled });
            haptics.select();
        };
    });

    // 3D Terrain relief toggle (Roadmap Level 25 or Pro)
    document.querySelectorAll('.terrain-toggle button').forEach((btn) => {
        btn.onclick = () => {
            const requestedOn = btn.dataset.terrain === 'on';
            const snap = getProgressSnapshot();
            const hasAccess = state.isPro || (snap?.level?.level || 1) >= 25;
            if (requestedOn && !hasAccess) {
                lastSettingsTab = 'map';
                const panel = document.getElementById('settings-panel');
                if (panel) panel.classList.remove('active');
                state.isSettingsOpen = false;
                openProModal();
                showToast('LEVEL 25 REQUIRED', 'Reach Level 25 or unlock Pro for 3D Satellite Terrain Elevation.', {
                    isPro: true
                });
                if (haptics) haptics.tap();
                return;
            }
            state.terrainEnabled = requestedOn;
            setupTerrain(map);
            updateToggleStates();
            saveState();
            trackEvent('toggle_terrain', { enabled: state.terrainEnabled });
            showToast('3D TERRAIN', state.terrainEnabled ? 'Elevation Active' : 'Elevation Disabled');
            haptics.select();
        };
    });

    // Drift steer assist toggle
    document.querySelectorAll('.drift-assist-toggle button').forEach((btn) => {
        btn.onclick = () => {
            state.driftAssist = btn.dataset.assist;
            updateToggleStates();
            saveState();
            trackEvent('change_drift_assist', { assist: state.driftAssist });
            haptics.select();
        };
    });

    // Graphics quality toggle
    document.querySelectorAll('.graphics-toggle button').forEach((btn) => {
        btn.onclick = () => {
            state.graphicsQuality = btn.dataset.quality;
            applyGraphicsQuality(map);
            updateToggleStates();
            saveState();
            trackEvent('change_graphics_quality', { quality: state.graphicsQuality });
            haptics.select();
            const labels = {
                ultra: 'ULTRA (Native 2K/4K, High Detail)',
                balanced: 'BALANCED (1080p Optimized)',
                eco: 'ECO (Battery Saver, Fast Render)'
            };
            showToast('GRAPHICS QUALITY', labels[state.graphicsQuality] || state.graphicsQuality.toUpperCase());
        };
    });

    // Map labels toggle
    document.querySelectorAll('.labels-toggle button').forEach((btn) => {
        btn.onclick = () => {
            state.mapLabels = btn.dataset.labels === 'on';
            applyMapLabels(map);
            updateToggleStates();
            saveState();
            trackEvent('toggle_map_labels', { enabled: state.mapLabels });
            haptics.select();
        };
    });

    // HUD mode toggle
    document.querySelectorAll('.hud-toggle button').forEach((btn) => {
        btn.onclick = () => {
            state.hudVisibility = btn.dataset.hud;
            applyHudVisibility();
            updateToggleStates();
            saveState();
            trackEvent('change_hud_mode', { mode: state.hudVisibility });
            haptics.select();
        };
    });

    // Crash camera shake toggle
    document.querySelectorAll('.camshake-toggle button').forEach((btn) => {
        btn.onclick = () => {
            state.cameraShakeEnabled = btn.dataset.camshake === 'on';
            if (!state.cameraShakeEnabled) state.crashShake = 0;
            updateToggleStates();
            saveState();
            trackEvent('toggle_camera_shake', { enabled: state.cameraShakeEnabled });
            haptics.select();
        };
    });

    // FPS counter toggle
    document.querySelectorAll('.fps-toggle button').forEach((btn) => {
        btn.onclick = () => {
            state.showFps = btn.dataset.fps === 'on';
            applyFpsCounter();
            updateToggleStates();
            saveState();
            trackEvent('toggle_fps', { enabled: state.showFps });
            haptics.select();
        };
    });
    applyFpsCounter();

    // Export / import settings backup
    const exportBtn = document.getElementById('settings-export-btn');
    const importBtn = document.getElementById('settings-import-btn');
    const importFile = document.getElementById('settings-import-file');
    const requireProForBackup = () => {
        if (state.isPro) return true;
        lastSettingsTab = document.querySelector('#settings-panel .sx-tab.active')?.dataset.sxTab || 'general';
        const panel = document.getElementById('settings-panel');
        if (panel) panel.classList.remove('active');
        state.isSettingsOpen = false;
        openProModal();
        if (haptics) haptics.tap();
        return false;
    };
    if (exportBtn) {
        exportBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!requireProForBackup()) return;
            exportSettings();
            trackEvent('settings_export');
            haptics.success();
        };
    }
    if (importBtn && importFile) {
        importBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!requireProForBackup()) return;
            importFile.click();
        };
        importFile.onchange = async () => {
            const file = importFile.files && importFile.files[0];
            importFile.value = '';
            if (!file || !state.isPro) return;
            try {
                await importSettings(await file.text(), map);
                trackEvent('settings_import');
                haptics.success();
            } catch {
                showToast('IMPORT FAILED', 'Selected file is not a valid GEO Ride settings backup.');
            }
        };
    }

    // Camera perspective toggle (Chase / Hood / Wide)
    document.querySelectorAll('.camera-mode-toggle button').forEach((btn) => {
        btn.onclick = () => {
            const cam = btn.dataset.camera;
            if (cam) {
                state.cameraMode = cam;
                import('./controls.js')
                    .then(({ setCameraMode }) => {
                        setCameraMode(cam);
                    })
                    .catch(() => {
                        updateToggleStates();
                    });
                updateToggleStates();
                saveState();
                trackEvent('camera_mode_change', { mode: cam, source: 'settings' });
                haptics.select();
            }
        };
    });

    const checkRadioAccess = () => {
        if (state.isPro || (getProgressSnapshot()?.level?.level || 1) >= 5) return true;
        showToast('LEVEL 5 REQUIRED', 'Reach Level 5 or unlock Pro to tune into Web Radio stations.');
        if (haptics) haptics.tap();
        return false;
    };

    // Direct radio station select buttons (Roadmap Level 5 or Pro)
    document.querySelectorAll('.radio-station-btn').forEach((btn) => {
        btn.onclick = () => {
            if (!checkRadioAccess()) return;
            setRadioStation(btn.dataset.station);
            updateToggleStates();
            trackEvent('radio_station_select', { station: btn.dataset.station });
            haptics.select();
        };
    });

    // Fast respawn at Belgrade home
    const homeBtn = document.getElementById('settings-home-btn');
    if (homeBtn) {
        homeBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setSettingsOpen(false);
            trackEvent('teleport_home', { location: 'Belgrade Waterfront' });
            teleportToCoordinates(INITIAL_CENTER[0], INITIAL_CENTER[1], 'Belgrade Waterfront', 107, 'Serbia');
            haptics.success();
        };
    }

    // Restore factory defaults
    const resetPrefsBtn = document.getElementById('settings-reset-prefs-btn');
    if (resetPrefsBtn) {
        resetPrefsBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            resetUserPreferences(map);
            trackEvent('reset_preferences');
            haptics.success();
        };
    }

    // Spots category filters
    document.querySelectorAll('.spot-filter-chip').forEach((chip) => {
        chip.onclick = () => {
            filterSpots(chip.dataset.filter);
            trackEvent('spots_filter', { filter: chip.dataset.filter });
            haptics.select();
        };
    });

    // Multiplayer pilot callsign
    const mpPlayerNameInput = document.getElementById('mp-player-name');
    if (mpPlayerNameInput) {
        let nameDebounce = null;
        mpPlayerNameInput.oninput = (e) => {
            state.playerName = (e.target.value || '').trim().slice(0, 16);
            saveState();
            clearTimeout(nameDebounce);
            nameDebounce = setTimeout(() => {
                if (state.playerName) {
                    trackEvent('multiplayer_nickname_change', { name_length: state.playerName.length });
                }
            }, 1000);
        };
    }

    // Multiplayer quick join global lobby
    const mpQuickJoinBtn = document.getElementById('mp-quick-join-btn');
    if (mpQuickJoinBtn) {
        mpQuickJoinBtn.onclick = (e) => {
            e.stopPropagation();
            trackEvent('multiplayer_quick_join');
            const joinPeerInput = document.getElementById('join-peer-id');
            if (joinPeerInput) joinPeerInput.value = '';
            document.getElementById('join-mp-btn')?.click();
            haptics.success();
        };
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
            let cachedResult = locationSearchCache.get(cacheKey);

            if (!cachedResult) {
                const response = await fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?types=place,locality,address,poi&limit=3&access_token=${mapboxgl.accessToken}`
                );
                const data = await response.json();
                if (data.features && data.features.length > 0) {
                    const feat = data.features[0];
                    const countryCtx = feat.context?.find((c) => c && c.id && c.id.startsWith('country'));
                    cachedResult = {
                        coords: feat.center,
                        city: feat.text || query,
                        country: countryCtx?.text || ''
                    };
                    locationSearchCache.set(cacheKey, cachedResult);
                }
            }

            if (
                cachedResult &&
                cachedResult.coords &&
                Array.isArray(cachedResult.coords) &&
                cachedResult.coords.length >= 2
            ) {
                const [lng, lat] = cachedResult.coords;
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
                if (settingsPanel) {
                    settingsPanel.classList.remove('active');
                    syncMapInteractions(map);
                }

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
                        showDiscoveryCinematic(
                            (cachedResult.city || query).toUpperCase(),
                            (cachedResult.country || '').toUpperCase(),
                            'ARRIVED AT'
                        );
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
    // Add tracking to external links & navigation
    document.querySelector('.logo')?.addEventListener('click', () => {
        trackEvent('click_logo', { destination: '/' });
    });

    document.querySelector('.coffee-btn-link')?.addEventListener('click', () => {
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
    const laterDonationBtn = document.getElementById('donation-later-btn');
    const donatePaypalBtn = document.getElementById('donation-paypal-btn');

    if (donationPopup && closeDonationBtn) {
        closeDonationBtn.addEventListener('click', () => {
            donationPopup.classList.remove('show');
            trackEvent('donation_dismiss', { reason: 'close' });
            if (haptics) haptics.tap();
        });
    }
    if (donationPopup && laterDonationBtn) {
        laterDonationBtn.addEventListener('click', () => {
            donationPopup.classList.remove('show');
            trackEvent('donation_dismiss', { reason: 'later' });
            if (haptics) haptics.tap();
        });
    }
    if (donatePaypalBtn) {
        donatePaypalBtn.addEventListener('click', () => {
            donationPopup?.classList?.remove('show');
            localStorage.setItem('geo-ride-donation-dismissed', 'true');
            trackEvent('donation_click', { provider: 'paypal' });
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
            lastSettingsTab = null;
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

    const proBackBtn = document.getElementById('pro-back-to-settings-btn');
    if (proBackBtn) {
        proBackBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const returnTab = lastSettingsTab || 'general';
            lastSettingsTab = null;
            closeProModal();
            openSettings(returnTab);
            if (haptics) haptics.tap();
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
    const spotsBtn = document.getElementById('settings-spots-btn');
    const spotsBackdrop = document.getElementById('spots-modal-backdrop');
    const spotsClose = document.getElementById('spots-modal-close');
    const spotsBackBtn = document.getElementById('spots-back-to-settings-btn');

    if (spotsBtn && spotsBackdrop) {
        spotsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsPanel?.classList.remove('active');
            spotsBackdrop.classList.add('active');
            syncMapInteractions(map);
            trackEvent('spots_modal_open');
            if (haptics) haptics.tap();
        });
    }

    if (spotsClose && spotsBackdrop) {
        spotsClose.addEventListener('click', () => {
            spotsBackdrop.classList.remove('active');
            syncMapInteractions(map);
            trackEvent('spots_modal_close');
            if (haptics) haptics.tap();
        });
    }

    if (spotsBackBtn && spotsBackdrop) {
        spotsBackBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            spotsBackdrop.classList.remove('active');
            openSettings('general');
            if (haptics) haptics.tap();
        });
    }

    if (spotsBackdrop) {
        spotsBackdrop.addEventListener('click', (e) => {
            if (e.target === spotsBackdrop) {
                spotsBackdrop.classList.remove('active');
                syncMapInteractions(map);
                trackEvent('spots_modal_close');
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
                            teleportToCoordinates(
                                spot.coords[0],
                                spot.coords[1],
                                spot.name,
                                spot.bearing,
                                spot.country
                            );
                            if (haptics) haptics.success();
                        }
                    });
                }
            });
        }
    }

    // Changelog Modal Listeners
    const changelogBackdrop = document.getElementById('changelog-modal-backdrop');
    const changelogClose = document.getElementById('changelog-modal-close');
    const changelogBackBtn = document.getElementById('changelog-back-to-settings-btn');

    if (changelogClose && changelogBackdrop) {
        changelogClose.addEventListener('click', () => {
            closeChangelogModal();
            trackEvent('changelog_modal_close');
            if (haptics) haptics.tap();
        });
    }

    if (changelogBackdrop) {
        changelogBackdrop.addEventListener('click', (e) => {
            if (e.target === changelogBackdrop) {
                closeChangelogModal();
                trackEvent('changelog_modal_close');
            }
        });
    }

    if (changelogBackBtn && changelogBackdrop) {
        changelogBackBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeChangelogModal();
            openSettings('more');
            if (haptics) haptics.tap();
        });
    }

    // Camera Mode Toggle Button Listener
    const cameraToggleBtn = document.getElementById('camera-toggle-btn');
    if (cameraToggleBtn) {
        cameraToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            import('./controls.js').then(({ cycleCameraMode }) => {
                cycleCameraMode();
                trackEvent('camera_mode_change', { mode: state.cameraMode, source: 'hud_btn' });
            });
        });
    }

    // Radio HUD Widget Listeners
    const radioPlayBtn = document.getElementById('radio-play-btn');
    const radioNextBtn = document.getElementById('radio-next-btn');
    if (radioPlayBtn) {
        radioPlayBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!checkRadioAccess()) return;
            toggleRadio();
            trackEvent('radio_toggle', {
                active: !!state.isRadioActive,
                station: state.currentRadioStation || 'default'
            });
            if (haptics) haptics.tap();
        });
    }
    if (radioNextBtn) {
        radioNextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!checkRadioAccess()) return;
            nextRadioStation();
            trackEvent('radio_next_station', { station: state.currentRadioStation || 'default' });
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
            document.querySelectorAll('.radio-station-btn').forEach((btn) => {
                btn.classList.toggle('active', btn.dataset.station === radioState.station?.id);
            });
        };
    }

    // Pro Activation key handler
    const proKeyInput = document.getElementById('pro-key-input');
    const proActivateBtn = document.getElementById('pro-activate-btn');
    const proStatusEl = document.getElementById('pro-activation-status');

    const showActivationStatus = (msg, type = 'info') => {
        if (!proStatusEl) return;
        proStatusEl.style.display = 'flex';
        const cfg = {
            info: [
                '#00f2ff',
                '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
            ],
            success: ['#22c55e', '<polyline points="20 6 9 17 4 12"/>'],
            error: [
                '#ef4444',
                '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
            ],
            loading: ['#c470f0', '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>', 'animation:spin 1s linear infinite;']
        }[type] || ['#00f2ff', ''];
        proStatusEl.style.color = cfg[0];
        proStatusEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;${cfg[2] || ''}">${cfg[1]}</svg> <span>${msg}</span>`;
    };

    if (proActivateBtn && proKeyInput) {
        const handleActivation = async () => {
            const val = proKeyInput.value.trim().toLowerCase();
            trackEvent('pro_activation_attempt', { email_domain: val.split('@')[1] || '' });
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

    // Initialize Photo Mode & First-Visit Tutorial
    initPhotoMode(map);
    initTutorialModal();
}

export function openSettings(tabName = null) {
    if (typeof document === 'undefined') return;
    const settingsPanel = document.getElementById('settings-panel');
    if (!settingsPanel) return;
    state.isSettingsOpen = true;
    state.velocity = 0;
    state.keys = {};
    settingsPanel.classList.add('active');
    const targetTab = tabName === 'more' ? 'about' : tabName;
    if (targetTab && typeof settingsPanel.querySelectorAll === 'function') {
        const tabBtn =
            settingsPanel.querySelector(`[data-sx-tab="${targetTab}"]`) ||
            settingsPanel.querySelector(`[data-sx-tab="${tabName}"]`);
        if (tabBtn && typeof tabBtn.click === 'function') {
            tabBtn.click();
        }
    }
    syncMapInteractions(activeMap);
}

export function closeSettings() {
    if (typeof document === 'undefined') return;
    state.isSettingsOpen = false;
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsPanel) {
        settingsPanel.classList.remove('active');
        syncMapInteractions(activeMap);
    }
    cloudSync().catch(() => {});
}

export function openChangelogModal() {
    if (typeof document === 'undefined') return;
    const backdrop = document.getElementById('changelog-modal-backdrop');
    if (backdrop) {
        backdrop.classList.add('active');
        state.isInputFocused = true;
        if (document.body && document.body.classList) {
            document.body.classList.remove('hide-cursor');
        }
        syncMapInteractions(activeMap);
    }
}

export function closeChangelogModal() {
    if (typeof document === 'undefined') return;
    const backdrop = document.getElementById('changelog-modal-backdrop');
    if (backdrop) {
        backdrop.classList.remove('active');
        state.isInputFocused = false;
        state.keys = {};
        syncMapInteractions(activeMap);
    }
}

export function closeAllPanels() {
    state.isSettingsOpen = false;
    state.isProfileOpen = false;
    document.getElementById('settings-panel')?.classList.remove('active');
    document.getElementById('spots-modal-backdrop')?.classList.remove('active');
    closeChangelogModal();
    closeTutorialModal();
    if (state.isPhotoMode) {
        togglePhotoMode(false);
    }
    document.querySelector('.search-box')?.classList.remove('expanded');
    closeProModal();
    closeProfile();
    state.isInputFocused = false;
    const searchInput = document.getElementById('location-search');
    if (searchInput && typeof searchInput.blur === 'function') {
        searchInput.blur();
    }
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
        const lbl = state.isPro ? 'GEO Ride Pro Active' : 'Unlock GEO Ride Pro';
        proOpenBtn.classList?.toggle?.('is-active', !!state.isPro);
        proOpenBtn.title = lbl;
        proOpenBtn.setAttribute?.('aria-label', lbl);
        proOpenBtn.innerHTML = `<span class="pro-btn-shimmer"></span><span class="pro-btn-inner"><svg class="pro-crown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20M5 20L3 8l5 4 4-7 4 7 5-4-2 12z"></path></svg><span class="pro-btn-label">${state.isPro ? 'ACTIVE' : 'GO PRO'}</span></span>`;
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

    document
        .querySelectorAll('.haptics-toggle button')
        .forEach((b) => b.classList.toggle('active', b.dataset.haptics === (state.hapticsEnabled ? 'on' : 'off')));
    document
        .querySelectorAll('.skidmarks-toggle button')
        .forEach((b) => b.classList.toggle('active', b.dataset.skidmarks === (state.skidMarksEnabled ? 'on' : 'off')));
    const curLv = getProgressSnapshot()?.level?.level || 1;
    const radOk = state.isPro || curLv >= 5;
    const terOk = state.isPro || curLv >= 25;
    const radBadge = document.getElementById('radio-roadmap-badge');
    if (radBadge) radBadge.hidden = radOk;
    const terBadge = document.getElementById('terrain-roadmap-badge');
    if (terBadge) terBadge.hidden = terOk;
    const radWidget = document.getElementById('radio-widget');
    const radTag = document.getElementById('radio-status-tag');
    if (radWidget) radWidget.classList?.toggle?.('is-locked', !radOk);
    if (radTag) radTag.textContent = radOk ? 'NOW TUNED' : 'UNLOCK AT LEVEL 5 OR PRO';
    document.querySelectorAll('.radio-station-btn').forEach((b, idx) => {
        b.classList?.toggle?.('disabled-btn', !radOk);
        if (!radOk) b.classList?.remove?.('active');
        else if (idx === 0 && !document.querySelector('.radio-station-btn.active')) b.classList?.add?.('active');
    });
    document.querySelectorAll('.terrain-toggle button').forEach((b) => {
        b.classList.toggle('active', b.dataset.terrain === (state.terrainEnabled ? 'on' : 'off'));
        if (b.dataset.terrain === 'on') b.classList?.toggle?.('disabled-btn', !terOk);
    });
    document
        .querySelectorAll('.bodyroll-toggle button')
        .forEach((b) => b.classList.toggle('active', b.dataset.bodyroll === (state.bodyRollEnabled ? 'on' : 'off')));
    document
        .querySelectorAll('.drift-assist-toggle button')
        .forEach((b) => b.classList.toggle('active', b.dataset.assist === (state.driftAssist || 'assisted')));
    document
        .querySelectorAll('.tilt-sens-toggle button')
        .forEach((b) => b.classList.toggle('active', b.dataset.sens === (state.tiltSensitivity || 'normal')));
    document
        .querySelectorAll('.camera-fov-toggle button')
        .forEach((b) => b.classList.toggle('active', b.dataset.fov === (state.cameraFovMode || 'dynamic')));
    document
        .querySelectorAll('.autocenter-toggle button')
        .forEach((b) => b.classList.toggle('active', b.dataset.autocenter === (state.cameraAutoCenter ? 'on' : 'off')));
    document
        .querySelectorAll('.graphics-toggle button')
        .forEach((b) => b.classList.toggle('active', b.dataset.quality === (state.graphicsQuality || 'ultra')));
    document
        .querySelectorAll('.labels-toggle button')
        .forEach((b) => b.classList.toggle('active', b.dataset.labels === (state.mapLabels ? 'on' : 'off')));
    document
        .querySelectorAll('.hud-toggle button')
        .forEach((b) => b.classList.toggle('active', b.dataset.hud === (state.hudVisibility || 'full')));
    const headProBtn = document.getElementById('settings-head-pro-btn');
    if (headProBtn) headProBtn.hidden = !!state.isPro;
    document.querySelectorAll('[data-pro-lock]').forEach((el) => {
        el.hidden = !!state.isPro;
    });

    const exportBtnEl = document.getElementById('settings-export-btn');
    const importBtnEl = document.getElementById('settings-import-btn');
    if (exportBtnEl && importBtnEl) {
        if (!state.isPro) {
            exportBtnEl.classList?.add?.('pro-locked-btn');
            importBtnEl.classList?.add?.('pro-locked-btn');
            if (typeof exportBtnEl.setAttribute === 'function') exportBtnEl.setAttribute('aria-disabled', 'true');
            if (typeof importBtnEl.setAttribute === 'function') importBtnEl.setAttribute('aria-disabled', 'true');
        } else {
            exportBtnEl.classList?.remove?.('pro-locked-btn');
            importBtnEl.classList?.remove?.('pro-locked-btn');
            if (typeof exportBtnEl.removeAttribute === 'function') exportBtnEl.removeAttribute('aria-disabled');
            if (typeof importBtnEl.removeAttribute === 'function') importBtnEl.removeAttribute('aria-disabled');
        }
    }

    document
        .querySelectorAll('.camshake-toggle button')
        .forEach((b) =>
            b.classList.toggle('active', b.dataset.camshake === (state.cameraShakeEnabled !== false ? 'on' : 'off'))
        );
    document
        .querySelectorAll('.fps-toggle button')
        .forEach((b) => b.classList.toggle('active', b.dataset.fps === (state.showFps ? 'on' : 'off')));

    // Camera perspective toggle buttons and description
    document
        .querySelectorAll('.camera-mode-toggle button')
        .forEach((b) => b.classList?.toggle('active', b.dataset?.camera === (state.cameraMode || 'chase')));
    const camMode = state.cameraMode || 'chase';
    const camLabel = document.getElementById('cam-mode-label');
    if (camLabel) camLabel.textContent = camMode.toUpperCase();
    const camDesc = document.getElementById('camera-mode-desc');
    const camDescriptions = {
        chase: 'Dynamic 3rd-person chase camera with drift compensation and speed tilt.',
        hood: 'Immersive bumper/hood first-person perspective for extreme sense of speed.',
        wide: 'High-angle cinematic overhead perspective with expanded peripheral vision.'
    };
    if (camDesc && camDescriptions[camMode]) {
        camDesc.textContent = camDescriptions[camMode];
    }

    const playerNameInput = document.getElementById('mp-player-name');
    if (playerNameInput && document.activeElement !== playerNameInput) {
        playerNameInput.value = state.playerName || 'Pilot';
    }
}

export function applyMapLabels(map) {
    if (!map || !map.getStyle) return;
    try {
        const style = map.getStyle();
        if (!style || !style.layers) return;
        const visibility = state.mapLabels !== false ? 'visible' : 'none';
        style.layers.forEach((layer) => {
            if (layer.type === 'symbol') {
                try {
                    map.setLayoutProperty(layer.id, 'visibility', visibility);
                } catch {}
            }
        });
    } catch {}
}

let fpsRafId = 0;

/**
 * Shows or hides the live FPS counter overlay according to state.showFps.
 * @returns {void}
 */
export function applyFpsCounter() {
    if (typeof document === 'undefined' || typeof requestAnimationFrame !== 'function') return;
    let el = document.getElementById('fps-counter');
    if (!state.showFps) {
        if (fpsRafId) cancelAnimationFrame(fpsRafId);
        fpsRafId = 0;
        if (el) el.remove();
        return;
    }
    if (fpsRafId) return;
    if (!el) {
        el = document.createElement('div');
        el.id = 'fps-counter';
        el.setAttribute('aria-hidden', 'true');
        document.body.appendChild(el);
    }
    let frames = 0;
    let last = performance.now();
    const tick = (now) => {
        frames++;
        if (now - last >= 500) {
            el.textContent = `${Math.round((frames * 1000) / (now - last))} FPS`;
            frames = 0;
            last = now;
        }
        fpsRafId = requestAnimationFrame(tick);
    };
    fpsRafId = requestAnimationFrame(tick);
}

const EXPORTABLE_KEYS = [
    'unit',
    'collisionsEnabled',
    'is3D',
    'is3DBuildings',
    'mapStyle',
    'lightPreset',
    'controlsMode',
    'masterVolume',
    'cameraMode',
    'hapticsEnabled',
    'skidMarksEnabled',
    'terrainEnabled',
    'bodyRollEnabled',
    'driftAssist',
    'underglowColor',
    'tiltSensitivity',
    'cameraFovMode',
    'cameraAutoCenter',
    'graphicsQuality',
    'mapLabels',
    'hudVisibility',
    'cameraShakeEnabled',
    'showFps',
    'playerName'
];

/**
 * Downloads current preferences as a JSON backup file.
 * @returns {void}
 */
export function exportSettings() {
    const data = { app: 'geo-ride', version: 1, settings: {} };
    EXPORTABLE_KEYS.forEach((k) => {
        data.settings[k] = state[k];
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'geo-ride-settings.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('SETTINGS EXPORTED', 'Backup saved as geo-ride-settings.json.');
}

/**
 * Imports preferences from a JSON backup, validating through the standard state loader.
 * @param {string} text - Raw JSON file contents.
 * @param {Object} map - Active map instance.
 * @returns {Promise<void>}
 */
export async function importSettings(text, map) {
    const parsed = JSON.parse(text);
    if (!parsed || parsed.app !== 'geo-ride' || typeof parsed.settings !== 'object') {
        throw new Error('Invalid backup');
    }
    const current = JSON.parse(localStorage.getItem('geo_ride_state') || '{}');
    const merged = { ...current };
    EXPORTABLE_KEYS.forEach((k) => {
        if (k in parsed.settings) merged[k] = parsed.settings[k];
    });
    localStorage.setItem('geo_ride_state', JSON.stringify(merged));
    loadState();
    updateToggleStates();
    applyFpsCounter();
    applyHudVisibility();
    applyGraphicsQuality(map);
    if (map) setupTerrain(map);
    if (map) applyMapLabels(map);
    saveState();
    showToast('SETTINGS IMPORTED', 'Preferences restored from backup.');
}

export function applyHudVisibility() {
    if (typeof document === 'undefined') return;
    const isHidden = state.hudVisibility === 'hidden';
    document.body?.classList?.toggle('hidden-ui', isHidden);
}

export function applyGraphicsQuality(map = activeMap) {
    if (typeof document === 'undefined') return;
    const quality = state.graphicsQuality || 'ultra';

    if (document.documentElement && document.documentElement.classList) {
        document.documentElement.classList.remove('quality-ultra', 'quality-balanced', 'quality-eco');
        document.documentElement.classList.add('quality-' + quality);
    }

    const threeLayer = getThreeLayer();
    if (threeLayer && threeLayer.renderer && typeof threeLayer.renderer.setPixelRatio === 'function') {
        const ratio =
            quality === 'ultra'
                ? Math.min(typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1, 2.0)
                : quality === 'balanced'
                  ? 1.0
                  : 0.75;
        threeLayer.renderer.setPixelRatio(ratio);
        threeLayer.maxParticles = quality === 'ultra' ? 120 : quality === 'balanced' ? 60 : 15;
    }

    if (map && typeof map.getLayer === 'function' && typeof map.setPaintProperty === 'function') {
        try {
            if (map.getLayer('3d-buildings')) {
                const opacity = quality === 'ultra' ? 0.95 : quality === 'balanced' ? 0.75 : 0.45;
                map.setPaintProperty('3d-buildings', 'fill-extrusion-opacity', opacity);
            }
        } catch {}
    }

    if (map && typeof map.triggerRepaint === 'function') {
        try {
            map.triggerRepaint();
        } catch {}
    }
}

export function resetUserPreferences(map) {
    state.masterVolume = 0.5;
    state.unit = 'km';
    state.collisionsEnabled = true;
    state.is3D = true;
    state.is3DBuildings = true;
    state.hapticsEnabled = true;
    state.skidMarksEnabled = true;
    state.terrainEnabled = false;
    state.bodyRollEnabled = true;
    state.driftAssist = 'assisted';
    state.tiltSensitivity = 'normal';
    state.cameraFovMode = 'dynamic';
    state.cameraAutoCenter = true;
    state.graphicsQuality = 'ultra';
    state.mapLabels = true;
    state.hudVisibility = 'full';
    state.cameraShakeEnabled = true;
    state.showFps = false;
    state.underglowColor = 'cyan';
    state.controlsMode = 'tilt';
    state.activeVehicle = 'car';
    state.godMode = false;
    updateToggleStates();
    applyFpsCounter();
    applyHudVisibility();
    applyGraphicsQuality(map);
    if (map) setupTerrain(map);
    if (map) applyMapLabels(map);
    saveState();
    showToast('PREFERENCES RESET', 'All options restored to factory defaults.');
}

export function filterSpots(category) {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.spot-filter-chip').forEach((chip) => {
        chip.classList.toggle('active', chip.dataset.filter === category);
    });
    document.querySelectorAll('.spot-card').forEach((card) => {
        const spotCat = card.dataset.spotCategory;
        const visible = category === 'all' || spotCat === category;
        card.style.display = visible ? 'flex' : 'none';
    });
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
        const modalEl = typeof backdrop.querySelector === 'function' ? backdrop.querySelector('.pro-modal') : null;
        if (modalEl) modalEl.scrollTop = 0;
        state.isInputFocused = true;
        if (document.body && document.body.classList) {
            document.body.classList.remove('hide-cursor');
        }
        syncMapInteractions(activeMap);
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

        // Dynamically fetch and sync latest plans & checkout URLs from Supabase
        fetchGeoRidePlans()
            .then((plans) => {
                if (!plans || !Array.isArray(plans)) return;
                const monthlyPlan = plans.find((p) => (p.id || p.plan_id) === 'pro_monthly');
                const yearlyPlan = plans.find((p) => (p.id || p.plan_id) === 'pro_yearly');
                const lifetimePlan = plans.find((p) => (p.id || p.plan_id) === 'pro_lifetime');

                const monthlyBtn = document.getElementById('pro-modal-monthly-btn');
                if (monthlyBtn && monthlyPlan) {
                    if (monthlyPlan.checkout_url) monthlyBtn.href = monthlyPlan.checkout_url;
                    const priceEl = monthlyBtn.querySelector('.pro-plan-price');
                    const monthlyPrice = Number(monthlyPlan.price ?? monthlyPlan.price_usd);
                    if (priceEl && Number.isFinite(monthlyPrice) && monthlyPrice > 0) {
                        priceEl.innerHTML = `$${monthlyPrice.toFixed(2)} <span>/ mo</span>`;
                    }
                }

                const yearlyBtn = document.getElementById('pro-modal-yearly-btn');
                if (yearlyBtn && yearlyPlan) {
                    if (yearlyPlan.checkout_url) yearlyBtn.href = yearlyPlan.checkout_url;
                    const priceEl = yearlyBtn.querySelector('.pro-plan-price');
                    const yearlyPrice = Number(yearlyPlan.price ?? yearlyPlan.price_usd);
                    if (priceEl && Number.isFinite(yearlyPrice) && yearlyPrice > 0) {
                        priceEl.innerHTML = `$${yearlyPrice.toFixed(2)} <span>/ mo</span>`;
                    }
                }

                const lifetimeBtn = document.getElementById('pro-modal-lifetime-btn');
                if (lifetimeBtn && lifetimePlan) {
                    if (lifetimePlan.checkout_url) lifetimeBtn.href = lifetimePlan.checkout_url;
                    const priceEl = lifetimeBtn.querySelector('.pro-plan-price');
                    const lifetimePrice = Number(lifetimePlan.price ?? lifetimePlan.price_usd);
                    if (priceEl && Number.isFinite(lifetimePrice) && lifetimePrice > 0) {
                        priceEl.innerHTML = `<span class="price-strikethrough">$79.99</span> $${lifetimePrice.toFixed(2)} <span>once</span>`;
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

let activeToastTimeout = null;

export function showToast(title, message, options = {}) {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('toast-container');
    if (!container) return;

    const lowerTitle = (title || '').toLowerCase();
    let iconType = 'info';
    let variantClass = '';

    if (lowerTitle.includes('achievement')) {
        iconType = 'trophy';
        variantClass = options.isPro ? 'toast-pro' : 'toast-achievement';
    } else if (options.isPro || lowerTitle.includes('pro') || lowerTitle.includes('god mode')) {
        iconType = 'pro';
        variantClass = 'toast-pro';
    } else if (lowerTitle.includes('camera')) {
        iconType = 'camera';
        variantClass = 'toast-camera';
    } else if (lowerTitle.includes('radar') || lowerTitle.includes('speed')) {
        iconType = 'radar';
        variantClass = 'toast-radar';
    } else if (lowerTitle.includes('drift')) {
        iconType = 'drift';
        variantClass = 'toast-drift';
    } else if (lowerTitle.includes('setting') || lowerTitle.includes('export') || lowerTitle.includes('import')) {
        iconType = 'check';
        variantClass = 'toast-success';
    } else if (
        lowerTitle.includes('lost') ||
        lowerTitle.includes('full') ||
        lowerTitle.includes('error') ||
        lowerTitle.includes('busy') ||
        lowerTitle.includes('failed')
    ) {
        iconType = 'alert';
        variantClass = 'toast-alert';
    }

    // Fast-path: If an active toast with the same title exists (e.g. rapid camera cycling),
    // update its message in-place with a subtle pulse and refresh timer!
    const existing = container.querySelector('.toast-msg:not(.hide)');
    if (existing && existing.dataset.toastTitle === title) {
        const textEl = existing.querySelector('.toast-text');
        if (textEl) textEl.textContent = message || '';
        existing.classList.remove('toast-pulse');
        void existing.offsetWidth; // trigger reflow
        existing.classList.add('toast-pulse');

        if (activeToastTimeout) clearTimeout(activeToastTimeout);
        const duration = options.duration || (iconType === 'camera' ? 2000 : iconType === 'alert' ? 5000 : 2500);
        activeToastTimeout = setTimeout(() => {
            if (existing && existing.parentElement) {
                existing.classList.add('hide');
                setTimeout(() => existing.remove(), 260);
            }
        }, duration);
        return;
    }

    // Single active toast limit: dismiss older toasts gracefully so the screen stays clean
    const oldToasts = container.querySelectorAll('.toast-msg:not(.hide)');
    oldToasts.forEach((t) => {
        t.classList.add('hide');
        setTimeout(() => t.remove(), 260);
    });

    const toastPaths = {
        trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
        pro: '<path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/>',
        camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
        radar: '<circle cx="12" cy="12" r="9"/><path d="M12 12l4-2"/><circle cx="12" cy="12" r="2"/>',
        drift: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
        check: '<polyline points="19 7 10 17 5 12"/>',
        alert: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
    };
    const iconSvg = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${toastPaths[iconType] || '<circle cx="12" cy="12" r="9"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'}</svg>`;

    const toast = document.createElement('div');
    toast.className = `toast-msg ${variantClass}`.trim();
    toast.dataset.toastTitle = title;
    toast.innerHTML = `
        <div class="toast-icon">${iconSvg}</div>
        <div class="toast-body">
            <span class="toast-title">${title}</span>
            ${message ? `<span class="toast-sep">•</span><span class="toast-text">${message}</span>` : ''}
        </div>
        ${options.actionText ? `<button class="toast-action-btn">${options.actionText}</button>` : ''}
        <button class="toast-close-btn" aria-label="Close">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
    `;

    const closeBtn = toast.querySelector('.toast-close-btn');
    const dismiss = () => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 260);
    };
    if (closeBtn) {
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            dismiss();
        };
    }

    if (options.actionText && options.onAction) {
        const actionBtn = toast.querySelector('.toast-action-btn');
        if (actionBtn) {
            actionBtn.onclick = (e) => {
                e.stopPropagation();
                options.onAction();
                dismiss();
            };
        }
    }

    container.appendChild(toast);

    const defaultDuration =
        iconType === 'trophy' ? 10000 : iconType === 'camera' ? 2000 : iconType === 'alert' ? 5000 : 2500;
    const duration = options.duration || defaultDuration;

    if (activeToastTimeout) clearTimeout(activeToastTimeout);
    activeToastTimeout = setTimeout(() => {
        if (toast.parentElement) dismiss();
    }, duration);
}

let notificationsInitialized = false;
export function initGameNotifications() {
    if (notificationsInitialized || typeof window === 'undefined') return;
    notificationsInitialized = true;
    // Unsolicited spam loops and unsolicited marketing timers are permanently disabled
    // to keep the driving experience focused, clean, and distraction-free.
}

/* ==========================================================================
   PHOTO MODE (FOTO MOD) ENGINE
   ========================================================================== */

export const PHOTO_FILTERS = {
    none: 'none',
    cyberpunk: 'contrast(1.3) saturate(1.7) hue-rotate(-15deg)',
    warm: 'sepia(0.35) saturate(1.4) contrast(1.1) brightness(1.05)',
    noir: 'grayscale(1) contrast(1.45) brightness(0.95)',
    vivid: 'saturate(1.85) contrast(1.2)',
    vintage: 'sepia(0.28) contrast(0.92) brightness(1.05) saturate(1.25)'
};

export function applyPhotoFilter(filter) {
    const filterVal = PHOTO_FILTERS[filter] || 'none';
    const canvas = document.querySelector('#map canvas');
    if (canvas) {
        canvas.style.filter = filterVal;
    }
}

export function capturePhoto(map = activeMap) {
    if (!map) return;
    const canvas = map.getCanvas();
    if (!canvas) return;

    const flashEl = document.getElementById('photo-flash-overlay');
    if (flashEl) {
        flashEl.classList.remove('flash-anim');
        void flashEl.offsetWidth;
        flashEl.classList.add('flash-anim');
    }

    map.triggerRepaint();

    requestAnimationFrame(() => {
        try {
            const outCanvas = document.createElement('canvas');
            outCanvas.width = canvas.width;
            outCanvas.height = canvas.height;
            const ctx = outCanvas.getContext('2d');

            const filterCss = PHOTO_FILTERS[state.photoFilter] || 'none';
            if (filterCss !== 'none') {
                ctx.filter = filterCss;
            }
            ctx.drawImage(canvas, 0, 0);
            ctx.filter = 'none';

            if (state.photoWatermark !== false) {
                const pad = Math.round(outCanvas.width * 0.03);
                ctx.save();
                ctx.textAlign = 'right';
                ctx.textBaseline = 'bottom';
                ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
                ctx.shadowBlur = 12;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                ctx.font = `bold ${Math.round(outCanvas.width * 0.024)}px Rajdhani, sans-serif`;
                ctx.fillStyle = '#00f2ff';
                ctx.fillText(
                    'GEO RIDE',
                    outCanvas.width - pad,
                    outCanvas.height - pad - Math.round(outCanvas.width * 0.018)
                );

                ctx.font = `600 ${Math.round(outCanvas.width * 0.013)}px Outfit, sans-serif`;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                const subtitle = `3D SIMULATOR • ${new Date().toLocaleDateString()}`;
                ctx.fillText(subtitle, outCanvas.width - pad, outCanvas.height - pad);
                ctx.restore();
            }

            const dataUrl = outCanvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `georide-photo-${Date.now()}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showToast('PHOTO CAPTURED', 'Screenshot exported in full resolution!');
            if (haptics) haptics.success();
            trackEvent('photo_captured', {
                filter: state.photoFilter,
                watermark: state.photoWatermark
            });
            trackPhoto();
        } catch (err) {
            console.error('Photo capture error:', err);
            showToast('CAPTURE ERROR', 'Could not export screenshot.');
        }
    });
}

export function togglePhotoMode(forceState = null) {
    if (typeof document === 'undefined') return;
    const shouldBeOpen = forceState !== null ? Boolean(forceState) : !state.isPhotoMode;
    state.isPhotoMode = shouldBeOpen;

    const overlay = document.getElementById('photo-mode-overlay');
    const zoomSlider = document.getElementById('photo-zoom-slider');
    const pitchSlider = document.getElementById('photo-pitch-slider');
    const orbitSlider = document.getElementById('photo-orbit-slider');

    if (shouldBeOpen) {
        document.body?.classList.add('photo-mode-active');
        if (overlay) overlay.classList.add('active');
        pauseAudioForPhoto();

        if (activeMap) {
            if (zoomSlider) zoomSlider.value = activeMap.getZoom().toFixed(1);
            if (pitchSlider) pitchSlider.value = Math.round(activeMap.getPitch());
            if (orbitSlider) orbitSlider.value = Math.round(activeMap.getBearing());
        }

        showToast('PHOTO MODE', 'Physics paused. Frame your shot and capture! (P / ESC to exit)');
        trackEvent('open_photo_mode');
    } else {
        document.body?.classList.remove('photo-mode-active');
        if (overlay) overlay.classList.remove('active');
        applyPhotoFilter('none');
        resumeAudioFromPhoto();
        trackEvent('close_photo_mode');
    }
}

export function initPhotoMode(map) {
    if (typeof window !== 'undefined') {
        window.togglePhotoMode = togglePhotoMode;
        window.capturePhoto = capturePhoto;
    }

    const photoExitBtn = document.getElementById('photo-exit-btn');
    if (photoExitBtn) {
        photoExitBtn.onclick = () => {
            togglePhotoMode(false);
            if (haptics) haptics.tap();
        };
    }

    const photoCaptureBtn = document.getElementById('photo-capture-btn');
    if (photoCaptureBtn) {
        photoCaptureBtn.onclick = () => {
            capturePhoto(map);
        };
    }

    document.querySelectorAll('.photo-filter-chip').forEach((chip) => {
        chip.onclick = () => {
            const filter = chip.dataset.filter || 'none';
            state.photoFilter = filter;
            document.querySelectorAll('.photo-filter-chip').forEach((c) => c.classList.toggle('active', c === chip));
            applyPhotoFilter(filter);
            if (haptics) haptics.select();
        };
    });

    const gridBtn = document.getElementById('photo-grid-toggle');
    if (gridBtn) {
        gridBtn.onclick = () => {
            state.photoGrid = !state.photoGrid;
            gridBtn.classList.toggle('active', state.photoGrid);
            const gridEl = document.getElementById('photo-grid-overlay');
            if (gridEl) gridEl.style.display = state.photoGrid ? 'block' : 'none';
            if (haptics) haptics.select();
        };
    }

    const wmBtn = document.getElementById('photo-wm-toggle');
    if (wmBtn) {
        wmBtn.onclick = () => {
            state.photoWatermark = !state.photoWatermark;
            wmBtn.classList.toggle('active', state.photoWatermark);
            const wmPreview = document.getElementById('photo-watermark-preview');
            if (wmPreview) wmPreview.style.display = state.photoWatermark ? 'flex' : 'none';
            if (haptics) haptics.select();
        };
    }

    const zoomSlider = document.getElementById('photo-zoom-slider');
    if (zoomSlider) {
        zoomSlider.oninput = (e) => {
            if (map) map.setZoom(parseFloat(e.target.value));
        };
    }

    const pitchSlider = document.getElementById('photo-pitch-slider');
    if (pitchSlider) {
        pitchSlider.oninput = (e) => {
            if (map) map.setPitch(parseFloat(e.target.value));
        };
    }

    const orbitSlider = document.getElementById('photo-orbit-slider');
    if (orbitSlider) {
        orbitSlider.oninput = (e) => {
            if (map) map.setBearing(parseFloat(e.target.value));
        };
    }
}

/* ==========================================================================
   TUTORIAL MODAL (TUTORIJAL PRI PRVOM ULASKU)
   ========================================================================== */

let currentTutorialStep = 1;
const TOTAL_TUTORIAL_STEPS = 5;
const tutKeysDone = new Set();
let tutAdvanceTimer = null;
const TUT_TAGS = [
    'WELCOME BRIEFING',
    'STEP 1/4 • THROTTLE',
    'STEP 2/4 • STEERING',
    'STEP 3/4 • DRIFT',
    'STEP 4/4 • SYSTEMS'
];

function setTutProgress(step, pct, msg, done = false) {
    const bar = document.querySelector(`[data-tut-bar="${step}"]`);
    const statusEl = document.querySelector(`[data-tut-status="${step}"]`);
    if (bar) bar.style.width = `${pct}%`;
    if (statusEl && msg) {
        statusEl.textContent = msg;
        statusEl.classList.toggle('is-done', done);
    }
}

export function setTutorialStep(step) {
    if (tutAdvanceTimer) {
        clearTimeout(tutAdvanceTimer);
        tutAdvanceTimer = null;
    }
    currentTutorialStep = Math.max(1, Math.min(TOTAL_TUTORIAL_STEPS, step));
    document.querySelectorAll('.tutorial-slide').forEach((slide) => {
        slide.classList.toggle('active', Number(slide.dataset.step) === currentTutorialStep);
    });
    document.querySelectorAll('.tutorial-dot').forEach((dot) => {
        dot.classList.toggle('active', Number(dot.dataset.step) === currentTutorialStep);
    });
    const tag = document.getElementById('tutorial-step-tag');
    if (tag) tag.textContent = TUT_TAGS[currentTutorialStep - 1] || '';

    const prevBtn = document.getElementById('tutorial-prev-btn');
    const nextBtn = document.getElementById('tutorial-next-btn');
    if (prevBtn) prevBtn.style.display = currentTutorialStep === 1 ? 'none' : 'inline-flex';
    if (nextBtn) {
        nextBtn.textContent = currentTutorialStep === TOTAL_TUTORIAL_STEPS ? 'DONE' : 'SKIP';
    }
}

function handleTutorialInput(rawKey) {
    if (tutAdvanceTimer) return;
    const map = { arrowup: 'w', arrowdown: 's', arrowleft: 'a', arrowright: 'd', ' ': 'space', enter: 'start' };
    let k = map[rawKey] || rawKey;
    if (currentTutorialStep === 1 && k === 'w') k = 'start';
    const slide = document.querySelector(`.tutorial-slide[data-step="${currentTutorialStep}"]`);
    const btn = slide?.querySelector?.(`[data-tut-key="${k}"]`);
    if (!btn) return;

    btn.classList.add('is-done');
    if (haptics) haptics.tap();

    const advance = (next) => {
        if (haptics) haptics.success();
        tutAdvanceTimer = setTimeout(() => {
            tutAdvanceTimer = null;
            if (next > TOTAL_TUTORIAL_STEPS) closeTutorialModal();
            else setTutorialStep(next);
        }, 520);
    };

    if (currentTutorialStep === 1 && k === 'start') {
        setTutProgress(1, 100, 'STARTING LIVE TRAINING...', true);
        advance(2);
    } else if (currentTutorialStep === 2 && k === 'w') {
        setTutProgress(2, 100, 'THROTTLE ENGAGED!', true);
        advance(3);
    } else if (currentTutorialStep === 3 && (k === 'a' || k === 'd')) {
        tutKeysDone.add(k);
        if (tutKeysDone.has('a') && tutKeysDone.has('d')) {
            setTutProgress(3, 100, 'STEERING CALIBRATED!', true);
            advance(4);
        } else {
            setTutProgress(3, 50, k === 'a' ? 'LEFT OK - NOW PRESS [D]' : 'RIGHT OK - NOW PRESS [A]');
        }
    } else if (currentTutorialStep === 4 && k === 'space') {
        playDriftBankSound?.(1);
        setTutProgress(4, 100, 'DRIFT SYSTEM READY!', true);
        advance(5);
    } else if (currentTutorialStep === 5 && (k === 'c' || k === 'r')) {
        setTutProgress(5, 100, 'ALL SET - ENJOY THE RIDE!', true);
        advance(6);
    }
}

export function openTutorialModal() {
    if (typeof document === 'undefined') return;
    const backdrop = document.getElementById('tutorial-modal-backdrop');
    if (backdrop) {
        tutKeysDone.clear();
        document.querySelectorAll('.tut-key-btn').forEach((b) => b.classList?.remove?.('is-done'));
        setTutProgress(1, 0, 'PRESS [W] OR CLICK START');
        setTutProgress(2, 0, 'WAITING FOR [W] THROTTLE...');
        setTutProgress(3, 0, 'PRESS [A] AND [D]');
        setTutProgress(4, 0, 'WAITING FOR [SPACEBAR]...');
        setTutProgress(5, 0, 'PRESS [C] OR [R] TO FINISH');
        backdrop.classList.add('active');
        setTutorialStep(1);
        trackEvent('tutorial_opened');
    }
}

export function closeTutorialModal() {
    if (typeof document === 'undefined') return;
    if (tutAdvanceTimer) {
        clearTimeout(tutAdvanceTimer);
        tutAdvanceTimer = null;
    }
    const backdrop = document.getElementById('tutorial-modal-backdrop');
    if (backdrop) {
        backdrop.classList.remove('active');
        const dontShow = document.getElementById('tutorial-dont-show-cb');
        if (!dontShow || dontShow.checked) {
            localStorage.setItem('geo_ride_tutorial_seen', 'true');
        }
        trackEvent('tutorial_closed');
    }
}

export function initTutorialModal() {
    if (typeof window !== 'undefined') {
        window.openTutorialModal = openTutorialModal;
        window.closeTutorialModal = closeTutorialModal;
    }

    const backdrop = document.getElementById('tutorial-modal-backdrop');
    if (!backdrop) return;

    const closeBtn = document.getElementById('tutorial-close-btn');
    if (closeBtn) closeBtn.onclick = () => closeTutorialModal();

    const prevBtn = document.getElementById('tutorial-prev-btn');
    if (prevBtn) {
        prevBtn.onclick = () => {
            setTutorialStep(currentTutorialStep - 1);
            if (haptics) haptics.select();
        };
    }

    const nextBtn = document.getElementById('tutorial-next-btn');
    if (nextBtn) {
        nextBtn.onclick = () => {
            if (currentTutorialStep === TOTAL_TUTORIAL_STEPS) {
                closeTutorialModal();
                if (haptics) haptics.success();
            } else {
                setTutorialStep(currentTutorialStep + 1);
                if (haptics) haptics.select();
            }
        };
    }

    document.querySelectorAll('.tutorial-dot').forEach((dot) => {
        dot.onclick = () => {
            setTutorialStep(Number(dot.dataset.step));
            if (haptics) haptics.select();
        };
    });

    document.querySelectorAll('.tut-key-btn').forEach((btn) => {
        btn.onclick = () => handleTutorialInput(btn.dataset.tutKey);
    });

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('keydown', (e) => {
            if (!backdrop.classList.contains('active') || state.isInputFocused || state.isSettingsOpen) return;
            const k = (e.key || '').toLowerCase();
            if (k === 'escape') {
                closeTutorialModal();
                return;
            }
            handleTutorialInput(k);
        });
    }

    const replayBtn = document.getElementById('settings-replay-tutorial-btn');
    if (replayBtn) {
        replayBtn.onclick = () => {
            closeSettings();
            openTutorialModal();
        };
    }

    // Auto-launch tutorial on first visit
    try {
        const tutorialSeen = localStorage.getItem('geo_ride_tutorial_seen');
        if (!tutorialSeen) {
            setTimeout(() => {
                openTutorialModal();
            }, 900);
        }
    } catch (_e) {}
}
/* --------------------------------------------------------------------------
   Pilot profile, challenges, ranks and achievements
   -------------------------------------------------------------------------- */

let profileApi = null;
let profileLoading = null;
let progressUiStarted = false;

function loadProfileModule() {
    if (profileApi) return Promise.resolve(profileApi);
    if (!profileLoading) {
        profileLoading = import('./profile-ui.js').then((mod) => {
            profileApi = mod;
            return mod;
        });
    }
    return profileLoading;
}

export async function openProfile(tab = 'profile') {
    if (typeof document === 'undefined') return;
    if (state.isPhotoMode) togglePhotoMode(false);
    openSettings('career');
    const subtab = tab === 'career' ? 'profile' : tab;
    loadProfileModule()
        .then((mod) => {
            const panel = document.getElementById('settings-panel');
            if (panel) mod.initSettingsPilotHub(panel);
            mod.renderSettingsCareerTab(subtab);
        })
        .catch(() => {});
}

export function closeProfile() {
    closeSettings();
}

function updateProfileChip() {
    if (typeof document === 'undefined' || !document || typeof document.getElementById !== 'function') return;
    const chip = document.getElementById('profile-level-chip');
    if (!chip) return;
    chip.textContent = String(getProgressSnapshot().level.level);
    chip.classList.toggle('is-pro', !!state.isPro);
}

function handleProgressEvent(ev) {
    switch (ev.type) {
        case 'challenge':
            showToast(
                ev.scope === 'weekly' ? 'WEEKLY CLEARED' : 'DAILY CLEARED',
                `${describeChallenge(ev.item)} (+${ev.xp} XP)`,
                { duration: 4000, isPro: ev.bonus }
            );
            if (haptics) haptics.success();
            break;
        case 'achievement':
            showToast('ACHIEVEMENT UNLOCKED', `${ev.def.name} (+${ev.xp} XP)`, {
                duration: 10000,
                isPro: ev.def.tier === 'pro'
            });
            if (haptics) haptics.success();
            break;
        case 'level':
            showToast('LEVEL UP', `Level ${ev.level}: ${ev.title}`, { duration: 4500 });
            updateProfileChip();
            break;
        case 'streak':
            if (ev.count > 1)
                showToast('STREAK', `${ev.count} day streak. Keep it alive tomorrow.`, { duration: 3500 });
            break;
        case 'freeze':
            showToast('PRO STREAK FREEZE', 'A missed day was forgiven. Your streak is safe.', { isPro: true });
            break;
        case 'proReady':
            showToast('PRO REWARD READY', `${ev.name} is complete. Go Pro to claim it.`, {
                duration: 5500,
                isPro: true
            });
            break;
        default:
            break;
    }
    if (profileApi?.refreshSettingsPilotHubIfOpen) profileApi.refreshSettingsPilotHubIfOpen();
}

function initProgressUI() {
    if (typeof document === 'undefined' || !document || progressUiStarted) return;
    progressUiStarted = true;
    loadProgress();
    updateProfileChip();

    const settingsPanel = document.getElementById('settings-panel');
    if (settingsPanel) {
        loadProfileModule()
            .then((mod) => mod.initSettingsPilotHub(settingsPanel))
            .catch(() => {});
    }

    onProgressEvent(handleProgressEvent);
    if (typeof window !== 'undefined') {
        window.openProfile = openProfile;
        // Warm up the pilot hub module during idle so first open is instant
        const warmUp = () => loadProfileModule().catch(() => {});
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(warmUp, { timeout: 2000 });
        } else {
            setTimeout(warmUp, 800);
        }
    }

    const isTest = typeof process !== 'undefined' && Boolean(process.versions?.node);
    if (!isTest) {
        cloudSync({ pullFirst: true })
            .then((r) => {
                if (r?.ok) {
                    updateProfileChip();
                    updateToggleStates();
                    if (profileApi?.refreshSettingsPilotHubIfOpen) profileApi.refreshSettingsPilotHubIfOpen();
                }
            })
            .catch(() => {});
        let seconds = 0;
        const secondTimer = setInterval(() => {
            if (typeof document === 'undefined' || !document || typeof document.getElementById !== 'function') return;
            seconds += 1;
            const isHidden = typeof document !== 'undefined' && Boolean(document.hidden);
            progressTick(!!state.loopStarted && !state.isPhotoMode && !isHidden);
            if (seconds % 5 === 0) {
                updateProfileChip();
            }
        }, 1000);
        const submitTimer = setInterval(() => {
            if (typeof document === 'undefined' || !document) return;
            submitProgress();
            cloudSync().catch(() => {});
        }, 30000);
        if (typeof secondTimer?.unref === 'function') secondTimer.unref();
        if (typeof submitTimer?.unref === 'function') submitTimer.unref();
    }

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                saveProgress();
                submitProgress({ force: true });
                cloudSync().catch(() => {});
            }
        });
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('pagehide', saveProgress);
    }
    subscribeState('isPro', () => {
        evaluateProgress();
        updateProfileChip();
    });
}
