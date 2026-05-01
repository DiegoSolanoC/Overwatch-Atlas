/**
 * Multi-row editor for Heroes / Factions / NPCs archive "connections":
 * layout mirrors the slide: This entry | relationship texts | Them (kind + name).
 * thisEntryLane A = this entry on the left of the slide, B = on the right (them fills the other side).
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

    function readSubjectOptsFromContainer(container) {
        if (!container || !container.dataset) return { subjectName: '', subjectKind: 'hero' };
        return {
            subjectName: String(container.dataset.bioConnSubjectName || '').trim(),
            subjectKind: String(container.dataset.bioConnSubjectKind || 'hero').toLowerCase()
        };
    }

    /** @param {Object|null|undefined} eventData */
    function subjectOptsFromArchiveRow(eventData, archiveSource) {
        var ev = eventData || {};
        var nm = ev.name != null ? String(ev.name).trim() : '';
        if (!nm && Array.isArray(ev.variants) && ev.variants[0] && ev.variants[0].name != null) {
            nm = String(ev.variants[0].name).trim();
        }
        var arch = String(archiveSource || 'heroes').toLowerCase();
        var sk = arch === 'factions' ? 'faction' : arch === 'npcs' ? 'npc' : 'hero';
        return { subjectName: nm, subjectKind: sk };
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

    function appendRow(container, data, subjectOpts) {
        if (!container) return;
        data = data || {};
        subjectOpts = subjectOpts || readSubjectOptsFromContainer(container);
        const subjectDisplay =
            String(subjectOpts.subjectName || '').trim() || 'This entry';

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

        const thisPanel = document.createElement('div');
        thisPanel.className = 'event-slide-bio-conn-row__this';
        const thisHead = document.createElement('div');
        thisHead.className = 'event-slide-bio-conn-row__panel-head';
        thisHead.textContent = 'This entry';
        const thisName = document.createElement('div');
        thisName.className = 'event-slide-bio-conn-row__this-name';
        thisName.textContent = subjectDisplay;
        thisName.title = 'The archive row you are editing';

        const laneFieldset = document.createElement('fieldset');
        laneFieldset.className = 'event-slide-bio-conn-row__lane-fieldset';
        const laneLegend = document.createElement('legend');
        laneLegend.className = 'event-slide-bio-conn-row__lane-legend';
        laneLegend.textContent = 'Position on slide';
        laneFieldset.appendChild(laneLegend);

        const rowUid =
            'bc-lane-' +
            Date.now().toString(36) +
            '-' +
            Math.random().toString(36).slice(2, 8);

        const laneA = document.createElement('input');
        laneA.type = 'radio';
        laneA.name = rowUid;
        laneA.value = 'A';
        laneA.id = rowUid + '-a';
        laneA.dataset.role = 'bio-conn-lane';
        const labA = document.createElement('label');
        labA.htmlFor = laneA.id;
        labA.className = 'event-slide-bio-conn-row__lane-label';
        labA.appendChild(laneA);
        labA.appendChild(document.createTextNode(' A (left)'));

        const laneB = document.createElement('input');
        laneB.type = 'radio';
        laneB.name = rowUid;
        laneB.value = 'B';
        laneB.id = rowUid + '-b';
        laneB.dataset.role = 'bio-conn-lane';
        const labB = document.createElement('label');
        labB.htmlFor = laneB.id;
        labB.className = 'event-slide-bio-conn-row__lane-label';
        labB.appendChild(laneB);
        labB.appendChild(document.createTextNode(' B (right)'));

        const laneStored = String(data.thisEntryLane || 'A').toUpperCase() === 'B' ? 'B' : 'A';
        if (laneStored === 'B') laneB.checked = true;
        else laneA.checked = true;

        const laneHint = document.createElement('div');
        laneHint.className = 'event-slide-bio-conn-row__lane-hint';
        laneHint.textContent = 'Them uses the other side.';

        laneFieldset.appendChild(labA);
        laneFieldset.appendChild(labB);
        laneFieldset.appendChild(laneHint);

        thisPanel.appendChild(thisHead);
        thisPanel.appendChild(thisName);
        thisPanel.appendChild(laneFieldset);

        const mid = document.createElement('div');
        mid.className = 'event-slide-bio-conn-row__mid';
        const midHead = document.createElement('div');
        midHead.className = 'event-slide-bio-conn-row__panel-head';
        midHead.textContent = 'Relationship text';

        let subjToLinked =
            data.reasoningSubjectToLinked != null ? String(data.reasoningSubjectToLinked).trim() : '';
        let linkedToSubj =
            data.reasoningLinkedToSubject != null ? String(data.reasoningLinkedToSubject).trim() : '';
        const leg = data.reasoning != null ? String(data.reasoning).trim() : '';
        if (!subjToLinked && !linkedToSubj && leg) {
            subjToLinked = leg;
            linkedToSubj = leg;
        }

        const hintOut = document.createElement('div');
        hintOut.className = 'event-slide-bio-conn-row__mid-hint';
        hintOut.textContent = 'This entry → them';

        const reasonOut = document.createElement('input');
        reasonOut.className = 'event-slide-inline-editor__input';
        reasonOut.type = 'text';
        reasonOut.spellcheck = true;
        reasonOut.placeholder = 'e.g. mentor to';
        reasonOut.dataset.role = 'bio-conn-reason-out';
        if (subjToLinked) reasonOut.value = subjToLinked;

        const hintIn = document.createElement('div');
        hintIn.className = 'event-slide-bio-conn-row__mid-hint';
        hintIn.textContent = 'Them → this entry';

        const reasonIn = document.createElement('input');
        reasonIn.className = 'event-slide-inline-editor__input';
        reasonIn.type = 'text';
        reasonIn.spellcheck = true;
        reasonIn.placeholder = 'e.g. student of';
        reasonIn.dataset.role = 'bio-conn-reason-in';
        if (linkedToSubj) reasonIn.value = linkedToSubj;

        mid.appendChild(midHead);
        mid.appendChild(hintOut);
        mid.appendChild(reasonOut);
        mid.appendChild(hintIn);
        mid.appendChild(reasonIn);

        const themPanel = document.createElement('div');
        themPanel.className = 'event-slide-bio-conn-row__them';
        const themHead = document.createElement('div');
        themHead.className = 'event-slide-bio-conn-row__panel-head';
        themHead.textContent = 'Them (linked)';

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

        themPanel.appendChild(themHead);
        themPanel.appendChild(kindSel);
        themPanel.appendChild(entityIn);

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
        row.appendChild(thisPanel);
        row.appendChild(mid);
        row.appendChild(themPanel);
        row.appendChild(rem);
        container.appendChild(row);

        setupEntityAutocomplete(entityIn, kindSel);
    }

    function render(container, items, subjectOpts) {
        if (!container) return;
        subjectOpts = subjectOpts || {};
        const sn = String(subjectOpts.subjectName || '').trim();
        const sk = String(subjectOpts.subjectKind || 'hero').toLowerCase();
        if (sk !== 'faction' && sk !== 'npc') {
            container.dataset.bioConnSubjectKind = 'hero';
        } else {
            container.dataset.bioConnSubjectKind = sk;
        }
        container.dataset.bioConnSubjectName = sn;

        container.innerHTML = '';
        const arr = Array.isArray(items) && items.length > 0 ? items : [{}];
        arr.forEach(function (item) {
            appendRow(container, item, subjectOpts);
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
                const laneEl = row.querySelector('input[data-role="bio-conn-lane"]:checked');
                let kind = String((kindEl && kindEl.value) || 'hero').toLowerCase();
                if (kind !== 'faction' && kind !== 'npc') kind = 'hero';
                const thisEntryLane =
                    laneEl && String(laneEl.value).toUpperCase() === 'B' ? 'B' : 'A';
                return {
                    kind: kind,
                    name: sanitizeConnectionEntityName(n && n.value ? n.value : ''),
                    reasoningSubjectToLinked: (rout && rout.value ? rout.value : '').trim(),
                    reasoningLinkedToSubject: (rin && rin.value ? rin.value : '').trim(),
                    thisEntryLane: thisEntryLane
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
        if (c) appendRow(c, {}, readSubjectOptsFromContainer(c));
    }

    window.BioArchiveConnectionsEditor = {
        render: render,
        collect: collect,
        addRow: addRow,
        subjectOptsFromArchiveRow: subjectOptsFromArchiveRow
    };
})();
