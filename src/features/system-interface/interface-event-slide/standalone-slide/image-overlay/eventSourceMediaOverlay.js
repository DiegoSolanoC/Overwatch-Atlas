/**
 * In-app source media (YouTube + PDF) inside #eventImageOverlay.
 */

import {
    isDialogueTheaterImageOverlayContext,
} from '../../../../dialogue-theater/dialogue-theater-stage/dialogueTheaterImageOverlayBridge.js';
import {
    isMobileEventSlideViewport,
    syncMobileEventSlideLayoutForImageHidden,
    syncMobileEventSlideLayoutForImageShown,
} from './mobileEventSlideImageLayout.js';
import { parseYouTubeVideoId } from '../sources/youtubeSourceUtils.js';
import { buildPdfViewerEmbedUrl, pdfSourceKey } from '../sources/pdfSourceUtils.js';
import {
    pauseMusicForSourceMedia,
    resumeMusicAfterSourceMedia,
    resetSourceMediaMusicDuckState,
} from './eventSourceMediaMusic.js';
import {
    destroyYouTubeEmbedPlayer,
    mountYouTubeEmbedPlayer,
} from './eventYouTubePlayer.js';
import { renderSourceMediaPlayButtonFace } from '../sources/sourceMediaPlayButton.js';

const YOUTUBE_HOST_ID = 'eventYouTubeEmbed';
const PDF_HOST_ID = 'eventPdfEmbed';

/**
 * @returns {HTMLElement|null}
 */
function getOverlay() {
    return document.getElementById('eventImageOverlay');
}

/**
 * @returns {HTMLElement|null}
 */
function getImageContainer() {
    return document.getElementById('eventImageContainer');
}

/**
 * @param {string} hostId
 * @param {string} className
 * @returns {HTMLElement|null}
 */
function getOrCreateMediaHost(hostId, className) {
    const container = getImageContainer();
    if (!container) return null;

    let host = document.getElementById(hostId);
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.id = hostId;
        host.className = className;
        host.hidden = true;
        container.appendChild(host);
    }
    return host;
}

function hideHeroImage() {
    const img = document.getElementById('eventImage');
    if (!(img instanceof HTMLImageElement)) return;
    img.classList.remove('fade-in', 'fade-out');
    img.style.display = 'none';
    img.style.opacity = '0';
}

function clearPdfEmbed() {
    const host = document.getElementById(PDF_HOST_ID);
    if (!host) return;
    host.innerHTML = '';
    host.hidden = true;
}

function clearYouTubeEmbed() {
    destroyYouTubeEmbedPlayer();
    const host = document.getElementById(YOUTUBE_HOST_ID);
    if (!host) return;
    host.innerHTML = '';
    host.hidden = true;
}

/**
 * Stop embedded source media and restore music when appropriate.
 */
export function clearEventSourceMediaEmbed() {
    const overlay = getOverlay();
    clearYouTubeEmbed();
    clearPdfEmbed();

    if (overlay) {
        delete overlay.dataset.mediaMode;
    }

    resumeMusicAfterSourceMedia();
    syncSourceMediaPlayButtons({ youtubeVideoId: '', pdfUrl: '' });
}

/** @deprecated alias */
export const clearEventYouTubeEmbed = clearEventSourceMediaEmbed;

/**
 * @returns {boolean}
 */
export function isEventYouTubeOverlayActive() {
    const overlay = getOverlay();
    return overlay?.dataset.mediaMode === 'youtube' && overlay.classList.contains('open');
}

/**
 * @returns {boolean}
 */
export function isEventPdfOverlayActive() {
    const overlay = getOverlay();
    return overlay?.dataset.mediaMode === 'pdf' && overlay.classList.contains('open');
}

/**
 * @returns {boolean}
 */
export function isEventSourceMediaOverlayActive() {
    return isEventYouTubeOverlayActive() || isEventPdfOverlayActive();
}

/**
 * @param {{ youtubeVideoId?: string, pdfUrl?: string }} active
 */
export function syncSourceMediaPlayButtons(active = {}) {
    const activeYoutube = String(active.youtubeVideoId || '').trim();
    const activePdf = pdfSourceKey(active.pdfUrl || '');

    document.querySelectorAll('.event-source-media-play').forEach((btn) => {
        if (!(btn instanceof HTMLButtonElement)) return;

        const kind = String(btn.dataset.mediaKind || '').trim();
        const key = String(btn.dataset.mediaKey || '').trim();
        const label = String(btn.dataset.mediaLabel || 'source');

        let isActive = false;
        if (kind === 'youtube') {
            isActive = Boolean(activeYoutube && key === activeYoutube);
        } else if (kind === 'pdf') {
            isActive = Boolean(activePdf && key === activePdf);
        }

        btn.classList.toggle('event-source-media-play--active', isActive);
        btn.classList.toggle('event-source-media-play--close', isActive);
        renderSourceMediaPlayButtonFace(btn, kind === 'pdf' ? 'pdf' : 'youtube', isActive);
        btn.title = isActive ? 'Return to image' : 'View in panel';
        btn.setAttribute(
            'aria-label',
            isActive ? `Return to image view (${label})` : `View ${label} in panel`,
        );
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
}

/** @deprecated alias */
export function syncYouTubeSourcePlayButtons(activeVideoId) {
    syncSourceMediaPlayButtons({ youtubeVideoId: activeVideoId });
}

/**
 * @param {object} slide
 * @param {'youtube'|'pdf'} mediaMode
 * @returns {boolean}
 */
function openSourceMediaOverlayShell(slide, mediaMode) {
    const overlay = getOverlay();
    const eventSlide = document.getElementById('eventSlide');
    const toggleBtn = document.getElementById('eventImageToggle');
    if (!overlay) return false;

    hideHeroImage();
    overlay.dataset.mediaMode = mediaMode;
    overlay.style.display = 'flex';
    overlay.style.opacity = '1';
    overlay.classList.add('open');
    if (eventSlide?.classList.contains('open')) {
        overlay.classList.add('slide-open');
    }
    if (toggleBtn) toggleBtn.textContent = 'Hide Image';

    syncMobileEventSlideLayoutForImageShown();
    window.SoundEffectsManager?.play?.('imageDisplay');
    return true;
}

/**
 * @param {object} slide
 * @returns {boolean}
 */
export function restoreEventImageFromSourceMedia(slide) {
    if (!isEventSourceMediaOverlayActive()) return false;

    const imagePath = String(slide?.currentImagePath || '').trim();
    const globalImageOn = localStorage.getItem('globalImageToggle') !== 'false';

    clearEventSourceMediaEmbed();
    if (slide && typeof slide === 'object') {
        slide.activeYouTubeVideoId = '';
        slide.activePdfSourceUrl = '';
    }

    if (globalImageOn && imagePath) {
        slide?.showImageOverlay?.(imagePath);
    } else {
        slide?.hideImageOverlay?.();
    }

    return true;
}

/** @deprecated alias */
export const restoreEventImageFromYouTube = restoreEventImageFromSourceMedia;

/**
 * @param {object} slide
 * @param {string} sourceUrl
 * @returns {boolean}
 */
export function runShowYouTubeOverlay(slide, sourceUrl) {
    if (isDialogueTheaterImageOverlayContext()) return false;

    const videoId = parseYouTubeVideoId(sourceUrl);
    if (!videoId) return false;

    const host = getOrCreateMediaHost(YOUTUBE_HOST_ID, 'event-source-media-embed event-youtube-embed');
    if (!host || !openSourceMediaOverlayShell(slide, 'youtube')) return false;

    clearPdfEmbed();
    host.hidden = false;

    syncSourceMediaPlayButtons({ youtubeVideoId: videoId });
    if (slide && typeof slide === 'object') {
        slide.activeYouTubeVideoId = videoId;
        slide.activePdfSourceUrl = '';
    }

    pauseMusicForSourceMedia();
    void mountYouTubeEmbedPlayer(host, videoId);

    return true;
}

/**
 * @param {HTMLElement} host
 * @param {string} sourceUrl
 */
function mountPdfEmbed(host, sourceUrl) {
    host.innerHTML = '';
    const frame = document.createElement('iframe');
    frame.className = 'event-source-media-embed__frame event-pdf-embed__frame';
    frame.src = buildPdfViewerEmbedUrl(sourceUrl);
    frame.title = 'PDF document';
    frame.setAttribute('loading', 'lazy');
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    host.appendChild(frame);
}

/**
 * @param {object} slide
 * @param {string} sourceUrl
 * @returns {boolean}
 */
export function runShowPdfOverlay(slide, sourceUrl) {
    if (isDialogueTheaterImageOverlayContext()) return false;

    const pdfUrl = pdfSourceKey(sourceUrl);
    if (!pdfUrl) return false;

    const host = getOrCreateMediaHost(PDF_HOST_ID, 'event-source-media-embed event-pdf-embed');
    if (!host || !openSourceMediaOverlayShell(slide, 'pdf')) return false;

    clearYouTubeEmbed();
    host.hidden = false;
    mountPdfEmbed(host, pdfUrl);

    syncSourceMediaPlayButtons({ pdfUrl });
    if (slide && typeof slide === 'object') {
        slide.activePdfSourceUrl = pdfUrl;
        slide.activeYouTubeVideoId = '';
    }

    pauseMusicForSourceMedia();

    return true;
}

/**
 * @param {Event} event
 * @returns {boolean}
 */
export function shouldIgnoreOverlayClickForSourceMedia(event) {
    if (!isEventSourceMediaOverlayActive()) return false;
    if (isMobileEventSlideViewport()) return true;

    const target = event?.target;
    if (target instanceof Element && target.closest('.event-source-media-embed')) {
        return true;
    }
    return true;
}

/** @deprecated alias */
export const shouldIgnoreOverlayClickForYouTube = shouldIgnoreOverlayClickForSourceMedia;

export { resetSourceMediaMusicDuckState };
export const resetYouTubeMusicDuckState = resetSourceMediaMusicDuckState;
