/**
 * Shared #storyViewerContainer lifecycle for Data Archive hub and Story Timeline.
 */

export const STORY_VIEWER_CONTAINER_ID = 'storyViewerContainer';

export function getStoryViewerContainer() {
    return document.getElementById(STORY_VIEWER_CONTAINER_ID);
}

/**
 * @param {{ immediate?: boolean }} [options] Use immediate teardown when chaining modes (no fade wait).
 */
export function removeStoryViewerContainer({ immediate = false } = {}) {
    const storyContainer = getStoryViewerContainer();
    if (!storyContainer) return;

    storyContainer.classList.remove('active');
    if (immediate) {
        storyContainer.remove();
        return;
    }
    setTimeout(() => storyContainer.remove(), 300);
}

function appendStoryViewerContainerToContent(storyContainer) {
    const content = document.getElementById('content');
    if (content) {
        content.appendChild(storyContainer);
    } else {
        document.body.appendChild(storyContainer);
    }
}

/**
 * Ensure the Data Archive category hub is visible in #storyViewerContainer.
 *
 * @param {() => HTMLElement} buildHubRoot
 * @returns {HTMLElement}
 */
export function ensureDataArchiveCategoryHub(buildHubRoot) {
    let storyContainer = getStoryViewerContainer();
    if (!storyContainer) {
        storyContainer = document.createElement('div');
        storyContainer.id = STORY_VIEWER_CONTAINER_ID;
        storyContainer.className = 'story-viewer-container story-viewer-container--hub';
        appendStoryViewerContainerToContent(storyContainer);
    } else {
        storyContainer.classList.remove('story-viewer-container--timeline-mode');
        storyContainer.classList.add('story-viewer-container--hub');
    }

    document.getElementById('storyArchiveCategoryHub')?.remove();
    if (!storyContainer.querySelector('#storyArchiveCategoryHub')) {
        storyContainer.replaceChildren();
        storyContainer.appendChild(buildHubRoot());
    }

    storyContainer.style.display = 'flex';
    requestAnimationFrame(() => storyContainer.classList.add('active'));
    return storyContainer;
}

/**
 * Prepare #storyViewerContainer for Story Timeline (no category hub DOM).
 *
 * @returns {HTMLElement}
 */
export function ensureStoryTimelineViewerContainer() {
    let storyContainer = getStoryViewerContainer();
    if (!storyContainer) {
        storyContainer = document.createElement('div');
        storyContainer.id = STORY_VIEWER_CONTAINER_ID;
        storyContainer.className = 'story-viewer-container story-viewer-container--timeline-mode';
        storyContainer.setAttribute('role', 'main');
        storyContainer.setAttribute('aria-label', 'Story');
        appendStoryViewerContainerToContent(storyContainer);
    } else {
        storyContainer.classList.remove('story-viewer-container--hub');
        storyContainer.classList.add('story-viewer-container--timeline-mode');
        document.getElementById('storyArchiveCategoryHub')?.remove();
    }

    storyContainer.style.display = 'flex';
    return storyContainer;
}
