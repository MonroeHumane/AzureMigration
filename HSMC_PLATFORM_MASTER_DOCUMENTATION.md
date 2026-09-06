# 🐾 Humane Society of Monroe County (HSMC)
## Enterprise Cloud Platform — Master Architecture & Operations Manual

**Version:** 2.5 (Astro 7 & Unified Enterprise Architecture)  
**Last Updated:** September 2026  
**Azure Tenant:** Microsoft Azure Sponsorship (`monroe-humane.org`)  
**Production Domain:** `https://monroe-humane.org`  
**Live Azure SWA Edge:** `https://delightful-dune-0d730f70f.7.azurestaticapps.net`  

---

## 📑 Table of Contents
1. [Executive Summary & System Topology](#1-executive-summary--system-topology)
2. [Astro 7 Reactive Frontend Architecture](#2-astro-7-reactive-frontend-architecture)
3. [Directus Headless CMS & Content Pipeline](#3-directus-headless-cms--content-pipeline)
4. [Humane Arcade & Adoptédex REST API](#4-humane-arcade--adoptédex-rest-api)
5. [Full-Screen TV & Lobby Kiosk Mode (`/tv`)](#5-full-screen-tv--lobby-kiosk-mode-tv)
6. [Unified Staff & Executive Board Portal (`/internal`)](#6-unified-staff--executive-board-portal-internal)
7. [Azure Cloud Infrastructure & Bicep IaC](#7-azure-cloud-infrastructure--bicep-iac)
8. [GitHub Actions CI/CD Pipeline & Development](#8-github-actions-cicd-pipeline--development)
9. [Automated Site Integrity & Quality Testing](#9-automated-site-integrity--quality-testing)
10. [Staff Operations Runbook & Content Workflows](#10-staff-operations-runbook--content-workflows)
11. [Disaster Recovery, Security & Maintenance](#11-disaster-recovery-security--maintenance)

---

## 1. Executive Summary & System Topology

The Monroe County Humane Society platform is an enterprise web architecture engineered for speed, low operating costs, and high reliability under the Microsoft Azure Sponsorship grant. Serving Monroe County animals since 1954, the modern platform delivers sub-100ms global edge speeds, instant reactive adoption filtering, kiosk TV signage, and executive board governance.

```text
                                  ┌────────────────────────────────────────────────────────┐
                                  │                  DNS: monroe-humane.org                │
                                  └───────────────────────────┬────────────────────────────┘
                                                              │
                     ┌────────────────────────────────────────┴────────────────────────────────────────┐
                     │                                                                                 │
                     ▼                                                                                 ▼
     ┌───────────────────────────────┐                                                 ┌───────────────────────────────┐
     │   Azure Static Web Apps (SWA) │                                                 │    Directus Headless CMS      │
     │  (Global Edge CDN + Fast SSG) │                                                 │  (Azure Container Apps - ACA) │
     ├───────────────────────────────┤                                                 ├───────────────────────────────┤
     │ • Astro 7 Client Islands      │◄─────────── Live REST API (SWR) ────────────────┤ • Staff Admin Portal          │
     │ • View Transitions SPA Router │                                                 │ • Public Read Endpoints       │
     │ • Unified /adopt Hub          │                                                 │ • Role-Scoped JWT Auth        │
     │ • TV Kiosk Mode (/tv)         │                                                 │ • PetSync Automation          │
     │ • Humane Arcade (/games)      │                                                 └───────────────┬───────────────┘
     │ • Staff Portal (/internal)    │                                                                 │
     └───────────────┬───────────────┘                                                                 │
                     │                                                                                 │
                     ▼                                                                                 ▼
     ┌───────────────────────────────┐                                                 ┌───────────────────────────────┐
     │     Arcade REST API (ACA)     │────────────── Database Queries ────────────────►│   Azure Database for MySQL    │
     │ (Scores, Adoptédex, Saves)    │                                                 │      (Flexible Server)        │
     └───────────────────────────────┘                                                 └───────────────────────────────┘
                     │                                                                                 ▲
                     ▼                                                                                 │
     ┌───────────────────────────────┐                                                                 │
     │      Azure Blob Storage       ├─────────────────────────────────────────────────────────────────┘
     │   (Pet Photos & Flyers)       │
     └───────────────────────────────┘
```

---

## 2. Astro 7 Reactive Frontend Architecture

### Core Innovations & Stack
* **Framework:** **Astro 7.2.9** with **Tailwind CSS v4.3.3** on **Node.js 22 LTS**.
* **Unified Adoption Hub (`/adopt`)**:
  * Replaced dozens of static subpages with a single reactive adoption interface.
  * **In-Place Reactive Filtering:** Real-time filtering by Species, Gender, Size, Age, and search query with 0ms page reloads.
  * **Deep Linking:** Query parameter synchronization (`/adopt?pet=61220759`, `/adopt/dogs`, `/adopt/cats`).
  * **Dynamic Pet Profiles (`/adopt/[id]`):** 80+ pre-rendered animal profile pages with medical badges (`✓ Spayed/Neutered`, `✓ Microchipped`, `✓ Vaccinated`), intake story, and direct application links.
  * **Live SWR Background Sync:** Queries `https://mchs-directus.../items/pets` in the background on load to reflect real-time adoptions without requiring full CI/CD builds.
* **Astro View Transitions (`<ClientRouter />`)**:
  * Smooth, native app-like page transitions without white-screen flickers.
  * Built-in hover prefetching (`data-astro-prefetch="hover"`).
* **Dedicated Clean Routes**:
  * `/contact`, `/faq`, `/donate`, `/membership`, `/events`, `/shop`, `/memorials`, `/memorials/give`, `/resources`, `/tv`, `/games`, `/volunteer-form`, `/specialsponsors`, `/newsletter`, `/dog-and-cat-shelter`.
* **100% Backward-Compatible 301 Wildcards**:
  * `staticwebapp.config.json` transparently redirects legacy URLs (`/adoption-center/*`, `/animal-shelter/*`, `/adopt-a-pet/*`, `/donate-now`, `/store`, `/petdisplay`) to their canonical modern hubs.

---

## 3. Directus Headless CMS & Content Pipeline

* **Endpoint**: `https://mchs-directus.livelyfield-d0a70609.eastus.azurecontainerapps.io`
* **Admin Portal**: Staff log in to manage pets, events, and site settings.
* **Auto-Provisioning**: `backend/scripts/setup-directus.js`

### Content Collections
| Collection | Purpose | Public Permissions |
| :--- | :--- | :--- |
| `pets` | Adoptable shelter dogs, cats, and small animals | Read-Only |
| `event_flyers` | Fundraiser flyers, Dine-to-Donate dates | Read-Only |
| `memorial_tributes` | Honor Roll & Memorial donations | Read-Only |
| `newsletter_issues` | Seasonal and annual review publications | Read-Only |
| `testimonials` | Community reviews & adoption stories | Read-Only |
| `membership_tiers` | Annual and monthly membership packages | Read-Only |
| `site_settings` | Shelter hours, emergency phone, annual counts | Read-Only |
| `board_meetings` | Meeting dates, agendas, and minutes | Authenticated Staff/Board |
| `board_documents` | Monthly financials, statements, and audit reports | Authenticated Staff/Board |
| `grants` | Grant pipeline, deadlines, and awards tracker | Authenticated Staff/Board |
| `directus_files` | Cloud-hosted images and flyer PDFs | Read-Only |

---

## 4. Humane Arcade & Adoptédex REST API

* **Endpoint**: `https://mchs-arcade-api.livelyfield-d0a70609.eastus.azurecontainerapps.io`
* **Stack**: PHP Flight Microframework container on Azure Container Apps.
* **Database**: `arcade_db` on Azure MySQL Flexible Server.

### API Capabilities & Games
* `POST /api/auth/nickname`: Passwordless device authentication.
* `GET/POST /api/scores`: Global arcade leaderboards.
* `GET/POST /api/dexit`: Adoptédex card collection albums.
* `GET/POST /api/tycoon/save`: Cloud save states for the Shelter Tycoon management sim.
* **Featured Games**:
  * *Pet Snake* (`/games/petsnake.html`): Classic snack trail arcade.
  * *Pet Snake Adventure* (`/games/petsnakerouguelike.html`): 15-floor roguelike with upgrades.
  * *Found* (`/games/found/index.html`): Stray cat neighborhood navigation.
  * *Catwalk* (`/games/catwalk`): Vector wireframe arcade night patrol.
  * *Pet Match Memory* (`/games/match/match.html`): Real shelter pet photo matching.
  * *Adoptédex Album* (`/games/dex/dex.html`): Collectible digital cards.
  * *Shelter Tycoon* (`/games/shelter-tycoon/index.html`): Humane society management sim.

---

## 5. Full-Screen TV & Lobby Kiosk Mode (`/tv`)

Designed specifically for shelter lobby smart TVs, adoption desks, and mobile outreach tablets:
* **Zero Web Navigation**: 100vw × 100vh full-bleed kiosk layout with ambient blurred backdrops.
* **In-Memory Image Preloading**: Preloads upcoming pet assets in memory to eliminate TV loading jitter.
* **Screen WakeLock API**: Prevents smart TVs and monitors from dimming or sleeping.
* **Dynamic High-Contrast QR Codes**: Generates phone-scannable QR codes natively in the browser so visiting adopters can immediately apply from their mobile devices.
* **Keyboard Controls**: `F` (Fullscreen), `Space` (Pause/Resume), `Arrow Left/Right` (Skip).

---

## 6. Unified Staff & Executive Board Portal (`/internal`)

The platform integrates internal shelter operations and executive board governance behind Directus role-scoped authentication:

* **Executive Hub (`/internal`)**: Central dashboard and secure login gate with Directus credentials.
* **PetSync & Active Census (`/internal/pets`)**:
  * Real-time shelter roster and active animal count.
  * PetPoint 30-minute Azure background sync health diagnostics.
  * One-click printable kennel card generator.
* **Board Financials & Operations (`/internal/board`)**:
  * Executive KPIs, operating revenue vs. expenses, and cash position.
  * Monthly operating statement tables and balance sheets.
  * Runway scenario simulator and bank statement audit reconciliation.
  * Governance archives: Board meetings, approved agendas, and minutes.
* **Printable Board Packet (`/internal/board/print`)**:
  * One-click, letter-portrait formatted multi-page PDF/print output for board meetings.
* **Grants Pipeline Tracker (`/internal/grants`)**:
  * Directus-synchronized grant application tracking.
  * Total tracked vs. awarded funding metrics and submission deadlines.

---

## 7. Azure Cloud Infrastructure & Bicep IaC

Managed declaratively via `infra/main.bicep`:
* **Resource Group**: `MCHS-Platform-RG` (`eastus`).
* **Subscription ID**: `fe900e8e-d5c4-473c-ba12-6787e04466bf`.
* **Tenant ID**: `00fa94bd-1214-416e-9b61-3c0c259681c1`.
* **Resources Provisioned**:
  * Azure Static Web App (`mchs-frontend-prod`)
  * Container Apps Environment (`mchs-aca-env`)
  * Directus Container App (`mchs-directus`)
  * Arcade API Container App (`mchs-arcade-api`)
  * MySQL Flexible Server (`mchs-mysql-2urwob6xh6j6s`)
  * Storage Account (`mchsstorage2urwob6xh6j6s`) with Blob CORS enabled.

---

## 8. GitHub Actions CI/CD Pipeline & Development

* **Repository**: `https://github.com/MonroeHumane/AzureMigration.git`
* **Workflows**:
  * `.github/workflows/deploy-frontend.yml`: Builds Astro 7 static bundle, applies SWA routing rules, and deploys to Azure Static Web Apps edge on push to `main` or repository dispatch.
  * `.github/workflows/deploy-containers.yml`: Builds and packages Directus CMS and Arcade API container images to Azure Container Apps.

### Local Development Commands
```bash
# In frontend/ directory:
npm run dev      # Launch Astro 7 dev server on http://localhost:4321
npm run check    # Run Astro & TypeScript typechecking
npm run build    # Build production static bundle (dist/)
```

---

## 9. Automated Site Integrity & Quality Testing

The platform includes an automated link and asset auditor:
```bash
# In repository root:
node test-site-integrity.cjs
```
* Scans all 140+ generated HTML pages in `frontend/dist/`.
* Verifies all internal `href` targets against valid routes and `staticwebapp.config.json` 301 redirects.
* Validates all `<img>` source paths and checks for `<title>` tags across every page.

---

## 10. Staff Operations Runbook & Content Workflows

### How Staff Add a New Adoptable Pet
1. Log into Directus (`https://mchs-directus.../admin`).
2. Navigate to **Pets** & click **Create Item**.
3. Upload a photo, set Name, Species (`dog` or `cat`), Breed, Age, Gender, and Personality description.
4. Click **Save**. The pet is immediately live in the `/adopt` hub and `/tv` kiosk!

### How Staff Mark a Pet as Adopted
1. Open the pet in Directus.
2. Set **Status** to `Adopted` or populate `Archived At`.
3. Click **Save**. The pet is instantly removed from the public website and TV display.

### How Staff Publish Event Flyers
1. Navigate to **Event Flyers** in Directus.
2. Create item with Title, Event Date, Flyer Image, and External Link URL.
3. Save item. The flyer automatically appears on `/events` and on the homepage event spotlight.

---

## 11. Disaster Recovery, Security & Maintenance

* **SSL/TLS**: Automated managed certificates through Azure SWA and Container Apps.
* **Cold Starts & Sessions**: Directus `KEY` and `SECRET` are stored as Container App secrets (not plaintext env). When applying Bicep to the live app, pass the KEY and SECRET already running on `mchs-directus` — do not generate new values. Rotating `KEY` can make existing encrypted fields unreadable. Those live values are not in git.
* **Database Backups**: Azure MySQL Flexible Server automated locally redundant backups with 7-day point-in-time recovery. Geo-redundant backup is not enabled: the live SKU is Burstable `Standard_B1ms`, which does not support geo-redundant backup.
* **Zero-Downtime Fallback**: If Directus is warming up during an Astro build, the build automatically uses bundled JSON fallback data, guaranteeing 100% CI/CD uptime.
* **Content Security Policy (CSP)**: Hardened headers in `staticwebapp.config.json` protecting against XSS, clickjacking, and MIME sniffing while allowing verified frames (BetterUnite, PayPal, Google Forms).
