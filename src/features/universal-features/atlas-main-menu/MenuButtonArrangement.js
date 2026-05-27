import { wireLoadingAssetImage } from '../atlas-ui/loadingAssetSlot.js';
import { MenuButtonMaker } from './MenuButtonMaker.js';
import { MenuSideButtonMaker } from './MenuSideButtonMaker.js';

const UNDIVIDED_WEBTOON_URL =
    'https://www.webtoons.com/en/action/overwatch/list?title_no=9843';

/**
 * Main menu layout: one row of four primary modes + side column on the right.
 *
 * Side 2×2: [Dialogue Theater, Read Undivided] | [Data Archive, Official Resources].
 * Modes row: Worldview, Codex, Story, Bios.
 *
 * Click handlers are wired in `./ModeActivation.js`.
 *
 * @returns {object}
 */
export function MenuButtonArrangement() {
    const stack = document.createElement('div');
    stack.className = 'main-menu-buttons-stack';

    const layout = document.createElement('div');
    layout.className = 'main-menu-layout';

    const sideColumn = document.createElement('div');
    sideColumn.className = 'main-menu-side-column';
    sideColumn.setAttribute('aria-label', 'Resources and archives');

    const modesRow = document.createElement('div');
    modesRow.className = 'main-menu-modes-row';
    modesRow.setAttribute('aria-label', 'Atlas modes');

    const readUndividedBtn = MenuSideButtonMaker({
        id: 'readUndividedBtn',
        title: 'Read Undivided',
        imagePath: 'src/assets/images/Menu/Undivided.png',
        label: 'Read Undivided',
        description: 'Read the Undivided webtoon on WEBTOON',
        href: UNDIVIDED_WEBTOON_URL,
    });

    const theaterBtn = MenuSideButtonMaker({
        id: 'runDialogueTheaterBtn',
        title: 'Dialogue Theater',
        imagePath: 'src/assets/images/Menu/Dialogue%20Theater.png',
        label: 'Dialogue Theater',
        description: 'Listen to Character Interactions',
    });

    const archivesBtn = MenuSideButtonMaker({
        id: 'runBiographyBtn',
        title: 'Data Archive',
        imagePath: 'src/assets/images/Menu/Data%20Archive.png',
        label: 'Data Archive',
        description: 'Browse Factions, Characters and Places',
    });

    const officialResourcesBtn = MenuSideButtonMaker({
        id: 'runOfficialResourcesBtn',
        title: 'Official Resources',
        imagePath: 'src/assets/images/Menu/Official%20Resources.png',
        label: 'Official Resources',
        description: 'Links to official Overwatch sites and media',
    });

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

    const storyBtn = MenuButtonMaker({
        id: 'runStoryTimelineBtn',
        title: 'Story Timeline',
        imagePath: 'src/assets/images/Menu/Story%20Timeline.png',
        label: 'Story Timeline',
        description: 'Experience the Narrative in Order',
    });

    const biosBtn = MenuButtonMaker({
        id: 'runHeroBiographyBtn',
        title: 'Hero Biography',
        imagePath: 'src/assets/images/Menu/Hero%20Biography.png',
        label: 'Hero Biography',
        description: 'Learn about every Hero and their Journey',
    });

    const sideGrid = document.createElement('div');
    sideGrid.className = 'main-menu-side-grid';

    const sideColLeft = document.createElement('div');
    sideColLeft.className = 'main-menu-side-grid__col';
    sideColLeft.setAttribute('aria-label', 'Theater and Undivided');
    sideColLeft.appendChild(theaterBtn);
    sideColLeft.appendChild(readUndividedBtn);

    const sideColRight = document.createElement('div');
    sideColRight.className = 'main-menu-side-grid__col';
    sideColRight.setAttribute('aria-label', 'Archive and official resources');
    sideColRight.appendChild(archivesBtn);
    sideColRight.appendChild(officialResourcesBtn);

    sideGrid.appendChild(sideColLeft);
    sideGrid.appendChild(sideColRight);
    sideColumn.appendChild(sideGrid);

    const seeLatestWrapper = document.createElement('div');
    seeLatestWrapper.className = 'main-menu-side-btn-wrapper main-menu-see-latest-wrapper';

    const seeLatestBtn = document.createElement('button');
    seeLatestBtn.type = 'button';
    seeLatestBtn.id = 'seeTheLatestBtn';
    seeLatestBtn.className = 'main-menu-btn main-menu-side-btn main-menu-side-btn--see-latest';
    seeLatestBtn.title = 'See the Latest';
    seeLatestBtn.innerHTML = `
        <div class="main-menu-image-container">
            <img src="" alt="Latest story event">
        </div>
        <div class="main-menu-label-container">
            <div class="main-menu-label">See the Latest</div>
        </div>
        <div class="main-menu-external-label">
            <div class="main-menu-external-label__desc">Jump to the newest story event</div>
        </div>
    `;
    const seeLatestImg = seeLatestBtn.querySelector('.main-menu-image-container img');
    if (seeLatestImg) {
        wireLoadingAssetImage(seeLatestImg, {
            wrap: seeLatestBtn.querySelector('.main-menu-image-container'),
        });
    }
    seeLatestWrapper.appendChild(seeLatestBtn);
    seeLatestWrapper.button = seeLatestBtn;
    sideColumn.appendChild(seeLatestWrapper);

    modesRow.appendChild(worldviewBtn);
    modesRow.appendChild(codexBtn);
    modesRow.appendChild(storyBtn);
    modesRow.appendChild(biosBtn);

    layout.appendChild(modesRow);
    layout.appendChild(sideColumn);
    stack.appendChild(layout);

    return {
        stack,
        layout,
        sideColumn,
        sideGrid,
        sideColLeft,
        sideColRight,
        modesRow,
        readUndividedBtn,
        theaterBtn,
        archivesBtn,
        officialResourcesBtn,
        seeLatestWrapper,
        seeLatestBtn,
        worldviewBtn,
        codexBtn,
        storyBtn,
        biosBtn,
        /** @deprecated use storyBtn */
        storyTimelineBtn: storyBtn,
        /** @deprecated use biosBtn */
        heroBiographyBtn: biosBtn,
        /** @deprecated use theaterBtn */
        dialogueTheaterBtn: theaterBtn,
        /** @deprecated use archivesBtn */
        archiveBtn: archivesBtn,
        /** @deprecated use archivesBtn */
        biographyBtn: archivesBtn,
        /** @deprecated use worldviewBtn */
        globeBtn: worldviewBtn,
        /** @deprecated use codexBtn */
        glossaryBtn: codexBtn,
        /** @deprecated use modesRow */
        row1: modesRow,
        row2: null,
    };
}
