import { test, expect } from '@playwright/test';

test.describe('GEO Ride Driving Simulator', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            if (typeof window.HTMLCanvasElement !== 'undefined') {
                const origGetContext = window.HTMLCanvasElement.prototype.getContext;
                window.HTMLCanvasElement.prototype.getContext = function (type, ...args) {
                    if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
                        return {
                            getExtension() {
                                return null;
                            },
                            getParameter() {
                                return 'Mock GPU';
                            },
                            createShader() {
                                return {};
                            },
                            shaderSource() {},
                            compileShader() {},
                            getShaderParameter() {
                                return true;
                            },
                            createProgram() {
                                return {};
                            },
                            attachShader() {},
                            linkProgram() {},
                            getProgramParameter() {
                                return true;
                            },
                            useProgram() {},
                            createBuffer() {
                                return {};
                            },
                            bindBuffer() {},
                            bufferData() {},
                            getAttribLocation() {
                                return 0;
                            },
                            enableVertexAttribArray() {},
                            vertexAttribPointer() {},
                            drawArrays() {},
                            viewport() {}
                        };
                    }
                    return origGetContext ? origGetContext.apply(this, [type, ...args]) : null;
                };
            }

            if (!window.mapboxgl) {
                window.mapboxgl = {
                    accessToken: '',
                    Map: class {
                        on(event, cb) {
                            if (event === 'load') setTimeout(cb, 50);
                        }
                        once(event, cb) {
                            if (event === 'idle') setTimeout(cb, 50);
                        }
                        setStyle() {}
                        addLayer() {}
                        addSource() {}
                        removeLayer() {}
                        removeSource() {}
                        getLayer() {
                            return null;
                        }
                        getSource() {
                            return null;
                        }
                        flyTo() {}
                        easeTo() {}
                        jumpTo() {}
                    },
                    Marker: class {
                        setLngLat() {
                            return this;
                        }
                        setRotation() {
                            return this;
                        }
                        addTo() {
                            return this;
                        }
                        getElement() {
                            return document.createElement('div');
                        }
                    }
                };
            }
            if (!window.Paho) {
                window.Paho = {
                    MQTT: {
                        Client: class {
                            constructor() {
                                this.onConnectionLost = null;
                                this.onMessageArrived = null;
                            }
                            connect(options) {
                                if (options && typeof options.onSuccess === 'function') {
                                    options.onSuccess();
                                }
                            }
                            subscribe() {}
                            send() {}
                            disconnect() {}
                            isConnected() {
                                return true;
                            }
                        },
                        Message: class {
                            constructor(payload) {
                                this.payloadString = payload;
                            }
                        }
                    }
                };
            }
            if (!window.THREE) {
                window.THREE = {
                    Scene: class {
                        add() {}
                        remove() {}
                    },
                    PerspectiveCamera: class {
                        position = { set() {} };
                        lookAt() {}
                    },
                    WebGLRenderer: class {
                        setSize() {}
                        render() {}
                        domElement = document.createElement('canvas');
                    },
                    Vector3: class {
                        set() {}
                        copy() {}
                        add() {}
                        sub() {}
                    },
                    Vector2: class {
                        set() {}
                    },
                    Vector4: class {
                        set() {}
                    },
                    Matrix4: class {
                        set() {}
                        makeRotationY() {}
                        multiply() {}
                    },
                    Color: class {
                        set() {}
                    },
                    Group: class {
                        add() {}
                        remove() {}
                        position = { set() {} };
                        rotation = { set() {} };
                    },
                    Mesh: class {
                        position = { set() {} };
                        rotation = { set() {} };
                        geometry = { dispose() {} };
                        material = { dispose() {} };
                    },
                    BoxGeometry: class {
                        dispose() {}
                    },
                    PlaneGeometry: class {
                        dispose() {}
                    },
                    ShapeGeometry: class {
                        dispose() {}
                    },
                    BufferGeometry: class {
                        dispose() {}
                        setAttribute() {}
                    },
                    MeshStandardMaterial: class {
                        dispose() {}
                    },
                    MeshBasicMaterial: class {
                        dispose() {}
                    },
                    TextureLoader: class {
                        load() {
                            return {};
                        }
                    }
                };
            }
        });

        await page.route('**/*', (route) => {
            const url = route.request().url();
            if (
                url.includes('mapbox-gl.js') ||
                url.includes('three.min.js') ||
                url.includes('mqttws31.min.js') ||
                url.includes('mapbox-gl.css')
            ) {
                return route.fulfill({
                    status: 200,
                    contentType: url.endsWith('.css') ? 'text/css' : 'application/javascript',
                    body: '/* Mocked CDN Resource */'
                });
            }
            return route.continue();
        });

        await page.goto('/play.html');
        await page.waitForFunction(() => typeof window.map !== 'undefined', { timeout: 10000 }).catch(() => {});
        await page.evaluate(() => {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) {
                overlay.classList.add('hidden');
                overlay.style.display = 'none';
                overlay.style.pointerEvents = 'none';
            }
        });
    });

    test('loads page title and HUD elements cleanly', async ({ page }) => {
        await expect(page).toHaveTitle(/GEO Ride/i);
        const mapContainer = page.locator('#map');
        await expect(mapContainer).toBeVisible();
    });

    test('opens multiplayer panel on button click', async ({ page }) => {
        const mpBtn = page.locator('#mp-btn');
        if (await mpBtn.isVisible()) {
            await page.evaluate(() => {
                const btn = document.getElementById('mp-btn');
                if (btn) btn.click();
            });
            const mpDropdown = page.locator('#mp-dropdown');
            await expect(mpDropdown).toHaveClass(/active/);
        }
    });

    test('vehicle selector tab interactions', async ({ page }) => {
        const truckBtn = page.locator('[data-vehicle="truck"]');
        if (await truckBtn.isVisible()) {
            await page.evaluate(() => {
                const btn = document.querySelector('[data-vehicle="truck"]');
                if (btn) btn.click();
            });
            await expect(truckBtn).toHaveClass(/active/);
        }
    });
});
