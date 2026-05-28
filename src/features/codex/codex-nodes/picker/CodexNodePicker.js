/** CodexNodePicker — Codex canvas slice. */
import { api } from '../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../codex-canvas/core/canvasSession.js';
import { getEventManager, getEventsFromEventManager, getGlobeController, getStandaloneEventSlide, playSoundEffect, updateAppStatus } from '../../codex-canvas/bridge/CodexAppBridge.js';
import { CODEX_ALLOWED_COUNTRY_KEYS, codexCountryFlagSrc } from '../placement/CodexNodePortraitMetrics.js';
import { capOpts, DOUBLE_RIGHT_MS, CODEX_JUNCTION_PREVIEW_DATA_URI, MAX_SUGGEST, CODEX_DEBUG_UI_PREF_KEY_LEGACY, CODEX_MODE_PREF_KEY } from '../../codex-canvas/core/canvasConstants.js';


function openPickerAtRootPoint(worldX, worldY, anchorClientX, anchorClientY) {
    removePicker();
    if (!s.root) return;

    s.pendingNodePos = { x: worldX, y: worldY };

    s.pickerEl = document.createElement('div');
    s.pickerEl.className = 'codex-picker';

    const maxW = 340;
    const estH = 56;
    const margin = 6;
    const usePointerAnchor =
        typeof anchorClientX === 'number'
        && typeof anchorClientY === 'number'
        && !Number.isNaN(anchorClientX)
        && !Number.isNaN(anchorClientY);

    const rr = s.root.getBoundingClientRect();
    const rw = s.root.clientWidth || rr.width || 0;
    const rh = s.root.clientHeight || rr.height || 0;

    if (usePointerAnchor) {
        /*
         * #codex-view-root lives under `body { transform: scale(--desktop-scale) }`. Viewport deltas must be
         * divided by that scale so `position:absolute` `left`/`top` match the pointer in layout space.
         */
        const layoutPerVp = api.getCodexBodyLayoutPerViewportPx();
        let pl = (anchorClientX - rr.left) / layoutPerVp;
        let pt = (anchorClientY - rr.top) / layoutPerVp;
        pl = Math.max(margin, Math.min(pl, Math.max(margin, rw - maxW - margin)));
        pt = Math.max(margin, Math.min(pt, Math.max(margin, rh - estH - margin)));
        s.pickerEl.style.position = 'absolute';
        s.pickerEl.style.left = `${pl}px`;
        s.pickerEl.style.top = `${pt}px`;
        s.pickerEl.style.zIndex = '120';
        s.root.appendChild(s.pickerEl);
    } else {
        let px = worldX;
        let py = worldY;
        if (s.codexWorldEl) {
            const z = Math.max(0.05, s.codexViewZoom);
            px = worldX * z + s.codexViewPanX;
            py = worldY * z + s.codexViewPanY;
        }
        px = Math.max(0, Math.min(px, Math.max(0, rw - maxW)));
        py = Math.max(0, Math.min(py, Math.max(0, rh - estH)));
        s.pickerEl.style.left = `${px}px`;
        s.pickerEl.style.top = `${py}px`;
        s.root.appendChild(s.pickerEl);
    }

    const row = document.createElement('div');
    row.className = 'codex-picker__row';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'codex-picker-input';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-label', 'Search heroes, factions, countries, and NPCs');
    input.placeholder = 'Hero, faction, country, or NPC…';

    const btnJunction = document.createElement('button');
    btnJunction.type = 'button';
    btnJunction.className = 'codex-picker__junction';
    btnJunction.textContent = 'Break';
    btnJunction.title = 'Place a junction waypoint (circle, no portrait) for corners and splits';
    btnJunction.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (s.pendingNodePos && s.root) {
            api.placeCodexNode(s.pendingNodePos.x, s.pendingNodePos.y, 'junction', null, null, { fromSaved: false });
        }
        removePicker();
    });

    row.appendChild(input);
    row.appendChild(btnJunction);
    s.pickerEl.appendChild(row);

    input.addEventListener('input', () => syncSuggestionList(input));
    input.addEventListener('blur', () => {
        setTimeout(() => {
            if (document.activeElement === input) return;
            const ae = document.activeElement;
            if (s.listEl && ae && s.listEl.contains(ae)) return;
            removePicker();
        }, 180);
    });

    s.onDocPointerDown = (ev) => {
        if (!s.pickerEl) return;
        const t = ev.target;
        if (s.pickerEl.contains(t) || (s.listEl && s.listEl.contains(t))) return;
        removePicker();
    };
    document.addEventListener('pointerdown', s.onDocPointerDown, true);

    s.onDocKeydown = (ev) => {
        if (ev.key === 'Escape') {
            removePicker();
        }
    };
    document.addEventListener('keydown', s.onDocKeydown, true);

    input.focus();
}

function normalizeFactions(raw) {
    if (!Array.isArray(raw) || raw.length === 0) return [];
    if (typeof raw[0] === 'string') {
        return raw.map((dn) => ({ displayName: dn, filename: dn }));
    }
    return raw.filter((f) => f && (f.displayName != null || f.filename != null));
}

function getHeroFactionLists() {
    const em = getEventManager();
    const dm = getGlobeController()?.dataModel;
    const heroes = (em?.heroes?.length ? em.heroes : null) || dm?.heroes || [];
    let factions = (em?.factions?.length ? em.factions : null) || dm?.factions || [];
    const npcs = (em?.npcs?.length ? em.npcs : null) || dm?.npcs || [];
    return { heroes, factions: normalizeFactions(factions), npcs };
}

function removeListOnly() {
    if (s.listEl) {
        s.listEl.remove();
        s.listEl = null;
    }
}

function removePicker() {
    removeListOnly();
    if (s.pickerEl) {
        s.pickerEl.remove();
        s.pickerEl = null;
    }
    s.pendingNodePos = null;
    if (s.onDocPointerDown) {
        document.removeEventListener('pointerdown', s.onDocPointerDown, true);
        s.onDocPointerDown = null;
    }
    if (s.onDocKeydown) {
        document.removeEventListener('keydown', s.onDocKeydown, true);
        s.onDocKeydown = null;
    }
}

function substringMatchScore(haystack, needle) {
    if (!needle) return 0;
    const h = String(haystack || '').toLowerCase();
    const n = needle.toLowerCase();
    if (!h.includes(n)) return Infinity;
    if (h.startsWith(n)) return 0;
    return 1 + h.indexOf(n);
}

function buildMatches(query) {
    const prefix = query.trim().toLowerCase();
    const { heroes, factions, npcs } = getHeroFactionLists();
    const countries = [];
    if (prefix) {
        for (let i = 0; i < CODEX_ALLOWED_COUNTRY_KEYS.length; i += 1) {
            const key = CODEX_ALLOWED_COUNTRY_KEYS[i];
            const lk = key.toLowerCase();
            if (lk.includes(prefix)) {
                countries.push({ key, label: key });
            }
        }
    }
    if (!prefix) {
        return { heroes: [], factions: [], countries: [], npcs: [] };
    }
    const hMatch = heroes
        .filter((h) => String(h || '').toLowerCase().includes(prefix))
        .sort(
            (a, b) =>
                substringMatchScore(a, prefix) - substringMatchScore(b, prefix)
                || String(a).length - String(b).length
        )
        .slice(0, MAX_SUGGEST);
    const fMatch = factions
        .filter((f) => {
            const dn = String(f.displayName || '').trim().toLowerCase();
            const fn = String(f.filename || '').toLowerCase();
            return dn.includes(prefix) || fn.includes(prefix);
        })
        .sort((a, b) => {
            const sa = Math.min(
                substringMatchScore(a.displayName, prefix),
                substringMatchScore(a.filename, prefix)
            );
            const sb = Math.min(
                substringMatchScore(b.displayName, prefix),
                substringMatchScore(b.filename, prefix)
            );
            if (sa !== sb) return sa - sb;
            return String(a.displayName || '').length - String(b.displayName || '').length;
        })
        .slice(0, MAX_SUGGEST);
    const npcList = Array.isArray(npcs) ? npcs : [];
    const nMatch = npcList
        .filter((n) => String(n || '').toLowerCase().includes(prefix))
        .sort(
            (a, b) =>
                substringMatchScore(a, prefix) - substringMatchScore(b, prefix)
                || String(a).length - String(b).length
        )
        .slice(0, MAX_SUGGEST);
    return { heroes: hMatch, factions: fMatch, countries, npcs: nMatch };
}

function appendSuggestionRow(list, kind, heroName, faction, onPick, countryMeta = null) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'filter-autocomplete-item';

    const img = document.createElement('img');
    img.className = 'filter-autocomplete-item-icon';
    img.alt = '';
    img.decoding = 'async';
    img.onerror = () => {
        img.style.visibility = 'hidden';
    };

    let labelText = '';
    let detailText = '';

    if (kind === 'hero') {
        labelText = heroName;
        detailText = 'Hero';
        img.src = `src/assets/images/Filters/Heroes/${encodeURIComponent(heroName)}.png`;
        img.className += ' filter-autocomplete-item-icon--hero';
    } else if (kind === 'npc') {
        labelText = heroName;
        detailText = 'NPC';
        img.src = `src/assets/images/Filters/NPCs/${encodeURIComponent(heroName)}.png`;
        img.className += ' filter-autocomplete-item-icon--npc';
    } else if (kind === 'country' && countryMeta) {
        labelText = countryMeta.label || countryMeta.key;
        detailText = 'Country';
        img.src = codexCountryFlagSrc(countryMeta.key);
        img.className += ' filter-autocomplete-item-icon--flag';
    } else {
        labelText = faction.displayName;
        detailText = 'Faction';
        img.src = `src/assets/images/Filters/Factions/${encodeURIComponent(faction.filename)}.png`;
        img.className += ' filter-autocomplete-item-icon--faction';
    }

    const labelSpan = document.createElement('span');
    labelSpan.className = 'filter-autocomplete-item-label';
    labelSpan.textContent = labelText;

    const detailSpan = document.createElement('span');
    detailSpan.className = 'filter-autocomplete-item-detail';
    detailSpan.textContent = detailText;

    row.appendChild(img);
    row.appendChild(labelSpan);
    row.appendChild(detailSpan);
    row.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onPick();
    });
    list.appendChild(row);
}

function syncSuggestionList(input) {
    removeListOnly();
    const { heroes, factions, countries, npcs } = buildMatches(input.value);
    if (heroes.length === 0 && factions.length === 0 && countries.length === 0 && npcs.length === 0) {
        return;
    }

    s.listEl = document.createElement('div');
    s.listEl.className = 'filter-autocomplete-list filter-autocomplete-list--codex-picker';

    const runPick = (kind, heroName, faction, extra = {}) => {
        if (s.pendingNodePos && s.root) {
            api.placeCodexNode(s.pendingNodePos.x, s.pendingNodePos.y, kind, heroName, faction, {
                fromSaved: false,
                ...extra
            });
        }
        removePicker();
    };

    heroes.forEach((h) => {
        appendSuggestionRow(s.listEl, 'hero', h, null, () => runPick('hero', h, null));
    });
    factions.forEach((f) => {
        appendSuggestionRow(s.listEl, 'faction', null, f, () => runPick('faction', null, f));
    });
    npcs.forEach((n) => {
        appendSuggestionRow(s.listEl, 'npc', n, null, () => runPick('npc', n, null));
    });
    countries.forEach((c) => {
        appendSuggestionRow(
            s.listEl,
            'country',
            null,
            null,
            () => runPick('country', null, null, { countryKey: c.key }),
            c
        );
    });

    if (s.pickerEl) {
        s.pickerEl.appendChild(s.listEl);
    } else {
        const rect = input.getBoundingClientRect();
        s.listEl.style.left = `${rect.left}px`;
        s.listEl.style.top = `${rect.bottom + 4}px`;
        s.listEl.style.width = `${Math.max(rect.width, 220)}px`;
        document.body.appendChild(s.listEl);
    }
}

function normalizeCodexHeroNameForMatch(s) {
    return String(s || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function codexHeroNamesLooselyEqual(a, b) {
    const na = normalizeCodexHeroNameForMatch(a);
    const nb = normalizeCodexHeroNameForMatch(b);
    if (na && na === nb) return true;
    const la = na.replace(/:/g, '').replace(/\s/g, '');
    const lb = nb.replace(/:/g, '').replace(/\s/g, '');
    return la.length > 0 && la === lb;
}

function findHeroArchiveIndexByCodexName(heroNameFromNode) {
    const events = getEventsFromEventManager();
    if (!Array.isArray(events) || !events.length) return -1;
    for (let i = 0; i < events.length; i += 1) {
        const rowName = events[i] && events[i].name != null ? String(events[i].name) : '';
        if (codexHeroNamesLooselyEqual(rowName, heroNameFromNode)) return i;
    }
    return -1;
}

async function openHeroArchiveEntryFromCodexHeroName(heroNameFromNode) {
    const em = getEventManager();
    if (!em || !String(heroNameFromNode || '').trim()) return;
    if (typeof em.openHeroArchiveEventByName === 'function') {
        await em.openHeroArchiveEventByName(heroNameFromNode);
        return;
    }
    /* Legacy fallback if EventManager method unavailable */
    const slide = getStandaloneEventSlide();
    if (!slide) return;
    try {
        if (slide.pushSlideHistoryIfOpen) {
            slide.pushSlideHistoryIfOpen();
        }
        const src = typeof em.dataService?.getArchiveSource === 'function' ? em.dataService.getArchiveSource() : 'story';
        if (src !== 'heroes') {
            if (typeof em.switchStoryArchiveSource === 'function') {
                await em.switchStoryArchiveSource('heroes');
            } else if (em.dataService?.setArchiveSource) {
                em.dataService.setArchiveSource('heroes');
                await em.loadEvents();
                if (typeof em.renderEvents === 'function') em.renderEvents();
            } else {
                return;
            }
        }
        const list = em.events || [];
        const idx = findHeroArchiveIndexByCodexName(heroNameFromNode);
        if (idx < 0) {
            updateAppStatus(`No Heroes archive entry matches “${String(heroNameFromNode).trim()}”`, 'warning');
            return;
        }
        slide.showEvent(idx, { eventList: list, keepSlideHistory: true });
        playSoundEffect('eventClick');
    } catch (err) {
        console.warn('CodexCanvasService: open hero archive from codex node failed', err);
    }
}

api.openPickerAtRootPoint = openPickerAtRootPoint;
api.normalizeFactions = normalizeFactions;
api.getHeroFactionLists = getHeroFactionLists;
api.removeListOnly = removeListOnly;
api.removePicker = removePicker;
api.substringMatchScore = substringMatchScore;
api.buildMatches = buildMatches;
api.appendSuggestionRow = appendSuggestionRow;
api.syncSuggestionList = syncSuggestionList;
api.normalizeCodexHeroNameForMatch = normalizeCodexHeroNameForMatch;
api.codexHeroNamesLooselyEqual = codexHeroNamesLooselyEqual;
api.findHeroArchiveIndexByCodexName = findHeroArchiveIndexByCodexName;
api.openHeroArchiveEntryFromCodexHeroName = openHeroArchiveEntryFromCodexHeroName;

