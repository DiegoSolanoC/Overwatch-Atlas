/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's goBackSlide method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

import { tryGoBackStoryCommentaryTheater } from '../../../interface-shared/openDialogueTheaterFromStoryCommentary.js';

export async function runGoBackSlide(slide) {
            // Legacy hook (no-op for in-place commentary opens).
            if (await tryGoBackStoryCommentaryTheater()) {
                return;
            }
            if (!slide._slideHistoryStack?.length) return;
            const prev = slide._slideHistoryStack.pop();
            if (!prev) {
                slide.updateBackButtonVisibility();
                return;
            }
            slide._slideHistoryRestoring = true;
            try {
                const em = window.eventManager;
                const peekArchive =
                    prev.presentationArchiveSource &&
                    prev.presentationArchiveSource !== 'story' &&
                    Array.isArray(prev.eventList);

                if (prev.presentationFromDock) {
                    if (em?.switchStoryArchiveSource) {
                        await em.switchStoryArchiveSource(prev.archiveSource || 'story');
                    }
                    slide.showEvent(prev.eventIndex, {
                        presentationArchiveSource: prev.presentationArchiveSource || 'story',
                    });
                } else if (peekArchive && (prev.archiveSource || 'story') === 'story') {
                    // Bio peek from story: restore the peeked list without switching archives.
                    slide.showEvent(prev.eventIndex, {
                        eventList: prev.eventList,
                        presentationArchiveSource: prev.presentationArchiveSource,
                    });
                } else {
                    if (em?.switchStoryArchiveSource) {
                        await em.switchStoryArchiveSource(prev.archiveSource);
                    }
                    const list = Array.isArray(prev.eventList) ? prev.eventList : (em?.events || []);
                    slide.showEvent(prev.eventIndex, {
                        eventList: list,
                        presentationArchiveSource: prev.presentationArchiveSource || undefined,
                    });
                }
            } finally {
                slide._slideHistoryRestoring = false;
            }
            slide.updateBackButtonVisibility();
            if (window.SoundEffectsManager?.play) {
                window.SoundEffectsManager.play('eventClick');
            }
}
