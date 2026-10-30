/**
 * @file server/index.js
 * @description GEO Ride authoritative multiplayer relay. Plain Node.js WebSocket server with rooms, per room
 * player caps (Free and Pro), 20 Hz batched binary snapshots, clock sync, rate limiting and movement validation.
 * Runs on any host with Node 20+ (Oracle Cloud Always Free, Render, Fly, a home server).
 *
 * Usage: node server/index.js
 * Environment: PORT, HOST, ALLOWED_ORIGINS, CAP_FREE, CAP_PRO, TICK_HZ, MAX_ROOMS, MAX_CONNS_PER_IP,
 *              TRUST_PROXY, SUPABASE_URL, SUPABASE_ANON_KEY
 */

import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import {
    FLAG_TELEPORT,
    VEHICLE_IDS,
    decodeState,
    encodeSnapshotRecord,
    buildSnapshot,
    sanitizeRoomCode,
    sanitizePlayerName
} from '../js/mp-protocol.js';
import { VEHICLE_CONFIG } from '../js/config.js';

const DEFAULTS = {
    port: 8080,
    host: '0.0.0.0',
    allowedOrigins: [],
    capFree: 10,
    capPro: 25,
    tickHz: 20,
    maxRooms: 2000,
    maxConnsPerIp: 8,
    trustProxy: false,
    supabaseUrl: '',
    supabaseKey: '',
    proLookup: null
};

const FRAME_MS = 1000 / 60;
const TELEPORT_COOLDOWN_MS = 1500;
const IDLE_TIMEOUT_MS = 30000;
const PRO_CACHE_MS = 10 * 60 * 1000;
const MAX_BUFFERED_BYTES = 64 * 1024;

/**
 * Creates the Pro status checker. Uses the same Supabase RPC as the game client and caches results.
 * @param {string} url
 * @param {string} key
 * @returns {(email:string)=>Promise<boolean>}
 */
export function createSupabaseProLookup(url, key) {
    const cache = new Map();
    return async (email) => {
        const clean = String(email || '')
            .trim()
            .toLowerCase();
        if (!clean || !url || !key) return false;
        const hit = cache.get(clean);
        if (hit && hit.expires > Date.now()) return hit.isPro;
        let isPro = false;
        let ttl = 60 * 1000;
        try {
            const res = await fetch(`${url}/rest/v1/rpc/check_georide_pro_status`, {
                method: 'POST',
                headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ p_email: clean }),
                signal: AbortSignal.timeout(3000)
            });
            if (res.ok) {
                const data = await res.json();
                isPro = !!(data && data.is_pro);
                ttl = PRO_CACHE_MS;
            }
        } catch (_e) {}
        cache.set(clean, { isPro, expires: Date.now() + ttl });
        return isPro;
    };
}

/**
 * Returns true when a newer u16 sequence number should replace the older one (wrap safe).
 * @param {number} next
 * @param {number} prev
 * @returns {boolean}
 */
export function isNewerSeq(next, prev) {
    const diff = (next - prev) & 0xffff;
    return diff !== 0 && diff < 0x8000;
}

/**
 * Creates (but does not start listening) a GEO Ride game server.
 * @param {Object} [options]
 * @returns {{listen:(port?:number)=>Promise<number>, close:()=>Promise<void>, rooms:Map<string,Object>, stats:()=>Object}}
 */
export function createGameServer(options = {}) {
    const cfg = { ...DEFAULTS, ...options };
    const lookupPro = cfg.proLookup || createSupabaseProLookup(cfg.supabaseUrl, cfg.supabaseKey);
    const startedAt = Date.now();
    const rooms = new Map();
    const connsByIp = new Map();
    let messageCount = 0;

    const server = http.createServer((req, res) => {
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify({ ok: true, ...stats() }));
            return;
        }
        res.writeHead(404);
        res.end();
    });

    const wss = new WebSocketServer({ server, maxPayload: 1024, perMessageDeflate: false });

    function stats() {
        let players = 0;
        for (const room of rooms.values()) players += room.players.size;
        return { rooms: rooms.size, players, uptime: Math.round((Date.now() - startedAt) / 1000) };
    }

    function sendJson(ws, obj) {
        if (ws.readyState === 1) ws.send(JSON.stringify(obj));
    }

    function broadcastJson(room, obj, exceptSlot = 0) {
        const text = JSON.stringify(obj);
        for (const p of room.players.values()) {
            if (p.slot !== exceptSlot && p.ws.readyState === 1) p.ws.send(text);
        }
    }

    function originAllowed(origin) {
        if (cfg.allowedOrigins.length === 0) return true;
        if (!origin) return false;
        return cfg.allowedOrigins.some((o) => origin === o || origin.endsWith('.' + o.replace(/^https?:\/\//, '')));
    }

    function clientIp(req) {
        if (cfg.trustProxy) {
            const fwd = req.headers['x-forwarded-for'];
            if (fwd) return String(fwd).split(',')[0].trim();
        }
        return req.socket.remoteAddress || 'unknown';
    }

    function freeSlot(room) {
        for (let s = 1; s < 256; s++) if (!room.players.has(s)) return s;
        return 0;
    }

    function startRoomTick(room) {
        const intervalMs = Math.round(1000 / cfg.tickHz);
        room.timer = setInterval(() => tickRoom(room), intervalMs);
    }

    function tickRoom(room) {
        const dirty = [];
        for (const p of room.players.values()) {
            if (p.dirty && p.state) {
                dirty.push(p);
                p.dirty = false;
            }
        }
        if (dirty.length === 0) return;

        const serverTime = Date.now();
        const records = dirty.map((p) => ({ slot: p.slot, rec: encodeSnapshotRecord(p.slot, p.state) }));

        for (const target of room.players.values()) {
            if (target.ws.readyState !== 1 || target.ws.bufferedAmount > MAX_BUFFERED_BYTES) continue;
            const others = records.filter((r) => r.slot !== target.slot).map((r) => r.rec);
            if (others.length === 0) continue;
            target.ws.send(buildSnapshot(serverTime, others), { binary: true });
        }
    }

    function removePlayer(player) {
        const room = player.room;
        if (!room) return;
        room.players.delete(player.slot);
        player.room = null;
        if (room.players.size === 0) {
            clearInterval(room.timer);
            rooms.delete(room.code);
        } else {
            broadcastJson(room, { t: 'left', slot: player.slot });
        }
    }

    async function handleJoin(player, msg) {
        if (player.room || player.joining) return;
        player.joining = true;

        const code = sanitizeRoomCode(msg.room) || 'lobby';
        const vehicle = VEHICLE_IDS.includes(msg.vehicle) ? msg.vehicle : 'car';
        const isPro = msg.email ? await lookupPro(msg.email) : false;

        let room = rooms.get(code);
        if (!room) {
            if (rooms.size >= cfg.maxRooms) {
                player.joining = false;
                return sendJson(player.ws, { t: 'error', code: 'server_busy' });
            }
            room = { code, cap: isPro ? cfg.capPro : cfg.capFree, players: new Map(), timer: null };
            rooms.set(code, room);
            startRoomTick(room);
        } else if (isPro && room.cap < cfg.capPro) {
            room.cap = cfg.capPro; // a Pro member upgrades the room to the Pro capacity
        }

        const slot = room.players.size >= room.cap ? 0 : freeSlot(room);
        if (!slot) {
            player.joining = false;
            if (room.players.size === 0) {
                clearInterval(room.timer);
                rooms.delete(code);
            }
            return sendJson(player.ws, { t: 'full', cap: room.cap });
        }

        player.slot = slot;
        player.room = room;
        player.name = sanitizePlayerName(msg.name) || 'P' + slot;
        player.vehicle = vehicle;
        player.isPro = isPro;
        player.joining = false;
        room.players.set(slot, player);

        sendJson(player.ws, {
            t: 'welcome',
            slot,
            room: code,
            cap: room.cap,
            serverTime: Date.now(),
            players: [...room.players.values()]
                .filter((p) => p.slot !== slot)
                .map((p) => ({ slot: p.slot, name: p.name, vehicle: p.vehicle, pro: p.isPro }))
        });
        broadcastJson(room, { t: 'joined', slot, name: player.name, vehicle, pro: isPro }, slot);
    }

    function handleControl(player, text) {
        let msg;
        try {
            msg = JSON.parse(text);
        } catch (_e) {
            return;
        }
        if (!msg || typeof msg.t !== 'string') return;

        if (msg.t === 'ping') {
            return sendJson(player.ws, { t: 'pong', c: Number(msg.c) || 0, s: Date.now() });
        }
        if (msg.t === 'join') return void handleJoin(player, msg);
        if (msg.t === 'leave') return removePlayer(player);
    }

    function strike(player, now) {
        if (now - player.strikeWindowStart > 10000) {
            player.strikeWindowStart = now;
            player.strikes = 0;
        }
        player.strikes++;
        if (player.strikes > 40) player.ws.close(1008, 'abuse');
    }

    function handleState(player, data, now) {
        if (!player.room) return;
        const s = decodeState(data);
        if (!s) return strike(player, now);
        if (player.state && !isNewerSeq(s.seq, player.state.seq)) return;

        if (player.state) {
            let teleport = (s.flags & FLAG_TELEPORT) !== 0;
            if (teleport && now - player.lastTeleportAt < TELEPORT_COOLDOWN_MS) teleport = false;

            if (teleport) {
                player.lastTeleportAt = now;
            } else {
                const vcfg = VEHICLE_CONFIG[s.vehicle] || VEHICLE_CONFIG.car;
                const dtMs = Math.max(50, now - player.stateAt);
                const maxDeg = ((vcfg.maxSpeed * 0.0001 * 2) / FRAME_MS) * dtMs + 0.00005;
                const dLat = Math.abs(s.lat - player.state.lat);
                const dLng = Math.abs(s.lng - player.state.lng) * Math.cos((s.lat * Math.PI) / 180);
                if (Math.hypot(dLat, dLng) > maxDeg) return strike(player, now);
            }
        }

        player.state = s;
        player.stateAt = now;
        player.vehicle = s.vehicle;
        player.dirty = true;
    }

    wss.on('connection', (ws, req) => {
        const ip = clientIp(req);
        const count = (connsByIp.get(ip) || 0) + 1;

        if (!originAllowed(req.headers.origin) || count > cfg.maxConnsPerIp) {
            ws.close(1008, 'forbidden');
            return;
        }
        connsByIp.set(ip, count);

        const now = Date.now();
        const player = {
            ws,
            ip,
            room: null,
            slot: 0,
            name: '',
            vehicle: 'car',
            isPro: false,
            joining: false,
            state: null,
            stateAt: now,
            dirty: false,
            lastTeleportAt: 0,
            lastSeen: now,
            isAlive: true,
            tokens: 80,
            tokensAt: now,
            strikes: 0,
            strikeWindowStart: now
        };

        ws.on('pong', () => {
            player.isAlive = true;
        });

        ws.on('message', (data, isBinary) => {
            const t = Date.now();
            // Token bucket: 60 messages per second sustained, bursts up to 80.
            player.tokens = Math.min(80, player.tokens + ((t - player.tokensAt) / 1000) * 60);
            player.tokensAt = t;
            if (player.tokens < 1) return strike(player, t);
            player.tokens -= 1;

            player.lastSeen = t;
            messageCount++;
            if (isBinary) handleState(player, data, t);
            else handleControl(player, data.toString());
        });

        ws.on('close', () => {
            removePlayer(player);
            const left = (connsByIp.get(ip) || 1) - 1;
            if (left <= 0) connsByIp.delete(ip);
            else connsByIp.set(ip, left);
        });

        ws.on('error', () => {});
        player.ws.player = player;
    });

    const heartbeat = setInterval(() => {
        const now = Date.now();
        for (const ws of wss.clients) {
            const p = ws.player;
            if (!p) continue;
            if (!p.isAlive || now - p.lastSeen > IDLE_TIMEOUT_MS) {
                ws.terminate();
                continue;
            }
            p.isAlive = false;
            ws.ping();
        }
    }, 10000);

    let metricsTimer = null;
    function startMetrics() {
        let last = messageCount;
        metricsTimer = setInterval(() => {
            const s = stats();
            const rate = Math.round((messageCount - last) / 60);
            last = messageCount;
            console.log(`[geo-ride] rooms=${s.rooms} players=${s.players} msgs/s=${rate}`);
        }, 60000);
        metricsTimer.unref();
    }

    return {
        rooms,
        stats,
        startMetrics,
        listen(port = cfg.port) {
            return new Promise((resolve) => {
                server.listen(port, cfg.host, () => resolve(server.address().port));
            });
        },
        close() {
            clearInterval(heartbeat);
            if (metricsTimer) clearInterval(metricsTimer);
            for (const room of rooms.values()) clearInterval(room.timer);
            for (const ws of wss.clients) ws.terminate();
            return new Promise((resolve) => wss.close(() => server.close(() => resolve())));
        }
    };
}

function readEnvConfig(env = process.env) {
    const num = (v, d) => (Number.isFinite(Number(v)) && v !== undefined && v !== '' ? Number(v) : d);
    return {
        port: num(env.PORT, DEFAULTS.port),
        host: env.HOST || DEFAULTS.host,
        allowedOrigins: (env.ALLOWED_ORIGINS || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        capFree: num(env.CAP_FREE, DEFAULTS.capFree),
        capPro: num(env.CAP_PRO, DEFAULTS.capPro),
        tickHz: num(env.TICK_HZ, DEFAULTS.tickHz),
        maxRooms: num(env.MAX_ROOMS, DEFAULTS.maxRooms),
        maxConnsPerIp: num(env.MAX_CONNS_PER_IP, DEFAULTS.maxConnsPerIp),
        trustProxy: env.TRUST_PROXY === 'true',
        supabaseUrl: env.SUPABASE_URL || '',
        supabaseKey: env.SUPABASE_ANON_KEY || ''
    };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
    const config = readEnvConfig();
    const game = createGameServer(config);
    game.listen().then((port) => {
        console.log(`[geo-ride] multiplayer server listening on ${config.host}:${port}`);
        game.startMetrics();
    });
    const shutdown = () => {
        console.log('[geo-ride] shutting down');
        game.close().then(() => process.exit(0));
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}
