/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's $name method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's 	his).
 */

import { shouldEventBeLocked } from '../../../markers/filtering/shouldEventBeLocked.js';
import { findMarkerForEvent } from '../../../markers/findMarkerForEvent.js';
import {
    centerCameraOnMarker,
    restoreCameraFromThumbnailHover
} from '../../../../Interactive-Worldview/presentation/views/ThumbnailHoverCameraHelpers.js';
import {
    updateStandaloneSliderTicks,
    eventRootSlotMissingDescription,
    eventSlotMissingDescription
} from '../../pagination/standalonePaginationFilterSync.js';
import {
    thumbPageTurnShrinkKeyframes,
    thumbPageTurnGrowKeyframes
} from '../../../dock/thumbPageTurnKeyframes.js';
import { isEventSlideEditDevHost } from '../../../info-panel/isEventSlideEditDevHost.js';
import {
    STORY_SECONDARY_PLACES_EDITOR_OPTS,
    STORY_HERO_FILTER_PLACES_OPTS,
    STORY_FACTION_FILTER_PLACES_OPTS,
    STORY_NPC_FILTER_PLACES_OPTS,
    applyStoryFilterPlacesToTarget,
    heroPlacesForEditor,
    factionPlacesForEditor,
    npcPlacesForEditor,
    copyFilterPlaceArraysFromSource,
    getStoryEventFactionTokens,
    getStoryEventHeroTokens,
    getStoryEventNpcTokens
} from '../../../utils/storyEventFilterPlaces.js';
import { readFactionTypeBioPanelTrimmed, syncFactionTypeBioPanelVisibility } from '../../../utils/bio-archive/FactionTypeBioInput.js';
import {
    readHeroRoleBioPanelTrimmed,
    readHeroSubRoleBioPanelTrimmed,
    syncHeroBioRolePanelsVisibility
} from '../../../utils/bio-archive/HeroRoleBioInputs.js';
import {
    updateEventSlideFactionTypeDisplay,
    updateEventSlideHeroRoleDisplay
} from '../../../info-panel/eventSlideMetaDisplays.js';

export function runSaveFullEdit(slide, eventData, editBtn, saveBtn) {
        if (!slide.isEditing || !slide.editTarget) return;

        const dockStoryPresentationActive = !!slide._presentationFromDockTimeline;
        const archiveSource = dockStoryPresentationActive
            ? 'story'
            : (window.eventManager?.dataService?.getArchiveSource?.() || 'story');
        const titleElEarly = document.getElementById('eventSlideTitle');
        const textElEarly = document.getElementById('eventSlideText');

        if (archiveSource !== 'story') {
            const cleanName = (titleElEarly?.textContent || '').trim();
            const cleanDesc = (textElEarly?.innerHTML || '').trim();
            const em = window.eventManager;
            const locContainer = document.getElementById('eventSlideEditRelevantLocations');
            const isBioSave =
                archiveSource === 'heroes'
                || archiveSource === 'factions'
                || archiveSource === 'npcs';
            const relevantLocations = isBioSave
                ? window.HeroRelevantLocationsEditor?.collect(locContainer) ?? []
                : undefined;
            const connections = isBioSave
                ? window.BioArchiveConnectionsEditor?.collect?.(
                      document.getElementById('eventSlideEditBioConnections')
                  ) ?? []
                : undefined;
            const normalized = isBioSave
                ? { name: cleanName, description: cleanDesc, relevantLocations, connections }
                : { name: cleanName, description: cleanDesc };
            if (archiveSource === 'factions') {
                normalized.factionType = readFactionTypeBioPanelTrimmed();
            }
            if (archiveSource === 'heroes') {
                normalized.heroRole = readHeroRoleBioPanelTrimmed();
                normalized.heroSubRole = readHeroSubRoleBioPanelTrimmed();
            }
            if (em?.events) {
                const idx =
                    window.BioArchiveConnectionsSync?.resolveBioArchiveEventIndex?.(
                        em.events,
                        slide.editTarget.eventData,
                        archiveSource
                    ) ?? em.events.indexOf(slide.editTarget.eventData);
                const oldRef = slide.editTarget.eventData;
                const prevConnections =
                    isBioSave && Array.isArray(oldRef?.connections)
                        ? oldRef.connections.map((c) => ({ ...c }))
                        : [];
                if (idx >= 0) {
                    em.events[idx] = normalized;
                    if (
                        archiveSource === 'factions' &&
                        window.FactionArchiveGroupOrderHelpers
                    ) {
                        const fgo = window.FactionArchiveGroupOrderHelpers;
                        if (
                            fgo.normalizeFactionArchiveType(oldRef?.factionType) !==
                            fgo.normalizeFactionArchiveType(normalized.factionType)
                        ) {
                            fgo.moveFactionEntryToLastInItsTypeGroup(em.events, normalized);
                        }
                    }
                    if (
                        archiveSource === 'heroes' &&
                        window.HeroArchiveRoleOrderHelpers
                    ) {
                        const hro = window.HeroArchiveRoleOrderHelpers;
                        const oldR = hro.normalizeHeroArchiveRole(oldRef?.heroRole);
                        const newR = hro.normalizeHeroArchiveRole(normalized.heroRole);
                        const oldS = hro.normalizeHeroArchiveSubrole(oldRef?.heroSubRole, oldR);
                        const newS = hro.normalizeHeroArchiveSubrole(normalized.heroSubRole, newR);
                        if (oldR !== newR) {
                            hro.moveHeroEntryToLastInItsRoleGroup(em.events, normalized);
                        }
                        if (oldR !== newR || oldS !== newS) {
                            hro.moveHeroEntryToLastInItsSubroleGroup(em.events, normalized);
                        }
                    }
                    {
                        const ni = em.events.indexOf(normalized);
                        if (ni >= 0) em.unsavedEventIndices?.add(ni);
                    }
                    if (
                        isBioSave &&
                        window.BioArchiveConnectionsSync?.syncMirrorsAfterSubjectSave
                    ) {
                        window.BioArchiveConnectionsSync.syncMirrorsAfterSubjectSave(
                            em.events,
                            archiveSource,
                            normalized,
                            prevConnections
                        );
                    }
                }
                slide.currentEventData = normalized;
                slide.editTarget.eventData = normalized;
            }
            em?.dataService?.saveEvents?.();

            if (titleElEarly) {
                titleElEarly.contentEditable = 'false';
                titleElEarly.removeAttribute('spellcheck');
            }
            if (textElEarly) {
                textElEarly.contentEditable = 'false';
                textElEarly.removeAttribute('spellcheck');
            }
            if (slide.descriptionOriginalParent && textElEarly) {
                const originalParent = slide.descriptionOriginalParent;
                const originalNextSibling = slide.descriptionOriginalNextSibling;
                if (originalNextSibling) {
                    originalParent.insertBefore(textElEarly, originalNextSibling);
                } else {
                    originalParent.appendChild(textElEarly);
                }
                slide.descriptionOriginalParent = null;
                slide.descriptionOriginalNextSibling = null;
            }
            document.getElementById('eventSlideInlineEditor')?.style && (document.getElementById('eventSlideInlineEditor').style.display = 'none');
            document.getElementById('eventSlide')?.classList.remove('event-slide--inline-editing');
            const orderRowSat = document.getElementById('eventSlideOrderRow');
            if (orderRowSat) {
                orderRowSat.setAttribute('hidden', '');
                orderRowSat.setAttribute('aria-hidden', 'true');
            }
            if (editBtn) editBtn.textContent = 'Edit';
            if (saveBtn) saveBtn.style.display = 'none';
            slide.isEditing = false;
            slide.editTarget = null;
            slide.originalState = null;
            slide.updateSourcesAndFilters(normalized);
            slide.allEvents = window.eventManager?.events || [];
            // Dock is main-timeline only; satellite saves do not change it — avoid dock thumb/page-turn refresh
            if (window.eventManager?.renderEvents) window.eventManager.renderEvents();
            const heroLocEditSaved = document.getElementById('eventSlideHeroLocationsEdit');
            if (heroLocEditSaved) {
                heroLocEditSaved.setAttribute('hidden', '');
                heroLocEditSaved.style.display = 'none';
            }
            syncFactionTypeBioPanelVisibility('story');
            syncHeroBioRolePanelsVisibility('story', undefined, undefined);
            const relSaved = document.getElementById('eventSlideRelevantLocations');
            if (isBioSave && relSaved) {
                window.LocationFlagHelpers?.updateRelevantLocationsSlideFromSecondaryPlaces?.(
                    normalized
                );
                window.LocationFlagHelpers?.updateBioConnectionsSlideFromEvent?.(normalized);
            }
            if (archiveSource === 'factions' && normalized) {
                updateEventSlideFactionTypeDisplay(
                    normalized,
                    slide.currentVariantIndex ?? 0
                );
            }
            if (archiveSource === 'heroes' && normalized) {
                updateEventSlideHeroRoleDisplay(
                    normalized,
                    slide.currentVariantIndex ?? 0
                );
            }
            if (window.SoundEffectsManager?.play) window.SoundEffectsManager.play('save');
            return;
        }
        
        // Save current variant data before saving
        slide.saveCurrentVariantData();
        
        const isMultiEvent = eventData.variants && eventData.variants.length > 0;
        const target = isMultiEvent ? eventData.variants[slide.currentVariantIndex || 0] : eventData;
        
        // Gather values from inline editor
        const cityInput = document.getElementById('eventSlideEditCityDisplayName');
        const yearStartInput = document.getElementById('eventSlideEditYearStart');
        const yearEndInput = document.getElementById('eventSlideEditYearEnd');
        const eraInput = document.getElementById('eventSlideEditEraName');
        const headlinesInput = document.getElementById('eventSlideEditHeadlines');
        const locationTypeInput = document.getElementById('eventSlideEditLocationType');
        const latInput = document.getElementById('eventSlideEditLat');
        const lonInput = document.getElementById('eventSlideEditLon');
        const xInput = document.getElementById('eventSlideEditX');
        const yInput = document.getElementById('eventSlideEditY');
        const titleEl = document.getElementById('eventSlideTitle');
        const textEl = document.getElementById('eventSlideText');
        
        // Update target
        if (target) {
            if (titleEl) target.name = titleEl.textContent || target.name;
            if (textEl) target.description = textEl.innerHTML || target.description;
            if (cityInput) target.cityDisplayName = cityInput.value;
            if (yearStartInput) target.yearStart = parseInt(yearStartInput.value) || target.yearStart;
            if (yearEndInput) target.yearEnd = parseInt(yearEndInput.value) || null;
            if (eraInput) target.eraName = eraInput.value || null;
            if (window.HeroRelevantLocationsEditor?.collect) {
                const heroFpSave = document.getElementById('eventSlideEditHeroFilterPlaces');
                const hr = heroFpSave ? window.HeroRelevantLocationsEditor.collect(heroFpSave) : [];
                const fr = window.HeroRelevantLocationsEditor.collect(
                    document.getElementById('eventSlideEditFactionFilterPlaces')
                );
                const nr = window.HeroRelevantLocationsEditor.collect(
                    document.getElementById('eventSlideEditNpcFilterPlaces')
                );
                applyStoryFilterPlacesToTarget(target, hr, fr, nr);
            }

            const secPlacesEl = document.getElementById('eventSlideEditSecondaryCountryPlaces');
            const places =
                window.HeroRelevantLocationsEditor?.collect?.(secPlacesEl) ?? [];
            target.secondaryCountryPlaces = places;
            if (window.LocationFlagHelpers?.syncSecondaryCountryFlagsOnEntity) {
                window.LocationFlagHelpers.syncSecondaryCountryFlagsOnEntity(target);
            }

            if (headlinesInput) target.headlines = headlinesInput.value.split('\n').map(s => s.trim()).filter(Boolean);
            
            // Save location type and coordinates
            const locType = locationTypeInput ? locationTypeInput.value : 'earth';
            target.locationType = locType;
            
            if (locType === 'earth') {
                const lat = latInput ? parseFloat(latInput.value) : null;
                const lon = lonInput ? parseFloat(lonInput.value) : null;
                if (!Number.isNaN(lat)) target.lat = lat;
                if (!Number.isNaN(lon)) target.lon = lon;
                delete target.x;
                delete target.y;
            } else {
                const x = xInput ? parseFloat(xInput.value) : null;
                const y = yInput ? parseFloat(yInput.value) : null;
                if (!Number.isNaN(x)) target.x = x;
                if (!Number.isNaN(y)) target.y = y;
                delete target.lat;
                delete target.lon;
            }
            
            // Gather sources
            const sourceRows = document.querySelectorAll('#eventSlideEditSources .event-slide-inline-editor__source-row');
            target.sources = Array.from(sourceRows).map(row => ({
                text: row.querySelector('[data-role="source-text"]')?.value || '',
                url: row.querySelector('[data-role="source-url"]')?.value || ''
            })).filter(s => s.text || s.url);
        }

        const emReorder = window.eventManager;
        const numReorderEl = document.getElementById('eventSlideEditEventNumber');
        if (emReorder && typeof emReorder.reorderEvents === 'function' && numReorderEl && Array.isArray(emReorder.events)) {
            const startIdx = emReorder.events.indexOf(eventData);
            if (startIdx >= 0) {
                const n = parseInt(numReorderEl.value, 10);
                if (!Number.isNaN(n) && n >= 1) {
                    const newIdx = Math.min(n - 1, emReorder.events.length - 1);
                    if (newIdx !== startIdx) {
                        emReorder.reorderEvents(startIdx, newIdx);
                    }
                }
            }
        }
        
        // Persist main-timeline rows for the dock before saveEvents() when a satellite archive
        // is active — saveEvents() only writes the active archive key; without this, story
        // dock edits never reach timelineEvents / data/events.json and vanish on reload.
        if (
            dockStoryPresentationActive &&
            (window.eventManager?.dataService?.getArchiveSource?.() || 'story') !== 'story' &&
            typeof window.eventManager?.dataService?.persistStoryDockTimelineFromSnapshot === 'function'
        ) {
            window.eventManager.dataService.persistStoryDockTimelineFromSnapshot();
        }

        // Mark as unsaved and persist to localStorage
        if (window.eventManager) {
            const idx = window.eventManager.events.indexOf(eventData);
            if (idx >= 0) {
                window.eventManager.unsavedEventIndices.add(idx);
            }
            // Persist changes to localStorage immediately
            if (window.eventManager.dataService && typeof window.eventManager.dataService.saveEvents === 'function') {
                window.eventManager.dataService.saveEvents();
            }
        }

        // Disable editing
        if (titleEl) {
            titleEl.contentEditable = 'false';
            titleEl.removeAttribute('spellcheck');
        }
        if (textEl) {
            textEl.contentEditable = 'false';
            textEl.removeAttribute('spellcheck');
        }
        
        // Restore description element to its original location
        if (slide.descriptionOriginalParent && textEl) {
            const originalParent = slide.descriptionOriginalParent;
            const originalNextSibling = slide.descriptionOriginalNextSibling;
            if (originalNextSibling) {
                originalParent.insertBefore(textEl, originalNextSibling);
            } else {
                originalParent.appendChild(textEl);
            }
            slide.descriptionOriginalParent = null;
            slide.descriptionOriginalNextSibling = null;
        }
        
        // Hide editor
        const eventSlide = document.getElementById('eventSlide');
        const editor = document.getElementById('eventSlideInlineEditor');
        if (editor) editor.style.display = 'none';
        eventSlide?.classList.remove('event-slide--inline-editing');
        const orderRowAfterSave = document.getElementById('eventSlideOrderRow');
        if (orderRowAfterSave) {
            orderRowAfterSave.setAttribute('hidden', '');
            orderRowAfterSave.setAttribute('aria-hidden', 'true');
        }

        if (editBtn) editBtn.textContent = 'Edit';
        if (saveBtn) saveBtn.style.display = 'none';
        
        slide.isEditing = false;
        slide.editTarget = null;
        slide.originalState = null;
        
        // Refresh display
        slide.updateSourcesAndFilters(target);
        
        // Do not call loadEvents() here: while viewing a satellite archive it reloads that
        // JSON from disk and can overwrite localStorage + in-memory rows unrelated to the dock.
        // While on story it re-fetches events.json and may prefer disk over timelineEvents
        // (lost edits if the dev POST failed or the file is stale). Dock rows are already updated in memory.
        slide.allEvents =
            window.eventManager?.getDockTimelineEvents?.() ||
            window.eventManager?.events ||
            [];

        if (window.eventManager?.refreshGlobeEvents) {
            try {
                window.eventManager.refreshGlobeEvents();
            } catch (err) {
                console.warn('[MenuHelpers] refreshGlobeEvents after save failed', err);
            }
        }
        
        // Regenerate slider ticks to update unfinished markers
        // Force a full regeneration by calling generateSliderTicks directly
        const ticksEl = document.getElementById('eventPageSliderTicks');
        const pageSlider = document.getElementById('eventPageSlider');
        if (ticksEl && pageSlider && slide.allEvents) {
            const totalPages = Math.max(1, Math.ceil(slide.allEvents.length / 50));
            ticksEl.innerHTML = '';
            // Call the local generateSliderTicks function
            // We need to access it from the closure - let's trigger updatePaginationUI instead
            if (slide.updatePaginationUI) {
                slide.updatePaginationUI();
            }
        }
        
        // Play sound
        if (window.SoundEffectsManager?.play) {
            window.SoundEffectsManager.play('save');
        }
}

