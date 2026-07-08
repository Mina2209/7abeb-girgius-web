import { 
  Calendar, 
  Target, 
  TrendingUp, 
  Globe, 
  X, 
  CheckCircle2, 
  Heart,
  Star,
  FolderOpen,
  Church,
  Music,
  Presentation,
  Image as ImageIcon,
  MessageSquareQuote,
  PenTool,
  Sparkles,
  Search,
  RefreshCw,
  Monitor,
  AlertTriangle,
  Ban,
  Share2
} from 'lucide-react';
import { cn } from '../utils/cn';

export function AboutSection() {
  return (
    <div className="space-y-16 pb-8">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl p-6 md:p-8 border border-primary/20 overflow-hidden">
        <div className="relative z-10">
          <h1 className="mb-2 font-bold text-2xl md:text-3xl">
            عن خدمة الأرشيدياكون حبيب جرجس للداتا شو
          </h1>
          <p className="text-lg text-muted-foreground">
            بكنيسة السيدة العذراء مريم بالنزهة الجديدة
          </p>
        </div>
        <div className="absolute top-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl"></div>
      </div>

      {/* History & Timeline Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <Calendar className="w-6 h-6 text-primary" />
          </div>
          <h2 className="font-bold text-2xl md:text-3xl">تاريخ وتطور الخدمة</h2>
        </div>

        <div className="bg-card rounded-2xl p-6 md:p-8 border border-border shadow-sm">
          <ul className="space-y-4 mb-6">
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2.5 flex-shrink-0"></div>
              <p className="text-lg leading-relaxed text-foreground/90">
                بدأت خدمة الإرشيدياكون حبيب جرجس للداتا شو عام 2010 بكنيسة السيدة العذراء مريم بالنزهة الجديدة بالقاهرة.
              </p>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2.5 flex-shrink-0"></div>
              <p className="text-lg leading-relaxed text-foreground/90">
                كان هدف الخدمة الأولي بسيطًا وواضحًا، مساعدة الشعب على متابعة الصلاة الليتورجية داخل الكنيسة من خلال عرض الصلوات باستخدام شرائح بوربوينت.
              </p>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2.5 flex-shrink-0"></div>
              <p className="text-lg leading-relaxed text-foreground/90">
                قامت الخدمة منذ بدايتها على مبادئ واضحة أهمها سهولة الاستخدام، والوضوح، والبساطة، والحفاظ على التركيز الكامل في الصلاة دون تشتيت. انعكست هذه المبادئ على تصميم الشرائح باستخدام خط واضح، ألوان متباينة وعدم اضافة صور مع الاهتمام بسهولة الاستخدام أثناء الصلاة وشمولية المحتوى بقدر المستطاع.
              </p>
            </li>
          </ul>

          <div className="space-y-4">
            <div className="bg-primary/5 rounded-xl p-5 border border-primary/20">
              <p className="text-lg md:text-xl leading-relaxed text-center font-bold">
                حيث أننا نؤمن ايمان كامل بأن الهدف من أى ميديا كنسية ليس الابهار أو الاستعراض بل أن تكون أداه تساعد على الصلاة والتسبيح لربنا يسوع المسيح.
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-xl p-5 border border-green-500/20">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                <p className="text-lg leading-relaxed text-foreground/90">
                وبناءً على هذه المبادئ تطورت هذه الشرائح من حيث العدد والمحتوى والتنظيم، حتى أصبحت مكتبة كاملة تُستخدم اليوم في كنائس عديدة داخل مصر وخارجها. يستخدمها الشعب و الاكليروس كهنة وشمامسة على حد سواء.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Purpose Section - Problem/Solution */}
      <section className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <Target className="w-6 h-6 text-primary" />
          </div>
          <h2 className="font-bold text-2xl md:text-3xl">سبب إنشاء المنصة والهدف منها</h2>
        </div>

        <div className="bg-card rounded-2xl p-6 md:p-8 border border-border shadow-sm">
          <p className="text-lg leading-relaxed text-foreground/90 mb-6">
            بدأنا نرى بوضوح كيف يمكن للميديا أن تخدم الكنيسة، وكيف يمكن لاستخدامها الصحيح أن يصنع فرقًا حقيقيًا في جو الصلاة والخدمة. ومع تطور الميديا ووجودها في كل مكان مع ظهور السوشيال ميديا والذكاء الاصطناعي، أصبح للميديا الرقمية دورًا لا غنى عنه داخل الكنيسة والخدمة كأداة مساعدة مهمة للخدمة لمختلف الأعمار.
          </p>

          {/* Problem vs Solution Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Problems */}
            <div className="bg-destructive/5 rounded-xl p-6 border border-destructive/20">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-destructive/10 rounded-lg flex items-center justify-center">
                  <X className="w-5 h-5 text-destructive" />
                </div>
                <h3 className="font-bold text-xl">التحديات والمشاكل</h3>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <X className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                  <span className="text-foreground/80 leading-relaxed">غير متاحة بسهولة لخدام الكنيسة</span>
                </li>
                <li className="flex items-start gap-3">
                  <X className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                  <span className="text-foreground/80 leading-relaxed">متناثرة في أماكن مختلفة وغير منظمة</span>
                </li>
                <li className="flex items-start gap-3">
                  <X className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                  <span className="text-foreground/80 leading-relaxed">يصعب الوصول إليها والبحث فيها</span>
                </li>
                <li className="flex items-start gap-3">
                  <X className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                  <span className="text-foreground/80 leading-relaxed">المحتوى لا يرقى في جودته لما يليق بكنيستنا</span>
                </li>
              </ul>
            </div>

            {/* Solutions */}
            <div className="bg-green-500/5 rounded-xl p-6 border border-green-500/20">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                <h3 className="font-bold text-xl">الحلول التي نقدمها</h3>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-foreground/80 leading-relaxed">مصدر موثوق ومركزي للميديا الكنسية</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-foreground/80 leading-relaxed">محتوى منظم وسهل الوصول إليه</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-foreground/80 leading-relaxed">نظام بحث متقدم وفعّال</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-foreground/80 leading-relaxed">محتوى ذو جودة عالية تليق بالكنيسة</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6 bg-primary/5 rounded-xl p-5 border border-primary/20">
            <p className="text-lg leading-relaxed text-foreground/90">
              <span className="font-bold text-primary">الهدف:</span> تمكين الخدام من الوصول إلى كل ما يحتاجونه بسهولة ومن مصدر موثوق، وتوفير مصدر موثوق ومنظم وسهل الاستخدام للميديا الكنسية.
            </p>
          </div>
        </div>
      </section>

      {/* Our Vision - 3 Principles */}
      <section className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <Heart className="w-6 h-6 text-primary" />
          </div>
          <h2 className="font-bold text-2xl md:text-3xl">رؤيتنا للمنصة والميديا الرقمية</h2>
        </div>

        {/* Bible Verse Quote */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl p-6 md:p-8 border border-primary/20 shadow-sm">
          <blockquote className="text-xl md:text-2xl leading-relaxed text-center italic font-medium">
            <span className="text-primary">"</span>
            وكل ما عملتم فاعمَلوا من القلب كما للرب لا للناس
            <span className="text-primary">"</span>
          </blockquote>
          <p className="text-center text-muted-foreground mt-3">(كولوسي 3:23)</p>
        </div>

        <p className="text-lg text-center text-muted-foreground mb-8">
          بُنيت هذه المنصة على ثلاث مبادئ أساسية:
        </p>

        {/* 3 Principle Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Principle 1 - Spiritual Focus */}
<div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-2xl p-6 md:p-8 border border-purple-500/20 shadow-sm hover:shadow-lg transition-all hover:scale-105">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                <Target className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="inline-block bg-purple-500/20 text-purple-700 dark:text-purple-300 px-4 py-1 rounded-full text-sm font-medium mb-3">
                المبدأ الأول
              </div>
              <h3 className="font-bold text-xl mb-3">التركيز على الهدف الروحي</h3>
              <p className="text-sm text-muted-foreground mb-1">وليس الشو أو التباهي</p>
            </div>
            <p className="text-foreground/80 leading-relaxed">
              هدف الميديا في الكنيسة لم يكن يومًا ولا يجب أن يكون الإبهار أو الظهور أو استعراض المهارات والقدرات. ولا تكون في حد ذاتها هدف أو غاية من جهة الإخراج أو التنفيذ. بل يكون التركيز على شخص ربنا يسوع المسيح وتعاليمه ووصاياه. وتكون بوقار يليق ببيت الله فتكون وسيلة في مكانها الصحيح كخادم للصلاة.
            </p>
          </div>

          {/* Principle 2 - Quality */}
<div className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 rounded-2xl p-6 md:p-8 border border-yellow-500/20 shadow-sm hover:shadow-lg transition-all hover:scale-105">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-yellow-500/20 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                <Star className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="inline-block bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 px-4 py-1 rounded-full text-sm font-medium mb-3">
                المبدأ الثاني
              </div>
              <h3 className="font-bold text-xl mb-3">الجودة</h3>
              <p className="text-sm text-muted-foreground mb-1">الإتقان والأمانة في الخدمة</p>
            </div>
            <p className="text-foreground/80 leading-relaxed">
              كل ما يُقدَّم في الخدمة يجب أن يُقدَّم بإتقان وأمانة؛ وهذا يمتد إلى الميديا الكنسية حيث يجب أن تكون مصنوعة ومصممة بإتقان، وبأفضل صورة ممكنة تليق بإلهنا وببيته المقدس.
            </p>
          </div>

          {/* Principle 3 - Organization */}
<div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-2xl p-6 md:p-8 border border-green-500/20 shadow-sm hover:shadow-lg transition-all hover:scale-105">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                <FolderOpen className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <div className="inline-block bg-green-500/20 text-green-700 dark:text-green-300 px-4 py-1 rounded-full text-sm font-medium mb-3">
                المبدأ الثالث
              </div>
              <h3 className="font-bold text-xl mb-3">التنظيم وسهولة الاستخدام</h3>
              <p className="text-sm text-muted-foreground mb-1">في خدمة جميع الخدام</p>
            </div>
            <p className="text-foreground/80 leading-relaxed">
              ليس كل الخدام عندهم موهبة صناعة المحتوى، وهكذا من أولويات المنصة سهولة الوصول للمحتوى المطلوب. وسهولة استخدامه.
            </p>
          </div>
        </div>
      </section>

      {/* What We Offer */}
      <section className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <h2 className="font-bold text-2xl md:text-3xl">ماذا نقدم</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Service 1 - Liturgy PowerPoints */}
          <div className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-lg hover:border-primary/50 transition-all group">
            <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Church className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-bold text-lg mb-3">بوربوينت الليتورجية</h3>
            <p className="text-foreground/80 leading-relaxed">
              مكتبة شرائح بوربوينت الليتورجية الكاملة، المعروفة والمستخدمة على نطاق واسع، تشمل صلوات القداس والطقوس الكنسية.
            </p>
          </div>

          {/* Service 2 - Hymns */}
          <div className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-lg hover:border-primary/50 transition-all group">
            <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Music className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-bold text-lg mb-3">ترانيم للعرض</h3>
            <p className="text-foreground/80 leading-relaxed">
              ترانيم مُعدّة للعرض، تشمل بوربوينت كلمات مع صور والموسيقى والفيديو منظمة حسب الموضوع، مناسبة للترنيم في مدارس الأحد والاجتماعات.
            </p>
          </div>

          {/* Service 3 - Various PowerPoints */}
          <div className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-lg hover:border-primary/50 transition-all group">
            <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Presentation className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-bold text-lg mb-3">عروض متنوعة</h3>
            <p className="text-foreground/80 leading-relaxed">
              مكتبة عروض بوربوينت متنوعة منها بعض الصلوات الليتورجية بالصور، تأملات من صلوات القديسين وعروض أخرى.
            </p>
          </div>

          {/* Service 4 - Images */}
          <div className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-lg hover:border-primary/50 transition-all group">
            <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <ImageIcon className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-bold text-lg mb-3">مكتبة الصور</h3>
            <p className="text-foreground/80 leading-relaxed">
              مكتبة صور مسيحية وقبطية عالية الجودة، للاستخدام في الخدمة، مُنظَّمة حسب الموضوع، ونوع الصورة والمصدر.
            </p>
          </div>

          {/* Service 5 - Sayings */}
          <div className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-lg hover:border-primary/50 transition-all group">
            <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <MessageSquareQuote className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-bold text-lg mb-3">أقوال الآباء</h3>
            <p className="text-foreground/80 leading-relaxed">
              مكتبة أقوال الآباء منقاة منظمة حس الموضوع، والقائل والمصدر، مراجَعة بعناية قبل نشرها.
            </p>
          </div>

          {/* Service 6 - Coptic */}
          <div className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-lg hover:border-primary/50 transition-all group">
            <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <PenTool className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-bold text-lg mb-3">كتابة القبطي</h3>
            <p className="text-foreground/80 leading-relaxed">
              صفحة مخصصة لكتابة القبطي رقميًا، تشمل شرح التقنيات المتاحة مع توفير وتجميع الأدوات المطلوبة لذلك.
            </p>
          </div>
        </div>

        <div className="bg-muted/50 rounded-xl p-5 border border-border">
          <p className="text-center text-foreground/80 leading-relaxed">
            <span className="font-semibold">جميع مواد المكتبات</span> مصنّفة ومنظمة حسب الموضوع، قابلة للبحث، ومراجَعة بعناية قبل نشرها.
          </p>
        </div>
      </section>

      {/* Platform Features */}
      <section className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <h2 className="font-bold text-2xl md:text-3xl">مميزات المنصة</h2>
        </div>

        <div className="bg-gradient-to-br from-primary/5 via-primary/3 to-transparent rounded-2xl p-6 md:p-8 border border-primary/20 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">نظام المفضلة</h3>
                <p className="text-foreground/80 leading-relaxed">
                  إمكانية إضافة المحتوى للمفضلة لسهولة الوصول إليه لاحقًا والرجوع إليه بسرعة
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Search className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">بحث متقم</h3>
                <p className="text-foreground/80 leading-relaxed">
                  نظام بحث متقدم حسب الموضوع والمصدر والنوع مع فلاتر متعددة
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">تحديثات دورية</h3>
                <p className="text-foreground/80 leading-relaxed">
                  تحديثات دورية ومحتوى جديد باستمرار لإثراء المكتبة
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Monitor className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">تصميم متجاوب</h3>
                <p className="text-foreground/80 leading-relaxed">
                  واجهة سهلة الاستخدام على جميع الأجهزة (كمبيوتر، تابلت، موبايل)
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Important Notice */}
      <section className="space-y-6">
        <div className="bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent rounded-2xl p-6 md:p-8 border-2 border-destructive/30 shadow-lg">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-destructive/20 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <h2 className="font-bold text-2xl text-destructive">تنبيه هام</h2>
          </div>

          <div className="space-y-6">
            {/* Commercial Use Warning */}
            <div className="bg-card/50 rounded-xl p-6 border border-destructive/20">
              <div className="flex items-start gap-4 mb-4">
                <Ban className="w-6 h-6 text-destructive flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-lg mb-3">ممنوع الاستخدام التجاري</h3>
                  <p className="text-foreground/90 leading-relaxed mb-4">
                    ممنوع منعًا باتًا استخدام المحتوى المتاح على المنصة بشكل تجاري أو هادف للربح.
                  </p>
                  <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                    <p className="text-center text-lg italic font-medium">
                      <span className="text-primary">"</span>
                      مجانًا أخذتم مجانًا أعطوا
                      <span className="text-primary">"</span>
                    </p>
                    <p className="text-center text-sm text-muted-foreground mt-2">(متى 10:8)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sharing Guidelines */}
            <div className="bg-card/50 rounded-xl p-6 border border-destructive/20">
              <div className="flex items-start gap-4">
                <Share2 className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-lg mb-3">إرشادات المشاركة</h3>
                  <p className="text-foreground/90 leading-relaxed mb-3">
                    نرجو عدم إعادة رفع الملفات في أماكن أخرى أو على منصات التواصل الاجتماعي.
                  </p>
                  <p className="text-foreground/90 leading-relaxed">
                    إننا غير مسؤولين عن أي ملفات تحمل اسم الخدمة يتم تحميلها من مصدر آخر.
                  </p>
                  <div className="bg-green-500/5 rounded-lg p-4 border border-green-500/20 mt-4">
                    <p className="text-foreground/90 leading-relaxed flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span><span className="font-semibold">الرجاء:</span> مشاركة رابط المنصة مباشرة لنشر محتواها</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Footer */}
      <section className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl p-6 md:p-8 border border-primary/20">
        <div className="text-center">
          <h3 className="font-bold text-xl mb-3">نحن هنا لخدمتكم</h3>
          <p className="text-muted-foreground leading-relaxed mb-4">
            إذا كان لديكم أي استفسارات أو اقتراحات، نسعد بالتواصل معكم
          </p>
          <div className="inline-flex items-center gap-2 text-primary">
            <Church className="w-5 h-5" />
            <span className="font-medium">خدمة الأرشيدياكون حبيب جرجس للداتا شو</span>
          </div>
        </div>
      </section>
    </div>
  );
}