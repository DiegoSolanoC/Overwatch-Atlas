/**
 * Compact event preview card markup for the story merge picker (mirrors Event Manager cards).
 */

import { storyEventDescriptionPreview } from './mergeStoryEvents.js';

/**
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * @param {unknown} event
 * @returns {string|null}
 */
function resolveMergeEventImagePath(event) {
    if (!event || typeof event !== 'object') return null;
    const name = String(event.name || '').trim();
    const image = event.image != null ? String(event.image) : '';

    if (typeof window !== 'undefined') {
        if (window.NavigationImageHelpers?.getEventImagePath) {
            return window.NavigationImageHelpers.getEventImagePath(event, name, 'story');
        }
        if (window.eventManager?.getEventImagePath) {
            return window.eventManager.getEventImagePath(name, image, 'story');
        }
    }

    if (image.trim()) return image.trim();
    return null;
}

/**
 * @param {unknown} event
 * @returns {string}
 */
function formatMergeEventYearLine(event) {
    if (!event || typeof event !== 'object') return 'Year unknown';
    const helpers = typeof window !== 'undefined' ? window.EventTimelineHelpers : null;
    if (helpers?.formatPanelYearRangeLine) {
        return helpers.formatPanelYearRangeLine(event);
    }
    const start = event.yearStart;
    const end = event.yearEnd;
    if (start != null && end != null && start !== end) return `${start} – ${end}`;
    if (start != null) return String(start);
    return 'Year unknown';
}

/**
 * @param {unknown} event
 * @returns {string}
 */
function formatMergeEventLocation(event) {
    if (!event || typeof event !== 'object') return '—';
    const city = String(event.cityDisplayName || '').trim();
    if (city) return city;
    if (event.lat != null && event.lon != null) {
        return `${Number(event.lat).toFixed(2)}, ${Number(event.lon).toFixed(2)}`;
    }
    return '—';
}

/**
 * @param {unknown} event
 * @returns {string}
 */
export function renderMergeEventPreviewCard(event) {
    if (!event || typeof event !== 'object') {
        return '<article class="story-events-merge-card story-events-merge-card--empty">No event data</article>';
    }

    const title = escapeHtml(String(event.name || '(unnamed event)'));
    const location = escapeHtml(formatMergeEventLocation(event));
    const yearLine = escapeHtml(formatMergeEventYearLine(event));
    const description = escapeHtml(storyEventDescriptionPreview(event));
    const imagePath = resolveMergeEventImagePath(event);

    const imageHtml = imagePath
        ? `<div class="event-item-preview-image story-events-merge-card__image"><img src="${escapeHtml(imagePath)}" alt="" loading="lazy" decoding="async" /></div>`
        : `<div class="event-item-preview-image story-events-merge-card__image story-events-merge-card__image--empty">No Image</div>`;

    return `
        <article class="story-events-merge-card">
            <div class="story-events-merge-card__thumb">
                ${imageHtml}
            </div>
            <div class="story-events-merge-card__body">
                <div class="event-item-heading">
                    <h3 class="event-item-title">${title}</h3>
                </div>
                <div class="event-item-meta">
                    <p class="event-item-location">${location}</p>
                    <p class="event-item-year">${yearLine}</p>
                </div>
                <p class="event-item-description">${description}</p>
            </div>
        </article>
    `;
}
