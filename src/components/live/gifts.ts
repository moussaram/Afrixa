export interface GiftItem {
  id: string;
  emoji: string;
  name: string;
  value: number;
  fromUser: string;
}

export const GIFTS = [
  { emoji: 'ðŸŒ¹', name: 'Rose', value: 1 },
  { emoji: 'ðŸŽ', name: 'Cadeau', value: 5 },
  { emoji: 'ðŸ’Ž', name: 'Diamant', value: 20 },
  { emoji: 'ðŸ†', name: 'TrophÃ©e', value: 50 },
  { emoji: 'ðŸš€', name: 'FusÃ©e', value: 100 },
  { emoji: 'ðŸ‘‘', name: 'Couronne', value: 200 },
];
