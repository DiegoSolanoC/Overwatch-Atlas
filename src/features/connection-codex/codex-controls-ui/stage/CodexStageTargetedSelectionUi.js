/**
 * Targeted selection UI (search, chips, apply/clear) for the stage controls panel.
 */

import { api } from '../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../codex-canvas/core/canvasSession.js';
import { codexCountryFlagSrc } from '../../codex-nodes/placement/CodexNodePortraitMetrics.js';
import {
    applyCodexTargetedSelection,
    clearCodexTargetedSelection,
    getCodexNodeDisplayName,
    listCodexCanvasNodeSuggestions,
    reapplyCodexTargetedSelectionIfActive,
    resolveCodexNodeIdFromNameQuery
} from './CodexTargetedSelection.js';

/** @type {Set<string>} */
let draftSeedIds = new Set();

/** @type {HTMLElement|null} */
let suggestListEl = null;

function findNodeRecord(nodeId) {
    return s.codexAllNodes.find((n) => n && n.id === nodeId) || null;
}

function removeSuggestList() {
    if (suggestListEl) {
        suggestListEl.remove();
        suggestListEl = null;
    }
}

function renderDraftChips(host) {
    const chips = host.querySelector('.codex-stage-controls__target-chips');
    if (!chips) return;
    chips.replaceChildren();
    draftSeedIds.forEach((nodeId) => {
        const node = findNodeRecord(nodeId);
        const name = node ? getCodexNodeDisplayName(node) : nodeId;
        const chip = document.createElement('span');
        chip.className = 'codex-stage-controls__target-chip';
        chip.dataset.nodeId = nodeId;
        const label = document.createElement('span');
        label.className = 'codex-stage-controls__target-chip-label';
        label.textContent = name;
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'codex-stage-controls__target-chip-remove';
        removeBtn.setAttribute('aria-label', `Remove ${name}`);
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            draftSeedIds.delete(nodeId);
            renderDraftChips(host);
        });
        chip.append(label, removeBtn);
        chips.appendChild(chip);
    });
}

function addDraftSeed(nodeId) {
    if (!nodeId) return false;
    if (draftSeedIds.has(nodeId)) return false;
    draftSeedIds.add(nodeId);
    return true;
}

function appendTargetSuggestionRow(list, row, onPick) {
    const { nodeId, kind, name } = row;
    const node = findNodeRecord(nodeId);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter-autocomplete-item';

    const img = document.createElement('img');
    img.className = 'filter-autocomplete-item-icon';
    img.alt = '';
    img.decoding = 'async';
    img.onerror = () => {
        img.style.visibility = 'hidden';
    };

    let detailText = kind;
    if (kind === 'hero') {
        img.src = `src/assets/images/Filters/Heroes/${encodeURIComponent(name)}.png`;
        img.className += ' filter-autocomplete-item-icon--hero';
        detailText = 'Hero';
    } else if (kind === 'npc') {
        img.src = `src/assets/images/Filters/NPCs/${encodeURIComponent(name)}.png`;
        img.className += ' filter-autocomplete-item-icon--npc';
        detailText = 'NPC';
    } else if (kind === 'country') {
        img.src = codexCountryFlagSrc(name);
        img.className += ' filter-autocomplete-item-icon--flag';
        detailText = 'Country';
    } else if (kind === 'faction' && node) {
        const fn = node.factionFilename || name;
        img.src = `src/assets/images/Filters/Factions/${encodeURIComponent(fn)}.png`;
        img.className += ' filter-autocomplete-item-icon--faction';
        detailText = 'Faction';
    }

    const labelSpan = document.createElement('span');
    labelSpan.className = 'filter-autocomplete-item-label';
    labelSpan.textContent = name;

    const detailSpan = document.createElement('span');
    detailSpan.className = 'filter-autocomplete-item-detail';
    detailSpan.textContent = detailText;

    btn.append(img, labelSpan, detailSpan);
    btn.addEventListener('mousedown', (ev) => ev.preventDefault());
    btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        onPick();
    });
    list.appendChild(btn);
}

function syncTargetSuggestions(input, host) {
    removeSuggestList();
    const wrap = host.querySelector('.codex-stage-controls__target-input-wrap');
    if (!wrap) return;
    const matches = listCodexCanvasNodeSuggestions(input.value);
    if (!matches.length) return;

    suggestListEl = document.createElement('div');
    suggestListEl.className =
        'filter-autocomplete-list filter-autocomplete-list--codex-targeted';
    matches.forEach((row) => {
        if (draftSeedIds.has(row.nodeId)) return;
        appendTargetSuggestionRow(suggestListEl, row, () => {
            addDraftSeed(row.nodeId);
            renderDraftChips(host);
            input.value = '';
            removeSuggestList();
            input.focus();
        });
    });
    if (!suggestListEl.childElementCount) {
        removeSuggestList();
        return;
    }
    wrap.appendChild(suggestListEl);
}

function updateTargetedSelectionHint(host) {
    const hint = host?.querySelector('.codex-stage-controls__target-hint');
    if (!hint) return;
    hint.textContent = s.codexTargetedSelectionLinkSeeds
        ? 'Shows each pick’s cords plus shortest paths that connect every pair of picks (2+ names).'
        : 'Each picked node shows only its own cords (through breaks to the next portrait). Selections are not linked together.';
}

function tryAddFromInput(input, host) {
    const raw = input.value.trim();
    if (!raw) return;
    const id = resolveCodexNodeIdFromNameQuery(raw);
    if (!id) return;
    addDraftSeed(id);
    renderDraftChips(host);
    input.value = '';
    removeSuggestList();
}

export function mountCodexStageTargetedSelectionUi(host) {
    draftSeedIds = new Set(s.codexTargetedSelectionSeedIds);

    const block = document.createElement('div');
    block.className = 'codex-stage-controls__target';

    const heading = document.createElement('div');
    heading.className = 'codex-stage-controls__target-heading';
    heading.textContent = 'Targeted selection';

    const hint = document.createElement('p');
    hint.className = 'codex-stage-controls__target-hint';

    const linkLbl = document.createElement('label');
    linkLbl.className = 'codex-stage-controls__label codex-stage-controls__target-link-label';
    const linkCb = document.createElement('input');
    linkCb.type = 'checkbox';
    linkCb.className = 'codex-stage-controls__target-link-toggle';
    linkCb.title =
        'When on, also show every node and break on the shortest path between each pair of picked names';
    linkCb.checked = s.codexTargetedSelectionLinkSeeds;
    linkCb.addEventListener('change', () => {
        s.codexTargetedSelectionLinkSeeds = !!linkCb.checked;
        api.persistCodexTargetedLinkPref();
        updateTargetedSelectionHint(host);
        reapplyCodexTargetedSelectionIfActive();
    });
    const linkSpan = document.createElement('span');
    linkSpan.textContent = 'Link selections';
    linkLbl.append(linkCb, linkSpan);

    const wrap = document.createElement('div');
    wrap.className = 'codex-stage-controls__target-input-wrap';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'codex-stage-controls__target-input';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-label', 'Search nodes on the canvas');
    input.placeholder = 'Node name…';

    const chips = document.createElement('div');
    chips.className = 'codex-stage-controls__target-chips';

    const actions = document.createElement('div');
    actions.className = 'codex-stage-controls__target-actions';

    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'codex-stage-controls__target-apply';
    applyBtn.textContent = 'Apply';

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'codex-stage-controls__target-clear';
    clearBtn.textContent = 'Clear';

    input.addEventListener('input', () => syncTargetSuggestions(input, host));
    input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            tryAddFromInput(input, host);
        } else if (ev.key === 'Escape') {
            removeSuggestList();
        }
    });
    input.addEventListener('blur', () => {
        setTimeout(() => {
            if (document.activeElement === input) return;
            const ae = document.activeElement;
            if (suggestListEl && ae && suggestListEl.contains(ae)) return;
            removeSuggestList();
        }, 160);
    });

    applyBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        tryAddFromInput(input, host);
        if (draftSeedIds.size === 0) return;
        applyCodexTargetedSelection([...draftSeedIds]);
    });

    clearBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        draftSeedIds.clear();
        input.value = '';
        removeSuggestList();
        renderDraftChips(host);
        clearCodexTargetedSelection();
    });

    wrap.appendChild(input);
    actions.append(applyBtn, clearBtn);
    block.append(heading, hint, linkLbl, wrap, chips, actions);
    host.appendChild(block);

    updateTargetedSelectionHint(host);
    renderDraftChips(host);
}

export function syncCodexStageTargetedSelectionModeUi(host) {
    if (!host) return;
    const linkCb = host.querySelector('.codex-stage-controls__target-link-toggle');
    if (linkCb) linkCb.checked = s.codexTargetedSelectionLinkSeeds;
    updateTargetedSelectionHint(host);
}

export function resetCodexStageTargetedSelectionDraft() {
    draftSeedIds = new Set();
    removeSuggestList();
}

export function syncCodexStageTargetedSelectionDraftFromSession(host) {
    draftSeedIds = new Set(s.codexTargetedSelectionSeedIds);
    if (host) {
        renderDraftChips(host);
        syncCodexStageTargetedSelectionModeUi(host);
    }
}
