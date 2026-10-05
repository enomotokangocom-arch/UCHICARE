"""pptxgenjs出力の後処理：日本語フォントを東アジア用フォントにも設定し、言語を日本語にする。
使い方: python postprocess.py deck.pptx
"""
import re, sys, zipfile, shutil, os, tempfile

FONT = "BIZ UDPGothic"
path = sys.argv[1]
tmp = tempfile.mktemp(suffix=".pptx")
with zipfile.ZipFile(path) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        data = zin.read(item.filename)
        name = item.filename
        if name.startswith("ppt/theme/") and name.endswith(".xml"):
            x = data.decode("utf-8")
            x = x.replace('<a:ea typeface=""/>', f'<a:ea typeface="{FONT}"/>')
            x = re.sub(r'<a:font script="Jpan" typeface="[^"]*"/>', f'<a:font script="Jpan" typeface="{FONT}"/>', x)
            data = x.encode("utf-8")
        elif re.match(r"ppt/(slides|slideLayouts|slideMasters|notesSlides|notesMasters)/[^/]+\.xml$", name):
            x = data.decode("utf-8")
            x = x.replace('lang="en-US"', 'lang="ja-JP" altLang="en-US"')
            data = x.encode("utf-8")
        zout.writestr(item, data)
shutil.move(tmp, path)
print("postprocessed", path)
