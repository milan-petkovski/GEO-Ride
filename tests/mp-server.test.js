import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { createGameServer, isNewerSeq } from '../server/index.js';
import { encodeState, decodeSnapshot, FLAG_TELEPORT } from '../js/mp-protocol.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, ms = 2000) {
    const start = Date.now();
    while (Date.now() - start < ms) {
        const v = fn();
        if (v) return v;
        await sleep(10);
    }
    throw new Error('waitFor timeout');
}

function connect(port, origin) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}`, origin ? { origin } : undefined);
        ws.msgs = [];
        ws.closed = false;
        ws.on('message', (data, isBinary) => ws.msgs.push({ isBinary, data: isBinary ? data : data.toString() }));
        ws.on('close', () => (ws.closed = true));
        ws.on('open', () => resolve(ws));
        ws.on('error', reject);
    });
}

const control = (ws, t) => ws.msgs.find((m) => !m.isBinary && JSON.parse(m.data).t === t);
const controls = (ws, t) =>
    ws.msgs.filter((m) => !m.isBinary && JSON.parse(m.data).t === t).map((m) => JSON.parse(m.data));
const snapshots = (ws) => ws.msgs.filter((m) => m.isBinary).map((m) => decodeSnapshot(m.data));

let seq = 0;
function stateMsg(overrides = {}) {
    return encodeState({
        seq: ++seq,
        lng: 20.46,
        lat: 44.81,
        bearing: 90,
        speed: 0.1,
        steer: 0,
        flags: 0,
        vehicle: 'car',
        ...overrides
    });
}

async function startServer(opts = {}) {
    const game = createGameServer({ host: '127.0.0.1', tickHz: 50, ...opts });
    const port = await game.listen(0);
    return { game, port };
}

async function join(port, room, extra = {}) {
    const ws = await connect(port);
    ws.send(JSON.stringify({ t: 'join', room, vehicle: 'car', ...extra }));
    return ws;
}

test('isNewerSeq handles u16 wraparound', () => {
    assert.strictEqual(isNewerSeq(2, 1), true);
    assert.strictEqual(isNewerSeq(1, 2), false);
    assert.strictEqual(isNewerSeq(1, 1), false);
    assert.strictEqual(isNewerSeq(0, 65535), true);
    assert.strictEqual(isNewerSeq(65535, 0), false);
});

test('server welcomes players, announces joins and relays binary snapshots', async () => {
    const { game, port } = await startServer();
    try {
        const a = await join(port, 'room1', { name: 'Alice' });
        await waitFor(() => control(a, 'welcome'));
        const b = await join(port, 'room1', { name: 'Bob' });
        const welcomeB = JSON.parse((await waitFor(() => control(b, 'welcome'))).data);

        assert.strictEqual(welcomeB.players.length, 1);
        assert.strictEqual(welcomeB.players[0].name, 'Alice');
        const joined = await waitFor(() => controls(a, 'joined')[0]);
        assert.strictEqual(joined.name, 'Bob');

        a.send(stateMsg({ lng: 20.5, lat: 44.9 }));
        await waitFor(() => snapshots(b).length > 0);
        const rec = snapshots(b)[0].players[0];
        assert.ok(Math.abs(rec.lng - 20.5) < 1e-6);
        assert.ok(Math.abs(rec.lat - 44.9) < 1e-6);

        // The sender never receives its own state back.
        await sleep(100);
        assert.strictEqual(snapshots(a).length, 0);

        a.close();
        b.close();
    } finally {
        await game.close();
    }
});

test('server answers ping with pong containing its clock', async () => {
    const { game, port } = await startServer();
    try {
        const a = await connect(port);
        a.send(JSON.stringify({ t: 'ping', c: 12345 }));
        const pong = JSON.parse((await waitFor(() => control(a, 'pong'))).data);
        assert.strictEqual(pong.c, 12345);
        assert.ok(Math.abs(pong.s - Date.now()) < 2000);
        a.close();
    } finally {
        await game.close();
    }
});

test('free rooms are capped and extra players receive a full notice', async () => {
    const { game, port } = await startServer({ capFree: 2, capPro: 4 });
    try {
        const a = await join(port, 'small');
        const b = await join(port, 'small');
        await waitFor(() => control(a, 'welcome') && control(b, 'welcome'));
        const c = await join(port, 'small');
        const full = JSON.parse((await waitFor(() => control(c, 'full'))).data);
        assert.strictEqual(full.cap, 2);
        assert.strictEqual(game.rooms.get('small').players.size, 2);
        [a, b, c].forEach((w) => w.close());
    } finally {
        await game.close();
    }
});

test('a verified Pro member raises the room capacity', async () => {
    const proLookup = async (email) => email === 'pro@example.com';
    const { game, port } = await startServer({ capFree: 1, capPro: 3, proLookup });
    try {
        const a = await join(port, 'vip');
        await waitFor(() => control(a, 'welcome'));
        const free = await join(port, 'vip');
        await waitFor(() => control(free, 'full'));

        const pro = await join(port, 'vip', { email: 'pro@example.com' });
        const welcome = JSON.parse((await waitFor(() => control(pro, 'welcome'))).data);
        assert.strictEqual(welcome.cap, 3);

        const late = await join(port, 'vip');
        await waitFor(() => control(late, 'welcome'));
        [a, free, pro, late].forEach((w) => w.close());
    } finally {
        await game.close();
    }
});

test('impossible movement is rejected while flagged teleports are allowed once per cooldown', async () => {
    const { game, port } = await startServer();
    try {
        const a = await join(port, 'rules');
        const b = await join(port, 'rules');
        await waitFor(() => control(a, 'welcome') && control(b, 'welcome'));

        a.send(stateMsg({ lng: 20.46, lat: 44.81 }));
        await waitFor(() => snapshots(b).length === 1);

        // Hundreds of kilometres in one tick without the teleport flag: dropped.
        a.send(stateMsg({ lng: 30.0, lat: 50.0 }));
        await sleep(150);
        assert.strictEqual(snapshots(b).length, 1);

        // With the teleport flag it is accepted.
        a.send(stateMsg({ lng: 30.0, lat: 50.0, flags: FLAG_TELEPORT }));
        await waitFor(() => snapshots(b).length === 2);
        assert.ok(Math.abs(snapshots(b)[1].players[0].lat - 50) < 1e-6);

        // A second teleport inside the cooldown is dropped.
        a.send(stateMsg({ lng: 10.0, lat: 40.0, flags: FLAG_TELEPORT }));
        await sleep(150);
        assert.strictEqual(snapshots(b).length, 2);

        a.close();
        b.close();
    } finally {
        await game.close();
    }
});

test('stale sequence numbers are ignored', async () => {
    const { game, port } = await startServer();
    try {
        const a = await join(port, 'order');
        const b = await join(port, 'order');
        await waitFor(() => control(a, 'welcome') && control(b, 'welcome'));

        a.send(
            encodeState({ seq: 50, lng: 20.46, lat: 44.81, bearing: 0, speed: 0, steer: 0, flags: 0, vehicle: 'car' })
        );
        await waitFor(() => snapshots(b).length === 1);
        a.send(
            encodeState({
                seq: 40,
                lng: 20.4601,
                lat: 44.8101,
                bearing: 0,
                speed: 0,
                steer: 0,
                flags: 0,
                vehicle: 'car'
            })
        );
        await sleep(120);
        assert.strictEqual(snapshots(b).length, 1);
        a.close();
        b.close();
    } finally {
        await game.close();
    }
});

test('leaving announces to peers and empty rooms are removed', async () => {
    const { game, port } = await startServer();
    try {
        const a = await join(port, 'bye');
        const b = await join(port, 'bye');
        await waitFor(() => control(a, 'welcome') && control(b, 'welcome'));
        b.close();
        const left = await waitFor(() => controls(a, 'left')[0]);
        assert.ok(left.slot > 0);
        a.close();
        await waitFor(() => game.rooms.size === 0);
    } finally {
        await game.close();
    }
});

test('connections from disallowed origins are refused', async () => {
    const { game, port } = await startServer({ allowedOrigins: ['https://playgeoride.com'] });
    try {
        const bad = await connect(port, 'https://evil.example');
        await waitFor(() => bad.closed);

        const good = await connect(port, 'https://playgeoride.com');
        good.send(JSON.stringify({ t: 'ping', c: 1 }));
        await waitFor(() => control(good, 'pong'));
        good.close();
    } finally {
        await game.close();
    }
});

test('health endpoint reports live room and player counts', async () => {
    const { game, port } = await startServer();
    try {
        const a = await join(port, 'health');
        await waitFor(() => control(a, 'welcome'));
        const res = await fetch(`http://127.0.0.1:${port}/health`);
        const body = await res.json();
        assert.strictEqual(body.ok, true);
        assert.strictEqual(body.rooms, 1);
        assert.strictEqual(body.players, 1);
        a.close();
    } finally {
        await game.close();
    }
});
