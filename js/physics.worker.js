/**
 * @file physics.worker.js
 * @description Web Worker for offloading vehicle trajectory prediction, collision bounding box math, and array computations off the main UI loop.
 */

self.onmessage = function (e) {
    const { type, payload } = e.data || {};
    if (type === 'COMPUTE_TRAJECTORY') {
        const { lng, lat, bearing, velocity, dt, steps = 10 } = payload;
        const trajectory = [];
        let currLng = lng;
        let currLat = lat;

        for (let i = 0; i < steps; i++) {
            const rad = bearing * (Math.PI / 180);
            const latRad = currLat * (Math.PI / 180);
            const proj = 1 / Math.cos(latRad);
            currLng += Math.sin(rad) * velocity * 0.0001 * proj * dt;
            currLat += Math.cos(rad) * velocity * 0.0001 * dt;
            trajectory.push([currLng, currLat]);
        }

        self.postMessage({ type: 'TRAJECTORY_RESULT', payload: { trajectory } });
    }
};
