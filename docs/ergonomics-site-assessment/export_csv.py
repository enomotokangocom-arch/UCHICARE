import csv, re, sys, os
src, outdir = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()
names = {'standard':'01_評価表_標準版','addon':'02_評価表_職種別追加項目','header':'03_訪問記録_ヘッダー',
         'critical':'04_重大懸念記録','hearing':'05_ヒアリング質問','action':'06_アクションプラン','mapping':'07_既存項目の扱い',
         'individual':'08_個人評価票','selfcheck':'09_本人用セルフチェック','individual_plan':'10_個別調整プラン'}
os.makedirs(outdir, exist_ok=True)
for key, name in names.items():
    m = re.search(r'<!-- TABLE:%s -->\n(.*?)<!-- /TABLE:%s -->' % (key, key), s, re.S)
    assert m, key
    rows = []
    for line in m.group(1).strip().splitlines():
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        if all(re.fullmatch(r'-+', c) for c in cells): continue
        rows.append([c.replace('<br>', '\n') for c in cells])
    n = len(rows[0]); assert all(len(r) == n for r in rows), (key, [len(r) for r in rows])
    with open(os.path.join(outdir, name + '.csv'), 'w', encoding='utf-8-sig', newline='') as f:
        csv.writer(f).writerows(rows)
    print(name, len(rows) - 1, 'rows', n, 'cols')
