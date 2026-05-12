/**
 * Build the variant-tab strip at the top of the edit form and wire its three button kinds:
 *   - Numbered tabs `[1] [2] ...` that switch the active variant.
 *   - A `+` "add variant" tab.
 *   - A `-` "delete current variant" tab (only when more than one variant exists).
 *
 * The strip is hidden entirely when `variantData` is empty (which only happens between a
 * clear and a re-populate — `clearEditForm` always immediately seeds one empty variant).
 *
 * Adding a new variant pre-seeds its `locationType` + coords from whatever's currently in
 * the form, so the user starts on the same planet/coords they were just editing.
 *
 * @param {any} formService Owning EventFormService.
 */
export function updateVariantTabs(formService) {
    if (!formService.eventManager) return;

    const tabsContainer = document.getElementById('eventVariantTabs');
    const deleteVariantBtn = document.getElementById('eventEditDeleteVariant');

    if (!tabsContainer) return;

    if (formService.eventManager.variantData.length === 0) {
        tabsContainer.style.display = 'none';
        if (deleteVariantBtn) deleteVariantBtn.style.display = 'none';
        return;
    }

    tabsContainer.style.display = 'flex';
    tabsContainer.innerHTML = '';

    formService.eventManager.variantData.forEach((variant, index) => {
        const tabBtn = document.createElement('button');
        tabBtn.type = 'button';
        tabBtn.className = 'variant-tab-btn';
        tabBtn.textContent = (index + 1).toString();
        tabBtn.dataset.variantIndex = index;
        if (index === formService.eventManager.activeVariantIndex) {
            tabBtn.classList.add('active');
        }
        tabBtn.addEventListener('click', () => {
            formService.loadVariantToForm(index);
            formService.updateVariantTabs();
        });
        tabsContainer.appendChild(tabBtn);
    });

    const addTabBtn = document.createElement('button');
    addTabBtn.type = 'button';
    addTabBtn.className = 'variant-tab-btn add-variant-tab-btn';
    addTabBtn.textContent = '+';
    addTabBtn.addEventListener('click', () => {
        formService.saveCurrentVariantToMemory();

        const locationTypeInput = document.getElementById('eventEditLocationType');
        const currentLocationType = locationTypeInput ? locationTypeInput.value : 'earth';
        const currentLat = document.getElementById('eventEditLat').value.trim();
        const currentLon = document.getElementById('eventEditLon').value.trim();
        const currentX = document.getElementById('eventEditX').value.trim();
        const currentY = document.getElementById('eventEditY').value.trim();

        const newVariant = {
            name: '',
            description: '',
            sources: [],
            headlines: [],
            locationType: currentLocationType
        };

        if (currentLocationType === 'earth') {
            newVariant.lat = currentLat ? parseFloat(currentLat) : undefined;
            newVariant.lon = currentLon ? parseFloat(currentLon) : undefined;
        } else {
            newVariant.x = currentX ? parseFloat(currentX) : undefined;
            newVariant.y = currentY ? parseFloat(currentY) : undefined;
        }

        formService.eventManager.variantData.push(newVariant);
        formService.loadVariantToForm(formService.eventManager.variantData.length - 1);
        formService.updateVariantTabs();
    });
    tabsContainer.appendChild(addTabBtn);

    if (formService.eventManager.variantData.length > 1) {
        const deleteTabBtn = document.createElement('button');
        deleteTabBtn.type = 'button';
        deleteTabBtn.className = 'variant-tab-btn delete-variant-tab-btn';
        deleteTabBtn.textContent = '-';
        deleteTabBtn.addEventListener('click', () => {
            formService.deleteVariant(formService.eventManager.activeVariantIndex);
        });
        tabsContainer.appendChild(deleteTabBtn);
    }
}

/**
 * Remove a variant at the given index, fix up `activeVariantIndex`, then reload+repaint.
 *
 * If only one variant remains, defer to `handleDeleteCurrentVariant`, which wipes its
 * contents in-place instead of removing the row (there must always be at least one row
 * for the tab strip to render meaningfully).
 *
 * @param {any} formService Owning EventFormService.
 * @param {number} variantIndex
 */
export function deleteVariant(formService, variantIndex) {
    if (!formService.eventManager) return;

    if (formService.eventManager.variantData.length <= 1) {
        formService.handleDeleteCurrentVariant();
        return;
    }

    if (variantIndex < 0 || variantIndex >= formService.eventManager.variantData.length) return;

    formService.eventManager.variantData.splice(variantIndex, 1);

    if (formService.eventManager.activeVariantIndex >= formService.eventManager.variantData.length) {
        formService.eventManager.activeVariantIndex = formService.eventManager.variantData.length - 1;
    } else if (formService.eventManager.activeVariantIndex > variantIndex) {
        formService.eventManager.activeVariantIndex--;
    }

    formService.loadVariantToForm(formService.eventManager.activeVariantIndex);
    formService.updateVariantTabs();
}

/**
 * Handler for the "delete this variant" button.
 *
 * Two paths:
 *   - **Only one variant exists**: we can't drop the last row, so we clear all the text
 *     inputs (name, description, filters, factions, NPCs, secondary countries, sources) and
 *     replace `variantData[0]` with an empty shell.
 *   - **More than one variant**: defer to `deleteVariant` to splice + reload.
 *
 * @param {any} formService Owning EventFormService.
 */
export function handleDeleteCurrentVariant(formService) {
    if (!formService.eventManager) return;

    if (formService.eventManager.variantData.length === 1) {
        document.getElementById('eventEditName').value = '';
        document.getElementById('eventEditDescription').value = '';
        document.getElementById('eventEditFilters').value = '';
        document.getElementById('eventEditFactions').value = '';
        const npcsDel = document.getElementById('eventEditNpcs');
        if (npcsDel) npcsDel.value = '';
        const secDel = document.getElementById('eventEditSecondaryCountries');
        if (secDel) secDel.value = '';
        formService.clearSourcePairs();
        formService.eventManager.variantData[0] = {
            name: '',
            description: '',
            sources: [],
            headlines: []
        };
    } else {
        formService.deleteVariant(formService.eventManager.activeVariantIndex);
    }
}
