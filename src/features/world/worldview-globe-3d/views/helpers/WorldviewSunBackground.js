import { EARTH_GLOBE_LIGHT_LAYER } from '../../../worldview-shared-assets/constants/WorldviewLightingConstants.js';

/**
 * Multi-stop radial: hot core → photosphere → soft corona (reads more like a real sun disc).
 */
function createRadialGlowTexture({ size = 512 } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2;

    ctx.clearRect(0, 0, size, size);

    // Soft outer corona
    const corona = ctx.createRadialGradient(cx, cy, r * 0.18, cx, cy, r);
    corona.addColorStop(0.0, 'rgba(255, 236, 190, 0.55)');
    corona.addColorStop(0.35, 'rgba(255, 200, 110, 0.28)');
    corona.addColorStop(0.65, 'rgba(255, 160, 70, 0.1)');
    corona.addColorStop(1.0, 'rgba(255, 140, 40, 0.0)');
    ctx.fillStyle = corona;
    ctx.fillRect(0, 0, size, size);

    // Photosphere disc
    const photo = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.42);
    photo.addColorStop(0.0, 'rgba(255, 252, 245, 1.0)');
    photo.addColorStop(0.35, 'rgba(255, 240, 200, 0.95)');
    photo.addColorStop(0.7, 'rgba(255, 210, 130, 0.75)');
    photo.addColorStop(1.0, 'rgba(255, 180, 90, 0.0)');
    ctx.fillStyle = photo;
    ctx.fillRect(0, 0, size, size);

    // Hot white core
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.14);
    core.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    core.addColorStop(0.55, 'rgba(255, 250, 230, 0.9)');
    core.addColorStop(1.0, 'rgba(255, 240, 200, 0.0)');
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

/** Very soft violet/rose nebula blotches for deep-space atmosphere. */
function createNebulaTexture({ size = 512 } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, size, size);

    const blobs = [
        { x: 0.32, y: 0.38, r: 0.42, c: '120, 90, 200' },
        { x: 0.68, y: 0.55, r: 0.38, c: '180, 70, 140' },
        { x: 0.48, y: 0.62, r: 0.3, c: '70, 110, 190' },
        { x: 0.58, y: 0.28, r: 0.26, c: '90, 140, 200' }
    ];

    for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i];
        const cx = b.x * size;
        const cy = b.y * size;
        const rad = b.r * size;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0.0, `rgba(${b.c}, 0.55)`);
        g.addColorStop(0.45, `rgba(${b.c}, 0.18)`);
        g.addColorStop(1.0, `rgba(${b.c}, 0.0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
    }

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
    if (sunBg.corona) sunBg.corona.position.copy(pos);
    if (sunBg.light) sunBg.light.position.copy(pos);
    if (sunBg.nebulae && sunBg.nebulae.length) {
        // Keep nebulae fixed in deep space (do not follow sun)
    }
}

export function addSunBackground({ scene }) {
    if (!scene) return null;
    const tex = createRadialGlowTexture({ size: 512 });
    if (!tex) return null;

    const mat = new THREE.SpriteMaterial({
        map: tex,
        color: 0xfff6e8,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending
    });

    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(14, 14, 1);
    sprite.renderOrder = -10;
    sprite.frustumCulled = false;
    scene.add(sprite);

    // Wider soft halo behind the disc
    const coronaTex = createRadialGlowTexture({ size: 256 });
    let corona = null;
    if (coronaTex) {
        const coronaMat = new THREE.SpriteMaterial({
            map: coronaTex,
            color: 0xffc878,
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
            depthTest: true,
            blending: THREE.AdditiveBlending
        });
        corona = new THREE.Sprite(coronaMat);
        corona.scale.set(28, 28, 1);
        corona.renderOrder = -11;
        corona.frustumCulled = false;
        scene.add(corona);
    }

    // Faint nebula plates (far behind stars feel)
    const nebulae = [];
    const nebTex = createNebulaTexture({ size: 512 });
    if (nebTex) {
        const placements = [
            { pos: new THREE.Vector3(55, 28, -70), scale: 95, opacity: 0.12, color: 0xb8a0ff },
            { pos: new THREE.Vector3(-40, -35, -85), scale: 110, opacity: 0.1, color: 0xff90c0 },
            { pos: new THREE.Vector3(20, -50, -95), scale: 80, opacity: 0.08, color: 0x80b0ff }
        ];
        for (let i = 0; i < placements.length; i++) {
            const p = placements[i];
            const nMat = new THREE.SpriteMaterial({
                map: nebTex,
                color: p.color,
                transparent: true,
                opacity: p.opacity,
                depthWrite: false,
                depthTest: true,
                blending: THREE.AdditiveBlending
            });
            const nSpr = new THREE.Sprite(nMat);
            nSpr.position.copy(p.pos);
            nSpr.scale.set(p.scale, p.scale * 0.72, 1);
            nSpr.renderOrder = -20;
            nSpr.frustumCulled = false;
            nSpr.name = `nebula-${i}`;
            scene.add(nSpr);
            nebulae.push(nSpr);
        }
    }

    const light = new THREE.DirectionalLight(0xfffcfa, 3.35);
    light.name = 'SunDirectionalLight';
    light.layers.set(EARTH_GLOBE_LIGHT_LAYER);
    scene.add(light);
    scene.add(light.target);
    light.target.position.set(0, 0, 0);

    const result = {
        sprite,
        corona,
        nebulae,
        light,
        sunAnchorBase: createRandomSunAnchorBasePosition(),
        sunDevYawDeg: 180
    };
    applySunBackgroundForViewport(result);
    return result;
}
