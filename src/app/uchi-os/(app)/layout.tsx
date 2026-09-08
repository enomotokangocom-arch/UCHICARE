import { redirect } from "next/navigation";
import { getSession } from "@/server/uchi-os/auth/session";
import { prisma } from "@/server/uchi-os/db/client";
import { AppShell } from "@/components/uchi-os/AppShell";

export default async function UchiOsAppLayout({ children }: { children: React.ReactNode }) {
  // middleware側で未ログインは/loginへリダイレクト済みだが、Server Component側でも防御的に確認する。
  const session = await getSession();
  if (!session) {
    redirect("/uchi-os/login");
  }

  const organization = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { name: true },
  });

  return (
    <AppShell orgName={organization?.name ?? ""} userName={session.name} userRole={session.role}>
      {children}
    </AppShell>
  );
}
