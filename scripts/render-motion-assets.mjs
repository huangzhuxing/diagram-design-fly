#!/usr/bin/env node
/**
 * Regenerate every committed motion asset under `docs/motion/`.
 *
 *   node scripts/render-motion-assets.mjs           # render all
 *   node scripts/render-motion-assets.mjs --check   # fail if any is missing
 *
 * A committed GIF goes stale silently: the source diagram changes, the file on
 * disk does not, and the README quietly shows last month's architecture. This
 * script is the single place that says which assets exist and how each one is
 * rendered, so regenerating them is one command rather than a remembered
 * incantation.
 *
 * Run it in the same commit that touches a source diagram.
 */
import {execFileSync} from 'node:child_process';
import {existsSync, statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = 'skills/diagram-design-fly/assets';

/**
 * README GIFs are sized for GitHub's ~850px content column, so `--scale 1` is
 * already above display resolution. 20fps halves the frame count against 30
 * with no visible cost on linear motion, which is most of the file size.
 */
const TARGETS = [
  {
    source: `${ASSETS}/example-skill-architecture-flow.html`,
    out: 'docs/motion/skill-architecture.gif',
    args: ['--format', 'gif', '--fps', '20', '--scale', '1'],
  },
  {
    source: `${ASSETS}/template-flow.html`,
    out: 'docs/motion/pipeline-flow.gif',
    args: ['--format', 'gif', '--fps', '20', '--scale', '1'],
  },
  {
    source: `${ASSETS}/example-fork-delta-flow.html`,
    out: 'docs/motion/fork-delta.gif',
    args: ['--format', 'gif', '--fps', '20', '--scale', '1'],
  },
  {
    source: `${ASSETS}/example-flow-mechanism-flow.html`,
    out: 'docs/motion/flow-mechanism.gif',
    args: ['--format', 'gif', '--fps', '20', '--scale', '1'],
  },
  {
    source: `${ASSETS}/example-getting-started-flow.html`,
    out: 'docs/motion/getting-started.gif',
    args: ['--format', 'gif', '--fps', '20', '--scale', '1'],
  },
  {
    source: `${ASSETS}/example-data-flow-flow.html`,
    out: 'docs/motion/data-flow.gif',
    args: ['--format', 'gif', '--fps', '20', '--scale', '1'],
  },
  {
    source: `${ASSETS}/example-loop-flow.html`,
    out: 'docs/motion/loop.gif',
    args: ['--format', 'gif', '--fps', '20', '--scale', '1'],
  },
  {
    source: `${ASSETS}/example-architecture-flow.html`,
    out: 'docs/motion/thumb-architecture.gif',
    args: ['--format', 'gif', '--fps', '15', '--scale', '0.5', '--padding', '12'],
  },
  {
    source: `${ASSETS}/example-flowchart-flow.html`,
    out: 'docs/motion/thumb-flowchart.gif',
    args: ['--format', 'gif', '--fps', '15', '--scale', '0.5', '--padding', '12'],
  },
  {
    source: `${ASSETS}/example-sequence-flow.html`,
    out: 'docs/motion/thumb-sequence.gif',
    args: ['--format', 'gif', '--fps', '15', '--scale', '0.5', '--padding', '12'],
  },
  {
    source: `${ASSETS}/example-state-flow.html`,
    out: 'docs/motion/thumb-state.gif',
    args: ['--format', 'gif', '--fps', '15', '--scale', '0.5', '--padding', '12'],
  },
  {
    source: `${ASSETS}/example-swimlane-flow.html`,
    out: 'docs/motion/thumb-swimlane.gif',
    args: ['--format', 'gif', '--fps', '15', '--scale', '0.5', '--padding', '12'],
  },
  {
    source: `${ASSETS}/example-high-level-flow.html`,
    out: 'docs/motion/thumb-high-level.gif',
    args: ['--format', 'gif', '--fps', '15', '--scale', '0.5', '--padding', '12'],
  },
  {
    source: `${ASSETS}/example-timeline-flow.html`,
    out: 'docs/motion/thumb-timeline.gif',
    args: ['--format', 'gif', '--fps', '15', '--scale', '0.5', '--padding', '12'],
  },
  {
    source: `${ASSETS}/example-gantt-flow.html`,
    out: 'docs/motion/thumb-gantt.gif',
    args: ['--format', 'gif', '--fps', '15', '--scale', '0.5', '--padding', '12'],
  },
  {
    source: `${ASSETS}/example-kanban-flow.html`,
    out: 'docs/motion/thumb-kanban.gif',
    args: ['--format', 'gif', '--fps', '15', '--scale', '0.5', '--padding', '12'],
  },
  {
    source: `${ASSETS}/example-journey-flow.html`,
    out: 'docs/motion/thumb-journey.gif',
    args: ['--format', 'gif', '--fps', '15', '--scale', '0.5', '--padding', '12'],
  },
  {
    source: `${ASSETS}/example-story-map-flow.html`,
    out: 'docs/motion/thumb-story-map.gif',
    args: ['--format', 'gif', '--fps', '15', '--scale', '0.5', '--padding', '12'],
  },
  {
    source: `${ASSETS}/example-process-flow.html`,
    out: 'docs/motion/thumb-process.gif',
    args: ['--format', 'gif', '--fps', '15', '--scale', '0.5', '--padding', '12'],
  },
  {
    source: `${ASSETS}/example-medallion-flow.html`,
    out: 'docs/motion/thumb-medallion.gif',
    args: ['--format', 'gif', '--fps', '15', '--scale', '0.5', '--padding', '12'],
  },
  {
    source: `${ASSETS}/example-dp-integration-flow.html`,
    out: 'docs/motion/thumb-dp-integration.gif',
    args: ['--format', 'gif', '--fps', '15', '--scale', '0.5', '--padding', '12'],
  },
  {
    source: `${ASSETS}/example-deployment-flow.html`,
    out: 'docs/motion/thumb-deployment.gif',
    args: ['--format', 'gif', '--fps', '15', '--scale', '0.5', '--padding', '12'],
  },
  {
    source: `${ASSETS}/example-data-flow-flow.html`,
    out: 'docs/motion/thumb-data-flow.gif',
    args: ['--format', 'gif', '--fps', '15', '--scale', '0.5', '--padding', '12'],
  },
  {
    source: `${ASSETS}/example-loop-flow.html`,
    out: 'docs/motion/thumb-loop.gif',
    args: ['--format', 'gif', '--fps', '15', '--scale', '0.5', '--padding', '12'],
  },
  {
    // A page produced in a real repository from a one-line prompt, kept here so
    // the README's claim about it can be re-rendered and checked.
    source: 'docs/examples/opspilot-current-architecture.html',
    out: 'docs/motion/real-example-opspilot.gif',
    args: ['--format', 'gif', '--fps', '18', '--scale', '0.85'],
  },
  {
    source: `${ASSETS}/example-skill-architecture-flow.html`,
    out: 'docs/motion/skill-architecture.mp4',
    args: ['--format', 'mp4', '--fps', '30', '--scale', '2'],
  },
];

const check = process.argv.includes('--check');

let failed = 0;
for (const target of TARGETS) {
  const out = path.join(REPO, target.out);
  if (check) {
    if (!existsSync(out)) {
      console.error(`missing: ${target.out} — run node scripts/render-motion-assets.mjs`);
      failed += 1;
      continue;
    }
    const asset = statSync(out).mtimeMs;
    const source = statSync(path.join(REPO, target.source)).mtimeMs;
    if (source > asset) {
      console.error(
        `stale: ${target.out} is older than ${target.source} — re-render it`,
      );
      failed += 1;
      continue;
    }
    console.log(`ok: ${target.out}`);
    continue;
  }

  console.log(`\n→ ${target.out}`);
  execFileSync(
    'node',
    [
      path.join(REPO, 'scripts/render-video.mjs'),
      path.join(REPO, target.source),
      ...target.args,
      '--out',
      out,
    ],
    {cwd: REPO, stdio: 'inherit'},
  );
}

if (check) {
  console.log(
    failed ? `\n${failed} motion asset(s) need attention` : '\nall motion assets current',
  );
  process.exit(failed ? 1 : 0);
}
