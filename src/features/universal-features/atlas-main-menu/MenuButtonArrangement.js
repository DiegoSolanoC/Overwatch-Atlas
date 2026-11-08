import { MenuButtonMaker } from './MenuButtonMaker.js';
import { MenuSideButtonMaker } from './MenuSideButtonMaker.js';

/**
 * Main menu layout: four tall primary tiles + secondary stack.
 *
 * World · Codex · Story · Intel | Theater · Archive · Gallery
 *                               | See the Latest
 *
 * Click handlers are wired in `./ModeActivation.js`.
 *
 * @returns {object}
 */
export function MenuButtonArrangement() {
    const stack = document.createElement('div');
    stack.className = 'main-menu-buttons-stack';

    const layout = document.createElement('div');
    layout.className = 'main-menu-layout main-menu-layout--modes-only';

    const modesRow = document.createElement('div');
    modesRow.className = 'main-menu-modes-row';
    modesRow.setAttribute('aria-label', 'Atlas modes');

    const worldviewBtn = MenuButtonMaker({
        id: 'runGlobeBtn',
        title: 'World',
        imagePath: 'src/assets/images/Menu/World.png',
        label: 'World',
        description: 'Visualize the story on a globe or map',
    });

    const codexBtn = MenuButtonMaker({
        id: 'runGlossaryBtn',
        title: 'Codex',
        imagePath: 'src/assets/images/Menu/Codex.png',
        label: 'Codex',
        description: 'Study how every detail connects',
    });

    const storyBtn = MenuButtonMaker({
        id: 'runStoryTimelineBtn',
        title: 'Story',
        imagePath: 'src/assets/images/Menu/Story.png',
        label: 'Story',
        description: 'Experience the Narrative in Order',
    });

    const biosBtn = MenuButtonMaker({
        id: 'runHeroBiographyBtn',
        title: 'Intel',
        imagePath: 'src/assets/images/Menu/Intel.png',
        label: 'Intel',
        description: 'Browse heroes, factions, NPCs, and places',
    });

    const theaterBtn = MenuButtonMaker({
        id: 'runDialogueTheaterBtn',
        title: 'Theater',
        imagePath: 'src/assets/images/Menu/Theater.png',
        label: 'Theater',
        description: 'Listen to Character Interactions',
    });

    const officialResourcesBtn = MenuButtonMaker({
        id: 'runOfficialResourcesBtn',
        title: 'Archive',
        imagePath: 'src/assets/images/Menu/Archive.png',
        label: 'Archive',
        description: 'Release schedule and Documentation',
    });

    const galleryBtn = MenuButtonMaker({
        id: 'runGalleryHubBtn',
        title: 'Gallery',
        imagePath: 'src/assets/images/Menu/Gallery.png',
        label: 'Gallery',
        description: 'Browse all sorts of Official media',
    });

    const seeLatestWrapper = MenuSideButtonMaker({
        id: 'seeTheLatestBtn',
        title: 'See the Latest',
        /* Preview art is filled by refreshSeeTheLatestMenuPreview — no Menu/Story hover swap */
        imagePath: null,
        label: 'See the Latest',
        description: 'Jump to the newest story beat',
        menuHoverIcon: false,
    });
    seeLatestWrapper.classList.add('main-menu-see-latest-wrapper');
    seeLatestWrapper.button.classList.add('main-menu-side-btn--see-latest');

    const secondaryModesRow = document.createElement('div');
    secondaryModesRow.className = 'main-menu-secondary-modes-row';
    secondaryModesRow.setAttribute('aria-label', 'Secondary modes');
    secondaryModesRow.appendChild(theaterBtn);
    secondaryModesRow.appendChild(officialResourcesBtn);
    secondaryModesRow.appendChild(galleryBtn);

    const secondaryStack = document.createElement('div');
    secondaryStack.className = 'main-menu-secondary-stack';
    secondaryStack.appendChild(secondaryModesRow);
    secondaryStack.appendChild(seeLatestWrapper);

    modesRow.appendChild(worldviewBtn);
    modesRow.appendChild(codexBtn);
    modesRow.appendChild(storyBtn);
    modesRow.appendChild(biosBtn);
    modesRow.appendChild(secondaryStack);

    layout.appendChild(modesRow);
    stack.appendChild(layout);

    const readUndividedBtn = null;
    const archivesBtn = null;
    const sideColumn = null;
    const sideGrid = null;
    const sideColLeft = null;
    const sideColRight = null;

    return {
        stack,
        layout,
        sideColumn,
        sideGrid,
        sideColLeft,
        sideColRight,
        modesRow,
        secondaryStack,
        secondaryModesRow,
        readUndividedBtn,
        theaterBtn,
        galleryBtn,
        archivesBtn,
        officialResourcesBtn,
        seeLatestWrapper,
        seeLatestBtn: seeLatestWrapper.button,
        worldviewBtn,
        codexBtn,
        storyBtn,
        biosBtn,
        storyTimelineBtn: storyBtn,
        heroBiographyBtn: biosBtn,
        dialogueTheaterBtn: theaterBtn,
        archiveBtn: archivesBtn,
        biographyBtn: archivesBtn,
        globeBtn: worldviewBtn,
        glossaryBtn: codexBtn,
        row1: modesRow,
        row2: null,
    };
}
