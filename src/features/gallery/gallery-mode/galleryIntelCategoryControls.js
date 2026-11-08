/**
 * Gallery intel edit — categorization selects (+ “Add new…”).
 */

import {
    addCustomGalleryCategory,
    listFactionTypeOptions,
    listHeroRoleOptions,
    listHeroSubroleOptions,
    listNpcCategoryOptions,
} from './galleryFilterTaxonomy.js';

const ADD_NEW_VALUE = '__gallery_add_category__';

/**
 * @param {HTMLSelectElement} select
 * @param {string[]} options
 * @param {string} selected
 * @param {{ includeEmpty?: boolean, emptyLabel?: string, allowAdd?: boolean }} [opts]
 */
function fillSelect(select, options, selected, opts = {}) {
    const includeEmpty = opts.includeEmpty !== false;
    const allowAdd = opts.allowAdd !== false;
    const emptyLabel = opts.emptyLabel || 'None';
    const sel = String(selected || '').trim();

    select.replaceChildren();

    if (includeEmpty) {
        const none = document.createElement('option');
        none.value = '';
        none.textContent = emptyLabel;
        select.appendChild(none);
    }

    const seen = new Set();
    for (const label of options) {
        const v = String(label || '').trim();
        if (!v || seen.has(v.toLowerCase())) continue;
        seen.add(v.toLowerCase());
        const o = document.createElement('option');
        o.value = v;
        o.textContent = v;
        select.appendChild(o);
    }

    if (sel && !seen.has(sel.toLowerCase())) {
        const o = document.createElement('option');
        o.value = sel;
        o.textContent = sel;
        select.appendChild(o);
    }

    if (allowAdd) {
        const add = document.createElement('option');
        add.value = ADD_NEW_VALUE;
        add.textContent = 'Add new…';
        select.appendChild(add);
    }

    select.value = sel && [...select.options].some((o) => o.value === sel) ? sel : '';
}

/**
 * @returns {{
 *   root: HTMLElement,
 *   populate: (category: string, entry: object|null, archiveEvents?: object[]) => void,
 *   read: (category: string) => object,
 *   setVisible: (show: boolean) => void,
 * }}
 */
export function createGalleryIntelCategoryControls() {
    const root = document.createElement('div');
    root.className = 'gallery-mode__archive-category-fields';
    root.hidden = true;

    const roleRow = document.createElement('div');
    roleRow.className = 'gallery-mode__archive-category-row';
    roleRow.dataset.fields = 'heroes';

    const roleLab = document.createElement('label');
    roleLab.className = 'gallery-mode__archive-category-label';
    roleLab.textContent = 'Role';
    const roleSelect = document.createElement('select');
    roleSelect.className = 'gallery-mode__archive-category-select';
    roleSelect.setAttribute('aria-label', 'Hero role');
    roleLab.appendChild(roleSelect);

    const subLab = document.createElement('label');
    subLab.className = 'gallery-mode__archive-category-label';
    subLab.textContent = 'Subrole';
    const subSelect = document.createElement('select');
    subSelect.className = 'gallery-mode__archive-category-select';
    subSelect.setAttribute('aria-label', 'Hero subrole');
    subLab.appendChild(subSelect);

    roleRow.append(roleLab, subLab);

    const factionRow = document.createElement('div');
    factionRow.className = 'gallery-mode__archive-category-row';
    factionRow.dataset.fields = 'factions';
    const factionLab = document.createElement('label');
    factionLab.className = 'gallery-mode__archive-category-label';
    factionLab.textContent = 'Type';
    const factionSelect = document.createElement('select');
    factionSelect.className = 'gallery-mode__archive-category-select';
    factionSelect.setAttribute('aria-label', 'Faction type');
    factionLab.appendChild(factionSelect);
    factionRow.append(factionLab);

    const npcRow = document.createElement('div');
    npcRow.className = 'gallery-mode__archive-category-row';
    npcRow.dataset.fields = 'npcs';
    const npcLab = document.createElement('label');
    npcLab.className = 'gallery-mode__archive-category-label';
    npcLab.textContent = 'Category';
    const npcSelect = document.createElement('select');
    npcSelect.className = 'gallery-mode__archive-category-select';
    npcSelect.setAttribute('aria-label', 'NPC category');
    npcLab.appendChild(npcSelect);
    npcRow.append(npcLab);

    const transferRow = document.createElement('div');
    transferRow.className = 'gallery-mode__archive-category-row gallery-mode__archive-category-row--transfer';
    transferRow.hidden = true;
    const transferBtn = document.createElement('button');
    transferBtn.type = 'button';
    transferBtn.className =
        'gallery-mode__archive-description-btn gallery-mode__archive-kind-transfer-btn';
    transferBtn.textContent = 'Promote to Hero';
    transferRow.append(transferBtn);

    root.append(roleRow, factionRow, npcRow, transferRow);

    /** @type {object[]} */
    let lastEvents = [];
    /** @type {string} */
    let lastCategory = 'heroes';

    function refreshHeroSubroles(preferred) {
        fillSelect(
            subSelect,
            listHeroSubroleOptions(roleSelect.value, lastEvents),
            preferred != null ? preferred : subSelect.value,
            { includeEmpty: true, emptyLabel: 'None', allowAdd: true },
        );
    }

    roleSelect.addEventListener('change', () => {
        if (roleSelect.value === ADD_NEW_VALUE) {
            const label = window.prompt('New hero role name:');
            const added = addCustomGalleryCategory('heroRole', label || '');
            fillSelect(roleSelect, listHeroRoleOptions(lastEvents), added || '', {
                includeEmpty: true,
                allowAdd: true,
            });
            refreshHeroSubroles('');
            return;
        }
        refreshHeroSubroles('');
    });

    subSelect.addEventListener('change', () => {
        if (subSelect.value !== ADD_NEW_VALUE) return;
        const label = window.prompt('New subrole name:');
        const added = addCustomGalleryCategory('heroSubrole', label || '', {
            role: roleSelect.value,
        });
        refreshHeroSubroles(added || '');
    });

    factionSelect.addEventListener('change', () => {
        if (factionSelect.value !== ADD_NEW_VALUE) return;
        const label = window.prompt('New faction type name:');
        const added = addCustomGalleryCategory('factionType', label || '');
        fillSelect(factionSelect, listFactionTypeOptions(lastEvents), added || '', {
            includeEmpty: true,
            allowAdd: true,
        });
    });

    npcSelect.addEventListener('change', () => {
        if (npcSelect.value !== ADD_NEW_VALUE) return;
        const label = window.prompt('New NPC category name:');
        const added = addCustomGalleryCategory('npcCategory', label || '');
        fillSelect(npcSelect, listNpcCategoryOptions(lastEvents), added || '', {
            includeEmpty: true,
            allowAdd: true,
        });
    });

    return {
        root,
        transferBtn,
        setVisible(show) {
            root.hidden = !show;
        },
        populate(category, entry, archiveEvents = []) {
            lastCategory = String(category || 'heroes');
            lastEvents = Array.isArray(archiveEvents) ? archiveEvents : [];

            const isHero = lastCategory === 'heroes';
            const isFaction = lastCategory === 'factions';
            const isNpc = lastCategory === 'npcs';

            roleRow.hidden = !isHero;
            factionRow.hidden = !isFaction;
            npcRow.hidden = !isNpc;
            transferRow.hidden = !(isHero || isNpc);
            if (isHero) {
                transferBtn.textContent = 'Demote to NPC';
                transferBtn.title = 'Move this hero to the NPC filter roster (testing)';
            } else if (isNpc) {
                transferBtn.textContent = 'Promote to Hero';
                transferBtn.title = 'Move this NPC to the Hero filter roster';
            }

            if (isHero) {
                fillSelect(roleSelect, listHeroRoleOptions(lastEvents), entry?.heroRole || '', {
                    includeEmpty: true,
                    allowAdd: true,
                });
                refreshHeroSubroles(entry?.heroSubRole || '');
            } else if (isFaction) {
                fillSelect(
                    factionSelect,
                    listFactionTypeOptions(lastEvents),
                    entry?.factionType || '',
                    { includeEmpty: true, allowAdd: true },
                );
            } else if (isNpc) {
                fillSelect(
                    npcSelect,
                    listNpcCategoryOptions(lastEvents),
                    entry?.npcCategory || '',
                    { includeEmpty: true, allowAdd: true },
                );
            }
        },
        read(category) {
            const cat = String(category || lastCategory);
            if (cat === 'heroes') {
                return {
                    heroRole: roleSelect.value === ADD_NEW_VALUE ? '' : String(roleSelect.value || '').trim(),
                    heroSubRole: subSelect.value === ADD_NEW_VALUE ? '' : String(subSelect.value || '').trim(),
                };
            }
            if (cat === 'factions') {
                return {
                    factionType:
                        factionSelect.value === ADD_NEW_VALUE
                            ? ''
                            : String(factionSelect.value || '').trim(),
                };
            }
            if (cat === 'npcs') {
                return {
                    npcCategory:
                        npcSelect.value === ADD_NEW_VALUE ? '' : String(npcSelect.value || '').trim(),
                };
            }
            return {};
        },
    };
}
