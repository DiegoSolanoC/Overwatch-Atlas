import { MenuButtonMaker } from './MenuButtonMaker.js';

/**
 * Builds two rows of three main-menu tiles (six modes total).
 *
 * Row 1: Interactive Worldview, Connection Codex, Data Archive
 * Row 2: Hero Biography, Story Timeline, Dialogue Theater
 *
 * Pure DOM construction — click handlers are wired in `./ModeActivation.js`.
 *
 * @returns {object} Row elements and each tile wrapper (`.button` on each wrapper).
 */
export function MenuButtonArrangement() {
    const stack = document.createElement('div');
    stack.className = 'main-menu-buttons-stack';

    const row1 = document.createElement('div');
    row1.className = 'main-menu-buttons-row';

    const row2 = document.createElement('div');
    row2.className = 'main-menu-buttons-row main-menu-buttons-row--secondary';

    const worldviewBtn = MenuButtonMaker({
        id: 'runGlobeBtn',
        title: 'Interactive Worldview',
        imagePath: 'src/assets/images/Menu/Interactive%20Worldview.png',
        label: 'Interactive Worldview',
        description: 'Visualize the story through a 3D globe or 2D map',
    });

    const codexBtn = MenuButtonMaker({
        id: 'runGlossaryBtn',
        title: 'Connection Codex',
        imagePath: 'src/assets/images/Menu/Connection%20Codex.png',
        label: 'Connection Codex',
        description: 'Study how every detail connects',
    });

    const archiveBtn = MenuButtonMaker({
        id: 'runBiographyBtn',
        title: 'Data Archive',
        imagePath: 'src/assets/images/Menu/Data%20Archive.png',
        label: 'Data Archive',
        description: 'Browse through Factions, Characters and Places',
    });

    const heroBiographyBtn = MenuButtonMaker({
        id: 'runHeroBiographyBtn',
        title: 'Hero Biography',
        imagePath: 'src/assets/images/Menu/Hero%20Biography.png',
        label: 'Hero Biography',
        description: 'Learn about every Hero and their Journey',
    });

    const storyTimelineBtn = MenuButtonMaker({
        id: 'runStoryTimelineBtn',
        title: 'Story Timeline',
        imagePath: 'src/assets/images/Menu/Story%20Timeline.png',
        label: 'Story Timeline',
        description: 'Experience the Narrative in Order',
    });

    const dialogueTheaterBtn = MenuButtonMaker({
        id: 'runDialogueTheaterBtn',
        title: 'Dialogue Theater',
        imagePath: 'src/assets/images/Menu/Dialogue%20Theater.png',
        label: 'Dialogue Theater',
        description: 'Listen to Character Interactions',
    });

    row1.appendChild(worldviewBtn);
    row1.appendChild(codexBtn);
    row1.appendChild(archiveBtn);

    row2.appendChild(heroBiographyBtn);
    row2.appendChild(storyTimelineBtn);
    row2.appendChild(dialogueTheaterBtn);

    stack.appendChild(row1);
    stack.appendChild(row2);

    return {
        stack,
        row1,
        row2,
        worldviewBtn,
        codexBtn,
        archiveBtn,
        heroBiographyBtn,
        storyTimelineBtn,
        dialogueTheaterBtn,
        /** @deprecated use worldviewBtn */
        globeBtn: worldviewBtn,
        /** @deprecated use codexBtn */
        glossaryBtn: codexBtn,
        /** @deprecated use archiveBtn */
        biographyBtn: archiveBtn,
    };
}
