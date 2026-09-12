import { useRef, useEffect } from 'react';
import { 
  Presentation, 
  Music, 
  Images, 
  MessageSquareQuote, 
  PenTool, 
  Church,
  Heart,
  Search,
  RefreshCw,
  Monitor,
  ArrowRight,
  FolderOpen,
  Download,
  BookOpen,
  GraduationCap,
  Mic2,
  Cross,
  Play,
  Video,
  AlertTriangle,
  ShieldAlert,
  Ban,
  Globe,
  BadgeCheck,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logoImg512 from '../../assets/church-logo-512.webp';
import logoImg384 from '../../assets/church-logo-384.webp';
import logoImg256 from '../../assets/church-logo-256.webp';
import logoImg128 from '../../assets/church-logo-128.webp';

const marqueeItems = [
  { icon: Church, title: 'الليتورجية', desc: 'صلوات القداس والطقوس', color: 'from-amber-500/15 to-amber-600/5', iconColor: 'text-amber-600', border: 'border-amber-500/20' },
  { icon: Music, title: 'الترانيم', desc: 'كلمات وألحان مسيحية', color: 'from-rose-500/15 to-rose-600/5', iconColor: 'text-rose-600', border: 'border-rose-500/20' },
  { icon: Presentation, title: 'العروض', desc: 'شرائح متنوعة للعرض', color: 'from-violet-500/15 to-violet-600/5', iconColor: 'text-violet-600', border: 'border-violet-500/20' },
  { icon: Images, title: 'الصور', desc: 'مكتبة صور قبطية عالية الجودة', color: 'from-emerald-500/15 to-emerald-600/5', iconColor: 'text-emerald-600', border: 'border-emerald-500/20' },
  { icon: MessageSquareQuote, title: 'أقوال الآباء', desc: 'حكم وأقوال روحية', color: 'from-sky-500/15 to-sky-600/5', iconColor: 'text-sky-600', border: 'border-sky-500/20' },
  { icon: PenTool, title: 'القبطي', desc: 'كتابة وتعلم اللغة القبطية', color: 'from-orange-500/15 to-orange-600/5', iconColor: 'text-orange-600', border: 'border-orange-500/20' },
  // { icon: BookOpen, title: 'المراجع', desc: 'كتب ومراجع دينية', color: 'from-teal-500/15 to-teal-600/5', iconColor: 'text-teal-600', border: 'border-teal-500/20' },
  // { icon: GraduationCap, title: 'التعليم', desc: 'مواد تعليمية للخدمة', color: 'from-indigo-500/15 to-indigo-600/5', iconColor: 'text-indigo-600', border: 'border-indigo-500/20' },
  // { icon: Mic2, title: 'التسجيلات', desc: 'تسجيلات صوتية للترانيم', color: 'from-pink-500/15 to-pink-600/5', iconColor: 'text-pink-600', border: 'border-pink-500/20' },
  // { icon: Cross, title: 'الرموز', desc: 'رموز مسيحية متنوعة', color: 'from-gray-500/15 to-gray-600/5', iconColor: 'text-gray-600', border: 'border-gray-500/20' },
];

const CARD_WIDTH = 224;
const CARD_GAP = 16;
const CARD_TOTAL = CARD_WIDTH + CARD_GAP;
const SPEED = 40;

function useMarqueeScroll(
  containerRef: React.RefObject<HTMLDivElement | null>,
  innerRef: React.RefObject<HTMLDivElement | null>,
) {
  const offsetRef = useRef(0);
  const isDragging = useRef(false);
  const lastClientX = useRef(0);
  const dragVelocity = useRef(0);
  const lastDragTime = useRef(0);

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

    const setWidth = marqueeItems.length * CARD_TOTAL;
    inner.style.width = `${setWidth * 4}px`;

    let rafId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;

      if (!isDragging.current) {
        const pxPerMs = setWidth / (SPEED * 1000);
        offsetRef.current += dt * pxPerMs;

        if (offsetRef.current >= setWidth) {
          offsetRef.current -= setWidth;
        }
      }

      inner.style.transform = `translate3d(-${offsetRef.current}px, 0, 0)`;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [innerRef]);

  useEffect(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;

    const setWidth = marqueeItems.length * CARD_TOTAL;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      isDragging.current = true;
      lastClientX.current = e.clientX;
      lastDragTime.current = performance.now();
      dragVelocity.current = 0;
      container.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      const now = performance.now();
      const dt = now - lastDragTime.current;
      const deltaX = e.clientX - lastClientX.current;
      lastClientX.current = e.clientX;

      if (dt > 0) {
        dragVelocity.current = deltaX / dt;
      }
      lastDragTime.current = now;

      offsetRef.current -= deltaX;
      if (offsetRef.current < 0) offsetRef.current += setWidth;
      if (offsetRef.current >= setWidth) offsetRef.current -= setWidth;

      inner.style.transform = `translate3d(-${offsetRef.current}px, 0, 0)`;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      container.releasePointerCapture(e.pointerId);
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
    };
  }, [containerRef, innerRef]);
}

export function HomeSection() {
  const navigate = useNavigate();
  const marqueeContainerRef = useRef<HTMLDivElement>(null);
  const marqueeInnerRef = useRef<HTMLDivElement>(null);
  useMarqueeScroll(marqueeContainerRef, marqueeInnerRef);

  const renderCards = (batchId: number) =>
    marqueeItems.map((item, i) => (
      <div
        key={`card-${batchId}-${i}`}
        dir="rtl"
        className={`flex-shrink-0 w-56 bg-gradient-to-br ${item.color} rounded-2xl p-5 border ${item.border} hover:scale-105 hover:shadow-lg transition-all duration-300 cursor-default`}
        style={{ width: CARD_WIDTH }}
      >
        <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 bg-background/60 backdrop-blur-sm">
          <item.icon className={`w-6 h-6 ${item.iconColor}`} />
        </div>
        <h4 className="font-bold text-base mb-1">{item.title}</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
      </div>
    ));

  return (
    <div className="space-y-16 pb-8">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-primary/15 via-primary/5 to-transparent rounded-3xl p-8 md:p-12 lg:p-16 border border-primary/20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_55%)] pointer-events-none"></div>
        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl scale-150"></div>
            <img
              src={logoImg256}
              srcSet={`${logoImg128} 128w, ${logoImg256} 256w, ${logoImg384} 384w, ${logoImg512} 512w`}
              sizes="(min-width: 768px) 144px, 112px"
              width={512}
              height={512}
              alt="شعار خدمة الأرشيدياكون حبيب جرجس"
              loading="eager"
              {...({ fetchpriority: 'high' } as unknown as React.ImgHTMLAttributes<HTMLImageElement>)}
              decoding="async"
              className="relative w-28 h-28 md:w-36 md:h-36 object-contain drop-shadow-xl rounded-full ring-4 ring-primary/25 shadow-lg"
            />
          </div>
          <h1 className="mb-4 font-bold text-3xl md:text-4xl lg:text-5xl leading-tight">
خدمة الأرشيدياكون{" "}            <br className="sm:hidden" />
            حبيب جرجس للداتا شو
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

      {/* About the Platform + Intro Video */}
      <section className="space-y-8 content-visibility-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          <div className="bg-card rounded-2xl p-6 md:p-8 border border-border shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h2 className="font-bold text-2xl md:text-3xl">ما هي المنصة؟</h2>
            </div>
            <p className="text-foreground/80 leading-relaxed mb-3">
              منصة تجمع الميديا الكنسية القبطية الأرثوذكسية في مكانٍ واحد موثوق ومُنظَّم —
              بوربوينت الليتورجية، وترانيم جاهزة للعرض، ومكتبة صور عالية الجودة، وأقوال الآباء.
            </p>
            <p className="text-foreground/80 leading-relaxed mb-6">
              هدفنا خدمة الكنيسة: أتاحة المحتوى مجانًا بأعلى جودة، منسَّقًا ومصنَّفًا حتى تصل
              للملف المناسب في ثوانٍ، وتُقدَّم الخدمة دون عناء تجميعها من أماكن متفرقة.
            </p>

            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-primary" />
              ما الذي يميّز هذه المنصة؟
            </h3>
            <ul className="space-y-3">
              {[
                'محتوى مُراجَع بعناية قبل نشره',
                'مُصنَّف حسب الموضوع والنوع والمصدر مع بحث وفلاتر ذكية',
                'جودة عالية جاهزة للعرض مباشرة من بيانات موثوقة',
                'متاح مجانًا بالكامل لخدمة الكنيسة',
                'تحديث مستمر وإضافة محتوى جديد باستمرار',
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                  <span className="text-foreground/80 leading-relaxed">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gradient-to-br from-primary/5 via-primary/3 to-transparent rounded-2xl border border-dashed border-primary/40 overflow-hidden flex flex-col">
            <div className="relative flex-1 aspect-video">
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 text-center">
                <div className="w-20 h-20 bg-primary/10 border border-primary/30 rounded-full flex items-center justify-center">
                  <Video className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-2xl mb-2">فيديو تعريفي بالمنصة</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    جولة سريعة على المكتبات والمميزات
                    <br />
                    وإجابة عن: كيف أستخدم المحتوى في خدمتي؟
                  </p>
                </div>
                <span className="px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-semibold border border-primary/30">
                  قريبًا
                </span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

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
      <section className="space-y-6 content-visibility-auto">
        <div className="text-center mb-8">
          <h2 className="font-bold text-2xl md:text-3xl mb-3">أقسام المنصة</h2>
          <p className="text-lg text-muted-foreground">اِبدأ بإستكشاف ما تحتاجه من مكتباتنا المتنوعة</p>
        </div>

        <div className="flex flex-wrap justify-center gap-6">
          <div
            className="w-full md:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)] bg-card rounded-2xl p-6 md:p-8 border border-border shadow-sm hover:shadow-xl hover:border-primary/50 transition-all group cursor-pointer"
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

          <div
            className="w-full md:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)] bg-card rounded-2xl p-6 md:p-8 border border-border shadow-sm hover:shadow-xl hover:border-primary/50 transition-all group cursor-pointer"
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

          <div
            className="w-full md:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)] bg-card rounded-2xl p-6 md:p-8 border border-border shadow-sm hover:shadow-xl hover:border-primary/50 transition-all group cursor-pointer"
            onClick={() => navigate('/various')}
          >
            <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Presentation className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-bold text-xl mb-3">بوربوينت متنوعة</h3>
            <p className="text-foreground/80 leading-relaxed mb-4">
              مكتبة عروض بوربوينت متنوعة منها بعض الصلوات الليتورجية بالصور، تأملات من صلوات القديسين وعروض أخرى.
            </p>
            <div className="flex items-center gap-2 text-primary font-medium group-hover:gap-3 transition-all">
              <span>استكشف المكتبة</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          <div
            className="w-full md:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)] bg-card rounded-2xl p-6 md:p-8 border border-border shadow-sm hover:shadow-xl hover:border-primary/50 transition-all group cursor-pointer"
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

          <div
            className="w-full md:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)] bg-card rounded-2xl p-6 md:p-8 border border-border shadow-sm hover:shadow-xl hover:border-primary/50 transition-all group cursor-pointer"
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
        </div>
      </section>

      {/* Vision Statement Box */}
      <section className="content-visibility-auto">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl p-8 md:p-12 border border-primary/20 shadow-sm">
          <blockquote className="text-xl md:text-2xl lg:text-3xl leading-relaxed text-center font-bold mb-4">
            <span className="text-primary text-4xl">"</span>
            وكل ما عملتم فاعَملوا من القلب كما للرب لا للناس
            <span className="text-primary text-4xl">"</span>
          </blockquote>
          <p className="text-center text-lg text-muted-foreground">(كولوسي 3:23)</p>
        </div>
      </section>

      {/* Horizontal Scrolling Showcase */}
      <section className="relative py-4" dir="ltr">
        <div className="absolute inset-y-0 left-0 w-20 z-10 bg-gradient-to-r from-background to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-20 z-10 bg-gradient-to-l from-background to-transparent pointer-events-none" />
        <div
          ref={marqueeContainerRef}
          className="overflow-hidden cursor-grab active:cursor-grabbing select-none touch-none"
        >
          <div ref={marqueeInnerRef} className="flex gap-4 w-max">
            {renderCards(1)}
            {renderCards(2)}
            {renderCards(3)}
            {renderCards(4)}
          </div>
        </div>
      </section>

      {/* Platform Features */}
      <section className="space-y-6 content-visibility-auto">
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
      <section className="space-y-6 content-visibility-auto">
        <div className="text-center mb-8">
          <h2 className="font-bold text-2xl md:text-3xl mb-3">كيف تبدأ؟</h2>
          <p className="text-lg text-muted-foreground">ثلاث خطوات بسيطة للاستفادة من المنصة</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="relative bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-2xl p-8 border border-blue-500/20 text-center hover:scale-105 transition-transform">
            <div className="absolute -top-4 right-1/2 transform translate-x-1/2 w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
              1
            </div>
            <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 mt-2">
              <FolderOpen className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="font-bold text-xl mb-3">تصفح المكتبات</h3>
            <p className="text-foreground/80 leading-relaxed">
              استكشف مكتباتنا واختر ما يناسب خدمتك
            </p>
          </div>

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

      {/* Important Notices: content usage rights */}
      <section className="space-y-6 content-visibility-auto">
        <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-rose-500/5 rounded-2xl p-6 md:p-10 border border-amber-500/30 shadow-sm">
          <div className="flex items-start gap-4 flex-col sm:flex-row mb-6">
            <div className="w-14 h-14 shrink-0 bg-amber-500/20 rounded-2xl flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="font-bold text-xl md:text-2xl mb-1">تنبيهات مهمة حول استخدام المحتوى</h2>
              <p className="text-foreground/80 leading-relaxed">
                جميع المواد في هذه المنصة مجهزة لخدمة الكنيسة، وهي محمية بحقوق استخدام واضحة.
                نرجو الالتزام بهذه الضوابط عند التحميل والمشاركة:
              </p>
            </div>
          </div>

          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                icon: Ban,
                title: 'ممنوع البيع والاستخدام التجاري',
                desc: 'لا يجوز بيع المحتوى أو استخدامه في أي نشاط تجاري أو مشروع يعود بربح.',
              },
              {
                icon: Globe,
                title: 'ممنوع إعادة الرفع في أماكن أخرى',
                desc: 'لا يجوز إعادة رفع الملفات على مواقع أو قنوات أو مجموعات أخرى.',
              },
              {
                icon: ShieldAlert,
                title: 'الحفاظ على اللوجو والهوية',
                desc: 'لا يجوز إزالة أو تغيير شعار الكنيسة أو شعارات الخدمة المضافة على أي ملف.',
              },
              {
                icon: BadgeCheck,
                title: 'المشاركة المسؤولة',
                desc: 'عند العرض خارج كنيسة خدمتك، يُرجى ذكر المصدر والحفاظ على المحتوى دون تحريف.',
              },
            ].map((notice) => (
              <li
                key={notice.title}
                className="flex items-start gap-3 bg-background/60 rounded-xl p-4 border border-amber-500/20"
              >
                <notice.icon className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm mb-1">{notice.title}</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{notice.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl p-8 md:p-12 border border-primary/20 content-visibility-auto">
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
