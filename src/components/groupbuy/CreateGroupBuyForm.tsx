import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

interface CreateGroupBuyFormProps {
  productName: string;
  productPrice: number;
  currency: string;
  onClose: () => void;
}

export const CreateGroupBuyForm = ({ productName, productPrice, currency, onClose }: CreateGroupBuyFormProps) => {
  const [tiers, setTiers] = useState([{ people: '5', price: '' }, { people: '10', price: '' }]);
  const [duration, setDuration] = useState('24');

  const durations = [
    { value: '12', label: '12h' },
    { value: '24', label: '24h' },
    { value: '48', label: '48h' },
  ];

  const addTier = () => setTiers([...tiers, { people: '', price: '' }]);
  const removeTier = (i: number) => setTiers(tiers.filter((_, idx) => idx !== i));

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-[hsl(var(--background))] rounded-t-3xl border-t border-border/30 max-h-[85vh] overflow-y-auto">
        <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mt-3" />
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="font-bold text-foreground">🔥 Créer un Group Buy</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-4 pb-8 space-y-4">
          {/* Product info */}
          <div className="p-3 rounded-xl bg-card/30 border border-border/20">
            <p className="text-sm font-semibold text-foreground">{productName}</p>
            <p className="text-xs text-muted-foreground">Prix solo : {productPrice.toLocaleString()} {currency}</p>
          </div>

          {/* Tiers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">Paliers de réduction</h4>
              <button onClick={addTier} className="p-1 rounded-lg bg-primary/10 hover:bg-primary/20">
                <Plus className="w-4 h-4 text-primary" />
              </button>
            </div>
            {tiers.map((tier, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="number"
                  placeholder="Personnes"
                  value={tier.people}
                  onChange={e => {
                    const updated = [...tiers];
                    updated[i].people = e.target.value;
                    setTiers(updated);
                  }}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-card/30 border border-border/20 text-foreground placeholder:text-muted-foreground text-sm"
                />
                <input
                  type="number"
                  placeholder={`Prix (${currency})`}
                  value={tier.price}
                  onChange={e => {
                    const updated = [...tiers];
                    updated[i].price = e.target.value;
                    setTiers(updated);
                  }}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-card/30 border border-border/20 text-foreground placeholder:text-muted-foreground text-sm"
                />
                {tiers.length > 1 && (
                  <button onClick={() => removeTier(i)} className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Durée du groupe</h4>
            <div className="flex gap-2">
              {durations.map(d => (
                <button
                  key={d.value}
                  onClick={() => setDuration(d.value)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    duration === d.value
                      ? 'gradient-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => { console.log('Group buy created', { tiers, duration }); onClose(); }}
            className="w-full py-3.5 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-colors"
          >
            🔥 Lancer le Group Buy
          </button>
        </div>
      </div>
    </>
  );
};
