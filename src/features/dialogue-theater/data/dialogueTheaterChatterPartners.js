/**
 * Chatter disclaimer partners — other-side heroes for conditioned lines.
 *
 * partnerMode:
 * - `or`      → pick one partner at random
 * - `and`     → show all partners stacked
 * - `vague`   → randomize who and how many (min 2)
 * - `hybrid`  → fixed AND heroes + one pick from each OR pool
 */

import {
    pickHeroicRenderForHero,
    renderImageUrl,
    resolveRenderHeroFolder,
} from './loadDialogueTheaterAssets.js';

/** @typedef {'or'|'and'|'vague'|'hybrid'|''} ChatterPartnerMode */

export const CHATTER_PARTNER_MODE_OR = 'or';
export const CHATTER_PARTNER_MODE_AND = 'and';
export const CHATTER_PARTNER_MODE_VAGUE = 'vague';
export const CHATTER_PARTNER_MODE_HYBRID = 'hybrid';

/**
 * @param {unknown} raw
 * @returns {ChatterPartnerMode}
 */
export function normalizeChatterPartnerMode(raw) {
    const value = String(raw != null ? raw : '').trim().toLowerCase();
    if (value === CHATTER_PARTNER_MODE_OR || value === 'or') return CHATTER_PARTNER_MODE_OR;
    if (value === CHATTER_PARTNER_MODE_AND || value === 'and') return CHATTER_PARTNER_MODE_AND;
    if (value === CHATTER_PARTNER_MODE_VAGUE || value === 'vague' || value === 'count') {
        return CHATTER_PARTNER_MODE_VAGUE;
    }
    if (value === CHATTER_PARTNER_MODE_HYBRID || value === 'hybrid') {
        return CHATTER_PARTNER_MODE_HYBRID;
    }
    return '';
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizeChatterPartnerList(raw) {
    /** @type {string[]} */
    const out = [];
    const seen = new Set();
    const list = Array.isArray(raw)
        ? raw
        : String(raw || '')
              .split(/[,;\n]+/)
              .map((part) => part.trim())
              .filter(Boolean);
    for (const entry of list) {
        const hero = String(entry || '').trim();
        if (!hero) continue;
        const key = hero.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(hero);
    }
    return out;
}

/**
 * OR pools for hybrid lines. Accepts string[][] or "A|B;C|D" encoding.
 * @param {unknown} raw
 * @returns {string[][]}
 */
export function normalizeChatterPartnerOrPools(raw) {
    if (Array.isArray(raw)) {
        return raw
            .map((pool) => normalizeChatterPartnerList(pool))
            .filter((pool) => pool.length > 0);
    }
    const text = String(raw || '').trim();
    if (!text) return [];
    return text
        .split(/[;]+/)
        .map((part) => normalizeChatterPartnerList(part.split(/[|/]+/)))
        .filter((pool) => pool.length > 0);
}

/**
 * Keep stack order in sync with partners (append new, drop removed).
 * @param {string[]} partners
 * @param {unknown} rawOrder
 * @returns {string[]}
 */
export function normalizeChatterPartnerStackOrder(partners, rawOrder) {
    const partnerSet = new Set(partners.map((h) => h.toLowerCase()));
    const order = normalizeChatterPartnerList(rawOrder).filter((h) =>
        partnerSet.has(h.toLowerCase()),
    );
    const have = new Set(order.map((h) => h.toLowerCase()));
    for (const hero of partners) {
        if (!have.has(hero.toLowerCase())) order.push(hero);
    }
    return order;
}

/**
 * @param {unknown} rawFocus
 * @param {string[]} partners
 * @returns {string}
 */
export function normalizeChatterPartnerFocus(rawFocus, partners) {
    const focus = String(rawFocus != null ? rawFocus : '').trim();
    if (!focus) return partners[0] || '';
    const hit = partners.find((h) => h.toLowerCase() === focus.toLowerCase());
    return hit || partners[0] || '';
}

/**
 * Fields persisted on a dialogue line for chatter partners.
 * @param {object} raw
 * @returns {Record<string, unknown>}
 */
export function normalizeChatterPartnerFields(raw) {
    if (!raw || typeof raw !== 'object') return {};
    const partners = normalizeChatterPartnerList(raw.partners);
    if (partners.length === 0) return {};

    let partnerMode = normalizeChatterPartnerMode(raw.partnerMode);
    if (!partnerMode) partnerMode = CHATTER_PARTNER_MODE_OR;

    const partnerStackOrder = normalizeChatterPartnerStackOrder(partners, raw.partnerStackOrder);
    const partnerFocus = normalizeChatterPartnerFocus(raw.partnerFocus, partners);
    const partnerFixed = normalizeChatterPartnerList(raw.partnerFixed).filter((h) =>
        partners.some((p) => p.toLowerCase() === h.toLowerCase()),
    );
    const partnerOrPools = normalizeChatterPartnerOrPools(raw.partnerOrPools)
        .map((pool) =>
            pool.filter((h) => partners.some((p) => p.toLowerCase() === h.toLowerCase())),
        )
        .filter((pool) => pool.length > 0);

    /** @type {Record<string, unknown>} */
    const out = {
        partnerMode,
        partners,
        partnerFocus,
        partnerStackOrder,
    };
    if (partnerMode === CHATTER_PARTNER_MODE_HYBRID) {
        if (partnerFixed.length) out.partnerFixed = partnerFixed;
        if (partnerOrPools.length) out.partnerOrPools = partnerOrPools;
    }
    const countMin = Number(raw.partnerCountMin);
    const countMax = Number(raw.partnerCountMax);
    if (partnerMode === CHATTER_PARTNER_MODE_VAGUE) {
        if (Number.isFinite(countMin) && countMin >= 2) out.partnerCountMin = Math.floor(countMin);
        if (Number.isFinite(countMax) && countMax >= 2) out.partnerCountMax = Math.floor(countMax);
    }
    return out;
}

/**
 * @param {{ partners?: string[], partnerMode?: string }|null|undefined} line
 * @returns {boolean}
 */
export function lineHasChatterPartners(line) {
    return Array.isArray(line?.partners) && line.partners.length > 0;
}

/**
 * @param {string} heroName
 * @param {Record<string, string[]>} rendersMap
 * @param {string} [renderFile]
 * @returns {string}
 */
export function getPartnerHeroRenderSrc(heroName, rendersMap, renderFile = '') {
    const hero = String(heroName || '').trim();
    if (!hero) return '';
    let render = String(renderFile || '').trim();
    if (!render) {
        render = pickHeroicRenderForHero(hero, rendersMap);
        if (!render) return '';
    }
    const folder = resolveRenderHeroFolder(hero, rendersMap);
    if (!folder) return '';
    return renderImageUrl(folder, render);
}

/**
 * @param {string[]} list
 * @param {number} count
 * @returns {string[]}
 */
function pickRandomSubset(list, count) {
    const pool = [...list];
    for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = pool[i];
        pool[i] = pool[j];
        pool[j] = tmp;
    }
    return pool.slice(0, Math.max(0, count));
}

/**
 * Heroes to paint on the partner side for this line.
 *
 * @param {{
 *   partnerMode?: string,
 *   partners?: string[],
 *   partnerFocus?: string,
 *   partnerStackOrder?: string[],
 *   partnerFixed?: string[],
 *   partnerOrPools?: string[][],
 * }|null|undefined} line
 * @param {{ stablePick?: string, stableSet?: string[], randomize?: boolean }} [options]
 * @returns {string[]}
 */
export function resolveChatterPartnerDisplayHeroes(line, options = {}) {
    const partners = normalizeChatterPartnerList(line?.partners);
    if (partners.length === 0) return [];

    const mode = normalizeChatterPartnerMode(line?.partnerMode) || CHATTER_PARTNER_MODE_OR;

    if (mode === CHATTER_PARTNER_MODE_AND) {
        return normalizeChatterPartnerStackOrder(partners, line?.partnerStackOrder);
    }

    if (mode === CHATTER_PARTNER_MODE_VAGUE) {
        const stableSet = Array.isArray(options.stableSet)
            ? normalizeChatterPartnerList(options.stableSet)
            : [];
        if (stableSet.length >= 2) {
            return stableSet.filter((h) => partners.some((p) => p.toLowerCase() === h.toLowerCase()));
        }
        if (options.randomize === false) {
            const focus = normalizeChatterPartnerFocus(line?.partnerFocus, partners);
            const fallback = focus ? [focus, partners.find((p) => p !== focus) || partners[0]] : partners.slice(0, 2);
            return [...new Set(fallback.filter(Boolean))];
        }
        const minRaw = Number(line?.partnerCountMin);
        const maxRaw = Number(line?.partnerCountMax);
        const min = Number.isFinite(minRaw) && minRaw >= 2 ? Math.min(minRaw, partners.length) : Math.min(2, partners.length);
        const maxDefault = Math.min(4, partners.length);
        const max =
            Number.isFinite(maxRaw) && maxRaw >= min
                ? Math.min(maxRaw, partners.length)
                : Math.max(min, maxDefault);
        const count = min + Math.floor(Math.random() * (max - min + 1));
        return pickRandomSubset(partners, count);
    }

    if (mode === CHATTER_PARTNER_MODE_HYBRID) {
        const fixed = normalizeChatterPartnerList(line?.partnerFixed);
        const pools = normalizeChatterPartnerOrPools(line?.partnerOrPools);
        const stableSet = Array.isArray(options.stableSet)
            ? normalizeChatterPartnerList(options.stableSet)
            : [];

        /** @type {string[]} */
        const out = [];
        const seen = new Set();
        const push = (hero) => {
            const key = hero.toLowerCase();
            if (!hero || seen.has(key)) return;
            seen.add(key);
            out.push(hero);
        };

        for (const hero of fixed) push(hero);

        if (stableSet.length > 0) {
            for (const hero of stableSet) {
                if (fixed.some((f) => f.toLowerCase() === hero.toLowerCase())) continue;
                push(hero);
            }
            return out;
        }

        for (const pool of pools) {
            if (options.randomize === false) {
                push(pool[0]);
                continue;
            }
            push(pool[Math.floor(Math.random() * pool.length)]);
        }
        return out;
    }

    // OR
    const stable = String(options.stablePick || '').trim();
    if (stable) {
        const hit = partners.find((h) => h.toLowerCase() === stable.toLowerCase());
        if (hit) return [hit];
    }
    if (options.randomize === false) {
        const focus = normalizeChatterPartnerFocus(line?.partnerFocus, partners);
        return focus ? [focus] : [partners[0]];
    }
    const pick = partners[Math.floor(Math.random() * partners.length)];
    return pick ? [pick] : [];
}
