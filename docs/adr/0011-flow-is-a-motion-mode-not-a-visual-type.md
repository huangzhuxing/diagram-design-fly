# ADR 0011 — `flow` is a motion mode, and the byte cap moves to 42,000

**Status:** accepted (fork, v2.7)

## Context

Continuous movement — material through a pipeline, requests over a boundary, a
cycle turning — had no home. `animation.md` covers ordered change that finishes
(`reveal`, `step`) and offers `loop` as a single decorative token, capped at one
item as a "quiet flow hint". A diagram whose *subject* is throughput needs more
than one token, and needs it on more than one edge.

Two shapes were possible: a new visual type, or a new motion mode.

Separately, this fork adds video export. Once a diagram's motion is continuous
and script-free, rendering it to MP4/WebM/GIF is a mechanical step rather than a
new authoring surface, so the two land together.

## Decision

**`flow` is a motion mode, not a visual type.** ADR 0002 fixes the taxonomy at a
count that moves only for a genuinely new *layout grammar*. Flow introduces no
layout: an architecture diagram, a data-flow diagram, and a loop diagram are all
still themselves when material is moving through them. It changes what the edges
*do*, which is the definition of a presentation layer.

Consequently it costs one `references/flow.md`, one `assets/template-flow.html`,
and routing rows — not a type reference, three example variants, a gallery tab,
and a budget row. `verify-docs-sync.py`'s type count does not move.

**`flow` is CSS-only.** No script, no controller, no playback UI. This is not an
economy; it is what makes the mode exportable. ADR 0001 pins exactly one
reviewed controller, and `lint-skin.py` enforces that by digest. A flow diagram
never trips that check because it contains no controller at all, and the video
renderer needs no JavaScript runtime — it replays the authored stylesheet with
the clock frozen per frame.

**Infinite animation stays scoped to the mode that declares it.** The existing
rule required `[data-motion-mode="loop"]`; it now accepts `flow` as well, and
still rejects an unscoped one. The invariant is unchanged: endless motion may
only run where a mode declares it, so a flow rule pasted into a stepped diagram
is inert.

**`flow` must not declare `data-step-count`.** Continuous motion has no ordered
sequence to number. A step count would imply a controller and a narrative that
do not exist, so the attribute is rejected rather than ignored.

**`MAX_SKILL_BYTES` moves from 40,000 to 42,000**, amending ADR 0004 rule 2.
ADR 0004's rule 1 is untouched and still binds: routing surface is never traded
for body prose.

The cap exists because `SKILL.md` loads on every invocation, so growth must be
honest — not because 40,000 is a physical limit; ADR 0004 records it as a
reviewed number already raised once. `SKILL.md` sat at 39,989 bytes, eleven
under, which made the cap a freeze rather than a budget: no capability could be
added without deleting an existing one.

Routing a whole new mode costs about 1,000 bytes, and every one of them is a
discoverability hook — the `§3` selection sentence, the primitive index entry,
the budget row, the template list, and the export section. An agent that cannot
route to `flow.md` will never load it, which would make the mode ship dead.
Trimming §6's SVG primitives to fit would pay for a new capability by degrading
an existing one.

2,000 bytes is 5% for a mode plus an export path, and it restores headroom
rather than consuming it.

## Consequences

- `verify-motion.py` gains `flow` in `MODES`, `CONTINUOUS_MODES`, and
  `SCRIPT_FREE_MODES`. `verify-flow.py` owns the flow-specific budgets, the
  phase discipline, and the dash arithmetic that makes the loop seamless.
- `docs/motion/` holds committed, regenerable artifacts —
  `scripts/render-motion-assets.mjs --check` reports any that are stale.
- `remotion/` is an optional dependency. Authoring a flow diagram needs nothing
  installed; only video export does.
- The next capability faces a real budget again. When `SKILL.md` next approaches
  42,000, ADR 0004 rule 2 applies as written: cut body prose or move detail into
  `references/`, never the description.
