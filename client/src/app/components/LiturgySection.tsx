import { Download, Info, RefreshCw, AlertTriangle, CheckCircle, Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { apiGetJson } from '../services/apiClient';
import { getImageUrl } from '../utils/getImageUrl';
import { useIsAdmin } from '../utils/adminUtils';
import { LiturgyEditModal, type LiturgyData, type LiturgyReleaseItem } from './LiturgyEditModal';
import { toast } from 'sonner';

const DEFAULT_LITURGY: LiturgyData = {
  version: 'ديسمبر 2025',
  last_updated: 'ديسمبر 2025',
  download_link:
    'https://www.mediafire.com/file/wpbqlo0imtdzct7/St.Mary_Elnozha_Liturgy_Powerpoint_Widescreen_December2025.rar/file',
  release_notes: [
    { text: 'إضافة ابصاليات بعض القديسين لتسبحة نصف الليل (عربى فقط).', images: [] },
    { text: 'إضافة تسبحة نصف الليل لبرمون عيد الميلاد', images: [] },
    { text: 'إضافة ابصالية برمون عيد الغطاس لإبصاليات الأعياد', images: [] },
    { text: 'إضافة طقس رسامة الابصلتس والأغنسطس والدياكون', images: [] },
    { text: 'إضافة قراءات الأحد الثالث من شهر توت لطقس عيد الصليب', images: [] },
    { text: 'تغير حجم شرائح العهد القديم لـ16:9 widescreen', images: [] },
    { text: 'العديد من التصليحات اللغوية والطقسية.', images: [] },
  ],
};

function normalizeReleaseNotes(notes: unknown): LiturgyReleaseItem[] {
  if (!Array.isArray(notes)) return DEFAULT_LITURGY.release_notes;
  const normalized = notes.map((note) =>
    typeof note === 'string'
      ? { text: note, images: [] }
      : {
          text: typeof (note as any)?.text === 'string' ? (note as any).text : '',
          images: Array.isArray((note as any)?.images) ? (note as any).images : [],
        }
  );
  return normalized.filter((note) => note.text || note.images.length > 0).length
    ? normalized
    : DEFAULT_LITURGY.release_notes;
}

export function LiturgySection() {
  const isAdmin = useIsAdmin();
  const [data, setData] = useState<LiturgyData>(DEFAULT_LITURGY);
  const [dataReady, setDataReady] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiGetJson<{ settings?: { liturgy_data?: LiturgyData } }>(
          '/api/auth/settings/liturgy'
        );
        const saved = res?.settings?.liturgy_data;
        if (mounted && saved && typeof saved === 'object') {
          setData({
            version:
              typeof saved.version === 'string' ? saved.version : DEFAULT_LITURGY.version,
            last_updated:
              typeof saved.last_updated === 'string'
                ? saved.last_updated
                : DEFAULT_LITURGY.last_updated,
            download_link:
              typeof saved.download_link === 'string'
                ? saved.download_link
                : DEFAULT_LITURGY.download_link,
            release_notes: normalizeReleaseNotes(saved.release_notes),
          });
        }
      } catch {
        toast.error('فشل تحميل بيانات صفحة الليتورجية');
      } finally {
        if (mounted) setDataReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-8 max-w-5xl mx-auto p-4 md:p-6 lg:p-8 animate-fade-in">
      {/* Header Section */}
      <div className="border-b border-border pb-6">
        <h1 className="mb-2 font-bold text-2xl sm:text-3xl lg:text-[36px] text-foreground tracking-tight">بوربوينت الليتورجية</h1>
        <p className="text-muted-foreground" style={{ fontSize: "1.09rem" }}>
          عروض تقديمية شاملة للطقوس والقداسات الكنسية
        </p>
      </div>

      {/* About Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <Info className="w-5 h-5 text-primary" />
            عن الخدمة ومحتوى الملفات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-card-foreground leading-relaxed">
          <p className="text-justify">
            خدمة الأرشيدياكون حبيب جرجس للداتا شو هى خدمة هدفها تقديم صلوات الكنيسة الليتورجية فى شكل عروض تقديمية (Powerpoint) تعمل على أجهزة البروجيكتور حتى نسهل على شعب الكنيسة متابعة الصلوات والمشاركة فيها.
          </p>
          <p className="text-justify">
            من خلال هذه الصفحة نشارككم ثمار تلك الخدمة حيث يمكنكم الآن تنزيل جميع هذه العروض فى شكل ملف مضغوط صغير الحجم وذلك لتستفيد منها جميع الكنائس.
          </p>
        </CardContent>
      </Card>

      {/* Main Action Download Box */}
      <Card className="border-primary/30 bg-gradient-to-l from-primary/5 via-transparent to-transparent shadow-md">
        <CardContent className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-right w-full sm:w-auto">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h3 className="font-bold text-2xl tracking-tight">تنزيل الإصدار الكامل</h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-400 animate-pulse">
                نسخة مستقرة
              </span>
            </div>
            <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1">
              <RefreshCw className="w-3.5 h-3.5 inline" />
              آخر تحديث: {data.last_updated}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsEditOpen(true)}
                  className="text-primary hover:text-primary/80 transition-colors p-0.5 ms-1"
                  title="تعديل"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="w-full sm:w-auto gap-3 text-xl font-bold shadow-lg px-8 py-6 rounded-xl hover:scale-105 transition-transform cursor-pointer"
          >
            <a href="/api/liturgy/download" target="_blank" rel="noopener noreferrer">
              <Download className="w-7 h-7" />
              إضغط للتنزيل
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Release Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <RefreshCw className="w-5 h-5 text-primary" />
            تحديثات نسخة {data.version}:
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsEditOpen(true)}
                className="text-primary hover:text-primary/80 transition-colors p-1 ms-1"
                title="تعديل التحديثات"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.release_notes.map((update, index) => (
              <li key={index} className="flex flex-col gap-2 text-sm text-muted-foreground">
                {update.text && (
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{update.text}</span>
                  </div>
                )}
                {update.images.length > 0 && (
                  <div className={`grid grid-cols-2 gap-2 ${update.text ? 'mt-1' : ''}`}>
                    {update.images.map((src, imgIndex) => (
                      <a
                        key={imgIndex}
                        href={getImageUrl(src)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg overflow-hidden border border-border block group"
                        title="اضغط للتكبير"
                      >
                        <img
                          src={getImageUrl(src)}
                          alt={`صورة ${index + 1}`}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-32 object-cover transition-transform group-hover:scale-105"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Critical Re-upload Warning */}
      <Alert className="border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400">
        <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0" />
        <div className="w-full">
          <AlertTitle className="font-bold text-base text-amber-500 dark:text-amber-400 mb-1">
            تنويه وتنبيه هام جداً
          </AlertTitle>
          <AlertDescription className="text-sm leading-relaxed text-amber-700 dark:text-amber-300 font-medium">
            نرجو عدم إعادة رفع الملفات على صفحات أخرى حيث أننا غير مسؤولين عن أي نسخة يتم تحميلها من مصدر أخر بل نرجو مشاركة رابط صفحتنا لتحميل الملفات المحدثة لضمان سلامة المحتوى الطقسي واللغوي. الرب يكمل هذا العمل و يستثمره لأجل مجد اسمه فى كل مكان.
          </AlertDescription>
        </div>
      </Alert>

      <LiturgyEditModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        data={dataReady ? data : DEFAULT_LITURGY}
        onSaved={(saved) => setData(saved)}
      />
    </div>
  );
}