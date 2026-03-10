import { useState, useEffect } from 'react';
import { Heart, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { FlatIcon } from './icons/FlatIcon';
import { getDefaultBookCover } from './BooksSection';

// Icon wrapper components for Flaticon (matching navigation icons)
const MusicIcon = (props: any) => <FlatIcon iconClass="fi-ss-music-alt" {...props} />;
const PictureIcon = (props: any) => <FlatIcon iconClass="fi-sr-picture" {...props} />;
const BookOpenIcon = (props: any) => <FlatIcon iconClass="fi-sr-book-alt" {...props} />;
const QuoteIcon = (props: any) => <FlatIcon iconClass="fi-sr-comment-quote" {...props} />;

type FavoriteTab = 'hymns' | 'images' | 'books' | 'sayings';

export function FavoritesPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<FavoriteTab>('hymns');

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">يرجى تسجيل الدخول لعرض المفضلات</p>
        </div>
      </div>
    );
  }

  // Get favorites from localStorage
  const favoriteHymnIds = JSON.parse(localStorage.getItem('favoriteHymns') || '[]');
  const favoriteImageIds = JSON.parse(localStorage.getItem('favoriteImages') || '[]');
  const favoriteBookIds = JSON.parse(localStorage.getItem('user_favorites') || '{"books":[]}').books || [];
  const favoriteSayingIds = JSON.parse(localStorage.getItem('favoriteSayings') || '[]');

  // Mock data for display (in real app, this would fetch from the actual data arrays)
  const mockHymns = [
    { id: 1, title: 'تينثينو', occasion: 'تسبحة نصف الليل' },
    { id: 2, title: 'بي اويك', occasion: 'مديحة للعذراء' },
    { id: 4, title: 'شيري ني ماريا', occasion: 'مديحة للعذراء' },
  ];

  const mockImages = [
    { id: 1, url: 'https://images.unsplash.com/photo-1513279922550-d21f55b45469?w=400', title: 'فرح الطفولة' },
    { id: 3, url: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=400', title: 'الصلاة في الكنيسة' },
    { id: 5, url: 'https://images.unsplash.com/photo-1545231027-637d2f6210f8?w=400', title: 'التسبيح' },
    { id: 8, url: 'https://images.unsplash.com/photo-1438032005730-c779502df39b?w=400', title: 'الفرح الروحي' },
  ];

  const mockBooks = [
    { id: '1', title: 'حياة الصلاة الأرثوذكسية', author: 'متى المسكين', coverImage: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400' },
    { id: '2', title: 'تاريخ الكنيسة القبطية', author: 'إيريس حبيب المصري', coverImage: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400' },
  ];

  const mockSayings = [
    { id: 1, text: 'من يضرب الحديد وهو بارد لا ينجح في عمله، كذلك من يتراخى في جهاده.', author: 'القديس الأنبا أنطونيوس' },
    { id: 3, text: 'الصلاة هي نور النفس، وحياة الروح، وباب السماء.', author: 'القديس يوحنا ذهبي الفم' },
    { id: 5, text: 'ليس شيء يعدل محبة الله، ولا شيء أحلى من محبة القريب.', author: 'القديس مار إسحق السرياني' },
    { id: 7, text: 'اقرأ الكتاب المقدس كأنك تقرأ رسالة من السماء موجهة إليك شخصياً.', author: 'القديس يوحنا كرونستادت' },
    { id: 9, text: 'ليس من يبدأ بل من يثبت إلى المنتهى هو الذي يخلص.', author: 'القديس الأنبا أنطونيوس' },
  ];

  const favorites = {
    hymns: mockHymns.filter(h => favoriteHymnIds.includes(h.id)),
    images: mockImages.filter(i => favoriteImageIds.includes(i.id)),
    books: mockBooks.filter(b => favoriteBookIds.includes(b.id)),
    sayings: mockSayings.filter(s => favoriteSayingIds.includes(s.id)),
  };

  const stats = {
    hymns: favorites.hymns.length,
    images: favorites.images.length,
    books: favorites.books.length,
    sayings: favorites.sayings.length,
    total: favorites.hymns.length + favorites.images.length + favorites.books.length + favorites.sayings.length,
  };

  const tabs = [
    { id: 'hymns' as FavoriteTab, label: 'الترانيم', icon: MusicIcon, count: stats.hymns },
    { id: 'images' as FavoriteTab, label: 'الصور', icon: PictureIcon, count: stats.images },
    { id: 'books' as FavoriteTab, label: 'الكتب', icon: BookOpenIcon, count: stats.books },
    { id: 'sayings' as FavoriteTab, label: 'الأقوال', icon: QuoteIcon, count: stats.sayings },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-card rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Heart className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">المفضلات</h1>
            <p className="text-muted-foreground">جميع العناصر المفضلة لديك في مكان واحد</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-primary">{stats.total}</p>
            <p className="text-sm text-muted-foreground">إجمالي المفضلات</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold">{stats.hymns}</p>
            <p className="text-sm text-muted-foreground">ترانيم</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold">{stats.images}</p>
            <p className="text-sm text-muted-foreground">صور</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold">{stats.books}</p>
            <p className="text-sm text-muted-foreground">كتب</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold">{stats.sayings}</p>
            <p className="text-sm text-muted-foreground">أقوال</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card rounded-xl shadow-sm overflow-hidden">
        <div className="flex border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span>{tab.label}</span>
              <span className={`px-2 py-1 rounded-full text-xs ${
                activeTab === tab.id
                  ? 'bg-primary-foreground/20'
                  : 'bg-muted'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'hymns' && (
            <div className="space-y-4">
              {favorites.hymns.length === 0 ? (
                <EmptyState
                  icon={MusicIcon}
                  title="لا توجد ترانيم مفضلة"
                  description="ابدأ بإضافة الترانيم المفضلة لديك من مكتبة الترانيم"
                />
              ) : (
                favorites.hymns.map((hymn: any) => (
                  <FavoriteHymnCard key={hymn.id} hymn={hymn} />
                ))
              )}
            </div>
          )}

          {activeTab === 'images' && (
            <div className="space-y-4">
              {favorites.images.length === 0 ? (
                <EmptyState
                  icon={PictureIcon}
                  title="لا توجد صور مفضلة"
                  description="ابدأ بإضافة الصور المفضلة لديك من معرض الصور"
                />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {favorites.images.map((image: any) => (
                    <FavoriteImageCard key={image.id} image={image} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'books' && (
            <div className="space-y-4">
              {favorites.books.length === 0 ? (
                <EmptyState
                  icon={BookOpenIcon}
                  title="لا توجد كتب مفضلة"
                  description="ابدأ بإضافة الكتب المفضلة لديك من مكتبة الكتب الروحية"
                />
              ) : (
                favorites.books.map((book: any) => (
                  <FavoriteBookCard key={book.id} book={book} />
                ))
              )}
            </div>
          )}

          {activeTab === 'sayings' && (
            <div className="space-y-4">
              {favorites.sayings.length === 0 ? (
                <EmptyState
                  icon={QuoteIcon}
                  title="لا توجد أقوال مفضلة"
                  description="ابدأ بإضافة الأقوال المفضلة لديك من مكتبة أقوال الآباء"
                />
              ) : (
                favorites.sayings.map((saying: any) => (
                  <FavoriteSayingCard key={saying.id} saying={saying} />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="text-center py-12">
      <div className="w-20 h-20 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
        <Icon className="w-10 h-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

function FavoriteHymnCard({ hymn }: { hymn: any }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
      <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center">
        <MusicIcon className="w-6 h-6 text-primary" />
      </div>
      <div className="flex-1">
        <h3 className="font-medium">{hymn.title}</h3>
        <p className="text-sm text-muted-foreground">{hymn.occasion}</p>
      </div>
      <button className="text-destructive hover:bg-destructive/10 p-2 rounded-lg transition-colors">
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  );
}

function FavoriteImageCard({ image }: { image: any }) {
  return (
    <div className="relative group">
      <div className="aspect-square rounded-lg overflow-hidden bg-muted">
        <img src={image.url} alt={image.title} className="w-full h-full object-cover" />
      </div>
      <button className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function FavoriteBookCard({ book }: { book: any }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
      <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center">
        <BookOpenIcon className="w-6 h-6 text-primary" />
      </div>
      <div className="flex-1">
        <h3 className="font-medium">{book.title}</h3>
        <p className="text-sm text-muted-foreground">- {book.author}</p>
      </div>
      <button className="text-destructive hover:bg-destructive/10 p-2 rounded-lg transition-colors">
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  );
}

function FavoriteSayingCard({ saying }: { saying: any }) {
  return (
    <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
      <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
        <QuoteIcon className="w-6 h-6 text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-sm mb-2">{saying.text}</p>
        <p className="text-xs text-muted-foreground">- {saying.author}</p>
      </div>
      <button className="text-destructive hover:bg-destructive/10 p-2 rounded-lg transition-colors flex-shrink-0">
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  );
}