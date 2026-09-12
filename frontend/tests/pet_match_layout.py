"""Pet Match responsive layout + difficulty regression test.

Covers the long-standing scaling defects reviewed in the layout pass:

  - wide rail layout applies in embed AND standalone (previously embed-only)
  - short landscape frames get the rail layout instead of a crushed board
  - grid orientation transposes to match the play-box aspect
  - cards stay >= touch floor on the densest board (level 10, 6x6)
  - keyboard arrows follow the RENDERED grid (transposed cols)
  - board never overflows its wrap
  - level table is strictly increasing in pairs (no 4x5/5x4 plateau)

Run:  python tests/pet_match_layout.py
Requires: playwright + Chrome (channel='chrome') + static server on :8399
          serving frontend/public  (e.g. python -m http.server 8399 -d public)
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8399/games/match/match.html"
RESULTS = []


def check(name, cond, extra=""):
    RESULTS.append((name, bool(cond)))
    print(f"  {'PASS' if cond else 'FAIL'}  {name}{(' - ' + extra) if extra else ''}")


MEASURE = """() => {
  const app = document.querySelector('.pet-match-app');
  const wrap = document.querySelector('.pet-match-board-wrap');
  const board = document.getElementById('pmBoard');
  const card = board ? board.querySelector('.pet-match-card') : null;
  const w = wrap.getBoundingClientRect();
  const b = board.getBoundingClientRect();
  return {
    wide: app.classList.contains('pet-match-app--wide'),
    display: getComputedStyle(app).display,
    wrapW: w.width, wrapH: w.height,
    boardW: b.width, boardH: b.height,
    cell: card ? card.getBoundingClientRect().width : 0,
    cols: +getComputedStyle(board).getPropertyValue('--cols'),
    rows: +getComputedStyle(board).getPropertyValue('--rows'),
    overflowX: b.width > w.width + 2 || b.height > w.height + 2,
    level: window.__pm ? __pm.level : 0,
  };
}"""

VIEWPORTS = [
    # (name, url_suffix, vw, vh, expect_wide)
    ("embed",       "?embed=1", 1040, 640, True),
    ("embed-small", "?embed=1", 800, 500, True),
    ("standalone",  "",         1400, 900, True),
    ("m-portrait",  "",         390, 844, False),
    ("m-landscape", "",         844, 390, True),
]

# (level, total cards, min cell px)
LEVEL_CASES = [(1, 4, 40), (5, 18, 40), (10, 36, 40)]


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        for name, suffix, vw, vh, expect_wide in VIEWPORTS:
            page = browser.new_page(viewport={"width": vw, "height": vh})
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(BASE + suffix, wait_until="domcontentloaded")
            page.wait_for_timeout(1600)

            m = page.evaluate(MEASURE)
            check(f"{name} wide-mode", m["wide"] == expect_wide,
                  f"wide={m['wide']} display={m['display']}")
            if expect_wide:
                check(f"{name} grid display", m["display"] == "grid", m["display"])

            for lv, total, min_cell in LEVEL_CASES:
                page.evaluate(f"__pm.startLevel({lv})")
                page.wait_for_timeout(1400)
                m = page.evaluate(MEASURE)
                check(f"{name} L{lv} board fits wrap", not m["overflowX"],
                      f"board {m['boardW']:.0f}x{m['boardH']:.0f} in {m['wrapW']:.0f}x{m['wrapH']:.0f}")
                check(f"{name} L{lv} cell >= {min_cell}px", m["cell"] >= min_cell,
                      f"cell={m['cell']:.0f}px grid={m['cols']}x{m['rows']}")
                landscape = m["wrapW"] > m["wrapH"]
                oriented = (m["cols"] >= m["rows"]) if landscape else True
                check(f"{name} L{lv} orientation", oriented,
                      f"{m['cols']}x{m['rows']} in {m['wrapW']:.0f}x{m['wrapH']:.0f}")

            # keyboard nav follows rendered grid (L5 = 6x3 in landscape boxes)
            if m["wrapW"] > m["wrapH"]:
                page.evaluate("__pm.startLevel(5)")
                page.wait_for_timeout(1300)
                page.evaluate("document.querySelector('[data-index=\"0\"]').focus()")
                page.keyboard.press("ArrowRight")
                right = page.evaluate("document.activeElement.dataset.index")
                page.keyboard.press("ArrowDown")
                down = page.evaluate("document.activeElement.dataset.index")
                check(f"{name} arrow-right", right == "1", f"got {right}")
                # From index 1, Down must step by RENDERED cols (6): 1+6=7.
                # Logical table cols (3) would wrongly land on 4.
                check(f"{name} arrow-down uses rendered cols",
                      down == "7", f"got {down} (rendered 6x3)")

            check(f"{name} no page errors", not errors, "; ".join(errors[:1]))
            page.close()

        # level table sanity — strictly increasing pairs, <=18 (SVG pool size)
        page = browser.new_page()
        page.goto(BASE, wait_until="domcontentloaded")
        page.wait_for_timeout(1200)
        pairs = page.evaluate("""() => {
          const out = [];
          for (let l = 1; l <= 10; l++) {
            __pm.startLevel(l);
            out.push(__pm.deck.length / 2);
          }
          return out;
        }""")
        check("pairs strictly increase", all(pairs[i] < pairs[i+1] for i in range(9)),
              str(pairs))
        check("pairs <= 18 image pool", max(pairs) <= 18, str(max(pairs)))
        page.close()
        browser.close()

    failed = [n for n, ok in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} passed")
    if failed:
        print("FAILED:", ", ".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main()
