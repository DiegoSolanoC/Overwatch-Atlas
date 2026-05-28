/**
 * Read-only #eventSlide meta rows (faction type, hero role) and global event index for markers.
 * Legacy bag: `window.EventSlideShowHelpers` (subset of former slide helper surface).
 */

import {
    getHeroBirthdayAgeDisplay,
    getHeroBirthdayRawFromEntry
} from '../interface-shared/bio-archive/HeroBirthdayAge.js';

function getCandidateEventLists(dataModel) {
    const lists = [];
    const push = (arr) => {
        if (Array.isArray(arr) && arr.length > 0) lists.push(arr);
    };
    if (dataModel) {
        push(typeof dataModel.getAllEvents === 'function' ? dataModel.getAllEvents() : dataModel.events);
    }
    try {
        push(window.globeController?.dataModel?.getAllEvents?.());
        push(window.globeController?.dataModel?.events);
        push(window.eventManager?.events);
    } catch (_) {}
    return lists;
}

export function getGlobalEventNumber1Based(eventData, dataModel) {
    if (!eventData) return null;
    const lists = getCandidateEventLists(dataModel);
    for (const list of lists) {
        const idx = list.indexOf(eventData);
        if (idx >= 0) return idx + 1;
        for (let i = 0; i < list.length; i++) {
            const variants = list[i]?.variants;
            if (Array.isArray(variants) && variants.includes(eventData)) return i + 1;
        }
    }
    return null;
}

function eventRowHasFactionTypeField(ev) {
    if (!ev || typeof ev !== 'object') return false;
    const root = ev.factionType;
    if (root != null && String(root).trim() !== '') return true;
    const vars = ev.variants;
    if (!Array.isArray(vars)) return false;
    for (let i = 0; i < vars.length; i++) {
        const ft = vars[i]?.factionType;
        if (ft != null && String(ft).trim() !== '') return true;
    }
    return false;
}

export function updateEventSlideFactionTypeDisplay(eventData, variantIndex) {
    const el = document.getElementById('eventSlideFactionTypeDisplay');
    if (!el) return;

    const heroStrip = document.getElementById('eventSlideHeroLocationsEdit');
    let stripVisible = false;
    if (heroStrip) {
        if (!heroStrip.hasAttribute('hidden')) {
            try {
                stripVisible = window.getComputedStyle(heroStrip).display !== 'none';
            } catch (_) {
                stripVisible = heroStrip.style.display !== 'none' && heroStrip.style.display !== '';
            }
        }
    }

    const ds = typeof window !== 'undefined' ? window.eventManager?.dataService : null;
    const arch = typeof ds?.getArchiveSource === 'function' ? ds.getArchiveSource() : '';
    const isFactionsArchive = arch === 'factions' || eventRowHasFactionTypeField(eventData);

    if (stripVisible || !eventData || !isFactionsArchive) {
        el.textContent = '';
        el.setAttribute('hidden', 'hidden');
        el.style.display = 'none';
        return;
    }

    const isMulti = Array.isArray(eventData.variants) && eventData.variants.length > 0;
    const vIdx = isMulti ? (variantIndex ?? 0) : 0;
    const target = isMulti ? (eventData.variants[vIdx] || eventData.variants[0]) : eventData;
    let raw = target?.factionType;
    if (isMulti && (raw == null || String(raw).trim() === '') && eventData.factionType != null) {
        raw = eventData.factionType;
    }
    const fgo = typeof window !== 'undefined' ? window.FactionArchiveGroupOrderHelpers : null;
    const label =
        fgo && typeof fgo.displayLabelForFactionArchiveType === 'function'
            ? fgo.displayLabelForFactionArchiveType(raw)
            : raw != null && String(raw).trim() !== ''
              ? String(raw).trim()
              : 'None';

    el.textContent = `Faction type: ${label}`;
    el.removeAttribute('hidden');
    el.style.display = '';
}

function eventRowHasHeroRoleField(ev) {
    if (!ev || typeof ev !== 'object') return false;
    const root = ev.heroRole;
    if (root != null && String(root).trim() !== '') return true;
    const vars = ev.variants;
    if (!Array.isArray(vars)) return false;
    for (let i = 0; i < vars.length; i++) {
        const hr = vars[i]?.heroRole;
        if (hr != null && String(hr).trim() !== '') return true;
    }
    return false;
}

function eventRowHasNpcCategoryField(ev) {
    if (!ev || typeof ev !== 'object') return false;
    const root = ev.npcCategory;
    if (root != null && String(root).trim() !== '') return true;
    const vars = ev.variants;
    if (!Array.isArray(vars)) return false;
    for (let i = 0; i < vars.length; i++) {
        const nc = vars[i]?.npcCategory;
        if (nc != null && String(nc).trim() !== '') return true;
    }
    return false;
}

export function updateEventSlideNpcCategoryDisplay(eventData, variantIndex) {
    const el = document.getElementById('eventSlideNpcCategoryDisplay');
    if (!el) return;

    const heroStrip = document.getElementById('eventSlideHeroLocationsEdit');
    let stripVisible = false;
    if (heroStrip) {
        if (!heroStrip.hasAttribute('hidden')) {
            try {
                stripVisible = window.getComputedStyle(heroStrip).display !== 'none';
            } catch (_) {
                stripVisible = heroStrip.style.display !== 'none' && heroStrip.style.display !== '';
            }
        }
    }

    const ds = typeof window !== 'undefined' ? window.eventManager?.dataService : null;
    const arch = typeof ds?.getArchiveSource === 'function' ? ds.getArchiveSource() : '';
    const isNpcsArchive = arch === 'npcs' || eventRowHasNpcCategoryField(eventData);

    if (stripVisible || !eventData || !isNpcsArchive) {
        el.textContent = '';
        el.setAttribute('hidden', 'hidden');
        el.style.display = 'none';
        return;
    }

    const isMulti = Array.isArray(eventData.variants) && eventData.variants.length > 0;
    const vIdx = isMulti ? (variantIndex ?? 0) : 0;
    const target = isMulti ? (eventData.variants[vIdx] || eventData.variants[0]) : eventData;
    let raw = target?.npcCategory;
    if (isMulti && (raw == null || String(raw).trim() === '') && eventData.npcCategory != null) {
        raw = eventData.npcCategory;
    }
    const ngo = typeof window !== 'undefined' ? window.NpcArchiveGroupOrderHelpers : null;
    const label =
        ngo && typeof ngo.displayLabelForNpcArchiveCategory === 'function'
            ? ngo.displayLabelForNpcArchiveCategory(raw)
            : raw != null && String(raw).trim() !== ''
              ? String(raw).trim()
              : 'Other';

    el.textContent = `NPC category: ${label}`;
    el.removeAttribute('hidden');
    el.style.display = '';
}

export function updateEventSlideHeroRoleDisplay(eventData, variantIndex) {
    const el = document.getElementById('eventSlideHeroRoleDisplay');
    if (!el) return;

    const heroStrip = document.getElementById('eventSlideHeroLocationsEdit');
    let stripVisible = false;
    if (heroStrip) {
        if (!heroStrip.hasAttribute('hidden')) {
            try {
                stripVisible = window.getComputedStyle(heroStrip).display !== 'none';
            } catch (_) {
                stripVisible = heroStrip.style.display !== 'none' && heroStrip.style.display !== '';
            }
        }
    }

    const ds = typeof window !== 'undefined' ? window.eventManager?.dataService : null;
    const arch = typeof ds?.getArchiveSource === 'function' ? ds.getArchiveSource() : '';
    const isHeroesArchive = arch === 'heroes' || eventRowHasHeroRoleField(eventData);

    if (stripVisible || !eventData || !isHeroesArchive) {
        el.textContent = '';
        el.setAttribute('hidden', 'hidden');
        el.style.display = 'none';
        return;
    }

    const isMulti = Array.isArray(eventData.variants) && eventData.variants.length > 0;
    const vIdx = isMulti ? (variantIndex ?? 0) : 0;
    const target = isMulti ? (eventData.variants[vIdx] || eventData.variants[0]) : eventData;
    let raw = target?.heroRole;
    if (isMulti && (raw == null || String(raw).trim() === '') && eventData.heroRole != null) {
        raw = eventData.heroRole;
    }
    const hro = typeof window !== 'undefined' ? window.HeroArchiveRoleOrderHelpers : null;
    const label =
        hro && typeof hro.displayLabelForHeroArchiveRole === 'function'
            ? hro.displayLabelForHeroArchiveRole(raw)
            : raw != null && String(raw).trim() !== ''
              ? String(raw).trim()
              : 'None';

    const roleNorm =
        hro && typeof hro.normalizeHeroArchiveRole === 'function' ? hro.normalizeHeroArchiveRole(raw) : '';
    let rawSub = target?.heroSubRole;
    if (isMulti && (rawSub == null || String(rawSub).trim() === '') && eventData.heroSubRole != null) {
        rawSub = eventData.heroSubRole;
    }
    const subNorm =
        hro && typeof hro.normalizeHeroArchiveSubrole === 'function'
            ? hro.normalizeHeroArchiveSubrole(rawSub, roleNorm)
            : '';
    let line = `Role: ${label}`;
    if (subNorm && hro && typeof hro.displayLabelForHeroArchiveSubrole === 'function') {
        const subDisp = hro.displayLabelForHeroArchiveSubrole(rawSub, roleNorm);
        if (subDisp && subDisp !== 'None') line = `Role: ${label} · ${subDisp}`;
    }
    el.textContent = line;
    el.removeAttribute('hidden');
    el.style.display = '';
}

export function updateEventSlideHeroBirthdayDisplay(eventData, variantIndex) {
    const el = document.getElementById('eventSlideHeroBirthdayDisplay');
    if (!el) return;

    const heroStrip = document.getElementById('eventSlideHeroLocationsEdit');
    let stripVisible = false;
    if (heroStrip) {
        if (!heroStrip.hasAttribute('hidden')) {
            try {
                stripVisible = window.getComputedStyle(heroStrip).display !== 'none';
            } catch (_) {
                stripVisible = heroStrip.style.display !== 'none' && heroStrip.style.display !== '';
            }
        }
    }

    const ds = typeof window !== 'undefined' ? window.eventManager?.dataService : null;
    const arch = typeof ds?.getArchiveSource === 'function' ? ds.getArchiveSource() : '';
    const isHeroesArchive = arch === 'heroes' || eventRowHasHeroRoleField(eventData);

    if (stripVisible || !eventData || !isHeroesArchive) {
        el.textContent = '';
        el.setAttribute('hidden', 'hidden');
        el.style.display = 'none';
        return;
    }

    const isMulti = Array.isArray(eventData.variants) && eventData.variants.length > 0;
    const vIdx = isMulti ? (variantIndex ?? 0) : 0;
    const target = isMulti ? (eventData.variants[vIdx] || eventData.variants[0]) : eventData;
    const birthdayRaw = getHeroBirthdayRawFromEntry(target || eventData);
    const display = getHeroBirthdayAgeDisplay(birthdayRaw);
    if (!display) {
        el.textContent = '';
        el.setAttribute('hidden', 'hidden');
        el.style.display = 'none';
        return;
    }
    el.textContent = `Birthday: ${display.birthdayText}\nAge: ${display.age}`;
    el.removeAttribute('hidden');
    el.style.display = '';
}

if (typeof window !== 'undefined') {
    if (!window.EventSlideShowHelpers) {
        window.EventSlideShowHelpers = {};
    }
    window.EventSlideShowHelpers.getGlobalEventNumber1Based = getGlobalEventNumber1Based;
    window.EventSlideShowHelpers.updateEventSlideFactionTypeDisplay = updateEventSlideFactionTypeDisplay;
    window.EventSlideShowHelpers.updateEventSlideNpcCategoryDisplay = updateEventSlideNpcCategoryDisplay;
    window.EventSlideShowHelpers.updateEventSlideHeroRoleDisplay = updateEventSlideHeroRoleDisplay;
    window.EventSlideShowHelpers.updateEventSlideHeroBirthdayDisplay = updateEventSlideHeroBirthdayDisplay;
}
