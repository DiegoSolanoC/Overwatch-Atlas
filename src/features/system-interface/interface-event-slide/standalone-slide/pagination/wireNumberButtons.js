/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's $name method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's 	his).
 */

import { isHeroBiographyDockFilterActive } from '../../../../gallery/gallery-mode/heroBiographyDockTimeline.js';
import {
    onHeroBiographyDockEventHover,
    onHeroBiographyDockEventHoverEnd,
} from '../../../../gallery/gallery-mode/heroBiographyDockLookHover.js';
import { shouldEventBeLocked } from '../../../interface-globe-markers/filtering/shouldEventBeLocked.js';
import { findMarkerForEvent } from '../../../interface-globe-markers/findMarkerForEvent.js';
import {
    centerCameraOnMarker,
    restoreCameraFromThumbnailHover
} from '../../../../world/worldview-globe-3d/views/WorldviewThumbnailHoverCamera.js';
import {
    updateStandaloneSliderTicks,
    eventRootSlotMissingDescription,
    eventSlotMissingDescription
} from '../../../interface-load-unload/pagination/standalonePaginationFilterSync.js';
import { setLoadingAssetImageSrc } from '../../../../universal-features/atlas-ui/loadingAssetSlot.js';
import {
    thumbPageTurnShrinkKeyframes,
    thumbPageTurnGrowKeyframes
} from '../../../interface-bottom-dock/thumbPageTurnKeyframes.js';
import { isEventSlideEditDevHost } from '../../../interface-info-display/isEventSlideEditDevHost.js';
import {
    startThumbnailHoverSoundLoop,
    stopThumbnailHoverSoundLoop
} from './thumbnailHoverSound.js';
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

export function runWireNumberButtons(slide, pageEvents, pageNum, allEvents) {
        const buttons = document.querySelectorAll('#eventNumberButtons .event-number-btn');
        if (!buttons.length) return;
        
        const events = allEvents || window.eventManager?.getDockTimelineEvents?.() || [];
        const eventsPerPage = 10;
        const baseIndex = (pageNum - 1) * eventsPerPage;
        
        // Curated hero-bio dock list — thumbs are all relevant; skip global filter locks.
        const activeFilters = isHeroBiographyDockFilterActive()
            ? new Set()
            : (window.standaloneActiveFilters || new Set());
        const filtersOn = activeFilters.size > 0;
        
        buttons.forEach((btn, index) => {
            // Remove old listeners by cloning
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            const event = pageEvents?.[index];
            const globalEventIndex = baseIndex + index;
            
            if (!event) {
                newBtn.disabled = true;
                newBtn.style.opacity = '0.3';
                newBtn.style.display = 'none';
                newBtn.classList.remove('locked');
                return;
            }
            
            // Check if this event should be locked based on filters
            const isLocked = filtersOn && shouldEventBeLocked(event, activeFilters);
            
            newBtn.disabled = isLocked;
            newBtn.style.opacity = isLocked ? '0.5' : '1';
            newBtn.style.display = '';
            newBtn.classList.toggle('locked', isLocked);
            newBtn.dataset.isLocked = isLocked ? 'true' : 'false';
            newBtn.dataset.eventIndex = globalEventIndex;
            // Set data-position to page position (1-10)
            newBtn.dataset.position = String(index + 1);
            
            // Update button number
            const numEl = newBtn.querySelector('.event-number-btn__num');
            if (numEl) numEl.textContent = globalEventIndex + 1;
            
            // Update button content
            const nameEl = newBtn.querySelector('.event-number-btn__name');
            const imgEl = newBtn.querySelector('.event-number-btn__img');
            const imgWrap = newBtn.querySelector('.event-number-btn__img-wrap');
            const variantBadge = newBtn.querySelector('.event-number-btn__variant-badge');
            const keyEl = newBtn.querySelector('.event-number-btn__key');
            
            // Get display event (first variant for multi-events)
            const isMultiEvent = Array.isArray(event.variants) && event.variants.length > 0;
            const displayEvent = isMultiEvent && event.variants[0] 
                ? { ...event, ...event.variants[0] }
                : event;
            
            // Get plain name
            const plainName = displayEvent.name || event.name || `Event ${globalEventIndex + 1}`;
            if (nameEl) {
                if (window.GlitchTextService) {
                    nameEl.innerHTML = window.GlitchTextService.getDisplayEventName(plainName);
                } else {
                    nameEl.textContent = plainName;
                }
            }
            
            // Unfinished indicator: same predicate as the dock-thumb / list rule
            const hasDescription = !eventSlotMissingDescription(displayEvent);
            newBtn.classList.toggle('event-number-btn--unfinished', !hasDescription);
            newBtn.title = hasDescription ? plainName : `${plainName} — Unfinished: missing description`;
            
            // Get image path using helper
            let imagePath = null;
            if (window.NavigationImageHelpers?.getEventImagePath) {
                imagePath = window.NavigationImageHelpers.getEventImagePath(displayEvent, plainName, 'story');
            } else if (window.eventManager?.getEventImagePath) {
                imagePath = window.eventManager.getEventImagePath(displayEvent.name, displayEvent.image, 'story');
            } else {
                imagePath = displayEvent.image || displayEvent.imagePath || null;
            }
            
            if (imgEl) {
                setLoadingAssetImageSrc(imgEl, imagePath, { wrap: imgWrap });
            }
            if (keyEl) keyEl.textContent = index + 1;
            
            // DEV ONLY: same-globe-page coordinate overlap (matches dock pagination: 10 per page).
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                const earthLatLon = (ev) => {
                    if (!ev) return { lat: null, lon: null };
                    const multi = Array.isArray(ev.variants) && ev.variants.length > 0;
                    const base = multi && ev.variants[0] ? { ...ev, ...ev.variants[0] } : ev;
                    let lat = base.lat !== undefined ? base.lat : ev.lat;
                    let lon = base.lon !== undefined ? base.lon : ev.lon;
                    if (lat == null && ev.location && typeof ev.location === 'object') {
                        lat = ev.location.lat;
                        lon = ev.location.lon;
                    }
                    const nLat = Number(lat);
                    const nLon = Number(lon);
                    if (!Number.isFinite(nLat) || !Number.isFinite(nLon)) return { lat: null, lon: null };
                    return { lat: nLat, lon: nLon };
                };
                const allDock = window.eventManager?.getDockTimelineEvents?.() || [];
                const thisPage = Math.floor(globalEventIndex / 10);
                const { lat: thisLat, lon: thisLon } = earthLatLon(event);
                const hasOverlap = thisLat != null && thisLon != null && allDock.some((otherEvent, otherIndex) => {
                    if (otherIndex === globalEventIndex) return false;
                    if (Math.floor(otherIndex / 10) !== thisPage) return false;
                    const { lat: oLat, lon: oLon } = earthLatLon(otherEvent);
                    if (oLat == null || oLon == null) return false;
                    return oLat === thisLat && oLon === thisLon;
                });
                
                
                if (hasOverlap) {
                    keyEl.style.color = '#ff4444';
                    keyEl.style.textShadow = '0 1px 3px rgba(0, 0, 0, 0.85), 0 2px 12px rgba(0, 0, 0, 0.45)';
                } else {
                    keyEl.style.color = '';
                    keyEl.style.textShadow = '';
                }
            }
            
            // Show variant badge if multi-variant
            if (variantBadge) {
                const hasVariants = Array.isArray(event.variants) && event.variants.length > 1;
                variantBadge.hidden = !hasVariants;
                variantBadge.dataset.eventIndex = globalEventIndex;
                variantBadge.dataset.currentVariant = '0';
                // Set badge text to show "1/3", "2/3", etc.
                if (hasVariants) {
                    variantBadge.textContent = `1/${event.variants.length}`;
                }
            }
            
            // Click handler - open event slide directly
            newBtn.onclick = (e) => {
                e.stopPropagation();
                
                // Check if clicking variant badge
                if (e.target.closest('.event-number-btn__variant-badge')) {
                    return;
                }
                
                // Alert if locked event was clicked (should not happen)
                const btnLocked = newBtn.dataset.isLocked === 'true';
                if (btnLocked || newBtn.disabled) {
                    return; // Don't open locked events
                }

                // Clear hover state when clicking thumbnail
                if (window.globeController?.interactionController) {
                    window.globeController.interactionController.hoveredEventMarker = null;
                }
                if (window.globeController?.markerPulseService) {
                    window.globeController.markerPulseService.hoveredEventMarker = null;
                }

                // Show event in standalone panel
                if (window.standaloneEventSlide) {
                    window.standaloneEventSlide.showEvent(globalEventIndex);
                }

                if (window.SoundEffectsManager?.play) {
                    window.SoundEffectsManager.play('eventClick');
                }
            };
            
            // Variant badge click - cycles thumbnail and opens event slide
            if (variantBadge) {
                variantBadge.onclick = (e) => {
                    e.stopPropagation();
                    
                    const targetEvent = events[globalEventIndex];
                    if (!targetEvent?.variants?.length) return;
                    
                    const currentVariant = parseInt(variantBadge.dataset.currentVariant || '0', 10);
                    const nextVariant = (currentVariant + 1) % targetEvent.variants.length;
                    variantBadge.dataset.currentVariant = nextVariant;
                    // Update badge text
                    variantBadge.textContent = `${nextVariant + 1}/${targetEvent.variants.length}`;
                    
                    // Update thumbnail image to show the variant
                    const variantDisplayEvent = targetEvent.variants[nextVariant];
                    if (variantDisplayEvent && imgEl) {
                        let variantImagePath = null;
                        if (window.NavigationImageHelpers?.getEventImagePath) {
                            variantImagePath = window.NavigationImageHelpers.getEventImagePath(
                                variantDisplayEvent,
                                variantDisplayEvent.name,
                                'story'
                            );
                        } else if (window.eventManager?.getEventImagePath) {
                            variantImagePath = window.eventManager.getEventImagePath(
                                variantDisplayEvent.name,
                                variantDisplayEvent.image,
                                'story'
                            );
                        } else {
                            variantImagePath = variantDisplayEvent.image || variantDisplayEvent.imagePath || null;
                        }
                        
                        if (variantImagePath) {
                            setLoadingAssetImageSrc(imgEl, variantImagePath, { wrap: imgWrap });
                        }
                        
                        // Update name to show variant name
                        if (nameEl && variantDisplayEvent.name) {
                            nameEl.textContent = variantDisplayEvent.name;
                        }
                    }
                    
                    // Also open the event slide with this variant
                    if (window.standaloneEventSlide) {
                        window.standaloneEventSlide.showStandaloneEventSlide({
                            ...targetEvent,
                            ...variantDisplayEvent,
                            variantIndex: nextVariant,
                            hasVariants: true,
                            variants: targetEvent.variants
                        }, globalEventIndex);
                    }
                };
            }
            
            // Hover effects - show preview badge and trigger marker hover
            newBtn.onmouseenter = () => {
                if (isHeroBiographyDockFilterActive()) {
                    void onHeroBiographyDockEventHover(event);
                }

                // Show preview badge
                if (window.SummaryInfoBadge?.show && event) {
                    const hoverLines = window.SummaryInfoBadge.getHoverPreviewLines 
                        ? window.SummaryInfoBadge.getHoverPreviewLines(event)
                        : { eraName: displayEvent.eraName || '', primaryRowFlag: null, otherRowFlags: [], yearLine: displayEvent.yearStart ? `${displayEvent.yearStart}${displayEvent.yearEnd ? `—${displayEvent.yearEnd}` : ''}` : '' };
                    
                    const variants = isMultiEvent ? event.variants : [];
                    const otherVariants = variants.slice(1);
                    
                    window.SummaryInfoBadge.show(
                        globalEventIndex + 1,
                        plainName,
                        otherVariants.map(v => v.name || ''),
                        hoverLines.eraName || displayEvent.eraName || '',
                        hoverLines.primaryRowFlag || null,
                        hoverLines.otherRowFlags || [],
                        hoverLines.yearLine || (displayEvent.yearStart ? `${displayEvent.yearStart}${displayEvent.yearEnd ? `—${displayEvent.yearEnd}` : ''}` : '')
                    );
                }

                // Trigger marker hover effect based on view mode
                const sceneModel = window.globeController?.sceneModel;
                const isMapView = sceneModel?.getMapViewEnabled?.() || !!sceneModel?.isMapView;

                if (isMapView) {
                    // Map view: find DOM marker and set hover
                    // Force cycle to this event if it's in an overlap group
                    let marker = findMarkerForEvent(event, globalEventIndex);
                    let markerBtn = marker?.__domMarkerButton;
                    
                    
                    if (window.globeController?.map2dLite) {
                        const targetMarker = window.globeController.map2dLite.forceCycleToEvent(event);
                        if (targetMarker) {
                            /*
                             * forceCycleToEvent returns an overlap-group wrapper
                             * ({ stub, btn, disk }), not a stub. setDomLiteMarkerHover
                             * reads .userData directly, so we must hand it the inner
                             * .stub — otherwise it falls into the "invalid marker"
                             * branch and immediately hides the summary badge.
                             */
                            marker = targetMarker.stub || targetMarker;
                            markerBtn = targetMarker.btn; // Use the button from the switched marker
                        }
                        window.globeController.map2dLite.pauseOverlapCycling();
                    }
                    
                    if (markerBtn) {
                        const ms = window.globeController?.interactionController?.markerService;
                        ms?.setDomLiteMarkerHover?.(marker);
                        // Play radiate sound effect and start continuous loop (every 1.2s matches wave animation)
                        if (window.SoundEffectsManager?.play) {
                            startThumbnailHoverSoundLoop(() => {
                                window.SoundEffectsManager?.play?.('radiate');
                            }, 1200);
                        }
                        // Add hover class to DOM marker button to trigger wave animation
                        markerBtn.classList.add('map-2d-lite__marker--synthetic-hover');
                        /*
                         * Cache the exact button we marked so onmouseleave can clear
                         * it unambiguously. findMarkerForEvent matches by name OR
                         * location, which returns the wrong button for the 2nd event
                         * in an overlap group (same lat/lon, different name), leaving
                         * the real hovered marker stuck in the wave animation.
                         */
                        newBtn.__hoveredMarkerBtn = markerBtn;
                    } else {
                    }
                    
                    // Center map on marker
                    if (event.lat != null && event.lon != null) {
                        window.globeController?.map2dLite?.flyToLatLon?.(event.lat, event.lon);
                    }
                } else {
                    // Globe view: use WebGL marker with pulse
                    let marker = findMarkerForEvent(event, globalEventIndex);
                    if (marker) {
                        // Force cycle to this event if it's in an overlap group
                        if (window.globeEventMarkerManager) {
                            const targetMarker = window.globeEventMarkerManager.forceCycleToEvent(event);
                            if (targetMarker) {
                                marker = targetMarker; // Use the switched marker
                            }
                            window.globeEventMarkerManager.pauseOverlapCycling();
                        }
                        
                        const ic = window.globeController?.interactionController;
                        if (ic?.pulseService) {
                            ic.pulseService.setHoveredMarker(marker); // Glow effect
                            ic.startEventMarkerPulse(marker); // Pulse rings
                        }
                        // Center camera on marker
                        centerCameraOnMarker(marker);
                    }
                }
            };
            
            newBtn.onmouseleave = () => {
                if (isHeroBiographyDockFilterActive()) {
                    onHeroBiographyDockEventHoverEnd();
                }

                if (window.SummaryInfoBadge?.hide) {
                    window.SummaryInfoBadge.hide();
                }

                // Clear marker hover effect based on view mode
                const sceneModel = window.globeController?.sceneModel;
                const isMapView = sceneModel?.getMapViewEnabled?.() || !!sceneModel?.isMapView;

                if (isMapView) {
                    // Map view: clear DOM-lite hover and reset to default view
                    const ms = window.globeController?.interactionController?.markerService;
                    ms?.setDomLiteMarkerHover?.(null);

                    /*
                     * Prefer the cached marker button from onmouseenter — that
                     * is the exact button we added the synthetic-hover class to.
                     * findMarkerForEvent matches by name OR location, so for the
                     * 2nd event in an overlap group it returns the *first*
                     * marker's button (locations match, names differ), leaving
                     * the pink marker stuck mid-animation.
                     */
                    let markerBtn = newBtn.__hoveredMarkerBtn || null;

                    if (!markerBtn) {
                        const marker = findMarkerForEvent(event, globalEventIndex);
                        markerBtn = marker?.__domMarkerButton || null;
                    }

                    // For overlap groups, find the currently visible marker's button
                    if (window.globeController?.map2dLite && !markerBtn) {
                        const group = window.globeController.map2dLite.overlapGroups.find(g =>
                            g.markers.some(m => {
                                const markerEvent = m.stub.userData.event;
                                if (!markerEvent) return false;
                                return markerEvent.name === event.name &&
                                       markerEvent.lat === event.lat &&
                                       markerEvent.lon === event.lon;
                            })
                        );
                        if (group) {
                            const visibleMarker = group.markers[group.currentIndex];
                            if (visibleMarker) {
                                markerBtn = visibleMarker.btn;
                            }
                        }
                    }

                    if (markerBtn) {
                        markerBtn.classList.remove('map-2d-lite__marker--synthetic-hover');
                    }
                    newBtn.__hoveredMarkerBtn = null;
                    stopThumbnailHoverSoundLoop();
                    window.globeController?.map2dLite?.resetView?.();
                    // Resume overlap cycling
                    window.globeController?.map2dLite?.resumeOverlapCycling?.();
                } else {
                    // Globe view: clear WebGL pulse effects and restore camera
                    const ic = window.globeController?.interactionController;
                    if (ic?.pulseService) {
                        const hoveredMarker = ic.pulseService.getHoveredMarker();
                        if (hoveredMarker) {
                            ic.stopEventMarkerPulse(hoveredMarker);
                            ic.pulseService.setHoveredMarker(null);
                        }
                    }
                    restoreCameraFromThumbnailHover();
                    // Resume overlap cycling
                    window.globeEventMarkerManager?.resumeOverlapCycling?.();
                }
            };
        });
}

