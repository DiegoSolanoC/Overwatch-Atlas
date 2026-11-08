/**
 * Gallery hub — Coming Soon placeholder (distinct from Intel / entity browser).
 */

import {
    mountEmptyModeShell,
    unmountEmptyModeShell,
} from '../../universal-features/atlas-mode-shell/EmptyModeShell.js';

export async function mountGalleryHubMode() {
    mountEmptyModeShell();
}

export async function unmountGalleryHubMode() {
    unmountEmptyModeShell();
}
