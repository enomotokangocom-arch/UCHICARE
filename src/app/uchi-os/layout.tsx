import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Uchi OS | 医療福祉経営の意思決定AI",
  description: "訪問看護経営者の意思決定をAI化する経営OS",
};

export default function UchiOsLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-neutral-50 text-neutral-900">{children}</div>;
}
