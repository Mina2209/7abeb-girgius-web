import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Archive,
  BarChart3,
  BookOpen,
  CalendarRange,
  Download,
  FileDown,
  FileJson,
  FileSpreadsheet,
  Loader2,
  Monitor,
  Presentation,
  RefreshCw,
  Share2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import {
  downloadExport,
  FULL_EXPORT_FORMAT,
  type ExportDatasetId,
  type ExportFormat,
  type ExportRange,
} from '../services/analyticsExport';

// ---------------------------------------------------------------------------
// Labels — technical values -> Arabic, human readable.
// ---------------------------------------------------------------------------

type RangePreset = 'today' | '7d' | '30d' | '90d' | 'custom';

const PRESET_LABELS: Record<RangePreset, string> = {
  today: 'اليوم',
  '7d': 'آخر ٧ أيام',
  '30d': 'آخر ٣٠ يومًا',
  '90d': 'آخر ٩٠ يومًا',
  custom: 'مخصص',
};

const PRESETS: RangePreset[] = ['today', '7d', '30d', '90d', 'custom'];

interface DatasetDef {
  id: ExportDatasetId;
  label: string;
  description: string;
  icon: typeof FileSpreadsheet;
}

const ANALYTICS_DATASETS: DatasetDef[] = [
  {
    id: 'summary',
    label: 'الملخص التحليلي',
    description: 'إجماليات يومية (مشاهدات، زوار، تحميلات، مشاركات...)',
    icon: BarChart3,
  },
  {
    id: 'pages',
    label: 'الصفحات',
    description: 'أكثر الصفحات زيارة مع عدد الزوار الفريدين',
    icon: Activity,
  },
  {
    id: 'content',
    label: 'المحتوى',
    description: 'أكثر المحتويات مشاهدةً وتحميلًا وإضافةً للمفضلة',
    icon: BookOpen,
  },
  {
    id: 'events',
    label: 'الأحداث',
    description: 'سجل الأحداث الخام مع خصائص كل حدث',
    icon: RefreshCw,
  },
  {
    id: 'devices',
    label: 'الأجهزة',
    description: 'توزيع الزوار حسب نوع الجهاز',
    icon: Monitor,
  },
  {
    id: 'social',
    label: 'التواصل الاجتماعي',
    description: 'النقرات على روابط فيسبوك ويوتيوب والإيميل',
    icon: Share2,
  },
  {
    id: 'contentTypes',
    label: 'أنواع المحتوى',
    description: 'توزيع المشاهدات حسب نوع المحتوى',
    icon: Presentation,
  },
];

const ACTIVITY_DATASETS: DatasetDef[] = [
  {
    id: 'activitySummary',
    label: 'ملخص نشاط المستخدمين',
    description: 'ملخص لكل مستخدم/زائر: المشاهدات والتحميلات والبحث والمفضلة',
    icon: Users,
  },
];

const FORMAT_LABELS: Record<Exclude<ExportFormat, 'zip'>, string> = {
  csv: 'CSV',
  json: 'JSON',
};

function toUtcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayUtc(): string {
  return toUtcDay(new Date());
}

function daysAgoUtc(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return toUtcDay(d);
}

function rangeForPreset(preset: RangePreset, customFrom: string, customTo: string): ExportRange {
  switch (preset) {
    case 'today':
      return { from: todayUtc(), to: todayUtc() };
    case '7d':
      return { from: daysAgoUtc(6), to: todayUtc() };
    case '90d':
      return { from: daysAgoUtc(89), to: todayUtc() };
    case 'custom': {
      const from = customFrom || undefined;
      const to = customTo || undefined;
      if (from && to && from > to) return {};
      return { from, to };
    }
    case '30d':
    default:
      return { from: daysAgoUtc(29), to: todayUtc() };
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function AdminExportPage() {
  const { profile, loading: authLoading } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [preset, setPreset] = useState<RangePreset>('30d');
  const [customFrom, setCustomFrom] = useState(() => daysAgoUtc(29));
  const [customTo, setCustomTo] = useState(() => todayUtc());
  const [rangeError, setRangeError] = useState<string | null>(null);

  const [format, setFormat] = useState<ExportFormat>('csv');

  // Single in-flight export at a time. `exporting` disables every button;
  // `busyRef` is the synchronous guard against double clicks.
  const [exporting, setExporting] = useState<{ id: ExportDatasetId; format: ExportFormat } | null>(null);
  const busyRef = useRef(false);

  const rangeForExport = useCallback((): ExportRange => {
    const range = rangeForPreset(preset, customFrom, customTo);
    if (preset === 'custom') {
      if (!customFrom || !customTo) {
        setRangeError('يرجى تحديد تاريخ البداية والنهاية');
        return {};
      }
      if (customFrom > customTo) {
        setRangeError('تاريخ البداية يجب أن يسبق تاريخ النهاية');
        return {};
      }
    }
    setRangeError(null);
    return range;
  }, [preset, customFrom, customTo]);

  const handlePresetClick = (next: RangePreset) => {
    setPreset(next);
    setRangeError(null);
  };

  const handleExport = async (id: ExportDatasetId, forcedFormat?: ExportFormat) => {
    if (busyRef.current) return;
    const effectiveFormat = forcedFormat ?? format;
    const range = rangeForExport();
    if (preset === 'custom' && (!range.from || !range.to)) return;

    busyRef.current = true;
    setExporting({ id, format: effectiveFormat });

    const def =
      ANALYTICS_DATASETS.find((d) => d.id === id) ??
      ACTIVITY_DATASETS.find((d) => d.id === id);
    const label = id === 'full' ? 'النسخة الشاملة' : def?.label ?? id;
    const formatLabel = effectiveFormat.toUpperCase();

    try {
      const result = await downloadExport(id, effectiveFormat, range);
      const rowsNote = result.rows !== undefined ? ` (${Number(result.rows).toLocaleString('ar-EG')} صف)` : '';
      toast.success(
        result.truncated
          ? `تم تصدير ${label} بالحد الأقصى للصفوف${rowsNote} — قد تكون البيانات مقتطعة`
          : `تم تصدير ${label} بنجاح${rowsNote}`,
        { description: result.filename },
      );
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'حدث خطأ غير متوقع أثناء التصدير';
      toast.error(`فشل تصدير ${label}`, { description: message });
    } finally {
      busyRef.current = false;
      setExporting(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        جاري التحقق من الصلاحيات...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <AlertTriangle className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold">لا تملك صلاحية الوصول</h1>
        <p className="text-muted-foreground">هذه الصفحة متاحة للمسؤولين فقط.</p>
      </div>
    );
  }

  const isBusy = exporting !== null;

  const renderDatasetRow = (def: DatasetDef) => {
    const Icon = def.icon;
    const active = exporting?.id === def.id;
    return (
      <li
        key={def.id}
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{def.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{def.description}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={isBusy}
          onClick={() => void handleExport(def.id)}
          aria-label={`تصدير ${def.label} بصيغة ${format.toUpperCase()}`}
        >
          {active ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              جاري التصدير...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" aria-hidden="true" />
              تصدير
            </>
          )}
        </Button>
      </li>
    );
  };

  return (
    <div dir="rtl" className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">تصدير البيانات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            تصدير الإحصائيات ونشاط المستخدمين بصيغ CSV أو JSON أو ZIP
          </p>
        </div>
      </div>

      {/* Date range + format */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">خيارات التصدير</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePresetClick(p)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${
                  preset === p
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
                aria-pressed={preset === p}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarRange className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">من</span>
                <Input
                  type="date"
                  value={customFrom}
                  max={customTo || todayUtc()}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-9 w-[10.5rem]"
                />
              </label>
              <span className="text-sm text-muted-foreground">إلى</span>
              <Input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                max={todayUtc()}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-9 w-[10.5rem]"
              />
            </div>
          )}

          {rangeError && (
            <p className="text-sm text-destructive" role="alert">
              {rangeError}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">الصيغة:</span>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1" role="group" aria-label="صيغة التصدير">
              {(['csv', 'json'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${
                    format === f
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                  aria-pressed={format === f}
                >
                  {f === 'csv' ? (
                    <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <FileJson className="h-4 w-4" aria-hidden="true" />
                  )}
                  {FORMAT_LABELS[f]}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analytics datasets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">بيانات الإحصائيات</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">{ANALYTICS_DATASETS.map(renderDatasetRow)}</ul>
        </CardContent>
      </Card>

      {/* User activity datasets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">نشاط المستخدمين</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">{ACTIVITY_DATASETS.map(renderDatasetRow)}</ul>
        </CardContent>
      </Card>

      {/* Full ZIP export */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">تصدير شامل (ZIP)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Archive className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">جميع البيانات في ملف واحد</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                ملف ZIP يضم كل المقاييس المذكورة أعلاه بالإضافة إلى سجل الأحداث ونشاط المستخدمين، مع دليل بيانات README
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={isBusy}
            onClick={() => void handleExport('full', FULL_EXPORT_FORMAT)}
            aria-label="تصدير جميع البيانات بصيغة ZIP"
          >
            {exporting?.id === 'full' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                جاري التصدير...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" aria-hidden="true" />
                تصدير ZIP
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
