/**
 * Multi-row editor for relevant locations (name, country w/ autocomplete, reasoning).
 * Used by hero archive and story "secondary country" groups (same row shape; different containers / placeholders).
 * Rows can be reordered with ↑ / ↓.
 */
(function () {
    'use strict';

    function setupListAutocomplete(input, options) {
        if (!input) return;
        options = options || {};
        const type = options.autocompleteType || 'countries';
        const auto = window.eventManager?.formService?.autocompleteService;
        if (!auto || typeof auto.setupAutocomplete !== 'function') return;

        input.dataset.autocompleteSetup = 'false';

        if (type === 'countries') {
            const lh = window.LocationFlagHelpers;
            const opts =
                lh && typeof lh.getCountryCommonNamesForAutocomplete === 'function'
                    ? lh.getCountryCommonNamesForAutocomplete()
                    : [];
            if (opts.length > 0) auto.setupAutocomplete(input, opts, 'countries');
            return;
        }
        if (type === 'heroes') {
            const heroes =
                window.eventManager?.heroes || window.globeController?.dataModel?.heroes || [];
            if (heroes.length) auto.setupAutocomplete(input, heroes, 'heroes');
            return;
        }
        if (type === 'factions') {
            const factionList =
                window.eventManager?.factions?.length > 0
                    ? window.eventManager.factions
                    : window.globeController?.dataModel?.factions || [];
            if (factionList.length) auto.setupAutocomplete(input, factionList, 'factions');
            return;
        }
        if (type === 'npcs') {
            const npcList = window.eventManager?.npcs || [];
            if (npcList.length) auto.setupAutocomplete(input, npcList, 'npcs');
        }
    }

    function moveRow(row, delta) {
        const p = row.parentNode;
        if (!p) return;
        const ix = Array.prototype.indexOf.call(p.children, row);
        const j = ix + delta;
        if (j < 0 || j >= p.children.length) return;
        const sibling = p.children[j];
        if (delta < 0) {
            p.insertBefore(row, sibling);
        } else {
            p.insertBefore(row, sibling.nextSibling);
        }
    }

    function appendRow(container, data, options) {
        if (!container) return;
        options = options || {};
        const ph = options.placeholders || {};

        const row = document.createElement('div');
        row.className = 'event-slide-inline-editor__relevant-loc-row';

        const reorder = document.createElement('div');
        reorder.className = 'event-slide-relevant-loc-reorder';
        const up = document.createElement('button');
        up.type = 'button';
        up.className = 'event-slide-relevant-loc-reorder__btn';
        up.dataset.role = 'rel-loc-up';
        up.setAttribute('aria-label', 'Move up');
        up.textContent = '↑';
        const down = document.createElement('button');
        down.type = 'button';
        down.className = 'event-slide-relevant-loc-reorder__btn';
        down.dataset.role = 'rel-loc-down';
        down.setAttribute('aria-label', 'Move down');
        down.textContent = '↓';
        up.addEventListener('click', function () {
            moveRow(row, -1);
        });
        down.addEventListener('click', function () {
            moveRow(row, 1);
        });
        reorder.appendChild(up);
        reorder.appendChild(down);

        const nameIn = document.createElement('input');
        nameIn.className = 'event-slide-inline-editor__input';
        nameIn.type = 'text';
        nameIn.placeholder = ph.locationName != null ? ph.locationName : 'Location name';
        nameIn.setAttribute('spellcheck', 'true');
        nameIn.dataset.role = 'rel-loc-name';
        if (data && data.locationName) nameIn.value = data.locationName;

        const countryIn = document.createElement('input');
        countryIn.className = 'event-slide-inline-editor__input';
        countryIn.type = 'text';
        countryIn.setAttribute('spellcheck', 'false');
        countryIn.setAttribute('autocomplete', 'off');
        countryIn.placeholder = ph.country != null ? ph.country : 'Country (flag)';
        countryIn.dataset.role = 'rel-loc-country';
        if (data && data.country) countryIn.value = data.country;

        const reasonIn = document.createElement('input');
        reasonIn.className = 'event-slide-inline-editor__input';
        reasonIn.type = 'text';
        reasonIn.placeholder = ph.reasoning != null ? ph.reasoning : 'Reason (e.g. Place of birth)';
        reasonIn.setAttribute('spellcheck', 'true');
        reasonIn.dataset.role = 'rel-loc-reason';
        if (data && data.reasoning) reasonIn.value = data.reasoning;

        const rem = document.createElement('button');
        rem.type = 'button';
        rem.className = 'event-slide-inline-editor__small-btn';
        rem.textContent = '−';
        rem.setAttribute('aria-label', 'Remove row');
        rem.addEventListener('click', function () {
            if (container.children.length > 1) row.remove();
        });

        row.appendChild(reorder);
        row.appendChild(nameIn);
        row.appendChild(countryIn);
        row.appendChild(reasonIn);
        row.appendChild(rem);
        container.appendChild(row);

        setupListAutocomplete(countryIn, options);
    }

    function render(container, locations, options) {
        if (!container) return;
        container.innerHTML = '';
        const arr = Array.isArray(locations) && locations.length > 0 ? locations : [{}];
        arr.forEach(function (item) {
            appendRow(container, item, options);
        });
    }

    function resolveContainer(containerOrId) {
        if (typeof containerOrId === 'string') {
            return document.getElementById(containerOrId);
        }
        return containerOrId;
    }

    function collect(containerOrId) {
        const c =
            resolveContainer(containerOrId) ||
            (typeof document !== 'undefined' ? document.getElementById('eventSlideEditRelevantLocations') : null);
        if (!c) return [];
        return Array.prototype.slice
            .call(c.querySelectorAll('.event-slide-inline-editor__relevant-loc-row'))
            .map(function (row) {
                const n = row.querySelector('[data-role="rel-loc-name"]');
                const co = row.querySelector('[data-role="rel-loc-country"]');
                const r = row.querySelector('[data-role="rel-loc-reason"]');
                return {
                    locationName: (n && n.value ? n.value : '').trim(),
                    country: (co && co.value ? co.value : '').trim(),
                    reasoning: (r && r.value ? r.value : '').trim()
                };
            })
            .filter(function (entry) {
                return entry.locationName || entry.country || entry.reasoning;
            });
    }

    /**
     * @param {string|{ containerId?: string, placeholders?: object, autocompleteType?: string }} [arg] — omit for hero default container
     */
    function addRow(arg) {
        const opts = typeof arg === 'object' && arg ? arg : {};
        const containerId =
            typeof arg === 'string' && arg ? arg : opts.containerId || 'eventSlideEditRelevantLocations';
        const c = document.getElementById(containerId);
        const passOpts = Object.keys(opts).length ? opts : undefined;
        if (c) appendRow(c, {}, passOpts);
    }

    window.HeroRelevantLocationsEditor = {
        render: render,
        collect: collect,
        addRow: addRow
    };
})();
