export const trackEvent = (eventName, params = {}) => {
  if (typeof gtag === 'function') {
    gtag('event', eventName, params);
  } else {
    console.warn(`GA4: gtag is not defined. Could not track event: ${eventName}`, params);
  }
};
