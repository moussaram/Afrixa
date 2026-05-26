import { useState } from 'react';
import { Search, TrendingUp, X } from 'lucide-react';
import { mockVideos, categories, trendingHashtags, mockUsers } from '@/data/mockData';
import { VideoThumbnail } from '@/components/video/VideoThumbnail';
import { MarketplaceContent } from '@/components/marketplace/MarketplaceContent';
import { GroupBuyList } from '@/components/groupbuy/GroupBuyList';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/formatters';

const boutiqueCategory = { id: 'boutique', name: 'Boutique', icon: '🛍️' };
const groupBuyCategory = { id: 'groupbuy', name: 'Group Buy', icon: '⚡' };
const allCategories = [boutiqueCategory, groupBuyCategory, ...categories];

const Discover = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('boutique');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="px-4 py-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher des vidéos, utilisateurs, sons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              className="input-search pl-12 pr-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto hide-scrollbar">
          {allCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all duration-200",
                activeCategory === category.id
                  ? "gradient-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{category.icon}</span>
              <span className="text-sm font-medium">{category.name}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Marketplace Tab */}
      {activeCategory === 'boutique' && <MarketplaceContent />}

      {/* Group Buy Tab */}
      {activeCategory === 'groupbuy' && <GroupBuyList />}

      {/* Default discover content */}
      {activeCategory !== 'boutique' && activeCategory !== 'groupbuy' && (
        <>
          {(isSearchFocused || searchQuery) && (
            <div className="px-4 py-4 border-b border-border/30 animate-fade-in">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                {searchQuery ? `Résultats pour "${searchQuery}"` : 'Suggestions'}
              </h3>
              <div className="space-y-3">
                {mockUsers
                  .filter((u) =>
                    !searchQuery ||
                    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    u.displayName.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .slice(0, 5)
                  .map((user) => (
                    <div key={user.id} className="flex items-center gap-3">
                      <img loading="lazy" src={user.avatar} alt={user.username} className="w-10 h-10 rounded-full object-cover" />
                      <div className="flex-1">
                        <p className="font-medium text-foreground text-sm">{user.displayName}</p>
                        <p className="text-xs text-muted-foreground">@{user.username}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatNumber(user.followers)} abonnés</span>
                    </div>
                  ))}
                {searchQuery &&
                  mockUsers.filter((u) =>
                    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    u.displayName.toLowerCase().includes(searchQuery.toLowerCase())
                  ).length === 0 && (
                    <p className="text-sm text-muted-foreground">Aucun utilisateur trouvé</p>
                  )}
              </div>
            </div>
          )}

          <section className="px-4 py-4 border-b border-border/30">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Tendances</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {trendingHashtags.map((hashtag) => (
                <button key={hashtag.tag} className="px-4 py-2 glass rounded-full hover:bg-muted/80 transition-colors duration-200">
                  <span className="text-sm font-medium text-gradient">{hashtag.tag}</span>
                  <span className="text-xs text-muted-foreground ml-2">{hashtag.views} vues</span>
                </button>
              ))}
            </div>
          </section>

          <section className="px-4 py-4 border-b border-border/30">
            <h2 className="text-lg font-semibold text-foreground mb-3">Comptes suggérés</h2>
            <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
              {mockUsers.map((user) => (
                <div key={user.id} className="flex flex-col items-center gap-2 min-w-[80px]">
                  <div className="relative">
                    <img loading="lazy" src={user.avatar} alt={user.username} className="w-16 h-16 rounded-full object-cover border-2 border-primary" />
                    {user.isVerified && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full gradient-primary flex items-center justify-center border-2 border-background">
                        <span className="text-[8px] text-primary-foreground">✓</span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-medium text-foreground truncate max-w-[80px]">{user.username}</span>
                  <button className="px-3 py-1 text-xs font-medium gradient-primary text-primary-foreground rounded-md hover:scale-105 transition-transform">Suivre</button>
                </div>
              ))}
            </div>
          </section>

          <section className="px-2 py-4">
            <h2 className="text-lg font-semibold text-foreground mb-3 px-2">
              {searchQuery ? 'Vidéos correspondantes' : 'Vidéos populaires'}
            </h2>
            <div className="grid grid-cols-3 gap-1">
              {(() => {
                const q = searchQuery.toLowerCase().trim();
                const filtered = q
                  ? mockVideos.filter(
                      (v) =>
                        v.description.toLowerCase().includes(q) ||
                        v.user.username.toLowerCase().includes(q) ||
                        v.hashtags.some((t) => t.toLowerCase().includes(q))
                    )
                  : mockVideos;
                if (filtered.length === 0) {
                  return (
                    <p className="col-span-3 text-center text-sm text-muted-foreground py-8">
                      Aucune vidéo trouvée
                    </p>
                  );
                }
                return filtered.map((video) => (
                  <VideoThumbnail key={video.id} video={video} className="aspect-[9/16]" />
                ));
              })()}
            </div>
          </section>

        </>
      )}
    </div>
  );
};

export default Discover;
