/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's goBackSlide method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

export async function runGoBackSlide(slide) {
            if (!slide._slideHistoryStack?.length) return;
            const prev = slide._slideHistoryStack.pop();
            if (!prev) {
                slide.updateBackButtonVisibility();
                return;
            }
            slide._slideHistoryRestoring = true;
            try {
                const em = window.eventManager;
                if (em?.switchStoryArchiveSource) {
                    await em.switchStoryArchiveSource(prev.archiveSource);
                }
                if (prev.presentationFromDock) {
                    slide.showEvent(prev.eventIndex, {});
                } else {
                    const list = em?.events || [];
                    slide.showEvent(prev.eventIndex, { eventList: list });
                }
            } finally {
                slide._slideHistoryRestoring = false;
            }
            slide.updateBackButtonVisibility();
            if (window.SoundEffectsManager?.play) {
                window.SoundEffectsManager.play('eventClick');
            }
}
