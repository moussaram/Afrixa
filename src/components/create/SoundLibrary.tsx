import { useState } from 'react';
import { X, Search, Play, Pause, Star, TrendingUp, Music, User, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';

export interface Sound {
  id: string;
  title: string;
  artist: string;
  duration: string;
  uses: number;
  preview?: string;
}

interface SoundLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSound: (sound: Sound | null) => void;
  selectedSound: Sound | null;
  volume: number;
  onVolumeChange: (volume: number) => void;
}

const categories = [
  { id: 'trending', label: 'Tendances', icon: TrendingUp },
  { id: 'favorites', label: 'Favoris', icon: Star },
  { id: 'mysounds', label: 'Mes sons', icon: User },
];

const mockSounds: Sound[] = [
  { id: '1', title: 'Amapiano Beat', artist: 'DJ Tarico', duration: '0:30', uses: 125000 },
  { id: '2', title: 'Afrobeats Vibes', artist: 'Burna Boy', duration: '0:45', uses: 89000 },
  { id: '3', title: 'Hausa Melody', artist: 'Traditional', duration: '0:20', uses: 45000 },
  { id: '4', title: 'Dance Challenge', artist: 'Various', duration: '0:15', uses: 230000 },
  { id: '5', title: 'Comedy Sound', artist: 'Unknown', duration: '0:10', uses: 67000 },
  { id: '6', title: 'Trending Beat #1', artist: 'Producer X', duration: '0:30', uses: 180000 },
];

const formatUses = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

export const SoundLibrary = ({ 
  isOpen, 
  onClose, 
  onSelectSound, 
  selectedSound,
  volume,
  onVolumeChange 
}: SoundLibraryProps) => {
  const [selectedCategory, setSelectedCategory] = useState('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);

  const togglePlay = (soundId: string) => {
    setPlayingId(prev => prev === soundId ? null : soundId);
  };

  const filteredSounds = mockSounds.filter(sound => 
    sound.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sound.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
        <SheetHeader className="pb-2">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-semibold">Ajouter un son</SheetTitle>
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
            placeholder="Rechercher un son..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-muted rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Volume Control */}
        {selectedSound && (
          <div className="mb-4 p-3 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-3">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <Slider
                value={[volume]}
                onValueChange={(v) => onVolumeChange(v[0])}
                max={100}
                step={1}
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground w-8">{volume}%</span>
            </div>
          </div>
        )}

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

        {/* Sounds List */}
        <div className="space-y-2 overflow-y-auto max-h-[calc(70vh-280px)] pb-4">
          {/* No sound option */}
          <button
            onClick={() => onSelectSound(null)}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
              selectedSound === null
                ? "bg-primary/10 ring-1 ring-primary"
                : "bg-muted/50 hover:bg-muted"
            )}
          >
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
              <X className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-foreground">Son original</p>
              <p className="text-sm text-muted-foreground">Utiliser l'audio de votre vidéo</p>
            </div>
          </button>

          {filteredSounds.map((sound) => (
            <div
              key={sound.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl transition-all",
                selectedSound?.id === sound.id
                  ? "bg-primary/10 ring-1 ring-primary"
                  : "bg-muted/50 hover:bg-muted"
              )}
            >
              {/* Play button */}
              <button
                onClick={() => togglePlay(sound.id)}
                className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0"
              >
                {playingId === sound.id ? (
                  <Pause className="w-5 h-5 text-primary-foreground" />
                ) : (
                  <Play className="w-5 h-5 text-primary-foreground ml-0.5" />
                )}
              </button>

              {/* Sound info */}
              <button
                onClick={() => onSelectSound(sound)}
                className="flex-1 text-left"
              >
                <p className="font-medium text-foreground truncate">{sound.title}</p>
                <p className="text-sm text-muted-foreground truncate">{sound.artist}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">{sound.duration}</span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">{formatUses(sound.uses)} vidéos</span>
                </div>
              </button>

              {/* Favorite button */}
              <button className="p-2 hover:bg-background/50 rounded-full transition-colors">
                <Star className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};
