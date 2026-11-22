import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { StoreHydration } from "@/components/StoreHydration";
import { AccessGuard } from "@/components/portal/AccessGuard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Uchi care 社内ポータル",
  description:
    "株式会社Uchi care の社内ポータル。運行管理表・アルコールチェック・人事評価・委員会議事録・社内のお知らせと外部システムへのリンクを一括管理します。",
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
            <main className="min-w-0 flex-1 pt-14 lg:pt-0">
              <AccessGuard>{children}</AccessGuard>
            </main>
          </div>
        </StoreHydration>
      </body>
    </html>
  );
}
