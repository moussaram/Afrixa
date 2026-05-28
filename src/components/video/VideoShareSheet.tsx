import QRCode from 'qrcode.react';
import { Copy, Facebook, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { copyShareLink, shareTargets } from '@/lib/share';

interface VideoShareSheetProps {
  url: string;
  title: string;
  allowDownload?: boolean;
  onClose: () => void;
}

export const VideoShareSheet = ({ url, title, allowDownload, onClose }: VideoShareSheetProps) => {
  const targets = shareTargets(url, title);

  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/60">
      <section className="w-full rounded-t-3xl bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black">Partager</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <a className="rounded-2xl bg-muted p-3 text-center text-xs font-bold" href={targets.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
          <a className="rounded-2xl bg-muted p-3 text-center text-xs font-bold" href={targets.facebook} target="_blank" rel="noreferrer"><Facebook className="mx-auto mb-1 h-4 w-4" />Facebook</a>
          <a className="rounded-2xl bg-muted p-3 text-center text-xs font-bold" href={targets.twitter} target="_blank" rel="noreferrer"><Send className="mx-auto mb-1 h-4 w-4" />X</a>
          <button className="rounded-2xl bg-muted p-3 text-center text-xs font-bold" onClick={() => copyShareLink(url)}><Copy className="mx-auto mb-1 h-4 w-4" />Copier</button>
        </div>
        <div className="mx-auto mt-5 w-fit rounded-2xl bg-white p-3">
          <QRCode value={url} size={144} />
        </div>
        {allowDownload && <Button className="mt-5 h-12 w-full rounded-2xl">Telecharger</Button>}
      </section>
    </div>
  );
};
