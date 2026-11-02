/**
 * @file discovery.js
 * @description Location discovery engine performing throttled, cached reverse-geocoding requests to Mapbox Places API and triggering cinematic HUD location banners when entering new cities.
 */

import { trackEvent } from './analytics.js';
import { getSnapshot } from './progress.js';

let lastDiscoveredCity = null;
let lastCheckTime = 0;
let lastCheckedLng = null;
let lastCheckedLat = null;
let isDiscovering = false;

/** @type {Map<string, {cityName: string, countryName: string}>} */
export const discoveryCache = new Map();

const DISCOVERY_CACHE_KEY = 'geo_ride_discovery_cache_v2';

/**
 * Pre-seeded in-game locations and famous circuits to eliminate Mapbox Geocoding API usage on spawn and hot spots.
 */
export const PRESEEDED_SPOTS = [
    { name: 'Belgrade Waterfront', country: 'Serbia', lng: 20.449425, lat: 44.809684, radiusKm: 0.8 },
    { name: 'Tokyo Shuto Expressway', country: 'Japan', lng: 139.7563, lat: 35.6329, radiusKm: 15 },
    { name: 'Monaco GP Marina Circuit', country: 'Monaco', lng: 7.4206, lat: 43.7347, radiusKm: 10 },
    { name: 'Nürburgring Nordschleife', country: 'Germany', lng: 6.9475, lat: 50.3341, radiusKm: 12 },
    { name: 'Silverstone Grand Prix Circuit', country: 'UK', lng: -1.0169, lat: 52.0786, radiusKm: 10 },
    { name: 'Circuit de Spa-Francorchamps', country: 'Belgium', lng: 5.9714, lat: 50.4372, radiusKm: 10 },
    { name: 'Laguna Seca Raceway', country: 'USA', lng: -121.758, lat: 36.5843, radiusKm: 10 },
    { name: 'Stelvio Pass', country: 'Italy', lng: 10.4533, lat: 46.5286, radiusKm: 12 },
    { name: 'Transfăgărășan Mountain Highway', country: 'Romania', lng: 24.6167, lat: 45.5992, radiusKm: 15 },
    { name: 'Mount Haruna (Akina)', country: 'Japan', lng: 138.8833, lat: 36.4722, radiusKm: 12 },
    { name: 'Pikes Peak Highway', country: 'USA', lng: -105.0444, lat: 38.8405, radiusKm: 15 },
    { name: 'Route 66 Historic Highway', country: 'USA', lng: -98.9644, lat: 35.5342, radiusKm: 15 },
    { name: 'Amalfi Coast Highway', country: 'Italy', lng: 14.6027, lat: 40.634, radiusKm: 12 },
    { name: 'Isle of Man TT Course', country: 'Isle of Man', lng: -4.4817, lat: 54.1667, radiusKm: 15 },
    { name: 'Circuit de la Sarthe (Le Mans)', country: 'France', lng: 0.2075, lat: 47.9542, radiusKm: 12 },
    { name: 'Tail of the Dragon', country: 'USA', lng: -83.9208, lat: 35.5186, radiusKm: 12 },
    { name: 'Suzuka International Circuit', country: 'Japan', lng: 136.5337, lat: 34.8431, radiusKm: 10 },
    { name: 'Mount Fuji Skyline', country: 'Japan', lng: 138.7274, lat: 35.3606, radiusKm: 15 }
];

/**
 * Checks if geographic coordinates match any pre-seeded track or landmark to prevent external API calls.
 * @param {number} lng
 * @param {number} lat
 * @returns {{cityName: string, countryName: string}|null}
 */
export function findPreseededSpot(lng, lat) {
    for (let i = 0; i < PRESEEDED_SPOTS.length; i++) {
        const spot = PRESEEDED_SPOTS[i];
        const dist = calculateDistanceKm(lat, lng, spot.lat, spot.lng);
        if (dist <= spot.radiusKm) {
            return { cityName: spot.name, countryName: spot.country };
        }
    }
    return null;
}

/**
 * Loads persistent reverse-geocoding cache from localStorage.
 */
function loadPersistentDiscoveryCache() {
    try {
        if (typeof localStorage === 'undefined') return;
        const legacy = localStorage.getItem('geo_ride_discovery_cache');
        if (legacy) {
            localStorage.removeItem('geo_ride_discovery_cache');
        }
        const saved = localStorage.getItem(DISCOVERY_CACHE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') {
                Object.entries(parsed).forEach(([k, v]) => {
                    if (v && typeof v.cityName === 'string') {
                        if (v.cityName === 'Belgrade Waterfront') {
                            const [cLat, cLng] = k.split(',').map(Number);
                            if (
                                isNaN(cLat) ||
                                isNaN(cLng) ||
                                calculateDistanceKm(cLat, cLng, 44.809684, 20.449425) > 0.8
                            ) {
                                return;
                            }
                        }
                        discoveryCache.set(k, v);
                    }
                });
            }
        }
    } catch (_e) {}
}

/**
 * Persists discovery cache to localStorage with size capping.
 */
function savePersistentDiscoveryCache() {
    try {
        if (typeof localStorage === 'undefined') return;
        const entries = Array.from(discoveryCache.entries()).slice(-300);
        localStorage.setItem(DISCOVERY_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch (_e) {}
}

loadPersistentDiscoveryCache();

/**
 * Resets discovery cache and state trackers (useful for tests and resets).
 */
export function clearDiscoveryCache() {
    discoveryCache.clear();
    lastDiscoveredCity = null;
    lastCheckTime = 0;
    lastCheckedLng = null;
    lastCheckedLat = null;
    isDiscovering = false;
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(DISCOVERY_CACHE_KEY);
        }
    } catch (_e) {}
}

/**
 * Calculates approximate great-circle distance between two coordinates in kilometers.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in kilometers
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Extracts normalized city and country names from Mapbox Geocoding API feature payloads.
 * @param {Object} place - Mapbox GeoJSON feature object.
 * @returns {{cityName: string, countryName: string}} Extracted location names.
 */
export function parseGeocodingFeature(place) {
    if (!place || typeof place !== 'object') return { cityName: '', countryName: '' };
    const cityName = place.text || '';
    let countryName = '';
    if (place.context && Array.isArray(place.context)) {
        const countryCtx = place.context.find((c) => c && typeof c.id === 'string' && c.id.startsWith('country'));
        if (countryCtx) countryName = countryCtx.text || '';
    }
    let finalCityName = cityName;
    if (finalCityName && finalCityName.toLowerCase() === 'savski venac') {
        finalCityName = 'Belgrade Waterfront';
    }
    return { cityName: finalCityName, countryName };
}

/**
 * Returns whether dynamic cruising discovery is unlocked (Level 10+ or Pro).
 * @returns {boolean}
 */
export function isDiscoveryUnlocked() {
    try {
        const snap = getSnapshot();
        return Boolean(snap?.isPro || (snap?.level?.level && snap.level.level >= 10));
    } catch {
        return false;
    }
}

/**
 * Checks current geographic coordinates via cached Mapbox Reverse Geocoding and displays location discovery cinematic UI.
 * - Free users: Discovery runs ONLY on initial load, reset, and teleport (force = true). Free cruising is completely disabled.
 * - Pro / Level 10+ users: Cruising discovery triggers INSTANTLY when entering new cities/areas with minimal throttling.
 * @param {number} lng - Current longitude coordinate.
 * @param {number} lat - Current latitude coordinate.
 * @param {boolean} [force=false] - Force check bypassing throttling interval and distance thresholds.
 * @returns {void}
 */
export function checkDiscovery(lng, lat, force = false) {
    if (typeof window === 'undefined') return;
    if (!window.mapboxgl || !window.mapboxgl.accessToken || isDiscovering) return;
    if (typeof lng !== 'number' || typeof lat !== 'number' || isNaN(lng) || isNaN(lat)) return;

    // Slobodna vožnja (force = false): strogo blokirana za free korisnike ispod nivoa 10.
    // Za free korisnike otkrivanje radi isključivo na: početno učitavanje, reset i teleport (force = true).
    if (!force && !isDiscoveryUnlocked()) return;

    const gridKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;

    // 1. Fast path: Check memory & persistent grid cache (instant 0ms)
    if (discoveryCache.has(gridKey)) {
        const cached = discoveryCache.get(gridKey);
        if (cached && cached.cityName && cached.cityName !== lastDiscoveredCity) {
            lastDiscoveredCity = cached.cityName;
            showDiscoveryCinematic(cached.cityName, cached.countryName);
        }
        return;
    }

    // 2. Pre-seeded spots check (Belgrade Waterfront & 17 famous circuits/passes) - instant bez API poziva
    const preseeded = findPreseededSpot(lng, lat);
    if (preseeded) {
        discoveryCache.set(gridKey, preseeded);
        savePersistentDiscoveryCache();
        if (preseeded.cityName && preseeded.cityName !== lastDiscoveredCity) {
            lastDiscoveredCity = preseeded.cityName;
            showDiscoveryCinematic(preseeded.cityName, preseeded.countryName);
        }
        return;
    }

    const now = Date.now();

    // 3. Za Pro/otključane korisnike: u slobodnoj vožnji radi INSTANT (minimalna pauza od 3s da se ne preklapaju fetch zahtevi)
    if (!force && now - lastCheckTime < 3000) return;

    // 4. Zahteva se kretanje od najmanje 2.5 km od prethodno proverene tačke
    if (!force && lastCheckedLng !== null && lastCheckedLat !== null) {
        const distKm = calculateDistanceKm(lastCheckedLat, lastCheckedLng, lat, lng);
        if (distKm < 2.5) return;
    }

    lastCheckTime = now;
    lastCheckedLng = lng;
    lastCheckedLat = lat;
    isDiscovering = true;

    // Reverse geocode to find the current city/locality (limit=1 for minimal payload)
    fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place,locality&limit=1&access_token=${window.mapboxgl.accessToken}`
    )
        .then((res) => res.json())
        .then((data) => {
            isDiscovering = false;
            if (data.features && data.features.length > 0) {
                const { cityName, countryName } = parseGeocodingFeature(data.features[0]);
                discoveryCache.set(gridKey, { cityName, countryName });
                savePersistentDiscoveryCache();

                // If it's a new city we haven't discovered yet during this session
                if (cityName && cityName !== lastDiscoveredCity) {
                    lastDiscoveredCity = cityName;
                    showDiscoveryCinematic(cityName, countryName);
                }
            } else {
                discoveryCache.set(gridKey, { cityName: '', countryName: '' });
                savePersistentDiscoveryCache();
            }
        })
        .catch((err) => {
            isDiscovering = false;
            console.error('Discovery reverse-geocoding error:', err);
        });
}

/**
 * Renders location discovery banner overlay in HUD.
 * @param {string} city - Name of discovered city.
 * @param {string} country - Name of country.
 * @param {string} [subtitle='ARRIVED AT'] - Subtitle label above city name.
 * @returns {void}
 */
export function showDiscoveryCinematic(city, country, subtitle = 'ARRIVED AT') {
    if (typeof document === 'undefined') return;
    const overlay = document.getElementById('location-discovery');

    const titleEl = document.getElementById('discovery-title');
    const countryEl = document.getElementById('discovery-country');
    const subtitleEl =
        typeof overlay?.querySelector === 'function' ? overlay.querySelector('.discovery-subtitle') : null;

    if (!overlay || !titleEl) return;

    if (subtitleEl && subtitle) {
        subtitleEl.textContent = subtitle;
    }
    titleEl.textContent = city;
    if (countryEl) {
        countryEl.textContent = country;
        countryEl.style.display = country ? 'block' : 'none';
    }

    overlay.classList.remove('hidden');
    overlay.classList.add('show');
    trackEvent('location_discovered', { city, country: country || '' });

    // Auto-hide the cinematic after 3.5 seconds
    if (overlay._hideTimeout) clearTimeout(overlay._hideTimeout);
    overlay._hideTimeout = setTimeout(() => {
        overlay.classList.remove('show');
    }, 3500);
}
