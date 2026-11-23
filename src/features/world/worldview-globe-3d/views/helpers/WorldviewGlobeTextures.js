/**
 * GlobeTextureHelpers - Utilities for texture loading and configuration
 * Extracted from WorldviewGlobeView to reduce duplication
 */
import { getGlobeQualitySnapshot } from '../../../worldview-shared-assets/constants/WorldviewQualitySettings.js';

/**
 * Downscale oversized equirect / atlas images before upload (VRAM + bandwidth).
 * @param {THREE.Texture} texture
 * @param {number} maxEdge - longest side in px
 */
export function downscaleTextureIfNeeded(texture, maxEdge) {
    const img = texture?.image;
    if (!img || !maxEdge || maxEdge <= 0) return;
    const w = img.width | 0;
    const h = img.height | 0;
    if (w <= 0 || h <= 0) return;
    const longest = Math.max(w, h);
    if (longest <= maxEdge) return;

    const scale = maxEdge / longest;
    const nw = Math.max(1, Math.round(w * scale));
    const nh = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = nw;
    canvas.height = nh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, nw, nh);
    texture.image = canvas;
    texture.needsUpdate = true;
}

/**
 * Configures texture settings for quality tier (mipmaps + capped anisotropy + optional downscale).
 * @param {THREE.Texture} texture - Texture to configure
 * @param {THREE.WebGLRenderer} renderer - Renderer instance
 * @param {{ maxEdge?: number, skipDownscale?: boolean }} [opts]
 */
export function configureTexture(texture, renderer, opts = {}) {
    const q = getGlobeQualitySnapshot();
    const maxEdge = opts.maxEdge ?? q.textureMaxEdge;
    if (!opts.skipDownscale) {
        downscaleTextureIfNeeded(texture, maxEdge);
    }

    const maxAniso = renderer?.capabilities?.getMaxAnisotropy?.() ?? 1;
    texture.anisotropy = Math.min(q.anisotropy, maxAniso);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
}

/**
 * Loads a texture with standard configuration
 * @param {THREE.TextureLoader} textureLoader - Texture loader instance
 * @param {string} texturePath - Path to texture file
 * @param {THREE.WebGLRenderer} renderer - Renderer instance
 * @param {Function} onLoad - Optional callback when texture loads
 * @param {Function} onError - Optional error callback
 * @returns {THREE.Texture} - The loaded texture
 */
export function loadTexture(textureLoader, texturePath, renderer, onLoad = null, onError = null) {
    return textureLoader.load(
        texturePath,
        (texture) => {
            configureTexture(texture, renderer);
            if (onLoad) {
                onLoad(texture);
            }
        },
        undefined,
        (err) => {
            if (onError) {
                onError(err);
            } else {
                console.warn(`Error loading texture: ${texturePath}`, err);
            }
        }
    );
}

/**
 * Changes a plane's texture
 * @param {THREE.Mesh} plane - Plane mesh to update
 * @param {string} texturePath - Path to new texture
 * @param {THREE.TextureLoader} textureLoader - Texture loader instance
 * @param {THREE.WebGLRenderer} renderer - Renderer instance
 * @param {boolean} updateEmissiveMap - Whether to also update emissive map
 */
export function changePlaneTexture(plane, texturePath, textureLoader, renderer, updateEmissiveMap = false) {
    if (!plane) {
        console.error('Plane not found');
        return;
    }

    loadTexture(textureLoader, texturePath, renderer, (texture) => {
        console.log('Plane texture changed to:', texturePath);
        plane.material.map = texture;
        if (updateEmissiveMap) {
            plane.material.emissiveMap = texture;
        }
        plane.material.needsUpdate = true;
    });
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.GlobeTextureHelpers) {
        window.GlobeTextureHelpers = {};
    }
    window.GlobeTextureHelpers.configureTexture = configureTexture;
    window.GlobeTextureHelpers.loadTexture = loadTexture;
    window.GlobeTextureHelpers.changePlaneTexture = changePlaneTexture;
    window.GlobeTextureHelpers.downscaleTextureIfNeeded = downscaleTextureIfNeeded;
}
