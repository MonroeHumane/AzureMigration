import sqlite3
import pandas as pd
import sys

def main():
    db_path = "C:/Users/Jeff/Documents/AzureMigration/scripts/data/qbo_audit_2024_2026.db"
    conn = sqlite3.connect(db_path)
    
    tables = pd.read_sql_query("SELECT name FROM sqlite_master WHERE type='table';", conn)
    print("Tables:")
    print(tables)
    
    for table in tables['name']:
        print(f"\nSchema for {table}:")
        schema = pd.read_sql_query(f"PRAGMA table_info({table});", conn)
        print(schema)
        
        print(f"\nSample data for {table}:")
        sample = pd.read_sql_query(f"SELECT * FROM {table} LIMIT 5;", conn)
        print(sample)

if __name__ == '__main__':
    main()
