/**
 * Starfield, shooting stars, and sky/lighting visibility for {@link WorldviewGlobeView}.
 */
import { loadTexture } from '../helpers/WorldviewGlobeTextures.js';

const MISC_STAR_PNG = 'src/assets/images/Misc/Celestial%20Panels/Star.png';

export const mixin = {
    _pickStarGlowColor(opts = {}) {
        const palettes = [
            [1.0, 0.88, 0.35],
            [0.34, 0.95, 0.52],
            [0.38, 0.74, 1.0],
            [1.0, 1.0, 1.0],
            [0.68, 0.4, 0.98]
        ];
        const p = palettes[(Math.random() * palettes.length) | 0];
        const strength = Math.random();
        if (opts.forSpritePoints) {
            const t = strength;
            const k = 0.92;
            return {
                r: 1 + (p[0] - 1) * t * k,
                g: 1 + (p[1] - 1) * t * k,
                b: 1 + (p[2] - 1) * t * k,
                strength
            };
        }
        const core = 0.08;
        return {
            r: core + (p[0] - core) * strength,
            g: core + (p[1] - core) * strength,
            b: core + (p[2] - core) * strength,
            strength
        };
    },

    _createStarShellAttributes(count, opts = {}) {
        const positions = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const colors = new Float32Array(count * 3);
        const forSprite = opts.forSpritePoints === true;
        for (let i = 0; i < count; i++) {
            const radius = 50 + Math.random() * 50;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);

            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);

            const glow = this._pickStarGlowColor(forSprite ? { forSpritePoints: true } : {});
            const sizeSpread = Math.random() * 2.5 + 0.5;
            sizes[i] = forSprite
                ? sizeSpread * (0.92 + 0.35 * glow.strength)
                : sizeSpread * (0.78 + 0.42 * glow.strength);

            colors[i * 3] = glow.r;
            colors[i * 3 + 1] = glow.g;
            colors[i * 3 + 2] = glow.b;
        }
        return { positions, sizes, colors };
    },

    _ensureMiscStarPng() {
        if (!this._miscStarPngPromise) {
            this._miscStarPngPromise = new Promise((resolve) => {
                const renderer = this.sceneModel.getRenderer();
                const textureLoader = new THREE.TextureLoader();
                if (renderer) {
                    loadTexture(
                        textureLoader,
                        MISC_STAR_PNG,
                        renderer,
                        (tex) => resolve(tex),
                        () => resolve(null)
                    );
                } else {
                    textureLoader.load(
                        MISC_STAR_PNG,
                        (tex) => {
                            tex.minFilter = THREE.LinearFilter;
                            tex.magFilter = THREE.LinearFilter;
                            tex.generateMipmaps = false;
                            resolve(tex);
                        },
                        undefined,
                        () => resolve(null)
                    );
                }
            });
        }
        return this._miscStarPngPromise;
    },

    addStarfield() {
        const scene = this.sceneModel.getScene();
        if (!scene) return;

        const starCount = 2000;
        const texturedFraction = 0.3;
        const texturedCount = Math.round(starCount * texturedFraction);
        const classicCount = Math.max(0, starCount - texturedCount);

        const cl = this._createStarShellAttributes(classicCount);
        const classicGeom = new THREE.BufferGeometry();
        classicGeom.setAttribute('position', new THREE.BufferAttribute(cl.positions, 3));
        classicGeom.setAttribute('size', new THREE.BufferAttribute(cl.sizes, 1));
        classicGeom.setAttribute('color', new THREE.BufferAttribute(cl.colors, 3));

        const classicBaseOp = 0.8;
        const classicMat = new THREE.PointsMaterial({
            size: 0.15,
            vertexColors: true,
            transparent: true,
            opacity: classicBaseOp,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending
        });
        classicMat.userData.baseOpacity = classicBaseOp;

        const classicPoints = new THREE.Points(classicGeom, classicMat);
        classicPoints.name = 'starfield-classic';

        const starFieldGroup = new THREE.Group();
        starFieldGroup.name = 'starfield';
        starFieldGroup.userData.starfieldMats = { classic: classicMat, textured: null };
        starFieldGroup.add(classicPoints);
        scene.add(starFieldGroup);
        this.sceneModel.setStars(starFieldGroup);

        if (texturedCount <= 0) return;

        this._ensureMiscStarPng().then((tex) => {
            if (!tex) return;
            if (starFieldGroup.userData.starPngLayerAdded) return;
            starFieldGroup.userData.starPngLayerAdded = true;

            const tg = this._createStarShellAttributes(texturedCount, { forSpritePoints: true });
            const texturedGeom = new THREE.BufferGeometry();
            texturedGeom.setAttribute('position', new THREE.BufferAttribute(tg.positions, 3));
            texturedGeom.setAttribute('size', new THREE.BufferAttribute(tg.sizes, 1));
            texturedGeom.setAttribute('color', new THREE.BufferAttribute(tg.colors, 3));

            const texturedBaseOp = 0.78;
            const texturedMat = new THREE.PointsMaterial({
                map: tex,
                // Larger than classic points so Star.png reads as a shape (PointsMaterial ignores per-vertex size).
                size: 0.62,
                vertexColors: true,
                transparent: true,
                opacity: texturedBaseOp,
                sizeAttenuation: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                alphaTest: 0.01
            });
            texturedMat.userData.baseOpacity = texturedBaseOp;

            const texturedPoints = new THREE.Points(texturedGeom, texturedMat);
            texturedPoints.name = 'starfield-textured';
            texturedPoints.renderOrder = 1;
            starFieldGroup.add(texturedPoints);
            if (starFieldGroup.userData.starfieldMats) {
                starFieldGroup.userData.starfieldMats.textured = texturedMat;
            }
        });
    },

    setGlobeSkyVisible(visible) {
        const v = !!visible;
        const stars = this.sceneModel.getStars();
        if (stars) {
            stars.visible = v;
        }
        const sunBg = this.sceneModel.getSunBackground();
        if (sunBg) {
            if (sunBg.sprite) sunBg.sprite.visible = v;
            if (sunBg.light) sunBg.light.visible = v;
        }
        const earthAmb = this.sceneModel.earthAmbientLayer1;
        if (earthAmb) {
            earthAmb.intensity = v ? 0.002 : 0.72;
        }
    },

    setGlobeLightingVisible(visible) {
        const v = !!visible;
        // 1. Sun background (sprite + light source)
        const sunBg = this.sceneModel.getSunBackground();
        if (sunBg) {
            if (sunBg.sprite) {
                sunBg.sprite.visible = v;
            }
            if (sunBg.light) {
                sunBg.light.visible = v;
            }
        }

        // 2. City lights dots
        if (this._earthCityLights) {
            this._earthCityLights.visible = v;
        }
        if (this._earthCityAccentLights) {
            this._earthCityAccentLights.forEach(light => {
                light.visible = v;
            });
        }

        // 3. Earth ambient contrast (if sun is off, we need more ambient light to see globe)
        const earthAmb = this.sceneModel.earthAmbientLayer1;
        if (earthAmb) {
            earthAmb.intensity = v ? 0.002 : 0.72;
        }

        // 4. Pattern overlay: disable sun shading when lighting is off so wave is visible everywhere
        if (this._globePatternOverlay && this._globePatternOverlay.material && this._globePatternOverlay.material.uniforms) {
            this._globePatternOverlay.material.uniforms.uShadeBySun.value = v ? 1.0 : 0.0;
        }
    },

    configureMapViewPresentation(mapEnabled) {
        const mapOn = !!mapEnabled;
        if (this._globePatternOverlay) this._globePatternOverlay.visible = !mapOn;
        if (this._cloudLayer) this._cloudLayer.visible = !mapOn;
        if (this._auroraMesh) this._auroraMesh.visible = !mapOn;
    },

    addShootingStars() {
        const scene = this.sceneModel.getScene();
        if (!scene) return;
        if (this._shootingStars._poolBuilt) return;
        this._shootingStars._poolBuilt = true;

        this._ensureMiscStarPng().then((tex) => {
            if (!tex) {
                console.warn('Shooting star texture not available, using solid fallback head.');
            }
            this._createShootingStarsGroup(tex || null);
        });
    },

    _createShootingStarsGroup(mapTexture) {
        if (this._shootingStars.group) return;
        const scene = this.sceneModel.getScene();
        if (!scene) return;

        const group = new THREE.Group();
        group.name = 'shooting-stars';
        group.renderOrder = -10;

        const isMobile = window.innerWidth <= 768;
        const poolSize = isMobile ? 4 : 6;
        this._shootingStars.maxActive = poolSize;
        const trailPointCount = isMobile ? 14 : 22;

        const makeStar = () => {
            const lineGeom = new THREE.BufferGeometry();
            const arr = new Float32Array(trailPointCount * 3);
            lineGeom.setAttribute('position', new THREE.BufferAttribute(arr, 3));
            const lineMat = new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                depthTest: true
            });
            const line = new THREE.Line(lineGeom, lineMat);
            line.visible = false;
            line.frustumCulled = false;
            line.renderOrder = -10;
            group.add(line);

            const headGeom = new THREE.PlaneGeometry(1, 1);
            const headMat = new THREE.MeshBasicMaterial({
                map: mapTexture || null,
                color: 0xffffff,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                depthTest: true,
                side: THREE.DoubleSide
            });
            if (!mapTexture) {
                headMat.color.setRGB(0.78, 0.9, 1.0);
            }
            const headMesh = new THREE.Mesh(headGeom, headMat);
            headMesh.visible = false;
            headMesh.frustumCulled = false;
            headMesh.renderOrder = -9;
            group.add(headMesh);

            const trailPts = [];
            for (let i = 0; i < trailPointCount; i++) {
                trailPts.push(new THREE.Vector3());
            }
            return {
                line,
                lineGeom,
                lineMat,
                trailPointCount,
                trailPts,
                headMesh,
                headMat,
                active: false,
                age: 0,
                duration: 1,
                speed: 20,
                head: new THREE.Vector3(),
                dir: new THREE.Vector3(),
                curvatureRadPerSec: 0,
                curvatureDriftRadPerSec2: 0,
                spinAngle: 0,
                spinRadPerSec: 6,
                baseScale: 0.65,
                glowStrength: 1
            };
        };

        for (let i = 0; i < poolSize; i++) {
            this._shootingStars.pool.push(makeStar());
        }

        this._shootingStars.nextSpawnSec = isMobile
            ? (8 + Math.random() * 8)
            : (3 + Math.random() * 4);

        this._shootingStars.group = group;
        scene.add(group);
        if (typeof this.sceneModel.getGlobeWeatherEffectsVisible === 'function'
            && !this.sceneModel.getGlobeWeatherEffectsVisible()) {
            group.visible = false;
        }
    },

    _spawnShootingStar() {
        const camera = this.sceneModel.getCamera();
        if (!camera) return;
        if (!this._shootingStars.group || this._shootingStars.pool.length === 0) return;

        // Find an inactive slot
        const star = this._shootingStars.pool.find(s => !s.active);
        if (!star) return;

        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        camDir.normalize();

        const mapView = this.sceneModel.getMapViewEnabled
            ? this.sceneModel.getMapViewEnabled()
            : !!this.sceneModel.isMapView;

        // Globe: sky cap = from camera toward world origin (matches starfield shell). Map: use view axis (lookAt is not toward origin).
        let spawnBase;
        if (mapView) {
            spawnBase = camDir.clone();
        } else {
            spawnBase = camera.position.clone();
            if (spawnBase.lengthSq() < 1e-8) return;
            spawnBase.normalize().negate();
        }

        // Build a screen-plane basis (right/up) from view direction for streak motion and spread.
        const worldUp = new THREE.Vector3(0, 1, 0);
        let right = new THREE.Vector3().crossVectors(camDir, worldUp);
        if (right.lengthSq() < 1e-6) {
            right = new THREE.Vector3(1, 0, 0);
        } else {
            right.normalize();
        }
        const up = new THREE.Vector3().crossVectors(right, camDir).normalize();

        // Spawn on the shell facing the camera (behind the globe), with small angular spread.
        const spread = 0.35;
        const spawnDir = spawnBase.clone()
            .addScaledVector(right, (Math.random() * 2 - 1) * spread)
            .addScaledVector(up, (Math.random() * 2 - 1) * spread)
            .normalize();

        const radius = 70 + Math.random() * 25;
        star.head.copy(spawnDir).multiplyScalar(radius);

        // Movement direction: across the screen plane.
        const ang = Math.random() * Math.PI * 2;
        star.dir.copy(right).multiplyScalar(Math.cos(ang)).addScaledVector(up, Math.sin(ang)).normalize();

        // Parameters
        star.active = true;
        star.age = 0;
        star.duration = 0.7 + Math.random() * 0.7;
        star.speed = 18 + Math.random() * 18;

        for (let i = 0; i < star.trailPointCount; i++) {
            star.trailPts[i].copy(star.head);
        }

        // Gentle in-view-plane bend only (see updateShootingStars: rotate around view axis).
        const curveMag = 0.18 + Math.random() * 0.55;
        star.curvatureRadPerSec = (Math.random() < 0.5 ? -1 : 1) * curveMag;
        star.curvatureDriftRadPerSec2 = (Math.random() * 2 - 1) * 0.35;

        const isMobile = window.innerWidth <= 768;
        star.baseScale = (isMobile ? 0.4 : 0.5) + Math.random() * 0.22;

        const glow = this._pickStarGlowColor();
        star.glowStrength = glow.strength;
        star.lineMat.color.setRGB(glow.r, glow.g, glow.b);
        star.headMat.color.setRGB(glow.r, glow.g, glow.b);
        const headMul = 0.9 + 0.32 * glow.strength;
        star.headMesh.scale.setScalar(star.baseScale * headMul);

        star.spinAngle = Math.random() * Math.PI * 2;
        star.spinRadPerSec = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 9);

        star.line.visible = true;
        star.headMesh.visible = true;
        star.lineMat.opacity = 0.001;
        star.headMat.opacity = 0.001;
        this._updateShootingStarGeometry(star, 0.001);
    },

    _updateShootingStarGeometry(star, alpha) {
        const pos = star.lineGeom.attributes.position.array;
        const n = star.trailPointCount;
        for (let i = 0; i < n; i++) {
            const p = star.trailPts[i];
            pos[i * 3] = p.x;
            pos[i * 3 + 1] = p.y;
            pos[i * 3 + 2] = p.z;
        }
        star.lineGeom.attributes.position.needsUpdate = true;
        const g = typeof star.glowStrength === 'number' ? star.glowStrength : 1;
        star.lineMat.opacity = alpha;
        // Slightly brighter head when glow is strong (additive read)
        star.headMat.opacity = alpha * (0.78 + 0.22 * g);
    },

    updateShootingStars(deltaSec) {
        // Respect page visibility (prevents "catch-up" spawns)
        if (this.sceneModel && this.sceneModel.isPageVisible === false) return;
        if (this.sceneModel && typeof this.sceneModel.getGlobeWeatherEffectsVisible === 'function'
            && !this.sceneModel.getGlobeWeatherEffectsVisible()) {
            return;
        }

        const mapView = this.sceneModel.getMapViewEnabled
            ? this.sceneModel.getMapViewEnabled()
            : !!this.sceneModel.isMapView;
        if (mapView) {
            if (this._shootingStars.group) this._shootingStars.group.visible = false;
            for (const s of this._shootingStars.pool) {
                if (!s.active) continue;
                s.active = false;
                s.line.visible = false;
                s.headMesh.visible = false;
                s.lineMat.opacity = 0;
                s.headMat.opacity = 0;
            }
            return;
        }
        if (this._shootingStars.group) this._shootingStars.group.visible = true;

        if (!this._shootingStars.group) return;
        const dt = Number.isFinite(deltaSec) ? Math.max(0, deltaSec) : 0;
        if (dt <= 0) return;

        const camera = this.sceneModel.getCamera();
        const camDir = this._ssCamDir;
        const bendQuat = this._ssBendQuat;

        // Update active stars
        for (const s of this._shootingStars.pool) {
            if (!s.active) continue;
            s.age += dt;
            const t = s.age / s.duration;
            if (t >= 1) {
                s.active = false;
                s.line.visible = false;
                s.headMesh.visible = false;
                s.lineMat.opacity = 0;
                s.headMat.opacity = 0;
                continue;
            }

            // 2D parabolic arcs in the image plane: velocity stays ⟂ view (no in/out of screen).
            // Bend by rotating dir around the camera view axis only (screen-plane parabola, slight curve).
            if (camera) {
                camera.getWorldDirection(camDir);

                let along = s.dir.dot(camDir);
                if (Math.abs(along) > 1e-6) {
                    s.dir.addScaledVector(camDir, -along);
                    s.dir.normalize();
                }

                s.curvatureRadPerSec += s.curvatureDriftRadPerSec2 * dt;
                s.curvatureRadPerSec = Math.max(-1.35, Math.min(1.35, s.curvatureRadPerSec));

                const bend = s.curvatureRadPerSec * dt;
                bendQuat.setFromAxisAngle(camDir, bend);
                s.dir.applyQuaternion(bendQuat);
                s.dir.normalize();

                along = s.dir.dot(camDir);
                if (Math.abs(along) > 1e-6) {
                    s.dir.addScaledVector(camDir, -along);
                    s.dir.normalize();
                }
            }

            s.head.addScaledVector(s.dir, s.speed * dt);

            const pts = s.trailPts;
            const n = s.trailPointCount;
            for (let i = 0; i < n - 1; i++) {
                pts[i].copy(pts[i + 1]);
            }
            pts[n - 1].copy(s.head);

            s.spinAngle += s.spinRadPerSec * dt;

            let a = 1;
            if (t < 0.12) {
                a = t / 0.12;
            } else {
                a = Math.pow(1 - t, 1.15);
            }
            const alpha = 0.85 * a;

            if (s.head.length() > 140) {
                s.active = false;
                s.line.visible = false;
                s.headMesh.visible = false;
                s.lineMat.opacity = 0;
                s.headMat.opacity = 0;
                continue;
            }

            s.headMesh.position.copy(s.head);
            if (camera) {
                s.headMesh.lookAt(camera.position);
                s.headMesh.rotateZ(s.spinAngle);
            }
            this._updateShootingStarGeometry(s, alpha);
        }

        // Spawn timer
        this._shootingStars.nextSpawnSec -= dt;
        if (this._shootingStars.nextSpawnSec <= 0) {
            // Keep at most N active
            const activeCount = this._shootingStars.pool.reduce((n, s) => n + (s.active ? 1 : 0), 0);
            if (activeCount < this._shootingStars.maxActive) {
                this._spawnShootingStar();
            }

            const isMobile = window.innerWidth <= 768;
            this._shootingStars.nextSpawnSec = isMobile
                ? (8 + Math.random() * 10)
                : (3 + Math.random() * 7);
        }
    },

};
