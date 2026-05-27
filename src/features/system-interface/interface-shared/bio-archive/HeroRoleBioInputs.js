/**
 * Heroes archive: **Role** + **Subrole** inputs on the static bio edit strip
 * (`#eventSlideHeroLocationsEdit`). Role drives the subrole select's option
 * list via `HeroArchiveRoleOrderHelpers.HERO_ARCHIVE_SUBROLE_ORDER_BY_ROLE`,
 * so changing role wipes any subrole value that is no longer valid.
 *
 * Visible only for the heroes archive; other archive sources hide the inputs
 * via `hidden` + `display: none` so save logic stays a single code path.
 */

/** @returns {typeof window.HeroArchiveRoleOrderHelpers|null} */
function hro() {
    return typeof window !== 'undefined' ? window.HeroArchiveRoleOrderHelpers || null : null;
}

const ALLOWED_ROLES = new Set(['', 'Tank', 'Damage', 'Support']);

/**
 * Repopulate the subrole `<select>` from the current Role value.
 * @param {unknown} [preferredSub] — if valid for the role, becomes the selected value
 */
export function populateHeroSubroleBioSelectOptions(preferredSub) {
    const roleSelect = document.getElementById('eventSlideEditHeroRoleBio');
    const subSelect = document.getElementById('eventSlideEditHeroSubRoleBio');
    if (!subSelect) return;
    const H = hro();
    const roleRaw = String(roleSelect?.value ?? '').trim();
    const roleNorm =
        H && typeof H.normalizeHeroArchiveRole === 'function'
            ? H.normalizeHeroArchiveRole(roleRaw)
            : roleRaw;
    const prev =
        preferredSub !== undefined ? String(preferredSub ?? '') : String(subSelect.value ?? '');

    subSelect.innerHTML = '';
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = 'None';
    subSelect.appendChild(noneOpt);

    if (!roleNorm || !H?.HERO_ARCHIVE_SUBROLE_ORDER_BY_ROLE?.[roleNorm]) {
        subSelect.value = '';
        return;
    }
    const list = H.HERO_ARCHIVE_SUBROLE_ORDER_BY_ROLE[roleNorm];
    for (let i = 0; i < list.length; i++) {
        const label = list[i];
        const o = document.createElement('option');
        o.value = label;
        o.textContent = label;
        subSelect.appendChild(o);
    }

    const allowed = new Set(['', ...list]);
    const n =
        H && typeof H.normalizeHeroArchiveSubrole === 'function'
            ? H.normalizeHeroArchiveSubrole(prev, roleNorm)
            : prev.trim();
    subSelect.value = allowed.has(n) ? n : '';
}

/**
 * @param {string} archiveSource
 * @param {unknown} [heroRoleForPopulate]
 * @param {unknown} [heroSubRoleForPopulate]
 */
export function syncHeroBioRolePanelsVisibility(archiveSource, heroRoleForPopulate, heroSubRoleForPopulate) {
    const rolePanel = document.getElementById('eventSlideHeroRoleBioPanel');
    const subPanel = document.getElementById('eventSlideHeroSubRoleBioPanel');
    const roleSelect = document.getElementById('eventSlideEditHeroRoleBio');
    if (!rolePanel || !roleSelect) return;
    const src = archiveSource != null ? String(archiveSource) : '';
    if (src === 'heroes') {
        rolePanel.removeAttribute('hidden');
        rolePanel.style.display = '';
        const H = hro();
        const norm =
            H && typeof H.normalizeHeroArchiveRole === 'function'
                ? H.normalizeHeroArchiveRole(heroRoleForPopulate)
                : String(heroRoleForPopulate ?? '').trim();
        roleSelect.value = ALLOWED_ROLES.has(norm) ? norm : '';
        if (subPanel) {
            subPanel.removeAttribute('hidden');
            subPanel.style.display = '';
        }
        populateHeroSubroleBioSelectOptions(heroSubRoleForPopulate);
    } else {
        rolePanel.setAttribute('hidden', 'hidden');
        rolePanel.style.display = 'none';
        roleSelect.value = '';
        if (subPanel) {
            subPanel.setAttribute('hidden', 'hidden');
            subPanel.style.display = 'none';
        }
        const subSelect = document.getElementById('eventSlideEditHeroSubRoleBio');
        if (subSelect) subSelect.innerHTML = '';
    }
}

/** @returns {string} */
export function readHeroRoleBioPanelTrimmed() {
    const select = document.getElementById('eventSlideEditHeroRoleBio');
    const raw = String(select?.value ?? '').trim();
    if (!raw) return '';
    const H = hro();
    if (H && typeof H.normalizeHeroArchiveRole === 'function') {
        const n = H.normalizeHeroArchiveRole(raw);
        return ALLOWED_ROLES.has(n) ? n : '';
    }
    return ALLOWED_ROLES.has(raw) ? raw : '';
}

/** @returns {string} */
export function readHeroSubRoleBioPanelTrimmed() {
    const subSelect = document.getElementById('eventSlideEditHeroSubRoleBio');
    const roleSelect = document.getElementById('eventSlideEditHeroRoleBio');
    const raw = String(subSelect?.value ?? '').trim();
    const H = hro();
    const roleNorm =
        H && typeof H.normalizeHeroArchiveRole === 'function'
            ? H.normalizeHeroArchiveRole(roleSelect?.value ?? '')
            : String(roleSelect?.value ?? '').trim();
    if (!roleNorm || !H?.HERO_ARCHIVE_SUBROLE_ORDER_BY_ROLE?.[roleNorm]) return '';
    if (!raw) return '';
    if (H && typeof H.normalizeHeroArchiveSubrole === 'function') {
        return H.normalizeHeroArchiveSubrole(raw, roleNorm);
    }
    return raw;
}
