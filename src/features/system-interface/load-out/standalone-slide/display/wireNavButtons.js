/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's wireNavButtons method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

export function runWireNavButtons(slide, eventData) {
            const prevBtn = document.getElementById('eventPrevBtn');
            const nextBtn = document.getElementById('eventNextBtn');
            
            if (prevBtn) {
                prevBtn.onclick = () => {
                    // Loop around: if at first event, go to last
                    const newIndex = slide.currentEventIndex > 0 
                        ? slide.currentEventIndex - 1 
                        : slide.allEvents.length - 1;
                    const list = slide.allEvents?.length
                        ? slide.allEvents
                        : (window.eventManager?.getDockTimelineEvents?.() || []);
                    const keepHist = (slide._slideHistoryStack?.length || 0) > 0;
                    slide.showEvent(newIndex, { eventList: list, keepSlideHistory: keepHist });
                    if (window.SoundEffectsManager?.play) {
                        window.SoundEffectsManager.play('switchEvent');
                    }
                };
            }
            
            if (nextBtn) {
                nextBtn.onclick = () => {
                    // Loop around: if at last event, go to first
                    const newIndex = slide.currentEventIndex < slide.allEvents.length - 1 
                        ? slide.currentEventIndex + 1 
                        : 0;
                    const list = slide.allEvents?.length
                        ? slide.allEvents
                        : (window.eventManager?.getDockTimelineEvents?.() || []);
                    const keepHist = (slide._slideHistoryStack?.length || 0) > 0;
                    slide.showEvent(newIndex, { eventList: list, keepSlideHistory: keepHist });
                    if (window.SoundEffectsManager?.play) {
                        window.SoundEffectsManager.play('switchEvent');
                    }
                };
            }
}
