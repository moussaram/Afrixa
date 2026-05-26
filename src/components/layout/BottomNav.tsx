import { Home, Search, Plus, Bell, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/hooks/useNotifications';

export const BottomNav = () => {
  const location = useLocation();
  const { unreadCount } = useNotifications();

  const navItems = [
    { path: '/', icon: Home, label: 'Accueil' },
    { path: '/discover', icon: Search, label: 'Découvrir' },
    { path: '/create', icon: Plus, label: 'Créer', isCreate: true },
    { path: '/notifications', icon: Bell, label: 'Notifications', badge: unreadCount > 0 ? unreadCount : undefined },
    { path: '/profile', icon: User, label: 'Profil' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border/30 safe-area-pb">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          if (item.isCreate) {
            return (
              <Link
                key={item.path}
                to={item.path}
                className="relative -mt-4"
              >
                <div className="w-12 h-8 gradient-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/30 hover:scale-110 transition-transform duration-200 active:scale-95">
                  <Plus className="w-6 h-6 text-primary-foreground" strokeWidth={2.5} />
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'nav-item relative p-2 min-w-[3rem]',
                isActive && 'nav-item-active'
              )}
            >
              <div className="relative">
                <Icon 
                  className={cn(
                    'w-6 h-6 transition-all duration-200',
                    isActive ? 'text-primary scale-110' : 'text-muted-foreground'
                  )} 
                />
                {item.badge && (
                  <span className="badge-notification">{item.badge}</span>
                )}
              </div>
              <span className={cn(
                'text-[10px] mt-1 transition-colors duration-200',
                isActive ? 'text-primary font-medium' : 'text-muted-foreground'
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
