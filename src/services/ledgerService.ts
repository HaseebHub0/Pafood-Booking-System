/**
 * Ledger Service - Single Source of Truth for Ledger Entry Creation
 * 
 * Cash-only system: All financial transactions are recorded in ledger entries.
 * This service ensures consistent ledger entry structure and calculations.
 */

import { LedgerTransaction, AdjustmentFormData } from '../types/ledger';
import { Order } from '../types/order';
import { StockReturn } from '../types/return';
import { v4 as uuidv4 } from 'uuid';

// Firebase imports
const getFirebaseImports = async () => {
  const { firestoreService } = await import('./firebase');
  const { COLLECTIONS } = await import('./firebase/collections');
  return { firestoreService, COLLECTIONS };
};

/**
 * Create ledger entry when order is delivered
 * 
 * Formula:
 * - gross_amount = subtotal (Σ(price × quantity))
 * - discount_allowed = allowedDiscount
 * - discount_given = totalDiscount
 * - unauthorized_discount = max(0, discount_given - discount_allowed)
 * - net_cash = gross_amount - discount_given
 */
/**
 * Validate required fields for ledger entry
 */
function validateLedgerEntryFields(order: Order, regionId: string, branchId?: string): void {
  if (!order.id) {
    throw new Error('Order ID is required for ledger entry');
  }
  if (!regionId || regionId.trim() === '') {
    throw new Error('Region ID is required for ledger entry');
  }
  // branchId is optional, but if order has branch, we should use it
  if (!branchId && !order.branch) {
    console.warn('Ledger entry: No branch ID provided and order has no branch');
  }
}

export async function createLedgerEntryOnDelivery(
  order: Order,
  deliveredBy: string, // User ID who marked as delivered
  shopName: string,
  branchId?: string
): Promise<LedgerTransaction | null> {
  try {
    // VALIDATION: Check required fields
    const regionId = order.regionId || '';
    validateLedgerEntryFields(order, regionId, branchId);

    // IDEMPOTENCY CHECK: Query Firebase for existing SALE_DELIVERED entry for this order
    const { firestoreService, COLLECTIONS } = await getFirebaseImports();
    const { query, where, getDocs } = await import('firebase/firestore');
    const { db } = await import('../config/firebase');
    const { collection } = await import('firebase/firestore');
    
    const ledgerRef = collection(db, COLLECTIONS.LEDGER_TRANSACTIONS);
    const existingEntryQuery = query(
      ledgerRef,
      where('order_id', '==', order.id),
      where('type', '==', 'SALE_DELIVERED')
    );
    const existingEntrySnapshot = await getDocs(existingEntryQuery);
    
    if (!existingEntrySnapshot.empty) {
      const existingEntry = existingEntrySnapshot.docs[0].data() as LedgerTransaction;
      console.log('createLedgerEntryOnDelivery: SALE_DELIVERED entry already exists for orderId:', order.id, '- returning existing entry');
      return existingEntry;
    }

    // Extract values from order
    const gross_amount = order.subtotal || 0;
    const discount_allowed = order.allowedDiscount || 0;
    const discount_given = order.totalDiscount || 0;
    const unauthorized_discount = Math.max(0, discount_given - discount_allowed);
    const net_cash = gross_amount - discount_given;

    // Create ledger entry
    const ledgerEntry: LedgerTransaction = {
      id: uuidv4(),
      ledger_id: uuidv4(),
      created_at: new Date().toISOString(),
      region_id: regionId,
      branch_id: branchId || order.branch,
      party_id: order.shopId,
      order_id: order.id,
      type: 'SALE_DELIVERED',
      gross_amount,
      discount_allowed,
      discount_given,
      unauthorized_discount,
      net_cash,
      created_by: deliveredBy,
      order_number: order.orderNumber,
      notes: `Cash sale - Order ${order.orderNumber}`,
      
      // Legacy fields for compatibility
      shopId: order.shopId,
      shopName: shopName,
      date: new Date().toISOString(),
      
      // BaseEntity fields
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    // Save to Firebase
    
    // Sanitize entry to remove undefined values
    const { sanitizeForFirebase } = await import('../utils/dataSanitizers');
    const sanitizedEntry = sanitizeForFirebase({
      ...ledgerEntry,
      syncStatus: 'synced',
    });

    await firestoreService.setDoc(COLLECTIONS.LEDGER_TRANSACTIONS, sanitizedEntry);

    console.log('Ledger entry created for delivery:', {
      orderNumber: order.orderNumber,
      net_cash,
      unauthorized_discount,
    });

    return ledgerEntry;
  } catch (error: any) {
    console.error('Error creating ledger entry on delivery:', error);
    throw error;
  }
}

/**
 * Create ledger entry when return is approved
 * 
 * Formula:
 * - gross_amount = 0
 * - net_cash = -totalValue (negative for return)
 */
export async function createLedgerEntryOnReturn(
  stockReturn: StockReturn,
  approvedBy: string, // User ID who approved the return
  branchId?: string
): Promise<LedgerTransaction | null> {
  try {
    // Get shop's region_id and branch
    const { useShopStore } = await import('../stores/shopStore');
    const shopStore = useShopStore.getState();
    const shop = shopStore.getShopById(stockReturn.shopId);
    
    if (!shop) {
      throw new Error(`Shop not found for return ${stockReturn.returnNumber}`);
    }

    // VALIDATION: Ensure return uses same region as shop
    const regionId = shop.regionId || '';
    if (!regionId || regionId.trim() === '') {
      throw new Error(`Region ID is required for return ledger entry. Shop ${shop.shopName} has no regionId.`);
    }

    // VALIDATION: If return has orderId, verify it matches shop's region
    // (Note: Returns may not have orderId, but if they do, they should match)
    if ((stockReturn as any).orderId) {
      const { useOrderStore } = await import('../stores/orderStore');
      const orderStore = useOrderStore.getState();
      const order = orderStore.getOrderById((stockReturn as any).orderId);
      if (order && order.regionId !== regionId) {
        console.warn(`Return regionId (${regionId}) does not match order regionId (${order.regionId}). Using shop's regionId.`);
      }
    }

    const gross_amount = 0;
    const discount_allowed = 0;
    const discount_given = 0;
    const unauthorized_discount = 0;
    const net_cash = -(stockReturn.totalValue || 0); // Negative for return

    const ledgerEntry: LedgerTransaction = {
      id: uuidv4(),
      ledger_id: uuidv4(),
      created_at: new Date().toISOString(),
      region_id: regionId, // Use validated regionId
      branch_id: branchId || shop.branch,
      party_id: stockReturn.shopId,
      type: 'RETURN',
      gross_amount,
      discount_allowed,
      discount_given,
      unauthorized_discount,
      net_cash,
      created_by: approvedBy,
      return_number: stockReturn.returnNumber,
      notes: stockReturn.notes || `Stock return - ${stockReturn.returnNumber}`,
      
      // Legacy fields for compatibility
      shopId: stockReturn.shopId,
      shopName: stockReturn.shopName || 'Unknown',
      date: new Date().toISOString(),
      
      // BaseEntity fields
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    // Save to Firebase
    const { firestoreService, COLLECTIONS } = await getFirebaseImports();
    
    const { sanitizeForFirebase } = await import('../utils/dataSanitizers');
    const sanitizedEntry = sanitizeForFirebase({
      ...ledgerEntry,
      syncStatus: 'synced',
    });

    await firestoreService.setDoc(COLLECTIONS.LEDGER_TRANSACTIONS, sanitizedEntry);

    console.log('Ledger entry created for return:', {
      returnNumber: stockReturn.returnNumber,
      net_cash,
    });

    return ledgerEntry;
  } catch (error: any) {
    console.error('Error creating ledger entry on return:', error);
    throw error;
  }
}

/**
 * Create ledger entry for adjustment (admin-only)
 * 
 * Formula:
 * - net_cash = admin_defined_amount (+/-)
 */
export async function createLedgerEntryAdjustment(
  data: AdjustmentFormData,
  createdBy: string, // User ID (should be admin)
  branchId?: string
): Promise<LedgerTransaction | null> {
  try {
    if (!data.notes || data.notes.trim() === '') {
      throw new Error('Notes are required for adjustments');
    }

    // Get shop info
    const { useShopStore } = await import('../stores/shopStore');
    const shopStore = useShopStore.getState();
    const shop = shopStore.getShopById(data.party_id);
    
    if (!shop) {
      throw new Error(`Shop not found: ${data.party_id}`);
    }

    // VALIDATION: Ensure regionId is present
    const regionId = shop.regionId || '';
    if (!regionId || regionId.trim() === '') {
      throw new Error(`Region ID is required for adjustment ledger entry. Shop ${shop.shopName} has no regionId.`);
    }

    const gross_amount = 0;
    const discount_allowed = 0;
    const discount_given = 0;
    const unauthorized_discount = 0;
    const net_cash = data.amount; // Can be positive or negative

    const ledgerEntry: LedgerTransaction = {
      id: uuidv4(),
      ledger_id: uuidv4(),
      created_at: new Date().toISOString(),
      region_id: regionId, // Use validated regionId
      branch_id: branchId || data.branch_id || shop.branch,
      party_id: data.party_id,
      type: 'ADJUSTMENT',
      gross_amount,
      discount_allowed,
      discount_given,
      unauthorized_discount,
      net_cash,
      created_by: createdBy,
      notes: data.notes,
      
      // Legacy fields for compatibility
      shopId: data.party_id,
      shopName: shop.shopName || 'Unknown',
      date: new Date().toISOString(),
      
      // BaseEntity fields
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    // Save to Firebase
    const { firestoreService, COLLECTIONS } = await getFirebaseImports();
    
    const { sanitizeForFirebase } = await import('../utils/dataSanitizers');
    const sanitizedEntry = sanitizeForFirebase({
      ...ledgerEntry,
      syncStatus: 'synced',
    });

    await firestoreService.setDoc(COLLECTIONS.LEDGER_TRANSACTIONS, sanitizedEntry);

    console.log('Ledger entry created for adjustment:', {
      party_id: data.party_id,
      net_cash,
      notes: data.notes,
    });

    return ledgerEntry;
  } catch (error: any) {
    console.error('Error creating ledger entry for adjustment:', error);
    throw error;
  }
}

/**
 * Create ledger entry for partial/full payment collection
 * 
 * This is used when collecting payments for outstanding balances (partial payments during delivery or later collections)
 * 
 * Formula:
 * - gross_amount = 0 (payment doesn't have gross amount)
 * - net_cash = collectedAmount (positive value)
 */
export async function createPaymentCollectionLedgerEntry(
  orderId: string,
  orderNumber: string,
  shopId: string,
  shopName: string,
  collectedAmount: number,
  remainingBalance: number,
  paymentSequence: number, // 1 for first payment, 2 for second, etc.
  collectedBy: string, // Salesman ID
  regionId: string,
  branchId?: string,
  notes?: string
): Promise<LedgerTransaction | null> {
  try {
    if (collectedAmount <= 0) {
      throw new Error('Payment amount must be greater than 0');
    }

    const paymentStatus = remainingBalance > 0 ? 'PARTIAL' : 'FULL';
    
    const ledgerEntry: LedgerTransaction & { payment_sequence?: number; payment_status?: string; remaining_balance?: number } = {
      id: uuidv4(),
      ledger_id: uuidv4(),
      created_at: new Date().toISOString(),
      region_id: regionId,
      branch_id: branchId,
      party_id: shopId,
      order_id: orderId,
      type: 'PAYMENT_COLLECTION',
      gross_amount: 0,
      discount_allowed: 0,
      discount_given: 0,
      unauthorized_discount: 0,
      net_cash: collectedAmount,
      created_by: collectedBy,
      order_number: orderNumber,
      notes: notes || `Payment collection - Order ${orderNumber} (${paymentStatus})`,
      
      // Additional fields for payment tracking (stored as part of notes or custom fields)
      payment_sequence: paymentSequence,
      payment_status: paymentStatus,
      remaining_balance: remainingBalance,
      
      // Legacy fields for compatibility
      shopId: shopId,
      shopName: shopName,
      date: new Date().toISOString(),
      
      // BaseEntity fields
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    // Save to Firebase
    const { firestoreService, COLLECTIONS } = await getFirebaseImports();
    
    const { sanitizeForFirebase } = await import('../utils/dataSanitizers');
    const sanitizedEntry = sanitizeForFirebase({
      ...ledgerEntry,
      syncStatus: 'synced',
    });

    await firestoreService.setDoc(COLLECTIONS.LEDGER_TRANSACTIONS, sanitizedEntry);

    console.log('Ledger entry created for payment collection:', {
      orderNumber,
      collectedAmount,
      paymentSequence,
      paymentStatus,
      remainingBalance,
    });

    return ledgerEntry as LedgerTransaction;
  } catch (error: any) {
    console.error('Error creating payment collection ledger entry:', error);
    throw error;
  }
}

/**
 * Create ledger entry when credit is created (owned by booker)
 * 
 * This is used when a bill is created with partial or full credit.
 * Credit is owned by the booker, not the salesman.
 * 
 * Formula:
 * - gross_amount = creditAmount
 * - net_cash = -creditAmount (negative because it's credit/outstanding)
 */
export async function createCreditCreatedLedgerEntry(
  orderId: string,
  orderNumber: string,
  billId: string,
  billNumber: string,
  shopId: string,
  shopName: string,
  creditAmount: number,
  bookerId: string, // Credit owner
  bookerName?: string,
  regionId: string,
  branchId?: string,
  notes?: string
): Promise<LedgerTransaction | null> {
  try {
    if (creditAmount <= 0) {
      throw new Error('Credit amount must be greater than 0');
    }

    const ledgerEntry: LedgerTransaction = {
      id: uuidv4(),
      ledger_id: uuidv4(),
      created_at: new Date().toISOString(),
      region_id: regionId,
      branch_id: branchId,
      party_id: shopId,
      order_id: orderId,
      type: 'CREDIT_CREATED',
      gross_amount: creditAmount,
      discount_allowed: 0,
      discount_given: 0,
      unauthorized_discount: 0,
      net_cash: -creditAmount, // Negative because it's credit
      created_by: bookerId, // Credit owned by booker
      order_number: orderNumber,
      notes: notes || `Credit created - Bill ${billNumber}, Order ${orderNumber} (Booker: ${bookerName || bookerId})`,
      
      // Legacy fields for compatibility
      shopId: shopId,
      shopName: shopName,
      date: new Date().toISOString(),
      
      // BaseEntity fields
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    // Save to Firebase
    const { firestoreService, COLLECTIONS } = await getFirebaseImports();
    
    const { sanitizeForFirebase } = await import('../utils/dataSanitizers');
    const sanitizedEntry = sanitizeForFirebase({
      ...ledgerEntry,
      syncStatus: 'synced',
    });

    await firestoreService.setDoc(COLLECTIONS.LEDGER_TRANSACTIONS, sanitizedEntry);

    console.log('Credit created ledger entry:', {
      billNumber,
      orderNumber,
      creditAmount,
      bookerId,
      bookerName,
    });

    return ledgerEntry;
  } catch (error: any) {
    console.error('Error creating credit created ledger entry:', error);
    throw error;
  }
}

/**
 * Create ledger entry when credit is collected (collected by salesman, but credit was owned by booker)
 * 
 * This is used when a salesman collects payment for an outstanding credit.
 * The collection is done by salesman, but the credit was originally owned by booker.
 * 
 * Formula:
 * - gross_amount = collectedAmount
 * - net_cash = collectedAmount (positive because cash is received)
 */
export async function createCreditCollectedLedgerEntry(
  orderId: string,
  orderNumber: string,
  billId: string,
  billNumber: string,
  shopId: string,
  shopName: string,
  collectedAmount: number,
  remainingCredit: number,
  bookerId: string, // Original credit owner
  bookerName?: string,
  collectedBy: string, // Salesman ID who collected
  salesmanName?: string,
  regionId: string,
  branchId?: string,
  notes?: string
): Promise<LedgerTransaction | null> {
  try {
    if (collectedAmount <= 0) {
      throw new Error('Collected amount must be greater than 0');
    }

    const ledgerEntry: LedgerTransaction = {
      id: uuidv4(),
      ledger_id: uuidv4(),
      created_at: new Date().toISOString(),
      region_id: regionId,
      branch_id: branchId,
      party_id: shopId,
      order_id: orderId,
      type: 'CREDIT_COLLECTED',
      gross_amount: collectedAmount,
      discount_allowed: 0,
      discount_given: 0,
      unauthorized_discount: 0,
      net_cash: collectedAmount, // Positive because cash is received
      created_by: collectedBy, // Collected by salesman
      order_number: orderNumber,
      notes: notes || `Credit collected - Bill ${billNumber}, Order ${orderNumber} (Collected by: ${salesmanName || collectedBy}, Original Booker: ${bookerName || bookerId})`,
      
      // Legacy fields for compatibility
      shopId: shopId,
      shopName: shopName,
      date: new Date().toISOString(),
      
      // BaseEntity fields
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    // Save to Firebase
    const { firestoreService, COLLECTIONS } = await getFirebaseImports();
    
    const { sanitizeForFirebase } = await import('../utils/dataSanitizers');
    const sanitizedEntry = sanitizeForFirebase({
      ...ledgerEntry,
      syncStatus: 'synced',
    });

    await firestoreService.setDoc(COLLECTIONS.LEDGER_TRANSACTIONS, sanitizedEntry);

    console.log('Credit collected ledger entry:', {
      billNumber,
      orderNumber,
      collectedAmount,
      remainingCredit,
      collectedBy: salesmanName || collectedBy,
      originalBooker: bookerName || bookerId,
    });

    return ledgerEntry;
  } catch (error: any) {
    console.error('Error creating credit collected ledger entry:', error);
    throw error;
  }
}

