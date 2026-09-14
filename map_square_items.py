import sqlite3
import pandas as pd

def get_db():
    return sqlite3.connect("C:/Users/Jeff/Documents/AzureMigration/scripts/data/qbo_audit_2024_2026.db")

def main():
    conn = get_db()
    
    # Load accounts
    accounts = pd.read_sql_query("SELECT id, fully_qualified_name FROM accounts;", conn)
    acc_map = dict(zip(accounts['id'], accounts['fully_qualified_name']))
    
    # Load classes
    classes = pd.read_sql_query("SELECT id, name FROM classes;", conn)
    cls_map = dict(zip(classes['id'], classes['name']))
    
    items_to_check = ['Puppy Pack', 'Quartly Payments County', 'RECLAIM FEE CAT', 'RECLAIM FEE DOG ALTERED', 'RECLAIM FEE DOG INTACT', 'Raffle 2025', 'Raffle Ticket', 'Raffle Ticket 2024', 'Raffle Ticket 2025', 'Reclaim Fee', 'Rescue Rival', 'SHIRTS', 'Surrender Fee - Cat', 'Surrender fee - Dog', 'TOYS', 'Ticket For Pawsitivity Event', 'Walk In Donations', 'car and critters', 'cat final', 'dog adoption', 'dog adoption event', 'dog final payment', 'microchip', 'puppy final payment', 'shirts. 2x or larger', 'shirts. size s to xl']
    
    results = []
    
    for item in items_to_check:
        # First, try to find an exact or similar item in QBO items
        qbo_item = pd.read_sql_query("SELECT id, name, income_account_id, expense_account_id FROM items WHERE name LIKE ? COLLATE NOCASE", conn, params=('%' + item + '%',))
        
        # Then, find how it's usually classed in transaction_lines by description OR item_id
        # Let's see if we can find it in descriptions
        query = f"""
            SELECT tl.account_id, tl.class_id, COUNT(*) as cnt
            FROM transaction_lines tl
            WHERE tl.description LIKE ? COLLATE NOCASE OR tl.item_id IN (SELECT id FROM items WHERE name LIKE ? COLLATE NOCASE)
            GROUP BY tl.account_id, tl.class_id
            ORDER BY cnt DESC
        """
        df = pd.read_sql_query(query, conn, params=('%' + item + '%', '%' + item + '%'))
        
        acc_name = "UNKNOWN"
        cls_name = "UNKNOWN"
        
        if len(df) > 0:
            best = df.iloc[0]
            acc_id = best['account_id']
            cls_id = best['class_id']
            
            # If account is null, maybe it uses the item's income_account_id?
            if pd.isna(acc_id) or not acc_id:
                if len(qbo_item) > 0 and qbo_item.iloc[0]['income_account_id']:
                    acc_id = qbo_item.iloc[0]['income_account_id']
            
            if acc_id:
                acc_name = acc_map.get(str(acc_id), f"ID:{acc_id}")
            if cls_id:
                cls_name = cls_map.get(str(cls_id), f"ID:{cls_id}")
                
        results.append(f"| {item} | {acc_name} | {cls_name} |")
            
    print("| Square Item | Account | Class |")
    print("|---|---|---|")
    for r in results:
        print(r)

if __name__ == '__main__':
    main()
