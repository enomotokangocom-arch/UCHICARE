import { getSession } from "@/server/uchi-os/auth/session";
import { getCeoMorningData } from "@/server/uchi-os/ceo-morning";
import { formatYearMonth } from "@/server/uchi-os/kpi-engine/dates";
import { CeoMorningView } from "@/components/uchi-os/ceo-morning/CeoMorningView";

export default async function CeoMorningPage() {
  const session = await getSession();
  if (!session) return null; // layout側でredirect済み

  const yearMonth = formatYearMonth(new Date());
  const data = await getCeoMorningData(session.organizationId, yearMonth);

  return <CeoMorningView data={data} />;
}
