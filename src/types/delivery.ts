import { BaseEntity } from './common';
import { LocationCoordinates } from '../services/location';

export type DeliveryStatus = 'pending' | 'assigned' | 'in_transit' | 'delivered' | 'failed' | 'returned';

export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export type DeliveryFailureReason = 
  | 'shop_closed' 
  | 'refused_delivery' 
  | 'wrong_address' 
  | 'customer_not_available' 
  | 'damaged_goods' 
  | 'other';

export interface PaymentRecord {
  id: string;
  amount: number;
  paidAt: string; // ISO timestamp
  collectedBy: string; // Salesman ID
  notes?: string;
}

export interface DeliveryItem {
  productId: string;
  productName: string;
  quantity: number;
  deliveredQuantity: number; // May be less than ordered if partial delivery
  unit: string;
  unitPrice: number;
}

export interface Delivery extends BaseEntity {
  orderId: string;
  orderNumber: string;
  shopId: string;
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  regionId: string; // Inherited from order
  
  // Assignment
  salesmanId: string;
  salesmanName: string;
  assignedAt: string; // ISO timestamp
  assignedBy?: string; // Manager/Admin ID (KPO who generated load form)
  
  // Status
  status: DeliveryStatus;
  
  // Delivery details
  items: DeliveryItem[];
  totalAmount: number;
  deliveredAmount: number; // May differ if partial delivery
  
  // Timing
  scheduledDeliveryDate?: string; // ISO date
  dispatchedAt?: string; // ISO timestamp
  deliveredAt?: string; // ISO timestamp
  deliveryDuration?: number; // Minutes from dispatch to delivery
  
  // Location
  deliveryLocation?: LocationCoordinates;
  deliveryAddress?: string; // Actual delivery address if different
  
  // Payment (legacy fields - kept for backward compatibility)
  paymentCollected: boolean;
  paymentAmount?: number;
  paymentMode?: 'cash' | 'credit' | 'partial';
  paymentCollectedAt?: string; // ISO timestamp
  
  // Payment tracking (new fields for partial payment support)
  paymentStatus?: PaymentStatus;
  paidAmount?: number;          // Total amount paid across all payments
  remainingBalance?: number;    // Outstanding amount (totalAmount - paidAmount)
  paymentHistory?: PaymentRecord[]; // Array of payment transactions
  
  // Invoice
  invoiceGenerated: boolean;
  invoiceNumber?: string;
  invoiceSigned: boolean;
  customerSignature?: string; // Base64 or URI
  
  // Failure/Return
  failureReason?: DeliveryFailureReason;
  failureNotes?: string;
  returnedItems?: DeliveryItem[]; // Items returned to warehouse
  
  // Notes
  deliveryNotes?: string;
  customerNotes?: string;
}

export interface DeliveryFormData {
  orderId: string;
  salesmanId: string;
  scheduledDeliveryDate?: string;
  notes?: string;
}

export interface DeliveryStats {
  totalDeliveries: number;
  pendingDeliveries: number;
  inTransitDeliveries: number;
  deliveredCount: number;
  failedDeliveries: number;
  totalAmount: number;
  deliveredAmount: number;
  collectionRate: number; // Percentage of deliveries with payment collected
  averageDeliveryTime: number; // Minutes
}

// Helper to calculate delivery stats
export const calculateDeliveryStats = (deliveries: Delivery[]): DeliveryStats => {
  const pending = deliveries.filter((d) => d.status === 'pending' || d.status === 'assigned').length;
  const inTransit = deliveries.filter((d) => d.status === 'in_transit').length;
  const delivered = deliveries.filter((d) => d.status === 'delivered').length;
  const failed = deliveries.filter((d) => d.status === 'failed').length;
  
  const totalAmount = deliveries.reduce((sum, d) => sum + d.totalAmount, 0);
  const deliveredAmount = deliveries
    .filter((d) => d.status === 'delivered')
    .reduce((sum, d) => sum + d.deliveredAmount, 0);
  
  const withPayment = deliveries.filter((d) => d.paymentCollected).length;
  const collectionRate = deliveries.length > 0 ? (withPayment / deliveries.length) * 100 : 0;
  
  const deliveredDeliveries = deliveries.filter((d) => d.status === 'delivered' && d.deliveryDuration);
  const averageDeliveryTime =
    deliveredDeliveries.length > 0
      ? deliveredDeliveries.reduce((sum, d) => sum + (d.deliveryDuration || 0), 0) /
        deliveredDeliveries.length
      : 0;

  return {
    totalDeliveries: deliveries.length,
    pendingDeliveries: pending,
    inTransitDeliveries: inTransit,
    deliveredCount: delivered,
    failedDeliveries: failed,
    totalAmount,
    deliveredAmount,
    collectionRate,
    averageDeliveryTime,
  };
};

