/**
 * @see src/features/world/worldview-controls-ui/runtime/WorldviewMarkerPulseRingsMixin.js
 */
(function (global) {
    const EVENT_PULSE_RING_RENDER_ORDER = 17;
    const FLAT_MAP_PULSE_RING_RENDER_ORDER = 12;

    function useOrbitPanelForStationShipMarkers(sceneModel) {
        if (!sceneModel) return false;
        const isMap = sceneModel.getMapViewEnabled?.() ? sceneModel.getMapViewEnabled() : !!sceneModel.isMapView;
        const hyper = sceneModel.getHyperloopVisible?.() ?? true;
        return isMap || !hyper;
    }

    global.WorldviewMarkerPulseRingsMixin = {
    createPulseRing(marker) {
        const globe = this.sceneModel.getGlobe();
        if (!globe) return;
        const waveColorHex = this._getPulseWaveColorHex(marker);
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        
        // Determine parent (globe, moonPlane, or marsPlane)
        const locationType = marker.userData ? marker.userData.locationType : 'earth';
        const moonPlane = this.sceneModel.getMoonPlane ? this.sceneModel.getMoonPlane() : this.sceneModel.moonPlane;
        const marsPlane = this.sceneModel.getMarsPlane ? this.sceneModel.getMarsPlane() : this.sceneModel.marsPlane;
        const moonMarkerParent = this.sceneModel.getMoonMarkerParent ? this.sceneModel.getMoonMarkerParent() : moonPlane;
        const marsMarkerParent = this.sceneModel.getMarsMarkerParent ? this.sceneModel.getMarsMarkerParent() : marsPlane;
        const orbitPlane = this.sceneModel.getOrbitPlane ? this.sceneModel.getOrbitPlane() : this.sceneModel.orbitPlane;
        const orbitMarkerParent = this.sceneModel.getOrbitMarkerParent ? this.sceneModel.getOrbitMarkerParent() : orbitPlane;
        const scene = this.sceneModel.getScene ? this.sceneModel.getScene() : null;
        
        // Get ISS satellite for station events
        const issSatellite = window.globeController && window.globeController.transportController 
            ? window.globeController.transportController.findISS() 
            : null;
        const marsShipSatellite = window.globeController && window.globeController.transportController
            ? window.globeController.transportController.findMarsShip?.()
            : null;
        
        let ringParent = globe; // Default to globe
        if (locationType === 'moon' && moonMarkerParent && marker.parent === moonMarkerParent) {
            ringParent = moonMarkerParent;
        } else if (locationType === 'mars' && marsMarkerParent && marker.parent === marsMarkerParent) {
            ringParent = marsMarkerParent;
        } else if (locationType === 'station' && issSatellite && marker.parent === issSatellite) {
            ringParent = issSatellite;
        } else if (locationType === 'marsShip' && marsShipSatellite && marker.parent === marsShipSatellite) {
            ringParent = marsShipSatellite;
        } else if (
            (locationType === 'station' || locationType === 'marsShip')
            && orbitMarkerParent
            && marker.parent === orbitMarkerParent
        ) {
            ringParent = orbitMarkerParent;
        }

        // Unwrapped map mode: for Moon/Mars/Station, render rings in world space (scene) to avoid inheriting
        // parent rotation or squash/stretch scaling that causes the 1-frame "snap" after page flips.
        if (isMapView && (locationType === 'moon' || locationType === 'mars' || locationType === 'station' || locationType === 'marsShip') && scene) {
            ringParent = scene;
        }
        
        const isAwakening = this.isAwakeningEventMarker(marker);
        if (isAwakening && isMapView && scene) {
            // In map view we want a screen-aligned, map-wide wave.
            ringParent = scene;
        }

        // Special case: "The Awakening" in globe mode should wrap across the sphere surface.
        // We render a thin sphere "shell" over the globe and animate angular radius in shader.
        if (isAwakening && !isMapView && locationType === 'earth') {
            const sphereRadius = 1.012;
            const geometry = new THREE.SphereGeometry(sphereRadius, 64, 64);
            const centerDir = marker.position.clone().normalize();

            const material = new THREE.ShaderMaterial({
                uniforms: {
                    uCenter: { value: centerDir },
                    uRadius: { value: 0.0 }, // radians, expands to PI
                    // Keep edge mostly crisp like the normal filled-circle wave,
                    // just enough smoothing to avoid aliasing on the sphere.
                    uFeather: { value: 0.008 }, // radians
                    uOpacity: { value: 0.9 },
                    uColor: { value: new THREE.Color(waveColorHex) }
                },
                transparent: true,
                depthTest: true,
                depthWrite: false,
                side: THREE.FrontSide,
                blending: THREE.NormalBlending,
                vertexShader: `
                    varying vec3 vDir;
                    void main() {
                        vDir = normalize(position);
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform vec3 uCenter;
                    uniform float uRadius;
                    uniform float uFeather;
                    uniform float uOpacity;
                    uniform vec3 uColor;
                    varying vec3 vDir;
                    void main() {
                        float d = acos(clamp(dot(normalize(vDir), normalize(uCenter)), -1.0, 1.0));
                        float inside = 1.0 - smoothstep(uRadius, uRadius + uFeather, d);
                        float a = inside * uOpacity;
                        if (a <= 0.001) discard;
                        gl_FragColor = vec4(uColor, a);
                    }
                `
            });

            const ring = new THREE.Mesh(geometry, material);
            ring.renderOrder = 999;
            ring.userData.isPulseRing = true;
            ring.userData.isAwakeningSphereWave = true;
            ring.userData.startTime = Date.now();
            ring.userData.duration = 2600;
            ring.userData.marker = marker;

            // Let scheduling know how long this marker's wave runs.
            marker.userData.pulseWaveDurationMs = ring.userData.duration;

            this.updateRingPositionAndOrientation(ring, marker);
            ringParent.add(ring);
            marker.userData.pulseRings.push(ring);

            if (window.SoundEffectsManager) {
                window.SoundEffectsManager.play('radiate');
            }
            return;
        }

        // Default: filled circle geometry (not a ring)
        let baseRadius = 0.02;
        if (marker.userData?.isFlatMapEventMarker && marker.geometry?.parameters?.radius != null) {
            const r = marker.geometry.parameters.radius;
            const sx = marker.scale?.x ?? 1;
            baseRadius = Math.max(0.006, r * sx);
        }
        const isFlatMapPulse =
            isMapView &&
            !isAwakening &&
            (
                marker.userData?.isFlatMapEventMarker ||
                locationType === 'moon' ||
                locationType === 'mars' ||
                locationType === 'station' ||
                locationType === 'marsShip'
            );
        // For map-wide waves we need more segments so the edge stays smooth when scaled up.
        const circleSegments = (isAwakening && isMapView) ? 192 : 32;
        const circleGeometry = new THREE.CircleGeometry(baseRadius, circleSegments);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: waveColorHex,
            transparent: true,
            opacity: 0.9, // Start more opaque in center
            side: THREE.DoubleSide,
            depthWrite: isAwakening ? false : !isFlatMapPulse,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2
        });
        
        const ring = new THREE.Mesh(circleGeometry, ringMaterial);
        if (isAwakening) {
            ring.renderOrder = 999;
        } else if (isFlatMapPulse) {
            ring.renderOrder = FLAT_MAP_PULSE_RING_RENDER_ORDER;
        } else {
            ring.renderOrder = EVENT_PULSE_RING_RENDER_ORDER;
        }
        
        // Store initial properties
        ring.userData.isPulseRing = true;
        ring.userData.startTime = Date.now();
        ring.userData.startScale = 1;
        ring.userData.maxScale = 5.2; // default wave expansion
        ring.userData.duration = 1200; // default wave speed
        ring.userData.marker = marker;

        // Special case: "The Awakening" should be map-wide (cover the whole map/globe) and repeat.
        if (isAwakening) {
            // Longer, slower wave so the map-wide expansion reads clearly.
            ring.userData.duration = 2600;

            let targetWorldRadius = 2.5; // sensible default for globe view

            // Map view: cover the entire Earth map plane (diagonal/2), taking plane scaling into account.
            if (isMapView) {
                // Prefer viewport-based radius so the wave fills the whole visible unwrapped map.
                const markerWorldPos = new THREE.Vector3();
                marker.getWorldPosition(markerWorldPos);
                const viewportRadius = this.getMapViewViewportRadiusAtWorldPoint(markerWorldPos);
                if (Number.isFinite(viewportRadius) && viewportRadius > 0) {
                    targetWorldRadius = viewportRadius * 1.18; // overshoot corners so it fully covers before vanishing
                } else {
                    targetWorldRadius = 3.5;
                }
            }

            ring.userData.maxScale = Math.max(5.2, targetWorldRadius / baseRadius);
        }

        // Let scheduling know how long this marker's wave runs.
        marker.userData.pulseWaveDurationMs = ring.userData.duration;
        
        // Position and orient the ring (will be updated in updatePulseRings)
        this.updateRingPositionAndOrientation(ring, marker);
        
        ringParent.add(ring);
        marker.userData.pulseRings.push(ring);
        
        // Play radiate sound effect when pulse ring is created
        if (window.SoundEffectsManager) {
            window.SoundEffectsManager.play('radiate');
        }
    },

    updateRingPositionAndOrientation(ring, marker) {
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        const isAwakening = this.isAwakeningEventMarker(marker);

        if (ring?.userData?.isAwakeningSphereWave) {
            ring.position.set(0, 0, 0);
            ring.quaternion.identity();
            return;
        }

        // Special case: "The Awakening" wave should expand across the view (billboard) in map view only.
        if (isAwakening && isMapView) {
            const markerWorldPos = new THREE.Vector3();
            marker.getWorldPosition(markerWorldPos);
            ring.position.copy(markerWorldPos);

            const camera = this.sceneModel.getCamera ? this.sceneModel.getCamera() : null;
            if (camera?.quaternion) {
                ring.quaternion.copy(camera.quaternion);
            } else {
                ring.quaternion.identity();
            }
            return;
        }
        
        // Check if marker is on Moon/Mars plane or Earth globe
        const locationType = marker.userData ? marker.userData.locationType : 'earth';
        const moonPlane = this.sceneModel.getMoonPlane ? this.sceneModel.getMoonPlane() : this.sceneModel.moonPlane;
        const marsPlane = this.sceneModel.getMarsPlane ? this.sceneModel.getMarsPlane() : this.sceneModel.marsPlane;
        const moonMarkerParent = this.sceneModel.getMoonMarkerParent ? this.sceneModel.getMoonMarkerParent() : moonPlane;
        const marsMarkerParent = this.sceneModel.getMarsMarkerParent ? this.sceneModel.getMarsMarkerParent() : marsPlane;
        const orbitPlane = this.sceneModel.getOrbitPlane ? this.sceneModel.getOrbitPlane() : this.sceneModel.orbitPlane;
        const orbitMarkerParent = this.sceneModel.getOrbitMarkerParent ? this.sceneModel.getOrbitMarkerParent() : orbitPlane;

        // Get ISS satellite for station events
        const issSatellite = window.globeController && window.globeController.transportController 
            ? window.globeController.transportController.findISS() 
            : null;
        const marsShipSatellite = window.globeController && window.globeController.transportController
            ? window.globeController.transportController.findMarsShip?.()
            : null;

        // Unwrapped map mode: rings parented to scene. Moon/Mars markers use non-uniform Y scale on the rig
        // (panel squash compensation) — matrixWorld.decompose() rotation does not match the disk plane and
        // shifts the wave. Center = marker world position; orientation = celestial texture plane (same basis
        // as the flat dot).
        if (isMapView && (locationType === 'moon' || locationType === 'mars')) {
            marker.getWorldPosition(ring.position);
            const surface = locationType === 'moon' ? moonPlane : marsPlane;
            if (surface) {
                surface.updateMatrixWorld(true);
                surface.getWorldQuaternion(this._scratchWorldQuat);
            } else {
                this._scratchWorldQuat.identity();
            }
            ring.quaternion.copy(this._scratchWorldQuat);
            ring.rotateZ(Math.PI / 2);
            this._scratchWorldNormal.set(0, 0, 1).applyQuaternion(this._scratchWorldQuat).normalize();
            const camera = this.sceneModel.getCamera ? this.sceneModel.getCamera() : null;
            if (camera) {
                this._scratchVec3.copy(camera.position).sub(ring.position);
                if (this._scratchWorldNormal.dot(this._scratchVec3) < 0) {
                    this._scratchWorldNormal.negate();
                }
            }
            ring.position.addScaledVector(this._scratchWorldNormal, 0.003);
            return;
        }
        if (
            isMapView
            && (locationType === 'station' || locationType === 'marsShip')
            && useOrbitPanelForStationShipMarkers(this.sceneModel)
        ) {
            marker.getWorldPosition(ring.position);
            const surface = orbitPlane;
            if (surface) {
                surface.updateMatrixWorld(true);
                surface.getWorldQuaternion(this._scratchWorldQuat);
            } else {
                this._scratchWorldQuat.identity();
            }
            ring.quaternion.copy(this._scratchWorldQuat);
            ring.rotateZ(Math.PI / 2);
            this._scratchWorldNormal.set(0, 0, 1).applyQuaternion(this._scratchWorldQuat).normalize();
            const camera = this.sceneModel.getCamera ? this.sceneModel.getCamera() : null;
            if (camera) {
                this._scratchVec3.copy(camera.position).sub(ring.position);
                if (this._scratchWorldNormal.dot(this._scratchVec3) < 0) {
                    this._scratchWorldNormal.negate();
                }
            }
            ring.position.addScaledVector(this._scratchWorldNormal, 0.003);
            return;
        }
        if (isMapView && (locationType === 'station' || locationType === 'marsShip')) {
            marker.updateMatrixWorld(true);
            marker.matrixWorld.decompose(this._scratchVec3, this._scratchWorldQuat, this._scratchScale);
            ring.position.copy(this._scratchVec3);
            ring.quaternion.copy(this._scratchWorldQuat);
            ring.rotateZ(Math.PI / 2);

            const m = marker.matrixWorld.elements;
            this._scratchWorldNormal.set(m[8], m[9], m[10]).normalize();
            const camera = this.sceneModel.getCamera ? this.sceneModel.getCamera() : null;
            if (camera) {
                this._scratchVec3.copy(camera.position).sub(ring.position);
                if (this._scratchWorldNormal.dot(this._scratchVec3) < 0) {
                    this._scratchWorldNormal.negate();
                }
            }
            const lift = 0.012;
            ring.position.addScaledVector(this._scratchWorldNormal, lift);
            return;
        }

        // Default: copy marker position (local to parent)
        ring.position.copy(marker.position);
        
        if (locationType === 'moon' && moonMarkerParent && marker.parent === moonMarkerParent) {
            // Child of moon rig/plane: parent already applies tilt. Copying plane.quaternion here doubled rotation
            // and skewed the radar into the mesh. Same local frame as the marker + small +Z lift.
            ring.position.z += 0.02;
            ring.quaternion.identity();
            ring.rotateZ(Math.PI / 2);
        } else if (locationType === 'mars' && marsMarkerParent && marker.parent === marsMarkerParent) {
            ring.position.z += 0.02;
            ring.quaternion.identity();
            ring.rotateZ(Math.PI / 2);
        } else if (
            (locationType === 'station' || locationType === 'marsShip')
            && orbitMarkerParent
            && marker.parent === orbitMarkerParent
        ) {
            ring.position.z += 0.02;
            ring.quaternion.identity();
            ring.rotateZ(Math.PI / 2);
        } else if (locationType === 'station' && issSatellite && marker.parent === issSatellite) {
            // Station: ring should match Earth's curvature (like earth events)
            // Calculate normal from globe center to marker's world position
            const globe = this.sceneModel.getGlobe();
            if (globe) {
                // Get marker's world position
                const markerWorldPos = new THREE.Vector3();
                marker.getWorldPosition(markerWorldPos);
                
                // Globe is at origin (0, 0, 0) in world space
                // Calculate normal (direction from globe center to marker)
                const normal = markerWorldPos.clone().normalize();
                
                // Convert normal to satellite's local space (where the ring is)
                const localNormal = normal.clone();
                const satelliteQuaternionInverse = issSatellite.quaternion.clone().invert();
                localNormal.applyQuaternion(satelliteQuaternionInverse);
                localNormal.normalize();
                
                // Create coordinate system with normal as Z-axis (pointing outward from globe)
                const up = new THREE.Vector3(0, 1, 0);
                let tangent = new THREE.Vector3();
                
                // If normal is parallel to up, use a different reference
                if (Math.abs(localNormal.dot(up)) > 0.9) {
                    const right = new THREE.Vector3(1, 0, 0);
                    tangent.crossVectors(localNormal, right).normalize();
                } else {
                    tangent.crossVectors(localNormal, up).normalize();
                }
                
                const bitangent = new THREE.Vector3().crossVectors(localNormal, tangent).normalize();
                
                // Create rotation matrix
                const rotationMatrix = new THREE.Matrix4();
                rotationMatrix.makeBasis(tangent, bitangent, localNormal);
                ring.quaternion.setFromRotationMatrix(rotationMatrix);
                
                // Rotate 90 degrees around Z to make ring horizontal
                ring.rotateZ(Math.PI / 2);
            } else {
                // Fallback: use satellite orientation
                ring.quaternion.copy(issSatellite.quaternion);
                ring.rotateZ(Math.PI / 2);
            }
        } else if (locationType === 'marsShip' && marsShipSatellite && marker.parent === marsShipSatellite) {
            // Mars Ship: ring should match Earth's curvature (like earth events)
            const globe = this.sceneModel.getGlobe();
            if (globe) {
                const markerWorldPos = new THREE.Vector3();
                marker.getWorldPosition(markerWorldPos);
                const normal = markerWorldPos.clone().normalize();

                const localNormal = normal.clone();
                const satInv = marsShipSatellite.quaternion.clone().invert();
                localNormal.applyQuaternion(satInv);
                localNormal.normalize();

                const up = new THREE.Vector3(0, 1, 0);
                let tangent = new THREE.Vector3();
                if (Math.abs(localNormal.dot(up)) > 0.9) {
                    const right = new THREE.Vector3(1, 0, 0);
                    tangent.crossVectors(localNormal, right).normalize();
                } else {
                    tangent.crossVectors(localNormal, up).normalize();
                }
                const bitangent = new THREE.Vector3().crossVectors(localNormal, tangent).normalize();
                const rotationMatrix = new THREE.Matrix4();
                rotationMatrix.makeBasis(tangent, bitangent, localNormal);
                ring.quaternion.setFromRotationMatrix(rotationMatrix);
                ring.rotateZ(Math.PI / 2);
            } else {
                ring.quaternion.copy(marsShipSatellite.quaternion);
                ring.rotateZ(Math.PI / 2);
            }
        } else {
            // Earth globe: calculate normal (direction from globe center to marker)
            const normal = marker.position.clone().normalize();
            
            // Create a coordinate system with normal as Z-axis (pointing outward from globe)
            const up = new THREE.Vector3(0, 1, 0);
            let tangent = new THREE.Vector3();
            
            // If normal is parallel to up, use a different reference
            if (Math.abs(normal.dot(up)) > 0.9) {
                const right = new THREE.Vector3(1, 0, 0);
                tangent.crossVectors(normal, right).normalize();
            } else {
                tangent.crossVectors(normal, up).normalize();
            }
            
            const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
            
            // Create rotation matrix to orient ring flat on surface
            const matrix = new THREE.Matrix4();
            matrix.makeBasis(tangent, bitangent, normal);
            ring.setRotationFromMatrix(matrix);
            
            // Rotate 90 degrees around Z to make ring horizontal
            ring.rotateZ(Math.PI / 2);
        }
    },

    updatePulseRings() {
        if (!this.sceneModel) return;
        
        const globe = this.sceneModel.getGlobe();
        if (!globe) return;

        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        const scene = this.sceneModel.getScene ? this.sceneModel.getScene() : null;
        
        const markers = this.sceneModel.getMarkers();
        if (!markers || markers.length === 0) return;
        
        markers.forEach(marker => {
            if (marker && marker.userData && marker.userData.isEventMarker && marker.userData.pulseRings) {
                const pulseRings = marker.userData.pulseRings;
                let bestFadeCurve = null; // used for marker hover glow sync
                
                // Update each pulse ring
                for (let i = pulseRings.length - 1; i >= 0; i--) {
                    const ring = pulseRings[i];
                    if (!ring || !ring.userData) {
                        pulseRings.splice(i, 1);
                        continue;
                    }
                    
                    if (!ring.parent) {
                        pulseRings.splice(i, 1);
                        continue;
                    }
                    
                    const elapsed = Date.now() - ring.userData.startTime;
                    const progress = elapsed / ring.userData.duration;
                    
                    if (progress >= 1) {
                        // Remove expired ring
                        if (ring.parent) {
                            ring.parent.remove(ring);
                        }
                        pulseRings.splice(i, 1);
                    } else {
                        if (ring.userData.isAwakeningSphereWave && ring.material && ring.material.uniforms) {
                            // Expand angular radius across the globe surface (0 -> PI).
                            const p = Math.max(0, Math.min(1, progress));
                            ring.material.uniforms.uRadius.value = Math.PI * p;

                            // Match the normal event-wave fade curve (more visible early, fades as it expands).
                            const fadeCurve = Math.pow(1 - p, 0.5);
                            ring.material.uniforms.uOpacity.value = 0.9 * fadeCurve;
                            bestFadeCurve = (bestFadeCurve === null) ? fadeCurve : Math.max(bestFadeCurve, fadeCurve);

                            // Keep center direction synced (globe-local).
                            if (ring.material.uniforms.uCenter?.value && marker?.position) {
                                ring.material.uniforms.uCenter.value.copy(marker.position).normalize();
                            }

                            this.updateRingPositionAndOrientation(ring, marker);
                            continue;
                        }

                        // Animate ring - for Moon/Mars/Station, scale only in X and Y (flat), keep Z at 1
                        const locationType = marker.userData ? marker.userData.locationType : 'earth';
                        const scale = ring.userData.startScale + (ring.userData.maxScale - ring.userData.startScale) * progress;
                        if (locationType === 'moon' || locationType === 'mars' || locationType === 'station' || locationType === 'marsShip') {
                            // Map view: ensure these rings are in world space so they never inherit
                            // ISS model rotation or Moon/Mars panel squash/stretch transforms.
                            if (isMapView && scene && ring.parent !== scene) {
                                scene.attach(ring);
                            }
                            // Flat scaling for planes and station (only X and Y, Z stays at 1)
                            ring.scale.set(scale, scale, 1);
                        } else {
                            // 3D scaling for globe
                            ring.scale.set(scale, scale, scale);
                        }
                        
                        // Fade from inside out - more transparent at edges (higher progress)
                        if (ring.material) {
                            const fadeCurve = Math.pow(1 - progress, 0.5); // Slower fade at start, faster at end
                            ring.material.opacity = 0.9 * fadeCurve;
                            bestFadeCurve = (bestFadeCurve === null) ? fadeCurve : Math.max(bestFadeCurve, fadeCurve);
                        }
                        
                        // Update position and orientation to follow marker
                        this.updateRingPositionAndOrientation(ring, marker);
                    }
                }

                // Sync hovered marker brightness with the ring fade timing.
                if (this.hoveredEventMarker === marker && bestFadeCurve !== null) {
                    this._applyMarkerHoverGlow(marker, bestFadeCurve);
                } else if (this.hoveredEventMarker !== marker) {
                    this._resetMarkerHoverGlow(marker);
                } else if (this.hoveredEventMarker === marker && bestFadeCurve === null) {
                    // Between pulse waves the ring list can be empty momentarily; keep steady hover
                    // brightness instead of resetting every frame (was visibly glitched).
                    this._applyMarkerHoverGlow(marker, 0.38);
                }
            }
        });
    },

    updateMarkerPulse() {
        if (!this.sceneModel) return;
        
        const isMapView = this.sceneModel.getMapViewEnabled ? this.sceneModel.getMapViewEnabled() : !!this.sceneModel.isMapView;
        const markers = this.sceneModel.getMarkers();
        const currentTime = Date.now();

        const setScaleWithMapViewPanelCompensation = (marker, desiredScale) => {
            const locationType = marker?.userData?.locationType || 'earth';
            const onOrbitPanel =
                (locationType === 'station' || locationType === 'marsShip')
                && useOrbitPanelForStationShipMarkers(this.sceneModel);
            if (!isMapView) {
                if (locationType === 'moon' || locationType === 'mars' || locationType === 'station' || locationType === 'marsShip') {
                    marker.scale.set(desiredScale, desiredScale, 1);
                } else {
                    marker.scale.set(desiredScale, desiredScale, desiredScale);
                }
                return;
            }

            if ((locationType === 'moon' || locationType === 'mars' || onOrbitPanel) && marker.parent && marker.parent.scale) {
                const parentScaleY = marker.parent.scale.y ?? 1;
                if (parentScaleY > 0.05) {
                    marker.scale.set(desiredScale, desiredScale / parentScaleY, desiredScale);
                } else {
                    marker.scale.set(0, 0, 0);
                }
                return;
            }

            // Earth map markers, station markers, and anything else in map view: uniform scale.
            marker.scale.set(desiredScale, desiredScale, desiredScale);
        };
        
        markers.forEach(marker => {
            if (marker && marker.userData && marker.userData.isEventMarker) {
                // In map view, Moon/Mars panel meshes squash/stretch in Y during page switches.
                // Even when markers are locked or mid-animation (where we skip pulsing),
                // keep them visually circular by compensating for parent Y-scale.
                if (isMapView) {
                    const locationType = marker.userData ? marker.userData.locationType : 'earth';
                    const onOrbitPanel =
                        (locationType === 'station' || locationType === 'marsShip')
                        && useOrbitPanelForStationShipMarkers(this.sceneModel);
                    if ((locationType === 'moon' || locationType === 'mars' || onOrbitPanel) && marker.parent) {
                        const current = marker.scale?.x ?? 1;
                        setScaleWithMapViewPanelCompensation(marker, current);
                    }
                }

                // Don't pulse non-interactive markers (variant markers) or locked events
                if (marker.userData.isInteractive === false || marker.userData.isLocked) {
                    return;
                }
                
                // Skip pulse animation if marker is currently being animated (page transition)
                if (marker.userData.isAnimating) {
                    return;
                }
                
                // Initialize pulse data if not exists
                if (!marker.userData.pulseData) {
                    const base = (marker.userData.originalScale !== undefined && marker.userData.originalScale !== null)
                        ? marker.userData.originalScale
                        : 1.0;
                    marker.userData.pulseData = {
                        startTime: currentTime,
                        baseScale: base,
                        minScale: base * 0.85,
                        maxScale: base * 1.20,
                        pulseSpeed: 0.008
                    };
                }
                
                const pulseData = marker.userData.pulseData;
                // Keep pulse base in sync with the marker's intended scale (e.g. Moon/Mars/Station in map view)
                const desiredBase = (marker.userData.originalScale !== undefined && marker.userData.originalScale !== null)
                    ? marker.userData.originalScale
                    : 1.0;
                if (pulseData.baseScale !== desiredBase) {
                    pulseData.baseScale = desiredBase;
                    pulseData.minScale = desiredBase * 0.85;
                    pulseData.maxScale = desiredBase * 1.20;
                }
                const elapsed = (currentTime - pulseData.startTime) * pulseData.pulseSpeed;
                const pulse = Math.sin(elapsed);
                // Pulse around base scale (about ±10% by default)
                let scale = pulseData.baseScale * (1 + 0.10 * pulse);
                
                // When hovering this marker, grow ~30% more (1.0 -> 1.3)
                const hoverScaleMultiplier = (this.hoveredEventMarker === marker) ? 1.3 : 1.0;
                scale *= hoverScaleMultiplier;
                
                setScaleWithMapViewPanelCompensation(marker, scale);
            }
        });
        
        // Also update pulse rings
        this.updatePulseRings();
    }
};
})(typeof window !== 'undefined' ? window : globalThis);
