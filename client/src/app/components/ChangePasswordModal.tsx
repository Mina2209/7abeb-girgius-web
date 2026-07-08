import { X, Lock, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const { profile } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('يرجى ملء جميع الحقول');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('كلمة المرور الجديدة وتأكيد كلمة المرور غير متطابقتين');
      return;
    }

    if (newPassword.length < 6) {
      setError('يجب أن تكون كلمة المرور الجديدة 6 أحرف على الأقل');
      return;
    }

    if (currentPassword === newPassword) {
      setError('كلمة المرور الجديدة يجب أن تكون مختلفة عن كلمة المرور الحالية');
      return;
    }

    // Verify current password on server
    // (السيرفر هيقوم بمطابقة كلمة المرور الحالية قبل تحديثها)
    if (!profile?.id) {
      setError('غير مصرح لك');
      return;
    }


    setLoading(true);

    try {
      // Update password on server
      const res = await (await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/password`, {

        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,

        },
        body: JSON.stringify({ currentPassword, newPassword }),
      })).json();

      if (!res?.ok) {
        throw new Error(res?.error || 'فشل تغيير كلمة المرور');
      }

      setSuccess('تم تغيير كلمة المرور بنجاح');
      

      
      // Reset form after 2 seconds
      setTimeout(() => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccess('');
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'فشل تغيير كلمة المرور');
    } finally {
      setLoading(false);
    }

  };

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4" dir="rtl">
      <div className="bg-background rounded-xl max-w-md w-full p-6 relative">
        <button
          onClick={handleClose}
          className="absolute top-4 left-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold mb-6 text-center">تغيير كلمة المرور</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm text-right">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg text-sm text-right">
              {success}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">كلمة المرور الحالية</label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full pr-11 pl-11 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showCurrentPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">كلمة المرور الجديدة</label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full pr-11 pl-11 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showNewPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">يجب أن تكون 6 أحرف على الأقل</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">تأكيد كلمة المرور الجديدة</label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full pr-11 pl-11 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || !!success}
              className="flex-1 bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'جارٍ التغيير...' : success ? 'تم التغيير ✓' : 'تغيير كلمة المرور'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-6 py-3 border border-border rounded-lg font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              إلغاء
            </button>
          </div>
        </form>

        <div className="mt-4 bg-primary/5 border border-primary/20 rounded-lg p-3">
          <p className="text-xs text-muted-foreground text-center">
             نصيحة: استخدم كلمة مرور قوية تحتوي على أحرف وأرقام ورموز
          </p>
        </div>
      </div>
    </div>
  );
}
