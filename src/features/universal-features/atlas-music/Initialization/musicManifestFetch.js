/**
 * musicManifestFetch — fetch and parse `src/data/manifest.json` for the music catalog.
 */

const getLogAssetLoad = () =>
    (typeof window !== 'undefined' && typeof window.logAssetLoad === 'function')
        ? window.logAssetLoad
        : () => {};

/**
 * @returns {Promise<{ music: Array<{ filename: string, name: string }> }>}
 */
export async function fetchMusicManifest() {
    const logAssetLoad = getLogAssetLoad();
    logAssetLoad('MUSIC', 'Loading manifest.json (PRIORITY)');

    const cacheBuster = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const response = await fetch(`src/data/manifest.json?v=${cacheBuster}`, {
        cache: 'no-store',
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
        }
    });
    if (!response.ok) {
        throw new Error(`manifest.json HTTP ${response.status}`);
    }
    const manifest = await response.json();
    logAssetLoad('MUSIC', `manifest.json loaded (${manifest.music ? manifest.music.length : 0} music files)`);
    return manifest;
}
