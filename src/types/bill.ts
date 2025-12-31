import { BaseEntity } from './common';

export type BillPaymentStatus = 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';
export type BillCreditStatus = 'PARTIAL' | 'FULL_CREDIT' | 'NONE';

export interface Bill extends BaseEntity {
  // Bill identification
  billNumber: string;
  
  // Related entity IDs
  orderId: string;
  orderNumber: string;
  deliveryId?: string;
  invoiceId?: string;
  
  // Booker information (credit owner)
  bookerId: string;
  bookerName?: string;
  
  // Salesman information (cash handler)
  salesmanId: string;
  salesmanName: string;
  
  // Customer/Shop information
  shopId: string;
  shopName: string;
  customerName: string; // Usually shop owner name
  
  // Amounts
  totalAmount: number;        // Total bill amount
  paidAmount: number;         // Total amount paid so far
  remainingCredit: number;    // Outstanding credit amount
  
  // Payment status
  paymentStatus: BillPaymentStatus;
  creditStatus: BillCreditStatus;
  
  // Dates
  billedAt: string;           // ISO timestamp when bill was created
  paidAt?: string;            // ISO timestamp when fully paid
  
  // Region/Branch
  regionId: string;
  branch?: string;
  
  // Notes
  notes?: string;
}

// Generate bill number
export const generateBillNumber = (): string => {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const day = String(new Date().getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `BILL-${year}${month}${day}-${random}`;
};

