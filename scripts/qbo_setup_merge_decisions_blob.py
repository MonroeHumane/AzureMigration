#!/usr/bin/env python3
"""One-time setup for the donor "possible duplicates" review workflow's
storage: creates an empty decisions blob in the same private container as
donor_database.json, and prints the two SAS URLs it needs (a read-write one
for the Function's live merge-decision endpoint, and a read-only one for
qbo_build_donor_database.py to consume when it regenerates the dataset).

This blob holds only donor ID pairs + a decision string -- no PII -- so a
long-lived key-signed SAS (not a short-lived user-delegation SAS) is fine
here, matching the pattern already used for DONOR_DATA_BLOB_URL.

Requires the Azure CLI, logged in with a role (or account key) on the
storage account -- run `az login` first if needed.

Usage:
  python scripts/qbo_setup_merge_decisions_blob.py
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta

STORAGE_ACCOUNT = "mchsstorage2urwob6xh6j6s"
CONTAINER = "staff-private-data"
BLOB_NAME = "donor_merge_decisions.json"
SAS_EXPIRY = (datetime.utcnow() + timedelta(days=365 * 5)).strftime("%Y-%m-%dT00:00Z")


def run(az, *args):
    result = subprocess.run([az, *args], capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr)
        sys.exit(1)
    return result.stdout.strip()


def main():
    az = shutil.which("az")
    if not az:
        print("ERROR: 'az' (Azure CLI) not found on PATH.")
        sys.exit(1)

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump([], f)
        empty_path = f.name

    print(f"Creating empty {BLOB_NAME} in {STORAGE_ACCOUNT}/{CONTAINER} (only if it doesn't already exist) ...")
    exists = run(
        az, "storage", "blob", "exists",
        "--account-name", STORAGE_ACCOUNT, "--container-name", CONTAINER,
        "--name", BLOB_NAME, "--auth-mode", "key", "--query", "exists", "-o", "tsv",
    )
    if exists.strip().lower() == "true":
        print(f"{BLOB_NAME} already exists -- leaving its current contents alone.")
    else:
        run(
            az, "storage", "blob", "upload",
            "--account-name", STORAGE_ACCOUNT, "--container-name", CONTAINER,
            "--name", BLOB_NAME, "--file", empty_path, "--auth-mode", "key",
        )
        print(f"Created empty {BLOB_NAME}.")
    os.unlink(empty_path)

    print("\nGenerating SAS URLs (expire " + SAS_EXPIRY + ") ...")
    rw_sas = run(
        az, "storage", "blob", "generate-sas",
        "--account-name", STORAGE_ACCOUNT, "--container-name", CONTAINER, "--name", BLOB_NAME,
        "--permissions", "rw", "--expiry", SAS_EXPIRY, "--auth-mode", "key", "--https-only", "-o", "tsv",
    )
    ro_sas = run(
        az, "storage", "blob", "generate-sas",
        "--account-name", STORAGE_ACCOUNT, "--container-name", CONTAINER, "--name", BLOB_NAME,
        "--permissions", "r", "--expiry", SAS_EXPIRY, "--auth-mode", "key", "--https-only", "-o", "tsv",
    )
    base_url = f"https://{STORAGE_ACCOUNT}.blob.core.windows.net/{CONTAINER}/{BLOB_NAME}"
    rw_url = f"{base_url}?{rw_sas}"
    ro_url = f"{base_url}?{ro_sas}"

    print("\n--- Read-write URL (Function app setting DONOR_MERGE_DECISIONS_BLOB_URL) ---")
    print(rw_url)
    print("\n--- Read-only URL (env var DONOR_MERGE_DECISIONS_URL for the build script) ---")
    print(ro_url)
    print(
        "\nTo apply the app setting:\n"
        f'  az staticwebapp appsettings set -g MCHS-Platform-RG -n mchs-frontend-prod '
        f'--setting-names "DONOR_MERGE_DECISIONS_BLOB_URL={rw_url}"\n'
        "\nTo use the read-only URL locally:\n"
        f'  export DONOR_MERGE_DECISIONS_URL="{ro_url}"\n'
        "  python scripts/qbo_build_donor_database.py"
    )


if __name__ == "__main__":
    main()
