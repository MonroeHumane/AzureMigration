import sqlite3
import pandas as pd

def get_db():
    return sqlite3.connect("C:/Users/Jeff/Documents/AzureMigration/scripts/data/qbo_audit_2024_2026.db")

def main():
    conn = get_db()
    
    schema = pd.read_sql_query("PRAGMA table_info(accounts);", conn)
    print("Schema for accounts:")
    print(schema)

if __name__ == '__main__':
    main()
