import { MenuButtonMaker } from './MenuButtonMaker.js';

/**
 * Builds the horizontal row of three main menu tiles:
 * Interactive Worldview, Connection Codex, and Data Archive.
 *
 * Pure DOM construction — no click handlers are wired here. Handler wiring is
 * the job of `./ModeActivation.js`.
 *
 * @returns {{
 *   row: HTMLDivElement,
 *   globeBtn: HTMLDivElement,
 *   glossaryBtn: HTMLDivElement,
 *   biographyBtn: HTMLDivElement
 * }} The row element and each tile wrapper (each wrapper has a `.button` ref).
 */
export function MenuButtonArrangement() {
    const row = document.createElement('div');
    row.className = 'main-menu-buttons-row';
    row.style.cssText = `
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: flex-start;
        gap: 30px;
        width: 100%;
    `;

    const globeBtn = MenuButtonMaker({
        id: 'runGlobeBtn',
        title: 'Interactive Worldview',
        imagePath: 'src/assets/images/Menu/Global%20Timeline.png',
        label: 'Interactive Worldview',
        description: 'Visualize the Story through a 3D Globe or 2D Map'
    });

    const glossaryBtn = MenuButtonMaker({
        id: 'runGlossaryBtn',
        title: 'Connection Codex',
        imagePath: 'src/assets/images/Menu/Concept%20Glossary.png',
        label: 'Connection Codex',
        description: 'Study how everything Connects in the Conspiracy Board'
    });

    const biographyBtn = MenuButtonMaker({
        id: 'runBiographyBtn',
        title: 'Data Archive',
        imagePath: 'src/assets/images/Menu/Character%20Bios.png',
        label: 'Data Archive',
        description: 'Browse through Story slides and Concept Files'
    });

    row.appendChild(globeBtn);
    row.appendChild(glossaryBtn);
    row.appendChild(biographyBtn);

    return { row, globeBtn, glossaryBtn, biographyBtn };
}
