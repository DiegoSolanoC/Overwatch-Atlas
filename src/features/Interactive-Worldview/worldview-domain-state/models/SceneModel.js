/**
 * SceneModel - Manages Three.js scene state
 * Handles scene, camera, renderer, globe, markers, and UI state
 */
import { EARTH_GLOBE_LIGHT_LAYER } from '../../worldview-shared-assets/constants/GlobeLightingConstants.js';

export class SceneModel {
    constructor() {
        // Three.js core objects
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.globe = null;
        this.stars = null;
        /** @type {{sprite: THREE.Sprite, light: THREE.DirectionalLight}|null} Background sun from addSunBackground */
        this.sunBackground = null;
        /** @type {THREE.AmbientLight|null} Earth-only fill (light layer 1); intensity raised in flat map when sun light is hidden. */
        this.earthAmbientLayer1 = null;
        this.earthMapPlane = null;
        this.moonPlane = null;
        this.marsPlane = null;
        /** @type {THREE.Group|null} Parent group for Moon mesh + markers (world transform). */
        this.moonRig = null;
        /** @type {THREE.Group|null} Parent group for Mars mesh + markers. */
        this.marsRig = null;
        this.orbitPlane = null;
        /** @type {THREE.Group|null} Station / Mars-ship panel when transport is off or in map view. */
        this.orbitRig = null;

        // Markers
        this.markers = [];

        // Interaction state
        this.isDragging = false;
        this.previousMousePosition = { x: 0, y: 0 };
        this.initialTouchPosition = null; // Track initial touch position to detect drag vs tap
        this.rotationVelocity = { x: 0, y: 0 };
        this.autoRotate = true;
        this.activeMarker = null;
        this.labelElement = null;
        this.autoRotateTimeout = null; // Store timeout reference for clearing

        // User preferences
        this.autoRotateEnabled = true;
        this.hyperloopVisible = true;
        /** Aurora shell + cloud layer; when false, meshes hide and reload randomizes like a fresh page when re-enabled. */
        this.globeWeatherEffectsVisible = true;
        /** Lighting toggle state: Sun, ambient contrast, and city lights (light dots). */
        this.globeLightingVisible = true;
        // NOTE: eventMarker and activeFilters removed - Globe no longer handles events
        this.isMapView = false; // Earth view mode: globe (false) or flat map (true)

        /** Same equirectangular asset as the WebGL map plane; used by DOM lite map `<img>`. */
        this.earthMapTextureUrl = '';

        // Page visibility
        this.isPageVisible = true;

        // GLTF Loader
        this.gltfLoader = null;
    }

    /**
     * Initialize Three.js scene
     * @param {HTMLElement} container - Container element
     */
    initScene(container) {
        // Scene setup
        this.scene = new THREE.Scene();
        
        // Check saved palette preference to set correct background color
        const savedPalette = localStorage.getItem('colorPalette');
        const isGray = savedPalette === 'gray';
        const isCrimson = savedPalette === 'crimson';
        const isNulled = savedPalette === 'nulled';
        const bgColor = isGray ? 0x0f0f0f : (isCrimson ? 0x14080c : (isNulled ? 0x100818 : 0x050d18));
        console.log('Initializing scene with palette:', savedPalette || 'blue (default)', 'Background color:', '0x' + bgColor.toString(16));
        this.scene.background = new THREE.Color(bgColor);

        // Camera setup
        this.camera = new THREE.PerspectiveCamera(
            45,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        
        // On mobile/vertical view, start more zoomed out to show Moon/Mars panels
        const isMobile = window.innerWidth <= 768;
        const isPortrait = container.clientHeight > container.clientWidth;
        const isMobilePortrait = isMobile && isPortrait;
        
        // Default camera position: more zoomed out on mobile portrait to show panels
        this.camera.position.z = isMobilePortrait ? 5.5 : 3.5;
        
        // Store mobile state for later use
        this.isMobilePortrait = isMobilePortrait;

        this.camera.layers.enable(EARTH_GLOBE_LIGHT_LAYER);

        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.applyRendererPixelRatioCap();
        container.appendChild(this.renderer.domElement);

        /*
         * Layer 0: Moon/Mars, markers, stars — higher ambient so panels stay self-lit (emissive + fill).
         * Layer 1: Earth globe + flat map — almost only sun directional; trace ambient for map mode / edge stability (no hemisphere — it flattened night).
         */
        const worldAmbient = new THREE.AmbientLight(0xffffff, 0.52);
        worldAmbient.layers.set(0);
        this.scene.add(worldAmbient);

        this.earthAmbientLayer1 = new THREE.AmbientLight(0xffffff, 0.002);
        this.earthAmbientLayer1.layers.set(EARTH_GLOBE_LIGHT_LAYER);
        this.scene.add(this.earthAmbientLayer1);

        // Initialize GLTF Loader
        this.gltfLoader = new THREE.GLTFLoader();
    }

    /**
     * Get scene
     * @returns {THREE.Scene}
     */
    getScene() {
        return this.scene;
    }

    /**
     * Change scene background color
     * @param {number} colorHex - Hex color value (e.g., 0x0a1929 for blue, 0x1a1a1a for gray)
     */
    setBackgroundColor(colorHex) {
        if (this.scene) {
            this.scene.background = new THREE.Color(colorHex);
        }
    }

    /**
     * Get camera
     * @returns {THREE.PerspectiveCamera}
     */
    getCamera() {
        return this.camera;
    }

    /**
     * Get renderer
     * @returns {THREE.WebGLRenderer}
     */
    getRenderer() {
        return this.renderer;
    }

    /**
     * Limit devicePixelRatio to reduce fill cost on HiDPI / phones; call after resize/orientation change.
     */
    applyRendererPixelRatioCap() {
        if (!this.renderer) return;
        const rawDpr = window.devicePixelRatio || 1;
        const narrow = window.innerWidth <= 768;
        const capped = narrow ? Math.min(rawDpr, 1.75) : Math.min(rawDpr, 2.25);
        if (typeof this.renderer.getPixelRatio === 'function' && this.renderer.getPixelRatio() === capped) {
            return;
        }
        this.renderer.setPixelRatio(capped);
    }

    /**
     * Set globe
     * @param {THREE.Mesh} globe - Globe mesh
     */
    setGlobe(globe) {
        this.globe = globe;
    }

    /**
     * Get globe
     * @returns {THREE.Mesh}
     */
    getGlobe() {
        return this.globe;
    }

    /**
     * The textured Earth mesh when the globe root is a Group (tilt + spin); otherwise the root mesh.
     * @returns {THREE.Mesh|null}
     */
    getGlobeSurfaceMesh() {
        const g = this.globe;
        if (!g) return null;
        if (g.isMesh) return g;
        const m = g.userData && g.userData.earthSurfaceMesh;
        return m && m.isMesh ? m : null;
    }

    /**
     * Set earth map plane (flat unwrapped Earth)
     * @param {THREE.Mesh} plane - Earth map plane mesh
     */
    setEarthMapPlane(plane) {
        this.earthMapPlane = plane;
    }

    /**
     * Get earth map plane
     * @returns {THREE.Mesh|null}
     */
    getEarthMapPlane() {
        return this.earthMapPlane;
    }

    /**
     * Enable/disable flat map view for Earth
     * @param {boolean} enabled
     */
    setMapViewEnabled(enabled) {
        this.isMapView = !!enabled;
    }

    /**
     * Is flat map view enabled?
     * @returns {boolean}
     */
    getMapViewEnabled() {
        return !!this.isMapView;
    }

    setEarthMapTextureUrl(url) {
        this.earthMapTextureUrl = url || '';
    }

    getEarthMapTextureUrl() {
        return this.earthMapTextureUrl || '';
    }

    /**
     * Set stars (group with point layers, or legacy single Points)
     * @param {THREE.Object3D} stars
     */
    setStars(stars) {
        this.stars = stars;
    }

    /**
     * Get stars
     * @returns {THREE.Object3D|null}
     */
    getStars() {
        return this.stars;
    }

    /**
     * @param {{sprite: THREE.Sprite, light: THREE.DirectionalLight}|null} sunBackground
     */
    setSunBackground(sunBackground) {
        this.sunBackground = sunBackground;
    }

    getSunBackground() {
        return this.sunBackground;
    }

    /**
     * Set moon plane
     * @param {THREE.Mesh} moonPlane - Moon plane mesh
     */
    setMoonPlane(moonPlane) {
        this.moonPlane = moonPlane;
    }

    /**
     * Get moon plane
     * @returns {THREE.Mesh}
     */
    getMoonPlane() {
        return this.moonPlane;
    }

    /**
     * Set mars plane
     * @param {THREE.Mesh} marsPlane - Mars plane mesh
     */
    setMarsPlane(marsPlane) {
        this.marsPlane = marsPlane;
    }

    /**
     * Get mars plane
     * @returns {THREE.Mesh}
     */
    getMarsPlane() {
        return this.marsPlane;
    }

    /**
     * @param {THREE.Group|null} rig
     */
    setMoonRig(rig) {
        this.moonRig = rig;
    }

    getMoonRig() {
        return this.moonRig;
    }

    /**
     * @param {THREE.Group|null} rig
     */
    setMarsRig(rig) {
        this.marsRig = rig;
    }

    getMarsRig() {
        return this.marsRig;
    }

    setOrbitPlane(plane) {
        this.orbitPlane = plane;
    }

    getOrbitPlane() {
        return this.orbitPlane;
    }

    setOrbitRig(rig) {
        this.orbitRig = rig;
    }

    getOrbitRig() {
        return this.orbitRig;
    }

    /** Parent for orbit-panel event markers (station / marsShip in panel mode). */
    getOrbitMarkerParent() {
        return this.orbitRig || this.orbitPlane;
    }

    /** Parent for Moon event markers (rig when present, else legacy mesh). */
    getMoonMarkerParent() {
        return this.moonRig || this.moonPlane;
    }

    /** Parent for Mars event markers. */
    getMarsMarkerParent() {
        return this.marsRig || this.marsPlane;
    }

    /**
     * Add marker
     * @param {Object} marker - Marker object
     */
    addMarker(marker) {
        this.markers.push(marker);
    }

    /**
     * Get all markers
     * @returns {Array}
     */
    getMarkers() {
        return this.markers;
    }

    /**
     * Set dragging state
     * @param {boolean} isDragging - Dragging state
     */
    setDragging(isDragging) {
        this.isDragging = isDragging;
        if (typeof document !== 'undefined' && document.body) {
            document.body.classList.toggle('globe-grabbing', !!isDragging);
        }
    }

    /**
     * Get dragging state
     * @returns {boolean}
     */
    isDraggingState() {
        return this.isDragging;
    }

    /**
     * Set previous mouse position
     * @param {Object} position - Mouse position {x, y}
     */
    setPreviousMousePosition(position) {
        this.previousMousePosition = position;
    }

    /**
     * Get previous mouse position
     * @returns {Object}
     */
    getPreviousMousePosition() {
        return this.previousMousePosition;
    }

    /**
     * Set rotation velocity
     * @param {Object} velocity - Rotation velocity {x, y}
     */
    setRotationVelocity(velocity) {
        this.rotationVelocity = velocity;
    }

    /**
     * Get rotation velocity
     * @returns {Object}
     */
    getRotationVelocity() {
        return this.rotationVelocity;
    }

    /**
     * Set auto rotate
     * @param {boolean} autoRotate - Auto rotate state
     */
    setAutoRotate(autoRotate) {
        this.autoRotate = autoRotate;
    }

    /**
     * Get auto rotate
     * @returns {boolean}
     */
    getAutoRotate() {
        return this.autoRotate;
    }

    /**
     * Set active marker
     * @param {Object} marker - Active marker
     */
    setActiveMarker(marker) {
        this.activeMarker = marker;
    }

    /**
     * Get active marker
     * @returns {Object|null}
     */
    getActiveMarker() {
        return this.activeMarker;
    }

    /**
     * Set label element
     * @param {HTMLElement} element - Label element
     */
    setLabelElement(element) {
        this.labelElement = element;
    }

    /**
     * Get label element
     * @returns {HTMLElement|null}
     */
    getLabelElement() {
        return this.labelElement;
    }

    /**
     * Set auto rotate enabled
     * @param {boolean} enabled - Auto rotate enabled state
     */
    setAutoRotateEnabled(enabled) {
        this.autoRotateEnabled = enabled;
    }

    /**
     * Get auto rotate enabled
     * @returns {boolean}
     */
    getAutoRotateEnabled() {
        return this.autoRotateEnabled;
    }

    /**
     * Set hyperloop visible
     * @param {boolean} visible - Hyperloop visible state
     */
    setHyperloopVisible(visible) {
        this.hyperloopVisible = visible;
    }

    /**
     * Get hyperloop visible
     * @returns {boolean}
     */
    getHyperloopVisible() {
        return this.hyperloopVisible;
    }

    /**
     * @param {boolean} visible
     */
    setGlobeWeatherEffectsVisible(visible) {
        this.globeWeatherEffectsVisible = !!visible;
    }

    /**
     * @returns {boolean}
     */
    getGlobeWeatherEffectsVisible() {
        return this.globeWeatherEffectsVisible !== false;
    }

    /**
     * Set page visible
     * @param {boolean} visible - Page visible state
     */
    setPageVisible(visible) {
        this.isPageVisible = visible;
    }

    /**
     * Get page visible
     * @returns {boolean}
     */
    getPageVisible() {
        return this.isPageVisible;
    }

    /**
     * Get GLTF loader
     * @returns {THREE.GLTFLoader}
     */
    getGLTFLoader() {
        return this.gltfLoader;
    }

    /**
     * @param {boolean} visible
     */
    setGlobeLightingVisible(visible) {
        this.globeLightingVisible = !!visible;
    }

    /**
     * @returns {boolean}
     */
    getGlobeLightingVisible() {
        return this.globeLightingVisible !== false;
    }
}

