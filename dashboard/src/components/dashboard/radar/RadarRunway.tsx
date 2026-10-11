import { cn } from "@/lib/utils";
import { daysUntil, type RadarItem } from "@/lib/mock/radar";
import { DOT, RUNWAY_DAYS, shortDate } from "./radarMeta";

interface RadarRunwayProps {
  items: RadarItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const TICKS = [
  { label: "TODAY", at: 0 },
  { label: "+30 DAYS", at: 30 },
  { label: "+60 DAYS", at: 60 },
];

/** A single line from today forward. Every dated change is a dot on it; click a dot to open its row. */
export default function RadarRunway({ items, selectedId, onSelect }: RadarRunwayProps) {
  const dated = items.filter((i) => daysUntil(i) !== undefined);
  const undated = items.length - dated.length;

  return (
    <div className="px-5 pb-6 pt-5 md:px-8">
      <div className="relative h-12">
        <span aria-hidden className="absolute left-0 right-0 top-1/2 h-px bg-box-outline dark:bg-dark-border" />
        {TICKS.map((t) => (
          <span
            key={t.label}
            aria-hidden
            className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-box-outline dark:bg-dark-border"
            style={{ left: (t.at / RUNWAY_DAYS) * 100 + "%" }}
          />
        ))}
        {dated.map((item) => {
          const days = Math.min(Math.max(daysUntil(item) ?? 0, 0), RUNWAY_DAYS);
          const active = item.id === selectedId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              title={shortDate(item) + " · " + item.service + " · " + item.title}
              aria-label={item.service + ": " + item.title}
              aria-pressed={active}
              className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2 p-2"
              style={{ left: (days / RUNWAY_DAYS) * 100 + "%" }}
            >
              <span
                className={cn(
                  "block h-3 w-3 rounded-full ring-2 ring-section transition-transform group-hover:scale-125 dark:ring-dark-dash-section",
                  DOT[item.severity],
                  active && "scale-150"
                )}
              />
            </button>
          );
        })}
      </div>
      <div className="relative mt-1 h-4 font-aeonik-mono text-[10px] tracking-wider text-text-primary/45 dark:text-white/40">
        {TICKS.map((t) => (
          <span
            key={t.label}
            className={cn("absolute", t.at === 0 ? "left-0" : t.at === RUNWAY_DAYS ? "right-0" : "-translate-x-1/2")}
            style={t.at === 0 || t.at === RUNWAY_DAYS ? undefined : { left: (t.at / RUNWAY_DAYS) * 100 + "%" }}
          >
            {t.label}
          </span>
        ))}
      </div>
      {undated > 0 && (
        <p className="mt-3 font-aeonik-light text-xs text-text-primary/50 dark:text-white/45">
          {undated} more {undated === 1 ? "has" : "have"} no date yet, so {undated === 1 ? "it is" : "they are"} not on the line.
        </p>
      )}
    </div>
  );
}
