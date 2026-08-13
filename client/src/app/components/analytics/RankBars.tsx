import type { ReactNode } from 'react';

export interface RankItem {
  key: string;
  label: string;
  sublabel?: string;
  value: number;
  icon?: ReactNode;
}

interface RankBarsProps {
  items: RankItem[];
  emptyText?: string;
  formatValue?: (n: number) => string;
}

/**
 * Clean horizontal percentage-bar ranking list. Used for pages, devices,
 * content types and event breakdowns. Accessible rows (role="progressbar").
 */
export function RankBars({
  items,
  emptyText = 'لا توجد بيانات كافية خلال الفترة المحددة',
  formatValue = (n) => n.toLocaleString('ar-EG'),
}: RankBarsProps) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
    );
  }

  const total = items.reduce((sum, it) => sum + it.value, 0);

  return (
    <ul className="space-y-4">
      {items.map((it) => {
        const pct = total > 0 ? (it.value / total) * 100 : 0;
        return (
          <li key={it.key}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                {it.icon && <span className="shrink-0 text-muted-foreground">{it.icon}</span>}
                <span className="min-w-0">
                  <span className="block truncate font-medium">{it.label}</span>
                  {it.sublabel && (
                    <span className="block truncate text-xs text-muted-foreground" dir="ltr">
                      {it.sublabel}
                    </span>
                  )}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs">
                <span className="font-medium text-foreground">{formatValue(it.value)}</span>
                <span className="w-10 text-left text-muted-foreground" dir="ltr">
                  {pct.toFixed(1)}%
                </span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="presentation">
              <div
                role="progressbar"
                aria-valuenow={Math.round(pct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${it.label}: ${pct.toFixed(1)}%`}
                className="h-full rounded-full bg-primary/80 transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
