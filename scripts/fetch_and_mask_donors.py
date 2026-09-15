import json
import os
import hashlib
import sys

def mask_string(s):
    if not s:
        return s
    return "MASKED_" + hashlib.md5(s.encode('utf-8')).hexdigest()[:8]

def mask_email(e):
    if not e:
        return e
    parts = e.split('@')
    if len(parts) == 2:
        return mask_string(parts[0]) + "@example.com"
    return mask_string(e)

def main():
    print("Starting PII masking tool...")
    target_path = os.path.join(os.path.dirname(__file__), '..', 'api', 'data', 'donor_database.json')
    target_path = os.path.abspath(target_path)
    
    if not os.path.exists(target_path):
        print(f"Error: Could not find {target_path}.")
        sys.exit(1)
        
    with open(target_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    if 'donors' not in data:
        print("No 'donors' array found in JSON.")
        sys.exit(1)
        
    count = 0
    for d in data['donors']:
        if 'first_name' in d: d['first_name'] = mask_string(d['first_name'])
        if 'last_name' in d: d['last_name'] = mask_string(d['last_name'])
        if 'display_name' in d: d['display_name'] = mask_string(d['display_name'])
        if 'email' in d: d['email'] = mask_email(d['email'])
        if 'phone' in d: d['phone'] = mask_string(d['phone'])
        if 'address' in d:
            addr = d['address']
            if 'line1' in addr: addr['line1'] = mask_string(addr['line1'])
            if 'line2' in addr: addr['line2'] = mask_string(addr['line2'])
            if 'city' in addr: addr['city'] = mask_string(addr['city'])
        count += 1
        
    masked_path = target_path.replace('.json', '_masked.json')
    with open(masked_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
        
    os.replace(masked_path, target_path)
    print(f"Successfully masked {count} donor records to protect PII.")
    print("Safe for local development!")

if __name__ == '__main__':
    main()
