/**
 * Remove hover blur culprits site-wide:
 * - filter: brightness(soft) used as hover lift/dim
 * - skewX(...) scale(...) transforms (scale re-rasterizes skewed chrome)
 *
 * Skips @keyframes bodies (intentional pulse animations).
 */
const fs = require('fs');
const path = require('path');

function walk(dir, out = []) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p, out);
        else if (ent.name.endsWith('.css')) out.push(p);
    }
    return out;
}

function mapOutsideKeyframes(css, fn) {
    const parts = [];
    let i = 0;
    while (i < css.length) {
        const start = css.indexOf('@keyframes', i);
        if (start === -1) {
            parts.push(fn(css.slice(i)));
            break;
        }
        parts.push(fn(css.slice(i, start)));
        const brace = css.indexOf('{', start);
        if (brace === -1) {
            parts.push(css.slice(start));
            break;
        }
        let depth = 0;
        let j = brace;
        for (; j < css.length; j++) {
            if (css[j] === '{') depth++;
            else if (css[j] === '}') {
                depth--;
                if (depth === 0) {
                    j++;
                    break;
                }
            }
        }
        parts.push(css.slice(start, j)); // keep keyframes untouched
        i = j;
    }
    return parts.join('');
}

function scrub(chunk) {
    let s = chunk;

    s = s.replace(
        /^([ \t]*)filter:\s*brightness\(1\.(0[0-9]|1[0-4])\)(\s*!important)?;\s*$/gm,
        (_, indent, _v, imp) => `${indent}filter: none${imp || ''};`
    );
    s = s.replace(
        /^([ \t]*)filter:\s*brightness\(0\.9[0-9]\)(\s*!important)?;\s*$/gm,
        (_, indent, imp) => `${indent}filter: none${imp || ''};`
    );

    const stripSkewScale = (value) => {
        if (!/skewX\s*\(/.test(value)) return null;
        const scaleMatch = value.match(/scale\s*\(\s*([0-9.]+)\s*\)/);
        if (!scaleMatch) return null;
        const scaleVal = parseFloat(scaleMatch[1]);
        let cleaned = value
            .replace(/\s*scale\s*\(\s*[0-9.]+\s*\)/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
        /* Grow hovers keep a lift; shrink/active presses stay put. */
        if (scaleVal > 1 && !/translateY\s*\(/.test(cleaned)) {
            cleaned = `${cleaned} translateY(-2px)`;
        }
        return cleaned;
    };

    s = s.replace(/transform:\s*([^;]+);/g, (full, value) => {
        const cleaned = stripSkewScale(value);
        return cleaned ? `transform: ${cleaned};` : full;
    });

    s = s.replace(/transform:\s*([^;]+?)\s*!important\s*;/g, (full, value) => {
        const cleaned = stripSkewScale(value);
        return cleaned ? `transform: ${cleaned} !important;` : full;
    });

    return s;
}

const root = path.join(__dirname, '..', 'src', 'styles');
const files = walk(root);
const report = [];

for (const file of files) {
    const before = fs.readFileSync(file, 'utf8');
    const after = mapOutsideKeyframes(before, scrub);
    if (after !== before) {
        fs.writeFileSync(file, after);
        report.push(path.relative(root, file).replace(/\\/g, '/'));
    }
}

console.log(`Updated ${report.length} files:`);
report.forEach((f) => console.log(` - ${f}`));
