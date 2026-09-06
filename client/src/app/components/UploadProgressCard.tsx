import { useState } from 'react';
import { Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp, X } from 'lucide-react';

import { useUploads, dismissUpload } from '../state/uploadProgressStore';
import { Button } from './ui/button';

/** Map a raw upload error to a user-friendly Arabic summary. */
export function mapUploadErrorToArabic(rawError: string): string {
  const error = rawError.trim();

  if (/invalid or disallowed folder\/type/i.test(error)) {
    return 'نوع الملف أو المجلد غير مسموح به على السيرفر';
  }
  if (/filename and contentType required/i.test(error)) {
    return 'بيانات الملف غير مكتملة (الاسم والنوع مطلوبان)';
  }
  if (/S3 upload failed/i.test(error)) {
    return 'فشل رفع الملف إلى وحدة التخزين';
  }
  if (/access denied/i.test(error)) {
    return 'ليس لديك صلاحية رفع هذا الملف';
  }
  if (/network request failed/i.test(error)) {
    return 'تعذر الاتصال بالشبكة، تحقق من اتصال الإنترنت';
  }
  if (/request aborted|AbortError/i.test(error)) {
    return 'تم إلغاء عملية الرفع';
  }
  if (/\b401\b/.test(error)) {
    return 'انتهت صلاحية الجلسة، سجل الدخول مرة أخرى';
  }
  if (/\b403\b/.test(error)) {
    return 'ليس لديك صلاحية رفع هذا الملف';
  }
  if (/\b404\b/.test(error)) {
    return 'تنقّل الرفع غير متاح';
  }
  if (/\b(413|payload too large)/i.test(error)) {
    return 'حجم الملف أكبر من المسموح به';
  }
  if (/\b500\b/.test(error) || /\b502\b/.test(error) || /\b503\b/.test(error)) {
    return 'حدث خطأ مؤقت على السيرفر، حاول مرة أخرى';
  }
  return 'حدث خطأ أثناء الرفع';
}

export function UploadProgressCard() {
  const uploads = useUploads();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  if (uploads.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 flex w-[320px] flex-col gap-2" dir="rtl">
      {uploads.map((upload) => {
        const isExpanded = !!expanded[upload.id];
        const isError = upload.status === 'error';
        const isSuccess = upload.status === 'success';
        const isUploading = upload.status === 'uploading';

        return (
          <div
            key={upload.id}
            className="rounded-xl border bg-card text-card-foreground shadow-lg"
            role="status"
            aria-live="polite"
          >
            <div className="flex flex-col gap-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {isUploading && <Loader2 className="size-4 animate-spin shrink-0 text-primary" />}
                  {isSuccess && <CheckCircle2 className="size-4 shrink-0 text-green-600" />}
                  {isError && <XCircle className="size-4 shrink-0 text-destructive" />}
                  <p className="min-w-0 truncate text-sm font-medium">{upload.fileName}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="-mt-0.5 -mr-1 size-6 shrink-0 text-muted-foreground"
                  onClick={() => dismissUpload(upload.id)}
                  aria-label="إغلاق"
                >
                  <X className="size-3.5" />
                </Button>
              </div>

              {isUploading ? (
                <>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-200"
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    جاري الرفع... {upload.progress}%
                  </p>
                </>
              ) : isSuccess ? (
                <p className="text-sm font-medium text-green-600">تم الرفع بنجاح</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-destructive">
                    {upload.error ? mapUploadErrorToArabic(upload.error) : 'لم يتم الرفع بنجاح'}
                  </p>
                  {upload.error && (
                    <div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ms-2 -mt-1 h-7 gap-1 px-2 text-xs text-muted-foreground"
                        onClick={() =>
                          setExpanded((prev) => ({ ...prev, [upload.id]: !isExpanded }))
                        }
                      >
                        {isExpanded ? (
                          <ChevronUp className="size-3.5" />
                        ) : (
                          <ChevronDown className="size-3.5" />
                        )}
                        {isExpanded ? 'إخفاء التفاصيل' : 'أظهر المزيد'}
                      </Button>
                      {isExpanded && (
                        <p
                          dir="ltr"
                          className="mt-1 max-h-40 overflow-y-auto rounded-md border bg-muted/50 p-2 text-left break-all font-mono text-xs text-muted-foreground"
                        >
                          {upload.error}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default UploadProgressCard;