import { type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Compass, PlusSquare, Bell, UserRound, Store, MessageCircle,
  Clapperboard, Coins, Settings, Search, ShoppingBag, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/contexts/useAuth';

type DesktopShellProps = { children: ReactNode; enabled?: boolean };

const primaryLinks = [
  { to: '/', label: 'Accueil', icon: Home },
  { to: '/discover', label: 'Découvrir', icon: Compass },
  { to: '/marketplace', label: 'Marketplace', icon: Store },\n  { to: '/live/setup', label: 'Afrixa Live', icon: Radio },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/create', label: 'Créer une publication', icon: PlusSquare },
  { to: '/profile', label: 'Profil', icon: UserRound },
];

const toolsLinks = [
  { to: '/creators/studio', label: 'Studio créateur', icon: Clapperboard },
  { to: '/coins', label: 'Mes pièces', icon: Coins },\n  { to: '/creators/wallet', label: 'Portefeuille créateur', icon: Wallet },\n  { to: '/ads', label: 'Publicités', icon: Megaphone },\n  { to: '/my-shop', label: 'Ma boutique', icon: Store },
  { to: '/orders', label: 'Mes commandes', icon: ShoppingBag },
  { to: '/settings', label: 'Paramètres', icon: Settings },
];

export const DesktopShell = ({ children, enabled = true }: DesktopShellProps) => {
  const location = useLocation();
  const { unreadCount } = useNotifications();
  const { profile } = useAuth();
  const username = profile?.username || 'Mon profil';

  if (!enabled) return <>{children}</>;

  const renderLink = (item: (typeof primaryLinks)[number] | (typeof toolsLinks)[number]) => {
    const active = item.to === '/'
      ? location.pathname === '/'
      : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
    const Icon = item.icon;
    const badge = item.to === '/notifications' && unreadCount > 0 ? unreadCount : null;

    return (
      <Link
        key={item.to}
        to={item.to}
        title={item.label}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
          active
            ? 'bg-primary/15 font-semibold text-primary'
            : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
        )}
      >
        <span className="relative shrink-0">
          <Icon className="h-5 w-5" />
          {badge !== null && (
            <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </span>
        <span className="afrixa-desktop-nav-label truncate">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="afrixa-desktop-shell min-h-screen bg-background">
      <header className="afrixa-desktop-topbar fixed inset-x-0 top-0 z-[60] flex h-16 items-center justify-between border-b border-border/70 bg-background/95 px-4 backdrop-blur-xl">
        <Link to="/" className="flex w-10 shrink-0 items-center gap-2 text-xl font-extrabold tracking-tight lg:w-[220px]">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary text-lg text-white">A</span>
          <span className="afrixa-desktop-brand">Afrixa</span>
        </Link>
        <div className="mx-2 hidden min-w-0 flex-1 md:block lg:mx-5 lg:max-w-xl">
          <Link to="/search" className="flex h-10 items-center gap-3 rounded-full bg-muted/80 px-4 text-sm text-muted-foreground transition-colors hover:bg-muted">
            <Search className="h-4 w-4" />
            Rechercher sur Afrixa
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link to="/create" aria-label="Créer" title="Créer" className="rounded-full bg-muted p-2.5 text-foreground hover:bg-muted/70">
            <PlusSquare className="h-5 w-5" />
          </Link>
          <Link to="/messages" aria-label="Messages" title="Messages" className="rounded-full bg-muted p-2.5 text-foreground hover:bg-muted/70">
            <MessageCircle className="h-5 w-5" />
          </Link>
          <Link to="/profile" className="ml-1 flex items-center gap-2 rounded-full p-1.5 pr-3 hover:bg-muted">
            <span className="flex h-8 w-8 items-center justify-center rounded-full gradient-primary text-xs font-bold text-white">
              {username.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden max-w-28 truncate text-sm font-medium lg:block">{username}</span>
          </Link>
        </div>
      </header>

      <aside className="afrixa-desktop-left fixed bottom-0 left-0 top-16 z-40 overflow-y-auto border-r border-border/60 bg-background px-3 py-5">
        <nav aria-label="Navigation principale" className="space-y-1">
          {primaryLinks.map(renderLink)}
        </nav>
        <div className="my-5 border-t border-border/70" />
        <p className="afrixa-desktop-nav-label mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Vos espaces</p>
        <nav aria-label="Vos espaces" className="space-y-1">
          {toolsLinks.map(renderLink)}
        </nav>
        <div className="afrixa-desktop-nav-label mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-primary" /> Afrixa
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">Le réseau qui rapproche les talents, les communautés et les commerces africains.</p>
        </div>
      </aside>

      <main className="afrixa-shell-main min-h-screen pt-16">
        <div className="afrixa-shell-content min-h-[calc(100vh-4rem)]">
          {children}
        </div>
      </main>

      <aside className="afrixa-desktop-right fixed right-0 top-16 hidden h-[calc(100vh-4rem)] overflow-y-auto border-l border-border/60 bg-background/70 px-5 py-6 2xl:block">
        <section className="rounded-2xl border border-border/70 bg-card/70 p-4">
          <h2 className="mb-2 text-sm font-bold text-foreground">Bienvenue sur Afrixa</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">Retrouve les publications, les créateurs et les boutiques depuis un seul espace.</p>
        </section>
        <section className="mt-5">
          <h2 className="mb-3 text-sm font-bold text-foreground">Accès rapides</h2>
          <div className="space-y-1">
            <Link to="/marketplace" className="flex items-center gap-3 rounded-xl p-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"><Store className="h-4 w-4" /> Explorer les boutiques</Link>
            <Link to="/creators/studio" className="flex items-center gap-3 rounded-xl p-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"><Clapperboard className="h-4 w-4" /> Espace créateur</Link>
            <Link to="/orders" className="flex items-center gap-3 rounded-xl p-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"><ShoppingBag className="h-4 w-4" /> Suivre mes commandes</Link>
          </div>
        </section>
        <p className="mt-8 text-[11px] leading-relaxed text-muted-foreground">Afrixa · Communauté, création et commerce.</p>
      </aside>
    </div>
  );
};
