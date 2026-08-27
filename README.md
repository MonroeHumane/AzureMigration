# 🐾 Monroe County Humane Society — Azure Native Platform

This repository houses the ground-up, Azure-native rewrite of the Monroe County Humane Society web platform, replacing legacy WordPress with a modern, high-performance architecture:

- **Frontend (`frontend/`)**: **Astro 5** static site with interactive client islands, deployed on **Azure Static Web Apps**.
- **Games (`frontend/public/games/`)**: Static HTML5/Canvas/WebAudio Humane Games (Booster Packs, Pet Match Memory, Flappy Cat, Shelter Run, and the Adoptédex Album) served via edge CDN.
- **Headless CMS (`backend/`)**: **Directus 11** on **Azure Container Apps** with Azure Blob Storage persistence for staff content management.
- **Game & Economy API (`arcade/`)**: Standalone **PHP 8.2 Flight** service handling cloud saves, optimistic concurrency locks, and player economy on **Azure Container Apps**.
- **PetSync Pipeline (`cron/`)**: Scheduled ingestion pipeline synchronizing shelter Google Sheets CSV data directly into Directus via **Azure Container Apps Jobs**.
- **Database (`infra/`)**: **Azure Database for MySQL Flexible Server** with strictly isolated `directus_db` and `arcade_db` schemas.

---

## 🚀 Local Development Quickstart

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Docker Compose v2+)
- [Node.js 20+](https://nodejs.org/)

### 1. Start Database & Backend Services
Run the unified Docker Compose stack:
```bash
docker compose up -d
```

This starts:
- **MySQL / MariaDB**: `localhost:3306` (initializes `directus_db` and `arcade_db`)
- **Directus CMS**: `http://localhost:8055` (Admin: `admin@monroe-humane.org` / `AdminPassword123!`)
- **Arcade Backend**: `http://localhost:8081`

### 2. Run Database Migrations
Apply the Phinx migrations for the game backend:
```bash
docker compose exec arcade-api vendor/bin/phinx migrate
```

### 3. Run the Astro Frontend
```bash
cd frontend
npm install
npm run dev
```
Open **`http://localhost:4321`** in your browser.

---

## 📂 Repository Topology

```text
AzureMigration/
├── docker-compose.yml              # Local development multi-container orchestrator
├── .env.example                    # Template environment variables
├── backend/                        # Directus 11 Headless CMS configuration & schema
│   ├── Dockerfile
│   ├── package.json
│   └── schema/schema.json          # Pre-configured collections: pets, flyers, newsletters, etc.
├── arcade/                         # Standalone PHP Flight Game API
│   ├── Dockerfile
│   ├── composer.json
│   ├── phinx.php                   # Phinx database migration configuration
│   ├── db/migrations/              # Game saves, profiles, and Adoptédex economy tables
│   └── src/                        # Controllers: Auth, Sync, Adoptedex, Cleanup, RateLimiter
├── frontend/                       # Astro 5 Static Site
│   ├── astro.config.mjs
│   ├── package.json
│   ├── public/games/               # Bundled static games (Booster, Match, Flappy Cat, Dex)
│   └── src/
│       ├── layouts/                # BaseLayout, Header, Footer
│       ├── lib/directus.ts         # Directus SDK client & fallback caches
│       └── pages/                  # Page routes: index, adopt, events, memorials, newsletter, etc.
├── cron/                           # Standalone PetSync pipeline
│   ├── package.json
│   ├── Dockerfile
│   └── src/sync-pets.ts            # Google Sheets CSV fetcher, parser & Directus diff engine
└── infra/                          # Infrastructure as Code & CI/CD
    ├── main.bicep                  # Complete Azure provisioning template
    └── .github/workflows/          # Automated GitHub Actions deployments
```

---

## 🔒 Security & Architecture Guarantees
- **HttpOnly Cookies**: Session & device credentials travel strictly via `HttpOnly`, `SameSite=Lax`, `Secure` cookies. Zero secret exposure to JS contexts.
- **Idempotency Receipts**: Mutating save operations use SHA-256 fingerprinting in `operation_receipts` to eliminate duplicate writes and replay races.
- **Atomic Ledgers**: Coin awards and spends are recorded as append-only transaction logs in `dex_coin_transactions` with conditional row updates (`WHERE coin_balance >= amount`).
- **Database Schema Isolation**: Directus ORM and Arcade Phinx migrations operate on independent databases (`directus_db` vs `arcade_db`) preventing schema collision.
