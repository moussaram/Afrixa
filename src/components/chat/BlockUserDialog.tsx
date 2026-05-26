import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from '@/types';
import { ShieldX, MessageCircleOff, Eye, EyeOff } from 'lucide-react';

interface BlockUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  onConfirm: () => void;
}

export const BlockUserDialog = ({
  open,
  onOpenChange,
  user,
  onConfirm,
}: BlockUserDialogProps) => {
  const [isBlocking, setIsBlocking] = useState(false);

  const handleBlock = async () => {
    setIsBlocking(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    onConfirm();
    setIsBlocking(false);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Avatar className="w-16 h-16">
                <AvatarImage src={user.avatar} alt={user.username} />
                <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-destructive flex items-center justify-center">
                <ShieldX className="w-4 h-4 text-destructive-foreground" />
              </div>
            </div>
          </div>
          <AlertDialogTitle>Bloquer @{user.username} ?</AlertDialogTitle>
          <AlertDialogDescription className="text-left space-y-3 mt-4">
            <p className="text-sm text-muted-foreground">
              Cette personne ne pourra plus :
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm">
                <MessageCircleOff className="w-4 h-4 text-muted-foreground" />
                <span>Vous envoyer de messages</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Eye className="w-4 h-4 text-muted-foreground" />
                <span>Voir vos stories</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <EyeOff className="w-4 h-4 text-muted-foreground" />
                <span>Voir votre statut en ligne</span>
              </li>
            </ul>
            <p className="text-xs text-muted-foreground pt-2">
              Vous pouvez débloquer cette personne à tout moment dans les paramètres.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2 sm:flex-row">
          <AlertDialogCancel className="flex-1 m-0">Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleBlock}
            disabled={isBlocking}
            className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isBlocking ? 'Blocage...' : 'Bloquer'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
