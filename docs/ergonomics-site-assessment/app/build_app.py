"""csv/ の評価項目から入力ツール(assessment-tool.html)を生成する。
使い方: python3 build_app.py  (このファイルのあるフォルダで実行)
"""
import csv, json, os

here = os.path.dirname(os.path.abspath(__file__))
csvdir = os.path.join(here, '..', 'csv')

def rows(name):
    with open(os.path.join(csvdir, name), encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))

std = [{
    'id': r['ID'], 'domain': r['評価領域'], 'title': r['確認項目'], 'facts': r['評価者が確認する具体的な事実'],
    'method': r['確認方法'], 'criteria': r['判断基準'], 'impact': r['想定される影響'],
    'improve': r['改善案(例)'], 'kubun': r['区分'], 'short': r['短時間版'] == '★',
} for r in rows('01_評価表_標準版.csv')]
addon = [{
    'id': r['ID'], 'job': r['対象職種'], 'domain': r['評価領域'], 'title': r['確認項目'],
    'facts': r['評価者が確認する具体的な事実'], 'method': r['確認方法'], 'criteria': r['判断基準'],
    'impact': r['想定される影響'], 'improve': r['改善案(例)'], 'kubun': r['区分'], 'short': False,
} for r in rows('02_評価表_職種別追加項目.csv')]
indiv = [{
    'id': r['ID'], 'domain': r['評価領域'], 'title': r['確認項目'], 'facts': r['評価者が確認する具体的な事実'],
    'method': r['確認方法'], 'criteria': r['判断基準'], 'unitRef': r['対応する部門評価項目'],
} for r in rows('08_個人評価票.csv')]

data = json.dumps({'standard': std, 'addon': addon, 'individual': indiv}, ensure_ascii=False)
tpl = open(os.path.join(here, 'assessment-tool.template.html'), encoding='utf-8').read()
out = tpl.replace('/*__ITEMS__*/null', data.replace('</', '<\\/'))
open(os.path.join(here, 'assessment-tool.html'), 'w', encoding='utf-8').write(out)
print('items:', len(std), len(addon), len(indiv), 'bytes:', len(out.encode()))
