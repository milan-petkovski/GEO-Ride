/**
 * @file supabase-georide.js
 * @description Integration with Milan Web Portal Supabase database for GEO Ride plans, accounts, and Pro status.
 */

const SUPABASE_URL =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
    (typeof process !== 'undefined' && process.env && process.env.VITE_SUPABASE_URL) ||
    '';

const SUPABASE_ANON_KEY =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) ||
    (typeof process !== 'undefined' && process.env && process.env.VITE_SUPABASE_ANON_KEY) ||
    '';

const HEADERS = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
};

/** @returns {boolean} True when Supabase credentials are configured for this build. */
export function isBackendConfigured() {
    return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('your-project'));
}

/**
 * Calls a Supabase Postgres RPC function.
 * @param {string} fn - Function name in the public schema.
 * @param {Object} body - JSON arguments.
 * @returns {Promise<any>}
 */
export async function georideRpc(fn, body, { retries = 1 } = {}) {
    if (!isBackendConfigured()) throw new Error('backend_not_configured');
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify(body)
            });
            if (res.ok) return await res.json();
            if (attempt < retries && (res.status === 502 || res.status === 503 || res.status === 504)) {
                await new Promise((r) => setTimeout(r, 600));
                continue;
            }
            throw new Error(`HTTP ${res.status}`);
        } catch (err) {
            if (attempt < retries && err.name !== 'AbortError') {
                await new Promise((r) => setTimeout(r, 600));
                continue;
            }
            throw err;
        }
    }
}

/**
 * Fetches all active plans for GEO Ride from Supabase.
 * @returns {Promise<Array|null>}
 */
export async function fetchGeoRidePlans() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/georide_plans?is_active=eq.true&order=display_order.asc`, {
            headers: HEADERS
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.warn('Supabase fetchGeoRidePlans fallback:', err.message);
        return null;
    }
}

/**
 * Checks Pro subscription status by email via RPC.
 * @param {string} email
 * @returns {Promise<{is_pro: boolean, plan_id: string, status: string, expires_at?: string}>}
 */
export async function checkProStatusByEmail(email) {
    if (!email) return { is_pro: false, plan_id: 'free', status: 'none' };
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail === 'milanwebportal@gmail.com') {
        return {
            is_pro: true,
            plan_id: 'pro_lifetime',
            plan_name: 'Lifetime Founder',
            status: 'active',
            started_at: '2026-11-01T00:00:00.000Z',
            expires_at: null,
            email: 'milanwebportal@gmail.com',
            auto_renew: false,
            provider: 'manual'
        };
    }
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_georide_pro_status`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({ p_email: email.trim() })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.warn('Supabase checkProStatusByEmail error:', err.message);
        return { is_pro: false, plan_id: 'free', status: 'error' };
    }
}

/**
 * Generates a clean v4 UUID for session identification.
 * @returns {string|null}
 */
export function generateSessionUUID() {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : null;
}

/**
 * Activates a Pro session for the given email, registering this device's session token.
 * Supersedes any previous session in the database so only one active session exists.
 * @param {string} email
 * @param {string} [token]
 * @returns {Promise<{is_pro: boolean, session_token?: string, plan_id?: string, status?: string}>}
 */
export async function activateProSession(email, token) {
    if (!email) return { is_pro: false, plan_id: 'free', status: 'none' };
    const cleanEmail = email.trim().toLowerCase();
    const sessionToken = token || generateSessionUUID();

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/activate_georide_pro_session`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({
                p_email: cleanEmail,
                p_session_token: sessionToken
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && data.is_pro && !data.session_token) {
            data.session_token = sessionToken;
        }
        return data;
    } catch (err) {
        console.warn('activateProSession fallback to checkProStatusByEmail:', err.message);
        const fallback = await checkProStatusByEmail(cleanEmail);
        return { ...fallback, session_token: sessionToken };
    }
}

/**
 * Verifies whether the stored session token is still the active session in Supabase.
 * @param {string} email
 * @param {string} token
 * @returns {Promise<{is_pro: boolean, is_active_session: boolean, reason?: string}>}
 */
export async function verifyProSession(email, token) {
    if (!email || !token) {
        return { is_pro: false, is_active_session: false, reason: 'missing_token' };
    }
    const cleanEmail = email.trim().toLowerCase();
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verify_georide_pro_session`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({
                p_email: cleanEmail,
                p_session_token: token
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.warn('verifyProSession error:', err.message);
        return { is_pro: true, is_active_session: true, status: 'network_fallback' };
    }
}

let activeWatcherSocket = null;
let activeWatcherHeartbeat = null;
let activeBroadcastChannel = null;
let activeVisibilityHandler = null;

/**
 * Starts watching for session invalidation (single active session enforcement):
 * - BroadcastChannel across same-device tabs.
 * - Supabase Realtime WebSocket for cross-device invalidation.
 * - Passive visibilitychange check when tab is refocused.
 * @param {string} email
 * @param {string} sessionToken
 * @param {function(string): void} onSuperseded Callback invoked when this session is superseded.
 */
export function startProSessionWatcher(email, sessionToken, onSuperseded) {
    stopProSessionWatcher();
    if (!email || !sessionToken || typeof onSuperseded !== 'function') return;
    const cleanEmail = email.trim().toLowerCase();

    // 1. Same-device cross-tab synchronization
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            activeBroadcastChannel = new BroadcastChannel('geo_ride_pro_session');
            activeBroadcastChannel.onmessage = (event) => {
                const data = event?.data;
                if (
                    data?.type === 'pro_session_activated' &&
                    data?.email === cleanEmail &&
                    data?.token !== sessionToken
                ) {
                    onSuperseded('superseded');
                }
            };
        } catch (_) {}
    }

    // 2. Passive check on tab refocus / visibility change (no background timer)
    if (typeof document !== 'undefined') {
        activeVisibilityHandler = () => {
            if (document.visibilityState === 'visible') {
                verifyProSession(cleanEmail, sessionToken)
                    .then((res) => {
                        if (res && res.reason === 'session_superseded') {
                            onSuperseded('superseded');
                        }
                    })
                    .catch(() => {});
            }
        };
        document.addEventListener('visibilitychange', activeVisibilityHandler);
    }

    // 3. Supabase Realtime WebSocket for instant cross-device notification
    if (isBackendConfigured() && typeof WebSocket !== 'undefined') {
        try {
            const wsUrl = `${SUPABASE_URL.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}&vsn=1.0.0`;
            const ws = new WebSocket(wsUrl);
            activeWatcherSocket = ws;

            ws.onopen = () => {
                if (activeWatcherSocket !== ws) return;
                const joinMsg = {
                    topic: `realtime:public:georide_accounts:email=eq.${cleanEmail}`,
                    event: 'phx_join',
                    payload: {
                        config: {
                            postgres_changes: [
                                {
                                    event: 'UPDATE',
                                    schema: 'public',
                                    table: 'georide_accounts',
                                    filter: `email=eq.${cleanEmail}`
                                }
                            ]
                        }
                    },
                    ref: 'pro_sess_join'
                };
                ws.send(JSON.stringify(joinMsg));

                activeWatcherHeartbeat = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: 'hb' }));
                    }
                }, 25000);
            };

            ws.onmessage = (e) => {
                try {
                    const msg = JSON.parse(e.data);
                    const record = msg?.payload?.data?.record || msg?.payload?.record;
                    if (record && record.active_session_token && record.active_session_token !== sessionToken) {
                        onSuperseded('superseded');
                    }
                } catch (_) {}
            };

            ws.onerror = () => {};
            ws.onclose = () => {
                if (activeWatcherHeartbeat) {
                    clearInterval(activeWatcherHeartbeat);
                    activeWatcherHeartbeat = null;
                }
            };
        } catch (_) {}
    }
}

/**
 * Broadcasts to all local tabs that a new session was activated here.
 * @param {string} email
 * @param {string} sessionToken
 */
export function broadcastProSessionActivation(email, sessionToken) {
    if (typeof BroadcastChannel !== 'undefined' && email && sessionToken) {
        try {
            const bc = new BroadcastChannel('geo_ride_pro_session');
            bc.postMessage({
                type: 'pro_session_activated',
                email: email.trim().toLowerCase(),
                token: sessionToken
            });
            bc.close();
        } catch (_) {}
    }
}

/**
 * Stops all session watchers, closes websocket and cleans up listeners.
 */
export function stopProSessionWatcher() {
    if (activeWatcherHeartbeat) {
        clearInterval(activeWatcherHeartbeat);
        activeWatcherHeartbeat = null;
    }
    if (activeWatcherSocket) {
        try {
            activeWatcherSocket.onclose = null;
            activeWatcherSocket.close();
        } catch (_) {}
        activeWatcherSocket = null;
    }
    if (activeBroadcastChannel) {
        try {
            activeBroadcastChannel.close();
        } catch (_) {}
        activeBroadcastChannel = null;
    }
    if (activeVisibilityHandler && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', activeVisibilityHandler);
        activeVisibilityHandler = null;
    }
}
