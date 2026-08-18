import { useEffect, useRef, useState } from 'react';

interface TrendPoint {
  date: string;
  count: number;
}

interface TrendChartProps {
  data: TrendPoint[];
  height?: number;
  ariaLabel: string;
}

const DEFAULT_HEIGHT = 240;
const PAD_TOP = 16;
const PAD_RIGHT = 8;
const PAD_BOTTOM = 26;
const PAD_LEFT = 8;
const GRID_STEPS = 4;

// "2026-08-10" -> "10/8" (latin digits — standard for chart axes).
function formatDay(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

/**
 * Tiny dependency-free SVG area/line chart. Uses the project's CSS color tokens
 * so it adapts to light/dark mode, is RTL-neutral (kept LTR internally), and
 * carries an accessible text equivalent for screen readers.
 */
export function TrendChart({ data, height = DEFAULT_HEIGHT, ariaLabel }: TrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth || 600);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (data.length === 0) return null;

  const maxCount = Math.max(1, ...data.map((p) => p.count));
  const innerW = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const innerH = height - PAD_TOP - PAD_BOTTOM;

  const xFor = (i: number) =>
    data.length === 1
      ? PAD_LEFT + innerW / 2
      : PAD_LEFT + (i / (data.length - 1)) * innerW;
  const yFor = (count: number) => PAD_TOP + innerH - (count / maxCount) * innerH;

  const linePoints = data.map((p, i) => `${xFor(i)},${yFor(p.count)}`);

  const linePath =
    data.length === 1
      ? `M ${xFor(0)} ${yFor(data[0].count)} L ${xFor(0) + 1} ${yFor(data[0].count)}`
      : `M ${linePoints.join(' L ')}`;

  const areaPath = data.length === 1
    ? `M ${xFor(0)} ${PAD_TOP + innerH} L ${xFor(0)} ${yFor(data[0].count)} L ${xFor(0)} ${PAD_TOP + innerH} Z`
    : `M ${PAD_LEFT} ${PAD_TOP + innerH} L ${linePoints.join(' L ')} L ${PAD_LEFT + innerW} ${PAD_TOP + innerH} Z`;

  const gridLines = Array.from({ length: GRID_STEPS + 1 }, (_, i) => {
    const value = (maxCount / GRID_STEPS) * i;
    return { y: yFor(value), value: Math.round(value) };
  });

  const labelCount = Math.min(6, data.length);
  const labelIndexes = Array.from({ length: labelCount }, (_, i) =>
    labelCount === 1
      ? 0
      : Math.round((i * (data.length - 1)) / (labelCount - 1)),
  );

  const active = activeIndex != null ? data[activeIndex] : null;

  return (
    <div ref={containerRef} className="relative w-full select-none" dir="ltr">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        className="block"
      >
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="transparent"
          className="cursor-crosshair"
          onMouseLeave={() => setActiveIndex(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const idx = Math.round(((x - PAD_LEFT) / innerW) * (data.length - 1));
            setActiveIndex(Math.min(data.length - 1, Math.max(0, idx)));
          }}
        />
        {gridLines.map((g) => (
          <g key={g.y}>
            <line
              x1={PAD_LEFT}
              x2={PAD_LEFT + innerW}
              y1={g.y}
              y2={g.y}
              stroke="var(--border)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <text
              x={PAD_LEFT}
              y={g.y - 4}
              fontSize={10}
              fill="var(--muted-foreground)"
            >
              {g.value}
            </text>
          </g>
        ))}
        <path d={areaPath} fill="var(--primary)" opacity={0.12} />
        <path
          d={linePath}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {labelIndexes.map((i) => (
          <text
            key={i}
            x={xFor(i)}
            y={height - 8}
            fontSize={10}
            fill="var(--muted-foreground)"
            textAnchor="middle"
          >
            {formatDay(data[i].date)}
          </text>
        ))}
        {active && activeIndex != null && (
          <circle
            cx={xFor(activeIndex)}
            cy={yFor(active.count)}
            r={4}
            fill="var(--primary)"
            stroke="var(--card)"
            strokeWidth={2}
          />
        )}
      </svg>

      {active && activeIndex != null && (
        <div
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-sm"
          style={{
            left: Math.min(Math.max(xFor(activeIndex) - 40, 0), Math.max(width - 110, 0)),
            top: Math.max(yFor(active.count) - 46, 0),
          }}
          dir="rtl"
        >
          <div className="font-medium text-foreground">{formatDay(active.date)}</div>
          <div className="text-muted-foreground">{active.count.toLocaleString('ar-EG')}</div>
        </div>
      )}

      {/* Accessible textual equivalent of the chart */}
      <ul className="sr-only">
        {data.map((p) => (
          <li key={p.date}>
            {formatDay(p.date)}: {p.count}
          </li>
        ))}
      </ul>
    </div>
  );
}
