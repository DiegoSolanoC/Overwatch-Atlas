#!/usr/bin/env node
import fs from 'node:fs';

const html = fs.readFileSync(process.argv[2] || '', 'utf8');
const urls = [...html.matchAll(/https:\/\/static\.wikia\.nocookie\.net[^"']+\.ogg[^"']*/g)].map((m) => m[0]);
const needles = (process.argv[3] || '').split('|').filter(Boolean);

for (const url of urls) {
    const decoded = decodeURIComponent(url);
    if (!needles.length || needles.some((n) => decoded.toLowerCase().includes(n.toLowerCase()))) {
        console.log(decoded);
    }
}
