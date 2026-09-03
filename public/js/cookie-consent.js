(function () {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    if (localStorage.getItem('georide_cookie_consent')) return;

    function renderBanner() {
        if (document.getElementById('cookie-consent-banner')) return;

        const banner = document.createElement('aside');
        banner.id = 'cookie-consent-banner';
        banner.setAttribute('role', 'region');
        banner.setAttribute('aria-label', 'Cookie consent preferences');
        banner.innerHTML = `
            <div class="cookie-content">
                <div class="cookie-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        <path d="m9 12 2 2 4-4"/>
                    </svg>
                </div>
                <div class="cookie-text">
                    <strong class="cookie-title">Privacy &amp; Analytics Notice</strong>
                    <p class="cookie-desc">We use essential local storage for simulation state and anonymous telemetry to optimize real-time frame rates and server stability. No ad tracking profiles are used.</p>
                </div>
            </div>
            <div class="cookie-actions">
                <button type="button" id="cookie-decline-btn" class="cookie-btn cookie-btn-decline">Decline</button>
                <button type="button" id="cookie-accept-btn" class="cookie-btn cookie-btn-accept">Accept</button>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            #cookie-consent-banner {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%) translateY(120%);
                width: calc(100% - 32px);
                max-width: 680px;
                background: rgba(10, 14, 22, 0.94);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(0, 242, 255, 0.3);
                box-shadow: 0 16px 48px rgba(0, 0, 0, 0.8), 0 0 24px rgba(0, 242, 255, 0.15);
                border-radius: 16px;
                padding: 16px 20px;
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 18px;
                box-sizing: border-box;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                color: #e2e8f0;
                transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
                opacity: 0;
            }
            #cookie-consent-banner.visible {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
            #cookie-consent-banner .cookie-content {
                display: flex;
                align-items: center;
                gap: 14px;
                flex: 1;
                min-width: 0;
            }
            #cookie-consent-banner .cookie-icon {
                color: #00f2ff;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                width: 38px;
                height: 38px;
                background: rgba(0, 242, 255, 0.08);
                border: 1px solid rgba(0, 242, 255, 0.2);
                border-radius: 10px;
            }
            #cookie-consent-banner .cookie-text {
                display: flex;
                flex-direction: column;
                gap: 3px;
                min-width: 0;
            }
            #cookie-consent-banner .cookie-title {
                font-size: 14px;
                font-weight: 600;
                color: #ffffff;
                letter-spacing: 0.3px;
            }
            #cookie-consent-banner .cookie-desc {
                font-size: 12.5px;
                line-height: 1.45;
                color: #94a3b8;
                margin: 0;
            }
            #cookie-consent-banner .cookie-actions {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-shrink: 0;
            }
            #cookie-consent-banner .cookie-btn {
                padding: 8px 16px;
                font-size: 13px;
                font-weight: 600;
                border-radius: 8px;
                cursor: pointer;
                border: none;
                transition: all 0.2s ease;
                min-height: 36px;
            }
            #cookie-consent-banner .cookie-btn-decline {
                background: rgba(255, 255, 255, 0.08);
                color: #cbd5e1;
                border: 1px solid rgba(255, 255, 255, 0.12);
            }
            #cookie-consent-banner .cookie-btn-decline:hover {
                background: rgba(255, 255, 255, 0.15);
                color: #ffffff;
            }
            #cookie-consent-banner .cookie-btn-accept {
                background: #00f2ff;
                color: #030712;
                box-shadow: 0 0 14px rgba(0, 242, 255, 0.4);
            }
            #cookie-consent-banner .cookie-btn-accept:hover {
                background: #38f8ff;
                box-shadow: 0 0 20px rgba(0, 242, 255, 0.6);
            }
            @media (max-width: 640px) {
                #cookie-consent-banner {
                    bottom: 12px;
                    width: calc(100% - 20px);
                    padding: 14px;
                    flex-direction: column;
                    align-items: stretch;
                    gap: 12px;
                }
                #cookie-consent-banner .cookie-actions {
                    justify-content: flex-end;
                }
                #cookie-consent-banner .cookie-btn {
                    flex: 1;
                }
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(banner);

        // Animate in
        requestAnimationFrame(() => {
            setTimeout(() => {
                banner.classList.add('visible');
            }, 100);
        });

        function closeBanner(granted) {
            banner.classList.remove('visible');
            setTimeout(() => {
                banner.remove();
            }, 400);
            if (typeof window.updateGeoRideConsent === 'function') {
                window.updateGeoRideConsent(granted);
            } else {
                localStorage.setItem('georide_cookie_consent', granted ? 'granted' : 'denied');
            }
        }

        document.getElementById('cookie-accept-btn')?.addEventListener('click', () => closeBanner(true));
        document.getElementById('cookie-decline-btn')?.addEventListener('click', () => closeBanner(false));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderBanner);
    } else {
        renderBanner();
    }
})();
