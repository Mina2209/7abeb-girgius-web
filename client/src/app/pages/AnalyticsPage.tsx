import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarRange,
  Download,
  Eye,
  Facebook,
  Heart,
  Image as ImageIcon,
  Mail,
  MessageSquareQuote,
  Monitor,
  Music,
  Presentation,
  RefreshCw,
  Repeat,
  Search,
  Share2,
  Smartphone,
  Tablet,
  Users,
  Youtube,
  type LucideIcon,
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { TrendChart } from '../components/analytics/TrendChart';
import { RankBars, type RankItem } from '../components/analytics/RankBars';
import {
  getAnalyticsContentTypes,
  getAnalyticsDevices,
  getAnalyticsEventBreakdown,
  getAnalyticsOverview,
  getAnalyticsRecentEvents,
  getAnalyticsTimeseries,
  getAnalyticsTopContent,
  getAnalyticsTopPages,
  getAnalyticsTopSocial,
  type AnalyticsContentItem,
  type AnalyticsContentTypeItem,
  type AnalyticsDayPoint,
  type AnalyticsDeviceItem,
  type AnalyticsEventItem,
  type AnalyticsOverview,
  type AnalyticsRange,
  type AnalyticsRecentEvent,
  type AnalyticsSocialItem,
  type AnalyticsTopPage,
  type TimeseriesMetric,
} from '../services/analyticsAdmin';

// ---------------------------------------------------------------------------
// Labels (technical values -> Arabic, human readable)
// ---------------------------------------------------------------------------

const EVENT_LABELS: Record<string, string> = {
  page_view: 'مشاهدة صفحة',
  route_change: 'تغيير مسار',
  session_start: 'بدء جلسة',
  card_page_view: 'مشاهدة البطاقة',
  login_success: 'تسجيل دخول ناجح',
  login_failed: 'فشل تسجيل الدخول',
  logout: 'تسجيل خروج',
  admin_login: 'دخول مدير',
  content_view: 'مشاهدة محتوى',
  hymn_view: 'مشاهدة ترنيمة',
  powerpoint_view: 'مشاهدة بوربوينت',
  image_view: 'مشاهدة صورة',
  saying_view: 'مشاهدة قول',
  book_view: 'مشاهدة كتاب',
  download_started: 'بدء تحميل',
  download_completed: 'اكتمال تحميل',
  download_failed: 'فشل تحميل',
  favorite_added: 'إضافة للمفضلة',
  favorite_removed: 'إزالة من المفضلة',
  search: 'بحث',
  filter_applied: 'تطبيق فلتر',
  facebook_click: 'ضغطة فيسبوك',
  youtube_click: 'ضغطة يوتيوب',
  email_click: 'ضغطة إيميل',
  card_link_click: 'ضغطة رابط البطاقة',
  card_social_click: 'ضغطة تواصل البطاقة',
  card_share: 'مشاركة البطاقة',
  card_copy_url: 'نسخ رابط البطاقة',
  share_started: 'بدء مشاركة',
  share_completed: 'مشاركة مكتملة',
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  hymn: 'ترنيمة',
  powerpoint: 'بوربوينت',
  image: 'صورة',
  book: 'كتاب',
  saying: 'قول',
};

const DEVICE_LABELS: Record<string, string> = {
  mobile: 'جوال',
  tablet: 'تابلت',
  desktop: 'كمبيوتر',
};

const SOCIAL_LABELS: Record<string, string> = {
  facebook_click: 'فيسبوك',
  youtube_click: 'يوتيوب',
  email_click: 'إيميل',
};

const ROUTE_LABELS: Record<string, string> = {
  '/': 'الصفحة الرئيسية',
  '/liturgy': 'بوربوينت الليتورجية',
  '/hymns': 'مكتبة الترانيم',
  '/various': 'بوربوينت متنوعة',
  '/images': 'مكتبة الصور',
  '/artists': 'الفنانون',
  '/books': 'مكتبة الكتب',
  '/sayings': 'أقوال الآباء',
  '/coptic': 'لغة قبطية',
  '/about': 'عن الخدمة',
  '/profile': 'الملف الشخصي',
  '/favorites': 'المفضلة',
  '/qrcode': 'البطاقة الرقمية',
};

function eventLabel(name: string): string {
  return EVENT_LABELS[name] ?? name;
}

function contentTypeLabel(type: string | null | undefined): string {
  if (!type) return '—';
  return CONTENT_TYPE_LABELS[type] ?? type;
}

// ---------------------------------------------------------------------------
// Date range handling (UTC-aligned with the backend's day aggregation)
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

function rangeForPreset(preset: RangePreset, customFrom: string, customTo: string): AnalyticsRange {
  switch (preset) {
    case 'today':
      return { from: todayUtc(), to: todayUtc() };
    case '7d':
      return { from: daysAgoUtc(6), to: todayUtc() };
    case '90d':
      return { from: daysAgoUtc(89), to: todayUtc() };
    case 'custom':
      return { from: customFrom || undefined, to: customTo || undefined };
    case '30d':
    default:
      return { from: daysAgoUtc(29), to: todayUtc() };
  }
}

// ---------------------------------------------------------------------------
// Per-section async data state
// ---------------------------------------------------------------------------

type SectionKey =
  | 'overview'
  | 'pages'
  | 'contentDownload'
  | 'contentViews'
  | 'social'
  | 'events'
  | 'devices'
  | 'contentTypes'
  | 'recent';

type DataState<T> =
  | { status: 'loading'; data?: T }
  | { status: 'success'; data: T }
  | { status: 'error'; data?: T };

type SectionData = {
  overview: DataState<AnalyticsOverview>;
  pages: DataState<AnalyticsTopPage[]>;
  contentDownload: DataState<AnalyticsContentItem[]>;
  contentViews: DataState<AnalyticsContentItem[]>;
  social: DataState<AnalyticsSocialItem[]>;
  events: DataState<AnalyticsEventItem[]>;
  devices: DataState<AnalyticsDeviceItem[]>;
  contentTypes: DataState<AnalyticsContentTypeItem[]>;
  recent: DataState<AnalyticsRecentEvent[]>;
};

const EMPTY_LOADING: SectionData = {
  overview: { status: 'loading' },
  pages: { status: 'loading' },
  contentDownload: { status: 'loading' },
  contentViews: { status: 'loading' },
  social: { status: 'loading' },
  events: { status: 'loading' },
  devices: { status: 'loading' },
  contentTypes: { status: 'loading' },
  recent: { status: 'loading' },
};

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className ?? ''}`} aria-hidden="true" />;
}

function SectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
      <AlertTriangle className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">تعذر تحميل الإحصائيات</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        إعادة المحاولة
      </Button>
    </div>
  );
}

function SectionEmpty() {
  return (
    <p className="py-6 text-center text-sm text-muted-foreground">
      لا توجد بيانات كافية خلال الفترة المحددة
    </p>
  );
}

const EMPTY_DATA_MSG = 'لا توجد بيانات كافية خلال الفترة المحددة';

const deviceIcon = (device: string | null | undefined) => {
  const d = device ?? '';
  if (d === 'mobile') return <Smartphone className="h-4 w-4" aria-hidden="true" />;
  if (d === 'tablet') return <Tablet className="h-4 w-4" aria-hidden="true" />;
  return <Monitor className="h-4 w-4" aria-hidden="true" />;
};

const contentIcon = (type: string | null | undefined) => {
  switch (type) {
    case 'hymn':
      return <Music className="h-4 w-4" aria-hidden="true" />;
    case 'powerpoint':
      return <Presentation className="h-4 w-4" aria-hidden="true" />;
    case 'image':
      return <ImageIcon className="h-4 w-4" aria-hidden="true" />;
    case 'book':
      return <BookOpen className="h-4 w-4" aria-hidden="true" />;
    case 'saying':
      return <MessageSquareQuote className="h-4 w-4" aria-hidden="true" />;
    default:
      return <BarChart3 className="h-4 w-4" aria-hidden="true" />;
  }
};

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

const CHART_METRIC_LABELS: Array<{ value: TimeseriesMetric; label: string }> = [
  { value: 'page_views', label: 'مشاهدات' },
  { value: 'sessions', label: 'جلسات' },
  { value: 'downloads', label: 'تحميلات' },
  { value: 'events', label: 'أحداث' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function AnalyticsPage() {
  const { profile, loading: authLoading } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [preset, setPreset] = useState<RangePreset>('30d');
  const [customFrom, setCustomFrom] = useState(() => daysAgoUtc(29));
  const [customTo, setCustomTo] = useState(() => todayUtc());
  const [range, setRange] = useState<AnalyticsRange>(() => rangeForPreset('30d', daysAgoUtc(29), todayUtc()));

  const [chartMetric, setChartMetric] = useState<TimeseriesMetric>('page_views');
  const [timeseries, setTimeseries] = useState<DataState<AnalyticsDayPoint[]>>({ status: 'loading' });
  const [sections, setSections] = useState<SectionData>(EMPTY_LOADING);

  const cacheRef = useRef(new Map<string, { sections: SectionData; timeseries: DataState<AnalyticsDayPoint[]> }>());

  const rangeRef = useRef(range);
  useEffect(() => {
    rangeRef.current = range;
  }, [range]);

  const chartMetricRef = useRef(chartMetric);
  useEffect(() => {
    chartMetricRef.current = chartMetric;
  }, [chartMetric]);

  // Monotonic guards against stale async results (rapid range/metric switching):
  // whichever range/metric request started last wins; earlier in-flight responses
  // that resolve late are dropped instead of overwriting newer data.
  const rangeSeqRef = useRef(0);
  const metricSeqRef = useRef(0);

  const loadSectionData = useCallback(async (r: AnalyticsRange, force: boolean) => {
    const metric = chartMetricRef.current;
    const seq = ++rangeSeqRef.current;
    const metricSeqAtStart = metricSeqRef.current;
    const cacheKey = `${r.from ?? ''}|${r.to ?? ''}|${metric}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached && !force) {
      setSections(cached.sections);
      setTimeseries(cached.timeseries);
      return;
    }

    setSections(EMPTY_LOADING);
    setTimeseries({ status: 'loading' });

    const tasks: Array<[keyof SectionData, Promise<unknown>]> = [
      ['overview', getAnalyticsOverview(r)],
      ['pages', getAnalyticsTopPages(r, 10)],
      ['contentDownload', getAnalyticsTopContent(r, 'download', 10)],
      ['contentViews', getAnalyticsTopContent(r, 'view', 10)],
      ['social', getAnalyticsTopSocial(r)],
      ['events', getAnalyticsEventBreakdown(r, 20)],
      ['devices', getAnalyticsDevices(r)],
      ['contentTypes', getAnalyticsContentTypes(r)],
      ['recent', getAnalyticsRecentEvents(r, 20)],
    ];

    // Fire the section queries and the timeseries query in parallel (no waterfall).
    const [sectionResults, timeseriesResult] = await Promise.all([
      Promise.allSettled(tasks.map(([, promise]) => promise)),
      getAnalyticsTimeseries(r, metric).then(
        (data) => ({ status: 'success', data }) as const,
        () => ({ status: 'error' }) as const,
      ),
    ]);

    const next = {} as SectionData;
    tasks.forEach(([key], index) => {
      const result = sectionResults[index];
      (next as Record<string, unknown>)[key] =
        result.status === 'fulfilled'
          ? { status: 'success', data: result.value }
          : { status: 'error' };
    });

    const nextTimeseries = timeseriesResult;

    // A newer range load started after this one — drop this stale response so the
    // toolbar selection always matches the displayed data.
    if (seq !== rangeSeqRef.current) return;

    setSections(next);
    // A newer metric request started while this load was in flight — keep the
    // chart on the newer metric instead of overwriting it with the old metric.
    if (metricSeqRef.current === metricSeqAtStart) {
      setTimeseries(nextTimeseries);
    }
    cacheRef.current.set(cacheKey, { sections: next, timeseries: nextTimeseries });
  }, []);

  // Initial load + when the applied date range changes.
  useEffect(() => {
    if (!isAdmin) return;
    void loadSectionData(range, false);
  }, [range, isAdmin, loadSectionData]);

  const handlePresetClick = (next: RangePreset) => {
    setPreset(next);
    setRange(rangeForPreset(next, customFrom, customTo));
  };

  const handleCustomApply = () => {
    setPreset('custom');
    setRange(rangeForPreset('custom', customFrom, customTo));
  };

  const handleRefresh = () => {
    void loadSectionData(rangeRef.current, true);
  };

  const handleChartMetricChange = (metric: TimeseriesMetric) => {
    if (metric === chartMetric) return;
    setChartMetric(metric);
    setTimeseries({ status: 'loading' });
    const seq = ++metricSeqRef.current;
    void getAnalyticsTimeseries(rangeRef.current, metric)
      .then((data) => {
        if (seq !== metricSeqRef.current) return;
        setTimeseries({ status: 'success', data });
      })
      .catch(() => {
        if (seq !== metricSeqRef.current) return;
        setTimeseries({ status: 'error' });
      });
  };

  // -------------------------------------------------------------------------
  // Derived KPI list
  // -------------------------------------------------------------------------

  const kpis: Array<{ key: string; label: string; icon: LucideIcon; value: number }> = useMemo(() => {
    const ov = sections.overview.status === 'success' ? sections.overview.data : null;
    return [
      { key: 'pageViews', label: 'مشاهدات الصفحات', icon: Eye, value: ov?.pageViews ?? 0 },
      { key: 'uniqueVisitors', label: 'الزوار', icon: Users, value: ov?.uniqueVisitors ?? 0 },
      { key: 'sessions', label: 'الجلسات', icon: Activity, value: ov?.sessions ?? 0 },
      { key: 'downloads', label: 'التحميلات', icon: Download, value: ov?.downloads ?? 0 },
      { key: 'favorites', label: 'إضافات المفضلة', icon: Heart, value: ov?.favorites ?? 0 },
      { key: 'totalEvents', label: 'إجمالي الأحداث', icon: BarChart3, value: ov?.totalEvents ?? 0 },
      { key: 'socialClicks', label: 'ضغطات التواصل', icon: Share2, value: ov?.socialClicks ?? 0 },
      { key: 'searches', label: 'عمليات البحث', icon: Search, value: ov?.searches ?? 0 },
      { key: 'shares', label: 'المشاركات', icon: Repeat, value: ov?.shares ?? 0 },
    ];
  }, [sections.overview]);

  // -------------------------------------------------------------------------
  // Guards: this page is for authenticated admins only. Backend still enforces it.
  // -------------------------------------------------------------------------

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

  const overviewLoading = sections.overview.status === 'loading';
  const overviewError = sections.overview.status === 'error';

  const chartData = timeseries.status === 'success' ? timeseries.data : [];
  const isEmptyOverall =
    sections.overview.status === 'success' &&
    sections.overview.data.totalEvents === 0 &&
    chartData.every((p) => p.count === 0);

  // Top pages rows
  const pageRows: RankItem[] =
    sections.pages.status === 'success'
      ? sections.pages.data.map((p) => ({
          key: p.route,
          label: ROUTE_LABELS[p.route] ?? p.route,
          sublabel: p.route,
          value: p.count,
          icon: <Eye className="h-4 w-4" aria-hidden="true" />,
        }))
      : [];

  // Devices rows
  const deviceRows: RankItem[] =
    sections.devices.status === 'success'
      ? sections.devices.data.map((d) => ({
          key: d.device,
          label: DEVICE_LABELS[d.device] ?? d.device,
          value: d.count,
          icon: deviceIcon(d.device),
        }))
      : [];

  // Content type rows
  const contentTypeRows: RankItem[] =
    sections.contentTypes.status === 'success'
      ? sections.contentTypes.data.map((c) => ({
          key: c.contentType,
          label: contentTypeLabel(c.contentType),
          value: c.count,
          icon: contentIcon(c.contentType),
        }))
      : [];

  // Event breakdown rows (top 20)
  const eventRows: RankItem[] =
    sections.events.status === 'success'
      ? sections.events.data.map((e) => ({
          key: e.event,
          label: eventLabel(e.event),
          value: e.count,
        }))
      : [];

  const socialItems = sections.social.status === 'success' ? sections.social.data : [];

  const socialIcons: Record<string, typeof Facebook> = {
    facebook_click: Facebook,
    youtube_click: Youtube,
    email_click: Mail,
  };

  return (
    <div dir="rtl" className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">الإحصائيات والتحليلات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            نظرة شاملة على استخدام الموقع خلال الفترة المحددة
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={overviewLoading}>
          <RefreshCw className={`h-4 w-4 ${overviewLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          تحديث
        </Button>
      </div>

      {/* Date range toolbar */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-6">
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

          <div className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden="true" />

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarRange className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">من</span>
              <Input
                type="date"
                value={customFrom}
                max={todayUtc()}
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
            <Button variant="secondary" size="sm" onClick={handleCustomApply}>
              تطبيق
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Overall empty state */}
      {isEmptyOverall && (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {EMPTY_DATA_MSG}
        </div>
      )}

      {/* KPI cards */}
      <section aria-label="مؤشرات رئيسية">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.key}>
                <CardContent className="flex items-start gap-3 pt-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-muted-foreground">{kpi.label}</p>
                    <div className="mt-1 text-2xl font-bold leading-none">
                      {overviewLoading ? (
                        <Skeleton className="h-8 w-14" />
                      ) : overviewError ? (
                        '—'
                      ) : (
                        kpi.value.toLocaleString('ar-EG')
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Timeseries chart */}
      <section aria-label="الاتجاه الزمني">
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base font-semibold">الاتجاه الزمني</CardTitle>
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="نوع المقياس">
              {CHART_METRIC_LABELS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => handleChartMetricChange(m.value)}
                  className={`rounded-md px-3 py-1 text-xs transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${
                    chartMetric === m.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                  aria-pressed={chartMetric === m.value}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {timeseries.status === 'loading' && (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-4 w-40" />
              </div>
            )}
            {timeseries.status === 'error' && <SectionError onRetry={handleRefresh} />}
            {timeseries.status === 'success' &&
              (chartData.length === 0 ? (
                <SectionEmpty />
              ) : (
                <TrendChart data={chartData} ariaLabel={`مخطط الاتجاه الزمني لـ${CHART_METRIC_LABELS.find((m) => m.value === chartMetric)?.label ?? chartMetric}`} />
              ))}
          </CardContent>
        </Card>
      </section>

      {/* Top pages + devices */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">أكثر الصفحات زيارة</CardTitle>
          </CardHeader>
          <CardContent>
            {sections.pages.status === 'loading' && (
              <div className="flex flex-col gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            )}
            {sections.pages.status === 'error' && <SectionError onRetry={handleRefresh} />}
            {sections.pages.status === 'success' &&
              (sections.pages.data.length === 0 ? <SectionEmpty /> : <RankBars items={pageRows} />)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">الأجهزة المستخدمة</CardTitle>
          </CardHeader>
          <CardContent>
            {sections.devices.status === 'loading' && (
              <div className="flex flex-col gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            )}
            {sections.devices.status === 'error' && <SectionError onRetry={handleRefresh} />}
            {sections.devices.status === 'success' &&
              (sections.devices.data.length === 0 ? <SectionEmpty /> : <RankBars items={deviceRows} />)}
          </CardContent>
        </Card>
      </div>

      {/* Downloads + views */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">أكثر الملفات تحميلًا</CardTitle>
          </CardHeader>
          <CardContent>
            {sections.contentDownload.status === 'loading' && (
              <div className="flex flex-col gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            )}
            {sections.contentDownload.status === 'error' && <SectionError onRetry={handleRefresh} />}
            {sections.contentDownload.status === 'success' && (
              <ContentList
                items={sections.contentDownload.data}
                icon={<Download className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">أكثر المحتويات مشاهدة</CardTitle>
          </CardHeader>
          <CardContent>
            {sections.contentViews.status === 'loading' && (
              <div className="flex flex-col gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            )}
            {sections.contentViews.status === 'error' && <SectionError onRetry={handleRefresh} />}
            {sections.contentViews.status === 'success' && (
              <ContentList
                items={sections.contentViews.data}
                icon={<Eye className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Social + content types */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">التفاعل مع وسائل التواصل</CardTitle>
          </CardHeader>
          <CardContent>
            {sections.social.status === 'loading' && (
              <div className="flex flex-col gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            )}
            {sections.social.status === 'error' && <SectionError onRetry={handleRefresh} />}
            {sections.social.status === 'success' &&
              (socialItems.length === 0 ? (
                <SectionEmpty />
              ) : (
                <ul className="space-y-3">
                  {socialItems.map((item) => {
                    const Icon = socialIcons[item.platform] ?? BarChart3;
                    return (
                      <li
                        key={item.platform}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          {SOCIAL_LABELS[item.platform] ?? item.platform}
                        </span>
                        <span className="text-sm font-bold">{item.count.toLocaleString('ar-EG')}</span>
                      </li>
                    );
                  })}
                </ul>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">أنواع المحتوى</CardTitle>
          </CardHeader>
          <CardContent>
            {sections.contentTypes.status === 'loading' && (
              <div className="flex flex-col gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            )}
            {sections.contentTypes.status === 'error' && <SectionError onRetry={handleRefresh} />}
            {sections.contentTypes.status === 'success' &&
              (sections.contentTypes.data.length === 0 ? <SectionEmpty /> : <RankBars items={contentTypeRows} />)}
          </CardContent>
        </Card>
      </div>

      {/* Event breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">الأحداث الأكثر نشاطًا</CardTitle>
        </CardHeader>
        <CardContent>
          {sections.events.status === 'loading' && (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          )}
          {sections.events.status === 'error' && <SectionError onRetry={handleRefresh} />}
          {sections.events.status === 'success' &&
            (sections.events.data.length === 0 ? <SectionEmpty /> : <RankBars items={eventRows} />)}
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">آخر النشاطات</CardTitle>
        </CardHeader>
        <CardContent>
          {sections.recent.status === 'loading' && (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          )}
          {sections.recent.status === 'error' && <SectionError onRetry={handleRefresh} />}
          {sections.recent.status === 'success' &&
            (sections.recent.data.length === 0 ? (
              <SectionEmpty />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-right text-sm">
                  <caption className="sr-only">آخر النشاطات المسجلة</caption>
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th scope="col" className="pb-2 pr-2 font-medium">الحدث</th>
                      <th scope="col" className="pb-2 pr-2 font-medium">المحتوى</th>
                      <th scope="col" className="pb-2 pr-2 font-medium">الصفحة</th>
                      <th scope="col" className="pb-2 pr-2 font-medium">الجهاز</th>
                      <th scope="col" className="pb-2 font-medium">الوقت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sections.recent.data.map((item) => (
                      <tr key={item.id} className="border-b border-border/50 last:border-0">
                        <td className="py-2.5 pr-2">
                          <span className="inline-flex items-center gap-1.5">
                            {contentIcon(item.contentType)}
                            {eventLabel(item.eventName)}
                          </span>
                        </td>
                        <td className="max-w-[14rem] truncate py-2.5 pr-2 text-muted-foreground">
                          {item.contentName || '—'}
                        </td>
                        <td className="max-w-[10rem] truncate py-2.5 pr-2 text-muted-foreground" dir="ltr">
                          {item.route || '—'}
                        </td>
                        <td className="py-2.5 pr-2 text-muted-foreground">
                          {item.deviceCategory ? DEVICE_LABELS[item.deviceCategory] ?? item.deviceCategory : '—'}
                        </td>
                        <td className="whitespace-nowrap py-2.5 text-muted-foreground">
                          {formatDateTime(item.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content list (downloads / views) — shared rows with type badge
// ---------------------------------------------------------------------------

function ContentList({
  items,
  icon,
}: {
  items: AnalyticsContentItem[];
  icon: ReactNode;
}) {
  if (items.length === 0) return <SectionEmpty />;
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={`${item.contentType ?? ''}-${item.contentId ?? ''}-${item.contentName}`}
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-muted-foreground">{icon}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{item.contentName}</span>
              <span className="block text-xs text-muted-foreground">
                {contentTypeLabel(item.contentType)}
              </span>
            </span>
          </span>
          <span className="shrink-0 text-sm font-bold">{item.count.toLocaleString('ar-EG')}</span>
        </li>
      ))}
    </ul>
  );
}
