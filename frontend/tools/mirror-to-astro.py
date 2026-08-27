#!/usr/bin/env python3
"""Convert a mirrored monroe-humane.org page into an Astro page draft.

Pipeline: extract <main>, rewrite internal links (slug map + rebuild route
aliases), localize asset URLs to /assets/recovered/..., strip WP form
artifacts, wrap in BaseLayout. Output is a starting draft — review the
REVIEW flags, then wire any islands.

Usage: python mirror-to-astro.py <slug> <out.astro>
       python mirror-to-astro.py events src/pages/events/index.astro
"""
import json
import re
import sys
from pathlib import Path
from urllib.parse import urljoin

MIRROR = Path(r"C:/Users/Jeff/Documents/GitHub/Humanewebsite/site-mirror/mirror_bundle/pages/monroe-humane.org")

# WP slugs -> rebuild routes.
ROUTE_ALIASES = {
    "/adopt/species-dog/": "/adopt/dogs",
    "/adopt/species-cat/": "/adopt/cats",
    "/donate-now/": "/donate",
    "/donations/": "/donate",
    "/memorial/": "/memorials",
    "/memorials/": "/memorials/give",
    "/specialsponsors/": "/specialsponsors",
    "/volunteer-form/": "/volunteer-form",
    "/shop/": "/shop",
    "/games/": "/games",
    "/events/": "/events",
    "/adoptions/": "/adoptions",
    "/resources/": "/resources",
    "/membership/": "/membership",
    "/dog-and-cat-shelter/": "/dog-and-cat-shelter",
    "/newsletter/": "/newsletter",
    "/": "/",
}

PAGE_CSS = {
    "adopt": ["monroe-adopt", "monroe-adopt-extra"],
    "events": ["monroe-events"],
    "games": ["monroe-games"],
}


def extract(path: Path):
    html = path.read_text(encoding="utf-8")
    main = re.search(r"<main[^>]*>(.*?)</main>", html, re.S)
    title = re.search(r"<title>([^<]*)</title>", html)
    desc = re.search(r'<meta name="description" content="([^"]*)"', html)
    if not main:
        sys.exit(f"no <main> found in {path}")
    return main.group(1), (title.group(1) if title else ""), (desc.group(1) if desc else "")


def rewrite_url(url: str, page_dir: str) -> str:
    if url.startswith(("http://", "https://", "mailto:", "tel:", "#")):
        if url.startswith("https://monroe-humane.org/wp-content/"):
            return "/assets/recovered/monroe-humane.org/wp-content/" + url.split("/wp-content/", 1)[1]
        return url
    # Mirror-relative assets (../../assets/...) -> recovered tree.
    if "assets/" in url and "index.html" not in url:
        rel = re.sub(r"^(\.\./)+", "", url)
        rel = re.sub(r"^assets/", "", rel)
        return "/assets/recovered/" + rel
    # Internal page links.
    anchor = ""
    if "#" in url:
        url, anchor = url.split("#", 1)
        anchor = "#" + anchor
    resolved = urljoin(page_dir, url) if url else page_dir
    resolved = "/" + resolved.lstrip("/")
    if resolved.endswith("index.html"):
        resolved = resolved[: -len("index.html")]
    resolved = ROUTE_ALIASES.get(resolved, ROUTE_ALIASES.get(resolved.lower(), resolved))
    return resolved + anchor


def strip_wp_artifacts(html: str) -> str:
    html = re.sub(r'<input type="hidden"[^>]*>', "", html)
    return html


def main():
    slug = sys.argv[1]
    out = Path(sys.argv[2])
    page_dir = "/" if slug == "home" else f"/{slug.strip('/')}/"
    src = MIRROR / ("index.html" if slug == "home" else Path(slug) / "index.html")
    body, title, desc = extract(src)
    body = strip_wp_artifacts(body)
    body = re.sub(
        r'(href|src|data-src|data-flyer-full|data-flyer-download)="([^"]+)"',
        lambda m: f'{m.group(1)}="{rewrite_url(m.group(2), page_dir)}"',
        body,
    )

    def fix_srcset(m: re.Match) -> str:
        parts = [p.strip() for p in m.group(1).split(",")]
        fixed = []
        for part in parts:
            url, _, descriptor = part.partition(" ")
            fixed.append(rewrite_url(url, page_dir) + (" " + descriptor if descriptor else ""))
        return 'srcset="' + " , ".join(fixed) + '"'

    body = re.sub(r'srcset="([^"]+)"', fix_srcset, body)
    body = re.sub(r"\n\s*\n", "\n", body).strip()

    up = "../" * len(out.relative_to("src/pages").parts)
    css_imports = "\n".join(f"import '{up}styles/{c}.css';" for c in PAGE_CSS.get(slug, []))

    draft = f"""---
import BaseLayout from '{up}layouts/BaseLayout.astro';
{css_imports}
---

<BaseLayout
  title={json.dumps(title)}
  description={json.dumps(desc)}
>
{body}
</BaseLayout>
"""
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(draft, encoding="utf-8", newline="\n")

    print(f"wrote {out} ({len(draft.splitlines())} lines)")
    flags = {
        "hidden-input remnants": "type=\"hidden\"" in draft,
        "unresolved ../ links": "../" in re.sub(r"^import .*$", "", draft, flags=re.M),
        "wp-content URLs": "wp-content" in draft,
        "data-rest-url (needs island decision)": "data-rest-url" in draft,
    }
    for name, bad in flags.items():
        if bad:
            print(f"  REVIEW: {name}")


if __name__ == "__main__":
    main()
