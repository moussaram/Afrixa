import { useState, useEffect, useRef } from 'react';
import { Share2, Download, Camera, ScanLine, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Simple QR code visual using SVG pattern (no external lib needed)
const QRCodeDisplay = ({ value }: { value: string }) => {
  // Generate a deterministic grid from the value string
  const size = 21;
  const grid: boolean[][] = [];
  
  for (let r = 0; r < size; r++) {
    grid[r] = [];
    for (let c = 0; c < size; c++) {
      // Finder patterns
      const inFinder = (
        (r < 7 && c < 7) ||
        (r < 7 && c >= size - 7) ||
        (r >= size - 7 && c < 7)
      );
      if (inFinder) {
        const lr = r % 7; const lc = c % 7;
        const rr = (r < 7 ? r : r - (size - 7)) % 7;
        const rc = (c < 7 ? c : c - (size - 7)) % 7;
        const row = r >= size - 7 ? r - (size - 7) : r;
        const col = c >= size - 7 ? c - (size - 7) : c;
        const inR = row < 7 && (col === 0 || col === 6 || row === 0 || row === 6 || (row >= 2 && row <= 4 && col >= 2 && col <= 4));
        grid[r][c] = inR;
      } else {
        // Data from hash of value
        const hash = [...value].reduce((h, ch) => ((h << 5) - h + ch.charCodeAt(0)) | 0, 0);
        grid[r][c] = ((hash + r * 31 + c * 17) % 3) !== 0;
      }
    }
  }

  const cellSize = 10;
  const padding = 16;
  const totalSize = size * cellSize + padding * 2;

  return (
    <svg width={totalSize} height={totalSize} viewBox={`0 0 ${totalSize} ${totalSize}`} className="rounded-2xl">
      <rect width={totalSize} height={totalSize} fill="white" rx="12" />
      {grid.map((row, r) =>
        row.map((filled, c) =>
          filled ? (
            <rect
              key={`${r}-${c}`}
              x={padding + c * cellSize}
              y={padding + r * cellSize}
              width={cellSize - 1}
              height={cellSize - 1}
              fill="hsl(var(--foreground))"
              rx="1"
            />
          ) : null
        )
      )}
    </svg>
  );
};

type Mode = 'view' | 'scan';

export const QRCodePanel = () => {
  const [mode, setMode] = useState<Mode>('view');
  const [scanning, setScanning] = useState(false);
  const { profile } = useAuth();
  const username = profile?.username || 'utilisateur';
  const avatarUrl = profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face';
  const profileUrl = `https://afrixa.app/@${username}`;

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: `Profil de @${username}`, url: profileUrl });
    } else {
      navigator.clipboard.writeText(profileUrl);
      toast.success('Lien copié dans le presse-papier');
    }
  };

  const handleDownload = () => {
    toast.success('QR Code sauvegardé dans la galerie');
  };

  const handleScan = () => {
    setScanning(true);
    toast.info('Caméra activée — Pointez vers un QR Code');
    setTimeout(() => {
      setScanning(false);
      toast.success('Profil trouvé : @dancequeen — Redirection...');
    }, 3000);
  };

  return (
    <div className="flex flex-col items-center px-4 py-6 gap-5">
      {/* Toggle */}
      <div className="flex rounded-xl bg-muted/30 p-1 w-full max-w-xs">
        <button
          onClick={() => setMode('view')}
          className={cn(
            'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
            mode === 'view' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground'
          )}
        >
          Mon QR
        </button>
        <button
          onClick={() => setMode('scan')}
          className={cn(
            'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
            mode === 'scan' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground'
          )}
        >
          Scanner
        </button>
      </div>

      {mode === 'view' ? (
        <>
          {/* QR Code */}
          <div className="relative p-4 rounded-3xl bg-white shadow-2xl shadow-primary/20">
            <QRCodeDisplay value={profileUrl} />
            {/* Avatar overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-12 h-12 rounded-full border-4 border-white overflow-hidden shadow-lg">
                <img loading="lazy" src={avatarUrl} alt="" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-lg font-bold text-foreground">@{username}</p>
            <p className="text-sm text-muted-foreground mt-0.5">Scannez pour accéder à mon profil</p>
          </div>

          {/* Gradient background indicator */}
          <div className="w-full max-w-xs">
            <p className="text-xs text-center text-muted-foreground mb-3">Personnaliser le fond</p>
            <div className="flex justify-center gap-2">
              {['from-primary to-secondary', 'from-pink-500 to-orange-400', 'from-cyan-400 to-blue-600', 'from-green-400 to-teal-600'].map((gradient, i) => (
                <button
                  key={i}
                  className={cn(
                    'w-8 h-8 rounded-full bg-gradient-to-br transition-all hover:scale-110',
                    gradient,
                    i === 0 && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                  )}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 w-full max-w-xs">
            <Button variant="glass" className="flex-1 gap-2" onClick={handleShare}>
              <Share2 className="w-4 h-4" /> Partager
            </Button>
            <Button variant="gradient" className="flex-1 gap-2" onClick={handleDownload}>
              <Download className="w-4 h-4" /> Sauvegarder
            </Button>
          </div>
        </>
      ) : (
        <div className="w-full max-w-xs flex flex-col items-center gap-4">
          {/* Scanner */}
          <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black/80 border-2 border-primary/40">
            {scanning ? (
              <>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-primary rounded-xl relative">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary rounded-br-lg" />
                    {/* Scan line animation */}
                    <div className="absolute left-0 right-0 h-0.5 bg-primary shadow-[0_0_8px_hsl(var(--primary))] animate-[scanLine_2s_ease-in-out_infinite]" style={{ animation: 'scanLine 2s ease-in-out infinite' }} />
                  </div>
                </div>
                <p className="absolute bottom-4 left-0 right-0 text-center text-white/80 text-sm">Analyse en cours...</p>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Camera className="w-12 h-12 text-white/40" />
                <p className="text-white/60 text-sm text-center px-4">Appuyez pour activer la caméra</p>
              </div>
            )}
          </div>

          <Button
            variant={scanning ? 'outline' : 'gradient'}
            className="w-full gap-2"
            onClick={handleScan}
            disabled={scanning}
          >
            <ScanLine className="w-4 h-4" />
            {scanning ? 'Scan en cours...' : 'Scanner un QR Code'}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Pointez votre caméra vers le QR Code d'un profil pour y accéder directement
          </p>
        </div>
      )}
    </div>
  );
};
