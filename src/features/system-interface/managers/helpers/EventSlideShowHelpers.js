/**
 * EventSlideShowHelpers - Utilities for showing event slides
 * Extracted from EventSlideManager to reduce file size and follow Small Functions principle
 */

/**
 * 1-based index of an event in the global timeline list (for title prefix).
 * @param {Object|null} eventData - Root event object (or variant object for fallback match)
 * @param {Object|null} dataModel
 * @returns {number|null}
 */
/** Resolve timeline arrays (injected dataModel may be stale vs window sync). */
function getCandidateEventLists(dataModel) {
    const lists = [];
    const push = (arr) => {
        if (Array.isArray(arr) && arr.length > 0) lists.push(arr);
    };
    if (dataModel) {
        push(typeof dataModel.getAllEvents === 'function' ? dataModel.getAllEvents() : dataModel.events);
    }
    try {
        push(window.globeController?.dataModel?.getAllEvents?.());
        push(window.globeController?.dataModel?.events);
        push(window.eventManager?.events);
    } catch (_) {}
    return lists;
}

export function getGlobalEventNumber1Based(eventData, dataModel) {
    if (!eventData) return null;
    const lists = getCandidateEventLists(dataModel);
    for (const list of lists) {
        let idx = list.indexOf(eventData);
        if (idx >= 0) return idx + 1;
        for (let i = 0; i < list.length; i++) {
            const variants = list[i]?.variants;
            if (Array.isArray(variants) && variants.includes(eventData)) return i + 1;
        }
    }
    return null;
}

/**
 * Prefix display title with global event number (HTML-safe wrapper around glitch/HTML name).
 */
export function formatEventSlideTitleHtml(displayNameHtml, eventData, dataModel) {
    if (!displayNameHtml) return displayNameHtml;
    const n = getGlobalEventNumber1Based(eventData, dataModel);
    if (n == null) return displayNameHtml;
    return `<span class="event-slide-title-number">${n}.</span> ${displayNameHtml}`;
}

/**
 * Initialize event slide state and auto-rotate
 */
export function initializeEventSlideState(eventSlideManager, marker, eventData, initialVariantIndex, uiView) {
    // Store current event marker and data
    eventSlideManager.currentEventMarker = marker;
    eventSlideManager.currentEventData = eventData;
    eventSlideManager.currentVariantIndex = initialVariantIndex;
    
    // Sync with UIView using helper
    const syncState = window.EventSlideStateHelpers?.syncStateWithUIView;
    if (syncState) {
        syncState(uiView, { 
            currentEventMarker: marker, 
            currentEventData: eventData, 
            currentVariantIndex: initialVariantIndex 
        });
    } else if (uiView) {
        uiView.currentEventMarker = marker;
        uiView.currentEventData = eventData;
        uiView.currentVariantIndex = initialVariantIndex;
    }

    const globeReady = typeof window !== 'undefined' && !!window.globeController;
    if (!globeReady) {
        eventSlideManager.previousAutoRotateState = null;
        return;
    }
    
    // Setup auto-rotate for event (globe / timeline only)
    const setupEventAutoRotate = window.EventSlideStateHelpers?.setupEventAutoRotate;
    if (setupEventAutoRotate) {
        eventSlideManager.previousAutoRotateState = setupEventAutoRotate(eventSlideManager.sceneModel, marker);
    } else if (eventSlideManager.sceneModel) {
        eventSlideManager.previousAutoRotateState = eventSlideManager.sceneModel.getAutoRotateEnabled();
        eventSlideManager.sceneModel.setAutoRotateEnabled(true);
        eventSlideManager.sceneModel.setAutoRotate(false);
        eventSlideManager.sceneModel.eventMarker = marker;
    }
}

/**
 * Update event slide content (title, location, description)
 */
export function updateEventSlideContent(eventSlideManager, eventName, description, eventData, marker, isMultiEvent, initialVariantIndex, isAlreadyOpen) {
    const eventSlideTitle = document.getElementById('eventSlideTitle');
    const eventSlideText = document.getElementById('eventSlideText');
    const eventSlideLocation = document.getElementById('eventSlideLocation');
    
    const getDisplayEventName = window.EventSlideContentHelpers?.getDisplayEventName || 
        ((name) => window.GlitchTextService?.getDisplayEventName(name) || name);
    const getDisplayText = window.EventSlideContentHelpers?.getDisplayText || 
        ((text) => window.GlitchTextService?.getDisplayText(text) || text);
    
    // Update title (global event # before name)
    if (eventSlideTitle) {
        const nameHtml = getDisplayEventName(eventName);
        const titleHtml = formatEventSlideTitleHtml(nameHtml, eventData, eventSlideManager.dataModel);
        eventSlideManager.updateContentWithFade(eventSlideTitle, titleHtml, isAlreadyOpen);
    }
    
    // Update location
    if (eventSlideLocation && eventData) {
        eventSlideManager.setupLocationDisplay(eventSlideLocation, eventData, marker, isMultiEvent, initialVariantIndex, isAlreadyOpen);
    }

    updateEventSlideTimelineMeta(eventData);
    updateEventSlideFactionTypeDisplay(eventData, initialVariantIndex);
    updateEventSlideHeroRoleDisplay(eventData, initialVariantIndex);

    // Update description
    if (eventSlideText) {
        const descriptionText = description || 'Placeholder text for event information. This will be replaced with actual event details.';
        eventSlideManager.updateContentWithFade(eventSlideText, getDisplayText(descriptionText), isAlreadyOpen);
    }
}

/**
 * Handle variant markers visibility
 */
export function handleVariantMarkers(uiView, currentEventData, eventData) {
    // Hide variant markers for previous event (if switching between events)
    if (currentEventData && currentEventData !== eventData && currentEventData.variants?.length > 0) {
        uiView.hideVariantMarkers(currentEventData);
    }
    
    // Show variant markers for this event (if it's a multi-event)
    if (eventData?.variants?.length > 0) {
        uiView.showVariantMarkers(eventData);
    }
}

/**
 * Update event sources and filters
 */
/**
 * Year line under location: "FirstYear - SecondYear", single year, or "Year Unknown".
 * @param {Object|null} eventData
 */
/** True if row shape matches factions archive (has factionType on root or any variant). */
function eventRowHasFactionTypeField(ev) {
    if (!ev || typeof ev !== 'object') return false;
    const root = ev.factionType;
    if (root != null && String(root).trim() !== '') return true;
    const vars = ev.variants;
    if (!Array.isArray(vars)) return false;
    for (let i = 0; i < vars.length; i++) {
        const ft = vars[i]?.factionType;
        if (ft != null && String(ft).trim() !== '') return true;
    }
    return false;
}

/**
 * Read-only faction archive type under the title (visible when not in satellite bio edit strip).
 * @param {Object|null} eventData
 * @param {number} [variantIndex]
 */
export function updateEventSlideFactionTypeDisplay(eventData, variantIndex) {
    const el = document.getElementById('eventSlideFactionTypeDisplay');
    if (!el) return;

    const heroStrip = document.getElementById('eventSlideHeroLocationsEdit');
    let stripVisible = false;
    if (heroStrip) {
        if (!heroStrip.hasAttribute('hidden')) {
            try {
                stripVisible = window.getComputedStyle(heroStrip).display !== 'none';
            } catch (_) {
                stripVisible = heroStrip.style.display !== 'none' && heroStrip.style.display !== '';
            }
        }
    }

    const ds = typeof window !== 'undefined' ? window.eventManager?.dataService : null;
    const arch = typeof ds?.getArchiveSource === 'function' ? ds.getArchiveSource() : '';
    const isFactionsArchive = arch === 'factions' || eventRowHasFactionTypeField(eventData);

    if (stripVisible || !eventData || !isFactionsArchive) {
        el.textContent = '';
        el.setAttribute('hidden', 'hidden');
        el.style.display = 'none';
        return;
    }

    const isMulti = Array.isArray(eventData.variants) && eventData.variants.length > 0;
    const vIdx = isMulti ? (variantIndex ?? 0) : 0;
    const target = isMulti ? (eventData.variants[vIdx] || eventData.variants[0]) : eventData;
    let raw = target?.factionType;
    if (isMulti && (raw == null || String(raw).trim() === '') && eventData.factionType != null) {
        raw = eventData.factionType;
    }
    const fgo = typeof window !== 'undefined' ? window.FactionArchiveGroupOrderHelpers : null;
    const label =
        fgo && typeof fgo.displayLabelForFactionArchiveType === 'function'
            ? fgo.displayLabelForFactionArchiveType(raw)
            : raw != null && String(raw).trim() !== ''
              ? String(raw).trim()
              : 'None';

    el.textContent = `Faction type: ${label}`;
    el.removeAttribute('hidden');
    el.style.display = '';
}

/** True if row has heroRole on root or any variant. */
function eventRowHasHeroRoleField(ev) {
    if (!ev || typeof ev !== 'object') return false;
    const root = ev.heroRole;
    if (root != null && String(root).trim() !== '') return true;
    const vars = ev.variants;
    if (!Array.isArray(vars)) return false;
    for (let i = 0; i < vars.length; i++) {
        const hr = vars[i]?.heroRole;
        if (hr != null && String(hr).trim() !== '') return true;
    }
    return false;
}

/**
 * Read-only heroes archive **Role** under the title (visible when not in satellite bio edit strip).
 * @param {Object|null} eventData
 * @param {number} [variantIndex]
 */
export function updateEventSlideHeroRoleDisplay(eventData, variantIndex) {
    const el = document.getElementById('eventSlideHeroRoleDisplay');
    if (!el) return;

    const heroStrip = document.getElementById('eventSlideHeroLocationsEdit');
    let stripVisible = false;
    if (heroStrip) {
        if (!heroStrip.hasAttribute('hidden')) {
            try {
                stripVisible = window.getComputedStyle(heroStrip).display !== 'none';
            } catch (_) {
                stripVisible = heroStrip.style.display !== 'none' && heroStrip.style.display !== '';
            }
        }
    }

    const ds = typeof window !== 'undefined' ? window.eventManager?.dataService : null;
    const arch = typeof ds?.getArchiveSource === 'function' ? ds.getArchiveSource() : '';
    const isHeroesArchive = arch === 'heroes' || eventRowHasHeroRoleField(eventData);

    if (stripVisible || !eventData || !isHeroesArchive) {
        el.textContent = '';
        el.setAttribute('hidden', 'hidden');
        el.style.display = 'none';
        return;
    }

    const isMulti = Array.isArray(eventData.variants) && eventData.variants.length > 0;
    const vIdx = isMulti ? (variantIndex ?? 0) : 0;
    const target = isMulti ? (eventData.variants[vIdx] || eventData.variants[0]) : eventData;
    let raw = target?.heroRole;
    if (isMulti && (raw == null || String(raw).trim() === '') && eventData.heroRole != null) {
        raw = eventData.heroRole;
    }
    const hro = typeof window !== 'undefined' ? window.HeroArchiveRoleOrderHelpers : null;
    const label =
        hro && typeof hro.displayLabelForHeroArchiveRole === 'function'
            ? hro.displayLabelForHeroArchiveRole(raw)
            : raw != null && String(raw).trim() !== ''
              ? String(raw).trim()
              : 'None';

    const roleNorm =
        hro && typeof hro.normalizeHeroArchiveRole === 'function'
            ? hro.normalizeHeroArchiveRole(raw)
            : '';
    let rawSub = target?.heroSubRole;
    if (isMulti && (rawSub == null || String(rawSub).trim() === '') && eventData.heroSubRole != null) {
        rawSub = eventData.heroSubRole;
    }
    const subNorm =
        hro && typeof hro.normalizeHeroArchiveSubrole === 'function'
            ? hro.normalizeHeroArchiveSubrole(rawSub, roleNorm)
            : '';
    let line = `Role: ${label}`;
    if (
        subNorm &&
        hro &&
        typeof hro.displayLabelForHeroArchiveSubrole === 'function'
    ) {
        const subDisp = hro.displayLabelForHeroArchiveSubrole(rawSub, roleNorm);
        if (subDisp && subDisp !== 'None') line = `Role: ${label} · ${subDisp}`;
    }
    el.textContent = line;
    el.removeAttribute('hidden');
    el.style.display = '';
}

export function updateEventSlideTimelineMeta(eventData) {
    const helpers = typeof window !== 'undefined' ? window.EventTimelineHelpers : null;
    const line =
        helpers && typeof helpers.formatPanelYearRangeLine === 'function'
            ? helpers.formatPanelYearRangeLine(eventData)
            : 'Year Unknown';

    const eraEl = document.getElementById('eventSlideEra');
    if (eraEl) {
        eraEl.textContent = '';
        eraEl.classList.add('event-slide-era-heading--empty');
        eraEl.setAttribute('aria-hidden', 'true');
    }

    const timelineMeta = document.getElementById('eventSlideTimelineMeta');
    if (!timelineMeta) return;

    timelineMeta.textContent = line;
    timelineMeta.style.display = '';
}

export function updateEventSourcesAndFilters(uiView, currentEvent) {
    uiView.updateEventSources(currentEvent);
    uiView.updateEventFilters(currentEvent);
    // Also update after a delay to ensure DOM is ready
    setTimeout(() => {
        uiView.updateEventSources(currentEvent);
        uiView.updateEventFilters(currentEvent);
    }, 100);
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.EventSlideShowHelpers) {
        window.EventSlideShowHelpers = {};
    }
    window.EventSlideShowHelpers.initializeEventSlideState = initializeEventSlideState;
    window.EventSlideShowHelpers.updateEventSlideContent = updateEventSlideContent;
    window.EventSlideShowHelpers.updateEventSlideTimelineMeta = updateEventSlideTimelineMeta;
    window.EventSlideShowHelpers.updateEventSlideFactionTypeDisplay = updateEventSlideFactionTypeDisplay;
    window.EventSlideShowHelpers.updateEventSlideHeroRoleDisplay = updateEventSlideHeroRoleDisplay;
    window.EventSlideShowHelpers.handleVariantMarkers = handleVariantMarkers;
    window.EventSlideShowHelpers.updateEventSourcesAndFilters = updateEventSourcesAndFilters;
    window.EventSlideShowHelpers.getGlobalEventNumber1Based = getGlobalEventNumber1Based;
    window.EventSlideShowHelpers.formatEventSlideTitleHtml = formatEventSlideTitleHtml;
}
