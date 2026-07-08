import { X, Mail, Lock, User, Church, Shield } from 'lucide-react';
import { useState } from 'react';
import { ChurchRoleDropdown } from './ChurchRoleDropdown';
import { ServicesDropdown } from './ServicesDropdown';

type UserRole = 'viewer' | 'editor' | 'admin';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddUser: (userData: {
    email: string;
    password: string;
    fullName: string;
    churchName: string;
    churchRole: string;
    services: string[];
    role: UserRole;
  }) => void;
}

export function AddUserModal({ isOpen, onClose, onAddUser }: AddUserModalProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [churchName, setChurchName] = useState('');
  const [churchRole, setChurchRole] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [role, setRole] = useState<UserRole>('viewer');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (password !== confirmPassword) {
      setError('كلمة المرور وتأكيد كلمة المرور غير متطابقتين');
      return;
    }

    if (password.length < 6) {
      setError('يجب أن تكون كلمة المرور 6 أحرف على الأقل');
      return;
    }

    // التحقق من وجود الإيميل يتم على السيرفر (authService.createUser)
    setLoading(true);


    try {
      onAddUser({
        email,
        password,
        fullName,
        churchName,
        churchRole,
        services,
        role,
      });

      // Reset form
      setFullName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setChurchName('');
      setChurchRole('');
      setServices([]);
      setRole('viewer');
      setError('');

      onClose();
    } catch (err: any) {
      setError(err.message || 'فشل إضافة المستخدم');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (selectedRole: UserRole) => {
    switch (selectedRole) {
      case 'admin':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      case 'editor':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'viewer':
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';
    }
  };

  const getRoleLabel = (selectedRole: UserRole) => {
    switch (selectedRole) {
      case 'admin':
        return 'مسؤول';
      case 'editor':
        return 'محرر';
      case 'viewer':
        return 'مشاهد';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4 overflow-y-auto" dir="rtl">
      <div className="bg-background rounded-xl max-w-md w-full p-6 relative my-8">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold mb-6 text-center">إضافة مستخدم جديد</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm text-right">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">الاسم الكامل</label>
            <div className="relative">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full pr-11 pl-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="الاسم الكامل"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pr-11 pl-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="example@church.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">كلمة المرور</label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pr-11 pl-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">تأكيد كلمة المرور</label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full pr-11 pl-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">اسم الكنيسة</label>
            <div className="relative">
              <Church className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={churchName}
                onChange={(e) => setChurchName(e.target.value)}
                required
                className="w-full pr-11 pl-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="كنيسة السيدة العذراء"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">الدور في الكنيسة</label>
            <ChurchRoleDropdown
              value={churchRole}
              onChange={(value) => setChurchRole(value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">خدمات مسؤول عنها/ تخدم بها</label>
            <ServicesDropdown
              value={services}
              onChange={(value) => setServices(value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">صلاحيات المستخدم</label>
            <div className="relative">
              <Shield className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className={`w-full pr-11 pl-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer ${getRoleBadgeColor(role)}`}
              >
                <option value="viewer">مشاهد - مشاهدة المحتوى فقط</option>
                <option value="editor">محرر - تعديل المحتوى</option>
                <option value="admin">مسؤول - جميع الصلاحيات</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {role === 'admin' && '✓ يمكنه إدارة المستخدمين والمواضيع والإعدادات'}
              {role === 'editor' && '✓ يمكنه إضافة وتعديل وحذف المحتوى'}
              {role === 'viewer' && '✓ يمكنه فقط مشاهدة المحتوى وإضافة المفضلات'}
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'جارٍ إضافة المستخدم...' : 'إضافة مستخدم'}
          </button>
        </form>

        <div className="mt-4 bg-primary/5 border border-primary/20 rounded-lg p-3">
          <p className="text-xs text-muted-foreground text-center">
            سيتم إنشاء حساب جديد بالمعلومات المدخلة، ويمكن للمستخدم تسجيل الدخول مباشرة
          </p>
        </div>
      </div>
    </div>
  );
}