import { BaseEntity } from './common';

export type LoadStatus = 'pending' | 'confirmed' | 'loaded';

export interface LoadFormItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  confirmedQuantity?: number; // Quantity confirmed by salesman
}

export interface LoadForm extends BaseEntity {
  deliveryId: string;
  orderId: string;
  orderNumber: string;
  shopId: string;
  shopName: string;
  
  // Items to load
  items: LoadFormItem[];
  totalQuantity: number; // Total items count
  
  // Load status
  status: LoadStatus;
  
  // Confirmation details
  confirmedAt?: string; // ISO timestamp when salesman confirmed
  loadedAt?: string; // ISO timestamp when actually loaded
  confirmedBy?: string; // Salesman ID
  confirmedByName?: string; // Salesman name
  
  // Warehouse info
  warehouseNotes?: string;
  loadNotes?: string;
}

export interface LoadFormFormData {
  deliveryId: string;
  confirmedQuantities: Record<string, number>; // productId -> confirmed quantity
  notes?: string;
}

