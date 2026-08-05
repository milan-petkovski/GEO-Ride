import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGeocodingFeature, checkDiscovery, showDiscoveryCinematic } from '../js/discovery.js';

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

    globalThis.fetch = origFetch;
    globalThis.window = origWindow;
});
