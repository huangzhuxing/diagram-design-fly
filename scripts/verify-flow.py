#!/usr/bin/env python3
"""Verify the `flow` motion contract.

`verify-motion.py` owns the rules every motion mode shares — declared mode,
script-free continuous modes, infinite animation scoped to the mode that
declares it. This script owns what is specific to `flow`: the budgets, the
phase discipline, the normalisation split between tokens and conduits, and the
arithmetic that makes the loop seamless.

    python3 scripts/verify-flow.py path/to/diagram.html [more.html ...]
    python3 scripts/verify-flow.py            # every flow asset in the skill

Exits non-zero on the first file with findings.
"""
from __future__ import annotations

import math
import re
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSET_DIR = ROOT / "skills/diagram-design-fly/assets"

MAX_CONNECTORS = 8
MAX_TOKENS = 16
MAX_TOKENS_PER_CONNECTOR = 3
MAX_DELAYS = 8
CYCLE_RANGE = (2.5, 6.0)
TOKEN_WIDTH_RANGE = (8.0, 14.0)

MIN_CONDUIT_SPAN = 64.0
SEQUENCE_RANGE = (2, 9)

DELAY_RE = re.compile(r"--flow-delay\s*:\s*(-?[\d.]+)s")
WIDTH_RE = re.compile(r"stroke-width\s*:\s*([\d.]+)")
NUMBER_RE = re.compile(r"-?\d+\.?\d*")
COMMAND_RE = re.compile(r"([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)")

# Numbers per command, and where the endpoint sits inside them. `H` and `V`
# carry a single coordinate and leave the other axis alone, which is why the
# endpoint cannot simply be read off the last two numbers of the whole path.
_SEGMENTS = {
    "M": 2, "L": 2, "T": 2,
    "H": 1, "V": 1,
    "C": 6, "S": 4, "Q": 4,
    "A": 7,
}


def path_span(d: str) -> float | None:
    """Straight-line distance from a path's first point to its last.

    A deliberate under-estimate: a curve is at least as long as its chord, so
    anything this rejects really is too short to watch something travel along.
    """
    start: tuple[float, float] | None = None
    x = y = 0.0
    for command, raw in COMMAND_RE.findall(d):
        upper = command.upper()
        if upper == "Z":
            continue
        size = _SEGMENTS.get(upper)
        if size is None:
            return None
        numbers = [float(n) for n in NUMBER_RE.findall(raw)]
        if not numbers or len(numbers) % size:
            return None
        relative = command.islower()
        # A command may repeat its argument set; walk every repetition.
        for offset in range(0, len(numbers), size):
            args = numbers[offset : offset + size]
            if upper == "H":
                x = x + args[0] if relative else args[0]
            elif upper == "V":
                y = y + args[0] if relative else args[0]
            else:
                dx, dy = args[-2], args[-1]
                x, y = (x + dx, y + dy) if relative else (dx, dy)
            if start is None:
                start = (x, y)
    if start is None:
        return None
    return math.hypot(x - start[0], y - start[1])


class FlowParser(HTMLParser):
    """Collect the motion root and every element carrying a flow class."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root: dict[str, str] | None = None
        self.streams: list[dict[str, str]] = []
        self.tokens: list[dict[str, str]] = []
        self.pulses: list[dict[str, str]] = []
        self.sequence: list[dict[str, str]] = []
        self.scripts = 0
        self._decorative_depth = 0
        self._depth = 0
        # Elements seen while inside a `data-motion-decorative` subtree.
        self._inside_decorative: list[int] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {key: (value or "") for key, value in attrs}
        self._depth += 1
        if tag == "script":
            self.scripts += 1
        if self.root is None and "data-motion-root" in attributes:
            self.root = attributes
        if "data-motion-decorative" in attributes:
            self._inside_decorative.append(self._depth)

        classes = attributes.get("class", "").split()
        record = dict(attributes)
        record["_decorative"] = "true" if self._inside_decorative else "false"
        if "flow-stream" in classes:
            self.streams.append(record)
        if "flow-token" in classes:
            self.tokens.append(record)
        if "flow-pulse" in classes:
            self.pulses.append(record)
        if "flow-seq" in classes:
            self.sequence.append(record)

    def handle_endtag(self, tag: str) -> None:
        if self._inside_decorative and self._inside_decorative[-1] == self._depth:
            self._inside_decorative.pop()
        self._depth = max(0, self._depth - 1)


def dash_arithmetic(css: str) -> list[str]:
    """The seam is invisible only when travel is a whole number of periods.

    A conduit with `stroke-dasharray: 5 9` has a period of 14, so its keyframe
    must move a multiple of 14. Anything else steps visibly once per cycle —
    the one flow defect that reads as a rendering bug rather than a choice.

    The keyframe name is resolved from the animation declaration rather than
    assumed. `@keyframes` names are global, so a document that inlines two
    diagrams needs them slug-prefixed for the same reason their IDs are; an
    earlier version of this check hardcoded `flow-stream` and so pushed authors
    toward the colliding name.
    """
    findings: list[str] = []

    dash = re.search(
        r"\.flow-stream\s*\{[^}]*stroke-dasharray\s*:\s*([\d.]+)\s+([\d.]+)", css
    )
    if not dash:
        findings.append(".flow-stream must declare a two-value stroke-dasharray")
        return findings

    animation = re.search(
        r"\.flow-stream\s*\{[^}]*animation\s*:\s*([A-Za-z_-][\w-]*)", css
    )
    if not animation:
        findings.append(".flow-stream must declare an animation naming its keyframes")
        return findings
    name = animation.group(1)

    travel = re.search(
        r"@keyframes\s+" + re.escape(name) + r"\s*\{[^}]*stroke-dashoffset\s*:\s*(-?[\d.]+)",
        css,
    )
    if not travel:
        findings.append(
            f"@keyframes {name} must animate stroke-dashoffset "
            "(the name comes from the .flow-stream animation declaration)"
        )
        return findings

    period = float(dash.group(1)) + float(dash.group(2))
    distance = abs(float(travel.group(1)))
    if period <= 0:
        findings.append("flow-stream dash period must be positive")
    elif abs(distance / period - round(distance / period)) > 1e-6:
        findings.append(
            f"@keyframes {name} travels {distance} over a dash period of {period} "
            f"({distance / period:.3f} periods); the loop will visibly jump. "
            f"Use a whole multiple, e.g. {round(distance / period) * period:g}."
        )
    return findings


def verify(path: Path) -> list[str]:
    source = path.read_text(encoding="utf-8")
    parser = FlowParser()
    parser.feed(source)

    if parser.root is None:
        return ["no data-motion-root found"]
    if parser.root.get("data-motion-mode") != "flow":
        return []  # Not a flow diagram; verify-motion.py covers it.

    errors: list[str] = []
    css = "\n".join(re.findall(r"<style[^>]*>(.*?)</style>", source, re.DOTALL))

    # --- cycle -------------------------------------------------------------
    raw_cycle = parser.root.get("data-flow-cycle", "")
    try:
        cycle = float(raw_cycle)
    except ValueError:
        errors.append("data-flow-cycle must be a number of seconds")
        cycle = 0.0
    else:
        low, high = CYCLE_RANGE
        if not low <= cycle <= high:
            errors.append(
                f"data-flow-cycle must be {low}s..{high}s; got {cycle}s "
                "(below nags, above reads as stalled)"
            )

    # --- budgets -----------------------------------------------------------
    if len(parser.streams) > MAX_CONNECTORS:
        errors.append(
            f"animated connector budget is {MAX_CONNECTORS}; found {len(parser.streams)}"
        )
    if len(parser.tokens) > MAX_TOKENS:
        errors.append(f"token budget is {MAX_TOKENS}; found {len(parser.tokens)}")

    per_path = Counter(token.get("d", "") for token in parser.tokens)
    crowded = {d[:36]: n for d, n in per_path.items() if n > MAX_TOKENS_PER_CONNECTOR}
    if crowded:
        errors.append(
            f"at most {MAX_TOKENS_PER_CONNECTOR} tokens may share one path; found {crowded}"
        )

    # --- conduit length ----------------------------------------------------
    # Flow exists so a reader can watch material cross an edge. On a stub of a
    # connector there is nothing to watch: the dashes and the token occupy the
    # whole path at once and the motion reads as a flicker. This is not a style
    # preference — it is the difference between the mode working and not.
    for index, stream in enumerate(parser.streams, 1):
        span = path_span(stream.get("d", ""))
        if span is None:
            errors.append(f"conduit {index} has an unreadable d attribute")
        elif span < MIN_CONDUIT_SPAN:
            errors.append(
                f"conduit {index} spans {span:.0f} user units end to end; "
                f"flow needs at least {MIN_CONDUIT_SPAN}. Move the nodes apart "
                "rather than shortening the travel."
            )

    # --- normalisation split ----------------------------------------------
    # HTMLParser lowercases attribute names, so the SVG camelCase `pathLength`
    # arrives here as `pathlength`.
    for index, stream in enumerate(parser.streams, 1):
        if "pathlength" in stream:
            errors.append(
                f"conduit {index} declares pathLength; conduits stay in user units "
                "so dash size is consistent across connectors"
            )
    for index, token in enumerate(parser.tokens, 1):
        if token.get("pathlength") != "1":
            errors.append(
                f"token {index} needs pathLength=\"1\" so one crossing takes one "
                "cycle regardless of connector length"
            )

    # --- decorative containment -------------------------------------------
    for name, group in (("conduit", parser.streams), ("token", parser.tokens), ("pulse", parser.pulses)):
        for index, element in enumerate(group, 1):
            if element.get("_decorative") != "true":
                errors.append(
                    f"{name} {index} must sit inside a data-motion-decorative group"
                )

    # --- phase -------------------------------------------------------------
    delays: list[float] = []
    for element in parser.streams + parser.tokens + parser.pulses:
        match = DELAY_RE.search(element.get("style", ""))
        delays.append(float(match.group(1)) if match else 0.0)
    positive = [value for value in delays if value > 0]
    if positive:
        errors.append(
            f"--flow-delay must be negative or zero; found {sorted(set(positive))} "
            "(a positive delay leaves the edge inert for its first cycle)"
        )
    if cycle and any(abs(value) > cycle for value in delays):
        errors.append(
            f"--flow-delay magnitude exceeds the {cycle}s cycle; "
            "phase offsets should stay within one cycle"
        )
    distinct = {abs(value) for value in delays}
    if len(distinct) > MAX_DELAYS:
        errors.append(
            f"distinct phase offsets budget is {MAX_DELAYS}; found {len(distinct)}"
        )

    # --- optional stage numbers -------------------------------------------
    # Opt-in, and all-or-nothing: a diagram either declares how many stages it
    # numbers and carries exactly that many badges, or carries none. Half a
    # numbering is worse than none, because a reader trusts the first number
    # they see and then looks for the rest.
    raw_sequence = parser.root.get("data-flow-sequence", "")
    if raw_sequence:
        low, high = SEQUENCE_RANGE
        try:
            declared = int(raw_sequence)
        except ValueError:
            errors.append("data-flow-sequence must be an integer stage count")
        else:
            if not low <= declared <= high:
                errors.append(
                    f"data-flow-sequence must be {low}..{high}; got {declared}. "
                    "More stages than that is a reading list, not a diagram."
                )
            if len(parser.sequence) != declared:
                errors.append(
                    f"data-flow-sequence declares {declared} stages but the diagram "
                    f"carries {len(parser.sequence)} .flow-seq badges"
                )
            seen = []
            for index, badge in enumerate(parser.sequence, 1):
                raw = badge.get("data-seq", "")
                if not raw.isdigit():
                    errors.append(f"stage badge {index} needs a numeric data-seq")
                else:
                    seen.append(int(raw))
            if seen and sorted(seen) != list(range(1, len(seen) + 1)):
                errors.append(
                    f"stage numbers must be contiguous 1..{len(seen)}; got {sorted(seen)}"
                )
        # A number is meaning, so it cannot live in the layer that print,
        # reduced motion, and static capture all delete.
        for index, badge in enumerate(parser.sequence, 1):
            if badge.get("_decorative") == "true":
                errors.append(
                    f"stage badge {index} sits inside data-motion-decorative; "
                    "numbers must survive the static frame"
                )
            if badge.get("aria-hidden") == "true":
                errors.append(
                    f"stage badge {index} is aria-hidden; the number is meaning, "
                    "not decoration, so it has to reach assistive technology"
                )
    elif parser.sequence:
        errors.append(
            f"found {len(parser.sequence)} .flow-seq badges but no "
            "data-flow-sequence on the motion root"
        )

    # --- token weight ------------------------------------------------------
    base_width = re.search(r"\.flow-token\s*\{[^}]*stroke-width\s*:\s*([\d.]+)", css)
    low, high = TOKEN_WIDTH_RANGE
    if base_width and not low <= float(base_width.group(1)) <= high:
        errors.append(
            f".flow-token stroke-width must be {low}..{high}; got {base_width.group(1)}"
        )

    # --- scope and script --------------------------------------------------
    for selector in ("flow-stream", "flow-token", "flow-pulse"):
        animated = re.search(
            r"([^{}]*\." + selector + r")\s*\{[^}]*animation\s*:", css
        )
        if animated and 'data-motion-mode="flow"' not in animated.group(1):
            errors.append(
                f".{selector} animation is not scoped to [data-motion-mode=\"flow\"]"
            )
    if parser.scripts:
        errors.append("flow mode is CSS-only; found a <script>")

    # --- static fallback ---------------------------------------------------
    if 'html[data-motion="static"]' not in css:
        errors.append(
            'flow documents need an html[data-motion="static"] rule; it is what '
            "PNG and video capture switch on"
        )
    if "prefers-reduced-motion" not in css:
        errors.append("flow documents need a prefers-reduced-motion fallback")

    errors.extend(dash_arithmetic(css))
    return errors


def targets(argv: list[str]) -> list[Path]:
    if argv:
        return [Path(arg) for arg in argv]
    return sorted(
        path
        for path in ASSET_DIR.glob("*.html")
        if 'data-motion-mode="flow"' in path.read_text(encoding="utf-8")
    )


def main(argv: list[str]) -> int:
    paths = targets(argv)
    if not paths:
        print("verify-flow: no flow diagrams found")
        return 0
    failed = 0
    for path in paths:
        errors = verify(path)
        if errors:
            failed += 1
            print(f"FAIL {path}")
            for error in errors:
                print(f"  - {error}")
        else:
            print(f"OK {path}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
