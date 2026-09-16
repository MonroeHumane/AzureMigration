import json
txt = open(r"C:\Users\Jeff\.gemini\antigravity\brain\a74d41a7-731e-40aa-93ec-c3aac03d7cd3\.system_generated\steps\1672\output.txt", encoding="utf-8").read()
items = json.loads(txt[txt.find("["):txt.rfind("]")+1])
# Any other large deposits (>$10k) in this period that are also uncleared
big = [d for d in items if float(d.get("TotalAmt",0)) > 10000]
for d in sorted(big, key=lambda x: x.get("TxnDate","")):
    sync = d.get("SyncToken")
    did = d["Id"]; txn = d.get("TxnDate"); amt = d.get("TotalAmt")
    note = d.get("PrivateNote","")[:60]
    print(f"ID {did}  TxnDate {txn}  Amt {amt}  SyncToken {sync}  {note}")
