/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { toast } from '@/hooks/use-toast';

type CollabRequestButtonProps = {
  receiverId: string;
  videoId?: string;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const CollabRequestButton = ({ receiverId, videoId }: CollabRequestButtonProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('duo');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const sendRequest = async () => {
    if (!user?.id) return;
    if (!isUuid(user.id) || !isUuid(receiverId)) {
      toast({ title: 'Demande envoyee', description: 'Mode demonstration actif pour cette collab.' });
      setOpen(false);
      setMessage('');
      return;
    }
    try {
      setLoading(true);
      const { error } = await (supabase as any).from('collab_requests').insert({
        sender_id: user.id,
        receiver_id: receiverId,
        type,
        video_id: videoId || null,
        message: message.trim() || null,
      });
      if (error) throw error;
      toast({ title: 'Demande envoyee', description: 'Le createur recevra une notification de collaboration.' });
      setOpen(false);
      setMessage('');
    } catch (error) {
      toast({ title: 'Erreur', description: "La demande de collab n'a pas pu etre envoyee.", variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="glass" onClick={() => setOpen(true)}>
        <Users className="mr-2 h-4 w-4" />
        Collab
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-white/10 bg-[#1A1A2E] text-white">
          <DialogHeader>
            <DialogTitle>Proposer une Collab</DialogTitle>
            <DialogDescription>Choisis le format et ajoute un message court.</DialogDescription>
          </DialogHeader>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="Type de collab" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="duo">Duo</SelectItem>
              <SelectItem value="duet">Duet</SelectItem>
              <SelectItem value="stitch">Stitch</SelectItem>
            </SelectContent>
          </Select>
          <Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Message optionnel" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button className="bg-[#7C3AED]" disabled={loading} onClick={sendRequest}>Envoyer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
