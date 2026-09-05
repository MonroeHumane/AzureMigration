import sqlite3

conn = sqlite3.connect(r'E:\qbbackup\qbo_mirror.db')
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [row[0] for row in cursor.fetchall()]
print('Tables in E:\\qbbackup\\qbo_mirror.db:')
for t in sorted(tables):
    cursor.execute(f'SELECT COUNT(*) FROM "{t}"')
    cnt = cursor.fetchone()[0]
    print(f'  {t}: {cnt} rows')
