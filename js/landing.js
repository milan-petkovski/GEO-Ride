/**
 * @file landing.js
 * @description Ultra-lightweight, zero-long-task landing page controller for GEO Ride.
 *              Includes IntersectionObserver-paused Hero canvas, lazy Three.js 3D vehicle preview,
 *              interactive gameplay HUD preview, destination tabs, pricing switch, FAQ accordion,
 *              advanced GA4/GTM analytics (AI referral tracking, Core Web Vitals RUM, session telemetry,
 *              scroll depth milestones, engagement time, conversion funnels), and WebMCP agentic registration.
 */

import { trackEvent, trackWebVitals, trackAIReferral } from './analytics.js';

// Ensure deferred stylesheet is active in its own animation frame
requestAnimationFrame(() => {
    setTimeout(() => {
        const deferredLink = document.getElementById('deferred-css');
        if (deferredLink && deferredLink.media !== 'all') {
            deferredLink.media = 'all';
        }
    }, 0);
});

/* --------------------------------------------------------------------------
   1. GA4 / GTAG ADVANCED EVENT TRACKING (GDPR-SAFE)
   -------------------------------------------------------------------------- */
export function trackLandingEvent(eventName, params = {}) {
    try {
        trackEvent(eventName, {
            source_page: 'landing',
            ...params
        });
    } catch (_err) {
        // Never block UI on analytics error
    }
}

/* --------------------------------------------------------------------------
   2. HERO CYBER CANVAS (INTERSECTIONOBSERVER + REDUCED-MOTION + MOBILE CAP)
   -------------------------------------------------------------------------- */
function initHeroCanvas() {
    const canvas = document.getElementById('hero-canvas');
    const heroSection = document.getElementById('hero');
    if (!canvas || !heroSection) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const isLowPowerOrMobile = () =>
        window.innerWidth < 768 || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const particleCount = isLowPowerOrMobile() ? 16 : 32;
    const particles = [];
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            r: Math.random() * 1.5 + 0.7,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            isCyan: i % 3 !== 0
        });
    }

    function renderFrame(advanceParticles) {
        ctx.clearRect(0, 0, width, height);
        const horizonY = height * 0.64;
        const vanishX = width * 0.5;

        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(0, 242, 255, 0.04)';
        for (let i = 0; i <= 10; i++) {
            const bx = (width / 10) * i;
            ctx.beginPath();
            ctx.moveTo(bx, height);
            ctx.lineTo(vanishX, horizonY);
            ctx.stroke();
        }

        for (let j = 1; j <= 5; j++) {
            const t = j / 5;
            const y = horizonY + (height - horizonY) * (t * t);
            ctx.strokeStyle = `rgba(0, 242, 255, ${(0.015 + t * 0.03).toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            if (advanceParticles) {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0) p.x = width;
                if (p.x > width) p.x = 0;
                if (p.y < 0) p.y = height;
                if (p.y > height) p.y = 0;
            }
            ctx.fillStyle = p.isCyan ? 'rgba(0, 242, 255, 0.45)' : 'rgba(196, 112, 240, 0.45)';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Draw initial crisp frame immediately
    renderFrame(false);

    let rafId = null;
    let isHeroVisible = true;
    let lastFrameTime = 0;
    const frameInterval = 34; // Cap at ~30 FPS on desktop

    function shouldAnimate() {
        return !reducedMotionQuery.matches && !isLowPowerOrMobile() && isHeroVisible && !document.hidden;
    }

    function loop(now) {
        if (!shouldAnimate()) {
            rafId = null;
            return;
        }
        if (now - lastFrameTime >= frameInterval) {
            lastFrameTime = now;
            renderFrame(true);
        }
        rafId = requestAnimationFrame(loop);
    }

    function updateLoopState() {
        if (shouldAnimate()) {
            if (!rafId) rafId = requestAnimationFrame(loop);
        } else if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(
            (entries) => {
                isHeroVisible = Boolean(entries[0]?.isIntersecting);
                updateLoopState();
            },
            { threshold: 0.05 }
        );
        observer.observe(heroSection);
    }

    window.addEventListener(
        'resize',
        () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            renderFrame(false);
            updateLoopState();
        },
        { passive: true }
    );

    document.addEventListener('visibilitychange', updateLoopState);
    if (typeof reducedMotionQuery.addEventListener === 'function') {
        reducedMotionQuery.addEventListener('change', updateLoopState);
    }

    updateLoopState();
}

/* --------------------------------------------------------------------------
   3. MAGNETIC MOUSE EFFECT FOR PLAY FREE (.btn-primary) BUTTONS
   -------------------------------------------------------------------------- */
function initMagneticButtons() {
    if (
        !window.matchMedia('(hover: hover) and (pointer: fine)').matches ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
        return;
    }

    const buttons = document.querySelectorAll('.btn');
    buttons.forEach((btn) => {
        btn.addEventListener(
            'pointermove',
            (e) => {
                if (!btn.classList.contains('btn-primary')) {
                    btn.style.transform = '';
                    return;
                }
                const rect = btn.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                const dx = Math.max(-9, Math.min(9, (e.clientX - cx) * 0.22));
                const dy = Math.max(-5, Math.min(5, (e.clientY - cy) * 0.28));
                btn.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
            },
            { passive: true }
        );

        const resetTransform = () => {
            btn.style.transform = '';
        };
        btn.addEventListener('pointerleave', resetTransform, { passive: true });
        btn.addEventListener('pointerdown', resetTransform, { passive: true });
        btn.addEventListener('blur', resetTransform, { passive: true });
    });
}

/* --------------------------------------------------------------------------
   4. VEHICLE FLEET SHOWCASE & LAZY THREE.JS 3D TURNTABLE
   -------------------------------------------------------------------------- */
const FLEET_DATA = {
    car: {
        name: 'Sports Car',
        classTag: 'Class: Agile Sports Car (Free)',
        desc: 'Balanced high-revving sports car. Crisp turn-in, responsive handbrake drift slip, and rapid acceleration ideal for city streets and tight mountain hairpins.',
        speedVal: '250 KM/H',
        speedPct: '80%',
        powerVal: 'High (0.0009)',
        powerPct: '70%',
        brakeVal: 'Strong (0.004)',
        brakePct: '80%',
        turnVal: 'Sharp (0.8)',
        turnPct: '88%',
        ctaText: 'Drive Sports Car Free',
        ctaHref: '/play?vehicle=car',
        isPro: false,
        svg: `<svg viewBox="0 0 70 140" fill="none" xmlns="http://www.w3.org/2000/svg" class="fleet-svg-showcase" aria-hidden="true">
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
        name: 'Heavy Semi Truck',
        classTag: 'Class: Heavy Semi Truck (Free)',
        desc: 'Heavy semi truck. Slow to accelerate and brake, requires wide turns. High momentum and satisfying stability on highways.',
        speedVal: '150 KM/H',
        speedPct: '48%',
        powerVal: 'Heavy (0.00045)',
        powerPct: '35%',
        brakeVal: 'Gradual (0.002)',
        brakePct: '40%',
        turnVal: 'Heavy (0.5)',
        turnPct: '38%',
        ctaText: 'Drive Heavy Truck Free',
        ctaHref: '/play?vehicle=truck',
        isPro: false,
        svg: `<svg viewBox="0 0 80 210" fill="none" xmlns="http://www.w3.org/2000/svg" class="fleet-svg-showcase" aria-hidden="true">
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
        name: 'City Transit Bus',
        classTag: 'Class: City Transit Bus (Free)',
        desc: 'City bus. Controlled top speed with surprisingly responsive urban steering geometry, engineered for metropolitan exploration.',
        speedVal: '120 KM/H',
        speedPct: '38%',
        powerVal: 'Low (0.00035)',
        powerPct: '28%',
        brakeVal: 'Smooth (0.0015)',
        brakePct: '30%',
        turnVal: 'Responsive (1.0)',
        turnPct: '55%',
        ctaText: 'Drive City Bus Free',
        ctaHref: '/play?vehicle=bus',
        isPro: false,
        svg: `<svg viewBox="0 0 76 210" fill="none" xmlns="http://www.w3.org/2000/svg" class="fleet-svg-showcase" aria-hidden="true">
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
        classTag: 'Class: Ghost Hyper-Vehicle (PRO)',
        desc: 'Unlocked ghost vehicle. No collisions, no speed limit, and extreme 44x acceleration to fly anywhere across the map instantly.',
        speedVal: '1,000+ KM/H',
        speedPct: '100%',
        powerVal: 'Extreme (0.04 - 44x)',
        powerPct: '100%',
        brakeVal: 'Instant (0.08)',
        brakePct: '100%',
        turnVal: 'Hyper-Agile (2.2)',
        turnPct: '100%',
        ctaText: 'Unlock God Mode With Pro',
        ctaHref: '#pricing',
        isPro: true,
        svg: `<svg viewBox="0 0 86 150" fill="none" xmlns="http://www.w3.org/2000/svg" class="fleet-svg-showcase" aria-hidden="true">
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

let currentFleetVehicle = 'car';
let fleetScene = null;
let fleetCamera = null;
let fleetRenderer = null;
let fleetVehicleGroup = null;
let isFleetDragging = false;
let fleetPreviousMousePosition = { x: 0, y: 0 };
let fleetAutoRotate = true;

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

export function selectFleetVehicle(key) {
    const data = FLEET_DATA[key];
    if (!data) return false;
    currentFleetVehicle = key;

    document.querySelectorAll('.fleet-tab').forEach((tab) => {
        const isMatch = tab.getAttribute('data-vehicle') === key;
        tab.classList.toggle('active', isMatch);
        tab.setAttribute('aria-selected', String(isMatch));
    });

    const displayCard = document.getElementById('fleet-panel');
    if (displayCard) {
        displayCard.classList.toggle('god-mode-active', Boolean(data.isPro));
    }

    const setElText = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.textContent = txt;
    };
    const setElWidth = (id, w) => {
        const el = document.getElementById(id);
        if (el) el.style.width = w;
    };

    setElText('vehicle-class', data.classTag);
    setElText('vehicle-name', data.name);
    setElText('vehicle-desc', data.desc);
    setElText('spec-speed-val', data.speedVal);
    setElWidth('spec-speed-bar', data.speedPct);
    setElText('spec-power-val', data.powerVal);
    setElWidth('spec-power-bar', data.powerPct);
    setElText('spec-brake-val', data.brakeVal);
    setElWidth('spec-brake-bar', data.brakePct);
    setElText('spec-turn-val', data.turnVal);
    setElWidth('spec-turn-bar', data.turnPct);
    setElText('vehicle-cta-text', data.ctaText);

    const ctaBtn = document.getElementById('vehicle-cta-btn');
    if (ctaBtn) {
        ctaBtn.setAttribute('href', data.ctaHref);
        ctaBtn.setAttribute('data-track', data.isPro ? 'pro_click' : 'play_click');
        ctaBtn.className = data.isPro ? 'btn btn-pro-solid' : 'btn btn-primary';
    }

    const svgContainer = document.getElementById('fleet-svg-container');
    if (svgContainer) {
        svgContainer.innerHTML = data.svg;
    }

    buildFleet3DMesh(key);
    trackLandingEvent('fleet_vehicle_select', { vehicle: key, vehicle_name: data.name });
    return true;
}

function initFleetShowcase() {
    document.querySelectorAll('.fleet-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            const v = tab.getAttribute('data-vehicle');
            if (v) selectFleetVehicle(v);
        });
    });

    const btn3d = document.getElementById('fleet-view-3d-btn');
    const btnSvg = document.getElementById('fleet-view-svg-btn');
    const canvas3d = document.getElementById('fleet-3d-canvas');
    const svgBox = document.getElementById('fleet-svg-container');

    if (btn3d && btnSvg && canvas3d && svgBox) {
        btn3d.addEventListener('click', () => {
            btn3d.classList.add('active');
            btn3d.setAttribute('aria-pressed', 'true');
            btnSvg.classList.remove('active');
            btnSvg.setAttribute('aria-pressed', 'false');
            canvas3d.style.display = 'block';
            svgBox.style.display = 'none';
            trackLandingEvent('fleet_view_toggle', { mode: '3d' });
        });
        btnSvg.addEventListener('click', () => {
            btnSvg.classList.add('active');
            btnSvg.setAttribute('aria-pressed', 'true');
            btn3d.classList.remove('active');
            btn3d.setAttribute('aria-pressed', 'false');
            canvas3d.style.display = 'none';
            svgBox.style.display = 'flex';
            if (FLEET_DATA[currentFleetVehicle]) {
                svgBox.innerHTML = FLEET_DATA[currentFleetVehicle].svg;
            }
            trackLandingEvent('fleet_view_toggle', { mode: 'schematic' });
        });
    }

    const fleetSection = document.getElementById('fleet');
    if (!fleetSection || !canvas3d) return;

    let threeBooted = false;
    let inView = true;

    function startThreeScene() {
        if (typeof window.THREE === 'undefined' || fleetRenderer) return;
        const THREE = window.THREE;
        fleetScene = new THREE.Scene();

        const getCanvasWidth = () => {
            if (!canvas3d.parentElement) return 320;
            const cs = window.getComputedStyle(canvas3d.parentElement);
            const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
            return Math.max(200, Math.floor(canvas3d.parentElement.clientWidth - padX));
        };
        const width = getCanvasWidth();
        const height = 240;
        fleetCamera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
        fleetCamera.position.set(0, 3.2, 7.5);
        fleetCamera.lookAt(0, 0, 0);

        try {
            fleetRenderer = new THREE.WebGLRenderer({ canvas: canvas3d, alpha: true, antialias: true });
            fleetRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            fleetRenderer.setSize(width, height, false);
        } catch (_e) {
            if (btnSvg) btnSvg.click();
            return;
        }

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
        fleetScene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0x00f2ff, 1.2);
        dirLight.position.set(5, 10, 7);
        fleetScene.add(dirLight);

        const rimLight = new THREE.DirectionalLight(0xc470f0, 1.0);
        rimLight.position.set(-5, -5, -5);
        fleetScene.add(rimLight);

        fleetVehicleGroup = new THREE.Group();
        fleetScene.add(fleetVehicleGroup);

        buildFleet3DMesh(currentFleetVehicle);

        canvas3d.addEventListener('mousedown', (e) => {
            isFleetDragging = true;
            fleetAutoRotate = false;
            fleetPreviousMousePosition = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener(
            'mousemove',
            (e) => {
                if (!isFleetDragging || !fleetVehicleGroup) return;
                const deltaX = e.clientX - fleetPreviousMousePosition.x;
                const deltaY = e.clientY - fleetPreviousMousePosition.y;
                fleetVehicleGroup.rotation.y += deltaX * 0.015;
                fleetVehicleGroup.rotation.x = Math.max(
                    -0.5,
                    Math.min(0.8, fleetVehicleGroup.rotation.x + deltaY * 0.01)
                );
                fleetPreviousMousePosition = { x: e.clientX, y: e.clientY };
            },
            { passive: true }
        );

        window.addEventListener(
            'mouseup',
            () => {
                if (isFleetDragging) {
                    isFleetDragging = false;
                    setTimeout(() => {
                        fleetAutoRotate = true;
                    }, 2500);
                }
            },
            { passive: true }
        );

        canvas3d.addEventListener(
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

        canvas3d.addEventListener(
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

        canvas3d.addEventListener(
            'touchend',
            () => {
                if (isFleetDragging) {
                    isFleetDragging = false;
                    setTimeout(() => {
                        fleetAutoRotate = true;
                    }, 2500);
                }
            },
            { passive: true }
        );

        window.addEventListener(
            'resize',
            () => {
                if (!canvas3d.parentElement || !fleetCamera || !fleetRenderer) return;
                const newW = getCanvasWidth();
                fleetCamera.aspect = newW / height;
                fleetCamera.updateProjectionMatrix();
                fleetRenderer.setSize(newW, height, false);
            },
            { passive: true }
        );

        function animateFleet() {
            requestAnimationFrame(animateFleet);
            if (!inView || document.hidden || canvas3d.style.display === 'none') return;
            if (fleetVehicleGroup && fleetAutoRotate) {
                fleetVehicleGroup.rotation.y += 0.008;
            }
            if (fleetRenderer && fleetScene && fleetCamera) {
                fleetRenderer.render(fleetScene, fleetCamera);
            }
        }
        animateFleet();
    }

    function ensureThreeLoaded() {
        if (threeBooted) return;
        threeBooted = true;
        if (typeof window.THREE !== 'undefined') {
            startThreeScene();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/three@0.147.0/build/three.min.js';
        script.integrity = 'sha384-vV17nr/rMaJqmeZkFUzXLpHdQ+ME5QHKdydaqqN+3Ga39RJlNrTatJxHwGV4ml2C';
        script.crossOrigin = 'anonymous';
        script.async = true;
        script.onload = startThreeScene;
        script.onerror = () => {
            if (btnSvg) btnSvg.click();
        };
        document.head.appendChild(script);
    }

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(
            (entries) => {
                inView = Boolean(entries[0]?.isIntersecting);
                if (inView) ensureThreeLoaded();
            },
            { rootMargin: '500px 0px' }
        );
        observer.observe(fleetSection);
    } else {
        ensureThreeLoaded();
    }
}

/* --------------------------------------------------------------------------
   5. DESTINATIONS FILTER
   -------------------------------------------------------------------------- */
export function filterDestinationsByCategory(category) {
    const cards = document.querySelectorAll('#destinations-grid .dest-card');
    if (!cards.length) return false;

    document.querySelectorAll('.dest-tab').forEach((tab) => {
        const isMatch = tab.getAttribute('data-filter') === category;
        tab.classList.toggle('active', isMatch);
        tab.setAttribute('aria-selected', String(isMatch));
    });

    cards.forEach((card) => {
        const cardCat = card.getAttribute('data-category');
        const isFeatured = card.getAttribute('data-featured') === 'true';
        const show = category === 'all' ? isFeatured : cardCat === category;
        card.style.display = show ? 'flex' : 'none';
    });
    return true;
}

function initDestinationsFilter() {
    filterDestinationsByCategory('all');
    document.querySelectorAll('.dest-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            const cat = tab.getAttribute('data-filter') || 'all';
            filterDestinationsByCategory(cat);
            trackLandingEvent('destinations_filter', { category: cat });
        });
    });
}

/* --------------------------------------------------------------------------
   6. PRICING BILLING SWITCH & PRICING_VIEW GA4 EVENT
   -------------------------------------------------------------------------- */
function initPricing() {
    const switchBtn = document.getElementById('billing-switch');
    const lblMonthly = document.getElementById('label-monthly');
    const lblAnnual = document.getElementById('label-annual');
    const priceEl = document.getElementById('pro-price');
    const periodEl = document.getElementById('pro-period');
    const checkoutBtn = document.getElementById('pro-checkout-btn');

    const URL_ANNUAL = 'https://pay.milanwebportal.com/checkout-element?id=057ae4b6-abef-4a0d-b770-c47a744d6328';
    const URL_MONTHLY = 'https://pay.milanwebportal.com/checkout-element?id=80d22d55-432b-4780-81c9-4e6466d09c44';

    let isAnnual = true;

    function applyBilling(annual, userInitiated = false) {
        isAnnual = annual;
        if (switchBtn) {
            switchBtn.classList.toggle('annual', isAnnual);
            switchBtn.setAttribute('aria-checked', String(isAnnual));
        }
        if (lblMonthly) lblMonthly.classList.toggle('active', !isAnnual);
        if (lblAnnual) lblAnnual.classList.toggle('active', isAnnual);
        if (priceEl) priceEl.textContent = isAnnual ? '2.99' : '4.99';
        if (periodEl) {
            periodEl.textContent = isAnnual
                ? 'per month, billed annually ($35.88/yr)'
                : 'per month, billed monthly ($4.99/mo)';
        }
        if (checkoutBtn) {
            checkoutBtn.setAttribute('href', isAnnual ? URL_ANNUAL : URL_MONTHLY);
        }
        if (userInitiated) {
            trackLandingEvent('pricing_toggle_click', {
                cycle: isAnnual ? 'annual' : 'monthly',
                price_per_month: isAnnual ? 2.99 : 4.99
            });
        }
    }

    switchBtn?.addEventListener('click', () => applyBilling(!isAnnual, true));
    lblMonthly?.addEventListener('click', () => applyBilling(false, true));
    lblAnnual?.addEventListener('click', () => applyBilling(true, true));

    checkoutBtn?.addEventListener('click', () => {
        trackLandingEvent('pro_checkout_start', {
            cycle: isAnnual ? 'annual' : 'monthly',
            price_billed: isAnnual ? 35.88 : 4.99,
            checkout_url: isAnnual ? URL_ANNUAL : URL_MONTHLY
        });
    });

    const founderCheckoutBtn = document.getElementById('founder-checkout-btn');
    founderCheckoutBtn?.addEventListener('click', () => {
        trackLandingEvent('pro_checkout_start', {
            cycle: 'lifetime',
            price_billed: 49.99,
            checkout_url: founderCheckoutBtn.getAttribute('href') || ''
        });
    });

    // Fire pricing_view GA4 event once when #pricing enters viewport
    const pricingSection = document.getElementById('pricing');
    if (pricingSection && 'IntersectionObserver' in window) {
        let pricingViewed = false;
        const obs = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting && !pricingViewed) {
                    pricingViewed = true;
                    trackLandingEvent('pricing_view', { billing_default: isAnnual ? 'annual' : 'monthly' });
                    obs.disconnect();
                }
            },
            { threshold: 0.25 }
        );
        obs.observe(pricingSection);
    }
}

/* --------------------------------------------------------------------------
   7. FAQ ACCORDION & FAQ_OPEN GA4 EVENT
   -------------------------------------------------------------------------- */
function initFaq() {
    const items = document.querySelectorAll('.faq-item');
    items.forEach((item) => {
        const btn = item.querySelector('.faq-question-btn');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const wasOpen = item.classList.contains('open');
            items.forEach((other) => {
                other.classList.remove('open');
                other.querySelector('.faq-question-btn')?.setAttribute('aria-expanded', 'false');
            });
            if (!wasOpen) {
                item.classList.add('open');
                btn.setAttribute('aria-expanded', 'true');
                const questionText = (btn.textContent || '').replace('+', '').trim().slice(0, 80);
                trackLandingEvent('faq_open', { question: questionText });
            }
        });
    });
}

/* --------------------------------------------------------------------------
   8. MOBILE DRAWER & CONVERSION CLICK DELEGATION
   -------------------------------------------------------------------------- */
function initNavigationAndTracking() {
    const hamburger = document.getElementById('hamburger-btn');
    const drawer = document.getElementById('mobile-drawer');
    const closeBtn = document.getElementById('drawer-close-btn');
    const overlay = document.getElementById('drawer-overlay');

    function setDrawer(open) {
        if (!drawer || !overlay) return;
        drawer.classList.toggle('open', open);
        drawer.inert = !open;
        overlay.classList.toggle('open', open);
        hamburger?.setAttribute('aria-expanded', String(open));
        trackLandingEvent('drawer_toggle', { action: open ? 'open' : 'close' });
    }

    hamburger?.addEventListener('click', () => setDrawer(true));
    closeBtn?.addEventListener('click', () => setDrawer(false));
    overlay?.addEventListener('click', () => setDrawer(false));
    drawer?.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => setDrawer(false));
    });

    // Show sticky mobile bottom bar when hero CTAs scroll out of view
    const heroCtas = document.querySelector('.hero-cta-group');
    const mobileBar = document.getElementById('mobile-bottom-bar');
    if (heroCtas && mobileBar && 'IntersectionObserver' in window) {
        const barObs = new IntersectionObserver(
            (entries) => {
                const isHeroCtaVisible = Boolean(entries[0]?.isIntersecting);
                mobileBar.classList.toggle('visible', !isHeroCtaVisible);
            },
            { threshold: 0.1 }
        );
        barObs.observe(heroCtas);
    }

    document.querySelectorAll('.logo').forEach((logoEl) => {
        logoEl.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    // Back to top click telemetry
    const bttBtn = document.getElementById('back-to-top');
    bttBtn?.addEventListener('click', () => {
        const docH = document.documentElement.scrollHeight - window.innerHeight;
        const pct = docH > 0 ? Math.round((window.scrollY / docH) * 100) : 0;
        trackLandingEvent('back_to_top_click', { scroll_percent_at_click: pct });
    });

    // Global delegated listener for play_click, pro_click, spawn_click, outbound links, and legal navigation
    document.addEventListener('click', (e) => {
        const el = e.target instanceof Element ? e.target : null;
        if (!el) return;

        // 1. Explicit data-track elements
        const trackTarget = el.closest('[data-track]');
        if (trackTarget) {
            const eventType = trackTarget.getAttribute('data-track');
            if (eventType) {
                trackLandingEvent(eventType, {
                    cta_location: trackTarget.getAttribute('data-track-location') || undefined,
                    spawn_destination: trackTarget.getAttribute('data-spawn') || undefined,
                    href: trackTarget.getAttribute('href') || undefined
                });
            }
        }

        // 2. Link navigation tracking (Outbound / Legal)
        const link = el.closest('a');
        if (link && link.href) {
            try {
                const u = new URL(link.href, window.location.href);
                if (u.origin !== window.location.origin) {
                    trackLandingEvent('outbound_click', {
                        destination_host: u.hostname,
                        destination_url: u.href,
                        link_text: (link.textContent || '').trim().slice(0, 60)
                    });
                } else if (u.pathname === '/privacy' || u.pathname === '/terms' || u.pathname === '/refund') {
                    trackLandingEvent('legal_nav_click', {
                        document_type: u.pathname.replace('/', ''),
                        link_location: link.closest('footer') ? 'footer' : 'body'
                    });
                }
            } catch (_err) {}
        }
    });
}

/* --------------------------------------------------------------------------
   9. ADVANCED LANDING ANALYTICS SUITE (MATCHING PLAY PAGE STANDARDS)
   -------------------------------------------------------------------------- */
function initAdvancedLandingAnalytics() {
    // 1. Detect AI Answer Engine traffic (ChatGPT, Perplexity, Gemini, Claude, Copilot)
    const aiEngine = trackAIReferral();

    // 2. Real User Monitoring (Core Web Vitals & FCP / Paint Timing)
    trackWebVitals();

    // 3. Complete Session & Device Telemetry
    const isMobile = window.innerWidth < 768;
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
    const deviceCategory = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';

    let referrerType = 'direct';
    if (aiEngine) {
        referrerType = `ai_${aiEngine}`;
    } else if (document.referrer) {
        try {
            const refHost = new URL(document.referrer).hostname.toLowerCase();
            if (
                refHost.includes('google.') ||
                refHost.includes('bing.') ||
                refHost.includes('yahoo.') ||
                refHost.includes('duckduckgo.')
            ) {
                referrerType = 'organic_search';
            } else if (
                refHost.includes('twitter.') ||
                refHost.includes('x.com') ||
                refHost.includes('reddit.') ||
                refHost.includes('facebook.') ||
                refHost.includes('instagram.')
            ) {
                referrerType = 'social';
            } else if (refHost === window.location.hostname) {
                referrerType = 'internal';
            } else {
                referrerType = 'external_referral';
            }
        } catch (_e) {
            referrerType = 'external_referral';
        }
    }

    trackLandingEvent('landing_session_start', {
        device_category: deviceCategory,
        screen_res: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
        viewport_size: `${window.innerWidth}x${window.innerHeight}`,
        connection_type: navigator.connection?.effectiveType || 'unknown',
        reduced_motion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        referrer_type: referrerType,
        landing_version: '1.2.2'
    });

    // 4. Scroll Depth Milestones (25%, 50%, 75%, 90%, 100%)
    const reachedScrollMilestones = new Set();
    const scrollMilestones = [25, 50, 75, 90, 100];
    let scrollTicking = false;

    function checkScrollDepth() {
        const docH = document.documentElement.scrollHeight - window.innerHeight;
        if (docH <= 0) return;
        const currentPct = Math.round((window.scrollY / docH) * 100);

        for (const m of scrollMilestones) {
            if (currentPct >= m && !reachedScrollMilestones.has(m)) {
                reachedScrollMilestones.add(m);
                trackLandingEvent('scroll_depth_milestone', {
                    depth_percent: m
                });
            }
        }
        scrollTicking = false;
    }

    window.addEventListener(
        'scroll',
        () => {
            if (!scrollTicking) {
                scrollTicking = true;
                requestAnimationFrame(checkScrollDepth);
            }
        },
        { passive: true }
    );

    // 5. Active Engagement Time Milestones (15s, 30s, 60s, 120s, 300s)
    const timeMilestones = [15, 30, 60, 120, 300];
    const reachedTimeMilestones = new Set();
    let activeSeconds = 0;

    setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        activeSeconds++;
        for (const t of timeMilestones) {
            if (activeSeconds >= t && !reachedTimeMilestones.has(t)) {
                reachedTimeMilestones.add(t);
                trackLandingEvent('landing_engagement_milestone', {
                    active_seconds: t
                });
            }
        }
    }, 1000);

    // 6. Section Visibility Tracking via IntersectionObserver
    if ('IntersectionObserver' in window) {
        const sections = [
            { id: 'gameplay', name: 'Gameplay Perspectives' },
            { id: 'fleet', name: '3D Vehicle Garage' },
            { id: 'destinations', name: '17 Curated Places' },
            { id: 'controls', name: 'Controls & Mobile PWA' },
            { id: 'pricing', name: 'Pricing Plans' },
            { id: 'faq', name: 'Frequently Asked Questions' }
        ];

        const viewedSections = new Set();
        const sectionObs = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const secId = entry.target.id;
                        if (!viewedSections.has(secId)) {
                            viewedSections.add(secId);
                            const sec = sections.find((s) => s.id === secId);
                            trackLandingEvent('section_view', {
                                section_id: secId,
                                section_name: sec?.name || secId
                            });
                        }
                    }
                });
            },
            { threshold: 0.3 }
        );

        sections.forEach((s) => {
            const el = document.getElementById(s.id);
            if (el) sectionObs.observe(el);
        });
    }
}

/* --------------------------------------------------------------------------
   9. WEBMCP AGENTIC BROWSING REGISTRATION (3/3 LIGHTHOUSE AGENTIC)
   -------------------------------------------------------------------------- */
function initAgenticWebMCP() {
    try {
        const mc = navigator.modelContext;
        if (!mc || typeof mc.registerTool !== 'function') return;

        mc.registerTool({
            name: 'launch_georide_simulator',
            description: 'Launch the GEO Ride 3D driving simulator at optional coordinates and vehicle class.',
            inputSchema: {
                type: 'object',
                properties: {
                    vehicle: { type: 'string', enum: ['car', 'truck', 'bus', 'god'] },
                    place: { type: 'string' }
                }
            },
            execute: async ({ vehicle = 'car', place = '' } = {}) => {
                const url = `/play?vehicle=${encodeURIComponent(vehicle)}${place ? `&place=${encodeURIComponent(place)}` : ''}`;
                window.location.href = url;
                return { launched: true, url };
            }
        });

        mc.registerTool({
            name: 'preview_fleet_vehicle',
            description: 'Preview a 3D vehicle class on the landing page (car, truck, bus, god).',
            inputSchema: {
                type: 'object',
                properties: {
                    vehicle: { type: 'string', enum: ['car', 'truck', 'bus', 'god'] }
                },
                required: ['vehicle']
            },
            execute: async ({ vehicle }) => ({
                success: selectFleetVehicle(vehicle),
                selectedVehicle: vehicle
            })
        });

        mc.registerTool({
            name: 'filter_destinations',
            description: 'Filter curated driving destinations by category (all, circuits, passes, cities).',
            inputSchema: {
                type: 'object',
                properties: {
                    category: { type: 'string', enum: ['all', 'circuits', 'passes', 'cities'] }
                },
                required: ['category']
            },
            execute: async ({ category }) => ({
                success: filterDestinationsByCategory(category),
                activeCategory: category
            })
        });
    } catch (_e) {
        // Ignore if browser does not implement WebMCP
    }
}

/* --------------------------------------------------------------------------
   10. MICRO-TASK SCHEDULER (ZERO LONG TASKS > 50MS ON MOBILE)
   -------------------------------------------------------------------------- */
function bootLandingYielding() {
    // Immediate lightweight interaction setup & advanced analytics (< 2ms)
    initNavigationAndTracking();
    initDestinationsFilter();
    initAdvancedLandingAnalytics();

    const deferredTasks = [
        initHeroCanvas,
        initMagneticButtons,
        initPricing,
        initFaq,
        initFleetShowcase,
        initAgenticWebMCP
    ];

    function runNext() {
        const fn = deferredTasks.shift();
        if (!fn) return;
        try {
            fn();
        } catch (_err) {}
        if (deferredTasks.length > 0) {
            setTimeout(runNext, 60);
        }
    }

    if (document.readyState === 'complete') {
        setTimeout(runNext, 80);
    } else {
        window.addEventListener(
            'load',
            () => {
                setTimeout(runNext, 80);
            },
            { once: true }
        );
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootLandingYielding);
} else {
    bootLandingYielding();
}
