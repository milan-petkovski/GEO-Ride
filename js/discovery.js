/**
 * @file discovery.js
 * @description Location discovery engine performing reverse-geocoding requests to Mapbox Place API and triggering cinematic HUD location banners when entering new cities.
 */

let lastDiscoveredCity = null;
let lastCheckTime = 0;
let isDiscovering = false;

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
 * Checks current geographic coordinates via Mapbox Reverse Geocoding and displays location discovery cinematic UI.
 * @param {number} lng - Current longitude coordinate.
 * @param {number} lat - Current latitude coordinate.
 * @param {boolean} [force=false] - Force check bypassing throttling interval.
 * @returns {void}
 */
export function checkDiscovery(lng, lat, force = false) {
    // Only proceed if mapbox token is available and we aren't already checking
    if (!window.mapboxgl || !window.mapboxgl.accessToken || isDiscovering) return;

    const now = Date.now();
    // Only check every 10 seconds normally, unless forced (e.g. after teleport)
    if (!force && now - lastCheckTime < 10000) return;

    lastCheckTime = now;
    isDiscovering = true;

    // Reverse geocode to find the current city/locality
    fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place,locality&access_token=${window.mapboxgl.accessToken}`
    )
        .then((res) => res.json())
        .then((data) => {
            isDiscovering = false;
            if (data.features && data.features.length > 0) {
                const { cityName, countryName } = parseGeocodingFeature(data.features[0]);

                // If it's a new city we haven't discovered yet during this session
                if (cityName && cityName !== lastDiscoveredCity) {
                    lastDiscoveredCity = cityName;
                    showDiscoveryCinematic(cityName, countryName);
                }
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
