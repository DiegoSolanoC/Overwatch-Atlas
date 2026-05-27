import {
    mountEmptyModeShell,
    unmountEmptyModeShell,
} from '../../universal-features/atlas-mode-shell/EmptyModeShell.js';

/**
 * @param {{ onCancel?: () => void }} [options]
 */
export async function mountStoryTimelineMode({ onCancel } = {}) {
    mountEmptyModeShell({
        title: 'Story Timeline',
        lead: 'Story timeline mode — content coming soon.',
        onCancel,
    });
}

export async function unmountStoryTimelineMode() {
    unmountEmptyModeShell();
}
