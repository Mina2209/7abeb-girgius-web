# Archdeacon Habib Girgis Data Show Service ⛪

An integrated Coptic Orthodox platform serving the Church of the Virgin Mary – New Nozha. This platform brings all digital church content together in one trusted and well-organized place: liturgical PowerPoint presentations, a ready-to-display hymns library with lyrics, a high-quality Coptic image library, books, sayings of the Church Fathers, and a section for learning the Coptic language. 

It also includes a complete user management system (roles, favorites, analytics, backups), along with specialized administrative dashboards.

> This project is built as a **monorepo** containing: a frontend (React + Vite) and a backend API (Express + Prisma), with media files stored on AWS S3.

---

## ✨ Features

- **Multi-media libraries**: Liturgy, hymns (display & lyrics), various PowerPoint presentations, images, books, sayings of the Church Fathers and authors, and Coptic language resources.
- **Presentation previews**: View PowerPoint files directly via Microsoft Office Online, with in-browser preview available during development.
- **Direct S3 downloads**: Secure, presigned URLs for direct downloads with support for large files via multipart uploads and ZIP compression.
- **Smart search & filters**: Arabic-normalized search, tag-based filtering, multiple filters, and Arabic-aware sorting.
- **User system & roles**: `ADMIN`, `EDITOR`, and `VIEWER` roles with fine-grained access control.
- **Favorites**: Save any type of content (hymns, images, books, or sayings) to your personal favorites list.
- **Admin dashboards**: Manage users, tags and sections, site settings, analytics, activity logs, and data exports.
- **First-party analytics + Google Analytics**: Track custom events (views, downloads, searches, shares, etc.) with interactive charts and user consent before loading Google Analytics.
- **Dark/Light mode** with full RTL support.
- **Standalone BioLink/QR page** (`/qrcode`): A shareable digital business card, independent from the main app.
- **Automated database backups**: Daily backups of the PostgreSQL database to S3 at midnight, retaining the last 7 backups.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18 · TypeScript · Vite 6 · Tailwind CSS v4 · React Router 7 · Radix UI · Lucide Icons · Flaticon · Sonner · React Responsive Masonry · XLSX · pptx-preview |
| **Backend** | Node.js 22 · Express 5 · Prisma 6 · PostgreSQL · JSON Web Tokens (JWT) · bcrypt |
| **Storage & Media** | AWS S3 · Presigned URLs · Sharp (image resizing) · Archiver (ZIP generation) · On-demand thumbnails |
| **Analytics** | First-party event tracking + GA4 via gtag with consent management |
| **Deployment & Infra** | Docker · GitHub Actions · Vercel · EC2 / Elastic Beanstalk · S3 + CloudFront (Terraform) |

---

## 📁 Project Structure

```text
7abeb-girgius-web/
├── client/                    # Frontend (React + Vite + Tailwind)
│   ├── public/                # logo.ico, robots.txt, Flaticon fonts
│   ├── scripts/               # optimize-logos.mjs, deploy-s3.sh
│   └── src/
│       ├── app/               # App.tsx, pages, components, contexts, services
│       ├── styles/            # Global styles (index.css, tailwind.css, theme.css, fonts.css)
│       └── assets/            # Church logos in multiple WebP sizes
├── server/                    # Backend (Express + Prisma)
│   ├── prisma/                # schema.prisma, migrations, seed.js
│   ├── routes/                # API routes
│   ├── controllers/           # Request handlers
│   ├── services/              # S3, analytics, backup, cache, normalization, etc.
│   ├── middleware/            # Auth, security, rate limiting
│   └── __tests__/             # Vitest + Supertest tests (113 tests)
├── infra/                     # Terraform for S3 + CloudFront (OAC)
├── docs/security/             # Security documentation & remediation plans
├── docker-compose.yml         # PostgreSQL + API setup
└── .github/workflows/ci.yml   # CI: backend tests + frontend build
```

---

## 🖥️ Backend (API)

The server runs on **Express 5** with **PostgreSQL** via **Prisma ORM**. The entry point is `server/index.js`. In `production`, a strong `JWT_SECRET` (minimum 32 characters) is required, otherwise the server will refuse to start.

### Authentication & Roles

- **JWT-based auth**: Tokens are valid for 7 days and include `{ id, username, role, tokenVersion }`.
- **Token invalidation**: The `tokenVersion` field in the database is incremented on password changes or role updates, instantly invalidating all previous tokens.
- **Password hashing**: Uses `bcrypt` with a cost factor of 10.
- **Brute-force protection**: Progressive delay is applied after failed login attempts for both existing and non-existing users.

| Role | Permissions |
|---|---|
| `VIEWER` | Browse libraries, add to favorites, access profile page |
| `EDITOR` | All content operations (add/edit/delete hymns, images, sayings, books, uploads) |
| `ADMIN` | Full access (user management, tags/sections, site settings, analytics, activity logs, exports, backups) |

### Key API Endpoints

| Endpoint | Description |
|---|---|
| `POST /api/auth/register`, `POST /api/auth/login`, `GET/POST /api/auth/users` | Authentication and user management (Admin only) |
| `PUT /api/auth/password`, `PUT /api/auth/profile` | Change password & update profile |
| `GET /api/auth/settings/site` | Get visible/hidden site sections |
| `GET/POST/PUT/DELETE /api/hymns`, `GET /api/hymns/zip` | Hymns library & ZIP download |
| `GET/POST/PUT/DELETE /api/sayings`, `GET/POST/PUT/DELETE /api/fathers` | Sayings & Church Fathers |
| `GET/POST/PUT/DELETE /api/images`, `GET /api/images/meta/*`, `GET /api/images/facets` | Image library with filters & metadata |
| `*/api/uploads/*` | Presigned S3 URLs, thumbnails (`thumb`), proxy viewing, Office Online integration for PowerPoint, and multipart uploads (`multipart/*`) |
| `GET /api/lyrics/*` | Hymn lyrics & search |
| `GET/POST/DELETE /api/favorites/*` | Favorites for all content types |
| `POST /api/analytics/events`, `GET /api/admin/analytics/*` | First-party event logging & analytics dashboards (Admin) |
| `POST /api/admin/activity/events`, `GET /api/admin/activity/*` | Audit trail of user actions (Admin) |
| `GET/POST/DELETE /api/backup/*` | Database backup management (Admin) |
| `GET /health` | Server & database health check |

### Media & S3

- **Direct-to-S3 uploads**: Files are uploaded directly to S3 via presigned URLs. Only thumbnails are processed through the server.
- **On-demand thumbnails**: `GET /api/uploads/thumb?key=...&w=400` generates and caches a resized JPEG thumbnail in S3.
- **PowerPoint previews**: Presentations are proxied for viewing via Microsoft Office Online. During development, the `pptx-preview` library is used for in-browser rendering.
- **Access control**: All S3 keys are validated using `isReadableKey`, `isWritableKey`, `S3_FOLDER_MAP`, and `S3_ALLOWED_FOLDERS`.

### Backups

Automated `pg_dump` jobs run every 24 hours, compress and upload the dump to `s3://.../backups/`, and automatically remove older backups beyond the last 7. Backups can also be created, downloaded, or deleted manually from the admin panel.

---

## 🗄️ Database (Prisma)

Key models include:

| Model | Purpose |
|---|---|
| `Hymn`, `File`, `Lyric` | Hymns with associated media files and lyrics |
| `Tag`, `TagSection` | Categorization for hymns, sayings, and images |
| `Saying`, `Father` | Sayings of the Church Fathers with author references |
| `Image`, `ImageAuthor`, `ImageType` | Image library with authors, types, AI flags, and publish status |
| `User`, `Log`, `Favorite` | Users, audit logs, and favorites with role-based access & `tokenVersion` |
| `SiteSettings` | Single-row config for toggling sections, liturgy/download links, and PowerPoint settings |
| `AnalyticsEvent`, `UserActivity` | First-party analytics and detailed activity tracking |

---

## 🎨 Frontend (Client)

A fully Arabic, RTL SPA built with React and Vite, supporting light and dark themes.

### Main Routes

| Route | Page |
|---|---|
| `/` | Home (hero, platform sections, carousel) |
| `/liturgy` | Liturgical PowerPoint presentations & downloads |
| `/hymns` | Hymns library (display & lyrics) |
| `/various`, `/images`, `/books`, `/sayings`, `/coptic` | Various libraries (images, books, sayings, Coptic learning) |
| `/artists`, `/artists/:id`, `/sayings/authors/:id` | Authors & Church Fathers details |
| `/profile`, `/favorites` | User profile & favorites |
| `/admin/users`, `/admin/topics`, `/admin/settings` | Admin management panels |
| `/admin/analytics`, `/admin/activity`, `/admin/export` | Analytics, activity logs & data export |
| `/qrcode` | BioLink digital business card (standalone page) |

### Key Features

- **Code splitting**: Lazy-loaded routes with manual chunking to separate heavy vendors (`vendor-pptx`, `vendor-xlsx`) from the initial bundle.
- **Unified API client**: Automatically attaches JWT tokens, retries failed requests with exponential backoff on `429/502/503/504`, and handles session expiration.
- **File uploads with progress**: Uses `XMLHttpRequest` to show real-time upload progress in a fixed top bar.
- **Analytics with consent**: First-party events are tracked by default, while GA4 is only loaded after user consent.
- **Optimized CSS loading**: Generates critical CSS on build and loads the full stylesheet non-blockingly to prevent FOUC.
- **Automatic logo optimization**: `prebuild` script generates multiple WebP logo sizes using `sharp`.

---

## 🚀 Getting Started

### Prerequisites

- Node.js **22+** and npm
- PostgreSQL (or use `docker compose up db`)
- AWS S3 account (optional for full media functionality)

### Backend Setup

```bash
cd server
cp .env.example .env        # Fill in DATABASE_URL, JWT_SECRET, AWS credentials, etc.
npm install
npx prisma generate
npx prisma migrate dev      # Run migrations
npm run seed                # Seed sample data (not for production)
npm run dev                 # Start dev server
```

### Frontend Setup

```bash
cd client
cp .env.example .env        # Set VITE_API_BASE_URL (e.g., http://localhost:8080)
npm install
npm run dev                 # Runs at http://localhost:5173 with /api proxy
```

> During the build process, `prebuild` automatically runs `optimize:images` to generate optimized WebP logo variants.

### Run with Docker

```bash
docker compose up --build
# API available at http://localhost:8080
# PostgreSQL runs internally
# Ensure JWT_SECRET is set in your environment
```

---

## 🧪 Testing

```bash
# Backend tests
cd server
npm test        # Vitest + Supertest (113 passing tests)

# Frontend lint & build
cd client
npm run lint    # ESLint (must pass with zero warnings)
npm run build   # TypeScript check + Vite production build
```

---

## ☁️ Deployment

### Frontend

- **Vercel**: Configured via `client/vercel.json` with security headers, SPA rewrites, and API proxying to the backend.
- **S3 + CloudFront**: Provisioned with `infra/cloudfront.tf` using Origin Access Control (OAC), CloudFront Functions for SPA routing, HTTP/2 & HTTP/3, Brotli compression, and optimized cache policies.
- **Manual S3 deploy**: 

```bash
cd client
CLOUDFRONT_DISTRIBUTION_ID=XXXXXXXXXXXX bash scripts/deploy-s3.sh
```

### Backend

- Deploy to **EC2** or **Elastic Beanstalk** behind Nginx or an Application Load Balancer.
- Must run with `NODE_ENV=production` and a strong `JWT_SECRET`.
- PostgreSQL can be managed directly or via the built-in admin backup system.

### CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on `main` and `feature/optimizations` branches:

- **Backend job**: `npm ci` → `prisma generate` → `npm test`
- **Frontend job**: `npm ci` → `npm run build`

---

## 🔒 Security

- **Secure headers**: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and more.
- **Rate limiting**: Applied globally and more strictly on auth, registration, and ZIP download endpoints.
- **Input validation & sanitization**: All user inputs are validated with request tracing via `requestId`.
- **Hardened Docker image**: Runs as a non-root `node` user with `HEALTHCHECK` enabled.
- **Comprehensive security docs**: Available in `docs/security/` (strategy, remediation plan, checklists, and final release gate report — all 113 tests passing).

> ⚠️ **Important:** Replace the default `JWT_SECRET` before deploying to production. The development value in `server/.env` is git-ignored but must never be used in production.

---

## ⚡ Performance

- **Modern protocols**: HTTP/2, HTTP/3, Brotli & Gzip compression via CloudFront.
- **Smart caching**: `/assets/*` served with `Cache-Control: immutable` for 1 year, while `index.html` uses `no-cache` for instant updates.
- **Image optimization**: Multi-size WebP logos with `srcSet`, `sizes`, and `fetchpriority="high"` for LCP elements.
- **Faster first paint**: Critical CSS inlined with non-blocking full stylesheet loading.
- **Bundle optimization**: Manual chunking and lazy loading keep heavy libraries (ECharts, XLSX, pptx) out of the main bundle.

---

## 📦 Useful Commands

```bash
# Frontend
npm run dev                # Vite dev server
npm run build              # Type-check & production build
npm run optimize:images    # Generate optimized logo sizes (runs automatically on prebuild)
bash scripts/deploy-s3.sh  # Deploy to S3 & invalidate CloudFront

# Backend
npm run dev                # Run with nodemon
npm test                   # Run tests with Vitest
npx prisma studio          # Open Prisma DB viewer
```

---

## 🏗️ Infrastructure (Terraform)

The `infra/cloudfront.tf` configuration provisions:

- **CloudFront Distribution** in front of `s3://7abeb-frontend` using Origin Access Control (bucket remains private, accessed only via CloudFront).
- **CloudFront Function** to rewrite SPA routes to `index.html` while preserving `/assets/*` and files with extensions.
- **Cache behaviors**: `CachingDisabled` for HTML/routes, `CachingOptimized` (1 year) for static assets under `/assets/*`.

```bash
cd infra
terraform init && terraform plan && terraform apply
```

---

## 📄 License

This platform is provided free of charge for the service of the Coptic Orthodox Church. All church-related content is reviewed and published under the name **"Service of Archdeacon Habib Girgis" – Church of the Virgin Mary, New Nozha**.