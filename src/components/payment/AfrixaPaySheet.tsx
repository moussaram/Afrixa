import { useState } from 'react';
import { X, ArrowLeft, Phone, Minus, Plus, MapPin, MessageSquare, ShieldCheck, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { YangoDeliveryStep } from './YangoDeliveryStep';
import type { DeliveryMethod } from './yango';


interface PaymentProduct {
  name: string;
  price: number;
  currency: string;
  imageUrl: string;
  sellerName: string;
  sellerVerified?: boolean;
  sellerId?: string;
}

interface AfrixaPaySheetProps {
  product: PaymentProduct;
  onClose: () => void;
  customPrice?: number;
  subtitle?: string;
  commissionType?: 'normale' | 'group_buy' | 'booste' | 'live';
}

const paymentMethods = [
  { id: 'orange_money', name: 'Orange Money', color: 'bg-orange-500', emoji: '🟠' },
  { id: 'wave', name: 'Wave', color: 'bg-blue-500', emoji: '🔵' },
  { id: 'mtn', name: 'MTN MoMo', color: 'bg-yellow-500', emoji: '🟡' },
  { id: 'moov', name: 'Moov Money', color: 'bg-blue-600', emoji: '🔵' },
];

const generateOrderNumber = () => {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `#AFR-${num}`;
};

export const AfrixaPaySheet = ({ product, onClose, customPrice, subtitle }: AfrixaPaySheetProps) => {
  const [step, setStep] = useState<number>(1);
  const [quantity, setQuantity] = useState(1);
  const [address, setAddress] = useState('');
  const [buyerNote, setBuyerNote] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('yango');
  const [yangoAddress, setYangoAddress] = useState('');
  const sellerAddress = `Boutique ${product.sellerName}`;

  const unitPrice = customPrice ?? product.price;
  const totalPrice = unitPrice * quantity;
  const selectedPayment = paymentMethods.find(m => m.id === selectedMethod);
  const yangoLink = buildYangoDeepLink(sellerAddress, yangoAddress || address);

  const goBack = () => {
    if (step === 2) setStep(1.5);
    else if (step === 1.5) setStep(1);
    else if (step === 3) setStep(2);
  };

  const openYango = () => {
    window.open(yangoLink, '_blank', 'noopener,noreferrer');
  };



