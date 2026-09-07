import { SearchX, Home } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export function NotFoundPage() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-l px-2">
        <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center">
          <SearchX className="w-12 h-12 text-primary" />
        </div>
        <p className="text-7xl font-black text-primary/20 mb-4" dir="ltr">
          404
        </p>
        <h2 className="text-2xl md:text-3xl font-bold mb-3">الصفحة غير موجودة</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          عذرًا، الصفحة أو الرابط الذي حاولت الوصول إليه غير موجود على المنصة.
        </p>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
        >
          <Home className="w-4 h-4" />
          العودة للرئيسية
        </button>
      </div>
    </div>
  );
}