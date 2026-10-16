// PDF のテキストを「ページ → 行」に再構成する。
// テキスト片を y 座標でまとめて行にし、行内は x 座標順に空白区切りで連結する。
import { extractTextItems } from "unpdf";

export type PositionedText = { str: string; x: number; y: number; height: number };

/** 位置付きテキスト片を行にまとめる（純粋関数。テスト対象） */
export function groupIntoLines(items: PositionedText[]): string[] {
  const visible = items.filter((i) => i.str.trim() !== "");
  // 上から下へ（PDF 座標は下が原点）
  const sorted = [...visible].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: { y: number; tol: number; parts: PositionedText[] }[] = [];
  for (const item of sorted) {
    const tol = Math.max(2, (item.height || 0) * 0.4);
    const line = lines.find((l) => Math.abs(l.y - item.y) <= Math.max(l.tol, tol));
    if (line) line.parts.push(item);
    else lines.push({ y: item.y, tol, parts: [item] });
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map((l) =>
      l.parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.str.trim())
        .join(" "),
    );
}

export async function pdfToPageLines(data: Uint8Array): Promise<string[][]> {
  // unpdf/pdf.js は渡したバッファを移譲（detach）するため複製して渡す
  const { items } = await extractTextItems(new Uint8Array(data));
  return items.map((page) => groupIntoLines(page.map((i) => ({ str: i.str, x: i.x, y: i.y, height: i.height }))));
}
