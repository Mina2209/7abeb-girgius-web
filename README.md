# خدمة الأرشيدياكون حبيب جرجس للداتا شو ⛪

منصة قبطية أرثوذكسية متكاملة لخدمة كنيسة السيدة العذراء مريم – النزهة الجديدة. تجمع المنصة المحتوى الكنسي الرقمي في مكانٍ واحد موثوق ومنظّم: بوربوينت الليتورجية، ومكتبة ترانيم جاهزة للعرض مع الكلمات، ومكتبة صور قبطية عالية الجودة، وكتب، وأقوال الآباء، وقسم لتعلم اللغة القبطية — بالإضافة إلى نظام مستخدمين كامل (أدوار، مفضلة، تحليلات، نسخ احتياطي) ولوحات إدارة متخصصة.

> المشروع مبني على **Monorepo** يحتوي على: واجهة أمامية (React + Vite) + خادم API (Express + Prisma) مع نشر بيانات على AWS S3.

---

## ✨ المميزات

- **مكتبات وسائط متعددة**: ليتورجية، ترانيم (عرض + كلمات)، بوربوينت متنوعة، صور، كتب، أقوال الآباء والمؤلفين، ولغة قبطية.
- **معاينة العروض** مباشرة عبر Microsoft Office Online (للعروض التقديمية)، مع معاينة داخل المتصفح أثناء التطوير.
- **تحميلات مباشرة من AWS S3** عبر روابط مُوقّعة (Presigned URLs) مع دعم للملفات الكبيرة (Multipart upload) وضغط ZIP.
- **بحث وفلاتر ذكية**: بحث عربي مُطبَّع (Normalization)، فلترة بالوسوم، فلاتر متعددة، وفرز عربي-aware.
- **نظام مستخدمين وأدوار**: `ADMIN` / `EDITOR` / `VIEWER` مع صلاحيات تحكم دقيقة.
- **المفضلة**: حفظ المحتوى لجميع الأنواع (ترنيمة / صورة / كتاب / قول).
- **لوحات إدارة**: إدارة المستخدمين، الوسوم والأقسام، إعدادات الموقع، التحليلات، سجل النشاطات، وتصدير البيانات.
- **تحليلات من طرفنا + Google Analytics**: أحداث مخصّصة (مشاهدات، تحميلات، بحث، مشاركة...) مع لوحات رسوم بيانية، وموافقة المستخدم قبل تحميل Google Analytics.
- **الوضع الليلي/النهاري** وواجهة RTL بالكامل.
- **صفحة BioLink / QR** مستقلة (`/qrcode`): بطاقة أعمال رقمية قابلة للمشاركة.
- **نسخ احتياطي تلقائي** لقاعدة البيانات إلى S3 كل 24 ساعة (الاحتفاظ بآخر 7 نسخ).

---

## 🛠️ التقنيات المستخدمة

| الطبقة | التقنيات |
|---|---|
| **الواجهة الأمامية** | React 18 · TypeScript · Vite 6 · Tailwind CSS v4 · React Router 7 · Radix UI · Lucide + Flaticon · Sonner · React Responsive Masonry · XLSX · pptx-preview |
| **الخادم** | Node.js 22 · Express 5 · Prisma 6 · PostgreSQL · JSON Web Tokens (JWT) · bcrypt |
| **التخزين/الوسائط** | AWS S3 · Presigned URLs · Sharp (تصغير الصور) · Archiver (ZIP) · الصور المصغّرة عند الطلب |
| **التحليلات** | أحداث أول-طرفية (أوّل شخصية) + GA4 عبر gtag مع الموافقة |
| **النشر والتشغيل** | Docker · GitHub Actions · Vercel · EC2 / Elastic Beanstalk · S3 + CloudFront (Terraform) |

---

## 📁 هيكل المشروع

```
7abeb-girgius-web/
├── client/                    # الواجهة الأمامية (React + Vite + Tailwind)
│   ├── public/                # logo.ico, robots.txt, خطوط Flaticon
│   ├── scripts/               # optimize-logos.mjs (توليد أحجام الشعار), deploy-s3.sh (نشر S3)
│   └── src/
│       ├── app/               # App.tsx + الصفحات والمكونات والسياقات
│       │   ├── components/    # المكونات (قائمة جانبية، أقسام المحتوى...)
│       │   ├── pages/         # الصفحات (الإدارة، الملف الشخصي، BioLink...)
│       │   ├── contexts/      # AuthContext, SectionsVisibilityContext, UploadProgress
│       │   └── services/      # analytics.ts, ga4.ts, apiClient.ts ...
│       ├── styles/            # index.css ← tailwind.css + theme.css + fonts.css
│       └── assets/            # شعار الكنيسة بأحجام WebP متعددة
├── server/                    # الخادم (Express + Prisma)
│   ├── prisma/                # schema.prisma + migrations + seed.js
│   ├── routes/                # مسارات API (auth, hymns, images, sayings, uploads ...)
│   ├── controllers/           # منطق المعالجة
│   ├── services/              # s3.service, analytics, backup, cache, normalize ...
│   ├── middleware/            # مصادقة وأمان و rate limiting
│   └── __tests__/             # اختبارات Vitest + Supertest (113 اختبارًا)
├── infra/                     # Terraform: CloudFront + S3 (OAC) للواجهة
├── docs/security/             # توثيق الأمان وخطط الإصلاح
├── docker-compose.yml         # PostgreSQL + API
└── .github/workflows/ci.yml   # CI: اختبارات الخادم + بناء الواجهة
```

---

## 🖥️ الخادم (API)

خادم `Express 5` بقاعدة `PostgreSQL` عبر `Prisma`. يبدأ بـ `server/index.js` ويتوقع `NODE_ENV=production` إجباريًا وجود `JWT_SECRET` قوي (≥32 حرفًا) — وإلا يرفض الإقلاع.

### المصادقة والأدوار

- **JWT** بصلاحية 7 أيام، مُحمّل بـ `{ id, username, role, tokenVersion }`.
- `tokenVersion` في قاعدة البيانات: تغيير كلمة المرور أو الدور يُبطل كل الرموز القديمة فورًا.
- كلمات المرور مشفّرة بـ `bcrypt` (cost 10).
- **حماية ضد التخمين**: تأخير تصاعدي بعد محاولات تسجيل الدخول الفاشلة (للمستخدمين الحقيقيين وغير الموجودين على حدٍ سواء).

| الدور | الصلاحيات |
|---|---|
| `VIEWER` | تصفح المكتبات، إضافة مفضلة، صفحة الملف الشخصي |
| `EDITOR` | كل ما يخص المحتوى: إضافة/تعديل/حذف الترانيم والصور والأقوال والكتب والتحميلات |
| `ADMIN` | كل شيء: إدارة المستخدمين، الوسوم والأقسام، الإعدادات، التحليلات، سجل النشاطات، التصدير، النسخ الاحتياطي |

### أبرز المسارات (Endpoints)

| المسار | الوصف |
|---|---|
| `POST /api/auth/register` · `/login` · `POST/GET /api/auth/users` | التسجيل، الدخول، وإدارة المستخدمين (أدمن) |
| `PUT /api/auth/password` · `/api/auth/profile` | تغيير كلمة المرور، والملف الشخصي |
| `GET /api/auth/settings/site` | أقسام الموقع الظاهرة/المخفية |
| `GET/POST/PUT/DELETE /api/hymns` · `/api/hymns/zip` | مكتبة الترانيم + تحميل ZIP لملفات الترانيم |
| `GET/POST/PUT/DELETE /api/sayings` · `/api/fathers` | الأقوال والمؤلفون |
| `GET/POST/PUT/DELETE /api/images` · `/api/images/meta/*` · `/api/images/facets` | مكتبة الصور (فلاتر وأصنّاف) |
| `*/api/uploads/*` | روابط S3 الموقعة، الصور المصغّرة `thumb`، proxy العرض، ومجمع `office` لعرض PowerPoint في Office Online، ورفع متعدد `multipart/*` |
| `GET /api/lyrics/*` | كلمات الترانيم والبحث |
| `GET/POST /api/favorites/*` | المفضلة لكل أنواع المحتوى |
| `POST /api/analytics/events` · `/api/admin/analytics/*` | تسجيل الأحداث + لوحات/تصدير (أدمن) |
| `POST /api/admin/activity/events` · `/api/admin/activity/*` | سجل «من فعل ماذا» (أدمن) |
| `*/api/backup/*` | إنشاء/تحميل/حذف النسخ الاحتياطية (أدمن) |
| `GET /health` | فحص حالة الخادم وقاعدة البيانات |

### الوسائط و S3

- **كل بيانات الوسائط تذهب إلى S3 مباشرة** عبر روابط موقّعة — لا يمر حجم الملف عبر الخادم (باستثناء توليد الصور المصغّرة).
- الصور تُقدَّم بتصغير **عند الطلب**: `GET /api/uploads/thumb?key=...&w=400` يولّد صورة مصغّرة `JPEG` مخزّنة في S3 ويُعيد استخدامها.
- معاينة PowerPoint تتم عبر **Microsoft Office Online** من خلال proxy يفرض نوع `pptx`؛ أثناء التطوير يُستخدم معاين داخل المتصفح (`pptx-preview`).
- التحكم في صلاحيات الوصول للمفاتيح من خلال قواعد `isReadableKey / isWritableKey` وقوائم `S3_FOLDER_MAP` و`S3_ALLOWED_FOLDERS`.

### النسخ الاحتياطي

`pg_dump` يُجمع ويُرفع إلى `s3://.../backups/` تلقائيًا كل 24 ساعة (يُحتفظ بـ 7 نسخ)، مع لوحة إدارة للإنشاء والتنزيل والتنظيف.

---

## 🗄️ قاعدة البيانات (Prisma)

النماذج الرئيسية:

- **Hymn** (ترنيمة) → مجموعة من **File** (فيديو / بوربوينت / صوت) + **Lyric** (كلمات).
- **Tag / TagSection** — وسوم وأقسام ترتبط بالترانيم والأقوال والصور.
- **Saying** (قول) و **Father** (أب) — للأقوال والمرجع.
- **Image** الكلاسيكية + **ImageAuthor** + **ImageType** (مكتبة الصور مع ربط بالمؤلف والنوع وعلامة AI وحالة نشر).
- **User** + **Log** + **Favorite** (بالأدوار الأربعة و`tokenVersion`).
- **SiteSettings** (صف واحد) — يتحكم بإظهار/إخفاء الأقسام، وروابط الليتورجية/التحميل، ومعلومات PowerPoint.
- **AnalyticsEvent** + **UserActivity** — تحليلات أول-طرفية وسجل تدقيق.

---

## 🎨 الواجهة الأمامية (Client)

SPA بالعربية و RTL بالكامل، مهيّأة للوضع الليلي/النهاري.

### الصفحات الرئيسية

| المسار | الصفحة |
|---|---|
| `/` | الرئيسية (Hero + أقسام المنصة + شريط متحرك) |
| `/liturgy` | بوربوينت الليتورجية + تحميل |
| `/hymns` | مكتبة الترانيم (عرض + كلمات) |
| `/various` · `/images` · `/books` · `/sayings` · `/coptic` | مكتبات متنوعة/صور/كتب/أقوال/قبطي |
| `/artists` · `/artists/:id` · `/sayings/authors/:id` | تفاصيل المؤلفين والآباء |
| `/profile` · `/favorites` | الملف الشخصي والمفضلة |
| `/admin/users` · `/admin/topics` · `/admin/settings` | لوحات الإدارة |
| `/admin/analytics` · `/admin/activity` · `/admin/export` | التحليلات وسجل النشاط والتصدير |
| `/qrcode` | **BioLink**: بطاقة أعمال رقمية بصفحة مستقلة عن التطبيق الرئيسي |

### سلوكيات وأدوات

- التحميل الكسول لكل الصفحات + فصل `vendor-pptx` و`vendor-xlsx` بعيدًا عن التحميل الأولي (Manual chunks).
- `apiClient` موحّد: إضافة `Authorization` تلقائيًا، إعادة محاولة مع backoff عند `429/502/503/504`، ومعالجة انتهاء الجلسة (`sessionExpired`).
- رفع الملفات عبر `XMLHttpRequest` لعرض نسبة حقيقية في واجهة علوية ثابتة.
- تحليلات أول-طرفية + GA4 (مع موافقة الزائر)، وتتبّع الأحداث عبر المسارات.
- ملف `vite.config.ts` يتضمن معالجة CSS: حقن "Critical CSS" بسيط + تحميل ورقة الأنماط كاملة بشكل غير محظور للمرّ الأول (منع FOUC).

---

## 🚀 البدء السريع

### المتطلبات

- Node.js **22+** · npm
- PostgreSQL (أو `docker compose up db`)
- حساب AWS S3 (اختياري لمعالجة الوسائط)

### الخادم (server)

```bash
cd server
cp .env.example .env        # ثم املأ القيم (DATABASE_URL, JWT_SECRET, AWS...)
npm install
npx prisma generate
npx prisma migrate dev      # إنشاء الجداول
npm run seed                # تعبئة بيانات تجريبية (خارج production)
npm run dev                 # تشغيل التطوير
```

### الواجهة الأمامية (client)

```bash
cd client
cp .env.example .env        # VITE_API_BASE_URL (مثال: http://localhost:8080)
npm install
npm run dev                 # http://localhost:5173 (مع proxy عام /api)
```

> عند البناء، يُنفَّذ `prebuild` لتوليد أحجام الشعار (`optimize:images`) عبر `sharp`.

### التشغيل الكامل بـ Docker

```bash
docker compose up --build
# api على المنفذ 8080، و postgres داخليًا
# يتطلب تعيين JWT_SECRET في البيئة
```

---

## 🧪 الاختبارات

```bash
cd server
npm test        # Vitest + Supertest — 113 اختبارًا عابرًا حاليًا
```

```bash
cd client
npm run lint    # ESLint (بدون تحذيرات)
npm run build   # tsc -b && vite build
```

---

## ☁️ النشر

### الواجهة (Client)

- **Vercel**: بدعم تكوين `client/vercel.json` (ترويسات أمنية + إعادة كتابة `/api/*` إلى الخادم + SPA).
- **S3 + CloudFront**: عبر `infra/cloudfront.tf` (OAC خاص + CloudFront Function لإعادة توجيه مسارات SPA + HTTP/2/3 + ضغط Brotli + سياسات تخزين مؤقت منفصلة لـ `/assets/*`).
- النشر إلى S3 بترويسات `Cache-Control` صحيحة عبر `client/scripts/deploy-s3.sh`:

```bash
cd client
CLOUDFRONT_DISTRIBUTION_ID=XXXXXXXXXXXX bash scripts/deploy-s3.sh
```

### الخادم (API)

- على **EC2 / Elastic Beanstalk** خلف nginx أو Load Balancer، مع `NODE_ENV=production` و `JWT_SECRET` قوي.
- قاعدة البيانات: PostgreSQL (ويمكن إدارتها عبر لوحة النسخ الاحتياطي في `/api/backup`).

### CI

`GitHub Actions` (`.github/workflows/ci.yml`) يعمل على `main` و`feature/optimizations`:
- `backend`: `npm ci` → `prisma generate` → `npm test`.
- `frontend`: `npm ci` → `npm run build`.

---

## 🔒 الأمان

- ترويسات أمان (CSP · HSTS · X-Frame-Options ...). 
- قيود معدل الطلبات (Rate limiting) على مستوى API العام وبشكل خاص لمسارات الدخول والتسجيل والتحميلات ZIP.
- تحقق من صحة المدخلات وتنظيفها، و`requestId` للتتبع.
- حاوية Docker بـ `USER node` وبلا صلاحيات الجذر، مع `HEALTHCHECK`.
- توثيق كامل في `docs/security/` (الاستراتيجية، الخطة، الأدلة، وتقرير بوّابة الإصدار النهائي — 113/113 اختبارًا).

> ⚠️ تذكير: استبدل `JWT_SECRET` قبل أي نشر إنتاجي — توجد قيمة تطويرية في `server/.env` (مُستبعدة من git) لا تجتاز فحص القوة.

---

## ⚡ الأداء

- HTTP/2 + HTTP/3 وضغط Brotli/Gzip عبر CloudFront.
- تخزين مؤقت `immutable` لمدة عام لأصول `/assets/*`، و`no-cache` لملف `index.html`.
- صور الشعار بأحجام WebP متعددة مع `srcSet`/`sizes`، و`fetchpriority="high"` لعنصر LCP.
- تحميل CSS غير محظور + Critical CSS مضمّن لمنع FOUC.
- تقسيم الحزم يدويًا وإبعاد المكتبات الثقيلة (echarts/xlsx/pptx) عن التحميل الأولي.

---

## 📦 الأوامر المفيدة

```bash
# Client
npm run dev                # خادم تطوير Vite
npm run build              # تيبس + بناء
npm run optimize:images    # توليد أحجام شعار WebP (يعمل تلقائيًا قبل build)
bash scripts/deploy-s3.sh  # نشر إلى S3 + تصفية CloudFront

# Server
npm run dev                # تشغيل مع nodemon
npm test                   # اختبارات Vitest
npx prisma studio          # استعراض قاعدة البيانات
```

---

## 🏗️ البنية التحتية (Terraform)

`infra/cloudfront.tf` يُنشئ:

- **CloudFront distribution** أمام `s3://7abeb-frontend` (OAC — الدلو يبقى خاصًا وجميع القراءات عبر CloudFront فقط).
- **CloudFront Function** لإعادة كتابة مسارات SPA إلى `index.html` مع تمرير `/assets/*` والملفات ذات الامتداد.
- **سلوكان للتخزين**: `CachingDisabled` لـ HTML/المسارات، و`CachingOptimized` (سنة) لأصول `/assets/*`.

```bash
cd infra
terraform init && terraform plan && terraform apply
```

---

## 📄 الترخيص

المنصة متاحة مجانًا لخدمة الكنيسة القبطية الأرثوذكسية. جميع المحتويات الكنسية مراجعة وتُنشر باسم «خدمة الأرشيدياكون حبيب جرجس» — كنيسة السيدة العذراء مريم بالنزهة الجديدة.