import type { Metadata, Viewport } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "Uchi Management OS", template: "%s | Uchi Management OS" },
  description: "株式会社Uchi care の訪問看護・居宅介護支援の経営管理",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, colorScheme: "light" };

export default function MosRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="h-full antialiased" style={{ colorScheme: "light" }}>
      <body className="min-h-full bg-slate-50 text-slate-900" style={{ background: "#f8fafc", color: "#0f172a", fontFamily: '"Hiragino Sans", "Noto Sans JP", "Yu Gothic UI", system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
