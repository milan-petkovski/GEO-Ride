/**
 * @file discovery.js
 * @description Location discovery engine performing throttled, cached reverse-geocoding requests to Mapbox Places API and triggering cinematic HUD location banners when entering new cities.
 */

let lastDiscoveredCity = null;
let lastCheckTime = 0;
let lastCheckedLng = null;
let lastCheckedLat = null;
let isDiscovering = false;

/** @type {Map<string, {cityName: string, countryName: string}>} */
export const discoveryCache = new Map();

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
 * Checks current geographic coordinates via cached Mapbox Reverse Geocoding and displays location discovery cinematic UI.
 * Enforces a minimum 5km movement threshold and 2-minute throttling window to minimize API usage.
 * @param {number} lng - Current longitude coordinate.
 * @param {number} lat - Current latitude coordinate.
 * @param {boolean} [force=false] - Force check bypassing throttling interval and distance thresholds.
 * @returns {void}
 */
export function checkDiscovery(lng, lat, force = false) {
    // Only proceed if mapbox token is available and we aren't already checking
    if (!window.mapboxgl || !window.mapboxgl.accessToken || isDiscovering) return;
    if (typeof lng !== 'number' || typeof lat !== 'number' || isNaN(lng) || isNaN(lat)) return;

    const gridKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;

    // 1. Fast path: Check memory grid cache
    if (discoveryCache.has(gridKey)) {
        const cached = discoveryCache.get(gridKey);
        if (cached && cached.cityName && cached.cityName !== lastDiscoveredCity) {
            lastDiscoveredCity = cached.cityName;
            showDiscoveryCinematic(cached.cityName, cached.countryName);
        }
        return;
    }

    const now = Date.now();

    // 2. Throttling: Enforce 2 minutes (120,000ms) between network calls unless forced
    if (!force && now - lastCheckTime < 120000) return;

    // 3. Distance check: Only check if vehicle moved at least 5km from last checked point
    if (!force && lastCheckedLng !== null && lastCheckedLat !== null) {
        const distKm = calculateDistanceKm(lastCheckedLat, lastCheckedLng, lat, lng);
        if (distKm < 5.0) return;
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

                // If it's a new city we haven't discovered yet during this session
                if (cityName && cityName !== lastDiscoveredCity) {
                    lastDiscoveredCity = cityName;
                    showDiscoveryCinematic(cityName, countryName);
                }
            } else {
                discoveryCache.set(gridKey, { cityName: '', countryName: '' });
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
 * @returns {void}
 */
export function showDiscoveryCinematic(city, country) {
    if (typeof document === 'undefined') return;
    const overlay = document.getElementById('location-discovery');

    const titleEl = document.getElementById('discovery-title');
    const countryEl = document.getElementById('discovery-country');

    if (!overlay || !titleEl) return;

    titleEl.textContent = city;
    if (countryEl) {
        countryEl.textContent = country;
        countryEl.style.display = country ? 'block' : 'none';
    }

    overlay.classList.add('show');

    // Auto-hide the cinematic after 3 seconds
    setTimeout(() => {
        overlay.classList.remove('show');
    }, 3000);
}
