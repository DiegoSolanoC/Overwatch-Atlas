/**
 * EventFormService - Thin orchestrator for the event-edit form.
 *
 * State lives on this instance (the field-manager dependencies and a back-reference to
 * `EventManager`); the bulky DOM-touching logic lives in the sibling modules:
 *
 *   - `tokens/factionsArrayToFormDisplayString.js` — manifest token → display label
 *   - `tokens/secondaryFlagsToFormString.js`       — flag filename → country label
 *   - `clearEditForm.js`                           — reset every field to defaults
 *   - `saveCurrentVariantToMemory.js`              — DOM → `variantData[active]`
 *   - `loadVariantToForm.js`                       — `variantData[active]` → DOM
 *   - `variantTabs.js`                             — tab strip + add/delete buttons
 *   - `populateEditForm.js`                        — stored event → form (open-for-edit entry)
 *
 * Each helper takes `formService` (this instance) so it can read the injected field-managers
 * and the back-referenced `eventManager`. The facade stays slim and delegates straight through.
 */

import { factionsArrayToFormDisplayString } from './tokens/factionsArrayToFormDisplayString.js';
import { secondaryFlagsToFormString } from './tokens/secondaryFlagsToFormString.js';
import { clearEditForm } from './clearEditForm.js';
import { saveCurrentVariantToMemory } from './saveCurrentVariantToMemory.js';
import { loadVariantToForm } from './loadVariantToForm.js';
import {
    updateVariantTabs,
    deleteVariant,
    handleDeleteCurrentVariant
} from './variantTabs.js';
import { populateEditForm } from './populateEditForm.js';

class EventFormService {
    constructor() {
        this.eventManager = null;
        this.locationFieldManager = new (window.LocationTypeFields || LocationTypeFields)();
        this.sourceFieldManager = new (window.SourcePairFields || SourcePairFields)();
        this.headlinesFieldManager = new (window.HeadlineFields || HeadlineFields)();
        this.autocompleteService = new (window.FormTokenAutocomplete || FormTokenAutocomplete)();
    }

    setEventManager(eventManager) {
        this.eventManager = eventManager;
    }

    secondaryFlagsToFormString(flagFilenames) {
        return secondaryFlagsToFormString(flagFilenames);
    }

    factionsArrayToFormDisplayString(factionTokens, manifestFactions) {
        return factionsArrayToFormDisplayString(factionTokens, manifestFactions);
    }

    setupLocationTypeHandler() {
        this.locationFieldManager.setupLocationTypeHandler();
    }

    setLocationType(locationType) {
        this.locationFieldManager.setLocationType(locationType);
    }

    updateLocationFields() {
        this.locationFieldManager.updateLocationFields();
    }

    addSourcePair() {
        this.sourceFieldManager.addSourcePair();
    }

    removeLastSourcePair() {
        this.sourceFieldManager.removeLastSourcePair();
    }

    clearSourcePairs() {
        this.sourceFieldManager.clearSourcePairs();
    }

    updateRemoveSourceButton() {
        this.sourceFieldManager.updateRemoveSourceButton();
    }

    addHeadlineField() {
        this.headlinesFieldManager.addHeadlineField();
    }

    removeLastHeadlineField() {
        this.headlinesFieldManager.removeLastHeadlineField();
    }

    clearHeadlineFields() {
        this.headlinesFieldManager.clearHeadlineFields();
    }

    updateRemoveHeadlineButton() {
        this.headlinesFieldManager.updateRemoveHeadlineButton();
    }

    clearEditForm() {
        clearEditForm(this);
    }

    saveCurrentVariantToMemory() {
        saveCurrentVariantToMemory(this);
    }

    saveAllVariantsToMemory() {
        if (!this.eventManager || this.eventManager.variantData.length === 0) return;
        this.saveCurrentVariantToMemory();
    }

    loadVariantToForm(variantIndex) {
        loadVariantToForm(this, variantIndex);
    }

    updateVariantTabs() {
        updateVariantTabs(this);
    }

    deleteVariant(variantIndex) {
        deleteVariant(this, variantIndex);
    }

    handleDeleteCurrentVariant() {
        handleDeleteCurrentVariant(this);
    }

    populateEditForm(event) {
        populateEditForm(this, event);
    }

    setupAutocomplete(input, options, type) {
        this.autocompleteService.setupAutocomplete(input, options, type);
    }
}

if (typeof window !== 'undefined') {
    window.EventFormService = new EventFormService();
}

export default EventFormService;
