/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's startFullEdit method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

import { syncFactionTypeBioPanelVisibility } from '../../../interface-shared/bio-archive/FactionTypeBioInput.js';
import { syncHeroBirthdayBioPanelVisibility } from '../../../interface-shared/bio-archive/HeroBirthdayBioInput.js';
import { syncHeroBioRolePanelsVisibility } from '../../../interface-shared/bio-archive/HeroRoleBioInputs.js';
import {
    STORY_SECONDARY_PLACES_EDITOR_OPTS,
    STORY_HERO_FILTER_PLACES_OPTS,
    STORY_FACTION_FILTER_PLACES_OPTS,
    STORY_NPC_FILTER_PLACES_OPTS
} from '../../../interface-shared/storyEventFilterPlaces.js';

function resolveLiveArchiveEventData(slide, fallbackEventData) {
    const api = typeof window !== 'undefined' ? window.BioArchiveSlideEventData : null;
    if (api && typeof api.resolveLiveArchiveEventDataForSlide === 'function') {
        return api.resolveLiveArchiveEventDataForSlide(slide, fallbackEventData);
    }
    const em = window.eventManager;
    const list = em && em.events;
    const idx = slide && slide.currentEventIndex;
    if (Array.isArray(list) && typeof idx === 'number' && idx >= 0 && idx < list.length && list[idx]) {
        return list[idx];
    }
    return fallbackEventData;
}

export function runStartFullEdit(slide, eventData, displayEvent, editBtn, saveBtn) {
            const liveEventData = resolveLiveArchiveEventData(slide, eventData);
            slide.isEditing = true;
            slide.editTarget = { eventData: liveEventData, displayEvent };
            slide.originalState = JSON.parse(JSON.stringify(liveEventData));

            const dockStoryPresentationActive = !!slide._presentationFromDockTimeline;
            const archiveSourceEdit = dockStoryPresentationActive
                ? 'story'
                : (window.eventManager?.dataService?.getArchiveSource?.() || 'story');
            const isSatelliteArchive = !dockStoryPresentationActive && archiveSourceEdit !== 'story';
            
            // Initialize variant index
            const isMulti = Array.isArray(eventData.variants) && eventData.variants.length > 0;
            slide.currentVariantIndex = isMulti ? 0 : -1;
            
            const eventSlide = document.getElementById('eventSlide');
            const eventSlideScrollable = document.getElementById('eventSlideScrollable');
            const titleEl = document.getElementById('eventSlideTitle');
            const textEl = document.getElementById('eventSlideText');
            
            // Add editing class
            eventSlide?.classList.add('event-slide--inline-editing');
            const orderRow = document.getElementById('eventSlideOrderRow');
            if (!isSatelliteArchive && orderRow) {
                orderRow.removeAttribute('hidden');
                orderRow.setAttribute('aria-hidden', 'false');
            }

            // Make title and description editable
            if (titleEl) {
                titleEl.contentEditable = 'true';
                titleEl.setAttribute('spellcheck', 'true');
            }
            if (textEl) {
                const plainDesc = (textEl.innerText ?? textEl.textContent ?? '').replace(/\r\n/g, '\n');
                textEl.textContent = plainDesc;
                textEl.contentEditable = 'true';
                textEl.setAttribute('spellcheck', 'true');
            }
            
            // Create or show inline editor
            let editor = document.getElementById('eventSlideInlineEditor');
            if (!editor) {
                editor = slide.createInlineEditor();
                eventSlideScrollable?.insertBefore(editor, eventSlideScrollable.firstChild);
            }
            editor.style.display = isSatelliteArchive ? 'none' : 'block';
            
            // Move description into the inline editor (story) or bio strip (satellite heroes/factions/npcs)
            const descContainer = document.getElementById('eventSlideEditDescriptionContainer');
            const isBioEditEarly =
                archiveSourceEdit === 'heroes'
                || archiveSourceEdit === 'factions'
                || archiveSourceEdit === 'npcs';
            const bioDescHost = document.getElementById('eventSlideBioDescriptionEditHost');
            if (!isSatelliteArchive && descContainer && textEl) {
                slide.descriptionOriginalParent = textEl.parentNode;
                slide.descriptionOriginalNextSibling = textEl.nextSibling;
                descContainer.appendChild(textEl);
            } else if (isSatelliteArchive && isBioEditEarly && bioDescHost && textEl) {
                if (textEl.parentNode !== bioDescHost) {
                    slide.descriptionOriginalParent = textEl.parentNode;
                    slide.descriptionOriginalNextSibling = textEl.nextSibling;
                    bioDescHost.appendChild(textEl);
                }
            }
            
            // Populate editor fields
            if (!isSatelliteArchive) {
                slide.populateInlineEditor(eventData, displayEvent);
            }
            
            // Enable predictive/autocomplete behavior (same service used in EventManager edit modal)
            const filtersInput = document.getElementById('eventSlideEditFilters');
            const factionsInput = document.getElementById('eventSlideEditFactions');
            const npcsInput = document.getElementById('eventSlideEditNpcs');
            
            const relElHero = document.getElementById('eventSlideRelevantLocations');
            const relSectionHero = document.getElementById('eventRelevantLocationsSection');
            const heroLocEdit = document.getElementById('eventSlideHeroLocationsEdit');
            const locContainer = document.getElementById('eventSlideEditRelevantLocations');
            const isBioEdit =
                archiveSourceEdit === 'heroes'
                || archiveSourceEdit === 'factions'
                || archiveSourceEdit === 'npcs';
            if (isSatelliteArchive && isBioEdit) {
                if (relElHero) {
                    relElHero.innerHTML = '';
                }
                if (relSectionHero) relSectionHero.style.display = 'none';
                if (heroLocEdit && locContainer && window.HeroRelevantLocationsEditor?.render) {
                    heroLocEdit.removeAttribute('hidden');
                    heroLocEdit.style.display = 'block';
                    const locs = Array.isArray(liveEventData?.relevantLocations)
                        ? liveEventData.relevantLocations
                        : [];
                    window.HeroRelevantLocationsEditor.render(locContainer, locs);
                    const addBtn = document.getElementById('eventSlideAddRelevantLocationBtn');
                    if (addBtn) {
                        addBtn.onclick = () =>
                            window.HeroRelevantLocationsEditor?.addRow?.();
                    }
                    const connContainer = document.getElementById('eventSlideEditBioConnections');
                    if (connContainer && window.BioArchiveConnectionsEditor?.render) {
                        const conns = Array.isArray(liveEventData?.connections)
                            ? liveEventData.connections
                            : [];
                        const bioOpts =
                            window.BioArchiveConnectionsEditor?.subjectOptsFromArchiveRow?.(
                                liveEventData,
                                archiveSourceEdit
                            ) || { subjectName: '', subjectKind: 'hero' };
                        window.BioArchiveConnectionsEditor.render(connContainer, conns, bioOpts);
                    }
                }
                syncFactionTypeBioPanelVisibility(
                    archiveSourceEdit,
                    archiveSourceEdit === 'factions'
                        ? slide.editTarget?.eventData?.factionType
                        : undefined
                );
                syncHeroBioRolePanelsVisibility(
                    archiveSourceEdit,
                    archiveSourceEdit === 'heroes'
                        ? slide.editTarget?.eventData?.heroRole
                        : undefined,
                    archiveSourceEdit === 'heroes'
                        ? slide.editTarget?.eventData?.heroSubRole
                        : undefined
                );
                syncHeroBirthdayBioPanelVisibility(
                    archiveSourceEdit,
                    archiveSourceEdit === 'heroes'
                        ? slide.editTarget?.eventData?.birthday
                        : undefined
                );
            } else if (heroLocEdit) {
                heroLocEdit.setAttribute('hidden', '');
                heroLocEdit.style.display = 'none';
                syncFactionTypeBioPanelVisibility('story');
                syncHeroBioRolePanelsVisibility('story', undefined, undefined);
                syncHeroBirthdayBioPanelVisibility('story', undefined);
            }

            const addSecPlacesBtn = document.getElementById('eventSlideAddSecondaryCountryPlaceBtn');
            if (!isSatelliteArchive && addSecPlacesBtn && window.HeroRelevantLocationsEditor?.addRow) {
                addSecPlacesBtn.onclick = () =>
                    window.HeroRelevantLocationsEditor.addRow({
                        containerId: 'eventSlideEditSecondaryCountryPlaces',
                        placeholders: STORY_SECONDARY_PLACES_EDITOR_OPTS.placeholders,
                        autocompleteType: STORY_SECONDARY_PLACES_EDITOR_OPTS.autocompleteType
                    });
                const addHeroFp = document.getElementById('eventSlideAddHeroFilterPlaceBtn');
                if (addHeroFp) {
                    addHeroFp.onclick = () =>
                        window.HeroRelevantLocationsEditor.addRow({
                            containerId: 'eventSlideEditHeroFilterPlaces',
                            placeholders: STORY_HERO_FILTER_PLACES_OPTS.placeholders,
                            autocompleteType: STORY_HERO_FILTER_PLACES_OPTS.autocompleteType
                        });
                }
                const addFactionFp = document.getElementById('eventSlideAddFactionFilterPlaceBtn');
                if (addFactionFp) {
                    addFactionFp.onclick = () =>
                        window.HeroRelevantLocationsEditor.addRow({
                            containerId: 'eventSlideEditFactionFilterPlaces',
                            placeholders: STORY_FACTION_FILTER_PLACES_OPTS.placeholders,
                            autocompleteType: STORY_FACTION_FILTER_PLACES_OPTS.autocompleteType
                        });
                }
                const addNpcFp = document.getElementById('eventSlideAddNpcFilterPlaceBtn');
                if (addNpcFp) {
                    addNpcFp.onclick = () =>
                        window.HeroRelevantLocationsEditor.addRow({
                            containerId: 'eventSlideEditNpcFilterPlaces',
                            placeholders: STORY_NPC_FILTER_PLACES_OPTS.placeholders,
                            autocompleteType: STORY_NPC_FILTER_PLACES_OPTS.autocompleteType
                        });
                }
            }

            if (!isSatelliteArchive) {
            // Reset setup flag each time we enter edit mode so options stay in sync
            if (filtersInput) filtersInput.dataset.autocompleteSetup = 'false';
            if (factionsInput) factionsInput.dataset.autocompleteSetup = 'false';
            if (npcsInput) npcsInput.dataset.autocompleteSetup = 'false';
            
            const auto = window.eventManager?.formService?.autocompleteService || window.EventFormService?.autocompleteService;
            if (auto && typeof auto.setupAutocomplete === 'function') {
                const heroes = window.eventManager?.heroes || window.globeController?.dataModel?.heroes || [];
                const npcList = window.eventManager?.npcs || [];
                const factionList = window.eventManager?.factions?.length
                    ? window.eventManager.factions
                    : (window.globeController?.dataModel?.factions || []);
                
                if (filtersInput) auto.setupAutocomplete(filtersInput, heroes, 'heroes');
                if (factionsInput) auto.setupAutocomplete(factionsInput, factionList, 'factions');
                if (npcsInput && npcList.length > 0) auto.setupAutocomplete(npcsInput, npcList, 'npcs');
            }
            }
            
            // Update buttons
            editBtn.textContent = 'Cancel';
            saveBtn.style.display = 'inline-flex';
            
            // Play sound
            if (window.SoundEffectsManager?.play) {
                window.SoundEffectsManager.play('uiClick');
            }
}
