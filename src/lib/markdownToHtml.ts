/** HTML特殊文字をエスケープする。 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** エスケープ済みテキストに **太字** のインライン装飾を適用する。 */
function applyInlineFormatting(escapedText: string): string {
  return escapedText.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function formatInline(rawText: string): string {
  return applyInlineFormatting(escapeHtml(rawText));
}

/**
 * 記事生成プロンプトが出力する限定的なMarkdown(##/### 見出し、段落、- 箇条書き、**太字**)を
 * WordPress REST APIに投稿できるHTMLに変換する。汎用Markdownパーサではなく、
 * このアプリが生成する形式に絞った軽量な変換器。
 */
export function markdownToHtml(markdown: string): string {
  const blocks = markdown.trim().split(/\n\s*\n/);
  const htmlBlocks: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const h3Match = trimmed.match(/^###\s+(.+)$/);
    const h2Match = trimmed.match(/^##\s+(.+)$/);

    if (h3Match) {
      htmlBlocks.push(`<h3>${formatInline(h3Match[1])}</h3>`);
      continue;
    }
    if (h2Match) {
      htmlBlocks.push(`<h2>${formatInline(h2Match[1])}</h2>`);
      continue;
    }

    const lines = trimmed.split("\n").map((l) => l.trim());
    const isList = lines.every((l) => /^[-*]\s+/.test(l));
    if (isList) {
      const items = lines.map((l) => `<li>${formatInline(l.replace(/^[-*]\s+/, ""))}</li>`).join("");
      htmlBlocks.push(`<ul>${items}</ul>`);
      continue;
    }

    htmlBlocks.push(`<p>${formatInline(lines.join(" "))}</p>`);
  }

  return htmlBlocks.join("\n");
}
