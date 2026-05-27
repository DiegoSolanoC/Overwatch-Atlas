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

export function runUpdateSingleButtonContent(slide, btn, event, globalEventIndex, allEvents) {
        if (!event) {
            btn.style.display = 'none';
            return;
        }

        btn.style.display = '';
        // Calculate page position from global index (1-10)
        const pagePosition = (globalEventIndex % 10) + 1;
        btn.dataset.position = String(pagePosition);
        btn.dataset.eventIndex = globalEventIndex;
        
        // Calculate current page from global index
        const currentPage = Math.floor(globalEventIndex / 10) + 1;
        const pageStart = (currentPage - 1) * 10;
        const pageEnd = Math.min(pageStart + 10, allEvents.length);
        const pageEvents = allEvents.slice(pageStart, pageEnd);
        
        // Check filter lock state (like wireNumberButtons does)
        const activeFilters = window.standaloneActiveFilters || new Set();
        const filtersOn = activeFilters.size > 0;
        const isLocked = filtersOn && shouldEventBeLocked(event, activeFilters);
        
        // Explicitly handle disabled state (property AND attribute)
        if (isLocked) {
            btn.disabled = true;
            btn.setAttribute('disabled', '');
            btn.style.pointerEvents = 'none';
            btn.style.setProperty('opacity', '0.5', 'important');
            btn.style.setProperty('filter', 'none', 'important');
        } else {
            btn.disabled = false;
            btn.removeAttribute('disabled');
            btn.style.pointerEvents = 'auto';
            btn.style.setProperty('opacity', '1', 'important');
            btn.style.setProperty('filter', 'none', 'important');
        }
        btn.classList.toggle('locked', isLocked);
        btn.dataset.locked = isLocked ? 'true' : 'false';
        
        // DEV ONLY: Check for overlapping coordinates on localhost
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
            const { lat: thisLat, lon: thisLon } = earthLatLon(event);
            const hasOverlap = thisLat != null && thisLon != null && pageEvents.some((otherEvent, otherIndex) => {
                if (otherIndex === (globalEventIndex % 10)) return false;
                const { lat: oLat, lon: oLon } = earthLatLon(otherEvent);
                if (oLat == null || oLon == null) return false;
                return oLat === thisLat && oLon === thisLon;
            });
            
            
            const keyEl = btn.querySelector('.event-number-btn__key');
            if (hasOverlap && keyEl) {
                keyEl.style.color = '#ff4444';
                keyEl.style.textShadow = '0 1px 3px rgba(0, 0, 0, 0.85), 0 2px 12px rgba(0, 0, 0, 0.45)';
            } else if (keyEl) {
                keyEl.style.color = '';
                keyEl.style.textShadow = '';
            }
        }
        
        // Debug logging with visual state
        if (filtersOn || btn.style.opacity !== '1') {
        }
        
        const numEl = btn.querySelector('.event-number-btn__num');
        const nameEl = btn.querySelector('.event-number-btn__name');
        const imgEl = btn.querySelector('.event-number-btn__img');
        const imgWrap = btn.querySelector('.event-number-btn__img-wrap');
        const variantBadge = btn.querySelector('.event-number-btn__variant-badge');
        const keyEl = btn.querySelector('.event-number-btn__key');
        
        if (numEl) numEl.textContent = globalEventIndex + 1;
        if (keyEl) keyEl.textContent = (globalEventIndex % 10) + 1;
        
        const isMultiEvent = Array.isArray(event.variants) && event.variants.length > 0;
        const displayEvent = isMultiEvent && event.variants[0]
            ? { ...event, ...event.variants[0] }
            : event;
        
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
        btn.classList.toggle('event-number-btn--unfinished', !hasDescription);
        btn.title = hasDescription ? plainName : `${plainName} — Unfinished: missing description`;
        
        // Get image (dock thumbs always use main timeline event art)
        let imagePath = null;
        if (window.NavigationImageHelpers?.getEventImagePath) {
            imagePath = window.NavigationImageHelpers.getEventImagePath(displayEvent, plainName, 'story');
        } else if (window.eventManager?.getEventImagePath) {
            imagePath = window.eventManager.getEventImagePath(displayEvent.name, displayEvent.image, 'story');
        } else {
            imagePath = displayEvent.image || displayEvent.imagePath || null;
        }
        
        if (imgEl) {
            if (imagePath) {
                imgEl.src = imagePath;
                imgEl.style.display = '';
                if (imgWrap) imgWrap.classList.remove('event-number-btn__img-wrap--empty');
            } else {
                imgEl.removeAttribute('src');
                imgEl.style.display = 'none';
                if (imgWrap) imgWrap.classList.add('event-number-btn__img-wrap--empty');
            }
        }
        
        // Variant badge
        if (variantBadge) {
            const hasVariants = Array.isArray(event.variants) && event.variants.length > 1;
            variantBadge.hidden = !hasVariants;
            variantBadge.dataset.eventIndex = globalEventIndex;
            variantBadge.dataset.currentVariant = '0';
            if (hasVariants) {
                variantBadge.textContent = `1/${event.variants.length}`;
            }
        }
        
        // Click handler
        btn.onclick = (e) => {
            e.stopPropagation();
            if (e.target.closest('.event-number-btn__variant-badge')) {
                return;
            }
            if (window.standaloneEventSlide) {
                window.standaloneEventSlide.showEvent(globalEventIndex);
                window.SoundEffectsManager?.play?.('eventClick');
            } else {
            }
        };
        
        // Variant badge click
        if (variantBadge) {
            variantBadge.onclick = (e) => {
                e.stopPropagation();
                const targetEvent = allEvents[globalEventIndex];
                if (!targetEvent?.variants?.length) return;
                
                const currentVariant = parseInt(variantBadge.dataset.currentVariant || '0', 10);
                const nextVariant = (currentVariant + 1) % targetEvent.variants.length;
                variantBadge.dataset.currentVariant = nextVariant;
                variantBadge.textContent = `${nextVariant + 1}/${targetEvent.variants.length}`;
                
                // Play switch event sound (same as event manager)
                if (window.SoundEffectsManager?.play) {
                    window.SoundEffectsManager.play('switchEvent');
                }
                
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
                        imgEl.src = variantImagePath;
                        imgEl.style.display = '';
                        if (imgWrap) imgWrap.classList.remove('event-number-btn__img-wrap--empty');
                    }
                    if (nameEl && variantDisplayEvent.name) {
                        nameEl.textContent = variantDisplayEvent.name;
                    }
                }
                
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
        btn.onmouseenter = () => {
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
                    btn.__hoveredMarkerBtn = markerBtn;
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

        btn.onmouseleave = () => {
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
                let markerBtn = btn.__hoveredMarkerBtn || null;

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
                btn.__hoveredMarkerBtn = null;
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
}

