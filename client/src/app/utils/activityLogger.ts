// Activity Logging System
// Tracks user activities for admin oversight

export type ActivityType =
  | 'login'
  | 'logout'
  | 'download'
  | 'favorite_add'
  | 'favorite_remove'
  | 'create'
  | 'edit'
  | 'delete'
  | 'bulk_delete'
  | 'import'
  | 'export'
  | 'user_role_change'
  | 'user_delete'
  | 'section_visibility'
  | 'topic_create'
  | 'topic_edit'
  | 'topic_delete'
  | 'topic_reorder'
  | 'settings_change';

export type ContentType = 'hymn' | 'image' | 'book' | 'saying' | 'topic' | 'user' | 'section' | 'settings';

export interface ActivityLog {
  id: string;
  userId: string;
  username: string;
  userRole: string;
  timestamp: string;
  activityType: ActivityType;
  contentType?: ContentType;
  contentId?: string | number;
  contentTitle?: string;
  description: string;
  details?: {
    changes?: Array<{
      field: string;
      oldValue: any;
      newValue: any;
    }>;
    bulkItems?: Array<{
      id: string | number;
      title: string;
    }>;
    downloadType?: string;
    fileName?: string;
    [key: string]: any;
  };
}

const STORAGE_KEY = 'activity_logs';
const MAX_AGE_DAYS = 180; // 6 months

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Get current user info
function getCurrentUser() {
  const userStr = localStorage.getItem('currentUser');
  if (!userStr) return null;
  return JSON.parse(userStr);
}

// Clean up old logs (older than 180 days)
function cleanupOldLogs(logs: ActivityLog[]): ActivityLog[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - MAX_AGE_DAYS);
  
  return logs.filter(log => {
    const logDate = new Date(log.timestamp);
    return logDate >= cutoffDate;
  });
}

// Get all logs
export function getAllLogs(): ActivityLog[] {
  const logsStr = localStorage.getItem(STORAGE_KEY);
  if (!logsStr) return [];
  
  const logs = JSON.parse(logsStr);
  return cleanupOldLogs(logs);
}

// Get logs for a specific user
export function getUserLogs(userId: string): ActivityLog[] {
  const allLogs = getAllLogs();
  return allLogs.filter(log => log.userId === userId);
}

// Save log
function saveLogs(logs: ActivityLog[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

// Log an activity
export function logActivity(
  activityType: ActivityType,
  description: string,
  options?: {
    contentType?: ContentType;
    contentId?: string | number;
    contentTitle?: string;
    details?: ActivityLog['details'];
  }
): void {
  const user = getCurrentUser();
  if (!user) return; // Don't log if no user is logged in

  const log: ActivityLog = {
    id: generateId(),
    userId: user.id,
    username: user.username,
    userRole: user.role,
    timestamp: new Date().toISOString(),
    activityType,
    description,
    ...options,
  };

  const logs = getAllLogs();
  logs.unshift(log); // Add to beginning (most recent first)
  saveLogs(logs);
}

// Specific logging functions for common activities

export function logLogin(): void {
  logActivity('login', 'تسجيل دخول');
}

export function logLogout(): void {
  logActivity('logout', 'تسجيل خروج');
}

export function logDownload(contentType: ContentType, fileName: string, contentTitle?: string): void {
  const contentTypeAr = {
    hymn: 'ترنيمة',
    image: 'صورة',
    book: 'كتاب',
    saying: 'قول',
    topic: 'موضوع',
    user: 'مستخدم',
    section: 'قسم',
    settings: 'إعدادات',
  };

  logActivity('download', `تحميل ${contentTypeAr[contentType]}: ${contentTitle || fileName}`, {
    contentType,
    contentTitle,
    details: {
      fileName,
      downloadType: contentType,
    },
  });
}

export function logFavoriteAdd(contentType: ContentType, contentId: string | number, contentTitle: string): void {
  const contentTypeAr = {
    hymn: 'ترنيمة',
    image: 'صورة',
    book: 'كتاب',
    saying: 'قول',
    topic: 'موضوع',
    user: 'مستخدم',
    section: 'قسم',
    settings: 'إعدادات',
  };

  logActivity('favorite_add', `إضافة ${contentTypeAr[contentType]} للمفضلة: ${contentTitle}`, {
    contentType,
    contentId,
    contentTitle,
  });
}

export function logFavoriteRemove(contentType: ContentType, contentId: string | number, contentTitle: string): void {
  const contentTypeAr = {
    hymn: 'ترنيمة',
    image: 'صورة',
    book: 'كتاب',
    saying: 'قول',
    topic: 'موضوع',
    user: 'مستخدم',
    section: 'قسم',
    settings: 'إعدادات',
  };

  logActivity('favorite_remove', `إزالة ${contentTypeAr[contentType]} من المفضلة: ${contentTitle}`, {
    contentType,
    contentId,
    contentTitle,
  });
}

export function logCreate(contentType: ContentType, contentTitle: string, contentId?: string | number): void {
  const contentTypeAr = {
    hymn: 'ترنيمة',
    image: 'صورة',
    book: 'كتاب',
    saying: 'قول',
    topic: 'موضوع',
    user: 'مستخدم',
    section: 'قسم',
    settings: 'إعدادات',
  };

  logActivity('create', `إنشاء ${contentTypeAr[contentType]} جديد: ${contentTitle}`, {
    contentType,
    contentId,
    contentTitle,
  });
}

export function logEdit(
  contentType: ContentType,
  contentTitle: string,
  changes: Array<{ field: string; oldValue: any; newValue: any }>,
  contentId?: string | number
): void {
  const contentTypeAr = {
    hymn: 'ترنيمة',
    image: 'صورة',
    book: 'كتاب',
    saying: 'قول',
    topic: 'موضوع',
    user: 'مستخدم',
    section: 'قسم',
    settings: 'إعدادات',
  };

  logActivity('edit', `تعديل ${contentTypeAr[contentType]}: ${contentTitle}`, {
    contentType,
    contentId,
    contentTitle,
    details: { changes },
  });
}

export function logDelete(contentType: ContentType, contentTitle: string, contentId?: string | number): void {
  const contentTypeAr = {
    hymn: 'ترنيمة',
    image: 'صورة',
    book: 'كتاب',
    saying: 'قول',
    topic: 'موضوع',
    user: 'مستخدم',
    section: 'قسم',
    settings: 'إعدادات',
  };

  logActivity('delete', `حذف ${contentTypeAr[contentType]}: ${contentTitle}`, {
    contentType,
    contentId,
    contentTitle,
  });
}

export function logBulkDelete(
  contentType: ContentType,
  items: Array<{ id: string | number; title: string }>
): void {
  const contentTypeAr = {
    hymn: 'ترانيم',
    image: 'صور',
    book: 'كتب',
    saying: 'أقوال',
    topic: 'مواضيع',
    user: 'مستخدمين',
    section: 'أقسام',
    settings: 'إعدادات',
  };

  logActivity('bulk_delete', `حذف جماعي: ${items.length} ${contentTypeAr[contentType]}`, {
    contentType,
    details: { bulkItems: items },
  });
}

export function logImport(contentType: ContentType, itemCount: number): void {
  const contentTypeAr = {
    hymn: 'ترانيم',
    image: 'صور',
    book: 'كتب',
    saying: 'أقوال',
    topic: 'مواضيع',
    user: 'مستخدمين',
    section: 'أقسام',
    settings: 'إعدادات',
  };

  logActivity('import', `استيراد ${itemCount} ${contentTypeAr[contentType]}`, {
    contentType,
    details: { itemCount },
  });
}

export function logExport(contentType: ContentType, itemCount: number): void {
  const contentTypeAr = {
    hymn: 'ترانيم',
    image: 'صور',
    book: 'كتب',
    saying: 'أقوال',
    topic: 'مواضيع',
    user: 'مستخدمين',
    section: 'أقسام',
    settings: 'إعدادات',
  };

  logActivity('export', `تصدير ${itemCount} ${contentTypeAr[contentType]}`, {
    contentType,
    details: { itemCount },
  });
}

export function logUserRoleChange(username: string, oldRole: string, newRole: string, userId: string): void {
  logActivity('user_role_change', `تغيير صلاحية المستخدم: ${username}`, {
    contentType: 'user',
    contentId: userId,
    contentTitle: username,
    details: {
      changes: [
        { field: 'الصلاحية', oldValue: oldRole, newValue: newRole },
      ],
    },
  });
}

export function logUserDelete(username: string, userId: string): void {
  logActivity('user_delete', `حذف مستخدم: ${username}`, {
    contentType: 'user',
    contentId: userId,
    contentTitle: username,
  });
}

export function logSectionVisibility(sectionName: string, visible: boolean): void {
  logActivity('section_visibility', `${visible ? 'إظهار' : 'إخفاء'} قسم: ${sectionName}`, {
    contentType: 'section',
    contentTitle: sectionName,
    details: {
      visible,
    },
  });
}

export function logTopicReorder(sectionName: string): void {
  logActivity('topic_reorder', `إعادة ترتيب المواضيع في قسم: ${sectionName}`, {
    contentType: 'topic',
    contentTitle: sectionName,
  });
}

export function logSettingsChange(settingName: string, oldValue: any, newValue: any): void {
  logActivity('settings_change', `تغيير الإعدادات: ${settingName}`, {
    contentType: 'settings',
    contentTitle: settingName,
    details: {
      changes: [
        { field: settingName, oldValue, newValue },
      ],
    },
  });
}

// Get activity statistics for a user
export interface UserActivityStats {
  totalActivities: number;
  lastLogin: string | null;
  totalLogins: number;
  totalDownloads: number;
  totalEdits: number;
  totalCreates: number;
  totalDeletes: number;
  accountAge: string;
}

export function getUserActivityStats(userId: string): UserActivityStats {
  const logs = getUserLogs(userId);
  
  const lastLoginLog = logs.find(log => log.activityType === 'login');
  const totalLogins = logs.filter(log => log.activityType === 'login').length;
  const totalDownloads = logs.filter(log => log.activityType === 'download').length;
  const totalEdits = logs.filter(log => log.activityType === 'edit').length;
  const totalCreates = logs.filter(log => log.activityType === 'create').length;
  const totalDeletes = logs.filter(log => log.activityType === 'delete' || log.activityType === 'bulk_delete').length;

  // Calculate account age from first activity
  const oldestLog = logs[logs.length - 1];
  const accountAge = oldestLog 
    ? formatRelativeTime(oldestLog.timestamp)
    : 'غير متوفر';

  return {
    totalActivities: logs.length,
    lastLogin: lastLoginLog ? lastLoginLog.timestamp : null,
    totalLogins,
    totalDownloads,
    totalEdits,
    totalCreates,
    totalDeletes,
    accountAge,
  };
}

// Format relative time in Arabic
export function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'الآن';
  if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  if (diffDays < 30) return `منذ ${diffDays} يوم`;
  if (diffDays < 365) return `منذ ${Math.floor(diffDays / 30)} شهر`;
  return `منذ ${Math.floor(diffDays / 365)} سنة`;
}

// Format absolute time in Arabic
export function formatAbsoluteTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Export logs to CSV
export function exportLogsToCSV(logs: ActivityLog[]): void {
  const headers = ['التاريخ والوقت', 'المستخدم', 'الصلاحية', 'نوع النشاط', 'الوصف'];
  const rows = logs.map(log => [
    formatAbsoluteTime(log.timestamp),
    log.username,
    log.userRole,
    log.activityType,
    log.description,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `activity-logs-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// Export logs to JSON
export function exportLogsToJSON(logs: ActivityLog[]): void {
  const dataStr = JSON.stringify(logs, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `activity-logs-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
