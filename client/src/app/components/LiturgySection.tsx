import { Download, Info, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

export function LiturgySection() {
  const downloadLink = "https://www.mediafire.com/file/wpbqlo0imtdzct7/St.Mary_Elnozha_Liturgy_Powerpoint_Widescreen_December2025.rar/file";

  return (
    <div className="space-y-8 max-w-5xl mx-auto p-4 md:p-6 lg:p-8 animate-fade-in">
      {/* Header Section */}
      <div className="border-b border-border pb-6">
        <h1 className="mb-2 font-bold text-2xl sm:text-3xl lg:text-[36px] text-foreground tracking-tight">بوربوينت الليتورجية</h1>
        <p className="text-muted-foreground text-lg">
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
              آخر تحديث: ديسمبر 2025
            </p>
          </div>
          <Button 
            size="lg"
            className="w-full sm:w-auto gap-3 text-xl font-bold shadow-lg px-8 py-6 rounded-xl hover:scale-105 transition-transform cursor-pointer"
            onClick={() => window.open(downloadLink, '_blank')}
          >
            <Download className="w-7 h-7" />
            إضغط للتنزيل
          </Button>
        </CardContent>
      </Card>

      {/* Release Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <RefreshCw className="w-5 h-5 text-primary" />
            تحديثات نسخة ديسمبر 2025:
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              "إضافة ابصاليات بعض القديسين لتسبحة نصف الليل (عربى فقط).",
              "إضافة تسبحة نصف الليل لبرمون عيد الميلاد",
              "إضافة ابصالية برمون عيد الغطاس لإبصاليات الأعياد",
              "إضافة طقس رسامة الابصلتس والأغنسطس والدياكون",
              "إضافة قراءات الأحد الثالث من شهر توت لطقس عيد الصليب",
              "تغير حجم شرائح العهد القديم لـ16:9 widescreen",
              "العديد من التصليحات اللغوية والطقسية."
            ].map((update, index) => (
              <li key={index} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{update}</span>
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
    </div>
  );
}