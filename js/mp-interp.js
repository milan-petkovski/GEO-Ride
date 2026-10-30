/**
 * @file mp-interp.js
 * @description Snapshot interpolation and clock synchronisation for remote vehicles.
 * Remote cars are rendered slightly in the past (interpolation delay) between real server samples using
 * Catmull-Rom style Hermite curves, with capped dead reckoning when packets are late.
 */

/** Rendering delay behind server time, in milliseconds. About two snapshots at 20 Hz. */
export const INTERP_DELAY_MS = 100;
/** Longest time a car is extrapolated past its newest sample, in milliseconds. */
export const MAX_EXTRAPOLATION_MS = 250;
/** Maximum samples kept per remote player. */
export const BUFFER_SIZE = 12;

/**
 * Shortest signed angular difference from a to b in degrees, range (-180, 180].
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function angleDelta(a, b) {
    let d = (b - a) % 360;
    if (d > 180) d -= 360;
    if (d <= -180) d += 360;
    return d;
}

/**
 * Estimates a clock offset between this client and the server using NTP style ping/pong samples.
 */
export class ClockSync {
    constructor(maxSamples = 7) {
        this.maxSamples = maxSamples;
        this.samples = [];
        this.offset = 0;
        this.rtt = 0;
        this.synced = false;
    }

    /**
     * Registers one ping round trip.
     * @param {number} clientSent - Client clock when ping was sent.
     * @param {number} serverTime - Server clock carried by the pong.
     * @param {number} clientReceived - Client clock when pong arrived.
     * @returns {void}
     */
    addSample(clientSent, serverTime, clientReceived) {
        const rtt = Math.max(0, clientReceived - clientSent);
        const offset = serverTime + rtt / 2 - clientReceived;
        this.samples.push({ rtt, offset });
        if (this.samples.length > this.maxSamples) this.samples.shift();

        // Prefer the lowest latency half of the samples, then take the median offset.
        const byRtt = [...this.samples].sort((a, b) => a.rtt - b.rtt);
        const best = byRtt.slice(0, Math.max(1, Math.ceil(byRtt.length / 2)));
        const offsets = best.map((s) => s.offset).sort((a, b) => a - b);
        this.offset = offsets[Math.floor(offsets.length / 2)];
        this.rtt = byRtt[0].rtt;
        this.synced = true;
    }

    /**
     * Current estimate of the server clock.
     * @param {number} [clientNow=Date.now()]
     * @returns {number}
     */
    serverNow(clientNow = Date.now()) {
        return clientNow + this.offset;
    }
}

/**
 * Creates an empty snapshot buffer.
 * @returns {{samples:Array<Object>}}
 */
export function createBuffer() {
    return { samples: [] };
}

/**
 * Adds a snapshot sample, keeping the buffer ordered by time and bounded in size.
 * A teleport flag clears older history so the car snaps instead of sliding across the map.
 * @param {{samples:Array<Object>}} buf
 * @param {Object} sample - Must contain time, lng, lat, bearing; optional speed, steer, flags, teleport.
 * @returns {void}
 */
export function pushSample(buf, sample) {
    const list = buf.samples;
    if (sample.teleport) list.length = 0;
    const last = list[list.length - 1];
    if (last && sample.time <= last.time) return; // drop duplicates and reordered packets
    list.push(sample);
    if (list.length > BUFFER_SIZE) list.shift();
}

function hermite(p0, p1, m0, m1, t, dt) {
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 * dt + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1 * dt;
}

function tangent(prev, next, key) {
    const dt = next.time - prev.time;
    return dt > 0 ? (next[key] - prev[key]) / dt : 0;
}

/**
 * Samples the interpolated pose of a remote player at a given render time (server clock).
 * @param {{samples:Array<Object>}} buf
 * @param {number} renderTime - Server clock time to render, already reduced by the interpolation delay.
 * @returns {{lng:number,lat:number,bearing:number,speed:number,steer:number,flags:number,extrapolated:boolean}|null}
 */
export function sampleBuffer(buf, renderTime) {
    const s = buf.samples;
    if (s.length === 0) return null;

    const first = s[0];
    const last = s[s.length - 1];

    if (s.length === 1 || renderTime <= first.time) {
        return pose(first, first.lng, first.lat, first.bearing, false);
    }

    // Past the newest sample: capped dead reckoning along the last observed velocity.
    if (renderTime >= last.time) {
        const prev = s[s.length - 2];
        const over = Math.min(renderTime - last.time, MAX_EXTRAPOLATION_MS);
        const fade = 1 - over / (MAX_EXTRAPOLATION_MS * 2);
        const vLng = tangent(prev, last, 'lng') * fade;
        const vLat = tangent(prev, last, 'lat') * fade;
        const vBearing = (angleDelta(prev.bearing, last.bearing) / Math.max(1, last.time - prev.time)) * fade;
        return pose(last, last.lng + vLng * over, last.lat + vLat * over, last.bearing + vBearing * over, true);
    }

    let i = 1;
    while (i < s.length - 1 && s[i].time < renderTime) i++;
    const a = s[i - 1];
    const b = s[i];
    const before = s[i - 2] || a;
    const after = s[i + 1] || b;

    const dt = b.time - a.time;
    const t = dt > 0 ? (renderTime - a.time) / dt : 1;

    const lng = hermite(a.lng, b.lng, tangent(before, b, 'lng'), tangent(a, after, 'lng'), t, dt);
    const lat = hermite(a.lat, b.lat, tangent(before, b, 'lat'), tangent(a, after, 'lat'), t, dt);
    const bearing = a.bearing + angleDelta(a.bearing, b.bearing) * t;

    return pose(t < 0.5 ? a : b, lng, lat, bearing, false);
}

function pose(src, lng, lat, bearing, extrapolated) {
    return {
        lng,
        lat,
        bearing: ((bearing % 360) + 360) % 360,
        speed: src.speed || 0,
        steer: src.steer || 0,
        flags: src.flags || 0,
        extrapolated
    };
}
