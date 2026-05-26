import { supabase } from '@/integrations/supabase/client';

export const COMMISSION_RATES = {
  normale: 0.05,
  group_buy: 0.03,
  booste: 0.07,
  live: 0.08,
} as const;

export type CommissionType = keyof typeof COMMISSION_RATES;

export const calculateSplit = (totalAmount: number, type: CommissionType = 'normale') => {
  const rate = COMMISSION_RATES[type];
  const commissionAmount = Math.round(totalAmount * rate);
  const sellerAmount = totalAmount - commissionAmount;
  return { commissionAmount, sellerAmount, rate };
};

export const generateOrderRef = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `AFR-${timestamp}-${random}`;
};

export const getPaymentOption = (_operator: string) => 'mobilemoneyfranco,card';

let cachedPublicKey: string | null = null;
export const fetchFlutterwavePublicKey = async (): Promise<string> => {
  if (cachedPublicKey) return cachedPublicKey;
  const { data, error } = await supabase.functions.invoke('flutterwave-config');
  if (error || !data?.publicKey) throw new Error('Clé Flutterwave indisponible');
  cachedPublicKey = data.publicKey;
  return cachedPublicKey;
};

export interface FlutterwaveConfigParams {
  amount: number;
  currency?: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerName: string;
  orderRef: string;
  operator: string;
  metadata?: Record<string, unknown>;
  publicKey: string;
}

export const getFlutterwaveConfig = (p: FlutterwaveConfigParams) => ({
  public_key: p.publicKey,
  tx_ref: p.orderRef,
  amount: p.amount,
  currency: p.currency ?? 'XOF',
  payment_options: getPaymentOption(p.operator),
  customer: {
    email: p.buyerEmail,
    phone_number: p.buyerPhone,
    name: p.buyerName,
  },
  customizations: {
    title: 'Afrixa Marketplace',
    description: 'Paiement sécurisé Afrixa',
    logo: '/logo.png',
  },
  meta: p.metadata ?? {},
});

export const verifyFlutterwavePayment = async (
  transaction_id: string | number,
  tx_ref: string,
  expected_amount?: number,
) => {
  const { data, error } = await supabase.functions.invoke('flutterwave-verify', {
    body: { transaction_id, tx_ref, expected_amount },
  });
  if (error) throw error;
  return data as { verified: boolean; flwData: unknown };
};

export const maskPhone = (phone: string) => {
  if (phone.length < 4) return phone;
  return phone.slice(0, 2) + '***' + phone.slice(-2);
};
