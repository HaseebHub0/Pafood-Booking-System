import { BaseEntity } from './common';
import { Shop } from './shop';

export type EditRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ShopEditRequest extends BaseEntity {
  shopId: string;
  shopName: string; // Current shop name
  
  // Requested changes
  requestedChanges: Partial<{
    shopName: string;
    ownerName: string;
    phone: string;
    city: string;
    area: string;
    address: string;
    // creditLimit removed - Cash-only system
  }>;
  
  // Current values (for comparison)
  currentValues: Partial<{
    shopName: string;
    ownerName: string;
    phone: string;
    city: string;
    area: string;
    address: string;
    // creditLimit removed - Cash-only system
  }>;
  
  // Status
  status: EditRequestStatus;
  
  // Request details
  requestedBy: string; // Booker ID
  requestedByName: string; // Booker name
  requestedAt: string; // ISO timestamp
  
  // Approval details
  approvedBy?: string; // KPO/Admin ID
  approvedByName?: string;
  approvedAt?: string; // ISO timestamp
  rejectedReason?: string;
  
  // Notes
  requestNotes?: string;
  approvalNotes?: string;
}

export interface EditRequestFormData {
  shopId: string;
  changes: Partial<{
    shopName: string;
    ownerName: string;
    phone: string;
    city: string;
    area: string;
    address: string;
    // creditLimit removed - Cash-only system
  }>;
  notes?: string;
}

