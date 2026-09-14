import sys
content = open('api/src/index.js', 'r', encoding='utf-8').read()
fetcher = open('financial_fetcher.js', 'r', encoding='utf-16').read()
new_content = content.replace('function mergeMultiYearFinancials() {', fetcher + '\nfunction mergeMultiYearFinancials() {')
open('api/src/index.js', 'w', encoding='utf-8').write(new_content)
