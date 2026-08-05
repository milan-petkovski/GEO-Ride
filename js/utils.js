/**
 * @file utils.js
 * @description Helper functions for Mapbox map layer cleanup, progress bar DOM updates, and skidmark GeoJSON rendering.
 */

/**
 * Removes cluttering POI and transit symbols from Mapbox style to improve visual clarity.
 * @param {Object} map - Mapbox GL JS map instance.
 * @returns {void}
 */
export function cleanMap(map) {
    if (!map || typeof map.getStyle !== 'function') return;
    const style = map.getStyle();
    if (!style || !Array.isArray(style.layers)) return;

    style.layers.forEach((layer) => {
        if (
            layer.type === 'symbol' &&
            (layer.id.includes('poi') ||
                layer.id.includes('transit') ||
                layer.id.includes('business') ||
                layer.id.includes('place-label'))
        ) {
            map.setLayoutProperty(layer.id, 'visibility', 'none');
        }
    });
}

/**
 * Sets visual loading progress bar percentage.
 * @param {number} p - Percentage value (0-100).
 * @returns {void}
 */
export function setProgress(p) {
    if (window.setLoadingTarget) {
        window.setLoadingTarget(p);
    } else {
        const progressBar = document.getElementById('progress-bar');
        const clamped = Math.max(0, Math.min(p, 100));
        if (progressBar) {
            progressBar.style.width = `${clamped.toFixed(1)}%`;
        }
    }
}

/**
 * Adds skidmarks GeoJSON source and line layer to Mapbox map.
 * @param {Object} map - Mapbox GL JS map instance.
 * @returns {void}
 */
export function addSkidMarksLayer(map) {
    if (!map || typeof map.getSource !== 'function') return;
    if (!map.getSource('skid-marks')) {
        map.addSource('skid-marks', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
    }
    if (!map.getLayer('skid-marks-layer')) {
        map.addLayer({
            id: 'skid-marks-layer',
            type: 'line',
            source: 'skid-marks',
            paint: {
                'line-color': '#050505',
                'line-width': ['interpolate', ['linear'], ['zoom'], 14, 1.5, 18, 4, 22, 10],
                'line-blur': ['interpolate', ['linear'], ['zoom'], 14, 0, 18, 1, 22, 3],
                'line-opacity': ['get', 'opacity']
            }
        });
    }
}
