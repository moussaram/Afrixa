import { Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { mockUsers } from '@/data/mockData';

export const StoriesRail = () => (
  <div className="fixed left-0 right-0 top-14 z-40 flex gap-3 overflow-x-auto border-b border-border/20 bg-background/80 px-4 py-3 backdrop-blur">
    <button className="flex w-16 shrink-0 flex-col items-center gap-1">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-primary bg-primary/10">
        <Plus className="h-5 w-5 text-primary" />
      </span>
      <span className="w-full truncate text-[10px]">Story</span>
    </button>
    {mockUsers.slice(0, 8).map((user, index) => (
      <button key={user.id} className="flex w-16 shrink-0 flex-col items-center gap-1">
        <span className={index < 4 ? 'rounded-full bg-gradient-to-tr from-primary to-secondary p-0.5' : 'rounded-full p-0.5'}>
          <Avatar className="h-14 w-14 border-2 border-background">
            <AvatarImage src={user.avatar} />
            <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
          </Avatar>
        </span>
        <span className="w-full truncate text-[10px]">{user.username}</span>
      </button>
    ))}
  </div>
);
