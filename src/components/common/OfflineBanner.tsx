import { useEffect, useState } from 'react';

export const OfflineBanner = () => {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[80] bg-destructive px-4 py-2 text-center text-xs font-bold text-destructive-foreground">
      Mode hors ligne
    </div>
  );
};
