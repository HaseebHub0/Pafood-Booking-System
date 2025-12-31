import { BaseEntity } from './common';
import { PaymentStatus } from './delivery';

export type CreditStatus = 'PARTIAL' | 'FULL_CREDIT';

export interface OutstandingPayment extends BaseEntity {
  orderId: string;
  orderNumber: string;
  shopId: string;
  shopName: string;
  totalAmount: number;
  paidAmount: number;
  remainingBalance: number;
  deliveryDate: string; // ISO timestamp
  salesmanId: string;
  salesmanName: string;
  paymentStatus: PaymentStatus;
  deliveryId?: string; // Optional reference to delivery record
  
  // Booker information (credit owner)
  bookerId: string;
  bookerName?: string;
  
  // Bill reference
  billId?: string;
  
  // Credit status
  creditStatus?: CreditStatus;
}

