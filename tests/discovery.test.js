import test from 'node:test';
import assert from 'node:assert/strict';
import {
    parseGeocodingFeature,
    checkDiscovery,
    showDiscoveryCinematic,
    calculateDistanceKm,
    discoveryCache,
    clearDiscoveryCache
} from '../js/discovery.js';

test('calculateDistanceKm - computes approximate distance accurately', () => {
    // Distance between same coordinates is 0
    const zeroDist = calculateDistanceKm(44.81, 20.46, 44.81, 20.46);
    assert.strictEqual(Math.round(zeroDist), 0);

    // Belgrade (44.8176, 20.4633) to Novi Sad (45.2671, 19.8335) ~ 70km
    const bgToNs = calculateDistanceKm(44.8176, 20.4633, 45.2671, 19.8335);
    assert.ok(bgToNs > 65 && bgToNs < 80);
});

test('parseGeocodingFeature - extracts city and country correctly', () => {
    const mockFeature = {
        text: 'Belgrade',
        context: [
            { id: 'district.123', text: 'Stari Grad' },
            { id: 'country.456', text: 'Serbia' }
        ]
    };

    const result = parseGeocodingFeature(mockFeature);
    assert.strictEqual(result.cityName, 'Belgrade');
    assert.strictEqual(result.countryName, 'Serbia');
});

test('parseGeocodingFeature - converts Savski Venac to Belgrade Waterfront', () => {
    const mockFeature = { text: 'Savski Venac', context: [] };
    const result = parseGeocodingFeature(mockFeature);
    assert.strictEqual(result.cityName, 'Belgrade Waterfront');
});

test('parseGeocodingFeature - handles missing context or null inputs gracefully', () => {
    assert.deepEqual(parseGeocodingFeature(null), { cityName: '', countryName: '' });
    assert.deepEqual(parseGeocodingFeature({}), { cityName: '', countryName: '' });
});

test('showDiscoveryCinematic updates DOM elements and displays overlay', () => {
    const mockOverlay = { classList: { add() {}, remove() {} } };
    const mockTitle = { textContent: '' };
    const mockCountry = { textContent: '', style: { display: 'none' } };

    const origDoc = globalThis.document;
    globalThis.document = {
        getElementById(id) {
            if (id === 'location-discovery') return mockOverlay;
            if (id === 'discovery-title') return mockTitle;
            if (id === 'discovery-country') return mockCountry;
            return null;
        }
    };

    showDiscoveryCinematic('Tokyo', 'Japan');

    assert.strictEqual(mockTitle.textContent, 'Tokyo');
    assert.strictEqual(mockCountry.textContent, 'Japan');
    assert.strictEqual(mockCountry.style.display, 'block');

    globalThis.document = origDoc;
});

test('checkDiscovery fetches reverse geocoding API and triggers cinematic', async () => {
    let fetchedUrl = null;
    const origFetch = globalThis.fetch;
    const origWindow = globalThis.window;

    globalThis.window = globalThis.window || {};
    globalThis.window.mapboxgl = { accessToken: 'test_mapbox_token' };

    globalThis.fetch = async (url) => {
        fetchedUrl = url;
        return {
            json: async () => ({
                features: [
                    {
                        text: 'Paris',
                        context: [{ id: 'country.1', text: 'France' }]
                    }
                ]
            })
        };
    };

    checkDiscovery(2.35, 48.85, true);

    // Allow promise tick to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.strictEqual(fetchedUrl.includes('mapbox.places/2.35,48.85.json'), true);
    assert.strictEqual(fetchedUrl.includes('access_token=test_mapbox_token'), true);

    // Cache hit test: Calling same coordinates should NOT trigger fetch again
    fetchedUrl = null;
    checkDiscovery(2.35, 48.85, true);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.strictEqual(fetchedUrl, null); // Fetched is null because it was served from discoveryCache!

    // Distance/Time throttle test: Moving less than 5km without force should NOT trigger fetch
    clearDiscoveryCache();
    fetchedUrl = null;
    checkDiscovery(10.0, 50.0, true); // First forced check sets lastChecked coordinates
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.ok(fetchedUrl !== null);

    // Small movement (0.001 deg ~ 100m) without force should be skipped
    fetchedUrl = null;
    checkDiscovery(10.001, 50.001, false);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.strictEqual(fetchedUrl, null);

    globalThis.fetch = origFetch;
    globalThis.window = origWindow;
});
