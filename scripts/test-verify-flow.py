#!/usr/bin/env python3
"""Adversarial tests for `verify-flow.py`.

Each case mutates the canonical flow template so that exactly one rule should
fire, then asserts that it does. A verifier that silently stops enforcing a rule
is worse than no verifier, so every budget and invariant gets a mutation that
proves it is still wired up.

    python3 scripts/test-verify-flow.py
"""
from __future__ import annotations

import importlib.util
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "skills/diagram-design-fly/assets/template-flow.html"

spec = importlib.util.spec_from_file_location(
    "verify_flow", ROOT / "scripts/verify-flow.py"
)
assert spec and spec.loader
verify_flow = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify_flow)


def run(source: str) -> list[str]:
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "case.html"
        path.write_text(source, encoding="utf-8")
        return verify_flow.verify(path)


def expect_clean(source: str, label: str) -> None:
    errors = run(source)
    if errors:
        raise AssertionError(f"{label}: expected no findings, got {errors}")
    print(f"OK: {label}")


def expect_finding(source: str, needle: str, label: str) -> None:
    errors = run(source)
    if not any(needle in error for error in errors):
        raise AssertionError(
            f"{label}: expected a finding containing {needle!r}, got {errors}"
        )
    print(f"OK: {label}")


def main() -> int:
    canonical = TEMPLATE.read_text(encoding="utf-8")

    expect_clean(canonical, "canonical flow template passes")

    expect_clean(
        canonical.replace('data-motion-mode="flow"', 'data-motion-mode="step"'),
        "a non-flow document is left to verify-motion.py",
    )

    expect_finding(
        canonical.replace('data-flow-cycle="3.2"', 'data-flow-cycle="0.8"'),
        "data-flow-cycle must be",
        "a sub-second cycle is rejected",
    )
    expect_finding(
        canonical.replace('data-flow-cycle="3.2"', 'data-flow-cycle="12"'),
        "data-flow-cycle must be",
        "a twelve-second cycle is rejected",
    )

    # Seamlessness: 70 over a period of 14 is exactly five periods. 65 is not.
    expect_finding(
        canonical.replace("stroke-dashoffset: -70;", "stroke-dashoffset: -65;"),
        "the loop will visibly jump",
        "a travel that is not a whole number of dash periods is rejected",
    )

    # Regression: `@keyframes` names are global, so a document inlining two
    # diagrams wants them slug-prefixed exactly as its IDs are. An earlier
    # version of the check hardcoded the name and rejected the safer form,
    # which pushed a generating agent back onto the colliding one.
    prefixed = canonical.replace(
        "animation: flow-stream var(--flow-cycle)",
        "animation: demo-flow-stream var(--flow-cycle)",
    ).replace("@keyframes flow-stream {", "@keyframes demo-flow-stream {")
    expect_clean(prefixed, "a slug-prefixed keyframe name is accepted")
    expect_finding(
        prefixed.replace("stroke-dashoffset: -70;", "stroke-dashoffset: -65;"),
        "the loop will visibly jump",
        "seam arithmetic still applies to a slug-prefixed keyframe",
    )

    expect_finding(
        canonical.replace(
            '<path class="flow-stream" d="M200 166 H276"/>',
            '<path class="flow-stream" pathLength="1" d="M200 166 H276"/>',
        ),
        "conduits stay in user units",
        "a normalised conduit is rejected",
    )
    expect_finding(
        canonical.replace(
            '<path class="flow-token"                 pathLength="1" style="--token-gap:1" d="M200 166 H276"/>',
            '<path class="flow-token"                 style="--token-gap:1" d="M200 166 H276"/>',
        ),
        'needs pathLength="1"',
        "an unnormalised token is rejected",
    )

    expect_finding(
        canonical.replace("--flow-delay:-.6s", "--flow-delay:.6s"),
        "--flow-delay must be negative or zero",
        "a positive phase offset is rejected",
    )
    expect_finding(
        canonical.replace("--flow-delay:-.6s", "--flow-delay:-9s"),
        "exceeds the",
        "a phase offset larger than the cycle is rejected",
    )

    expect_finding(
        canonical.replace(
            '[data-motion-mode="flow"] .flow-stream {\n      animation:',
            '.flow-stream-unscoped, .flow-stream {\n      animation:',
        ),
        "not scoped to",
        "an unscoped infinite animation is rejected",
    )

    expect_finding(
        canonical.replace("</main>", "</main>\n  <script>void 0;</script>"),
        "flow mode is CSS-only",
        "a script in a flow document is rejected",
    )

    # The template carries two static-capture rules, so the mutation has to
    # remove both — replacing only the first leaves the check satisfied.
    expect_finding(
        canonical.replace('html[data-motion="static"]', '.disabled-static'),
        'html[data-motion="static"]',
        "a missing static-capture rule is rejected",
    )
    expect_finding(
        canonical.replace("prefers-reduced-motion", "prefers-nothing"),
        "prefers-reduced-motion",
        "a missing reduced-motion fallback is rejected",
    )

    expect_finding(
        canonical.replace("stroke-width: 11;", "stroke-width: 26;"),
        "stroke-width must be",
        "an oversized token is rejected",
    )

    # Budget: clone one conduit past the eight-connector ceiling.
    extra = '<path class="flow-stream" d="M200 166 H276"/>'
    expect_finding(
        canonical.replace(extra, extra + ("\n        " + extra) * 8, 1),
        "animated connector budget",
        "exceeding the connector budget is rejected",
    )

    # Containment: move a token out of the decorative group.
    token = '<path class="flow-token"                 pathLength="1" style="--token-gap:1" d="M200 166 H276"/>'
    expect_finding(
        canonical.replace(token, "").replace("</svg>", token + "\n      </svg>"),
        "data-motion-decorative",
        "a token outside the decorative group is rejected",
    )

    # Found by dogfooding: a generating agent laid stages 12px apart and made
    # the conduits 12px stubs. Every other check passed — the figure was valid
    # and the motion was invisible.
    expect_finding(
        canonical.replace(
            '<path class="flow-stream" d="M200 166 H276"/>',
            '<path class="flow-stream" d="M200 166 H212"/>',
        ),
        "user units end to end",
        "a conduit too short to watch anything travel along is rejected",
    )
    expect_clean(
        canonical.replace(
            '<path class="flow-stream" d="M592 212 V300"/>',
            '<path class="flow-stream" d="M592 212 V276"/>',
        ),
        "a 64-unit conduit is exactly at the floor and accepted",
    )

    # ---- optional stage numbers -----------------------------------------
    # The feature is opt-in, so the canonical template must stay clean with the
    # rules present, and every failure mode has to fire on its own.
    def sequenced(count=3, seqs=None, decorative=False):
        seqs = seqs or list(range(1, count + 1))
        badges = "".join(
            f'<g class="flow-seq" data-seq="{n}"><circle cx="{100 + 40 * i}" cy="60" r="13"/>'
            f'<text x="{100 + 40 * i}" y="60">{n}</text></g>'
            for i, n in enumerate(seqs)
        )
        source = canonical.replace(
            'data-flow-cycle="3.2"', f'data-flow-cycle="3.2" data-flow-sequence="{count}"'
        )
        if decorative:
            # slip them into the decorative group instead of the base layer
            return source.replace(
                '<g data-motion-decorative aria-hidden="true" focusable="false">',
                '<g data-motion-decorative aria-hidden="true" focusable="false">' + badges,
            )
        return source.replace("</svg>", badges + "</svg>")

    expect_clean(sequenced(), "a correctly numbered flow diagram is accepted")
    expect_finding(
        sequenced(count=3, seqs=[1, 2]),
        "carries 2 .flow-seq badges",
        "a badge count that disagrees with the declaration is rejected",
    )
    expect_finding(
        sequenced(count=3, seqs=[1, 2, 4]),
        "must be contiguous",
        "a gap in the stage numbers is rejected",
    )
    expect_finding(
        sequenced(count=3, seqs=[1, 2, 2]),
        "must be contiguous",
        "a repeated stage number is rejected",
    )
    expect_finding(
        sequenced(decorative=True),
        "must survive the static frame",
        "a stage badge hidden in the decorative layer is rejected",
    )
    expect_finding(
        canonical.replace(
            "</svg>",
            '<g class="flow-seq" data-seq="1"><circle cx="100" cy="60" r="13"/>'
            '<text x="100" y="60">1</text></g></svg>',
        ),
        "no data-flow-sequence on the motion root",
        "badges without a declaration are rejected",
    )
    expect_finding(
        sequenced(count=12, seqs=list(range(1, 13))),
        "data-flow-sequence must be",
        "numbering more stages than a diagram should carry is rejected",
    )

    expect_finding(
        sequenced().replace('<g class="flow-seq" data-seq="1">',
                            '<g class="flow-seq" data-seq="1" aria-hidden="true">'),
        "is aria-hidden",
        "a stage badge hidden from assistive technology is rejected",
    )

    print("All flow contract tests passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
