/**
 * @file mp-protocol.js
 * @description Compact binary wire protocol shared by the GEO Ride browser client and the game server.
 * Vehicle state is packed into 18 bytes (versus roughly 150 bytes of JSON). Control messages stay JSON text.
 */

/** Binary message type ids. */
export const MSG_STATE = 1;
export const MSG_SNAPSHOT = 2;

/** Bit flags carried in every vehicle state record. */
export const FLAG_DRIFT = 1;
export const FLAG_BRAKE = 2;
export const FLAG_LIGHTS = 4;
export const FLAG_HORN = 8;
export const FLAG_FLASH = 16;
export const FLAG_TELEPORT = 32;

/** Coordinates are stored as signed 32 bit integers scaled by 1e7 (about 1.1 cm resolution). */
export const COORD_SCALE = 1e7;
const VELOCITY_SCALE = 10000;
const STEER_RANGE = 3;

/** Index of a vehicle type in this list is its wire id. Never reorder, only append. */
export const VEHICLE_IDS = ['car', 'truck', 'bus', 'god', 'sports', 'cyber', 'supercar', 'suv', 'taxi', 'police'];

/** Size of one vehicle record without slot byte, and with slot byte. */
export const STATE_BODY_BYTES = 17;
export const STATE_PACKET_BYTES = 1 + STATE_BODY_BYTES;
export const SNAPSHOT_RECORD_BYTES = 1 + STATE_BODY_BYTES;
export const SNAPSHOT_HEADER_BYTES = 1 + 8 + 1;

/**
 * Converts a vehicle type name into its wire id.
 * @param {string} vehicle
 * @returns {number}
 */
export function vehicleToId(vehicle) {
    const idx = VEHICLE_IDS.indexOf(vehicle);
    return idx >= 0 ? idx : 0;
}

/**
 * Converts a wire id back into a vehicle type name.
 * @param {number} id
 * @returns {string}
 */
export function idToVehicle(id) {
    return VEHICLE_IDS[id] || 'car';
}

function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
}

/**
 * Normalizes a room code into a safe lowercase token (letters, digits, underscore, hyphen).
 * @param {*} raw
 * @returns {string} Sanitized code or an empty string.
 */
export function sanitizeRoomCode(raw) {
    if (typeof raw !== 'string') return '';
    return raw
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 24);
}

/**
 * Normalizes a display name (letters, digits, space, underscore, hyphen, max 16 chars).
 * @param {*} raw
 * @returns {string}
 */
export function sanitizePlayerName(raw) {
    if (typeof raw !== 'string') return '';
    return raw
        .replace(/[^A-Za-z0-9 _-]/g, '')
        .trim()
        .slice(0, 16);
}

/**
 * Writes one vehicle record body (17 bytes) at the given offset.
 * @param {DataView} view
 * @param {number} offset
 * @param {{seq:number,lng:number,lat:number,bearing:number,speed:number,steer:number,flags:number,vehicle:string|number}} s
 * @returns {number} Next offset.
 */
function writeBody(view, offset, s) {
    view.setUint16(offset, s.seq & 0xffff);
    view.setInt32(offset + 2, Math.round(clamp(s.lng, -180, 180) * COORD_SCALE));
    view.setInt32(offset + 6, Math.round(clamp(s.lat, -90, 90) * COORD_SCALE));
    const bearing = (((s.bearing % 360) + 360) % 360) / 360;
    view.setUint16(offset + 10, Math.round(bearing * 65536) & 0xffff);
    view.setInt16(offset + 12, Math.round(clamp(s.speed, -3.2, 3.2) * VELOCITY_SCALE));
    view.setInt8(offset + 14, Math.round(clamp(s.steer / STEER_RANGE, -1, 1) * 127));
    view.setUint8(offset + 15, s.flags & 0xff);
    view.setUint8(offset + 16, typeof s.vehicle === 'number' ? s.vehicle : vehicleToId(s.vehicle));
    return offset + STATE_BODY_BYTES;
}

/**
 * Reads one vehicle record body (17 bytes) from the given offset.
 * @param {DataView} view
 * @param {number} offset
 * @returns {{seq:number,lng:number,lat:number,bearing:number,speed:number,steer:number,flags:number,vehicle:string}}
 */
function readBody(view, offset) {
    return {
        seq: view.getUint16(offset),
        lng: view.getInt32(offset + 2) / COORD_SCALE,
        lat: view.getInt32(offset + 6) / COORD_SCALE,
        bearing: (view.getUint16(offset + 10) / 65536) * 360,
        speed: view.getInt16(offset + 12) / VELOCITY_SCALE,
        steer: (view.getInt8(offset + 14) / 127) * STEER_RANGE,
        flags: view.getUint8(offset + 15),
        vehicle: idToVehicle(view.getUint8(offset + 16))
    };
}

/**
 * Encodes a client vehicle state packet (18 bytes).
 * @param {Object} s - State with seq, lng, lat, bearing, speed, steer, flags, vehicle.
 * @returns {ArrayBuffer}
 */
export function encodeState(s) {
    const buf = new ArrayBuffer(STATE_PACKET_BYTES);
    const view = new DataView(buf);
    view.setUint8(0, MSG_STATE);
    writeBody(view, 1, s);
    return buf;
}

/**
 * Decodes a client vehicle state packet.
 * @param {ArrayBuffer|Uint8Array|Buffer} data
 * @returns {Object|null} Decoded state or null when malformed or out of range.
 */
export function decodeState(data) {
    const view = toView(data);
    if (!view || view.byteLength !== STATE_PACKET_BYTES || view.getUint8(0) !== MSG_STATE) return null;
    const s = readBody(view, 1);
    if (s.lng < -180 || s.lng > 180 || s.lat < -90 || s.lat > 90) return null;
    return s;
}

/**
 * Encodes one record of a server snapshot (slot byte plus vehicle body).
 * @param {number} slot
 * @param {Object} s
 * @returns {Uint8Array}
 */
export function encodeSnapshotRecord(slot, s) {
    const buf = new ArrayBuffer(SNAPSHOT_RECORD_BYTES);
    const view = new DataView(buf);
    view.setUint8(0, slot & 0xff);
    writeBody(view, 1, s);
    return new Uint8Array(buf);
}

/**
 * Builds a full snapshot message from pre-encoded records.
 * @param {number} serverTime - Server clock in milliseconds.
 * @param {Uint8Array[]} records - Records produced by encodeSnapshotRecord.
 * @returns {Uint8Array}
 */
export function buildSnapshot(serverTime, records) {
    const out = new Uint8Array(SNAPSHOT_HEADER_BYTES + records.length * SNAPSHOT_RECORD_BYTES);
    const view = new DataView(out.buffer);
    view.setUint8(0, MSG_SNAPSHOT);
    view.setFloat64(1, serverTime);
    view.setUint8(9, records.length);
    let offset = SNAPSHOT_HEADER_BYTES;
    for (const rec of records) {
        out.set(rec, offset);
        offset += SNAPSHOT_RECORD_BYTES;
    }
    return out;
}

/**
 * Decodes a server snapshot message.
 * @param {ArrayBuffer|Uint8Array|Buffer} data
 * @returns {{time:number, players:Array<Object>}|null}
 */
export function decodeSnapshot(data) {
    const view = toView(data);
    if (!view || view.byteLength < SNAPSHOT_HEADER_BYTES || view.getUint8(0) !== MSG_SNAPSHOT) return null;
    const count = view.getUint8(9);
    if (view.byteLength !== SNAPSHOT_HEADER_BYTES + count * SNAPSHOT_RECORD_BYTES) return null;
    const time = view.getFloat64(1);
    const players = [];
    let offset = SNAPSHOT_HEADER_BYTES;
    for (let i = 0; i < count; i++) {
        const slot = view.getUint8(offset);
        players.push({ slot, ...readBody(view, offset + 1) });
        offset += SNAPSHOT_RECORD_BYTES;
    }
    return { time, players };
}

function toView(data) {
    if (data instanceof ArrayBuffer) return new DataView(data);
    if (ArrayBuffer.isView(data)) return new DataView(data.buffer, data.byteOffset, data.byteLength);
    return null;
}
