export const formatFCFA = (amount: number | null | undefined) =>
  `${new Intl.NumberFormat('fr-FR').format(amount ?? 0)} FCFA`;

export const formatCompact = (value: number | null | undefined) =>
  new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(value ?? 0);

export const creatorLevelLabel: Record<string, string> = {
  starter: 'Starter',
  rising: 'Rising',
  verified: 'Verified',
  elite: 'Elite',
};

export const creatorLevelColor: Record<string, string> = {
  starter: 'text-gray-300 bg-gray-500/15 border-gray-400/30',
  rising: 'text-sky-300 bg-sky-500/15 border-sky-400/30',
  verified: 'text-violet-300 bg-violet-500/15 border-violet-400/30',
  elite: 'text-amber-300 bg-amber-500/15 border-amber-400/30',
};
