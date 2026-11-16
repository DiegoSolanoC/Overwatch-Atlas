/**
 * Night-time city lights: instanced additive dots on the globe (shader-faded by sun).
 * No real PointLights — those lit every MeshStandard fragment on Earth/clouds and
 * tanked frame time while transport was moving.
 * Placement is filtered by equirectangular land mask (Alpha.png) so lights do not appear over ocean.
 */

import { latLonToVector3 } from '../../../worldview-shared-assets/utils/WorldviewGeometry.js';
import {
    collectEarthLightHubs,
    randomLatLonInDisk,
    getEarthLightsPerHubMultiplier,
    isLatLonSuppressedForEarthLights
} from '../../../worldview-shared-assets/utils/EarthLightsData.js';
import { loadEarthLandMask, isLatLonOnLand } from '../../../worldview-shared-assets/utils/EarthLandMask.js';
import { EARTH_GLOBE_LIGHT_LAYER } from '../../../worldview-shared-assets/constants/WorldviewLightingConstants.js';

const DEFAULT_LIGHTS_PER_HUB = 12;
/** Degrees: scatter radius around each hub (lat/lon disk). */
const DEFAULT_CLUSTER_RADIUS_DEG = 5.5;
const DEFAULT_SURFACE_RADIUS = 1.0035;
const DOT_RADIUS = 0.0038;
const DOT_SEGMENTS = 5;
const MAX_ATTEMPTS_PER_DOT = 40;

const _zAxis = new THREE.Vector3(0, 0, 1);
const _normal = new THREE.Vector3();

/**
 * Must not redeclare built-in Three.js shader prefixes (attributes/uniforms).
 */
const CITY_LIGHTS_VERTEX_SHADER = `
varying vec3 vWorldPos;
varying vec2 vLocalXY;

void main() {
    vLocalXY = position.xy;
#ifdef USE_INSTANCING
    mat4 m = modelMatrix * instanceMatrix;
#else
    mat4 m = modelMatrix;
#endif
    vec4 worldPosition = m * vec4(position, 1.0);
    vWorldPos = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const CITY_LIGHTS_FRAGMENT_SHADER = `
uniform vec3 uSunDirWorld;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uDotRadius;
varying vec3 vWorldPos;
varying vec2 vLocalXY;

void main() {
    vec3 n = normalize(vWorldPos);
    vec3 s = normalize(uSunDirWorld);
    float nd = dot(n, s);
    float night = 1.0 - smoothstep(-0.1, 0.22, nd);
    // Day-side dots contribute nothing — bail before glow math / blend.
    if (night <= 0.004) discard;

    float r = length(vLocalXY) / uDotRadius;
    float t = clamp(r, 0.0, 1.0);
    float core = pow(1.0 - t, 1.65);
    float glow = exp(-t * 2.85) * 1.15;
    float halo = exp(-t * 6.2) * 0.35;
    float lum = core + glow + halo;

    vec3 rgb = uColor * (1.12 + core * 1.05 + glow * 0.6 + halo * 0.28);
    float alpha = clamp(uOpacity * lum * night, 0.0, 1.0);
    gl_FragColor = vec4(rgb * alpha, alpha);
}
`;

function createEarthCityLightsMaterial(dotRadius) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uSunDirWorld: { value: new THREE.Vector3(0, 0, 1) },
            uColor: { value: new THREE.Color(0xffd060) },
            uOpacity: { value: 1.2 },
            uDotRadius: { value: dotRadius }
        },
        vertexShader: CITY_LIGHTS_VERTEX_SHADER,
        fragmentShader: CITY_LIGHTS_FRAGMENT_SHADER,
        fog: false,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });
}

/**
 * @param {import('../../../worldview-domain-state/models/WorldviewLocationCatalog.js').WorldviewLocationCatalog} dataModel
 * @param {Object} [opts]
 * @returns {Promise<{ instancedMesh: THREE.InstancedMesh, accentPointLights: THREE.PointLight[] }|null>}
 */
export async function createEarthCityLightsPoints(dataModel, opts = {}) {
    if (!dataModel || typeof THREE === 'undefined') return null;

    const lightsPerHub = opts.lightsPerHub ?? DEFAULT_LIGHTS_PER_HUB;
    const clusterR = opts.clusterRadiusDeg ?? DEFAULT_CLUSTER_RADIUS_DEG;
    const surfaceR = opts.surfaceRadius ?? DEFAULT_SURFACE_RADIUS;
    const landThreshold = opts.landThreshold;

    let landMask = opts.landMask;
    if (landMask === undefined) {
        try {
            landMask = await loadEarthLandMask();
        } catch (e) {
            console.warn('Earth city lights: land mask failed, lights not filtered by continent', e);
            landMask = null;
        }
    }

    const hubs = collectEarthLightHubs(dataModel);
    if (!hubs.length) return null;

    const geometry = new THREE.CircleGeometry(DOT_RADIUS, DOT_SEGMENTS);
    const material = createEarthCityLightsMaterial(DOT_RADIUS);

    const dummy = new THREE.Object3D();
    const mats = [];

    for (const h of hubs) {
        const nForHub = Math.max(0, Math.round(lightsPerHub * getEarthLightsPerHubMultiplier(h.lat, h.lon, h.name)));
        for (let i = 0; i < nForHub; i++) {
            let lat = h.lat;
            let lon = h.lon;
            let placed = false;

            for (let a = 0; a < MAX_ATTEMPTS_PER_DOT; a++) {
                const o = randomLatLonInDisk(h.lat, h.lon, clusterR);
                lat = o.lat;
                lon = o.lon;
                if (isLatLonSuppressedForEarthLights(lat, lon)) continue;
                if (!landMask || isLatLonOnLand(landMask, lat, lon, landThreshold)) {
                    placed = true;
                    break;
                }
            }

            if (!placed && landMask && isLatLonOnLand(landMask, h.lat, h.lon, landThreshold)) {
                lat = h.lat;
                lon = h.lon;
                if (!isLatLonSuppressedForEarthLights(lat, lon)) placed = true;
            }

            if (!placed) continue;

            const p = latLonToVector3(lat, lon, surfaceR);
            _normal.copy(p).normalize();
            dummy.position.copy(p);
            dummy.quaternion.setFromUnitVectors(_zAxis, _normal);
            const size = 0.82 + Math.random() * 1.55;
            dummy.scale.setScalar(size);
            dummy.updateMatrix();
            mats.push(dummy.matrix.clone());
        }
    }

    const count = mats.length;
    if (!count) {
        geometry.dispose();
        material.dispose();
        return null;
    }

    const inst = new THREE.InstancedMesh(geometry, material, count);
    inst.name = 'earthCityLights';
    inst.frustumCulled = true;
    inst.renderOrder = 4;
    inst.userData.isEarthCityLights = true;
    inst.layers.set(EARTH_GLOBE_LIGHT_LAYER);

    for (let i = 0; i < count; i++) {
        inst.setMatrixAt(i, mats[i]);
    }
    inst.instanceMatrix.needsUpdate = true;

    // Keep empty array for call-site compat (old accent PointLights removed for perf).
    return { instancedMesh: inst, accentPointLights: [] };
}

/**
 * @param {THREE.Object3D|null} obj - InstancedMesh from {@link createEarthCityLightsPoints}
 */
export function disposeEarthCityLights(obj) {
    if (!obj) return;
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
}
