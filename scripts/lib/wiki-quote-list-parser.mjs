/**
 * Parse Overwatch wiki interaction quote lists, including nested route variants.
 *
 * Example variant block:
 *   <li><i>(variant if Wuyang is present, replaces response above)</i>
 *   <ul><li><b>Anran</b>: …</li><li><b>Wuyang</b>: …</li></ul></li>
 */

/**
 * @param {string} value
 * @returns {string}
 */
export function stripHtmlToText(value) {
    return String(value || '')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<i>([\s\S]*?)<\/i>/gi, '*$1*')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * @param {string} html
 * @param {number} liStart
 * @returns {number}
 */
export function findMatchingLiClose(html, liStart) {
    let depth = 0;
    let i = liStart;

    while (i < html.length) {
        if (html.startsWith('<li', i)) {
            depth += 1;
            i = html.indexOf('>', i) + 1;
            continue;
        }

        if (html.startsWith('</li>', i)) {
            depth -= 1;
            if (depth === 0) return i + 5;
            i += 5;
            continue;
        }

        i += 1;
    }

    return -1;
}

/**
 * @param {string} ulHtml Full `<ul>…</ul>` block or inner list HTML.
 * @returns {string[]}
 */
export function extractTopLevelLiBlocks(ulHtml) {
    const start = ulHtml.indexOf('<ul');
    const openEnd = start >= 0 ? ulHtml.indexOf('>', start) + 1 : 0;
    const close = ulHtml.lastIndexOf('</ul>');
    const inner = close > openEnd ? ulHtml.slice(openEnd, close) : ulHtml;

    /** @type {string[]} */
    const blocks = [];
    let pos = 0;

    while (pos < inner.length) {
        const liStart = inner.indexOf('<li', pos);
        if (liStart < 0) break;

        const end = findMatchingLiClose(inner, liStart);
        if (end < 0) break;

        blocks.push(inner.slice(liStart, end));
        pos = end;
    }

    return blocks;
}

/**
 * @param {string} liInnerHtml
 * @returns {{ hero: string, subtitles: string }|null}
 */
export function parseDialogueLine(liInnerHtml) {
    const heroMatch = liInnerHtml.match(/<b>([^<]+)<\/b>\s*:\s*/i);
    if (!heroMatch) return null;

    const hero = heroMatch[1].trim();
    const afterColon = liInnerHtml.slice(heroMatch.index + heroMatch[0].length);
    const beforeNested = afterColon.split(/<ul>/i)[0];
    const subtitles = stripHtmlToText(beforeNested);
    if (!subtitles) return null;

    return { hero, subtitles };
}

/**
 * @param {string} liHtml
 * @returns {boolean}
 */
export function isOneOfTheFollowingBlock(liHtml) {
    return /one\s+of\s+the\s+following/i.test(liHtml);
}

/**
 * @param {string} liHtml
 * @returns {{ lines: Array<{ hero: string, subtitles: string }> }}
 */
export function parseOneOfTheFollowingBlock(liHtml) {
    const nestedUl = liHtml.match(/<ul>([\s\S]*)<\/ul>/i);
    /** @type {Array<{ hero: string, subtitles: string }>} */
    const lines = [];

    if (nestedUl) {
        for (const block of extractTopLevelLiBlocks(nestedUl[0])) {
            const line = parseDialogueLine(block.replace(/^<li[^>]*>/i, '').replace(/<\/li>$/i, ''));
            if (line) lines.push(line);
        }
    }

    return { lines };
}

/**
 * @param {string} liHtml
 * @returns {boolean}
 */
export function isTeamRouteBlock(liHtml) {
    return /\(with\s+.+\s+on\s+the\s+team\s*\)/i.test(liHtml);
}

/**
 * @param {string} liHtml
 * @returns {boolean}
 */
export function isVariantRouteBlock(liHtml) {
    return (
        /\(variant\s+if\b/i.test(liHtml) ||
        /replaces\s+response\s+above/i.test(liHtml) ||
        /\(only\s+if\b/i.test(liHtml)
    );
}

/**
 * @param {string} liHtml
 * @returns {{ condition: string, lines: Array<{ hero: string, subtitles: string }> }}
 */
export function parseTeamRouteBlock(liHtml) {
    return parseNestedRouteBlock(liHtml);
}

/**
 * @param {string} liHtml
 * @returns {{ condition: string, lines: Array<{ hero: string, subtitles: string }> }}
 */
function parseNestedRouteBlock(liHtml) {
    const conditionMatch = liHtml.match(/<i>\(([\s\S]*?)\)\s*:?\s*<\/i>/i);
    const condition = conditionMatch ? stripHtmlToText(conditionMatch[1]) : '';

    const nestedUl = liHtml.match(/<ul>([\s\S]*)<\/ul>/i);
    /** @type {Array<{ hero: string, subtitles: string }>} */
    const lines = [];

    if (nestedUl) {
        for (const block of extractTopLevelLiBlocks(nestedUl[0])) {
            const line = parseDialogueLine(block.replace(/^<li[^>]*>/i, '').replace(/<\/li>$/i, ''));
            if (line) lines.push(line);
        }
    }

    return { condition, lines };
}

/**
 * @param {string} liHtml
 * @returns {{ condition: string, lines: Array<{ hero: string, subtitles: string }> }}
 */
export function parseVariantRouteBlock(liHtml) {
    return parseNestedRouteBlock(liHtml);
}

/**
 * @param {string} text
 * @param {number} [maxLen=56]
 * @returns {string}
 */
export function summarizePathLabel(text, maxLen = 56) {
    const collapsed = String(text || '')
        .replace(/\*+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!collapsed) return '';
    if (collapsed.length <= maxLen) return collapsed;
    return `${collapsed.slice(0, maxLen - 1).trim()}…`;
}

/**
 * @param {{ hero: string, subtitles: string }} line
 * @returns {string}
 */
function pathLabelFromLine(line) {
    const snippet = summarizePathLabel(line.subtitles, 48);
    return snippet || line.hero || 'Default';
}

/**
 * @param {string} condition
 * @param {Array<{ hero: string, subtitles: string }>} nestedLines
 * @returns {string}
 */
function pathLabelFromTeamRoute(condition, nestedLines) {
    const heroMatch = condition.match(/with\s+(.+?)\s+on\s+the\s+team/i);
    if (heroMatch) {
        return `${heroMatch[1].trim()} on team`;
    }

    return pathLabelFromVariant(condition, nestedLines);
}

/**
 * @param {string} condition
 * @param {Array<{ hero: string, subtitles: string }>} nestedLines
 * @returns {string}
 */
function pathLabelFromVariant(condition, nestedLines) {
    const first = nestedLines[0];
    if (first?.subtitles) {
        return summarizePathLabel(first.subtitles, 48) || first.hero;
    }

    const heroMatch = condition.match(/if\s+([^,]+?)\s+is\s+present/i);
    if (heroMatch) {
        return `${heroMatch[1].trim()} present`;
    }

    return summarizePathLabel(condition, 48) || 'Variant';
}

/**
 * @param {string} quoteCellHtml
 * @returns {{
 *   lines: Array<{ hero: string, subtitles: string }>,
 *   paths: Array<{ label: string, lineIndexes: number[], variantCondition?: string }>,
 * }}
 */
export function parseQuoteListWithRoutes(quoteCellHtml) {
    const ulMatch = quoteCellHtml.match(/<ul>[\s\S]*<\/ul>/i);
    if (!ulMatch) {
        return { lines: [], paths: [] };
    }

    /** @type {Array<{ hero: string, subtitles: string }>} */
    const lines = [];
    /** @type {Array<{ label: string, lineIndexes: number[], variantCondition?: string }>} */
    const paths = [];

    /** @type {number[]} */
    let sharedPrefixIndexes = [];

    /** @type {number[]|null} */
    let defaultIndexes = [];

    /** @type {null | Array<{ prefix: number[], variantIndex: number, label: string }>} */
    let pendingOneOfPaths = null;

    for (const liBlock of extractTopLevelLiBlocks(ulMatch[0])) {
        const liInner = liBlock.replace(/^<li[^>]*>/i, '').replace(/<\/li>$/i, '');

        if (isOneOfTheFollowingBlock(liInner)) {
            const { lines: nestedLines } = parseOneOfTheFollowingBlock(liInner);
            if (nestedLines.length === 0 || sharedPrefixIndexes.length === 0) {
                continue;
            }

            const variantIndexes = nestedLines.map((nestedLine) => {
                lines.push(nestedLine);
                return lines.length - 1;
            });

            pendingOneOfPaths = variantIndexes.map((variantIndex) => ({
                prefix: [...sharedPrefixIndexes],
                variantIndex,
                label: pathLabelFromLine(lines[variantIndex]),
            }));
            continue;
        }

        if (isTeamRouteBlock(liInner)) {
            const { condition, lines: nestedLines } = parseTeamRouteBlock(liInner);
            if (nestedLines.length === 0 || sharedPrefixIndexes.length === 0) {
                continue;
            }

            const variantIndexes = nestedLines.map((nestedLine) => {
                lines.push(nestedLine);
                return lines.length - 1;
            });

            paths.push({
                label: pathLabelFromTeamRoute(condition, nestedLines),
                lineIndexes: [...sharedPrefixIndexes, ...variantIndexes],
                variantCondition: condition,
            });
            continue;
        }

        if (isVariantRouteBlock(liInner)) {
            const { condition, lines: nestedLines } = parseVariantRouteBlock(liInner);
            if (nestedLines.length === 0 || !defaultIndexes || defaultIndexes.length === 0) {
                continue;
            }

            const prefixBeforeReplace = defaultIndexes.slice(0, -1);
            const replacedLine = lines[defaultIndexes[defaultIndexes.length - 1]];

            paths.push({
                label: pathLabelFromLine(replacedLine),
                lineIndexes: [...defaultIndexes],
            });

            const variantIndexes = nestedLines.map((nestedLine) => {
                lines.push(nestedLine);
                return lines.length - 1;
            });

            paths.push({
                label: pathLabelFromVariant(condition, nestedLines),
                lineIndexes: [...prefixBeforeReplace, ...variantIndexes],
                variantCondition: condition,
            });

            defaultIndexes = null;
            continue;
        }

        const line = parseDialogueLine(liInner);
        if (!line) continue;

        lines.push(line);
        const lineIndex = lines.length - 1;

        if (pendingOneOfPaths) {
            for (const pending of pendingOneOfPaths) {
                paths.push({
                    label: pending.label,
                    lineIndexes: [...pending.prefix, pending.variantIndex, lineIndex],
                });
            }
            pendingOneOfPaths = null;
            sharedPrefixIndexes = [];
            defaultIndexes = null;
            continue;
        }

        if (defaultIndexes) {
            defaultIndexes.push(lineIndex);
        }
        sharedPrefixIndexes.push(lineIndex);
    }

    if (paths.length === 0 && lines.length > 0) {
        paths.push({
            label: pathLabelFromLine(lines[lines.length - 1]),
            lineIndexes: lines.map((_, index) => index),
        });
    }

    return { lines, paths };
}
