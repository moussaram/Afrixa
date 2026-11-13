import { Users, ShieldCheck } from 'lucide-react';

export const GroupBuyList = () => (
  <div className="px-4 py-16">
    <div className="max-w-sm mx-auto text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
        <Users className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-lg font-bold text-foreground">Achats groupés en préparation</h2>
      <p className="text-sm text-muted-foreground">
        Les groupes de démonstration ont été retirés. Les achats groupés seront réactivés lorsque les participants, les paiements et les remboursements en cas de seuil non atteint seront entièrement reliés à des données réelles.
      </p>
      <div className="flex items-start gap-2 rounded-xl border border-border/30 bg-card p-3 text-left">
        <ShieldCheck className="w-5 h-5 shrink-0 text-primary" />
        <p className="text-xs text-muted-foreground">
          Aucun paiement ne sera demandé tant que le parcours de remboursement ne sera pas sécurisé.
        </p>
      </div>
    </div>
  </div>
);
