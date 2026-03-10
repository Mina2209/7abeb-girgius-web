// Seed mock activities for testing the activity log feature
import type { ActivityLog } from './activityLogger';

export function seedMockActivities(): void {
  const existingLogs = localStorage.getItem('activity_logs');
  if (existingLogs) {
    const confirmation = window.confirm(
      'توجد بيانات أنشطة موجودة بالفعل. هل تريد استبدالها ببيانات تجريبية جديدة؟'
    );
    if (!confirmation) return;
  }

  // Get all users
  const usersStr = localStorage.getItem('all_users');
  if (!usersStr) {
    alert('لا يوجد مستخدمون في النظام. يرجى إضافة مستخدمين أولاً.');
    return;
  }

  const users = JSON.parse(usersStr);
  
  // Helper to generate timestamps in the past
  const daysAgo = (days: number, hoursOffset = 0) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(date.getHours() - hoursOffset);
    return date.toISOString();
  };

  const mockLogs: ActivityLog[] = [];
  let idCounter = 1;

  // Generate activities for each user
  users.forEach((user: any, userIndex: number) => {
    const userId = user.id;
    const username = user.full_name;
    const userRole = user.role;

    // Admin activities (most comprehensive)
    if (userRole === 'admin') {
      // Logins (last 7 days)
      for (let i = 0; i < 15; i++) {
        mockLogs.push({
          id: `mock-${idCounter++}`,
          userId,
          username,
          userRole,
          timestamp: daysAgo(i % 7, i * 2),
          activityType: 'login',
          description: 'تسجيل دخول',
        });
      }

      // User management
      mockLogs.push({
        id: `mock-${idCounter++}`,
        userId,
        username,
        userRole,
        timestamp: daysAgo(2, 3),
        activityType: 'user_role_change',
        contentType: 'user',
        contentId: 'user-3',
        contentTitle: 'مريم يوسف',
        description: 'تغيير صلاحية المستخدم: مريم يوسف',
        details: {
          changes: [
            { field: 'الصلاحية', oldValue: 'viewer', newValue: 'editor' },
          ],
        },
      });

      // Topic management
      mockLogs.push({
        id: `mock-${idCounter++}`,
        userId,
        username,
        userRole,
        timestamp: daysAgo(3, 1),
        activityType: 'topic_create',
        contentType: 'topic',
        contentId: 'topic-101',
        contentTitle: 'الصوم الكبير',
        description: 'إنشاء موضوع جديد: الصوم الكبير',
      });

      mockLogs.push({
        id: `mock-${idCounter++}`,
        userId,
        username,
        userRole,
        timestamp: daysAgo(4, 2),
        activityType: 'topic_edit',
        contentType: 'topic',
        contentId: 'topic-5',
        contentTitle: 'عيد القيامة',
        description: 'تعديل موضوع: عيد القيامة',
        details: {
          changes: [
            { field: 'الاسم', oldValue: 'القيامة', newValue: 'عيد القيامة' },
          ],
        },
      });

      mockLogs.push({
        id: `mock-${idCounter++}`,
        userId,
        username,
        userRole,
        timestamp: daysAgo(5, 4),
        activityType: 'topic_reorder',
        contentType: 'topic',
        contentTitle: 'المناسبات الكنسية',
        description: 'إعادة ترتيب المواضيع في قسم: المناسبات الكنسية',
      });

      // Section visibility
      mockLogs.push({
        id: `mock-${idCounter++}`,
        userId,
        username,
        userRole,
        timestamp: daysAgo(1, 5),
        activityType: 'section_visibility',
        contentType: 'section',
        contentTitle: 'مكتبة الترانيم',
        description: 'إظهار قسم: مكتبة الترانيم',
        details: { visible: true },
      });

      // Settings changes
      mockLogs.push({
        id: `mock-${idCounter++}`,
        userId,
        username,
        userRole,
        timestamp: daysAgo(6, 1),
        activityType: 'settings_change',
        contentType: 'settings',
        contentTitle: 'صورة الكتاب الافتراضية',
        description: 'تغيير الإعدادات: صورة الكتاب الافتراضية',
        details: {
          changes: [
            { field: 'صورة الكتاب الافتراضية', oldValue: 'default-old.jpg', newValue: 'default-new.jpg' },
          ],
        },
      });

      // Content creation
      mockLogs.push({
        id: `mock-${idCounter++}`,
        userId,
        username,
        userRole,
        timestamp: daysAgo(7, 3),
        activityType: 'create',
        contentType: 'book',
        contentId: '101',
        contentTitle: 'كتاب الأجبية',
        description: 'إنشاء كتاب جديد: كتاب الأجبية',
      });

      // Import/Export
      mockLogs.push({
        id: `mock-${idCounter++}`,
        userId,
        username,
        userRole,
        timestamp: daysAgo(8, 2),
        activityType: 'import',
        contentType: 'hymn',
        description: 'استيراد 25 ترانيم',
        details: { itemCount: 25 },
      });

      mockLogs.push({
        id: `mock-${idCounter++}`,
        userId,
        username,
        userRole,
        timestamp: daysAgo(9, 1),
        activityType: 'export',
        contentType: 'image',
        description: 'تصدير 50 صور',
        details: { itemCount: 50 },
      });
    }

    // Editor activities
    if (userRole === 'editor') {
      // Logins
      for (let i = 0; i < 8; i++) {
        mockLogs.push({
          id: `mock-${idCounter++}`,
          userId,
          username,
          userRole,
          timestamp: daysAgo(i % 5, i * 3),
          activityType: 'login',
          description: 'تسجيل دخول',
        });
      }

      // Content edits
      mockLogs.push({
        id: `mock-${idCounter++}`,
        userId,
        username,
        userRole,
        timestamp: daysAgo(1, 2),
        activityType: 'edit',
        contentType: 'hymn',
        contentId: '15',
        contentTitle: 'ترنيمة الفصح',
        description: 'تعديل ترنيمة: ترنيمة الفصح',
        details: {
          changes: [
            { field: 'العنوان', oldValue: 'الفصح', newValue: 'ترنيمة الفصح' },
            { field: 'الموضوع', oldValue: 'عام', newValue: 'عيد القيامة' },
          ],
        },
      });

      mockLogs.push({
        id: `mock-${idCounter++}`,
        userId,
        username,
        userRole,
        timestamp: daysAgo(2, 4),
        activityType: 'edit',
        contentType: 'saying',
        contentId: '22',
        contentTitle: 'قول عن الصلاة',
        description: 'تعديل قول: قول عن الصلاة',
        details: {
          changes: [
            { field: 'القديس', oldValue: 'القديس أنطونيوس', newValue: 'الأنبا أنطونيوس' },
          ],
        },
      });

      // Content creation
      mockLogs.push({
        id: `mock-${idCounter++}`,
        userId,
        username,
        userRole,
        timestamp: daysAgo(3, 1),
        activityType: 'create',
        contentType: 'hymn',
        contentId: '203',
        contentTitle: 'ترنيمة الصليب',
        description: 'إنشاء ترنيمة جديد: ترنيمة الصليب',
      });

      mockLogs.push({
        id: `mock-${idCounter++}`,
        userId,
        username,
        userRole,
        timestamp: daysAgo(4, 3),
        activityType: 'create',
        contentType: 'image',
        contentId: '305',
        contentTitle: 'صورة القيامة',
        description: 'إنشاء صورة جديد: صورة القيامة',
      });

      // Bulk delete
      mockLogs.push({
        id: `mock-${idCounter++}`,
        userId,
        username,
        userRole,
        timestamp: daysAgo(5, 2),
        activityType: 'bulk_delete',
        contentType: 'hymn',
        description: 'حذف جماعي: 3 ترانيم',
        details: {
          bulkItems: [
            { id: '1001', title: 'ترنيمة قديمة 1' },
            { id: '1002', title: 'ترنيمة قديمة 2' },
            { id: '1003', title: 'ترنيمة قديمة 3' },
          ],
        },
      });

      // Single delete
      mockLogs.push({
        id: `mock-${idCounter++}`,
        userId,
        username,
        userRole,
        timestamp: daysAgo(6, 1),
        activityType: 'delete',
        contentType: 'saying',
        contentId: '99',
        contentTitle: 'قول مكرر',
        description: 'حذف قول: قول مكرر',
      });

      // Downloads
      mockLogs.push({
        id: `mock-${idCounter++}`,
        userId,
        username,
        userRole,
        timestamp: daysAgo(7, 4),
        activityType: 'download',
        contentType: 'hymn',
        contentTitle: 'ترنيمة الميلاد',
        description: 'تحميل ترنيمة: ترنيمة الميلاد',
        details: {
          fileName: 'hymn-christmas.mp4',
          downloadType: 'hymn',
        },
      });
    }

    // Viewer activities (limited)
    if (userRole === 'viewer') {
      // Logins
      for (let i = 0; i < 5; i++) {
        mockLogs.push({
          id: `mock-${idCounter++}`,
          userId,
          username,
          userRole,
          timestamp: daysAgo(i % 4, i * 4),
          activityType: 'login',
          description: 'تسجيل دخول',
        });
      }

      // Downloads
      mockLogs.push({
        id: `mock-${idCounter++}`,
        userId,
        username,
        userRole,
        timestamp: daysAgo(1, 2),
        activityType: 'download',
        contentType: 'book',
        contentTitle: 'كتاب القداس',
        description: 'تحميل كتاب: كتاب القداس',
        details: {
          fileName: 'book-liturgy.pdf',
          downloadType: 'book',
        },
      });

      mockLogs.push({
        id: `mock-${idCounter++}`,
        userId,
        username,
        userRole,
        timestamp: daysAgo(2, 1),
        activityType: 'download',
        contentType: 'image',
        contentTitle: 'صورة العذراء',
        description: 'تحميل صورة: صورة العذراء',
        details: {
          fileName: 'image-mary.jpg',
          downloadType: 'image',
        },
      });

      // Favorites
      mockLogs.push({
        id: `mock-${idCounter++}`,
        userId,
        username,
        userRole,
        timestamp: daysAgo(3, 3),
        activityType: 'favorite_add',
        contentType: 'hymn',
        contentId: '10',
        contentTitle: 'ترنيمة التسبحة',
        description: 'إضافة ترنيمة للمفضلة: ترنيمة التسبحة',
      });

      mockLogs.push({
        id: `mock-${idCounter++}`,
        userId,
        username,
        userRole,
        timestamp: daysAgo(4, 2),
        activityType: 'favorite_add',
        contentType: 'saying',
        contentId: '5',
        contentTitle: 'قول عن المحبة',
        description: 'إضافة قول للمفضلة: قول عن المحبة',
      });

      mockLogs.push({
        id: `mock-${idCounter++}`,
        userId,
        username,
        userRole,
        timestamp: daysAgo(5, 1),
        activityType: 'favorite_remove',
        contentType: 'book',
        contentId: '3',
        contentTitle: 'كتاب التسابيح',
        description: 'إزالة كتاب من المفضلة: كتاب التسابيح',
      });
    }

    // Logout activities for all users
    if (userIndex % 2 === 0) {
      mockLogs.push({
        id: `mock-${idCounter++}`,
        userId,
        username,
        userRole,
        timestamp: daysAgo(0, 12),
        activityType: 'logout',
        description: 'تسجيل خروج',
      });
    }
  });

  // Sort by timestamp (most recent first)
  mockLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Save to localStorage
  localStorage.setItem('activity_logs', JSON.stringify(mockLogs));
  
  console.log(`✅ تم إنشاء ${mockLogs.length} نشاط تجريبي بنجاح!`);
  alert(`تم إنشاء ${mockLogs.length} نشاط تجريبي بنجاح!\n\nيمكنك الآن عرض سجل الأنشطة لأي مستخدم.`);
}
