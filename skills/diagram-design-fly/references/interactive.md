# Interactive diagrams

Use when changing inputs, selecting relationships, opening layers, inspecting values, or stepping through a calculation is part of what the reader learns. A static relationship remains static; a fixed continuous path uses `flow`. An interactive diagram is a small explorable explanation, not necessarily a dashboard or a Transformer.

This mode supersedes the fixed-controller, no-semantic-mutation, eight-step and global nine-node restrictions in the static/animation references. Keep their readability and accessibility intent. Group a complex subject into navigable views instead of squeezing everything into one screen. Start with one useful question the user can answer by changing something.

## Choose the representation from the subject

| Reader's question | Useful components and behavior |
|---|---|
| Where does a request go? | Cards, branch paths, selecting one trace, input-dependent outcomes |
| Which resource is a bottleneck? | Queue/count bars, rate controls, conservation model, timeline |
| What happens inside this layer? | Stack overview, select control, expanded layer, detail text |
| How are quantities combined? | Vectors or matrices, highlighted relationships, actual arithmetic |
| How does a value change over time? | Sparkline with explicit time samples, units and a common scale |
| What changes across scenarios? | Scenario selector, updated cards/bars, explanation of the difference |

These are choices, not a checklist. Do not put a matrix or fake 3D stack into an unrelated topic. Use colors consistently for a role/entity; use text as well. Reuse the runtime rather than reimplementing controls. The subject's logic belongs in a separate pure model; it must not reach into the DOM.

## Portable authoring path

Resolve paths from the installed skill directory (not the user's output folder). Read one relevant example, not every example:

- Layered computation: [Transformer spec](../assets/interactive/transformer.json) and [model](../assets/interactive/transformer-model.js).
- Time and conservation: [Queue spec](../assets/interactive/queue.json) and [model](../assets/interactive/queue-model.js).
- Shared visual tokens/layout: [style](../assets/interactive/style.css).

1. Write a scene JSON and, when values/layout depend on inputs, a local JavaScript model.
2. Build a single standalone HTML with the packaged builder. It embeds the runtime, styles, model, JSON and an already-rendered complete default SVG. No CDN, server or npm install is needed for the delivered HTML. The examples are SVG layouts, not an obligation to include their shapes. Match every claim about visual encoding to what the selected primitive actually renders.
3. Run packaged self-check and inspect it in a browser. Exercise inputs and keyboard selection, not just the opening frame. Fix clipping, overlapping text, unreadable labels and inert controls based on the actual render.

```bash
node /absolute/skill/scripts/build-interactive.mjs scene.json --model model.js --out explanation.html
python3 /absolute/skill/scripts/self_check.py explanation.html
```

Omit `--model` for static scene data with selection/playback. The builder executes your authored local model; do not pass unknown downloaded code to it. Source files remain editable alongside the portable HTML. Rebuild HTML after source changes.

## Scene contract v1

Required: `version:1`, lowercase slug `id`, `title`, `description`, `width`, `height` (SVG units), and `duration` (seconds, >0, ≤300). Optional: `lang`, `eyebrow`, `hint`, `seed`, `exportWidth`/`exportHeight` (page frame), `theme` (six-digit hex values for paper/panel/ink/muted/line/accent).

`controls` is an array with unique `id`, visible `label`, `type` and initial `value`:

- `text`: optional `maxLength`. Handle empty text and limit item count in the model.
- `range`: numeric `min`, `max`, optional `step`.
- `select`: `options:[{value:"a",label:"Scenario A"}, ...]`.

`nodes` and `edges` can live in the JSON or be returned by the model. Every node requires `id,label,x,y,w,h`; positions are explicit SVG coordinates. Lay out for the content, with enough connector space to see motion. Leave room for the longest expected label and selected state. Nodes must not overlap: the builder checks all pairs at default, control-boundary, selector and timeline states. Use a stack primitive for decorative overlap, not overlapping separate semantic nodes.

Node kinds:

- `card` (default): `lines:["..."]`.
- `vector`: `values:[number,...]`, optional `labels`. Cells have **fixed height**; do not describe them as bar-height or time-series charts. Color strength represents clamped absolute magnitude 0–1; tooltips retain raw values. Normalize deliberately if that encoding is unsuitable.
- `matrix`: rectangular `values:[[0.2,0.8],...]`; null is masked and drawn as ×. Cells display percent numbers, and colors represent 0–1. Optional `labels` for both axes. Use only for weights/proportions; other matrix semantics need an extended primitive.
- `bars`: `values`, `labels`, optional `max`, `format:"percent"`. Values are nonnegative; choose a common max when comparing bars.
- `sparkline`: `values:[number,...]`, time/sample `labels`, optional `min` and `max`. Position/line height encodes the value, with endpoint labels and a numeric vertical axis. Use for time series; state units in `subtitle`.
- `stack`: `count`, `lines`; optional `action` can change a select control to open another view.

All kinds accept `subtitle`, `detail`, `color`, `badge`. Clicking or pressing Enter/Space selects a node and shows `detail`; an explicit `action:{type:"input",id:"view",value:"next"}` updates a control instead. Model-returned node sets can differ across views; return their complete corresponding edge set.

Edges require `id,from,to,start,end`. Start/end are seconds in the scene duration. Optional `label,color,points:[[x0,y0],[x1,y1],[x2,y2],[x3,y3]]`. Default is a left-to-right cubic between node boundaries; provide points for vertical, backward, branch or bypass routes. Travel is deterministic cubic interpolation, not a simulated physical speed. Keep a base path visible at all times.

A model assigns a pure function:

```js
globalThis.DiagramModel = function(input, {time, selected, seed}) {
  const count = Number(input.count);
  return {
    nodes: [{id:'result', label:'Result', x:40,y:60,w:240,h:150,
      lines:[`${count * 2} items`], detail:'Each batch contains two items.'}],
    edges: [],
    summaryTitle:'Batch size', summary:'Changing the input recalculates the result.',
    metrics:`${count} × 2 = ${count * 2}`
  };
};
```

The runtime supplies validated controls. Return finite values and stable IDs. Compute all related displays from the same results. Use seeded randomness or explicit recorded outcomes if needed; no `Math.random()`, wall-clock, network fetch, or external mutable state. Label demonstration assumptions honestly. A semantic model needs arithmetic tests beyond HTML checks.

## Time and controls

Browser API: `window.diagram.seek(seconds)`, `.dispatch({type:"input",id,value})`, `.dispatch({type:"select",id})`, `.snapshot()`, `.play()`, `.pause()`.

- Manual parameter edits pause and return to 0 seconds; manual selection pauses at the current time.
- Play advances the current scenario once and stops at `duration`. Reset restores original controls and clears selection.
- Optional `timeline:[{at:0,type:"select",id:"node"},{at:4,type:"input",id:"count",value:10}]` contains sorted events. The “演示预设” button and `seek(t)` replay from default state, so reverse seeks do not retain future input values.
- `seek(t,{timeline:false})` keeps manually selected inputs. The scrubber preserves whether the viewer is in manual or preset mode.
- The model receives absolute time plus the currently selected inputs. If a time-dependent model needs event history, implement its deterministic integration explicitly; switching a parameter alone does not integrate earlier values for you.

Do not make meaningful information depend on the moving packet. With JS disabled, default-parameter meaning is already present. `?motion=static` locks the static illustration. Reduced-motion keeps parameter exploration and seeking but disables playback and moving packets. Print uses the current complete diagram.

## Export

The repository's `scripts/render-video.mjs` routes interactive HTML to its own composition, which loads the same artifact and drives `seek(frame/fps)`. This is distinct from CSS flow extraction. Export executes the local artifact's scripts; use authored/trusted input. The standalone installed skill does not require Remotion for HTML authoring.

```bash
node /absolute/repo/scripts/render-video.mjs explanation.html --format mp4 --out explanation.mp4
node /absolute/repo/scripts/render-interactive.mjs explanation.html --format png --frame 120 --out frame.png
```

Set exportWidth/exportHeight to fit the header, SVG and detail area; verify a late frame with the longest detail. Export only when requested or authorized as implementation validation. Scene timelines describe a finite tour; exported GIF looping is a format-level replay.

## Verification and extension

The packaged self-check routes this mode to `verify_interactive.py`, leaving existing flow/step contracts intact. It checks packaging and fallback structure, not numerical truth or visual quality. Test input boundaries, pause/resume, reset, reverse seeking, node actions, reduced motion, narrow screens and no-JS fallback. If video matters, compare matching browser/export frames.

For a subject the primitives cannot express clearly, extend a primitive or add a renderer intentionally, including its numerical encoding and tests. Do not silently distort the subject to fit this template. Full camera-controlled 3D is a separate renderer, not required for SVG layer stacks.
