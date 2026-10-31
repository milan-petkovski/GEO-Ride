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
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        <path d="m9 12 2 2 4-4"/>
                    </svg>
                </div>
                <div class="cookie-text">
                    <div class="cookie-title-row">
                        <span class="cookie-badge">PRIVACY PREFERENCES</span>
                    </div>
                    <p class="cookie-desc">We store essential game settings and anonymous telemetry to optimize 3D performance.</p>
                </div>
            </div>
            <div class="cookie-actions">
                <button type="button" id="cookie-decline-btn" class="cookie-btn cookie-btn-decline">ESSENTIAL ONLY</button>
                <button type="button" id="cookie-accept-btn" class="cookie-btn cookie-btn-accept">ACCEPT</button>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            #cookie-consent-banner {
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%) translateY(130%);
                width: calc(100vw - 32px);
                max-width: 660px;
                background: linear-gradient(155deg, rgba(12, 16, 30, 0.94) 0%, rgba(6, 9, 18, 0.97) 100%);
                backdrop-filter: blur(24px) saturate(175%);
                -webkit-backdrop-filter: blur(24px) saturate(175%);
                border: 1px solid rgba(0, 242, 255, 0.32);
                box-shadow:
                    0 20px 50px rgba(0, 0, 0, 0.8),
                    0 0 28px rgba(0, 242, 255, 0.14),
                    inset 0 1px 0 rgba(255, 255, 255, 0.14);
                border-radius: 20px;
                padding: 16px 20px;
                z-index: 9500;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 18px;
                box-sizing: border-box;
                font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                color: #f8fafc;
                transition: transform 0.42s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
                opacity: 0;
                pointer-events: none;
            }
            body:has(.ui-container) #cookie-consent-banner {
                bottom: 94px;
            }
            #cookie-consent-banner.visible {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
                pointer-events: auto;
            }
            body:has(#loading-overlay:not(.hidden):not(.fade-out)) #cookie-consent-banner,
            body:has(#settings-panel.active) #cookie-consent-banner,
            body:has(#pro-modal-backdrop.active) #cookie-consent-banner {
                opacity: 0 !important;
                pointer-events: none !important;
                transform: translateX(-50%) translateY(130%) !important;
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
                width: 42px;
                height: 42px;
                background: radial-gradient(circle at 35% 30%, rgba(0, 242, 255, 0.2), rgba(0, 242, 255, 0.05) 70%);
                border: 1px solid rgba(0, 242, 255, 0.32);
                border-radius: 12px;
                box-shadow: 0 0 16px rgba(0, 242, 255, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.15);
            }
            #cookie-consent-banner .cookie-text {
                display: flex;
                flex-direction: column;
                gap: 4px;
                min-width: 0;
            }
            #cookie-consent-banner .cookie-title-row {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }
            #cookie-consent-banner .cookie-badge {
                font-size: 0.64rem;
                font-weight: 800;
                letter-spacing: 1.2px;
                text-transform: uppercase;
                color: #00f2ff;
                background: rgba(0, 242, 255, 0.1);
                border: 1px solid rgba(0, 242, 255, 0.28);
                padding: 3px 10px;
                border-radius: 999px;
                line-height: 1.2;
                white-space: nowrap;
            }
            #cookie-consent-banner .cookie-desc {
                font-size: 0.76rem;
                line-height: 1.35;
                color: rgba(226, 232, 240, 0.78);
                margin: 0;
                max-width: 360px;
            }
            #cookie-consent-banner .cookie-actions {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-shrink: 0;
            }
            #cookie-consent-banner .cookie-btn {
                padding: 0 16px;
                height: 38px;
                font-family: inherit;
                font-size: 0.72rem;
                font-weight: 800;
                letter-spacing: 1.1px;
                text-transform: uppercase;
                border-radius: 999px;
                cursor: pointer;
                transition: all 0.22s cubic-bezier(0.22, 1, 0.36, 1);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                white-space: nowrap;
            }
            #cookie-consent-banner .cookie-btn-decline {
                background: rgba(255, 255, 255, 0.06);
                color: rgba(248, 250, 252, 0.8);
                border: 1px solid rgba(255, 255, 255, 0.14);
            }
            #cookie-consent-banner .cookie-btn-decline:hover {
                background: rgba(255, 255, 255, 0.12);
                border-color: rgba(255, 255, 255, 0.28);
                color: #ffffff;
            }
            #cookie-consent-banner .cookie-btn-accept {
                background: linear-gradient(135deg, #00f2ff 0%, #00b8ff 100%);
                color: #020813;
                border: 1px solid #5ef6ff;
                box-shadow: 0 0 18px rgba(0, 242, 255, 0.38);
            }
            #cookie-consent-banner .cookie-btn-accept:hover {
                filter: brightness(1.08);
                transform: translateY(-1px);
                box-shadow: 0 4px 22px rgba(0, 242, 255, 0.55);
            }
            @media (max-width: 767px) {
                #cookie-consent-banner,
                body:has(.ui-container) #cookie-consent-banner {
                    bottom: 86px;
                    width: calc(100vw - 28px);
                    max-width: 400px;
                    padding: 14px 16px;
                    border-radius: 18px;
                    flex-direction: column;
                    align-items: stretch;
                    gap: 12px;
                }
                #cookie-consent-banner .cookie-icon {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                }
                #cookie-consent-banner .cookie-desc {
                    font-size: 0.72rem;
                }
                #cookie-consent-banner .cookie-actions {
                    width: 100%;
                }
                #cookie-consent-banner .cookie-btn {
                    flex: 1;
                    height: 36px;
                    font-size: 0.68rem;
                    padding: 0 12px;
                }
            }
            @media (max-height: 540px) and (orientation: landscape) {
                #cookie-consent-banner,
                body:has(.ui-container) #cookie-consent-banner {
                    bottom: 14px;
                    max-width: 560px;
                    padding: 10px 16px;
                    flex-direction: row;
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
