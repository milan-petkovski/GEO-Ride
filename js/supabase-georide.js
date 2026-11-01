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
export async function georideRpc(fn, body) {
    if (!isBackendConfigured()) throw new Error('backend_not_configured');
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
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
