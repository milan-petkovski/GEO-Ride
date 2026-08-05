window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }

// Default Consent Mode v2
gtag('consent', 'default', {
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied',
    'analytics_storage': 'granted',
    'wait_for_update': 500
});

gtag('js', new Date());
gtag('config', 'G-C33HV1QV3S', {
    'anonymize_ip': true,
    'cookie_flags': 'SameSite=None;Secure'
});
