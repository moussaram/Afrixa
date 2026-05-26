import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MarketplaceContent } from '@/components/marketplace/MarketplaceContent';

const Marketplace = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="flex-1 text-lg font-bold text-foreground">🛍️ Marketplace</h1>
        </div>
      </header>
      <MarketplaceContent />
    </div>
  );
};

export default Marketplace;
