import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarDays,
  CalendarRange,
  Clock,
  Download,
  Facebook,
  Heart,
  History,
  Image as ImageIcon,
  Inbox,
  Link2,
  ListFilter,
  LogIn,
  LogOut,
  Mail,
  MessageSquareQuote,
  Monitor,
  MousePointerClick,
  Music,
  Presentation,
  RefreshCw,
  Search,
  Share2,
  Smartphone,
  Tablet,
  UserCheck,
  UserX,
  Users,
  Youtube,
  X,
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import {
  getActivity,
  getActivityActions,
  getActivityOverview,
  getUsersActivity,
  type ActivityActionItem,
  type ActivityItem,
  type ActivityListParams,
  type ActivityOverview,
  type ActivityUserItem,
  type ActivityUsersResult,
} from '../services/adminActivity';

// ---------------------------------------------------------------------------
// Centralized labels — technical values -> Arabic, human readable.
// ACTION_LABELS mirrors the backend whitelist exactly (no invented events).
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  login_success: 'تسجيل الدخول',
  logout: 'تسجيل الخروج',
  hymn_view: 'مشاهدة ترنيمة',
  powerpoint_view: 'مشاهدة بوربوينت',
  image_view: 'مشاهدة صورة',
  saying_view: 'مشاهدة قول',
  book_view: 'مشاهدة كتاب',
  download_started: 'بدء تحميل',
  favorite_added: 'إضافة للمفضلة',
  favorite_removed: 'إزالة من المفضلة',
  search: 'بحث',
  share_started: 'بدء مشاركة',
  share_completed: 'إتمام مشاركة',
  card_link_click: 'ضغط على رابط البطاقة',
  card_social_click: 'ضغط على رابط اجتماعي',
  card_share: 'مشاركة البطاقة',
  card_copy_url: 'نسخ رابط البطاقة',
  facebook_click: 'ضغط على Facebook',
  youtube_click: 'ضغط على YouTube',
  email_click: 'ضغط على البريد الإلكتروني',
};

const ACTION_GROUPS: Array<{ label: string; actions: string[] }> = [
  { label: 'الحساب', actions: ['login_success', 'logout'] },
  {
    label: 'المشاهدة',
    actions: ['hymn_view', 'powerpoint_view', 'image_view', 'saying_view', 'book_view'],
  },
  { label: 'التحميل', actions: ['download_started'] },
  { label: 'المفضلة', actions: ['favorite_added', 'favorite_removed'] },
  { label: 'البحث', actions: ['search'] },
  { label: 'المشاركة', actions: ['share_started', 'share_completed'] },
  {
    label: 'البطاقة الرقمية',
    actions: ['card_link_click', 'card_social_click', 'card_share', 'card_copy_url'],
  },
  { label: 'التواصل الاجتماعي', actions: ['facebook_click', 'youtube_click', 'email_click'] },
];

const CONTENT_TYPE_LABELS: Record<string, string> = {
  hymn: 'ترنيمة',
  powerpoint: 'بوربوينت',
  image: 'صورة',
  book: 'كتاب',
  saying: 'قول',
  none: 'أخرى',
};

const CONTENT_TYPE_OPTIONS = ['hymn', 'powerpoint', 'image', 'book', 'saying', 'none'];

const DEVICE_LABELS: Record<string, string> = {
  desktop: 'كمبيوتر',
  mobile: 'موبايل',
  tablet: 'تابلت',
  unknown: 'غير معروف',
};

const ROUTE_LABELS: Record<string, string> = {
  '/': 'الصفحة الرئيسية',
  '/liturgy': 'بوربوينت الليتورجية',
  '/hymns': 'مكتبة الترانيم للعرض',
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

const ANONYMOUS_LABEL = 'زائر مجهول';
const NO_EXTRA_DETAILS = 'لا توجد تفاصيل إضافية';

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function contentTypeLabel(type: string | null | undefined): string {
  if (!type) return '—';
  return CONTENT_TYPE_LABELS[type] ?? type;
}

function deviceLabel(device: string | null | undefined): string {
  if (!device) return '—';
  return DEVICE_LABELS[device] ?? device;
}

function routeLabel(route: string | null | undefined): string {
  if (!route) return '—';
  return ROUTE_LABELS[route] ?? route;
}

// ---------------------------------------------------------------------------
// Date range handling (UTC-aligned with the backend's date parsing)
// ---------------------------------------------------------------------------

type RangePreset = 'all' | 'today' | '7d' | '30d' | 'custom';

const PRESET_LABELS: Record<RangePreset, string> = {
  all: 'الكل',
  today: 'اليوم',
  '7d': 'آخر ٧ أيام',
  '30d': 'آخر ٣٠ يومًا',
  custom: 'مخصص',
};

const PRESETS: RangePreset[] = ['all', 'today', '7d', '30d', 'custom'];

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

function rangeForPreset(
  preset: RangePreset,
  customFrom: string,
  customTo: string,
): { from?: string; to?: string } {
  switch (preset) {
    case 'today':
      return { from: todayUtc(), to: todayUtc() };
    case '7d':
      return { from: daysAgoUtc(6), to: todayUtc() };
    case '30d':
      return { from: daysAgoUtc(29), to: todayUtc() };
    case 'custom': {
      const from = customFrom || undefined;
      const to = customTo || undefined;
      return from && to && from > to ? {} : { from, to };
    }
    case 'all':
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const relativeFormatter = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' });

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = date.getTime() - Date.now();
  const minutes = Math.round(diffMs / 60000);
  const absMinutes = Math.abs(minutes);
  if (absMinutes < 60) return relativeFormatter.format(minutes, 'minute');
  const hours = Math.round(diffMs / 3600000);
  if (Math.abs(hours) < 24) return relativeFormatter.format(hours, 'hour');
  const days = Math.round(diffMs / 86400000);
  return relativeFormatter.format(days, 'day');
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function userLabel(user: ActivityItem['user']): string {
  if (!user) return ANONYMOUS_LABEL;
  return user.name || user.username || 'مستخدم';
}

function isAuthenticated(item: ActivityItem): boolean {
  return item.visitorType === 'authenticated' && !!item.user;
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className ?? ''}`} aria-hidden="true" />;
}

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
      <AlertTriangle className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        إعادة المحاولة
      </Button>
    </div>
  );
}

function SectionEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

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

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

type UserFilterValue = 'all' | 'authenticated' | 'anonymous' | string;

function FilterSelect({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 min-w-0 rounded-md border border-input bg-input-background px-3 py-1 text-sm text-foreground transition-[color,box-shadow] outline-none focus-visible:ring-[3px] dark:bg-input/30"
      >
        {children}
      </select>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function UserActivityPage() {
  const { profile, loading: authLoading } = useAuth();
  const isAdmin = profile?.role === 'admin';

  // ---- Filters (draft vs applied) ----
  const [preset, setPreset] = useState<RangePreset>('all');
  const [customFrom, setCustomFrom] = useState(() => daysAgoUtc(29));
  const [customTo, setCustomTo] = useState(() => todayUtc());
  const [action, setAction] = useState('');
  const [userFilter, setUserFilter] = useState<UserFilterValue>('all');
  const [contentType, setContentType] = useState('');
  const [searchDraft, setSearchDraft] = useState('');

  const [applied, setApplied] = useState<{
    preset: RangePreset;
    action: string;
    userFilter: UserFilterValue;
    contentType: string;
    search: string;
  }>({
    preset: 'all',
    action: '',
    userFilter: 'all',
    contentType: '',
    search: '',
  });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [customRangeError, setCustomRangeError] = useState<string | null>(null);

  // ---- Data states ----
  const [overview, setOverview] = useState<{
    all: ActivityOverview | null;
    today: ActivityOverview | null;
    last7d: ActivityOverview | null;
  }>({ all: null, today: null, last7d: null });
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState(false);

  const [list, setList] = useState<{ items: ActivityItem[]; total: number; totalPages: number }>({
    items: [],
    total: 0,
    totalPages: 1,
  });
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(false);

  const [users, setUsers] = useState<ActivityUsersResult>({ items: [], anonymousCount: 0, totalAuthenticatedUsers: 0 });
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState(false);

  const [actionsData, setActionsData] = useState<ActivityActionItem[]>([]);

  // ---- Detail dialogs ----
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
  const [detailUser, setDetailUser] = useState<ActivityUserItem | null>(null);
  const [userTimeline, setUserTimeline] = useState<ActivityItem[]>([]);
  const [userTimelineLoading, setUserTimelineLoading] = useState(false);
  const [userTimelineError, setUserTimelineError] = useState(false);

  // ---- Stale-response guards ----
  const seqRef = useRef(0);

  const buildListParams = useCallback(
    (overrides?: Partial<ActivityListParams>): ActivityListParams => {
      const range = rangeForPreset(applied.preset, customFrom, customTo);
      const params: ActivityListParams = {
        ...range,
        page,
        limit,
        ...overrides,
      };
      if (applied.action) params.action = applied.action;
      if (applied.contentType) params.contentType = applied.contentType;
      if (applied.search) params.search = applied.search;
      if (applied.userFilter === 'authenticated' || applied.userFilter === 'anonymous') {
        params.userId = applied.userFilter;
      } else if (applied.userFilter && applied.userFilter !== 'all') {
        params.userId = applied.userFilter;
      }
      return params;
    },
    [applied, customFrom, customTo, page, limit],
  );

  // ---- Overview (KPIs): all-time, today, last 7 days ----
  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(false);
    try {
      const [all, today, last7d] = await Promise.all([
        getActivityOverview(),
        getActivityOverview(todayUtc(), todayUtc()),
        getActivityOverview(daysAgoUtc(6), todayUtc()),
      ]);
      setOverview({ all, today, last7d });
    } catch {
      setOverviewError(true);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  // ---- Users summary ----
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(false);
    try {
      const range = rangeForPreset(applied.preset, customFrom, customTo);
      const data = await getUsersActivity({ ...range, limit: 25 });
      setUsers(data);
    } catch {
      setUsersError(true);
    } finally {
      setUsersLoading(false);
    }
  }, [applied.preset, customFrom, customTo]);

  // ---- Activity list (paginated, filtered) ----
  const loadList = useCallback(
    async (seq: number) => {
      setListLoading(true);
      setListError(false);
      try {
        const data = await getActivity(buildListParams());
        if (seq !== seqRef.current) return;
        setList({ items: data.items, total: data.total, totalPages: data.totalPages });
      } catch {
        if (seq !== seqRef.current) return;
        setListError(true);
      } finally {
        if (seq === seqRef.current) setListLoading(false);
      }
    },
    [buildListParams],
  );

  // ---- Load actions list for the summary ----
  const loadActions = useCallback(async () => {
    try {
      const range = rangeForPreset(applied.preset, customFrom, customTo);
      setActionsData(await getActivityActions(range.from, range.to));
    } catch {
      setActionsData([]);
    }
  }, [applied.preset, customFrom, customTo]);

  // Initial load.
  useEffect(() => {
    if (!isAdmin) return;
    void loadOverview();
    void loadUsers();
    void loadActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // Reload the filtered list whenever the applied filters / pagination change.
  useEffect(() => {
    if (!isAdmin) return;
    const seq = ++seqRef.current;
    void loadList(seq);
  }, [isAdmin, loadList]);

  // Reload users + actions when the applied date range changes.
  useEffect(() => {
    if (!isAdmin) return;
    void loadUsers();
    void loadActions();
  }, [isAdmin, loadUsers, loadActions]);

  // ---- Filter handlers ----
  const handlePresetClick = (next: RangePreset) => {
    setPreset(next);
    if (next === 'custom') {
      if (!customFrom || !customTo) setCustomRangeError('يرجى تحديد تاريخ البداية والنهاية');
      else if (customFrom > customTo) setCustomRangeError('تاريخ البداية يجب أن يسبق تاريخ النهاية');
      else setCustomRangeError(null);
    } else {
      setCustomRangeError(null);
    }
    if (next !== 'custom' || (customFrom && customTo && customFrom <= customTo)) {
      applyFilters({ preset: next });
    }
  };

  const applyFilters = (overrides?: Partial<typeof applied>) => {
    const next = { ...applied, ...overrides };
    if (next.preset === 'custom') {
      if (!customFrom || !customTo) {
        setCustomRangeError('يرجى تحديد تاريخ البداية والنهاية');
        return;
      }
      if (customFrom > customTo) {
        setCustomRangeError('تاريخ البداية يجب أن يسبق تاريخ النهاية');
        return;
      }
      setCustomRangeError(null);
    } else {
      setCustomRangeError(null);
    }
    setApplied(next);
    setPage(1);
  };

  const handleApplyCustom = () => {
    setPreset('custom');
    applyFilters({ preset: 'custom' });
  };

  const handleSearch = () => {
    applyFilters({ search: searchDraft.trim() });
  };

  const handleResetFilters = () => {
    setPreset('all');
    setAction('');
    setUserFilter('all');
    setContentType('');
    setSearchDraft('');
    setCustomRangeError(null);
    setApplied({ preset: 'all', action: '', userFilter: 'all', contentType: '', search: '' });
    setPage(1);
  };

  const handleRefresh = () => {
    const seq = ++seqRef.current;
    void loadOverview();
    void loadUsers();
    void loadActions();
    void loadList(seq);
  };

  // ---- User detail ----
  const openUserDetail = (item: ActivityUserItem) => {
    setDetailUser(item);
    setUserTimeline([]);
    setUserTimelineError(false);
    setUserTimelineLoading(true);
    const userId = item.user ? item.user.id : 'anonymous';
    void getActivity({ userId, limit: 25 })
      .then((data) => {
        setUserTimeline(data.items);
        setUserTimelineLoading(false);
      })
      .catch(() => {
        setUserTimelineError(true);
        setUserTimelineLoading(false);
      });
  };

  // ---- Derived values ----
  const kpis = useMemo(() => {
    const all = overview.all;
    return [
      { key: 'total', label: 'إجمالي الأنشطة', icon: Activity, value: all?.totalActivities ?? 0 },
      {
        key: 'active',
        label: 'المستخدمون النشطون',
        icon: Users,
        value: (all?.uniqueUsers ?? 0) + (all?.uniqueVisitors ?? 0),
      },
      { key: 'registered', label: 'المستخدمون المسجلون', icon: UserCheck, value: all?.uniqueUsers ?? 0 },
      { key: 'anonymous', label: 'الزوار المجهولون', icon: UserX, value: all?.uniqueVisitors ?? 0 },
      { key: 'today', label: 'أنشطة اليوم', icon: CalendarDays, value: overview.today?.totalActivities ?? 0 },
      { key: 'last7d', label: 'أنشطة آخر ٧ أيام', icon: CalendarRange, value: overview.last7d?.totalActivities ?? 0 },
    ];
  }, [overview]);

  const mostFrequentAction = useMemo(() => {
    if (userTimeline.length === 0) return null;
    const counts = new Map<string, number>();
    for (const item of userTimeline) {
      counts.set(item.action, (counts.get(item.action) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [action, count] of counts) {
      if (count > bestCount) {
        best = action;
        bestCount = count;
      }
    }
    return best;
  }, [userTimeline]);

  const mostUsedContentType = useMemo(() => {
    if (userTimeline.length === 0) return null;
    const counts = new Map<string, number>();
    for (const item of userTimeline) {
      if (!item.contentType) continue;
      counts.set(item.contentType, (counts.get(item.contentType) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [type, count] of counts) {
      if (count > bestCount) {
        best = type;
        bestCount = count;
      }
    }
    return best;
  }, [userTimeline]);

  // ---- Guards: admin only (backend is authoritative) ----
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

  const userOptions = users.items.filter((item) => item.user);

  return (
    <div dir="rtl" className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">سجل نشاط المستخدمين</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            متابعة ومعرفة نشاط المستخدمين داخل الموقع
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={listLoading || overviewLoading}>
          <RefreshCw className={`h-4 w-4 ${listLoading || overviewLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          تحديث
        </Button>
      </div>

      {/* KPI cards */}
      <section aria-label="مؤشرات رئيسية">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
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

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ListFilter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            الفلاتر
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {/* Date presets */}
            <div className="flex flex-wrap items-center gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePresetClick(p)}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${
                    applied.preset === p
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                  aria-pressed={applied.preset === p}
                >
                  {PRESET_LABELS[p]}
                </button>
              ))}
            </div>

            {/* Custom range */}
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarRange className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">من تاريخ</span>
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
              <Button variant="secondary" size="sm" onClick={handleApplyCustom}>
                تطبيق
              </Button>
            </div>

            {customRangeError && (
              <p className="text-sm text-destructive" role="alert">
                {customRangeError}
              </p>
            )}

            {/* Select filters */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <FilterSelect
                id="activity-filter-action"
                label="النشاط"
                value={action}
                onChange={(v) => {
                  setAction(v);
                  applyFilters({ action: v });
                }}
              >
                <option value="">كل الأنشطة</option>
                {ACTION_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.actions.map((a) => (
                      <option key={a} value={a}>
                        {ACTION_LABELS[a]}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </FilterSelect>

              <FilterSelect
                id="activity-filter-user"
                label="المستخدم"
                value={userFilter}
                onChange={(v) => {
                  setUserFilter(v);
                  applyFilters({ userFilter: v });
                }}
              >
                <option value="all">كل المستخدمين</option>
                <option value="authenticated">المستخدمون المسجلون</option>
                <option value="anonymous">الزوار المجهولون</option>
                {userOptions.length > 0 && <optgroup label="مستخدمون محددون">
                  {userOptions.map((item) => (
                    <option key={item.user!.id} value={item.user!.id}>
                      {item.user!.name || item.user!.username}
                    </option>
                  ))}
                </optgroup>}
              </FilterSelect>

              <FilterSelect
                id="activity-filter-content"
                label="نوع المحتوى"
                value={contentType}
                onChange={(v) => {
                  setContentType(v);
                  applyFilters({ contentType: v });
                }}
              >
                <option value="">كل الأنواع</option>
                {CONTENT_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {CONTENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </FilterSelect>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">بحث عن مستخدم</span>
                <div className="flex gap-2">
                  <Input
                    type="search"
                    value={searchDraft}
                    onChange={(e) => setSearchDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearch();
                    }}
                    placeholder="اسم أو اسم مستخدم..."
                    className="h-9"
                    aria-label="بحث عن مستخدم بالاسم أو اسم المستخدم"
                  />
                  <Button variant="outline" size="sm" onClick={handleSearch} aria-label="بحث">
                    <Search className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                <X className="h-4 w-4" aria-hidden="true" />
                مسح الفلاتر
              </Button>
              <span className="text-xs text-muted-foreground">
                {listLoading
                  ? 'جاري التحميل...'
                  : `إجمالي النتائج: ${list.total.toLocaleString('ar-EG')}`}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            سجل النشاطات
          </CardTitle>
        </CardHeader>
        <CardContent>
          {listError && (
            <SectionError message="حدث خطأ أثناء تحميل النشاط" onRetry={handleRefresh} />
          )}

          {!listError && listLoading && (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {!listError && !listLoading && list.items.length === 0 && (
            <SectionEmpty
              message={
                applied.preset === 'all' &&
                !applied.action &&
                !applied.contentType &&
                applied.userFilter === 'all' &&
                !applied.search
                  ? 'لا توجد أنشطة مسجلة حتى الآن'
                  : 'لا يوجد نشاط مطابق للفلاتر الحالية'
              }
            />
          )}

          {!listError && !listLoading && list.items.length > 0 && (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[720px] text-right text-sm">
                  <caption className="sr-only">سجل نشاط المستخدمين</caption>
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th scope="col" className="pb-2 pr-2 font-medium">المستخدم</th>
                      <th scope="col" className="pb-2 pr-2 font-medium">النشاط</th>
                      <th scope="col" className="pb-2 pr-2 font-medium">المحتوى</th>
                      <th scope="col" className="pb-2 pr-2 font-medium">الصفحة</th>
                      <th scope="col" className="pb-2 pr-2 font-medium">الجهاز</th>
                      <th scope="col" className="pb-2 font-medium">الوقت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.items.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedActivity(item)}
                        className="cursor-pointer border-b border-border/50 last:border-0 transition-colors hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedActivity(item);
                          }
                        }}
                        aria-label={`عرض تفاصيل نشاط ${actionLabel(item.action)}`}
                      >
                        <td className="py-2.5 pr-2">
                          <span className="inline-flex items-center gap-1.5">
                            {isAuthenticated(item) ? (
                              <UserCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                            ) : (
                              <UserX className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                            )}
                            <span className="max-w-[10rem] truncate">{userLabel(item.user)}</span>
                          </span>
                        </td>
                        <td className="py-2.5 pr-2">
                          <span className="inline-flex items-center gap-1.5">
                            {contentIcon(item.contentType)}
                            {actionLabel(item.action)}
                          </span>
                        </td>
                        <td className="max-w-[12rem] truncate py-2.5 pr-2 text-muted-foreground">
                          {item.contentName || '—'}
                        </td>
                        <td className="max-w-[10rem] truncate py-2.5 pr-2 text-muted-foreground" dir="ltr">
                          {item.route || '—'}
                        </td>
                        <td className="py-2.5 pr-2 text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            {deviceIcon(item.deviceCategory)}
                            {deviceLabel(item.deviceCategory)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap py-2.5 text-muted-foreground">
                          <span title={formatDateTime(item.createdAt)}>
                            {formatRelativeTime(item.createdAt)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile timeline cards */}
              <ul className="space-y-3 md:hidden">
                {list.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedActivity(item)}
                      className="w-full rounded-xl border border-border bg-card p-4 text-right shadow-sm transition-all hover:shadow-lg focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                      aria-label={`عرض تفاصيل نشاط ${actionLabel(item.action)}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold">
                          {isAuthenticated(item) ? (
                            <UserCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                          ) : (
                            <UserX className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          )}
                          <span className="truncate">{userLabel(item.user)}</span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 text-sm text-foreground">
                        {contentIcon(item.contentType)}
                        {actionLabel(item.action)}
                      </div>
                      {(item.contentName || item.route) && (
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {item.contentName || ''}
                          {item.contentName && item.route ? ' · ' : ''}
                          <span dir="ltr">{item.route || ''}</span>
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>

              {/* Pagination */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">عرض</span>
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                    aria-label="عدد النتائج في الصفحة"
                    className="focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 min-w-0 rounded-md border border-input bg-input-background px-2 py-1 text-sm text-foreground transition-[color,box-shadow] outline-none focus-visible:ring-[3px] dark:bg-input/30"
                  >
                    {[25, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-muted-foreground">نتيجة</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || listLoading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    السابق
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    الصفحة {page.toLocaleString('ar-EG')} من {list.totalPages.toLocaleString('ar-EG')}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= list.totalPages || listLoading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    التالي
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Users summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            ملخص نشاط المستخدمين
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usersError && <SectionError message="حدث خطأ أثناء تحميل ملخص المستخدمين" onRetry={handleRefresh} />}

          {!usersError && usersLoading && (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}

          {!usersError && !usersLoading && users.items.length === 0 && users.anonymousCount === 0 && (
            <SectionEmpty message="لا يوجد نشاط مطابق للفلاتر الحالية" />
          )}

          {!usersError && !usersLoading && (users.items.length > 0 || users.anonymousCount > 0) && (
            <>
              <div className="mb-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-primary">
                  <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  {users.totalAuthenticatedUsers.toLocaleString('ar-EG')} مستخدم مسجل
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                  <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                  {users.anonymousCount.toLocaleString('ar-EG')} نشاط مجهول
                </span>
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[640px] text-right text-sm">
                  <caption className="sr-only">ملخص نشاط المستخدمين</caption>
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th scope="col" className="pb-2 pr-2 font-medium">المستخدم</th>
                      <th scope="col" className="pb-2 pr-2 font-medium">نوع المستخدم</th>
                      <th scope="col" className="pb-2 pr-2 font-medium">عدد الأنشطة</th>
                      <th scope="col" className="pb-2 pr-2 font-medium">آخر نشاط</th>
                      <th scope="col" className="pb-2 font-medium">أول نشاط</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.items.map((item) => (
                      <tr
                        key={item.user ? item.user.id : 'anonymous'}
                        onClick={() => openUserDetail(item)}
                        className="cursor-pointer border-b border-border/50 last:border-0 transition-colors hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openUserDetail(item);
                          }
                        }}
                        aria-label={`عرض تفاصيل مستخدم ${item.user ? item.user.name || item.user.username : ANONYMOUS_LABEL}`}
                      >
                        <td className="py-2.5 pr-2">
                          <span className="inline-flex items-center gap-1.5">
                            {item.user ? (
                              <UserCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                            ) : (
                              <UserX className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                            )}
                            <span className="max-w-[12rem] truncate">
                              {item.user ? item.user.name || item.user.username : ANONYMOUS_LABEL}
                            </span>
                          </span>
                        </td>
                        <td className="py-2.5 pr-2 text-muted-foreground">
                          {item.user ? 'مستخدم مسجل' : ANONYMOUS_LABEL}
                        </td>
                        <td className="py-2.5 pr-2 font-bold">
                          {item.activityCount.toLocaleString('ar-EG')}
                        </td>
                        <td className="whitespace-nowrap py-2.5 pr-2 text-muted-foreground" title={item.lastActivityAt ? formatDateTime(item.lastActivityAt) : ''}>
                          {item.lastActivityAt ? formatRelativeTime(item.lastActivityAt) : '—'}
                        </td>
                        <td className="whitespace-nowrap py-2.5 text-muted-foreground" title={item.firstActivityAt ? formatDateTime(item.firstActivityAt) : ''}>
                          {item.firstActivityAt ? formatRelativeTime(item.firstActivityAt) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile users list */}
              <ul className="space-y-3 md:hidden">
                {users.items.map((item) => (
                  <li key={item.user ? item.user.id : 'anonymous'}>
                    <button
                      type="button"
                      onClick={() => openUserDetail(item)}
                      className="w-full rounded-xl border border-border bg-card p-4 text-right shadow-sm transition-all hover:shadow-lg focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                      aria-label={`عرض تفاصيل مستخدم ${item.user ? item.user.name || item.user.username : ANONYMOUS_LABEL}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold">
                          {item.user ? (
                            <UserCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                          ) : (
                            <UserX className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          )}
                          <span className="truncate">
                            {item.user ? item.user.name || item.user.username : ANONYMOUS_LABEL}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-bold">
                          {item.activityCount.toLocaleString('ar-EG')} نشاط
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        آخر نشاط: {item.lastActivityAt ? formatRelativeTime(item.lastActivityAt) : '—'}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>

              {users.items.length === 0 && users.anonymousCount > 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  لا يوجد مستخدمون مسجلون ضمن الفترة المحددة — {users.anonymousCount.toLocaleString('ar-EG')} نشاط مجهول فقط.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Most frequent actions summary */}
      {actionsData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              أكثر الأنشطة تكرارًا
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {actionsData.slice(0, 10).map((item) => (
                <li
                  key={item.action}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                >
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    {contentIconForAction(item.action)}
                    <span className="truncate">{actionLabel(item.action)}</span>
                  </span>
                  <span className="shrink-0 text-sm font-bold">{item.count.toLocaleString('ar-EG')}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Activity detail dialog */}
      <Dialog open={selectedActivity !== null} onOpenChange={(open) => { if (!open) setSelectedActivity(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تفاصيل النشاط</DialogTitle>
          </DialogHeader>
          {selectedActivity && (
            <ActivityDetails item={selectedActivity} />
          )}
        </DialogContent>
      </Dialog>

      {/* User detail dialog */}
      <Dialog open={detailUser !== null} onOpenChange={(open) => { if (!open) setDetailUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تفاصيل المستخدم</DialogTitle>
          </DialogHeader>
          {detailUser && (
            <UserDetails
              item={detailUser}
              timeline={userTimeline}
              loading={userTimelineLoading}
              error={userTimelineError}
              mostFrequentAction={mostFrequentAction}
              mostUsedContentType={mostUsedContentType}
              onRetry={() => openUserDetail(detailUser)}
              onSelectActivity={setSelectedActivity}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity details panel
// ---------------------------------------------------------------------------

function contentIconForAction(action: string) {
  switch (action) {
    case 'login_success':
      return <LogIn className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    case 'logout':
      return <LogOut className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    case 'download_started':
      return <Download className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    case 'favorite_added':
    case 'favorite_removed':
      return <Heart className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    case 'share_started':
    case 'share_completed':
      return <Share2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    case 'facebook_click':
      return <Facebook className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    case 'youtube_click':
      return <Youtube className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    case 'email_click':
      return <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    case 'card_link_click':
    case 'card_social_click':
    case 'card_share':
    case 'card_copy_url':
      return <Link2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    case 'search':
      return <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    default:
      return <MousePointerClick className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
  }
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 text-left text-sm font-medium">{children}</span>
    </div>
  );
}

function ActivityDetails({ item }: { item: ActivityItem }) {
  const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : null;
  const entries = metadata ? Object.entries(metadata) : [];
  return (
    <div className="divide-y divide-border">
      <DetailRow label="المستخدم">
        {isAuthenticated(item)
          ? `${userLabel(item.user)}${item.user!.username ? ` (@${item.user!.username})` : ''}`
          : ANONYMOUS_LABEL}
      </DetailRow>
      <DetailRow label="النشاط">
        <span className="inline-flex items-center gap-1.5">
          {contentIconForAction(item.action)}
          {actionLabel(item.action)}
        </span>
      </DetailRow>
      <DetailRow label="التاريخ والوقت">{formatDateTime(item.createdAt)}</DetailRow>
      <DetailRow label="الصفحة">
        <span dir="ltr">{routeLabel(item.route) !== '—' ? item.route : '—'}</span>
      </DetailRow>
      <DetailRow label="نوع المحتوى">{contentTypeLabel(item.contentType)}</DetailRow>
      <DetailRow label="معرف المحتوى">
        <span dir="ltr">{item.contentId || '—'}</span>
      </DetailRow>
      <DetailRow label="اسم المحتوى">{item.contentName || '—'}</DetailRow>
      <DetailRow label="الجهاز">
        <span className="inline-flex items-center gap-1.5">
          {deviceIcon(item.deviceCategory)}
          {deviceLabel(item.deviceCategory)}
        </span>
      </DetailRow>
      <DetailRow label="المتصفح">{item.browserCategory || '—'}</DetailRow>

      <div className="pt-3">
        <p className="text-sm font-medium text-foreground">تفاصيل إضافية</p>
        {entries.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">{NO_EXTRA_DETAILS}</p>
        ) : (
          <dl className="mt-2 space-y-1.5">
            {entries.map(([key, value]) => (
              <div key={key} className="flex items-start justify-between gap-4">
                <dt className="shrink-0 text-sm text-muted-foreground">{key}</dt>
                <dd className="min-w-0 break-words text-left text-sm font-medium">
                  {typeof value === 'string' ? value : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// User details + timeline
// ---------------------------------------------------------------------------

function UserDetails({
  item,
  timeline,
  loading,
  error,
  mostFrequentAction,
  mostUsedContentType,
  onRetry,
  onSelectActivity,
}: {
  item: ActivityUserItem;
  timeline: ActivityItem[];
  loading: boolean;
  error: boolean;
  mostFrequentAction: string | null;
  mostUsedContentType: string | null;
  onRetry: () => void;
  onSelectActivity: (item: ActivityItem) => void;
}) {
  const user = item.user;
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{user ? user.name || user.username : ANONYMOUS_LABEL}</p>
            {user && (
              <p className="truncate text-xs text-muted-foreground">
                @{user.username}
                {user.email ? ` · ${user.email}` : ''}
              </p>
            )}
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-md bg-card p-2.5">
            <dt className="text-xs text-muted-foreground">إجمالي الأنشطة</dt>
            <dd className="mt-0.5 font-bold">{item.activityCount.toLocaleString('ar-EG')}</dd>
          </div>
          <div className="rounded-md bg-card p-2.5">
            <dt className="text-xs text-muted-foreground">أحدث نشاط</dt>
            <dd className="mt-0.5 font-bold" title={item.lastActivityAt ? formatDateTime(item.lastActivityAt) : ''}>
              {item.lastActivityAt ? formatRelativeTime(item.lastActivityAt) : '—'}
            </dd>
          </div>
          <div className="rounded-md bg-card p-2.5">
            <dt className="text-xs text-muted-foreground">النشاط الأكثر تكرارًا</dt>
            <dd className="mt-0.5 font-bold">{mostFrequentAction ? actionLabel(mostFrequentAction) : '—'}</dd>
          </div>
          <div className="rounded-md bg-card p-2.5">
            <dt className="text-xs text-muted-foreground">نوع المحتوى الأكثر استخدامًا</dt>
            <dd className="mt-0.5 font-bold">{mostUsedContentType ? contentTypeLabel(mostUsedContentType) : '—'}</dd>
          </div>
        </dl>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-foreground">الخط الزمني للنشاط</p>

        {loading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}

        {error && <SectionError message="حدث خطأ أثناء تحميل نشاط المستخدم" onRetry={onRetry} />}

        {!loading && !error && timeline.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            لا توجد أنشطة مسجلة لهذا المستخدم
          </p>
        )}

        {!loading && !error && timeline.length > 0 && (
          <ol className="relative space-y-4 border-r border-border pr-4">
            {timeline.map((item, index) => (
              <li key={item.id} className="relative">
                <span
                  className={`absolute -right-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${
                    isAuthenticated(item) ? 'bg-primary' : 'bg-muted-foreground/50'
                  }`}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={() => onSelectActivity(item)}
                  className="w-full rounded-lg border border-border bg-card p-3 text-right transition-colors hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  aria-label={`عرض تفاصيل ${actionLabel(item.action)}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                      {contentIconForAction(item.action)}
                      {actionLabel(item.action)}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>
                  {item.contentName && (
                    <p className="mt-1 truncate text-sm text-muted-foreground">{item.contentName}</p>
                  )}
                  {item.route && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground" dir="ltr">
                      {item.route}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
