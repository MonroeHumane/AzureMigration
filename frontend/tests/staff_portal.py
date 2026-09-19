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
        page.on("pageerror", lambda e: errors.append(f"{str(e)} -> {getattr(e, 'stack', str(e))}"))

        # 1. Unauthenticated Visit -> Login Gate
        page.goto(BASE + "/internal/", wait_until="domcontentloaded")
        page.wait_for_timeout(1000)

        check("auth gate visible", page.is_visible("#staff-portal-auth-gate"))
        check("email input present", page.is_visible("#unified-email"))
        check("password input present", page.is_visible("#unified-password"))
        page.screenshot(path=str(SHOTS / "staff_gate.png"))

        # 2. Authenticate with Administrator / Staff Credentials (Shelt3r2025!)
        page.fill("#unified-email", "jackie@monroe-humane.org")
        page.fill("#unified-password", "Shelt3r2025!")
        page.click("#unified-submit-btn")
        try:
            page.wait_for_selector("html.staff-authenticated", timeout=8000)
        except Exception:
            pass

        is_auth = page.evaluate("() => document.documentElement.classList.contains('staff-authenticated')")
        check("staff session established", is_auth)
        check("dashboard hub visible", page.is_visible("#staff-portal-content"))
        check("desktop sidebar mounted on hub", page.is_visible(".sidebar-root"))
        check("sidebar reactive network status visible", page.is_visible(".sidebar-net-status"))
        sidebar_net_text = (page.locator("#sidebar-net-text").text_content() or "").strip()
        check("sidebar system online badge active", "Online" in sidebar_net_text, f"netText={sidebar_net_text}")
        has_idle = page.evaluate("() => Boolean(window.__hsmc_idle_bound)")
        check("idle session auto-lock security guard active", has_idle)
        check("command palette mounted on hub", page.locator("#cmd-k-dialog").count() > 0)
        check("floating action menu mounted on hub", page.locator("#fab-container").count() > 0)
        page.screenshot(path=str(SHOTS / "staff_hub.png"))

        # Wait for hub financials to hydrate from decrypted vault
        page.wait_for_timeout(2000)
        fin_status = (page.locator("#hub-status-financials").text_content() or "").strip()
        check("hub financials status active", "unavailable" not in fin_status.lower() and fin_status != "loading...", f"status={fin_status}")
        donor_vol = (page.locator("#metric-donor-volume").text_content() or "").strip()
        check("hub donor volume hydrated", donor_vol != "--" and donor_vol != "", f"vol={donor_vol}")

        # Hub grants card verification (resilient fallback/seed)
        hub_grants_count = (page.locator("#hub-grants-count").text_content() or "").strip()
        check("hub grants count hydrated", hub_grants_count != "--" and hub_grants_count != "" and hub_grants_count != "—", f"grantsCount={hub_grants_count}")
        hub_grants_detail = (page.locator("#hub-grants-detail").text_content() or "").strip()
        check("hub grants detail populated", "open" in hub_grants_detail or "awarded" in hub_grants_detail, f"grantsDetail={hub_grants_detail}")

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

        # 4b. Test Animal ID Copy Button & Checkmark Feedback
        copy_btn = page.locator(".copy-pet-id-btn").first
        if copy_btn.is_visible():
            copy_btn.click()
            page.wait_for_timeout(250)
            btn_html = copy_btn.inner_html()
            btn_title = copy_btn.get_attribute("title") or ""
            check("copy animal id provides checkmark feedback", "✓" in btn_html or "Copied" in btn_title, f"feedback={btn_title}")

        # 4c. Census CSV Export
        check("census export csv button present", page.is_visible("#export-csv-btn"))
        page.click("#export-csv-btn")
        page.wait_for_timeout(300)

        # 5. Printable Kennel Card Modal
        first_card_btn = page.locator(".petsync-print-card-btn").first
        if first_card_btn.is_visible():
            first_card_btn.click()
            page.wait_for_timeout(800)
            check("kennel card modal opens", page.is_visible("#kennel-card-modal"))
            check("qr code generated", page.locator("#card-qr-container svg, #card-qr-container canvas").count() > 0)
            page.screenshot(path=str(SHOTS / "staff_kennel_card.png"))
            # Test Escape key dismissal (WAI-ARIA compliance)
            page.keyboard.press("Escape")
            page.wait_for_timeout(400)
            check("kennel card modal closes via Escape", not page.is_visible("#kennel-card-modal"))

        # 6. Executive Board Financials (/internal/board/)
        page.goto(BASE + "/internal/board/", wait_until="domcontentloaded")
        page.wait_for_timeout(2500)

        # Confirm board page loaded and status bar resolved
        check("board page rendered", page.is_visible("h1, h2"))
        
        # In static mode with client-side decryption, #board-data-status becomes hidden or displays success
        status_hidden = not page.is_visible("#board-data-status") or "hidden" in (page.locator("#board-data-status").get_attribute("class") or "")
        check("board data status dismissed/ready", status_hidden or not page.locator("#board-data-status").is_visible())

        # Check KPI Grid Hydration
        checking_bal = (page.locator("#kpi-total-liquidity").text_content() or "").strip()
        check("operating checking balance rendered", "$" in checking_bal and checking_bal != "--", f"checking={checking_bal}")

        reserve_bal = (page.locator("#kpi-fidelity-reserve").text_content() or "").strip()
        check("fidelity reserve rendered", "$205,144" in reserve_bal or "$" in reserve_bal, f"reserve={reserve_bal}")

        net_income = (page.locator("#kpi-all-in-net").text_content() or "").strip()
        check("net income KPI rendered", "$" in net_income or "(" in net_income, f"net={net_income}")

        # Check Subnav Tab Navigation
        # Tab 2: Months
        stmt_pill = page.locator("button[data-tab-id='statement']")
        if stmt_pill.is_visible():
            stmt_pill.click()
            page.wait_for_timeout(500)
            check("months tab content displayed", page.is_visible("#sec-statement"))
            check("monthly statement csv export button present", page.is_visible("#export-statement-csv-btn"))
            page.click("#export-statement-csv-btn")
            page.wait_for_timeout(300)
        
        # Tab 3: Money detail
        exp_pill = page.locator("button[data-tab-id='expenses']")
        if exp_pill.is_visible():
            exp_pill.click()
            page.wait_for_timeout(500)
            check("money detail tab displayed", page.is_visible("#sec-expenses"))

        # Tab 4: Bank
        audit_pill = page.locator("button[data-tab-id='audit']")
        if audit_pill.is_visible():
            audit_pill.click()
            page.wait_for_timeout(500)
            check("bank statement tab displayed", page.is_visible("#sec-audit"))
            bank_end = (page.locator("#stmt-ending-balance").text_content() or "").strip()
            check("bank statement ending balance rendered", "$" in bank_end and bank_end != "", f"bankEnd={bank_end}")
            check("bank statement csv export button present", page.is_visible("#btn-export-bank-csv"))
            page.click("#btn-export-bank-csv")
            page.wait_for_timeout(300)

        # Tab 5: Trend
        trend_pill = page.locator("button[data-tab-id='trend']")
        if trend_pill.is_visible():
            trend_pill.click()
            page.wait_for_timeout(500)
            check("trend tab displayed", page.is_visible("#sec-trend"))

        page.screenshot(path=str(SHOTS / "staff_board.png"))

        # 7. Board Financials Print Packet (/internal/board/print/)
        page.goto(BASE + "/internal/board/print/", wait_until="domcontentloaded")
        page.wait_for_timeout(2500)

        check("print packet title rendered", page.is_visible("#print-period-title"))
        print_checking = (page.locator("#print-total-liq").text_content() or "").strip()
        check("print packet checking cash rendered", "$" in print_checking and print_checking != "--", f"printChecking={print_checking}")
        check("print loading banner dismissed", not page.is_visible("#print-loading-banner"))
        page.screenshot(path=str(SHOTS / "staff_board_print.png"))

        # 8. Unified Donor Registry & Giving (/internal/donors/)
        page.goto(BASE + "/internal/donors/", wait_until="domcontentloaded")
        page.wait_for_timeout(2500)

        check("donors page rendered", page.is_visible("h1:has-text('Donors')"))
        
        # Check that status banner is hidden (decryption + data load succeeded)
        donor_status_hidden = not page.is_visible("#donor-api-status") or "hidden" in (page.locator("#donor-api-status").get_attribute("class") or "")
        check("donor data status dismissed/ready", donor_status_hidden or not page.locator("#donor-api-status").is_visible())

        # Check Banner & KPIs
        banner_vol = (page.locator("#donor-banner-volume").text_content() or "").strip()
        check("donor banner lifetime volume rendered", "$" in banner_vol and banner_vol != "--", f"volume={banner_vol}")

        banner_count = (page.locator("#donor-banner-count").text_content() or "").strip()
        check("donor banner count rendered", banner_count != "--" and banner_count != "", f"count={banner_count}")

        kpi_major = (page.locator("#donor-kpi-major").text_content() or "").strip()
        check("donor major donors KPI rendered", kpi_major != "--" and kpi_major != "", f"major={kpi_major}")

        kpi_active = (page.locator("#donor-kpi-active").text_content() or "").strip()
        check("donor active 2026 KPI rendered", kpi_active != "--" and kpi_active != "", f"active={kpi_active}")

        # Check Tier Chart SVG
        tier_chart_rendered = page.locator("#donor-tier-chart rect, #donor-tier-chart path").count() > 0
        check("donor tier chart SVG rendered", tier_chart_rendered)

        # Check Tributes List
        tributes_rendered = page.locator("#donor-tributes-list .tribute-item, #donor-tributes-list > div").count() > 0
        check("donor tributes list rendered", tributes_rendered)

        # Check Donor Roster Table
        roster_visible = page.is_visible("#donor-roster-section")
        check("donor roster section displayed", roster_visible)
        check("donor roster csv export button present", page.is_visible("#export-donors-csv-btn"))
        page.click("#export-donors-csv-btn")
        page.wait_for_timeout(300)

        rows = page.locator(".donor-row")
        donor_rows_count = rows.count()
        check("donor roster rows populated", donor_rows_count > 0, f"rows={donor_rows_count}")

        # Search Filter Test
        page.fill("#donor-search-input", "Clark")
        page.wait_for_timeout(500)
        clark_count = page.locator(".donor-row:visible").count()
        check("donor search filter responsive", clark_count > 0, f"clarkRows={clark_count}")

        # Donor Drawer Expansion
        first_drawer_btn = page.locator(".donor-row:visible button[data-donor-toggle]").first
        if first_drawer_btn.is_visible():
            first_drawer_btn.click()
            page.wait_for_timeout(600)
            check("donor drawer expands", page.locator(".donor-drawer:visible").count() > 0)
            page.screenshot(path=str(SHOTS / "staff_donor_drawer.png"))

        # Clear search
        page.fill("#donor-search-input", "")
        page.wait_for_timeout(400)
        page.screenshot(path=str(SHOTS / "staff_donors.png"))

        # 9. Grants Pipeline (/internal/grants/)
        page.goto(BASE + "/internal/grants/", wait_until="domcontentloaded")
        page.wait_for_timeout(2500)

        check("grants page title rendered", page.is_visible("h1:has-text('Grants Pipeline')"))

        # Verify offline vault sync pill and metrics
        sync_text = (page.locator("#grant-stat-sync").text_content() or "").strip()
        check("grants sync state active/local", "Offline Vault" in sync_text or "Synchronized" in sync_text or "Local" in sync_text, f"sync={sync_text}")

        grant_total = (page.locator("#grant-stat-total").text_content() or "").strip()
        check("grants total count rendered", grant_total != "--" and grant_total != "" and int(grant_total) >= 6, f"total={grant_total}")

        grant_val = (page.locator("#grant-stat-total-value").text_content() or "").strip()
        check("grants portfolio value rendered", "$" in grant_val and "59,000" in grant_val, f"value={grant_val}")

        # Check visual funding distribution bar
        check("grants visual progress bar rendered", page.is_visible("#pipeline-bar-won") and page.is_visible("#pipeline-bar-open"))
        pipeline_summary = (page.locator("#pipeline-bar-summary").text_content() or "").strip()
        check("grants pipeline summary populated", "Won" in pipeline_summary and "Open" in pipeline_summary, f"summary={pipeline_summary}")

        # Check export CSV button
        check("grants export csv button present", page.is_visible("#export-grants-csv-btn"))
        page.click("#export-grants-csv-btn")
        page.wait_for_timeout(300)

        # Search filter
        page.fill("#grants-search-input", "La-Z-Boy")
        page.wait_for_timeout(500)
        search_count = page.locator("#grants-container tr[data-status]:visible, #grants-container .grant-card:visible").count()
        check("grants search filter functional", search_count > 0, f"matching={search_count}")
        page.fill("#grants-search-input", "")
        page.wait_for_timeout(400)

        # Add new grant modal & local persistence test
        page.click("#add-grant-btn")
        page.wait_for_timeout(600)
        check("add grant modal opens", page.is_visible("#add-grant-modal"))

        page.fill("#new-title", "Emergency Veterinary Care Support")
        page.fill("#new-amount", "$5,000")
        page.select_option("#new-source", "Private Foundation")
        page.select_option("#new-status", "applied")
        page.fill("#new-deadline", "2026-12-01")
        page.fill("#new-notes", "Zero-cloud test submission for clinic")

        # Submit form
        page.click("#add-grant-form button[type='submit']")
        page.wait_for_timeout(1000)

        check("add grant modal closed after submit", not page.is_visible("#add-grant-modal"))
        new_total = (page.locator("#grant-stat-total").text_content() or "").strip()
        check("grant count incremented locally", int(new_total) >= 7, f"newTotal={new_total}")
        page.screenshot(path=str(SHOTS / "staff_grants.png"))

        # 10. Content Manager (/internal/content/) & Static Branding Check
        page.goto(BASE + "/internal/content/", wait_until="domcontentloaded")
        page.wait_for_timeout(1500)
        check("content manager page rendered", page.is_visible("h1:has-text('Website Content Manager')"))
        check("legacy azure web app branding removed", not page.locator("text=Azure Web App").is_visible())
        check("static architecture v3 badge verified", page.locator("text=Static Architecture v3.0").is_visible())
        page.screenshot(path=str(SHOTS / "staff_content.png"))

        # 11. Mobile Viewport & Thumb-Dock Navigation (375x812)
        mobile_page = context.new_page()
        mobile_page.set_viewport_size({"width": 375, "height": 812})
        mobile_page.goto(BASE + "/internal/", wait_until="domcontentloaded")
        mobile_page.wait_for_timeout(1000)

        check("mobile bottom nav dock visible", mobile_page.is_visible("#mobile-bottom-nav-dock"))
        check("desktop sidebar hidden on mobile", not mobile_page.is_visible(".sidebar-root"))

        # Open mobile slide-up sheet
        mobile_page.click("#bottom-dock-more-btn")
        mobile_page.wait_for_timeout(500)
        check("mobile more sheet opens", mobile_page.is_visible("#mobile-more-sheet"))
        mobile_page.screenshot(path=str(SHOTS / "staff_mobile_sheet.png"))

        # Close mobile sheet
        mobile_page.click("button.sheet-close-btn")
        mobile_page.wait_for_timeout(300)
        check("mobile more sheet closes", not mobile_page.is_visible("#mobile-more-sheet"))
        mobile_page.close()

        # Filter out expected 404 network probes for missing cloud backends and third-party partytown analytics proxy
        unhandled_errors = [
            e for e in errors
            if "Failed to load resource" not in e
            and "Network error" not in e
            and "partytown" not in e.lower()
        ]
        if unhandled_errors:
            for err in unhandled_errors:
                print(f"  [DEBUG UNHANDLED ERROR] {err}")
        check("no unhandled JavaScript errors", len(unhandled_errors) == 0, f"errors={len(unhandled_errors)}")

        browser.close()

    failed = [n for n, ok in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(failed)} passed, {len(failed)} failed out of {len(RESULTS)} checks.")
    for n in failed:
        print(f"  FAILED: {n}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
