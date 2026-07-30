/**
 * Bridges story image-overlay helpers (#eventImageOverlay) with Dialogue Theater stage mode.
 */

import { dialogueTheaterDataService } from '../data/DialogueTheaterDataService.js?v=102';
import {
    hideDialogueTheaterStage,
    ensureDialogueTheaterStageOverlayVisible,
    showDialogueTheaterStage,
} from './dialogueTheaterStageOverlay.js';
import {
    syncMobileEventSlideLayoutForImageHidden,
    syncMobileEventSlideLayoutForImageShown,
} from '../../system-interface/interface-event-slide/standalone-slide/image-overlay/mobileEventSlideImageLayout.js';

const CONVERSATION_ID_ATTR = 'data-dialogue-theater-conversation-id';

export function isDialogueTheaterEventSlideMarked() {
    const eventSlide = document.getElementById('eventSlide');
    return !!(
        eventSlide?.classList.contains('event-slide--dialogue-theater')
        && eventSlide.getAttribute(CONVERSATION_ID_ATTR)
    );
}

export function isDialogueTheaterImageOverlayContext() {
    const eventSlide = document.getElementById('eventSlide');
    return !!(
        isDialogueTheaterEventSlideMarked()
        && eventSlide.classList.contains('open')
    );
}

function getActiveConversationRow() {
    const id = document.getElementById('eventSlide')?.getAttribute(CONVERSATION_ID_ATTR);
    if (!id) return null;
    return dialogueTheaterDataService.getConversationById(id);
}

function updateImageToggleLabel(isVisible) {
    const toggleBtn = document.getElementById('eventImageToggle');
    if (toggleBtn) {
        toggleBtn.textContent = isVisible ? 'Hide Image' : 'Show Image';
    }
}

/**
 * @param {ReturnType<typeof import('../../system-interface/interface-event-slide/standalone-slide/createStandaloneEventSlide.js')>|null|undefined} slide
 */
export function ensureDialogueTheaterOverlayClickHandler(slide) {
    const overlay = document.getElementById('eventImageOverlay');
    if (!overlay || !slide?.hideImageOverlayTemporarily) return;

    if (overlay.dataset.dialogueTheaterClickHandlerSet === 'true') return;
    overlay.dataset.dialogueTheaterClickHandlerSet = 'true';

    overlay.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) return;
        if (!isDialogueTheaterImageOverlayContext()) return;
        if (!overlay.classList.contains('open')) return;

        const target = e.target;
        if (
            target === overlay
            || target instanceof HTMLImageElement
            || target?.closest?.('#dialogueTheaterStage')
        ) {
            e.stopPropagation();
            slide.hideImageOverlayTemporarily(5000);
        }
    });
}

export function hideDialogueTheaterImageOverlay() {
    hideDialogueTheaterStage();
    updateImageToggleLabel(false);
    syncMobileEventSlideLayoutForImageHidden();
}

export async function showDialogueTheaterImageOverlay(slide, options = {}) {
    const row = getActiveConversationRow();
    if (!row) return false;

    if (options.preserveStage) {
        await ensureDialogueTheaterStageOverlayVisible();
    } else {
        await showDialogueTheaterStage(row);
    }
    ensureDialogueTheaterOverlayClickHandler(slide);
    updateImageToggleLabel(true);
    syncMobileEventSlideLayoutForImageShown();
    return true;
}

/**
 * @param {ReturnType<typeof import('../../system-interface/interface-event-slide/standalone-slide/createStandaloneEventSlide.js')>|null|undefined} slide
 */
export function hideDialogueTheaterImageOverlayGradually(slide, durationMs = 600) {
    const overlay = document.getElementById('eventImageOverlay');
    if (
        !overlay
        || (!isDialogueTheaterImageOverlayContext() && !isDialogueTheaterEventSlideMarked())
    ) {
        return false;
    }

    overlay.style.setProperty('pointer-events', 'none');

    const startTime = Date.now();
    const fadeInterval = 50;

    const fadeTimer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        const eased = 1 - (1 - progress) * (1 - progress);
        const opacity = 1 - eased;

        overlay.style.opacity = String(opacity);

        if (progress >= 1) {
            clearInterval(fadeTimer);
            hideDialogueTheaterImageOverlay();
            overlay.style.removeProperty('pointer-events');
        }
    }, fadeInterval);

    return true;
}

/**
 * @param {ReturnType<typeof import('../../system-interface/interface-event-slide/standalone-slide/createStandaloneEventSlide.js')>|null|undefined} slide
 */
export async function showDialogueTheaterImageOverlayGradually(slide, durationMs = 1500) {
    const row = getActiveConversationRow();
    if (!row) return false;

    await showDialogueTheaterStage(row);
    ensureDialogueTheaterOverlayClickHandler(slide);
    syncMobileEventSlideLayoutForImageShown();

    const overlay = document.getElementById('eventImageOverlay');
    if (!overlay) return false;

    overlay.style.display = 'flex';
    overlay.style.opacity = '0';

    const startTime = Date.now();
    const fadeInterval = 50;

    const fadeTimer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        const eased = progress * progress;
        const opacity = eased;

        overlay.style.opacity = String(opacity);

        if (progress >= 1) {
            clearInterval(fadeTimer);
            overlay.style.opacity = '1';
            updateImageToggleLabel(true);
        }
    }, fadeInterval);

    return true;
}

/**
 * @param {ReturnType<typeof import('../../system-interface/interface-event-slide/standalone-slide/createStandaloneEventSlide.js')>|null|undefined} slide
 */
export async function restoreDialogueTheaterImageOverlayGradually(slide, durationMs = 600) {
    return showDialogueTheaterImageOverlayGradually(slide, durationMs);
}
