              {/* Favorites Only Toggle - Only visible when user is logged in */}
              {user && profile && (
                <button
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 h-[42px] border rounded-xl transition-all relative whitespace-nowrap ${
                    showFavoritesOnly
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-card border-border hover:bg-muted'
                  }`}
                  title={showFavoritesOnly ? 'إظهار كل الترانيم' : 'عرض المفضلة فقط'}
                >
                  <Heart className={`w-4 h-4 flex-shrink-0 transition-all ${showFavoritesOnly ? 'fill-current' : ''}`} />
                  <span className="text-sm hidden lg:inline">المفضلة فقط</span>
                  {showFavoritesOnly && favoritedHymns.length > 0 && (
                    <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full px-2 py-0.5">
                      {favoritedHymns.length}
                    </span>
                  )}
                </button>
              )}
