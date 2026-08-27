#!/usr/bin/env python3
"""One-command parity check for the rebuilt site.

1. Fetches every route, asserts HTTP 200 (or expected non-200) and that the
   page carries its expected class signatures (derived from the mirror).
2. Crawls each page for internal href/src and reports 404 assets/links.
3. Sweeps for WP artifacts and Tailwind utility classes that must not ship.

Usage: python verify-parity.py [base_url]
"""
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4321"

# route -> (expected status, class signatures that must appear)
ROUTES = {
    "/": (200, ["home-editable-hero", "monroe-vote-ways", "pet-card-widget", "hs-hero-fence-widget",
                "logo-track", "monroe-membership-under-construction", "pp-cta-btn", "offline-donations",
                "home-editable-social-embed", "hs-news-2025review", "home-editable-faq-grid",
                "monroe-accomplishments-widget", "home-editable-games-teasers", "monroe-contact-form"]),
    "/adopt": (200, ["monroe-adopt-page", "monroe-adopt-hero", "animal-search-widget", "animal-card"]),
    "/adopt/dogs": (200, ["monroe-adopt-page", "animal-search-widget"]),
    "/adopt/cats": (200, ["monroe-adopt-page", "animal-search-widget"]),
    "/adoptions": (200, ["monroe-adoptions-page", "monroe-adoptions-checklist", "monroe-google-form-embed"]),
    "/dog-and-cat-shelter": (200, ["monroe-native-inner--dog-and-cat-shelter", "monroe-day-in-life", "monroe-trust-row"]),
    "/memorials": (200, ["monroe-memorial-tribute-page", "monroe-tribute-plaque", "monroe-tribute-azrail"]),
    "/memorials/give": (200, ["monroe-memorials-page", "monroe-memorials-hero", "monroe-memorials-planned"]),
    "/events": (200, ["monroe-events", "event-flyer"]),
    "/games": (200, ["monroe-games-page"]),
    "/newsletter": (200, ["monroe-native-inner--newsletter", "monroe-newsletter-archive__grid"]),
    "/newsletter/issue/2025-in-review": (200, ["hs-news-section"]),
    "/shop": (200, ["monroe-shop-page", "monroe-shop-product-card", "monroe-shop-under-construction"]),
    "/specialsponsors": (200, ["monroe-native-inner--specialsponsors", "monroe-native-hero"]),
    "/resources": (200, ["monroe-native-inner--resources"]),
    "/donate": (200, ["monroe-native-inner--donate-now", "monroe-membership" ]),
    "/volunteer-form": (200, ["monroe-native-inner--volunteer-form", "monroe-google-form-embed"]),
    "/membership": (200, ["monroe-native-inner--membership", "monroe-membership-under-construction"]),
    "/auction-in-april-2025": (200, ["monroe-native-hero"]),
    "/adoptions/": (200, None),
    "/404": (404, None),
}

BAD_PATTERNS = {
    "WP nonce": r'name="[^"]*nonce',
    "WP referer": "_wp_http_referer",
    "unresolved ../ link": r'href="\.\./',
    "non-localized wp-content URL": r'(href|src)="(https?://monroe-humane\.org|/wp-content|\.\.)[^"]*wp-content',
    "alert( stub": r"alert\(",
}

TAILWIND_TOKENS = {"flex", "grid", "hidden", "container", "aspect-square"}

def tailwind_classes(body: str) -> list:
    found = []
    for m in re.finditer(r'class="([^"]+)"', body):
        for token in m.group(1).split():
            if token in TAILWIND_TOKENS or re.match(r"^(bg|text|px|py|pt|pb|mx|my|mt|mb|max-w|min-w|w|h|rounded|border|font|space|tracking|leading|items|justify|gap|grid-cols|col-span|sm:|md:|lg:|xl:)-", token):
                found.append(token)
    return found


def fetch(url):
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, r.read().decode("utf-8", "replace"), r.geturl()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace") if e.fp else "", url
    except Exception as e:
        return 0, str(e), url


def head(url):
    try:
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0


def main():
    failures = 0
    asset_cache = {}

    def check_route(route):
        nonlocal failures
        expect_status, sigs = ROUTES[route]
        status, body, _ = fetch(BASE + route)
        problems = []
        if status != expect_status:
            problems.append(f"status {status} != {expect_status}")
        if sigs:
            for sig in sigs:
                if sig not in body:
                    problems.append(f"missing signature: {sig}")
        for name, pat in BAD_PATTERNS.items():
            if re.search(pat, body):
                problems.append(f"artifact: {name}")
        tw = tailwind_classes(body)
        if tw:
            problems.append(f"artifact: Tailwind utility classes ({tw[:4]})")
        # Check internal links/assets resolve.
        for url in set(re.findall(r'(?:href|src)="(/[^"]+)"', body)):
            if url.startswith(("/@vite", "/src/", "/node_modules")):
                continue  # dev-server HMR/module paths, absent in production builds
            if url.startswith("//"):
                continue
            target = url.split("#")[0]
            if not target:
                continue
            if target not in asset_cache:
                asset_cache[target] = head(BASE + target)
            if asset_cache[target] in (404, 0):
                problems.append(f"broken internal ref: {url} ({asset_cache[target]})")
        status_line = "OK  " if not problems else "FAIL"
        if problems:
            failures += 1
        print(f"{status_line} {route or '/'}")
        for p in problems:
            print(f"       - {p}")

    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(check_route, ROUTES))

    print(f"\n{'ALL CHECKS PASSED' if failures == 0 else f'{failures} route(s) failed'}")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
