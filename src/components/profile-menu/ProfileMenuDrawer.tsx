import { useState } from 'react';
import { X, Activity, WifiOff, QrCode, Building2, Clapperboard, ChevronRight, ArrowLeft, Store, Zap, Package, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ActivityCenter } from './ActivityCenter';
import { OfflineVideos } from './OfflineVideos';
import { QRCodePanel } from './QRCodePanel';
import { BusinessSuite } from './BusinessSuite';
import { EnetStudio } from './EnetStudio';

type MenuSection = null | 'activity' | 'offline' | 'qr' | 'business' | 'studio' | 'myshop' | 'boostprod' | 'orders' | 'wallet';

interface MenuItem {
  id: MenuSection;
  icon: React.ElementType;
  label: string;
  description: string;
  gradient: string;
  badge?: string;
}

const section1: MenuItem[] = [
  {
    id: 'activity',
    icon: Activity,
    label: 'Centre des activités',
    description: 'Vus, likes, commentaires, interactions',
    gradient: 'from-primary to-secondary',
  },
  {
    id: 'orders' as MenuSection,
    icon: Package,
    label: 'Mes commandes',
    description: 'Suivi de vos achats et paiements',
    gradient: 'from-emerald-500 to-green-400',
  },
  {
    id: 'offline',
    icon: WifiOff,
    label: 'Vidéos hors ligne',
    description: 'Téléchargez pour regarder sans internet',
    gradient: 'from-blue-500 to-cyan-400',
    badge: '2',
  },
  {
    id: 'qr',
    icon: QrCode,
    label: 'Ton code QR',
    description: 'Partager et scanner des profils',
    gradient: 'from-violet-500 to-purple-400',
  },
];

const section2: MenuItem[] = [
  {
    id: 'business',
    icon: Building2,
    label: 'Ensemble entreprise',
    description: 'Compte Business, stats avancées',
    gradient: 'from-orange-500 to-amber-400',
  },
  {
    id: 'studio',
    icon: Clapperboard,
    label: 'Afrixa Studio',
    description: 'Dashboard créateur, analytics, brouillons',
    gradient: 'from-green-500 to-teal-400',
    badge: 'NEW',
  },
];

const section3: MenuItem[] = [
  {
    id: 'myshop',
    icon: Store,
    label: 'Ma Boutique',
    description: 'Gérer mes produits, commandes, stock',
    gradient: 'from-orange-500 to-amber-400',
  },
  {
    id: 'wallet' as MenuSection,
    icon: Wallet,
    label: 'Portefeuille vendeur',
    description: 'Solde, historique, retrait Mobile Money',
    gradient: 'from-emerald-500 to-teal-400',
  },
  {
    id: 'boostprod',
    icon: Zap,
    label: 'Boost Produit',
    description: 'Mettre en avant tes produits dans le feed',
    gradient: 'from-green-500 to-emerald-400',
  },
];

const sectionTitles: Record<Exclude<MenuSection, null>, string> = {
  activity: 'Centre des activités',
  orders: 'Mes commandes',
  offline: 'Vidéos hors ligne',
  qr: 'Mon code QR',
  business: 'Ensemble entreprise',
  studio: 'Afrixa Studio',
  myshop: 'Ma Boutique',
  wallet: 'Portefeuille vendeur',
  boostprod: 'Boost Produit',
};

interface ProfileMenuDrawerProps {
  open: boolean;
  onClose: () => void;
}

import { useNavigate } from 'react-router-dom';

export const ProfileMenuDrawer = ({ open, onClose }: ProfileMenuDrawerProps) => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<MenuSection>(null);

  const handleClose = () => {
    setActiveSection(null);
    onClose();
  };

  const handleBack = () => {
    setActiveSection(null);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-background border-l border-border/30 flex flex-col',
          'transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-4 border-b border-border/20 glass shrink-0">
          {activeSection ? (
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          ) : (
            <div className="w-10" />
          )}
          <h2 className="flex-1 text-center font-bold text-foreground">
            {activeSection ? sectionTitles[activeSection] : 'Mon espace'}
          </h2>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="w-5 h-5" />
          </Button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeSection === null && (
            <div className="py-4">
              {/* Section 1 */}
              <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary">
                Outils personnels
              </p>
              <div className="mx-3 rounded-2xl bg-card/20 border border-border/20 overflow-hidden divide-y divide-border/20">
                {section1.map((item) => {
                  const Icon = item.icon;
                  return (
                     <button
                      key={item.id}
                      onClick={() => {
                        if (item.id === 'orders') {
                          handleClose();
                          navigate('/orders');
                        } else {
                          setActiveSection(item.id);
                        }
                      }}
                      className="w-full flex items-center gap-4 px-4 py-4 hover:bg-muted/30 active:bg-muted/50 transition-colors text-left"
                    >
                      <div className={cn('w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0', item.gradient)}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground text-sm">{item.label}</p>
                          {item.badge && (
                            <span className="text-xs font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>

              {/* Section 2 */}
              <p className="px-4 py-2 mt-4 text-xs font-semibold uppercase tracking-wider text-primary">
                Outils créateur & pro
              </p>
              <div className="mx-3 rounded-2xl bg-card/20 border border-border/20 overflow-hidden divide-y divide-border/20">
                {section2.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className="w-full flex items-center gap-4 px-4 py-4 hover:bg-muted/30 active:bg-muted/50 transition-colors text-left"
                    >
                      <div className={cn('w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0', item.gradient)}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground text-sm">{item.label}</p>
                          {item.badge && (
                            <span className={cn(
                              'text-xs font-bold px-1.5 py-0.5 rounded-full',
                              item.badge === 'NEW'
                                ? 'bg-green-500/10 text-green-500'
                                : 'bg-primary/10 text-primary'
                            )}>
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>

              {/* Section 3 - Boutique & Commerce */}
              <p className="px-4 py-2 mt-4 text-xs font-semibold uppercase tracking-wider text-primary">
                Boutique & Commerce
              </p>
              <div className="mx-3 rounded-2xl bg-card/20 border border-border/20 overflow-hidden divide-y divide-border/20">
                {section3.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.id === 'myshop') {
                          handleClose();
                          navigate('/my-shop');
                        } else if (item.id === 'boostprod') {
                          handleClose();
                          navigate('/boost');
                        } else if (item.id === 'wallet') {
                          handleClose();
                          navigate('/seller-wallet');
                        }
                      }}
                      className="w-full flex items-center gap-4 px-4 py-4 hover:bg-muted/30 active:bg-muted/50 transition-colors text-left"
                    >
                      <div className={cn('w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0', item.gradient)}>
                        <Icon className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm">{item.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-4 pt-6 pb-4">
                <p className="text-xs text-muted-foreground text-center">Afrixa · Version 2.0.0</p>
              </div>
            </div>
          )}

          {activeSection === 'activity' && <ActivityCenter />}
          {activeSection === 'offline' && <OfflineVideos />}
          {activeSection === 'qr' && <QRCodePanel />}
          {activeSection === 'business' && <BusinessSuite />}
          {activeSection === 'studio' && <EnetStudio />}
        </div>
      </div>
    </>
  );
};
