import Image from "next/image";
import { ReactNode } from "react";

/**
 * 店舗の看板デザイン(紺地・金の細い曲線・六角形のマーク)をもとにした見出しエリア。
 */
export function BrandHero({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-brand-700 p-5 text-white shadow-sm sm:p-7">
      {/* 装飾: 右下の濃紺の曲面と金の細い弧 */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 800 200" preserveAspectRatio="none" aria-hidden>
        <path d="M560 200 C 620 120, 700 70, 800 60 L 800 200 Z" fill="#26374a" />
        <path d="M470 200 C 560 110, 680 40, 800 20" fill="none" stroke="#d8c484" strokeWidth="1.5" opacity="0.9" />
        <path d="M0 40 C 60 20, 110 0, 150 0" fill="none" stroke="#d8c484" strokeWidth="1.2" opacity="0.6" />
      </svg>
      <Image
        src="/brand/uchicare-mark-white.png"
        alt=""
        width={117}
        height={113}
        className="pointer-events-none absolute right-5 top-1/2 hidden h-20 w-auto -translate-y-1/2 opacity-90 sm:block"
        loading="eager"
      />
      <div className="relative">{children}</div>
    </div>
  );
}
