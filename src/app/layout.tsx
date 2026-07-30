import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { StoreHydration } from "@/components/StoreHydration";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UCHICARE | 企業向け健康経営ダッシュボード",
  description:
    "保健師・療法士・ケアマネジャーが監修する、労働環境・ストレスチェック・腰痛リスク・介護リスクを統合した企業向け健康経営データ可視化ツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-50 text-slate-900">
        <StoreHydration>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="min-w-0 flex-1">{children}</main>
          </div>
        </StoreHydration>
      </body>
    </html>
  );
}
