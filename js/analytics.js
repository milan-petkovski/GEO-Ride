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

// Error Tracking
export const trackError = (message, source, lineno, colno, _error) => {
    trackEvent('exception', {
        description: `${message} at ${source}:${lineno}:${colno}`,
        fatal: false
    });
};

// Core Web Vitals Tracking (Lighthouse / Search Console Optimization)
export const trackWebVitals = () => {
    if (typeof window !== 'undefined' && 'performance' in window && 'getEntriesByType' in performance) {
        window.addEventListener('load', () => {
            setTimeout(() => {
                const paint = performance.getEntriesByType('paint');
                paint.forEach((entry) => {
                    trackEvent('web_vitals', {
                        metric_name: entry.name,
                        metric_value: entry.startTime,
                        metric_id: entry.entryType
                    });
                });
            }, 3000);
        });
    }
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
        page_path: window.location?.pathname || ''
    };

    if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, {
            ...eventParams,
            send_to: 'G-C33HV1QV3S'
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
        trackEvent('exception', {
            description: `Unhandled Rejection: ${event.reason}`,
            fatal: false
        });
    };
}
