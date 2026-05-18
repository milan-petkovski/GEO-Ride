import { state } from './state.js';

export function cleanMap(map) {
    const style = map.getStyle();
    if (!style) return;

    style.layers.forEach(layer => {
        if (layer.type === 'symbol' &&
            (layer.id.includes('poi') ||
                layer.id.includes('transit') ||
                layer.id.includes('business') ||
                layer.id.includes('place-label'))) {
            map.setLayoutProperty(layer.id, 'visibility', 'none');
        }
    });
}

export function setProgress(p) {
    const progressBar = document.getElementById('progress-bar');
    const clamped = Math.max(0, Math.min(p, 100));
    if (progressBar) {
        progressBar.style.width = `${clamped.toFixed(1)}%`;
    }
}

export function addSkidMarksLayer(map) {
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
                'line-width': [
                    'interpolate', ['linear'], ['zoom'],
                    14, 1.5,
                    18, 4,
                    22, 10
                ],
                'line-blur': [
                    'interpolate', ['linear'], ['zoom'],
                    14, 0,
                    18, 1,
                    22, 3
                ],
                'line-opacity': ['get', 'opacity']
            }
        });
    }
}
