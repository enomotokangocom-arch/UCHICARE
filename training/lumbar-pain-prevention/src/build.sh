#!/usr/bin/env bash
# 研修スライドのビルド（PPTX生成 → テーマ適用 → 日本語フォント後処理 → PDF）
# 必要: node + pptxgenjs, python3, LibreOffice (Impress)
# 例: NODE_PATH=/path/to/node_modules APPLY_THEME=/path/to/apply_theme.js ./build.sh
set -euo pipefail
cd "$(dirname "$0")"
OUT_DIR=..
NAME="UchiCare_腰痛予防研修_訪問看護・居宅介護支援"
node build_deck.js "$OUT_DIR/$NAME.pptx" "${APPLY_THEME:-}"
python3 postprocess.py "$OUT_DIR/$NAME.pptx"
soffice --headless --convert-to pdf --outdir "$OUT_DIR" "$OUT_DIR/$NAME.pptx"
