import Link from "next/link";
import { cn } from "@/lib/utils";

export type DonutPart = {
  key: string;
  label: string;
  value: number;
  color: string;
  href?: string;
};

const SIZE = 128;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Folga na cor do cartão entre as fatias, em vez de borda ao redor delas. */
const GAP = 3;

export function StatusDonut({
  parts,
  totalLabel,
}: {
  parts: DonutPart[];
  totalLabel: string;
}) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  const visible = parts.filter((part) => part.value > 0);
  const gap = visible.length > 1 ? GAP : 0;

  const lengthOf = (part: DonutPart) => (part.value / Math.max(total, 1)) * CIRCUMFERENCE;
  const arcs = visible.map((part, index) => {
    const dash = Math.max(lengthOf(part) - gap, 1);
    return {
      ...part,
      dash,
      rest: CIRCUMFERENCE - dash,
      dashOffset: -visible.slice(0, index).reduce((sum, item) => sum + lengthOf(item), 0),
    };
  });

  return (
    <div className="my-auto flex flex-wrap items-center gap-x-4 gap-y-4">
      <div className="relative mx-auto shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`${total} ${totalLabel}: ${visible
            .map((part) => `${part.label} ${part.value}`)
            .join(", ")}`}
          className="-rotate-90"
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--insyt-canvas-alt)"
            strokeWidth={STROKE}
          />
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={arc.color}
              strokeWidth={STROKE}
              strokeDasharray={`${arc.dash} ${arc.rest}`}
              strokeDashoffset={arc.dashOffset}
            >
              <title>{`${arc.label}: ${arc.value}`}</title>
            </circle>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-[family-name:var(--font-heading)] text-[1.625rem] font-bold leading-none text-[var(--insyt-black)]">
            {total}
          </span>
          <span className="mt-1 text-xs text-[var(--insyt-muted)]">{totalLabel}</span>
        </div>
      </div>

      <ul className="min-w-[11rem] flex-1 space-y-0.5">
        {parts.map((part) => {
          const share = total > 0 ? Math.round((part.value / total) * 100) : 0;
          const content = (
            <>
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: part.color }}
              />
              <span className="min-w-0 flex-1 truncate text-[var(--insyt-slate)]">
                {part.label}
              </span>
              <span className="font-semibold tabular-nums text-[var(--insyt-black)]">
                {part.value}
              </span>
              <span className="w-8 text-right text-xs tabular-nums text-[var(--insyt-muted)]">
                {share}%
              </span>
            </>
          );
          const rowClass = "flex items-center gap-2 rounded-lg px-1 py-1 text-[13px]";
          return (
            <li key={part.key}>
              {part.href ? (
                <Link
                  href={part.href}
                  className={cn(
                    rowClass,
                    "transition-colors duration-150 hover:bg-[var(--insyt-canvas)]",
                  )}
                >
                  {content}
                </Link>
              ) : (
                <span className={rowClass}>{content}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
