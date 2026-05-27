import fs from 'fs';

const p = 'src/features/system-interface/interface-event-slide/standalone-slide/pagination/setupStandalonePagination.js';
const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
const eventNavStart = lines.findIndex((l) => l.includes('// Event navigation buttons'));
const pageInputStart = lines.findIndex((l) => l.trim().startsWith('// Page input'));
if (eventNavStart < 0 || pageInputStart < 0) throw new Error('split markers not found');

const body = lines.slice(eventNavStart, pageInputStart).map((l) => l.replace(/^        /, '    ')).join('\n');

const eventNavFile = `/**
 * Prev/next event buttons for standalone pagination.
 */
import { shouldEventBeLocked } from '../../../interface-globe-markers/filtering/shouldEventBeLocked.js';

/** @param {object} ctx */
export function wireStandaloneEventNavButtons(ctx) {
    const { getDockEvents, getTotalPages, getCurrentPage, handlePageChange, eventsPerPage } = ctx;
    let { updatePaginationUI } = ctx;
${body}
    ctx.updatePaginationUI = updatePaginationUI;
}
`;

fs.writeFileSync(
    'src/features/system-interface/interface-event-slide/standalone-slide/pagination/standalonePaginationEventNav.js',
    eventNavFile
);

const newLines = [
    ...lines.slice(0, eventNavStart),
    '        wireStandaloneEventNavButtons({',
    '            getDockEvents,',
    '            getTotalPages,',
    '            getCurrentPage,',
    '            handlePageChange,',
    '            eventsPerPage,',
    '            updatePaginationUI',
    '        });',
    '',
    ...lines.slice(pageInputStart)
];

fs.writeFileSync(p, newLines.join('\n'));
console.log('pagination split ok');
