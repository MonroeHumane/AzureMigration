# 🐾 Humane Society of Monroe County (HSMC)
## Enterprise Cloud Platform

[![Production Azure SWA](https://img.shields.io/badge/Production-Live%20Edge%20CDN-2dd4bf?style=for-the-badge&logo=microsoftazure)](https://delightful-dune-0d730f70f.7.azurestaticapps.net/)
[![Astro 7](https://img.shields.io/badge/Astro-7.2.9-ff5d01?style=for-the-badge&logo=astro)](https://astro.build/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4.3.3-38bdf8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![Directus CMS](https://img.shields.io/badge/Directus-Headless%20CMS-6644ff?style=for-the-badge&logo=directus)](https://directus.io/)

> High-performance, low-maintenance cloud architecture engineered under the **Microsoft Azure Sponsorship grant** for the Humane Society of Monroe County, Michigan (Serving Monroe County animals since 1954).

---

## 🌐 Production Deployments & Endpoints

| Service / Layer | Deployment Host | Production URL |
| :--- | :--- | :--- |
| **Primary Domain** | Azure Custom Domain | [https://monroe-humane.org](https://monroe-humane.org) |
| **Edge Frontend (SWA)** | Azure Static Web Apps | [https://delightful-dune-0d730f70f.7.azurestaticapps.net](https://delightful-dune-0d730f70f.7.azurestaticapps.net) |
| **Headless CMS API** | Azure Container Apps | `https://mchs-directus.livelyfield-d0a70609.eastus.azurecontainerapps.io` |
| **Arcade & Adoptédex API** | Azure Container Apps | `https://mchs-arcade-api.livelyfield-d0a70609.eastus.azurecontainerapps.io` |
| **Database** | Azure Flexible Server | `mchs-mysql-2urwob6xh6j6s` (MySQL 8.0) |
| **Object Storage** | Azure Blob Storage | `mchsstorage2urwob6xh6j6s` (Pet Photos & PDF Flyers) |

---

## 📁 Repository Directory Structure

```text
.
├── frontend/                   # Astro 7 Reactive Web Application & Kiosk
│   ├── src/                    # Pages, components, layouts, site config
│   │   ├── components/         # Reactive Astro client islands & UI components
│   │   ├── config/             # Centralized SITE configuration & endpoints
│   │   ├── data/               # Local fallback data & published board financials
│   │   ├── layouts/            # BaseLayout and StaffPortalLayout templates
│   │   ├── lib/                # Directus API SDK client & data loaders
│   │   ├── pages/              # 20+ file-based routes (Adopt, Events, Internal, TV)
│   │   └── styles/             # Tailwind CSS v4 & theme design systems
│   ├── public/                 # Static web assets, games, staticwebapp.config.json
│   └── astro.config.mjs        # Astro 7 build configuration
├── backend/                    # Directus Headless CMS configuration
│   ├── schema/                 # Directus collection schemas & field snapshots
│   └── scripts/                # Database bootstrap & auto-provisioning scripts
├── arcade/                     # Humane Arcade REST API (PHP Flight microframework)
│   ├── src/                    # Auth, leaderboards, Adoptédex saves, Tycoon states
│   └── Dockerfile              # Container image definition for Azure Container Apps
├── cron/                       # PetSync Background Worker
│   └── src/                    # 30-minute PetPoint intake & adoption sync pipeline
├── infra/                      # Infrastructure as Code (Azure Bicep)
│   ├── main.bicep              # Declarative Azure cloud resources template
│   └── main.bicepparam         # Environment parameter bindings
├── api/                        # Azure Static Web Apps serverless API functions
├── scripts/                    # Operational automation (QuickBooks reconciliation)
├── test-site-integrity.cjs     # End-to-end static link, asset, and route validator
└── HSMC_PLATFORM_MASTER_DOCUMENTATION.md # Comprehensive platform manual
```

---

## 🚀 Quickstart & Local Development

### Prerequisites
* **Node.js 22+** (LTS)
* **npm 10+**

### 1. Frontend Development (Astro 7)
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start local Astro dev server (runs on http://localhost:4321)
npm run dev

# Run Astro & TypeScript typechecking
npm run check

# Build production static bundle (outputs to frontend/dist)
npm run build
```

### 2. Full Site Integrity & Route Verification
Before pushing changes, run the root link auditor to verify all 140+ pre-rendered pages, redirects, images, and anchors:
```bash
# Run from repository root
node test-site-integrity.cjs
```

---

## 🧭 Core Platform Features & Specialized Hubs

* **Unified Adoption Hub (`/adopt`)**: Real-time 0ms client-side filtering by Species, Gender, Size, and Age, with deep query linking (`/adopt?pet=...`) and SWR Directus live hydration.
* **Lobby Kiosk & TV Display (`/tv`)**: 100vw × 100vh full-bleed kiosk mode with Screen WakeLock API, in-memory prefetching, and dynamically generated QR codes for shelter lobby smart TVs.
* **Humane Arcade & Adoptédex (`/games`)**: Interactive browser games featuring real shelter pets (*Pet Snake*, *Catwalk*, *Found*, *Shelter Tycoon*) with cloud card album saves.
* **Unified Staff & Board Portal (`/internal`)**:
  * **PetSync Operations (`/internal/pets`)**: Live census, PetPoint synchronization health, and instant printable kennel cards.
  * **Board Financials (`/internal/board`)**: Executive KPIs, monthly operating statements, balance sheets, and cash runway simulator.
  * **Printable Board Packet (`/internal/board/print`)**: Formatted, paginated letter-portrait PDF/print layout for board meetings.
  * **Grants Tracker (`/internal/grants`)**: Directus-synchronized grant application pipeline and deadline tracking.

---

## 📖 In-Depth Platform Documentation

For detailed architecture diagrams, disaster recovery procedures, Directus field schemas, staff runbooks, and Bicep infrastructure configuration, refer to:

👉 **[HSMC Platform Master Architecture & Operations Manual (v2.5)](./HSMC_PLATFORM_MASTER_DOCUMENTATION.md)**
