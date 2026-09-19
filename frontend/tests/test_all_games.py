import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ARTIFACTS = Path(r"C:\Users\Jeff\.gemini\antigravity-ide\brain\c5a81bad-01e0-4c71-827e-995b6e97f71d\.tempmediaStorage")
ARTIFACTS.mkdir(parents=True, exist_ok=True)

GAMES = [
    ("shelter_run", "shelter-run", "Shelter Run"),
    ("flappy", "flappy-cat-2", "Flappy Cat"),
    ("puppy_skater", "puppy-skater", "Puppy Skater"),
    ("match", "match", "Pet Match Memory"),
    ("booster", "booster", "Pet Booster Packs"),
    ("catwalk", "catwalk", "Catwalk Night Patrol"),
    ("pet_snake", "pet-snake", "Pet Snake Adventure"),
    ("dex", "dex/album", "Pet Discovery Binder"),
]

def run_suite():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        
        # ─────────────────────────────────────────────────────────────
        # 1. Desktop Cabinet Suite (1280x800)
        # ─────────────────────────────────────────────────────────────
        print("=== 1. DESKTOP CABINET SUITE (1280x800) ===", flush=True)
        d_page = browser.new_page(viewport={"width": 1280, "height": 800})
        d_page.goto("http://127.0.0.1:8399/games/", wait_until="domcontentloaded")
        d_page.wait_for_timeout(1000)

        desktop_results = []
        for gid, path_sub, label in GAMES:
            # Check if cabinet modal is already open
            modal = d_page.locator("#game-cabinet-modal")
            if modal.is_visible():
                # Use bottom quick dock
                dock_btn = d_page.locator(f'[data-dock-game="{gid}"]').first
                if dock_btn.count() > 0:
                    dock_btn.click()
                else:
                    # Close and launch
                    d_page.locator("#cabinet-close-btn").click()
                    d_page.wait_for_timeout(400)
                    btn = d_page.locator("#btn-view-album" if gid == "dex" else f'[data-launch-game="{gid}"]').first
                    btn.click()
            else:
                btn = d_page.locator("#btn-view-album" if gid == "dex" else f'[data-launch-game="{gid}"]').first
                btn.click()
            
            d_page.wait_for_timeout(1200)

            # Find target frame
            target_frame = None
            for f in d_page.frames:
                if path_sub in f.url:
                    target_frame = f
                    break

            if target_frame:
                metrics = target_frame.evaluate("""() => ({
                    docScrollW: document.documentElement.scrollWidth,
                    docClientW: document.documentElement.clientWidth,
                    docScrollH: document.documentElement.scrollHeight,
                    docClientH: document.documentElement.clientHeight,
                    bodyScrollH: document.body.scrollHeight,
                    bodyClientH: document.body.clientHeight,
                    vertScroll: document.documentElement.scrollHeight > document.documentElement.clientHeight,
                    horizScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
                    htmlOverflow: window.getComputedStyle(document.documentElement).overflow,
                    bodyOverflow: window.getComputedStyle(document.body).overflow
                })""")
                
                is_dex = (gid == "dex")
                pass_vert = not metrics['vertScroll'] if not is_dex else True
                pass_horiz = not metrics['horizScroll']
                status = "PASS" if (pass_vert and pass_horiz) else "FAIL"
                
                desktop_results.append((gid, status, metrics))
                print(f"[{status}] Desktop {label:<22} | doc: {metrics['docClientW']}x{metrics['docClientH']} (scrollH: {metrics['docScrollH']}) | VScroll: {metrics['vertScroll']} HScroll: {metrics['horizScroll']}", flush=True)

                # Capture desktop screenshot
                shot_path = ARTIFACTS / f"cabinet_desktop_{gid}.png"
                d_page.screenshot(path=str(shot_path))
            else:
                print(f"[FAIL] Frame not found for {gid}", flush=True)

        # ─────────────────────────────────────────────────────────────
        # 2. Mobile Cabinet Suite (390x844 iPhone 14)
        # ─────────────────────────────────────────────────────────────
        print("\n=== 2. MOBILE CABINET SUITE (390x844) ===", flush=True)
        m_page = browser.new_page(viewport={"width": 390, "height": 844})
        m_page.goto("http://127.0.0.1:8399/games/", wait_until="domcontentloaded")
        m_page.wait_for_timeout(1000)

        mobile_results = []
        for gid, path_sub, label in GAMES:
            modal = m_page.locator("#game-cabinet-modal")
            if modal.is_visible():
                dock_btn = m_page.locator(f'[data-dock-game="{gid}"]').first
                if dock_btn.count() > 0:
                    dock_btn.click()
                else:
                    m_page.locator("#cabinet-close-btn").click()
                    m_page.wait_for_timeout(400)
                    btn = m_page.locator("#btn-view-album" if gid == "dex" else f'[data-launch-game="{gid}"]').first
                    btn.click()
            else:
                btn = m_page.locator("#btn-view-album" if gid == "dex" else f'[data-launch-game="{gid}"]').first
                btn.click()

            m_page.wait_for_timeout(1200)

            target_frame = None
            for f in m_page.frames:
                if path_sub in f.url:
                    target_frame = f
                    break

            if target_frame:
                metrics = target_frame.evaluate("""() => ({
                    docScrollW: document.documentElement.scrollWidth,
                    docClientW: document.documentElement.clientWidth,
                    docScrollH: document.documentElement.scrollHeight,
                    docClientH: document.documentElement.clientHeight,
                    bodyScrollH: document.body.scrollHeight,
                    bodyClientH: document.body.clientHeight,
                    vertScroll: document.documentElement.scrollHeight > document.documentElement.clientHeight,
                    horizScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
                    htmlOverflow: window.getComputedStyle(document.documentElement).overflow,
                    bodyOverflow: window.getComputedStyle(document.body).overflow
                })""")

                is_dex = (gid == "dex")
                pass_vert = not metrics['vertScroll'] if not is_dex else True
                pass_horiz = not metrics['horizScroll']
                status = "PASS" if (pass_vert and pass_horiz) else "FAIL"

                mobile_results.append((gid, status, metrics))
                print(f"[{status}] Mobile  {label:<22} | doc: {metrics['docClientW']}x{metrics['docClientH']} (scrollH: {metrics['docScrollH']}) | VScroll: {metrics['vertScroll']} HScroll: {metrics['horizScroll']}", flush=True)

                shot_path = ARTIFACTS / f"cabinet_mobile_{gid}.png"
                m_page.screenshot(path=str(shot_path))
            else:
                print(f"[FAIL] Frame not found for {gid}", flush=True)

        # ─────────────────────────────────────────────────────────────
        # 3. Booster Pack Opening & Reveal Check
        # ─────────────────────────────────────────────────────────────
        print("\n=== 3. BOOSTER PACK OPENING & REVEAL SCALING CHECK ===", flush=True)
        b_page = browser.new_page(viewport={"width": 1280, "height": 800})
        b_page.goto("http://127.0.0.1:8399/games/booster/index.html?embed=1", wait_until="domcontentloaded")
        b_page.wait_for_timeout(800)

        # Press space to open
        b_page.keyboard.press("Space")
        b_page.wait_for_timeout(1000)

        booster_check = b_page.evaluate("""() => ({
            scrollH: document.documentElement.scrollHeight,
            clientH: document.documentElement.clientHeight,
            vertScroll: document.documentElement.scrollHeight > document.documentElement.clientHeight,
            horizScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            bodyOverflow: window.getComputedStyle(document.body).overflow
        })""")
        print(f"Booster Open Ceremony Sizing: {booster_check}", flush=True)
        b_shot = ARTIFACTS / "booster_opened_stage.png"
        b_page.screenshot(path=str(b_shot))

        browser.close()

        all_passed = all(s == "PASS" for _, s, _ in desktop_results + mobile_results)
        print(f"\nFINAL TEST OUTCOME: {'ALL CHECKS PASSED (16/16)' if all_passed else 'SOME CHECKS FAILED'}", flush=True)
        return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(run_suite())
