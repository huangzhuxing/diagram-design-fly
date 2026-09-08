#!/usr/bin/env python3
"""Measure rendered text contrast against WCAG AA.

The contract verifiers read markup, and `lint-render.py` reads geometry. Neither
can see that a label came out invisible — a `.cardtitle` rule that sets a font
size but forgets `fill` inherits something pale, passes every other gate, and
ships a card whose text a reader cannot make out.

So the browser is the oracle here too: render the page, then for every `<text>`
take its computed fill, then hide every label and shoot the page again so each
one's own centre reveals the background it actually sits on. Measuring against
a single assumed page colour instead would report white-on-accent as a failure
and miss white-on-paper entirely — the two have the same fill and opposite
legibility.

    python3 scripts/lint-contrast.py path/to/diagram.html [more.html ...]
    python3 scripts/lint-contrast.py --all
    python3 scripts/lint-contrast.py --all --aa      # strict WCAG audit

The default floor is 1.8:1, which is not a WCAG threshold and is not meant to
be one. Measuring the whole corpus puts the ratios in two clean groups with an
empty band between them: 152 labels below 1.5:1, nothing at all between 1.5 and
2.0, then several hundred between 2.5 and 4.5. That upper group is the design
system working as designed — muted and accent tokens on paper sit at 2.86:1 and
3.3:1 by choice. Failing them would be relitigating the palette, and a gate that
reports 787 findings is a gate nobody reads.

So the default catches the other group: text a reader cannot see at all, which
is a bug every time. `--aa` applies the real AA thresholds instead, for anyone
auditing rather than gating.
"""
from __future__ import annotations

import io
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSET_DIR = ROOT / "skills/diagram-design-fly/assets"
BASELINE = ROOT / "scripts/lint-contrast-baseline.txt"

AA_BODY = 4.5
AA_LARGE = 3.0
# Set inside the empty band the corpus leaves between "invisible" and "muted".
INVISIBLE = 1.8


def _channel(value: float) -> float:
    v = value / 255
    return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4


def luminance(rgb: tuple[float, float, float]) -> float:
    r, g, b = (_channel(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def parse_colour(value: str) -> tuple[float, float, float] | None:
    numbers = re.findall(r"[\d.]+", value or "")
    if len(numbers) < 3:
        return None
    if len(numbers) >= 4 and float(numbers[3]) < 0.5:
        return None  # mostly transparent; the fill is not what the reader sees
    return tuple(float(n) for n in numbers[:3])  # type: ignore[return-value]


def verify(path: Path, page, Image, strict: bool = False) -> list[str]:
    page.goto(path.resolve().as_uri())
    page.evaluate("document.fonts.ready")

    items = page.evaluate(
        """() => [...document.querySelectorAll('svg text')].map(t => {
            const r = t.getBoundingClientRect();
            const s = getComputedStyle(t);
            return {
              fill: s.fill, size: parseFloat(s.fontSize) || 0,
              weight: parseInt(s.fontWeight, 10) || 400,
              x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height,
              text: (t.textContent || '').trim().slice(0, 28),
            };
        }).filter(o => o.w > 1 && o.h > 1)"""
    )

    # Hide every label and shoot once. Each text's own centre in that frame is
    # exactly what it sits on — no guessing.
    #
    # Sampling the corners of the text box instead looks cheaper and is wrong:
    # an 11px number centred in a 26px badge has corners that fall outside the
    # badge onto the page, so the check compares the number against the wrong
    # colour and reports a failure that is not there.
    page.add_style_tag(content="svg text { visibility: hidden !important; }")
    plate = Image.open(io.BytesIO(page.screenshot(full_page=True))).convert("RGB")

    findings: list[str] = []
    for item in items:
        fill = parse_colour(item["fill"])
        if fill is None:
            continue

        cx = int(item["x"] + item["w"] / 2)
        cy = int(item["y"] + item["h"] / 2)
        if not (0 <= cx < plate.width and 0 <= cy < plate.height):
            continue
        background = plate.getpixel((cx, cy))

        if strict:
            large = item["size"] >= 18 or (item["size"] >= 14 and item["weight"] >= 600)
            floor = AA_LARGE if large else AA_BODY
        else:
            floor = INVISIBLE
        measured = ratio(fill, background)  # type: ignore[arg-type]
        if measured < floor:
            findings.append(
                f"{path.name}: {measured:.2f}:1 (needs {floor}) — "
                f"{item['text']!r} at {item['size']:.0f}px on rgb{background}"
            )
    return findings


def load_baseline() -> set[str]:
    """Files carrying findings that predate this gate.

    Same convention as `lint-skin-baseline.txt`: a documented skip list, so the
    gate goes green on the corpus as it stands and still fails on anything new.
    Fixing a listed file means deleting its line, not editing the threshold.
    """
    if not BASELINE.exists():
        return set()
    return {
        line.strip()
        for line in BASELINE.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    }


def targets(argv: list[str]) -> list[Path]:
    if "--all" in argv:
        paths = sorted(ASSET_DIR.glob("*.html"))
        if "--baseline" in argv:
            skip = load_baseline()
            paths = [p for p in paths if p.name not in skip]
        return paths
    return [Path(a) for a in argv if not a.startswith("--")]


def main(argv: list[str]) -> int:
    paths = targets(argv)
    if not paths:
        print("lint-contrast: pass files or --all")
        return 2
    try:
        from PIL import Image
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(
            "lint-contrast: needs Playwright and Pillow.\n"
            '  python3 -m pip install "Pillow==12.1.1" playwright\n'
            "  python3 -m playwright install chromium"
        )
        return 2

    strict = "--aa" in argv
    findings: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1600, "height": 1000})
        for path in paths:
            findings.extend(verify(path, page, Image, strict))
        browser.close()

    for finding in findings:
        print(finding)
    print(
        f"Summary: {len(paths)} file(s) checked, {len(findings)} finding(s)."
    )
    return 1 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
