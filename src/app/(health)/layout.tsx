import { Sidebar } from "@/components/Sidebar";
import { StoreHydration } from "@/components/StoreHydration";

export default function HealthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <StoreHydration>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </StoreHydration>
  );
}
