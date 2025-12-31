import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { OutstandingPayment, CreditStatus } from '../types/outstandingPayment';
import { PaymentStatus } from '../types/delivery';
import { storage } from '../services/storage/asyncStorage';

interface OutstandingPaymentState {
  outstandingPayments: OutstandingPayment[];
  isLoading: boolean;
  error: string | null;
}

interface OutstandingPaymentActions {
  loadOutstandingPayments: () => Promise<void>;
  getOutstandingPaymentsByShop: (shopId: string) => OutstandingPayment[];
  getOutstandingPaymentsBySalesman: (salesmanId: string) => OutstandingPayment[];
  getOutstandingPaymentsByBooker: (bookerId: string) => OutstandingPayment[];
  addOutstandingPayment: (
    orderId: string,
    orderNumber: string,
    shopId: string,
    shopName: string,
    totalAmount: number,
    paidAmount: number,
    remainingBalance: number,
    deliveryDate: string,
    salesmanId: string,
    salesmanName: string,
    bookerId: string,
    bookerName?: string,
    billId?: string,
    deliveryId?: string
  ) => Promise<OutstandingPayment>;
  updateOutstandingPayment: (
    orderId: string,
    paidAmount: number,
    remainingBalance: number,
    paymentStatus: DeliveryPaymentStatus
  ) => Promise<boolean>;
  clearOutstandingPayment: (orderId: string) => Promise<boolean>;
  getOutstandingPaymentByOrderId: (orderId: string) => OutstandingPayment | undefined;
}

type OutstandingPaymentStore = OutstandingPaymentState & OutstandingPaymentActions;

const OUTSTANDING_PAYMENTS_STORAGE_KEY = 'outstanding_payments';

export const useOutstandingPaymentStore = create<OutstandingPaymentStore>((set, get) => ({
  // Initial state
  outstandingPayments: [],
  isLoading: false,
  error: null,

  // Actions
  loadOutstandingPayments: async () => {
    set({ isLoading: true, error: null });

    try {
      // Try Firebase first
      try {
        const { firestoreService } = await import('../services/firebase');
        const { COLLECTIONS } = await import('../services/firebase/collections');
        
        // Check if collection exists, if not use local storage
        const outstandingPaymentsList = await firestoreService.getDocs<OutstandingPayment>(
          COLLECTIONS.OUTSTANDING_PAYMENTS
        ).catch(() => []);

        // Update local storage cache
        await storage.set(OUTSTANDING_PAYMENTS_STORAGE_KEY, outstandingPaymentsList);
        set({ outstandingPayments: outstandingPaymentsList, isLoading: false });
      } catch (firebaseError) {
        console.warn('Firebase load failed, trying local storage:', firebaseError);
        
        // Fallback to local storage
        const storedPayments = await storage.get<OutstandingPayment[]>(OUTSTANDING_PAYMENTS_STORAGE_KEY);
        const paymentsList = storedPayments || [];
        set({ outstandingPayments: paymentsList, isLoading: false });
      }
    } catch (error) {
      set({
        error: 'Failed to load outstanding payments',
        isLoading: false,
      });
    }
  },

  getOutstandingPaymentsByShop: (shopId: string) => {
    const { outstandingPayments } = get();
    return outstandingPayments.filter(p => p.shopId === shopId);
  },

  getOutstandingPaymentsBySalesman: (salesmanId: string) => {
    const { outstandingPayments } = get();
    return outstandingPayments.filter(p => p.salesmanId === salesmanId);
  },

  getOutstandingPaymentsByBooker: (bookerId: string) => {
    const { outstandingPayments } = get();
    return outstandingPayments.filter(p => p.bookerId === bookerId);
  },

  addOutstandingPayment: async (
    orderId,
    orderNumber,
    shopId,
    shopName,
    totalAmount,
    paidAmount,
    remainingBalance,
    deliveryDate,
    salesmanId,
    salesmanName,
    bookerId,
    bookerName,
    billId,
    deliveryId
  ) => {
    const { outstandingPayments } = get();
    
    // Check if outstanding payment already exists for this order
    const existing = outstandingPayments.find(p => p.orderId === orderId);
    if (existing) {
      console.warn('Outstanding payment already exists for order:', orderId);
      return existing;
    }

    const paymentStatus: PaymentStatus = remainingBalance > 0 && remainingBalance < totalAmount ? 'PARTIAL' : remainingBalance === 0 ? 'PAID' : 'UNPAID';
    
    // Determine credit status
    const creditStatus: 'PARTIAL' | 'FULL_CREDIT' | undefined = 
      remainingBalance === totalAmount ? 'FULL_CREDIT' :
      remainingBalance > 0 && remainingBalance < totalAmount ? 'PARTIAL' :
      undefined;
    
    const newOutstandingPayment: OutstandingPayment = {
      id: uuidv4(),
      orderId,
      orderNumber,
      shopId,
      shopName,
      totalAmount,
      paidAmount,
      remainingBalance,
      deliveryDate,
      salesmanId,
      salesmanName,
      paymentStatus,
      deliveryId,
      bookerId,
      bookerName,
      billId,
      creditStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedPayments = [...outstandingPayments, newOutstandingPayment];
    await storage.set(OUTSTANDING_PAYMENTS_STORAGE_KEY, updatedPayments);
    set({ outstandingPayments: updatedPayments });

    // Try to sync to Firebase
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');
      
      await firestoreService.addDoc(COLLECTIONS.OUTSTANDING_PAYMENTS, newOutstandingPayment);
      
      const syncedPayment = { ...newOutstandingPayment, syncStatus: 'synced' as const };
      const syncedPayments = updatedPayments.map(p => 
        p.id === newOutstandingPayment.id ? syncedPayment : p
      );
      await storage.set(OUTSTANDING_PAYMENTS_STORAGE_KEY, syncedPayments);
      set({ outstandingPayments: syncedPayments });
    } catch (error) {
      console.warn('Failed to sync outstanding payment to Firebase:', error);
      // Keep as pending - will sync later
    }

    return newOutstandingPayment;
  },

  updateOutstandingPayment: async (
    orderId,
    paidAmount,
    remainingBalance,
    paymentStatus: PaymentStatus
  ) => {
    const { outstandingPayments } = get();
    const paymentIndex = outstandingPayments.findIndex(p => p.orderId === orderId);

    if (paymentIndex === -1) {
      console.warn('Outstanding payment not found for order:', orderId);
      return false;
    }

    const existingPayment = outstandingPayments[paymentIndex];
    const updatedPayment: OutstandingPayment = {
      ...existingPayment,
      paidAmount,
      remainingBalance,
      paymentStatus,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedPayments = outstandingPayments.map((p, index) =>
      index === paymentIndex ? updatedPayment : p
    );
    await storage.set(OUTSTANDING_PAYMENTS_STORAGE_KEY, updatedPayments);
    set({ outstandingPayments: updatedPayments });

    // Try to sync to Firebase
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');
      
      await firestoreService.updateDoc(COLLECTIONS.OUTSTANDING_PAYMENTS, existingPayment.id, {
        paidAmount,
        remainingBalance,
        paymentStatus,
        updatedAt: updatedPayment.updatedAt,
        syncStatus: 'synced',
      });
      
      const syncedPayment = { ...updatedPayment, syncStatus: 'synced' as const };
      const syncedPayments = updatedPayments.map(p => 
        p.id === existingPayment.id ? syncedPayment : p
      );
      await storage.set(OUTSTANDING_PAYMENTS_STORAGE_KEY, syncedPayments);
      set({ outstandingPayments: syncedPayments });
    } catch (error) {
      console.warn('Failed to sync outstanding payment update to Firebase:', error);
      // Keep as pending - will sync later
    }

    return true;
  },

  clearOutstandingPayment: async (orderId: string) => {
    const { outstandingPayments } = get();
    const paymentIndex = outstandingPayments.findIndex(p => p.orderId === orderId);

    if (paymentIndex === -1) {
      console.warn('Outstanding payment not found for order:', orderId);
      return false;
    }

    const paymentToDelete = outstandingPayments[paymentIndex];
    const updatedPayments = outstandingPayments.filter(p => p.orderId !== orderId);
    await storage.set(OUTSTANDING_PAYMENTS_STORAGE_KEY, updatedPayments);
    set({ outstandingPayments: updatedPayments });

    // Try to sync deletion to Firebase
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');
      
      await firestoreService.deleteDoc(COLLECTIONS.OUTSTANDING_PAYMENTS, paymentToDelete.id);
    } catch (error) {
      console.warn('Failed to sync outstanding payment deletion to Firebase:', error);
      // Keep in local storage for now
    }

    return true;
  },

  getOutstandingPaymentByOrderId: (orderId: string) => {
    const { outstandingPayments } = get();
    return outstandingPayments.find(p => p.orderId === orderId);
  },
}));

