import { X, Mail, Lock, User, Church, Briefcase, Upload, Users } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ChurchRoleDropdown } from './ChurchRoleDropdown';
import { ServicesDropdown } from './ServicesDropdown';
import { checkPassword } from '../utils/password';

interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
}

export function SignupModal({ isOpen, onClose, onSwitchToLogin }: SignupModalProps) {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [churchName, setChurchName] = useState('');
  const [churchRole, setChurchRole] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('كلمة المرور وتأكيد كلمة المرور غير متطابقتين');
      return;
    }

    const passwordCheck = checkPassword(password);
    if (!passwordCheck.valid) {
      setError(
        'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل وأن تحتوي على حرف كبير وصغير ورقم ورمز خاص'
      );
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password, fullName, churchName, churchRole, services);
      onClose();
    } catch (err: any) {
      setError(err.message || 'فشل إنشاء الحساب');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-[1000] p-4 overflow-y-auto" dir="rtl">
      <div className="bg-background rounded-xl max-w-md w-full p-6 relative my-auto max-h-[85vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold mb-6 text-center">إنشاء حساب جديد</h2>

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
                id="signup-full-name"
                name="full_name"
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
                id="signup-email"
                name="email"
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
                id="signup-password"
                name="password"
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
                id="signup-confirm-password"
                name="confirm_password"
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
                id="signup-church-name"
                name="church_name"
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
            <label className="block text-sm font-medium mb-2">صورة الملف الشخصي (اختياري)</label>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id="avatar-upload"
                name="avatar"
              />
              <label
                htmlFor="avatar-upload"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-card border border-border rounded-lg hover:bg-muted transition-colors cursor-pointer"
              >
                <Upload className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">اختر صورة</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'جارٍ إنشاء الحساب...' : 'إنشاء حساب'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          لديك حساب بالفعل؟{' '}
          <button onClick={onSwitchToLogin} className="text-primary hover:underline">
            تسجيل الدخول
          </button>
        </p>
      </div>
    </div>
  );
}