import sqlite3
import pandas as pd

def get_db():
    return sqlite3.connect("C:/Users/Jeff/Documents/AzureMigration/scripts/data/qbo_audit_2024_2026.db")

def main():
    conn = get_db()
    
    tables = pd.read_sql_query("SELECT name FROM sqlite_master WHERE type='table';", conn)
    print("Tables:")
    print(tables['name'].tolist())

if __name__ == '__main__':
    main()
