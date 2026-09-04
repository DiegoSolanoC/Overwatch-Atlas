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
import { wireBioDeleteButton } from '../../interface-shared/bio-archive/BioArchiveDeleteButton.js';
import { wireSourcePairRow } from '../../interface-shared/storyEventSourceAutocomplete.js';
import { wireStoryEventCommentaryAutocomplete } from '../../interface-shared/storyEventCommentaryAutocomplete.js';
import { normalizeCommentaryList } from '../../interface-shared/storyEventCommentary.js';
import { getSourceUrls } from './sources/sourceUrlUtils.js';
// Variants
import { runRenderVariantBar } from './variants/renderVariantBar.js';
import { runOnVariantAdd } from './variants/onVariantAdd.js';
import { runOnVariantRemove } from './variants/onVariantRemove.js';
import { runOnVariantMakePrimary } from './variants/onVariantMakePrimary.js';
import { runSaveCurrentVariantData } from './variants/saveCurrentVariantData.js';
import { runConvertRootEventToMulti } from './variants/convertRootEventToMulti.js';
import { runCollapseMultiToSingleRoot } from './variants/collapseMultiToSingleRoot.js';
// Pagination
import { getDockTimelineEventsForPagination } from '../../../gallery/gallery-mode/heroBiographyDockTimeline.js';
import { syncStandaloneSlideEventContext } from '../../../system-interface/interface-shared/syncStandaloneSlideEventContext.js';
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
import {
    clearEventSourceMediaEmbed,
    resetSourceMediaMusicDuckState,
    runShowYouTubeOverlay,
    runShowPdfOverlay,
    restoreEventImageFromSourceMedia,
} from './image-overlay/eventSourceMediaOverlay.js';

/**
 * @param {string} [value]
 * @returns {HTMLDivElement}
 */
function createInlineSourceLinkRow(value = '') {
    const row = document.createElement('div');
    row.className = 'event-slide-inline-editor__source-link-row';

    const input = document.createElement('input');
    input.className = 'event-slide-inline-editor__input';
    input.dataset.role = 'source-url';
    input.type = 'text';
    input.spellcheck = false;
    input.autocomplete = 'on';
    input.placeholder = 'URL (optional)';
    input.value = value;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'event-slide-inline-editor__small-btn';
    removeBtn.dataset.role = 'source-link-remove';
    removeBtn.textContent = '−';
    removeBtn.addEventListener('click', () => {
        const stack = row.parentElement;
        if (!stack) return;
        if (stack.querySelectorAll('[data-role="source-url"]').length <= 1) {
            input.value = '';
            return;
        }
        row.remove();
    });

    row.append(input, removeBtn);
    return row;
}

/**
 * @param {HTMLElement} stack
 * @param {string[]} urls
 */
function populateInlineSourceLinks(stack, urls) {
    if (!stack) return;
    stack.replaceChildren();
    const list = urls.length > 0 ? urls : [''];
    list.forEach((url) => stack.appendChild(createInlineSourceLinkRow(url)));

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'event-slide-inline-editor__small-btn event-slide-inline-editor__source-link-add';
    addBtn.dataset.role = 'source-link-add';
    addBtn.textContent = '+ link';
    addBtn.addEventListener('click', () => {
        const linkRow = createInlineSourceLinkRow('');
        stack.insertBefore(linkRow, addBtn);
        linkRow.querySelector('[data-role="source-url"]')?.focus();
    });
    stack.appendChild(addBtn);
}

/**
 * @returns {HTMLDivElement}
 */
function createInlineSourceRow() {
    const row = document.createElement('div');
    row.className = 'event-slide-inline-editor__source-row';

    const textInput = document.createElement('input');
    textInput.className = 'event-slide-inline-editor__input';
    textInput.dataset.role = 'source-text';
    textInput.type = 'text';
    textInput.spellcheck = true;
    textInput.autocomplete = 'on';
    textInput.placeholder = 'Source text';

    const linksStack = document.createElement('div');
    linksStack.className = 'event-slide-inline-editor__source-links';
    linksStack.dataset.role = 'source-links';
    populateInlineSourceLinks(linksStack, ['']);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'event-slide-inline-editor__small-btn';
    removeBtn.dataset.role = 'source-remove';
    removeBtn.textContent = '-';

    row.append(textInput, linksStack, removeBtn);
    return row;
}

/**
 * @param {string} [name]
 * @returns {HTMLDivElement}
 */
function createInlineCommentaryRow(name = '') {
    const row = document.createElement('div');
    row.className = 'event-slide-inline-editor__source-row event-slide-inline-editor__commentary-row';

    const textInput = document.createElement('input');
    textInput.className = 'event-slide-inline-editor__input';
    textInput.dataset.role = 'commentary-name';
    textInput.type = 'text';
    textInput.spellcheck = true;
    textInput.autocomplete = 'off';
    textInput.placeholder = 'Dialogue Theater interaction name';
    textInput.value = name || '';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'event-slide-inline-editor__small-btn';
    removeBtn.dataset.role = 'commentary-remove';
    removeBtn.textContent = '-';

    row.append(textInput, removeBtn);
    return row;
}

/**
 * Build a fresh standalone-slide controller. The returned object is meant
 * to be assigned to `window.standaloneEventSlide` by the load-out shell.
 *
 * @returns {Object} the slide controller
 */
export function createStandaloneEventSlide() {
    const slide = {
        currentEventIndex: 0,
        currentPage: 1, // Track current page for marker display
        allEvents: [],
        /** True when the slide row comes from the main-timeline dock (thumbs / story), not satellite Event Manager rows. Do not infer via `allEvents === getDockTimelineEvents()` — references can differ while content is still dock. */
        _presentationFromDockTimeline: true,
        currentEventData: null,
        currentVariantIndex: 0,
        isEditing: false,
        currentImagePath: null,
        activeYouTubeVideoId: '',
        activePdfSourceUrl: '',
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
            const dockList = getDockTimelineEventsForPagination();
            const events =
                options.eventList != null ? options.eventList : dockList;
            if (index < 0 || index >= events.length) return;
            this.currentEventIndex = index;
            this.allEvents = events;
            this._presentationFromDockTimeline =
                options.eventList == null || events === dockList;
            
            const eventData = events[index];
            syncStandaloneSlideEventContext(this, eventData, index, options);
            this.showStandaloneEventSlide(eventData, index, options);
        },
        
        // Show event slide with event data
        showStandaloneEventSlide(eventData, globalIndex, options = {}) { return runShowStandaloneEventSlide(this, eventData, globalIndex, options); },
        
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

            srcs.forEach((source) => {
                const row = createInlineSourceRow();
                const textInput = row.querySelector('[data-role="source-text"]');
                if (textInput instanceof HTMLInputElement) {
                    textInput.value = source.text || '';
                }
                const linksStack = row.querySelector('[data-role="source-links"]');
                populateInlineSourceLinks(linksStack, getSourceUrls(source));

                row.querySelector('[data-role="source-remove"]')?.addEventListener('click', () => {
                    if (container.children.length > 1) row.remove();
                });

                container.appendChild(row);
                wireSourcePairRow(row);
            });
        },

        addSourceRow() {
            const container = document.getElementById('eventSlideEditSources');
            if (!container) return;

            const row = createInlineSourceRow();
            row.querySelector('[data-role="source-remove"]')?.addEventListener('click', () => {
                if (container.children.length > 1) row.remove();
            });
            container.appendChild(row);
            wireSourcePairRow(row);
        },

        /**
         * @param {string[]|undefined|null} commentary
         */
        renderCommentaryEditor(commentary) {
            const container = document.getElementById('eventSlideEditCommentary');
            if (!container) return;

            container.innerHTML = '';
            const names = normalizeCommentaryList(commentary);
            const rows = names.length > 0 ? names : [''];

            rows.forEach((name) => {
                const row = createInlineCommentaryRow(name);
                row.querySelector('[data-role="commentary-remove"]')?.addEventListener('click', () => {
                    if (container.children.length > 1) row.remove();
                    else {
                        const input = row.querySelector('[data-role="commentary-name"]');
                        if (input instanceof HTMLInputElement) input.value = '';
                    }
                });
                container.appendChild(row);
                const input = row.querySelector('[data-role="commentary-name"]');
                if (input instanceof HTMLInputElement) {
                    wireStoryEventCommentaryAutocomplete(input);
                }
            });
        },

        addCommentaryRow() {
            const container = document.getElementById('eventSlideEditCommentary');
            if (!container) return;

            const row = createInlineCommentaryRow('');
            row.querySelector('[data-role="commentary-remove"]')?.addEventListener('click', () => {
                if (container.children.length > 1) row.remove();
                else {
                    const input = row.querySelector('[data-role="commentary-name"]');
                    if (input instanceof HTMLInputElement) input.value = '';
                }
            });
            container.appendChild(row);
            const input = row.querySelector('[data-role="commentary-name"]');
            if (input instanceof HTMLInputElement) {
                wireStoryEventCommentaryAutocomplete(input);
                input.focus();
            }
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
            
            const entryName = eventData?.name || 'this entry';
            if (confirm(`Are you sure you want to delete "${entryName}"?`)) {
                if (em.deleteEvent(idx, { skipConfirm: true })) {
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
            const allEvents = getDockTimelineEventsForPagination();

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

        showYouTubeOverlay(sourceUrl) { return runShowYouTubeOverlay(this, sourceUrl); },

        showPdfOverlay(sourceUrl) { return runShowPdfOverlay(this, sourceUrl); },

        restoreEventImageFromSourceMedia() { return restoreEventImageFromSourceMedia(this); },

        /** @deprecated */
        restoreEventImageFromYouTube() { return restoreEventImageFromSourceMedia(this); },
    };
    wireBioDeleteButton(slide);
    void import('../../../gallery/gallery-mode/factionBiographyPortraitLooks.js')
        .then((m) => m.loadFactionBiographyLooksMap())
        .catch(() => {});
    return slide;
}

