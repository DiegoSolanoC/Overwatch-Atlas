/**
 * WorldviewTransportView - Handles transport rendering (trains, planes, boats) and trails
 */
import { latLonToVector3, latLonToMapPlanePosition } from '../../worldview-shared-assets/utils/WorldviewGeometry.js';
import { getGlobeQualitySnapshot } from '../../worldview-shared-assets/constants/WorldviewQualitySettings.js';

export class WorldviewTransportView {
    constructor(sceneModel, transportModel) {
        this.sceneModel = sceneModel;
        this.transportModel = transportModel;
        this.airportMarkers = [];
        this.trainStationMarkers = [];
        this.seaportMarkers = [];

        /** Satellite / ISS / MarsShip dotted trail pool. */
        this._satTrailGeo = new THREE.SphereGeometry(0.002, 6, 6);
        this._satTrailPool = [];
        this._trailScratch = new THREE.Vector3();
        this._trailSide = new THREE.Vector3();
        this._trailUp = new THREE.Vector3();
        this._trailFwd = new THREE.Vector3();
        this._trailN = new THREE.Vector3();

        /**
         * Kelvin wake half-angle ≈ 19.47° (tan ≈ 0.354). Opening grows with
         * distance behind the stern — not with “fraction of samples” (that made
         * short paths look like fat triangles glued to the hull).
         */
        this._kelvinHalfTan = Math.tan((19.47 * Math.PI) / 180);
        this._wakeMaxHalf = 0.01;
        /* Offset from hull center toward the bow (triangular tip parts the water). */
        this._wakeBowGap = 0.018;
        this._wakeSurfaceLift = 0.0018; /* sit on the water, not as a fence */

        this._contrailRadius = 0.0042;
        this._contrailRadial = 6;
    }

    /** White trail material — vertex `color.r` drives alpha (true transparency gradient). */
    _makeTrailAlphaMaterial(opacityMul = 1) {
        return new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            uniforms: { uOpacity: { value: opacityMul } },
            vertexShader: `
                attribute vec3 color;
                varying float vA;
                void main() {
                    vA = color.r;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uOpacity;
                varying float vA;
                void main() {
                    float a = vA * uOpacity;
                    if (a < 0.01) discard;
                    gl_FragColor = vec4(1.0, 1.0, 1.0, a);
                }
            `
        });
    }

    _acquireSatTrailMesh() {
        const pool = this._satTrailPool;
        let mesh = pool.pop();
        if (!mesh) {
            mesh = new THREE.Mesh(
                this._satTrailGeo,
                new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.8
                })
            );
            mesh.userData.pooledTrail = true;
        } else {
            mesh.material.opacity = 0.8;
        }
        mesh.userData.age = 0;
        mesh.userData.maxAge = 180;
        mesh.visible = true;
        return mesh;
    }

    _releaseSatTrailMesh(mesh) {
        if (!mesh) return;
        if (mesh.parent) mesh.parent.remove(mesh);
        if (mesh.userData?.pooledTrail) {
            this._satTrailPool.push(mesh);
        } else {
            mesh.geometry?.dispose?.();
            mesh.material?.dispose?.();
        }
    }

    /* ── Plane contrails: low-poly tubes with fade-in + long-lived cut-offs ── */

    _createContrailSegmentMesh(maxPts = 72) {
        const radial = this._contrailRadial;
        const maxVerts = maxPts * radial;
        const positions = new Float32Array(maxVerts * 3);
        const colors = new Float32Array(maxVerts * 3);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const index = [];
        for (let s = 0; s < maxPts - 1; s++) {
            for (let r = 0; r < radial; r++) {
                const a = s * radial + r;
                const b = s * radial + ((r + 1) % radial);
                const c = (s + 1) * radial + r;
                const d = (s + 1) * radial + ((r + 1) % radial);
                index.push(a, c, b, b, c, d);
            }
        }
        geometry.setIndex(index);
        geometry.setDrawRange(0, 0);
        const mesh = new THREE.Mesh(geometry, this._makeTrailAlphaMaterial(1));
        mesh.frustumCulled = false;
        mesh.renderOrder = 6;
        mesh.userData.isPlaneContrail = true;
        mesh.userData.contrailPts = []; /* {x,y,z, tx,ty,tz, rx,ry,rz} */
        mesh.userData.contrailMaxPts = maxPts;
        mesh.userData.detached = false;
        mesh.userData.age = 0;
        mesh.userData.maxAge = 280;
        return mesh;
    }

    _ensurePlaneContrailState(plane) {
        if (!plane.userData.contrailState) {
            plane.userData.contrailState = {
                active: null,
                detached: [],
                gapFrames: 0,
                emitFrames: 0,
                nextCutIn: 55 + Math.floor(Math.random() * 100)
            };
        }
        return plane.userData.contrailState;
    }

    _contrailFrameAt(pts, i, outT, outR, outU) {
        const p = pts[i];
        const prev = pts[Math.max(0, i - 1)];
        const next = pts[Math.min(pts.length - 1, i + 1)];
        outT.set(next.x - prev.x, next.y - prev.y, next.z - prev.z);
        if (outT.lengthSq() < 1e-10) outT.set(p.tx || 0, p.ty || 1, p.tz || 0);
        outT.normalize();
        outU.set(p.x, p.y, p.z).normalize();
        outR.crossVectors(outT, outU);
        if (outR.lengthSq() < 1e-10) {
            outR.set(p.rx || 1, p.ry || 0, p.rz || 0);
        }
        outR.normalize();
        outU.crossVectors(outR, outT).normalize();
    }

    _writeContrailTube(mesh) {
        const pts = mesh.userData.contrailPts;
        const maxPts = mesh.userData.contrailMaxPts || 72;
        const radial = this._contrailRadial;
        const baseR = this._contrailRadius;
        const posAttr = mesh.geometry.getAttribute('position');
        const colAttr = mesh.geometry.getAttribute('color');
        const arr = posAttr.array;
        const cols = colAttr.array;
        const n = pts.length;

        for (let i = 0; i < n; i++) {
            const p = pts[i];
            this._contrailFrameAt(pts, i, this._trailFwd, this._trailSide, this._trailUp);

            /* u=0 at craft (newest), u=1 at faded tip (oldest). Cone: round nose → sharp tail. */
            const u = (n - 1 - i) / Math.max(1, n - 1);
            let profile;
            if (u < 0.14) {
                const t = u / 0.14;
                profile = 0.18 + 0.82 * Math.sin(t * Math.PI * 0.5); /* round front */
            } else {
                const t = (u - 0.14) / 0.86;
                profile = Math.pow(1 - t, 1.75); /* sharpen back to a point */
            }
            const radius = baseR * Math.max(0.02, profile);

            /* Stronger transparency gradient along the plume. */
            let alpha = 1;
            if (u < 0.12) alpha *= u / 0.12; /* fade-in at craft */
            else if (u > 0.35) alpha *= Math.pow(1 - (u - 0.35) / 0.65, 1.45);
            alpha = Math.max(0.02, Math.min(0.95, alpha));

            for (let r = 0; r < radial; r++) {
                const ang = (r / radial) * Math.PI * 2;
                const c = Math.cos(ang);
                const s = Math.sin(ang);
                const ox = this._trailSide.x * c + this._trailUp.x * s;
                const oy = this._trailSide.y * c + this._trailUp.y * s;
                const oz = this._trailSide.z * c + this._trailUp.z * s;
                const vi = (i * radial + r) * 3;
                arr[vi] = p.x + ox * radius;
                arr[vi + 1] = p.y + oy * radius;
                arr[vi + 2] = p.z + oz * radius;
                cols[vi] = alpha;
                cols[vi + 1] = alpha;
                cols[vi + 2] = alpha;
            }
        }
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        const segs = Math.max(0, n - 1);
        mesh.geometry.setDrawRange(0, segs * radial * 6);
        mesh.geometry.computeBoundingSphere();
        mesh.visible = n >= 2;
        void maxPts;
    }

    _detachActiveContrail(plane) {
        const state = plane.userData.contrailState;
        if (!state?.active) return;
        const mesh = state.active;
        mesh.userData.detached = true;
        mesh.userData.age = 0;
        state.detached.push(mesh);
        state.active = null;
        /* Gap shorter than fade life so old plume still shows when a new one starts. */
        state.gapFrames = 22 + Math.floor(Math.random() * 30);
        state.nextCutIn = 50 + Math.floor(Math.random() * 110);
    }

    /**
     * @param {THREE.Object3D} plane
     * @param {THREE.Vector3} position
     * @param {THREE.Vector3} aftDir
     * @param {THREE.Vector3} [rightDir]
     */
    pushPlaneContrailPoint(plane, position, aftDir, rightDir) {
        if (!this.sceneModel.getHyperloopVisible()) return;
        if (!getGlobeQualitySnapshot().trailsEnabled) return;

        const state = this._ensurePlaneContrailState(plane);
        if (state.gapFrames > 0) return;

        const globe = this.sceneModel.getGlobe();
        if (!state.active) {
            const mesh = this._createContrailSegmentMesh(72);
            state.active = mesh;
            if (globe) globe.add(mesh);
            this.transportModel.addPlaneTrail(mesh);
        }

        const mesh = state.active;
        const pts = mesh.userData.contrailPts;
        const maxPts = mesh.userData.contrailMaxPts || 72;

        this._trailUp.copy(position).normalize();
        if (aftDir && aftDir.lengthSq() > 1e-8) this._trailFwd.copy(aftDir).normalize();
        else this._trailFwd.set(0, 1, 0);
        if (rightDir && rightDir.lengthSq() > 1e-8) this._trailSide.copy(rightDir).normalize();
        else {
            this._trailSide.crossVectors(this._trailFwd, this._trailUp);
            if (this._trailSide.lengthSq() < 1e-8) this._trailSide.set(1, 0, 0);
            else this._trailSide.normalize();
        }

        /* Slight stern gap so the plume reads as exhaust, not a hull spike. */
        const gap = 0.006;
        pts.push({
            x: position.x + this._trailFwd.x * gap,
            y: position.y + this._trailFwd.y * gap,
            z: position.z + this._trailFwd.z * gap,
            tx: this._trailFwd.x,
            ty: this._trailFwd.y,
            tz: this._trailFwd.z,
            rx: this._trailSide.x,
            ry: this._trailSide.y,
            rz: this._trailSide.z
        });
        while (pts.length > maxPts) pts.shift();
        this._writeContrailTube(mesh);

        state.emitFrames += 1;
        if (state.emitFrames >= state.nextCutIn && pts.length > 16) {
            this._detachActiveContrail(plane);
            state.emitFrames = 0;
        }
    }

    disposePlaneContrail(plane) {
        const state = plane?.userData?.contrailState;
        if (!state) {
            const line = plane?.userData?.contrailLine;
            if (line) {
                this.transportModel.removePlaneTrail(line);
                if (line.parent) line.parent.remove(line);
                line.geometry?.dispose?.();
                line.material?.dispose?.();
                plane.userData.contrailLine = null;
                plane.userData.contrailPts = null;
            }
            return;
        }
        const kill = (mesh) => {
            if (!mesh) return;
            this.transportModel.removePlaneTrail(mesh);
            if (mesh.parent) mesh.parent.remove(mesh);
            mesh.geometry?.dispose?.();
            mesh.material?.dispose?.();
        };
        kill(state.active);
        for (let i = 0; i < state.detached.length; i++) kill(state.detached[i]);
        plane.userData.contrailState = null;
        plane.userData.contrailLine = null;
        plane.userData.contrailPts = null;
    }

    /* ── Boat wakes: surface-imprinted Kelvin V fill (lies on the globe) ── */

    _makeWakeFillMesh(maxSegs) {
        /* 3 verts/sample: left edge, center, right edge — fill + readable V rim. */
        const positions = new Float32Array(maxSegs * 3 * 3);
        const colors = new Float32Array(maxSegs * 3 * 3);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const index = [];
        for (let s = 0; s < maxSegs - 1; s++) {
            const a = s * 3;
            index.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
            index.push(a + 1, a + 2, a + 4, a + 2, a + 5, a + 4);
        }
        geometry.setIndex(index);
        geometry.setDrawRange(0, 0);
        const mesh = new THREE.Mesh(geometry, this._makeTrailAlphaMaterial(1));
        mesh.frustumCulled = false;
        mesh.renderOrder = 5;
        mesh.userData.isBoatWake = true;
        return mesh;
    }

    ensureBoatWake(boat, maxSegs = 40) {
        if (!boat) return null;
        if (boat.userData.wakeMesh) return boat.userData.wakeMesh;
        const globe = this.sceneModel.getGlobe();
        const mesh = this._makeWakeFillMesh(maxSegs);
        boat.userData.wakeMesh = mesh;
        boat.userData.wakeSamples = [];
        boat.userData.wakeMaxSegs = maxSegs;
        boat.userData.wakePrevRight = null;
        if (globe) globe.add(mesh);
        this.transportModel.addBoatTrail(mesh);
        /* Drop legacy edge-only meshes if a hot reload left them around. */
        if (boat.userData.wakeLeft || boat.userData.wakeRight) {
            const kill = (o) => {
                if (!o) return;
                this.transportModel.removeBoatTrail(o);
                if (o.parent) o.parent.remove(o);
                o.geometry?.dispose?.();
                o.material?.dispose?.();
            };
            kill(boat.userData.wakeLeft);
            kill(boat.userData.wakeRight);
            boat.userData.wakeLeft = null;
            boat.userData.wakeRight = null;
        }
        return mesh;
    }

    /**
     * @param {THREE.Object3D} boat
     * @param {THREE.Vector3} position
     * @param {THREE.Vector3} aft
     * @param {THREE.Vector3} right
     */
    pushBoatWakeSample(boat, position, aft, right) {
        if (!this.sceneModel.getHyperloopVisible()) return;
        if (!getGlobeQualitySnapshot().trailsEnabled) return;
        this.ensureBoatWake(boat);
        const samples = boat.userData.wakeSamples;
        const maxSegs = boat.userData.wakeMaxSegs || 40;

        /* `position` is already at the bow; keep a tiny surface-forward nudge only. */
        const gx = position.x;
        const gy = position.y;
        const gz = position.z;
        void aft;

        let dist = 0;
        if (samples.length) {
            const prev = samples[samples.length - 1];
            const dx = gx - prev.x;
            const dy = gy - prev.y;
            const dz = gz - prev.z;
            dist = prev.dist + Math.sqrt(dx * dx + dy * dy + dz * dz);
        }

        samples.push({ x: gx, y: gy, z: gz, dist });
        while (samples.length > maxSegs) samples.shift();
        if (samples.length) {
            const tipDist = samples[samples.length - 1].dist;
            for (let i = 0; i < samples.length; i++) {
                samples[i].behind = tipDist - samples[i].dist;
            }
        }
        this._rebuildBoatWakeGeometry(boat);
        void right;
    }

    _rebuildBoatWakeGeometry(boat) {
        const mesh = boat?.userData?.wakeMesh;
        const samples = boat?.userData?.wakeSamples;
        if (!mesh || !samples || samples.length < 2) {
            if (mesh) mesh.visible = false;
            return;
        }

        const n = samples.length;
        const posAttr = mesh.geometry.getAttribute('position');
        const colAttr = mesh.geometry.getAttribute('color');
        const arr = posAttr.array;
        const cols = colAttr.array;
        const lift = this._wakeSurfaceLift;
        let prevRx = 0;
        let prevRy = 0;
        let prevRz = 0;
        let hasPrev = false;
        const maxBehind = samples[0].behind || 0.04;

        for (let i = 0; i < n; i++) {
            const s = samples[i];
            const prev = samples[Math.max(0, i - 1)];
            const next = samples[Math.min(n - 1, i + 1)];

            /* Radial up from globe center → wake stays tangent to the surface. */
            this._trailUp.set(s.x, s.y, s.z).normalize();
            this._trailFwd.set(next.x - prev.x, next.y - prev.y, next.z - prev.z);
            /* Project tangent into tangent plane (remove radial component). */
            const radialDot = this._trailFwd.dot(this._trailUp);
            this._trailFwd.addScaledVector(this._trailUp, -radialDot);
            if (this._trailFwd.lengthSq() < 1e-10) this._trailFwd.set(0, 1, 0);
            this._trailFwd.normalize();

            this._trailSide.crossVectors(this._trailFwd, this._trailUp);
            if (this._trailSide.lengthSq() < 1e-10) this._trailSide.set(1, 0, 0);
            else this._trailSide.normalize();

            /* Stabilize handedness so the V doesn't flip mid-path (off-angle kink). */
            if (hasPrev && this._trailSide.x * prevRx + this._trailSide.y * prevRy + this._trailSide.z * prevRz < 0) {
                this._trailSide.negate();
            }
            prevRx = this._trailSide.x;
            prevRy = this._trailSide.y;
            prevRz = this._trailSide.z;
            hasPrev = true;

            const behind = s.behind || 0;
            const open = Math.min(this._wakeMaxHalf, behind * this._kelvinHalfTan);
            const cx = s.x + this._trailUp.x * lift;
            const cy = s.y + this._trailUp.y * lift;
            const cz = s.z + this._trailUp.z * lift;
            const lx = cx + this._trailSide.x * open;
            const ly = cy + this._trailSide.y * open;
            const lz = cz + this._trailSide.z * open;
            const rx = cx - this._trailSide.x * open;
            const ry = cy - this._trailSide.y * open;
            const rz = cz - this._trailSide.z * open;

            const t = Math.min(1, behind / Math.max(0.04, maxBehind));
            const fade = Math.pow(1 - t, 1.25);
            const fillA = 0.22 * fade;
            const edgeA = 0.42 * fade;

            const vi = i * 9;
            arr[vi] = lx; arr[vi + 1] = ly; arr[vi + 2] = lz;
            arr[vi + 3] = cx; arr[vi + 4] = cy; arr[vi + 5] = cz;
            arr[vi + 6] = rx; arr[vi + 7] = ry; arr[vi + 8] = rz;
            cols[vi] = cols[vi + 1] = cols[vi + 2] = edgeA;
            cols[vi + 3] = cols[vi + 4] = cols[vi + 5] = fillA;
            cols[vi + 6] = cols[vi + 7] = cols[vi + 8] = edgeA;
        }

        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        /* 2 quads × 6 indices per segment */
        mesh.geometry.setDrawRange(0, Math.max(0, n - 1) * 12);
        mesh.geometry.computeBoundingSphere();
        mesh.visible = true;
        if (mesh.material?.uniforms?.uOpacity) mesh.material.uniforms.uOpacity.value = 1;
    }

    disposeBoatWake(boat) {
        const kill = (o) => {
            if (!o) return;
            this.transportModel.removeBoatTrail(o);
            if (o.parent) o.parent.remove(o);
            o.geometry?.dispose?.();
            o.material?.dispose?.();
        };
        kill(boat?.userData?.wakeMesh);
        kill(boat?.userData?.wakeLeft);
        kill(boat?.userData?.wakeRight);
        boat.userData.wakeMesh = null;
        boat.userData.wakeLeft = null;
        boat.userData.wakeRight = null;
        boat.userData.wakeSamples = null;
    }

    /**
     * Get train color based on journey progress
     * @param {number} progress - Journey progress (0-1)
     * @returns {number} - Color hex value
     */
    getTrainColor(progress) {
        // Red (0xcc0000) -> Green (0x00cc00) gradient
        const r = Math.floor(0xcc * (1 - progress));
        const g = Math.floor(0xcc * progress);
        const b = 0x00;
        return (r << 16) | (g << 8) | b;
    }

    /**
     * Update train color based on journey progress
     * @param {Object} train - Train object
     */
    updateTrainColor(train) {
        const data = train.userData;
        if (!data || !data.curve) return;
        
        const progress = data.progress || 0;
        const color = this.getTrainColor(progress);
        
        // Update all wagons
        train.children.forEach(wagon => {
            if (wagon.material) {
                wagon.material.color.setHex(color);
            }
        });
    }

    /**
     * Append to the plane's active contrail segment (may be in a cut-off gap).
     * @param {THREE.Object3D} plane
     * @param {THREE.Vector3} position
     * @param {THREE.Vector3} aftDir
     * @param {THREE.Vector3} [rightDir]
     */
    createTrailSegment(plane, position, aftDir, rightDir) {
        if (plane && plane.isVector3) return;
        this.pushPlaneContrailPoint(plane, position, aftDir, rightDir);
    }

    /**
     * Age cut-off gaps, peel / fade detached + active tails, sat dots.
     */
    updateTrailSegments() {
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        const planes = this.transportModel.getPlanes();

        for (let i = 0; i < planes.length; i++) {
            const plane = planes[i];
            const state = plane.userData?.contrailState;
            if (!state) continue;

            if (state.gapFrames > 0) state.gapFrames -= 1;

            const tickSegment = (mesh, peeling) => {
                if (!mesh) return false;
                mesh.visible = hyperloopVisible;
                const pts = mesh.userData.contrailPts;
                if (!pts || pts.length < 2) return true;
                /* Slow dissolve from the oldest end — cut-offs must outlive the next emit. */
                if (peeling && pts.length >= 2 && mesh.userData.age % 2 === 0) {
                    pts.shift();
                    this._writeContrailTube(mesh);
                }
                if (mesh.userData.detached) {
                    mesh.userData.age += 1;
                    const t = mesh.userData.age / mesh.userData.maxAge;
                    /* Faster dissolve after cut-off so plumes clear before the next starts. */
                    const fade = Math.pow(1 - t, 1.15);
                    if (mesh.material?.uniforms?.uOpacity) {
                        mesh.material.uniforms.uOpacity.value = Math.max(0, fade);
                    }
                    if (mesh.userData.age >= mesh.userData.maxAge || pts.length < 2) {
                        this.transportModel.removePlaneTrail(mesh);
                        if (mesh.parent) mesh.parent.remove(mesh);
                        mesh.geometry?.dispose?.();
                        mesh.material?.dispose?.();
                        return false;
                    }
                } else if (pts.length >= 4 && Math.random() < 0.2) {
                    pts.shift();
                    this._writeContrailTube(mesh);
                }
                return true;
            };

            if (state.active) {
                tickSegment(state.active, false);
                if (state.active) state.active.visible = hyperloopVisible && plane.visible;
            }
            for (let d = state.detached.length - 1; d >= 0; d--) {
                if (!tickSegment(state.detached[d], true)) {
                    state.detached.splice(d, 1);
                }
            }
        }

        const planeTrails = this.transportModel.getPlaneTrails();
        for (let i = planeTrails.length - 1; i >= 0; i--) {
            const trail = planeTrails[i];
            if (trail.userData?.isPlaneContrail) {
                trail.visible = hyperloopVisible && trail.visible;
                continue;
            }
            trail.userData.age += 1;
            const fadeProgress = trail.userData.age / trail.userData.maxAge;
            if (trail.material) trail.material.opacity = 0.8 * (1 - fadeProgress);
            if (trail.userData.age >= trail.userData.maxAge) {
                this.transportModel.removePlaneTrail(trail);
                this._releaseSatTrailMesh(trail);
            } else {
                trail.visible = hyperloopVisible;
            }
        }
    }

    /**
     * @param {THREE.Object3D} boat
     * @param {THREE.Vector3} position
     * @param {THREE.Vector3} aft - behind boat
     * @param {THREE.Vector3} right
     */
    createBoatTrailSegment(boat, position, aft, right) {
        /* Legacy (position, forward, right, up) without boat — ignore. */
        if (boat && boat.isVector3) return;
        this.pushBoatWakeSample(boat, position, aft, right);
    }

    /**
     * Soft-trim boat V-edge wakes + visibility.
     */
    updateBoatTrailSegments() {
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        const boats = this.transportModel.getBoats();
        for (let i = 0; i < boats.length; i++) {
            const boat = boats[i];
            const mesh = boat.userData?.wakeMesh;
            if (!mesh) continue;
            const samples = boat.userData.wakeSamples;
            if (samples && samples.length > 3 && Math.random() < 0.22) {
                samples.shift();
                if (samples.length) {
                    const tipDist = samples[samples.length - 1].dist;
                    for (let s = 0; s < samples.length; s++) {
                        samples[s].behind = tipDist - samples[s].dist;
                    }
                }
                this._rebuildBoatWakeGeometry(boat);
            }
            mesh.visible = hyperloopVisible && boat.visible && (samples?.length || 0) >= 2;
        }

        const boatTrails = this.transportModel.getBoatTrails();
        for (let i = boatTrails.length - 1; i >= 0; i--) {
            const trail = boatTrails[i];
            if (trail.userData?.isBoatWake) {
                trail.visible = hyperloopVisible && trail.visible;
            }
        }
    }

    /**
     * Update visibility of all transport elements
     */
    /**
     * Remove plane/boat/satellite streak meshes when transport is disabled (free GPU objects, stop fade loops).
     */
    purgePlaneTrails() {
        const planes = this.transportModel.getPlanes();
        for (let i = 0; i < planes.length; i++) {
            this.disposePlaneContrail(planes[i]);
        }
        const planeTrails = this.transportModel.getPlaneTrails();
        for (let i = planeTrails.length - 1; i >= 0; i--) {
            const trail = planeTrails[i];
            this.transportModel.removePlaneTrail(trail);
            if (trail.userData?.isPlaneContrail) {
                if (trail.parent) trail.parent.remove(trail);
                trail.geometry?.dispose?.();
                trail.material?.dispose?.();
            } else {
                this._releaseSatTrailMesh(trail);
            }
        }
    }

    purgeBoatTrails() {
        const boats = this.transportModel.getBoats();
        for (let i = 0; i < boats.length; i++) {
            this.disposeBoatWake(boats[i]);
        }
        const boatTrails = this.transportModel.getBoatTrails();
        for (let i = boatTrails.length - 1; i >= 0; i--) {
            const trail = boatTrails[i];
            this.transportModel.removeBoatTrail(trail);
            if (trail.parent) trail.parent.remove(trail);
            trail.geometry?.dispose?.();
            trail.material?.dispose?.();
        }
    }

    updateHyperloopVisibility() {
        const scene = this.sceneModel.getScene();
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        const transportController = typeof window !== 'undefined' && window.globeController
            ? window.globeController.transportController
            : null;

        if (!hyperloopVisible) {
            this.purgePlaneTrails();
            this.purgeBoatTrails();
            if (transportController && typeof transportController.disposeDecorSatellites === 'function') {
                transportController.disposeDecorSatellites();
            }
        } else if (transportController && typeof transportController.ensureDecorSatellitesLoaded === 'function') {
            transportController.ensureDecorSatellitesLoaded();
        }
        const markers = this.sceneModel.getMarkers();
        const trains = this.transportModel.getTrains();
        const planes = this.transportModel.getPlanes();
        const boats = this.transportModel.getBoats();
        const boatTrails = this.transportModel.getBoatTrails();

        const boatRoutesOn = this.sceneModel.getBoatRoutesVisible?.()
            ? this.sceneModel.getBoatRoutesVisible()
            : !!this.sceneModel.boatRoutesVisible;
        const planeRoutesOn = this.sceneModel.getPlaneRoutesVisible?.()
            ? this.sceneModel.getPlaneRoutesVisible()
            : !!this.sceneModel.planeRoutesVisible;

        // Toggle markers visibility (but keep main event markers always visible)
        // Variant markers (pink) should maintain their current visibility state
        markers.forEach(marker => {
            if (marker.userData && marker.userData.isEventMarker) {
                // Only main variant markers should always be visible
                // Variant markers (isMainVariant === false) should keep their current state
                // (they're only visible when their event is open)
                if (marker.userData.isMainVariant !== false) {
                    marker.visible = true;
                }
                // If it's a variant marker (isMainVariant === false), don't change its visibility
                // Let WorldviewVariantMarkerLayer control it
            } else if (marker.userData && marker.userData.isSatelliteMarker) {
                // Reserved for future rocket UI; never show as purple dots (see WorldviewGlobeView.addSatelliteMarkers)
                marker.visible = false;
            } else if (marker.userData && marker.userData.isSeaportMarker) {
                marker.visible = boatRoutesOn;
            } else if (marker.userData && marker.userData.isAirportMarker) {
                marker.visible = planeRoutesOn;
            } else {
                marker.visible = hyperloopVisible;
            }
        });

        // Toggle connection lines and marker pins visibility
        scene.traverse((object) => {
            if (object.userData) {
                if (object.userData.isSeaportConnectionLine) {
                    object.visible = boatRoutesOn;
                } else if (object.userData.isPlaneRouteLine) {
                    object.visible = planeRoutesOn;
                } else if (
                    object.userData.isSeaportMarker ||
                    object.userData.isSeaportMarkerPin ||
                    object.userData.isBoatViaMarker
                ) {
                    object.visible = boatRoutesOn;
                } else if (
                    object.userData.isAirportMarker ||
                    object.userData.isAirportMarkerPin
                ) {
                    object.visible = planeRoutesOn;
                } else if (object.userData.isEventMarkerPin) {
                    object.visible = true;
                } else if (object.userData.isConnectionLine || object.userData.isSecondaryLine || object.userData.isMarkerPin) {
                    object.visible = hyperloopVisible;
                }
            }
        });
        
        // Toggle train visibility
        trains.forEach(train => {
            if (hyperloopVisible) {
                const data = train.userData;
                if (data && data.progress > 0 && data.progress <= 1 && !data.isWaiting) {
                    train.visible = true;
                }
            } else {
                train.visible = false;
            }
        });
        
        // Toggle plane visibility
        planes.forEach(plane => {
            if (hyperloopVisible) {
                const data = plane.userData;
                if (data && data.progress > 0 && data.progress <= 1) {
                    plane.visible = true;
                }
            } else {
                plane.visible = false;
            }
        });
        
        // Toggle boat visibility
        boats.forEach(boat => {
            if (hyperloopVisible) {
                const data = boat.userData;
                if (data && data.progress > 0 && data.progress <= 1 && !data.isWaiting) {
                    boat.visible = true;
                }
            } else {
                boat.visible = false;
            }
        });
        
        // Toggle boat trail visibility
        boatTrails.forEach(trail => {
            trail.visible = hyperloopVisible;
        });
        
        // Update all transport markers visibility (airports, train stations, seaports)
        this.updateAllTransportMarkersVisibility();
    }

    /**
     * Create a small dot trail for satellites, offset to the sides randomly
     * @param {THREE.Vector3} position - Position
     */
    createSatelliteTrailDot(position) {
        if (!this.sceneModel.getHyperloopVisible()) return;
        if (!getGlobeQualitySnapshot().trailsEnabled) return;

        const globe = this.sceneModel.getGlobe();
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        
        const randomAngle = Math.random() * Math.PI * 2;
        const offsetDistance = 0.01 + Math.random() * 0.015;
        const offsetX = Math.cos(randomAngle) * offsetDistance;
        const offsetY = Math.sin(randomAngle) * offsetDistance;
        const offsetZ = (Math.random() - 0.5) * offsetDistance * 0.5;
        
        const dot = this._acquireSatTrailMesh();
        dot.position.set(position.x + offsetX, position.y + offsetY, position.z + offsetZ);
        dot.visible = hyperloopVisible;
        if (globe) globe.add(dot);
        this.transportModel.addPlaneTrail(dot);
    }

    /**
     * Create airport markers for all airports
     * @param {Array} airports - Array of airport objects with lat/lon
     */
    createAirportMarkers(airports) {
        if (!airports || airports.length === 0) return;
        
        const globe = this.sceneModel.getGlobe();
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        
        // Remove existing airport markers first
        this.removeAirportMarkers();
        
        airports.forEach(airport => {
            // Create marker for globe view
            const globePosition = latLonToVector3(airport.lat, airport.lon, 1.008);
            const globeMarkerGeometry = new THREE.SphereGeometry(0.015, 16, 16);
            const globeMarkerMaterial = new THREE.MeshBasicMaterial({
                color: 0x00bfff, // Light blue for airports
                transparent: true,
                opacity: 0.9
            });
            const globeMarker = new THREE.Mesh(globeMarkerGeometry, globeMarkerMaterial);
            globeMarker.position.copy(globePosition);
            globeMarker.userData = { type: 'airport', name: airport.name };
            globeMarker.visible = hyperloopVisible && !isMapView;
            if (globe) globe.add(globeMarker);
            
            // Create marker for map view
            const mapPosition = latLonToMapPlanePosition(airport.lat, airport.lon, 2.0, 1.0, 0.008);
            const mapMarkerGeometry = new THREE.SphereGeometry(0.012, 16, 16);
            const mapMarkerMaterial = new THREE.MeshBasicMaterial({
                color: 0x00bfff, // Light blue for airports
                transparent: true,
                opacity: 0.9
            });
            const mapMarker = new THREE.Mesh(mapMarkerGeometry, mapMarkerMaterial);
            mapMarker.position.copy(mapPosition);
            mapMarker.userData = { type: 'airport', name: airport.name, isMapMarker: true };
            mapMarker.visible = false;
            if (globe) globe.add(mapMarker);
            
            this.airportMarkers.push({ globe: globeMarker, map: mapMarker, airport });
        });
        
        console.log(`✈️ Created ${this.airportMarkers.length} airport markers`);
    }

    /**
     * Remove all airport markers
     */
    removeAirportMarkers() {
        const globe = this.sceneModel.getGlobe();
        
        this.airportMarkers.forEach(({ globe: globeMarker, map: mapMarker }) => {
            if (globeMarker) {
                if (globeMarker.geometry) globeMarker.geometry.dispose();
                if (globeMarker.material) globeMarker.material.dispose();
                if (globe) globe.remove(globeMarker);
            }
            if (mapMarker) {
                if (mapMarker.geometry) mapMarker.geometry.dispose();
                if (mapMarker.material) mapMarker.material.dispose();
                if (globe) globe.remove(mapMarker);
            }
        });
        
        this.airportMarkers = [];
    }

    /**
     * Update airport marker visibility based on view mode and transport toggle
     */
    updateAirportMarkersVisibility() {
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        const planeRoutesOn = this.sceneModel.getPlaneRoutesVisible?.()
            ? this.sceneModel.getPlaneRoutesVisible()
            : !!this.sceneModel.planeRoutesVisible;

        this.airportMarkers.forEach(({ globe: globeMarker, map: mapMarker }) => {
            if (globeMarker) globeMarker.visible = planeRoutesOn && !isMapView;
            if (mapMarker) mapMarker.visible = false;
        });
    }

    /**
     * Create train station markers for all cities (train stations)
     * @param {Array} cities - Array of city objects with lat/lon
     */
    createTrainStationMarkers(cities) {
        if (!cities || cities.length === 0) return;
        
        const globe = this.sceneModel.getGlobe();
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        
        // Remove existing train station markers first
        this.removeTrainStationMarkers();
        
        cities.forEach(city => {
            // Create marker for globe view
            const globePosition = latLonToVector3(city.lat, city.lon, 1.008);
            const globeMarkerGeometry = new THREE.SphereGeometry(0.012, 16, 16);
            const globeMarkerMaterial = new THREE.MeshBasicMaterial({
                color: 0xff6600, // Orange for train stations
                transparent: true,
                opacity: 0.9
            });
            const globeMarker = new THREE.Mesh(globeMarkerGeometry, globeMarkerMaterial);
            globeMarker.position.copy(globePosition);
            globeMarker.userData = { type: 'trainStation', name: city.name };
            globeMarker.visible = hyperloopVisible && !isMapView;
            if (globe) globe.add(globeMarker);
            
            // Create marker for map view
            const mapPosition = latLonToMapPlanePosition(city.lat, city.lon, 2.0, 1.0, 0.008);
            const mapMarkerGeometry = new THREE.SphereGeometry(0.010, 16, 16);
            const mapMarkerMaterial = new THREE.MeshBasicMaterial({
                color: 0xff6600, // Orange for train stations
                transparent: true,
                opacity: 0.9
            });
            const mapMarker = new THREE.Mesh(mapMarkerGeometry, mapMarkerMaterial);
            mapMarker.position.copy(mapPosition);
            mapMarker.userData = { type: 'trainStation', name: city.name, isMapMarker: true };
            mapMarker.visible = false;
            if (globe) globe.add(mapMarker);
            
            this.trainStationMarkers.push({ globe: globeMarker, map: mapMarker, city });
        });
        
        console.log(`🚂 Created ${this.trainStationMarkers.length} train station markers`);
    }

    /**
     * Remove all train station markers
     */
    removeTrainStationMarkers() {
        const globe = this.sceneModel.getGlobe();
        
        this.trainStationMarkers.forEach(({ globe: globeMarker, map: mapMarker }) => {
            if (globeMarker) {
                if (globeMarker.geometry) globeMarker.geometry.dispose();
                if (globeMarker.material) globeMarker.material.dispose();
                if (globe) globe.remove(globeMarker);
            }
            if (mapMarker) {
                if (mapMarker.geometry) mapMarker.geometry.dispose();
                if (mapMarker.material) mapMarker.material.dispose();
                if (globe) globe.remove(mapMarker);
            }
        });
        
        this.trainStationMarkers = [];
    }

    /**
     * Update train station marker visibility based on view mode and transport toggle
     */
    updateTrainStationMarkersVisibility() {
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        
        this.trainStationMarkers.forEach(({ globe: globeMarker, map: mapMarker }) => {
            if (globeMarker) globeMarker.visible = hyperloopVisible && !isMapView;
            if (mapMarker) mapMarker.visible = false;
        });
    }

    /**
     * Create seaport markers for all seaports
     * @param {Array} seaports - Array of seaport objects with lat/lon
     */
    createSeaportMarkers(seaports) {
        if (!seaports || seaports.length === 0) return;
        
        const globe = this.sceneModel.getGlobe();
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        const hyperloopVisible = this.sceneModel.getHyperloopVisible();
        
        // Remove existing seaport markers first
        this.removeSeaportMarkers();
        
        seaports.forEach(seaport => {
            // Create marker for globe view
            const globePosition = latLonToVector3(seaport.lat, seaport.lon, 1.008);
            const globeMarkerGeometry = new THREE.SphereGeometry(0.012, 16, 16);
            const globeMarkerMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ff88, // Teal/green for seaports
                transparent: true,
                opacity: 0.9
            });
            const globeMarker = new THREE.Mesh(globeMarkerGeometry, globeMarkerMaterial);
            globeMarker.position.copy(globePosition);
            globeMarker.userData = { type: 'seaport', name: seaport.name };
            globeMarker.visible = hyperloopVisible && !isMapView;
            if (globe) globe.add(globeMarker);
            
            // Create marker for map view
            const mapPosition = latLonToMapPlanePosition(seaport.lat, seaport.lon, 2.0, 1.0, 0.008);
            const mapMarkerGeometry = new THREE.SphereGeometry(0.010, 16, 16);
            const mapMarkerMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ff88, // Teal/green for seaports
                transparent: true,
                opacity: 0.9
            });
            const mapMarker = new THREE.Mesh(mapMarkerGeometry, mapMarkerMaterial);
            mapMarker.position.copy(mapPosition);
            mapMarker.userData = { type: 'seaport', name: seaport.name, isMapMarker: true };
            mapMarker.visible = false;
            if (globe) globe.add(mapMarker);
            
            this.seaportMarkers.push({ globe: globeMarker, map: mapMarker, seaport });
        });
        
        console.log(`⚓ Created ${this.seaportMarkers.length} seaport markers`);
    }

    /**
     * Remove all seaport markers
     */
    removeSeaportMarkers() {
        const globe = this.sceneModel.getGlobe();
        
        this.seaportMarkers.forEach(({ globe: globeMarker, map: mapMarker }) => {
            if (globeMarker) {
                if (globeMarker.geometry) globeMarker.geometry.dispose();
                if (globeMarker.material) globeMarker.material.dispose();
                if (globe) globe.remove(globeMarker);
            }
            if (mapMarker) {
                if (mapMarker.geometry) mapMarker.geometry.dispose();
                if (mapMarker.material) mapMarker.material.dispose();
                if (globe) globe.remove(mapMarker);
            }
        });
        
        this.seaportMarkers = [];
    }

    /**
     * Update seaport marker visibility based on view mode and transport toggle
     */
    updateSeaportMarkersVisibility() {
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        const boatRoutesOn = this.sceneModel.getBoatRoutesVisible?.()
            ? this.sceneModel.getBoatRoutesVisible()
            : !!this.sceneModel.boatRoutesVisible;

        this.seaportMarkers.forEach(({ globe: globeMarker, map: mapMarker }) => {
            if (globeMarker) globeMarker.visible = boatRoutesOn && !isMapView;
            if (mapMarker) mapMarker.visible = false;
        });
    }

    /**
     * Update all transport marker visibility (airports, train stations, seaports)
     */
    updateAllTransportMarkersVisibility() {
        this.updateAirportMarkersVisibility();
        this.updateTrainStationMarkersVisibility();
        this.updateSeaportMarkersVisibility();
    }
}
