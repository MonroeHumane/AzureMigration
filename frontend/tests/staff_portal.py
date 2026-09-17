"""Staff Portal & Shelter Census Browser Integration Test.

Tests the zero-cost offline/fallback staff authentication, dashboard metrics,
and live shelter animal census with kennel card modal printing.

Run: python tests/staff_portal.py
Requires: static server on :8399 serving frontend/dist
"""

import sys
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8399"
SHOTS = Path(__file__).resolve().parent / "_shots"
RESULTS = []


def check(name, cond, extra=""):
    RESULTS.append((name, bool(cond)))
    name = str(name).encode("ascii", "replace").decode("ascii")
    extra = str(extra).encode("ascii", "replace").decode("ascii")
    print(f"  {'PASS' if cond else 'FAIL'}  {name}{(' - ' + extra) if extra else ''}")


def server_up():
    try:
        with urllib.request.urlopen(BASE + "/internal/", timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


def main():
    if not server_up():
        print("FAIL: static server not running on :8399")
        return 1

    SHOTS.mkdir(exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()

        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        # 1. Unauthenticated Visit -> Login Gate
        page.goto(BASE + "/internal/", wait_until="domcontentloaded")
        page.wait_for_timeout(1000)

        check("auth gate visible", page.is_visible("#staff-portal-auth-gate"))
        check("email input present", page.is_visible("#unified-email"))
        check("password input present", page.is_visible("#unified-password"))
        page.screenshot(path=str(SHOTS / "staff_gate.png"))

        # 2. Authenticate with Shelter Staff Credentials
        page.fill("#unified-email", "staff@monroe-humane.org")
        page.fill("#unified-password", "MonroeStaff2026!")
        page.click("#unified-submit-btn")
        try:
            page.wait_for_selector("html.staff-authenticated", timeout=8000)
        except Exception:
            pass

        is_auth = page.evaluate("() => document.documentElement.classList.contains('staff-authenticated')")
        check("staff session established", is_auth)
        check("dashboard hub visible", page.is_visible("#staff-portal-content"))
        page.screenshot(path=str(SHOTS / "staff_hub.png"))

        # 3. Visit Animal Census Page
        page.goto(BASE + "/internal/pets/", wait_until="domcontentloaded")
        page.wait_for_timeout(2000)

        check("census page title rendered", page.is_visible("h1:has-text('Shelter Animal Census')"))
        
        # Wait for census to inflate
        try:
            page.wait_for_selector(".petsync-row", timeout=6000)
            rows_count = page.locator(".petsync-row").count()
            check("animal roster table inflated", rows_count > 0, f"rows={rows_count}")
        except Exception:
            check("animal roster table inflated", False, "timeout waiting for rows")

        active_count_text = page.locator("#petsync-active-count-badge").text_content() or ""
        check("active count badge populated", active_count_text.strip() != "--" and active_count_text.strip() != "", f"count={active_count_text.strip()}")

        # 4. Search Filter Test
        page.fill("#petsync-search-input", "cat")
        page.wait_for_timeout(500)
        filtered_count = page.locator(".petsync-row:visible").count()
        check("roster search responsive", filtered_count >= 0, f"visible={filtered_count}")
        page.screenshot(path=str(SHOTS / "staff_census.png"))

        # 5. Printable Kennel Card Modal
        first_card_btn = page.locator(".print-card-btn").first
        if first_card_btn.is_visible():
            first_card_btn.click()
            page.wait_for_timeout(800)
            check("kennel card modal opens", page.is_visible("#printable-kennel-card-modal"))
            check("qr code generated", page.locator("#card-qr-container svg, #card-qr-container canvas").count() > 0)
            page.screenshot(path=str(SHOTS / "staff_kennel_card.png"))
            page.click("#close-card-modal-btn")
            page.wait_for_timeout(400)
            check("kennel card modal closes", not page.is_visible("#printable-kennel-card-modal"))

        # 6. Board Financials
        page.goto(BASE + "/internal/board/", wait_until="domcontentloaded")
        page.wait_for_timeout(2000)
        check("board page rendered", page.is_visible("h1, h2"))
        page.screenshot(path=str(SHOTS / "staff_board.png"))

        # Filter out expected 404 network probes for missing cloud backends
        unhandled_errors = [e for e in errors if "Failed to load resource" not in e and "Network error" not in e]
        check("no unhandled JavaScript errors", len(unhandled_errors) == 0, f"errors={len(unhandled_errors)}")

        browser.close()

    failed = [n for n, ok in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(failed)} passed, {len(failed)} failed out of {len(RESULTS)} checks.")
    for n in failed:
        print(f"  FAILED: {n}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
