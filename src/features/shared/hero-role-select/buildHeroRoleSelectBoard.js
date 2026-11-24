/**
 * Shared Tank | Damage | Support hero-select board.
 * Visuals use the existing `.chatters-hero-*` classes (Theater Chatters look).
 * Modes supply hero ids + icon/select/hover callbacks.
 */

import {
    buildHeroBiographyRoleGroups,
    HERO_BIOGRAPHY_ROLE_ORDER,
} from '../../gallery/gallery-mode/heroBiographyRoleLayout.js';
import { getHeroDisplayName } from '../../system-interface/interface-filter-menu/buttons/filterKeyMapping.js';

/**
 * @typedef {object} HeroRoleSelectCardOpts
 * @property {(heroId: string) => string} iconUrl
 * @property {(heroId: string, displayName: string, btn: HTMLButtonElement) => void} onSelect
 * @property {(heroId: string, displayName: string, btn: HTMLButtonElement) => void} [onCardHover]
 * @property {() => void} [onCardLeave]
 * @property {string} [ariaLabelSuffix]
 */

/**
 * @param {string} heroId
 * @param {HeroRoleSelectCardOpts} opts
 * @returns {HTMLButtonElement}
 */
function buildHeroCard(heroId, opts) {
    const label = getHeroDisplayName(heroId) || heroId;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chatters-hero-card';
    btn.dataset.heroId = heroId;
    btn.setAttribute('role', 'listitem');
    btn.setAttribute('aria-label', `${label} ${opts.ariaLabelSuffix || 'select'}`);
    btn.title = label;

    const portrait = document.createElement('span');
    portrait.className = 'chatters-hero-card__portrait';
    const img = document.createElement('img');
    img.className = 'chatters-hero-card__img';
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    const src = opts.iconUrl(heroId);
    if (src) img.src = src;
    else portrait.classList.add('chatters-hero-card__portrait--empty');
    portrait.appendChild(img);

    const name = document.createElement('span');
    name.className = 'chatters-hero-card__name';
    name.textContent = label;

    btn.append(portrait, name);

    if (opts.onCardHover) {
        const hover = () => opts.onCardHover(heroId, label, btn);
        btn.addEventListener('pointerenter', hover);
        btn.addEventListener('focus', hover);
    }
    if (opts.onCardLeave) {
        btn.addEventListener('pointerleave', opts.onCardLeave);
        btn.addEventListener('blur', opts.onCardLeave);
    }
    btn.addEventListener('click', () => {
        opts.onCardLeave?.();
        opts.onSelect(heroId, label, btn);
    });
    return btn;
}

/**
 * @param {string} role
 * @param {string[]} heroIds
 * @param {HeroRoleSelectCardOpts} cardOpts
 * @returns {HTMLElement}
 */
function buildRoleColumn(role, heroIds, cardOpts) {
    const column = document.createElement('section');
    column.className = `chatters-hero-select__column chatters-hero-select__column--${role.toLowerCase()}`;
    column.setAttribute('aria-label', role);

    const heading = document.createElement('h3');
    heading.className = 'chatters-hero-select__heading';
    heading.textContent = role;
    column.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'chatters-hero-select__grid';
    grid.setAttribute('role', 'list');
    for (const heroId of heroIds) {
        grid.appendChild(buildHeroCard(heroId, cardOpts));
    }
    column.appendChild(grid);
    return column;
}

/**
 * @param {string[]} heroIds
 * @param {HeroRoleSelectCardOpts & {
 *   ariaLabel?: string,
 *   includeHero?: (heroId: string) => boolean,
 * }} opts
 * @returns {Promise<HTMLElement>}
 */
export async function buildHeroRoleSelectBoard(heroIds, opts) {
    const allIds = Array.isArray(heroIds) ? heroIds.filter(Boolean) : [];
    const include = opts.includeHero || (() => true);
    const roleGroups = await buildHeroBiographyRoleGroups(allIds);

    /** @type {Record<string, string[]>} */
    const columns = {};
    const placed = new Set();

    for (const role of HERO_BIOGRAPHY_ROLE_ORDER) {
        /** @type {string[]} */
        const ids = [];
        const roleGroup = roleGroups[role] || {};
        for (const sub of Object.keys(roleGroup)) {
            for (const id of roleGroup[sub] || []) {
                if (!id || placed.has(id) || !include(id)) continue;
                ids.push(id);
                placed.add(id);
            }
        }
        ids.sort((a, b) =>
            getHeroDisplayName(a).localeCompare(getHeroDisplayName(b), undefined, {
                numeric: true,
                sensitivity: 'base',
            }),
        );
        columns[role] = ids;
    }

    for (const id of allIds) {
        if (placed.has(id) || !include(id)) continue;
        if (!columns.Unassigned) columns.Unassigned = [];
        columns.Unassigned.push(id);
        placed.add(id);
    }
    if (columns.Unassigned?.length) {
        columns.Unassigned.sort((a, b) =>
            getHeroDisplayName(a).localeCompare(getHeroDisplayName(b), undefined, {
                numeric: true,
                sensitivity: 'base',
            }),
        );
    }

    const board = document.createElement('div');
    board.className = 'chatters-hero-select';
    board.setAttribute('role', 'navigation');
    board.setAttribute('aria-label', opts.ariaLabel || 'Heroes');

    /** @type {HeroRoleSelectCardOpts} */
    const cardOpts = {
        iconUrl: opts.iconUrl,
        onSelect: opts.onSelect,
        onCardHover: opts.onCardHover,
        onCardLeave: opts.onCardLeave,
        ariaLabelSuffix: opts.ariaLabelSuffix || 'select',
    };

    for (const role of HERO_BIOGRAPHY_ROLE_ORDER) {
        const ids = columns[role] || [];
        if (!ids.length && role === 'Unassigned') continue;
        if (!ids.length) continue;
        board.appendChild(buildRoleColumn(role, ids, cardOpts));
    }

    return board;
}

/**
 * Stage shell that mirrors Theater Chatters inset:
 * `.events-manage-content` (28px) + list pad (16–36px).
 * Use outside Theater so card size matches Chatters.
 * @param {HTMLElement} board
 * @returns {HTMLElement}
 */
export function wrapHeroRoleSelectStage(board) {
    const shell = document.createElement('div');
    shell.className = 'events-manage-content hero-role-select-stage';

    const list = document.createElement('div');
    list.className = 'events-list events-list--chatters-hero-select hero-role-select-stage__list';
    list.appendChild(board);
    shell.appendChild(list);
    return shell;
}
