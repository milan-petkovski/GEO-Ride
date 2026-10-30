import test from 'node:test';
import assert from 'node:assert/strict';
import { MpClient } from '../js/mp-client.js';
import { decodeState, buildSnapshot, encodeSnapshotRecord } from '../js/mp-protocol.js';

class FakeWS {
    constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        FakeWS.instances.push(this);
    }
    send(data) {
        this.sent.push(data);
    }
    close() {
        this.readyState = 3;
    }
    open() {
        this.readyState = 1;
        if (this.onopen) this.onopen();
    }
    recv(data) {
        if (this.onmessage) this.onmessage({ data });
    }
    drop() {
        this.readyState = 3;
        if (this.onclose) this.onclose();
    }
}
FakeWS.instances = [];

function setup() {
    FakeWS.instances = [];
    const events = { status: [], welcome: [], snapshots: [], latency: [], full: [] };
    const client = new MpClient(
        'wss://example.test',
        {
            onStatus: (s) => events.status.push(s),
            onWelcome: (m) => events.welcome.push(m),
            onSnapshot: (s) => events.snapshots.push(s),
            onLatency: (r) => events.latency.push(r),
            onFull: (c) => events.full.push(c)
        },
        { WebSocketImpl: FakeWS }
    );
    return { client, events };
}

test('MpClient sends join on open, goes online on welcome and uploads binary state', () => {
    const { client, events } = setup();
    client.connect({ room: 'abc', name: 'ME', vehicle: 'car' });
    const ws = FakeWS.instances[0];
    ws.open();

    const join = JSON.parse(ws.sent[0]);
    assert.deepEqual([join.t, join.room, join.name], ['join', 'abc', 'ME']);

    ws.recv(JSON.stringify({ t: 'welcome', slot: 2, room: 'abc', cap: 10, serverTime: Date.now(), players: [] }));
    assert.deepEqual(events.status, ['connecting', 'online']);
    assert.strictEqual(events.welcome.length, 1);

    const ok = client.sendState({ lng: 20.4, lat: 44.8, bearing: 10, speed: 0.1, steer: 0, flags: 1, vehicle: 'bus' });
    assert.strictEqual(ok, true);
    const decoded = decodeState(ws.sent[ws.sent.length - 1]);
    assert.strictEqual(decoded.vehicle, 'bus');
    assert.strictEqual(decoded.seq, 1);

    client.close();
    assert.strictEqual(events.status[events.status.length - 1], 'closed');
});

test('MpClient decodes snapshots and tracks latency from pongs', () => {
    const { client, events } = setup();
    client.connect({ room: 'abc', name: 'ME', vehicle: 'car' });
    const ws = FakeWS.instances[0];
    ws.open();

    const snap = buildSnapshot(5000, [
        encodeSnapshotRecord(4, { seq: 1, lng: 1, lat: 2, bearing: 3, speed: 0, steer: 0, flags: 0, vehicle: 'car' })
    ]);
    ws.recv(snap.buffer.slice(snap.byteOffset, snap.byteOffset + snap.byteLength));
    assert.strictEqual(events.snapshots[0].players[0].slot, 4);

    const sent = Date.now() - 40;
    ws.recv(JSON.stringify({ t: 'pong', c: sent, s: Date.now() + 1000 }));
    assert.ok(events.latency[0] >= 40);
    assert.ok(client.rtt >= 40);
    assert.strictEqual(client.clock.synced, true);
    client.close();
});

test('MpClient reports full rooms and does not reconnect', () => {
    const { client, events } = setup();
    client.connect({ room: 'abc', name: 'ME', vehicle: 'car' });
    const ws = FakeWS.instances[0];
    ws.open();
    ws.recv(JSON.stringify({ t: 'full', cap: 10 }));
    assert.deepEqual(events.full, [10]);
    assert.strictEqual(client.isOpen, false);
    assert.strictEqual(FakeWS.instances.length, 1);
});

test('MpClient fails fast when the server was never reachable so the caller can fall back', async () => {
    const { client, events } = setup();
    client.connect({ room: 'abc', name: 'ME', vehicle: 'car' });
    FakeWS.instances[0].drop();
    assert.ok(events.status.includes('reconnecting'));

    await new Promise((r) => setTimeout(r, 650));
    assert.strictEqual(FakeWS.instances.length, 2);
    FakeWS.instances[1].drop();
    assert.strictEqual(events.status[events.status.length - 1], 'failed');
    assert.strictEqual(
        client.sendState({ lng: 0, lat: 0, bearing: 0, speed: 0, steer: 0, flags: 0, vehicle: 'car' }),
        false
    );
});

test('MpClient fails immediately without a WebSocket implementation', () => {
    const events = [];
    const client = new MpClient('wss://x', { onStatus: (s) => events.push(s) }, { WebSocketImpl: null });
    client.WebSocketImpl = null;
    client.connect({ room: 'a' });
    assert.strictEqual(events[events.length - 1], 'failed');
});
