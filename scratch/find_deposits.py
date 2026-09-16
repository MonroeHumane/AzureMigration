import json
path = r'C:\Users\Jeff\.gemini\antigravity\brain\7e016732-6e76-4e94-bc20-ec546c9b118f\.system_generated\steps\12\output.txt'
txt = open(path, encoding='utf-8').read()
deposits = json.loads(txt[txt.find('['):txt.rfind(']')+1])
total = 0
for d in deposits:
    if 'missing from QBO' in d.get('PrivateNote', ''):
        total += float(d.get('TotalAmt', 0))
print(f"Total: {total}")
