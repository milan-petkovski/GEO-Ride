window.dataLayer = window.dataLayer || [];
function gtag() {
    window.dataLayer.push(arguments);
}
window.gtag = gtag;

// Activate deferred non-critical CSS in next frame under strict CSP (avoids coalescing with DOMContentLoaded)
if (typeof window !== 'undefined' && typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
        setTimeout(() => {
            const deferredCss = document.getElementById('deferred-css');
            if (deferredCss && deferredCss.media !== 'all') {
                deferredCss.media = 'all';
            }
        }, 0);
    });
}

const GA_MEASUREMENT_ID = 'G-RK7YHSC0NN';
let gtagScriptLoaded = false;

function loadGtagScript() {
    if (gtagScriptLoaded || typeof document === 'undefined') return;
    gtagScriptLoaded = true;

    if (!document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
        document.head.appendChild(script);
    }

    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID);
}

const savedConsent = typeof localStorage !== 'undefined' ? localStorage.getItem('georide_cookie_consent') : null;
const isAnalyticsGranted = savedConsent !== 'denied';

gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: isAnalyticsGranted ? 'granted' : 'denied',
    wait_for_update: 500
});

if (isAnalyticsGranted) {
    loadGtagScript();
}

window.updateGeoRideConsent = function (granted) {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('georide_cookie_consent', granted ? 'granted' : 'denied');
    }
    gtag('consent', 'update', {
        analytics_storage: granted ? 'granted' : 'denied'
    });
    if (granted) {
        loadGtagScript();
    }
};
