import sqlite3
conn = sqlite3.connect('scripts/data/payee_matching.db')
rows = conn.execute("SELECT category, txn_date, amount, memo, original_name FROM gl_transactions WHERE year=2025 AND id NOT IN (SELECT transaction_id FROM payee_matches) AND original_name='Unknown'").fetchall()
for r in rows:
    if r[0] in ('Individual Donor Contributions', 'Adoption fees', 'Event Donation', 'Bottle & Can Recycling Revenue', 'Property Sale', 'Services', 'Revenue', 'Contributed income'):
        print(r)
