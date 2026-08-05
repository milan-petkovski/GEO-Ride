import { state } from './state.js';
import { VEHICLE_CONFIG } from './config.js';

let threeLayer;
let vehicleMarker;
const THREE = typeof window !== 'undefined' ? window.THREE : null;

export function getThreeLayer() { return threeLayer; }
export function getVehicleMarker() { return vehicleMarker; }

export function setupVehicleMarker(map) {
    if (vehicleMarker) vehicleMarker.remove();

    if (!state.is3D || state.activeVehicle === 'god') {
        const config = VEHICLE_CONFIG[state.activeVehicle];
        const el = document.createElement('div');
        el.className = 'marker-container';

        const inner = document.createElement('div');
        inner.className = `vehicle-marker ${state.activeVehicle}-2d`;
        inner.innerHTML = config.svg;
        inner.style.transform = `scale(${config.size * 1.2})`;
        inner.style.transition = 'transform 0.1s ease-out';

        el.appendChild(inner);

        vehicleMarker = new mapboxgl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' })
            .setLngLat([state.lng, state.lat]).setRotation(state.bearing).addTo(map);
    }
}

export function setup3DVehicleLayer(map) {
    const shouldShow3D = state.is3D || state.isTeleporting;
    if (!shouldShow3D || state.activeVehicle === 'god') {
        if (map.getLayer('3d-vehicle-layer')) map.removeLayer('3d-vehicle-layer');
        return;
    }

    if (map.getLayer('3d-vehicle-layer')) {
        if (threeLayer && threeLayer.buildVehicle) threeLayer.buildVehicle(state.activeVehicle);
        return;
    }

    const modelTransform = {
        translateX: 0,
        translateY: 0,
        translateZ: 0,
        rotateX: Math.PI / 2,
        rotateY: 0,
        rotateZ: 0,
        scale: 0
    };

    threeLayer = {
        id: '3d-vehicle-layer',
        type: 'custom',
        renderingMode: '3d',
        modelTransform: modelTransform,
        onAdd: function (map, gl) {
            this.camera = new THREE.Camera();
            this.scene = new THREE.Scene();
            this.matrix = new THREE.Matrix4();
            this.translation = new THREE.Matrix4();
            this.scaleVec = new THREE.Vector3();
            this.rotation = new THREE.Matrix4();

            const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
            this.scene.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(0, -70, 100).normalize();
            this.scene.add(directionalLight);

            this.vehicleGroup = new THREE.Group();
            this.scene.add(this.vehicleGroup);
            this.skidGroup = new THREE.Group();
            this.scene.add(this.skidGroup);

            const circleGeom = new THREE.CircleGeometry(3.5, 32);
            const circleMat = new THREE.MeshBasicMaterial({ color: 0x00F2FF, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
            this.travelCircle = new THREE.Mesh(circleGeom, circleMat);
            this.travelCircle.rotation.x = -Math.PI / 2;
            this.travelCircle.visible = false;
            this.scene.add(this.travelCircle);

            const destRingGeom = new THREE.RingGeometry(3.8, 4.2, 32);
            const destRingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
            this.destRing = new THREE.Mesh(destRingGeom, destRingMat);
            this.destRing.rotation.x = -Math.PI / 2;
            this.destRing.visible = false;
            this.scene.add(this.destRing);

            this.buildVehicle(state.activeVehicle);
            this.map = map;
            this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: false });
            this.renderer.autoClear = false;
        },
        buildVehicle: function (type) {
            while (this.vehicleGroup.children.length > 0) {
                const child = this.vehicleGroup.children[0];
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
                this.vehicleGroup.remove(child);
            }
            this.wheels = [];
            if (type === 'god') return;

            const accentColor = 0x00F2FF;
            const loader = new THREE.TextureLoader();
            const logoTex = loader.load('favicon.png');
            const wheelSegments = state.performance.eliteEnd ? 24 : (state.performance.lowEnd ? 8 : 12);

            const teleSphereGeom = new THREE.SphereGeometry(1.2, 32, 32);
            const teleSphereMat = new THREE.MeshStandardMaterial({ color: 0x00F2FF, emissive: 0x00F2FF, emissiveIntensity: 5, transparent: true, opacity: 0.8 });
            this.teleSphere = new THREE.Mesh(teleSphereGeom, teleSphereMat);
            this.teleSphere.name = 'teleportSphere';
            this.vehicleGroup.add(this.teleSphere);

            if (type === 'car' || type === 'god') {
                const mainMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.8 });
                const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 2 });
                const glassMat = new THREE.MeshStandardMaterial({ color: 0x00F2FF, transparent: true, opacity: 0.5 });

                const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 4.5), mainMat);
                body.position.y = 0.4; this.vehicleGroup.add(body);

                const fenderGeom = new THREE.BoxGeometry(0.3, 0.55, 1.3);
                [[-0.9, 0.45, 1.4], [0.9, 0.45, 1.4], [-0.9, 0.45, -1.5], [0.9, 0.45, -1.5]].forEach(pos => {
                    const f = new THREE.Mesh(fenderGeom, mainMat);
                    f.position.set(...pos); this.vehicleGroup.add(f);
                });

                const hood = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 1.6), mainMat);
                hood.position.set(0, 0.55, 1.45); hood.rotation.x = -0.25; this.vehicleGroup.add(hood);

                const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 2.2), glassMat);
                cabin.position.set(0, 0.8, -0.2); this.vehicleGroup.add(cabin);

                const roof = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 1.9), mainMat);
                roof.position.set(0, 1.1, -0.2); this.vehicleGroup.add(roof);

                const headlightGeom = new THREE.BoxGeometry(0.5, 0.05, 0.1);
                [[-0.6, 0.5, 2.26], [0.6, 0.5, 2.26]].forEach(pos => {
                    const light = new THREE.Mesh(headlightGeom, accentMat);
                    light.position.set(...pos); this.vehicleGroup.add(light);
                });

                const lightBar = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 3 }));
                lightBar.position.set(0, 0.6, -2.26); this.vehicleGroup.add(lightBar);

                const logo = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, side: THREE.DoubleSide, alphaTest: 0.05 }));
                logo.position.set(0, 0.8, 1.6); logo.rotation.x = -Math.PI / 2 - 0.25; this.vehicleGroup.add(logo);

                const wheelGeom = new THREE.CylinderGeometry(0.45, 0.45, 0.35, wheelSegments);
                const wheelMat = new THREE.MeshStandardMaterial({ color: 0x050505 });
                const rimMat = new THREE.MeshStandardMaterial({ color: accentColor, metalness: 1, roughness: 0.2 });
                [[-0.9, 0.45, 1.4], [0.9, 0.45, 1.4], [-0.9, 0.45, -1.5], [0.9, 0.45, -1.5]].forEach(pos => {
                    const wGroup = new THREE.Group();
                    const w = new THREE.Mesh(wheelGeom, wheelMat);
                    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.36, wheelSegments), rimMat);
                    w.rotation.z = Math.PI / 2; rim.rotation.z = Math.PI / 2;
                    wGroup.add(w); wGroup.add(rim); wGroup.position.set(...pos);
                    this.vehicleGroup.add(wGroup); this.wheels.push(wGroup);
                });
            } else if (type === 'truck') {
                const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.7 });
                const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.5, 6), bodyMat);
                body.position.set(0, 1.8, -1); this.vehicleGroup.add(body);

                const logoGeom = new THREE.PlaneGeometry(2.2, 2.2);
                const logoMat = new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, alphaTest: 0.05 });
                [[-1.105, 1.8, -1, -Math.PI / 2], [1.105, 1.8, -1, Math.PI / 2]].forEach(pos => {
                    const logo = new THREE.Mesh(logoGeom, logoMat);
                    logo.position.set(pos[0], pos[1], pos[2]); logo.rotation.y = pos[3]; this.vehicleGroup.add(logo);
                });

                const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 2), bodyMat);
                cab.position.set(0, 1.4, 2.8); this.vehicleGroup.add(cab);

                const fender = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 2.2), new THREE.MeshStandardMaterial({ color: 0x050505 }));
                fender.position.set(0, 0.8, 2.8); this.vehicleGroup.add(fender);

                const doorGeom = new THREE.BoxGeometry(0.06, 1.3, 1.1);
                const doorMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.2 });
                const windowGeom = new THREE.BoxGeometry(0.07, 0.6, 0.8);
                const windowMat = new THREE.MeshStandardMaterial({ color: 0x00F2FF, transparent: true, opacity: 0.3 });
                const handleGeom = new THREE.BoxGeometry(0.1, 0.05, 0.15);
                const handleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 });
                [[-1.1, 1.45, 2.8], [1.1, 1.45, 2.8]].forEach(pos => {
                    const door = new THREE.Mesh(doorGeom, doorMat);
                    door.position.set(...pos); this.vehicleGroup.add(door);
                    const sWindow = new THREE.Mesh(windowGeom, windowMat);
                    sWindow.position.set(pos[0] * 1.01, 1.7, pos[2] + 0.1); this.vehicleGroup.add(sWindow);
                    const handle = new THREE.Mesh(handleGeom, handleMat);
                    handle.position.set(pos[0] * 1.05, 1.4, pos[2] - 0.35); this.vehicleGroup.add(handle);
                });

                const rearDoorGeom = new THREE.BoxGeometry(1.0, 2.2, 0.05);
                const rearDoorMat = new THREE.MeshStandardMaterial({ color: 0x151515, metalness: 0.5 });
                [[-0.55, 1.8, -4.01], [0.55, 1.8, -4.01]].forEach(pos => {
                    const door = new THREE.Mesh(rearDoorGeom, rearDoorMat);
                    door.position.set(...pos); this.vehicleGroup.add(door);
                    // Add vertical bars/handles to doors
                    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.8, 0.04), new THREE.MeshStandardMaterial({ color: 0x444444 }));
                    handle.position.set(pos[0] + (pos[0] < 0 ? 0.3 : -0.3), 1.8, -4.04); this.vehicleGroup.add(handle);
                });

                const pipeGeom = new THREE.CylinderGeometry(0.1, 0.1, 3.0, 12);
                const pipeMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0 });
                [[-0.9, 2.2, 1.8], [0.9, 2.2, 1.8]].forEach(pos => {
                    const pipe = new THREE.Mesh(pipeGeom, pipeMat);
                    pipe.position.set(...pos); this.vehicleGroup.add(pipe);
                });

                const glass = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x00F2FF, transparent: true, opacity: 0.6, emissive: 0x00F2FF, emissiveIntensity: 0.2 }));
                glass.position.set(0, 1.8, 3.8); this.vehicleGroup.add(glass);

                const headlightGeom = new THREE.BoxGeometry(0.5, 0.2, 0.1);
                const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2 });
                [[-0.8, 0.9, 3.9], [0.8, 0.9, 3.9]].forEach(pos => {
                    const light = new THREE.Mesh(headlightGeom, headlightMat);
                    light.position.set(...pos); this.vehicleGroup.add(light);
                });

                const wheelGeom = new THREE.CylinderGeometry(0.6, 0.6, 0.4, wheelSegments);
                const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
                const rimGeom = new THREE.CylinderGeometry(0.4, 0.4, 0.42, wheelSegments);
                const rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1, roughness: 0.2 });
                [[-1.0, 0.6, 3], [1.0, 0.6, 3], [-1.0, 0.6, -1], [1.0, 0.6, -1], [-1.0, 0.6, -3], [1.0, 0.6, -3]].forEach(pos => {
                    const wGroup = new THREE.Group();
                    const w = new THREE.Mesh(wheelGeom, wheelMat);
                    const rim = new THREE.Mesh(rimGeom, rimMat);
                    w.rotation.z = Math.PI / 2; rim.rotation.z = Math.PI / 2;
                    wGroup.add(w); wGroup.add(rim); wGroup.position.set(...pos);
                    this.vehicleGroup.add(wGroup); this.wheels.push(wGroup);
                });
            } else if (type === 'bus') {
                const bodyMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.3, metalness: 0.5 });
                const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 8), bodyMat);
                body.position.set(0, 1.6, 0); this.vehicleGroup.add(body);

                const glassMat = new THREE.MeshStandardMaterial({ color: 0x00F2FF, transparent: true, opacity: 0.4, emissive: 0x00F2FF, emissiveIntensity: 0.1 });
                const rightWin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 7.2), glassMat);
                rightWin.position.set(1.1, 1.9, 0); this.vehicleGroup.add(rightWin);

                [[0, 1.9, 1.5], [0, 1.9, -1.5]].forEach(pos => {
                    const lw = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 1.8), glassMat);
                    lw.position.set(-1.1, pos[1], pos[2]); this.vehicleGroup.add(lw);
                });

                const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.2, 0.1), glassMat);
                windshield.position.set(0, 1.8, 4.05); this.vehicleGroup.add(windshield);

                const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.8, 0.1), glassMat);
                rearWindow.position.set(0, 1.8, -4.05); this.vehicleGroup.add(rearWindow);

                const doorGeom = new THREE.BoxGeometry(0.1, 1.8, 0.8);
                const doorMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
                [3, 0, -3].forEach(z => {
                    const door = new THREE.Mesh(doorGeom, doorMat);
                    door.position.set(-1.1, 1.2, z); this.vehicleGroup.add(door);
                    const dGlass = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.6), glassMat);
                    dGlass.position.set(-1.1, 1.4, z); this.vehicleGroup.add(dGlass);
                });

                const acGeom = new THREE.BoxGeometry(1.4, 0.3, 2.5);
                const acMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
                const ac = new THREE.Mesh(acGeom, acMat);
                ac.position.set(0, 2.9, 1); this.vehicleGroup.add(ac);

                const logoGeom = new THREE.PlaneGeometry(1.1, 1.1);
                const logoMat = new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, alphaTest: 0.05 });
                [[-1.105, 0.95, 1.5, -Math.PI / 2], [-1.105, 0.95, -1.5, -Math.PI / 2], [1.105, 0.95, 1.5, Math.PI / 2], [1.105, 0.95, -1.5, Math.PI / 2]].forEach(pos => {
                    const logo = new THREE.Mesh(logoGeom, logoMat);
                    logo.position.set(pos[0], pos[1], pos[2]); logo.rotation.y = pos[3]; this.vehicleGroup.add(logo);
                });

                const wheelGeom = new THREE.CylinderGeometry(0.6, 0.6, 0.4, wheelSegments);
                const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
                const rimGeom = new THREE.CylinderGeometry(0.4, 0.4, 0.42, wheelSegments);
                const rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1, roughness: 0.2 });
                [[-1, 0.6, 3], [1, 0.6, 3], [-1, 0.6, -3], [1, 0.6, -3]].forEach(pos => {
                    const wGroup = new THREE.Group();
                    const w = new THREE.Mesh(wheelGeom, wheelMat);
                    const rim = new THREE.Mesh(rimGeom, rimMat);
                    w.rotation.z = Math.PI / 2; rim.rotation.z = Math.PI / 2;
                    wGroup.add(w); wGroup.add(rim); wGroup.position.set(...pos);
                    this.vehicleGroup.add(wGroup); this.wheels.push(wGroup);
                });

                const headlightGeom = new THREE.BoxGeometry(0.6, 0.3, 0.1);
                const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2 });
                [[-0.7, 0.6, 4.05], [0.7, 0.6, 4.05]].forEach(pos => {
                    const light = new THREE.Mesh(headlightGeom, headlightMat);
                    light.position.set(...pos); this.vehicleGroup.add(light);
                });
            }

            this.brakeMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff0000, emissiveIntensity: 0 });
            const brakeGeom = new THREE.BoxGeometry(0.6, 0.2, 0.1);
            const zOff = type === 'bus' ? -4 : type === 'truck' ? -4 : -2;
            [[-0.7, 0.8, zOff], [0.7, 0.8, zOff]].forEach(pos => {
                const b = new THREE.Mesh(brakeGeom, this.brakeMat); b.position.set(...pos); this.vehicleGroup.add(b);
            });
        },
        render: function (gl, matrix) {
            const mc = mapboxgl.MercatorCoordinate.fromLngLat([state.lng, state.lat], 0);
            this.modelTransform.scale = mc.meterInMercatorCoordinateUnits();

            // Visibility & Scale Logic (STARO.js style)
            if (this.vehicleGroup) {
                this.vehicleGroup.children.forEach(child => {
                    if (child.name === 'teleportSphere') {
                        child.visible = state.teleportProgress > 0.05;
                        const s = state.teleportProgress * (1 + Math.sin(Date.now() * 0.01) * 0.1);
                        child.scale.set(s, s, s);
                    } else {
                        const s = 1 - state.teleportProgress;
                        child.scale.set(s, s, s);
                        child.visible = s > 0.05;
                    }
                });
            }

            // Smooth Teleport Progress Animation (STARO.js style)
            const targetProg = state.isTeleporting ? 1 : 0;
            state.teleportProgress += (targetProg - state.teleportProgress) * 0.15;
            if (Math.abs(targetProg - state.teleportProgress) < 0.01) state.teleportProgress = targetProg;

            const angleRad = -(state.bearing * Math.PI / 180) + Math.PI;
            const targetPitch = -state.velocity * 0.1;
            const targetRoll = state.steeringAngle * 0.15 * Math.min(Math.abs(state.velocity) * 10, 1);

            // Calculate Altitude for Teleport Arc (STARO.js style)
            let altitude = 0;
            if (state.isTeleporting) {
                const progress = Math.max(0, Math.min(1, (Date.now() - (state.teleportStartTime || 0)) / (state.teleportDuration || 1000)));
                altitude = Math.sin(progress * Math.PI) * 20;
            }

            // Positioning & Rotation
            this.matrix.fromArray(matrix);
            this.scaleVec.set(this.modelTransform.scale * 5.0, -this.modelTransform.scale * 5.0, this.modelTransform.scale * 5.0);
            const coord = mapboxgl.MercatorCoordinate.fromLngLat([state.lng, state.lat], altitude);
            this.translation.makeTranslation(coord.x, coord.y, coord.z).scale(this.scaleVec).multiply(this.rotation.makeRotationX(this.modelTransform.rotateX + targetPitch)).multiply(this.rotation.makeRotationY(angleRad)).multiply(this.rotation.makeRotationZ(targetRoll));
            this.camera.projectionMatrix = this.matrix.multiply(this.translation);

            if (this.brakeMat) this.brakeMat.emissiveIntensity = state.keys['s'] ? 4 : 0.4;
            for (let i = 0; i < this.wheels.length; i++) this.wheels[i].rotation.x += state.velocity * 2;

            this.renderer.resetState();
            this.renderer.render(this.scene, this.camera);
            this.map.triggerRepaint();
        }
    };
    map.addLayer(threeLayer);
}

export function updateSkidMarks(map) {
    const isDrifting = state.keys[' '] && Math.abs(state.velocity) > 0.05 && state.activeVehicle !== 'god';
    const isBurnout = state.isCharging && state.activeVehicle !== 'god';
    const shouldMark = isDrifting || isBurnout;

    if (shouldMark) {
        const A = state.bearing * (Math.PI / 180);

        // Fine-tuned offsets for all vehicles
        const sideDist = state.activeVehicle === 'bus' ? 0.000045 : (state.activeVehicle === 'truck' ? 0.000060 : 0.000040);
        const rearDist = state.activeVehicle === 'bus' ? -0.000050 : (state.activeVehicle === 'truck' ? -0.000155 : -0.0000100);

        const getTirePos = (side) => {
            const s = sideDist * side;
            const r = rearDist;
            return {
                lng: state.lng + (Math.cos(A) * s + Math.sin(A) * r),
                lat: state.lat + (-Math.sin(A) * s + Math.cos(A) * r)
            };
        };

        const currentTires = { right: getTirePos(1), left: getTirePos(-1) };

        if (state.lastSkidPos && state.lastSkidPos.right) {
            const createTrack = (side) => {
                const tire = side === 1 ? currentTires.right : currentTires.left;
                const lastTire = side === 1 ? state.lastSkidPos.right : state.lastSkidPos.left;
                // Remove jitter for a perfectly smooth tire track curve
                const jitter = 0;

                return {
                    type: 'Feature',
                    properties: { opacity: isBurnout ? 0.7 : 0.85, life: isBurnout ? 3.0 : 4.5 },
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [lastTire.lng + jitter, lastTire.lat + jitter],
                            [tire.lng, tire.lat]
                        ]
                    }
                };
            };
            state.skidMarks.push(createTrack(1), createTrack(-1));
        }
        state.lastSkidPos = currentTires;
    } else {
        state.lastSkidPos = null;
    }

    if (state.skidMarks.length > 0) {
        state.skidMarks.forEach(m => {
            m.properties.life -= 0.005; // Fade 3x slower
            m.properties.opacity = Math.max(0, m.properties.life * 0.2); // Smooth fade transition
        });

        state.skidMarks = state.skidMarks.filter(m => m.properties.life > 0);
        const maxMarks = state.performance.eliteEnd ? 2000 : (state.performance.lowEnd ? 200 : 800);
        if (state.skidMarks.length > maxMarks) state.skidMarks = state.skidMarks.slice(-maxMarks);

        state.skidUpdateFrame++;
        if (state.skidUpdateFrame % 5 === 0) {
            const source = map.getSource('skid-marks');
            if (source) {
                source.setData({
                    type: 'FeatureCollection',
                    features: state.skidMarks
                });
            }
        }
    }
}
