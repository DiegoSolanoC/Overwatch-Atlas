import {
    mountEmptyModeShell,
    unmountEmptyModeShell,
} from '../../universal-features/atlas-mode-shell/EmptyModeShell.js';

export async function mountOfficialArchiveMode() {
    mountEmptyModeShell({
        title: 'Official Archive',
        lead: 'Official Archive — content coming soon.',
    });
}

export async function unmountOfficialArchiveMode() {
    unmountEmptyModeShell();
}

/** @deprecated Use {@link mountOfficialArchiveMode} */
export const mountOfficialResourcesMode = mountOfficialArchiveMode;
/** @deprecated Use {@link unmountOfficialArchiveMode} */
export const unmountOfficialResourcesMode = unmountOfficialArchiveMode;
