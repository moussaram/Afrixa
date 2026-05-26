import { useState } from 'react';
import { X, Search, Star, TrendingUp, Palette, Sparkles, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export interface Effect {
  id: string;
  name: string;
  preview: string;
  category: string;
}

interface EffectsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEffect: (effect: Effect | null) => void;
  selectedEffect: Effect | null;
}

const categories = [
  { id: 'trending', label: 'Tendances', icon: TrendingUp },
  { id: 'favorites', label: 'Favoris', icon: Star },
  { id: 'beauty', label: 'Beauté', icon: Heart },
  { id: 'filters', label: 'Filtres', icon: Palette },
  { id: 'effects', label: 'Effets', icon: Sparkles },
];

const mockEffects: Effect[] = [
  { id: '1', name: 'Glow Up', preview: '✨', category: 'trending' },
  { id: '2', name: 'Vintage', preview: '📷', category: 'filters' },
  { id: '3', name: 'Neon', preview: '💜', category: 'effects' },
  { id: '4', name: 'Soft Skin', preview: '🌸', category: 'beauty' },
  { id: '5', name: 'B&W', preview: '⬛', category: 'filters' },
  { id: '6', name: 'Sunset', preview: '🌅', category: 'filters' },
  { id: '7', name: 'Sparkle', preview: '⭐', category: 'effects' },
  { id: '8', name: 'Blur BG', preview: '🔵', category: 'beauty' },
  { id: '9', name: 'Cinematic', preview: '🎬', category: 'filters' },
  { id: '10', name: 'Pop Art', preview: '🎨', category: 'effects' },
  { id: '11', name: 'Natural', preview: '🌿', category: 'beauty' },
  { id: '12', name: 'Warm', preview: '🔥', category: 'filters' },
];

export const EffectsPanel = ({ isOpen, onClose, onSelectEffect, selectedEffect }: EffectsPanelProps) => {
  const [selectedCategory, setSelectedCategory] = useState('trending');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEffects = mockEffects.filter(effect => {
    const matchesCategory = selectedCategory === 'favorites' 
      ? false // Would check user's favorites
      : effect.category === selectedCategory || selectedCategory === 'trending';
    const matchesSearch = effect.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[60vh] rounded-t-3xl">
        <SheetHeader className="pb-2">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-semibold">Effets</SheetTitle>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </SheetHeader>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher un effet..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-muted rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-3 hide-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all",
                selectedCategory === cat.id
                  ? "gradient-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <cat.icon className="w-4 h-4" />
              {cat.label}
            </button>
          ))}
        </div>

        {/* Effects Grid */}
        <div className="grid grid-cols-4 gap-3 overflow-y-auto max-h-[calc(60vh-200px)] pb-4">
          {/* No effect option */}
          <button
            onClick={() => onSelectEffect(null)}
            className={cn(
              "aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all",
              selectedEffect === null
                ? "ring-2 ring-primary bg-primary/10"
                : "bg-muted hover:bg-muted/80"
            )}
          >
            <X className="w-6 h-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Aucun</span>
          </button>

          {filteredEffects.map((effect) => (
            <button
              key={effect.id}
              onClick={() => onSelectEffect(effect)}
              className={cn(
                "aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all",
                selectedEffect?.id === effect.id
                  ? "ring-2 ring-primary bg-primary/10"
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              <span className="text-2xl">{effect.preview}</span>
              <span className="text-xs text-muted-foreground truncate w-full px-1 text-center">
                {effect.name}
              </span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};
