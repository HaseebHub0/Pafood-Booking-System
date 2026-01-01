/**
 * Shared Configuration and Types for Data Integrity Scripts
 */

// Firebase configuration - matches src/config/firebase.ts
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDga2U0A0hvwblpWCJyB8f-LP4Hp_vszAM",
  authDomain: "pakasianfood-field.firebaseapp.com",
  projectId: "pakasianfood-field",
  storageBucket: "pakasianfood-field.firebasestorage.app",
  messagingSenderId: "756905212386",
  appId: "1:756905212386:web:36a46686a78ce2f1a821bb",
  measurementId: "G-1BM5GLBEVS"
};

// Configuration constants
export const CONFIG = {
  DRY_RUN: process.env.DRY_RUN !== 'false', // Default: true (safe)
  BATCH_SIZE: 500, // Firestore batch limit
  COLLECTIONS: {
    LEDGER: 'ledger_transactions',
    DELIVERIES: 'deliveries',
    ORDERS: 'orders'
  }
};

// Type definitions
export interface LedgerEntry {
  id: string;
  ledger_id?: string;
  order_id?: string;
  orderId?: string; // Legacy field
  type: 'SALE_DELIVERED' | 'RETURN' | 'SALE' | 'ADJUSTMENT' | 'PAYMENT_COLLECTION' | 'CREDIT_CREATED' | 'CREDIT_COLLECTED';
  region_id?: string;
  regionId?: string; // Legacy field
  branch_id?: string;
  branchId?: string; // Legacy field
  party_id?: string;
  shopId?: string; // Legacy field
  net_cash: number;
  gross_amount?: number;
  discount_given?: number;
  discount_allowed?: number;
  unauthorized_discount?: number;
  created_at?: string;
  createdAt?: string; // Legacy field
  created_by?: string;
  order_number?: string;
  return_number?: string;
  notes?: string;
  [key: string]: any; // Allow other fields
}

export interface Delivery {
  id: string;
  orderId: string;
  orderNumber?: string;
  shopId: string;
  shopName?: string;
  status: string;
  createdAt: string;
  created_at?: string; // Legacy field
  updatedAt?: string;
  totalAmount?: number;
  [key: string]: any; // Allow other fields
}

export interface Order {
  id: string;
  orderNumber?: string;
  shopId: string;
  status: string;
  regionId?: string;
  branch?: string;
  createdAt?: string;
  [key: string]: any;
}

// Analysis Report Types
export interface DuplicateSale {
  orderId: string;
  orderNumber?: string;
  entries: Array<{
    ledgerId: string;
    createdAt: string;
    net_cash: number;
    region_id?: string;
    branch_id?: string;
    hasCompleteFields: boolean;
  }>;
  keepEntry: string; // ledgerId to keep
  deleteEntries: string[]; // ledgerIds to delete
}

export interface MissingFieldsEntry {
  ledgerId: string;
  orderId?: string;
  orderNumber?: string;
  type: string;
  missingFields: string[];
  net_cash: number;
}

export interface DuplicateDelivery {
  orderId: string;
  orderNumber?: string;
  deliveries: Array<{
    deliveryId: string;
    status: string;
    createdAt: string;
  }>;
  keepDelivery: string; // deliveryId to keep
  deleteDeliveries: string[]; // deliveryIds to delete
}

export interface AnalysisReport {
  timestamp: string;
  ledgerIssues: {
    duplicateSales: DuplicateSale[];
    missingFields: MissingFieldsEntry[];
    statistics: {
      totalLedgerEntries: number;
      totalSaleEntries: number;
      totalReturnEntries: number;
      duplicateSaleOrders: number;
      missingFieldEntries: number;
    };
  };
  deliveryIssues: {
    duplicateDeliveries: DuplicateDelivery[];
    statistics: {
      totalDeliveries: number;
      duplicateDeliveryOrders: number;
    };
  };
}

// Cleanup Log Types
export interface CleanupLog {
  timestamp: string;
  operation: 'delete' | 'keep';
  collection: string;
  documentId: string;
  orderId?: string;
  reason: string;
  amount?: number;
  net_cash?: number;
  dryRun: boolean;
}

export interface CleanupReport {
  timestamp: string;
  dryRun: boolean;
  operations: CleanupLog[];
  statistics: {
    totalDeletions: number;
    totalKept: number;
    ledgerDeletions: number;
    deliveryDeletions: number;
  };
}

// Verification Report Types
export interface IntegrityCheck {
  name: string;
  passed: boolean;
  message: string;
  violations?: any[];
  statistics?: any;
}

export interface IntegrityReport {
  timestamp: string;
  checks: IntegrityCheck[];
  overallStatus: 'PASS' | 'FAIL';
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
  };
}

