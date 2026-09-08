export function PageHeader({ title, yearMonth }: { title: string; yearMonth: string }) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <h1 className="text-xl font-semibold tracking-tight text-neutral-900">{title}</h1>
      <span className="text-sm text-neutral-500">{yearMonth}</span>
    </div>
  );
}
