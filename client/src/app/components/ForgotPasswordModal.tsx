import { X, Mail, KeyRound, Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { apiPostJson } from '../services/apiClient';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackToLogin: () => void;
}

interface ResetResponse {
  ok: boolean;
  temporaryPassword?: string;
}

export function ForgotPasswordModal({ isOpen, onClose, onBackToLogin }: ForgotPasswordModalProps) {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim()) {
      setError('يرجى إدخال اسم المستخدم أو البريد الإلكتروني');
      return;
    }

    setLoading(true);

    try {
      const res = await apiPostJson<ResetResponse>('/api/auth/forgot-password', {
        identifier: identifier.trim(),
      });

      if (res?.ok && res.temporaryPassword) {
        setTemporaryPassword(res.temporaryPassword);
      } else {
        setError('تعذر استعادة كلمة المرور. يرجى المحاولة لاحقاً.');
      }
    } catch (err: any) {
      setError(err.message || 'تعذر استعادة كلمة المرور. يرجى المحاولة لاحقاً.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access may be blocked; the password remains selectable.
    }
  };

  const handleClose = () => {
    setIdentifier('');
    setError('');
    setTemporaryPassword('');
    setCopied(false);
    onClose();
  };

  const handleBackToLogin = () => {
    setIdentifier('');
    setError('');
    setTemporaryPassword('');
    setCopied(false);
    onBackToLogin();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1100] p-4 overflow-y-auto" dir="rtl">
      <div className="bg-background rounded-xl max-w-md w-full p-6 relative my-auto max-h-[85vh] overflow-y-auto">
        <button
          onClick={handleClose}
          className="absolute top-4 left-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold mb-2 text-center">استعادة كلمة المرور</h2>

        {!temporaryPassword ? (
          <>
            <p className="text-sm text-muted-foreground text-center mb-6">
              أدخل اسم المستخدم أو البريد الإلكتروني المرتبط بحسابك وسنقوم بتوليد كلمة مرور مؤقتة لك
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm text-right">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">اسم المستخدم أو البريد الإلكتروني</label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    id="forgot-password-identifier"
                    name="identifier"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    className="w-full pr-11 pl-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="example@church.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? 'جارٍ استعادة كلمة المرور...' : 'استعادة كلمة المرور'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              تذكرت كلمة المرور؟{' '}
              <button onClick={handleBackToLogin} className="text-primary hover:underline">
                العودة لتسجيل الدخول
              </button>
            </p>
          </>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg text-sm text-right">
              تم استعادة كلمة المرور بنجاح
            </div>

            <p className="text-sm text-muted-foreground text-center">
              استخدم كلمة المرور المؤقتة التالية لتسجيل الدخول، ثم غيّرها من صفحة ملفك الشخصي
            </p>

            <div className="relative">
              <div className="flex items-center justify-center gap-2 bg-card border border-border rounded-lg py-4 px-4 text-center">
                <KeyRound className="w-5 h-5 text-primary flex-shrink-0" />
                <span dir="ltr" className="text-lg font-mono font-semibold tracking-wider break-all select-all">
                  {temporaryPassword}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="absolute top-1/2 -translate-y-1/2 left-3 text-muted-foreground hover:text-foreground transition-colors"
                title="نسخ"
              >
                {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>

            <button
              type="button"
              onClick={handleBackToLogin}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              العودة لتسجيل الدخول
            </button>
          </div>
        )}
      </div>
    </div>
  );
}