import { useState, useEffect, useMemo } from 'react';
import { Users, Search, Shield, Edit, Trash2, Calendar, Mail, Crown, Edit2 as EditIcon, Eye, Activity, Download, Database, UserPlus, ChevronDown, ChevronUp, Church, Briefcase } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { useAuth } from '../contexts/AuthContext';
import { ActivityLogModal } from './ActivityLogModal';
import { AddUserModal } from './AddUserModal';
import { logUserRoleChange, logUserDelete, getAllLogs, exportLogsToCSV, exportLogsToJSON } from '../utils/activityLogger';
import { seedMockActivities } from '../utils/seedMockActivities';

type UserRole = 'viewer' | 'editor' | 'admin';

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

  // Load users from localStorage on mount
  useEffect(() => {
    loadUsers();
    
    // Also listen for storage changes (in case mock users are initialized)
    const handleStorageChange = () => {
      loadUsers();
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Poll once after a short delay to catch late initialization
    const timer = setTimeout(() => {
      loadUsers();
    }, 500);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearTimeout(timer);
    };
  }, []);

  const loadUsers = () => {
    const savedUsers = localStorage.getItem('all_users');
    console.log('📋 Loading users from localStorage:', savedUsers);
    console.log('📋 Parsed users:', savedUsers ? JSON.parse(savedUsers) : 'No users found');
    if (savedUsers) {
      const parsedUsers = JSON.parse(savedUsers);
      setUsers(parsedUsers);
      console.log(`✅ Loaded ${parsedUsers.length} users`);
    } else {
      console.log('⚠️ No users found in localStorage');
      // Initialize with current user if no users exist
      if (currentUserProfile) {
        const initialUsers = [{
          id: currentUserProfile.id,
          email: currentUserProfile.email,
          full_name: currentUserProfile.full_name,
          church_name: currentUserProfile.church_name,
          church_role: currentUserProfile.church_role,
          services: currentUserProfile.services,
          role: currentUserProfile.role,
          created_at: currentUserProfile.created_at,
          avatar_url: currentUserProfile.avatar_url,
        }];
        setUsers(initialUsers);
        localStorage.setItem('all_users', JSON.stringify(initialUsers));
        console.log('✅ Initialized with current user');
      }
    }
  };

  const saveUsers = (updatedUsers: User[]) => {
    setUsers(updatedUsers);
    localStorage.setItem('all_users', JSON.stringify(updatedUsers));

    // If current user's role was changed, update their profile
    const currentUser = updatedUsers.find(u => u.email === currentUserProfile?.email);
    if (currentUser && currentUserProfile && currentUser.role !== currentUserProfile.role) {
      const updatedProfile = { ...currentUserProfile, role: currentUser.role };
      localStorage.setItem('mockProfile', JSON.stringify(updatedProfile));
      window.location.reload(); // Reload to apply new permissions
    }
  };

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    // Prevent changing your own role
    if (userId === currentUserProfile?.id) {
      alert('لا يمكنك تغيير صلاحياتك الخاصة');
      return;
    }

    const user = users.find(u => u.id === userId);
    if (!user) return;

    const oldRole = user.role;
    const updatedUsers = users.map(user =>
      user.id === userId ? { ...user, role: newRole } : user
    );
    saveUsers(updatedUsers);
    logUserRoleChange(user.full_name, oldRole, newRole, userId);
  };

  const handleDeleteUser = (userId: string) => {
    // Prevent deleting yourself
    if (userId === currentUserProfile?.id) {
      alert('لا يمكنك حذف حسابك الخاصّ');
      return;
    }

    const user = users.find(u => u.id === userId);
    if (!user) return;

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف المستخدم \"${user.full_name}\"؟\n\nهذا الإجراء لا يمكن التراجع عنه.`
    );

    if (confirmed) {
      const updatedUsers = users.filter(u => u.id !== userId);
      saveUsers(updatedUsers);
      logUserDelete(user.full_name, userId);
    }
  };

  const filteredUsers = useMemo(() => {
    let filtered = users.filter(user => {
      const matchesSearch =
        user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = filterRole === 'all' || user.role === filterRole;
      return matchesSearch && matchesRole;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.full_name.localeCompare(b.full_name, 'ar');
        case 'role':
          const roleOrder = { admin: 0, editor: 1, viewer: 2 };
          return roleOrder[a.role] - roleOrder[b.role];
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
      admins: users.filter(u => u.role === 'admin').length,
      editors: users.filter(u => u.role === 'editor').length,
      viewers: users.filter(u => u.role === 'viewer').length,
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

  const handleAddUser = (userData: {
    email: string;
    password: string;
    fullName: string;
    churchName: string;
    churchRole: string;
    services: string[];
    role: UserRole;
  }) => {
    // Create new user object
    const newUser: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: userData.email,
      full_name: userData.fullName,
      church_name: userData.churchName,
      church_role: userData.churchRole,
      services: userData.services,
      role: userData.role,
      created_at: new Date().toISOString(),
      avatar_url: null,
    };

    // Add to users list
    const updatedUsers = [...users, newUser];
    saveUsers(updatedUsers);

    // Also save to credentials storage for login
    const credentials = JSON.parse(localStorage.getItem('mockCredentials') || '{}');
    credentials[userData.email] = userData.password;
    localStorage.setItem('mockCredentials', JSON.stringify(credentials));

    // Show success message
    alert(`تم إضافة المستخدم "${userData.fullName}" بنجاح!`);
    
    // Reload users
    loadUsers();
  };

  return (
    <div className="max-w-6xl mx-auto" dir="rtl">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">إدارة المستخدمين</h1>
            <p className="text-muted-foreground">
              إدارة المستخدمين وتعيين الصلاحيات
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Add User Button */}
            <Button
              onClick={() => setIsAddUserModalOpen(true)}
              className="bg-primary text-primary-foreground hover:opacity-90"
              size="sm"
            >
              <UserPlus className="w-4 h-4 ml-2" />
              إضافة مستخدم
            </Button>

            {/* Export All Dropdown */}
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
                        const allLogs = getAllLogs();
                        exportLogsToCSV(allLogs);
                        setIsExportMenuOpen(false);
                      }}
                      className="w-full text-right px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm"
                    >
                      تصدير CSV (جميع المستخدمين)
                    </button>
                    <button
                      onClick={() => {
                        const allLogs = getAllLogs();
                        exportLogsToJSON(allLogs);
                        setIsExportMenuOpen(false);
                      }}
                      className="w-full text-right px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm"
                    >
                      تصدير JSON (جميع المستخدمين)
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={loadUsers}
              variant="outline"
              size="sm"
            >
              <Users className="w-4 h-4 ml-2" />
              تحديث القائمة
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
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

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative md:col-span-2">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="بحث بالاسم أو البريد الإلكتروني..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
          </div>

          {/* Filter by Role */}
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

        {/* Sort */}
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

      {/* Users Table */}
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
                          {/* Expand/Collapse Icon */}
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
                              <img src={user.avatar_url} alt={user.full_name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              <span className="text-sm font-semibold text-primary">
                                {user.full_name.charAt(0)}
                              </span>
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
                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(user.role)}`}>
                              {getRoleIcon(user.role)}
                              {getRoleLabel(user.role)}
                            </span>
                          ) : (
                            <select
                              value={user.role}
                              onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                              className={`px-3 py-1 rounded-full text-sm font-medium border-0 cursor-pointer ${getRoleBadgeColor(user.role)}`}
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
                            day: 'numeric'
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
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={user.id === currentUserProfile?.id}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ];
                  
                  // Add expandable row if this user is expanded
                  if (expandedUserId === user.id) {
                    rows.push(
                      <tr key={`${user.id}-details`} className="bg-muted/20">
                        <td colSpan={4} className="px-4 py-4">
                          <div className="bg-card rounded-lg p-4 border border-border">
                            <h3 className="text-sm font-semibold mb-4 text-muted-foreground">التفاصيل الكاملة</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Church Name */}
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <Church className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">اسم الكنيسة</p>
                                  <p className="font-medium">{user.church_name || 'غير محدد'}</p>
                                </div>
                              </div>

                              {/* Church Role */}
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

                            {/* Services */}
                            <div className="mt-4">
                              <p className="text-xs text-muted-foreground mb-2">الخدمات المسؤول عنها / يخدم بها</p>
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

                            {/* Action Buttons */}
                            <div className="mt-4 pt-4 border-t border-border flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-primary hover:text-primary hover:bg-primary/10"
                                onClick={() => {
                                  setSelectedUserForLog(user);
                                  setIsActivityLogOpen(true);
                                }}
                              >
                                <Activity className="w-4 h-4 ml-2" />
                                عرض سجل النشاط
                              </Button>
                              {user.id !== currentUserProfile?.id && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteUser(user.id)}
                                >
                                  <Trash2 className="w-4 h-4 ml-2" />
                                  حذف المستخدم
                                </Button>
                              )}
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

      {/* Info Box */}
      <div className="mt-6 bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="text-sm flex-1">
            <p className="font-semibold mb-2">مستويات الصلاحيات:</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <Crown className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <span><strong>مسؤول:</strong> جميع الصلاحيات بما في ذلك إدارة المستخدمين والمواضيع</span>
              </li>
              <li className="flex items-start gap-2">
                <EditIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <span><strong>محرر:</strong> إضافة وتعديل وحذف المحتوى في جميع المكتبات</span>
              </li>
              <li className="flex items-start gap-2">
                <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                <span><strong>مشاهد:</strong> مشاهدة المحتوى وإضافة المفضلات فقط</span>
              </li>
            </ul>
          </div>
          <Button
            onClick={seedMockActivities}
            variant="outline"
            size="sm"
            className="flex-shrink-0"
          >
            <Database className="w-4 h-4 ml-2" />
            إنشاء بيانات تجريبية
          </Button>
        </div>
      </div>

      {/* Activity Log Modal */}
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

      {/* Add User Modal */}
      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        onAddUser={handleAddUser}
      />
    </div>
  );
}