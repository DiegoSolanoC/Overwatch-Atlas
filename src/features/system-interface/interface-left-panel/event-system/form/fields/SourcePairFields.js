/**
 * SourcePairFields - Handles source pair management in event edit form
 * Manages adding, removing, and clearing source pairs
 */

import { serializeSourceLinks } from '../../../../interface-event-slide/standalone-slide/sources/sourceUrlUtils.js';
import { wireSourcePairRow, wireSourceRowsIn } from '../../../../interface-shared/storyEventSourceAutocomplete.js';
import {
    appendSourceLinkRow,
    buildSourcePairMarkup,
    populateSourceLinkStack,
    readSourceLinkValues,
    urlsForSourcePairLoad,
    wireSourcePairLinkControls,
} from './sourcePairLinkRows.js';

class SourcePairFields {
    constructor() {
        this.container = null;
    }

    /**
     * Get the source container element
     * @returns {HTMLElement|null}
     */
    getContainer() {
        if (!this.container) {
            this.container = document.getElementById('eventSourcesContainer');
        }
        return this.container;
    }

    /**
     * @param {HTMLElement} pairDiv
     */
    wirePair(pairDiv) {
        wireSourcePairLinkControls(pairDiv);
        wireSourcePairRow(pairDiv);
    }

    /**
     * Add a new source pair
     */
    addSourcePair() {
        const container = this.getContainer();
        if (!container) return;

        const currentPairs = container.querySelectorAll('.source-pair');
        const newIndex = currentPairs.length;

        const pairDiv = document.createElement('div');
        pairDiv.innerHTML = buildSourcePairMarkup(newIndex).trim();
        const pair = pairDiv.firstElementChild;
        if (!(pair instanceof HTMLElement)) return;

        container.appendChild(pair);
        populateSourceLinkStack(pair, ['']);
        this.wirePair(pair);
        this.updateRemoveSourceButton();
    }

    /**
     * Remove the last source pair (but keep at least one)
     */
    removeLastSourcePair() {
        const container = this.getContainer();
        if (!container) return;

        const pairs = container.querySelectorAll('.source-pair');
        if (pairs.length <= 1) {
            alert('At least one source field is required');
            return;
        }

        pairs[pairs.length - 1].remove();
        this.updateRemoveSourceButton();
    }

    /**
     * Clear all source pairs and reset to one empty pair
     */
    clearSourcePairs() {
        const container = this.getContainer();
        if (!container) return;

        container.innerHTML = buildSourcePairMarkup(0);
        const pair = container.querySelector('.source-pair');
        if (pair instanceof HTMLElement) {
            populateSourceLinkStack(pair, ['']);
            this.wirePair(pair);
        }
        this.updateRemoveSourceButton();
        wireSourceRowsIn(container);
    }

    /**
     * Update the visibility of the remove source button
     */
    updateRemoveSourceButton() {
        const removeBtn = document.getElementById('removeSourcePairBtn');
        const container = this.getContainer();
        if (removeBtn && container) {
            const pairs = container.querySelectorAll('.source-pair');
            removeBtn.style.display = pairs.length > 1 ? 'inline-block' : 'none';
        }
    }

    /**
     * Get all source pairs data
     * @returns {Array<{text: string, url?: string, urls?: string[]}>}
     */
    getSourcePairsData() {
        const container = this.getContainer();
        if (!container) return [];

        const sources = [];
        container.querySelectorAll('.source-pair').forEach((pair) => {
            const nameInput = pair.querySelector('.source-name-input');
            const name = nameInput instanceof HTMLInputElement ? nameInput.value.trim() : '';
            const serialized = serializeSourceLinks(name, readSourceLinkValues(pair));
            if (serialized) sources.push(serialized);
        });
        return sources;
    }

    /**
     * Load sources into source pairs
     * @param {Array<{text: string, url?: string, urls?: string[]}>} sources
     */
    loadSources(sources) {
        this.clearSourcePairs();
        const container = this.getContainer();
        if (!container) return;

        if (sources && sources.length > 0) {
            sources.forEach((source, index) => {
                if (index > 0) {
                    this.addSourcePair();
                }
                const pair = container.querySelectorAll('.source-pair')[index];
                if (!(pair instanceof HTMLElement)) return;

                const nameInput = pair.querySelector('.source-name-input');
                if (nameInput instanceof HTMLInputElement) {
                    nameInput.value = source.text || '';
                }
                populateSourceLinkStack(pair, urlsForSourcePairLoad(source));
                this.wirePair(pair);
            });
        }
        this.updateRemoveSourceButton();
        wireSourceRowsIn(container);
    }
}

if (typeof window !== 'undefined') {
    window.SourcePairFields = SourcePairFields;
}

export { SourcePairFields };
