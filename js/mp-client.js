/**
 * @file mp-client.js
 * @description Browser WebSocket client for the GEO Ride game server. Handles joining a room, binary state
 * uploads, snapshot downloads, NTP style clock sync, latency measurement and automatic reconnection.
 */

import { encodeState, decodeSnapshot } from './mp-protocol.js';
import { ClockSync } from './mp-interp.js';

const CONNECT_TIMEOUT_MS = 5000;
const PING_INTERVAL_MS = 2000;
const MAX_RECONNECT_ATTEMPTS = 6;

/**
 * Real time multiplayer connection to the GEO Ride game server.
 */
export class MpClient {
    /**
     * @param {string} url - WebSocket server URL (wss://...).
     * @param {Object} handlers - onStatus, onWelcome, onJoined, onLeft, onSnapshot, onFull, onError callbacks.
     * @param {Object} [deps] - Injectable WebSocket implementation and clock for tests.
     */
    constructor(url, handlers = {}, deps = {}) {
        this.url = url;
        this.handlers = handlers;
        this.WebSocketImpl = deps.WebSocketImpl || (typeof WebSocket !== 'undefined' ? WebSocket : null);
        this.now = deps.now || (() => Date.now());
        this.clock = new ClockSync();
        this.ws = null;
        this.joinInfo = null;
        this.attempts = 0;
        this.closedByUser = false;
        this.everWelcomed = false;
        this.pingTimer = null;
        this.connectTimer = null;
        this.retryTimer = null;
        this.seq = 0;
    }

    /** Round trip time in milliseconds (lowest recent sample). */
    get rtt() {
        return this.clock.rtt;
    }

    /** True when the socket is open and joined. */
    get isOpen() {
        return !!this.ws && this.ws.readyState === 1;
    }

    /**
     * Estimated server clock in milliseconds.
     * @returns {number}
     */
    serverNow() {
        return this.clock.serverNow(this.now());
    }

    /**
     * Opens the connection and joins a room.
     * @param {{room:string,name:string,vehicle:string,email?:string}} joinInfo
     * @returns {void}
     */
    connect(joinInfo) {
        this.joinInfo = joinInfo;
        this.closedByUser = false;
        this.open();
    }

    open() {
        if (!this.WebSocketImpl) return this.fail();
        this.emitStatus(this.attempts === 0 ? 'connecting' : 'reconnecting');

        let ws;
        try {
            ws = new this.WebSocketImpl(this.url);
        } catch (_e) {
            return this.fail();
        }
        ws.binaryType = 'arraybuffer';
        this.ws = ws;

        this.connectTimer = setTimeout(() => {
            if (ws.readyState !== 1) {
                try {
                    ws.close();
                } catch (_e) {}
                this.scheduleRetry();
            }
        }, CONNECT_TIMEOUT_MS);

        ws.onopen = () => {
            clearTimeout(this.connectTimer);
            ws.send(JSON.stringify({ t: 'join', ...this.joinInfo }));
            this.startPing();
        };

        ws.onmessage = (ev) => {
            if (typeof ev.data === 'string') return this.handleControl(ev.data);
            const snap = decodeSnapshot(ev.data);
            if (snap && this.handlers.onSnapshot) this.handlers.onSnapshot(snap);
        };

        ws.onclose = () => {
            clearTimeout(this.connectTimer);
            this.stopPing();
            if (this.ws === ws) this.scheduleRetry();
        };

        ws.onerror = () => {};
    }

    handleControl(text) {
        let msg;
        try {
            msg = JSON.parse(text);
        } catch (_e) {
            return;
        }
        const h = this.handlers;
        switch (msg.t) {
            case 'welcome':
                this.attempts = 0;
                this.everWelcomed = true;
                this.clock.addSample(this.now(), msg.serverTime, this.now());
                this.emitStatus('online');
                if (h.onWelcome) h.onWelcome(msg);
                break;
            case 'pong':
                this.clock.addSample(msg.c, msg.s, this.now());
                if (h.onLatency) h.onLatency(this.clock.rtt);
                break;
            case 'joined':
                if (h.onJoined) h.onJoined(msg);
                break;
            case 'left':
                if (h.onLeft) h.onLeft(msg);
                break;
            case 'full':
                this.closedByUser = true;
                if (h.onFull) h.onFull(msg.cap);
                this.close();
                break;
            case 'error':
                if (h.onError) h.onError(msg.code);
                break;
        }
    }

    startPing() {
        this.stopPing();
        const ping = () => {
            if (this.isOpen) this.ws.send(JSON.stringify({ t: 'ping', c: this.now() }));
        };
        // Quick initial burst gives an accurate clock offset within the first second.
        [150, 350, 600].forEach((ms) => setTimeout(ping, ms));
        this.pingTimer = setInterval(ping, PING_INTERVAL_MS);
    }

    stopPing() {
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = null;
    }

    scheduleRetry() {
        if (this.closedByUser) return;
        this.attempts++;
        if (this.attempts > MAX_RECONNECT_ATTEMPTS || (!this.everWelcomed && this.attempts > 1)) {
            return this.fail();
        }
        const delay = Math.min(8000, 500 * 2 ** (this.attempts - 1));
        this.emitStatus('reconnecting');
        this.retryTimer = setTimeout(() => this.open(), delay);
    }

    fail() {
        this.cleanup();
        this.emitStatus('failed');
    }

    emitStatus(status) {
        if (this.handlers.onStatus) this.handlers.onStatus(status);
    }

    /**
     * Uploads this player's vehicle state as an 18 byte binary packet.
     * @param {{lng:number,lat:number,bearing:number,speed:number,steer:number,flags:number,vehicle:string}} s
     * @returns {boolean} True when the packet was sent.
     */
    sendState(s) {
        if (!this.isOpen) return false;
        this.seq = (this.seq + 1) & 0xffff;
        this.ws.send(encodeState({ ...s, seq: this.seq }));
        return true;
    }

    cleanup() {
        clearTimeout(this.connectTimer);
        clearTimeout(this.retryTimer);
        this.stopPing();
        const ws = this.ws;
        this.ws = null;
        if (ws) {
            ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
            try {
                ws.close();
            } catch (_e) {}
        }
    }

    /**
     * Leaves the room and closes the connection without reconnecting.
     * @returns {void}
     */
    close() {
        this.closedByUser = true;
        if (this.isOpen) {
            try {
                this.ws.send(JSON.stringify({ t: 'leave' }));
            } catch (_e) {}
        }
        this.cleanup();
        this.emitStatus('closed');
    }
}
