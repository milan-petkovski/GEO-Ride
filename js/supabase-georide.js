/**
 * @file supabase-georide.js
 * @description Integration with Milan Web Portal Supabase database for GEO Ride plans, accounts, and Pro status.
 */

const SUPABASE_URL =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
    'https://anjxbeymcslbxvnqwzws.supabase.co';

const SUPABASE_ANON_KEY =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuanhiZXltY3NsYnh2bnF3endzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNTM3NTcsImV4cCI6MjEwMzgyOTc1N30.P882dCFTFZgHh2vw9hTh7eDAFOenSi55-HSZI7mXLr0';

const HEADERS = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
};

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

/**
 * Records or updates a GEO Ride purchase / subscription.
 * @param {string} email
 * @param {string} planId
 * @param {string} [orderId]
 * @param {string} [provider='fungies']
 * @returns {Promise<Object>}
 */
export async function recordPurchase(email, planId, orderId = null, provider = 'fungies') {
    if (!email || !planId) return { success: false, error: 'Email and planId are required' };
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_georide_purchase`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({
                p_email: email.trim(),
                p_plan_id: planId,
                p_provider_order_id: orderId,
                p_provider: provider
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.warn('Supabase recordPurchase error:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Registers or retrieves a GEO Ride account by email.
 * @param {string} email
 * @param {string} [displayName]
 * @returns {Promise<Object|null>}
 */
export async function getOrCreateAccount(email, displayName = null) {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();
    try {
        const fetchRes = await fetch(
            `${SUPABASE_URL}/rest/v1/georide_accounts?email=eq.${encodeURIComponent(cleanEmail)}&select=*`,
            { headers: HEADERS }
        );
        if (fetchRes.ok) {
            const list = await fetchRes.json();
            if (list.length > 0) return list[0];
        }

        const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/georide_accounts`, {
            method: 'POST',
            headers: {
                ...HEADERS,
                Prefer: 'return=representation'
            },
            body: JSON.stringify({
                email: cleanEmail,
                display_name: displayName || cleanEmail.split('@')[0]
            })
        });
        if (!insertRes.ok) throw new Error(`HTTP ${insertRes.status}`);
        const inserted = await insertRes.json();
        return inserted[0] || null;
    } catch (err) {
        console.warn('Supabase getOrCreateAccount error:', err.message);
        return null;
    }
}
