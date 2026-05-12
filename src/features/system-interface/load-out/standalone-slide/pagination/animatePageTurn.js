/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's animatePageTurn method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

import { shouldEventBeLocked } from '../../../markers/filtering/shouldEventBeLocked.js';
import {
    thumbPageTurnShrinkKeyframes,
    thumbPageTurnGrowKeyframes
} from '../../../dock/thumbPageTurnKeyframes.js';

export function runAnimatePageTurn(slide, pageEvents, pageNum, allEvents) {
            const buttons = document.querySelectorAll('#eventNumberButtons .event-number-btn');
            if (!buttons.length) return;
            
            const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
            if (prefersReducedMotion || typeof Element.prototype.animate !== 'function') {
                // Fallback: just update content without animation
                slide.wireNumberButtons(pageEvents, pageNum, allEvents);
                return;
            }
            
            // Match globe timing
            const STAGGER_MS = 58;
            const SHRINK_MS = 290;
            const GROW_MS = 515;
            
            // Detect desktop layout (skews transform)
            const isThumbsDesktop = window.matchMedia?.('(min-width: 1024px)')?.matches ?? false;
            
            // Cancel any existing animations
            buttons.forEach(btn => {
                if (btn.dataset.pageTurnToken) {
                    try {
                        const oldAnim = btn.getAnimations?.();
                        if (oldAnim?.length) {
                            oldAnim.forEach(a => a.cancel?.());
                        }
                    } catch (e) {}
                }
            });
            
            // Start fresh wave
            const waveToken = Date.now().toString();
            
            // Get active filters for lock state check
            const activeFilters = window.standaloneActiveFilters || new Set();
            const filtersOn = activeFilters.size > 0;
            
            // Helper to set up click handler
            const setupClickHandler = (button, eventIndex) => {
                if (!window.standaloneEventSlide) {
                    return;
                }
                button.onclick = (e) => {
                    e.stopPropagation();
                    if (e.target.closest('.event-number-btn__variant-badge')) return;
                    window.standaloneEventSlide.showEvent(eventIndex);
                    window.SoundEffectsManager?.play?.('eventClick');
                };
            };
            
            buttons.forEach((btn, i) => {
                // Get the event data for this button position
                const event = pageEvents[i];
                const globalEventIndex = (pageNum - 1) * 10 + i;
                
                // Handle case where there's no event for this button slot
                if (!event) {
                    btn.style.display = 'none';
                    return;
                }
                
                // Ensure button is visible (was hidden on pages with fewer events)
                btn.style.display = '';
                
                // IMMEDIATELY set up click handler with CORRECT index
                // (will be refreshed again in updateSingleButtonContent, but this ensures it's right from start)
                setupClickHandler(btn, globalEventIndex);
                
                // Calculate CORRECT lock state for this event (not from old button state)
                const isLocked = filtersOn && event && shouldEventBeLocked(event, activeFilters);
                
                btn.dataset.pageTurnToken = waveToken;
                btn.dataset.locked = isLocked ? 'true' : 'false';
                
                // Set initial disabled state for animation (will be updated in updateSingleButtonContent)
                if (isLocked) {
                    btn.disabled = true;
                    btn.setAttribute('disabled', '');
                    btn.style.pointerEvents = 'none';
                } else {
                    btn.disabled = false;
                    btn.removeAttribute('disabled');
                    btn.style.pointerEvents = 'auto';
                }
                
                // Staggered start for each button
                const delay = i * STAGGER_MS;
                
                // Step 1: Shrink out with CORRECT lock state
                const shrinkAnim = btn.animate(
                    thumbPageTurnShrinkKeyframes(isThumbsDesktop, isLocked),
                    {
                        duration: SHRINK_MS,
                        easing: 'cubic-bezier(0.55, 0.06, 0.68, 0.19)',
                        delay: delay,
                        fill: 'both'
                    }
                );
                
                shrinkAnim.onfinish = () => {
                    // Check if this wave is still valid
                    if (btn.dataset.pageTurnToken !== waveToken) return;
                    
                    // Update THIS button's content while it's invisible (between shrink and grow)
                    slide.updateSingleButtonContent(btn, event, globalEventIndex, allEvents);
                    
                    // RECALCULATE lock state AFTER content update (button now has new dataset.locked)
                    const newLocked = btn.dataset.locked === 'true';
                    
                    // ENSURE click handler is set with correct index (redundancy for safety)
                    setupClickHandler(btn, globalEventIndex);
                    
                    // Step 2: Grow in (new content) with CORRECT lock state
                    const growAnim = btn.animate(
                        thumbPageTurnGrowKeyframes(isThumbsDesktop, newLocked),
                        {
                            duration: GROW_MS,
                            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                            fill: 'both'
                        }
                    );
                    
                    growAnim.onfinish = () => {
                        delete btn.dataset.pageTurnToken;
                        // Re-apply correct filter-based visual state (in case filters changed during animation)
                        const finalLocked = btn.dataset.locked === 'true';
                        if (finalLocked) {
                            btn.style.setProperty('opacity', '0.5', 'important');
                            btn.style.setProperty('filter', 'none', 'important');
                            btn.classList.add('locked');
                        } else {
                            btn.style.setProperty('opacity', '1', 'important');
                            btn.style.setProperty('filter', 'none', 'important');
                            btn.classList.remove('locked');
                        }
                        // Final safety: ensure click handler is still set correctly
                        if (!btn.onclick || btn.dataset.eventIndex !== String(globalEventIndex)) {
                            setupClickHandler(btn, globalEventIndex);
                        }
                    };
                };
            });
}
