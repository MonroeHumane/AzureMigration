#!/usr/bin/env python3
"""Extract homepage-needed rules from the monroe-rebuild theme CSS into a
clean Astro stylesheet. Parses top-level rules (recursing into @media),
keeps rules matching homepage section families, drops deadweight families,
and strips WP body-class scoping prefixes."""
import re
import sys

SRC_HOME = r"C:/Users/Jeff/Documents/GitHub/Humanewebsite/wordpress-rebuild/theme/monroe-rebuild/assets/home-editable.css"
SRC_WIDGETS = r"C:/Users/Jeff/Documents/GitHub/Humanewebsite/wordpress-rebuild/theme/monroe-rebuild/assets/home-embed-widgets.css"

INCLUDE = [
    "home-editable-", "hs-feature-widget", "hs-wrap", "hs-copy", "hs-kicker",
    "hs-deadline", "hs-body", "hs-note", "hs-actions", "hs-btn", "hs-voting",
    "monroe-vote-ways", "sponsor-widget", "sponsor-grid", "sponsor-card",
    "logo-slider", "logo-track", "logo-set", "monroe-accomplishments",
    "monroe-contact-form", "monroe-membership-under-construction",
    "monroe-membership-plans-shared", "offline-donations", "pp-giving",
    "pp-widget-header", "pp-content", "pp-icon", "pp-cta", "monroe-testimonials",
    "hs-news", "hs-lightbox", "hs-letter", "hs-card", "hs-hero", "hs-head",
    "hs-grid", "hs-box", "hs-gallery", "hs-thumb", "hs-expand", "hs-title",
    "hs-sub", "hs-eyebrow", "hs-improvements", "hs-lb",
]
EXCLUDE = [
    "monroe-animal-search", "monroe-adopt", "adopt-page", "memorial",
    "tribute", "monroe-shelter", "dog-and-cat-shelter", "shelter-hero",
    "artwork-contest", "monroe-artwork", "staff-", "content-hub", "admin",
    "event-flyer", "monroe-events", "newsletter-archive", "monroe-inner-page",
    "shop", "search-widget", "petango", "monroe-pet", "wp-block-embed",
]

SCOPE_STRIP = [
    (re.compile(r'body\.page-slug-home-editable(\.monroe-rebuild-(?:no|has)-runtime)?\s*'), ''),
    (re.compile(r'body\[data-page-alias="home-editable"\](\.monroe-rebuild-(?:no|has)-runtime)?\s*'), ''),
    (re.compile(r'body\.monroe-rebuild-theme\s*'), ''),
    (re.compile(r'(?<![/\w])\.page-slug-home-editable\s*'), ''),
]


def parse(css):
    rules, i, n = [], 0, len(css)
    while i < n:
        j = css.find("{", i)
        if j < 0:
            break
        prelude = css[i:j].strip()
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == "{":
                depth += 1
            elif css[k] == "}":
                depth -= 1
            k += 1
        rules.append((prelude, css[j + 1 : k - 1]))
        i = k
    return rules


def wanted(selector):
    sel = selector.lower()
    if not sel or sel.startswith("/*"):
        return False
    if any(x in sel for x in EXCLUDE):
        return False
    if any(x in sel for x in INCLUDE):
        return True
    # keyframes / font-face referenced by kept rules, and bare body/html resets
    if sel.startswith("@keyframes") or sel.startswith("@font-face"):
        return True
    return False


def clean(text):
    for rx, repl in SCOPE_STRIP:
        text = rx.sub(repl, text)
    return text


def convert(src, out_path, header, keep_all=False):
    out = [header]
    kept = 0
    for prelude, body in parse(open(src, encoding="utf-8").read()):
        if prelude.startswith("@media"):
            inner_kept = [
                clean(p + " {" + b + "}") for p, b in parse(body) if keep_all or wanted(p)
            ]
            if inner_kept:
                out.append(clean(prelude) + " {\n" + "\n".join(inner_kept) + "\n}")
                kept += len(inner_kept)
        elif keep_all or wanted(prelude):
            out.append(clean(prelude) + " {" + body + "}")
            kept += 1
    open(out_path, "w", encoding="utf-8", newline="\n").write("\n\n".join(out) + "\n")
    print(f"{out_path}: {kept} rules")


HEADER_HOME = """/*
 Homepage styles — Astro port of the monroe-rebuild theme's home-editable.css.
 Machine-extracted: rules matching the homepage section families only; the
 adopt-search / memorial / shelter / contest / shop / admin families stay with
 their own per-page stylesheets. WP body-class scoping stripped (the homepage
 <body> carries `monroe-rebuild-theme home-editable-has-flyers-rail`).
 Generated from the theme source 2026-08-27 — re-run tools/extract-home-css.py
 if the theme changes.
*/"""

HEADER_WIDGETS = """/*
 Homepage embed widgets — Astro port of the theme's home-embed-widgets.css:
 hs-feature-widget (events band + Hero Fence), sponsor widgets (vet partners,
 auction five), the 2025-in-Review newsletter card + lightbox, the featured
 pets widget, and the Trustindex testimonials container.
*/"""

# home-embed-widgets.css is homepage-only by design; keep every rule.
convert(SRC_WIDGETS, r"C:/Users/Jeff/Documents/AzureMigration/frontend/src/styles/monroe-home-widgets.css", HEADER_WIDGETS, keep_all=True)
convert(SRC_HOME, r"C:/Users/Jeff/Documents/AzureMigration/frontend/src/styles/monroe-home.css", HEADER_HOME)

# ---- Per-page stylesheets (self-contained, keep everything) ----
ASSETS = r"C:/Users/Jeff/Documents/GitHub/Humanewebsite/wordpress-rebuild/theme/monroe-rebuild/assets"
STYLES = r"C:/Users/Jeff/Documents/AzureMigration/frontend/src/styles"
PAGES = [
    ("adopt-page.css", "monroe-adopt.css",
     "Adopt page — port of the theme's adopt-page.css (renewed adopt landing: hero, quick pills, search shell)."),
    ("dog-cat-shelter.css", "monroe-shelter.css",
     "Dog & Cat Shelter page — port of the theme's dog-cat-shelter.css."),
    ("memorial-giving.css", "monroe-memorial-giving.css",
     "Memorials & planned giving — port of the theme's memorial-giving.css."),
    ("memorial-tribute.css", "monroe-memorial-tribute.css",
     "Memorial honor roll — port of the theme's memorial-tribute.css."),
    ("humane-games-launcher.css", "monroe-games.css",
     "Humane Games launcher — port of the theme's humane-games-launcher.css."),
]
for src_name, out_name, blurb in PAGES:
    convert(ASSETS + "/" + src_name, STYLES + "/" + out_name, f"/*\n {blurb}\n*/", keep_all=True)

# ---- Adopt search + events-flyer rule families from home-editable.css ----
ADOPT_INCLUDE = [
    "monroe-animal-search", "monroe-adopt", "adopt-page", "adopt-hero", "adopt-quick",
    "adopt-search", "adopt-results", "adopt-card", "petango", "pet-profile",
    "monroe-pet-profile", "pet-card", "skeleton", "adopt-toolbar", "masw-",
]
EVENTS_INCLUDE = ["event-flyer", "monroe-events", "events-calendar", "flyers-grid", "flyer-card"]
convert_filtered = None  # placeholder; use convert() with swapped lists below

def convert_with(src, out_path, header, include):
    global INCLUDE, EXCLUDE
    old_i, old_e = INCLUDE[:], EXCLUDE[:]
    INCLUDE[:] = include
    EXCLUDE[:] = []
    try:
        convert(src, out_path, header)
    finally:
        INCLUDE[:] = old_i
        EXCLUDE[:] = old_e

convert_with(SRC_HOME, STYLES + "/monroe-adopt-extra.css",
    "/*\n Adopt search widget, results cards, and Petango profile modal — extracted from\n the theme's home-editable.css (families excluded from the homepage sheet).\n*/", ADOPT_INCLUDE)
convert_with(SRC_HOME, STYLES + "/monroe-events.css",
    "/*\n Events page: flyer grid + month calendar — extracted from the theme's\n home-editable.css.\n*/", EVENTS_INCLUDE)
