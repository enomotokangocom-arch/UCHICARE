import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * セキュリティのためのHTTPヘッダー
 * - 読み込んでよい外部サイトを限定する(Content-Security-Policy)。不正なスクリプトの実行・情報の外部送信を防ぐ
 * - 他のサイトの中に埋め込ませない(クリックジャッキング対策)
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://accounts.google.com https://vercel.live`,
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "img-src 'self' blob: data: https:",
  "font-src 'self' data: https://vercel.live",
  "media-src 'self' blob:",
  // Supabase(ログイン・データ)、Google(ドライブ連携)
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://vercel.live wss://ws-us3.pusher.com",
  "frame-src 'self' https://accounts.google.com https://docs.google.com https://drive.google.com https://vercel.live",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 録音(議事録)のためマイクだけ自サイトに許可
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // ログイン後の画面・APIの応答を共有キャッシュに残さない
      { source: "/api/(.*)", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
