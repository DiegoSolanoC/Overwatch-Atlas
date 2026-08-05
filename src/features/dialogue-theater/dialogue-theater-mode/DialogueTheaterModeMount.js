import {
    getDialogueTheaterListHostId,
    mountDialogueTheaterListView,
    unmountDialogueTheaterListView,
} from '../dialogue-theater-list/DialogueTheaterListView.js?v=109';

function hideGlobeChrome() {
    const testContainer = document.querySelector('.test-container');
    if (testContainer) {
        testContainer.style.display = 'none';
    }

    const eventManagerBtn = document.getElementById('eventsManageToggle');
    if (eventManagerBtn) {
        eventManagerBtn.style.setProperty('display', 'none', 'important');
    }
    const eventsManagePanel = document.getElementById('eventsManagePanel');
    if (eventsManagePanel) {
        eventsManagePanel.classList.remove('open');
    }

    const globeContainer = document.getElementById('globe-container');
    if (globeContainer) {
        globeContainer.style.display = 'none';
    }
}

function restoreGlobeChrome() {
    const testContainer = document.querySelector('.test-container');
    if (testContainer) {
        testContainer.style.display = '';
    }

    const eventManagerBtn = document.getElementById('eventsManageToggle');
    if (eventManagerBtn) {
        eventManagerBtn.style.removeProperty('display');
    }

    const globeContainer = document.getElementById('globe-container');
    if (globeContainer) {
        globeContainer.style.display = '';
    }
}

export async function mountDialogueTheaterMode() {
    unmountDialogueTheaterMode();
    hideGlobeChrome();

    const content = document.getElementById('content');
    if (!content) return;

    const host = document.createElement('div');
    host.id = getDialogueTheaterListHostId();
    content.appendChild(host);

    await mountDialogueTheaterListView(host);
}

export async function unmountDialogueTheaterMode() {
    const host = document.getElementById(getDialogueTheaterListHostId());
    unmountDialogueTheaterListView(host);
    restoreGlobeChrome();
}
