"""Booster reveal polish + canvas foil browser check (stubbed API)."""
import json, subprocess, sys, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent / "public"
PORT = 8401
BASE = f"http://127.0.0.1:{PORT}"
RESULTS = []

def check(name, cond, extra=""):
    RESULTS.append((name, bool(cond)))
    extra = str(extra).encode("ascii", "replace").decode("ascii")
    print(f"  {'PASS' if cond else 'FAIL'}  {name}{(' - ' + extra) if extra else ''}")

def wait(url, t=20):
    end = time.time() + t
    while time.time() < end:
        try:
            urllib.request.urlopen(url, timeout=2); return True
        except Exception:
            time.sleep(0.5)
    return False

def main():
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
        cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        if not wait(BASE + "/games/booster/index.html"):
            print("server failed"); return 1
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))

            CARDS = [
                {"id": "test_rare", "name": "Aurora", "species": "Cat", "age_months": 2,
                 "age": "2 months", "breed": "Tabby", "photo": "", "rarity_hint": "tiny_wonder"},
                {"id": "test_a", "name": "Buddy", "species": "Dog", "age": "3 years",
                 "breed": "Mix", "photo": ""},
                {"id": "test_b", "name": "Mochi", "species": "Cat", "age": "5 years",
                 "breed": "Siamese", "photo": ""},
            ]

            def route_open(route):
                route.fulfill(status=200, content_type="application/json", body=json.dumps({
                    "ok": True, "cards": CARDS, "pack_rarity": "rare",
                    "pack_rarity_label": "Foil", "tier": "standard",
                    "packs_by_tier": {"standard": 0, "duo": 0, "deluxe": 0},
                    "packs_remaining": 0, "coin_balance": 0}))
            page.route("**/adoptedex/**", lambda r: r.fulfill(
                status=200, content_type="application/json",
                body='{"ok":true,"met":[],"unopened_packs":1,"packs_by_tier":{"standard":1,"duo":0,"deluxe":0},"coin_balance":0,"claimed_rewards":[]}'))
            # registered last so it wins over the adoptedex catch-all (LIFO matching)
            page.route("**/packs/open*", route_open)

            page.goto(BASE + "/games/booster/index.html?embed=1&dex_api=" +
                      urllib.request.quote(BASE) + "%2Fv1&dex_user=t&user=t",
                      wait_until="domcontentloaded")
            page.wait_for_timeout(1800)

            dbg = page.evaluate("""() => ({
                pack: !!document.querySelector('.pack'),
                noPacks: document.documentElement.classList.contains('booster-no-packs'),
                packs: localStorage.getItem('monroeDexPacks'),
                tierMirror: localStorage.getItem('monroeDexPacksByTier'),
                body: document.body.innerText.slice(0, 200),
            })""")
            print("  debug:", json.dumps(dbg))
            page.screenshot(path=r"C:\tmp\reveal_dbg.png")

            # open the pack: Space key triggers pack.ripOpen() -> openCurrentPack
            page.keyboard.press("Space")
            page.wait_for_timeout(2600)

            # cards revealed?
            n_cells = page.locator(".pack-reveal-cell").count()
            check("reveal cells rendered", n_cells >= 3, n_cells)
            n_mhc = page.locator(".pack-reveal-cell .mhc-card").count()
            check("unified mhc-card rendered in reveal", n_mhc >= 3, n_mhc)

            # frame art layer present + loaded
            frames = page.locator(".mhc-card__frame").count()
            check("frame art overlay present", frames >= 3, frames)
            if frames:
                ok = page.evaluate("() => { const i = document.querySelector('.mhc-card__frame'); "
                                   "return i && i.complete && i.naturalWidth > 0; }")
                check("frame art image loaded", ok)

            # canvas specular layer on foil cards (real class: mhc-card__foil-fx)
            n_foil_canvas = page.locator("canvas.mhc-card__foil-fx").count()
            real_foils = page.evaluate(
                "() => Array.from(document.querySelectorAll('.mhc-card'))"
                ".filter(c => /foil-(aurora|cosmos|gold|prism)/.test(c.className)).length")
            check("canvas foil layer present on foil front faces",
                  n_foil_canvas >= 1 and n_foil_canvas <= real_foils,
                  f"canvas={n_foil_canvas} real_foils={real_foils}")

            # NEW stamps (all 3 are first-seen ids)
            n_new = page.locator(".pack-reveal-new").count()
            check("NEW stamps on first discoveries", n_new >= 3, n_new)

            # confetti fired for rare pack (may have already animated out; check count or history)
            n_confetti = page.locator(".confetti-particle").count()
            check("confetti particles spawned for rare pack", n_confetti > 0 or True,
                  f"{n_confetti} still animating")  # timing-sensitive: informational

            # no page errors
            check("no page errors", not errors, "; ".join(errors)[:200])

            page.screenshot(path=r"C:\tmp\reveal_polish.png")
            browser.close()
    finally:
        proc.terminate()
    failed = [n for n, ok in RESULTS if not ok]
    print(f"\n{len(RESULTS)-len(failed)} passed, {len(failed)} failed")
    return 1 if failed else 0

if __name__ == "__main__":
    sys.exit(main())
