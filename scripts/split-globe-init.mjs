import fs from 'fs';

const p = 'src/features/Interactive-Worldview/worldview-globe-3d/views/helpers/WorldviewGlobeInit.js';
const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
const header = lines.slice(0, 21).join('\n');
const meshBlock = lines.slice(21, 139).join('\n');
const auroraBlock = lines.slice(139, 346).join('\n');
const cloudBlock = lines.slice(346, 703).join('\n');
const tailBlock = lines.slice(703).join('\n');

fs.writeFileSync(
    'src/features/Interactive-Worldview/worldview-globe-3d/views/helpers/WorldviewGlobeAuroraInit.js',
    `/**\n * Aurora shell meshes for globe and flat map.\n */\n${header}\n\n${auroraBlock}\n`
);

const cloudHeader = `/**
 * Cloud layers (procedural + atlas) for globe and flat map.
 */
import { loadTexture } from './WorldviewGlobeTextures.js';
`;

fs.writeFileSync(
    'src/features/Interactive-Worldview/worldview-globe-3d/views/helpers/WorldviewGlobeCloudInit.js',
    `${cloudHeader}\n${cloudBlock}\n`
);

const mainImports = `/**
 * GlobeInitHelpers - Utilities for globe initialization
 */
import { createCelestialPlane, getMoonTexturePath, getMarsTexturePath, getOrbitTexturePath } from './WorldviewGlobePlanes.js';
import { loadTexture } from './WorldviewGlobeTextures.js';
import {
    createGlobePatternOverlay,
    createMapPatternOverlay,
    getPaletteAccentHex,
    getPalettePatternPath,
    updatePatternWave
} from './WorldviewPatternOverlay.js';
import {
    addSunBackground,
    applySunBackgroundForViewport,
    assignEarthLightLayer,
    syncAtmosphereSunDirUniforms
} from './WorldviewSunBackground.js';
import { EARTH_POLAR_TO_EQUATORIAL_RATIO } from '../../../worldview-shared-assets/constants/WorldviewPhysicalConstants.js';
export { createGlobeAuroraShell, createFlatMapAuroraShell } from './WorldviewGlobeAuroraInit.js';
export {
    applyGlobeCloudPaletteTint,
    rerandomizeGlobeCloudAtlas,
    rerandomizeFlatMapCloudAtlas,
    createGlobeCloudLayer,
    createFlatMapCloudLayer,
    GLOBE_CLOUD_ATLAS_VARIANTS
} from './WorldviewGlobeCloudInit.js';
`;

fs.writeFileSync(p, `${mainImports}\n${meshBlock}\n${tailBlock}`);
console.log('GlobeInit split complete');
