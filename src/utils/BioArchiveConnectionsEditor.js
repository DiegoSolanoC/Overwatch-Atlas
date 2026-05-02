/**
 * Multi-row editor for Heroes / Factions / NPCs archive "connections":
 * Three blocks (hero / faction / NPC); each row is this entry | relationship text | linked name (no type dropdown).
 * Mid hints: (subject) is x of (linked) / (linked) is x of (subject), updated as the linked name changes.
 * thisEntryLane A = this entry on the left of the slide, B = on the right (them fills the other side).
 * Faction ↔ hero|npc: one-way descriptor from faction toward the other; faction is always slide A (forced lane).
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

    /** @param {string} k */
    function normalizeConnKind(k) {
        var x = String(k || '').toLowerCase();
        if (x === 'character') x = 'hero';
        if (x === 'faction') return 'faction';
        if (x === 'npc') return 'npc';
        return 'hero';
    }

    /** @param {Array<unknown>} items */
    function splitConnectionsByKind(items) {
        var heroes = [];
        var factions = [];
        var npcs = [];
        if (!Array.isArray(items)) return { heroes: heroes, factions: factions, npcs: npcs };
        items.forEach(function (item) {
            var nk = normalizeConnKind(item && item.kind);
            if (nk === 'faction') factions.push(item);
            else if (nk === 'npc') npcs.push(item);
            else heroes.push(item);
        });
        return { heroes: heroes, factions: factions, npcs: npcs };
    }

    function isFactionHeroNpcMixedEditor(sk, lk) {
        var s = normalizeConnKind(sk);
        var l = normalizeConnKind(lk);
        if (s === 'faction' && (l === 'hero' || l === 'npc')) return true;
        if ((s === 'hero' || s === 'npc') && l === 'faction') return true;
        return false;
    }

    function setupEntityAutocomplete(entityInput, fixedKind) {
        if (!entityInput) return;
        const auto = window.eventManager?.formService?.autocompleteService;
        if (!auto || typeof auto.setupAutocomplete !== 'function') return;
        entityInput.dataset.autocompleteSetup = 'false';
        const kind = normalizeConnKind(fixedKind);
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

    /** @param {string} label */
    function parenLabel(label) {
        var t = String(label == null ? '' : label).trim();
        return '(' + (t || '…') + ')';
    }

    /**
     * @param {HTMLElement} row
     * @param {string} subjectDisplay
     * @param {string} linkedName
     */
    function applyBioConnRelationHints(row, subjectDisplay, linkedName) {
        var ho = row.querySelector('[data-role="bio-conn-hint-out"]');
        var hi = row.querySelector('[data-role="bio-conn-hint-in"]');
        if (row.dataset.bioConnFactionMixed === '1') {
            if (ho) {
                ho.textContent =
                    'One way: describe how the faction relates toward them (slide always shows faction on the left, → toward them).';
            }
            if (hi) {
                hi.textContent = '';
                hi.style.display = 'none';
            }
            return;
        }
        if (hi) hi.style.display = '';
        var subj = String(subjectDisplay || '').trim() || 'This entry';
        var link = String(linkedName || '').trim() || 'linked entry';
        if (ho) ho.textContent = parenLabel(subj) + ' is x of ' + parenLabel(link);
        if (hi) hi.textContent = parenLabel(link) + ' is x of ' + parenLabel(subj);
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

    /**
     * @param {HTMLElement} container Row list for one kind (inside a block).
     * @param {Object} data
     * @param {{ subjectName?: string, subjectKind?: string }} subjectOpts
     * @param {'hero'|'faction'|'npc'} fixedKind
     */
    function appendRow(container, data, subjectOpts, fixedKind) {
        if (!container) return;
        data = data || {};
        subjectOpts =
            subjectOpts ||
            readSubjectOptsFromContainer(container.closest('#eventSlideEditBioConnections') || container);
        const subjectDisplay =
            String(subjectOpts.subjectName || '').trim() || 'This entry';
        const fk = normalizeConnKind(fixedKind);
        const subjK = normalizeConnKind(subjectOpts.subjectKind || 'hero');
        const factionMixed = isFactionHeroNpcMixedEditor(subjK, fk);

        const row = document.createElement('div');
        row.className = 'event-slide-inline-editor__relevant-loc-row event-slide-bio-conn-row';
        row.dataset.bioConnFixedKind = fk;
        if (factionMixed) row.dataset.bioConnFactionMixed = '1';

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

        const rowUid =
            'bc-lane-' +
            Date.now().toString(36) +
            '-' +
            Math.random().toString(36).slice(2, 8);

        thisPanel.appendChild(thisHead);
        thisPanel.appendChild(thisName);

        if (factionMixed) {
            const laneHidden = document.createElement('input');
            laneHidden.type = 'hidden';
            laneHidden.dataset.role = 'bio-conn-lane-forced';
            laneHidden.value = subjK === 'faction' ? 'A' : 'B';
            thisPanel.appendChild(laneHidden);
        } else {
            const laneFieldset = document.createElement('fieldset');
            laneFieldset.className = 'event-slide-bio-conn-row__lane-fieldset';
            const laneLegend = document.createElement('legend');
            laneLegend.className = 'event-slide-bio-conn-row__lane-legend';
            laneLegend.textContent = 'Position on slide';
            laneFieldset.appendChild(laneLegend);

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
            thisPanel.appendChild(laneFieldset);
        }

        const mid = document.createElement('div');
        mid.className = 'event-slide-bio-conn-row__mid';
        const midHead = document.createElement('div');
        midHead.className = 'event-slide-bio-conn-row__panel-head';
        midHead.textContent = factionMixed ? 'Relationship (one way)' : 'Relationship text';

        let subjToLinked =
            data.reasoningSubjectToLinked != null ? String(data.reasoningSubjectToLinked).trim() : '';
        let linkedToSubj =
            data.reasoningLinkedToSubject != null ? String(data.reasoningLinkedToSubject).trim() : '';
        const leg = data.reasoning != null ? String(data.reasoning).trim() : '';
        if (!subjToLinked && !linkedToSubj && leg) {
            subjToLinked = leg;
            linkedToSubj = leg;
        }

        var oneWayInit = '';
        if (factionMixed) {
            if (subjK === 'faction') {
                oneWayInit = (subjToLinked || linkedToSubj || leg || '').trim();
            } else {
                oneWayInit = (linkedToSubj || subjToLinked || leg || '').trim();
            }
        }

        const hintOut = document.createElement('div');
        hintOut.className = 'event-slide-bio-conn-row__mid-hint';
        hintOut.dataset.role = 'bio-conn-hint-out';

        const reasonOut = document.createElement('input');
        reasonOut.className = 'event-slide-inline-editor__input';
        reasonOut.type = 'text';
        reasonOut.spellcheck = true;
        reasonOut.placeholder = factionMixed ? 'e.g. commands, sponsors, opposes' : 'e.g. mentor to';
        reasonOut.dataset.role = 'bio-conn-reason-out';
        if (factionMixed) {
            if (oneWayInit) reasonOut.value = oneWayInit;
        } else if (subjToLinked) {
            reasonOut.value = subjToLinked;
        }

        const hintIn = document.createElement('div');
        hintIn.className = 'event-slide-bio-conn-row__mid-hint';
        hintIn.dataset.role = 'bio-conn-hint-in';

        const reasonIn = document.createElement('input');
        reasonIn.className = 'event-slide-inline-editor__input';
        reasonIn.type = 'text';
        reasonIn.spellcheck = true;
        reasonIn.placeholder = 'e.g. student of';
        reasonIn.dataset.role = 'bio-conn-reason-in';
        if (!factionMixed && linkedToSubj) reasonIn.value = linkedToSubj;

        const showCodexCb = document.createElement('input');
        showCodexCb.type = 'checkbox';
        showCodexCb.id = rowUid + '-show-codex';
        showCodexCb.dataset.role = 'bio-conn-show-codex';
        const showCodexLab = document.createElement('label');
        showCodexLab.htmlFor = showCodexCb.id;
        showCodexLab.className = 'event-slide-bio-conn-row__show-codex';
        showCodexLab.appendChild(showCodexCb);
        showCodexLab.appendChild(document.createTextNode(' Show in Codex'));
        if (data.showInCodex === true) showCodexCb.checked = true;

        mid.appendChild(midHead);
        mid.appendChild(hintOut);
        mid.appendChild(reasonOut);
        if (!factionMixed) {
            mid.appendChild(hintIn);
            mid.appendChild(reasonIn);
        }
        mid.appendChild(showCodexLab);

        const themPanel = document.createElement('div');
        themPanel.className = 'event-slide-bio-conn-row__them';
        const themHead = document.createElement('div');
        themHead.className = 'event-slide-bio-conn-row__panel-head';
        themHead.textContent =
            fk === 'faction' ? 'Linked faction' : fk === 'npc' ? 'Linked NPC' : 'Linked hero';

        const entityIn = document.createElement('input');
        entityIn.className = 'event-slide-inline-editor__input';
        entityIn.type = 'text';
        entityIn.spellcheck = true;
        entityIn.autocomplete = 'off';
        entityIn.placeholder =
            fk === 'faction' ? 'Faction name (autocomplete)' : fk === 'npc' ? 'NPC name (autocomplete)' : 'Hero name (autocomplete)';
        entityIn.dataset.role = 'bio-conn-name';
        if (data.name) entityIn.value = data.name;

        themPanel.appendChild(themHead);
        themPanel.appendChild(entityIn);

        const rem = document.createElement('button');
        rem.type = 'button';
        rem.className = 'event-slide-inline-editor__small-btn';
        rem.textContent = '−';
        rem.setAttribute('aria-label', 'Remove row');
        rem.addEventListener('click', function () {
            row.remove();
        });

        function onLinkedNameChange() {
            applyBioConnRelationHints(row, subjectDisplay, entityIn.value);
        }
        entityIn.addEventListener('input', onLinkedNameChange);
        entityIn.addEventListener('change', onLinkedNameChange);

        applyBioConnRelationHints(row, subjectDisplay, entityIn.value);

        row.appendChild(reorder);
        row.appendChild(thisPanel);
        row.appendChild(mid);
        row.appendChild(themPanel);
        row.appendChild(rem);
        container.appendChild(row);

        setupEntityAutocomplete(entityIn, fk);
    }

    /**
     * @param {'hero'|'faction'|'npc'} kind
     * @param {string} title
     * @param {{ subjectName?: string, subjectKind?: string }} subjectOpts
     */
    function buildKindBlock(kind, title, subjectOpts) {
        var sec = document.createElement('section');
        sec.className = 'event-slide-bio-conn-block';
        sec.dataset.bioConnBlock = kind;

        var head = document.createElement('div');
        head.className = 'event-slide-bio-conn-block__head';

        var hspan = document.createElement('span');
        hspan.className = 'event-slide-bio-conn-block__title';
        hspan.textContent = title;

        var addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'event-slide-inline-editor__small-btn';
        addBtn.textContent = '+ Add';
        addBtn.setAttribute('aria-label', 'Add ' + title);

        var list = document.createElement('div');
        list.className = 'event-slide-bio-conn-block__list';
        list.dataset.bioConnList = kind;

        addBtn.addEventListener('click', function () {
            appendRow(list, {}, subjectOpts, kind);
        });

        head.appendChild(hspan);
        head.appendChild(addBtn);
        sec.appendChild(head);
        sec.appendChild(list);
        return sec;
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
        const wrap = document.createElement('div');
        wrap.className = 'event-slide-bio-conn-blocks';
        container.appendChild(wrap);

        const split = splitConnectionsByKind(Array.isArray(items) ? items : []);

        var blocks = [
            { kind: 'hero', title: 'Hero connections', rows: split.heroes },
            { kind: 'faction', title: 'Faction connections', rows: split.factions },
            { kind: 'npc', title: 'NPC connections', rows: split.npcs }
        ];

        blocks.forEach(function (b) {
            var sec = buildKindBlock(b.kind, b.title, subjectOpts);
            wrap.appendChild(sec);
            var list = sec.querySelector('[data-bio-conn-list="' + b.kind + '"]');
            if (list && b.rows.length) {
                b.rows.forEach(function (rowData) {
                    appendRow(list, rowData, subjectOpts, b.kind);
                });
            }
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
        var skRoot = normalizeConnKind(c.dataset && c.dataset.bioConnSubjectKind);
        return Array.prototype.slice
            .call(c.querySelectorAll('.event-slide-bio-conn-row'))
            .map(function (row) {
                var fk = normalizeConnKind(row.dataset.bioConnFixedKind);
                var list = row.closest('[data-bio-conn-list]');
                if (list && list.dataset.bioConnList) {
                    fk = normalizeConnKind(list.dataset.bioConnList);
                }
                const n = row.querySelector('[data-role="bio-conn-name"]');
                const rout = row.querySelector('[data-role="bio-conn-reason-out"]');
                const rin = row.querySelector('[data-role="bio-conn-reason-in"]');
                const showCodexEl = row.querySelector('[data-role="bio-conn-show-codex"]');
                const forcedLane = row.querySelector('[data-role="bio-conn-lane-forced"]');
                const laneEl = row.querySelector('input[data-role="bio-conn-lane"]:checked');
                var factionMixed = row.dataset.bioConnFactionMixed === '1';
                var thisEntryLane =
                    forcedLane && forcedLane.value
                        ? String(forcedLane.value).toUpperCase() === 'B'
                            ? 'B'
                            : 'A'
                        : laneEl && String(laneEl.value).toUpperCase() === 'B'
                          ? 'B'
                          : 'A';
                var oneTxt = (rout && rout.value ? rout.value : '').trim();
                var out;
                if (factionMixed && isFactionHeroNpcMixedEditor(skRoot, fk)) {
                    if (skRoot === 'faction') {
                        out = {
                            kind: fk,
                            name: sanitizeConnectionEntityName(n && n.value ? n.value : ''),
                            reasoningSubjectToLinked: oneTxt,
                            reasoningLinkedToSubject: '',
                            thisEntryLane: 'A'
                        };
                    } else {
                        out = {
                            kind: fk,
                            name: sanitizeConnectionEntityName(n && n.value ? n.value : ''),
                            reasoningSubjectToLinked: '',
                            reasoningLinkedToSubject: oneTxt,
                            thisEntryLane: 'B'
                        };
                    }
                } else {
                    out = {
                        kind: fk,
                        name: sanitizeConnectionEntityName(n && n.value ? n.value : ''),
                        reasoningSubjectToLinked: oneTxt,
                        reasoningLinkedToSubject: (rin && rin.value ? rin.value : '').trim(),
                        thisEntryLane: thisEntryLane
                    };
                }
                if (showCodexEl && showCodexEl.checked) out.showInCodex = true;
                return out;
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
        var kind = 'hero';
        if (typeof arg === 'string' && arg) kind = arg;
        else if (typeof arg === 'object' && arg && arg.kind) kind = String(arg.kind);
        kind = normalizeConnKind(kind);
        const opts = typeof arg === 'object' && arg ? arg : {};
        const containerId = opts.containerId || 'eventSlideEditBioConnections';
        const c = document.getElementById(containerId);
        if (!c) return;
        const list = c.querySelector('[data-bio-conn-list="' + kind + '"]');
        if (!list) return;
        appendRow(list, {}, readSubjectOptsFromContainer(c), kind);
    }

    window.BioArchiveConnectionsEditor = {
        render: render,
        collect: collect,
        addRow: addRow,
        subjectOptsFromArchiveRow: subjectOptsFromArchiveRow
    };
})();
