"""Puppy Skater browser test.

Assumes the Astro dev server is already running on :8399.
Covers: boot, start screen, run start, jump/duck input, canvas rendering,
distance HUD ticking, collectible pickup, milestone banner, death → game over.

Run:  python tests/puppy_skater.py
"""

import sys
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8399"
GAME = BASE + "/games/puppy-skater/index.html"
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
        check("start overlay visible", page.is_visible(".ps-start.is-open"))
        check("dog picker rendered", page.locator(".ps-dog-pick").count() == 4)
        page.screenshot(path=str(SHOTS / "ps_start.png"))

        # Start the run
        page.click("[data-start]")
        page.wait_for_timeout(400)
        check("start overlay hidden", not page.is_visible(".ps-start.is-open"))
        check("milestone ticks live", page.is_visible(".ps-ticks.is-live"))

        # First input starts PLAYING; give the pup a moment on the sidewalk.
        # Invincibility up front so random obstacles can't interrupt the
        # pose/pickup assertions (the real-death path is exercised below).
        page.keyboard.press("ArrowUp")
        page.wait_for_timeout(1400)
        page.evaluate("() => { window.__ps.lives = 5; window.__ps.invincibleT = 120; }")
        page.screenshot(path=str(SHOTS / "ps_play.png"))

        meters = page.evaluate("() => window.__ps ? window.__ps.meters : -1")
        check("distance ticking", meters > 0, f"{meters:.1f}m")

        # Duck + jump shouldn't throw and the pup should change pose
        page.keyboard.press("ArrowDown")
        page.wait_for_timeout(180)
        check("duck pose active", page.evaluate("() => window.__ps.action") == "ducking")
        page.screenshot(path=str(SHOTS / "ps_duck.png"))
        page.wait_for_timeout(600)
        page.keyboard.press("ArrowUp")
        page.wait_for_timeout(180)
        check("ollie pose active", page.evaluate("() => window.__ps.action") == "jumping")
        page.screenshot(path=str(SHOTS / "ps_jump.png"))
        page.wait_for_timeout(600)

        # Rescue pickup: drop a collectible at the player's x at ground height.
        rescued_before = page.evaluate("() => window.__ps.rescuedCount")
        page.evaluate("""() => {
          const g = window.__ps;
          g.collectibles.push({ id: 8888, worldX: g.cameraX + 118, alt: 34, collected: false, pet: null });
        }""")
        page.wait_for_timeout(600)
        check("rescue pickup counted",
              page.evaluate("() => window.__ps.rescuedCount") > rescued_before)

        # Milestone cross: move the camera to just under 500m (meters derive
        # from cameraX via distScale = 0.02) → banner + confetti.
        # Clear in-flight obstacles + top up lives so a random hit can't end
        # the run between the camera jump and the threshold cross.
        page.evaluate("""() => {
          const g = window.__ps;
          g.lives = 3; g.invincibleT = 30;
          g.obstacles.length = 0;
          g.cameraX = 497 / 0.02;
        }""")
        page.wait_for_timeout(1600)
        check("milestone banner shown",
              page.evaluate("() => !!(window.__ps.banner && window.__ps.banner.t > 0)"))
        check("milestone confetti spawned",
              page.evaluate("() => window.__ps.confetti.length") > 0)
        page.screenshot(path=str(SHOTS / "ps_milestone.png"))

        # Canvas is actually drawing — screenshots above cover visual review
        # (pixel reads are unavailable: remote pet photos may taint the canvas)

        # Force a death: park a block stack on the player's path with lives=1
        # → hitPlayer → DYING → GAME_OVER → over panel.
        page.evaluate("""() => {
          const g = window.__ps;
          g.lives = 1;
          g.invincibleT = 0;
          g.obstacles.push({ id: 9999, t: 'blocks', worldX: g.cameraX + 118,
                             w: 56, h: 56, color: 'pink', passed: false });
        }""")
        # Death → DYING (~1.1s) → GAME_OVER, then the over panel opens after
        # the async leaderboard/profile fetch resolves (slow when the API is
        # origin-locked) — wait on the selector, not a fixed delay.
        try:
            page.wait_for_selector(".ps-over.is-open", timeout=12000)
            state = True
        except Exception:
            state = False
        page.screenshot(path=str(SHOTS / "ps_late.png"))
        check("game over panel opens on death", state)
        check("retry button present", page.is_visible("[data-retry]"))

        # Retry restarts cleanly
        if state:
            page.click("[data-retry]")
            page.wait_for_timeout(500)
            check("retry resets to READY", page.evaluate("() => window.__ps.state") in ("READY", "PLAYING"),
                  page.evaluate("() => window.__ps.state"))

        check("no page errors", not errors, "; ".join(errors[:3]) or "clean")
        browser.close()

    failed = [n for n, ok in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(failed)} passed, {len(failed)} failed")
    for n in failed:
        print(f"  FAILED: {n}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
