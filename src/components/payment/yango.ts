export type DeliveryMethod = 'yango' | 'pickup';

export const buildYangoDeepLink = (sellerAddress: string, buyerAddress: string) => {
  const s = encodeURIComponent(sellerAddress || '');
  const b = encodeURIComponent(buyerAddress || '');
  return `https://ya.cc/maps/?rtext=${s}~${b}&rtt=auto`;
};
