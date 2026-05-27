import {
    mountEmptyModeShell,
    unmountEmptyModeShell,
} from '../../universal-features/atlas-mode-shell/EmptyModeShell.js';

export async function mountDialogueTheaterMode() {
    mountEmptyModeShell({
        title: 'Dialogue Theater',
        lead: 'Dialogue theater mode — content coming soon.',
    });
}

export async function unmountDialogueTheaterMode() {
    unmountEmptyModeShell();
}
