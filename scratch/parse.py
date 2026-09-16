import json
txt = open(r'C:\Users\Jeff\.gemini\antigravity\brain\a74d41a7-731e-40aa-93ec-c3aac03d7cd3\.system_generated\steps\1430\output.txt', encoding='utf-8').read()
data = json.loads(txt[txt.find('{'):])
txns = []
def walk(node):
    if isinstance(node, dict):
        if 'ColData' in node and len(node['ColData']) >= 7:
            try:
                amt_str = node['ColData'][6].get('value', '0')
                if not amt_str: amt_str = '0'
                amt = float(amt_str)
                if amt == 0 and len(node['ColData']) > 7:
                    amt_str2 = node['ColData'][7].get('value', '0')
                    if not amt_str2: amt_str2 = '0'
                    amt = float(amt_str2)
                txns.append({'date': node['ColData'][0].get('value'), 'type': node['ColData'][1].get('value'), 'amt': amt})
            except Exception as e:
                pass
        for v in node.values(): walk(v)
    elif isinstance(node, list):
        for v in node: walk(v)
walk(data)
txns.sort(key=lambda x: abs(x['amt']), reverse=True)
for t in txns[:20]: print(t)
