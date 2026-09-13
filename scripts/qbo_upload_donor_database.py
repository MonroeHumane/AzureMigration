#!/usr/bin/env python3
"""Upload api/data/donor_database.json to the private Blob Storage container
the production Function reads from (see api/data/README.md -- this file is
git-ignored on purpose and can never reach prod via the normal git-push
deploy, since this app runs as an Azure Static Web Apps managed Function
with no Kudu/file console).

Requires the Azure CLI, logged in as a user with a data-plane role (or an
account key) on the storage account -- run `az login` first if needed.

Usage:
  python scripts/qbo_upload_donor_database.py
"""
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCAL_FILE = os.path.join(ROOT, "api", "data", "donor_database.json")

STORAGE_ACCOUNT = "mchsstorage2urwob6xh6j6s"
CONTAINER = "staff-private-data"
BLOB_NAME = "donor_database.json"


def main():
    if not os.path.isfile(LOCAL_FILE):
        print(f"ERROR: {LOCAL_FILE} does not exist. Run qbo_build_donor_database.py first.")
        sys.exit(1)

    az = shutil.which("az")
    if not az:
        print("ERROR: 'az' (Azure CLI) not found on PATH.")
        sys.exit(1)

    print(f"Uploading {LOCAL_FILE} -> {STORAGE_ACCOUNT}/{CONTAINER}/{BLOB_NAME} ...")
    result = subprocess.run(
        [
            az, "storage", "blob", "upload",
            "--account-name", STORAGE_ACCOUNT,
            "--container-name", CONTAINER,
            "--name", BLOB_NAME,
            "--file", LOCAL_FILE,
            "--auth-mode", "key",
            "--overwrite",
        ],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print("Upload failed:")
        print(result.stdout)
        print(result.stderr)
        sys.exit(1)

    print("Uploaded. The Function's in-memory cache refreshes within 10 minutes")
    print("(DONOR_DATA_CACHE_TTL_MS in api/src/index.js) -- no redeploy needed.")


if __name__ == "__main__":
    main()
