# `api/data` — private local JSON (staff features)

This directory holds **optional** JSON files loaded at runtime by the Azure Functions API (`api/src/index.js` via `loadJsonOptional`). They are used for staff/board financial and donor tooling under `/internal` — not for public pages.

## Privacy

- **Do not commit** donor or other PII dumps. `donor_database.json` is listed in the root `.gitignore`.
- Restore staff data **locally or on the deploy host** from your private staff backup / artifact store. Never paste contents into issues, PRs, or chat.
- Bank / statement / published YTD JSON that ships in git is aggregated operational data for board views — still treat it as internal.

## Local restore (staff only)

1. Obtain the current `donor_database.json` (and any other private packs) from the shelter’s private backup location — not from git history unless you are performing an approved purge/migration.
2. Place files next to this README (`api/data/donor_database.json`, etc.).
3. Restart or redeploy the Functions app so `loadJsonOptional` picks them up. Missing files are skipped (optional load); staff donor panels simply lack that dataset.

## Out of scope here

- No sample donor rows, credentials, tokens, or connection strings belong in this folder or this README.
- Removing historical blobs from git history requires a separate, coordinated history rewrite — not part of ordinary hygiene PRs.
