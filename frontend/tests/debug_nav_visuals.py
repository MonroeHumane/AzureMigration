"""Script to capture desktop and mobile dropdown navigation screenshots."""
import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8399"
SHOTS_DIR = Path(__file__).resolve().parent / "_shots" / "nav_debug"
SHOTS_DIR.mkdir(parents=True, exist_ok=True)

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)

        # 1. Desktop Nav & Dropdowns
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        page.goto(f"{BASE}/dog-and-cat-shelter/", wait_until="networkidle")
        time.sleep(1)

        # Base page screenshot
        page.screenshot(path=str(SHOTS_DIR / "desktop_dog_shelter_fixed.png"))
        print("Captured desktop_dog_shelter_fixed.png")

        # Dropdown test items
        nav_children = page.locator(".monroe-global-nav__panel > .monroe-global-nav__list > .monroe-global-nav__item.has-children").all()
        names = ["services", "adopt", "resources", "events", "donations"]
        for i, item in enumerate(nav_children):
            name = names[i] if i < len(names) else f"item_{i}"
            item.hover()
            time.sleep(0.4)
            page.screenshot(path=str(SHOTS_DIR / f"desktop_{name}_fixed.png"))
            print(f"Captured desktop_{name}_fixed.png")

        # Also test on /resources to verify is-current split pill
        page.goto(f"{BASE}/resources/", wait_until="networkidle")
        time.sleep(0.5)
        page.screenshot(path=str(SHOTS_DIR / "desktop_resources_active_pill.png"))
        print("Captured desktop_resources_active_pill.png")

        # 2. Mobile Bottom Sheet Test
        mobile_page = browser.new_page(viewport={"width": 390, "height": 844})
        mobile_page.goto(f"{BASE}/dog-and-cat-shelter/", wait_until="networkidle")
        time.sleep(0.5)
        mobile_page.screenshot(path=str(SHOTS_DIR / "mobile_dog_shelter_fixed.png"))
        print("Captured mobile_dog_shelter_fixed.png")

        # Click #bottom-tab-menu-btn
        more_btn = mobile_page.locator("#bottom-tab-menu-btn")
        if more_btn.is_visible():
            more_btn.click()
            time.sleep(0.5)
            mobile_page.screenshot(path=str(SHOTS_DIR / "mobile_bottom_sheet_open.png"))
            print("Captured mobile_bottom_sheet_open.png")

        browser.close()
        print("All screenshots successfully captured.")

if __name__ == "__main__":
    main()
