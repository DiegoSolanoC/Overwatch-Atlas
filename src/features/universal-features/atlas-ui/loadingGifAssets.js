/**
 * Loading GIF paths: boot overlay (`loading.gif`) vs image-slot placeholder (`loading asset.gif`).
 */

export const LOADING_GIF_STANDARD = 'src/assets/images/Misc/GIFs/loading.gif';
export const LOADING_GIF_ASSET = 'src/assets/images/Misc/GIFs/loading%20asset.gif';

/** Full-screen boot overlay + globe/codex inline loaders. */
export function getOverlayLoadingGifSrc() {
    return LOADING_GIF_STANDARD;
}

/** Event list / thumb slots while preview art loads. */
export function getEventListSpinnerGifSrc() {
    return LOADING_GIF_ASSET;
}
