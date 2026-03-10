import { EyeOff, AlertTriangle } from 'lucide-react';

export function HiddenSectionBanner() {
  return (
    <div className="bg-orange-500/10 border-2 border-orange-500/30 rounded-lg p-4 mb-6" dir="rtl">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
          <EyeOff className="w-5 h-5 text-orange-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
            <h3 className="font-semibold text-orange-900 dark:text-orange-200">
              هذا القسم مخفي عن الزوار
            </h3>
          </div>
          <p className="text-sm text-orange-800 dark:text-orange-300">
            يمكن للمحررين والمشرفين فقط رؤية هذا القسم والعمل عليه. الزوار لا يستطيعون الوصول إليه حالياً.
          </p>
        </div>
      </div>
    </div>
  );
}
