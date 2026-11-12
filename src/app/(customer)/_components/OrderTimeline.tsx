export type EventView = { id: string; toStatus: string; actor: string; note: string | null; createdAt: string };

export function OrderTimeline({ events }: { events: EventView[] }) {
  return (
    <ol className="space-y-3 border-l-2 border-line pl-4">
      {events.map((e) => (
        <li key={e.id} data-testid="timeline-event" className="relative">
          <span className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-chip bg-brand" aria-hidden="true" />
          <p className="text-sm font-semibold">{e.toStatus.replaceAll("_", " ")}</p>
          <p className="text-xs text-muted">
            {e.actor} ·{" "}
            <time dateTime={e.createdAt} suppressHydrationWarning>
              {new Date(e.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </time>
          </p>
          {e.note && <p className="text-sm text-muted">{e.note}</p>}
        </li>
      ))}
    </ol>
  );
}
