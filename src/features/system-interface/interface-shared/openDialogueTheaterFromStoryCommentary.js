/**
 * Story Commentary ▶ opens a Dialogue Theater entry in the current event slide
 * (same-mode, chip→workshop style). Back restores the prior story entry.
 *
 * Direct Play overlays theater renders + subtitles on the event image without
 * opening the Dialogue Theater panel.
 *
 * IMPORTANT: import DialogueTheaterDataService with the same `?v=` as theater modules
 * so we share one in-memory conversation store (not a second empty instance).
 */

import { updateStatus } from '../../universal-features/atlas-mode-runtime/statusFeed.js';
import { dialogueTheaterDataService } from '../../dialogue-theater/data/DialogueTheaterDataService.js?v=105';
import {
    closeDialogueTheaterInfoPanel,
    isDialogueTheaterInfoPanelActive,
    openDialogueTheaterInfoPanel,
} from '../../dialogue-theater/dialogue-theater-info-panel/DialogueTheaterInfoPanel.js';
import {
    playDialogueTheaterViewConversation,
    stopDialogueTheaterViewPlayback,
} from '../../dialogue-theater/dialogue-theater-info-panel/DialogueTheaterEditPanel.js';
import { pickRandomConversationPathId } from '../../dialogue-theater/dialogue-theater-info-panel/dialogueTheaterRandomRoutePlay.js';
import {
    endStoryCommentaryDirectPlayStage,
    isStoryCommentaryDirectPlayActive,
    showDialogueTheaterStageWithSceneUrl,
} from '../../dialogue-theater/dialogue-theater-stage/dialogueTheaterStageOverlay.js';
import {
    isActiveChatterLineForCommentary,
    resolveStoryCommentaryTheaterTarget,
} from './storyEventCommentaryTheater.js';

/**
 * @param {string | { name?: string, theaterId?: string, lineId?: string }} interactionNameOrEntry
 * @returns {Promise<{
 *   conversation: import('../../dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation,
 *   kind: string,
 *   line: import('../../dialogue-theater/data/DialogueTheaterDataService.js').DialogueLine | null,
 * } | null>}
 */
async function resolveCommentaryTheaterTargetOrWarn(interactionNameOrEntry) {
    const entry = typeof interactionNameOrEntry === 'string'
        ? { name: interactionNameOrEntry }
        : (interactionNameOrEntry && typeof interactionNameOrEntry === 'object'
            ? interactionNameOrEntry
            : null);
    const name = String(entry?.name || '').trim();
    const theaterId = String(entry?.theaterId || '').trim();
    if (!name && !theaterId) {
        updateStatus('No Commentary interaction name to open.', 'warning');
        return null;
    }

    try {
        if (!Array.isArray(dialogueTheaterDataService.conversations)
            || dialogueTheaterDataService.conversations.length === 0) {
            await dialogueTheaterDataService.load();
        }
    } catch (err) {
        console.warn('story commentary theater: load failed', err);
    }

    const target = resolveStoryCommentaryTheaterTarget(
        entry,
        dialogueTheaterDataService.conversations,
    );
    if (!target?.conversation?.id) {
        updateStatus(
            `Dialogue Theater interaction not found: “${name || theaterId}”`,
            'warning',
        );
        return null;
    }
    return target;
}

/**
 * Build a playable conversation snapshot (chatter line / random multipath).
 * Does not mutate the theater data store.
 * @param {{
 *   conversation: import('../../dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation,
 *   kind: string,
 *   line: import('../../dialogue-theater/data/DialogueTheaterDataService.js').DialogueLine | null,
 * }} target
 */
function buildStoryCommentaryPlaybackConversation(target) {
    const base = target.conversation;
    /** @type {import('../../dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation} */
    let playback = { ...base };

    if (target.kind === 'chatter-line' && target.line) {
        playback = {
            ...playback,
            paths: undefined,
            selectedPathId: '',
            lines: [target.line],
        };
    } else if (target.kind === 'chatter-hub') {
        const playable = (base.lines || []).filter(isActiveChatterLineForCommentary);
        if (playable.length) {
            const pick = playable[Math.floor(Math.random() * playable.length)];
            playback = {
                ...playback,
                paths: undefined,
                selectedPathId: '',
                lines: pick ? [pick] : [],
            };
        }
    } else if ((base.paths || []).length > 1) {
        const pathId = pickRandomConversationPathId(base);
        if (pathId) {
            playback = { ...playback, selectedPathId: pathId };
        }
    }

    return playback;
}

/**
 * Open a theater interaction or Hero Chatter line inside Story (no mode switch).
 * @param {string} interactionName
 * @returns {Promise<boolean>}
 */
export async function openDialogueTheaterFromStoryCommentary(interactionName) {
    stopStoryCommentaryDirectPlay({ restoreEventImage: true });

    const target = await resolveCommentaryTheaterTargetOrWarn(interactionName);
    if (!target) return false;

    const slide = window.standaloneEventSlide;
    if (!slide) {
        updateStatus('Event slide is not ready.', 'warning');
        return false;
    }

    /** @type {{ playLineId?: string }} */
    const openOptions = {};
    if (target.kind === 'chatter-line' && target.line?.id) {
        openOptions.playLineId = target.line.id;
    } else if (target.kind === 'chatter-hub') {
        const playable = (target.conversation.lines || []).filter(isActiveChatterLineForCommentary);
        if (playable.length) {
            const pick = playable[Math.floor(Math.random() * playable.length)];
            if (pick?.id) openOptions.playLineId = pick.id;
        }
    }

    try {
        slide.pushSlideHistoryIfOpen?.();
        await openDialogueTheaterInfoPanel(target.conversation.id, openOptions);
        slide.updateBackButtonVisibility?.();
        return true;
    } catch (err) {
        console.error('openDialogueTheaterFromStoryCommentary failed:', err);
        updateStatus('Could not open Dialogue Theater commentary.', 'error');
        slide.updateBackButtonVisibility?.();
        return false;
    }
}

/**
 * Play theater audio/renders over the current event image (stay on the story entry).
 * Multipath entries pick a random route. Chatter hubs pick a random active line.
 * @param {string} interactionName
 * @returns {Promise<boolean>}
 */
export async function directPlayDialogueTheaterFromStoryCommentary(interactionName) {
    stopStoryCommentaryDirectPlay({ restoreEventImage: true });

    const target = await resolveCommentaryTheaterTargetOrWarn(interactionName);
    if (!target) return false;

    const slide = window.standaloneEventSlide;
    if (!slide) {
        updateStatus('Event slide is not ready.', 'warning');
        return false;
    }

    const sceneUrl = String(slide.currentImagePath || '').trim();
    if (!sceneUrl) {
        updateStatus('No event image to play commentary over.', 'warning');
        return false;
    }

    const playback = buildStoryCommentaryPlaybackConversation(target);
    if (!(playback.lines || []).length) {
        updateStatus('No playable lines for this commentary.', 'warning');
        return false;
    }

    try {
        if (typeof slide.showImageOverlay === 'function') {
            slide.showImageOverlay(sceneUrl);
        }
        await showDialogueTheaterStageWithSceneUrl(playback, sceneUrl);
        void playDialogueTheaterViewConversation(playback);
        return true;
    } catch (err) {
        console.error('directPlayDialogueTheaterFromStoryCommentary failed:', err);
        updateStatus('Could not Direct Play commentary.', 'error');
        stopStoryCommentaryDirectPlay({ restoreEventImage: true });
        return false;
    }
}

/**
 * @param {{ restoreEventImage?: boolean }} [options]
 */
export function stopStoryCommentaryDirectPlay({ restoreEventImage = true } = {}) {
    const inDirectPlay =
        isStoryCommentaryDirectPlayActive()
        || Boolean(document.getElementById('dialogueTheaterStage')?.dataset?.sceneUrlOverride);

    if (!inDirectPlay) return;

    stopDialogueTheaterViewPlayback();
    endStoryCommentaryDirectPlayStage({ restoreEventImage });
}

export { isStoryCommentaryDirectPlayActive };

/**
 * When theater was opened from story history, Back/X restores the prior entry.
 * @returns {Promise<boolean>}
 */
export async function tryGoBackStoryCommentaryTheater() {
    return false;
}

export function hasStoryCommentaryTheaterReturn() {
    return false;
}

export function clearStoryCommentaryTheaterReturn() {
    window.standaloneEventSlide?.updateBackButtonVisibility?.();
}

export function onDialogueTheaterPanelClosed() {
    window.standaloneEventSlide?.updateBackButtonVisibility?.();
}

/**
 * Prefer restoring prior slide history when closing a commentary-opened theater panel.
 * @returns {Promise<boolean>}
 */
export async function closeDialogueTheaterOrRestoreStoryHistory() {
    const slide = window.standaloneEventSlide;
    if (slide?._slideHistoryStack?.length && typeof slide.goBackSlide === 'function') {
        await slide.goBackSlide();
        return true;
    }
    if (isDialogueTheaterInfoPanelActive()) {
        closeDialogueTheaterInfoPanel();
        return true;
    }
    return false;
}

if (typeof window !== 'undefined') {
    window.StoryCommentaryTheaterNav = {
        openDialogueTheaterFromStoryCommentary,
        directPlayDialogueTheaterFromStoryCommentary,
        stopStoryCommentaryDirectPlay,
        isStoryCommentaryDirectPlayActive,
        tryGoBackStoryCommentaryTheater,
        hasStoryCommentaryTheaterReturn,
        clearStoryCommentaryTheaterReturn,
        onDialogueTheaterPanelClosed,
        closeDialogueTheaterOrRestoreStoryHistory,
    };
}
