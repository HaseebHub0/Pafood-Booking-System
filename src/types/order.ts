import { BaseEntity, SyncStatus } from './common';
import { PaymentMode } from './ledger';

export type OrderStatus = 'draft' | 'submitted' | 'finalized' | 'billed' | 'load_form_ready' | 'assigned' | 'delivered' | 'edit_requested';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;        // English name
  productNameUrdu?: string;   // Urdu name
  quantity: number;
  unitPrice: number;
  unit?: string;              // Product unit (Pcs, 1 Kg, etc.)
  discountPercent: number;
  lineTotal: number;
  discountAmount: number;
  finalAmount: number;
  maxAllowedDiscount: number;
  isUnauthorizedDiscount: boolean;
  unauthorizedAmount: number;
}

export interface Order extends BaseEntity {
  orderNumber: string;
  shopId: string;
  shopName: string;
  bookerId: string;
  bookerName?: string;  // Admin tracking: who created this order
  regionId: string; // Inherited from booker
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  totalDiscount: number;
  allowedDiscount: number;
  unauthorizedDiscount: number;
  grandTotal: number;
  notes: string;
  acknowledgedUnauthorizedDiscount: boolean;
  // Payment fields (legacy - kept for backward compatibility)
  paymentMode: PaymentMode;   // cash, credit, or partial
  cashAmount: number;         // Amount paid in cash
  creditAmount: number;       // Amount added to credit
  
  // Payment tracking (new fields for partial payment support)
  paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID';
  paidAmount?: number;          // Total amount paid across all payments
  remainingBalance?: number;    // Outstanding amount (grandTotal - paidAmount)
  // KPO finalization fields
  finalizedBy?: string; // KPO ID who finalized
  finalizedAt?: string; // Timestamp when finalized
  finalizedItems?: OrderItem[]; // Items with adjusted quantities
  billGenerated: boolean;
  loadFormGenerated: boolean;
}

export interface OrderTotals {
  subtotal: number;
  totalDiscount: number;
  allowedDiscount: number;
  unauthorizedDiscount: number;
  grandTotal: number;
  hasUnauthorizedDiscount: boolean;
  bookerLimitExceeded?: boolean;
  bookerLimitExcessAmount?: number;
}

export interface DiscountResult {
  totalAmount: number;
  totalAllowedDiscount: number;
  totalGivenDiscount: number;
  totalUnauthorizedDiscount: number;
  hasUnauthorizedDiscount: boolean;
  items: OrderItem[];
}

export interface SubmitOrderResult {
  success: boolean;
  requiresConfirmation: boolean;
  unauthorizedAmount?: number;
  message?: string;
}
