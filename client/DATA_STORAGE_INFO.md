########### Figma's OUTDATED DATA_STORAGE_INFO

# Data Storage Information

## Current Implementation: 100% LocalStorage & Mock Data

This application is **completely independent** of Supabase and uses only browser localStorage for all data persistence.

### ✅ What's Being Used:
- **localStorage** - All user data, profiles, authentication, and content
- **Mock Data** - Predefined data for hymns, images, books, sayings, etc.
- **Browser-Based Auth** - Simple email/password authentication stored locally

### ❌ What's NOT Being Used:
- ~~Supabase Authentication~~
- ~~Supabase Database~~
- ~~Supabase Storage~~
- ~~Any external APIs~~

### 📂 Data Storage Locations:

All data is stored in browser localStorage with these keys:

1. **Authentication & Users:**
   - `mockProfile` - Current logged-in user profile
   - `mockUsers` - Array of all registered users
   - `mockAccessToken` - Session token

2. **User Activity:**
   - `userActivityLogs` - Activity tracking for admin panel

3. **Content Data:**
   - `galleryImages` - Image library with metadata
   - `fatherSayings` - Fathers' sayings collection
   - `booksLibrary` - Books collection
   - `topics` - Centralized topics system
   - `sectionVisibility` - Section visibility settings

4. **User Preferences:**
   - `favoriteHymns` - User's favorite hymns
   - `favoriteImages` - User's favorite images
   - `favoriteBooks` - User's favorite books
   - `favoriteSayings` - User's favorite sayings

### 🔧 Mock User System:

**Default Admin Account:**
- Email: `admin@church.com`
- Password: `admin123`
- Role: Admin (full access)

**Default Editor Account:**
- Email: `editor@church.com`
- Password: `editor123`
- Role: Editor (content management)

**New Users:**
- Automatically assigned "Viewer" role
- Can be upgraded by admins
- Stored in localStorage only

### ⚠️ Important Notes:

1. **Data Persistence:** All data is stored in browser localStorage, meaning:
   - Data persists across page refreshes
   - Data is specific to each browser/device
   - Clearing browser data will delete all content
   - No cloud sync or backup

2. **Supabase Files:** The `/supabase/` and `/utils/supabase/` directories exist but are:
   - Protected system files (cannot be deleted)
   - **NOT imported or used anywhere** in the application code
   - Safe to ignore - they generate harmless background errors

3. **Deployment Errors:** You may see Supabase deployment errors in console:
   - Error 544 (timeout)
   - Error 403 (forbidden)
   - These are **completely harmless** and don't affect functionality
   - They're just failed attempts to sync with a service we're not using

### 🎯 Summary:

This is a **fully functional, standalone web application** that requires no backend infrastructure. Everything runs in the browser with localStorage providing all data persistence needs.

---

*Last Updated: January 18, 2026*
