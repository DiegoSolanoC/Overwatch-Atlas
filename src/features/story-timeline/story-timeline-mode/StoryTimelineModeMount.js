import {
    mountEmptyModeShell,
    unmountEmptyModeShell,
} from '../../universal-features/atlas-mode-shell/EmptyModeShell.js';

export async function mountStoryTimelineMode() {
    mountEmptyModeShell({
        title: 'Story Timeline',
        lead: 'Story timeline mode — content coming soon.',
    });
}

export async function unmountStoryTimelineMode() {
    unmountEmptyModeShell();
}
