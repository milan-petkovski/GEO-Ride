/**
 * GEO Ride • Back to Top with Circular Scroll Progress
 */
(function () {
    function initBackToTop() {
        const btn = document.getElementById('back-to-top');
        if (!btn) return;

        const progressCircle = btn.querySelector('.btt-progress-circle');
        const radius = 20;
        const circumference = 2 * Math.PI * radius; // ~125.6637

        if (progressCircle) {
            progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
            progressCircle.style.strokeDashoffset = `${circumference}`;
        }

        let ticking = false;

        function updateProgress() {
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const progress = docHeight > 0 ? Math.min(Math.max(scrollTop / docHeight, 0), 1) : 0;

            if (scrollTop > 220) {
                btn.classList.add('visible');
            } else {
                btn.classList.remove('visible');
            }

            if (progressCircle) {
                const offset = circumference - progress * circumference;
                progressCircle.style.strokeDashoffset = String(offset);
            }

            ticking = false;
        }

        function onScroll() {
            if (!ticking) {
                window.requestAnimationFrame(updateProgress);
                ticking = true;
            }
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        updateProgress();

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBackToTop);
    } else {
        initBackToTop();
    }
})();
