import { CheckCheck, Edit2, Trash2 } from 'lucide-react';

interface BulkActionsBarProps {
  isEditor: boolean;
  bulkEditMode: boolean;
  selectedCount: number;
  filteredCount: number;
  onSelectAll: () => void;
  onOpenBulkEdit: () => void;
  onBulkDelete: () => void;
}

export function BulkActionsBar({
  isEditor,
  bulkEditMode,
  selectedCount,
  filteredCount,
  onSelectAll,
  onOpenBulkEdit,
  onBulkDelete,
}: BulkActionsBarProps) {
  if (!isEditor || !bulkEditMode || selectedCount <= 0) return null;

  return (
    <div className="mt-4 p-3 bg-primary/10 border border-primary rounded-xl flex items-center justify-between flex-wrap gap-2">
      <span className="text-sm font-medium">{selectedCount} عنصر محدد</span>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onSelectAll}
          className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-muted transition-opacity text-sm"
        >
          <CheckCheck className="w-4 h-4" />
          {selectedCount === filteredCount ? 'إلغاء الكل' : 'تحديد الكل'}
        </button>
        <button
          onClick={onOpenBulkEdit}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-opacity text-sm"
        >
          <Edit2 className="w-4 h-4" />
          تعديل المحدد
        </button>
        <button
          onClick={onBulkDelete}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-opacity text-sm"
        >
          <Trash2 className="w-4 h-4" />
          حذف المحدد
        </button>
      </div>
    </div>
  );
}

