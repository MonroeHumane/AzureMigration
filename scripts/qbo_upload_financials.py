#!/usr/bin/env python3
'''Upload financial JSONs to the private Blob Storage container.
Usage: python scripts/qbo_upload_financials.py
'''
import os, shutil, subprocess, sys, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API_DATA_DIR = os.path.join(ROOT, 'api', 'data')
STORAGE_ACCOUNT = 'mchsstorage2urwob6xh6j6s'
CONTAINER = 'staff-private-data'
BLOB_NAME = 'financial_data_bundle.json'
FILES_TO_BUNDLE = ['published_2026_ytd.json', 'statement_2026_08.json', 'monthly_drilldown_2026.json', 'checking_balance_2024_2026.json', 'bank_in_out_2026.json', 'bank_in_out_2025.json', 'bank_in_out_2024.json', 'published_2025_ytd.json', 'monthly_drilldown_2025.json', 'published_2024_ytd.json', 'monthly_drilldown_2024.json']
def main():
    az = shutil.which('az')
    if not az: sys.exit('az cli not found')
    bundle = {}
    for filename in FILES_TO_BUNDLE:
        p = os.path.join(API_DATA_DIR, filename)
        if os.path.isfile(p):
            with open(p, 'r', encoding='utf-8') as f:
                bundle[filename] = json.load(f)
    bp = os.path.join(API_DATA_DIR, BLOB_NAME)
    with open(bp, 'w', encoding='utf-8') as f: json.dump(bundle, f)
    result = subprocess.run([az, 'storage', 'blob', 'upload', '--account-name', STORAGE_ACCOUNT, '--container-name', CONTAINER, '--name', BLOB_NAME, '--file', bp, '--auth-mode', 'key', '--overwrite'], capture_output=True, text=True)
    os.remove(bp)
    if result.returncode != 0: sys.exit(result.stderr)
    print('Upload complete!')
if __name__ == '__main__': main()
