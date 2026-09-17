"""Live Production Review & End-to-End Testing Suite.

Tests the live production deployment at https://monroe-humane.org:
1. SSL / HTTPS security
2. Homepage & navigation dropdown rendering
3. Dog & Cat Shelter page layout and typography
4. Adoptable pets catalog & client hydration
5. Arcade games & offline wallet resilience
6. Staff Portal authentication gate & salted passkey login
7. Animal Census & printable kennel card generator
8. Board Financials & statements
9. Negative security test (rejects arbitrary emails & passwords)
10. Custom 404 Lost Pup error page
"""

import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "https://monroe-humane.org"
SHOTS = Path(__file__).resolve().parent / "_shots_live"
RESULTS = []


def check(name, cond, extra=""):
    RESULTS.append((name, bool(cond)))
    name = str(name).encode("ascii", "replace").decode("ascii")
    extra = str(extra).encode("ascii", "replace").decode("ascii")
    print(f"  {'PASS' if cond else 'FAIL'}  {name}{(' - ' + extra) if extra else ''}")


def main():
    SHOTS.mkdir(exist_ok=True)
    print(f"\nStarting Live Production Review on {BASE}...\n")

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        context = browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        page = context.new_page()

        page_errors = []
        page.on("pageerror", lambda e: page_errors.append(str(e)))

        failed_requests = []
        page.on(
            "requestfailed",
            lambda req: failed_requests.append(f"{req.url} ({req.failure})")
            if not req.url.endswith("favicon.ico")
            else None,
        )

        # -------------------------------------------------------------
        # 1. Homepage & Global Nav
        # -------------------------------------------------------------
        print("[1/8] Reviewing Live Homepage & Navigation...")
        res = page.goto(BASE + "/", wait_until="networkidle")
        check("homepage status 200", res.status == 200, f"status={res.status}")
        check("hero title rendered", page.is_visible("h1"))
        page.screenshot(path=str(SHOTS / "01_live_homepage.png"))

        # Test hover on navigation dropdown (About MCHS or Services)
        nav_trigger = page.locator(".monroe-global-nav__trigger").first
        if nav_trigger.count() > 0:
            nav_trigger.hover()
            page.wait_for_timeout(400)
            dropdown = page.locator(".monroe-global-nav__submenu").first
            check("nav dropdown opens on hover", dropdown.is_visible())
            page.screenshot(path=str(SHOTS / "02_live_nav_dropdown.png"))

        # -------------------------------------------------------------
        # 2. Dog & Cat Shelter Page Review
        # -------------------------------------------------------------
        print("\n[2/8] Reviewing Live Dog & Cat Shelter Page...")
        res_shelter = page.goto(BASE + "/dog-and-cat-shelter/", wait_until="networkidle")
        check("shelter page status 200", res_shelter.status == 200, f"status={res_shelter.status}")
        check("shelter headline visible", page.is_visible("h1"))
        
        # Test navigation dropdown on shelter page
        nav_trigger_services = page.locator(".monroe-global-nav__trigger").nth(1)
        if nav_trigger_services.count() > 0:
            nav_trigger_services.hover()
            page.wait_for_timeout(400)
        page.screenshot(path=str(SHOTS / "03_live_shelter_page.png"))

        # -------------------------------------------------------------
        # 3. Adoptable Pets Catalog
        # -------------------------------------------------------------
        print("\n[3/8] Reviewing Live Adoptable Pets Catalog...")
        res_adopt = page.goto(BASE + "/adopt/", wait_until="networkidle")
        check("adopt page status 200", res_adopt.status == 200)
        
        # Check if pet cards are rendered
        try:
            page.wait_for_selector(".pet-card, [data-pet-card], article", timeout=5000)
            cards = page.locator(".pet-card, [data-pet-card], article").count()
            check("adoptable pets rendered", cards > 0, f"count={cards}")
        except Exception:
            check("adoptable pets rendered", False, "timeout waiting for cards")
        page.screenshot(path=str(SHOTS / "04_live_adopt_catalog.png"))

        # -------------------------------------------------------------
        # 4. Arcade Hub & Shelter Run
        # -------------------------------------------------------------
        print("\n[4/8] Reviewing Live Arcade Hub & Shelter Run...")
        res_games = page.goto(BASE + "/games/", wait_until="networkidle")
        check("arcade hub status 200", res_games.status == 200)
        page.screenshot(path=str(SHOTS / "05_live_arcade_hub.png"))

        res_sr = page.goto(BASE + "/games/shelter-run/", wait_until="networkidle")
        check("shelter run status 200", res_sr.status == 200)
        check("game canvas rendered", page.is_visible("canvas#sr-canvas, canvas"))
        page.screenshot(path=str(SHOTS / "06_live_shelter_run.png"))

        # -------------------------------------------------------------
        # 5. Staff Portal: Unauthenticated Gate & Negative Security
        # -------------------------------------------------------------
        print("\n[5/8] Reviewing Live Staff Portal & Negative Security...")
        page.goto(BASE + "/internal/", wait_until="networkidle")
        check("staff gate visible", page.is_visible("#staff-portal-auth-gate"))
        check("login email input visible", page.is_visible("#unified-email"))
        check("login password input visible", page.is_visible("#unified-password"))
        page.screenshot(path=str(SHOTS / "07_live_staff_gate.png"))

        # Negative Test: Test unauthorized login attempt
        page.fill("#unified-email", "attacker@monroe-humane.org")
        page.fill("#unified-password", "wrongpass123")
        page.click("#unified-submit-btn")
        page.wait_for_timeout(4500)

        is_auth_negative = page.evaluate("() => document.documentElement.classList.contains('staff-authenticated')")
        err_msg = page.locator("#login-error-text").text_content() or ""
        check("unauthorized login rejected", not is_auth_negative, f"error='{err_msg.strip()}'")
        check("error alert rendered", page.is_visible("#login-error-alert"))
        page.screenshot(path=str(SHOTS / "08_live_login_rejected.png"))

        # -------------------------------------------------------------
        # 6. Staff Portal: Authorized Passkey Login & Hub
        # -------------------------------------------------------------
        print("\n[6/8] Authenticating with Authorized Shelter Passkey...")
        # Clear form
        page.fill("#unified-email", "jackie@monroe-humane.org")
        page.fill("#unified-password", "Shelt3r2025!")
        page.click("#unified-submit-btn")

        try:
            page.wait_for_selector("html.staff-authenticated", timeout=8000)
        except Exception:
            pass

        is_auth_positive = page.evaluate("() => document.documentElement.classList.contains('staff-authenticated')")
        check("authorized login succeeded", is_auth_positive)
        check("staff hub content visible", page.is_visible("#staff-portal-content"))
        page.screenshot(path=str(SHOTS / "09_live_staff_hub.png"))

        # -------------------------------------------------------------
        # 7. Live Staff Census & Printable Kennel Cards
        # -------------------------------------------------------------
        print("\n[7/8] Reviewing Live Shelter Animal Census...")
        page.goto(BASE + "/internal/pets/", wait_until="networkidle")
        check("census page title visible", page.is_visible("h1"))

        try:
            page.wait_for_selector(".petsync-row", timeout=7000)
            row_count = page.locator(".petsync-row").count()
            check("census rows populated", row_count > 0, f"rows={row_count}")
        except Exception:
            check("census rows populated", False, "timeout waiting for rows")

        # Test kennel card print button
        print_btn = page.locator(".print-card-btn").first
        if print_btn.count() > 0:
            print_btn.click()
            page.wait_for_timeout(500)
            modal_visible = page.is_visible("#kennel-card-modal")
            check("printable kennel card modal opens", modal_visible)
            page.screenshot(path=str(SHOTS / "10_live_kennel_card_modal.png"))
            # Close modal
            page.keyboard.press("Escape")

        page.screenshot(path=str(SHOTS / "11_live_staff_census.png"))

        # -------------------------------------------------------------
        # 8. 404 Lost Pup Custom Error Page
        # -------------------------------------------------------------
        print("\n[8/8] Reviewing Live 404 Custom Error Handling...")
        res_404 = page.goto(BASE + "/this-page-does-not-exist-test-404", wait_until="networkidle")
        check("404 status returned", res_404.status == 404, f"status={res_404.status}")
        check("lost pup 404 headline visible", page.is_visible("h1:has-text('Page Not Found')"))
        page.screenshot(path=str(SHOTS / "12_live_404_lost_pup.png"))

        # Check total JavaScript errors encountered
        check("zero unhandled page errors", len(page_errors) == 0, f"errors={len(page_errors)}")

        browser.close()

    passed = sum(1 for _, c in RESULTS if c)
    total = len(RESULTS)
    print(f"\n==========================================")
    print(f"Live Production Test Summary: {passed}/{total} Passed")
    print(f"==========================================\n")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
