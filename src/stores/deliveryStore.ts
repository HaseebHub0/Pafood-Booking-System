import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  Delivery,
  DeliveryFormData,
  DeliveryStatus,
  DeliveryFailureReason,
  PaymentRecord,
  PaymentStatus,
  calculateDeliveryStats,
} from '../types/delivery';
import { storage, STORAGE_KEYS } from '../services/storage/asyncStorage';
import { useAuthStore } from './authStore';
import { useOrderStore } from './orderStore';
import { useShopStore } from './shopStore';
import { getCurrentLocation } from '../services/location';
import { sanitizeForFirebase } from '../utils/dataSanitizers';

interface DeliveryState {
  deliveries: Delivery[];
  isLoading: boolean;
  error: string | null;
}

interface DeliveryActions {
  loadDeliveries: () => Promise<void>;
  createDeliveryFromOrder: (orderId: string) => Promise<Delivery | null>;
  updateDeliveryStatus: (id: string, status: DeliveryStatus, notes?: string) => Promise<boolean>;
  markDelivered: (id: string, collectedAmount: number, signature?: string, notes?: string) => Promise<boolean>;
  markFailed: (id: string, reason: DeliveryFailureReason, notes?: string) => Promise<boolean>;
  updateDeliveryItems: (id: string, deliveredQuantities: Record<string, number>) => Promise<boolean>;
  updateDeliveryPayment: (id: string, collectedAmount: number, notes?: string) => Promise<boolean>;
  adjustDeliveryPayment: (id: string, correctedAmount: number, notes?: string) => Promise<boolean>;
  getDeliveryById: (id: string) => Delivery | undefined;
  getDeliveriesByStatus: (status: DeliveryStatus) => Delivery[];
  getDeliveriesBySalesman: (salesmanId: string) => Delivery[];
  getPendingDeliveries: () => Delivery[];
  calculateDeliveryStats: () => ReturnType<typeof calculateDeliveryStats>;
}

type DeliveryStore = DeliveryState & DeliveryActions;

export const useDeliveryStore = create<DeliveryStore>((set, get) => ({
  // Initial state
  deliveries: [],
  isLoading: false,
  error: null,

  // Actions
  loadDeliveries: async () => {
    set({ isLoading: true, error: null });

    try {
      const currentUser = useAuthStore.getState().user;
      
      // Load from local storage first to preserve any recent changes
      const localDeliveries = await storage.get<Delivery[]>(STORAGE_KEYS.DELIVERIES) || [];
      
      // Try Firebase
      try {
        const { firestoreService } = await import('../services/firebase');
        const { COLLECTIONS } = await import('../services/firebase/collections');
        
        let firebaseDeliveries: Delivery[] = [];
        
        if (currentUser?.role?.toLowerCase() === 'salesman') {
          // Salesman sees only deliveries from assigned bookers
          console.log('Loading deliveries for salesman:', currentUser.id, 'regionId:', currentUser.regionId);
          
          try {
            const { useMappingStore } = await import('./mappingStore');
            const mappingStore = useMappingStore.getState();
            await mappingStore.loadMappings();
            const assignedBookerIds = mappingStore.getBookersForSalesman(currentUser.id);
            
            if (assignedBookerIds.length > 0) {
              // Get all deliveries in the region first
              if (currentUser?.regionId) {
                firebaseDeliveries = await firestoreService.getDocsWhere<Delivery>(
                  COLLECTIONS.DELIVERIES,
                  'regionId',
                  '==',
                  currentUser.regionId
                );
              } else {
                firebaseDeliveries = await firestoreService.getDocs<Delivery>(COLLECTIONS.DELIVERIES);
              }
              
              // Get orders to filter deliveries by bookerId
              const { COLLECTIONS: ORDERS_COLLECTIONS } = await import('../services/firebase/collections');
              const allOrders = await firestoreService.getDocs<any>(ORDERS_COLLECTIONS.ORDERS);
              const assignedOrderIds = allOrders
                .filter((order: any) => assignedBookerIds.includes(order.bookerId))
                .map((order: any) => order.id);
              
              // Filter deliveries by orderId (orders from assigned bookers)
              firebaseDeliveries = firebaseDeliveries.filter((delivery: Delivery) => 
                assignedOrderIds.includes(delivery.orderId)
              );
              
              console.log(`Found ${firebaseDeliveries.length} deliveries from ${assignedBookerIds.length} assigned bookers`);
            } else {
              // No bookers assigned - show no deliveries
              firebaseDeliveries = [];
              console.log('No bookers assigned to salesman, showing no deliveries');
            }
          } catch (error) {
            console.warn('Failed to load mappings for delivery filtering, falling back to salesmanId:', error);
            // Fallback to salesmanId-based filtering (old behavior)
            if (currentUser?.regionId) {
              firebaseDeliveries = await firestoreService.getDocsWhere<Delivery>(
                COLLECTIONS.DELIVERIES,
                'regionId',
                '==',
                currentUser.regionId
              );
            } else {
              firebaseDeliveries = await firestoreService.getDocs<Delivery>(COLLECTIONS.DELIVERIES);
            }
            // Then filter by salesmanId
            firebaseDeliveries = firebaseDeliveries.filter((d) => d.salesmanId === currentUser.id);
            console.log('Found deliveries for salesman:', firebaseDeliveries.length);
          }
        } else if (currentUser?.role === 'kpo') {
          // KPO sees deliveries in their region
          if (currentUser?.regionId) {
            firebaseDeliveries = await firestoreService.getDocsWhere<Delivery>(
              COLLECTIONS.DELIVERIES,
              'regionId',
              '==',
              currentUser.regionId
            );
          } else {
            firebaseDeliveries = await firestoreService.getDocs<Delivery>(COLLECTIONS.DELIVERIES);
          }
        } else if (currentUser?.role === 'admin' || currentUser?.role === 'owner') {
          // Admin/Owner can see all deliveries
          firebaseDeliveries = await firestoreService.getDocs<Delivery>(COLLECTIONS.DELIVERIES);
        } else {
          // Unknown role - no deliveries
          firebaseDeliveries = [];
        }
        
        // Merge strategy: 
        // 1. First deduplicate by delivery.id (keep latest version)
        // 2. Then deduplicate by orderId (keep only latest delivery per order)
        
        // Step 1: Create a map of deliveries by ID - keep the most recent version
        const deliveryMapById = new Map<string, Delivery>();
        
        // Add Firebase deliveries to map
        firebaseDeliveries.forEach((delivery) => {
          deliveryMapById.set(delivery.id, delivery);
        });
        
        // Merge with local deliveries - keep the most recent version
        localDeliveries.forEach((localDelivery) => {
          const firebaseDelivery = deliveryMapById.get(localDelivery.id);
          
          if (!firebaseDelivery) {
            // Local delivery not in Firebase - keep it (might be pending sync)
            deliveryMapById.set(localDelivery.id, localDelivery);
          } else {
            // Both exist - compare timestamps
            const localUpdatedAt = new Date(localDelivery.updatedAt || localDelivery.createdAt).getTime();
            const firebaseUpdatedAt = firebaseDelivery.updatedAt 
              ? (firebaseDelivery.updatedAt.toDate ? firebaseDelivery.updatedAt.toDate().getTime() : new Date(firebaseDelivery.updatedAt).getTime())
              : (firebaseDelivery.createdAt.toDate ? firebaseDelivery.createdAt.toDate().getTime() : new Date(firebaseDelivery.createdAt).getTime());
            
            // If local has 'delivered' status and is newer or same time, prefer local
            // This prevents Firebase from overwriting a recently marked delivery
            if (localDelivery.status === 'delivered' && localUpdatedAt >= firebaseUpdatedAt) {
              deliveryMapById.set(localDelivery.id, localDelivery);
            } else if (firebaseUpdatedAt > localUpdatedAt) {
              // Firebase is newer - use it
              deliveryMapById.set(localDelivery.id, firebaseDelivery);
            } else {
              // Same timestamp or local is newer - prefer local if it has delivered status
              if (localDelivery.status === 'delivered') {
                deliveryMapById.set(localDelivery.id, localDelivery);
              } else {
                deliveryMapById.set(localDelivery.id, firebaseDelivery);
              }
            }
          }
        });
        
        // Step 2: Deduplicate by orderId - keep only the latest delivery per order
        // This prevents duplicate orders on salesman home screen
        const deliveryMapByOrderId = new Map<string, Delivery>();
        
        deliveryMapById.forEach((delivery) => {
          if (!delivery.orderId) {
            // Delivery without orderId - keep it (shouldn't happen, but be safe)
            return;
          }
          
          const existingDelivery = deliveryMapByOrderId.get(delivery.orderId);
          
          if (!existingDelivery) {
            // First delivery for this orderId
            deliveryMapByOrderId.set(delivery.orderId, delivery);
          } else {
            // Compare timestamps - keep the one with latest updatedAt
            const existingUpdatedAt = existingDelivery.updatedAt 
              ? (existingDelivery.updatedAt.toDate ? existingDelivery.updatedAt.toDate().getTime() : new Date(existingDelivery.updatedAt).getTime())
              : (existingDelivery.createdAt.toDate ? existingDelivery.createdAt.toDate().getTime() : new Date(existingDelivery.createdAt).getTime());
            
            const currentUpdatedAt = delivery.updatedAt 
              ? (delivery.updatedAt.toDate ? delivery.updatedAt.toDate().getTime() : new Date(delivery.updatedAt).getTime())
              : (delivery.createdAt.toDate ? delivery.createdAt.toDate().getTime() : new Date(delivery.createdAt).getTime());
            
            // Keep the one with the latest update, or if same, prefer the one that's not delivered
            // (to avoid keeping old delivered records when new pending ones exist)
            if (currentUpdatedAt > existingUpdatedAt) {
              deliveryMapByOrderId.set(delivery.orderId, delivery);
            } else if (currentUpdatedAt === existingUpdatedAt) {
              // Same timestamp - prefer non-delivered status (to show pending deliveries)
              if (existingDelivery.status === 'delivered' && delivery.status !== 'delivered') {
                deliveryMapByOrderId.set(delivery.orderId, delivery);
              }
              // Otherwise keep existing (it's already in the map)
            }
            // Otherwise keep existing (it's newer)
          }
        });
        
        // Convert map back to array
        let deliveriesList = Array.from(deliveryMapByOrderId.values());
        
        // Sort by creation date (most recent first)
        deliveriesList.sort((a, b) => {
          const aTime = a.createdAt.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
          const bTime = b.createdAt.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
          return bTime - aTime;
        });

        // Update local storage cache with merged data
        await storage.set(STORAGE_KEYS.DELIVERIES, deliveriesList);
        set({ deliveries: deliveriesList, isLoading: false });
      } catch (firebaseError) {
        console.warn('Firebase load failed, using local storage:', firebaseError);
        
        // Fallback to local storage only
        let deliveriesList: Delivery[] = localDeliveries;

        // Filter by role and region
        if (currentUser) {
          if (currentUser.role?.toLowerCase() === 'salesman') {
            // Salesman sees only their assigned deliveries
            deliveriesList = deliveriesList.filter((d) => d.salesmanId === currentUser.id && d.regionId === currentUser.regionId);
          } else if (currentUser.role === 'kpo') {
            // KPO sees deliveries in their region
            deliveriesList = deliveriesList.filter((d) => d.regionId === currentUser.regionId);
          }
          // Admin/Owner sees all (no filtering)
        }

        set({ deliveries: deliveriesList, isLoading: false });
      }
    } catch (error) {
      set({
        error: 'Failed to load deliveries',
        isLoading: false,
      });
    }
  },

  createDeliveryFromOrder: async (orderId) => {
    const { deliveries } = get();
    const orderStore = useOrderStore.getState();
    const currentUser = useAuthStore.getState().user;
    const shopStore = useShopStore.getState();

    const order = orderStore.getOrderById(orderId);
    if (!order) {
      set({ error: 'Order not found' });
      return null;
    }

    // IDEMPOTENCY CHECK: Check local store first
    const existingDelivery = deliveries.find((d) => d.orderId === orderId);
    if (existingDelivery) {
      console.log('createDeliveryFromOrder: Delivery already exists in local store for orderId:', orderId);
      return existingDelivery;
    }

    // IDEMPOTENCY CHECK: Query Firebase to ensure no delivery already exists
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');
      const { query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');
      const { collection } = await import('firebase/firestore');
      
      const deliveriesRef = collection(db, COLLECTIONS.DELIVERIES);
      const existingDeliveryQuery = query(deliveriesRef, where('orderId', '==', orderId));
      const existingDeliverySnapshot = await getDocs(existingDeliveryQuery);
      
      if (!existingDeliverySnapshot.empty) {
        const existingFirebaseDelivery = existingDeliverySnapshot.docs[0].data();
        console.log('createDeliveryFromOrder: Delivery already exists in Firebase for orderId:', orderId);
        // Return the existing delivery from Firebase
        return existingFirebaseDelivery as Delivery;
      }
    } catch (firebaseCheckError) {
      console.warn('createDeliveryFromOrder: Failed to check Firebase for existing delivery:', firebaseCheckError);
      // Continue with creation if check fails (defensive approach)
    }

    const shop = shopStore.getShopById(order.shopId);
    if (!shop) {
      set({ error: 'Shop not found' });
      return null;
    }

    // Convert order items to delivery items
    const deliveryItems = order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      deliveredQuantity: 0,
      unit: item.unit || 'Pcs',
      unitPrice: item.unitPrice,
    }));

    // Use finalized items if available, otherwise use original items
    const itemsToDeliver = order.finalizedItems || order.items;
    
    const newDelivery: Delivery = {
      id: uuidv4(),
      orderId: order.id,
      orderNumber: order.orderNumber,
      shopId: shop.id,
      shopName: shop.shopName,
      shopAddress: shop.address,
      shopPhone: shop.phone,
      regionId: order.regionId || shop.regionId,
      salesmanId: currentUser?.id || '',
      salesmanName: currentUser?.name || '',
      assignedAt: new Date().toISOString(),
      status: 'assigned',
      items: itemsToDeliver.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        deliveredQuantity: 0,
        unit: item.unit || 'Pcs',
        unitPrice: item.unitPrice,
      })),
      totalAmount: order.grandTotal,
      deliveredAmount: 0,
      paymentCollected: false,
      invoiceGenerated: false,
      invoiceSigned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedDeliveries = [...deliveries, newDelivery];
    await storage.set(STORAGE_KEYS.DELIVERIES, updatedDeliveries);
    set({ deliveries: updatedDeliveries });

    // Try to sync to Firebase
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');
      
      await firestoreService.setDoc(COLLECTIONS.DELIVERIES, {
        ...newDelivery,
        syncStatus: 'synced',
      });
      
      // Update local storage with synced status
      const syncedDelivery = { ...newDelivery, syncStatus: 'synced' as const };
      const syncedDeliveries = updatedDeliveries.map((d) => (d.id === newDelivery.id ? syncedDelivery : d));
      await storage.set(STORAGE_KEYS.DELIVERIES, syncedDeliveries);
      set({ deliveries: syncedDeliveries });
    } catch (error) {
      console.warn('Failed to sync delivery to Firebase:', error);
      // Keep as pending - will sync later
      set({ deliveries: updatedDeliveries });
    }

    return newDelivery;
  },

  updateDeliveryStatus: async (id, status, notes) => {
    const { deliveries } = get();
    const deliveryIndex = deliveries.findIndex((d) => d.id === id);
    if (deliveryIndex === -1) return false;

    const delivery = deliveries[deliveryIndex];
    let updatedDelivery: Delivery = {
      ...delivery,
      status,
      deliveryNotes: notes || delivery.deliveryNotes,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    // Set dispatched time when status changes to in_transit
    if (status === 'in_transit' && !delivery.dispatchedAt) {
      updatedDelivery.dispatchedAt = new Date().toISOString();
    }

    const updatedDeliveries = deliveries.map((d, index) =>
      index === deliveryIndex ? updatedDelivery : d
    );
    await storage.set(STORAGE_KEYS.DELIVERIES, updatedDeliveries);
    set({ deliveries: updatedDeliveries });

    // Try to sync to Firebase
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');
      
      await firestoreService.updateDoc(COLLECTIONS.DELIVERIES, id, {
        status,
        deliveryNotes: notes || delivery.deliveryNotes,
        dispatchedAt: updatedDelivery.dispatchedAt,
        updatedAt: updatedDelivery.updatedAt,
        syncStatus: 'synced',
      });
      
      // Update local storage with synced status
      const syncedDelivery = { ...updatedDelivery, syncStatus: 'synced' as const };
      const syncedDeliveries = updatedDeliveries.map((d) => (d.id === id ? syncedDelivery : d));
      await storage.set(STORAGE_KEYS.DELIVERIES, syncedDeliveries);
      set({ deliveries: syncedDeliveries });
    } catch (error) {
      console.warn('Failed to sync delivery status update to Firebase:', error);
      // Keep as pending - will sync later
    }

    return true;
  },

  markDelivered: async (id, collectedAmount, signature, notes) => {
    const { deliveries } = get();
    const deliveryIndex = deliveries.findIndex((d) => d.id === id);
    if (deliveryIndex === -1) return false;

    const delivery = deliveries[deliveryIndex];
    const dispatchedTime = delivery.dispatchedAt ? new Date(delivery.dispatchedAt).getTime() : Date.now();
    const deliveredTime = Date.now();
    const deliveryDuration = Math.round((deliveredTime - dispatchedTime) / 60000); // Minutes

    // Validate collected amount
    if (collectedAmount < 0 || collectedAmount > delivery.totalAmount) {
      console.error('Invalid collected amount:', collectedAmount, 'Total:', delivery.totalAmount);
      return false;
    }

    // Get delivery location
    const deliveryLocation = await getCurrentLocation();

    // Calculate payment status and remaining balance
    const totalAmount = delivery.totalAmount;
    const paidAmount = collectedAmount;
    const remainingBalance = totalAmount - paidAmount;
    
    let paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
    if (paidAmount === 0) {
      paymentStatus = 'UNPAID';
    } else if (paidAmount < totalAmount) {
      paymentStatus = 'PARTIAL';
    } else {
      paymentStatus = 'PAID';
    }

    // Create initial payment record
    const currentUser = useAuthStore.getState().user;
    const paymentRecord: PaymentRecord = {
      id: uuidv4(),
      amount: paidAmount,
      paidAt: new Date().toISOString(),
      collectedBy: currentUser?.id || 'unknown',
      notes: notes,
    };

    const updatedDelivery: Delivery = {
      ...delivery,
      status: 'delivered',
      deliveredAt: new Date().toISOString(),
      deliveryDuration,
      deliveryLocation: deliveryLocation || undefined,
      deliveredAmount: delivery.totalAmount,
      // Legacy fields for backward compatibility
      paymentCollected: paidAmount > 0,
      paymentAmount: paidAmount > 0 ? paidAmount : undefined,
      paymentMode: 'cash',
      paymentCollectedAt: paidAmount > 0 ? new Date().toISOString() : undefined,
      // New payment tracking fields
      paymentStatus,
      paidAmount,
      remainingBalance,
      paymentHistory: [paymentRecord],
      invoiceSigned: !!signature,
      customerSignature: signature,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedDeliveries = deliveries.map((d, index) =>
      index === deliveryIndex ? updatedDelivery : d
    );
    await storage.set(STORAGE_KEYS.DELIVERIES, updatedDeliveries);
    set({ deliveries: updatedDeliveries });

    // Try to sync to Firebase
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');

      // Sanitize data to remove undefined values before sending to Firebase
      const sanitizedData = sanitizeForFirebase({
        ...updatedDelivery,
        syncStatus: 'synced',
      });

      await firestoreService.updateDoc(COLLECTIONS.DELIVERIES, id, sanitizedData);
      
      // Update local storage with synced status
      const syncedDelivery = { ...updatedDelivery, syncStatus: 'synced' as const };
      const syncedDeliveries = updatedDeliveries.map((d) => (d.id === id ? syncedDelivery : d));
      await storage.set(STORAGE_KEYS.DELIVERIES, syncedDeliveries);
      set({ deliveries: syncedDeliveries });

      // Create ledger entry for payment collection
      if (paidAmount > 0) {
        try {
          const { createPaymentCollectionLedgerEntry } = await import('../services/ledgerService');
          const { useShopStore } = await import('./shopStore');
          const shopStore = useShopStore.getState();
          const shop = shopStore.getShopById(delivery.shopId);

          if (shop && currentUser) {
            // Create payment collection ledger entry
            await createPaymentCollectionLedgerEntry(
              delivery.orderId,
              delivery.orderNumber,
              delivery.shopId,
              delivery.shopName,
              paidAmount,
              remainingBalance,
              1, // First payment (payment sequence)
              currentUser.id,
              delivery.regionId,
              shop.branch,
              notes || `Payment collection - Order ${delivery.orderNumber}`
            );
            
            console.log('Payment collection ledger entry created:', {
              orderNumber: delivery.orderNumber,
              paidAmount,
              remainingBalance,
              paymentStatus,
            });

            // Get order to access booker information
            const { useOrderStore } = await import('./orderStore');
            const orderStore = useOrderStore.getState();
            const order = orderStore.getOrderById(delivery.orderId);

            if (!order) {
              console.error('Order not found for delivery:', delivery.orderId);
            } else {
              // Create Bill entity
              try {
                const { createBillFromDelivery } = await import('../services/billService');
                const bill = await createBillFromDelivery(
                  updatedDelivery,
                  order,
                  paidAmount
                );

                if (bill) {
                  console.log('Bill created:', {
                    billNumber: bill.billNumber,
                    paymentStatus: bill.paymentStatus,
                    creditStatus: bill.creditStatus,
                  });

                  // If full cash payment: Record cash entry under salesman, no credit entry
                  // IDEMPOTENCY: createLedgerEntryOnDelivery already checks for existing entries, but add explicit check here too
                  if (paymentStatus === 'PAID') {
                    try {
                      // IDEMPOTENCY CHECK: Verify no SALE_DELIVERED entry already exists for this order
                      const { query, where, getDocs } = await import('firebase/firestore');
                      const { db } = await import('../config/firebase');
                      const { collection } = await import('firebase/firestore');
                      const { COLLECTIONS } = await import('../services/firebase/collections');
                      
                      const ledgerRef = collection(db, COLLECTIONS.LEDGER_TRANSACTIONS);
                      const existingEntryQuery = query(
                        ledgerRef,
                        where('order_id', '==', order.id),
                        where('type', '==', 'SALE_DELIVERED')
                      );
                      const existingEntrySnapshot = await getDocs(existingEntryQuery);
                      
                      if (!existingEntrySnapshot.empty) {
                        console.log('markDelivered: SALE_DELIVERED entry already exists for orderId:', order.id, '- skipping creation');
                      } else {
                        const { createLedgerEntryOnDelivery } = await import('../services/ledgerService');
                        await createLedgerEntryOnDelivery(
                          order,
                          currentUser.id,
                          shop.shopName,
                          shop.branch
                        );
                        console.log('SALE_DELIVERED ledger entry created for full payment:', order.orderNumber);
                      }
                    } catch (ledgerError) {
                      console.error('Failed to create SALE_DELIVERED ledger entry:', ledgerError);
                    }
                  }

                  // If partial payment or full credit: Create credit record linked to booker
                  if (paymentStatus === 'PARTIAL' || paymentStatus === 'UNPAID') {
                    try {
                      const { useOutstandingPaymentStore } = await import('./outstandingPaymentStore');
                      const outstandingStore = useOutstandingPaymentStore.getState();
                      
                      await outstandingStore.addOutstandingPayment(
                        delivery.orderId,
                        delivery.orderNumber,
                        delivery.shopId,
                        delivery.shopName,
                        totalAmount,
                        paidAmount,
                        remainingBalance,
                        updatedDelivery.deliveredAt!,
                        delivery.salesmanId,
                        delivery.salesmanName,
                        order.bookerId, // Credit owned by booker
                        order.bookerName,
                        bill.id, // Link to bill
                        delivery.id
                      );
                      
                      console.log('Outstanding payment record created with booker:', {
                        orderNumber: delivery.orderNumber,
                        bookerId: order.bookerId,
                        remainingCredit: remainingBalance,
                      });
                    } catch (outstandingError) {
                      console.error('Failed to create outstanding payment record:', outstandingError);
                    }
                  }
                }
              } catch (billError) {
                console.error('Failed to create bill:', billError);
                // Don't fail delivery update if bill creation fails
              }
            }
          }
        } catch (ledgerError) {
          console.error('Failed to create payment collection ledger entry:', ledgerError);
          // Don't fail delivery update if ledger recording fails
        }
      }
    } catch (error) {
      console.warn('Failed to sync delivery completion to Firebase:', error);
      // Keep as pending - will sync later
    }

    return true;
  },

  markFailed: async (id, reason, notes) => {
    const { deliveries } = get();
    const deliveryIndex = deliveries.findIndex((d) => d.id === id);
    if (deliveryIndex === -1) return false;

    const updatedDelivery: Delivery = {
      ...deliveries[deliveryIndex],
      status: 'failed',
      failureReason: reason,
      failureNotes: notes,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedDeliveries = deliveries.map((d, index) =>
      index === deliveryIndex ? updatedDelivery : d
    );
    await storage.set(STORAGE_KEYS.DELIVERIES, updatedDeliveries);
    set({ deliveries: updatedDeliveries });

    // Try to sync to Firebase
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');

      // Sanitize data to remove undefined values before sending to Firebase
      const sanitizedData = sanitizeForFirebase({
        ...updatedDelivery,
        syncStatus: 'synced',
      });

      await firestoreService.updateDoc(COLLECTIONS.DELIVERIES, id, sanitizedData);
      
      // Update local storage with synced status
      const syncedDelivery = { ...updatedDelivery, syncStatus: 'synced' as const };
      const syncedDeliveries = updatedDeliveries.map((d) => (d.id === id ? syncedDelivery : d));
      await storage.set(STORAGE_KEYS.DELIVERIES, syncedDeliveries);
      set({ deliveries: syncedDeliveries });
    } catch (error) {
      console.warn('Failed to sync delivery failure to Firebase:', error);
      // Keep as pending - will sync later
    }

    return true;
  },

  updateDeliveryPayment: async (id, collectedAmount, notes) => {
    const { deliveries } = get();
    const deliveryIndex = deliveries.findIndex((d) => d.id === id);
    if (deliveryIndex === -1) return false;

    const delivery = deliveries[deliveryIndex];
    const currentUser = useAuthStore.getState().user;
    
    // Calculate new payment totals
    const currentPaidAmount = delivery.paidAmount || 0;
    const newPaidAmount = currentPaidAmount + collectedAmount;
    const totalAmount = delivery.totalAmount;
    const newRemainingBalance = totalAmount - newPaidAmount;
    
    // Determine payment status
    let newPaymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
    if (newPaidAmount === 0) {
      newPaymentStatus = 'UNPAID';
    } else if (newPaidAmount < totalAmount) {
      newPaymentStatus = 'PARTIAL';
    } else {
      newPaymentStatus = 'PAID';
    }

    // Create new payment record
    const newPaymentRecord: PaymentRecord = {
      id: `payment_${Date.now()}`,
      amount: collectedAmount,
      paidAt: new Date().toISOString(),
      collectedBy: currentUser?.id || 'unknown',
      notes: notes,
    };

    // Update payment history
    const existingHistory = delivery.paymentHistory || [];
    const updatedPaymentHistory = [...existingHistory, newPaymentRecord];

    const updatedDelivery: Delivery = {
      ...delivery,
      paidAmount: newPaidAmount,
      remainingBalance: newRemainingBalance,
      paymentStatus: newPaymentStatus,
      paymentHistory: updatedPaymentHistory,
      paymentCollected: newPaymentStatus === 'PAID',
      paymentAmount: newPaidAmount,
      paymentCollectedAt: newPaidAmount > 0 ? new Date().toISOString() : delivery.paymentCollectedAt,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedDeliveries = deliveries.map((d, index) =>
      index === deliveryIndex ? updatedDelivery : d
    );
    await storage.set(STORAGE_KEYS.DELIVERIES, updatedDeliveries);
    set({ deliveries: updatedDeliveries });

    // Try to sync to Firebase
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');

      const sanitizedData = sanitizeForFirebase({
        ...updatedDelivery,
        syncStatus: 'synced',
      });

      await firestoreService.updateDoc(COLLECTIONS.DELIVERIES, id, sanitizedData);
      
      const syncedDelivery = { ...updatedDelivery, syncStatus: 'synced' as const };
      const syncedDeliveries = updatedDeliveries.map((d) => (d.id === id ? syncedDelivery : d));
      await storage.set(STORAGE_KEYS.DELIVERIES, syncedDeliveries);
      set({ deliveries: syncedDeliveries });
    } catch (error) {
      console.warn('Failed to sync delivery payment update to Firebase:', error);
    }

    return true;
  },

  adjustDeliveryPayment: async (id, correctedAmount, notes) => {
    const { deliveries } = get();
    const deliveryIndex = deliveries.findIndex((d) => d.id === id);
    if (deliveryIndex === -1) return false;

    const delivery = deliveries[deliveryIndex];
    const currentUser = useAuthStore.getState().user;
    
    // Validate corrected amount
    if (correctedAmount < 0 || correctedAmount > delivery.totalAmount) {
      console.error('Invalid corrected amount:', correctedAmount, 'Total:', delivery.totalAmount);
      return false;
    }

    const totalAmount = delivery.totalAmount;
    const currentPaidAmount = delivery.paidAmount || delivery.totalAmount;
    const newPaidAmount = correctedAmount;
    const newRemainingBalance = totalAmount - newPaidAmount;
    
    // Can only adjust if currently marked as fully paid
    if (delivery.paymentStatus !== 'PAID') {
      console.warn('adjustDeliveryPayment: Can only adjust payments marked as PAID');
      return false;
    }

    // Determine new payment status
    let newPaymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
    if (newPaidAmount === 0) {
      newPaymentStatus = 'UNPAID';
    } else if (newPaidAmount < totalAmount) {
      newPaymentStatus = 'PARTIAL';
    } else {
      newPaymentStatus = 'PAID';
    }

    // Create adjustment payment record
    const adjustmentRecord: PaymentRecord = {
      id: `adjustment_${Date.now()}`,
      amount: correctedAmount - currentPaidAmount, // Can be negative
      paidAt: new Date().toISOString(),
      collectedBy: currentUser?.id || 'unknown',
      notes: notes || `Payment adjustment: Reduced from Rs. ${currentPaidAmount.toLocaleString()} to Rs. ${correctedAmount.toLocaleString()}`,
    };

    // Update payment history
    const existingHistory = delivery.paymentHistory || [];
    const updatedPaymentHistory = [...existingHistory, adjustmentRecord];

    const updatedDelivery: Delivery = {
      ...delivery,
      paidAmount: newPaidAmount,
      remainingBalance: newRemainingBalance,
      paymentStatus: newPaymentStatus,
      paymentHistory: updatedPaymentHistory,
      paymentCollected: newPaymentStatus === 'PAID',
      paymentAmount: newPaidAmount,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedDeliveries = deliveries.map((d, index) =>
      index === deliveryIndex ? updatedDelivery : d
    );
    await storage.set(STORAGE_KEYS.DELIVERIES, updatedDeliveries);
    set({ deliveries: updatedDeliveries });

    // Try to sync to Firebase
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');

      const sanitizedData = sanitizeForFirebase({
        ...updatedDelivery,
        syncStatus: 'synced',
      });

      await firestoreService.updateDoc(COLLECTIONS.DELIVERIES, id, sanitizedData);
      
      const syncedDelivery = { ...updatedDelivery, syncStatus: 'synced' as const };
      const syncedDeliveries = updatedDeliveries.map((d) => (d.id === id ? syncedDelivery : d));
      await storage.set(STORAGE_KEYS.DELIVERIES, syncedDeliveries);
      set({ deliveries: syncedDeliveries });

      // If payment was reduced, create outstanding payment record
      if (newPaymentStatus === 'PARTIAL' || newPaymentStatus === 'UNPAID') {
        try {
          const { useOutstandingPaymentStore } = await import('./outstandingPaymentStore');
          const outstandingStore = useOutstandingPaymentStore.getState();
          
          // Check if outstanding payment already exists
          const existingOutstanding = outstandingStore.getOutstandingPaymentByOrderId(delivery.orderId);
          
          if (!existingOutstanding) {
            // Create new outstanding payment record
            await outstandingStore.addOutstandingPayment(
              delivery.orderId,
              delivery.orderNumber,
              delivery.shopId,
              delivery.shopName,
              totalAmount,
              newPaidAmount,
              newRemainingBalance,
              delivery.deliveredAt || new Date().toISOString(),
              delivery.salesmanId,
              delivery.salesmanName,
              delivery.id
            );
            console.log('Outstanding payment record created after adjustment:', delivery.orderNumber);
          } else {
            // Update existing outstanding payment
            await outstandingStore.updateOutstandingPayment(
              delivery.orderId,
              newPaidAmount,
              newRemainingBalance,
              newPaymentStatus
            );
            console.log('Outstanding payment record updated after adjustment:', delivery.orderNumber);
          }
        } catch (outstandingError) {
          console.error('Failed to create/update outstanding payment after adjustment:', outstandingError);
        }
      }

      // Create adjustment ledger entry
      try {
        const { createPaymentCollectionLedgerEntry } = await import('../services/ledgerService');
        const { useShopStore } = await import('./shopStore');
        const shopStore = useShopStore.getState();
        const shop = shopStore.getShopById(delivery.shopId);

        if (shop && currentUser) {
          // Create a negative adjustment entry if payment was reduced
          const adjustmentAmount = correctedAmount - currentPaidAmount;
          if (adjustmentAmount < 0) {
            // Negative entry for payment reduction
            await createPaymentCollectionLedgerEntry(
              delivery.orderId,
              delivery.orderNumber,
              delivery.shopId,
              delivery.shopName,
              Math.abs(adjustmentAmount),
              newRemainingBalance,
              2, // Adjustment sequence
              currentUser.id,
              delivery.regionId,
              shop.branch,
              notes || `Payment adjustment: Reduced payment from Rs. ${currentPaidAmount.toLocaleString()} to Rs. ${correctedAmount.toLocaleString()}`
            );
          }
        }
      } catch (ledgerError) {
        console.error('Failed to create adjustment ledger entry:', ledgerError);
      }
    } catch (error) {
      console.warn('Failed to sync payment adjustment to Firebase:', error);
    }

    return true;
  },

  updateDeliveryItems: async (id, deliveredQuantities) => {
    const { deliveries } = get();
    const deliveryIndex = deliveries.findIndex((d) => d.id === id);
    if (deliveryIndex === -1) return false;

    const delivery = deliveries[deliveryIndex];
    const updatedItems = delivery.items.map((item) => ({
      ...item,
      deliveredQuantity: deliveredQuantities[item.productId] ?? item.deliveredQuantity,
    }));

    const deliveredAmount = updatedItems.reduce(
      (sum, item) => sum + item.deliveredQuantity * item.unitPrice,
      0
    );

    const updatedDelivery: Delivery = {
      ...delivery,
      items: updatedItems,
      deliveredAmount,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedDeliveries = deliveries.map((d, index) =>
      index === deliveryIndex ? updatedDelivery : d
    );
    await storage.set(STORAGE_KEYS.DELIVERIES, updatedDeliveries);
    set({ deliveries: updatedDeliveries });

    return true;
  },

  getDeliveryById: (id) => {
    return get().deliveries.find((delivery) => delivery.id === id);
  },

  getDeliveriesByStatus: (status) => {
    return get().deliveries.filter((d) => d.status === status);
  },

  getDeliveriesBySalesman: (salesmanId) => {
    return get().deliveries.filter((d) => d.salesmanId === salesmanId);
  },

  getPendingDeliveries: () => {
    return get().deliveries.filter(
      (d) => d.status === 'pending' || d.status === 'assigned' || d.status === 'in_transit'
    );
  },

  calculateDeliveryStats: () => {
    return calculateDeliveryStats(get().deliveries);
  },
}));

