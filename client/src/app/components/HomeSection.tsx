import { 
  Presentation, 
  Music, 
  Images, 
  MessageSquareQuote, 
  PenTool, 
  FileText,
  Church,
  Heart,
  Star,
  Target,
  Search,
  RefreshCw,
  Monitor,
  ArrowRight,
  Sparkles,
  TrendingUp,
  FolderOpen,
  CheckCircle2,
  Download
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function HomeSection() {
  const navigate = useNavigate();

  return (
    <div className="space-y-16 pb-8">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-3xl p-8 md:p-12 lg:p-16 border border-primary/20 overflow-hidden">
        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <h1 className="mb-4 font-bold text-3xl md:text-4xl lg:text-5xl">
            خدمة الأرشيدياكون حبيب جرجس للداتا شو
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-2">
            بكنيسة السيدة العذراء مريم بالنزهة الجديدة
          </p>
          <p className="text-lg md:text-xl text-primary/80 mb-8 font-medium">
            مصدر موثوق للميديا الكنسية القبطية الأرثوذكسية
          </p>
          <button
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-xl font-semibold text-lg transition-all hover:scale-105 shadow-lg hover:shadow-xl inline-flex items-center gap-2"
            onClick={() => navigate('/liturgy')}
          >
            <span>استكشف المنصة</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
        <div className="absolute top-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
      </div>

      {/* Quick Stats Section */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-2xl p-6 border border-blue-500/20 text-center hover:scale-105 transition-transform">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Presentation className="w-6 h-6 text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">500+</div>
            <div className="text-sm text-muted-foreground">ملف باوربوينت</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-2xl p-6 border border-purple-500/20 text-center hover:scale-105 transition-transform">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Music className="w-6 h-6 text-purple-500" />
            </div>
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">300+</div>
            <div className="text-sm text-muted-foreground">ترنيمة</div>
          </div>

          <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-2xl p-6 border border-green-500/20 text-center hover:scale-105 transition-transform">
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Images className="w-6 h-6 text-green-500" />
            </div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">1000+</div>
            <div className="text-sm text-muted-foreground">صورة</div>
          </div>

          <div className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 rounded-2xl p-6 border border-orange-500/20 text-center hover:scale-105 transition-transform">
            <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <MessageSquareQuote className="w-6 h-6 text-orange-500" />
            </div>
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-1">200+</div>
            <div className="text-sm text-muted-foreground">قول للآباء</div>
          </div>
        </div>
      </section>

      {/* Featured Services Grid */}
      <section className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="font-bold text-2xl md:text-3xl mb-3">خدماتنا</h2>
          <p className="text-lg text-muted-foreground">اختر ما تحتاجه من مكتباتنا المتنوعة</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Service 1 - Liturgy PowerPoints */}
          <div
            className="bg-card rounded-2xl p-6 md:p-8 border border-border shadow-sm hover:shadow-xl hover:border-primary/50 transition-all group cursor-pointer"
            onClick={() => navigate('/liturgy')}
          >
            <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Church className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-bold text-xl mb-3">بوربوينت الليتورجية</h3>
            <p className="text-foreground/80 leading-relaxed mb-4">
              مكتبة شرائح بوربوينت الليتورجية الكاملة، المعروفة والمستخدمة على نطاق واسع، تشمل صلوات القداس والطقوس الكنسية.
            </p>
            <div className="flex items-center gap-2 text-primary font-medium group-hover:gap-3 transition-all">
              <span>استكشف المكتبة</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Service 2 - Hymns */}
          <div
            className="bg-card rounded-2xl p-6 md:p-8 border border-border shadow-sm hover:shadow-xl hover:border-primary/50 transition-all group cursor-pointer"
            onClick={() => navigate('/hymns')}
          >
            <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Music className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-bold text-xl mb-3">ترانيم للعرض</h3>
            <p className="text-foreground/80 leading-relaxed mb-4">
              ترانيم مُعدّة للعرض، تشمل بوربوينت كلمات مع صور والموسيقى والفيديو منظمة حسب الموضوع، مناسبة للترنيم في مدارس الأحد والاجتماعات.
            </p>
            <div className="flex items-center gap-2 text-primary font-medium group-hover:gap-3 transition-all">
              <span>استكشف المكتبة</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Service 3 - Various PowerPoints */}
          <div
            className="bg-card rounded-2xl p-6 md:p-8 border border-border shadow-sm hover:shadow-xl hover:border-primary/50 transition-all group cursor-pointer"
            onClick={() => navigate('/various')}
          >
            <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Presentation className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-bold text-xl mb-3">عروض متنوعة</h3>
            <p className="text-foreground/80 leading-relaxed mb-4">
              مكتبة عروض بوربوينت متنوعة منها بعض الصلوات الليتورجية بالصور، تأملات من صلوات القديسين وعروض أخرى.
            </p>
            <div className="flex items-center gap-2 text-primary font-medium group-hover:gap-3 transition-all">
              <span>استكشف المكتبة</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Service 4 - Images */}
          <div
            className="bg-card rounded-2xl p-6 md:p-8 border border-border shadow-sm hover:shadow-xl hover:border-primary/50 transition-all group cursor-pointer"
            onClick={() => navigate('/images')}
          >
            <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Images className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-bold text-xl mb-3">مكتبة الصور</h3>
            <p className="text-foreground/80 leading-relaxed mb-4">
              مكتبة صور مسيحية وقبطية عالية الجودة، للاستخدام في الخدمة، مُنظَّمة حسب الموضوع، ونوع الصورة والمصدر.
            </p>
            <div className="flex items-center gap-2 text-primary font-medium group-hover:gap-3 transition-all">
              <span>استكشف المكتبة</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Service 5 - Sayings */}
          <div
            className="bg-card rounded-2xl p-6 md:p-8 border border-border shadow-sm hover:shadow-xl hover:border-primary/50 transition-all group cursor-pointer"
            onClick={() => navigate('/sayings')}
          >
            <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <MessageSquareQuote className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-bold text-xl mb-3">أقوال الآباء</h3>
            <p className="text-foreground/80 leading-relaxed mb-4">
              مكتبة أقوال الآباء منقاة منظمة حسب الموضوع، والقائل والمصدر، مراجَعة بعناية قبل نشرها.
            </p>
            <div className="flex items-center gap-2 text-primary font-medium group-hover:gap-3 transition-all">
              <span>استكشف المكتبة</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Service 6 - Coptic */}
          <div
            className="bg-card rounded-2xl p-6 md:p-8 border border-border shadow-sm hover:shadow-xl hover:border-primary/50 transition-all group cursor-pointer"
            onClick={() => navigate('/coptic')}
          >
            <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <PenTool className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-bold text-xl mb-3">كتابة القبطي</h3>
            <p className="text-foreground/80 leading-relaxed mb-4">
              صفحة مخصصة لكتابة القبطي رقميًا، تشمل شرح التقنيات المتاحة مع توفير وتجميع الأدوات المطلوبة لذلك.
            </p>
            <div className="flex items-center gap-2 text-primary font-medium group-hover:gap-3 transition-all">
              <span>استكشف المكتبة</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </section>

      {/* Vision Statement Box */}
      <section>
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl p-8 md:p-12 border border-primary/20 shadow-sm">
          <blockquote className="text-xl md:text-2xl lg:text-3xl leading-relaxed text-center font-bold mb-4">
            <span className="text-primary text-4xl">"</span>
            وكل ما عملتم فاعَملوا من القلب كما للرب لا للناس
            <span className="text-primary text-4xl">"</span>
          </blockquote>
          <p className="text-center text-lg text-muted-foreground">(كولوسي 3:23)</p>
        </div>
      </section>

      {/* Platform Features */}
      <section className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="font-bold text-2xl md:text-3xl mb-3">مميزات المنصة</h2>
          <p className="text-lg text-muted-foreground">أدوات تساعدك على الوصول للمحتوى بسهولة</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-primary/5 via-primary/3 to-transparent rounded-2xl p-6 border border-primary/20 text-center hover:scale-105 transition-transform">
            <div className="w-14 h-14 bg-primary/20 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Heart className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-bold text-lg mb-2">نظام المفضلة</h3>
            <p className="text-sm text-foreground/80 leading-relaxed">
              احفظ المحتوى المفضل لديك للوصول إليه بسرعة
            </p>
          </div>

          <div className="bg-gradient-to-br from-primary/5 via-primary/3 to-transparent rounded-2xl p-6 border border-primary/20 text-center hover:scale-105 transition-transform">
            <div className="w-14 h-14 bg-primary/20 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Search className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-bold text-lg mb-2">بحث متقدم</h3>
            <p className="text-sm text-foreground/80 leading-relaxed">
              ابحث بسهولة حسب الموضوع والمصدر والنوع
            </p>
          </div>

          <div className="bg-gradient-to-br from-primary/5 via-primary/3 to-transparent rounded-2xl p-6 border border-primary/20 text-center hover:scale-105 transition-transform">
            <div className="w-14 h-14 bg-primary/20 rounded-xl flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-bold text-lg mb-2">تحديثات دورية</h3>
            <p className="text-sm text-foreground/80 leading-relaxed">
              محتوى جديد يُضاف باستمرار لإثراء المكتبة
            </p>
          </div>

          <div className="bg-gradient-to-br from-primary/5 via-primary/3 to-transparent rounded-2xl p-6 border border-primary/20 text-center hover:scale-105 transition-transform">
            <div className="w-14 h-14 bg-primary/20 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Monitor className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-bold text-lg mb-2">تصميم متجاوب</h3>
            <p className="text-sm text-foreground/80 leading-relaxed">
              يعمل على جميع الأجهزة بسلاسة
            </p>
          </div>
        </div>
      </section>

      {/* How to Get Started */}
      <section className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="font-bold text-2xl md:text-3xl mb-3">كيف تبدأ؟</h2>
          <p className="text-lg text-muted-foreground">ثلاث خطوات بسيطة للاستفادة من المنصة</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="relative bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-2xl p-8 border border-blue-500/20 text-center hover:scale-105 transition-transform">
            <div className="absolute -top-4 right-1/2 transform translate-x-1/2 w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
              1
            </div>
            <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 mt-2">
              <FolderOpen className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="font-bold text-xl mb-3">تصفح المكتبات</h3>
            <p className="text-foreground/80 leading-relaxed">
              استكشف مكتباتنا الستة واختر ما يناسب خدمتك
            </p>
          </div>

          {/* Step 2 */}
          <div className="relative bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-2xl p-8 border border-purple-500/20 text-center hover:scale-105 transition-transform">
            <div className="absolute -top-4 right-1/2 transform translate-x-1/2 w-10 h-10 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
              2
            </div>
            <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 mt-2">
              <Search className="w-8 h-8 text-purple-500" />
            </div>
            <h3 className="font-bold text-xl mb-3">ابحث عن المحتوى</h3>
            <p className="text-foreground/80 leading-relaxed">
              استخدم البحث والفلاتر للوصول للمحتوى المطلوب
            </p>
          </div>

          {/* Step 3 */}
          <div className="relative bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-2xl p-8 border border-green-500/20 text-center hover:scale-105 transition-transform">
            <div className="absolute -top-4 right-1/2 transform translate-x-1/2 w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
              3
            </div>
            <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 mt-2">
              <Download className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="font-bold text-xl mb-3">حمّل واستخدم</h3>
            <p className="text-foreground/80 leading-relaxed">
              قم بتحميل المحتوى واستخدمه في خدمتك
            </p>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl p-8 md:p-12 border border-primary/20">
        <div className="text-center max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Church className="w-8 h-8 text-primary" />
          </div>
          <h3 className="font-bold text-2xl md:text-3xl mb-4">ابدأ الآن في استكشاف المنصة</h3>
          <p className="text-lg text-muted-foreground leading-relaxed mb-6">
            جميع المحتوى متاح مجانًا لخدمة الكنيسة. ابدأ باستكشاف المكتبات واختر ما يناسب احتياجاتك
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-xl font-semibold text-lg transition-all hover:scale-105 shadow-lg inline-flex items-center justify-center gap-2"
              onClick={() => navigate('/liturgy')}
            >
              <span>تصفح المكتبات</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              className="border-2 border-primary text-primary hover:bg-primary/10 px-8 py-3 rounded-xl font-semibold text-lg transition-all hover:scale-105 inline-flex items-center justify-center gap-2"
              onClick={() => navigate('/about')}
            >
              <span>تعرف على الخدمة</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}