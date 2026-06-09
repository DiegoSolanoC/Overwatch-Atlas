/**
 * Single-row editor for bio archive entry lifetime (optional start / end story events).
 */
(function () {
    'use strict';

    function storyEventAutocompleteApi() {
        return window.HeroBiographyStoryEventAutocomplete || null;
    }

    function wireStoryEventInput(input) {
        if (!input) return;
        const api = storyEventAutocompleteApi();
        if (api && typeof api.wireStoryEventNameAutocomplete === 'function') {
            api.wireStoryEventNameAutocomplete(input);
            return;
        }
        if (input.dataset.entryLifetimeStoryEventWirePending === '1') return;
        input.dataset.entryLifetimeStoryEventWirePending = '1';
        requestAnimationFrame(function () {
            delete input.dataset.entryLifetimeStoryEventWirePending;
            wireStoryEventInput(input);
        });
    }

    function resolveContainer(containerOrId) {
        if (!containerOrId) return null;
        if (typeof containerOrId === 'string') {
            return document.getElementById(containerOrId);
        }
        return containerOrId;
    }

    /**
     * @param {HTMLElement | string | null | undefined} containerOrId
     * @param {object | null | undefined} lifetimeRange
     */
    function render(containerOrId, lifetimeRange) {
        const container = resolveContainer(containerOrId);
        if (!container) return;

        const data = lifetimeRange && typeof lifetimeRange === 'object' ? lifetimeRange : {};
        container.innerHTML = '';

        const row = document.createElement('div');
        row.className = 'event-slide-bio-conn-range event-slide-entry-lifetime';

        const eventsRow = document.createElement('div');
        eventsRow.className = 'event-slide-bio-conn-range__events';

        const startPair = document.createElement('div');
        startPair.className = 'event-slide-bio-conn-range__event-field';
        const startLab = document.createElement('span');
        startLab.className = 'event-slide-bio-conn-range__event-label';
        startLab.textContent = 'Born / founded at (optional)';
        const startWrap = document.createElement('div');
        startWrap.className = 'event-slide-bio-conn-range__event-input-wrap';
        const startIn = document.createElement('input');
        startIn.type = 'text';
        startIn.spellcheck = false;
        startIn.autocomplete = 'off';
        startIn.placeholder = 'Story event — empty = existed before timeline';
        startIn.className = 'event-slide-inline-editor__input event-slide-story-event-input';
        startIn.dataset.entryLifetimeStart = '1';
        if (data.startEvent) startIn.value = data.startEvent;
        startWrap.appendChild(startIn);
        startPair.appendChild(startLab);
        startPair.appendChild(startWrap);
        wireStoryEventInput(startIn);

        const sep = document.createElement('span');
        sep.className = 'event-slide-bio-conn-range__event-sep';
        sep.setAttribute('aria-hidden', 'true');
        sep.textContent = '→';

        const endPair = document.createElement('div');
        endPair.className = 'event-slide-bio-conn-range__event-field';
        const endLab = document.createElement('span');
        endLab.className = 'event-slide-bio-conn-range__event-label';
        endLab.textContent = 'Until (optional)';
        const endWrap = document.createElement('div');
        endWrap.className = 'event-slide-bio-conn-range__event-input-wrap';
        const endIn = document.createElement('input');
        endIn.type = 'text';
        endIn.spellcheck = false;
        endIn.autocomplete = 'off';
        endIn.placeholder = 'Story event — empty = still active';
        endIn.className = 'event-slide-inline-editor__input event-slide-story-event-input';
        endIn.dataset.entryLifetimeEnd = '1';
        if (data.endEvent) endIn.value = data.endEvent;
        endWrap.appendChild(endIn);
        endPair.appendChild(endLab);
        endPair.appendChild(endWrap);
        wireStoryEventInput(endIn);

        eventsRow.appendChild(startPair);
        eventsRow.appendChild(sep);
        eventsRow.appendChild(endPair);
        row.appendChild(eventsRow);
        container.appendChild(row);
    }

    /**
     * @param {HTMLElement | string | null | undefined} containerOrId
     * @returns {object | null}
     */
    function collect(containerOrId) {
        const container = resolveContainer(containerOrId);
        if (!container) return null;

        const startEvent = String(
            container.querySelector('[data-entry-lifetime-start]')?.value || '',
        ).trim();
        const endEvent = String(
            container.querySelector('[data-entry-lifetime-end]')?.value || '',
        ).trim();

        if (!startEvent && !endEvent) return null;

        /** @type {{ startEvent?: string, endEvent?: string }} */
        const out = {};
        if (startEvent) out.startEvent = startEvent;
        if (endEvent) out.endEvent = endEvent;
        return out;
    }

    window.BioArchiveEntryLifetimeEditor = {
        render,
        collect,
    };
})();
