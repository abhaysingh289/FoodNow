import type { CountryCode } from "@/lib/countries";
import { formatTime } from "@/lib/time";

export type EventView = { id: string; toStatus: string; actor: string; note: string | null; createdAt: string };

export function OrderTimeline({ events, country }: { events: EventView[]; country: CountryCode }) {
  return (
    <ol className="space-y-4 border-l border-line-strong pl-5">
      {events.map((e) => (
        <li key={e.id} data-testid="timeline-event" className="relative">
          <span
            className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-muted"
            aria-hidden="true"
          />
          <p className="text-sm font-semibold">{e.toStatus.replaceAll("_", " ")}</p>
          <p className="text-xs text-muted">
            {e.actor} ·{" "}
            <time dateTime={e.createdAt}>
              {formatTime(e.createdAt, country)}
            </time>
          </p>
          {e.note && <p className="text-sm text-muted">{e.note}</p>}
        </li>
      ))}
    </ol>
  );
}
