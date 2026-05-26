import { useState } from 'react';
import { mockGroupBuys } from '@/data/mockGroupBuy';
import { GroupBuyCard } from './GroupBuyCard';
import { cn } from '@/lib/utils';

const filters = [
  { id: 'all', label: 'Tous' },
  { id: 'Mode', label: '👗 Mode' },
  { id: 'Électronique', label: '📱 Électronique' },
  { id: 'Beauté', label: '💄 Beauté' },
  { id: 'Maison', label: '🏠 Maison' },
];

const timeFilters = [
  { id: 'all', label: 'Tous' },
  { id: 'urgent', label: '🔴 Urgent (<6h)' },
  { id: 'tonight', label: '🌙 Ce soir' },
  { id: 'tomorrow', label: '☀️ Demain' },
];

export const GroupBuyList = () => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeTime, setActiveTime] = useState('all');

  let filtered = mockGroupBuys;
  if (activeCategory !== 'all') {
    filtered = filtered.filter(gb => gb.category === activeCategory);
  }
  if (activeTime === 'urgent') {
    filtered = filtered.filter(gb => new Date(gb.endsAt).getTime() - Date.now() < 6 * 3600000);
  } else if (activeTime === 'tonight') {
    filtered = filtered.filter(gb => new Date(gb.endsAt).getTime() - Date.now() < 12 * 3600000);
  } else if (activeTime === 'tomorrow') {
    filtered = filtered.filter(gb => new Date(gb.endsAt).getTime() - Date.now() < 36 * 3600000);
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Category filters */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setActiveCategory(f.id)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
              activeCategory === f.id ? 'gradient-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Time filters */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar">
        {timeFilters.map(f => (
          <button
            key={f.id}
            onClick={() => setActiveTime(f.id)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
              activeTime === f.id ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-muted text-muted-foreground'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map(gb => (
          <GroupBuyCard key={gb.id} groupBuy={gb} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-10">Aucun Group Buy actif dans cette catégorie</p>
      )}
    </div>
  );
};
