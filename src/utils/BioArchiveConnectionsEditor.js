/**
 * Multi-row editor for Heroes / Factions / NPCs archive "connections":
 * kind (hero | faction | npc), linked name (same autocomplete as story relevancy),
 * directional relationship text (this entry → them, them → this entry).
 */
(function () {
    'use strict';

    function sanitizeConnectionEntityName(raw) {
        var t = String(raw == null ? '' : raw).trim();
        while (t.length > 0 && /[,;]\s*$/.test(t)) {
            t = t.replace(/[,;]\s*$/, '').trim();
        }
        return t;
    }

    function setupEntityAutocomplete(entityInput, kindSelect) {
        if (!entityInput || !kindSelect) return;
        const auto = window.eventManager?.formService?.autocompleteService;
        if (!auto || typeof auto.setupAutocomplete !== 'function') return;
        entityInput.dataset.autocompleteSetup = 'false';
        const kind = kindSelect.value;
        if (kind === 'faction') {
            const factionList =
                window.eventManager?.factions?.length > 0
                    ? window.eventManager.factions
                    : window.globeController?.dataModel?.factions || [];
            if (factionList.length) auto.setupAutocomplete(entityInput, factionList, 'factions');
            return;
        }
        if (kind === 'npc') {
            const npcList = window.eventManager?.npcs || [];
            if (npcList.length) auto.setupAutocomplete(entityInput, npcList, 'npcs');
            return;
        }
        const heroes = window.eventManager?.heroes || window.globeController?.dataModel?.heroes || [];
        if (heroes.length) auto.setupAutocomplete(entityInput, heroes, 'heroes');
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

    function appendRow(container, data) {
        if (!container) return;
        data = data || {};

        const row = document.createElement('div');
        row.className = 'event-slide-inline-editor__relevant-loc-row event-slide-bio-conn-row';

        const reorder = document.createElement('div');
        reorder.className = 'event-slide-relevant-loc-reorder';
        const up = document.createElement('button');
        up.type = 'button';
        up.className = 'event-slide-relevant-loc-reorder__btn';
        up.dataset.role = 'bio-conn-up';
        up.setAttribute('aria-label', 'Move up');
        up.textContent = '↑';
        const down = document.createElement('button');
        down.type = 'button';
        down.className = 'event-slide-relevant-loc-reorder__btn';
        down.dataset.role = 'bio-conn-down';
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

        const kindSel = document.createElement('select');
        kindSel.className = 'event-slide-inline-editor__input event-slide-bio-conn-row__kind';
        kindSel.dataset.role = 'bio-conn-kind';
        kindSel.setAttribute('aria-label', 'Connection type');
        [['hero', 'Hero'], ['faction', 'Faction'], ['npc', 'NPC']].forEach(function (pair) {
            const opt = document.createElement('option');
            opt.value = pair[0];
            opt.textContent = pair[1];
            kindSel.appendChild(opt);
        });
        let k = String(data.kind || 'hero').toLowerCase();
        if (k === 'character') k = 'hero';
        if (k !== 'faction' && k !== 'npc') k = 'hero';
        kindSel.value = k;

        const entityIn = document.createElement('input');
        entityIn.className = 'event-slide-inline-editor__input';
        entityIn.type = 'text';
        entityIn.spellcheck = true;
        entityIn.autocomplete = 'off';
        entityIn.placeholder = 'Name (autocomplete)';
        entityIn.dataset.role = 'bio-conn-name';
        if (data.name) entityIn.value = data.name;

        let subjToLinked =
            data.reasoningSubjectToLinked != null ? String(data.reasoningSubjectToLinked).trim() : '';
        let linkedToSubj =
            data.reasoningLinkedToSubject != null ? String(data.reasoningLinkedToSubject).trim() : '';
        const leg = data.reasoning != null ? String(data.reasoning).trim() : '';
        if (!subjToLinked && !linkedToSubj && leg) {
            subjToLinked = leg;
            linkedToSubj = leg;
        }

        const reasonOut = document.createElement('input');
        reasonOut.className = 'event-slide-inline-editor__input';
        reasonOut.type = 'text';
        reasonOut.spellcheck = true;
        reasonOut.placeholder = 'This entry → them (e.g. mentor to)';
        reasonOut.dataset.role = 'bio-conn-reason-out';
        if (subjToLinked) reasonOut.value = subjToLinked;

        const reasonIn = document.createElement('input');
        reasonIn.className = 'event-slide-inline-editor__input';
        reasonIn.type = 'text';
        reasonIn.spellcheck = true;
        reasonIn.placeholder = 'Them → this entry (e.g. student of)';
        reasonIn.dataset.role = 'bio-conn-reason-in';
        if (linkedToSubj) reasonIn.value = linkedToSubj;

        const rem = document.createElement('button');
        rem.type = 'button';
        rem.className = 'event-slide-inline-editor__small-btn';
        rem.textContent = '−';
        rem.setAttribute('aria-label', 'Remove row');
        rem.addEventListener('click', function () {
            if (container.children.length > 1) row.remove();
        });

        kindSel.addEventListener('change', function () {
            entityIn.value = '';
            setupEntityAutocomplete(entityIn, kindSel);
        });

        row.appendChild(reorder);
        row.appendChild(kindSel);
        row.appendChild(entityIn);
        row.appendChild(reasonOut);
        row.appendChild(reasonIn);
        row.appendChild(rem);
        container.appendChild(row);

        setupEntityAutocomplete(entityIn, kindSel);
    }

    function render(container, items) {
        if (!container) return;
        container.innerHTML = '';
        const arr = Array.isArray(items) && items.length > 0 ? items : [{}];
        arr.forEach(function (item) {
            appendRow(container, item);
        });
    }

    function resolveContainer(containerOrId) {
        if (typeof containerOrId === 'string') {
            return document.getElementById(containerOrId);
        }
        return containerOrId;
    }

    function collect(containerOrId) {
        const c = resolveContainer(containerOrId) || document.getElementById('eventSlideEditBioConnections');
        if (!c) return [];
        return Array.prototype.slice
            .call(c.querySelectorAll('.event-slide-bio-conn-row'))
            .map(function (row) {
                const kindEl = row.querySelector('[data-role="bio-conn-kind"]');
                const n = row.querySelector('[data-role="bio-conn-name"]');
                const rout = row.querySelector('[data-role="bio-conn-reason-out"]');
                const rin = row.querySelector('[data-role="bio-conn-reason-in"]');
                let kind = String((kindEl && kindEl.value) || 'hero').toLowerCase();
                if (kind !== 'faction' && kind !== 'npc') kind = 'hero';
                return {
                    kind: kind,
                    name: sanitizeConnectionEntityName(n && n.value ? n.value : ''),
                    reasoningSubjectToLinked: (rout && rout.value ? rout.value : '').trim(),
                    reasoningLinkedToSubject: (rin && rin.value ? rin.value : '').trim()
                };
            })
            .filter(function (entry) {
                return (
                    entry.name ||
                    entry.reasoningSubjectToLinked ||
                    entry.reasoningLinkedToSubject
                );
            });
    }

    function addRow(arg) {
        const opts = typeof arg === 'object' && arg ? arg : {};
        const containerId =
            typeof arg === 'string' && arg ? arg : opts.containerId || 'eventSlideEditBioConnections';
        const c = document.getElementById(containerId);
        if (c) appendRow(c, {});
    }

    window.BioArchiveConnectionsEditor = {
        render: render,
        collect: collect,
        addRow: addRow
    };
})();
