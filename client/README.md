########### Figma's OUTDATED README

# خدمة الأرشيدياكون حبيب جرجس للداتا شو

## Arabic RTL Church Website - Complete LocalStorage Implementation

A complete Arabic RTL website for church services featuring a collapsible vertical navigation sidebar, comprehensive content management, and advanced user role system.

---

## ⚡ Important: 100% LocalStorage Implementation

**This application uses ZERO external services or databases.**

All data is stored in browser localStorage:
- ✅ User authentication & profiles
- ✅ Content (hymns, images, books, sayings)
- ✅ Favorites & preferences
- ✅ Activity logs
- ✅ Site settings

**No Supabase, Firebase, or any backend service is used.**

### 🔐 Default Login Credentials

**Admin Account:**
- Email: `admin@church.com`
- Password: `admin123`

**Editor Account:**
- Email: `editor@church.com`
- Password: `editor123`

---

## 🎯 Features Implemented

### Core Sections (8 Main Sections)
1. **الرئيسية (Home)** - Welcome section with quick access
2. **عرض الصلوات الليتورجية (Liturgy PowerPoint)** - Liturgy presentations
3. **مكتبة الألحان (Hymns Library)** - Complete hymns collection with advanced filtering
4. **معرض الصور (Image Gallery)** - Professional image gallery with lightbox
5. **مكتبة الكتب (Books Library)** - Digital book library
6. **أقوال الآباء (Fathers' Sayings)** - Wisdom and teachings collection
7. **اللغة القبطية (Coptic Language)** - Coptic language resources
8. **عن الخدمة (About)** - Service information

### Advanced Features

#### 🔐 Authentication System
- Mock authentication using localStorage
- 3-tier role system: Admin, Editor, Viewer
- Persistent sessions across page reloads
- Profile management with avatar upload
- Password change functionality

#### 👥 User Management (Admin Only)
- Complete user management dashboard
- Role assignment (Admin/Editor/Viewer)
- Expandable user rows with detailed information
- **Filter by church role** (كاهن، معلم، أمين خدمة، خادم، لا اخدم، اخرى)
- **Filter by service** (18 service options)
- Activity log tracking per user
- User deletion (except self)
- Multi-select services field with checkboxes

#### 📊 User Profile System
- Church name field
- Church role dropdown (6 predefined roles)
- Services multi-select (18 service options)
- "اختر كل ما ينطبق" (check all that apply) interface
- Array-based services storage
- Automatic data migration from old string format

#### 🎨 Content Management
- Centralized Topics (المواضيع) system
- Section visibility controls
- Bulk edit operations for images and books
- Advanced filtering systems across all libraries
- Tag-based organization

#### ⭐ Favorites System
- Multi-selection favorites with checkboxes
- Unified favorites page for all content types
- Persistent across sessions
- Quick access icons

#### 📈 Activity Logging
- Comprehensive user activity tracking
- Login/logout events
- Content modifications
- Role changes
- User management actions
- Export to CSV/JSON

#### ⚙️ Site Settings
- Section visibility management
- Topic management
- User management (admin only)
- Centralized configuration

---

## 🏗️ Technical Stack

- **Framework:** React 18.3.1
- **Styling:** Tailwind CSS v4.1.12
- **Icons:** Lucide React
- **Typography:** Tajawal (Google Fonts)
- **Build Tool:** Vite 6.3.5
- **UI Components:** Radix UI
- **Data Storage:** Browser localStorage
- **Authentication:** Custom localStorage-based mock system

---

## 📂 Project Structure

```
/src
  /app
    /components         # All React components
    /contexts          # AuthContext (localStorage-based)
    /data             # Mock data (artists, fathers, images, tags)
    /hooks            # Custom hooks
    /utils            # Utility functions (activityLogger, adminUtils)
  /styles             # CSS files (Tailwind v4, fonts, theme)

/DATA_STORAGE_INFO.md  # Detailed localStorage documentation
```

---

## 🚀 Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

---

## ⚠️ Known Console Warnings (Safe to Ignore)

You may see these harmless errors in the console:

```
Error while deploying: XHR for "/api/integrations/supabase/.../deploy" failed with status 544
Error while deploying: XHR for "/api/integrations/supabase/.../deploy" failed with status 403
```

**These are completely harmless!** They're failed attempts to sync with Supabase, which:
- We don't use
- Don't affect functionality
- Can be safely ignored
- Are caused by protected system files that can't be deleted

---

## 📝 Data Persistence

All data is stored in browser localStorage with these keys:

### Authentication
- `mockProfile` - Current user profile
- `mockUsers` - All registered users  
- `mockAccessToken` - Session token

### Content
- `galleryImages` - Image library
- `fatherSayings` - Fathers' sayings
- `booksLibrary` - Books collection
- `topics` - Centralized topics
- `sectionVisibility` - Section visibility settings

### User Data
- `favoriteHymns` - Favorite hymns
- `favoriteImages` - Favorite images
- `favoriteBooks` - Favorite books
- `favoriteSayings` - Favorite sayings
- `userActivityLogs` - Activity logs

---

## 🎨 Design Features

- **RTL Support:** Full Arabic right-to-left layout
- **Responsive:** Mobile, tablet, and desktop optimized
- **Dark Mode:** Complete dark mode support
- **Modern UI:** Card-based layouts, smooth animations
- **Accessibility:** Proper ARIA labels and semantic HTML
- **Clean Typography:** Tajawal font throughout

---

## 🔧 User Roles & Permissions

### Admin (مسؤول)
- Full access to all sections
- User management
- Content editing and deletion
- Topic management
- Site settings
- Activity log viewing
- Role assignment

### Editor (محرر)
- Content viewing
- Content editing
- Limited content deletion
- Cannot manage users
- Cannot change site settings

### Viewer (مشاهد)
- Content viewing only
- Can favorite content
- Cannot edit or delete
- Cannot access admin features

---

## 📱 Responsive Breakpoints

- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

---

## 🌐 Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

**Note:** All modern browsers with localStorage support.

---

## 📞 Support

This is a standalone application with no external dependencies or services to configure. Everything runs locally in the browser!

---

## 📄 License

Private project for church use.

---

**Last Updated:** January 18, 2026
**Status:** ✅ Production Ready (LocalStorage-only implementation)
