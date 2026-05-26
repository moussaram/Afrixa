import { useState } from 'react';
import { formatTimeAgo } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Heart, MessageCircle, UserPlus, AtSign, Check, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { SkeletonList } from '@/components/common/SkeletonLoader';


const tabs = [
  { id: 'all', label: 'Tous' },
  { id: 'mentions', label: 'Mentions' },
  { id: 'likes', label: 'J\'aime' },
  { id: 'comments', label: 'Commentaires' },
  { id: 'followers', label: 'Abonnés' },
];

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'like':
      return <Heart className="w-4 h-4 text-destructive" fill="currentColor" />;
    case 'comment':
      return <MessageCircle className="w-4 h-4 text-accent" />;
    case 'follow':
      return <UserPlus className="w-4 h-4 text-primary" />;
    case 'mention':
      return <AtSign className="w-4 h-4 text-secondary" />;
    default:
      return null;
  }
};

const Notifications = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const { notifications, unreadCount, markRead, markAllRead, loading, reload } = useNotifications();
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  const filteredNotifications = activeTab === 'all'
    ? notifications
    : notifications.filter(n => {
        switch (activeTab) {
          case 'mentions': return n.type === 'mention';
          case 'likes': return n.type === 'like';
          case 'comments': return n.type === 'comment';
          case 'followers': return n.type === 'follow';
          default: return true;
        }
      });

  const handleFollow = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFollowingMap(prev => ({ ...prev, [userId]: !prev[userId] }));
  };


  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">Notifications</h1>
            {unreadCount > 0 && (
              <span className="min-w-5 h-5 flex items-center justify-center text-xs font-bold bg-destructive text-destructive-foreground rounded-full px-1.5">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="text-primary text-xs">
              <Check className="w-4 h-4 mr-1" />
              Tout lire
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto hide-scrollbar px-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "tab-item flex-shrink-0 px-4 py-3",
                activeTab === tab.id && "tab-item-active"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Notifications list */}
      <div className="divide-y divide-border/30">
        {loading ? (
          <div className="p-4">
            <SkeletonList rows={6} />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="w-20 h-20 rounded-full glass flex items-center justify-center mb-4">
              <Bell className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-center">
              Aucune notification pour le moment
            </p>
          </div>
        ) : (

          filteredNotifications.map((notification) => {
            const isFollowing = followingMap[notification.user.id] ?? notification.user.isFollowing;
            return (
              <div
                key={notification.id}
                className={cn(
                  "flex items-start gap-3 p-4 transition-colors duration-200 hover:bg-muted/30 cursor-pointer",
                  !notification.isRead && "bg-primary/5"
                )}
                onClick={() => {
                  markRead(notification.id);
                  if (notification.type === 'follow') navigate(`/user/${notification.user.id}`);
                }}
              >
                {/* User avatar with icon overlay */}
                <div className="relative flex-shrink-0">
                  <img
                    src={notification.user.avatar}
                    alt={notification.user.username}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-card border-2 border-background flex items-center justify-center">
                    {getNotificationIcon(notification.type)}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">{notification.user.username}</span>
                    {' '}
                    <span className="text-muted-foreground">{notification.message}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTimeAgo(notification.createdAt)}
                  </p>
                </div>

                {/* Right side: video thumbnail or follow button */}
                {notification.type === 'follow' ? (
                  <Button
                    size="sm"
                    variant={isFollowing ? 'outline' : 'gradient'}
                    className="flex-shrink-0 text-xs h-8 px-3"
                    onClick={(e) => handleFollow(notification.user.id, e)}
                  >
                    {isFollowing ? 'Abonné' : 'Suivre'}
                  </Button>
                ) : notification.video ? (
                  <div className="flex-shrink-0">
                    <img
                      src={notification.video.thumbnailUrl}
                      alt=""
                      className="w-12 h-16 rounded-md object-cover"
                    />
                  </div>
                ) : null}

                {/* Unread indicator */}
                {!notification.isRead && (
                  <div className="w-2 h-2 rounded-full gradient-primary flex-shrink-0 mt-2" />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Activity section */}
      <section className="mt-6 px-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">Activité récente</h2>
        <div className="space-y-4">
          <div className="p-4 glass rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center">
                <Heart className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">Cette semaine</p>
                <p className="text-sm text-muted-foreground">+1,234 j'aime sur vos vidéos</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 glass rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-secondary-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">Nouveaux abonnés</p>
                <p className="text-sm text-muted-foreground">+56 cette semaine</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Notifications;
