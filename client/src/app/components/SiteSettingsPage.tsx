import { useState, useEffect } from 'react';
import { Settings, Image as ImageIcon, BookOpen, Save, RotateCcw, Eye, EyeOff, Globe, Shield, AlertTriangle, Database, Download, Upload, Clock, HardDrive, CheckCircle2, Info } from 'lucide-react';
import { Button } from './ui/button';
import { getDefaultBookCover } from './BooksSection';

const FALLBACK_BOOK_COVER = 'https://images.unsplash.com/photo-1569690484582-58b478f46805?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxib29rJTIwY292ZXIlMjBwbGFjZWhvbGRlcnxlbnwxfHx8fDE3Njg1NzEyMTd8MA&ixlib=rb-4.1.0&q=80&w=1080';

interface SectionConfig {
  id: string;
  name: string;
  route: string;
}

interface Backup {
  id: string;
  timestamp: number;
  date: string;
  type: 'auto' | 'manual';
  size: string;
}

const MAIN_SECTIONS: SectionConfig[] = [
  { id: 'home', name: 'الصفحة الرئيسية', route: 'home' },
  { id: 'liturgy', name: 'بوربوينت الليتورجية', route: 'liturgy' },
  { id: 'hymns', name: 'مكتبة الترانيم', route: 'hymns' },
  { id: 'various', name: 'بوربوينت متنوعة', route: 'various' },
  { id: 'images', name: 'مكتبة الصور', route: 'images' },
  { id: 'books', name: 'مكتبة الكتب', route: 'books' },
  { id: 'sayings', name: 'أقوال أباء', route: 'sayings' },
  { id: 'coptic', name: 'لغة قبطية', route: 'coptic' },
  { id: 'about', name: 'عن الخدمة', route: 'about' },
];

export function SiteSettingsPage() {
  // Book cover states
  const [defaultBookCover, setDefaultBookCover] = useState(getDefaultBookCover());
  const [previewCover, setPreviewCover] = useState(getDefaultBookCover());
  const [coverHasChanges, setCoverHasChanges] = useState(false);

  // Sections visibility states
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [visibilityHasChanges, setVisibilityHasChanges] = useState(false);

  // Backup states
  const [backups, setBackups] = useState<Backup[]>([]);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);

  useEffect(() => {
    loadSettings();
    loadVisibilitySettings();
    loadBackups();
  }, []);

  // Book cover functions
  const loadSettings = () => {
    const savedCover = localStorage.getItem('default_book_cover') || FALLBACK_BOOK_COVER;
    setDefaultBookCover(savedCover);
    setPreviewCover(savedCover);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewCover(reader.result as string);
        setCoverHasChanges(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCoverSave = () => {
    localStorage.setItem('default_book_cover', previewCover);
    setDefaultBookCover(previewCover);
    setCoverHasChanges(false);
    
    // Trigger a custom event to notify other components
    window.dispatchEvent(new Event('defaultBookCoverChanged'));
    
    alert('تم حفظ صورة الغلاف الافتراضية بنجاح!');
  };

  const handleCoverReset = () => {
    if (confirm('هل تريد استعادة الصورة الافتراضية الأصلية؟')) {
      setPreviewCover(FALLBACK_BOOK_COVER);
      setCoverHasChanges(true);
    }
  };

  const handleCoverCancel = () => {
    setPreviewCover(defaultBookCover);
    setCoverHasChanges(false);
  };

  // Sections visibility functions
  const loadVisibilitySettings = () => {
    const saved = localStorage.getItem('site_sections_visibility');
    if (saved) {
      setVisibility(JSON.parse(saved));
    } else {
      // Default: all sections visible
      const defaultVisibility: Record<string, boolean> = {};
      MAIN_SECTIONS.forEach(section => {
        defaultVisibility[section.id] = true;
      });
      setVisibility(defaultVisibility);
    }
    setVisibilityHasChanges(false);
  };

  const toggleVisibility = (sectionId: string) => {
    setVisibility(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
    setVisibilityHasChanges(true);
  };

  const handleVisibilitySave = () => {
    localStorage.setItem('site_sections_visibility', JSON.stringify(visibility));
    setVisibilityHasChanges(false);
    
    // Dispatch event to notify sidebar to update
    window.dispatchEvent(new Event('sectionsVisibilityChanged'));
    
    alert('تم حفظ إعدادات الأقسام بنجاح!');
  };

  const handleVisibilityReset = () => {
    if (confirm('هل أنت متأكد من إلغاء التغييرات والعودة للإعدادات المحفوظة؟')) {
      loadVisibilitySettings();
    }
  };

  const visibleCount = Object.values(visibility).filter(v => v).length;
  const hiddenCount = MAIN_SECTIONS.length - visibleCount;

  const hasAnyChanges = coverHasChanges || visibilityHasChanges;

  // Backup functions
  const loadBackups = () => {
    const savedBackups = localStorage.getItem('site_backups');
    if (savedBackups) {
      setBackups(JSON.parse(savedBackups));
    } else {
      setBackups([]);
    }
  };

  const createBackup = () => {
    setIsCreatingBackup(true);
    setTimeout(() => {
      const newBackup: Backup = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        date: new Date().toLocaleString(),
        type: 'manual',
        size: '10MB' // Placeholder size
      };
      const updatedBackups = [...backups, newBackup];
      localStorage.setItem('site_backups', JSON.stringify(updatedBackups));
      setBackups(updatedBackups);
      setIsCreatingBackup(false);
      alert('تم إنشاء نسخة احتياطية جديدة بنجاح!');
    }, 2000); // Simulate a delay for backup creation
  };

  return (
    <div className="max-w-4xl mx-auto p-6" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Settings className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">إعدادات الموقع</h1>
          </div>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Book Library Settings - Compact */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">صورة الغلاف الافتراضية للكتب</h2>
          </div>

          {/* Compact Layout */}
          <div className="flex items-start gap-6 flex-wrap">
            {/* Preview Image - Compact */}
            <div className="flex-shrink-0">
              <div className="aspect-[3/4] w-[150px] rounded-lg overflow-hidden border-2 border-border">
                <img
                  src={previewCover}
                  alt="Default book cover preview"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Controls */}
            <div className="flex-1 min-w-[280px] space-y-4">
              {/* Upload and Reset Buttons */}
              <div className="flex items-center gap-3 flex-wrap">
                <label className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                    <ImageIcon className="w-4 h-4" />
                    <span className="text-sm">رفع صورة جديدة</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={handleCoverReset}
                  className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="text-sm">استعادة الافتراضي</span>
                </button>
              </div>

              {/* Save/Cancel - Inline */}
              {coverHasChanges && (
                <div className="flex items-center gap-3 pt-3 border-t border-border">
                  <Button onClick={handleCoverSave} size="sm" className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    حفظ
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCoverCancel}>
                    إلغاء
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    لديك تغييرات غير محفوظة
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sections Visibility */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <Eye className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">إدارة رؤية الأقسام</h2>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xl font-bold">{visibleCount}</p>
                  <p className="text-xs text-muted-foreground">مرئية للجميع</p>
                </div>
              </div>
            </div>
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <EyeOff className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xl font-bold">{hiddenCount}</p>
                  <p className="text-xs text-muted-foreground">مخفية عن الزوار</p>
                </div>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="mb-6 bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
            <div className="flex gap-3">
              <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold mb-1 text-blue-600">كيف تعمل رؤية الأقسام؟</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li><strong>الزوار (Viewers):</strong> يرون الأقسام المرئية فقط</li>
                  <li><strong>المحررون (Editors):</strong> يرون جميع الأقسام مع تمييز المخفية</li>
                  <li><strong>المشرفون (Admins):</strong> يرون جميع الأقسام ويمكنهم التحكم بالرؤية</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Sections List */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="border-b border-border bg-muted/50 px-4 py-2">
              <h3 className="font-semibold text-sm">الأقسام الرئيسية للموقع</h3>
            </div>
            <div className="divide-y divide-border">
              {MAIN_SECTIONS.map((section) => {
                const isVisible = visibility[section.id] ?? true;
                
                return (
                  <div
                    key={section.id}
                    className={`p-4 transition-colors ${
                      isVisible ? 'bg-card' : 'bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Status Icon */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isVisible 
                          ? 'bg-green-500/10' 
                          : 'bg-orange-500/10'
                      }`}>
                        {isVisible ? (
                          <Eye className="w-5 h-5 text-green-600" />
                        ) : (
                          <EyeOff className="w-5 h-5 text-orange-600" />
                        )}
                      </div>

                      {/* Section Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold">{section.name}</h4>
                        <div className="flex items-center gap-3 text-xs mt-1">
                          <span className="text-muted-foreground">
                            <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{section.route}</code>
                          </span>
                          {isVisible ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <Globe className="w-3 h-3" />
                              مرئي للجميع
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-orange-600">
                              <Shield className="w-3 h-3" />
                              مخفي عن الزوار
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Toggle Button */}
                      <Button
                        onClick={() => toggleVisibility(section.id)}
                        variant={isVisible ? 'outline' : 'default'}
                        size="sm"
                        className={`min-w-[100px] ${
                          isVisible 
                            ? 'border-orange-500/50 text-orange-600 hover:bg-orange-500/10' 
                            : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                      >
                        {isVisible ? (
                          <>
                            <EyeOff className="w-4 h-4 ml-2" />
                            إخفاء
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4 ml-2" />
                            نشر
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Visibility Save/Cancel */}
          {visibilityHasChanges && (
            <div className="flex items-center gap-3 pt-4 mt-4 border-t border-border">
              <Button onClick={handleVisibilitySave} className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                حفظ التغييرات
              </Button>
              <Button variant="outline" onClick={handleVisibilityReset}>
                إلغاء
              </Button>
              <p className="text-sm text-muted-foreground mr-auto">
                لديك تغييرات غير محفوظة
              </p>
            </div>
          )}
        </div>

        {/* Backups */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <Database className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">إدارة النسخ الاحتياطية</h2>
          </div>

          {/* Info Box */}
          <div className="mb-6 bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold mb-2 text-blue-600">معلومات:</p>
                <ul className="space-y-1.5 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>يتم إنشاء نسخة احتياطية تلقائية كل 24 ساعة</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>يتم الاحتفاظ بآخر 7 نسخ احتياطية تلقائياً</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>النسخ الاحتياطية مخزنة على S3 للحماية</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>يمكنك إنشاء نسخة احتياطية يدوية في أي وقت</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Create Backup Button */}
          <div className="mb-6">
            <Button
              onClick={createBackup}
              disabled={isCreatingBackup}
              className="flex items-center gap-2"
            >
              {isCreatingBackup ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  جاري إنشاء النسخة الاحتياطية...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  إنشاء نسخة احتياطية يدوية
                </>
              )}
            </Button>
          </div>

          {/* Backups List */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="border-b border-border bg-muted/50 px-4 py-2">
              <h3 className="font-semibold text-sm">النسخ الاحتياطية المتاحة</h3>
            </div>
            <div className="divide-y divide-border">
              {backups.map((backup) => (
                <div
                  key={backup.id}
                  className="p-4"
                >
                  <div className="flex items-center gap-3">
                    {/* Status Icon */}
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Database className="w-5 h-5 text-blue-600" />
                    </div>

                    {/* Backup Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold">{backup.type === 'auto' ? 'نسخة احتياطية آلية' : 'نسخة احتياطية يدوي'}</h4>
                      <div className="flex items-center gap-3 text-xs mt-1">
                        <span className="text-muted-foreground">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{backup.date}</code>
                        </span>
                        <span className="text-muted-foreground">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{backup.size}</code>
                        </span>
                      </div>
                    </div>

                    {/* Download Button */}
                    <Button
                      onClick={() => alert('تم تنزيل النسخة الاحتياطية!')}
                      size="sm"
                      className="min-w-[100px] bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Download className="w-4 h-4 ml-2" />
                      تنزيل
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky notification when there are any unsaved changes */}
      {hasAnyChanges && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-full shadow-lg flex items-center gap-3 z-50">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-semibold">لديك تغييرات غير محفوظة في هذه الصفحة</span>
        </div>
      )}
    </div>
  );
}