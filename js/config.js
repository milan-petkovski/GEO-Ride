/**
 * @file config.js
 * @description Centralized configuration parameters, SVG vehicle templates, physical dynamics constants, and hardware performance tier detection.
 */

/** @type {[number, number]} Default geographic spawn location [longitude, latitude] (Belgrade Waterfront) */
export const INITIAL_CENTER = [20.449425, 44.809684];

/** @type {number} Initial camera zoom level */
export const INITIAL_ZOOM = 18;

// Named Constants for Vehicle Physics & Dynamics (eliminates magic numbers)
export const AIR_DRAG_FACTOR = 0.98;
export const NATURAL_FRICTION_DECAY = 0.95;
export const MAX_REVERSE_SPEED_RATIO = 0.33;
export const STEERING_RETURN_RATE = 0.85;
export const LAUNCH_BOOST_ACCEL_MULTIPLIER = 2.5;
export const SKID_MARK_MIN_SPEED_KMH = 35;
export const DRIFT_LATERAL_SLIP_THRESHOLD = 0.4;
export const COLLISION_RESTITUTION_COEFFICIENT = 0.6;
export const COLLISION_BOUNCE_BACK_SPEED = 12;

// Custom Premium SVGs
export const CAR_SVG = `<svg width="60" height="110" viewBox="0 0 60 110" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 24C12 13 18 5 30 5C42 5 48 13 48 24V86C48 97 43 105 30 105C17 105 12 97 12 86V24Z" fill="#070B14" stroke="#00F2FF" stroke-width="2.2"/><path d="M9 26H12V44H9C7.9 44 7 43.1 7 42V28C7 26.9 7.9 26 9 26ZM48 26H51C52.1 26 53 26.9 53 28V42C53 43.1 52.1 44 51 44H48V26ZM9 70H12V88H9C7.9 88 7 87.1 7 86V72C7 70.9 7.9 70 9 70ZM48 70H51C52.1 70 53 70.9 53 72V86C53 87.1 52.1 88 51 88H48V70Z" fill="#04070E" stroke="#00F2FF" stroke-opacity="0.55" stroke-width="1.2"/><path d="M16 36L30 27L44 36V58H16V36Z" fill="#00F2FF" fill-opacity="0.26" stroke="#00F2FF" stroke-width="1.2"/><path d="M18 58H42L40 76H20L18 58Z" fill="#0D1526" stroke="#00F2FF" stroke-opacity="0.35" stroke-width="1"/><rect x="16" y="86" width="28" height="9" rx="3" fill="#00F2FF" fill-opacity="0.14" stroke="#00F2FF" stroke-opacity="0.4"/><rect x="15" y="10" width="9" height="3.5" rx="1.5" fill="#FFFFFF"/><rect x="36" y="10" width="9" height="3.5" rx="1.5" fill="#FFFFFF"/><rect x="16" y="100" width="28" height="2.8" rx="1.4" fill="#FF2A5F"/></svg>`;
export const TRUCK_SVG = `<svg width="80" height="180" viewBox="0 0 80 180" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="12" y="52" width="56" height="120" rx="5" fill="#070B14" stroke="#00F2FF" stroke-width="2.2"/><path d="M14 16C14 11 20 8 40 8C60 8 66 11 66 16V48H14V16Z" fill="#0B1120" stroke="#00F2FF" stroke-width="2.2"/><path d="M18 18C18 14 25 12 40 12C55 12 62 14 62 18V28H18V18Z" fill="#00F2FF" fill-opacity="0.32" stroke="#00F2FF" stroke-width="1"/><rect x="18" y="60" width="44" height="104" rx="3" fill="#0D1424" stroke="#00F2FF" stroke-opacity="0.28" stroke-width="1.2"/><line x1="40" y1="60" x2="40" y2="164" stroke="#00F2FF" stroke-opacity="0.2" stroke-dasharray="6 4"/><rect x="18" y="9" width="10" height="3.5" rx="1.5" fill="#FFFFFF"/><rect x="52" y="9" width="10" height="3.5" rx="1.5" fill="#FFFFFF"/><rect x="18" y="168" width="44" height="3" rx="1.5" fill="#FF2A5F"/></svg>`;
export const BUS_SVG = `<svg width="80" height="200" viewBox="0 0 80 200" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 20C12 12 20 8 40 8C60 8 68 12 68 20V180C68 188 60 192 40 192C20 192 12 188 12 180V20Z" fill="#070B14" stroke="#00F2FF" stroke-width="2.2"/><path d="M16 24C16 17 25 14 40 14C55 14 64 17 64 24V44H16V24Z" fill="#00F2FF" fill-opacity="0.32" stroke="#00F2FF" stroke-width="1"/><rect x="17" y="54" width="46" height="32" rx="3" fill="#00F2FF" fill-opacity="0.14" stroke="#00F2FF" stroke-opacity="0.35"/><rect x="17" y="94" width="46" height="32" rx="3" fill="#00F2FF" fill-opacity="0.14" stroke="#00F2FF" stroke-opacity="0.35"/><rect x="17" y="134" width="46" height="32" rx="3" fill="#00F2FF" fill-opacity="0.14" stroke="#00F2FF" stroke-opacity="0.35"/><rect x="24" y="174" width="32" height="6" rx="2" fill="#00F2FF" fill-opacity="0.28"/><rect x="18" y="10" width="10" height="3.5" rx="1.5" fill="#FFFFFF"/><rect x="52" y="10" width="10" height="3.5" rx="1.5" fill="#FFFFFF"/><rect x="20" y="186" width="40" height="3" rx="1.5" fill="#FF2A5F"/></svg>`;
export const GOD_SVG = `<svg width="70" height="130" viewBox="0 0 70 130" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M35 5C16 5 7 24 7 44V104C7 115 17 125 35 125C53 125 63 115 63 104V44C63 24 54 5 35 5Z" fill="#090612" stroke="#FF00E5" stroke-width="2.5"/><path d="M13 48C13 33 22 19 35 19C48 19 57 33 57 48V70H13V48Z" fill="#FF00E5" fill-opacity="0.28" stroke="#FF00E5" stroke-width="1.2"/><rect x="16" y="11" width="10" height="4" rx="2" fill="#FF00E5"><animate attributeName="opacity" values="0.4;1;0.4" dur="0.6s" repeatCount="indefinite"/></rect><rect x="44" y="11" width="10" height="4" rx="2" fill="#FF00E5"><animate attributeName="opacity" values="0.4;1;0.4" dur="0.6s" repeatCount="indefinite"/></rect><path d="M10 82H60" stroke="#00F2FF" stroke-width="1.2" stroke-dasharray="4 3"/><path d="M14 112L56 112" stroke="#FF00E5" stroke-width="3" stroke-linecap="round"/></svg>`;

/**
 * @typedef {Object} VehicleSpec
 * @property {number} power - Acceleration scalar per tick.
 * @property {number} brake - Deceleration scalar per tick.
 * @property {number} maxSpeed - Maximum top speed in coordinates/tick (equivalent to km/h).
 * @property {number} turnRate - Steering responsiveness multiplier.
 * @property {number} steeringWeight - Inertial damping factor.
 * @property {number} size - Visual mesh scale factor.
 * @property {string} svg - Inline SVG string representation for 2D map marker.
 */

/** @type {Record<string, VehicleSpec>} Specifications dictionary for drivable vehicles */
export const VEHICLE_CONFIG = {
    car: {
        power: 0.0009,
        brake: 0.004,
        maxSpeed: 0.4167,
        turnRate: 0.8,
        steeringWeight: 0.05,
        size: 0.9,
        svg: CAR_SVG
    },
    truck: {
        power: 0.00045,
        brake: 0.002,
        maxSpeed: 0.25,
        turnRate: 0.5,
        steeringWeight: 0.02,
        size: 0.7,
        svg: TRUCK_SVG
    },
    bus: {
        power: 0.00035,
        brake: 0.0015,
        maxSpeed: 0.2,
        turnRate: 1.0,
        steeringWeight: 0.015,
        size: 0.65,
        svg: BUS_SVG
    },
    god: { power: 0.04, brake: 0.08, maxSpeed: 1.667, turnRate: 2.2, steeringWeight: 0.1, size: 1, svg: GOD_SVG }
};

/**
 * Hardware profile detection utility assessing CPU cores, device memory, GPU capabilities, and user preferences.
 */
export function detectPerformanceProfile(
    win = typeof window !== 'undefined' ? window : undefined,
    nav = typeof navigator !== 'undefined' ? navigator : undefined,
    doc = typeof document !== 'undefined' ? document : undefined
) {
    const isWin = typeof win !== 'undefined' && win !== null;
    const isNav = typeof nav !== 'undefined' && nav !== null;

    const connection = isNav ? nav.connection || nav.mozConnection || nav.webkitConnection : null;
    const deviceMemory = isNav ? nav.deviceMemory || 8 : 8;
    const hardwareConcurrency = isNav ? nav.hardwareConcurrency || 8 : 8;
    const reducedMotion =
        isWin && win.matchMedia ? !!win.matchMedia('(prefers-reduced-motion: reduce)')?.matches : false;
    const saveData = !!(connection && connection.saveData);
    const touchDevice = isWin ? 'ontouchstart' in win || (isNav && nav.maxTouchPoints > 0) : false;
    const compactViewport = isWin ? Math.min(win.innerWidth || 1024, win.innerHeight || 768) <= 900 : false;

    const getGpuInfo = () => {
        try {
            if (typeof doc === 'undefined' || !doc || !doc.createElement)
                return { renderer: 'Server', vendor: 'Server', isLowEndGpu: false };
            const canvas = doc.createElement('canvas');
            if (!canvas || !canvas.getContext) return { renderer: 'Unknown', vendor: 'Unknown', isLowEndGpu: false };
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) return { renderer: 'Unknown', vendor: 'Unknown', isLowEndGpu: false };
            const debugInfo = gl.getExtension ? gl.getExtension('WEBGL_debug_renderer_info') : null;
            if (!debugInfo) return { renderer: 'Unknown', vendor: 'Unknown', isLowEndGpu: false };
            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
            const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
            const lowEndGpuRegex = /intel|iris|hd graphics|uhd graphics|mali|adreno|swiftshader|software|google/i;
            const isLowEndGpu = lowEndGpuRegex.test(renderer);
            return { renderer, vendor, isLowEndGpu };
        } catch (_e) {
            return { renderer: 'Error', vendor: 'Error', isLowEndGpu: false };
        }
    };

    const gpu = getGpuInfo();
    const isSlowConn =
        saveData || !!(connection && (connection.effectiveType === '2g' || connection.effectiveType === '3g'));

    // Determine three-tier hardware classification
    let tier = 'mid';
    if (
        isSlowConn ||
        deviceMemory <= 4 ||
        hardwareConcurrency <= 4 ||
        gpu.isLowEndGpu ||
        (compactViewport && hardwareConcurrency <= 6)
    ) {
        tier = 'low';
    } else if (deviceMemory >= 12 && hardwareConcurrency >= 8 && !gpu.isLowEndGpu) {
        tier = 'elite';
    }

    return {
        tier, // 'low' | 'mid' | 'elite'
        lowEnd: tier === 'low',
        midEnd: tier === 'mid',
        eliteEnd: tier === 'elite',
        gpu,
        cores: hardwareConcurrency,
        memory: deviceMemory,
        touchDevice,
        reducedMotion,
        isSlowConn
    };
}

export const PERFORMANCE_PROFILE = detectPerformanceProfile();
