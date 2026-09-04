/**
 * Story Commentary ▶ opens a Dialogue Theater entry in the current event slide
 * (same-mode, chip→workshop style). Back restores the prior story entry.
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
import { normalizeForPredictiveMatch } from '../interface-left-panel/event-system/form/autocomplete/tokenInputMatching.js';

/**
 * @param {string} name
 * @returns {import('../../dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation | null}
 */
function findConversationByName(name) {
    const needle = normalizeForPredictiveMatch(name);
    if (!needle) return null;
    const matches = dialogueTheaterDataService.conversations.filter(
        (row) => normalizeForPredictiveMatch(row?.name) === needle,
    );
    if (!matches.length) return null;
    const active = matches.find((row) => String(row.status || 'active') !== 'removed');
    return active || matches[0];
}

/**
 * Open a theater interaction inside Story (no mode switch).
 * @param {string} interactionName
 * @returns {Promise<boolean>}
 */
export async function openDialogueTheaterFromStoryCommentary(interactionName) {
    const name = String(interactionName || '').trim();
    if (!name) {
        updateStatus('No Commentary interaction name to open.', 'warning');
        return false;
    }

    try {
        if (!Array.isArray(dialogueTheaterDataService.conversations)
            || dialogueTheaterDataService.conversations.length === 0) {
            await dialogueTheaterDataService.load();
        }
    } catch (err) {
        console.warn('openDialogueTheaterFromStoryCommentary: load failed', err);
    }

    const conversation = findConversationByName(name);
    if (!conversation?.id) {
        updateStatus(`Dialogue Theater interaction not found: “${name}”`, 'warning');
        return false;
    }

    const slide = window.standaloneEventSlide;
    if (!slide) {
        updateStatus('Event slide is not ready.', 'warning');
        return false;
    }

    try {
        slide.pushSlideHistoryIfOpen?.();
        await openDialogueTheaterInfoPanel(conversation.id);
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
        tryGoBackStoryCommentaryTheater,
        hasStoryCommentaryTheaterReturn,
        clearStoryCommentaryTheaterReturn,
        onDialogueTheaterPanelClosed,
        closeDialogueTheaterOrRestoreStoryHistory,
    };
}
