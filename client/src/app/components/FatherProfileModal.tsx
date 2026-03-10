import { X, Heart, Share2 } from 'lucide-react';
import { Father } from '../data/fathers';
import { useMemo } from 'react';

interface Saying {
  id: number;
  quote: string;
  author: string;
  authorImage: string;
  tags: string[];
  source: string;
  dateAdded: string;
}

interface FatherProfileModalProps {
  father: Father | null;
  sayings: Saying[];
  isOpen: boolean;
  onClose: () => void;
  favoritedQuotes: number[];
  onToggleFavorite: (quoteId: number) => void;
  onShare: (saying: Saying) => void;
}

export function FatherProfileModal({
  father,
  sayings,
  isOpen,
  onClose,
  favoritedQuotes,
  onToggleFavorite,
  onShare,
}: FatherProfileModalProps) {
  // Filter sayings by this father
  const fatherSayings = useMemo(() => {
    if (!father) return [];
    return sayings.filter(saying => saying.author === father.name);
  }, [sayings, father]);

  if (!isOpen || !father) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-[1000] flex items-center justify-center p-4 overflow-hidden">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 left-4 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-full p-3 transition-colors z-10"
        aria-label="إغلاق"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Main content - scrollable */}
      <div className="w-full max-w-4xl h-full overflow-y-auto bg-background rounded-2xl shadow-2xl">
        {/* Header Section with Father Info */}
        <div className="relative bg-gradient-to-b from-primary/10 to-background p-8 border-b border-border">
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-col items-center text-center gap-4">
              {/* Profile Image */}
              <img
                src={father.profileImage}
                alt={father.name}
                className="w-32 h-32 rounded-full object-cover border-4 border-primary/20 shadow-lg"
              />

              {/* Father Name */}
              <div>
                <h1 className="text-3xl font-bold mb-1">{father.name}</h1>
                {father.nameEnglish && (
                  <p className="text-lg text-muted-foreground">{father.nameEnglish}</p>
                )}
              </div>
            </div>

            {/* Bio Section */}
            <div className="mt-6 p-6 bg-card rounded-xl border border-border">
              <h2 className="text-lg font-bold mb-3 text-center">نبذة عن القديس</h2>
              <p className="text-muted-foreground leading-relaxed text-justify">
                {father.bio}
              </p>
            </div>
          </div>
        </div>

        {/* Quotes Section */}
        <div className="p-8">
          <div className="max-w-3xl mx-auto">
            {/* Section Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-1">أقوال القديس</h2>
              <p className="text-muted-foreground">
                {fatherSayings.length} قول مأثور
              </p>
            </div>

            {/* Quotes List - Simple vertical layout */}
            {fatherSayings.length > 0 ? (
              <div className="space-y-4">
                {fatherSayings.map((saying) => (
                  <div
                    key={saying.id}
                    className="bg-card rounded-xl border border-border p-5 hover:bg-muted transition-all"
                  >
                    {/* Quote Text */}
                    <blockquote className="text-foreground/90 leading-relaxed mb-4 text-base">
                      "{saying.quote}"
                    </blockquote>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {saying.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="text-xs px-2.5 py-1 bg-primary/10 text-primary rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-border/50">
                      <span className="text-sm text-muted-foreground">
                        المصدر: {saying.source}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onShare(saying);
                          }}
                          className="p-2 rounded-lg hover:bg-background transition-colors text-muted-foreground hover:text-foreground"
                          title="مشاركة"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(saying.id);
                          }}
                          className={`p-2 rounded-lg transition-colors ${
                            favoritedQuotes.includes(saying.id)
                              ? 'text-red-500 hover:text-red-600'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                          title="مفضلة"
                        >
                          <Heart
                            className={`w-4 h-4 ${
                              favoritedQuotes.includes(saying.id) ? 'fill-current' : ''
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-card rounded-xl border border-border">
                <p className="text-muted-foreground">لا توجد أقوال لهذا القديس بعد</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
