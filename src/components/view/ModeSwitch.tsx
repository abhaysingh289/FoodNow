import { cn } from "@/components/ui";
import type { ViewMode } from "@/lib/viewMode";

function DesktopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </svg>
  );
}

/** "Desktop | Mobile" segmented control. Purely presentational: the caller decides what a switch does. */
export function ModeSwitch({
  mode,
  onChange,
  className,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}) {
  const options: { value: ViewMode; label: string; icon: React.ReactNode }[] = [
    { value: "desktop", label: "Desktop", icon: <DesktopIcon /> },
    { value: "mobile", label: "Mobile", icon: <PhoneIcon /> },
  ];
  return (
    <div role="group" aria-label="View" className={cn("flex rounded-chip bg-fill p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          data-testid={`view-${o.value}`}
          aria-pressed={o.value === mode}
          onClick={() => o.value !== mode && onChange(o.value)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-chip px-3 text-sm font-semibold transition-colors",
            o.value === mode ? "bg-surface text-ink shadow-[0_1px_3px_rgb(0_0_0/0.12)]" : "text-muted hover:text-ink",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
