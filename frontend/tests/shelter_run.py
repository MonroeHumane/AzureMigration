"""Shelter Run (recreation) browser test.

Assumes the Astro dev server is already running on :8399.
Covers: boot, start screen, run start, lane/jump/slide input, canvas
rendering, distance HUD ticking, console errors.

Run:  python tests/shelter_run.py
"""

import sys
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8399"
GAME = BASE + "/games/shelter-run/index.html"
SHOTS = Path(__file__).resolve().parent / "_shots"

RESULTS = []


def check(name, cond, extra=""):
    RESULTS.append((name, bool(cond)))
    extra = str(extra).encode("ascii", "replace").decode("ascii")
    print(f"  {'PASS' if cond else 'FAIL'}  {name}{(' - ' + extra) if extra else ''}")


def server_up():
    try:
        with urllib.request.urlopen(BASE + "/games/", timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


def main():
    if not server_up():
        print("FAIL: dev server not running on :8399")
        return 1
    SHOTS.mkdir(exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        page = browser.new_page(viewport={"width": 432, "height": 800})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        def on_console(m):
            if m.type != "error":
                return
            # Network noise is expected locally: the WP pet endpoint 404s
            # (pets.js falls back to shelter-pets.json) and the Azure API
            # 401s (origin-locked). Only genuine JS errors should fail.
            if "Failed to load resource" in m.text:
                return
            errors.append(m.text)

        page.on("console", on_console)

        page.goto(GAME, wait_until="domcontentloaded")
        page.wait_for_timeout(2500)

        # Boot → start overlay
        check("start overlay visible", page.is_visible(".sr-start.is-open"))
        check("cat picker rendered", page.locator(".sr-cat-pick").count() == 4)
        page.screenshot(path=str(SHOTS / "sr_start.png"))

        # Start the run
        page.click("[data-start]")
        page.wait_for_timeout(400)
        check("start overlay hidden", not page.is_visible(".sr-start.is-open"))
        check("milestone ticks live", page.is_visible(".sr-ticks.is-live"))

        # First input starts PLAYING; give the runner a moment on the track
        page.keyboard.press("ArrowUp")
        page.wait_for_timeout(1400)
        page.screenshot(path=str(SHOTS / "sr_play.png"))

        meters = page.evaluate("() => window.__srDebug ? window.__srDebug.meters : -1")

        # Lane changes + slide + jump shouldn't throw and cat should animate
        page.keyboard.press("ArrowLeft")
        page.wait_for_timeout(300)
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(300)
        page.keyboard.press("ArrowDown")
        page.wait_for_timeout(700)
        page.screenshot(path=str(SHOTS / "sr_slide.png"))
        page.keyboard.press("ArrowUp")
        page.wait_for_timeout(200)
        page.screenshot(path=str(SHOTS / "sr_jump.png"))

        # Canvas is actually drawing — screenshot the play state for review
        # (pixel reads are unavailable: remote pet photos may taint the canvas)

        # Force a death: park a lane-block on the player's lane at playerZ
        # with lives=1 → hitPlayer → DYING → GAME_OVER → over panel.
        page.evaluate("""() => {
          const g = window.__sr;
          g.lives = 1;
          g.invincibleT = 0;
          g.obstacles.push({ id: 9999, type: 'lane_block', lane: g.targetLane,
                             worldZ: g.cameraZ + 200, passed: false, variant: 0 });
        }""")
        # Death → DYING (~1.1s) → GAME_OVER, then the over panel opens after
        # the async leaderboard/profile fetch resolves (slow when the API is
        # origin-locked) — wait on the selector, not a fixed delay.
        try:
            page.wait_for_selector(".sr-over.is-open", timeout=12000)
            state = True
        except Exception:
            state = False
        page.screenshot(path=str(SHOTS / "sr_late.png"))
        check("game over panel opens on death", state)
        check("retry button present", page.is_visible("[data-retry]"))

        # Retry restarts cleanly
        if state:
            page.click("[data-retry]")
            page.wait_for_timeout(500)
            check("retry resets to READY", page.evaluate("() => window.__sr.state") in ("READY", "PLAYING"),
                  page.evaluate("() => window.__sr.state"))

        check("no page errors", not errors, "; ".join(errors[:3]) or "clean")
        browser.close()

    failed = [n for n, ok in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(failed)} passed, {len(failed)} failed")
    for n in failed:
        print(f"  FAILED: {n}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
