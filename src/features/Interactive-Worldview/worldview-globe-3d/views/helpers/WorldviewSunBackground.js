import { EARTH_GLOBE_LIGHT_LAYER } from '../../../worldview-shared-assets/constants/WorldviewLightingConstants.js';

function createRadialGlowTexture({ size = 256 } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0.0, 'rgba(255, 250, 230, 1.0)');
    g.addColorStop(0.25, 'rgba(255, 230, 160, 0.85)');
    g.addColorStop(0.55, 'rgba(255, 200, 120, 0.35)');
    g.addColorStop(1.0, 'rgba(255, 180, 80, 0.0)');

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

const SUN_ANCHOR_RADIUS = new THREE.Vector3(-78, 14, -28).length();
const SUN_BACKGROUND_FALLBACK_POSITION = new THREE.Vector3(-78, 0, -28).normalize().multiplyScalar(SUN_ANCHOR_RADIUS);
const SUN_VIEWPORT_MOBILE_MAX_WIDTH = 768;
const SUN_MOBILE_DISTANCE_SCALE = 0.52;
const SUN_DEV_YAW_AXIS = new THREE.Vector3(0, 1, 0);

function createRandomSunAnchorBasePosition() {
    const theta = Math.random() * Math.PI * 2;
    const r = SUN_ANCHOR_RADIUS;
    return new THREE.Vector3(Math.cos(theta) * r, 0, Math.sin(theta) * r);
}

export function assignEarthLightLayer(root) {
    if (!root) return;
    root.traverse((obj) => {
        if (obj.layers) obj.layers.set(EARTH_GLOBE_LIGHT_LAYER);
    });
}

export function syncAtmosphereSunDirUniforms(light, meshes) {
    if (!light || !meshes || !meshes.length) return;
    const dir = light.position.clone().normalize();
    for (let i = 0; i < meshes.length; i++) {
        const mat = meshes[i] && meshes[i].material;
        if (mat && mat.uniforms && mat.uniforms.uSunDirWorld) {
            mat.uniforms.uSunDirWorld.value.copy(dir);
        }
    }
}

export function applySunBackgroundForViewport(sunBg) {
    if (!sunBg || !sunBg.sprite) return;
    const mobile = typeof window !== 'undefined' && window.innerWidth <= SUN_VIEWPORT_MOBILE_MAX_WIDTH;
    const base = sunBg.sunAnchorBase || SUN_BACKGROUND_FALLBACK_POSITION;
    const pos = base.clone();
    const yawDeg = Number(sunBg.sunDevYawDeg);
    if (Number.isFinite(yawDeg)) {
        pos.applyAxisAngle(SUN_DEV_YAW_AXIS, THREE.MathUtils.degToRad(yawDeg));
    }
    if (mobile) pos.multiplyScalar(SUN_MOBILE_DISTANCE_SCALE);
    sunBg.sprite.position.copy(pos);
    if (sunBg.light) sunBg.light.position.copy(pos);
}

export function addSunBackground({ scene }) {
    if (!scene) return null;
    const tex = createRadialGlowTexture({ size: 256 });
    if (!tex) return null;

    const mat = new THREE.SpriteMaterial({
        map: tex,
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending
    });

    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(10, 10, 1);
    sprite.renderOrder = -10;
    sprite.frustumCulled = false;
    scene.add(sprite);

    const light = new THREE.DirectionalLight(0xfffcfa, 3.15);
    light.name = 'SunDirectionalLight';
    light.layers.set(EARTH_GLOBE_LIGHT_LAYER);
    scene.add(light);
    scene.add(light.target);
    light.target.position.set(0, 0, 0);

    const result = {
        sprite,
        light,
        sunAnchorBase: createRandomSunAnchorBasePosition(),
        sunDevYawDeg: 0
    };
    applySunBackgroundForViewport(result);
    return result;
}
