/**
 * @file landing.js
 * @description Interactive UI behavior and enhanced analytics event tracking for GEO Ride landing page.
 */

// Safe event tracking helper using dataLayer / gtag
function trackLandingEvent(eventName, params = {}) {
    try {
        const payload = {
            event: eventName,
            page_location: window.location.origin + window.location.pathname,
            page_title: document.title,
            ...params
        };

        if (typeof window.gtag === 'function') {
            window.gtag('event', eventName, payload);
        } else if (window.dataLayer) {
            window.dataLayer.push(payload);
        }
    } catch (_e) {
        // Analytics failure should never block UI
    }
}

// 1. Scroll Reveal Animations
function initScrollReveal() {
    if (!('IntersectionObserver' in window)) {
        document.querySelectorAll('.reveal').forEach((el) => el.classList.add('vis'));
        return;
    }

    const ro = new IntersectionObserver(
        (entries) => {
            entries.forEach((e) => {
                if (e.isIntersecting) {
                    e.target.classList.add('vis');
                    ro.unobserve(e.target);
                }
            });
        },
        { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
    );

    document.querySelectorAll('.reveal').forEach((el, i) => {
        el.style.transitionDelay = (i % 5) * 0.065 + 's';
        ro.observe(el);
    });
}

// 2. FAQ Accordion Interaction & Tracking
function initFaq() {
    document.querySelectorAll('.faq-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const item = btn.closest('.faq-item');
            if (!item) return;

            const isOpen = item.classList.contains('open');
            document.querySelectorAll('.faq-item.open').forEach((openItem) => {
                openItem.classList.remove('open');
                const openBtn = openItem.querySelector('.faq-btn');
                if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
            });

            if (!isOpen) {
                item.classList.add('open');
                btn.setAttribute('aria-expanded', 'true');

                // Track FAQ interaction
                const questionText = btn.textContent ? btn.textContent.trim() : '';
                trackLandingEvent('faq_expand', { question: questionText.slice(0, 80) });
            }
        });
    });
}

// Fungies Checkout Subscriptions
const FUNGIES_MONTHLY_URL = 'https://milanwebportal.app.fungies.io/subscribe/61d216ef-2508-4acd-9c8e-dc1fd437bf1c';
const FUNGIES_YEARLY_URL = 'https://milanwebportal.app.fungies.io/subscribe/578272f8-f871-45ba-8575-2ffbe8b4d4fb';

// 3. Pricing Toggle & Tracking
function initPricing() {
    const tog = document.getElementById('tog');
    const proPrice = document.getElementById('pro-price');
    const proPer = document.getElementById('pro-period');
    const lblMo = document.getElementById('lbl-mo');
    const lblYr = document.getElementById('lbl-yr');
    const proBtn = document.getElementById('pro-cta-btn');

    if (!tog || !proPrice || !proPer || !lblMo || !lblYr) return;

    let isAnnual = false;

    function applyBilling() {
        tog.classList.toggle('annual', isAnnual);
        tog.setAttribute('aria-checked', String(isAnnual));
        proPrice.textContent = isAnnual ? '2.99' : '4.99';
        proPer.textContent = isAnnual
            ? 'per month, billed annually - cancel anytime'
            : 'per month - cancel anytime';
        lblMo.classList.toggle('active', !isAnnual);
        lblYr.classList.toggle('active', isAnnual);

        if (proBtn) {
            proBtn.href = isAnnual ? FUNGIES_YEARLY_URL : FUNGIES_MONTHLY_URL;
        }

        trackLandingEvent('pricing_period_change', {
            period: isAnnual ? 'annual' : 'monthly',
            price_displayed: isAnnual ? 2.99 : 4.99,
            checkout_url: isAnnual ? FUNGIES_YEARLY_URL : FUNGIES_MONTHLY_URL
        });
    }

    if (proBtn) {
        proBtn.href = FUNGIES_MONTHLY_URL;
    }

    tog.addEventListener('click', () => {
        isAnnual = !isAnnual;
        applyBilling();
    });

    tog.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            isAnnual = !isAnnual;
            applyBilling();
        }
    });

    if (lblMo) {
        lblMo.addEventListener('click', () => {
            if (isAnnual) {
                isAnnual = false;
                applyBilling();
            }
        });
    }

    if (lblYr) {
        lblYr.addEventListener('click', () => {
            if (!isAnnual) {
                isAnnual = true;
                applyBilling();
            }
        });
    }
}

// 4. Navbar Scroll State
function initNavbar() {
    const nav = document.getElementById('nav');
    if (!nav) return;

    function updateNav() {
        nav.classList.toggle('scrolled', window.scrollY > 20);
    }

    window.addEventListener('scroll', updateNav, { passive: true });
    updateNav();
}

// 5. CTA Conversions Tracking
function initCtaTracking() {
    // Play button triggers
    const playButtons = [
        { id: 'nav-play-btn', location: 'navbar' },
        { id: 'hero-play-btn', location: 'hero_primary' },
        { id: 'free-cta-btn', location: 'pricing_free' },
        { id: 'cta-play-btn', location: 'bottom_banner' }
    ];

    playButtons.forEach(({ id, location }) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', () => {
                trackLandingEvent('play_game_click', { cta_location: location });
            });
        }
    });

    // Pro / Upgrade button triggers
    const proBtn = document.getElementById('pro-cta-btn');
    if (proBtn) {
        proBtn.addEventListener('click', () => {
            const currentPeriod = document.getElementById('tog')?.classList.contains('annual') ? 'annual' : 'monthly';
            trackLandingEvent('pro_upgrade_click', {
                billing_period: currentPeriod,
                price: currentPeriod === 'annual' ? 2.99 : 4.99
            });
        });
    }
}

// Boot everything on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initScrollReveal();
        initFaq();
        initPricing();
        initNavbar();
        initCtaTracking();
    });
} else {
    initScrollReveal();
    initFaq();
    initPricing();
    initNavbar();
    initCtaTracking();
}

// Register Service Worker for PWA support on production
if ('serviceWorker' in navigator) {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch((err) => console.log('SW registration skipped:', err));
        });
    }
}

