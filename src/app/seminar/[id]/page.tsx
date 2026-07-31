import { notFound } from "next/navigation";
import { getSeminarTopic, seminarTopics } from "@/lib/seminarTopics";
import { SeminarDetail } from "@/components/SeminarDetail";

export function generateStaticParams() {
  return seminarTopics.map((topic) => ({ id: topic.id }));
}

export default async function SeminarTopicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const topic = getSeminarTopic(id);
  if (!topic) notFound();

  return <SeminarDetail topic={topic} />;
}
