/**
 * Multi-row editor for Heroes / Factions / NPCs archive "connections":
 * Visual edit rows mirror read-only slide layout (portraits + arrows); toolbar holds lane / codex / reorder.
 * Top-level relationship fields are hidden when the row has story event ranges (wording lives on each range).
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
    function storyEventAutocompleteApi() {
        return window.HeroBiographyStoryEventAutocomplete || null;
    }

    function canonicalStoryEventName(value) {
        var raw = String(value || '').trim();
        if (!raw) return '';
        var api = storyEventAutocompleteApi();
        if (api && typeof api.resolveCanonicalStoryEventName === 'function') {
            return api.resolveCanonicalStoryEventName(raw) || raw;
        }
        return raw;
    }

    function wireBioConnStoryEventInput(input) {
        if (!input) return;
        var api = storyEventAutocompleteApi();
        if (api && typeof api.wireStoryEventNameAutocomplete === 'function') {
            api.wireStoryEventNameAutocomplete(input);
            return;
        }
        if (input.dataset.bioConnStoryEventWirePending === '1') return;
        input.dataset.bioConnStoryEventWirePending = '1';
        requestAnimationFrame(function () {
            delete input.dataset.bioConnStoryEventWirePending;
            wireBioConnStoryEventInput(input);
        });
    }

    function refreshBioConnRangeHints(row, subjectDisplay, linkedName) {
        if (!row) return;
        var items = row.querySelectorAll('[data-bio-conn-range-item]');
        for (var i = 0; i < items.length; i += 1) {
            applyBioConnRelationHints(items[i], subjectDisplay, linkedName);
        }
    }

    /**
     * @param {HTMLElement} listEl
     * @param {object} rangeData
     * @param {{ factionMixed: boolean, subjectKind: string }} opts
     */
    function appendConnectionRangeRow(listEl, rangeData, opts) {
        var data = rangeData || {};
        var factionMixed = !!opts.factionMixed;
        var subjK = normalizeConnKind(opts.subjectKind || 'hero');

        var item = document.createElement('div');
        item.className = 'event-slide-bio-conn-range';
        item.dataset.bioConnRangeItem = '1';

        var eventsRow = document.createElement('div');
        eventsRow.className = 'event-slide-bio-conn-range__events';

        var startPair = document.createElement('div');
        startPair.className = 'event-slide-bio-conn-range__event-field';
        var startLab = document.createElement('span');
        startLab.className = 'event-slide-bio-conn-range__event-label';
        startLab.textContent = 'From event';
        var startWrap = document.createElement('div');
        startWrap.className = 'event-slide-bio-conn-range__event-input-wrap';
        var startIn = document.createElement('input');
        startIn.type = 'text';
        startIn.spellcheck = false;
        startIn.autocomplete = 'off';
        startIn.placeholder = 'Story event name (autocomplete)';
        startIn.className = 'event-slide-inline-editor__input event-slide-story-event-input';
        startIn.dataset.role = 'bio-conn-range-start';
        if (data.startEvent) startIn.value = data.startEvent;
        startWrap.appendChild(startIn);
        startPair.appendChild(startLab);
        startPair.appendChild(startWrap);
        wireBioConnStoryEventInput(startIn);

        var sep = document.createElement('span');
        sep.className = 'event-slide-bio-conn-range__event-sep';
        sep.setAttribute('aria-hidden', 'true');
        sep.textContent = '→';

        var endPair = document.createElement('div');
        endPair.className = 'event-slide-bio-conn-range__event-field';
        var endLab = document.createElement('span');
        endLab.className = 'event-slide-bio-conn-range__event-label';
        endLab.textContent = 'Until (optional)';
        var endWrap = document.createElement('div');
        endWrap.className = 'event-slide-bio-conn-range__event-input-wrap';
        var endIn = document.createElement('input');
        endIn.type = 'text';
        endIn.spellcheck = false;
        endIn.autocomplete = 'off';
        endIn.placeholder = 'Leave empty if still active (autocomplete)';
        endIn.className = 'event-slide-inline-editor__input event-slide-story-event-input';
        endIn.dataset.role = 'bio-conn-range-end';
        if (data.endEvent) endIn.value = data.endEvent;
        endWrap.appendChild(endIn);
        endPair.appendChild(endLab);
        endPair.appendChild(endWrap);
        wireBioConnStoryEventInput(endIn);

        eventsRow.appendChild(startPair);
        eventsRow.appendChild(sep);
        eventsRow.appendChild(endPair);

        var reasonBlock = document.createElement('div');
        reasonBlock.className = 'event-slide-bio-conn-range__reasons';

        var hintOut = document.createElement('div');
        hintOut.className = 'event-slide-bio-conn-row__mid-hint';
        hintOut.dataset.role = 'bio-conn-hint-out';

        var reasonOut = document.createElement('input');
        reasonOut.className = 'event-slide-inline-editor__input';
        reasonOut.type = 'text';
        reasonOut.spellcheck = true;
        reasonOut.placeholder = factionMixed ? 'e.g. commands, opposes' : 'e.g. mentor to';
        reasonOut.dataset.role = 'bio-conn-range-reason-out';

        var hintIn = document.createElement('div');
        hintIn.className = 'event-slide-bio-conn-row__mid-hint';
        hintIn.dataset.role = 'bio-conn-hint-in';

        var reasonIn = document.createElement('input');
        reasonIn.className = 'event-slide-inline-editor__input';
        reasonIn.type = 'text';
        reasonIn.spellcheck = true;
        reasonIn.placeholder = 'e.g. student of';
        reasonIn.dataset.role = 'bio-conn-range-reason-in';

        var tOut =
            data.reasoningSubjectToLinked != null ? String(data.reasoningSubjectToLinked).trim() : '';
        var tIn =
            data.reasoningLinkedToSubject != null ? String(data.reasoningLinkedToSubject).trim() : '';
        var leg = data.reasoning != null ? String(data.reasoning).trim() : '';
        if (!tOut && !tIn && leg) {
            tOut = leg;
            tIn = leg;
        }

        if (factionMixed) {
            item.dataset.bioConnFactionMixed = '1';
            var oneTxt = subjK === 'faction' ? tOut || tIn || leg : tIn || tOut || leg;
            if (oneTxt) reasonOut.value = oneTxt;
            reasonBlock.appendChild(hintOut);
            reasonBlock.appendChild(reasonOut);
        } else {
            if (tOut) reasonOut.value = tOut;
            if (tIn) reasonIn.value = tIn;
            reasonBlock.appendChild(hintOut);
            reasonBlock.appendChild(reasonOut);
            reasonBlock.appendChild(hintIn);
            reasonBlock.appendChild(reasonIn);
        }

        var remRange = document.createElement('button');
        remRange.type = 'button';
        remRange.className = 'event-slide-inline-editor__small-btn event-slide-bio-conn-range__remove';
        remRange.textContent = '−';
        remRange.setAttribute('aria-label', 'Remove this range');
        remRange.addEventListener('click', function () {
            var parentRow = item.closest('.event-slide-bio-conn-row');
            item.remove();
            if (parentRow) syncRowLegacyRelationshipVisibility(parentRow);
        });

        item.appendChild(eventsRow);
        item.appendChild(reasonBlock);
        item.appendChild(remRange);
        listEl.appendChild(item);
    }

    /**
     * @param {HTMLElement} row
     * @returns {boolean}
     */
    function connectionRowHasRangeItems(row) {
        if (!row) return false;
        var listEl = row.querySelector('[data-bio-conn-ranges-list]');
        if (!listEl) return false;
        return listEl.querySelectorAll('[data-bio-conn-range-item]').length > 0;
    }

    /**
     * When story ranges exist, relationship text lives on each range — hide duplicate top fields.
     * @param {HTMLElement} row
     */
    function syncRowLegacyRelationshipVisibility(row) {
        if (!row) return;
        var usesRanges = connectionRowHasRangeItems(row);
        var legacy = row.querySelector('[data-bio-conn-legacy-reasoning]');
        var note = row.querySelector('[data-bio-conn-ranges-only-note]');
        var midHead = row.querySelector('[data-bio-conn-mid-relationship-head]');
        var arrows = row.querySelector('[data-bio-conn-arrows]');
        var oneway = row.querySelector('.event-slide-bio-connections__oneway-arrows[data-bio-conn-arrows]');
        if (legacy) legacy.hidden = usesRanges;
        if (arrows) arrows.hidden = usesRanges;
        if (oneway) oneway.hidden = usesRanges;
        if (note) note.hidden = !usesRanges;
        if (midHead) midHead.hidden = usesRanges;
    }

    /**
     * @param {HTMLElement} row
     * @param {object} data
     * @param {{ factionMixed: boolean, subjectKind: string, subjectDisplay: string }} opts
     */
    function buildConnectionRangesPanel(row, data, opts) {
        var panel = document.createElement('div');
        panel.className = 'event-slide-bio-conn-row__ranges';

        var head = document.createElement('div');
        head.className = 'event-slide-bio-conn-row__ranges-head';

        var title = document.createElement('span');
        title.className = 'event-slide-bio-conn-row__ranges-title';
        title.textContent = 'Story event ranges';

        var addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'event-slide-inline-editor__small-btn';
        addBtn.textContent = '+ Add range';
        addBtn.setAttribute('aria-label', 'Add story event range for this connection');

        var listEl = document.createElement('div');
        listEl.className = 'event-slide-bio-conn-ranges__list';
        listEl.dataset.bioConnRangesList = '1';

        var hint = document.createElement('p');
        hint.className = 'event-slide-bio-conn-row__ranges-hint';
        hint.textContent =
            'Each range needs a start event and relationship text for that period. '
            + 'Leave “Until” empty if the wording still applies through the latest story entry. '
            + 'Use multiple ranges when the link stays but the relationship text changes.';

        addBtn.addEventListener('click', function () {
            appendConnectionRangeRow(listEl, {}, opts);
            syncRowLegacyRelationshipVisibility(row);
            var linkedIn = row.querySelector('[data-role="bio-conn-name"]');
            refreshBioConnRangeHints(
                row,
                opts.subjectDisplay,
                linkedIn && linkedIn.value ? linkedIn.value : '',
            );
        });

        head.appendChild(title);
        head.appendChild(addBtn);
        panel.appendChild(head);
        panel.appendChild(hint);
        panel.appendChild(listEl);

        var ranges = Array.isArray(data.ranges) ? data.ranges : [];
        for (var ri = 0; ri < ranges.length; ri += 1) {
            appendConnectionRangeRow(listEl, ranges[ri], opts);
        }

        return panel;
    }

  /**
     * @param {HTMLElement} row
     * @param {boolean} factionMixed
     * @param {string} skRoot
     * @param {string} fk
     * @returns {object[]}
     */
    function collectConnectionRangesFromRow(row, factionMixed, skRoot, fk) {
        var listEl = row.querySelector('[data-bio-conn-ranges-list]');
        if (!listEl) return [];

        var items = listEl.querySelectorAll('[data-bio-conn-range-item]');
        var ranges = [];

        for (var i = 0; i < items.length; i += 1) {
            var item = items[i];
            var startEl = item.querySelector('[data-role="bio-conn-range-start"]');
            var endEl = item.querySelector('[data-role="bio-conn-range-end"]');
            var rout = item.querySelector('[data-role="bio-conn-range-reason-out"]');
            var rin = item.querySelector('[data-role="bio-conn-range-reason-in"]');

            var startEvent = canonicalStoryEventName(startEl && startEl.value ? startEl.value : '');
            if (!startEvent) continue;

            var endEvent = canonicalStoryEventName(endEl && endEl.value ? endEl.value : '');
            var rangeMixed = item.dataset.bioConnFactionMixed === '1';
            var oneTxt = (rout && rout.value ? rout.value : '').trim();
            var outTxt = oneTxt;
            var inTxt = (rin && rin.value ? rin.value : '').trim();

            if (rangeMixed && isFactionHeroNpcMixedEditor(skRoot, fk)) {
                if (skRoot === 'faction') {
                    outTxt = oneTxt;
                    inTxt = '';
                } else {
                    outTxt = '';
                    inTxt = oneTxt;
                }
            }

            var entry = {
                startEvent: startEvent,
                reasoningSubjectToLinked: outTxt,
                reasoningLinkedToSubject: inTxt,
            };
            if (endEvent) entry.endEvent = endEvent;
            ranges.push(entry);
        }

        var norm = window.BioArchiveConnectionRanges;
        if (norm && typeof norm.normalizeBioConnectionRanges === 'function') {
            return norm.normalizeBioConnectionRanges(ranges);
        }
        return ranges;
    }

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

    function bioConnPortraitHtml(entityKind, token) {
        var fn =
            typeof window !== 'undefined'
            && window.__SlideBioConnections
            && window.__SlideBioConnections.bioArchiveConnectionPortraitHtml;
        if (typeof fn === 'function') {
            return fn(entityKind, token) || '';
        }
        return (
            '<img class="event-slide-bio-connections__portrait event-slide-bio-connections__portrait--fallback" ' +
            'src="src/assets/images/Icons/Filter Icons/Hero Icon.png" alt="" width="52" height="52" decoding="async" />'
        );
    }

    /**
     * @param {HTMLElement} row
     * @returns {'A'|'B'}
     */
    function readBioConnRowLane(row) {
        if (!row) return 'A';
        var forced = row.querySelector('[data-role="bio-conn-lane-forced"]');
        if (forced && forced.value) {
            return String(forced.value).toUpperCase() === 'B' ? 'B' : 'A';
        }
        var laneEl = row.querySelector('input[data-role="bio-conn-lane"]:checked');
        return laneEl && String(laneEl.value).toUpperCase() === 'B' ? 'B' : 'A';
    }

    /**
     * @param {HTMLElement} slotEl
     * @param {string} entityKind
     * @param {string} name
     * @param {string} caption
     */
    function fillBioConnPortraitSlot(slotEl, entityKind, name, caption) {
        if (!slotEl) return;
        var portraitWrap = slotEl.querySelector('[data-bio-conn-portrait-wrap]');
        var captionEl = slotEl.querySelector('[data-bio-conn-portrait-caption]');
        if (portraitWrap) {
            portraitWrap.innerHTML = bioConnPortraitHtml(entityKind, name);
        }
        if (captionEl) {
            captionEl.textContent = caption || '';
            captionEl.hidden = !caption;
        }
    }

    /**
     * @param {HTMLElement} row
     */
    function mountLinkedNameInputOnSlot(row, slotEl) {
        if (!row || !slotEl) return;
        var entityIn = row.querySelector('[data-role="bio-conn-name"]');
        if (!entityIn) return;

        var visual = row.querySelector('[data-bio-conn-visual]');
        if (visual) {
            var slots = visual.querySelectorAll('[data-bio-conn-slot]');
            for (var si = 0; si < slots.length; si += 1) {
                var cap = slots[si].querySelector('[data-bio-conn-portrait-caption]');
                if (!cap) continue;
                if (slots[si] === slotEl) {
                    cap.hidden = true;
                } else {
                    cap.hidden = !String(cap.textContent || '').trim();
                }
            }
        }

        slotEl.appendChild(entityIn);
        entityIn.hidden = false;
        entityIn.style.display = '';
    }

    /**
     * Swap portrait columns + arrow lane order to match read-only slide (lane A/B).
     * @param {HTMLElement} row
     */
    function refreshBioConnRowVisual(row) {
        if (!row) return;
        var visual = row.querySelector('[data-bio-conn-visual]');
        if (!visual) return;

        var subjectDisplay = String(row.dataset.bioConnSubjectName || '').trim() || 'This entry';
        var subjK = normalizeConnKind(row.dataset.bioConnSubjectKind || 'hero');
        var fk = normalizeConnKind(row.dataset.bioConnFixedKind || 'hero');
        var factionMixed = row.dataset.bioConnFactionMixed === '1';
        var linkedIn = row.querySelector('[data-role="bio-conn-name"]');
        var linkedName = linkedIn && linkedIn.value ? String(linkedIn.value).trim() : '';

        var leftSlot = visual.querySelector('[data-bio-conn-slot="left"]');
        var rightSlot = visual.querySelector('[data-bio-conn-slot="right"]');
        if (!leftSlot || !rightSlot) return;

        if (factionMixed) {
            var facName = subjK === 'faction' ? subjectDisplay : linkedName;
            var othKind = subjK === 'faction' ? fk : subjK;
            var othName = subjK === 'faction' ? linkedName : subjectDisplay;
            fillBioConnPortraitSlot(leftSlot, 'faction', facName, facName || 'Faction');
            fillBioConnPortraitSlot(
                rightSlot,
                othKind,
                othName,
                othName || (fk === 'npc' ? 'NPC' : fk === 'faction' ? 'Faction' : 'Hero'),
            );
            mountLinkedNameInputOnSlot(
                row,
                subjK === 'faction' ? rightSlot : leftSlot,
            );
            return;
        }

        var lane = readBioConnRowLane(row);
        var leftIsSubject = lane !== 'B';
        if (leftIsSubject) {
            fillBioConnPortraitSlot(leftSlot, subjK, subjectDisplay, subjectDisplay);
            fillBioConnPortraitSlot(
                rightSlot,
                fk,
                linkedName,
                linkedName || (fk === 'npc' ? 'Linked NPC' : fk === 'faction' ? 'Linked faction' : 'Linked hero'),
            );
            mountLinkedNameInputOnSlot(row, rightSlot);
        } else {
            fillBioConnPortraitSlot(
                leftSlot,
                fk,
                linkedName,
                linkedName || (fk === 'npc' ? 'Linked NPC' : fk === 'faction' ? 'Linked faction' : 'Linked hero'),
            );
            fillBioConnPortraitSlot(rightSlot, subjK, subjectDisplay, subjectDisplay);
            mountLinkedNameInputOnSlot(row, leftSlot);
        }

        var arrows = visual.querySelector('[data-bio-conn-arrows]');
        if (!arrows) return;
        var laneOut = arrows.querySelector('[data-bio-conn-arrow-lane="out"]');
        var laneIn = arrows.querySelector('[data-bio-conn-arrow-lane="in"]');
        if (!laneOut || !laneIn) return;

        if (lane === 'B') {
            arrows.insertBefore(laneIn, laneOut);
        } else if (laneIn.nextElementSibling !== laneOut) {
            arrows.insertBefore(laneOut, laneIn);
        }
    }

    /**
     * @param {string} fk
     * @returns {string}
     */
    function linkedEntityPlaceholder(fk) {
        if (fk === 'faction') return 'Faction name (autocomplete)';
        if (fk === 'npc') return 'NPC name (autocomplete)';
        return 'Hero name (autocomplete)';
    }

    /**
     * @param {HTMLElement} slotEl
     */
    function buildBioConnPortraitSlotShell(slotEl) {
        var portraitWrap = document.createElement('div');
        portraitWrap.className = 'event-slide-bio-conn-row__portrait-wrap';
        portraitWrap.dataset.bioConnPortraitWrap = '1';

        var caption = document.createElement('span');
        caption.className = 'event-slide-bio-conn-row__portrait-caption';
        caption.dataset.bioConnPortraitCaption = '1';

        slotEl.appendChild(portraitWrap);
        slotEl.appendChild(caption);
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
        row.className = 'event-slide-bio-conn-row';
        row.dataset.bioConnFixedKind = fk;
        row.dataset.bioConnSubjectName = subjectDisplay;
        row.dataset.bioConnSubjectKind = subjK;
        if (factionMixed) row.dataset.bioConnFactionMixed = '1';

        const rowUid =
            'bc-lane-' +
            Date.now().toString(36) +
            '-' +
            Math.random().toString(36).slice(2, 8);

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

        const visual = document.createElement('div');
        visual.className =
            'event-slide-bio-conn-row__visual event-slide-bio-connections__row event-slide-bio-conn-row__visual--edit'
            + (factionMixed
                ? ' event-slide-bio-connections__row--dual event-slide-bio-connections__row--faction-oneway'
                : ' event-slide-bio-connections__row--dual');
        visual.dataset.bioConnVisual = '1';

        const leftSlot = document.createElement('div');
        leftSlot.className =
            'event-slide-bio-connections__portrait-col event-slide-bio-conn-row__portrait-slot';
        leftSlot.dataset.bioConnSlot = 'left';

        const rightSlot = document.createElement('div');
        rightSlot.className =
            'event-slide-bio-connections__portrait-col event-slide-bio-conn-row__portrait-slot';
        rightSlot.dataset.bioConnSlot = 'right';

        buildBioConnPortraitSlotShell(leftSlot);
        buildBioConnPortraitSlotShell(rightSlot);

        var entityIn = document.createElement('input');
        entityIn.className =
            'event-slide-inline-editor__input event-slide-bio-conn-row__linked-name-input';
        entityIn.type = 'text';
        entityIn.spellcheck = true;
        entityIn.autocomplete = 'off';
        entityIn.placeholder = linkedEntityPlaceholder(fk);
        entityIn.dataset.role = 'bio-conn-name';
        if (data.name) entityIn.value = data.name;
        row.appendChild(entityIn);

        const midVisual = document.createElement('div');
        midVisual.className = 'event-slide-bio-conn-row__mid-visual';

        const midHead = document.createElement('div');
        midHead.className = 'event-slide-bio-conn-row__panel-head event-slide-bio-conn-row__panel-head--visual';
        midHead.dataset.bioConnMidRelationshipHead = '1';
        midHead.textContent = factionMixed ? 'Relationship (one way)' : 'Relationship text';

        const hintOut = document.createElement('div');
        hintOut.className = 'event-slide-bio-conn-row__mid-hint';
        hintOut.dataset.role = 'bio-conn-hint-out';

        const reasonOut = document.createElement('input');
        reasonOut.className =
            'event-slide-inline-editor__input event-slide-bio-conn-row__arrow-input';
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
        reasonIn.className =
            'event-slide-inline-editor__input event-slide-bio-conn-row__arrow-input';
        reasonIn.type = 'text';
        reasonIn.spellcheck = true;
        reasonIn.placeholder = 'e.g. student of';
        reasonIn.dataset.role = 'bio-conn-reason-in';
        if (!factionMixed && linkedToSubj) reasonIn.value = linkedToSubj;

        const legacyWrap = document.createElement('div');
        legacyWrap.className = 'event-slide-bio-conn-row__legacy-reasoning';
        legacyWrap.dataset.bioConnLegacyReasoning = '1';

        const rangesOnlyNote = document.createElement('p');
        rangesOnlyNote.className = 'event-slide-bio-conn-row__ranges-only-note';
        rangesOnlyNote.dataset.bioConnRangesOnlyNote = '1';
        rangesOnlyNote.hidden = true;
        rangesOnlyNote.textContent =
            'Relationship wording is set in each story range below. Remove all ranges to edit a single line here.';

        var arrowsEl;
        if (factionMixed) {
            arrowsEl = document.createElement('div');
            arrowsEl.className = 'event-slide-bio-connections__oneway-arrows';
            arrowsEl.dataset.bioConnArrows = '1';
            arrowsEl.setAttribute('role', 'group');
            arrowsEl.setAttribute('aria-label', 'Relationship from faction');
            legacyWrap.appendChild(hintOut);
            arrowsEl.appendChild(reasonOut);
            var glyphOne = document.createElement('span');
            glyphOne.className = 'event-slide-bio-connections__arrow-glyph';
            glyphOne.setAttribute('aria-hidden', 'true');
            glyphOne.textContent = '→';
            arrowsEl.appendChild(glyphOne);
        } else {
            arrowsEl = document.createElement('div');
            arrowsEl.className = 'event-slide-bio-connections__arrows';
            arrowsEl.dataset.bioConnArrows = '1';
            arrowsEl.setAttribute('role', 'group');
            arrowsEl.setAttribute('aria-label', 'Relationship in each direction');

            var laneOut = document.createElement('div');
            laneOut.className =
                'event-slide-bio-connections__arrow-lane event-slide-bio-connections__arrow-lane--out';
            laneOut.dataset.bioConnArrowLane = 'out';
            laneOut.appendChild(reasonOut);
            var glyphOut = document.createElement('span');
            glyphOut.className = 'event-slide-bio-connections__arrow-glyph';
            glyphOut.setAttribute('aria-hidden', 'true');
            glyphOut.textContent = '→';
            laneOut.appendChild(glyphOut);

            var laneIn = document.createElement('div');
            laneIn.className =
                'event-slide-bio-connections__arrow-lane event-slide-bio-connections__arrow-lane--in';
            laneIn.dataset.bioConnArrowLane = 'in';
            var glyphIn = document.createElement('span');
            glyphIn.className = 'event-slide-bio-connections__arrow-glyph';
            glyphIn.setAttribute('aria-hidden', 'true');
            glyphIn.textContent = '←';
            laneIn.appendChild(glyphIn);
            laneIn.appendChild(reasonIn);

            legacyWrap.appendChild(hintOut);
            legacyWrap.appendChild(hintIn);
            arrowsEl.appendChild(laneOut);
            arrowsEl.appendChild(laneIn);
        }

        midVisual.appendChild(midHead);
        midVisual.appendChild(arrowsEl);
        midVisual.appendChild(legacyWrap);
        midVisual.appendChild(rangesOnlyNote);

        visual.appendChild(leftSlot);
        visual.appendChild(midVisual);
        visual.appendChild(rightSlot);

        const toolbar = document.createElement('div');
        toolbar.className = 'event-slide-bio-conn-row__toolbar';

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

        const toolbarMain = document.createElement('div');
        toolbarMain.className = 'event-slide-bio-conn-row__toolbar-main';

        if (factionMixed) {
            const laneHidden = document.createElement('input');
            laneHidden.type = 'hidden';
            laneHidden.dataset.role = 'bio-conn-lane-forced';
            laneHidden.value = subjK === 'faction' ? 'A' : 'B';
            toolbarMain.appendChild(laneHidden);
        } else {
            const laneFieldset = document.createElement('fieldset');
            laneFieldset.className = 'event-slide-bio-conn-row__lane-fieldset';
            const laneLegend = document.createElement('legend');
            laneLegend.className = 'event-slide-bio-conn-row__lane-legend';
            laneLegend.textContent = 'This entry side';
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
            labA.appendChild(document.createTextNode(' Left'));

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
            labB.appendChild(document.createTextNode(' Right'));

            const laneStored = String(data.thisEntryLane || 'A').toUpperCase() === 'B' ? 'B' : 'A';
            if (laneStored === 'B') laneB.checked = true;
            else laneA.checked = true;

            laneFieldset.appendChild(labA);
            laneFieldset.appendChild(labB);
            toolbarMain.appendChild(laneFieldset);

            function onLaneChange() {
                refreshBioConnRowVisual(row);
            }
            laneA.addEventListener('change', onLaneChange);
            laneB.addEventListener('change', onLaneChange);
        }

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
        toolbarMain.appendChild(showCodexLab);

        const rem = document.createElement('button');
        rem.type = 'button';
        rem.className = 'event-slide-inline-editor__small-btn event-slide-bio-conn-row__remove-btn';
        rem.textContent = '−';
        rem.setAttribute('aria-label', 'Remove connection');
        rem.addEventListener('click', function () {
            row.remove();
        });
        toolbarMain.appendChild(rem);

        toolbar.appendChild(reorder);
        toolbar.appendChild(toolbarMain);

        function onLinkedNameChange() {
            applyBioConnRelationHints(row, subjectDisplay, entityIn.value);
            refreshBioConnRangeHints(row, subjectDisplay, entityIn.value);
            refreshBioConnRowVisual(row);
        }
        if (entityIn) {
            entityIn.addEventListener('input', onLinkedNameChange);
            entityIn.addEventListener('change', onLinkedNameChange);
        }

        applyBioConnRelationHints(row, subjectDisplay, entityIn ? entityIn.value : '');

        const rangesPanel = buildConnectionRangesPanel(row, data, {
            factionMixed: factionMixed,
            subjectKind: subjK,
            subjectDisplay: subjectDisplay,
        });
        refreshBioConnRangeHints(row, subjectDisplay, entityIn ? entityIn.value : '');

        row.appendChild(visual);
        row.appendChild(toolbar);
        row.appendChild(rangesPanel);
        container.appendChild(row);

        syncRowLegacyRelationshipVisibility(row);
        refreshBioConnRowVisual(row);

        if (entityIn) setupEntityAutocomplete(entityIn, fk);
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
                var entityName = sanitizeConnectionEntityName(n && n.value ? n.value : '');
                var collectedRanges = collectConnectionRangesFromRow(
                    row,
                    factionMixed,
                    skRoot,
                    fk,
                );

                if (collectedRanges.length) {
                    var rangedOut = {
                        kind: fk,
                        name: entityName,
                        ranges: collectedRanges,
                        thisEntryLane: thisEntryLane,
                    };
                    if (factionMixed && isFactionHeroNpcMixedEditor(skRoot, fk)) {
                        rangedOut.thisEntryLane = skRoot === 'faction' ? 'A' : 'B';
                    }
                    if (showCodexEl && showCodexEl.checked) rangedOut.showInCodex = true;
                    if (
                        window.BioArchiveConnectionRanges
                        && typeof window.BioArchiveConnectionRanges.syncLegacyReasoningFieldsFromRanges
                            === 'function'
                    ) {
                        window.BioArchiveConnectionRanges.syncLegacyReasoningFieldsFromRanges(rangedOut);
                    }
                    return rangedOut;
                }

                var oneTxt = (rout && rout.value ? rout.value : '').trim();
                var out;
                if (factionMixed && isFactionHeroNpcMixedEditor(skRoot, fk)) {
                    if (skRoot === 'faction') {
                        out = {
                            kind: fk,
                            name: entityName,
                            reasoningSubjectToLinked: oneTxt,
                            reasoningLinkedToSubject: '',
                            thisEntryLane: 'A',
                        };
                    } else {
                        out = {
                            kind: fk,
                            name: entityName,
                            reasoningSubjectToLinked: '',
                            reasoningLinkedToSubject: oneTxt,
                            thisEntryLane: 'B',
                        };
                    }
                } else {
                    out = {
                        kind: fk,
                        name: entityName,
                        reasoningSubjectToLinked: oneTxt,
                        reasoningLinkedToSubject: (rin && rin.value ? rin.value : '').trim(),
                        thisEntryLane: thisEntryLane,
                    };
                }
                if (showCodexEl && showCodexEl.checked) out.showInCodex = true;

                return out;
            })
            .filter(function (entry) {
                return (
                    entry.name ||
                    entry.reasoningSubjectToLinked ||
                    entry.reasoningLinkedToSubject ||
                    (Array.isArray(entry.ranges) && entry.ranges.length > 0)
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
