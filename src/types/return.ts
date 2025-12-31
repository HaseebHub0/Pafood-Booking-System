import { BaseEntity } from './common';

export type ReturnStatus = 'pending' | 'pending_kpo_approval' | 'approved' | 'rejected' | 'processed';
export type ReturnReason = 'expired' | 'damaged' | 'wrong_product' | 'defective' | 'other';

export interface ReturnItem {
  productId: string;
  productName: string;
  productNameUrdu?: string;
  orderId?: string; // Reference to original order
  orderNumber?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  returnReason: ReturnReason;
  condition?: string; // Description of condition
  photos?: string[]; // Photo URIs (future feature)
}

export interface StockReturn extends BaseEntity {
  returnNumber: string;
  shopId: string;
  shopName: string;
  ownerName: string;
  
  // Return details
  items: ReturnItem[];
  totalValue: number; // Total value of returned items
  
  // Status
  status: ReturnStatus;
  
  // Assignment
  salesmanId: string;
  salesmanName: string;
  collectedAt?: string; // ISO timestamp when collected from shop
  
  // Warehouse
  receivedAt?: string; // ISO timestamp when received at warehouse
  receivedBy?: string; // Warehouse staff ID
  warehouseNotes?: string;
  
  // Approval
  approvedBy?: string; // Manager/Admin ID
  approvedAt?: string; // ISO timestamp
  rejectionReason?: string;
  
  // Notes
  notes?: string;
  shopNotes?: string; // Notes from shopkeeper
}

export interface ReturnFormData {
  shopId: string;
  items: Omit<ReturnItem, 'productName' | 'productNameUrdu'>[];
  notes?: string;
  shopNotes?: string;
}

// Generate return number
export const generateReturnNumber = (): string => {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const day = String(new Date().getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `RET-${year}${month}${day}-${random}`;
};

