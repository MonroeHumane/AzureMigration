import csv
import re

def norm_name(s):
    if not s: return ''
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9]', ' ', s.lower())).strip()

master_donors = {}
email_map = {}

with open(r'C:\Users\Jeff\Downloads\HSMC_Master_Donor_Roll_With_Full_Mailing_Addresses.csv', mode='r', encoding='utf-8', errors='ignore') as f:
    reader = csv.DictReader(f)
    for row in reader:
        n = norm_name(row['norm_name'] or row['Primary_Name'])
        em = (row.get('Email') or '').strip().lower()
        donor = {
            'norm_name': n,
            'name': row.get('Primary_Name'),
            'email': em,
            'phone': row.get('Phone'),
            'total_lifetime': float(row.get('Total_Lifetime_Given') or 0),
            'total_txs': int(row.get('Total_Transactions') or 0),
            'first_date': row.get('First_Gift_Date'),
            'latest_date': row.get('Latest_Gift_Date'),
            'platforms': row.get('Platforms_Used'),
            'campaign': row.get('Sample_Campaign'),
            'address': row.get('Mailing_Address'),
            'tx_list': []
        }
        master_donors[n] = donor
        if em:
            email_map[em] = donor

print(f'Master donors loaded: {len(master_donors)}, with unique emails: {len(email_map)}')

# Match PayPal
pp_matched = 0
pp_total = 0
with open(r'C:\Users\Jeff\Downloads\HSMC_2026_PayPal_Reconciled_Donations.csv', mode='r', encoding='utf-8', errors='ignore') as f:
    reader = csv.DictReader(f)
    for row in reader:
        pp_total += 1
        em = (row.get('From Email Address') or '').strip().lower()
        n = norm_name(row.get('Name'))
        d = email_map.get(em) or master_donors.get(n)
        if d:
            pp_matched += 1
            d['tx_list'].append({
                'date': row.get('Date'),
                'amount': float(row.get('Gross') or 0),
                'platform': 'PayPal',
                'campaign': row.get('Item Title') or 'PayPal General Fund',
                'memo': row.get('Note') or ''
            })

print(f'PayPal matched: {pp_matched}/{pp_total} ({pp_matched/pp_total*100:.1f}%)')

# Match BetterUnite 2026
bu_matched = 0
bu_total = 0
with open(r'C:\Users\Jeff\Downloads\Transactions Export 2026-09-03.csv', mode='r', encoding='utf-8', errors='ignore') as f:
    for _ in range(12): next(f)
    reader = csv.DictReader(f)
    for row in reader:
        dt = row.get('Payment Date Eastern Standard Time', '')
        amt_str = row.get('Item Paid Amount')
        if not amt_str or row.get('Item Type') == 'Fees paid by Donor': continue
        bu_total += 1
        fn = row.get('First Name', '')
        ln = row.get('Last Name', '')
        full = f"{fn} {ln}".strip()
        n = norm_name(full)
        em = (row.get('Primary Email') or '').strip().lower()
        d = email_map.get(em) or master_donors.get(n)
        if d:
            bu_matched += 1
            d['tx_list'].append({
                'date': dt.split()[0] if dt else '',
                'amount': float(amt_str or 0),
                'platform': 'BetterUnite',
                'campaign': row.get('Campaign') or '',
                'memo': row.get('Dedication') or row.get('Note') or ''
            })

print(f'BetterUnite donations matched: {bu_matched}/{bu_total} ({bu_matched/bu_total*100:.1f}%)')
