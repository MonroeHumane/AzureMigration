import sys
from playwright.sync_api import sync_playwright

def test_homepage_accomplishments():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        page = browser.new_page()
        page.goto('http://localhost:8399/', wait_until='domcontentloaded')

        # 1. Verify Alpine is NOT present
        has_alpine = page.evaluate("() => typeof window.Alpine !== 'undefined'")
        assert not has_alpine, "Alpine.js should not be defined on window!"
        print("[PASS] Alpine.js is completely absent from window.Alpine")

        # 2. Check widget visibility
        widget = page.locator('[data-monroe-accomplishments-widget]')
        assert widget.is_visible(), "Accomplishments widget must be visible"

        # 3. Check tab 2025 click
        tab_2025 = page.locator('#monroe-accomplishments-tab-2025')
        assert tab_2025.is_visible()
        tab_2025.click()
        assert tab_2025.get_attribute('aria-selected') == 'true'
        panel_2025 = page.locator('#monroe-accomplishments-panel-2025')
        assert panel_2025.is_visible(), "2025 panel must be visible"
        print("[PASS] 2025 tab clicked and panel displayed")

        # 4. Check tab 2024 click
        tab_2024 = page.locator('#monroe-accomplishments-tab-2024')
        assert tab_2024.is_visible()
        tab_2024.click()
        assert tab_2024.get_attribute('aria-selected') == 'true'
        panel_2024 = page.locator('#monroe-accomplishments-panel-2024')
        assert panel_2024.is_visible(), "2024 panel must be visible"
        print("[PASS] 2024 tab clicked and panel displayed")

        # 5. Click back to 2025
        tab_2025.click()
        assert tab_2025.get_attribute('aria-selected') == 'true'
        assert panel_2025.is_visible()
        print("[PASS] 2025 tab toggled back cleanly")

        # 6. Capture screenshot
        page.screenshot(path='C:/Users/Jeff/.gemini/antigravity-ide/brain/c5a81bad-01e0-4c71-827e-995b6e97f71d/home_accomplishments_vanilla.png')
        print("[PASS] Screenshot saved to artifacts directory")

        browser.close()

if __name__ == '__main__':
    test_homepage_accomplishments()
    print("ALL CHECKS PASSED FOR PHASE 1 HOMEPAGE REFACTOR!")
