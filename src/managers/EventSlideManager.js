/**
 * EventSlideManager - Handles event slide display, hiding, and variant switching
 * Extracted from UIView to reduce complexity and improve maintainability
 */

import { formatEventSlideTitleHtml } from './helpers/EventSlideShowHelpers.js';
import { getPreferredVariantIndexForActiveFilters } from './helpers/MarkerCreationHelpers.js';
/** Side effect: defines `window.EventSlideGlitchHelpers` (glitch toggle + text click delegation). */
import './helpers/EventSlideGlitchHelpers.js';
import {
    setupMobileEventSlide,
    cleanupMobileEventSlide,
    getDefaultZoom,
    resetMobileFullTextUi
} from './helpers/MobileEventSlideHelpers.js';
import { setupEarthLocation, setupMoonMarsLocation, setupStationLocation, setupMarsShipLocation, hideLocationWithFade, setupLocationClickHandler } from './helpers/LocationDisplayHelpers.js';
import { loadEventImage, setupImageFadeIn } from './helpers/ImageLoadingHelpers.js';
import { findVariantMarker, zoomToVariantLocation, createTempMarkerForCoords } from './helpers/VariantHelpers.js';
import { isEventSlideEditDevHost } from '../utils/isEventSlideEditDevHost.js';
import {
    STORY_SECONDARY_PLACES_EDITOR_OPTS,
    STORY_HERO_FILTER_PLACES_OPTS,
    STORY_FACTION_FILTER_PLACES_OPTS,
    STORY_NPC_FILTER_PLACES_OPTS,
    applyStoryFilterPlacesToTarget,
    heroPlacesForEditor,
    factionPlacesForEditor,
    npcPlacesForEditor,
    copyFilterPlaceArraysFromSource
} from '../utils/StoryFilterPlacesSync.js';

const SATELLITE_RELEVANT_PLACES_EDITOR_OPTS = {
    placeholders: {
        locationName: 'Location / group label',
        country: 'Countries (comma-separated for multiple flags)',
        reasoning: 'Relevance (e.g. headquarters, place of origin)'
    },
    autocompleteType: 'countries'
};

function isBioArchiveSource(archiveId) {
    const s = archiveId != null ? String(archiveId) : '';
    return s === 'heroes' || s === 'factions' || s === 'npcs';
}

// getHeroDisplayName removed - not used in this file

// Export mobile helpers for backward compatibility
export const MobileHelpers = {
    isMobile: () => window.innerWidth <= 768,
    isMobilePortrait: () => window.innerWidth <= 768 && window.innerHeight > window.innerWidth,
    getDefaultZoom,
    setupMobileEventSlide,
    cleanupMobileEventSlide,
    resetMobileFullTextUi
};

export class EventSlideManager {
    constructor(sceneModel, dataModel, uiView) {
        this.sceneModel = sceneModel;
        this.dataModel = dataModel;
        this.uiView = uiView; // Reference back to UIView for methods that still need to be there
        this.currentEventMarker = null;
        this.currentEventData = null;
        this.currentVariantIndex = 0;
        this.previousAutoRotateState = null;
        this.originalCameraPosition = null;
        this.originalGlobeRotation = null;

        const eventSlideEl = document.getElementById('eventSlide');
        if (eventSlideEl && typeof window.EventSlideGlitchHelpers?.bindGlitchTextClickDelegation === 'function') {
            window.EventSlideGlitchHelpers.bindGlitchTextClickDelegation(eventSlideEl, uiView);
        }

        this._inlineDescEdit = {
            active: false,
            dirty: false,
            originalText: '',
            // snapshot of what we were editing (so cancel works even if state changes)
            eventData: null,
            variantIndex: -1,

            // extended fields
            originalName: '',
            originalCityDisplayName: '',
            originalFilters: [],
            originalFactions: [],
            originalNpcs: [],
            originalSources: [],
            originalHeadlines: [],
            originalSecondaryCountryFlags: [],
            /** Index in eventManager.events when edit started (for reorder / event number) */
            eventListIndex: -1,
        };
    }

    _resolveEventListIndex(rootEvent) {
        const em = typeof window !== 'undefined' ? window.eventManager : null;
        if (!em || !Array.isArray(em.events) || !rootEvent) return -1;
        const i = em.events.indexOf(rootEvent);
        return i >= 0 ? i : -1;
    }

    _showEventSlideOrderRowForEdit() {
        const row = document.getElementById('eventSlideOrderRow');
        if (!row) return;
        row.removeAttribute('hidden');
        row.setAttribute('aria-hidden', 'false');
    }

    _hideEventSlideOrderRow() {
        const row = document.getElementById('eventSlideOrderRow');
        if (!row) return;
        row.setAttribute('hidden', '');
        row.setAttribute('aria-hidden', 'true');
    }

    _ensureSlidePlacementBlock(editor) {
        if (!editor) return;
        if (editor.querySelector('#eventSlidePlacementBlock')) return;

        if (!document.getElementById('eventSlideInlineVariantBar')) {
            // Create variant row at the very top of the editor (before city name)
            const firstRow = editor.querySelector('.event-slide-inline-editor__row');
            if (firstRow) {
                firstRow.insertAdjacentHTML('beforebegin', `
                <div class="event-slide-inline-editor__row" id="eventSlideVariantEditRow">
                    <div class="event-slide-inline-editor__label">Variants</div>
                    <div class="event-slide-inline-variant-bar" id="eventSlideInlineVariantBar"></div>
                    <p class="event-slide-inline-editor__hint">Switch tabs to edit another variant. + / − add or remove (saved when you click Save).</p>
                </div>`);
            }
        }
        const first = editor.querySelector('.event-slide-inline-editor__row');
        const html = `
                <div class="event-slide-inline-editor__placement" id="eventSlidePlacementBlock">
                <div class="event-slide-inline-editor__row" id="eventSlideCityLookupRow">
                    <label class="event-slide-inline-editor__label" for="eventSlideEditCityLookup">City name (for coordinate lookup)</label>
                    <div class="event-slide-inline-editor__lookup-row">
                        <input class="event-slide-inline-editor__input event-slide-inline-editor__input--grow" id="eventSlideEditCityLookup" type="text" spellcheck="true" autocomplete="on" />
                        <label class="event-slide-inline-editor__inline-check"><input type="checkbox" id="eventSlideUseCodeLookup" checked /> Code lookup</label>
                        <button type="button" class="event-slide-inline-editor__small-btn" id="eventSlideLookupCityBtn">Lookup</button>
                    </div>
                </div>
                <div class="event-slide-inline-editor__row">
                    <div class="event-slide-inline-editor__label">Location type</div>
                    <div class="event-slide-inline-editor__loc-types" role="group" aria-label="Location type">
                        <button type="button" class="event-slide-loc-type-btn active" data-location-type="earth">Earth</button>
                        <button type="button" class="event-slide-loc-type-btn" data-location-type="moon">Moon</button>
                        <button type="button" class="event-slide-loc-type-btn" data-location-type="mars">Mars</button>
                        <button type="button" class="event-slide-loc-type-btn" data-location-type="station">Station</button>
                        <button type="button" class="event-slide-loc-type-btn" data-location-type="marsShip">Ship</button>
                    </div>
                    <input type="hidden" id="eventSlideEditLocationType" value="earth" />
                </div>
                <div class="event-slide-inline-editor__row event-slide-inline-editor__year-row" id="eventSlideLatLonRow">
                    <div class="event-slide-inline-editor__year-cell">
                        <label class="event-slide-inline-editor__label" for="eventSlideEditLat">Latitude</label>
                        <input class="event-slide-inline-editor__input" id="eventSlideEditLat" type="number" step="any" autocomplete="off" />
                    </div>
                    <div class="event-slide-inline-editor__year-cell">
                        <label class="event-slide-inline-editor__label" for="eventSlideEditLon">Longitude</label>
                        <input class="event-slide-inline-editor__input" id="eventSlideEditLon" type="number" step="any" autocomplete="off" />
                    </div>
                </div>
                <div class="event-slide-inline-editor__row event-slide-inline-editor__year-row" id="eventSlideXyRow" style="display: none;">
                    <div class="event-slide-inline-editor__year-cell">
                        <label class="event-slide-inline-editor__label" for="eventSlideEditX">X (0–100)</label>
                        <input class="event-slide-inline-editor__input" id="eventSlideEditX" type="number" step="any" min="0" max="100" autocomplete="off" />
                    </div>
                    <div class="event-slide-inline-editor__year-cell">
                        <label class="event-slide-inline-editor__label" for="eventSlideEditY">Y (0–100)</label>
                        <input class="event-slide-inline-editor__input" id="eventSlideEditY" type="number" step="any" min="0" max="100" autocomplete="off" />
                    </div>
                </div>
                </div>`;
        if (first) {
            first.insertAdjacentHTML('beforebegin', html);
        } else {
            editor.insertAdjacentHTML('afterbegin', html);
        }
    }

    _ensureInlineDeleteRow(editor) {
        if (!editor || document.getElementById('eventSlideInlineDeleteBtn')) return;
        const row = document.createElement('div');
        row.className = 'event-slide-inline-editor__row event-slide-inline-editor__row--delete';
        row.innerHTML = '<button type="button" class="event-slide-inline-editor__delete-btn" id="eventSlideInlineDeleteBtn">Delete event</button>';
        editor.appendChild(row);
    }

    _syncSlideLocationTypeUI() {
        const hid = document.getElementById('eventSlideEditLocationType');
        const type = hid ? hid.value : 'earth';
        const latLonRow = document.getElementById('eventSlideLatLonRow');
        const xyRow = document.getElementById('eventSlideXyRow');
        const lookupRow = document.getElementById('eventSlideCityLookupRow');
        if (type === 'earth') {
            if (latLonRow) latLonRow.style.display = '';
            if (xyRow) xyRow.style.display = 'none';
            if (lookupRow) lookupRow.style.display = '';
        } else {
            if (latLonRow) latLonRow.style.display = 'none';
            if (xyRow) xyRow.style.display = '';
            if (lookupRow) lookupRow.style.display = 'none';
        }
        document.querySelectorAll('.event-slide-loc-type-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.locationType === type);
        });
    }

    _setSlideLocationTypeForEdit(locationType) {
        const hid = document.getElementById('eventSlideEditLocationType');
        if (hid) hid.value = locationType;
        this._syncSlideLocationTypeUI();
    }

    /**
     * @returns {boolean} false if validation failed (alert already shown)
     */
    _applySlidePlacementOnSave(target, rootEvent, variantIndex) {
        const hid = document.getElementById('eventSlideEditLocationType');
        const type = hid ? hid.value : 'earth';

        let lat;
        let lon;
        let x;
        let y;

        if (type === 'earth') {
            lat = parseFloat(document.getElementById('eventSlideEditLat')?.value ?? '');
            lon = parseFloat(document.getElementById('eventSlideEditLon')?.value ?? '');
            if (Number.isNaN(lat) || Number.isNaN(lon)) {
                window.alert('Please fill in latitude and longitude for Earth locations.');
                return false;
            }
        } else {
            x = parseFloat(document.getElementById('eventSlideEditX')?.value ?? '');
            y = parseFloat(document.getElementById('eventSlideEditY')?.value ?? '');
            if (Number.isNaN(x) || Number.isNaN(y) || x < 0 || x > 100 || y < 0 || y > 100) {
                window.alert('X and Y must be numbers from 0 to 100.');
                return false;
            }
        }

        target.locationType = type;
        delete target.lat;
        delete target.lon;
        delete target.x;
        delete target.y;

        if (type === 'earth') {
            target.lat = lat;
            target.lon = lon;
        } else {
            target.x = x;
            target.y = y;
        }

        const isMulti = Array.isArray(rootEvent.variants) && rootEvent.variants.length > 0;
        if (isMulti && variantIndex === 0) {
            rootEvent.locationType = type;
            delete rootEvent.lat;
            delete rootEvent.lon;
            delete rootEvent.x;
            delete rootEvent.y;
            if (type === 'earth') {
                rootEvent.lat = lat;
                rootEvent.lon = lon;
            } else {
                rootEvent.x = x;
                rootEvent.y = y;
            }
        }
        if (!isMulti) {
            rootEvent.locationType = type;
        }

        return true;
    }

    _wireSlidePlacementListeners(editor, markDirty) {
        const lookupBtn = document.getElementById('eventSlideLookupCityBtn');
        if (lookupBtn && !lookupBtn.dataset.bound) {
            lookupBtn.dataset.bound = 'true';
            lookupBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.eventManager?.lookupCitySlide) {
                    window.eventManager.lookupCitySlide();
                }
                markDirty();
            });
        }

        const locBtns = editor.querySelectorAll('.event-slide-loc-type-btn');
        locBtns.forEach((btn) => {
            if (btn.dataset.bound === 'true') return;
            btn.dataset.bound = 'true';
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const hid = document.getElementById('eventSlideEditLocationType');
                if (hid) hid.value = btn.dataset.locationType || 'earth';
                this._syncSlideLocationTypeUI();
                markDirty();
            });
        });

        const placementInputs = [
            'eventSlideEditEventNumber',
            'eventSlideEditCityLookup',
            'eventSlideUseCodeLookup',
            'eventSlideEditLat',
            'eventSlideEditLon',
            'eventSlideEditX',
            'eventSlideEditY',
        ];
        placementInputs.forEach((id) => {
            const el = document.getElementById(id);
            if (el && !el.dataset.slidePlacementDirty) {
                el.dataset.slidePlacementDirty = 'true';
                el.addEventListener('change', markDirty, { passive: true });
                el.addEventListener('input', markDirty, { passive: true });
            }
        });
    }

    _readSlideSourcesFromDom() {
        const sourcesList = document.getElementById('eventSlideEditSources');
        if (!sourcesList) return [];
        const rows = [...sourcesList.querySelectorAll('.event-slide-inline-editor__source-row')];
        const out = [];
        for (const row of rows) {
            const text = row.querySelector('[data-role="source-text"]')?.value?.trim() || '';
            const url = row.querySelector('[data-role="source-url"]')?.value?.trim() || '';
            if (!text) continue;
            out.push({ text, url: url || undefined });
        }
        return out;
    }

    /**
     * Writes timeline, placement, title/body, filters, sources, etc. to the current target (and root).
     * @returns {boolean}
     */
    _applyAllInlineFieldsToTarget() {
        const { target, eventData: rootEvent, variantIndex } = this._getCurrentDescriptionTarget();
        if (!target || !rootEvent) return false;

        const eventSlideTitle = document.getElementById('eventSlideTitle');
        const eventSlideText = document.getElementById('eventSlideText');
        if (!eventSlideTitle || !eventSlideText) return false;

        if (window.EventEditService && window.EventEditService.constructor) {
            const EC = window.EventEditService.constructor;
            const y1 = document.getElementById('eventSlideEditYearStart')?.value ?? '';
            const y2 = document.getElementById('eventSlideEditYearEnd')?.value ?? '';
            const timeline = EC.parseTimelineFormStrings(y1, y2);
            if (timeline.error) {
                window.alert(timeline.error);
                return false;
            }
            EC.applyTimelineToEvent(rootEvent, timeline);
            EC.applyEraNameToEvent(rootEvent, (document.getElementById('eventSlideEditEraName')?.value ?? '').trim());
        }

        if (!this._applySlidePlacementOnSave(target, rootEvent, variantIndex)) {
            return false;
        }

        const cityInput = document.getElementById('eventSlideEditCityDisplayName');
        const filtersInput = document.getElementById('eventSlideEditFilters');
        const factionsInput = document.getElementById('eventSlideEditFactions');
        const npcsInput = document.getElementById('eventSlideEditNpcs');
        const headlinesInput = document.getElementById('eventSlideEditHeadlines');

        const newName = (eventSlideTitle.innerText ?? eventSlideTitle.textContent ?? '').trim();
        const newText = (eventSlideText.textContent ?? '').replace(/\r\n/g, '\n');
        const newCity = (cityInput?.value || '').trim();

        let newFilters = null;
        if (filtersInput) {
            newFilters = (filtersInput.value || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
        }

        let newFactions = null;
        if (factionsInput) {
            const factionTokens = (factionsInput.value || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            const availableFactions = window.eventManager?.factions || [];
            const fh = typeof window !== 'undefined' ? window.FactionMatchHelpers : null;
            newFactions = factionTokens.map((token) => {
                const found = availableFactions.find((f) =>
                    (f?.displayName || '').toLowerCase() === token.toLowerCase()
                    || (f?.filename || '').toLowerCase() === token.toLowerCase()
                    || (fh && typeof fh.factionIdsMatch === 'function' && (
                        fh.factionIdsMatch(f.filename, token) || fh.factionIdsMatch(f.displayName, token)
                    ))
                );
                return found ? found.displayName : token;
            });
        }

        let newNpcs = null;
        if (npcsInput) {
            const npcTokens = (npcsInput.value || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            const manifestNpcs = window.eventManager?.npcs || [];
            const npcCanon = new Map(manifestNpcs.map((n) => [String(n).toLowerCase(), n]));
            newNpcs = npcTokens.map((t) => npcCanon.get(t.toLowerCase()) || t);
        }

        const headlinesLines = (headlinesInput?.value || '')
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);

        const newSources = this._readSlideSourcesFromDom();

        const archiveSrc = window.eventManager?.dataService?.getArchiveSource?.() || 'story';

        const secPlacesEl = document.getElementById('eventSlideEditSecondaryCountryPlaces');
        const places = window.HeroRelevantLocationsEditor?.collect?.(secPlacesEl) ?? [];
        if (isBioArchiveSource(archiveSrc)) {
            target.relevantLocations = places;
            delete target.secondaryCountryPlaces;
            delete target.secondaryCountryFlags;
            const bioConnEl = document.getElementById('eventSlideEditBioConnections');
            if (bioConnEl && window.BioArchiveConnectionsEditor?.collect) {
                target.connections = window.BioArchiveConnectionsEditor.collect(bioConnEl);
            }
        } else {
            target.secondaryCountryPlaces = places;
            if (window.LocationFlagHelpers?.syncSecondaryCountryFlagsOnEntity) {
                window.LocationFlagHelpers.syncSecondaryCountryFlagsOnEntity(target);
            }
        }

        const heroPlacesEl = document.getElementById('eventSlideEditHeroFilterPlaces');
        if (!isBioArchiveSource(archiveSrc) && heroPlacesEl && window.HeroRelevantLocationsEditor?.collect) {
            const hr = window.HeroRelevantLocationsEditor.collect(heroPlacesEl);
            const fr = window.HeroRelevantLocationsEditor.collect(
                document.getElementById('eventSlideEditFactionFilterPlaces')
            );
            const nr = window.HeroRelevantLocationsEditor.collect(
                document.getElementById('eventSlideEditNpcFilterPlaces')
            );
            applyStoryFilterPlacesToTarget(target, hr, fr, nr);
        } else {
            if (newFilters !== null) target.filters = newFilters;
            if (newFactions !== null) target.factions = newFactions;
            if (newNpcs !== null) target.npcs = newNpcs.length > 0 ? newNpcs : [];
        }

        if (newName) target.name = newName;
        target.description = newText;
        target.cityDisplayName = newCity || undefined;
        target.sources = newSources.length > 0 ? newSources : undefined;
        target.headlines = headlinesLines.length > 0 ? headlinesLines : undefined;

        return true;
    }

    _convertRootEventToMulti(root) {
        const v0 = {
            name: root.name || '',
            description: root.description || '',
            filters: Array.isArray(root.filters) ? [...root.filters] : [],
            factions: Array.isArray(root.factions) ? [...root.factions] : [],
            npcs: Array.isArray(root.npcs) ? [...root.npcs] : [],
            sources: root.sources ? JSON.parse(JSON.stringify(root.sources)) : undefined,
            headlines: Array.isArray(root.headlines) ? [...root.headlines] : undefined,
            locationType: root.locationType || 'earth',
            lat: root.lat,
            lon: root.lon,
            x: root.x,
            y: root.y,
            cityDisplayName: root.cityDisplayName,
            secondaryCountryFlags: Array.isArray(root.secondaryCountryFlags) ? [...root.secondaryCountryFlags] : undefined,
            secondaryCountryPlaces: Array.isArray(root.secondaryCountryPlaces)
                ? root.secondaryCountryPlaces.map((p) => ({
                      locationName: p.locationName,
                      country: p.country,
                      reasoning: p.reasoning
                  }))
                : [],
            ...copyFilterPlaceArraysFromSource(root)
        };
        const lt = v0.locationType || 'earth';
        const v1 = {
            name: '',
            description: '',
            filters: [],
            factions: [],
            npcs: [],
            sources: undefined,
            headlines: undefined,
            locationType: lt,
            heroFilterPlaces: [],
            factionFilterPlaces: [],
            npcFilterPlaces: []
        };
        if (lt === 'earth') {
            v1.lat = v0.lat;
            v1.lon = v0.lon;
        } else {
            v1.x = v0.x;
            v1.y = v0.y;
        }
        root.variants = [v0, v1];
        delete root.name;
        delete root.description;
        delete root.filters;
        delete root.factions;
        delete root.npcs;
        delete root.sources;
        delete root.headlines;
        delete root.lat;
        delete root.lon;
        delete root.x;
        delete root.y;
        delete root.secondaryCountryFlags;
        delete root.secondaryCountryPlaces;
        delete root.heroFilterPlaces;
        delete root.factionFilterPlaces;
        delete root.npcFilterPlaces;
        root.locationType = lt;
        if (v0.cityDisplayName) {
            root.cityDisplayName = v0.cityDisplayName;
        }
    }

    _collapseMultiToSingleRoot(root, keepVariant) {
        if (!keepVariant) return;
        const v = keepVariant;
        root.name = v.name || '';
        root.description = v.description || '';
        root.filters = Array.isArray(v.filters) ? [...v.filters] : [];
        root.factions = Array.isArray(v.factions) ? [...v.factions] : [];
        root.npcs = Array.isArray(v.npcs) ? [...v.npcs] : [];
        root.sources = v.sources ? JSON.parse(JSON.stringify(v.sources)) : undefined;
        root.headlines = Array.isArray(v.headlines) ? [...v.headlines] : undefined;
        root.locationType = v.locationType || root.locationType || 'earth';
        root.cityDisplayName = v.cityDisplayName;
        root.secondaryCountryFlags = Array.isArray(v.secondaryCountryFlags) && v.secondaryCountryFlags.length > 0
            ? [...v.secondaryCountryFlags]
            : undefined;
        root.secondaryCountryPlaces = Array.isArray(v.secondaryCountryPlaces)
            ? v.secondaryCountryPlaces.map((p) => ({
                  locationName: p.locationName,
                  country: p.country,
                  reasoning: p.reasoning
              }))
            : [];
        const fp = copyFilterPlaceArraysFromSource(v);
        if (fp.heroFilterPlaces.length) root.heroFilterPlaces = fp.heroFilterPlaces;
        else delete root.heroFilterPlaces;
        if (fp.factionFilterPlaces.length) root.factionFilterPlaces = fp.factionFilterPlaces;
        else delete root.factionFilterPlaces;
        if (fp.npcFilterPlaces.length) root.npcFilterPlaces = fp.npcFilterPlaces;
        else delete root.npcFilterPlaces;
        delete root.lat;
        delete root.lon;
        delete root.x;
        delete root.y;
        const lt = root.locationType;
        if (lt === 'earth') {
            if (v.lat !== undefined) root.lat = v.lat;
            if (v.lon !== undefined) root.lon = v.lon;
        } else {
            if (v.x !== undefined) root.x = v.x;
            if (v.y !== undefined) root.y = v.y;
        }
        delete root.variants;
    }

    _renderSlideInlineVariantBar() {
        const bar = document.getElementById('eventSlideInlineVariantBar');
        if (!bar || !this._inlineDescEdit.active) return;

        const eventData = this.uiView?.currentEventData || this.currentEventData;
        if (!eventData) return;

        const variants = eventData.variants && eventData.variants.length > 0
            ? eventData.variants
            : null;
        const n = variants ? variants.length : 1;
        let cur = this.uiView?.currentVariantIndex ?? this.currentVariantIndex ?? 0;
        if (cur >= n) cur = n - 1;
        if (cur < 0) cur = 0;

        bar.innerHTML = '';
        for (let i = 0; i < n; i++) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'event-slide-inline-variant-tab';
            if (i === cur) b.classList.add('active');
            b.textContent = String(i + 1);
            b.dataset.variantIndex = String(i);
            b.dataset.role = 'variant-tab';
            bar.appendChild(b);
        }
        const addB = document.createElement('button');
        addB.type = 'button';
        addB.className = 'event-slide-inline-editor__small-btn event-slide-inline-variant-action';
        addB.textContent = '+';
        addB.title = 'Add variant';
        addB.dataset.role = 'add-variant';
        bar.appendChild(addB);
        if (variants && variants.length > 1) {
            const remB = document.createElement('button');
            remB.type = 'button';
            remB.className = 'event-slide-inline-editor__small-btn event-slide-inline-variant-action event-slide-inline-variant-action--remove';
            remB.textContent = '−';
            remB.title = 'Remove current variant';
            remB.dataset.role = 'remove-variant';
            bar.appendChild(remB);
        }

        if (!bar.dataset.delegationBound) {
            bar.dataset.delegationBound = 'true';
            bar.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if (!btn || !this._inlineDescEdit.active) return;
                if (btn.dataset.role === 'variant-tab') {
                    const idx = parseInt(btn.dataset.variantIndex, 10);
                    if (!Number.isNaN(idx)) this._onInlineVariantTabSelect(idx);
                } else if (btn.dataset.role === 'add-variant') {
                    this._onInlineVariantAdd();
                } else if (btn.dataset.role === 'remove-variant') {
                    this._onInlineVariantRemove();
                }
            });
        }
    }

    _onInlineVariantTabSelect(index) {
        const cur = this.uiView?.currentVariantIndex ?? this.currentVariantIndex ?? 0;
        if (index === cur) return;
        if (!this._applyAllInlineFieldsToTarget()) return;

        this.currentVariantIndex = index;
        if (this.uiView) this.uiView.currentVariantIndex = index;
        const ed = this.uiView?.currentEventData || this.currentEventData;
        this._inlineDescEdit.variantIndex = Array.isArray(ed?.variants) && ed.variants.length > 0 ? index : -1;

        this._populateInlineEditorFieldsFromTarget();
        this._renderSlideInlineVariantBar();
        this._inlineDescEdit.dirty = true;
    }

    _onInlineVariantAdd() {
        if (!this._applyAllInlineFieldsToTarget()) return;

        const eventData = this.uiView?.currentEventData || this.currentEventData;
        if (!eventData) return;

        if (!eventData.variants || eventData.variants.length === 0) {
            this._convertRootEventToMulti(eventData);
            const newIdx = eventData.variants.length - 1;
            this.currentVariantIndex = newIdx;
            if (this.uiView) this.uiView.currentVariantIndex = newIdx;
        } else {
            const last = eventData.variants[eventData.variants.length - 1];
            const lt = last?.locationType || eventData.locationType || 'earth';
            const nv = {
                name: '',
                description: '',
                filters: [],
                factions: [],
                npcs: [],
                sources: undefined,
                headlines: undefined,
                locationType: lt,
                secondaryCountryPlaces: [],
                heroFilterPlaces: [],
                factionFilterPlaces: [],
                npcFilterPlaces: []
            };
            if (lt === 'earth') {
                nv.lat = last?.lat;
                nv.lon = last?.lon;
            } else {
                nv.x = last?.x;
                nv.y = last?.y;
            }
            if (last?.cityDisplayName) nv.cityDisplayName = last.cityDisplayName;
            eventData.variants.push(nv);
            const newIdx = eventData.variants.length - 1;
            this.currentVariantIndex = newIdx;
            if (this.uiView) this.uiView.currentVariantIndex = newIdx;
        }

        this._populateInlineEditorFieldsFromTarget();
        this._renderSlideInlineVariantBar();
        this._inlineDescEdit.dirty = true;
    }

    _onInlineVariantRemove() {
        const eventData = this.uiView?.currentEventData || this.currentEventData;
        if (!eventData?.variants || eventData.variants.length <= 1) return;
        if (!window.confirm('Remove this variant? This cannot be undone except by canceling edit without saving.')) {
            return;
        }
        if (!this._applyAllInlineFieldsToTarget()) return;

        const cur = this.uiView?.currentVariantIndex ?? this.currentVariantIndex ?? 0;
        const vars = eventData.variants;

        if (vars.length === 2) {
            const keep = vars[1 - cur];
            this._collapseMultiToSingleRoot(eventData, keep);
            this.currentVariantIndex = 0;
            if (this.uiView) this.uiView.currentVariantIndex = 0;
        } else {
            vars.splice(cur, 1);
            const newIdx = Math.min(cur, vars.length - 1);
            this.currentVariantIndex = newIdx;
            if (this.uiView) this.uiView.currentVariantIndex = newIdx;
        }

        this._populateInlineEditorFieldsFromTarget();
        this._renderSlideInlineVariantBar();
        this._inlineDescEdit.dirty = true;
    }

    /**
     * Fills inline inputs from currentEventData + currentVariantIndex (while staying in edit mode).
     */
    _populateInlineEditorFieldsFromTarget() {
        const eventData = this.uiView?.currentEventData || this.currentEventData;
        if (!eventData) return;

        const eventSlideTitle = document.getElementById('eventSlideTitle');
        const eventSlideText = document.getElementById('eventSlideText');
        const cityInput = document.getElementById('eventSlideEditCityDisplayName');
        const yearStartInput = document.getElementById('eventSlideEditYearStart');
        const yearEndInput = document.getElementById('eventSlideEditYearEnd');
        const eraNameInput = document.getElementById('eventSlideEditEraName');
        const filtersInput = document.getElementById('eventSlideEditFilters');
        const factionsInput = document.getElementById('eventSlideEditFactions');
        const npcsInput = document.getElementById('eventSlideEditNpcs');
        const headlinesInput = document.getElementById('eventSlideEditHeadlines');
        const sourcesList = document.getElementById('eventSlideEditSources');

        const isMulti = Array.isArray(eventData.variants) && eventData.variants.length > 0;
        const vIdx = isMulti ? (this.uiView?.currentVariantIndex ?? this.currentVariantIndex ?? 0) : -1;
        const target = isMulti ? (eventData.variants[vIdx] || eventData.variants[0]) : eventData;

        if (eventSlideTitle) eventSlideTitle.textContent = target.name || '';
        if (eventSlideText) eventSlideText.textContent = target.description || '';

        if (cityInput) cityInput.value = target.cityDisplayName || '';
        if (yearStartInput) yearStartInput.value = eventData.yearStart != null && eventData.yearStart !== '' ? String(eventData.yearStart) : '';
        if (yearEndInput) yearEndInput.value = eventData.yearEnd != null && eventData.yearEnd !== '' ? String(eventData.yearEnd) : '';
        if (eraNameInput) eraNameInput.value = eventData.eraName != null ? String(eventData.eraName) : '';
        if (filtersInput) filtersInput.value = (target.filters || []).join(', ');
        if (factionsInput) {
            const formSvc = window.eventManager?.formService;
            const manifest = window.eventManager?.factions?.length
                ? window.eventManager.factions
                : (window.globeController?.dataModel?.factions || []);
            factionsInput.value = formSvc && typeof formSvc.factionsArrayToFormDisplayString === 'function'
                ? formSvc.factionsArrayToFormDisplayString(target.factions || [], manifest)
                : (target.factions || []).map((f) => String(f).replace(/^\d+/, '').trim()).join(', ');
        }
        if (npcsInput) npcsInput.value = (target.npcs || []).join(', ');
        const secPlacesEl = document.getElementById('eventSlideEditSecondaryCountryPlaces');
        if (secPlacesEl && window.HeroRelevantLocationsEditor?.render) {
            const archiveSrc = window.eventManager?.dataService?.getArchiveSource?.() || 'story';
            let places = [];
            let editorOpts = STORY_SECONDARY_PLACES_EDITOR_OPTS;
            if (isBioArchiveSource(archiveSrc)) {
                places = Array.isArray(target.relevantLocations) ? target.relevantLocations : [];
                editorOpts = SATELLITE_RELEVANT_PLACES_EDITOR_OPTS;
            } else {
                places = Array.isArray(target.secondaryCountryPlaces) ? target.secondaryCountryPlaces : [];
            }
            window.HeroRelevantLocationsEditor.render(secPlacesEl, places, editorOpts);
        }
        const heroFpEl = document.getElementById('eventSlideEditHeroFilterPlaces');
        const factionFpEl = document.getElementById('eventSlideEditFactionFilterPlaces');
        const npcFpEl = document.getElementById('eventSlideEditNpcFilterPlaces');
        if (
            heroFpEl &&
            factionFpEl &&
            npcFpEl &&
            window.HeroRelevantLocationsEditor?.render
        ) {
            const archPop = window.eventManager?.dataService?.getArchiveSource?.() || 'story';
            if (!isBioArchiveSource(archPop)) {
                window.HeroRelevantLocationsEditor.render(
                    heroFpEl,
                    heroPlacesForEditor(target),
                    STORY_HERO_FILTER_PLACES_OPTS
                );
                window.HeroRelevantLocationsEditor.render(
                    factionFpEl,
                    factionPlacesForEditor(target),
                    STORY_FACTION_FILTER_PLACES_OPTS
                );
                window.HeroRelevantLocationsEditor.render(
                    npcFpEl,
                    npcPlacesForEditor(target),
                    STORY_NPC_FILTER_PLACES_OPTS
                );
            } else {
                heroFpEl.innerHTML = '';
                factionFpEl.innerHTML = '';
                npcFpEl.innerHTML = '';
            }
        }
        const bioConnPopulate = document.getElementById('eventSlideEditBioConnections');
        if (bioConnPopulate && window.BioArchiveConnectionsEditor?.render) {
            const archConn = window.eventManager?.dataService?.getArchiveSource?.() || 'story';
            if (isBioArchiveSource(archConn)) {
                const conns = Array.isArray(target.connections) ? target.connections : [];
                window.BioArchiveConnectionsEditor.render(bioConnPopulate, conns);
            } else {
                bioConnPopulate.innerHTML = '';
            }
        }
        if (headlinesInput) headlinesInput.value = (target.headlines || []).join('\n');

        if (sourcesList) {
            sourcesList.innerHTML = '';
            const srcs = Array.isArray(target.sources) && target.sources.length > 0 ? target.sources : [{ text: '', url: '' }];
            srcs.forEach((s) => {
                const row = document.createElement('div');
                row.className = 'event-slide-inline-editor__source-row';
                row.innerHTML = `
                    <input class="event-slide-inline-editor__input" data-role="source-text" type="text" placeholder="Source text" spellcheck="true" autocomplete="on" autocorrect="on" autocapitalize="sentences" />
                    <input class="event-slide-inline-editor__input" data-role="source-url" type="text" placeholder="URL (optional)" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="none" inputmode="url" />
                    <button type="button" class="event-slide-inline-editor__small-btn" data-role="source-remove" title="Remove">−</button>
                `;
                row.querySelector('[data-role="source-text"]').value = s?.text || '';
                row.querySelector('[data-role="source-url"]').value = s?.url || '';
                row.querySelector('[data-role="source-remove"]').addEventListener('click', () => {
                    row.remove();
                    this._inlineDescEdit.dirty = true;
                });
                row.querySelector('[data-role="source-text"]').addEventListener('input', () => {
                    this._inlineDescEdit.dirty = true;
                }, { passive: true });
                row.querySelector('[data-role="source-url"]').addEventListener('input', () => {
                    this._inlineDescEdit.dirty = true;
                }, { passive: true });
                sourcesList.appendChild(row);
            });
        }

        const em = window.eventManager;
        const numEl = document.getElementById('eventSlideEditEventNumber');
        if (numEl && em?.events?.length && this._inlineDescEdit.eventListIndex >= 0) {
            numEl.min = '1';
            numEl.max = String(em.events.length);
            numEl.value = String(this._inlineDescEdit.eventListIndex + 1);
        }

        const locType = target.locationType || eventData.locationType || 'earth';
        this._setSlideLocationTypeForEdit(locType);
        const latEl = document.getElementById('eventSlideEditLat');
        const lonEl = document.getElementById('eventSlideEditLon');
        const xEl = document.getElementById('eventSlideEditX');
        const yEl = document.getElementById('eventSlideEditY');
        const cityLookEl = document.getElementById('eventSlideEditCityLookup');
        if (cityLookEl) {
            cityLookEl.value = (target.cityDisplayName || eventData.cityDisplayName || '').trim();
        }
        if (latEl) latEl.value = '';
        if (lonEl) lonEl.value = '';
        if (xEl) xEl.value = '';
        if (yEl) yEl.value = '';
        if (locType === 'earth') {
            if (latEl && target.lat != null) latEl.value = String(target.lat);
            if (lonEl && target.lon != null) lonEl.value = String(target.lon);
        } else {
            if (xEl && target.x != null) xEl.value = String(target.x);
            if (yEl && target.y != null) yEl.value = String(target.y);
            if ((locType === 'station' || locType === 'marsShip') && xEl && yEl) {
                if (!String(xEl.value).trim()) xEl.value = '50';
                if (!String(yEl.value).trim()) yEl.value = '50';
            }
        }
    }

    _isInlineEditAllowed() {
        // Dev-only: localhost / 127.0.0.1 (hidden on GitHub Pages and other hosts).
        return isEventSlideEditDevHost();
    }

    _getCurrentDescriptionTarget() {
        const eventData = this.uiView?.currentEventData || this.currentEventData;
        if (!eventData) return { target: null, eventData: null, variantIndex: -1 };

        const isMultiEvent = Array.isArray(eventData.variants) && eventData.variants.length > 0;
        const variantIndex = isMultiEvent ? (this.uiView?.currentVariantIndex ?? this.currentVariantIndex ?? 0) : -1;
        const target = isMultiEvent ? (eventData.variants[variantIndex] || eventData.variants[0]) : eventData;
        return { target, eventData, variantIndex };
    }

    _ensureInlineEditControls() {
        const editBtn = document.getElementById('eventSlideEditBtn');
        const saveBtn = document.getElementById('eventSlideSaveBtn');
        const eventSlide = document.getElementById('eventSlide');
        if (!editBtn || !saveBtn || !eventSlide) return;

        const allowed = this._isInlineEditAllowed();
        if (!allowed) {
            editBtn.style.display = 'none';
            saveBtn.style.display = 'none';
            editBtn.disabled = true;
            saveBtn.disabled = true;
        } else {
            editBtn.style.display = '';
            editBtn.disabled = false;
            saveBtn.disabled = false;
            if (!this._inlineDescEdit.active) {
                saveBtn.style.display = 'none';
            }
            editBtn.style.opacity = '';
            saveBtn.style.opacity = '';
            editBtn.title = 'Edit description';
            saveBtn.title = 'Save description';
        }

        if (editBtn.dataset.inlineEditSetup === 'true') return;
        editBtn.dataset.inlineEditSetup = 'true';

        const eventSlideText = document.getElementById('eventSlideText');
        const eventSlideTitle = document.getElementById('eventSlideTitle');
        const eventSlideScrollable = document.getElementById('eventSlideScrollable');
        if (!eventSlideText) return;
        if (!eventSlideTitle) return;
        if (!eventSlideScrollable) return;

        // Create the inline editor block once (structured inputs for non-text fields).
        let editor = document.getElementById('eventSlideInlineEditor');
        if (!editor) {
            editor = document.createElement('div');
            editor.id = 'eventSlideInlineEditor';
            editor.className = 'event-slide-inline-editor';
            editor.style.display = 'none';
            editor.innerHTML = `
                <div class="event-slide-inline-editor__row">
                    <label class="event-slide-inline-editor__label" for="eventSlideEditCityDisplayName">Location label</label>
                    <input class="event-slide-inline-editor__input" id="eventSlideEditCityDisplayName" type="text" spellcheck="true" autocomplete="on" autocorrect="on" autocapitalize="sentences" />
                </div>
                <div class="event-slide-inline-editor__row event-slide-inline-editor__year-row">
                    <div class="event-slide-inline-editor__year-cell">
                        <label class="event-slide-inline-editor__label" for="eventSlideEditYearStart">First year (range)</label>
                        <input class="event-slide-inline-editor__input" id="eventSlideEditYearStart" type="number" step="1" autocomplete="off" />
                    </div>
                    <div class="event-slide-inline-editor__year-cell">
                        <label class="event-slide-inline-editor__label" for="eventSlideEditYearEnd">Second year (optional)</label>
                        <input class="event-slide-inline-editor__input" id="eventSlideEditYearEnd" type="number" step="1" autocomplete="off" />
                    </div>
                </div>
                <div class="event-slide-inline-editor__row">
                    <label class="event-slide-inline-editor__label" for="eventSlideEditEraName">Era name (optional)</label>
                    <input class="event-slide-inline-editor__input" id="eventSlideEditEraName" type="text" spellcheck="true" autocomplete="on" />
                </div>
                <div class="event-slide-inline-editor__row" id="eventSlideEditDescriptionContainer">
                    <label class="event-slide-inline-editor__label">Description</label>
                </div>
                <div class="event-slide-inline-editor__row">
                    <div class="event-slide-inline-editor__label">Relevant countries &amp; places (grouped)</div>
                    <p class="event-slide-inline-editor__hint">Add one row per group. Reorder with ↑ / ↓. Each row: group label, countries (comma-separated for multiple flags), and why they matter.</p>
                    <div class="event-slide-inline-editor__actions">
                        <button type="button" class="event-slide-inline-editor__small-btn" id="eventSlideAddSecondaryCountryPlaceBtn">+ Add group</button>
                    </div>
                    <div id="eventSlideEditSecondaryCountryPlaces" class="event-slide-inline-editor__relevant-locs" data-inline-grouped-places="1" aria-label="Secondary country groups"></div>
                </div>
                <div class="event-slide-inline-editor__row">
                    <div class="event-slide-inline-editor__label">Relevant heroes (grouped)</div>
                    <p class="event-slide-inline-editor__hint">Same pattern as countries: group label, comma-separated heroes, why they matter.</p>
                    <div class="event-slide-inline-editor__actions">
                        <button type="button" class="event-slide-inline-editor__small-btn" id="eventSlideAddHeroFilterPlaceBtn">+ Add group</button>
                    </div>
                    <div id="eventSlideEditHeroFilterPlaces" class="event-slide-inline-editor__relevant-locs" data-inline-grouped-places="1" aria-label="Hero groups"></div>
                </div>
                <div class="event-slide-inline-editor__row">
                    <div class="event-slide-inline-editor__label">Relevant factions (grouped)</div>
                    <p class="event-slide-inline-editor__hint">Group label, comma-separated factions, why they matter.</p>
                    <div class="event-slide-inline-editor__actions">
                        <button type="button" class="event-slide-inline-editor__small-btn" id="eventSlideAddFactionFilterPlaceBtn">+ Add group</button>
                    </div>
                    <div id="eventSlideEditFactionFilterPlaces" class="event-slide-inline-editor__relevant-locs" data-inline-grouped-places="1" aria-label="Faction groups"></div>
                </div>
                <div class="event-slide-inline-editor__row">
                    <div class="event-slide-inline-editor__label">Relevant NPCs (grouped)</div>
                    <p class="event-slide-inline-editor__hint">Group label, comma-separated NPCs, why they matter.</p>
                    <div class="event-slide-inline-editor__actions">
                        <button type="button" class="event-slide-inline-editor__small-btn" id="eventSlideAddNpcFilterPlaceBtn">+ Add group</button>
                    </div>
                    <div id="eventSlideEditNpcFilterPlaces" class="event-slide-inline-editor__relevant-locs" data-inline-grouped-places="1" aria-label="NPC groups"></div>
                </div>
                <div class="event-slide-inline-editor__row">
                    <label class="event-slide-inline-editor__label" for="eventSlideEditHeadlines">Headlines (one per line)</label>
                    <textarea class="event-slide-inline-editor__textarea" id="eventSlideEditHeadlines" rows="4" spellcheck="true"></textarea>
                </div>
                <div class="event-slide-inline-editor__row">
                    <div class="event-slide-inline-editor__label">Sources</div>
                    <div class="event-slide-inline-editor__sources" id="eventSlideEditSources"></div>
                    <div class="event-slide-inline-editor__actions">
                        <button type="button" class="event-slide-inline-editor__small-btn" id="eventSlideAddSourceBtn">+ Source</button>
                    </div>
                </div>
                <div class="event-slide-inline-editor__row event-slide-inline-editor__row--delete">
                    <button type="button" class="event-slide-inline-editor__delete-btn" id="eventSlideInlineDeleteBtn">Delete event</button>
                </div>
            `;

            // Insert near the top of the scrollable content (right above sources/filters).
            const sourcesSection = document.getElementById('eventSourcesSection');
            if (sourcesSection && sourcesSection.parentNode === eventSlideScrollable) {
                eventSlideScrollable.insertBefore(editor, sourcesSection);
            } else {
                eventSlideScrollable.appendChild(editor);
            }
        }

        const slideEditorRoot = document.getElementById('eventSlideInlineEditor');
        if (slideEditorRoot) {
            this._ensureSlidePlacementBlock(slideEditorRoot);
            this._ensureInlineDeleteRow(slideEditorRoot);
        }

        const inlineDeleteBtn = document.getElementById('eventSlideInlineDeleteBtn');
        if (inlineDeleteBtn && !inlineDeleteBtn.dataset.inlineDeleteWired) {
            inlineDeleteBtn.dataset.inlineDeleteWired = 'true';
            inlineDeleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!this._isInlineEditAllowed() || !this._inlineDescEdit.active) return;
                const root = this.uiView?.currentEventData || this.currentEventData;
                const em = window.eventManager;
                if (!root || !em?.events || typeof em.deleteEvent !== 'function') return;
                const idx = em.events.indexOf(root);
                if (idx < 0) return;
                if (em.deleteEvent(idx)) {
                    this.hideEventSlide();
                }
            });
        }

        const cityInput = document.getElementById('eventSlideEditCityDisplayName');
        const yearStartInput = document.getElementById('eventSlideEditYearStart');
        const yearEndInput = document.getElementById('eventSlideEditYearEnd');
        const eraNameInput = document.getElementById('eventSlideEditEraName');
        const filtersInput = document.getElementById('eventSlideEditFilters');
        const factionsInput = document.getElementById('eventSlideEditFactions');
        const npcsInput = document.getElementById('eventSlideEditNpcs');
        const headlinesInput = document.getElementById('eventSlideEditHeadlines');
        const sourcesList = document.getElementById('eventSlideEditSources');
        const addSourceBtn = document.getElementById('eventSlideAddSourceBtn');

        const markDirty = () => {
            if (!this._inlineDescEdit.active) return;
            this._inlineDescEdit.dirty = true;
        };

        const renderSourcesEditor = (sources) => {
            if (!sourcesList) return;
            sourcesList.innerHTML = '';
            const srcs = Array.isArray(sources) ? sources : [];
            const normalized = srcs.length > 0 ? srcs : [{ text: '', url: '' }];
            normalized.forEach((s, idx) => {
                const row = document.createElement('div');
                row.className = 'event-slide-inline-editor__source-row';
                row.innerHTML = `
                    <input class="event-slide-inline-editor__input" data-role="source-text" type="text" placeholder="Source text" spellcheck="true" autocomplete="on" autocorrect="on" autocapitalize="sentences" />
                    <input class="event-slide-inline-editor__input" data-role="source-url" type="text" placeholder="URL (optional)" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="none" inputmode="url" />
                    <button type="button" class="event-slide-inline-editor__small-btn" data-role="source-remove" title="Remove">−</button>
                `;
                row.querySelector('[data-role="source-text"]').value = s?.text || '';
                row.querySelector('[data-role="source-url"]').value = s?.url || '';
                row.querySelector('[data-role="source-remove"]').addEventListener('click', () => {
                    row.remove();
                    markDirty();
                });
                row.querySelector('[data-role="source-text"]').addEventListener('input', markDirty, { passive: true });
                row.querySelector('[data-role="source-url"]').addEventListener('input', markDirty, { passive: true });
                sourcesList.appendChild(row);
            });
        };

        const readSourcesEditor = () => {
            if (!sourcesList) return [];
            const rows = [...sourcesList.querySelectorAll('.event-slide-inline-editor__source-row')];
            const out = [];
            for (const row of rows) {
                const text = row.querySelector('[data-role="source-text"]')?.value?.trim() || '';
                const url = row.querySelector('[data-role="source-url"]')?.value?.trim() || '';
                if (!text) continue;
                out.push({ text, url: url || undefined });
            }
            return out;
        };

        if (addSourceBtn) {
            addSourceBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!this._inlineDescEdit.active) return;
                renderSourcesEditor([...readSourcesEditor(), { text: '', url: '' }]);
                markDirty();
            });
        }

        // Dirty tracking for structured inputs
        cityInput?.addEventListener('input', markDirty, { passive: true });
        yearStartInput?.addEventListener('input', markDirty, { passive: true });
        yearEndInput?.addEventListener('input', markDirty, { passive: true });
        eraNameInput?.addEventListener('input', markDirty, { passive: true });
        filtersInput?.addEventListener('input', markDirty, { passive: true });
        factionsInput?.addEventListener('input', markDirty, { passive: true });
        npcsInput?.addEventListener('input', markDirty, { passive: true });
        headlinesInput?.addEventListener('input', markDirty, { passive: true });

        if (slideEditorRoot && !slideEditorRoot.dataset.slidePlacementWired) {
            slideEditorRoot.dataset.slidePlacementWired = 'true';
            this._wireSlidePlacementListeners(slideEditorRoot, markDirty);
        }

        if (slideEditorRoot && !slideEditorRoot.dataset.secondaryPlacesDirtyWired) {
            slideEditorRoot.dataset.secondaryPlacesDirtyWired = 'true';
            slideEditorRoot.addEventListener(
                'input',
                (e) => {
                    if (!this._inlineDescEdit.active) return;
                    if (e.target.closest('[data-inline-grouped-places="1"]')) markDirty();
                },
                { passive: true }
            );
            slideEditorRoot.addEventListener('click', (e) => {
                if (!this._inlineDescEdit.active) return;
                if (
                    e.target.closest(
                        '[data-inline-grouped-places="1"] .event-slide-inline-editor__relevant-loc-row'
                    )
                ) {
                    markDirty();
                }
            });
        }

        // Make the description field behave like a plain-text editor.
        // This prevents browsers from inserting extra <div>/<br> nodes that can inflate blank lines.
        const insertPlainTextAtCursor = (text) => {
            const sel = window.getSelection?.();
            if (!sel || sel.rangeCount === 0) return;
            const range = sel.getRangeAt(0);
            range.deleteContents();
            const node = document.createTextNode(text);
            range.insertNode(node);
            range.setStartAfter(node);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        };

        if (eventSlideText.dataset.inlinePlainTextSetup !== 'true') {
            eventSlideText.dataset.inlinePlainTextSetup = 'true';

            eventSlideText.addEventListener('keydown', (e) => {
                if (!this._inlineDescEdit.active) return;
                if (!eventSlideText.isContentEditable) return;
                if (e.key !== 'Enter') return;
                e.preventDefault();
                insertPlainTextAtCursor('\n');
                markDirty();
            });

            eventSlideText.addEventListener('paste', (e) => {
                if (!this._inlineDescEdit.active) return;
                if (!eventSlideText.isContentEditable) return;
                e.preventDefault();
                const text = e.clipboardData?.getData('text/plain') ?? '';
                if (!text) return;
                insertPlainTextAtCursor(text.replace(/\r\n/g, '\n'));
                markDirty();
            });
        }

        editBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!this._isInlineEditAllowed()) return;

            // Toggle: if already editing, cancel (discard).
            if (this._inlineDescEdit.active) {
                this._cancelInlineDescriptionEdit();
                return;
            }

            const { target, eventData, variantIndex } = this._getCurrentDescriptionTarget();
            if (!target) return;
            if (!eventData) return;

            // Start editing
            this._inlineDescEdit.active = true;
            this._inlineDescEdit.dirty = false;
            this._inlineDescEdit.originalText = target.description || '';
            this._inlineDescEdit.originalName = target.name || '';
            this._inlineDescEdit.originalCityDisplayName = target.cityDisplayName || '';
            this._inlineDescEdit.originalFilters = Array.isArray(target.filters) ? [...target.filters] : [];
            this._inlineDescEdit.originalFactions = Array.isArray(target.factions) ? [...target.factions] : [];
            this._inlineDescEdit.originalNpcs = Array.isArray(target.npcs) ? [...target.npcs] : [];
            this._inlineDescEdit.originalSources = Array.isArray(target.sources) ? JSON.parse(JSON.stringify(target.sources)) : [];
            this._inlineDescEdit.originalHeadlines = Array.isArray(target.headlines) ? [...target.headlines] : [];
            this._inlineDescEdit.originalSecondaryCountryFlags = Array.isArray(target.secondaryCountryFlags)
                ? [...target.secondaryCountryFlags]
                : [];
            this._inlineDescEdit.eventData = eventData;
            this._inlineDescEdit.variantIndex = variantIndex;
            this._inlineDescEdit.eventListIndex = this._resolveEventListIndex(eventData);

            eventSlide.classList.add('event-slide--inline-editing');
            this._showEventSlideOrderRowForEdit();
            saveBtn.style.display = 'inline-flex';
            editBtn.textContent = 'Cancel';

            // Make title editable too (raw text, not glitched)
            eventSlideTitle.textContent = this._inlineDescEdit.originalName;
            eventSlideTitle.setAttribute('contenteditable', 'true');
            eventSlideTitle.setAttribute('spellcheck', 'true');

            // Edit description "in place" (same element/layout as display).
            // Use plain textContent so whitespace is controlled by CSS, not HTML nodes.
            eventSlideText.textContent = this._inlineDescEdit.originalText;
            eventSlideText.setAttribute('contenteditable', 'true');
            eventSlideText.setAttribute('spellcheck', 'true');

            // Move description element into the description container in the inline editor
            const descContainer = document.getElementById('eventSlideEditDescriptionContainer');
            if (descContainer && eventSlideText) {
                // Store original parent for restoration
                this._inlineDescEdit.descriptionOriginalParent = eventSlideText.parentNode;
                this._inlineDescEdit.descriptionOriginalNextSibling = eventSlideText.nextSibling;
                descContainer.appendChild(eventSlideText);
            }

            if (editor) editor.style.display = 'block';
            this._populateInlineEditorFieldsFromTarget();
            this._renderSlideInlineVariantBar();

            // Enable predictive/autocomplete behavior (same service used in EventManager edit modal).
            // Reset setup flag each time we enter edit mode so options stay in sync.
            if (filtersInput) filtersInput.dataset.autocompleteSetup = 'false';
            if (factionsInput) factionsInput.dataset.autocompleteSetup = 'false';
            const npcsInputAuto = document.getElementById('eventSlideEditNpcs');
            if (npcsInputAuto) npcsInputAuto.dataset.autocompleteSetup = 'false';
            const auto = window.eventManager?.formService?.autocompleteService || window.EventFormService?.autocompleteService;
            if (auto && typeof auto.setupAutocomplete === 'function') {
                const heroes = window.eventManager?.heroes || window.globeController?.dataModel?.heroes || [];
                const npcList = window.eventManager?.npcs || [];
                const factionList = window.eventManager?.factions?.length
                    ? window.eventManager.factions
                    : (window.globeController?.dataModel?.factions || []);
                
                if (filtersInput) auto.setupAutocomplete(filtersInput, heroes, 'heroes');
                if (factionsInput) auto.setupAutocomplete(factionsInput, factionList, 'factions');
                if (npcsInputAuto && npcList.length > 0) auto.setupAutocomplete(npcsInputAuto, npcList, 'npcs');
            }

            const addSecBtn = document.getElementById('eventSlideAddSecondaryCountryPlaceBtn');
            if (addSecBtn && window.HeroRelevantLocationsEditor?.addRow) {
                addSecBtn.onclick = () => {
                    const ar = window.eventManager?.dataService?.getArchiveSource?.() || 'story';
                    const opts = isBioArchiveSource(ar)
                        ? SATELLITE_RELEVANT_PLACES_EDITOR_OPTS
                        : STORY_SECONDARY_PLACES_EDITOR_OPTS;
                    window.HeroRelevantLocationsEditor.addRow({
                        containerId: 'eventSlideEditSecondaryCountryPlaces',
                        placeholders: opts.placeholders,
                        autocompleteType: opts.autocompleteType
                    });
                };
            }
            const addHeroBtn = document.getElementById('eventSlideAddHeroFilterPlaceBtn');
            if (addHeroBtn && window.HeroRelevantLocationsEditor?.addRow) {
                addHeroBtn.onclick = () => {
                    window.HeroRelevantLocationsEditor.addRow({
                        containerId: 'eventSlideEditHeroFilterPlaces',
                        placeholders: STORY_HERO_FILTER_PLACES_OPTS.placeholders,
                        autocompleteType: STORY_HERO_FILTER_PLACES_OPTS.autocompleteType
                    });
                };
            }
            const addFactionBtn = document.getElementById('eventSlideAddFactionFilterPlaceBtn');
            if (addFactionBtn && window.HeroRelevantLocationsEditor?.addRow) {
                addFactionBtn.onclick = () => {
                    window.HeroRelevantLocationsEditor.addRow({
                        containerId: 'eventSlideEditFactionFilterPlaces',
                        placeholders: STORY_FACTION_FILTER_PLACES_OPTS.placeholders,
                        autocompleteType: STORY_FACTION_FILTER_PLACES_OPTS.autocompleteType
                    });
                };
            }
            const addNpcBtn = document.getElementById('eventSlideAddNpcFilterPlaceBtn');
            if (addNpcBtn && window.HeroRelevantLocationsEditor?.addRow) {
                addNpcBtn.onclick = () => {
                    window.HeroRelevantLocationsEditor.addRow({
                        containerId: 'eventSlideEditNpcFilterPlaces',
                        placeholders: STORY_NPC_FILTER_PLACES_OPTS.placeholders,
                        autocompleteType: STORY_NPC_FILTER_PLACES_OPTS.autocompleteType
                    });
                };
            }

            // Track edits
            eventSlideTitle.addEventListener('input', markDirty, { passive: true });
            eventSlideText.addEventListener('input', markDirty, { passive: true });

            // Focus description textarea by default
            eventSlideText.focus();
        });

        saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!this._isInlineEditAllowed()) return;
            if (!this._inlineDescEdit.active) return;

            const archInline = window.eventManager?.dataService?.getArchiveSource?.() || 'story';
            const { target: prevDescTarget } = this._getCurrentDescriptionTarget();
            const prevBioConnections =
                isBioArchiveSource(archInline) && Array.isArray(prevDescTarget?.connections)
                    ? prevDescTarget.connections.map((c) => ({ ...c }))
                    : [];

            if (!this._applyAllInlineFieldsToTarget()) return;

            if (
                isBioArchiveSource(archInline) &&
                window.BioArchiveConnectionsSync?.syncMirrorsAfterSubjectSave &&
                window.eventManager?.events
            ) {
                const { target: savedDescTarget } = this._getCurrentDescriptionTarget();
                window.BioArchiveConnectionsSync.syncMirrorsAfterSubjectSave(
                    window.eventManager.events,
                    archInline,
                    savedDescTarget,
                    prevBioConnections
                );
            }

            const emReorder = window.eventManager;
            const startIdx = this._inlineDescEdit.eventListIndex;
            const numReorderEl = document.getElementById('eventSlideEditEventNumber');
            if (emReorder && typeof emReorder.reorderEvents === 'function' && numReorderEl && startIdx >= 0 && Array.isArray(emReorder.events)) {
                const n = parseInt(numReorderEl.value, 10);
                if (!Number.isNaN(n) && n >= 1) {
                    const newIdx = Math.min(n - 1, emReorder.events.length - 1);
                    if (newIdx !== startIdx) {
                        emReorder.reorderEvents(startIdx, newIdx);
                    }
                }
            }

            // Persist the same way EventManager does: save to localStorage via EventDataService.
            if (window.eventManager?.dataService?.saveEvents) {
                window.eventManager.dataService.saveEvents();
            }

            if (window.eventManager?.refreshGlobeEvents) {
                window.eventManager.refreshGlobeEvents();
            }

            // Exit edit mode and render display text
            this._exitInlineDescriptionEdit(true);

            // Quick feedback
            const originalLabel = saveBtn.textContent;
            saveBtn.textContent = 'Saved';
            setTimeout(() => { saveBtn.textContent = originalLabel; }, 900);
        });
    }

    _exitInlineDescriptionEdit(keepEdits) {
        const eventSlide = document.getElementById('eventSlide');
        const eventSlideText = document.getElementById('eventSlideText');
        const eventSlideTitle = document.getElementById('eventSlideTitle');
        const saveBtn = document.getElementById('eventSlideSaveBtn');
        const editBtn = document.getElementById('eventSlideEditBtn');
        const editor = document.getElementById('eventSlideInlineEditor');
        if (!eventSlideText) return;
        if (!eventSlideTitle) return;

        const { target } = this._getCurrentDescriptionTarget();
        const textToShow = keepEdits ? (target?.description || '') : (this._inlineDescEdit.originalText || '');
        const nameToShow = keepEdits ? (target?.name || '') : (this._inlineDescEdit.originalName || '');
        const getDisplayText = window.GlitchTextService
            ? (t) => window.GlitchTextService.getDisplayText(t)
            : (t) => t;
        const getDisplayEventName = window.GlitchTextService
            ? (t) => window.GlitchTextService.getDisplayEventName(t)
            : (t) => t;

        const parentEvent = this.uiView?.currentEventData || this.currentEventData;
        const nameHtml = getDisplayEventName(nameToShow);
        const titleHtml = formatEventSlideTitleHtml(nameHtml, parentEvent, this.dataModel);
        this.updateContentWithFade(eventSlideTitle, titleHtml, true);
        this.updateContentWithFade(eventSlideText, getDisplayText(textToShow), true);

        // Restore rendered paragraph visibility
        eventSlideText.removeAttribute('contenteditable');
        eventSlideText.removeAttribute('spellcheck');
        eventSlideTitle.removeAttribute('contenteditable');
        eventSlideTitle.removeAttribute('spellcheck');
        
        // Restore description element to its original location
        if (this._inlineDescEdit.descriptionOriginalParent && eventSlideText) {
            const originalParent = this._inlineDescEdit.descriptionOriginalParent;
            const originalNextSibling = this._inlineDescEdit.descriptionOriginalNextSibling;
            if (originalNextSibling) {
                originalParent.insertBefore(eventSlideText, originalNextSibling);
            } else {
                originalParent.appendChild(eventSlideText);
            }
            this._inlineDescEdit.descriptionOriginalParent = null;
            this._inlineDescEdit.descriptionOriginalNextSibling = null;
        }
        
        if (eventSlide) eventSlide.classList.remove('event-slide--inline-editing');
        this._hideEventSlideOrderRow();
        if (saveBtn) saveBtn.style.display = 'none';
        if (editBtn) editBtn.textContent = 'Edit';
        if (editor) editor.style.display = 'none';

        const variantToggles = document.getElementById('eventVariantToggles');
        const rootForToggles = this.uiView?.currentEventData || this.currentEventData;
        if (variantToggles && rootForToggles) {
            const setupVariantToggles = window.EventSlideContentHelpers?.setupVariantToggles;
            if (setupVariantToggles) {
                const isMulti = !!(rootForToggles.variants && rootForToggles.variants.length > 0);
                const curIdx = this.uiView?.currentVariantIndex ?? this.currentVariantIndex ?? 0;
                setupVariantToggles(
                    variantToggles,
                    isMulti ? rootForToggles.variants : null,
                    curIdx,
                    (idx) => this.switchEventVariant(idx, rootForToggles)
                );
            }
        }

        // After exiting edit mode (either save or cancel), ensure sources/filters reflect current target
        if (keepEdits && target) {
            this.uiView.updateEventSources(target);
            this.uiView.updateEventFilters(target);

            // Update location label based on edited cityDisplayName
            const marker = this.uiView?.currentEventMarker || this.currentEventMarker;
            const eventData = this.uiView?.currentEventData || this.currentEventData;
            const isMulti = !!(eventData?.variants && eventData.variants.length > 0);
            const eventSlideLocation = document.getElementById('eventSlideLocation');
            if (eventSlideLocation && eventData) {
                this.setupLocationDisplay(eventSlideLocation, eventData, marker, isMulti, this.uiView?.currentVariantIndex ?? this.currentVariantIndex, true);
            }
            const refreshMeta = window.EventSlideShowHelpers?.updateEventSlideTimelineMeta;
            if (typeof refreshMeta === 'function') {
                refreshMeta(eventData);
            }
        }

        this._inlineDescEdit.active = false;
        this._inlineDescEdit.dirty = false;
        this._inlineDescEdit.originalText = '';
        this._inlineDescEdit.eventData = null;
        this._inlineDescEdit.variantIndex = -1;
        this._inlineDescEdit.originalName = '';
        this._inlineDescEdit.originalCityDisplayName = '';
        this._inlineDescEdit.originalFilters = [];
        this._inlineDescEdit.originalFactions = [];
        this._inlineDescEdit.originalNpcs = [];
        this._inlineDescEdit.originalSources = [];
        this._inlineDescEdit.originalHeadlines = [];
        this._inlineDescEdit.originalSecondaryCountryFlags = [];
        this._inlineDescEdit.eventListIndex = -1;
    }

    _cancelInlineDescriptionEdit() {
        if (!this._inlineDescEdit.active) return;
        this._exitInlineDescriptionEdit(false);
    }

    // Process image path using helper
    processImagePath(imagePath) {
        const processImagePathHelper = window.EventSlideUtilityHelpers?.processImagePath;
        if (processImagePathHelper) {
            return processImagePathHelper(imagePath);
        }
        // Minimal fallback
        if (!imagePath?.trim()) return null;
        imagePath = imagePath.trim();
        if (imagePath.includes('Event Images/') && !imagePath.includes('Event%20Images/')) {
            const parts = imagePath.split(/Event Images\//);
            if (parts.length === 2) {
                let filename = parts[1];
                let previousFilename = '';
                while (filename !== previousFilename) {
                    previousFilename = filename;
                    try {
                        const decoded = decodeURIComponent(filename);
                        if (decoded !== filename) filename = decoded;
                        else break;
                    } catch (e) { break; }
                }
                imagePath = `assets/images/Archive%20data/events/${encodeURIComponent(filename)}`;
            }
        }
        return imagePath;
    }

    // Update content with fade using helper
    updateContentWithFade(element, newContent, isAlreadyOpen) {
        const updateContentWithFadeHelper = window.EventSlideUtilityHelpers?.updateContentWithFade;
        if (updateContentWithFadeHelper) {
            updateContentWithFadeHelper(element, newContent, isAlreadyOpen);
        } else {
            // Minimal fallback
            if (!element) return;
            if (isAlreadyOpen) {
                element.style.transition = 'opacity 0.2s ease';
                element.style.opacity = '0';
                setTimeout(() => {
                    element.innerHTML = newContent;
                    setTimeout(() => { element.style.opacity = '1'; }, 10);
                }, 200);
            } else {
                element.innerHTML = newContent;
                element.style.opacity = '1';
            }
        }
    }

    /**
     * Setup location display in event slide
     * @param {HTMLElement} eventSlideLocation - Location element
     * @param {Object} eventData - Event data
     * @param {Object} marker - Event marker
     * @param {boolean} isMultiEvent - Whether this is a multi-event
     * @param {number} variantIndex - Current variant index
     * @param {boolean} isAlreadyOpen - Whether slide is already open
     */
    setupLocationDisplay(eventSlideLocation, eventData, marker, isMultiEvent, variantIndex, isAlreadyOpen) {
        if (!eventSlideLocation || !eventData) return;

        let lat, lon, x, y, locationName, locationType;

        if (isMultiEvent) {
            // Use the variant index from marker if available, otherwise default to 0
            const currentVariantIndex = (marker && marker.userData && marker.userData.variantIndex !== undefined)
                ? marker.userData.variantIndex
                : variantIndex || 0;
            const currentVariant = eventData.variants[currentVariantIndex] || eventData.variants[0];
            lat = currentVariant.lat !== undefined ? currentVariant.lat : eventData.lat;
            lon = currentVariant.lon !== undefined ? currentVariant.lon : eventData.lon;
            x = currentVariant.x !== undefined ? currentVariant.x : eventData.x;
            y = currentVariant.y !== undefined ? currentVariant.y : eventData.y;
            locationName = currentVariant.cityDisplayName || eventData.cityDisplayName || null;
            locationType = currentVariant.locationType || eventData.locationType || 'earth';
        } else {
            lat = eventData.lat;
            lon = eventData.lon;
            x = eventData.x;
            y = eventData.y;
            locationName = eventData.cityDisplayName || null;
            locationType = eventData.locationType || 'earth';
        }

        // Handle different location types using helpers
        if (locationType === 'earth' && lat !== undefined && lon !== undefined && window.eventManager) {
            setupEarthLocation(eventSlideLocation, lat, lon, marker, isAlreadyOpen, locationName, true);
        } else if (locationType === 'moon' || locationType === 'mars') {
            setupMoonMarsLocation(eventSlideLocation, locationType, x, y, locationName, marker, isAlreadyOpen);
        } else if (locationType === 'station') {
            setupStationLocation(eventSlideLocation, locationName, marker, isAlreadyOpen);
        } else if (locationType === 'marsShip') {
            setupMarsShipLocation(eventSlideLocation, locationName, marker, isAlreadyOpen);
        } else {
            // No location data for other types
            hideLocationWithFade(eventSlideLocation, isAlreadyOpen);
        }
    }

    /**
     * Show event slide panel
     * @param {string} eventName - Event name
     * @param {string} imagePath - Optional image path
     * @param {string} description - Event description
     * @param {THREE.Object3D} marker - Event marker object
     * @param {Object} eventData - Event data object
     */
    showEventSlide(eventName, imagePath = null, description = null, marker = null, eventData = null) {
        // If user was inline-editing and didn't save, discard edits when switching/opening.
        this._cancelInlineDescriptionEdit();

        // Track last opened event for reopen functionality
        try {
            if (eventData && eventData.name) {
                localStorage.setItem('lastOpenedEvent', JSON.stringify({
                    name: eventData.name,
                    index: eventData.index || 0
                }));
            }
        } catch (e) {
            console.warn('Failed to save last opened event:', e);
        }

        try {
            if (typeof window.closeTimelineMusicFiltersPanelsIfOpen === 'function') {
                window.closeTimelineMusicFiltersPanelsIfOpen();
            }
        } catch (_) {}

        // Play event click sound when opening event
        if (window.SoundEffectsManager) {
            window.SoundEffectsManager.play('eventClick');
        }

        const isMultiEvent = !!(eventData && eventData.variants && eventData.variants.length > 0);
        let initialVariantIndex = 0;
        if (isMultiEvent && marker && marker.userData && marker.userData.variantIndex !== undefined) {
            initialVariantIndex = marker.userData.variantIndex;
        }
        // NOTE: Use standaloneActiveFilters instead of sceneModel.activeFilters
        const activeFilters = window.standaloneActiveFilters;
        if (activeFilters && activeFilters.size > 0 && isMultiEvent && initialVariantIndex === 0) {
            initialVariantIndex = getPreferredVariantIndexForActiveFilters(eventData, activeFilters);
        }

        if (isMultiEvent) {
            const dv = eventData.variants[initialVariantIndex] || eventData.variants[0];
            if (dv) {
                eventName = dv.name || eventName;
                if (dv.description != null) {
                    description = dv.description;
                }
                if (window.eventManager && typeof window.eventManager.getEventImagePath === 'function') {
                    const ip = window.eventManager.getEventImagePath(dv.name, dv.image);
                    if (ip) {
                        imagePath = ip;
                    }
                } else if (dv.image) {
                    imagePath = dv.image;
                }
            }
        }

        // Process image path using helper
        const processImagePathHelper = window.EventSlideUtilityHelpers?.processImagePath;
        imagePath = processImagePathHelper ? processImagePathHelper(imagePath) : this.processImagePath(imagePath);

        const eventSlide = document.getElementById('eventSlide');
        const eventSlideTitle = document.getElementById('eventSlideTitle');
        const eventSlideText = document.getElementById('eventSlideText');
        const eventImageOverlay = document.getElementById('eventImageOverlay');
        const eventImage = document.getElementById('eventImage');
        const imageToggleBtn = document.getElementById('eventImageToggle');
        const variantToggles = document.getElementById('eventVariantToggles');

        // Initialize event slide state using helper
        const initializeEventSlideState = window.EventSlideShowHelpers?.initializeEventSlideState;
        if (initializeEventSlideState) {
            initializeEventSlideState(this, marker, eventData, initialVariantIndex, this.uiView);
        } else {
            // Minimal fallback
            this.currentEventMarker = marker;
            this.currentEventData = eventData;
            this.currentVariantIndex = initialVariantIndex;
            if (this.uiView) {
                this.uiView.currentEventMarker = marker;
                this.uiView.currentEventData = eventData;
                this.uiView.currentVariantIndex = initialVariantIndex;
            }
            if (window.globeController && this.sceneModel) {
                this.previousAutoRotateState = this.sceneModel.getAutoRotateEnabled();
                this.sceneModel.setAutoRotateEnabled(true);
                this.sceneModel.setAutoRotate(false);
                this.sceneModel.eventMarker = marker;
            } else {
                this.previousAutoRotateState = null;
            }
        }

        if (eventSlide) {
            // Mutual exclusion: opening Event Info closes Filters.
            const filtersPanel = document.getElementById('filtersPanel');
            const filtersToggle = document.getElementById('filtersToggle');
            if (filtersPanel?.classList.contains('open')) {
                filtersPanel.classList.remove('open');
                filtersToggle?.classList.remove('active');
            }

            // Setup variant toggle buttons using helper
            const setupVariantToggles = window.EventSlideContentHelpers?.setupVariantToggles;
            if (setupVariantToggles) {
                setupVariantToggles(variantToggles, isMultiEvent ? eventData.variants : null, initialVariantIndex, (index) => {
                    this.switchEventVariant(index, eventData);
                });
            } else if (variantToggles) {
                // Minimal fallback
                variantToggles.style.display = isMultiEvent ? 'flex' : 'none';
                variantToggles.innerHTML = '';
                if (isMultiEvent) {
                    eventData.variants.forEach((variant, index) => {
                        const btn = document.createElement('button');
                        btn.className = 'variant-toggle-btn';
                        btn.innerHTML = (window.GlitchTextService?.getDisplayEventName(variant.name) || variant.name) || `Variant ${index + 1}`;
                        btn.dataset.variantIndex = index;
                        if (index === initialVariantIndex) btn.classList.add('active');
                        btn.addEventListener('click', () => this.switchEventVariant(index, eventData));
                        variantToggles.appendChild(btn);
                    });
                }
            }

            // Check if event slide is already open (for fade transition)
            const isAlreadyOpen = eventSlide.classList.contains('open');

            // Update event slide content using helper
            const updateEventSlideContent = window.EventSlideShowHelpers?.updateEventSlideContent;
            if (updateEventSlideContent) {
                updateEventSlideContent(this, eventName, description, eventData, marker, isMultiEvent, initialVariantIndex, isAlreadyOpen);
            } else {
                // Minimal fallback (wrap so GlitchTextService methods are called with correct this)
                const getDisplayEventName = window.GlitchTextService
                    ? (name) => window.GlitchTextService.getDisplayEventName(name)
                    : (name) => name;
                const getDisplayText = window.GlitchTextService
                    ? (text) => window.GlitchTextService.getDisplayText(text)
                    : (text) => text;
                const nameHtmlFb = getDisplayEventName(eventName);
                const titleHtmlFb = formatEventSlideTitleHtml(nameHtmlFb, eventData, this.dataModel);
                this.updateContentWithFade(eventSlideTitle, titleHtmlFb, isAlreadyOpen);
                const eventSlideLocation = document.getElementById('eventSlideLocation');
                if (eventSlideLocation && eventData) {
                    this.setupLocationDisplay(eventSlideLocation, eventData, marker, isMultiEvent, initialVariantIndex, isAlreadyOpen);
                }
                if (window.EventSlideShowHelpers && typeof window.EventSlideShowHelpers.updateEventSlideTimelineMeta === 'function') {
                    window.EventSlideShowHelpers.updateEventSlideTimelineMeta(eventData);
                }
                this.updateContentWithFade(eventSlideText, getDisplayText(description || 'Placeholder text for event information. This will be replaced with actual event details.'), isAlreadyOpen);
            }

            // Manage glitch animation using helper
            const manageGlitchAnimation = window.EventSlideGlitchHelpers?.manageGlitchAnimation;
            if (manageGlitchAnimation) {
                manageGlitchAnimation(window.GlitchTextService?.isEnabled() || false, this.uiView);
            } else {
                // Fallback
                if (window.GlitchTextService?.isEnabled()) {
                    window.GlitchTextService.startAnimation();
                    setTimeout(() => this.uiView.showHackedOverlay(), 400);
                } else {
                    window.GlitchTextService?.stopAnimation();
                }
            }

            // Get current variant or main event
            const currentEvent = isMultiEvent ? eventData.variants[this.currentVariantIndex] : eventData;

            // Handle variant markers using helper (globe only — no markers in Codex)
            if (window.globeController && this.uiView) {
                const handleVariantMarkers = window.EventSlideShowHelpers?.handleVariantMarkers;
                if (handleVariantMarkers) {
                    handleVariantMarkers(this.uiView, this.currentEventData, eventData);
                } else {
                    if (this.currentEventData && this.currentEventData !== eventData && this.currentEventData.variants?.length > 0) {
                        this.uiView.hideVariantMarkers(this.currentEventData);
                    }
                    if (eventData?.variants?.length > 0) {
                        this.uiView.showVariantMarkers(eventData);
                    }
                }
            }

            // Store event data for variant switching
            if (isMultiEvent) {
                this.currentEventData = eventData;
            }

            eventSlide.classList.add('open');
            if (eventImageOverlay) eventImageOverlay.classList.add('slide-open');
            MobileHelpers.setupMobileEventSlide();

            // Update sources and filters using helper
            const updateEventSourcesAndFilters = window.EventSlideShowHelpers?.updateEventSourcesAndFilters;
            if (updateEventSourcesAndFilters) {
                updateEventSourcesAndFilters(this.uiView, currentEvent);
            } else {
                this.uiView.updateEventSources(currentEvent);
                this.uiView.updateEventFilters(currentEvent);
                setTimeout(() => {
                    this.uiView.updateEventSources(currentEvent);
                    this.uiView.updateEventFilters(currentEvent);
                }, 100);
            }
        }

        // Initialize image overlay using helper
        const initializeImageOverlay = window.EventSlideImageHelpers?.initializeImageOverlay;
        // Default to ON (true) if not set
        const storedValue = localStorage.getItem('globalImageToggle');
        const globalImageToggleEnabled = storedValue === null ? true : storedValue !== 'false';
        
        if (initializeImageOverlay) {
            initializeImageOverlay(eventImageOverlay, eventImage, imagePath, this.uiView);
            // Respect global image toggle state
            if (globalImageToggleEnabled && this.uiView?.imageOverlayManager) {
                this.uiView.imageOverlayManager.imageToggleState = true;
                this.uiView.showImageOverlay();
            } else if (!globalImageToggleEnabled && this.uiView?.imageOverlayManager) {
                this.uiView.imageOverlayManager.imageToggleState = false;
                // Update button text to reflect global state
                const imageToggleBtn = document.getElementById('eventImageToggle');
                if (imageToggleBtn) {
                    imageToggleBtn.textContent = 'Show Image';
                }
            }
        } else if (eventImageOverlay && eventImage) {
            // Minimal fallback
            loadEventImage(eventImage, eventImageOverlay, imagePath);
            if (this.uiView?.imageOverlayManager) {
                this.uiView.imageOverlayManager.imageOverlayVisible = globalImageToggleEnabled;
                this.uiView.imageOverlayManager.imageToggleState = globalImageToggleEnabled;
            }
            if (globalImageToggleEnabled) {
                eventImageOverlay.classList.add('open');
                setupImageFadeIn(eventImage, eventImageOverlay, imagePath, () => {
                    this.uiView.disablePageNavigationButtons(true);
                }, 600);
                if (this.uiView) {
                    this.uiView.pendingImagePath = imagePath || null;
                    this.uiView.setupImageOverlayHandlers(eventImageOverlay);
                }
            }
        } else if (this.uiView?.imageOverlayManager) {
            this.uiView.imageOverlayManager.imageOverlayVisible = false;
            this.uiView.imageOverlayManager.imageToggleState = false;
        }

        // Setup image toggle button
        if (imageToggleBtn && this.uiView) {
            // Set button text based on global toggle state
            imageToggleBtn.textContent = globalImageToggleEnabled ? 'Hide Image' : 'Show Image';
            imageToggleBtn.onclick = () => this.uiView.toggleEventImage();
        }

        // Setup glitch toggle button using helper
        const glitchToggleBtn = document.getElementById('eventGlitchToggle');
        const hasOliviaColomar = window.EventSlideGlitchHelpers?.hasOliviaColomar || 
            ((eventName, description, eventData) => {
                if (eventName && /Olivia Colomar/gi.test(eventName)) return true;
                if (description && /Olivia Colomar/gi.test(description)) return true;
                return eventData?.variants?.some(v =>
                    (v.name && /Olivia Colomar/gi.test(v.name)) ||
                    (v.description && /Olivia Colomar/gi.test(v.description))
                ) || false;
            });
        const setupGlitchToggleButton = window.EventSlideGlitchHelpers?.setupGlitchToggleButton;
        if (setupGlitchToggleButton) {
            setupGlitchToggleButton(glitchToggleBtn, hasOliviaColomar(eventName, description, eventData), this.uiView);
        } else if (glitchToggleBtn) {
            // Minimal fallback
            const hasOlivia = hasOliviaColomar(eventName, description, eventData);
            if (hasOlivia) {
                glitchToggleBtn.style.display = 'inline-flex';
                glitchToggleBtn.style.visibility = 'visible';
                window.GlitchTextService?.setEnabled(true);
                if (window.EventSlideGlitchHelpers?.applyGlitchToggleButtonState) {
                    window.EventSlideGlitchHelpers.applyGlitchToggleButtonState(glitchToggleBtn, true);
                }
                glitchToggleBtn.onclick = () => this.uiView.toggleGlitchEffect();
                setTimeout(() => {
                    if (window.GlitchTextService?.isEnabled() && window.SoundEffectsManager?.play) {
                        try {
                            window.SoundEffectsManager.play('hackOn', { playbackRate: 1.2, fadeOut: true, fadeOutDuration: 500 });
                        } catch (e) { console.error('Error playing hackOn sound:', e); }
                    }
                }, 50);
            } else {
                glitchToggleBtn.style.display = 'none';
            }
        }

        // Setup close button using helper
        const closeBtn = document.getElementById('eventSlideClose');
        const setupCloseButton = window.EventSlideContentHelpers?.setupCloseButton;
        if (setupCloseButton) {
            setupCloseButton(closeBtn, () => this.hideEventSlide());
        } else if (closeBtn) {
            // Minimal fallback
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            newCloseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hideEventSlide();
            });
        }

        // Setup inline edit controls (Edit + Save next to X)
        this._ensureInlineEditControls();

        // Setup navigation buttons and reset stillness tracking
        this.uiView.setupEventNavigation();
        const resetStillnessTracking = window.EventSlideStateHelpers?.resetStillnessTracking;
        if (resetStillnessTracking) {
            resetStillnessTracking(this.uiView);
        } else {
            // Minimal fallback
            this.uiView.lastCameraPosition = null;
            this.uiView.lastGlobeRotation = null;
            this.uiView.stillnessStartTime = null;
            this.uiView.wasDragging = false;
        }
    }

    /**
     * Hide event slide panel
     */
    hideEventSlide() {
        const eventSlide = document.getElementById('eventSlide');
        // Only play sound if panel was actually open
        const wasOpen = eventSlide?.classList.contains('open');

        // Discard unsaved inline edits on close
        this._cancelInlineDescriptionEdit();

        // Stop glitch animation when hiding slide
        if (window.GlitchTextService) {
            window.GlitchTextService.stopAnimation();
        }

        // CRITICAL: Stop station/ship follow when closing event slide
        console.log('[EventSlideManager.hideEventSlide] Stopping station/ship follow');
        if (window.globeController?.interactionController) {
            window.globeController.interactionController.stopFollowingStation();
        }

        // Restore plane visibility when closing event slide
        if (window.globeController && window.globeController.interactionController) {
            window.globeController.interactionController.restorePlanesVisibility();
        }

        // CRITICAL: Reset camera to default when closing event slide
        console.log('[EventSlideManager.hideEventSlide] Resetting camera to default');
        if (window.globeController?.cameraControlService) {
            window.globeController.cameraControlService.resetCameraToDefault();
        }

        const eventImageOverlay = document.getElementById('eventImageOverlay');
        const eventImage = document.getElementById('eventImage');

        window.standaloneEventSlide?.clearSlideHistory?.();

        // Close instantly - no fade delays
        if (eventSlide) {
            eventSlide.classList.remove('open');
        }

        // On mobile: move bottom section content back and reset title position when closing
        MobileHelpers.cleanupMobileEventSlide();

        // Hide image overlay immediately
        if (eventImageOverlay) {
            eventImageOverlay.classList.remove('slide-open', 'open', 'fade-in', 'fade-out');
            eventImageOverlay.style.display = 'none';
            eventImageOverlay.style.opacity = '0';
        }

        if (eventImage) {
            eventImage.classList.remove('fade-in', 'fade-out');
            eventImage.style.display = 'none';
            eventImage.style.opacity = '0';
        }

        // Re-enable page navigation buttons when event slide is closed
        if (this.uiView && typeof this.uiView.disablePageNavigationButtons === 'function') {
            this.uiView.disablePageNavigationButtons(false);
        }

        // Hide variant markers for the current event (if it was a multi-event)
        if (
            window.globeController &&
            this.uiView &&
            this.currentEventData &&
            this.currentEventData.variants &&
            this.currentEventData.variants.length > 0
        ) {
            this.uiView.hideVariantMarkers(this.currentEventData);
        }

        // Clear current event data (sync with UIView using helper)
        const hadEventMarker = this.currentEventMarker !== null;
        this.currentEventData = null;
        this.currentEventMarker = null;
        const syncState = window.EventSlideStateHelpers?.syncStateWithUIView;
        if (syncState && this.uiView) {
            syncState(this.uiView, { currentEventData: null, currentEventMarker: null });
        } else if (this.uiView) {
            this.uiView.currentEventData = null;
            this.uiView.currentEventMarker = null;
        }

        // Only zoom out and restore camera position if we actually zoomed to an event
        // (i.e., if originalCameraPosition was set from zoomToMarker)
        // Read from uiView since zoomToMarker sets it there
        if (hadEventMarker && this.uiView && this.uiView.originalCameraPosition && window.globeController) {
            this.uiView.zoomOutFromEvent();
        } else {
            this.originalCameraPosition = null;
            this.originalGlobeRotation = null;
            if (this.uiView) {
                this.uiView.originalCameraPosition = null;
                this.uiView.originalGlobeRotation = null;
            }
        }

        if (window.globeController && this.sceneModel) {
            const restoreAutoRotateState = window.EventSlideStateHelpers?.restoreAutoRotateState;
            if (restoreAutoRotateState) {
                restoreAutoRotateState(this.sceneModel, this.previousAutoRotateState);
            } else {
                this.sceneModel.eventMarker = null;
                if (this.previousAutoRotateState !== null) {
                    this.sceneModel.setAutoRotateEnabled(this.previousAutoRotateState);
                    if (this.previousAutoRotateState) {
                        this.sceneModel.setAutoRotate(true);
                    }
                }
            }
        }
        this.previousAutoRotateState = null;

        if (this.uiView && this.uiView.imageOverlayManager) {
            this.uiView.imageOverlayManager.imageOverlayVisible = false;
            this.uiView.imageOverlayManager.imageToggleState = false;
            if (this.uiView.imageOverlayManager.imageAutoHideTimeout) {
                clearTimeout(this.uiView.imageOverlayManager.imageAutoHideTimeout);
                this.uiView.imageOverlayManager.imageAutoHideTimeout = null;
            }
        }

        const resetStillnessTracking = window.EventSlideStateHelpers?.resetStillnessTracking;
        if (this.uiView) {
            if (resetStillnessTracking) {
                resetStillnessTracking(this.uiView);
            } else {
                this.uiView.lastCameraPosition = null;
                this.uiView.lastGlobeRotation = null;
                this.uiView.stillnessStartTime = null;
                this.uiView.wasDragging = false;
            }
        }

        // Play event click sound when closing panel (only if it was actually open)
        if (wasOpen && window.SoundEffectsManager) {
            window.SoundEffectsManager.play('eventClick');
        }
    }

    /**
     * Switch to a different variant of a multi-event
     * @param {number} variantIndex - Index of variant to switch to
     * @param {Object} eventData - Event data object
     */
    switchEventVariant(variantIndex, eventData) {
        // Discard unsaved inline edits when switching variants
        this._cancelInlineDescriptionEdit();

        if (!eventData || !eventData.variants || variantIndex >= eventData.variants.length) {
            return;
        }

        const variant = eventData.variants[variantIndex];
        this.currentVariantIndex = variantIndex;
        const syncVariantIndex = window.EventSlideStateHelpers?.syncStateWithUIView;
        if (syncVariantIndex) {
            syncVariantIndex(this.uiView, { currentVariantIndex: variantIndex });
        } else {
            this.uiView.currentVariantIndex = variantIndex;
        }

        // Setup variant location using helper
        const eventSlideLocation = document.getElementById('eventSlideLocation');
        const setupVariantLocation = window.EventSlideVariantHelpers?.setupVariantLocation;
        if (setupVariantLocation) {
            setupVariantLocation(eventSlideLocation, variant, eventData, this.sceneModel, this.currentEventMarker);
        } else {
            // Minimal fallback
            const variantLat = variant.lat ?? eventData.lat;
            const variantLon = variant.lon ?? eventData.lon;
            const variantX = variant.x ?? eventData.x;
            const variantY = variant.y ?? eventData.y;
            const variantLocationType = variant.locationType || eventData.locationType || 'earth';
            const locationName = variant.cityDisplayName || eventData.cityDisplayName || null;
            const variantMarker = findVariantMarker(this.sceneModel, eventData, variantIndex);
            
            if (eventSlideLocation) {
                if (variantLocationType === 'earth' && variantLat !== undefined && variantLon !== undefined && window.eventManager) {
                    setupEarthLocation(eventSlideLocation, variantLat, variantLon, variantMarker || this.currentEventMarker, false, locationName, false);
                } else if (variantLocationType === 'moon' || variantLocationType === 'mars') {
                    setupMoonMarsLocation(eventSlideLocation, variantLocationType, variantX, variantY, locationName, variantMarker || this.currentEventMarker, false);
                } else if (variantLocationType === 'station') {
                    setupStationLocation(eventSlideLocation, locationName, variantMarker || this.currentEventMarker, false);
                } else if (variantLocationType === 'marsShip') {
                    setupMarsShipLocation(eventSlideLocation, locationName, variantMarker || this.currentEventMarker, false);
                } else {
                    hideLocationWithFade(eventSlideLocation, false);
                }
                
                if (variantMarker) {
                    setupLocationClickHandler(eventSlideLocation, variantMarker, variantLocationType);
                } else if (variantLocationType === 'earth' && variantLat !== undefined && variantLon !== undefined) {
                    const tempMarker = createTempMarkerForCoords(variantLat, variantLon);
                    if (tempMarker) setupLocationClickHandler(eventSlideLocation, tempMarker, variantLocationType);
                } else if (variantLocationType === 'moon' || variantLocationType === 'mars') {
                    setupLocationClickHandler(eventSlideLocation, { userData: { locationType: variantLocationType } }, variantLocationType);
                }
            }
            zoomToVariantLocation(variantMarker, variantLocationType, variantLat, variantLon);
        }

        // Update variant content using helper
        const updateVariantContent = window.EventSlideVariantHelpers?.updateVariantContent;
        if (updateVariantContent) {
            updateVariantContent(variant, variantIndex, this);
        } else {
            // Minimal fallback (wrap so GlitchTextService methods are called with correct this)
            const eventSlideTitle = document.getElementById('eventSlideTitle');
            const eventSlideText = document.getElementById('eventSlideText');
            const getDisplayEventName = window.GlitchTextService
                ? (name) => window.GlitchTextService.getDisplayEventName(name)
                : (name) => name;
            const getDisplayText = window.GlitchTextService
                ? (text) => window.GlitchTextService.getDisplayText(text)
                : (text) => text;
            if (eventSlideTitle) {
                const variantHtml = getDisplayEventName(variant.name) || `Variant ${variantIndex + 1}`;
                const parentEvent = this.currentEventData;
                eventSlideTitle.innerHTML = formatEventSlideTitleHtml(variantHtml, parentEvent, this.dataModel);
            }
            if (eventSlideText) eventSlideText.innerHTML = getDisplayText(variant.description || 'No description');
            
            const eventImage = document.getElementById('eventImage');
            const eventImageOverlay = document.getElementById('eventImageOverlay');
            if (eventImage && eventImageOverlay) {
                let imagePath = window.eventManager?.getEventImagePath(variant.name, variant.image) || variant.image;
                if (!imagePath?.trim()) {
                    imagePath = `assets/images/Archive%20data/events/${encodeURIComponent(variant.name.replace(/\s+/g, ' ').trim())}.png`;
                }
                const processed = this.processImagePath(imagePath);
                // Keep slide + overlay in sync: switching variants must update the pending path
                // so "Show Image" and auto-show use the correct image.
                if (this.uiView) {
                    this.uiView.pendingImagePath = processed || null;
                }
                loadEventImage(eventImage, eventImageOverlay, processed);
                // The overlay CSS keeps images at opacity:0 unless `.fade-in` is applied.
                // When switching variants we must re-trigger the fade-in so the newly loaded image becomes visible.
                setupImageFadeIn(eventImage, eventImageOverlay, processed, null, 0);

                // If the overlay is currently open, ensure we keep showing the new image.
                const mgr = this.uiView?.imageOverlayManager;
                if (mgr && mgr.imageToggleState && mgr.imageOverlayVisible) {
                    // No need to re-run full fade sequence; just keep it open.
                    eventImageOverlay.classList.add('open');
                }
            }
        }

        // Play switch event sound
        window.SoundEffectsManager?.play('switchEvent');

        // Manage glitch animation
        const manageGlitchAnimation = window.EventSlideGlitchHelpers?.manageGlitchAnimation;
        if (manageGlitchAnimation) {
            manageGlitchAnimation(window.GlitchTextService?.isEnabled() || false, this.uiView);
        } else {
            if (window.GlitchTextService?.isEnabled()) {
                window.GlitchTextService.startAnimation();
            } else {
                window.GlitchTextService?.stopAnimation();
            }
        }

        // Update sources and filters
        this.uiView.updateEventSources(variant);
        this.uiView.updateEventFilters(variant);

        // Update variant toggle buttons using helper
        const variantToggles = document.getElementById('eventVariantToggles');
        const updateVariantToggleButtons = window.EventSlideContentHelpers?.updateVariantToggleButtons;
        if (updateVariantToggleButtons) {
            updateVariantToggleButtons(variantToggles, variantIndex);
        } else if (variantToggles) {
            // Fallback
            const buttons = variantToggles.querySelectorAll('.variant-toggle-btn');
            buttons.forEach((btn, index) => {
                if (index === variantIndex) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
    }

    // Simple getters
    getCurrentEventMarker() { return this.currentEventMarker; }
    getCurrentEventData() { return this.currentEventData; }
    getCurrentVariantIndex() { return this.currentVariantIndex; }

    setOriginalCameraPosition(position, rotation) {
        this.originalCameraPosition = position;
        this.originalGlobeRotation = rotation;
        this.uiView.originalCameraPosition = position;
        this.uiView.originalGlobeRotation = rotation;
    }
    
    getOriginalCameraPosition() {
        return this.uiView.originalCameraPosition || this.originalCameraPosition;
    }
    
    getOriginalGlobeRotation() {
        return this.uiView.originalGlobeRotation || this.originalGlobeRotation;
    }
}
