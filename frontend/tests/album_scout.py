"""Album scout-strip + recovery modal browser check (stubbed API)."""
import json, subprocess, sys, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent / "public"
PORT = 8402
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
        if not wait(BASE + "/games/dex/album.html"):
            print("server failed"); return 1
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))

            # stub: 5 real cats + 4 real dogs (album joins met_ids to catalog)
            met_ids = ["61388848","61447464","61410143","61410096","61410078",
                       "61461825","61448087","61447973","61447319"]
            def route_profile(r):
                r.fulfill(status=200, content_type="application/json", body=json.dumps({
                    "ok": True, "met_ids": met_ids, "unopened_packs": 0,
                    "packs_by_tier": {"standard":0,"duo":0,"deluxe":0},
                    "coin_balance": 0, "claimed_rewards": []}))
            page.route("**/adoptedex/**", route_profile)

            page.goto(BASE + "/games/dex/album.html?dex_user=t&dex_api=" +
                      urllib.request.quote(BASE) + "%2Fv1", wait_until="domcontentloaded")
            page.wait_for_timeout(2500)

            cats = page.text_content("#scoutCatsCount") or ""
            dogs = page.text_content("#scoutDogsCount") or ""
            check("cat scout shows 5/10", "5/10" in cats, cats.strip())
            check("dog scout shows 4/10", "4/10" in dogs, dogs.strip())

            # recovery modal opens + closes
            page.click("#binderRecoverBtn")
            page.wait_for_timeout(300)
            check("recovery modal opens", page.is_visible("#binderRecoverModal"))
            page.click("#binderRecoverCancel")
            page.wait_for_timeout(300)
            check("recovery modal closes", not page.is_visible("#binderRecoverModal"))

            check("no page errors", not errors, "; ".join(errors)[:200])
            page.screenshot(path=r"C:\tmp\album_scout.png")
            browser.close()
    finally:
        proc.terminate()
    failed = [n for n, ok in RESULTS if not ok]
    print(f"\n{len(RESULTS)-len(failed)} passed, {len(failed)} failed")
    return 1 if failed else 0

if __name__ == "__main__":
    sys.exit(main())
