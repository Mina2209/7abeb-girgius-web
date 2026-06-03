import { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Presentation, 
  Download, 
  Eye, 
  Plus, 
  Edit2, 
  Trash2, 
  ArrowUpDown, 
  X, 
  Tags, 
  Heart,
  CheckSquare,
  Square,
  CheckCheck,
  UploadCloud
} from 'lucide-react';
import { useUniversalTopics } from '../hooks/useUniversalTopics';
import { useIsEditor } from '../utils/adminUtils';

interface LiturgyPresentation {
  id: number;
  title: string;
  description: string;
  category: string;
  tags: string[];
  fileUrl: string;
  downloadsCount: number;
  viewsCount: number;
  createdAt: string;
}

export function LiturgySection() {
  const isEditor = useIsEditor();
  const { topicNames } = useUniversalTopics();
  
  const [scrollProgress, setScrollProgress] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'title' | 'downloads' | 'latest'>('latest');

  const [favorites, setFavorites] = useState<number[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [newPresentation, setNewPresentation] = useState({
    title: '',
    description: '',
    category: '',
    tags: [] as string[],
    fileUrl: ''
  });

  const [presentations, setPresentations] = useState<LiturgyPresentation[]>([
    {
      id: 1,
      title: "القداس الباسيلي الكامل - للشعب",
      description: "عرض بوربوينت يحتوي على كافة صلوات ومردات القداس الباسيلي بالتناوب بين الكاهن والشعب.",
      category: "قداسات",
      tags: ["القداس الباسيلي"],
      fileUrl: "#",
      downloadsCount: 142,
      viewsCount: 380,
      createdAt: "2026-05-01"
    },
    {
      id: 2,
      title: "تسبحة كيهك الكاملة (السبعة والأربعة)",
      description: "ملف عرض تقديمي منسق بالكامل للتسبحة الكيهكية متضمناً الهوسات والمسابح والقطمارس.",
      category: "تسبحة",
      tags: ["كيهك"],
      fileUrl: "#",
      downloadsCount: 285,
      viewsCount: 610,
      createdAt: "2026-04-15"
    }
  ]);

  // مراقبة السكرول للإخفاء الناعم للهيدر
  useEffect(() => {
    const handleScroll = () => {
      const offset = window.scrollY;
      const progress = Math.min(offset / 120, 1);
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // الفلترة والترتيب للبيانات
  const filteredPresentations = useMemo(() => {
    return presentations
      .filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              item.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
        const matchesTag = selectedTag === 'all' || item.tags.includes(selectedTag);
        return matchesSearch && matchesCategory && matchesTag;
      })
      .sort((a, b) => {
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        if (sortBy === 'downloads') return b.downloadsCount - a.downloadsCount;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [presentations, searchQuery, selectedCategory, selectedTag, sortBy]);

  // منطق التحديد الجماعي
  const handleSelectCard = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(cardId => cardId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const allFilteredIds = filteredPresentations.map(p => p.id);
    if (selectedIds.length === allFilteredIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allFilteredIds);
    }
  };

  const toggleFavorite = (id: number) => {
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(favId => favId !== id) : [...prev, id]
    );
  };

  //  دالة معالجة إضافة العرض الجديد وحفظه في الـ State
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresentation.title || !newPresentation.category) return;

    const createdItem: LiturgyPresentation = {
      id: Date.now(),
      title: newPresentation.title,
      description: newPresentation.description,
      category: newPresentation.category,
      tags: newPresentation.tags,
      fileUrl: newPresentation.fileUrl || '#',
      downloadsCount: 0,
      viewsCount: 0,
      createdAt: new Date().toISOString().split('T')[0]
    };

    setPresentations(prev => [createdItem, ...prev]);
    setIsAddModalOpen(false);
    setNewPresentation({ title: '', description: '', category: '', tags: [], fileUrl: '' }); // تصفير الفورم
  };

  const handleTagToggle = (tag: string) => {
    setNewPresentation(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]
    }));
  };

  const categories = ['all', 'قداسات', 'تسبحة', 'أسبوع الآلام', 'أعياد ومناسبات'];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-4 space-y-6 relative min-h-screen pb-24">
      
      {/* Hide Header While Scrool*/}
      <div 
        style={{
          opacity: 1 - scrollProgress,
          maxHeight: `${(1 - scrollProgress) * 180}px`,
          transform: `translateY(${-scrollProgress * 15}px)`,
          marginBottom: `${(1 - scrollProgress) * 24}px`,
        }}
        className={`transition-all duration-300 ease-out overflow-hidden ${
          scrollProgress >= 0.9 ? 'pointer-events-none invisible' : 'pointer-events-auto visible'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="mb-2 font-bold text-[36px] tracking-tight text-foreground">
              بوربوينت الليتورجية
            </h1>
            <p className="text-muted-foreground text-base max-w-2xl">
              عروض تقديمية وملفات بوربوينت منسقة بالكامل للقداسات والصلوات الطقسية والتسابيح الكنسية.
            </p>
          </div>
          
          {/* زر فتح شاشة إضافة عرض جديد */}
          {isEditor && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-xl font-medium shadow-lg hover:bg-primary/90 active:scale-95 transition-all self-start md:self-center flex-shrink-0"
            >
              <Plus className="w-5 h-5" />
              <span>إضافة عرض جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* شريط البحث والفلترة الثابت (Sticky Bar) */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md py-3 border-b border-border pointer-events-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="ابحث في ملفات البوربوينت..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-11 py-2.5 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute left-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-md transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
            {isEditor && filteredPresentations.length > 0 && (
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 px-3 py-2.5 bg-card border border-border rounded-xl text-sm hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-all whitespace-nowrap"
              >
                {selectedIds.length === filteredPresentations.length ? (
                  <CheckCheck className="w-4 h-4 text-primary" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                <span>تحديد الكل</span>
              </button>
            )}

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 hover:bg-muted/50 cursor-pointer transition-colors"
            >
              <option value="all">كل الأقسام</option>
              {categories.filter(c => c !== 'all').map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="px-3 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 hover:bg-muted/50 cursor-pointer transition-colors"
            >
              <option value="all">كل الوسوم</option>
              {topicNames.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>

            <button
              onClick={() => setSortBy(prev => prev === 'latest' ? 'downloads' : prev === 'downloads' ? 'title' : 'latest')}
              className="flex items-center gap-2 px-4 py-2.5 bg-muted/60 border border-border rounded-xl text-sm hover:bg-muted active:scale-95 transition-all whitespace-nowrap"
            >
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
              <span>
                {sortBy === 'latest' ? 'الأحدث' : sortBy === 'downloads' ? 'الأكثر تحميلاً' : 'أبجدي'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* شبكة الـ Cards */}
      {filteredPresentations.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center p-12 bg-card border border-dashed border-border rounded-2xl">
          <Presentation className="w-12 h-12 text-muted-foreground mb-3 opacity-60" />
          <h3 className="text-lg font-bold">لا توجد نتائج مطابقة</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredPresentations.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <div 
                key={item.id}
                className={`group bg-card border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col relative cursor-pointer ${
                  isSelected ? 'border-primary ring-1 ring-primary/30' : 'border-border'
                }`}
                onClick={() => isEditor ? handleSelectCard(item.id) : null}
              >
                <div className="aspect-[4/3] w-full bg-gradient-to-br from-orange-500/10 to-amber-500/5 flex items-center justify-center relative border-b border-border overflow-hidden">
                  {isEditor && (
                    <div 
                      className={`absolute top-3 right-3 z-20 p-1 rounded-md transition-all ${
                        isSelected ? 'text-primary scale-100' : 'text-muted-foreground/60 sm:opacity-0 group-hover:opacity-100 scale-95 hover:scale-100'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectCard(item.id);
                      }}
                    >
                      {isSelected ? <CheckSquare className="w-5 h-5 fill-background" /> : <Square className="w-5 h-5 fill-background/40" />}
                    </div>
                  )}

                  <Presentation className="w-16 h-16 text-orange-500/80 group-hover:scale-110 transition-transform duration-300" />
                  
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(item.id);
                    }}
                    className="absolute top-3 left-3 p-2 bg-background/80 backdrop-blur-sm rounded-full border border-border text-muted-foreground hover:text-red-500 active:scale-90 transition-all shadow-sm z-10"
                  >
                    <Heart className={`w-4 h-4 transition-colors ${favorites.includes(item.id) ? 'fill-red-500 text-red-500' : ''}`} />
                  </button>

                  <span className="absolute bottom-3 right-3 px-2 py-0.5 bg-background/90 backdrop-blur-sm text-muted-foreground rounded-md text-[11px] font-medium border border-border">
                    {item.category}
                  </span>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1 pt-1">
                    {item.tags.map(tag => (
                      <span key={tag} className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded">
                        <Tags className="w-2.5 h-2.5" />
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/60 gap-2">
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => e.stopPropagation()} className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg active:scale-95 transition-all border border-border/50">
                        <Eye className="w-4 h-4" />
                      </button>
                      <a href={item.fileUrl} onClick={(e) => e.stopPropagation()} className="p-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg active:scale-95 transition-all border border-primary/20">
                        <Download className="w-4 h-4" />
                      </a>
                    </div>

                    {isEditor && (
                      <div className="flex items-center gap-1 border-r pr-2 border-border" onClick={(e) => e.stopPropagation()}>
                        <button className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-all active:scale-95">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-md transition-all active:scale-95">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* الفوتر  */}
      {isEditor && selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border shadow-2xl rounded-2xl px-6 py-4 flex items-center gap-6 min-w-[320px] md:min-w-[450px] animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground font-bold w-7 h-7 rounded-full flex items-center justify-center text-sm shadow-sm">
              {selectedIds.length}
            </div>
            <span className="text-sm font-medium text-muted-foreground">تم تحديدها</span>
          </div>
          <div className="h-5 w-px bg-border mx-1" />
          <div className="flex items-center gap-2 flex-1 justify-end">
            <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-border rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <Edit2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">تعديل جماعي</span>
            </button>
            <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-colors border border-red-500/10">
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">حذف جماعي</span>
            </button>
            <button onClick={() => setSelectedIds([])} className="p-2 text-muted-foreground hover:bg-muted rounded-xl transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* شاشة إضافة عرض جديد (Add Presentation Modal) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in scale-in duration-200 max-h-[90vh]">
            
            {/* رأس المودال */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2">
                <Presentation className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">إضافة ملف بوربوينت جديد</h2>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* محتوى الاستمارة / الفورم */}
            <form onSubmit={handleAddSubmit} className="p-6 overflow-y-auto space-y-4 no-scrollbar">
              
              {/* حقل العنوان */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">عنوان العرض التقديمي *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: القداس الباسيلي للشعب"
                  value={newPresentation.title}
                  onChange={(e) => setNewPresentation(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                />
              </div>

              {/* حقل الوصف */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">وصف مختصر</label>
                <textarea
                  rows={3}
                  placeholder="اكتب وصفاً محتويات الملف أو المناسبة الطقسية الخاصة به..."
                  value={newPresentation.description}
                  onChange={(e) => setNewPresentation(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none"
                />
              </div>

              {/* اختيار القسم الرئيسي */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">القسم الطقسي *</label>
                <select
                  required
                  value={newPresentation.category}
                  onChange={(e) => setNewPresentation(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer transition-all"
                >
                  <option value="" disabled>اختر القسم...</option>
                  {categories.filter(c => c !== 'all').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* اختيار الوسوم والتاغات المتاحة بالمنصة */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground flex items-center gap-1">
                  <span>الوسوم / الألحان المرتبطة</span>
                  <span className="text-xs font-normal text-muted-foreground">(اختياري)</span>
                </label>
                <div className="flex flex-wrap gap-1.5 p-3 bg-muted/20 border border-border rounded-xl max-h-28 overflow-y-auto no-scrollbar">
                  {topicNames.map(tag => {
                    const isSelected = newPresentation.tags.includes(tag);
                    return (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => handleTagToggle(tag)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                          isSelected 
                            ? 'bg-primary/20 text-primary border-primary' 
                            : 'bg-background border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* رفع ملف أو رابط الملف */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">رابط تحميل الملف (أو رفع ملف)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="ضع رابط ملف البوربوينت هنا..."
                    value={newPresentation.fileUrl}
                    onChange={(e) => setNewPresentation(prev => ({ ...prev, fileUrl: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                  />
                </div>
                
                {/* منطقة الرفع الوهمية للشكل الجمالي المتناسق مع بقية المنصة */}
                <div className="border border-dashed border-border hover:border-primary/50 transition-colors bg-muted/10 rounded-xl p-4 flex flex-col items-center justify-center gap-1 cursor-pointer group text-center">
                  <UploadCloud className="w-7 h-7 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-xs font-medium text-foreground">اسحب الملف هنا أو تصفح جهازك</span>
                  <span className="text-[10px] text-muted-foreground">يدعم ملفات PPTX, PPT بحد أقصى 50 ميجابايت</span>
                </div>
              </div>

              {/* أزرار الفوتر الخاصة بالحفظ والإلغاء */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold border border-border rounded-xl hover:bg-muted transition-colors text-muted-foreground"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors shadow-md"
                >
                  حفظ ونشر العرض
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}