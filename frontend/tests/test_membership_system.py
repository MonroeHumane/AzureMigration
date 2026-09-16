"""
Test Suite for Monroe Humane 2026 Membership Program & Content Manager Toggle System
"""
import json
import os
import re
import urllib.request

BASE_URL = "http://127.0.0.1:4321"

def test_membership_json_config():
    config_path = os.path.join(os.path.dirname(__file__), "..", "src", "data", "membership.json")
    assert os.path.exists(config_path), "membership.json must exist"
    with open(config_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert data.get("enabled") is True, "Default enabled must be True"
    assert "Kitty Circle" in data.get("tiers", {}).get("kitty-circle", {}).get("name", "")
    assert "The Saint Bernard Society" in data.get("tiers", {}).get("saint-bernard", {}).get("name", "")
    assert "Lifetime Guardian" in data.get("tiers", {}).get("lifetime-guardian", {}).get("name", "")
    assert "zeffy.com" in data.get("zeffyUrl", ""), "zeffyUrl must be configured"
    print("PASS: test_membership_json_config")

def test_membership_page_served():
    url = f"{BASE_URL}/membership"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    res = urllib.request.urlopen(req)
    assert res.status == 200, f"Expected 200 from {url}, got {res.status}"
    html = res.read().decode("utf-8")
    
    # Verify 5 Tiers
    assert "Kitty Circle" in html
    assert "Beagle Buddies" in html
    assert "Spaniel Squad" in html
    assert "The Saint Bernard Society" in html
    assert "Lifetime Guardian" in html
    
    # Verify Pricing
    assert "$60+" in html
    assert "$120+" in html
    assert "$240+" in html
    assert "$480+" in html
    assert "$10,000+" in html
    
    # Verify Dual States
    assert "data-membership-active" in html
    assert "data-membership-paused" in html
    
    # Verify Interactive Toggles & Badges
    assert "btn-toggle-annual" in html
    assert "btn-toggle-monthly" in html
    assert "data-membership-status-pill" in html
    assert "data-zeffy-membership-link" in html
    
    # Verify T-shirt Contest Winners
    assert "Connie Gotz" in html
    assert "Rylee Dunn" in html
    assert "Bailey Mruzik" in html
    
    # Verify Wayfinding
    assert "link-shelter-resources" in html
    assert "link-other-ways-give" in html
    print("PASS: test_membership_page_served")

def test_content_manager_controls():
    url = f"{BASE_URL}/internal/content/"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    res = urllib.request.urlopen(req)
    assert res.status == 200, f"Expected 200 from {url}, got {res.status}"
    html = res.read().decode("utf-8")
    
    # Verify Tab & Pane
    assert 'data-tab-target="membership"' in html
    assert 'id="pane-membership"' in html
    assert 'id="membership-tab-status-pill"' in html
    
    # Verify Controls
    assert 'id="input-membership-master-toggle"' in html
    assert 'id="input-membership-zeffy-url"' in html
    assert 'id="membership-live-badge"' in html
    assert 'id="btn-save-membership"' in html
    assert 'id="btn-reset-membership"' in html
    
    # Verify Tier Toggles
    assert 'id="tier-toggle-kitty-circle"' in html
    assert 'id="tier-toggle-beagle-buddies"' in html
    assert 'id="tier-toggle-spaniel-squad"' in html
    assert 'id="tier-toggle-saint-bernard"' in html
    assert 'id="tier-toggle-lifetime-guardian"' in html
    print("PASS: test_content_manager_controls")

def test_site_wide_toggle_selectors():
    pages = [
        ("/", ["data-nav-membership", "data-footer-membership", "data-bottom-sheet-membership", "data-home-membership-active", "data-home-membership-paused"]),
        ("/donate", ["data-donate-membership"]),
        ("/resources", ["data-resources-membership"]),
    ]
    for path, selectors in pages:
        url = f"{BASE_URL}{path}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        res = urllib.request.urlopen(req)
        assert res.status == 200, f"Expected 200 from {url}"
        html = res.read().decode("utf-8")
        for sel in selectors:
            assert sel in html, f"Selector {sel} missing on {path}"
    print("PASS: test_site_wide_toggle_selectors")

if __name__ == "__main__":
    test_membership_json_config()
    test_membership_page_served()
    test_content_manager_controls()
    test_site_wide_toggle_selectors()
    print("\nALL 4 TEST SUITES PASSED PERFECTLY!")
