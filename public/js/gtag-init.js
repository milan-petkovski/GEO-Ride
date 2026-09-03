window.dataLayer = window.dataLayer || [];
function gtag() {
    window.dataLayer.push(arguments);
}

// Default Google Consent Mode v2 - GDPR compliant default: DENIED
const savedConsent = typeof localStorage !== 'undefined' ? localStorage.getItem('georide_cookie_consent') : null;
const isAnalyticsGranted = savedConsent === 'granted';

gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: isAnalyticsGranted ? 'granted' : 'denied',
    wait_for_update: 500
});

window.updateGeoRideConsent = function (granted) {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('georide_cookie_consent', granted ? 'granted' : 'denied');
    }
    gtag('consent', 'update', {
        analytics_storage: granted ? 'granted' : 'denied'
    });
};

gtag('js', new Date());
gtag('config', 'G-C33HV1QV3S', {
    anonymize_ip: true,
    cookie_flags: 'SameSite=None;Secure'
});
