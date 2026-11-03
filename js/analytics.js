/**
 * @file analytics.js
 * @description GEO Ride analytics and performance monitoring module, integrating GA4, Google Tag Manager, Consent Mode v2, and Core Web Vitals tracking.
 */

if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
}

export function gtag() {
    if (typeof window !== 'undefined' && window.dataLayer) {
        window.dataLayer.push(Array.from(arguments));
    }
}

// Default Consent Mode v2 settings
export const initConsentMode = () => {
    gtag('consent', 'default', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'granted',
        wait_for_update: 500
    });
};

/**
 * Coarse device class used as a parameter on every event so desktop and mobile can be compared.
 * @returns {'mobile'|'tablet'|'desktop'}
 */
export const getDeviceType = () => {
    if (typeof window === 'undefined') return 'desktop';
    try {
        const coarse =
            !!window.matchMedia?.('(pointer: coarse)').matches &&
            !window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
        const shortSide = Math.min(
            window.screen?.width || window.innerWidth,
            window.screen?.height || window.innerHeight
        );
        const ua = navigator.userAgent || '';
        if (/iPad|Tablet/i.test(ua) || (coarse && shortSide >= 700)) return 'tablet';
        if (coarse || /Mobi|Android|iPhone/i.test(ua) || window.innerWidth < 768) return 'mobile';
    } catch (_e) {}
    return 'desktop';
};

// Error Tracking: identical errors are reported once per session and the total is capped,
// so a single broken loop can never flood the property.
const reportedErrors = new Set();
const MAX_ERROR_EVENTS_PER_SESSION = 15;

export const trackErrorOnce = (eventName, description, extra = {}) => {
    const text = String(description || 'unknown').slice(0, 300);
    const key = `${eventName}|${text}`;
    if (reportedErrors.has(key) || reportedErrors.size >= MAX_ERROR_EVENTS_PER_SESSION) return;
    reportedErrors.add(key);
    trackEvent(eventName, {
        description: text,
        page: typeof window !== 'undefined' ? window.location?.pathname || '' : '',
        fatal: false,
        ...extra
    });
};

export const trackError = (message, source, lineno, colno, _error) => {
    trackErrorOnce('exception', `${message} at ${source}:${lineno}:${colno}`);
};

// Core Web Vitals Tracking: ONE event per page load carrying every metric.
let webVitalsStarted = false;
export const trackWebVitals = () => {
    if (webVitalsStarted) return;
    if (typeof window === 'undefined' || !('performance' in window)) return;
    webVitalsStarted = true;

    let lcp = 0;
    let cls = 0;
    try {
        new PerformanceObserver((list) => {
            const entries = list.getEntries();
            if (entries.length) lcp = Math.round(entries[entries.length - 1].startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (_e) {}
    try {
        new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
                if (!entry.hadRecentInput) cls += entry.value;
            });
        }).observe({ type: 'layout-shift', buffered: true });
    } catch (_e) {}

    window.addEventListener('load', () => {
        setTimeout(() => {
            const paint = performance.getEntriesByType?.('paint') || [];
            const fp = paint.find((x) => x.name === 'first-paint');
            const fcp = paint.find((x) => x.name === 'first-contentful-paint');
            trackEvent('web_vitals', {
                fp_ms: fp ? Math.round(fp.startTime) : undefined,
                fcp_ms: fcp ? Math.round(fcp.startTime) : undefined,
                lcp_ms: lcp || undefined,
                cls_x1000: Math.round(cls * 1000)
            });
        }, 3000);
    });
};
const AI_REFERRAL_DOMAINS = [
    { match: 'chatgpt.com', engine: 'chatgpt' },
    { match: 'chat.openai.com', engine: 'chatgpt' },
    { match: 'openai.com', engine: 'openai' },
    { match: 'perplexity.ai', engine: 'perplexity' },
    { match: 'gemini.google.com', engine: 'gemini' },
    { match: 'bard.google.com', engine: 'gemini' },
    { match: 'copilot.microsoft.com', engine: 'copilot' },
    { match: 'claude.ai', engine: 'claude' },
    { match: 'you.com', engine: 'you' },
    { match: 'phind.com', engine: 'phind' }
];

/**
 * Detects visits originating from AI Answer Engines (ChatGPT, Perplexity, Gemini, Copilot, Claude)
 * via document.referrer or utm_source and records a dedicated `ai_referral_visit` event.
 * @returns {string|null} Detected AI engine identifier or null.
 */
export const trackAIReferral = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;
    try {
        let refHost = '';
        if (document.referrer) {
            refHost = new URL(document.referrer).hostname.toLowerCase();
        }
        const params = new URLSearchParams(window.location?.search || '');
        const utmSource = (params.get('utm_source') || params.get('ref') || '').toLowerCase();

        const matched = AI_REFERRAL_DOMAINS.find(
            (item) =>
                (refHost && (refHost === item.match || refHost.endsWith('.' + item.match))) ||
                (utmSource && utmSource.includes(item.engine))
        );

        if (matched) {
            trackEvent('ai_referral_visit', {
                ai_engine: matched.engine,
                referrer_host: refHost || utmSource,
                landing_page: window.location?.pathname || '/play'
            });
            return matched.engine;
        }
    } catch (_e) {}
    return null;
};

// Enhanced Event Tracking
export const trackEvent = (eventName, params = {}) => {
    if (typeof window === 'undefined') return;

    let sanitizedLocation = window.location?.href || '';
    if (window.location?.href) {
        try {
            const u = new URL(window.location.href);
            sanitizedLocation = u.origin + u.pathname;
        } catch (_e) {}
    }

    const eventParams = {
        ...params,
        page_location: sanitizedLocation,
        page_path: window.location?.pathname || '',
        device_type: getDeviceType()
    };

    if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, {
            ...eventParams,
            send_to: 'G-RK7YHSC0NN'
        });
    } else if (window.dataLayer) {
        window.dataLayer.push({
            event: eventName,
            ...eventParams
        });
    }
};

// Global Handlers
if (typeof window !== 'undefined') {
    window.onerror = trackError;
    window.onunhandledrejection = (event) => {
        trackErrorOnce('exception', `Unhandled Rejection: ${event.reason}`);
    };

    // Engaged time: counts only while the tab is visible and reports increments when it is hidden or closed,
    // so desktop and mobile session length can be compared through the device_type parameter.
    let engagedSince = document.visibilityState === 'visible' ? Date.now() : 0;
    let engagedTotalMs = 0;
    let engagedSentMs = 0;
    const flushEngagement = () => {
        if (engagedSince) {
            engagedTotalMs += Date.now() - engagedSince;
            engagedSince = 0;
        }
        const deltaMs = engagedTotalMs - engagedSentMs;
        if (deltaMs < 1000) return;
        engagedSentMs = engagedTotalMs;
        trackEvent('session_engagement', {
            engaged_seconds: Math.round(deltaMs / 1000),
            total_engaged_seconds: Math.round(engagedTotalMs / 1000),
            transport_type: 'beacon'
        });
    };
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushEngagement();
        else if (!engagedSince) engagedSince = Date.now();
    });
    window.addEventListener('pagehide', flushEngagement);
}
