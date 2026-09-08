#!/usr/bin/env node
/**
 * Render a flow-mode diagram to MP4, WebM, or GIF.
 *
 *   node scripts/render-video.mjs <diagram.html> [options]
 *
 *   --format mp4|webm|gif   default: gif
 *   --out <path>            default: alongside the source, matching extension
 *   --fps <n>               default: 30
 *   --cycles <n>            flow cycles to capture; default: 1 (a seamless loop)
 *   --scale <n>             render supersampling; default: 2 (1.5 for gif)
 *   --padding <px>          margin around the diagram; default: 32
 *   --width <px>            override composition width
 *
 * The source diagram is never modified. Everything below reads it, hands the
 * pieces to the Remotion composition, and writes one file.
 */
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REMOTION = path.join(REPO, 'remotion');

const fail = (message) => {
  console.error(`render-video: ${message}`);
  process.exit(1);
};

// ---------------------------------------------------------------- arguments

const argv = process.argv.slice(2);
const source = argv.find((token) => !token.startsWith('--'));
if (!source) {
  fail('missing <diagram.html>. See the header of this file for usage.');
}

const flag = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? fallback : argv[index + 1];
};

const format = flag('format', 'gif');
if (!['mp4', 'webm', 'gif'].includes(format)) {
  fail(`unknown --format ${format}. Expected mp4, webm, or gif.`);
}

const fps = Number(flag('fps', 30));
const cycles = Number(flag('cycles', 1));
const scale = Number(flag('scale', format === 'gif' ? 1.5 : 2));
const padding = Number(flag('padding', 32));

const sourcePath = path.resolve(source);
const outPath = path.resolve(
  flag('out', sourcePath.replace(/\.html$/, `.${format}`)),
);

// ------------------------------------------------------------- extract HTML

const html = readFileSync(sourcePath, 'utf8');

const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(
  (match) => match[1],
);
if (styles.length === 0) {
  fail('no <style> block found — is this a diagram-design-fly HTML file?');
}

const svgMatch = html.match(/<svg[\s\S]*?<\/svg>/i);
if (!svgMatch) {
  fail('no <svg> block found — is this a diagram-design-fly HTML file?');
}
const svg = svgMatch[0];

const viewBox = svg.match(/viewBox="([\d.\s-]+)"/i);
if (!viewBox) {
  fail('the <svg> has no viewBox, so the output size cannot be derived.');
}
const [, , vbWidth, vbHeight] = viewBox[1].trim().split(/\s+/).map(Number);

/*
 * Carry the motion root's own attributes into the composition.
 *
 * Flow CSS is deliberately scoped as `[data-motion-mode="flow"] .flow-stream`,
 * so the SVG alone is inert — the wrapper is what switches the animations on.
 * Dropping these attributes renders a perfectly still diagram and looks like a
 * renderer bug rather than a missing selector, so they are not optional.
 */
const rootTag = html.match(/<[a-zA-Z][\w-]*[^>]*\bdata-motion-root\b[^>]*>/);
const rootAttrs = {};
if (rootTag) {
  const body = rootTag[0].replace(/^<[a-zA-Z][\w-]*/, '').replace(/\/?>$/, '');
  for (const attr of body.matchAll(/([a-zA-Z][\w-]*)(?:\s*=\s*"([^"]*)")?/g)) {
    if (attr[1]) {
      rootAttrs[attr[1]] = attr[2] ?? '';
    }
  }
}

const mode = html.match(/data-motion-mode="([^"]+)"/);
if (mode && mode[1] !== 'flow') {
  console.warn(
    `render-video: warning — data-motion-mode is "${mode[1]}", not "flow". ` +
      'Step-based diagrams are driven by JavaScript, which this renderer does ' +
      'not run; expect a still frame.',
  );
}

// A flow diagram declares its own period. One cycle is a seamless loop.
const cycleSeconds = Number(
  (html.match(/data-flow-cycle="([\d.]+)"/) || [])[1] ?? 3.2,
);

const fontHrefs = [...html.matchAll(/<link[^>]+href="(https:\/\/[^"]+)"[^>]*>/gi)]
  .map((match) => match[1])
  .filter((href) => href.includes('fonts.googleapis.com'));

const background = (styles.join('\n').match(/--color-paper:\s*([^;]+);/) || [
  ,
  '#f5f5f5',
])[1].trim();

// h264 requires even dimensions; keep webm and gif on the same grid.
const even = (n) => Math.round(n / 2) * 2;
const width = even(Number(flag('width', vbWidth)) + padding * 2);
const height = even(
  (Number(flag('width', vbWidth)) / vbWidth) * vbHeight + padding * 2,
);
const durationInFrames = Math.max(1, Math.round(cycleSeconds * cycles * fps));

console.log(
  `render-video: ${path.basename(sourcePath)} → ${format}\n` +
    `  ${width}×${height} @${fps}fps ×${scale}  ·  ` +
    `${cycleSeconds}s cycle × ${cycles} = ${durationInFrames} frames`,
);

// ------------------------------------------------------------------- render

const work = mkdtempSync(path.join(tmpdir(), 'diagram-flow-'));
const propsFile = path.join(work, 'props.json');
writeFileSync(
  propsFile,
  JSON.stringify({
    css: styles.join('\n'),
    svg,
    rootAttrs,
    fontHrefs,
    background,
    padding,
    width,
    height,
    fps,
    durationInFrames,
  }),
);

const remotion = (args) =>
  execFileSync('npx', ['remotion', ...args], {
    cwd: REMOTION,
    stdio: 'inherit',
    env: {...process.env, BROWSER: 'none'},
  });

// Geometry and duration ride in the props file and are resolved by the
// composition's `calculateMetadata`, so nothing here needs to restate them.
const common = [
  'src/index.ts',
  'DiagramFlow',
  `--props=${propsFile}`,
  `--scale=${scale}`,
  '--log=error',
];

mkdirSync(path.dirname(outPath), {recursive: true});

try {
  if (format === 'gif') {
    /*
     * Two stages on purpose. Remotion writes a lossless PNG sequence, then
     * ffmpeg builds a palette from the whole sequence before mapping colours.
     *
     * Going straight to GIF from a compressed video would bake h264 ringing
     * into a 256-colour palette, which is exactly where flat editorial fills
     * turn into banded mud. Palettegen over lossless frames keeps the accent
     * a single clean colour.
     */
    const frames = path.join(work, 'frames');
    mkdirSync(frames, {recursive: true});
    remotion(['render', ...common, '--sequence', frames]);

    const pattern = path.join(frames, 'element-%d.png');
    const first = readdirSync(frames)[0] ?? '';
    const digits = (first.match(/element-(\d+)\.png/) || [, ''])[1].length;
    const inputPattern = digits > 1 ? pattern.replace('%d', `%0${digits}d`) : pattern;

    const palette = path.join(work, 'palette.png');
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-i', inputPattern,
      '-vf', 'palettegen=stats_mode=diff:max_colors=256',
      palette,
    ]);
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-framerate', String(fps),
      '-i', inputPattern,
      '-i', palette,
      '-lavfi', 'paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
      '-loop', '0',
      outPath,
    ]);
  } else {
    remotion([
      'render',
      ...common,
      `--codec=${format === 'mp4' ? 'h264' : 'vp9'}`,
      ...(format === 'mp4' ? ['--crf=18'] : ['--crf=32']),
      outPath,
    ]);
  }
} finally {
  rmSync(work, {recursive: true, force: true});
}

const {size} = await import('node:fs').then((fs) => fs.statSync(outPath));
console.log(`render-video: wrote ${outPath} (${(size / 1024).toFixed(0)} KB)`);
