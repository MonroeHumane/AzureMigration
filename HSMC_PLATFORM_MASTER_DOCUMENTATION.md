# 🐾 Humane Society of Monroe County (HSMC)
## Enterprise Cloud Platform — Master Architecture & Operations Manual
**Version:** 2.0 (Modernized Reactive Platform)  
**Last Updated:** August 2026  
**Azure Tenant:** Microsoft Azure Sponsorship (`monroe-humane.org`)  
**Production Domain:** `https://monroe-humane.org` (Live Azure SWA: `https://delightful-dune-0d730f70f.7.azurestaticapps.net`)  

---

## 📑 Table of Contents
1. [Executive Summary & System Topology](#1-executive-summary--system-topology)
2. [Astro 5 Reactive Frontend Architecture](#2-astro-5-reactive-frontend-architecture)
3. [Directus Headless CMS & Data Pipeline](#3-directus-headless-cms--data-pipeline)
4. [Humane Arcade & Adoptédex REST API](#4-humane-arcade--adoptédex-rest-api)
5. [Full-Screen TV & Lobby Kiosk Mode (`/tv`)](#5-full-screen-tv--lobby-kiosk-mode-tv)
6. [Azure Cloud Infrastructure & Bicep IaC](#6-azure-cloud-infrastructure--bicep-iac)
7. [GitHub Actions CI/CD Deployment Pipeline](#7-github-actions-cicd-deployment-pipeline)
8. [Staff Operations Runbook & Content Management](#8-staff-operations-runbook--content-management)
9. [Disaster Recovery, Security & Maintenance](#9-disaster-recovery-security--maintenance)

---

## 1. Executive Summary & System Topology

The Monroe County Humane Society platform is an enterprise, high-performance web architecture engineered for speed, low maintenance costs, and high reliability under the Microsoft Azure Sponsorship grant.

```
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
     │ • Astro 5 Client Islands      │                                                 │ • Staff Admin Portal          │
     │ • View Transitions SPA        │◄─────────── Live REST API (SWR) ────────────────┤ • Public Read Endpoints       │
     │ • Unified /adopt Hub          │                                                 │ • Automated Backup & Auth     │
     │ • TV Kiosk Mode (/tv)         │                                                 └───────────────┬───────────────┘
     │ • Pet Arcade & Games          │                                                                 │
     └───────────────────────────────┘                                                                 │
                     │                                                                                 │
                     ▼                                                                                 ▼
     ┌───────────────────────────────┐                                                 ┌───────────────────────────────┐
     │     Arcade REST API (ACA)     │                                                 │   Azure Database for MySQL    │
     │ (Scores, Adoptédex, Saves)    ├────────────── Database Queries ────────────────►│      (Flexible Server)        │
     └───────────────────────────────┘                                                 └───────────────────────────────┘
                     │                                                                                 ▲
                     ▼                                                                                 │
     ┌───────────────────────────────┐                                                                 │
     │      Azure Blob Storage       ├─────────────────────────────────────────────────────────────────┘
     │   (Pet Photos & Flyers)       │
     └───────────────────────────────┘
```

---

## 2. Astro 5 Reactive Frontend Architecture

### Core Innovations
1. **Unified Adoption Hub (`/adopt`)**:
   - Replaced 86 rigid static subpages with a single reactive adoption interface.
   - **In-Place Reactive Filtering**: Real-time filtering by Species, Gender, Age, and search query with 0ms page reload.
   - **Slide-Over Pet Drawer**: Clicking any animal opens an accessible modal sheet with high-resolution photo, medical tags (`✓ Spayed/Neutered`, `✓ Microchipped`, `✓ Rabies Vaccines`), intake story, and direct application links.
   - **Deep Linking**: Seamless URL query synchronization (`/adopt?pet=61220759`, `/adopt?type=dog`).
   - **Live SWR Background Sync**: Queries `https://mchs-directus.../items/pets` in the background on load to automatically reflect real-time adoptions without requiring full GitHub Actions builds.
2. **Astro View Transitions (`<ClientRouter />`)**:
   - Smooth, native app-like page transitions without white-screen flickers.
   - Built-in hover prefetching (`data-astro-prefetch="hover"`).
3. **Dedicated Clean Routes (No Homepage Anchor Jumps)**:
   - Dedicated pages: `/contact`, `/faq`, `/donate`, `/membership`, `/events`, `/shop`, `/memorials`, `/resources`, `/tv`, `/games`.
4. **100% Backward-Compatible 301 Wildcards**:
   - `staticwebapp.config.json` transparently redirects legacy URLs (`/adoption-center/*`, `/animal-shelter/*`, `/hero-fence/*`, `/adopt/dogs`, `/adopt/cats`) to their canonical modern hubs.

---

## 3. Directus Headless CMS & Data Pipeline

* **Endpoint**: `https://mchs-directus.livelyfield-d0a70609.eastus.azurecontainerapps.io`
* **Admin Portal**: Staff log in to create and edit site content.
* **Auto-Provisioning Script**: `backend/scripts/setup-directus.js`

### Content Collections Overview
| Collection | Purpose | Public Permissions |
| :--- | :--- | :--- |
| `pets` | Adoptable shelter dogs, cats, and small animals | Read-Only |
| `event_flyers` | Fundraiser flyers, Dine-to-Donate dates | Read-Only |
| `memorial_tributes` | Honor Roll & Memorial donations | Read-Only |
| `newsletter_issues` | Seasonal and annual review publications | Read-Only |
| `testimonials` | Community reviews & adoption stories | Read-Only |
| `membership_tiers` | Annual and monthly membership packages | Read-Only |
| `site_settings` | Shelter hours, emergency phone, alerts banner | Read-Only |
| `directus_files` | Cloud-hosted images and flyer PDFs | Read-Only |

---

## 4. Humane Arcade & Adoptédex REST API

* **Endpoint**: `https://mchs-arcade-api.livelyfield-d0a70609.eastus.azurecontainerapps.io`
* **Stack**: PHP Flight Microframework container on Azure Container Apps.
* **Database**: `arcade_db` on Azure MySQL Flexible Server.

### API Capabilities
* `POST /api/auth/nickname`: Passwordless device authentication.
* `GET/POST /api/scores`: Global arcade leaderboards.
* `GET/POST /api/dexit`: Adoptédex card collection albums.
* `GET/POST /api/tycoon/save`: Cloud save states for the Shelter Tycoon management sim.

---

## 5. Full-Screen TV & Lobby Kiosk Mode (`/tv`)

Designed specifically for shelter lobby smart TVs, adoption desks, and mobile outreach tablets:
* **Zero Web Navigation**: 100vw × 100vh kiosk mode.
* **In-Memory Image Preloading**: Preloads upcoming pet assets in memory to eliminate TV loading jitter.
* **Screen WakeLock API**: Prevents smart TVs and monitors from dimming or sleeping.
* **Dynamic QR Codes**: Displays a high-contrast QR code for each pet so visiting adopters can scan with their phone camera to open that pet's application page instantly.
* **Keyboard Shortcuts**: `F` (Fullscreen), `Space` (Pause/Resume), `Arrow Left/Right` (Skip).

---

## 6. Azure Cloud Infrastructure & Bicep IaC

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

## 7. GitHub Actions CI/CD Deployment Pipeline

* **Repository**: `https://github.com/MonroeHumane/AzureMigration.git`
* **Workflows**:
  * `.github/workflows/deploy-frontend.yml`: Builds Astro 5 static bundle, applies SWA routing rules, and deploys to Azure Static Web Apps edge.
  * `.github/workflows/deploy-containers.yml`: Builds and packages Directus CMS and Arcade API container images to Azure Container Apps.

---

## 8. Staff Operations Runbook & Content Management

### How Staff Add a New Adoptable Pet
1. Log into Directus (`https://mchs-directus.../admin`).
2. Navigate to **Pets** & click **Create Item**.
3. Upload a photo, set Name, Species (`dog` or `cat`), Breed, Age, Gender, and Personality description.
4. Click **Save**. The pet is immediately live in the `/adopt` hub and `/tv` kiosk!

### How Staff Mark a Pet as Adopted
1. Open the pet in Directus.
2. Set **Status** to `Adopted` or populate `Archived At`.
3. Click **Save**. The pet is instantly removed from the public website and TV display.

---

## 9. Disaster Recovery, Security & Maintenance

* **SSL/TLS**: Automated managed certificates through Azure SWA and Container Apps.
* **Cold Starts & Sessions**: Directus `KEY` and `SECRET` are hardened in Bicep so container reboots never invalidate staff JWTs.
* **Database Backups**: Azure MySQL Flexible Server automated geo-redundant snapshots with 7-day point-in-time recovery.
* **Zero-Downtime Fallback**: If Directus is warming up during an Astro build, the build automatically uses bundled JSON fallback data, guaranteeing 100% CI/CD uptime.
