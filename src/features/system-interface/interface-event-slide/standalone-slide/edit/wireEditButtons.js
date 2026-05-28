/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's wireEditButtons method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's `this`).
 */

import { isEventSlideEditDevHost } from '../../../interface-info-display/isEventSlideEditDevHost.js';

function resolveLiveArchiveEventData(slide, fallbackEventData) {
    const api = typeof window !== 'undefined' ? window.BioArchiveSlideEventData : null;
    if (api && typeof api.resolveLiveArchiveEventDataForSlide === 'function') {
        return api.resolveLiveArchiveEventDataForSlide(slide, fallbackEventData);
    }
    const em = window.eventManager;
    const list = em && em.events;
    const idx = slide && slide.currentEventIndex;
    if (Array.isArray(list) && typeof idx === 'number' && idx >= 0 && idx < list.length && list[idx]) {
        return list[idx];
    }
    return fallbackEventData;
}

export function runWireEditButtons(slide, eventData, displayEvent, editBtn, saveBtn, titleEl, textEl) {
            if (!editBtn || !saveBtn) return;

            if (!isEventSlideEditDevHost()) {
                editBtn.style.display = 'none';
                saveBtn.style.display = 'none';
                editBtn.disabled = true;
                saveBtn.disabled = true;
                return;
            }
            
            // Reset state
            slide.isEditing = false;
            editBtn.textContent = 'Edit';
            editBtn.style.display = 'block';
            saveBtn.style.display = 'none';
            
            // Remove old listeners by cloning
            const newEditBtn = editBtn.cloneNode(true);
            const newSaveBtn = saveBtn.cloneNode(true);
            editBtn.parentNode.replaceChild(newEditBtn, editBtn);
            saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
            
            newEditBtn.onclick = () => {
                const live = resolveLiveArchiveEventData(slide, eventData);
                if (slide.isEditing) {
                    slide.cancelEdit(newEditBtn, newSaveBtn);
                } else {
                    slide.startFullEdit(live, displayEvent, newEditBtn, newSaveBtn);
                }
            };

            newSaveBtn.onclick = () => {
                const live = resolveLiveArchiveEventData(slide, eventData);
                slide.saveFullEdit(live, newEditBtn, newSaveBtn);
            };
}
