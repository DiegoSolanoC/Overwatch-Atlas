import {
    mountEmptyModeShell,
    unmountEmptyModeShell,
} from '../../universal-features/atlas-mode-shell/EmptyModeShell.js';

/**
 * @param {{ onCancel?: () => void }} [options]
 */
export async function mountDialogueTheaterMode({ onCancel } = {}) {
    mountEmptyModeShell({
        title: 'Dialogue Theater',
        lead: 'Dialogue theater mode — content coming soon.',
        onCancel,
    });
}

export async function unmountDialogueTheaterMode() {
    unmountEmptyModeShell();
}
