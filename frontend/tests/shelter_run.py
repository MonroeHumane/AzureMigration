"""Shelter Run (recreation) browser test.

Assumes the Astro dev server is already running on :8399.
Covers: boot, start screen, run start, lane/jump/slide input, canvas
rendering, distance HUD, rescue pickup, milestone banner/confetti,
two-strike chase (stumble → pack → escape / caught), upgrade store,
objectives panel, death + retry, console errors.

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
    name = str(name).encode("ascii", "replace").decode("ascii")
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

        # Store modal: opens, lists 5 upgrades with level pips, closes.
        page.click("[data-store]")
        page.wait_for_timeout(300)
        check("store opens", page.is_visible(".sr-storemodal.is-open"))
        check("store lists 5 upgrades", page.locator(".sr-upgrade").count() == 5)
        page.screenshot(path=str(SHOTS / "sr_store.png"))
        page.click("[data-store-close]")
        page.wait_for_timeout(200)
        check("store closes", not page.is_visible(".sr-storemodal.is-open"))

        # Objectives modal: opens, lists objectives, closes.
        page.click("[data-objectives]")
        page.wait_for_timeout(300)
        check("objectives opens", page.is_visible(".sr-objmodal.is-open"))
        check("objectives listed", page.locator(".sr-obj-list li").count() >= 8)
        page.screenshot(path=str(SHOTS / "sr_objectives.png"))
        page.click("[data-obj-close]")
        page.wait_for_timeout(200)

        # Start the run
        page.click("[data-start]")
        page.wait_for_timeout(400)
        check("start overlay hidden", not page.is_visible(".sr-start.is-open"))
        check("milestone ticks live", page.is_visible(".sr-ticks.is-live"))

        # First input starts PLAYING; give the runner a moment on the track
        page.keyboard.press("ArrowUp")
        page.wait_for_timeout(1400)
        page.screenshot(path=str(SHOTS / "sr_play.png"))

        meters = page.evaluate("() => window.__sr ? window.__sr.meters : -1")
        check("meters advancing", meters > 1, f"meters={meters:.0f}")

        # Lane changes + slide + jump shouldn't throw and cat should animate
        page.keyboard.press("ArrowLeft")
        page.wait_for_timeout(300)
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(300)
        page.keyboard.press("ArrowDown")
        page.wait_for_timeout(220)
        check("slide pose active", page.evaluate("() => window.__sr.action") == "sliding")
        page.screenshot(path=str(SHOTS / "sr_slide.png"))
        page.wait_for_timeout(600)
        page.keyboard.press("ArrowUp")
        page.wait_for_timeout(180)
        check("jump pose active", page.evaluate("() => window.__sr.action") == "jumping")
        page.screenshot(path=str(SHOTS / "sr_jump.png"))

        # Rescue pickup: drop a pet token in the player's lane at the plane.
        rescued_before = page.evaluate("() => window.__sr.rescuedCount")
        page.evaluate("""() => {
          const g = window.__sr;
          g.collectibles.push({ id: 8888, kind: 'pet', lane: g.targetLane,
                                worldZ: g.cameraZ + 130, collected: false, pet: null });
        }""")
        page.wait_for_timeout(600)
        check("rescue pickup counted",
              page.evaluate("() => window.__sr.rescuedCount") > rescued_before)

        # Treat pickup: same path, kind 'treat' feeds treatsRun.
        page.evaluate("""() => {
          const g = window.__sr;
          g.collectibles.push({ id: 8889, kind: 'treat', lane: g.targetLane,
                                worldZ: g.cameraZ + 130, collected: false,
                                tier: 'bronze', value: 1 });
        }""")
        page.wait_for_timeout(600)
        check("treat pickup counted",
              page.evaluate("() => window.__sr.treatsRun") >= 1)

        # ── Two-strike chase ──────────────────────────────────────────────
        # Strike one: forced hit while clean → pack releases (chase.active).
        page.evaluate("""() => {
          const g = window.__sr;
          g.invincibleT = 0; g.effects = { magnet: 0, ghost: 0, boost: 0 };
          g.obstacles.push({ id: 9991, type: 'lane_block', lane: g.targetLane,
                             worldZ: g.cameraZ + 205, passed: false, variant: 0 });
        }""")
        page.wait_for_timeout(700)
        check("strike one releases the pack",
              page.evaluate("() => window.__sr.chase.active") == True)
        check("pack visible (intensity rising)",
              page.evaluate("() => window.__sr.chase.intensity") > 0)
        check("still alive after strike one",
              page.evaluate("() => window.__sr.state") == "PLAYING")
        page.screenshot(path=str(SHOTS / "sr_chase.png"))

        # Escape: drain the recovery clock → pack retreats, lives restored.
        page.evaluate("""() => {
          const g = window.__sr;
          g.invincibleT = 12;   // stay clean while the clock drains
          g.chase.t = 0.4;
        }""")
        page.wait_for_timeout(900)
        check("clean play escapes the pack",
              page.evaluate("() => window.__sr.chase.active") == False)
        check("lives restored after escape",
              page.evaluate("() => window.__sr.lives") == 2)

        # Strike two while the pack is out → caught → death.
        page.evaluate("""() => {
          const g = window.__sr;
          g.chase.active = true; g.chase.t = 8; g.chase.intensity = 1;
          g.invincibleT = 0;
          g.obstacles.push({ id: 9992, type: 'lane_block', lane: g.targetLane,
                             worldZ: g.cameraZ + 205, passed: false, variant: 0 });
        }""")
        try:
            page.wait_for_selector(".sr-over.is-open", timeout=12000)
            state = True
        except Exception:
            state = False
        check("strike two caught → game over", state)
        check("caught flag set", page.evaluate("() => window.__sr.caught") == True)
        page.screenshot(path=str(SHOTS / "sr_caught.png"))

        # Retry restarts cleanly — chase state fully cleared.
        if state:
            page.click("[data-retry]")
            page.wait_for_timeout(500)
            check("retry resets to READY", page.evaluate("() => window.__sr.state") in ("READY", "PLAYING"),
                  page.evaluate("() => window.__sr.state"))
            check("chase cleared on retry",
                  page.evaluate("() => window.__sr.chase.active") == False)

        # ── Fresh page for milestone + boost coverage ─────────────────────
        page.goto(GAME, wait_until="domcontentloaded")
        page.wait_for_timeout(2200)
        page.click("[data-start]")
        page.wait_for_timeout(300)
        page.keyboard.press("ArrowUp")
        page.wait_for_timeout(800)

        # Milestone cross: move the camera to just under 500m.
        page.evaluate("""() => {
          const g = window.__sr;
          g.invincibleT = 30;
          g.cameraZ = 497 / 0.009;
        }""")
        page.wait_for_timeout(1600)
        check("milestone banner shown",
              page.evaluate("() => !!(window.__sr.banner && window.__sr.banner.t > 0)"))
        check("milestone confetti spawned",
              page.evaluate("() => window.__sr.confetti.length") > 0)
        page.screenshot(path=str(SHOTS / "sr_milestone.png"))

        # Boost autopilot: enable + verify it survives a stretch + collects.
        page.evaluate("""() => {
          const g = window.__sr;
          g.upgrades.boost = 3;
          g.effects.boost = 4; g.boostEndM = g.meters + 400;
          g.invincibleT = 8;
        }""")
        page.wait_for_timeout(1200)
        check("boost runs at max speed",
              page.evaluate("() => Math.abs(window.__sr.speed - 23) < 0.5"))
        page.screenshot(path=str(SHOTS / "sr_boost.png"))

        check("no page errors", not errors, "; ".join(errors[:3]) or "clean")
        browser.close()

    failed = [n for n, ok in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(failed)} passed, {len(failed)} failed")
    for n in failed:
        print(f"  FAILED: {n}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
