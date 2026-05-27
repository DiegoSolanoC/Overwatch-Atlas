import {
    mountEmptyModeShell,
    unmountEmptyModeShell,
} from '../../universal-features/atlas-mode-shell/EmptyModeShell.js';

export async function mountOfficialResourcesMode() {
    mountEmptyModeShell({
        title: 'Official Resources',
        lead: 'Official resources hub — content coming soon.',
    });
}

export async function unmountOfficialResourcesMode() {
    unmountEmptyModeShell();
}
