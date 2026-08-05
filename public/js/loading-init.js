(function () {
    let pct = 0;
    let target = 25;
    const bar = document.getElementById('progress-bar');
    const pctText = document.getElementById('loading-pct');

    window.setLoadingTarget = function (newTarget) {
        target = Math.max(target, newTarget);
    };

    function tick() {
        if (pct < 100) {
            if (target >= 100) {
                // Fast completion when target is 100%
                pct += Math.max(0.8, (100 - pct) * 0.12);
                if (pct >= 99.9) pct = 100;
            } else {
                // Continuous speed: catches up when far, crawls forward when close
                const catchUpSpeed = (target - pct) * 0.05;
                const crawlSpeed = 0.04 + Math.random() * 0.02;

                pct += Math.max(catchUpSpeed, crawlSpeed);

                // Keep loading bar under 100% until Mapbox/Three.js are fully ready
                if (pct > 98.8) pct = 98.8;
            }

            if (bar) bar.style.width = pct.toFixed(1) + '%';
            if (pctText) pctText.innerText = Math.floor(pct) + '%';
            window.currentLoadingPct = pct;
            requestAnimationFrame(tick);
        }
    }
    requestAnimationFrame(tick);

    // Simulation of initial download progress
    let initialSim = setInterval(() => {
        if (target < 85) {
            target += Math.random() * 4 + 1;
        } else {
            clearInterval(initialSim);
        }
    }, 250);
    window.loadingSimInterval = initialSim;

    // Rotating tips logic
    const tips = [
        "Press 'R' to instantly reset your vehicle if you get stuck or flip over.",
        'Switch to Satellite view in settings for a photorealistic global driving experience.',
        'Invite your friends to roam the world together by sharing your Room ID in multiplayer!',
        'Wow style displays fully detailed 3D buildings and realistic lighting in major cities.',
        'Use the handbrake (Spacebar) or mobile drift button to slide around sharp corners.',
        'Toggle Collision mode off in settings if you want to drive through buildings and fly over mountains.',
        "Realtime light preset synchronizes the sun's position with your local computer time!",
        'Driving a bus or truck changes the vehicle physics, mass, and braking distance.',
        'The simulator uses real-world geographical coordinates mapped in real time.',
        'Zoom out with scroll or pinch gestures to see a wider view of your surroundings.'
    ];

    let tipIndex = Math.floor(Math.random() * tips.length);
    const tipText = document.getElementById('loading-tip');

    if (tipText) {
        tipText.innerText = tips[tipIndex];
        tipIndex = (tipIndex + 1) % tips.length;
    }

    function showNextTip() {
        if (!tipText) return;
        tipText.style.opacity = 0;
        setTimeout(() => {
            tipText.innerText = tips[tipIndex];
            tipText.style.opacity = 1;
            tipIndex = (tipIndex + 1) % tips.length;
        }, 400);
    }

    setInterval(showNextTip, 4000);
})();
