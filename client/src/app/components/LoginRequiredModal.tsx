import { X, Heart, LogIn, User, Sparkles } from 'lucide-react';

interface LoginRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginClick: () => void;
}

export function LoginRequiredModal({ isOpen, onClose, onLoginClick }: LoginRequiredModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-card rounded-xl shadow-2xl max-w-md w-full p-6 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Heart className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">تسجيل الدخول مطلوب</h2>
              <p className="text-sm text-muted-foreground">للوصول إلى ميزة المفضلات</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-center text-muted-foreground">
              يجب عليك تسجيل الدخول أولاً لحفظ العناصر في قائمة المفضلات الخاصة بك
            </p>
          </div>

          {/* Features List */}
          <div>
            <h3 className="font-semibold mb-3 text-foreground">مميزات التسجيل:</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <Heart className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-foreground/90">حفظ المحتوى المفضل لك</span>
              </li>
              <li className="flex items-start gap-3">
                <User className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm text-foreground/90">الوصول لمحتواك من أي جهاز</span>
              </li>
              <li className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm text-foreground/90">تجربة مخصصة حسب اهتماماتك</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={onLoginClick}
            className="flex-1 px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <LogIn className="w-5 h-5" />
            تسجيل الدخول
          </button>
        </div>
      </div>
    </div>
  );
}