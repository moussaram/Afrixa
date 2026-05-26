import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { User } from '@/types';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ReportUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  onBlock?: () => void;
}

const reportReasons = [
  { id: 'spam', label: 'Spam' },
  { id: 'harassment', label: 'Harcèlement' },
  { id: 'inappropriate', label: 'Contenu inapproprié' },
  { id: 'hate', label: 'Discours haineux' },
  { id: 'impersonation', label: "Usurpation d'identité" },
  { id: 'scam', label: 'Arnaque/Fraude' },
  { id: 'violence', label: 'Violence' },
  { id: 'other', label: 'Autre' },
];

export const ReportUserDialog = ({
  open,
  onOpenChange,
  user,
  onBlock,
}: ReportUserDialogProps) => {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [blockUser, setBlockUser] = useState(true);
  const [deleteConversation, setDeleteConversation] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) return;

    setIsSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (blockUser && onBlock) {
      onBlock();
    }

    setIsSubmitting(false);
    setIsSubmitted(true);

    // Reset after showing success
    setTimeout(() => {
      toast({
        title: 'Signalement envoyé',
        description: 'Merci pour votre signalement. Notre équipe va examiner ce compte.',
      });
      onOpenChange(false);
      // Reset state
      setSelectedReason('');
      setDetails('');
      setBlockUser(true);
      setDeleteConversation(true);
      setIsSubmitted(false);
    }, 1500);
  };

  const handleClose = (value: boolean) => {
    if (!isSubmitting) {
      onOpenChange(value);
      if (!value) {
        setSelectedReason('');
        setDetails('');
        setBlockUser(true);
        setDeleteConversation(true);
        setIsSubmitted(false);
      }
    }
  };

  if (isSubmitted) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Merci pour votre signalement
            </h3>
            <p className="text-sm text-muted-foreground text-center">
              Notre équipe va examiner ce compte dans les 24 à 48 heures.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>Signaler @{user.username}</DialogTitle>
              <DialogDescription className="text-xs">
                Aidez-nous à comprendre le problème
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Reason selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Pourquoi signalez-vous ce compte ?</Label>
            <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
              <div className="grid grid-cols-1 gap-2">
                {reportReasons.map((reason) => (
                  <div
                    key={reason.id}
                    className="flex items-center space-x-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedReason(reason.id)}
                  >
                    <RadioGroupItem value={reason.id} id={reason.id} />
                    <Label htmlFor={reason.id} className="cursor-pointer flex-1 text-sm">
                      {reason.label}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* Additional details */}
          <div className="space-y-2">
            <Label htmlFor="details" className="text-sm font-medium">
              Détails supplémentaires (optionnel)
            </Label>
            <Textarea
              id="details"
              placeholder="Décrivez le problème en détail..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="resize-none h-20"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {details.length}/500
            </p>
          </div>

          {/* Additional options */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="block"
                checked={blockUser}
                onCheckedChange={(checked) => setBlockUser(checked as boolean)}
              />
              <Label htmlFor="block" className="text-sm cursor-pointer">
                Bloquer @{user.username}
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <Checkbox
                id="delete"
                checked={deleteConversation}
                onCheckedChange={(checked) => setDeleteConversation(checked as boolean)}
              />
              <Label htmlFor="delete" className="text-sm cursor-pointer">
                Supprimer la conversation
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isSubmitting}
            className="flex-1"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedReason || isSubmitting}
            className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isSubmitting ? 'Envoi...' : 'Envoyer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
