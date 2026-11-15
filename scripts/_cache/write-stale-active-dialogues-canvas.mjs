import fs from 'node:fs';
import path from 'node:path';

const auditJson = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'interactions',
    'overwatch-atlas-audits',
    'herovoice-snapshots',
    'diff_baseline_pre-next-extract_vs_post_after-next-extract',
    'stale-affected-dialogues-active-only.json',
);
const data = JSON.parse(fs.readFileSync(auditJson, 'utf8'));
const rowsLit = data.entries
    .map((e, i) => JSON.stringify([String(i + 1), e.name, String(e.matchedLines), String(e.lineCount)]))
    .join(',\n  ');

const src = `import { Stack, H1, H2, Text, Table, Stat, Grid, Callout } from 'cursor/canvas';

const ROWS: string[][] = [
  ${rowsLit}
];

export default function StaleActiveDialoguesCanvas() {
  return (
    <Stack gap={16}>
      <H1>Stale MatchTalk dialogues (not already removed)</H1>
      <Text tone="secondary" size="small">
        Source: HeroVoice diff baseline_pre-next-extract vs post_after-next-extract. Matched via subtitle/voice to stale MatchTalk labels. Excludes conversation.status = removed.
      </Text>
      <Grid columns={3} gap={12}>
        <Stat value="${data.staleButNotRemoved}" label="Active entries with stale files" />
        <Stat value="${data.alreadyMarkedRemoved}" label="Stale hits already marked removed" tone="secondary" />
        <Stat value="${data.staleAffectedTotal}" label="All stale-affected before filter" tone="secondary" />
      </Grid>
      <Callout tone="info">
        Stale means the extract did not touch that MatchTalk file — not an automatic removal. Use this list to decide keep vs revisit.
      </Callout>
      <H2>Entry names</H2>
      <Table
        headers={["#", "Entry name", "Stale-matched lines", "Total lines"]}
        columnAlign={["right", "left", "right", "right"]}
        rows={ROWS}
        striped
        stickyHeader
        style={{ maxHeight: 640 }}
      />
    </Stack>
  );
}
`;

const out = path.join(
    process.env.USERPROFILE || '',
    '.cursor',
    'projects',
    'c-Users-diego-OneDrive-Escritorio-Projects-Overwatch-Atlas',
    'canvases',
    'stale-active-dialogues.canvas.tsx',
);
fs.writeFileSync(out, src);
console.log(`wrote ${out} (${data.entries.length} rows)`);
