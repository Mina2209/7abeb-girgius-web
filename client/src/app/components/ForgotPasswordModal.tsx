import { X, Mail } from 'lucide-react';
import { useState } from 'react';
import { ApiError, apiPostJson } from '../services/apiClient';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackToLogin: () => void;
}

interface ResetResponse {
  ok: boolean;
  message?: string;
}

const DEFAULT_SUCCESS_MESSAGE =
  'تم استلام طلبك. إذا كان الحساب موجوداً، فسيتم التواصل معك من قبل المسؤول لإعادة تعيين كلمة المرور.';

const GENERIC_ERROR_MESSAGE = 'تعذر إرسال الطلب. يرجى المحاولة لاحقاً.';

export function ForgotPasswordModal({ isOpen, onClose, onBackToLogin }: ForgotPasswordModalProps) {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

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

      // A resolved request means HTTP 2xx. Never treat an application-level
      // failure as success.
      if (res?.ok) {
        const message =
          typeof res.message === 'string' && res.message.trim()
            ? res.message
            : DEFAULT_SUCCESS_MESSAGE;
        setSuccessMessage(message);
      } else {
        setError(GENERIC_ERROR_MESSAGE);
      }
    } catch (err) {
      // Network failures and non-2xx HTTP responses (ApiError) land here.
      // Keep user-facing validation messages; replace server-side 5xx details
      // with a friendly generic message.
      const message =
        err instanceof ApiError && err.status < 500 && err.message
          ? err.message
          : GENERIC_ERROR_MESSAGE;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setIdentifier('');
    setError('');
    setSuccessMessage('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleBackToLogin = () => {
    resetState();
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

        {!successMessage ? (
          <>
            <p className="text-sm text-muted-foreground text-center mb-6">
              أدخل اسم المستخدم أو البريد الإلكتروني المرتبط بحسابك وسنراجع طلب إعادة التعيين
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
                {loading ? 'جارٍ إرسال الطلب...' : 'استعادة كلمة المرور'}
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
              تم استلام طلبك بنجاح
            </div>

            <p className="text-sm text-muted-foreground text-center">{successMessage}</p>

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
