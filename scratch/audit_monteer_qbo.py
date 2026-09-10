import sqlite3
p = r"E:\qbbackup\qbo_mirror.db"
c = sqlite3.connect(p)
c.row_factory = sqlite3.Row
print("salary/labor/professional accounts:")
for r in c.execute(
    """
    SELECT id, name, account_type,
           json_extract(raw_json, '$.FullyQualifiedName') AS fqn,
           json_extract(raw_json, '$.AccountSubType') AS sub
    FROM qbo_record
    WHERE entity_type='Account' AND active=1
      AND (
        lower(name) LIKE '%salar%'
        OR lower(name) LIKE '%wage%'
        OR lower(name) LIKE '%labor%'
        OR lower(name) LIKE '%contract%'
        OR lower(name) LIKE '%professional%'
        OR lower(name) LIKE '%compensat%'
        OR lower(json_extract(raw_json, '$.FullyQualifiedName')) LIKE '%personnel%'
      )
    ORDER BY fqn
    """
):
    print(dict(r))

print("\nline 13 of bill 6455:")
for r in c.execute(
    "SELECT line_id, line_num, amount, description, account_id FROM qbo_line WHERE parent_id='6455' AND parent_type='Bill' ORDER BY line_num"
):
    print(dict(r))
