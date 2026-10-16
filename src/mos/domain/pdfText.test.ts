import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { groupIntoLines, pdfToPageLines } from "./pdfText";

describe("PDF テキストの行再構成", () => {
  it("同じ高さのテキスト片を x 座標順に1行にまとめ、上から順に並べる", () => {
    const lines = groupIntoLines([
      { str: "8,000", x: 300, y: 700, height: 8 },
      { str: "給", x: 20, y: 700.5, height: 8 },
      { str: "料", x: 30, y: 700, height: 8 },
      { str: "9,000", x: 400, y: 699.2, height: 8 },
      { str: "勘定科目", x: 20, y: 720, height: 8 },
      { str: " ", x: 50, y: 720, height: 8 },
      { str: "雑費", x: 20, y: 680, height: 8 },
    ]);
    expect(lines).toEqual(["勘定科目", "給 料 8,000 9,000", "雑費"]);
  });

  it("実際の PDF からページごとの行を取り出せる", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([600, 400]);
    page.drawText("TITLE LINE", { x: 20, y: 360, size: 10, font });
    page.drawText("ACCOUNT", { x: 20, y: 300, size: 10, font });
    page.drawText("1,000", { x: 300, y: 300, size: 10, font });
    page.drawText("-2,000", { x: 400, y: 300, size: 10, font });
    doc.addPage([600, 400]).drawText("PAGE TWO", { x: 20, y: 300, size: 10, font });
    const bytes = await doc.save();
    const pages = await pdfToPageLines(bytes);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toEqual(["TITLE LINE", "ACCOUNT 1,000 -2,000"]);
    expect(pages[1]).toEqual(["PAGE TWO"]);
  });
});
