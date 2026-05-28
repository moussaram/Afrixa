import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

type CreatorPageShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
};

export const CreatorPageShell = ({ title, subtitle, children, action }: CreatorPageShellProps) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-24 text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0A0A0F]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold">{title}</h1>
            {subtitle && <p className="truncate text-sm text-[#9CA3AF]">{subtitle}</p>}
          </div>
          {action}
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5">{children}</main>
    </div>
  );
};
