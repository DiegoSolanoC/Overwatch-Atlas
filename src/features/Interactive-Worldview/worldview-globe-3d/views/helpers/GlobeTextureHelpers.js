/**
 * GlobeTextureHelpers - Utilities for texture loading and configuration
 * Extracted from GlobeView to reduce duplication
 */

/**
 * Configures texture settings for optimal quality
 * @param {THREE.Texture} texture - Texture to configure
 * @param {THREE.WebGLRenderer} renderer - Renderer instance
 */
export function configureTexture(texture, renderer) {
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
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
}
