import { BaseEntity } from './common';

export type InvoiceStatus = 'draft' | 'generated' | 'sent' | 'paid' | 'cancelled';

export interface InvoiceItem {
  productId: string;
  productName: string;
  productNameUrdu?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  lineTotal: number;
}

export interface Invoice extends BaseEntity {
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  
  // Shop/Customer info
  shopId: string;
  shopName: string;
  ownerName: string;
  shopAddress: string;
  shopPhone: string;
  
  // Delivery info
  deliveryId?: string;
  deliveredAt?: string; // ISO timestamp
  
  // Invoice details
  items: InvoiceItem[];
  subtotal: number;
  totalDiscount: number;
  taxAmount?: number;
  grandTotal: number;
  paymentMode: 'cash' | 'credit' | 'partial';
  cashAmount: number;
  creditAmount: number;
  
  // Status
  status: InvoiceStatus;
  
  // Dates
  invoiceDate: string; // ISO date
  dueDate?: string; // ISO date (for credit sales)
  
  // Signature
  customerSignature?: string; // Base64 or URI
  signedAt?: string; // ISO timestamp
  signedBy?: string; // Customer name
  
  // Payment
  paidAmount?: number;
  paidAt?: string; // ISO timestamp
  paymentReference?: string;
  
  // Notes
  notes?: string;
  terms?: string; // Payment terms
}

export interface InvoiceFormData {
  orderId: string;
  deliveryId?: string;
  invoiceDate?: string;
  dueDate?: string;
  notes?: string;
  terms?: string;
}

// Generate invoice number
export const generateInvoiceNumber = (): string => {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `INV-${year}${month}-${random}`;
};

