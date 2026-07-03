/**

 * Extracted from the standalone-slide factory (window.standaloneEventSlide).

 * The factory's updateSourcesAndFilters method delegates here so the factory file stays

 * scannable; the heavy body lives in this single-purpose file.

 *

 * The slide parameter is the standalone-slide controller (i.e. acts as

 * the original method's `this`).

 */



import { isYouTubeSourceUrl, parseYouTubeVideoId } from '../sources/youtubeSourceUtils.js';

import { isPdfSourceUrl, pdfSourceKey } from '../sources/pdfSourceUtils.js';

import { getSourcePrimaryUrl, getSourceUrls } from '../sources/sourceUrlUtils.js';

import { renderSourceMediaPlayButtonFace } from '../sources/sourceMediaPlayButton.js';

import {

    isEventPdfOverlayActive,

    isEventYouTubeOverlayActive,

    restoreEventImageFromSourceMedia,

} from '../image-overlay/eventSourceMediaOverlay.js';



/**

 * @param {object} slide

 * @param {string} label

 * @param {'youtube'|'pdf'} mediaKind

 * @param {string} mediaKey

 * @param {() => void} onPlay

 * @returns {HTMLButtonElement}

 */

function createSourceMediaPlayButton(slide, label, mediaKind, mediaKey, onPlay) {

    const playBtn = document.createElement('button');

    playBtn.type = 'button';

    playBtn.className = 'event-source-media-play';

    if (mediaKind === 'pdf') playBtn.classList.add('event-source-media-play--pdf');

    playBtn.dataset.mediaKind = mediaKind;

    playBtn.dataset.mediaKey = mediaKey;

    playBtn.dataset.mediaLabel = label;

    playBtn.setAttribute('aria-label', `View ${label} in panel`);

    playBtn.setAttribute('aria-pressed', 'false');

    playBtn.title = 'View in panel';

    renderSourceMediaPlayButtonFace(playBtn, mediaKind, false);



    playBtn.addEventListener('click', (e) => {

        e.preventDefault();

        e.stopPropagation();



        const isYoutubeActive =

            mediaKind === 'youtube'

            && slide.activeYouTubeVideoId === mediaKey

            && isEventYouTubeOverlayActive();

        const isPdfActive =

            mediaKind === 'pdf'

            && pdfSourceKey(slide.activePdfSourceUrl) === mediaKey

            && isEventPdfOverlayActive();



        if (isYoutubeActive || isPdfActive) {

            restoreEventImageFromSourceMedia(slide);

            return;

        }



        onPlay();

    });

    return playBtn;

}



export async function runUpdateSourcesAndFilters(slide, event) {

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

                    event.sources.forEach((source) => {

                        const item = document.createElement('div');

                        const urls = getSourceUrls(source);

                        const primaryUrl = getSourcePrimaryUrl(source);

                        const hasYouTubePlay = urls.some((url) => {

                            const videoId = parseYouTubeVideoId(url);

                            return Boolean(videoId && isYouTubeSourceUrl(url));

                        });

                        const hasPdfView = urls.some((url) => isPdfSourceUrl(url));

                        const hasMediaPlay = hasYouTubePlay || hasPdfView;



                        item.className = hasMediaPlay

                            ? 'event-source-display-item event-source-display-item--with-play'

                            : 'event-source-display-item';



                        if (primaryUrl || source.text) {

                            if (primaryUrl) {

                                const link = document.createElement('a');

                                link.href = primaryUrl;

                                link.target = '_blank';

                                link.rel = 'noopener noreferrer';

                                link.className = 'event-source-link';

                                link.textContent = source.text || primaryUrl;

                                link.addEventListener('click', () => {

                                    window.SoundEffectsManager?.play?.('filterConfirm');

                                });

                                item.appendChild(link);

                            } else {

                                const textSpan = document.createElement('span');

                                textSpan.className = 'event-source-text';

                                textSpan.textContent = source.text;

                                item.appendChild(textSpan);

                            }



                            if (hasMediaPlay) {

                                const playGroup = document.createElement('div');

                                playGroup.className = 'event-source-media-play-group';



                                urls.forEach((url) => {

                                    const videoId = parseYouTubeVideoId(url);

                                    if (videoId && isYouTubeSourceUrl(url)) {

                                        const label = String(source.text || 'YouTube video');

                                        playGroup.appendChild(

                                            createSourceMediaPlayButton(

                                                slide,

                                                label,

                                                'youtube',

                                                videoId,

                                                () => slide.showYouTubeOverlay?.(url),

                                            ),

                                        );

                                    }

                                    if (isPdfSourceUrl(url)) {

                                        const label = String(source.text || 'PDF document');

                                        playGroup.appendChild(

                                            createSourceMediaPlayButton(

                                                slide,

                                                label,

                                                'pdf',

                                                pdfSourceKey(url),

                                                () => slide.showPdfOverlay?.(url),

                                            ),

                                        );

                                    }

                                });



                                if (playGroup.childElementCount > 0) {

                                    item.appendChild(playGroup);

                                }

                            }

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

            await slide.renderEventFilters(event);

}
