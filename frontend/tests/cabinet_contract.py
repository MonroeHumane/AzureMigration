"""Cabinet iframe postMessage contract test.

Boots the real Astro dev server, opens the real games cabinet shell
(/games/), launches the Pet Booster iframe, and verifies the cross-frame
contract in both directions:

  iframe -> cabinet : adoptedex:pack_awarded  (packs count + toast)
                      adoptedex:pack_opened   (packs decrement)
                      adoptedex:pet_discovered (discovered merge)
  cabinet -> iframe : arcade:set_mute         (booster mutes)

Run:  python tests/cabinet_contract.py
Requires: playwright (pip package) + installed Google Chrome (channel='chrome')
          + `npm install` already run in frontend/ (astro dev server).
"""

import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

FRONTEND = Path(__file__).resolve().parent.parent
PORT = 8399
BASE = f"http://127.0.0.1:{PORT}"

RESULTS = []


def check(name, cond, extra=""):
    RESULTS.append((name, bool(cond)))
    extra = str(extra).encode("ascii", "replace").decode("ascii")
    print(f"  {'PASS' if cond else 'FAIL'}  {name}{(' - ' + extra) if extra else ''}")


def wait_for_server(url, timeout=45):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                if r.status == 200:
                    return True
        except Exception:
            time.sleep(0.8)
    return False


def main():
    # 1. Boot the real Astro dev server (serves src/pages + public/)
    proc = subprocess.Popen(
        ["npx", "astro", "dev", "--port", str(PORT), "--host", "127.0.0.1"],
        cwd=str(FRONTEND),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        shell=True,
    )
    try:
        if not wait_for_server(BASE + "/games/"):
            print("FAIL: astro dev server did not start")
            return 1

        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.goto(BASE + "/games/", wait_until="domcontentloaded")
            page.wait_for_timeout(1500)

            # 2. Launch booster inside the real cabinet shell
            page.click('[data-launch-game="booster"]')
            page.wait_for_selector("#cabinet-game-iframe[src*='booster']", timeout=8000)

            iframe_el = page.wait_for_selector("#cabinet-game-iframe")
            frame = None
            deadline = time.time() + 10
            while time.time() < deadline:
                for fr in page.frames:
                    if "booster/index.html" in (fr.url or ""):
                        frame = fr
                        break
                if frame:
                    break
                page.wait_for_timeout(300)
            check("booster iframe loaded in cabinet", frame is not None,
                  (frame.url if frame else "no frame"))

            # embed-mode contract: ?embed=1 appended + html.is-embedded
            check("iframe url has embed=1", "embed=1" in (iframe_el.get_attribute("src") or ""))
            frame.wait_for_selector("html.is-embedded, html.humane-embed", timeout=8000)
            check("booster entered embed mode", True)

            # booster bridge exposed inside iframe
            bridge_ok = frame.evaluate("() => !!window.HumaneBoosterBridge")
            check("HumaneBoosterBridge exposed in iframe", bridge_ok)

            # ── OUTBOUND: iframe -> cabinet ──────────────────────────────
            # pack_awarded -> cabinet writes monroeDexPacks + toast
            frame.evaluate(
                "() => window.parent.postMessage("
                "{type:'adoptedex:pack_awarded', remainingPacks:4}, '*')"
            )
            page.wait_for_timeout(600)
            packs = page.evaluate("() => localStorage.getItem('monroeDexPacks')")
            check("pack_awarded -> monroeDexPacks = 4", packs == "4", packs or "null")
            toast_visible = page.evaluate(
                "() => !document.getElementById('milestone-award-toast').classList.contains('hidden')"
            )
            check("pack_awarded -> milestone toast shown", toast_visible)

            # pack_opened -> decrement
            frame.evaluate(
                "() => window.parent.postMessage("
                "{type:'adoptedex:pack_opened', remainingPacks:3}, '*')"
            )
            page.wait_for_timeout(400)
            packs = page.evaluate("() => localStorage.getItem('monroeDexPacks')")
            check("pack_opened -> monroeDexPacks = 3", packs == "3", packs or "null")

            # pet_discovered -> discovered merge
            frame.evaluate(
                "() => window.parent.postMessage("
                "{type:'adoptedex:pet_discovered', petIds:['contract_cat','contract_dog']}, '*')"
            )
            page.wait_for_timeout(400)
            discovered = json.loads(page.evaluate(
                "() => localStorage.getItem('monroe_discovered_pets') || '[]'"
            ))
            check(
                "pet_discovered -> discovered merge",
                {"contract_cat", "contract_dog"}.issubset(set(map(str, discovered))),
                str(discovered)[:80],
            )

            # ── INBOUND: cabinet -> iframe ───────────────────────────────
            # Toggle cabinet sound -> arcade:set_mute reaches the booster
            before = frame.evaluate(
                "() => (document.querySelector('.sound-icon')||{}).textContent || ''"
            )
            page.click("#cabinet-sound-btn")
            page.wait_for_timeout(600)
            after = frame.evaluate(
                "() => (document.querySelector('.sound-icon')||{}).textContent || ''"
            )
            check("arcade:set_mute -> booster sound icon flipped",
                  before != after,
                  f"muted={after == chr(0x1f507)}")

            # booster responds to pack_awarded inbound (refresh path doesn't throw)
            errors = []
            frame.evaluate(
                "() => { window.__pmErr = null; window.addEventListener('error', e => window.__pmErr = e.message); }"
            )
            page.evaluate(
                "() => document.getElementById('cabinet-game-iframe')"
                ".contentWindow.postMessage({type:'adoptedex:pack_awarded', remainingPacks:5}, '*')"
            )
            page.wait_for_timeout(800)
            err = frame.evaluate("() => window.__pmErr")
            check("inbound pack_awarded handled without frame error", not err, err or "")

            browser.close()

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except Exception:
            proc.kill()

    failed = [n for n, ok in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(failed)} passed, {len(failed)} failed")
    for n in failed:
        print(f"  FAILED: {n}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
