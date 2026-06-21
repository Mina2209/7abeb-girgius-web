import { X, Download, Search, Filter, Clock, User, LogIn, LogOut, Heart, Share2, Edit2, Trash2, Upload, Settings, Tag, Eye, ChevronDown, ChevronUp, FileText, Image, Music, BookOpen, MessageSquareQuote } from 'lucide-react';
import { useState, useMemo, useRef, useEffect } from 'react';
import type { ActivityLog, ActivityType, ContentType } from '../utils/activityLogger';
import { normalizeArabic } from '../utils/arabicUtils';
import { getUserLogs, getUserActivityStats, formatRelativeTime, formatAbsoluteTime, exportLogsToCSV, exportLogsToJSON } from '../utils/activityLogger';

interface ActivityLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  userRole: string;
}

// Activity type icons and colors
const activityConfig: Record<ActivityType, { icon: any; color: string; label: string }> = {
  login: { icon: LogIn, color: 'text-green-500', label: 'تسجيل دخول' },
  logout: { icon: LogOut, color: 'text-gray-500', label: 'تسجيل خروج' },
  download: { icon: Download, color: 'text-blue-500', label: 'تحميل' },
  favorite_add: { icon: Heart, color: 'text-red-500', label: 'إضافة للمفضلة' },
  favorite_remove: { icon: Heart, color: 'text-gray-400', label: 'إزالة من المفضلة' },
  create: { icon: FileText, color: 'text-green-600', label: 'إنشاء' },
  edit: { icon: Edit2, color: 'text-blue-600', label: 'تعديل' },
  delete: { icon: Trash2, color: 'text-red-600', label: 'حذف' },
  bulk_delete: { icon: Trash2, color: 'text-red-700', label: 'حذف جماعي' },
  import: { icon: Upload, color: 'text-purple-600', label: 'استيراد' },
  export: { icon: Download, color: 'text-purple-600', label: 'تصدير' },
  user_role_change: { icon: User, color: 'text-orange-600', label: 'تغيير صلاحية' },
  user_delete: { icon: User, color: 'text-red-600', label: 'حذف مستخدم' },
  section_visibility: { icon: Eye, color: 'text-indigo-600', label: 'إظهار/إخفاء قسم' },
  topic_create: { icon: Tag, color: 'text-green-600', label: 'إنشاء موضوع' },
  topic_edit: { icon: Tag, color: 'text-blue-600', label: 'تعديل موضوع' },
  topic_delete: { icon: Tag, color: 'text-red-600', label: 'حذف موضوع' },
  topic_reorder: { icon: Tag, color: 'text-purple-600', label: 'إعادة ترتيب مواضيع' },
  settings_change: { icon: Settings, color: 'text-orange-600', label: 'تغيير إعدادات' },
};

// Content type icons
const contentTypeIcons: Record<ContentType, any> = {
  hymn: Music,
  image: Image,
  book: BookOpen,
  saying: MessageSquareQuote,
  topic: Tag,
  user: User,
  section: Eye,
  settings: Settings,
};
const normalizeSearchText = (text: string) => normalizeArabic(text).toLowerCase();
export function ActivityLogModal({ isOpen, onClose, userId, username, userRole }: ActivityLogModalProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<ReturnType<typeof getUserActivityStats> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityType | 'all'>('all');
  const [selectedContentType, setSelectedContentType] = useState<ContentType | 'all'>('all');
  const [selectedDuration, setSelectedDuration] = useState<'all' | '7' | '30' | '90' | '180'>('all');
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  
  const filterRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // Load logs and stats
  useEffect(() => {
    if (isOpen) {
      const userLogs = getUserLogs(userId);
      setLogs(userLogs);
      setStats(getUserActivityStats(userId));
    }
  }, [isOpen, userId]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };

    if (isFilterOpen || isExportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterOpen, isExportMenuOpen]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const normalizedQuery = normalizeSearchText(searchQuery);
      const matchesSearch =
        searchQuery === '' ||
        normalizeSearchText(log.description).includes(normalizedQuery) ||
        (log.contentTitle ? normalizeSearchText(log.contentTitle).includes(normalizedQuery) : false);

      const matchesActivityType = selectedActivityType === 'all' || log.activityType === selectedActivityType;
      const matchesContentType = selectedContentType === 'all' || log.contentType === selectedContentType;

      // Duration filter
      let matchesDuration = true;
      if (selectedDuration !== 'all') {
        const daysAgo = parseInt(selectedDuration);
        const cutoffDate = new Date(Date.now() - (daysAgo * 24 * 60 * 60 * 1000));
        const logDate = new Date(log.timestamp);
        matchesDuration = logDate >= cutoffDate;
      }

      return matchesSearch && matchesActivityType && matchesContentType && matchesDuration;
    });
  }, [logs, searchQuery, selectedActivityType, selectedContentType, selectedDuration]);

  const toggleExpand = (logId: string) => {
    setExpandedLogIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const handleExport = (format: 'csv' | 'json') => {
    if (format === 'csv') {
      exportLogsToCSV(filteredLogs);
    } else {
      exportLogsToJSON(filteredLogs);
    }
    setIsExportMenuOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-2xl font-bold mb-2">سجل نشاط المستخدم</h2>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span className="font-medium">{username}</span>
              </div>
              <span>•</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                userRole === 'admin' ? 'bg-red-500/10 text-red-500' :
                userRole === 'editor' ? 'bg-blue-500/10 text-blue-500' :
                'bg-gray-500/10 text-gray-500'
              }`}>
                {userRole === 'admin' ? 'مدير' : userRole === 'editor' ? 'محرر' : 'مشاهد'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 border-b border-border bg-muted/30">
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs">آخر تسجيل دخول</span>
              </div>
              <p className="text-sm font-bold">
                {stats.lastLogin ? formatRelativeTime(stats.lastLogin) : 'لم يسجل دخول بعد'}
              </p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <LogIn className="w-4 h-4" />
                <span className="text-xs">عدد مرات الدخول</span>
              </div>
              <p className="text-2xl font-bold">{stats.totalLogins}</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Download className="w-4 h-4" />
                <span className="text-xs">إجمالي التحميلات</span>
              </div>
              <p className="text-2xl font-bold">{stats.totalDownloads}</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Edit2 className="w-4 h-4" />
                <span className="text-xs">إجمالي التعديلات</span>
              </div>
              <p className="text-2xl font-bold">{stats.totalEdits}</p>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="p-6 border-b border-border space-y-3">
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="ابحث في الأنشطة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              />
            </div>

            {/* Filter Dropdown */}
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors text-sm ${
                  selectedActivityType !== 'all' || selectedContentType !== 'all' || selectedDuration !== 'all'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card border-border hover:bg-muted'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>فلترة</span>
              </button>

              {isFilterOpen && (
                <div className="absolute left-0 top-full mt-2 w-64 bg-card border border-border rounded-xl shadow-lg z-10">
                  <div className="p-3 space-y-3">
                    {/* Activity Type Filter */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-2 block">نوع النشاط</label>
                      <select
                        value={selectedActivityType}
                        onChange={(e) => setSelectedActivityType(e.target.value as ActivityType | 'all')}
                        className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        <option value="all">الكل</option>
                        {Object.entries(activityConfig).map(([type, config]) => (
                          <option key={type} value={type}>{config.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Content Type Filter */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-2 block">نوع المحتوى</label>
                      <select
                        value={selectedContentType}
                        onChange={(e) => setSelectedContentType(e.target.value as ContentType | 'all')}
                        className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        <option value="all">الكل</option>
                        <option value="hymn">ترنيمة</option>
                        <option value="image">صورة</option>
                        <option value="book">كتاب</option>
                        <option value="saying">قول</option>
                        <option value="topic">موضوع</option>
                        <option value="user">مستخدم</option>
                        <option value="section">قسم</option>
                        <option value="settings">إعدادات</option>
                      </select>
                    </div>

                    {/* Duration Filter */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-2 block">الفترة الزمنية</label>
                      <select
                        value={selectedDuration}
                        onChange={(e) => setSelectedDuration(e.target.value as 'all' | '7' | '30' | '90' | '180')}
                        className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        <option value="all">الكل</option>
                        <option value="7">7 أيام</option>
                        <option value="30">30 يومًا</option>
                        <option value="90">90 يومًا</option>
                        <option value="180">180 يومًا</option>
                      </select>
                    </div>

                    {/* Reset Button */}
                    {(selectedActivityType !== 'all' || selectedContentType !== 'all' || selectedDuration !== 'all') && (
                      <button
                        onClick={() => {
                          setSelectedActivityType('all');
                          setSelectedContentType('all');
                          setSelectedDuration('all');
                        }}
                        className="w-full px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm transition-colors"
                      >
                        إعادة تعيين
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Export Dropdown */}
            <div className="relative" ref={exportRef}>
              <button
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-muted transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                <span>تصدير</span>
              </button>

              {isExportMenuOpen && (
                <div className="absolute left-0 top-full mt-2 w-48 bg-card border border-border rounded-xl shadow-lg z-10">
                  <div className="p-2">
                    <button
                      onClick={() => handleExport('csv')}
                      className="w-full text-right px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm"
                    >
                      تصدير CSV
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      className="w-full text-right px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm"
                    >
                      تصدير JSON
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Active Filters Display */}
          {(selectedActivityType !== 'all' || selectedContentType !== 'all' || selectedDuration !== 'all') && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">الفلاتر النشطة:</span>
              {selectedActivityType !== 'all' && (
                <span className="px-2 py-1 bg-primary/10 text-primary rounded-full">
                  {activityConfig[selectedActivityType].label}
                </span>
              )}
              {selectedContentType !== 'all' && (
                <span className="px-2 py-1 bg-primary/10 text-primary rounded-full">
                  {selectedContentType === 'hymn' ? 'ترنيمة' :
                   selectedContentType === 'image' ? 'صورة' :
                   selectedContentType === 'book' ? 'كتاب' :
                   selectedContentType === 'saying' ? 'قول' :
                   selectedContentType === 'topic' ? 'موضوع' :
                   selectedContentType === 'user' ? 'مستخدم' :
                   selectedContentType === 'section' ? 'قسم' : 'إعدادات'}
                </span>
              )}
              {selectedDuration !== 'all' && (
                <span className="px-2 py-1 bg-primary/10 text-primary rounded-full">
                  {selectedDuration === '7' ? '7 أيام' :
                   selectedDuration === '30' ? '30 يومًا' :
                   selectedDuration === '90' ? '90 يومًا' : '180 يومًا'}
                </span>
              )}
            </div>
          )}

          {/* Results Count */}
          <div className="text-sm text-muted-foreground">
            عرض {filteredLogs.length} من {logs.length} نشاط
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredLogs.length > 0 ? (
            <div className="space-y-3">
              {filteredLogs.map((log) => {
                const config = activityConfig[log.activityType];
                const Icon = config.icon;
                const ContentIcon = log.contentType ? contentTypeIcons[log.contentType] : null;
                const isExpanded = expandedLogIds.has(log.id);
                const hasDetails = log.details && (log.details.changes || log.details.bulkItems);

                return (
                  <div
                    key={log.id}
                    className="bg-muted/50 rounded-xl p-4 border border-border hover:bg-muted transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={`p-2 rounded-lg bg-background ${config.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <div className="flex items-center gap-2 flex-1">
                            <p className="text-sm font-medium">{log.description}</p>
                            {ContentIcon && (
                              <ContentIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatRelativeTime(log.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          {formatAbsoluteTime(log.timestamp)}
                        </p>

                        {/* Expand button if has details */}
                        {hasDetails && (
                          <button
                            onClick={() => toggleExpand(log.id)}
                            className="flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-3.5 h-3.5" />
                                <span>إخفاء التفاصيل</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3.5 h-3.5" />
                                <span>عرض التفاصيل</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* Expanded Details */}
                        {isExpanded && hasDetails && (
                          <div className="mt-3 p-3 bg-background rounded-lg border border-border text-xs space-y-2">
                            {/* Changes */}
                            {log.details?.changes && log.details.changes.length > 0 && (
                              <div>
                                <p className="font-medium mb-2">التغييرات:</p>
                                <div className="space-y-1">
                                  {log.details.changes.map((change, idx) => (
                                    <div key={idx} className="flex items-start gap-2">
                                      <span className="text-muted-foreground">•</span>
                                      <div className="flex-1">
                                        <span className="font-medium">{change.field}:</span>
                                        <div className="flex items-center gap-2 mt-1">
                                          <span className="px-2 py-0.5 bg-red-500/10 text-red-600 rounded">
                                            {String(change.oldValue)}
                                          </span>
                                          <span>←</span>
                                          <span className="px-2 py-0.5 bg-green-500/10 text-green-600 rounded">
                                            {String(change.newValue)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Bulk Items */}
                            {log.details?.bulkItems && log.details.bulkItems.length > 0 && (
                              <div>
                                <p className="font-medium mb-2">العناصر المحذوفة ({log.details.bulkItems.length}):</p>
                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                  {log.details.bulkItems.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-muted-foreground">
                                      <span>•</span>
                                      <span>{item.title}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Other details */}
                            {log.details?.fileName && (
                              <div>
                                <span className="font-medium">اسم الملف:</span> {log.details.fileName}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">
                {logs.length === 0 
                  ? 'لا توجد أنشطة مسجلة لهذا المستخدم' 
                  : 'لا توجد أنشطة مطابقة للفلاتر المحددة'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border bg-muted/30">
          <p className="text-xs text-muted-foreground">
            يتم الاحتفاظ بالسجلات لمدة 180 يومًا
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}