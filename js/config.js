export const INITIAL_CENTER = [20.251391, 44.831868]; // Belgrade
export const INITIAL_ZOOM = 18;

// Custom Premium SVGs
export const CAR_SVG = `<svg width="60" height="110" viewBox="0 0 60 110" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 25C10 15 15 5 30 5C45 5 50 15 50 25V85C50 95 45 105 30 105C15 105 10 95 10 85V25Z" fill="#0A0A0A" stroke="#00F2FF" stroke-width="2.5"/><path d="M15 35L30 25L45 35V55H15V35Z" fill="#00F2FF" fill-opacity="0.3" stroke="#00F2FF" stroke-width="1"/><rect x="15" y="85" width="30" height="12" rx="2" fill="#00F2FF" fill-opacity="0.1"/><rect x="14" y="14" width="8" height="3" rx="1" fill="white" fill-opacity="0.9"/><rect x="38" y="14" width="8" height="3" rx="1" fill="white" fill-opacity="0.9"/></svg>`;
export const TRUCK_SVG = `<svg width="80" height="180" viewBox="0 0 80 180" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 15L70 15V175C70 180 65 185 40 185C15 185 10 180 10 175V15Z" fill="#0A0A0A" stroke="#00F2FF" stroke-width="2.5"/><rect x="10" y="10" width="60" height="40" rx="4" fill="#111" stroke="#00F2FF" stroke-width="1.5"/><path d="M15 15L65 15V25H15V15Z" fill="#00F2FF" fill-opacity="0.4"/><rect x="15" y="55" width="50" height="110" rx="2" fill="#151515" stroke="#333"/></svg>`;
export const BUS_SVG = `<svg width="80" height="200" viewBox="0 0 80 200" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 20C10 12 18 10 40 10C62 10 70 12 70 20V180C70 188 62 190 40 190C18 190 10 188 10 180V20Z" fill="#111" stroke="#00F2FF" stroke-width="2.5"/><path d="M15 25C15 18 25 15 40 15C55 15 65 18 65 25V45H15V25Z" fill="#00F2FF" fill-opacity="0.4"/><rect x="15" y="55" width="50" height="30" rx="2" fill="#00F2FF" fill-opacity="0.15"/><rect x="15" y="95" width="50" height="30" rx="2" fill="#00F2FF" fill-opacity="0.15"/><rect x="15" y="135" width="50" height="30" rx="2" fill="#00F2FF" fill-opacity="0.15"/><rect x="25" y="175" width="30" height="5" rx="1" fill="#00F2FF" fill-opacity="0.3"/></svg>`;
export const GOD_SVG = `<svg width="70" height="130" viewBox="0 0 70 130" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M35 5C15 5 5 25 5 45V105C5 115 15 125 35 125C55 125 65 115 65 105V45C65 25 55 5 35 5Z" fill="#0A0A0A" stroke="#FF00E5" stroke-width="2.5"/><path d="M10 50C10 35 20 20 35 20C50 20 60 35 60 50V70H10V50Z" fill="#FF00E5" fill-opacity="0.3"/><rect x="15" y="10" width="10" height="4" rx="2" fill="#FF00E5"><animate attributeName="opacity" values="0.4;1;0.4" dur="0.5s" repeatCount="indefinite"/></rect><rect x="45" y="10" width="10" height="4" rx="2" fill="#FF00E5"><animate attributeName="opacity" values="0.4;1;0.4" dur="0.5s" repeatCount="indefinite"/></rect><path d="M5 80H65" stroke="#FF00E5" stroke-width="1" stroke-dasharray="4 2"/><path d="M10 110L60 110" stroke="#FF00E5" stroke-width="3" stroke-opacity="0.6"/></svg>`;

export const VEHICLE_CONFIG = {
    car: { power: 0.0009, brake: 0.004, maxSpeed: 0.4167, turnRate: 0.8, steeringWeight: 0.05, size: 0.9, svg: CAR_SVG },
    truck: { power: 0.00045, brake: 0.002, maxSpeed: 0.25, turnRate: 0.5, steeringWeight: 0.02, size: 0.7, svg: TRUCK_SVG },
    bus: { power: 0.00035, brake: 0.0015, maxSpeed: 0.2, turnRate: 1.0, steeringWeight: 0.015, size: 0.65, svg: BUS_SVG },
    god: { power: 0.04, brake: 0.08, maxSpeed: 1.667, turnRate: 2.2, steeringWeight: 0.1, size: 1, svg: GOD_SVG }
};

export const PERFORMANCE_PROFILE = (() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const deviceMemory = navigator.deviceMemory || 8;
    const hardwareConcurrency = navigator.hardwareConcurrency || 8;
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = !!(connection && connection.saveData);
    const touchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const compactViewport = Math.min(window.innerWidth, window.innerHeight) <= 900;
    const lowEnd = saveData || reducedMotion || (deviceMemory <= 4 && hardwareConcurrency <= 6) || (compactViewport && hardwareConcurrency <= 6) || (touchDevice && hardwareConcurrency <= 4);

    return {
        lowEnd,
        touchDevice,
        reducedMotion,
        deviceMemory,
        hardwareConcurrency,
        saveData
    };
})();
