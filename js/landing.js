/**
 * @file landing.js
 * @description Interactive UI behavior, cyber canvas animation engine, vehicle/map showcases,
 *              billing switches, and analytics tracking for GEO Ride landing page.
 *              All vehicle specs and simulator data strictly match the core game engine.
 */

import { fetchGeoRidePlans, getOrCreateAccount } from './supabase-georide.js';
import { trackWebVitals } from './analytics.js';

/* --------------------------------------------------------------------------
   1. GA4 / GTAG EVENT TRACKING HELPER
   -------------------------------------------------------------------------- */
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
    } catch (_err) {
        // Analytics failures must never interrupt UI
    }
}

/* --------------------------------------------------------------------------
   2. INTERACTIVE CYBER CANVAS ENGINE (HERO)
   -------------------------------------------------------------------------- */
function initHeroCanvas() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let mouseX = width / 2;
    let mouseY = height / 2;
    let targetMouseX = mouseX;
    let targetMouseY = mouseY;

    // Particle pool
    const particleCount = Math.min(Math.floor(width * 0.05), 65);
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            radius: Math.random() * 1.8 + 0.6,
            vx: (Math.random() - 0.5) * 0.6,
            vy: (Math.random() - 0.5) * 0.6,
            color: Math.random() > 0.3 ? 'rgba(0, 242, 255,' : 'rgba(196, 112, 240,',
            alpha: Math.random() * 0.5 + 0.2
        });
    }

    // Window Resize handler
    function onResize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', onResize, { passive: true });

    // Mouse & Touch movement tracking
    function onPointerMove(e) {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        targetMouseX = clientX;
        targetMouseY = clientY;
    }
    window.addEventListener('mousemove', onPointerMove, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });

    let animationFrameId;

    function render() {
        // Smooth lerp mouse coordinates
        mouseX += (targetMouseX - mouseX) * 0.05;
        mouseY += (targetMouseY - mouseY) * 0.05;

        ctx.clearRect(0, 0, width, height);

        // 1. Draw Perspective Cyber Horizon Lines
        const horizonY = height * 0.65;
        const vanishingX = width / 2 + (mouseX - width / 2) * 0.15;
        const vanishingY = horizonY + (mouseY - height / 2) * 0.1;

        ctx.lineWidth = 1;

        // Radiating perspective lines
        const lineCount = 14;
        for (let i = 0; i <= lineCount; i++) {
            const startX = (width / lineCount) * i;
            ctx.strokeStyle = 'rgba(0, 242, 255, 0.035)';
            ctx.beginPath();
            ctx.moveTo(startX, height);
            ctx.lineTo(vanishingX, vanishingY);
            ctx.stroke();
        }

        // Horizontal grid lines approaching camera
        for (let j = 1; j <= 7; j++) {
            const progress = j / 7;
            const gridY = horizonY + (height - horizonY) * (progress * progress);
            ctx.strokeStyle = `rgba(0, 242, 255, ${0.015 + progress * 0.035})`;
            ctx.beginPath();
            ctx.moveTo(0, gridY);
            ctx.lineTo(width, gridY);
            ctx.stroke();
        }

        // 2. Draw Floating Cyber Particles
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];

            // Attract slightly to mouse pointer
            const dx = mouseX - p.x;
            const dy = mouseY - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 220 && dist > 10) {
                p.x += (dx / dist) * 0.4;
                p.y += (dy / dist) * 0.4;
            }

            p.x += p.vx;
            p.y += p.vy;

            // Wrap around edges
            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;
            if (p.y < 0) p.y = height;
            if (p.y > height) p.y = 0;

            // Render Particle
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = `${p.color} ${p.alpha})`;
            ctx.fill();

            // Connect close particles with subtle cyber links
            for (let j = i + 1; j < particles.length; j++) {
                const p2 = particles[j];
                const pDist = Math.hypot(p.x - p2.x, p.y - p2.y);
                if (pDist < 85) {
                    ctx.strokeStyle = `rgba(0, 242, 255, ${0.08 * (1 - pDist / 85)})`;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
            }
        }

        animationFrameId = requestAnimationFrame(render);
    }

    render();

    // Pause rendering when tab is inactive to save battery
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            cancelAnimationFrame(animationFrameId);
        } else {
            render();
        }
    });
}

/* --------------------------------------------------------------------------
   3. SPOTLIGHT HOVER EFFECT (AWWWARDS CARDS)
   -------------------------------------------------------------------------- */
function initSpotlightCards() {
    const cards = document.querySelectorAll('.spotlight-card');
    if (!cards.length) return;

    cards.forEach((card) => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });
}

/* --------------------------------------------------------------------------
   4. INTERACTIVE FLEET SHOWCASE (100% REAL GAME PHYSICS & FULL UNCLIPPED SVGS)
   -------------------------------------------------------------------------- */
const FLEET_DATA = {
    car: {
        name: 'Car',
        class: 'Class: Sports Car',
        desc: 'Balanced sports car. Best handling, smooth acceleration, ideal for exploring cities and tight corners.',
        topSpeed: '250 KM/H',
        topSpeedPct: '80%',
        power: 'High (0.0009)',
        powerPct: '70%',
        brake: 'Strong (0.004)',
        brakePct: '80%',
        turnRate: 'Sharp (0.8)',
        turnRatePct: '88%',
        btnText: 'Drive Car',
        isGod: false,
        svg: `<svg viewBox="0 0 70 140" fill="none" xmlns="http://www.w3.org/2000/svg" class="fleet-svg-showcase">
            <ellipse cx="35" cy="70" rx="28" ry="58" fill="#00F2FF" fill-opacity="0.08"/>
            <rect x="3" y="24" width="8" height="22" rx="4" fill="#050508" stroke="#00F2FF" stroke-width="1.5"/>
            <rect x="59" y="24" width="8" height="22" rx="4" fill="#050508" stroke="#00F2FF" stroke-width="1.5"/>
            <rect x="3" y="94" width="9" height="24" rx="4" fill="#050508" stroke="#00F2FF" stroke-width="1.5"/>
            <rect x="58" y="94" width="9" height="24" rx="4" fill="#050508" stroke="#00F2FF" stroke-width="1.5"/>
            <path d="M18 16C24 10 46 10 52 16C58 22 60 40 60 70C60 100 58 120 54 126C50 132 20 132 16 126C12 120 10 100 10 70C10 40 12 22 18 16Z" fill="#080B12" stroke="#00F2FF" stroke-width="2.2"/>
            <path d="M25 28L30 38H40L45 28" stroke="#00F2FF" stroke-width="1.2" stroke-opacity="0.7"/>
            <line x1="35" y1="20" x2="35" y2="34" stroke="#00F2FF" stroke-width="1.2" stroke-opacity="0.5"/>
            <path d="M16 46C22 42 48 42 54 46L50 64H20L16 46Z" fill="#00F2FF" fill-opacity="0.25" stroke="#00F2FF" stroke-width="1.5"/>
            <rect x="22" y="66" width="26" height="24" rx="3" fill="#0B0F19" stroke="#00F2FF" stroke-width="1" stroke-opacity="0.6"/>
            <line x1="35" y1="68" x2="35" y2="88" stroke="#00F2FF" stroke-width="1" stroke-opacity="0.4"/>
            <path d="M21 92H49L53 108H17L21 92Z" fill="#00F2FF" fill-opacity="0.2" stroke="#00F2FF" stroke-width="1.2"/>
            <rect x="10" y="123" width="50" height="5" rx="2" fill="#00F2FF" fill-opacity="0.8"/>
            <rect x="18" y="118" width="4" height="6" fill="#00F2FF"/>
            <rect x="48" y="118" width="4" height="6" fill="#00F2FF"/>
            <polygon points="17,17 25,14 23,21 16,21" fill="#FFFFFF" fill-opacity="0.95"/>
            <polygon points="53,17 45,14 47,21 54,21" fill="#FFFFFF" fill-opacity="0.95"/>
            <line x1="18" y1="129" x2="52" y2="129" stroke="#FF2A4B" stroke-width="2.5" stroke-linecap="round"/>
        </svg>`
    },
    truck: {
        name: 'Truck',
        class: 'Class: Heavy Semi Truck',
        desc: 'Heavy semi truck. Slow to accelerate and brake, requires wide turns. Satisfying on highways.',
        topSpeed: '150 KM/H',
        topSpeedPct: '48%',
        power: 'Heavy (0.00045)',
        powerPct: '35%',
        brake: 'Gradual (0.002)',
        brakePct: '40%',
        turnRate: 'Heavy (0.5)',
        turnRatePct: '38%',
        btnText: 'Drive Truck',
        isGod: false,
        svg: `<svg viewBox="0 0 80 210" fill="none" xmlns="http://www.w3.org/2000/svg" class="fleet-svg-showcase">
            <rect x="8" y="10" width="64" height="190" rx="8" fill="#00F2FF" fill-opacity="0.06"/>
            <rect x="2" y="22" width="8" height="24" rx="3" fill="#050508" stroke="#00F2FF" stroke-width="1.5"/>
            <rect x="70" y="22" width="8" height="24" rx="3" fill="#050508" stroke="#00F2FF" stroke-width="1.5"/>
            <rect x="2" y="152" width="9" height="22" rx="3" fill="#050508" stroke="#00F2FF" stroke-width="1.5"/>
            <rect x="69" y="152" width="9" height="22" rx="3" fill="#050508" stroke="#00F2FF" stroke-width="1.5"/>
            <rect x="2" y="178" width="9" height="22" rx="3" fill="#050508" stroke="#00F2FF" stroke-width="1.5"/>
            <rect x="69" y="178" width="9" height="22" rx="3" fill="#050508" stroke="#00F2FF" stroke-width="1.5"/>
            <path d="M12 12C12 8 20 6 40 6C60 6 68 8 68 12V62H12V12Z" fill="#0A0E17" stroke="#00F2FF" stroke-width="2.2"/>
            <rect x="10" y="6" width="60" height="5" rx="2" fill="#00F2FF" fill-opacity="0.8"/>
            <path d="M16 16H64L60 34H20L16 16Z" fill="#00F2FF" fill-opacity="0.3" stroke="#00F2FF" stroke-width="1.3"/>
            <rect x="8" y="52" width="5" height="10" rx="1" fill="#00F2FF" fill-opacity="0.7"/>
            <rect x="67" y="52" width="5" height="10" rx="1" fill="#00F2FF" fill-opacity="0.7"/>
            <circle cx="40" cy="74" r="8" fill="#07090F" stroke="#00F2FF" stroke-width="1.8"/>
            <circle cx="40" cy="74" r="3" fill="#00F2FF"/>
            <rect x="12" y="80" width="56" height="122" rx="4" fill="#090D18" stroke="#00F2FF" stroke-width="2"/>
            <line x1="12" y1="100" x2="68" y2="100" stroke="#00F2FF" stroke-width="1" stroke-opacity="0.35"/>
            <line x1="12" y1="120" x2="68" y2="120" stroke="#00F2FF" stroke-width="1" stroke-opacity="0.35"/>
            <line x1="12" y1="140" x2="68" y2="140" stroke="#00F2FF" stroke-width="1" stroke-opacity="0.35"/>
            <rect x="18" y="9" width="6" height="2" rx="1" fill="#FFAA00"/>
            <rect x="37" y="9" width="6" height="2" rx="1" fill="#FFAA00"/>
            <rect x="56" y="9" width="6" height="2" rx="1" fill="#FFAA00"/>
            <line x1="14" y1="200" x2="66" y2="200" stroke="#FF2A4B" stroke-width="2.5" stroke-linecap="round"/>
        </svg>`
    },
    bus: {
        name: 'Bus',
        class: 'Class: City Transit Bus',
        desc: 'City bus. Very slow top speed but surprisingly responsive steering. Great for urban exploration.',
        topSpeed: '120 KM/H',
        topSpeedPct: '38%',
        power: 'Low (0.00035)',
        powerPct: '28%',
        brake: 'Smooth (0.0015)',
        brakePct: '30%',
        turnRate: 'Responsive (1.0)',
        turnRatePct: '55%',
        btnText: 'Drive Bus',
        isGod: false,
        svg: `<svg viewBox="0 0 76 210" fill="none" xmlns="http://www.w3.org/2000/svg" class="fleet-svg-showcase">
            <rect x="6" y="8" width="64" height="194" rx="14" fill="#00F2FF" fill-opacity="0.06"/>
            <rect x="1" y="28" width="8" height="22" rx="3" fill="#050508" stroke="#00F2FF" stroke-width="1.5"/>
            <rect x="67" y="28" width="8" height="22" rx="3" fill="#050508" stroke="#00F2FF" stroke-width="1.5"/>
            <rect x="1" y="160" width="8" height="24" rx="3" fill="#050508" stroke="#00F2FF" stroke-width="1.5"/>
            <rect x="67" y="160" width="8" height="24" rx="3" fill="#050508" stroke="#00F2FF" stroke-width="1.5"/>
            <rect x="8" y="10" width="60" height="190" rx="12" fill="#090D18" stroke="#00F2FF" stroke-width="2.2"/>
            <path d="M12 26C12 18 20 14 38 14C56 14 64 18 64 26V42H12V26Z" fill="#00F2FF" fill-opacity="0.32" stroke="#00F2FF" stroke-width="1.3"/>
            <rect x="22" y="16" width="32" height="6" rx="1" fill="#FFAA00" fill-opacity="0.9"/>
            <rect x="20" y="60" width="36" height="28" rx="4" fill="#0D1322" stroke="#00F2FF" stroke-width="1.2"/>
            <line x1="24" y1="68" x2="52" y2="68" stroke="#00F2FF" stroke-width="1" stroke-opacity="0.4"/>
            <line x1="24" y1="76" x2="52" y2="76" stroke="#00F2FF" stroke-width="1" stroke-opacity="0.4"/>
            <rect x="20" y="112" width="36" height="28" rx="4" fill="#0D1322" stroke="#00F2FF" stroke-width="1.2"/>
            <line x1="24" y1="120" x2="52" y2="120" stroke="#00F2FF" stroke-width="1" stroke-opacity="0.4"/>
            <line x1="24" y1="128" x2="52" y2="128" stroke="#00F2FF" stroke-width="1" stroke-opacity="0.4"/>
            <line x1="10" y1="46" x2="10" y2="175" stroke="#00F2FF" stroke-width="2.5" stroke-dasharray="14 6"/>
            <line x1="66" y1="46" x2="66" y2="175" stroke="#00F2FF" stroke-width="2.5" stroke-dasharray="14 6"/>
            <path d="M14 182H62V192C62 195 56 198 38 198C20 198 14 195 14 192V182Z" fill="#00F2FF" fill-opacity="0.25" stroke="#00F2FF" stroke-width="1.2"/>
            <rect x="14" y="196" width="10" height="3" rx="1" fill="#FF2A4B"/>
            <rect x="52" y="196" width="10" height="3" rx="1" fill="#FF2A4B"/>
        </svg>`
    },
    god: {
        name: 'God Mode',
        class: 'Class: Ghost Hyper-Vehicle (PRO)',
        desc: 'Unlocked ghost vehicle. No collisions, no speed limit, maximum acceleration to fly anywhere across the map instantly.',
        topSpeed: '1,000+ KM/H (Unlimited)',
        topSpeedPct: '100%',
        power: 'Extreme (0.04 - 44x)',
        powerPct: '100%',
        brake: 'Instant (0.08)',
        brakePct: '100%',
        turnRate: 'Hyper-Agile (2.2)',
        turnRatePct: '100%',
        btnText: 'Unlock God Mode with Pro',
        isGod: true,
        svg: `<svg viewBox="0 0 86 150" fill="none" xmlns="http://www.w3.org/2000/svg" class="fleet-svg-showcase">
            <ellipse cx="43" cy="75" rx="36" ry="65" fill="#FF00E5" fill-opacity="0.12">
                <animate attributeName="rx" values="34;38;34" dur="2s" repeatCount="indefinite"/>
            </ellipse>
            <path d="M43 8L62 48L80 102L68 112L43 96L18 112L6 102L24 48L43 8Z" fill="#0A0610" stroke="#FF00E5" stroke-width="2.4"/>
            <polygon points="43,24 53,58 43,76 33,58" fill="#FF00E5" fill-opacity="0.38" stroke="#FF00E5" stroke-width="1.5"/>
            <polygon points="43,80 51,85 51,95 43,100 35,95 35,85" fill="#00F2FF" fill-opacity="0.4" stroke="#00F2FF" stroke-width="1.5">
                <animate attributeName="fill-opacity" values="0.2;0.7;0.2" dur="1.2s" repeatCount="indefinite"/>
            </polygon>
            <path d="M22 114L20 136L28 126L26 112" fill="#FF00E5" fill-opacity="0.75"/>
            <path d="M64 114L66 136L58 126L60 112" fill="#FF00E5" fill-opacity="0.75"/>
            <path d="M41 102L43 144L45 102" stroke="#00F2FF" stroke-width="2.2" stroke-linecap="round">
                <animate attributeName="stroke-opacity" values="0.4;1;0.4" dur="0.6s" repeatCount="indefinite"/>
            </path>
            <line x1="28" y1="52" x2="43" y2="76" stroke="#FF00E5" stroke-width="1" stroke-dasharray="3 2"/>
            <line x1="58" y1="52" x2="43" y2="76" stroke="#FF00E5" stroke-width="1" stroke-dasharray="3 2"/>
        </svg>`
    }
};

let currentVehicleKey = 'car';

function initFleetShowcase() {
    const tabs = document.querySelectorAll('.fleet-tab');
    const displayCard = document.getElementById('fleet-display');
    const visualPane = document.getElementById('fleet-visual-content');
    const classTag = document.getElementById('vehicle-class');
    const nameEl = document.getElementById('vehicle-name');
    const descEl = document.getElementById('vehicle-desc');
    const btnEl = document.getElementById('fleet-cta-btn');

    const statSpeedVal = document.getElementById('stat-speed-val');
    const statSpeedBar = document.getElementById('stat-speed-bar');
    const statPowerVal = document.getElementById('stat-power-val');
    const statPowerBar = document.getElementById('stat-power-bar');
    const statBrakeVal = document.getElementById('stat-brake-val');
    const statBrakeBar = document.getElementById('stat-brake-bar');
    const statTurnVal = document.getElementById('stat-turn-val');
    const statTurnBar = document.getElementById('stat-turn-bar');

    if (!tabs.length || !displayCard) return;

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            const key = tab.dataset.vehicle;
            const data = FLEET_DATA[key];
            if (!data) return;

            tabs.forEach((t) => t.classList.remove('active'));
            tab.classList.add('active');

            // Apply God Mode visual state
            if (data.isGod) {
                displayCard.classList.add('god-mode-active');
                if (btnEl) {
                    btnEl.href = '#pricing';
                    btnEl.className = 'btn btn-pro btn-lg';
                }
            } else {
                displayCard.classList.remove('god-mode-active');
                if (btnEl) {
                    btnEl.href = '/play';
                    btnEl.className = 'btn btn-primary btn-lg';
                }
            }

            // Update content
            if (visualPane) visualPane.innerHTML = data.svg;
            if (classTag) classTag.textContent = data.class;
            if (nameEl) nameEl.textContent = data.name;
            if (descEl) descEl.textContent = data.desc;
            if (btnEl) {
                btnEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> ${data.btnText}`;
            }

            // Update physics gauges
            if (statSpeedVal && statSpeedBar) {
                statSpeedVal.textContent = data.topSpeed;
                statSpeedBar.style.width = data.topSpeedPct;
            }
            if (statPowerVal && statPowerBar) {
                statPowerVal.textContent = data.power;
                statPowerBar.style.width = data.powerPct;
            }
            if (statBrakeVal && statBrakeBar) {
                statBrakeVal.textContent = data.brake;
                statBrakeBar.style.width = data.brakePct;
            }
            if (statTurnVal && statTurnBar) {
                statTurnVal.textContent = data.turnRate;
                statTurnBar.style.width = data.turnRatePct;
            }

            currentVehicleKey = key;
            if (typeof buildFleet3DMesh === 'function') {
                buildFleet3DMesh(key);
            }

            trackLandingEvent('fleet_vehicle_select', { vehicle: key, vehicle_name: data.name });
        });
    });
}

/* --------------------------------------------------------------------------
   5. REAL ONLINE ACTIVE PLAYERS BADGE (> 100 PLAYERS ONLY)
   -------------------------------------------------------------------------- */
function initRealOnlineBadge() {
    const pill = document.getElementById('nav-live-pill');
    if (!pill) return;

    // Strictly shown only when active players count > 100
    const activeCount = 0; // Current real baseline
    if (activeCount > 100) {
        pill.innerHTML = `<span class="live-indicator-dot"></span> ${activeCount.toLocaleString()} ONLINE`;
        pill.style.display = 'inline-flex';
    } else {
        pill.style.display = 'none';
    }
}

/* --------------------------------------------------------------------------
   6. ANNUAL / MONTHLY PRICING SWITCHER & FUNGIES CHECKOUT
   -------------------------------------------------------------------------- */
const FUNGIES_MONTHLY_URL = 'https://milanwebportal.app.fungies.io/subscribe/61d216ef-2508-4acd-9c8e-dc1fd437bf1c';
const FUNGIES_YEARLY_URL = 'https://milanwebportal.app.fungies.io/subscribe/578272f8-f871-45ba-8575-2ffbe8b4d4fb';

let monthlyPrice = '4.99';
let annualPrice = '2.99';
let monthlyUrl = FUNGIES_MONTHLY_URL;
let yearlyUrl = FUNGIES_YEARLY_URL;

function initPricing() {
    const toggle = document.getElementById('pricing-toggle-switch');
    const priceAmount = document.getElementById('pro-price-amount');
    const pricePeriod = document.getElementById('pro-price-period');
    const lblMonthly = document.getElementById('label-monthly');
    const lblAnnual = document.getElementById('label-annual');
    const proBtn = document.getElementById('pro-checkout-btn');

    if (!toggle || !priceAmount || !pricePeriod || !lblMonthly || !lblAnnual) return;

    let isAnnual = false;

    function applyPricingState() {
        toggle.classList.toggle('annual', isAnnual);
        toggle.setAttribute('aria-checked', String(isAnnual));

        lblMonthly.classList.toggle('active', !isAnnual);
        lblAnnual.classList.toggle('active', isAnnual);

        if (isAnnual) {
            priceAmount.textContent = annualPrice;
            pricePeriod.textContent = 'USD / month (billed annually, save 40%)';
            if (proBtn) proBtn.href = yearlyUrl;
        } else {
            priceAmount.textContent = monthlyPrice;
            pricePeriod.textContent = 'USD / month (cancel anytime)';
            if (proBtn) proBtn.href = monthlyUrl;
        }

        trackLandingEvent('pricing_period_toggle', {
            period: isAnnual ? 'annual' : 'monthly',
            displayed_price: isAnnual ? Number(annualPrice) : Number(monthlyPrice)
        });
    }

    // Dynamic fetch from Milan Web Portal Supabase
    fetchGeoRidePlans().then((plans) => {
        if (!plans || !plans.length) return;
        const pMonthly = plans.find((p) => p.id === 'pro_monthly');
        const pYearly = plans.find((p) => p.id === 'pro_yearly');
        if (pMonthly && pMonthly.price) monthlyPrice = Number(pMonthly.price).toFixed(2);
        if (pYearly && pYearly.price) annualPrice = Number(pYearly.price).toFixed(2);
        if (pMonthly && pMonthly.checkout_url) monthlyUrl = pMonthly.checkout_url;
        if (pYearly && pYearly.checkout_url) yearlyUrl = pYearly.checkout_url;
        applyPricingState();
    });

    if (proBtn) proBtn.href = monthlyUrl;

    toggle.addEventListener('click', () => {
        isAnnual = !isAnnual;
        applyPricingState();
    });

    toggle.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            isAnnual = !isAnnual;
            applyPricingState();
        }
    });

    lblMonthly.addEventListener('click', () => {
        if (isAnnual) {
            isAnnual = false;
            applyPricingState();
        }
    });

    lblAnnual.addEventListener('click', () => {
        if (!isAnnual) {
            isAnnual = true;
            applyPricingState();
        }
    });
}

/* --------------------------------------------------------------------------
   7. ACCESSIBLE FAQ ACCORDION
   -------------------------------------------------------------------------- */
function initFaq() {
    const items = document.querySelectorAll('.faq-item');
    if (!items.length) return;

    items.forEach((item) => {
        const btn = item.querySelector('.faq-question-btn');
        if (!btn) return;

        btn.addEventListener('click', () => {
            const isOpen = item.classList.contains('open');

            // Close all
            items.forEach((other) => {
                other.classList.remove('open');
                const otherBtn = other.querySelector('.faq-question-btn');
                if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
            });

            if (!isOpen) {
                item.classList.add('open');
                btn.setAttribute('aria-expanded', 'true');
                const questionText = btn.textContent ? btn.textContent.trim() : '';
                trackLandingEvent('faq_expand', { question: questionText.slice(0, 80) });
            }
        });
    });
}

/* --------------------------------------------------------------------------
   8. MOBILE NAVIGATION DRAWER
   -------------------------------------------------------------------------- */
function initMobileDrawer() {
    const hamburger = document.getElementById('hamburger-btn');
    const drawer = document.getElementById('mobile-drawer');
    const overlay = document.getElementById('drawer-overlay');
    const drawerLinks = document.querySelectorAll('.drawer-menu a, .drawer-footer a');

    if (!hamburger || !drawer || !overlay) return;

    function openDrawer() {
        hamburger.classList.add('active');
        hamburger.setAttribute('aria-expanded', 'true');
        drawer.classList.add('open');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
        hamburger.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
        drawer.classList.remove('open');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    hamburger.addEventListener('click', () => {
        const isOpen = drawer.classList.contains('open');
        if (isOpen) {
            closeDrawer();
        } else {
            openDrawer();
        }
    });

    const closeBtn = document.getElementById('drawer-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeDrawer);
    }

    overlay.addEventListener('click', closeDrawer);

    drawerLinks.forEach((link) => {
        link.addEventListener('click', closeDrawer);
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawer.classList.contains('open')) {
            closeDrawer();
        }
    });
}

/* --------------------------------------------------------------------------
   9. STICKY MOBILE ACTION BAR & NAVBAR SCROLL STATE
   -------------------------------------------------------------------------- */
function initScrollBehaviors() {
    const navHeader = document.getElementById('nav-header');
    const mobileBottomBar = document.getElementById('mobile-bottom-bar');
    const heroSection = document.getElementById('hero');
    const backToTopBtn = document.getElementById('back-to-top');
    const progressIndicator = document.getElementById('progress-ring-indicator');

    // SVG Circular Progress Setup: 2 * PI * r (r = 21) => ~131.95
    const radius = 21;
    const circumference = 2 * Math.PI * radius;
    if (progressIndicator) {
        progressIndicator.style.strokeDasharray = `${circumference} ${circumference}`;
        progressIndicator.style.strokeDashoffset = `${circumference}`;
    }

    function onScroll() {
        const scrollY = window.scrollY;
        if (navHeader) {
            navHeader.classList.toggle('scrolled', scrollY > 20);
        }

        // Back to top visibility & circular border progress
        if (backToTopBtn && progressIndicator) {
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            if (docHeight > 0) {
                const scrollFraction = Math.min(Math.max(scrollY / docHeight, 0), 1);
                const offset = circumference - scrollFraction * circumference;
                progressIndicator.style.strokeDashoffset = `${offset}`;
            }

            if (scrollY > 320) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Observe hero to display mobile bottom action bar once scrolled past hero
    if (mobileBottomBar && heroSection && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        mobileBottomBar.classList.remove('visible');
                    } else {
                        mobileBottomBar.classList.add('visible');
                    }
                });
            },
            { threshold: 0.2 }
        );
        observer.observe(heroSection);
    }
}

/* --------------------------------------------------------------------------
   10. SCROLL REVEAL ANIMATIONS (WITH BENTO STAGGER)
   -------------------------------------------------------------------------- */
function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;

    if (!('IntersectionObserver' in window)) {
        reveals.forEach((el) => el.classList.add('vis'));
        return;
    }

    // Assign stagger delay: bento-card siblings get per-sibling index for cascade
    reveals.forEach((el) => {
        if (el.classList.contains('bento-card')) {
            const parent = el.parentElement;
            const siblings = parent ? Array.from(parent.querySelectorAll('.bento-card.reveal')) : [];
            const sibIdx = siblings.indexOf(el);
            el.style.transitionDelay = `${sibIdx * 0.09}s`;
        } else {
            // Fallback: group-relative stagger for all other reveals
            const parent = el.parentElement;
            const siblings = parent ? Array.from(parent.querySelectorAll('.reveal')) : [];
            const sibIdx = Math.max(siblings.indexOf(el), 0);
            el.style.transitionDelay = `${(sibIdx % 5) * 0.07}s`;
        }
    });

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('vis');
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.06, rootMargin: '0px 0px -30px 0px' }
    );

    reveals.forEach((el) => observer.observe(el));
}

/* --------------------------------------------------------------------------
   11. HERO PARALLAX SCROLL
   -------------------------------------------------------------------------- */
function initHeroParallax() {
    const heroOverlay = document.querySelector('.hero-bg-overlay');
    const heroCanvas = document.getElementById('hero-canvas');
    if (!heroOverlay && !heroCanvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let ticking = false;
    window.addEventListener(
        'scroll',
        () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                const scrollY = window.scrollY;
                const factor = Math.min(scrollY * 0.2, 80);
                if (heroOverlay) heroOverlay.style.transform = `translateY(${factor}px)`;
                if (heroCanvas) heroCanvas.style.transform = `translateY(${factor * 0.5}px)`;
                ticking = false;
            });
        },
        { passive: true }
    );
}

/* --------------------------------------------------------------------------
   12. CONVERSION TRACKING CLICKS
   -------------------------------------------------------------------------- */
function initConversionTracking() {
    // Play CTA triggers
    document.querySelectorAll('[data-track="play_click"]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const loc = btn.dataset.trackLocation || 'unknown';
            trackLandingEvent('play_game_click', { cta_location: loc });
        });
    });

    // Pro checkout triggers
    document.querySelectorAll('[data-track="pro_click"]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const loc = btn.dataset.trackLocation || 'unknown';
            const isAnnual = document.getElementById('pricing-toggle-switch')?.classList.contains('annual');
            trackLandingEvent('pro_upgrade_click', {
                cta_location: loc,
                billing_period: isAnnual ? 'annual' : 'monthly',
                price: isAnnual ? 2.99 : 4.99
            });
        });
    });
}

/* --------------------------------------------------------------------------
   12. PWA SERVICE WORKER REGISTRATION
   -------------------------------------------------------------------------- */
if ('serviceWorker' in navigator) {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch((err) => {
                console.log('SW registration skipped:', err);
            });
        });
    }
}

/* --------------------------------------------------------------------------
   13. MAGNETIC BUTTONS (AWWWARDS INTERACTION)
   -------------------------------------------------------------------------- */
function initMagneticButtons() {
    if (window.matchMedia('(hover: none)').matches) return;
    const btns = document.querySelectorAll('.btn-primary, .btn-pro');
    btns.forEach((btn) => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - (rect.left + rect.width / 2);
            const y = e.clientY - (rect.top + rect.height / 2);
            btn.style.transform = `translate(${x * 0.18}px, ${y * 0.18}px)`;
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = '';
        });
    });
}

/* --------------------------------------------------------------------------
   14. INITIALIZATION ON DOM READY
   -------------------------------------------------------------------------- */

/* --------------------------------------------------------------------------
   4B. INTERACTIVE 3D FLEET WEBGL VIEWER (AWWWARDS THREE.JS SHOWCASE)
   -------------------------------------------------------------------------- */
let fleetScene, fleetCamera, fleetRenderer, fleetVehicleGroup;
let isFleetDragging = false,
    fleetPreviousMousePosition = { x: 0, y: 0 };
let fleetAutoRotate = true;

function initFleet3D() {
    const canvas = document.getElementById('fleet-3d-canvas');
    if (!canvas) return;

    let retryCount = 0;
    function startThree() {
        if (typeof window.THREE === 'undefined') {
            retryCount++;
            if (retryCount < 40) {
                setTimeout(startThree, 100);
            } else {
                // Fallback to SVG Schematic if CDN unreachable
                canvas.style.display = 'none';
                const visualSvg = document.getElementById('fleet-visual-content');
                if (visualSvg) visualSvg.style.display = 'block';
                const btn3d = document.getElementById('fleet-view-3d-btn');
                const btnSvg = document.getElementById('fleet-view-svg-btn');
                if (btn3d && btnSvg) {
                    btn3d.classList.remove('active');
                    btnSvg.classList.add('active');
                }
            }
            return;
        }
        const THREE = window.THREE;
        fleetScene = new THREE.Scene();

        const width = canvas.parentElement ? canvas.parentElement.clientWidth || 360 : 360;
        const height = 240;
        fleetCamera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
        fleetCamera.position.set(0, 3.2, 7.5);
        fleetCamera.lookAt(0, 0, 0);

        try {
            fleetRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
            fleetRenderer.setSize(width, height);
            fleetRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        } catch (_e) {
            // WebGL blocked / unavailable
            canvas.style.display = 'none';
            const visualSvg = document.getElementById('fleet-visual-content');
            if (visualSvg) visualSvg.style.display = 'block';
            const btn3d = document.getElementById('fleet-view-3d-btn');
            const btnSvg = document.getElementById('fleet-view-svg-btn');
            if (btn3d && btnSvg) {
                btn3d.classList.remove('active');
                btnSvg.classList.add('active');
            }
            return;
        }

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
        fleetScene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0x00f2ff, 1.2);
        dirLight.position.set(5, 10, 7);
        fleetScene.add(dirLight);

        const rimLight = new THREE.DirectionalLight(0xc470f0, 1.0);
        rimLight.position.set(-5, -5, -5);
        fleetScene.add(rimLight);

        // Vehicle Container Group
        fleetVehicleGroup = new THREE.Group();
        fleetScene.add(fleetVehicleGroup);

        buildFleet3DMesh(currentVehicleKey);

        // Interactive Drag to Rotate
        canvas.addEventListener('mousedown', (e) => {
            isFleetDragging = true;
            fleetAutoRotate = false;
            fleetPreviousMousePosition = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('mousemove', (e) => {
            if (!isFleetDragging || !fleetVehicleGroup) return;
            const deltaX = e.clientX - fleetPreviousMousePosition.x;
            const deltaY = e.clientY - fleetPreviousMousePosition.y;
            fleetVehicleGroup.rotation.y += deltaX * 0.015;
            fleetVehicleGroup.rotation.x = Math.max(-0.5, Math.min(0.8, fleetVehicleGroup.rotation.x + deltaY * 0.01));
            fleetPreviousMousePosition = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('mouseup', () => {
            if (isFleetDragging) {
                isFleetDragging = false;
                setTimeout(() => {
                    fleetAutoRotate = true;
                }, 2500);
            }
        });

        // Touch Gestures
        canvas.addEventListener(
            'touchstart',
            (e) => {
                if (e.touches.length === 1) {
                    isFleetDragging = true;
                    fleetAutoRotate = false;
                    fleetPreviousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                }
            },
            { passive: true }
        );

        canvas.addEventListener(
            'touchmove',
            (e) => {
                if (!isFleetDragging || !fleetVehicleGroup || e.touches.length !== 1) return;
                const deltaX = e.touches[0].clientX - fleetPreviousMousePosition.x;
                const deltaY = e.touches[0].clientY - fleetPreviousMousePosition.y;
                fleetVehicleGroup.rotation.y += deltaX * 0.015;
                fleetVehicleGroup.rotation.x = Math.max(
                    -0.5,
                    Math.min(0.8, fleetVehicleGroup.rotation.x + deltaY * 0.01)
                );
                fleetPreviousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            },
            { passive: true }
        );

        canvas.addEventListener('touchend', () => {
            if (isFleetDragging) {
                isFleetDragging = false;
                setTimeout(() => {
                    fleetAutoRotate = true;
                }, 2500);
            }
        });

        // Resize Listener
        window.addEventListener('resize', () => {
            if (!canvas.parentElement) return;
            const newW = canvas.parentElement.clientWidth || 360;
            fleetCamera.aspect = newW / height;
            fleetCamera.updateProjectionMatrix();
            fleetRenderer.setSize(newW, height);
        });

        // Smooth Animation Loop
        function animateFleet() {
            requestAnimationFrame(animateFleet);
            if (fleetVehicleGroup && fleetAutoRotate) {
                fleetVehicleGroup.rotation.y += 0.008;
            }
            if (fleetRenderer && fleetScene && fleetCamera) {
                fleetRenderer.render(fleetScene, fleetCamera);
            }
        }
        animateFleet();
    }

    startThree();
}

function buildFleet3DMesh(type) {
    if (typeof window.THREE === 'undefined' || !fleetVehicleGroup) return;
    const THREE = window.THREE;

    while (fleetVehicleGroup.children.length > 0) {
        const obj = fleetVehicleGroup.children[0];
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
            else obj.material.dispose();
        }
        fleetVehicleGroup.remove(obj);
    }

    fleetVehicleGroup.rotation.set(0.15, Math.PI / 4, 0);

    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0a0e1a, roughness: 0.2, metalness: 0.85 });
    const cyanNeonMat = new THREE.MeshStandardMaterial({
        color: 0x00f2ff,
        emissive: 0x00f2ff,
        emissiveIntensity: 1.8,
        roughness: 0.1
    });
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0x00f2ff,
        transparent: true,
        opacity: 0.65,
        roughness: 0.1
    });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x04060a, roughness: 0.8 });
    const proMagentaMat = new THREE.MeshStandardMaterial({
        color: 0xff00e5,
        emissive: 0xff00e5,
        emissiveIntensity: 2.2,
        wireframe: true
    });
    const proCoreMat = new THREE.MeshStandardMaterial({ color: 0x1f062b, roughness: 0.1, metalness: 0.9 });

    if (type === 'car') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.45, 4.2), darkMat);
        body.position.y = 0.4;
        fleetVehicleGroup.add(body);

        const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.25, 1.4), darkMat);
        hood.position.set(0, 0.55, 1.3);
        hood.rotation.x = -0.15;
        fleetVehicleGroup.add(hood);

        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 1.8), glassMat);
        cabin.position.set(0, 0.75, -0.1);
        fleetVehicleGroup.add(cabin);

        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.06, 1.4), darkMat);
        roof.position.set(0, 1.05, -0.15);
        fleetVehicleGroup.add(roof);

        const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.1), cyanNeonMat);
        hlL.position.set(-0.6, 0.48, 2.11);
        const hlR = hlL.clone();
        hlR.position.x = 0.6;
        fleetVehicleGroup.add(hlL, hlR);

        const tailBar = new THREE.Mesh(
            new THREE.BoxGeometry(1.7, 0.08, 0.1),
            new THREE.MeshStandardMaterial({ color: 0xff1e42, emissive: 0xff1e42, emissiveIntensity: 2.2 })
        );
        tailBar.position.set(0, 0.52, -2.11);
        fleetVehicleGroup.add(tailBar);

        const wheelGeom = new THREE.CylinderGeometry(0.38, 0.38, 0.25, 16);
        wheelGeom.rotateZ(Math.PI / 2);
        [
            [-0.95, 0.38, 1.3],
            [0.95, 0.38, 1.3],
            [-0.95, 0.38, -1.3],
            [0.95, 0.38, -1.3]
        ].forEach((pos) => {
            const w = new THREE.Mesh(wheelGeom, tireMat);
            w.position.set(...pos);
            fleetVehicleGroup.add(w);
        });
    } else if (type === 'truck') {
        const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.4, 1.8), darkMat);
        cab.position.set(0, 0.9, 1.5);
        fleetVehicleGroup.add(cab);

        const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 0.1), glassMat);
        windshield.position.set(0, 1.2, 2.41);
        fleetVehicleGroup.add(windshield);

        const trailer = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.7, 4.2), darkMat);
        trailer.position.set(0, 1.2, -1.5);
        fleetVehicleGroup.add(trailer);

        const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.1, 4.2), cyanNeonMat);
        stripe.position.set(0, 0.7, -1.5);
        fleetVehicleGroup.add(stripe);

        const wheelGeom = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 16);
        wheelGeom.rotateZ(Math.PI / 2);
        [
            [-1.05, 0.42, 1.5],
            [1.05, 0.42, 1.5],
            [-1.05, 0.42, -1.2],
            [1.05, 0.42, -1.2],
            [-1.05, 0.42, -2.8],
            [1.05, 0.42, -2.8]
        ].forEach((pos) => {
            const w = new THREE.Mesh(wheelGeom, tireMat);
            w.position.set(...pos);
            fleetVehicleGroup.add(w);
        });
    } else if (type === 'bus') {
        const busBody = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 5.6), darkMat);
        busBody.position.set(0, 1.0, 0);
        fleetVehicleGroup.add(busBody);

        const windows = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.55, 5.0), glassMat);
        windows.position.set(0, 1.25, 0.1);
        fleetVehicleGroup.add(windows);

        const routeSign = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.05), cyanNeonMat);
        routeSign.position.set(0, 1.62, 2.81);
        fleetVehicleGroup.add(routeSign);

        const wheelGeom = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
        wheelGeom.rotateZ(Math.PI / 2);
        [
            [-1.02, 0.4, 1.8],
            [1.02, 0.4, 1.8],
            [-1.02, 0.4, -1.8],
            [1.02, 0.4, -1.8]
        ].forEach((pos) => {
            const w = new THREE.Mesh(wheelGeom, tireMat);
            w.position.set(...pos);
            fleetVehicleGroup.add(w);
        });
    } else if (type === 'god') {
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 2), proCoreMat);
        core.position.y = 0.8;
        fleetVehicleGroup.add(core);

        const auraWire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 1), proMagentaMat);
        auraWire.position.y = 0.8;
        fleetVehicleGroup.add(auraWire);

        const ringGeom = new THREE.TorusGeometry(2.1, 0.04, 16, 64);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0x00f2ff, emissive: 0x00f2ff, emissiveIntensity: 2.8 });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.position.y = 0.8;
        ring.rotation.x = Math.PI / 3;
        fleetVehicleGroup.add(ring);
    }
}

function initFleetViewToggle() {
    const btn3d = document.getElementById('fleet-view-3d-btn');
    const btnSvg = document.getElementById('fleet-view-svg-btn');
    const canvas3d = document.getElementById('fleet-3d-canvas');
    const visualSvg = document.getElementById('fleet-visual-content');
    const statusText = document.getElementById('fleet-hologram-status');

    if (!btn3d || !btnSvg || !canvas3d || !visualSvg) return;

    btn3d.addEventListener('click', () => {
        btn3d.classList.add('active');
        btn3d.setAttribute('aria-pressed', 'true');
        btnSvg.classList.remove('active');
        btnSvg.setAttribute('aria-pressed', 'false');
        canvas3d.style.display = 'block';
        visualSvg.style.display = 'none';
        if (statusText) statusText.textContent = 'INTERACTIVE 3D WEBGL MODEL • DRAG TO ROTATE';
        trackLandingEvent('fleet_view_toggle', { mode: '3d' });
    });

    btnSvg.addEventListener('click', () => {
        btnSvg.classList.add('active');
        btnSvg.setAttribute('aria-pressed', 'true');
        btn3d.classList.remove('active');
        btn3d.setAttribute('aria-pressed', 'false');
        canvas3d.style.display = 'none';
        visualSvg.style.display = 'block';
        if (statusText) statusText.textContent = '2D SCHEMATIC BLUEPRINT VIEW';
        trackLandingEvent('fleet_view_toggle', { mode: 'schematic' });
    });
}

/* --------------------------------------------------------------------------
   14. DEVELOPER UPDATES & LEAD CAPTURE
   -------------------------------------------------------------------------- */
function initLeadCapture() {
    const form = document.getElementById('lead-capture-form');
    const emailInput = document.getElementById('lead-email-input');
    const feedback = document.getElementById('lead-feedback');
    if (!form || !emailInput || !feedback) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            feedback.className = 'updates-feedback error';
            feedback.textContent = 'Please enter a valid email address.';
            return;
        }

        try {
            const subs = JSON.parse(localStorage.getItem('geo_ride_subs') || '[]');
            subs.push({ email, timestamp: new Date().toISOString() });
            localStorage.setItem('geo_ride_subs', JSON.stringify(subs));
            getOrCreateAccount(email);
        } catch (_e) {}

        trackLandingEvent('lead_captured', { email_domain: email.split('@')[1] });

        feedback.className = 'updates-feedback success';
        feedback.textContent = "You're on the grid! We will notify you when new maps and vehicles drop.";
        emailInput.value = '';
    });
}

/* --------------------------------------------------------------------------
   15. LEGAL MODAL (PRIVACY, TERMS & REFUNDS)
   -------------------------------------------------------------------------- */
const LEGAL_TEXTS = {
    privacy: `
        <h4>1. Personal Data & Privacy by Design</h4>
        <p>GEO Ride is built with privacy by design. We do not track, collect, or store your real-world GPS coordinates, identity, or personal device location.</p>
        <h4>2. Local Storage & Preferences</h4>
        <p>Your vehicle preferences, measurement units (km/mi), camera pitch, and sound volume are saved exclusively in your browser's local storage (localStorage). No tracking cookies are placed on third-party sites.</p>
        <h4>3. Analytics & Telemetry</h4>
        <p>We use anonymized Google Analytics 4 (GA4) with IP anonymization enabled to monitor performance, WebGL frame rates, and error boundaries so we can continually optimize the experience for all devices.</p>
    `,
    terms: `
        <h4>1. Acceptance of Terms</h4>
        <p>By accessing and playing GEO Ride, you agree to these Terms of Service. GEO Ride is free to play in your browser without warranty, provided as-is.</p>
        <h4>2. Map Data & Attributions</h4>
        <p>Satellite imagery, building extrusions, and street vector data are licensed via Mapbox and OpenStreetMap contributors. Commercial reproduction or reverse engineering of map tiles is prohibited.</p>
        <h4>3. Pro Membership & Fungies Checkout</h4>
        <p>Pro access is billed either monthly ($4.99) or annually ($2.99/mo) via Fungies. Subscriptions renew automatically until cancelled. You may cancel at any time through your account dashboard or by contacting support.</p>
    `,
    refund: `
        <h4>1. 14-Day Refund Guarantee</h4>
        <p>If you are not 100% satisfied with GEO Ride Pro, you can request a full refund within 14 days of purchase with no questions asked.</p>
        <h4>2. How to Request a Refund</h4>
        <p>Simply send an email to <strong>support@milanwebportal.com</strong> with your order ID or email used at checkout. Refunds are processed within 2-3 business days back to your original payment method.</p>
        <h4>3. Cancellation Notice</h4>
        <p>Cancelling a subscription stops all future billings while keeping your Pro access active until the end of the paid billing cycle.</p>
    `
};

function initLegalModal() {
    const modal = document.getElementById('legal-modal');
    const closeBtn = document.getElementById('legal-modal-close');
    const bodyEl = document.getElementById('legal-modal-body');
    const tabs = document.querySelectorAll('.legal-tab-btn');
    const triggers = document.querySelectorAll('[data-legal]');

    if (!modal || !bodyEl) return;

    function openModal(tabKey) {
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        setTab(tabKey);
        document.body.style.overflow = 'hidden';
        trackLandingEvent('legal_doc_view', { document: tabKey });
    }

    function closeModal() {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    function setTab(tabKey) {
        tabs.forEach((t) => {
            const isActive = t.dataset.tab === tabKey;
            t.classList.toggle('active', isActive);
            t.setAttribute('aria-selected', String(isActive));
        });
        bodyEl.innerHTML = LEGAL_TEXTS[tabKey] || LEGAL_TEXTS.privacy;
    }

    triggers.forEach((trig) => {
        trig.addEventListener('click', (e) => {
            e.preventDefault();
            const tabKey = trig.dataset.legal || 'privacy';
            openModal(tabKey);
        });
    });

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            setTab(tab.dataset.tab);
        });
    });

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        }
    });
}

function bootLanding() {
    initHeroCanvas();
    initSpotlightCards();
    initFleetShowcase();
    initFleet3D();
    initFleetViewToggle();
    initRealOnlineBadge();
    initPricing();
    initFaq();
    initMobileDrawer();
    initScrollBehaviors();
    initScrollReveal();
    initHeroParallax();
    initMagneticButtons();
    initLeadCapture();
    initLegalModal();
    initConversionTracking();
    trackWebVitals();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootLanding);
} else {
    bootLanding();
}
