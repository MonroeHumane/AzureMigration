"""Pet Snake Adventure automated browser test.

Tests the modernized Canvas/Roguelike Pet Snake game:
1. Boot & Title Screen (Mascot & Starting Modifier pickers)
2. Run Start & HUD Chip verification (Hearts, Floor, Score, Goal bar)
3. Deterministic state manipulation via window.__snake
4. Direction queueing & steering
5. Treat eating & score multiplier verification
6. Floor clear & upgrade drafting modal (3 equipment cards, 2 route options)
7. Milestone progression & Floor 15 Vacuum Boss phases
8. Damage handling & Field Journal summary card
9. Clean console without unhandled exceptions

Run: python tests/pet_snake.py
"""

import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

FRONTEND = Path(__file__).resolve().parent.parent
PORT = 8399
BASE = f"http://127.0.0.1:{PORT}"
SHOTS = Path(__file__).resolve().parent / "_shots"

RESULTS = []

def check(name, cond, extra=""):
    RESULTS.append((name, bool(cond)))
    name_str = str(name).encode("ascii", "replace").decode("ascii")
    extra_str = str(extra).encode("ascii", "replace").decode("ascii")
    print(f"  {'PASS' if cond else 'FAIL'}  {name_str}{(' - ' + extra_str) if extra_str else ''}")

def check_server(url, timeout=2):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return r.status == 200
    except Exception:
        return False

def wait_for_server(url, timeout=45):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if check_server(url):
            return True
        time.sleep(0.8)
    return False

def main():
    server_proc = None
    if not check_server(f"{BASE}/games/"):
        print(f"Starting Astro server on :{PORT}...")
        server_proc = subprocess.Popen(
            ["npx", "astro", "dev", "--port", str(PORT), "--host", "127.0.0.1"],
            cwd=str(FRONTEND),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            shell=True,
        )
        if not wait_for_server(f"{BASE}/games/"):
            print(f"FAIL: dev server did not start on :{PORT}")
            if server_proc:
                server_proc.terminate()
            return 1
        print(f"Astro dev server is up on :{PORT}")

    game_url = f"{BASE}/games/pet-snake/index.html?embed=1"
    SHOTS.mkdir(exist_ok=True)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=True)
            page = browser.new_page(viewport={"width": 640, "height": 840})
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))

            def on_console(m):
                if m.type != "error":
                    return
                # Allow expected network fallbacks (e.g. offline WP/ACA API)
                if "Failed to load resource" in m.text:
                    return
                errors.append(m.text)

            page.on("console", on_console)

            print(f"Navigating to {game_url}...")
            page.goto(game_url, wait_until="domcontentloaded")
            page.wait_for_timeout(2000)

            # 1. Boot & Title Screen
            check("canvas playfield mounted", page.is_visible("#game-canvas"))
            check("title card rendered", page.is_visible(".ps-title-card"))
            check("mascot picker rendered 3 choices", page.locator(".ps-mascot-btn").count() == 3)
            check("modifier list rendered 5 archetypes", page.locator(".ps-mod-btn").count() == 5)
            page.screenshot(path=str(SHOTS / "snake_title.png"))

            # 2. Start Run with Fragile Archetype
            page.click(".ps-mod-btn[data-mod='fragile']")
            page.wait_for_timeout(200)
            page.click("#btn-start-run")
            page.wait_for_timeout(600)

            check("title card dismissed", not page.is_visible(".ps-title-card"))
            check("HUD chips visible", page.is_visible("#ps-hud"))
            check("window.__snake debug handle exposed", page.evaluate("() => typeof window.__snake === 'object'"))

            # 3. Fragile Modifier state verification (1 Heart, 2x Coins)
            hearts = page.evaluate("() => window.__snake.hearts")
            check("fragile start gives exactly 1 heart", hearts == 1, f"hearts={hearts}")
            coin_mul = page.evaluate("() => window.__snake.startingModifier.coinMultiplier")
            check("fragile coin multiplier is 2.0", coin_mul == 2.0)
            page.screenshot(path=str(SHOTS / "snake_play.png"))

            # 4. Steering & Direction Queueing
            page.keyboard.press("ArrowUp")
            page.wait_for_timeout(100)
            page.keyboard.press("ArrowRight")
            page.wait_for_timeout(300)
            snake_len = page.evaluate("() => window.__snake.snake.length")
            check("snake body intact", snake_len >= 3, f"len={snake_len}")

            # 5. Treat Eating & Scoring
            score_before = page.evaluate("() => window.__snake.score")
            page.evaluate("""() => {
                window.__snake.eatTreat({ key: 'steak', label: 'Juicy Steak', score: 4 });
            }""")
            page.wait_for_timeout(200)
            score_after = page.evaluate("() => window.__snake.score")
            check("treat eating awarded score with multiplier", score_after > score_before, f"{score_before} -> {score_after}")

            # 6. Floor Complete & Upgrade Drafting Modal
            page.evaluate("() => window.__snake.completeFloor('goal')")
            page.wait_for_timeout(400)
            check("draft modal appeared", page.is_visible(".ps-draft-card"))
            draft_cards = page.locator(".ps-upgrade-card").count()
            check("draft presents 3 upgrade choices", draft_cards == 3, f"count={draft_cards}")
            route_cards = page.locator(".ps-route-card").count()
            check("route picker presents 2 destinations", route_cards == 2, f"count={route_cards}")
            page.screenshot(path=str(SHOTS / "snake_draft.png"))

            # 7. Upgrade Selection & Route Continuation
            page.click(".ps-upgrade-card:first-child")
            page.wait_for_timeout(200)
            page.click("#btn-draft-continue")
            page.wait_for_timeout(400)
            current_floor = page.evaluate("() => window.__snake.floorIndex + 1")
            check("advanced to Floor 2", current_floor == 2, f"floor={current_floor}")
            upgrades_count = page.evaluate("() => window.__snake.upgrades.length")
            check("selected upgrade retained in equipment kit", upgrades_count == 1)

            # 8. Boss Room (Floor 15) & Phases
            page.evaluate("() => window.__snake.startFloor(14)")
            page.wait_for_timeout(400)
            boss_floor = page.evaluate("() => window.__snake.floorIndex + 1")
            check("jumped to Floor 15 Boss Arena", boss_floor == 15)
            has_vacuum = page.evaluate("() => window.__snake.vacuum !== null")
            check("Vacuum Cleaner active in Boss arena", has_vacuum)

            # 9. Death & Field Journal Summary
            page.evaluate("""() => {
                window.__snake.handleCollision('vacuum');
            }""")
            page.wait_for_timeout(600)
            check("field journal observation log rendered", page.is_visible(".ps-journal-card"))
            stamp_text = page.locator(".ps-stamp").text_content()
            check("expedition failed stamp shown", "VACUUMED" in stamp_text or "BONKED" in stamp_text or "BLASTED" in stamp_text, f"stamp={stamp_text}")
            page.screenshot(path=str(SHOTS / "snake_journal.png"))

            # 10. Console errors check
            check("zero unhandled JavaScript console errors", len(errors) == 0, ", ".join(errors) if errors else "clean")

            browser.close()
    finally:
        if server_proc:
            try:
                server_proc.terminate()
                server_proc.wait(timeout=3)
            except Exception:
                pass

    total_pass = sum(1 for _, ok in RESULTS if ok)
    total_fail = sum(1 for _, ok in RESULTS if not ok)
    print(f"\nSummary: {total_pass} passed, {total_fail} failed out of {len(RESULTS)} checks.")
    return 0 if total_fail == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
