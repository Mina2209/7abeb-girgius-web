import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Calendar,
  ChevronDown,
  ChevronUp,
  Church,
  Crown,
  Edit2 as EditIcon,
  Eye,
  Mail,
  Users,
  Trash2,
  Download,
  UserPlus,
  Briefcase,
} from 'lucide-react';

import { Button } from './ui/button';
import { Input } from './ui/input';
import { useAuth } from '../contexts/AuthContext';
import { ActivityLogModal } from './ActivityLogModal';
import { AddUserModal } from './AddUserModal';
import { exportLogsToCSV, exportLogsToJSON } from '../utils/activityLogger';
import { seedMockActivities } from '../utils/seedMockActivities';
import { apiGetJson, apiRequest } from '../services/apiClient';

type UserRole = 'viewer' | 'editor' | 'admin';

type ServerRole = 'ADMIN' | 'EDITOR' | 'USER' | 'VIEWER';

type ServerUser = {
  id: string;
  username: string;
  role: ServerRole;
  createdAt: string;
};

interface User {
  id: string;
  email: string;
  full_name: string;
  church_name: string;
  church_role: string;
  services: string[];
  role: UserRole;
  created_at: string;
  avatar_url: string | null;
}

const mapServerRoleToClient = (role: ServerRole): UserRole => {
  if (role === 'ADMIN') return 'admin';
  if (role === 'EDITOR') return 'editor';
  return 'viewer';
};

export function UserManagementPage() {
  const { profile: currentUserProfile } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | UserRole>('all');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'role'>('date');

  const [selectedUserForLog, setSelectedUserForLog] = useState<User | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoadError(null);
      const apiUsers = await apiGetJson<ServerUser[]>('/api/auth/users');

      const mapped: User[] = apiUsers.map((u) => ({
        id: u.id,
        email: u.username,
        full_name: u.username,
        church_name: '',
        church_role: '',
        services: [],
        role: mapServerRoleToClient(u.role),
        created_at: u.createdAt,
        avatar_url: null,
      }));

      setUsers(mapped);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'فشل تحميل المستخدمين');
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (userId === currentUserProfile?.id) {
      alert('لا يمكنك تغيير صلاحياتك الخاصة');
      return;
    }

    const roleMap: Record<UserRole, ServerRole> = { admin: 'ADMIN', editor: 'EDITOR', viewer: 'VIEWER' };
    const prismaRole = roleMap[newRole];

    try {
      const res = await apiRequest(`/api/auth/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ role: prismaRole }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || 'فشل تغيير صلاحية المستخدم');
      }

      await loadUsers();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'فشل تغيير الصلاحية');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUserProfile?.id) {
      alert('لا يمكنك حذف حسابك الخاصّ');
      return;
    }

    const user = users.find((u) => u.id === userId);

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف المستخدم "${user?.full_name ?? ''}"؟\n\nهذا الإجراء لا يمكن التراجع عنه.`
    );

    if (!confirmed) return;

    try {
      const res = await apiRequest(`/api/auth/users/${userId}`, { method: 'DELETE' });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || 'فشل حذف المستخدم');
      }

      await loadUsers();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'فشل حذف المستخدم');
    }
  };

  const filteredUsers = useMemo(() => {
    const filtered = users.filter((user) => {
      const matchesSearch =
        user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole = filterRole === 'all' || user.role === filterRole;
      return matchesSearch && matchesRole;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.full_name.localeCompare(b.full_name, 'ar');
        case 'role': {
          const roleOrder = { admin: 0, editor: 1, viewer: 2 } as const;
          return (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3);
        }
        case 'date':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return filtered;
  }, [users, searchQuery, filterRole, sortBy]);

  const userStats = useMemo(() => {
    return {
      total: users.length,
      admins: users.filter((u) => u.role === 'admin').length,
      editors: users.filter((u) => u.role === 'editor').length,
      viewers: users.filter((u) => u.role === 'viewer').length,
    };
  }, [users]);

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-red-500/10 text-red-600 dark:text-red-400';
      case 'editor':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
      case 'viewer':
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400';
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <Crown className="w-4 h-4" />;
      case 'editor':
        return <EditIcon className="w-4 h-4" />;
      case 'viewer':
        return <Eye className="w-4 h-4" />;
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'مسؤول';
      case 'editor':
        return 'محرر';
      case 'viewer':
        return 'مشاهد';
    }
  };

  const handleAddUser = async (userData: {
    email: string;
    password: string;
    fullName: string;
    churchName: string;
    churchRole: string;
    services: string[];
    role: UserRole;
  }) => {
    // السيرفر الحالي (auth.controller.js) createUser يستقبل username/password/role فقط.
    // لذلك نستخدم email كـ username.
    const username = userData.email;
    const roleMap: Record<UserRole, ServerRole> = { admin: 'ADMIN', editor: 'EDITOR', viewer: 'VIEWER' };
    const prismaRole = roleMap[userData.role];

    const res = await apiRequest('/api/auth/users', {
      method: 'POST',
      body: JSON.stringify({ username, password: userData.password, role: prismaRole }),
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(txt || 'فشل إضافة المستخدم');
    }

    await loadUsers();
  };

  const handleExportLogs = async (format: 'csv' | 'json') => {
    try {
      const allLogs = await apiGetJson<any[]>('/api/auth/logs');
      if (format === 'csv') exportLogsToCSV(allLogs);
      else exportLogsToJSON(allLogs);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'فشل تحميل سجل الأنشطة');
    }
    setIsExportMenuOpen(false);
  };

  return (
    <div className="max-w-6xl mx-auto" dir="rtl">
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">إدارة المستخدمين</h1>
            <p className="text-muted-foreground">إدارة المستخدمين وتعيين الصلاحيات</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => setIsAddUserModalOpen(true)}
              className="bg-primary text-primary-foreground hover:opacity-90"
              size="sm"
            >
              <UserPlus className="w-4 h-4 ml-2" />
              إضافة مستخدم
            </Button>

            <div className="relative">
              <Button
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                variant="outline"
                size="sm"
              >
                <Download className="w-4 h-4 ml-2" />
                تصدير سجل الأنشطة
              </Button>

              {isExportMenuOpen && (
                <div className="absolute left-0 top-full mt-2 w-48 bg-card border border-border rounded-xl shadow-lg z-10">
                  <div className="p-2">
                    <button
                      onClick={() => {
                        void handleExportLogs('csv');
                      }}
                      className="w-full text-right px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm"
                    >
                      تصدير CSV (جميع المستخدمين)
                    </button>
                    <button
                      onClick={() => {
                        void handleExportLogs('json');
                      }}
                      className="w-full text-right px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm"
                    >
                      تصدير JSON (جميع المستخدمين)
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Button onClick={() => void loadUsers()} variant="outline" size="sm">
              <Users className="w-4 h-4 ml-2" />
              تحديث القائمة
            </Button>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-4 mb-6 flex items-center justify-between">
          <span>{loadError}</span>
          <Button size="sm" variant="ghost" onClick={() => void loadUsers()}>إعادة المحاولة</Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{userStats.total}</p>
              <p className="text-sm text-muted-foreground">إجمالي المستخدمين</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <Crown className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{userStats.admins}</p>
              <p className="text-sm text-muted-foreground">مسؤولين</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <EditIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{userStats.editors}</p>
              <p className="text-sm text-muted-foreground">محررين</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-500/10 flex items-center justify-center">
              <Eye className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{userStats.viewers}</p>
              <p className="text-sm text-muted-foreground">مشاهدين</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-2">
            <SearchIcon />
            <Input
              type="text"
              placeholder="بحث بالاسم أو البريد الإلكتروني..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
          </div>

          <div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as 'all' | UserRole)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="all">جميع الصلاحيات</option>
              <option value="admin">مسؤول</option>
              <option value="editor">محرر</option>
              <option value="viewer">مشاهد</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <span className="text-sm text-muted-foreground">ترتيب حسب:</span>
          <button
            onClick={() => setSortBy('date')}
            className={`text-sm ${sortBy === 'date' ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
          >
            التاريخ
          </button>
          <span className="text-muted-foreground">•</span>
          <button
            onClick={() => setSortBy('name')}
            className={`text-sm ${sortBy === 'name' ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
          >
            الاسم
          </button>
          <span className="text-muted-foreground">•</span>
          <button
            onClick={() => setSortBy('role')}
            className={`text-sm ${sortBy === 'role' ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
          >
            الصلاحية
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-right px-4 py-3 font-semibold">المستخدم</th>
                <th className="text-center px-4 py-3 font-semibold">الصلاحية</th>
                <th className="text-center px-4 py-3 font-semibold">تاريخ الانضمام</th>
                <th className="text-center px-4 py-3 font-semibold">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-muted-foreground">
                    لا توجد نتائج
                  </td>
                </tr>
              ) : (
                filteredUsers.flatMap((user) => {
                  const rows = [
                    <tr
                      key={user.id}
                      className={`border-b border-border hover:bg-muted/30 transition-colors cursor-pointer ${
                        user.id === currentUserProfile?.id ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedUserId(expandedUserId === user.id ? null : user.id);
                            }}
                          >
                            {expandedUserId === user.id ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </button>

                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            {user.avatar_url ? (
                              <img
                                src={user.avatar_url}
                                alt={user.full_name}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-sm font-semibold text-primary">{user.full_name.charAt(0)}</span>
                            )}
                          </div>

                          <div>
                            <p className="font-medium">
                              {user.full_name}
                              {user.id === currentUserProfile?.id && (
                                <span className="text-xs text-muted-foreground mr-2">(أنت)</span>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-center">
                          {user.id === currentUserProfile?.id ? (
                            <span
                              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(
                                user.role
                              )}`}
                            >
                              {getRoleIcon(user.role)}
                              {getRoleLabel(user.role)}
                            </span>
                          ) : (
                            <select
                              value={user.role}
                              onChange={(e) => void handleRoleChange(user.id, e.target.value as UserRole)}
                              className={`px-3 py-1 rounded-full text-sm font-medium border-0 cursor-pointer ${getRoleBadgeColor(
                                user.role
                              )}`}
                            >
                              <option value="viewer">مشاهد</option>
                              <option value="editor">محرر</option>
                              <option value="admin">مسؤول</option>
                            </select>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                        <div className="flex items-center justify-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(user.created_at).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      </td>

                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2 justify-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-primary hover:text-primary hover:bg-primary/10"
                            onClick={() => {
                              setSelectedUserForLog(user);
                              setIsActivityLogOpen(true);
                            }}
                            title="عرض سجل النشاط"
                          >
                            <Activity className="w-4 h-4" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => void handleDeleteUser(user.id)}
                            disabled={user.id === currentUserProfile?.id}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>,
                  ];

                  if (expandedUserId === user.id) {
                    rows.push(
                      <tr key={`${user.id}-details`} className="bg-muted/20">
                        <td colSpan={4} className="px-4 py-4">
                          <div className="bg-card rounded-lg p-4 border border-border">
                            <h3 className="text-sm font-semibold mb-4 text-muted-foreground">التفاصيل الكاملة</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <Church className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">اسم الكنيسة</p>
                                  <p className="font-medium">{user.church_name || 'غير محدد'}</p>
                                </div>
                              </div>

                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                  <Briefcase className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">الدور في الكنيسة</p>
                                  <p className="font-medium">{user.church_role || 'غير محدد'}</p>
                                </div>
                              </div>
                            </div>

                            <div className="mt-4">
                              <p className="text-xs text-muted-foreground mb-2">الخدمات</p>
                              <div className="flex flex-wrap gap-2">
                                {user.services && user.services.length > 0 ? (
                                  user.services.map((service, index) => (
                                    <span
                                      key={index}
                                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                                    >
                                      <Users className="w-3 h-3 ml-1" />
                                      {service}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-sm text-muted-foreground">لا توجد خدمات محددة</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return rows;
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="text-sm flex-1 min-w-[200px]">
            <p className="font-semibold mb-2">مستويات الصلاحيات:</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <Crown className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>مسؤول:</strong> جميع الصلاحيات بما في ذلك إدارة المستخدمين
                </span>
              </li>
              <li className="flex items-start gap-2">
                <EditIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>محرر:</strong> إضافة وتعديل وحذف المحتوى
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>مشاهد:</strong> مشاهدة المحتوى
                </span>
              </li>
            </ul>
          </div>
          <Button onClick={seedMockActivities} variant="outline" size="sm" className="flex-shrink-0">
            <DatabaseIcon />
            إنشاء بيانات تجريبية
          </Button>
        </div>
      </div>

      {selectedUserForLog && (
        <ActivityLogModal
          isOpen={isActivityLogOpen}
          onClose={() => {
            setIsActivityLogOpen(false);
            setSelectedUserForLog(null);
          }}
          userId={selectedUserForLog.id}
          username={selectedUserForLog.full_name}
          userRole={selectedUserForLog.role}
        />
      )}

      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        onAddUser={handleAddUser}
      />
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="w-4 h-4 ml-2"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </svg>
  );
}

