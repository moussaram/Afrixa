export interface GiftItem {
  id: string;
  emoji: string;
  name: string;
  coins: number;
  fromUser: string;
}

/** Cadeau tel que configure cote serveur (table virtual_gifts). */
export interface GiftCatalogEntry {
  id: string;
  name: string;
  emoji: string;
  price_coins: number;
  fcfa_value: number;
  sort_order: number;
}
