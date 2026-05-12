/**
 * Factory for the standalone Event Slide controller.
 *
 * Returns the object assigned to `window.standaloneEventSlide` when the
 * Event System Load Out is mounted. The object combines six concerns:
 *
 *   - slide history back-stack (`pushSlideHistoryIfOpen`, `goBackSlide`, etc.)
 *   - slide display (`showEvent`, `showStandaloneEventSlide`, `displaySlide`,
 *     `updateSourcesAndFilters`, `renderEventFilters`, `getCountryLabel`)
 *   - inline edit (`wireEditButtons`, `startFullEdit`, `createInlineEditor`,
 *     `populateInlineEditor`, `saveFullEdit`, `cancelEdit`, `renderSourcesEditor`,
 *     `addSourceRow`, `syncLocationTypeUI`, `deleteCurrentEvent`)
 *   - variant tabs (`renderVariantBar`, variant tab handlers,
 *     `saveCurrentVariantData`, `convertRootEventToMulti`, `collapseMultiToSingleRoot`)
 *   - pagination (`setupStandalonePagination`, `wireNumberButtons`,
 *     `updateNumberButtons`, `animatePageTurn`, `updateSingleButtonContent`,
 *     `wireNavButtons`, `updateNavButtons`)
 *   - image overlay (`toggleImageOverlay`, `showImageOverlay`, `hideImageOverlay`,
 *     `hideImageOverlayTemporarily`, `showImageOverlayGradually`,
 *     `hideImageOverlayGradually`, `updateGlobalToggleButtonLabel`)
 *
 * The factory keeps the slide as a single object literal so all methods can
 * share `this`-bound state (`isEditing`, `currentEventIndex`, `currentPage`,
 * `currentImagePath`, `_slideHistoryStack`, etc.). External consumers reach in
 * through `window.standaloneEventSlide.<methodName>`.
 */

// History
import { runGoBackSlide } from './history/goBackSlide.js';
// Display
import { runShowStandaloneEventSlide } from './display/showStandaloneEventSlide.js';
import { runDisplaySlide } from './display/displaySlide.js';
import { runUpdateSourcesAndFilters } from './display/updateSourcesAndFilters.js';
import { runRenderEventFilters } from './display/renderEventFilters.js';
import { runWireNavButtons } from './display/wireNavButtons.js';
import { runHideEventSlide } from './display/hideEventSlide.js';
// Inline edit
import { runWireEditButtons } from './edit/wireEditButtons.js';
import { runStartFullEdit } from './edit/startFullEdit.js';
import { runCreateInlineEditor } from './edit/createInlineEditor.js';
import { runPopulateInlineEditor } from './edit/populateInlineEditor.js';
import { runCancelEdit } from './edit/cancelEdit.js';
import { runSaveFullEdit } from './edit/saveFullEdit.js';
// Variants
import { runRenderVariantBar } from './variants/renderVariantBar.js';
import { runOnVariantAdd } from './variants/onVariantAdd.js';
import { runOnVariantRemove } from './variants/onVariantRemove.js';
import { runOnVariantMakePrimary } from './variants/onVariantMakePrimary.js';
import { runSaveCurrentVariantData } from './variants/saveCurrentVariantData.js';
import { runConvertRootEventToMulti } from './variants/convertRootEventToMulti.js';
import { runCollapseMultiToSingleRoot } from './variants/collapseMultiToSingleRoot.js';
// Pagination
import { runSetupStandalonePagination } from './pagination/setupStandalonePagination.js';
import { runWireNumberButtons } from './pagination/wireNumberButtons.js';
import { runAnimatePageTurn } from './pagination/animatePageTurn.js';
import { runUpdateSingleButtonContent } from './pagination/updateSingleButtonContent.js';
// Image overlay
import { runToggleImageOverlay } from './image-overlay/toggleImageOverlay.js';
import { runShowImageOverlay } from './image-overlay/showImageOverlay.js';
import { runHideImageOverlayTemporarily } from './image-overlay/hideImageOverlayTemporarily.js';
import { runShowImageOverlayGradually } from './image-overlay/showImageOverlayGradually.js';
import { runHideImageOverlayGradually } from './image-overlay/hideImageOverlayGradually.js';
import { runHideImageOverlay } from './image-overlay/hideImageOverlay.js';

/**
 * Build a fresh standalone-slide controller. The returned object is meant
 * to be assigned to `window.standaloneEventSlide` by the load-out shell.
 *
 * @returns {Object} the slide controller
 */
export function createStandaloneEventSlide() {
    return {
        currentEventIndex: 0,
        currentPage: 1, // Track current page for marker display
        allEvents: [],
        /** True when the slide row comes from the main-timeline dock (thumbs / story), not satellite Event Manager rows. Do not infer via `allEvents === getDockTimelineEvents()` — references can differ while content is still dock. */
        _presentationFromDockTimeline: true,
        currentEventData: null,
        currentVariantIndex: 0,
        isEditing: false,
        /** @type {{ archiveSource: string, eventIndex: number, presentationFromDock: boolean }[]} */
        _slideHistoryStack: [],
        _slideHistoryRestoring: false,

        pushSlideHistoryIfOpen() {
            const panel = document.getElementById('eventSlide');
            if (!panel?.classList.contains('open')) return;
            if (this._slideHistoryRestoring) return;
            const em = window.eventManager;
            this._slideHistoryStack.push({
                archiveSource: em?.dataService?.getArchiveSource?.() || 'story',
                eventIndex: this.currentEventIndex,
                presentationFromDock: !!this._presentationFromDockTimeline
            });
            this.updateBackButtonVisibility();
        },

        updateBackButtonVisibility() {
            const btn = document.getElementById('eventSlideBack');
            if (!btn) return;
            const n = this._slideHistoryStack?.length || 0;
            btn.style.display = n > 0 ? 'inline-flex' : 'none';
            btn.disabled = n === 0;
            btn.setAttribute('aria-hidden', n === 0 ? 'true' : 'false');
        },

        clearSlideHistory() {
            if (this._slideHistoryStack) {
                this._slideHistoryStack.length = 0;
            }
            this.updateBackButtonVisibility();
        },

        async goBackSlide() { return runGoBackSlide(this); },

        /**
         * @param {number} index
         * @param {{ eventList?: Array<Object>, keepSlideHistory?: boolean }} [options] - `eventList` for Event Manager rows; omit for dock. `keepSlideHistory` when following relevancy / prev-next while Back stack is active.
         */
        showEvent(index, options = {}) {
            if (!this._slideHistoryRestoring && !options.keepSlideHistory) {
                this.clearSlideHistory();
            }
            const dockList = window.eventManager?.getDockTimelineEvents?.() || [];
            const events =
                options.eventList != null ? options.eventList : dockList;
            if (index < 0 || index >= events.length) return;
            this.currentEventIndex = index;
            this.allEvents = events;
            this._presentationFromDockTimeline =
                options.eventList == null || events === dockList;
            
            const eventData = events[index];
            this.showStandaloneEventSlide(eventData, index);
        },
        
        // Show event slide with event data
        showStandaloneEventSlide(eventData, globalIndex) { return runShowStandaloneEventSlide(this, eventData, globalIndex); },
        
        // Display the slide panel
        displaySlide(eventName, imagePath, description, eventData, isMultiEvent, displayEvent) { return runDisplaySlide(this, eventName, imagePath, description, eventData, isMultiEvent, displayEvent); },
        
        updateSourcesAndFilters(event) { return runUpdateSourcesAndFilters(this, event); },
        
        renderEventFilters(event) { return runRenderEventFilters(this, event); },

        getCountryLabel(flagFile) {
            const map = window.FLAG_FILE_BY_COMMON;
            if (map) {
                for (const common of Object.keys(map).sort()) {
                    if (map[common] === flagFile) return common;
                }
            }
            return flagFile?.replace(/\.png$/i, '') || flagFile;
        },
        
        wireEditButtons(eventData, displayEvent, editBtn, saveBtn, titleEl, textEl) { return runWireEditButtons(this, eventData, displayEvent, editBtn, saveBtn, titleEl, textEl); },
        
        startFullEdit(eventData, displayEvent, editBtn, saveBtn) { return runStartFullEdit(this, eventData, displayEvent, editBtn, saveBtn); },
        
        createInlineEditor() { return runCreateInlineEditor(this); },
        
        populateInlineEditor(eventData, displayEvent) { return runPopulateInlineEditor(this, eventData, displayEvent); },
        
        syncLocationTypeUI() {
            const hid = document.getElementById('eventSlideEditLocationType');
            const type = hid ? hid.value : 'earth';
            const latLonRow = document.getElementById('eventSlideLatLonRow');
            const xyRow = document.getElementById('eventSlideXyRow');
            const locBtns = document.querySelectorAll('.event-slide-loc-type-btn');
            
            if (latLonRow) latLonRow.style.display = type === 'earth' ? 'grid' : 'none';
            if (xyRow) xyRow.style.display = type === 'earth' ? 'none' : 'grid';
            
            locBtns.forEach(btn => {
                if (btn.dataset.locationType === type) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        },
        
        renderSourcesEditor(sources) {
            const container = document.getElementById('eventSlideEditSources');
            if (!container) return;
            
            container.innerHTML = '';
            const srcs = Array.isArray(sources) && sources.length > 0 ? sources : [{ text: '', url: '' }];
            
            srcs.forEach((s, idx) => {
                const row = document.createElement('div');
                row.className = 'event-slide-inline-editor__source-row';
                row.innerHTML = `
                    <input class="event-slide-inline-editor__input" data-role="source-text" type="text" placeholder="Source text" value="${s.text || ''}" />
                    <input class="event-slide-inline-editor__input" data-role="source-url" type="text" placeholder="URL (optional)" value="${s.url || ''}" />
                    <button type="button" class="event-slide-inline-editor__small-btn" data-role="source-remove">-</button>
                `;
                row.querySelector('[data-role="source-remove"]').addEventListener('click', () => {
                    if (container.children.length > 1) row.remove();
                });
                container.appendChild(row);
            });
        },
        
        addSourceRow() {
            const container = document.getElementById('eventSlideEditSources');
            if (!container) return;
            
            const row = document.createElement('div');
            row.className = 'event-slide-inline-editor__source-row';
            row.innerHTML = `
                <input class="event-slide-inline-editor__input" data-role="source-text" type="text" placeholder="Source text" />
                <input class="event-slide-inline-editor__input" data-role="source-url" type="text" placeholder="URL (optional)" />
                <button type="button" class="event-slide-inline-editor__small-btn" data-role="source-remove">-</button>
            `;
            row.querySelector('[data-role="source-remove"]').addEventListener('click', () => {
                if (container.children.length > 1) row.remove();
            });
            container.appendChild(row);
        },
        
        renderVariantBar(eventData) { return runRenderVariantBar(this, eventData); },
        
        onVariantTabSelect(index) {
            const cur = this.currentVariantIndex ?? 0;
            if (index === cur) return;
            
            // Save current variant data before switching
            this.saveCurrentVariantData();
            
            this.currentVariantIndex = index;
            const { eventData } = this.editTarget;
            const target = eventData.variants[index];
            this.populateInlineEditor(eventData, target);
            this.renderVariantBar(eventData);
        },
        
        onVariantAdd() { return runOnVariantAdd(this); },
        
        onVariantRemove() { return runOnVariantRemove(this); },
        
        onVariantMakePrimary() { return runOnVariantMakePrimary(this); },
        
        saveCurrentVariantData() { return runSaveCurrentVariantData(this); },
        
        convertRootEventToMulti(eventData) { return runConvertRootEventToMulti(this, eventData); },
        
        collapseMultiToSingleRoot(eventData, keepVariant) { return runCollapseMultiToSingleRoot(this, eventData, keepVariant); },
        
        deleteCurrentEvent() {
            if (!this.editTarget) return;
            const { eventData } = this.editTarget;
            const em = window.eventManager;
            if (!em?.events || typeof em.deleteEvent !== 'function') return;
            
            const idx = em.events.indexOf(eventData);
            if (idx < 0) return;
            
            if (confirm('Are you sure you want to delete this event?')) {
                if (em.deleteEvent(idx)) {
                    this.hideEventSlide();
                }
            }
        },
        cancelEdit(editBtn, saveBtn) { return runCancelEdit(this, editBtn, saveBtn); },
        
        saveFullEdit(eventData, editBtn, saveBtn) { return runSaveFullEdit(this, eventData, editBtn, saveBtn); },
        
        wireNavButtons(eventData) { return runWireNavButtons(this, eventData); },
        
        updateNavButtons() {
            const prevBtn = document.getElementById('eventPrevBtn');
            const nextBtn = document.getElementById('eventNextBtn');
            // Buttons always enabled since navigation loops around
            if (prevBtn) prevBtn.disabled = false;
            if (nextBtn) nextBtn.disabled = false;
        },
        
        // Toggle image overlay
        updateGlobalToggleButtonLabel(isOn) {
            const globalBtn = document.getElementById('globalImageToggle');
            if (globalBtn) {
                const labelEl = globalBtn.querySelector('.globe-control-btn__label');
                if (labelEl) {
                    labelEl.textContent = isOn ? 'Image On' : 'Image Off';
                }
                if (isOn) {
                    globalBtn.classList.add('active');
                } else {
                    globalBtn.classList.remove('active');
                }
            }
        },
        hideEventSlide() { return runHideEventSlide(this); },
        
        setupStandalonePagination() { return runSetupStandalonePagination(this); },
        
        wireNumberButtons(pageEvents, pageNum, allEvents) { return runWireNumberButtons(this, pageEvents, pageNum, allEvents); },
        
        updateNumberButtons(pageEvents, pageNum, options = {}) {
            // Get all events for indexing (dock = main story timeline only)
            const allEvents = window.eventManager?.getDockTimelineEvents?.() || [];

            // Initial boot seeding bypasses the page-turn animation so the
            // user doesn't see thumbnails staggering in after the loading
            // overlay drops; animations are still used for real page changes.
            if (options.animate === false) {
                this.wireNumberButtons(pageEvents, pageNum, allEvents);
                return;
            }

            // Animate with content swap during animation (like globe)
            this.animatePageTurn(pageEvents, pageNum, allEvents);
        },
        
        animatePageTurn(pageEvents, pageNum, allEvents) { return runAnimatePageTurn(this, pageEvents, pageNum, allEvents); },
        
        updateSingleButtonContent(btn, event, globalEventIndex, allEvents) { return runUpdateSingleButtonContent(this, btn, event, globalEventIndex, allEvents); },
        
        toggleImageOverlay(imagePath) { return runToggleImageOverlay(this, imagePath); },
        
        showImageOverlay(imagePath) { return runShowImageOverlay(this, imagePath); },
        
        hideImageOverlayTemporarily(delayMs = 5000) { return runHideImageOverlayTemporarily(this, delayMs); },
        
        showImageOverlayGradually(imagePath, durationMs = 1500) { return runShowImageOverlayGradually(this, imagePath, durationMs); },
        
        hideImageOverlayGradually(durationMs = 600) { return runHideImageOverlayGradually(this, durationMs); },
        
        hideImageOverlay() { return runHideImageOverlay(this); },
    };
}

