import sqlite3
import pandas as pd

def get_db():
    return sqlite3.connect("C:/Users/Jeff/Documents/AzureMigration/scripts/data/qbo_audit_2024_2026.db")

def main():
    conn = get_db()
    
    # Load accounts
    accounts = pd.read_sql_query("SELECT fully_qualified_name FROM accounts WHERE active=1 ORDER BY fully_qualified_name;", conn)
    print("=== ACCOUNTS ===")
    print(accounts['fully_qualified_name'].tolist())
    
    # Load classes
    classes = pd.read_sql_query("SELECT name FROM classes WHERE active=1 ORDER BY name;", conn)
    print("=== CLASSES ===")
    print(classes['name'].tolist())

if __name__ == '__main__':
    main()
