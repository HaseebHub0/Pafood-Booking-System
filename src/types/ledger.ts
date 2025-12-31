import { BaseEntity } from './common';

// Payment mode - deprecated (cash-only system, but kept for Order type compatibility)
export type PaymentMode = 'cash' | 'credit' | 'partial';

// Types of ledger transactions - Cash-only system
export type TransactionType = 'SALE_DELIVERED' | 'RETURN' | 'ADJUSTMENT' | 'PAYMENT_COLLECTION' | 'CREDIT_CREATED' | 'CREDIT_COLLECTED';

// Ledger transaction record - Cash-only system
export interface LedgerTransaction extends BaseEntity {
  // New structure (mandatory fields)
  ledger_id: string;          // Unique ledger entry ID (same as id from BaseEntity)
  created_at: string;         // ISO timestamp when entry was created
  region_id: string;          // Region ID
  branch_id?: string;         // Branch ID (optional, for branch-level entries)
  party_id: string;           // Shop ID (shopId)
  order_id?: string;          // Order ID (nullable, for SALE_DELIVERED)
  type: TransactionType;      // Type of transaction
  gross_amount: number;       // Σ(price × quantity) - total before discounts
  discount_allowed: number;   // Maximum allowed discount
  discount_given: number;     // Actual discount given
  unauthorized_discount: number; // discount_given - discount_allowed (if > 0)
  net_cash: number;           // gross_amount - discount_given (for SALE_DELIVERED)
  created_by: string;         // User ID who created this entry
  order_number?: string;      // Order number for display
  return_number?: string;     // Return number for display (for RETURN type)
  notes?: string;             // Additional notes
  
  // Legacy fields for migration compatibility (can be removed later)
  shopId?: string;            // Legacy: use party_id instead
  shopName?: string;          // Legacy: for display purposes
  date?: string;              // Legacy: use created_at instead
}

// Form data for adjustment (admin-only)
export interface AdjustmentFormData {
  party_id: string;           // Shop ID
  amount: number;             // Positive to add cash, negative to subtract
  notes: string;              // Required for adjustments
  branch_id?: string;         // Optional branch filter
}

// Filter options for ledger transactions
export interface LedgerFilter {
  party_id?: string;          // Shop ID filter
  type?: TransactionType;     // Transaction type filter
  region_id?: string;         // Region filter
  branch_id?: string;         // Branch filter
  startDate?: string;         // Start date filter
  endDate?: string;           // End date filter
  minAmount?: number;         // Minimum net_cash filter
  maxAmount?: number;         // Maximum net_cash filter
}


