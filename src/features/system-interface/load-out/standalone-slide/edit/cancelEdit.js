/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's cancelEdit method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

import { syncFactionTypeBioPanelVisibility } from '../../../utils/bio-archive/FactionTypeBioInput.js';
import { syncHeroBioRolePanelsVisibility } from '../../../utils/bio-archive/HeroRoleBioInputs.js';
import {
    updateEventSlideFactionTypeDisplay,
    updateEventSlideHeroRoleDisplay
} from '../../../info-panel/eventSlideMetaDisplays.js';

export function runCancelEdit(slide, editBtn, saveBtn) {
            if (!slide.isEditing) {
                // Just hide editor if exists
                const editor = document.getElementById('eventSlideInlineEditor');
                if (editor) editor.style.display = 'none';
                const orderRowIdle = document.getElementById('eventSlideOrderRow');
                if (orderRowIdle) {
                    orderRowIdle.setAttribute('hidden', '');
                    orderRowIdle.setAttribute('aria-hidden', 'true');
                }
                const heroIdle = document.getElementById('eventSlideHeroLocationsEdit');
                if (heroIdle) {
                    heroIdle.setAttribute('hidden', '');
                    heroIdle.style.display = 'none';
                }
                return;
            }
            
            const eventSlide = document.getElementById('eventSlide');
            const titleEl = document.getElementById('eventSlideTitle');
            const textEl = document.getElementById('eventSlideText');
            const eb = editBtn || document.getElementById('eventSlideEditBtn');
            const sb = saveBtn || document.getElementById('eventSlideSaveBtn');
            const editor = document.getElementById('eventSlideInlineEditor');
            
            // Restore original state
            if (slide.originalState && slide.editTarget) {
                Object.assign(slide.editTarget.eventData, slide.originalState);
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
            if (editor) editor.style.display = 'none';
            eventSlide?.classList.remove('event-slide--inline-editing');
            const orderRowCancel = document.getElementById('eventSlideOrderRow');
            if (orderRowCancel) {
                orderRowCancel.setAttribute('hidden', '');
                orderRowCancel.setAttribute('aria-hidden', 'true');
            }

            if (eb) eb.textContent = 'Edit';
            if (sb) sb.style.display = 'none';

            const heroLocEditCancel = document.getElementById('eventSlideHeroLocationsEdit');
            if (heroLocEditCancel) {
                heroLocEditCancel.setAttribute('hidden', '');
                heroLocEditCancel.style.display = 'none';
            }
            syncFactionTypeBioPanelVisibility('story');
            syncHeroBioRolePanelsVisibility('story', undefined, undefined);
            const archiveSrcAfterCancel =
                window.eventManager?.dataService?.getArchiveSource?.() || 'story';
            const relAfterCancel = document.getElementById('eventSlideRelevantLocations');
            const relSectionAfterCancel = document.getElementById('eventRelevantLocationsSection');
            const isBioAfterCancel =
                archiveSrcAfterCancel === 'heroes'
                || archiveSrcAfterCancel === 'factions'
                || archiveSrcAfterCancel === 'npcs';
            if (relAfterCancel && isBioAfterCancel && slide.editTarget?.eventData) {
                window.LocationFlagHelpers?.updateRelevantLocationsSlideFromSecondaryPlaces?.(
                    slide.editTarget.eventData
                );
                window.LocationFlagHelpers?.updateBioConnectionsSlideFromEvent?.(
                    slide.editTarget.eventData
                );
            }
            if (archiveSrcAfterCancel === 'factions' && slide.editTarget?.eventData) {
                updateEventSlideFactionTypeDisplay(
                    slide.editTarget.eventData,
                    slide.currentVariantIndex ?? 0
                );
            }
            if (archiveSrcAfterCancel === 'heroes' && slide.editTarget?.eventData) {
                updateEventSlideHeroRoleDisplay(
                    slide.editTarget.eventData,
                    slide.currentVariantIndex ?? 0
                );
            }

            slide.isEditing = false;
            slide.editTarget = null;
            slide.originalState = null;
}
