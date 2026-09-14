import sqlite3
import pandas as pd

def get_db():
    return sqlite3.connect("C:/Users/Jeff/Documents/AzureMigration/scripts/data/qbo_audit_2024_2026.db")

def main():
    conn = get_db()
    
    accounts = pd.read_sql_query("SELECT id, fully_qualified_name FROM accounts;", conn)
    acc_map = dict(zip(accounts['id'], accounts['fully_qualified_name']))
    classes = pd.read_sql_query("SELECT id, name FROM classes;", conn)
    cls_map = dict(zip(classes['id'], classes['name']))
    
    queries = ["adoption", "surrender", "donation"]
    
    for q in queries:
        print(f"\n--- Searching for {q} ---")
        df = pd.read_sql_query(f"""
            SELECT tl.account_id, tl.class_id, COUNT(*) as cnt
            FROM transaction_lines tl
            WHERE tl.description LIKE '%{q}%'
            GROUP BY tl.account_id, tl.class_id
            ORDER BY cnt DESC
            LIMIT 5
        """, conn)
        
        for i, row in df.iterrows():
            acc = acc_map.get(str(row['account_id']), "UNKNOWN")
            cls = cls_map.get(str(row['class_id']), "UNKNOWN")
            print(f"Count: {row['cnt']} | Account: {acc} | Class: {cls}")

if __name__ == '__main__':
    main()
