/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's updateSourcesAndFilters method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

export function runUpdateSourcesAndFilters(slide, event) {
            const archiveSrc = window.eventManager?.dataService?.getArchiveSource?.() || 'story';
            const showingDockStoryEvent = !!slide._presentationFromDockTimeline;
            if (archiveSrc !== 'story' && !showingDockStoryEvent) {
                const ss = document.getElementById('eventSourcesSection');
                const fs = document.getElementById('eventFiltersSection');
                if (ss) ss.style.display = 'none';
                if (fs) fs.style.display = 'none';
                const lhEarly = window.LocationFlagHelpers;
                lhEarly?.clearStoryFilterPlacesSlideDom?.();
                // Do not clear relevant locations here: displaySlide already filled them for bio satellites;
                // clearing would wipe Ana (relevantLocations) right after render.
                return;
            }
            // Update sources section
            const sourcesSection = document.getElementById('eventSourcesSection');
            const sourcesList = document.getElementById('eventSourcesList');
            if (sourcesSection && sourcesList && event) {
                if (event.sources && event.sources.length > 0) {
                    sourcesList.innerHTML = '';
                    event.sources.forEach(source => {
                        const item = document.createElement('div');
                        item.className = 'event-source-display-item';
                        if (source.url) {
                            const link = document.createElement('a');
                            link.href = source.url;
                            link.target = '_blank';
                            link.rel = 'noopener noreferrer';
                            link.className = 'event-source-link';
                            link.textContent = source.text || source.url;
                            link.addEventListener('click', () => {
                                if (window.SoundEffectsManager?.play) {
                                    window.SoundEffectsManager.play('filterConfirm');
                                }
                            });
                            item.appendChild(link);
                        } else {
                            item.textContent = source.text;
                            item.className = 'event-source-text';
                        }
                        sourcesList.appendChild(item);
                    });
                    sourcesSection.style.display = 'block';
                } else {
                    sourcesSection.style.display = 'none';
                }
            }
            
            // Update filters section with icon chips (matching globe mode)
            slide.renderEventFilters(event);
}
