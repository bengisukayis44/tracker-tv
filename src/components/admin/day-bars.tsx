/** "24 Eki" */
const dayLabel = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" });
const label = (day: string) => dayLabel.format(new Date(`${day}T00:00:00Z`));

/**
 * One count per day as thin bars (a single series, so no legend: the title names it), with the exact number on
 * hover/focus and a table for screen readers.
 */
export function DayBars({
  title,
  unit,
  data,
}: {
  title: string;
  unit: string;
  data: { day: string; count: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);
  return (
    <figure className="bg-card space-y-3 rounded-2xl border p-4">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{title}</span>
        <span className="text-muted-foreground text-sm">
          Toplam {total} {unit}
        </span>
      </figcaption>
      <div aria-hidden className="flex h-32 items-end gap-0.5 border-b">
        {data.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end">
            <div
              className="bg-primary group-hover:bg-primary-strong w-full rounded-t-[4px]"
              style={{ height: d.count ? `${(d.count / max) * 100}%` : 0 }}
            />
            <span className="bg-popover text-popover-foreground pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md border px-2 py-1 text-xs whitespace-nowrap shadow group-hover:block">
              {label(d.day)}: <strong>{d.count}</strong> {unit}
            </span>
          </div>
        ))}
      </div>
      <div aria-hidden className="text-muted-foreground flex justify-between text-xs">
        <span>{label(data[0].day)}</span>
        <span>{label(data[data.length - 1].day)}</span>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Gün</th>
            <th>{unit}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td>{label(d.day)}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
