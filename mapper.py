import pandas as pd
df = pd.read_csv('C:/Users/Jeff/Documents/AzureMigration/desc_counts.csv')

keywords = ['surrender', 'donation', 'adopt', 'member', 'humane', 'nail', 'microchip', 'nubs', 'pug', 'bank', 'medical']

for kw in keywords:
    print(f'\n--- Matches for {kw} ---')
    matches = df[df['description'].str.contains(kw, case=False, na=False)]
    for _, row in matches.head(3).iterrows():
        print(f"[{row['count']}] {str(row['description'])[:50]} -> Acc: {row['account_name']}, Class: {row['class_name']}")

