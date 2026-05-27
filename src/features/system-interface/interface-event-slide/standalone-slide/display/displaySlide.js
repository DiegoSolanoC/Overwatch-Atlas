/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's $name method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's 	his).
 */

import { shouldEventBeLocked } from '../../../interface-globe-markers/filtering/shouldEventBeLocked.js';
import { findMarkerForEvent } from '../../../interface-globe-markers/findMarkerForEvent.js';
import {
    centerCameraOnMarker,
    restoreCameraFromThumbnailHover
} from '../../../../Interactive-Worldview/worldview-globe-3d/views/ThumbnailHoverCameraHelpers.js';
import {
    updateStandaloneSliderTicks,
    eventRootSlotMissingDescription,
    eventSlotMissingDescription
} from '../../../interface-load-unload/pagination/standalonePaginationFilterSync.js';
import {
    thumbPageTurnShrinkKeyframes,
    thumbPageTurnGrowKeyframes
} from '../../../interface-bottom-dock/thumbPageTurnKeyframes.js';
import { isEventSlideEditDevHost } from '../../../interface-info-display/isEventSlideEditDevHost.js';
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
} from '../../../interface-shared/storyEventFilterPlaces.js';
import { readFactionTypeBioPanelTrimmed, syncFactionTypeBioPanelVisibility } from '../../../interface-shared/bio-archive/FactionTypeBioInput.js';
import {
    readHeroRoleBioPanelTrimmed,
    readHeroSubRoleBioPanelTrimmed,
    syncHeroBioRolePanelsVisibility
} from '../../../interface-shared/bio-archive/HeroRoleBioInputs.js';
import {
    updateEventSlideFactionTypeDisplay,
    updateEventSlideHeroRoleDisplay
} from '../../../interface-info-display/eventSlideMetaDisplays.js';

export function runDisplaySlide(slide, eventName, imagePath, description, eventData, isMultiEvent, displayEvent) {
        const eventSlide = document.getElementById('eventSlide');
        if (!eventSlide) return;
        /* Fresh open from a closed panel: drop stale back-stack (X, hideEventSlide, filters, etc.). */
        if (!eventSlide.classList.contains('open')) {
            slide.clearSlideHistory();
        }
        const eventSlideTitle = document.getElementById('eventSlideTitle');
        const eventSlideText = document.getElementById('eventSlideText');
        const eventSlideClose = document.getElementById('eventSlideClose');
        const eventImageToggle = document.getElementById('eventImageToggle');
        const variantToggles = document.getElementById('eventVariantToggles');
        const editBtn = document.getElementById('eventSlideEditBtn');
        const saveBtn = document.getElementById('eventSlideSaveBtn');
        const eventSlideLocation = document.getElementById('eventSlideLocation');
        const eventSlideTimelineMeta = document.getElementById('eventSlideTimelineMeta');
        const dockStoryPresentationActive = !!slide._presentationFromDockTimeline;
        const archiveSourceSlide = dockStoryPresentationActive
            ? 'story'
            : (window.eventManager?.dataService?.getArchiveSource?.() || 'story');
        const isSatelliteArchive = !dockStoryPresentationActive && archiveSourceSlide !== 'story';
        
        // Store the image path for later use when toggling
        slide.currentImagePath = imagePath;
        
        // Cancel any active editing
        slide.cancelEdit();
        
        const relElClear = document.getElementById('eventSlideRelevantLocations');
        const relSectionClear = document.getElementById('eventRelevantLocationsSection');
        const heroLocEditClear = document.getElementById('eventSlideHeroLocationsEdit');
        if (relElClear) {
            relElClear.innerHTML = '';
        }
        if (relSectionClear) {
            relSectionClear.style.display = 'none';
        }
        window.LocationFlagHelpers?.clearBioConnectionsSlideDom?.();
        if (heroLocEditClear) {
            heroLocEditClear.setAttribute('hidden', '');
            heroLocEditClear.style.display = 'none';
        }
        syncFactionTypeBioPanelVisibility('story');
        syncHeroBioRolePanelsVisibility('story', undefined, undefined);
        
        // Check for Olivia Colomar
        const hasOliviaColomar = /Olivia\s+Colomar/gi.test(eventName) || 
                                  /Olivia\s+Colomar/gi.test(description) ||
                                  (isMultiEvent && eventData.variants?.some(v => 
                                      /Olivia\s+Colomar/gi.test(v.name || '') || 
                                      /Olivia\s+Colomar/gi.test(v.description || '')));
        
        // Apply glitch text to both title and description
        const applyGlitch = (text) => {
            if (!text) return text;
            return window.GlitchTextService?.getDisplayText?.(text) || text;
        };
        
        // Update content (with glitch applied)
        if (eventSlideTitle) {
            eventSlideTitle.innerHTML = applyGlitch(eventName);
        }
        if (eventSlideText) {
            eventSlideText.innerHTML = applyGlitch(description) || 'No description available.';
        }
        
        // Display location and years under title (Story timeline only)
        const target = displayEvent || eventData;
        if (!isSatelliteArchive) {
            if (eventSlideLocation && target.cityDisplayName) {
                // Get location flag
                const lh = window.LocationFlagHelpers;
                const flagFile = lh?.getResolvedFlagFilename?.(target.cityDisplayName, target.locationType || 'earth');
                
                if (flagFile) {
                    eventSlideLocation.innerHTML = `<img class="event-slide-location-flag" src="src/assets/images/Filters/Flags/${flagFile}" alt="" width="24" height="16" decoding="async"> ${target.cityDisplayName}`;
                } else {
                    eventSlideLocation.textContent = target.cityDisplayName;
                }
                eventSlideLocation.style.display = 'block';
            } else if (eventSlideLocation) {
                eventSlideLocation.style.display = 'none';
            }
            
            if (eventSlideTimelineMeta) {
                const yearStart = target.yearStart || target.year;
                const yearEnd = target.yearEnd;
                let yearText = '';
                if (yearStart) {
                    yearText = String(yearStart);
                    if (yearEnd) {
                        yearText += ` — ${yearEnd}`;
                    }
                }
                if (yearText) {
                    eventSlideTimelineMeta.textContent = yearText;
                    eventSlideTimelineMeta.style.display = 'block';
                } else {
                    eventSlideTimelineMeta.style.display = 'none';
                }
            }
        } else {
            if (eventSlideLocation) eventSlideLocation.style.display = 'none';
            if (eventSlideTimelineMeta) eventSlideTimelineMeta.style.display = 'none';
            const relEl = document.getElementById('eventSlideRelevantLocations');
            const isBioSlide =
                archiveSourceSlide === 'heroes'
                || archiveSourceSlide === 'factions'
                || archiveSourceSlide === 'npcs';
            if (isBioSlide && relEl) {
                window.LocationFlagHelpers?.updateRelevantLocationsSlideFromSecondaryPlaces?.(
                    target
                );
                window.LocationFlagHelpers?.updateBioConnectionsSlideFromEvent?.(target);
            }
        }

        if (archiveSourceSlide === 'factions') {
            updateEventSlideFactionTypeDisplay(eventData, slide.currentVariantIndex ?? 0);
        } else {
            updateEventSlideFactionTypeDisplay(null, 0);
        }
        if (archiveSourceSlide === 'heroes') {
            updateEventSlideHeroRoleDisplay(eventData, slide.currentVariantIndex ?? 0);
        } else {
            updateEventSlideHeroRoleDisplay(null, 0);
        }

        // Setup glitch toggle button
        const glitchToggleBtn = document.getElementById('eventGlitchToggle');
        if (glitchToggleBtn) {
            if (hasOliviaColomar) {
                // Add icon if not present
                let iconWrap = glitchToggleBtn.querySelector('.event-glitch-toggle-btn__icon');
                if (!iconWrap) {
                    iconWrap = document.createElement('span');
                    iconWrap.className = 'event-glitch-toggle-btn__icon';
                    glitchToggleBtn.appendChild(iconWrap);
                }
                if (!iconWrap.innerHTML.includes('Hacked.png')) {
                    iconWrap.innerHTML = `<img class="event-glitch-toggle-img" src="src/assets/images/Misc/Hacked.png" alt="" width="48" height="48" decoding="async" draggable="false" />`;
                }
                
                glitchToggleBtn.style.display = 'inline-flex';
                glitchToggleBtn.style.visibility = 'visible';
                
                // Set initial state
                const isEnabled = window.GlitchTextService?.isEnabled?.() || false;
                glitchToggleBtn.classList.toggle('event-glitch-toggle-btn--on', isEnabled);
                glitchToggleBtn.setAttribute('aria-pressed', String(isEnabled));
                glitchToggleBtn.title = isEnabled ? 'Glitch effect on' : 'Glitch effect off';
                
                glitchToggleBtn.onclick = () => {
                    // Toggle glitch
                    const newEnabled = window.GlitchTextService?.toggle?.() || false;
                    // Update button state
                    glitchToggleBtn.classList.toggle('event-glitch-toggle-btn--on', newEnabled);
                    glitchToggleBtn.setAttribute('aria-pressed', String(newEnabled));
                    glitchToggleBtn.title = newEnabled ? 'Glitch effect on' : 'Glitch effect off';
                    // Re-apply to current view
                    const currentEvent = isMultiEvent ? eventData.variants[slide.currentVariantIndex || 0] : eventData;
                    if (eventSlideTitle) {
                        eventSlideTitle.innerHTML = applyGlitch(currentEvent?.name || eventName);
                    }
                    if (eventSlideText) {
                        eventSlideText.innerHTML = applyGlitch(currentEvent?.description || description) || 'No description available.';
                    }
                    slide.updateSourcesAndFilters?.(currentEvent);
                    // Wire click handlers on new glitch elements
                    setTimeout(wireGlitchClickToggle, 100);
                    // Play sound
                    if (window.SoundEffectsManager?.play) {
                        window.SoundEffectsManager.play(newEnabled ? 'hackOn' : 'hackOff');
                    }
                };
                // Start animation if enabled
                if (window.GlitchTextService?.isEnabled?.()) {
                    window.GlitchTextService.startAnimation?.();
                    if (window.SoundEffectsManager?.play) {
                        setTimeout(() => window.SoundEffectsManager.play('hackOn'), 50);
                    }
                }
            } else {
                glitchToggleBtn.style.display = 'none';
                glitchToggleBtn.classList.remove('event-glitch-toggle-btn--on');
            }
        }
        
        // Wire up click-to-toggle on glitchy text
        const wireGlitchClickToggle = () => {
            const containers = eventSlide.querySelectorAll('.glitchy-text-container, .glitchy-text-toggle-target');
            containers.forEach(el => {
                el.style.cursor = 'pointer';
                el.onclick = (e) => {
                    e.stopPropagation();
                    if (glitchToggleBtn) glitchToggleBtn.click();
                };
            });
        };
        // Run after glitch applied
        setTimeout(wireGlitchClickToggle, 100);
        
        // Setup variant toggles
        if (variantToggles) {
            variantToggles.innerHTML = '';
            if (!isSatelliteArchive && isMultiEvent && eventData.variants) {
                variantToggles.style.display = 'flex';
                eventData.variants.forEach((variant, idx) => {
                    const btn = document.createElement('button');
                    btn.className = 'variant-toggle-btn' + (idx === 0 ? ' active' : '');
                    btn.textContent = variant.name || `Variant ${idx + 1}`;
                    btn.addEventListener('click', () => {
                        slide.currentVariantIndex = idx;
                        variantToggles.querySelectorAll('.variant-toggle-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        const v = eventData.variants[idx];
                        const vName = v.name || variant.name || eventName;
                        const vDesc = v.description || description;
                        
                        // Update title and description
                        if (eventSlideTitle) eventSlideTitle.innerHTML = applyGlitch(vName);
                        if (eventSlideText) eventSlideText.innerHTML = applyGlitch(vDesc) || 'No description available.';
                        
                        // Update location and years for variant
                        if (eventSlideLocation && v.cityDisplayName) {
                            // Get location flag for variant
                            const lh = window.LocationFlagHelpers;
                            const flagFile = lh?.getResolvedFlagFilename?.(v.cityDisplayName, v.locationType || 'earth');
                            
                            if (flagFile) {
                                eventSlideLocation.innerHTML = `<img class="event-slide-location-flag" src="src/assets/images/Filters/Flags/${flagFile}" alt="" width="24" height="16" decoding="async"> ${v.cityDisplayName}`;
                            } else {
                                eventSlideLocation.textContent = v.cityDisplayName;
                            }
                            eventSlideLocation.style.display = 'block';
                        } else if (eventSlideLocation) {
                            eventSlideLocation.style.display = 'none';
                        }
                        
                        if (eventSlideTimelineMeta) {
                            const vYearStart = v.yearStart || v.year;
                            const vYearEnd = v.yearEnd;
                            let vYearText = '';
                            if (vYearStart) {
                                vYearText = String(vYearStart);
                                if (vYearEnd) {
                                    vYearText += ` — ${vYearEnd}`;
                                }
                            }
                            if (vYearText) {
                                eventSlideTimelineMeta.textContent = vYearText;
                                eventSlideTimelineMeta.style.display = 'block';
                            } else {
                                eventSlideTimelineMeta.style.display = 'none';
                            }
                        }
                        
                        // Update image for variant
                        const vImagePath = window.eventManager?.getEventImagePath
                            ? window.eventManager.getEventImagePath(
                                v.name,
                                v.image,
                                !isSatelliteArchive ? 'story' : undefined
                            )
                            : v.image;
                        if (vImagePath) {
                            slide.showImageOverlay(vImagePath);
                        } else {
                            slide.hideImageOverlay();
                        }
                        
                        slide.updateSourcesAndFilters(v);
                        // Re-wire glitch clicks after variant switch
                        setTimeout(wireGlitchClickToggle, 100);
                    });
                    variantToggles.appendChild(btn);
                });
            } else {
                variantToggles.style.display = 'none';
            }
        }
        
        // Update sources and filters
        slide.updateSourcesAndFilters(displayEvent);
        
        // Wire up prev/next buttons
        slide.wireNavButtons(eventData);
        
        // Wire edit/save buttons
        slide.wireEditButtons(eventData, displayEvent, editBtn, saveBtn, eventSlideTitle, eventSlideText);
        
        // Show the panel
        // Mutual exclusion: opening Event Info closes Filters.
        const filtersPanel = document.getElementById('filtersPanel');
        const filtersToggle = document.getElementById('filtersToggle');
        if (filtersPanel?.classList.contains('open')) {
            filtersPanel.classList.remove('open');
            filtersToggle?.classList.remove('active');
        }
        eventSlide.classList.add('open');
        
        // Wire close button
        if (eventSlideClose) {
            eventSlideClose.onclick = () => {
                slide.cancelEdit();
                slide.clearSlideHistory();
                eventSlide.classList.remove('open');
                slide.hideImageOverlay();
                
                // Reset camera when closing event slide
                if (window.globeController?.interactionController) {
                    window.globeController.interactionController.stopFollowingStation();
                    window.globeController.interactionController.restorePlanesVisibility?.();
                }
                if (window.globeController?.cameraControlService) {
                    window.globeController.cameraControlService.resetCameraToDefault();
                }
                
                if (window.SoundEffectsManager?.play) {
                    window.SoundEffectsManager.play('eventClick');
                }
            };
        }
        
        // Wire image toggle
        if (eventImageToggle) {
            eventImageToggle.onclick = () => {
                // Use the standalone event slide's toggle method which syncs with global state
                // Pass the stored image path
                slide.toggleImageOverlay(slide.currentImagePath);
            };
        }
        
        // Show image based on global toggle state
        // Default to ON (true) if not set
        const storedValue = localStorage.getItem('globalImageToggle');
        const globalImageToggleEnabled = storedValue === null ? true : storedValue !== 'false';
        setTimeout(() => {
            if (globalImageToggleEnabled && imagePath) {
                slide.showImageOverlay(imagePath);
            } else {
                slide.hideImageOverlay();
            }
        }, 100);
        
        // On mobile, if no image, start in full-screen mode
        const isMobile = window.innerWidth <= 768;
        if (isMobile && !imagePath && eventSlide) {
            eventSlide.classList.add('full-screen');
        }

        slide.updateBackButtonVisibility?.();
}

