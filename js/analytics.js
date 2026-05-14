/**
 * GEO Ride - Advanced Analytics & Performance Monitoring (2026 Edition)
 * Optimized for GA4, Google Tag, and Consent Mode v2
 */

// Initialize dataLayer if not exists
window.dataLayer = window.dataLayer || [];

export function gtag() {
    window.dataLayer.push(arguments);
}

// Default Consent Mode v2 settings
export const initConsentMode = () => {
    gtag('consent', 'default', {
        'ad_storage': 'denied',
        'ad_user_data': 'denied',
        'ad_personalization': 'denied',
        'analytics_storage': 'granted', // Assuming we are focusing on analytics
        'wait_for_update': 500
    });
};

// Error Tracking
export const trackError = (message, source, lineno, colno, error) => {
    trackEvent('exception', {
        'description': `${message} at ${source}:${lineno}:${colno}`,
        'fatal': false
    });
};

// Core Web Vitals Tracking (Lighthouse / Search Console Optimization)
export const trackWebVitals = () => {
    if ('performance' in window && 'getEntriesByType' in performance) {
        window.addEventListener('load', () => {
            setTimeout(() => {
                const paint = performance.getEntriesByType('paint');
                paint.forEach(entry => {
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
    if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, {
            ...params,
            page_location: window.location.href,
            page_path: window.location.pathname,
            send_to: 'G-C33HV1QV3S'
        });
    } else {
        // Fallback to pushing directly to dataLayer
        window.dataLayer.push({
            event: eventName,
            ...params
        });
    }
};

// Global Error Handler
window.onerror = trackError;

// Global Unhandled Rejection Handler
window.onunhandledrejection = (event) => {
    trackEvent('exception', {
        'description': `Unhandled Rejection: ${event.reason}`,
        'fatal': false
    });
};
