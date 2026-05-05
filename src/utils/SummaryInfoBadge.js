/**
 * Summary Info Badge - Shows event preview when hovering over events (mirrors music "now playing" badge).
 */

import { getEraHoverPreviewSlug } from './EraHoverPreviewTheme.js';

/**
 * Side-dock Event Manager uses `.open` on #eventsManagePanel. Data Archive also sets `.open` while
 * centered (`.story-viewer-panel-embedded`) — suppress the hover badge only for the dock drawer.
 */
function isEventsManageDockDrawerOpen() {
    try {
        const p = document.getElementById('eventsManagePanel');
        return !!(p && p.classList.contains('open') && !p.classList.contains('story-viewer-panel-embedded'));
    } catch (_) {
        return false;
    }
}

let badgeEl = null;
let textNumberEl = null;
let textTitleEl = null;
let textEraEl = null;
let textVariantsEl = null;
let hoverPreviewFollowCleanup = null;

function stopHoverPreviewFollow() {
    if (hoverPreviewFollowCleanup) {
        try {
            hoverPreviewFollowCleanup();
        } catch (_) {}
        hoverPreviewFollowCleanup = null;
    }
}

function getBodyScale() {
    try {
        const t = window.getComputedStyle(document.body).transform;
        if (!t || t === 'none') return 1;
        const m = t.match(/^matrix\(([^)]+)\)$/);
        if (!m) return 1;
        const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
        const a = parts[0];
        return Number.isFinite(a) && a > 0 ? a : 1;
    } catch (_) {
        return 1;
    }
}

function isEventImageOverlayOpen() {
    try {
        const overlay = document.getElementById('eventImageOverlay');
        return !!(overlay && overlay.classList.contains('open'));
    } catch (_) {
        return false;
    }
}

/** Last successful hover payload so we can re-show after overlay closes without a new mouseenter. */
let lastStickySummaryShow = null;
let imageOverlaySummaryRestoreMo = null;

function cloneStickyShowArgs(
    eventNum,
    plainEventName,
    otherVariantNames,
    eraName,
    primaryRowFlag,
    otherRowFlags,
    yearLine
) {
    const ov = Array.isArray(otherVariantNames) ? [...otherVariantNames] : [];
    const flags = Array.isArray(otherRowFlags)
        ? otherRowFlags.map((f) => (f && typeof f === 'object' ? { ...f } : f))
        : [];
    const prim = primaryRowFlag && typeof primaryRowFlag === 'object' ? { ...primaryRowFlag } : primaryRowFlag;
    return [
        eventNum,
        plainEventName,
        ov,
        eraName != null ? String(eraName) : '',
        prim,
        flags,
        yearLine,
    ];
}

function tryRestoreStickySummaryBadge() {
    if (!lastStickySummaryShow || isEventImageOverlayOpen() || isEventsManageDockDrawerOpen()) return;
    try {
        if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
            return;
        }
    } catch (_) {}
    const args = lastStickySummaryShow.args;
    if (!Array.isArray(args) || args.length < 7) return;
    showSummaryInfo(...args);
}

function ensureImageOverlaySummaryRestoreObserver() {
    if (imageOverlaySummaryRestoreMo) return;
    const overlay = document.getElementById('eventImageOverlay');
    if (!overlay || typeof MutationObserver === 'undefined') return;
    let wasOpen = overlay.classList.contains('open');
    imageOverlaySummaryRestoreMo = new MutationObserver(() => {
        const open = overlay.classList.contains('open');
        if (wasOpen && !open) {
            requestAnimationFrame(() => {
                tryRestoreStickySummaryBadge();
            });
        }
        wasOpen = open;
    });
    imageOverlaySummaryRestoreMo.observe(overlay, { attributes: true, attributeFilter: ['class'] });
}

let textPrimaryFlagSlot = null;
let textEraNameEl = null;
let textEraYearsEl = null;

function fillLineFlagSlot(slotEl, entry) {
    if (!slotEl) return;
    slotEl.innerHTML = '';
    const lh = typeof window !== 'undefined' ? window.LocationFlagHelpers : null;
    if (entry && entry.filename && lh && typeof lh.flagSrc === 'function') {
        const img = document.createElement('img');
        img.className = 'summary-info-flag';
        img.src = lh.flagSrc(String(entry.filename).trim());
        img.alt = entry.alt != null ? String(entry.alt).trim() : '';
        img.decoding = 'async';
        img.setAttribute('aria-hidden', 'true');
        slotEl.appendChild(img);
        slotEl.style.display = '';
    } else {
        slotEl.style.display = 'none';
    }
}

function ensureBadge() {
    if (badgeEl) return badgeEl;
    badgeEl = document.createElement('div');
    badgeEl.id = 'summaryInfoBadge';
    badgeEl.className = 'music-now-playing-badge summary-info-badge';
    badgeEl.style.zIndex = '40';
    badgeEl.setAttribute('aria-hidden', 'true');
    badgeEl.innerHTML = `
        <div class="summary-info-stack">
            <div class="summary-info-era" aria-hidden="true">
                <span class="summary-info-era__name"></span>
                <span class="summary-info-era__years"></span>
            </div>
            <div class="summary-info-mainline">
                <span class="summary-info-number" aria-hidden="true"></span>
                <div class="summary-info-title-column">
                    <div class="summary-info-title-row">
                        <div class="summary-info-line-flag summary-info-line-flag--primary" aria-hidden="true"></div>
                        <span class="summary-info-title"></span>
                    </div>
                    <div class="summary-info-variants" aria-hidden="true"></div>
                </div>
            </div>
            <img class="summary-info-underline" src="assets/images/misc/Badge Underline.png" alt="" aria-hidden="true" />
        </div>
    `;
    document.body.appendChild(badgeEl);
    textPrimaryFlagSlot = badgeEl.querySelector('.summary-info-line-flag--primary');
    textNumberEl = badgeEl.querySelector('.summary-info-number');
    textTitleEl = badgeEl.querySelector('.summary-info-title');
    textEraEl = badgeEl.querySelector('.summary-info-era');
    textEraNameEl = badgeEl.querySelector('.summary-info-era__name');
    textEraYearsEl = badgeEl.querySelector('.summary-info-era__years');
    textVariantsEl = badgeEl.querySelector('.summary-info-variants');
    return badgeEl;
}

function positionBadge() {
    const headerHub = document.getElementById('headerHub');
    if (!badgeEl) return;

    const anchorEl = headerHub;
    if (!anchorEl) return;

    const scale = getBodyScale();
    const rect = anchorEl.getBoundingClientRect();
    const gap = 2;
    
    // Anchor against the current center stage width (main#content), not viewport.
    // This makes badge position slide with panel open/close layout changes.
    const contentRect = document.getElementById('content')?.getBoundingClientRect() || null;
    const vw = Math.max(1, (window.innerWidth || 1) / scale);
    const rightPos = contentRect
        ? ((vw - ((contentRect.left + (contentRect.width * 0.2)) / scale)))
        : (vw * 0.8);

    const top = (rect.bottom + gap) / scale;

    badgeEl.style.left = '';
    badgeEl.style.right = `${rightPos}px`;
    badgeEl.style.top = `${top}px`;
}

/** Plain-text event title for hover preview (strips HTML from name). */
export function getPlainEventTitleForHover(eventObj) {
    if (!eventObj) return '';
    const raw = (eventObj.name != null ? String(eventObj.name) : '').trim();
    if (!raw) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = raw;
    const t = (tmp.textContent || tmp.innerText || '').trim();
    return t || raw.replace(/<[^>]+>/g, '');
}

/**
 * Extract country name from cityDisplayName (e.g., "London, United Kingdom" -> "United Kingdom")
 * @param {string} cityDisplayName
 * @returns {string}
 */
function extractCountryFromCityDisplayName(cityDisplayName) {
    if (!cityDisplayName || typeof cityDisplayName !== 'string') return '';
    const parts = cityDisplayName.split(',');
    if (parts.length >= 2) {
        return parts[parts.length - 1].trim();
    }
    return '';
}

function buildRowFlagEntry(eventObj, variantIndex, getLN, lh) {
    if (!eventObj || !lh || typeof lh.getFlagLocationContext !== 'function' || typeof lh.getResolvedFlagFilename !== 'function') {
        return null;
    }
    const ctx = lh.getFlagLocationContext(eventObj, variantIndex, getLN);
    const fn = lh.getResolvedFlagFilename(ctx.locationDisplayText, ctx.displayLocationType);
    if (!fn) return null;
    return { filename: fn, alt: extractCountryFromCityDisplayName(ctx.locationDisplayText) || '' };
}

/**
 * Same flag rules as event list / slide: LocationFlagHelpers.getFlagLocationContext + getResolvedFlagFilename.
 * Multi-variant: one flag per row (parallel to each variant title), not deduped.
 * @param {Object|null} eventObj
 * @param {{ variantIndex?: number }} [options] - Globe markers pass marker.userData.variantIndex (for single-event / root only).
 * @returns {{ primary: string, otherVariants: string[], era: string, primaryRowFlag: object|null, otherRowFlags: (object|null)[], yearLine: string }}
 */
export function getHoverPreviewLines(eventObj, options) {
    if (!eventObj) {
        return {
            primary: '',
            otherVariants: [],
            era: '',
            primaryRowFlag: null,
            otherRowFlags: [],
            yearLine: 'Year Unknown',
        };
    }
    const era =
        typeof window !== 'undefined'
        && window.EventTimelineHelpers
        && typeof window.EventTimelineHelpers.getEraNameTrimmed === 'function'
            ? window.EventTimelineHelpers.getEraNameTrimmed(eventObj)
            : '';
    const yearLine =
        typeof window !== 'undefined'
        && window.EventTimelineHelpers
        && typeof window.EventTimelineHelpers.formatPanelYearRangeLine === 'function'
            ? window.EventTimelineHelpers.formatPanelYearRangeLine(eventObj)
            : 'Year Unknown';

    const getLN =
        typeof window !== 'undefined'
        && window.eventManager
        && typeof window.eventManager.getLocationName === 'function'
            ? (lat, lon) => window.eventManager.getLocationName(lat, lon)
            : null;
    const lh = typeof window !== 'undefined' ? window.LocationFlagHelpers : null;

    const variants = Array.isArray(eventObj.variants) ? eventObj.variants : [];

    if (variants.length === 0) {
        const single = getPlainEventTitleForHover(eventObj);
        const vi = options && options.variantIndex !== undefined ? options.variantIndex : undefined;
        const primaryRowFlag = buildRowFlagEntry(eventObj, vi, getLN, lh);
        return {
            primary: single || '',
            otherVariants: [],
            era,
            primaryRowFlag,
            otherRowFlags: [],
            yearLine,
        };
    }
    const variantTitles = variants.map((v, i) => {
        const t = v ? getPlainEventTitleForHover(v) : '';
        return t && t.trim() ? t.trim() : `Variant ${i + 1}`;
    });
    const parentName = getPlainEventTitleForHover(eventObj);
    const primary = variantTitles[0] || parentName || 'Event';
    const otherVariants = variantTitles.slice(1);
    const primaryRowFlag = buildRowFlagEntry(eventObj, 0, getLN, lh);
    const otherRowFlags = otherVariants.map((_, j) => buildRowFlagEntry(eventObj, j + 1, getLN, lh));
    return { primary, otherVariants, era, primaryRowFlag, otherRowFlags, yearLine };
}

/**
 * @param {number|null|undefined} globalNumber1Based
 * @param {string} titlePlain - Primary line (e.g. first variant or single event name)
 * @param {string[]} [otherVariantTitles] - Additional variant names (smaller text)
 * @param {string} [eraPlain] - Optional era name (root event field); shown under title on hover only
 * @param {object|null} [primaryRowFlag] - Flag before primary title
 * @param {(object|null)[]} [otherRowFlags] - One optional flag per extra variant row (same order as otherVariantTitles)
 * @param {string} [yearLinePlain] - Years after era (smaller); default "Year Unknown"
 */
export function showSummaryInfo(
    eventNum,
    plainEventName,
    otherVariantNames,
    eraName,
    primaryRowFlag,
    otherRowFlags,
    yearLine
) {
    const badgeEl = ensureBadge();
    ensureImageOverlaySummaryRestoreObserver();
    if (isEventImageOverlayOpen()) return;
    try {
        if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
            return;
        }
    } catch (_) {}
    if (isEventsManageDockDrawerOpen()) return;

    // Cancel any pending hide cleanup when showing new content
    cancelPendingHideCleanup();

    ensureBadge();

    // Remove hiding state if present
    badgeEl.classList.remove('summary-info-badge--hiding');

    fillLineFlagSlot(textPrimaryFlagSlot, primaryRowFlag);
    
    if (textNumberEl) {
        textNumberEl.textContent =
            eventNum != null && Number.isFinite(eventNum)
                ? String(eventNum)
                : '';
    }
    if (textTitleEl) textTitleEl.textContent = plainEventName || '';

    const eraTrim = eraName != null ? String(eraName).trim() : '';
    const yearTrim =
        yearLine != null && String(yearLine).trim() !== ''
            ? String(yearLine).trim()
            : 'Year Unknown';

    if (textEraNameEl) {
        textEraNameEl.textContent = eraTrim;
        const eraSlug = getEraHoverPreviewSlug(eraTrim);
        if (eraSlug) {
            textEraNameEl.setAttribute('data-era', eraSlug);
        } else {
            textEraNameEl.removeAttribute('data-era');
        }
    }
    if (textEraYearsEl) {
        textEraYearsEl.textContent = yearTrim;
    }
    if (textEraEl) {
        textEraEl.style.display = '';
        textEraEl.classList.toggle('summary-info-era--nameless', !eraTrim);
    }
    if (badgeEl) {
        badgeEl.classList.toggle('summary-info-badge--no-era', !eraTrim);
    }

    const titlesRaw = Array.isArray(otherVariantNames) ? otherVariantNames : [];
    const flagsParallel = Array.isArray(otherRowFlags) ? otherRowFlags : [];
    let variantRowCount = 0;
    if (textVariantsEl) {
        textVariantsEl.innerHTML = '';
        titlesRaw.forEach((tRaw, idx) => {
            const t = tRaw != null ? String(tRaw).trim() : '';
            if (!t) return;
            variantRowCount++;
            const row = document.createElement('div');
            row.className = 'summary-info-variant-line';
            const flagSlot = document.createElement('div');
            flagSlot.className = 'summary-info-line-flag summary-info-line-flag--secondary';
            fillLineFlagSlot(flagSlot, flagsParallel[idx] || null);
            const span = document.createElement('span');
            span.className = 'summary-info-variant-text';
            span.textContent = t;
            row.appendChild(flagSlot);
            row.appendChild(span);
            textVariantsEl.appendChild(row);
        });
        textVariantsEl.style.display = variantRowCount ? 'block' : 'none';
    }
    if (badgeEl) {
        badgeEl.classList.toggle('summary-info-badge--multiline', variantRowCount > 0);
    }

    badgeEl.classList.add('music-now-playing-badge--visible');
    positionBadge();

    lastStickySummaryShow = {
        args: cloneStickyShowArgs(
            eventNum,
            plainEventName,
            otherVariantNames,
            eraName,
            primaryRowFlag,
            otherRowFlags,
            yearLine
        ),
    };

    stopHoverPreviewFollow();
    let pending = null;
    const schedule = () => {
        if (pending != null) return;
        pending = requestAnimationFrame(() => {
            pending = null;
            if (!badgeEl || !badgeEl.classList.contains('music-now-playing-badge--visible')) return;
            if (isEventImageOverlayOpen()) {
                hideSummaryInfo({ clearSticky: false });
                return;
            }
            if (isEventsManageDockDrawerOpen()) {
                hideSummaryInfo();
                return;
            }
            positionBadge();
        });
    };
    const onScroll = () => schedule();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    const observerTargets = [
        document.getElementById('filtersPanel'),
        document.getElementById('eventSlide'),
        document.getElementById('eventsManagePanel'),
        document.querySelector('.layout-container'),
    ].filter(Boolean);
    let mo = null;
    if (typeof MutationObserver !== 'undefined' && observerTargets.length > 0) {
        mo = new MutationObserver(() => schedule());
        observerTargets.forEach((el) => mo.observe(el, { attributes: true, attributeFilter: ['class', 'style'] }));
    }
    // Get header hub directly (button is now in dock rail, not header)
    const hub = document.getElementById('headerHub');
    if (hub) hub.addEventListener('scroll', onScroll);
    hoverPreviewFollowCleanup = () => {
        window.removeEventListener('scroll', onScroll, true);
        window.removeEventListener('resize', onScroll);
        if (hub) hub.removeEventListener('scroll', onScroll);
        if (mo) mo.disconnect();
        if (pending != null) {
            cancelAnimationFrame(pending);
            pending = null;
        }
    };
}

let hideTimeoutId = null;

function cancelPendingHideCleanup() {
    if (hideTimeoutId) {
        clearTimeout(hideTimeoutId);
        hideTimeoutId = null;
    }
}

/**
 * @param {{ clearSticky?: boolean }} [opts] - Pass `{ clearSticky: false }` when hiding only because the image overlay opened (pointer may still be over the same hover target).
 */
export function hideSummaryInfo(opts) {
    const clearSticky = !(opts && opts.clearSticky === false);
    if (clearSticky) {
        lastStickySummaryShow = null;
    }
    stopHoverPreviewFollow();
    if (!badgeEl) return;
    
    // Clear any pending hide cleanup
    cancelPendingHideCleanup();
    
    // Add hiding class to trigger slide-out animation
    badgeEl.classList.add('summary-info-badge--hiding');
    badgeEl.classList.remove('music-now-playing-badge--visible');
    
    // Delay the cleanup until after the slide-out animation completes (200ms + buffer)
    hideTimeoutId = setTimeout(() => {
        hideTimeoutId = null;
        if (!badgeEl) return;
        // Only clean up if still in hiding state (not re-shown)
        if (!badgeEl.classList.contains('music-now-playing-badge--visible')) {
            if (textPrimaryFlagSlot) {
                textPrimaryFlagSlot.innerHTML = '';
                textPrimaryFlagSlot.style.display = 'none';
            }
            if (textEraNameEl) {
                textEraNameEl.textContent = '';
                textEraNameEl.removeAttribute('data-era');
            }
            if (textEraYearsEl) textEraYearsEl.textContent = '';
            if (textEraEl) {
                textEraEl.style.display = '';
                textEraEl.classList.remove('summary-info-era--nameless');
            }
            if (textVariantsEl) {
                textVariantsEl.innerHTML = '';
                textVariantsEl.style.display = 'none';
            }
            badgeEl.classList.remove('summary-info-badge--multiline');
            badgeEl.classList.remove('summary-info-badge--no-era');
            badgeEl.classList.remove('summary-info-badge--hiding');
        }
    }, 250);
}

/**
 * Cleanup function to reset module state when unloading
 * This allows the badge to be recreated on next load
 */
export function cleanupSummaryInfo() {
    if (imageOverlaySummaryRestoreMo) {
        try {
            imageOverlaySummaryRestoreMo.disconnect();
        } catch (_) {}
        imageOverlaySummaryRestoreMo = null;
    }
    lastStickySummaryShow = null;
    stopHoverPreviewFollow();
    if (badgeEl && badgeEl.parentNode) {
        badgeEl.parentNode.removeChild(badgeEl);
    }
    badgeEl = null;
    textNumberEl = null;
    textTitleEl = null;
    textEraEl = null;
    textVariantsEl = null;
    textPrimaryFlagSlot = null;
    textEraNameEl = null;
    textEraYearsEl = null;
    cancelPendingHideCleanup();
}

if (typeof window !== 'undefined') {
    window.SummaryInfoBadge = {
        show: showSummaryInfo,
        hide: hideSummaryInfo,
        getPlainTitle: getPlainEventTitleForHover,
        getHoverPreviewLines: getHoverPreviewLines,
        cleanup: cleanupSummaryInfo
    };
}
