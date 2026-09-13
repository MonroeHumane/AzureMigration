# `api/data` — private local JSON (staff features)

This directory holds **optional** JSON files loaded at runtime by the Azure Functions API (`api/src/index.js` via `loadJsonOptional`). They are used for staff/board financial and donor tooling under `/internal` — not for public pages.

## Privacy

- **Do not commit** donor or other PII dumps. `donor_database.json` is listed in the root `.gitignore`.
- Restore staff data **locally or on the deploy host** from your private staff backup / artifact store. Never paste contents into issues, PRs, or chat.
- Bank / statement / published YTD JSON that ships in git is aggregated operational data for board views — still treat it as internal.

## Local restore (staff only, for local dev)

1. Obtain the current `donor_database.json` (and any other private packs) from the shelter's private backup location — not from git history unless you are performing an approved purge/migration.
2. Place files next to this README (`api/data/donor_database.json`, etc.).
3. Restart the Functions app so `loadJsonOptional` picks them up. Missing files are skipped (optional load); staff donor panels simply lack that dataset.

This local-file path only runs when `DONOR_DATA_BLOB_URL` is unset (i.e. local dev) — see Production below.

## Production: private Blob Storage, not git

`api/data/donor_database.json` can never reach production through the normal
git-push deploy — it's git-ignored on purpose, and this app deploys as an
Azure Static Web Apps **managed** Function (no linked backend, no Kudu/file
console), so only what GitHub Actions checks out from git ever lands on the
running app. Production instead reads the donor file from a private Blob
Storage container at request time, via `scripts/qbo_upload_donor_database.py`:

1. Regenerate the file: `python scripts/qbo_build_donor_database.py`.
2. Upload it: `python scripts/qbo_upload_donor_database.py`. This overwrites
   the blob at `staff-private-data/donor_database.json` in storage account
   `mchsstorage2urwob6xh6j6s` (private container, no anonymous access).
3. Nothing else to redeploy — the Function fetches this URL and caches it in
   memory for 10 minutes (`DONOR_DATA_CACHE_TTL_MS` in `api/src/index.js`),
   so a refresh shows up within that window with zero downtime.

The Static Web App's `DONOR_DATA_BLOB_URL` setting holds a long-lived,
read-only SAS URL scoped to that one blob (not the account key itself). If it
is ever rotated or revoked, regenerate it with `az storage blob generate-sas`
against that container/blob and update the setting with
`az staticwebapp appsettings set`.

## Out of scope here

- No sample donor rows, credentials, tokens, or connection strings belong in this folder or this README.
- Removing historical blobs from git history requires a separate, coordinated history rewrite — not part of ordinary hygiene PRs.
