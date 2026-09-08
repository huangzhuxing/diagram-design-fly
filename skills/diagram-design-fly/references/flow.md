# Continuous flow

`flow` is the mode for movement that has no beginning and no end: material
travelling through a pipeline, requests crossing a boundary, a queue draining,
a cycle turning. It answers "what moves, and which way" — never "what happened,
and in what order." That question belongs to [`animation.md`](animation.md)'s
`step` and `reveal` modes, which narrate a sequence and finish.

Load this reference when a diagram's edges carry *throughput* and the reader
would learn something from seeing direction and rate. If the edges only carry
*structure*, ship the static diagram — an arrowhead already says which way.

## Which of the 39 types want flow

The question is not what kind of diagram it is. It is **whether the figure
carries an order the reader is meant to travel**.

If it does, flow shows the direction and stage numbers show where to start, and
the two together answer "what happens, and in what order" without a controller.
If it does not, motion is decoration and numbering invents a sequence the
subject does not have — both are anti-patterns.

**Ordered — flow, and turn `data-flow-sequence` on:**

`architecture` · `data-flow` · `deployment` · `dp-integration` · `flowchart` ·
`gantt` · `high-level` · `journey` · `kanban` · `loop` · `medallion` ·
`process` · `sequence` · `state` · `story-map` · `swimlane` · `timeline`

These have stages a reader walks: a pipeline, a lifecycle, a cycle, a plan
across time, work crossing columns, a quantity splitting downstream.

**Directional, but not stepped — flow sometimes, numbers rarely:**

`dependency` · `fishbone` · `it-state` · `layers` · `nested` · `org-chart` ·
`pyramid` · `tree` · `wardley`

These have a direction — down the tree, up the stack, in toward the effect —
but no canonical first step. Animate the spine if propagation is the point;
leave the numbers off, because there is no stage 1 to name.

**Unordered — no flow:**

`bar` · `db-schema` · `er` · `line` · `polar` · `quadrant` · `radar` ·
`scatter` · `treemap` · `uml-class` · `venn` · `dp-security-matrix`

Comparison, distribution, and static structure. Nothing moves through an ER
diagram, and a bar chart's categories have no order to travel. Motion here is
decoration, which [the philosophy in `SKILL.md`](../SKILL.md) already rules out.

### `sankey` is ordered and still cannot take flow

Quantity splitting downstream is the clearest ordering there is, so Sankey
belongs in the first list on meaning — and it is excluded anyway, because its
own contract forbids what flow needs.

`verify-sankey.py` checks that every band's width equals the value it is
labelled with, reading the geometry straight from the attributes. For that proof
to hold it rejects **any stylesheet rule that reaches the figure** and could
repaint or move it — and flow's `animation` declarations are exactly that. It
also requires the light, dark, and full variants to be one figure in three
skins, which a fourth variant carrying different data breaks.

Neither rule is worth weakening: they are what make a Sankey's widths
trustworthy. The lesson generalises — **a type's own verifier outranks this
routing table.** Where a type earns its correctness from static geometry,
motion is not available to it, however ordered its subject.

### Flow is the default here, not an upgrade

Upstream ships static and treats motion as something the user asks for. **This
fork inverts that for ordered types**: if the subject carries an order, build it
in `flow` with `data-flow-sequence` on, without waiting to be asked.

That is safe precisely because of the contract above. A flow diagram *is* a
complete static diagram with a decorative layer over it — print, reduced motion,
`?motion=static`, and PNG export all resolve to the same frame a static build
would have produced. Defaulting to flow adds a layer; it never removes one.

Two things still hold:

- **Unordered types stay static.** Nothing moves through an ER diagram. The
  default is per-subject, not per-repo.
- **A type's own verifier outranks this.** See the Sankey case above.

After shipping a flow diagram, tell the user it renders to video and give them
the one line — but do not run it. Export stays manual, the same rule PNG and SVG
follow:

```bash
node scripts/render-video.mjs <file>.html --format gif
```

## What separates it from `loop`

`loop` in `animation.md` is a single decorative token as a quiet hint, capped at
one item, deliberately minimal. `flow` is the mode for a whole diagram whose
subject *is* movement: every connector may carry motion, and the composition is
designed around it.

Both are continuous, script-free, and CSS-only. Nothing in either mode may
encode meaning that the static frame does not already carry.

| | `loop` | `flow` |
|---|---|---|
| Animated connectors | 1 | up to 8 |
| Tokens | 1 | up to 3 per connector, 16 total |
| Declares `data-step-count` | yes (`0`) | **no** — it is rejected |
| JavaScript | none | none |
| Playback controls | none | none |

## One mechanism

Everything is an animated `stroke-dashoffset`. There is no `offset-path`, no
`<animateMotion>`, no per-frame JavaScript, and no measured geometry.

```css
/* Conduit — dashes crawling inside the pipe. */
.flow-stream { stroke-dasharray: 5 9; }              /* period 14 */
@keyframes flow-stream { to { stroke-dashoffset: -70; } }   /* 5 periods */

/* Token — a zero-length dash with a round cap is a dot. */
.flow-token  { stroke-dasharray: 0 var(--token-gap, 1); stroke-linecap: round; }
@keyframes flow-token { to { stroke-dashoffset: 0; } }
```

Two consequences follow, and both are load-bearing:

1. **It follows any path.** Straight segments, orthogonal routes, and long
   beziers all animate from the same declaration, because the dash travels
   along the path's own length. Corners need no special case.
2. **The loop is seamless when the travelled distance is a whole number of dash
   periods.** `-70` over a period of `14` is exactly five. Break that and the
   cycle visibly jumps.

### Prefix the keyframe names

`@keyframes` names are global. A page that inlines two flow diagrams with
different cycles would have one silently overwrite the other, which is the same
hazard the slug-prefixed `<title>` / `<desc>` IDs already guard against. Prefix
them with the file slug:

```css
[data-motion-mode="flow"] .flow-stream { animation: my-diagram-flow-stream …; }
@keyframes my-diagram-flow-stream { to { stroke-dashoffset: -70; } }
```

`verify-flow.py` reads the name off the animation declaration, so any name works
as long as the two agree.

### Normalise tokens, not conduits

Tokens carry `pathLength="1"`; conduits must not.

A token means "one payload crossing this edge," so it should take one cycle to
cross whether the edge is 76px or 900px — normalising the path makes the
duration independent of the geometry. `--token-gap: 1` puts one dot on the
path, `.5` puts two, `.3334` puts three.

A conduit means "material is moving in here," so its dashes must stay the same
*size* everywhere. Normalising it would cut a short connector into the same
number of dashes as a long bezier: fine stipple on one, long strokes on the
other, one diagram, two rhythms. Leave conduits in user units.

### Give the conduit room

A conduit must span at least **64 user units** end to end, and 100+ reads far
better. Flow exists so a reader can watch material cross an edge; on a stub
there is nothing to watch — the dashes and the token cover the whole path at
once and the motion reads as a flicker.

This constrains layout, not just the flow layer: if two stages end up 12px
apart, move the nodes, do not shorten the travel. A diagram whose stages cannot
be spaced that far apart is one where the edges carry no throughput, which
means it should not be in `flow` mode at all.

`verify-flow.py` measures the chord from a path's first point to its last, so
the number it reports is a lower bound on the real length.

## Optional: stage numbers

Off by default. Turn them on when a reader would otherwise have to guess which
end of the diagram to start at — a linear pipeline with a fold, a ring, a
fan-out where the branches are not obviously parallel.

**One `<g>` per stage**, each carrying its own `data-seq`. `flow-seq` names the
badge, not a container — a single group wrapped around all of them is the
mistake to avoid, and so is `aria-hidden`, because the number is meaning:

```html
<main data-motion-root data-motion-mode="flow" data-flow-cycle="3.6"
      data-flow-sequence="4">
  …
  <g class="flow-seq" data-seq="1">
    <circle cx="106" cy="80" r="13"/><text x="106" y="80">1</text>
  </g>
  <g class="flow-seq" data-seq="2">
    <circle cx="362" cy="80" r="13"/><text x="362" y="80">2</text>
  </g>
  <!-- …one more for 3 and 4 -->
```

```html
<!-- wrong: one container, no per-stage data-seq, hidden from readers -->
<g class="flow-seq" aria-hidden="true"> …every badge… </g>
```

The badge sits in the **base layer**, beside the nodes — never inside
`data-motion-decorative`. A number carries meaning, and the decorative layer is
exactly what print, reduced motion, and static capture delete.

### They are reading order, not elapsed time

This is the distinction that decides whether the option belongs at all.

`flow` has no beginning: material is in every stage at once, and the diagram
looks the same at second 1 and second 100. A number here says *"start reading
here"* — the topology, not the clock.

If what you mean is *"first this happens, then that"* — a state actually
changing over time, one thing waiting on another — that is `step` mode in
[`animation.md`](animation.md). It has a controller, it finishes, and it can be
paused on any frame. Numbering a `flow` diagram does not turn it into one, and
using it to imply sequencing that the system does not have is the one way this
option makes a diagram less true.

### Rules

- **All or nothing.** Declare `data-flow-sequence="N"` and carry exactly N
  badges, or carry none. Half a numbering is worse than none: a reader trusts
  the first number and then hunts for the rest.
- **Contiguous from 1.** `data-seq` values must be `1..N` with no gaps and no
  repeats.
- **2 to 9 stages.** More than that is a reading list, not a diagram.
- **Base layer only**, as above.
- **Number the stages or the hand-offs, never both.** Both readings are valid;
  mixing them makes `3` ambiguous.

### Where to put them

On the node, or on the conduit — the verifier does not care, and each suits a
different diagram.

| Placement | Reads as | Fits |
|---|---|---|
| At a node's outward corner | "this is stage 3" | fan-outs, layered diagrams, anything where conduits outnumber stages |
| At a conduit's midpoint | "this is hand-off 3" | rings and linear chains, where each edge is one step |

On a conduit, put the badge **after** the `data-motion-decorative` group in
document order — still outside it, so it survives the static frame, but painted
last so travelling tokens cannot cross over the number. Give the circle a
paper-coloured stroke as well, so it lifts off the line it labels:

```css
.flow-seq circle { fill: var(--color-accent); stroke: var(--color-paper); stroke-width: 3; }
```

### Spacing a ring

Arcs cut at a constant angle from each node's *centre* look uneven, because an
axis-aligned box broadside to the ring subtends far more angle than the same box
seen edge-on — 42° against 28° for a 150-wide node at radius 280. The arcs come
out identical and the visible gaps do not: some tuck under a node, others float
away from it.

Measure each box's real angular footprint from its four corners and clear a
constant number of degrees from *that*. The arcs then differ in length, which is
correct — that is what equal gaps around unequal boxes requires.

`verify-flow.py` enforces every one of these.

### When to leave them off

- The order is already obvious — a left-to-right row with arrowheads.
- The diagram is a cycle whose entry point genuinely does not matter.
- The stages are parallel rather than sequential; numbering them invents an
  order the system does not have.
- The diagram already carries stage names that read in order (`COLLECT`,
  `CLEAN`, `STORE`). Numbers on top of that is saying it twice.

## Contract

1. **The static frame is the diagram.** Every node, label, connector, and
   arrowhead lives in the base layer. Deleting the entire flow layer must leave
   a complete, readable figure. Verified by rendering with `?motion=static`.
2. **The flow layer is decorative, wholly.** It sits in one
   `<g data-motion-decorative aria-hidden="true" focusable="false">`. It
   introduces no text, no unique colour meaning, and no element the base layer
   does not already account for.
3. **Animation is scoped to the mode.** Write
   `[data-motion-mode="flow"] .flow-stream { animation: … }`, never a bare
   `.flow-stream { animation: … }`. Unscoped infinite motion is rejected — the
   scope is what keeps a flow rule pasted into a stepped diagram inert.
4. **No script.** `flow` documents contain no `<script>`, no playback controls,
   and no live region. A capture tool sets `html[data-motion="static"]`; there
   is no controller to ask.
5. **One clock.** Every animation uses `var(--flow-cycle)`. Phase is expressed
   only as a negative `--flow-delay` on the element. Never give one element a
   different duration — differing rates read as differing speeds, which is
   meaning the static frame does not carry.
6. **Cycle between 2.5s and 6s.** Below 2.5s the motion nags; above 6s it reads
   as stalled. Declare it once, on the root, as `data-flow-cycle`.
7. **Reduced motion, print, and static all resolve identically** — the flow
   layer is `display: none` and every animation is off.

## Budgets

Flow does not raise the static diagram budget. It shares it.

| | Limit |
|---|---|
| Animated connectors | 8 |
| Tokens total | 16 |
| Tokens per connector | 3 |
| Distinct `--flow-delay` values | 8 |
| Cycle | 2.5s – 6s |
| Token stroke width | 8 – 14 |

Above these the figure stops reading as a system and starts reading as
decoration. If a diagram needs more, it is two diagrams.

## Phase

Give each connector a negative delay proportional to its position in the chain,
so a payload appears to hand off rather than every edge firing at once:

```html
<path class="flow-stream" d="…"/>
<path class="flow-stream" style="--flow-delay:-.5s" d="…"/>
<path class="flow-stream" style="--flow-delay:-1s"  d="…"/>
```

Negative, never positive. A positive delay leaves the element inert for its
first cycle, which reads as a broken edge on load.

Arrival pulses use the delay of the connector that feeds them, so the ring
fires as the token lands:

```html
<rect class="flow-pulse" style="--flow-delay:-.5s" …/>
```

## Authoring

Start from [`assets/template-flow.html`](../assets/template-flow.html). Replace
the diagram content and the slug-prefixed IDs; keep the CSS block intact. The
worked example is
[`assets/example-skill-architecture-flow.html`](../assets/example-skill-architecture-flow.html).

Then verify:

```bash
python3 scripts/verify-motion.py path/to/diagram.html   # mode, scope, script-free
python3 scripts/verify-flow.py  path/to/diagram.html    # flow budgets and phase
python3 scripts/lint-skin.py    path/to/diagram.html    # palette and typography
```

And in a browser:

1. Disable JavaScript — the diagram is unchanged. (Nothing here needs it.)
2. Emulate `prefers-reduced-motion: reduce` — the flow layer is gone and the
   figure is complete.
3. Set `html[data-motion="static"]` — same result, and it is what export uses.
4. Watch one full cycle twice — the seam is invisible.

## Video

A flow diagram renders to MP4, WebM, or GIF with no extra authoring; the export
reuses this stylesheet rather than reimplementing it. See
[`video-export.md`](video-export.md).

## Two traps that render silently

Both produce a diagram that passes every markup check and is wrong on screen.
`lint-contrast.py` catches them; nothing else does.

**`var()` does not work in an SVG presentation attribute.** This is invalid and
the browser discards it, leaving the element to inherit whatever an ancestor set
— often the paper colour, which paints the label invisible:

```html
<text fill="var(--color-accent)">…</text>   <!-- ignored -->
<text style="fill:var(--color-accent)">…</text>  <!-- works -->
```

The attribute form looks right, greps right, and reviews right. Only a rendered
measurement shows the text came out the colour of the page.

**SVG text inherits `fill`, not `color`.** A rule that sets a size and forgets
the fill does not fall back to the body colour:

```css
.card-title { font-size: 12px; font-weight: 600; }             /* invisible */
.card-title { fill: var(--color-ink); font-size: 12px; }       /* correct */
```

Give every class that styles an SVG `<text>` an explicit `fill`.

## Anti-patterns

- Motion that supplies meaning the static frame lacks — a direction the
  arrowheads do not show, a rate no label states.
- Conduits with `pathLength="1"`: dash size then depends on connector length,
  and the diagram loses one rhythm.
- A travelled distance that is not a whole number of dash periods; the seam
  shows on every cycle.
- Per-element durations standing in for speed. Speed is data; put it in a label.
- Tokens on every edge of a dense diagram. Animate the spine, not the fringe.
- Positive `--flow-delay`, which leaves an edge dead on first load.
- Using `flow` to narrate an ordered sequence. That is `step`.
