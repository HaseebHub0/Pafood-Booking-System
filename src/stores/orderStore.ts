import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Order, OrderItem, OrderStatus, OrderTotals, Product, SubmitOrderResult } from '../types';
import { PaymentMode } from '../types/ledger';
import { storage, STORAGE_KEYS } from '../services/storage/asyncStorage';
import { getEffectiveMaxDiscount, checkOrderDiscountLimit } from '../data';
import { useShopStore } from './shopStore';
import { useAuthStore } from './authStore';
import { useLedgerStore } from './ledgerStore';

interface OrderState {
  orders: Order[];
  currentOrder: Order | null;
  isLoading: boolean;
  error: string | null;
}

interface OrderActions {
  loadOrders: () => Promise<void>;
  createOrder: (shopId: string) => void;
  addItem: (product: Product, quantity: number) => void;
  updateItemQuantity: (itemId: string, quantity: number) => void;
  updateItemDiscount: (itemId: string, discount: number) => void;
  removeItem: (itemId: string) => void;
  saveDraft: () => Promise<void>;
  submitOrder: (acknowledgeDeduction?: boolean) => Promise<SubmitOrderResult>;
  requestEdit: (orderId: string) => Promise<boolean>;
  getOrdersByStatus: (status: OrderStatus | 'all') => Order[];
  getOrderById: (id: string) => Order | undefined;
  calculateTotals: () => OrderTotals;
  clearCurrentOrder: () => void;
  setCurrentOrder: (order: Order) => void;
  updateNotes: (notes: string) => void;
  // Payment mode actions
  updatePaymentMode: (mode: PaymentMode, cashAmount?: number) => void;
  getShopAvailableCredit: () => number;
  // Status update action (for salesman delivery)
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<boolean>;
}

type OrderStore = OrderState & OrderActions;

// Calculate item totals with dual discount validation (product + booker limits)
const calculateItemTotals = (
  product: Product,
  quantity: number,
  discountPercent: number
): Partial<OrderItem> => {
  const lineTotal = quantity * product.price;
  const discountAmount = lineTotal * (discountPercent / 100);
  const finalAmount = lineTotal - discountAmount;
  
  // Get effective max discount considering BOTH product and booker limits
  const currentUser = useAuthStore.getState().user;
  const maxAllowedDiscount = getEffectiveMaxDiscount(
    product.category,
    product.maxDiscount,
    currentUser
  );
  
  const maxAllowedAmount = lineTotal * (maxAllowedDiscount / 100);
  const isUnauthorizedDiscount = discountPercent > maxAllowedDiscount;
  const unauthorizedAmount = isUnauthorizedDiscount
    ? discountAmount - maxAllowedAmount
    : 0;

  return {
    lineTotal,
    discountAmount,
    finalAmount,
    maxAllowedDiscount,
    isUnauthorizedDiscount,
    unauthorizedAmount,
  };
};

const generateOrderNumber = (): string => {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `ORD-${year}-${random}`;
};

export const useOrderStore = create<OrderStore>((set, get) => ({
  // Initial state
  orders: [],
  currentOrder: null,
  isLoading: false,
  error: null,

  // Actions
  loadOrders: async () => {
    set({ isLoading: true, error: null });

    try {
      const currentUser = useAuthStore.getState().user;
      
      // Try Firebase first
      try {
        const { firestoreService } = await import('../services/firebase');
        const { COLLECTIONS } = await import('../services/firebase/collections');
        
        let ordersList: Order[] = [];
        
        if (currentUser?.role === 'booker') {
          // Get orders for current booker (without orderBy to avoid index requirement)
          ordersList = await firestoreService.getDocsWhere<Order>(
            COLLECTIONS.ORDERS,
            'bookerId',
            '==',
            currentUser.id
          );
          // Filter by region
          ordersList = ordersList.filter(order => order.regionId === currentUser.regionId);
          // Sort in memory
          ordersList.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        } else if (currentUser?.role === 'admin' || currentUser?.role === 'owner') {
          // Admin/Owner can see all orders
          ordersList = await firestoreService.getDocs<Order>(
            COLLECTIONS.ORDERS,
            []
          );
          // Sort in memory
          ordersList.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        } else if (currentUser?.role === 'kpo') {
          // KPO can see orders in their region
          ordersList = await firestoreService.getDocsWhere<Order>(
            COLLECTIONS.ORDERS,
            'regionId',
            '==',
            currentUser.regionId
          );
          // Sort in memory
          ordersList.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        } else if (currentUser?.role?.toLowerCase() === 'salesman') {
          // Salesman can see only approved orders from assigned bookers
          console.log('Loading orders for salesman:', currentUser.id, 'regionId:', currentUser.regionId);
          
          try {
            const { useMappingStore } = await import('./mappingStore');
            const mappingStore = useMappingStore.getState();
            await mappingStore.loadMappings();
            const assignedBookerIds = mappingStore.getBookersForSalesman(currentUser.id);
            
            if (assignedBookerIds.length > 0) {
              // Get all orders in the region first (for performance)
              const regionOrders = currentUser?.regionId
                ? await firestoreService.getDocsWhere<Order>(
                    COLLECTIONS.ORDERS,
                    'regionId',
                    '==',
                    currentUser.regionId
                  )
                : await firestoreService.getDocs<Order>(COLLECTIONS.ORDERS, []);
              
              // Filter orders by assigned booker IDs and only show approved or higher status
              ordersList = regionOrders.filter(order => 
                assignedBookerIds.includes(order.bookerId) && 
                order.status !== 'draft' &&
                (order.status === 'approved' || order.status === 'billed' || order.status === 'load_form_ready' || order.status === 'assigned' || order.status === 'delivered')
              );
              
              console.log(`Found ${ordersList.length} approved orders from ${assignedBookerIds.length} assigned bookers`);
            } else {
              // No bookers assigned - show no orders
              ordersList = [];
              console.log('No bookers assigned to salesman, showing no orders');
            }
          } catch (error) {
            console.warn('Failed to load mappings for order filtering, falling back to branch:', error);
            // Fallback to branch-based filtering (old behavior)
            if (currentUser?.branch) {
              const regionOrders = currentUser?.regionId
                ? await firestoreService.getDocsWhere<Order>(
                    COLLECTIONS.ORDERS,
                    'regionId',
                    '==',
                    currentUser.regionId
                  )
                : await firestoreService.getDocs<Order>(COLLECTIONS.ORDERS, []);
              
              const allUsers = await firestoreService.getDocs<any>(COLLECTIONS.USERS, []);
              const branchBookers = allUsers.filter(
                (user: any) => 
                  user.branch === currentUser.branch && 
                  (user.role || '').toLowerCase() === 'booker'
              );
              const bookerIds = branchBookers.map((b: any) => b.id);
              ordersList = regionOrders.filter(order => bookerIds.includes(order.bookerId));
            } else if (currentUser?.regionId) {
              ordersList = await firestoreService.getDocsWhere<Order>(
                COLLECTIONS.ORDERS,
                'regionId',
                '==',
                currentUser.regionId
              );
            } else {
              ordersList = [];
            }
            // Exclude draft orders
            ordersList = ordersList.filter(order => order.status !== 'draft');
          }
          
          // Sort in memory
          ordersList.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        } else {
          // Unknown role - no orders
          ordersList = [];
        }

        // Update local storage cache
        await storage.set(STORAGE_KEYS.ORDERS, ordersList);
        set({ orders: ordersList, isLoading: false });
      } catch (firebaseError) {
        console.warn('Firebase load failed, trying local storage:', firebaseError);
        
        // Fallback to local storage
        const storedOrders = await storage.get<Order[]>(STORAGE_KEYS.ORDERS);
        const ordersList = storedOrders || [];
        set({ orders: ordersList, isLoading: false });
      }
    } catch (error) {
      set({
        error: 'Failed to load orders',
        isLoading: false,
      });
    }
  },

  createOrder: (shopId: string) => {
    const shop = useShopStore.getState().getShopById(shopId);
    const currentUser = useAuthStore.getState().user;

    if (!shop) {
      set({ error: 'Shop not found' });
      return;
    }

    // Ensure regionId is always set - prioritize shop's regionId, then booker's regionId
    const orderRegionId = shop.regionId || currentUser?.regionId || '';
    if (!orderRegionId) {
      console.warn('createOrder: Warning - No regionId found for shop or booker');
    }

    const newOrder: Order = {
      id: uuidv4(),
      orderNumber: generateOrderNumber(),
      shopId,
      shopName: shop.shopName,
      bookerId: currentUser?.id || 'booker_001',
      regionId: orderRegionId, // Inherit from shop or booker
      status: 'draft',
      items: [],
      subtotal: 0,
      totalDiscount: 0,
      allowedDiscount: 0,
      unauthorizedDiscount: 0,
      grandTotal: 0,
      notes: '',
      acknowledgedUnauthorizedDiscount: false,
      // Payment fields - default to cash
      paymentMode: 'cash',
      cashAmount: 0,
      creditAmount: 0,
      // KPO finalization fields
      billGenerated: false,
      loadFormGenerated: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    set({ currentOrder: newOrder });
  },

  addItem: (product: Product, quantity: number) => {
    const { currentOrder } = get();
    if (!currentOrder) return;

    // Check if product already exists in order
    const existingItemIndex = currentOrder.items.findIndex(
      (item) => item.productId === product.id
    );

    let updatedItems: OrderItem[];

    if (existingItemIndex >= 0) {
      // Update existing item quantity
      updatedItems = currentOrder.items.map((item, index) => {
        if (index === existingItemIndex) {
          const newQuantity = item.quantity + quantity;
          const totals = calculateItemTotals(product, newQuantity, item.discountPercent);
          return { ...item, quantity: newQuantity, ...totals };
        }
        return item;
      });
    } else {
      // Add new item with effective max discount
      const totals = calculateItemTotals(product, quantity, 0);
      const newItem: OrderItem = {
        id: uuidv4(),
        productId: product.id,
        productName: product.nameEn || product.name, // Use English name for display
        productNameUrdu: product.name, // Store Urdu name too
        quantity,
        unitPrice: product.price,
        unit: product.unit,
        discountPercent: 0,
        lineTotal: totals.lineTotal!,
        discountAmount: totals.discountAmount!,
        finalAmount: totals.finalAmount!,
        maxAllowedDiscount: totals.maxAllowedDiscount!,
        isUnauthorizedDiscount: totals.isUnauthorizedDiscount!,
        unauthorizedAmount: totals.unauthorizedAmount!,
      };
      updatedItems = [...currentOrder.items, newItem];
    }

    const totals = calculateOrderTotals(updatedItems);

    set({
      currentOrder: {
        ...currentOrder,
        items: updatedItems,
        ...totals,
        updatedAt: new Date().toISOString(),
      },
    });
  },

  updateItemQuantity: (itemId: string, quantity: number) => {
    const { currentOrder } = get();
    if (!currentOrder) return;

    if (quantity <= 0) {
      get().removeItem(itemId);
      return;
    }

    const currentUser = useAuthStore.getState().user;

    const updatedItems = currentOrder.items.map((item) => {
      if (item.id === itemId) {
        // Keep discount percent as is (no cap) - allow any discount
        const discountPercent = item.discountPercent;
        const lineTotal = quantity * item.unitPrice;
        const discountAmount = lineTotal * (discountPercent / 100);
        const finalAmount = lineTotal - discountAmount;
        
        // Recalculate effective max discount for this item
        const maxAllowedAmount = lineTotal * (item.maxAllowedDiscount / 100);
        const isUnauthorizedDiscount = discountPercent > item.maxAllowedDiscount;
        const unauthorizedAmount = isUnauthorizedDiscount
          ? discountAmount - maxAllowedAmount
          : 0;

        return {
          ...item,
          quantity,
          discountPercent, // Keep original discount percent (no cap)
          lineTotal,
          discountAmount,
          finalAmount,
          isUnauthorizedDiscount,
          unauthorizedAmount,
        };
      }
      return item;
    });

    const totals = calculateOrderTotals(updatedItems);

    set({
      currentOrder: {
        ...currentOrder,
        items: updatedItems,
        ...totals,
        updatedAt: new Date().toISOString(),
      },
    });
  },

  updateItemDiscount: (itemId: string, discount: number) => {
    const { currentOrder } = get();
    if (!currentOrder) return;

    const currentUser = useAuthStore.getState().user;

    const updatedItems = currentOrder.items.map((item) => {
      if (item.id === itemId) {
        // Recalculate lineTotal to ensure it's current (quantity * unitPrice)
        const lineTotal = item.quantity * item.unitPrice;
        
        // Allow any discount percentage (no cap) - user can exceed allowed limit
        // System will track unauthorized amount and show warning
        const discountPercent = Math.max(0, discount); // Only ensure non-negative
        
        // Calculate discount amount based on current lineTotal
        const discountAmount = lineTotal * (discountPercent / 100);
        const finalAmount = lineTotal - discountAmount;
        const maxAllowedAmount = lineTotal * (item.maxAllowedDiscount / 100);
        const isUnauthorizedDiscount = discountPercent > item.maxAllowedDiscount;
        const unauthorizedAmount = isUnauthorizedDiscount
          ? discountAmount - maxAllowedAmount
          : 0;

        console.log(`updateItemDiscount: Item ${itemId}`, {
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal,
          discountPercent,
          discountAmount,
          finalAmount,
          maxAllowedDiscount: item.maxAllowedDiscount
        });

        return {
          ...item,
          lineTotal, // Update lineTotal to ensure it's current
          discountPercent,
          discountAmount,
          finalAmount,
          isUnauthorizedDiscount,
          unauthorizedAmount,
        };
      }
      return item;
    });

    const totals = calculateOrderTotals(updatedItems);

    // Check total order discount against booker's maxDiscountAmount limit
    const orderLimitCheck = checkOrderDiscountLimit(totals.totalDiscount, currentUser);

    console.log('updateItemDiscount: Updated totals', {
      subtotal: totals.subtotal,
      totalDiscount: totals.totalDiscount,
      grandTotal: totals.grandTotal,
      unauthorizedDiscount: totals.unauthorizedDiscount
    });

    set({
      currentOrder: {
        ...currentOrder,
        items: updatedItems,
        ...totals,
        updatedAt: new Date().toISOString(),
      },
    });
  },

  removeItem: (itemId: string) => {
    const { currentOrder } = get();
    if (!currentOrder) return;

    const updatedItems = currentOrder.items.filter((item) => item.id !== itemId);
    const totals = calculateOrderTotals(updatedItems);

    set({
      currentOrder: {
        ...currentOrder,
        items: updatedItems,
        ...totals,
        updatedAt: new Date().toISOString(),
      },
    });
  },

  saveDraft: async () => {
    const { currentOrder, orders } = get();
    if (!currentOrder) return;

    const existingOrderIndex = orders.findIndex((o) => o.id === currentOrder.id);
    let updatedOrders: Order[];

    const orderToSave = {
      ...currentOrder,
      status: 'draft' as const,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending' as const,
    };

    if (existingOrderIndex >= 0) {
      updatedOrders = orders.map((o, index) =>
        index === existingOrderIndex ? orderToSave : o
      );
    } else {
      updatedOrders = [...orders, orderToSave];
    }

    await storage.set(STORAGE_KEYS.ORDERS, updatedOrders);
    set({ orders: updatedOrders, currentOrder: orderToSave });
  },

  submitOrder: async (acknowledgeDeduction = false) => {
    const { currentOrder, orders } = get();
    if (!currentOrder) {
      return { success: false, requiresConfirmation: false, message: 'No order to submit' };
    }

    if (currentOrder.items.length === 0) {
      return { success: false, requiresConfirmation: false, message: 'Order must have at least one item' };
    }

    const totals = get().calculateTotals();
    const currentUser = useAuthStore.getState().user;

    // Check for unauthorized discount from product/percentage limits
    let totalUnauthorized = totals.unauthorizedDiscount;

    // Also check if total discount exceeds booker's max amount limit
    // Only check if maxDiscountAmount is set and > 0
    const orderLimitCheck = checkOrderDiscountLimit(totals.totalDiscount, currentUser);
    if (orderLimitCheck.exceedsLimit) {
      totalUnauthorized += orderLimitCheck.excessAmount;
    }

    // If unauthorized discount exists, require confirmation with warning about salary deduction
    if (totalUnauthorized > 0 && !acknowledgeDeduction) {
      const maxDiscountPercent = currentUser?.maxDiscountPercent || 0;
      const maxDiscountAmount = currentUser?.maxDiscountAmount || 0;
      
      let warningMessage = '⚠️ Unauthorized Discount Detected!\n\n';
      warningMessage += `Aap ne allowed discount se ziada discount diya hai.\n\n`;
      
      if (totals.unauthorizedDiscount > 0) {
        warningMessage += `• Item discount: ${maxDiscountPercent}% se ziada\n`;
      }
      
      // Only show amount limit error if maxDiscountAmount is actually set (> 0)
      if (orderLimitCheck.exceedsLimit && maxDiscountAmount > 0) {
        warningMessage += `• Total discount: Rs. ${maxDiscountAmount.toFixed(0)} se ziada\n`;
      }
      
      warningMessage += `\n💰 Salary Deduction Notice:\n`;
      warningMessage += `Ye extra discount (Rs. ${totalUnauthorized.toFixed(2)}) aap ki salary me se kate ga.\n\n`;
      warningMessage += `Kya aap order submit karna chahte hain?`;
      
      return {
        success: false,
        requiresConfirmation: true,
        unauthorizedAmount: totalUnauthorized,
        message: warningMessage,
      };
    }

    // Validate credit if payment mode includes credit
    if (currentOrder.paymentMode !== 'cash' && currentOrder.creditAmount > 0) {
      const availableCredit = get().getShopAvailableCredit();
      if (currentOrder.creditAmount > availableCredit) {
        return {
          success: false,
          requiresConfirmation: false,
          message: `Credit amount exceeds available credit limit. Available: Rs. ${availableCredit.toLocaleString()}`,
        };
      }
    }

    const existingOrderIndex = orders.findIndex((o) => o.id === currentOrder.id);
    
    // Ensure regionId is set - use order's regionId, or fallback to booker's regionId
    const finalRegionId = currentOrder.regionId || currentUser?.regionId || '';
    if (!finalRegionId) {
      console.warn('submitOrder: Warning - No regionId found for order or booker');
    }
    
    // Ensure all items have correct discount calculations before submission
    const finalItems = currentOrder.items.map(item => {
      // Recalculate to ensure discount is properly applied
      const lineTotal = item.quantity * item.unitPrice;
      const discountAmount = lineTotal * ((item.discountPercent || 0) / 100);
      const finalAmount = lineTotal - discountAmount;
      
      return {
        ...item,
        lineTotal,
        discountAmount,
        finalAmount,
      };
    });
    
    // Recalculate totals with final items to ensure discount is included
    const finalTotals = calculateOrderTotals(finalItems);
    
    const orderToSubmit: Order = {
      ...currentOrder,
      items: finalItems, // Use items with recalculated discounts
      ...finalTotals, // Use recalculated totals that include discounts
      unauthorizedDiscount: totalUnauthorized,
      regionId: finalRegionId, // Ensure regionId is always set
      status: 'submitted',
      acknowledgedUnauthorizedDiscount: totalUnauthorized > 0,
      bookerName: currentUser?.name || currentUser?.email || 'Unknown', // Admin tracking
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
      // Ensure payment mode is always cash
      paymentMode: 'cash',
      cashAmount: finalTotals.grandTotal,
      creditAmount: 0,
    };
    
    console.log('submitOrder: Final order with discounts', {
      subtotal: finalTotals.subtotal,
      totalDiscount: finalTotals.totalDiscount,
      grandTotal: finalTotals.grandTotal,
      itemsCount: finalItems.length,
      items: finalItems.map(item => ({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        discountPercent: item.discountPercent,
        discountAmount: item.discountAmount,
        finalAmount: item.finalAmount
      }))
    });

    let updatedOrders: Order[];
    if (existingOrderIndex >= 0) {
      updatedOrders = orders.map((o, index) =>
        index === existingOrderIndex ? orderToSubmit : o
      );
    } else {
      updatedOrders = [...orders, orderToSubmit];
    }

    await storage.set(STORAGE_KEYS.ORDERS, updatedOrders);

    // Try to sync to Firebase
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');
      
      await firestoreService.setDoc(COLLECTIONS.ORDERS, {
        ...orderToSubmit,
        syncStatus: 'synced',
      });
      
      // Update local storage with synced status
      const syncedOrder = { ...orderToSubmit, syncStatus: 'synced' as const };
      const syncedOrders = updatedOrders.map((o) => (o.id === orderToSubmit.id ? syncedOrder : o));
      await storage.set(STORAGE_KEYS.ORDERS, syncedOrders);
      set({ orders: syncedOrders });

      // Track unauthorized discount if exists
      // Note: dataService is dashboard-specific, so we track via Firestore directly
      if (totalUnauthorized > 0 && currentUser?.id) {
        try {
          const { doc, getDoc, updateDoc, serverTimestamp } = await import('firebase/firestore');
          const { db } = await import('../config/firebase');
          
          // Update user document with unauthorized discount tracking
          const userRef = doc(db, 'users', currentUser.id);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            const monthlyDiscounts = userData.monthlyUnauthorizedDiscounts || {};
            const currentMonthTotal = monthlyDiscounts[currentMonth] || 0;
            
            const monthlyOrderIds = userData.monthlyUnauthorizedDiscountOrders || {};
            const currentMonthOrders = monthlyOrderIds[currentMonth] || [];
            
            if (!currentMonthOrders.includes(orderToSubmit.id)) {
              await updateDoc(userRef, {
                monthlyUnauthorizedDiscounts: {
                  ...monthlyDiscounts,
                  [currentMonth]: currentMonthTotal + totalUnauthorized
                },
                monthlyUnauthorizedDiscountOrders: {
                  ...monthlyOrderIds,
                  [currentMonth]: [...currentMonthOrders, orderToSubmit.id]
                },
                totalUnauthorizedDiscount: (userData.totalUnauthorizedDiscount || 0) + totalUnauthorized,
                updatedAt: serverTimestamp()
              });
            } else {
              await updateDoc(userRef, {
                monthlyUnauthorizedDiscounts: {
                  ...monthlyDiscounts,
                  [currentMonth]: currentMonthTotal + totalUnauthorized
                },
                totalUnauthorizedDiscount: (userData.totalUnauthorizedDiscount || 0) + totalUnauthorized,
                updatedAt: serverTimestamp()
              });
            }
            
            console.log(`trackUnauthorizedDiscount: Tracked Rs. ${totalUnauthorized} for booker ${currentUser.id}`);
          }
        } catch (trackError) {
          console.warn('Failed to track unauthorized discount:', trackError);
          // Don't fail order submission if tracking fails
        }
      }

      // Auto-create delivery and assign to salesman by area
      // Only create delivery for new orders (not for KPO edits of existing orders)
      if (existingOrderIndex < 0) {
      try {
        const { findSalesmanByArea } = await import('../utils/salesmanAssignment');
        const shopStore = useShopStore.getState();
        const shop = shopStore.getShopById(orderToSubmit.shopId);

        if (!shop) {
          console.warn('submitOrder: Shop not found for delivery creation');
        } else {
          // Find salesman by shop's branch (preferred) or area (fallback)
          const shopBranch = shop.branch || currentUser?.branch;
          const shopArea = shop.area || currentUser?.area;
          const salesmanAssignment = await findSalesmanByArea(
            shopBranch,
            shopArea,
            finalRegionId
          );

          if (salesmanAssignment) {
            // Create delivery directly in Firebase
            const deliveryData = {
              id: `delivery_${orderToSubmit.id}_${Date.now()}`,
              orderId: orderToSubmit.id,
              orderNumber: orderToSubmit.orderNumber,
              shopId: shop.id,
              shopName: shop.shopName,
              shopAddress: shop.address || '',
              shopPhone: shop.phone || '',
              regionId: finalRegionId,
              salesmanId: salesmanAssignment.salesmanId,
              salesmanName: salesmanAssignment.salesmanName,
              assignedAt: new Date().toISOString(),
              assignedBy: currentUser?.id || 'system',
              status: 'assigned',
              items: orderToSubmit.items.map((item) => ({
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                deliveredQuantity: 0,
                unit: item.unit || 'Pcs',
                unitPrice: item.unitPrice,
              })),
              totalAmount: orderToSubmit.grandTotal,
              deliveredAmount: 0,
              paymentCollected: false,
              invoiceGenerated: false,
              invoiceSigned: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              syncStatus: 'synced',
            };

            await firestoreService.setDoc(COLLECTIONS.DELIVERIES, deliveryData);
            console.log('Delivery created and assigned to salesman:', salesmanAssignment.salesmanName);
          } else {
            console.warn('submitOrder: No salesman found for area, delivery not created. KPO can assign manually.');
          }
        }
      } catch (deliveryError) {
        console.error('Failed to create delivery automatically:', deliveryError);
        // Don't fail order submission if delivery creation fails
        }
      } else {
        // Order was updated (existing order) - update existing delivery if it exists
        console.log('submitOrder: Order updated (existing order). Updating existing delivery if present.');
        try {
          const { firestoreService } = await import('../services/firebase');
          const { COLLECTIONS } = await import('../services/firebase/collections');
          const { query, where, getDocs } = await import('firebase/firestore');
          const { db } = await import('../config/firebase');
          const { collection } = await import('firebase/firestore');
          
          // Find existing delivery for this order
          const deliveriesRef = collection(db, COLLECTIONS.DELIVERIES);
          const q = query(deliveriesRef, where('orderId', '==', orderToSubmit.id));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            // Update the first delivery found (there should only be one per orderId after deduplication)
            const deliveryDoc = querySnapshot.docs[0];
            const shopStore = useShopStore.getState();
            const shop = shopStore.getShopById(orderToSubmit.shopId);
            
            if (shop) {
              await firestoreService.updateDoc(COLLECTIONS.DELIVERIES, deliveryDoc.id, {
                orderNumber: orderToSubmit.orderNumber,
                shopName: shop.shopName,
                shopAddress: shop.address || '',
                items: orderToSubmit.items.map((item) => ({
                  productId: item.productId,
                  productName: item.productName,
                  quantity: item.quantity,
                  deliveredQuantity: 0,
                  unit: item.unit || 'Pcs',
                  unitPrice: item.unitPrice,
                })),
                totalAmount: orderToSubmit.grandTotal,
                updatedAt: new Date().toISOString(),
                syncStatus: 'synced',
              });
              
              console.log('Delivery updated for edited order:', orderToSubmit.orderNumber);
              
              // Trigger a reload of deliveries to get the updated data
              // This ensures the UI stays in sync without manually updating the store
              const { useDeliveryStore } = await import('./deliveryStore');
              const deliveryStore = useDeliveryStore.getState();
              
              // Only reload if deliveries are already loaded (to avoid unnecessary Firebase calls)
              if (deliveryStore.deliveries.length > 0) {
                console.log('Triggering delivery reload to sync updated order data...');
                // Reload in the background without blocking
                deliveryStore.loadDeliveries().catch(err => {
                  console.warn('Failed to reload deliveries after order update:', err);
                });
              }
            }
          } else {
            console.log('No existing delivery found for edited order, skipping delivery update.');
          }
        } catch (deliveryUpdateError) {
          console.error('Failed to update delivery for edited order:', deliveryUpdateError);
          // Don't fail order submission if delivery update fails
        }
      }
    } catch (error) {
      console.warn('Failed to sync order to Firebase:', error);
      // Keep as pending - will sync later
      set({ orders: updatedOrders });
    }

    // ❌ REMOVED: Ledger entry creation on booking
    // Ledger entries should ONLY be created on delivery, not on booking
    // This ensures bookings don't affect cash, sales, or receivables until delivery
    
    // Log activity (non-financial) - this is OK for activity logs
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');
      const { serverTimestamp } = await import('firebase/firestore');
      
      await firestoreService.addDoc(COLLECTIONS.ACTIVITY_LOGS, {
        userId: currentUser?.id || 'system',
        action: `Order ${orderToSubmit.orderNumber} submitted by ${currentUser?.name || 'Unknown'}`,
        timestamp: serverTimestamp()
      });
    } catch (logError) {
      console.warn('Failed to log activity:', logError);
      // Don't fail order submission if logging fails
    }

    set({ currentOrder: null });

    return { success: true, requiresConfirmation: false, message: 'Order submitted successfully!' };
  },

  requestEdit: async (orderId: string) => {
    const { orders } = get();
    const order = orders.find(o => o.id === orderId);
    
    if (!order) {
      throw new Error('Order not found');
    }

    // Update local state
    const updatedOrder = {
      ...order,
      status: 'edit_requested' as const,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending' as const,
    };

    const updatedOrders = orders.map((o) =>
      o.id === orderId ? updatedOrder : o
    );

    await storage.set(STORAGE_KEYS.ORDERS, updatedOrders);
    set({ orders: updatedOrders });

    // Sync to Firebase
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');
      
      const orderRef = doc(db, COLLECTIONS.ORDERS, orderId);
      await updateDoc(orderRef, {
        status: 'edit_requested',
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced'
      });

      // Update local storage with synced status
      const syncedOrder = { ...updatedOrder, syncStatus: 'synced' as const };
      const syncedOrders = updatedOrders.map((o) => (o.id === orderId ? syncedOrder : o));
      await storage.set(STORAGE_KEYS.ORDERS, syncedOrders);
      set({ orders: syncedOrders });

      console.log('Order edit request synced to Firebase');
    } catch (error: any) {
      console.error('Error syncing edit request to Firebase:', error);
      // Don't throw - local update is still valid
      // The sync will retry on next sync cycle
    }

    return true;
  },

  getOrdersByStatus: (status: OrderStatus | 'all') => {
    const { orders } = get();
    if (status === 'all') return orders;
    return orders.filter((order) => order.status === status);
  },

  getOrderById: (id: string) => {
    return get().orders.find((order) => order.id === id);
  },

  calculateTotals: () => {
    const { currentOrder } = get();
    if (!currentOrder || currentOrder.items.length === 0) {
      return {
        subtotal: 0,
        totalDiscount: 0,
        allowedDiscount: 0,
        unauthorizedDiscount: 0,
        grandTotal: 0,
        hasUnauthorizedDiscount: false,
      };
    }

    const baseTotals = calculateOrderTotals(currentOrder.items);
    
    // Additional check for booker's max amount limit
    const currentUser = useAuthStore.getState().user;
    const orderLimitCheck = checkOrderDiscountLimit(baseTotals.totalDiscount, currentUser);
    
    if (orderLimitCheck.exceedsLimit) {
      return {
        ...baseTotals,
        unauthorizedDiscount: baseTotals.unauthorizedDiscount + orderLimitCheck.excessAmount,
        hasUnauthorizedDiscount: true,
        bookerLimitExceeded: true,
        bookerLimitExcessAmount: orderLimitCheck.excessAmount,
      };
    }

    return baseTotals;
  },

  clearCurrentOrder: () => {
    set({ currentOrder: null });
  },

  setCurrentOrder: (order: Order) => {
    set({ currentOrder: { ...order } });
  },

  updateNotes: (notes: string) => {
    const { currentOrder } = get();
    if (!currentOrder) return;

    set({
      currentOrder: {
        ...currentOrder,
        notes,
        updatedAt: new Date().toISOString(),
      },
    });
  },

  updatePaymentMode: (mode: PaymentMode, cashAmount?: number) => {
    const { currentOrder } = get();
    if (!currentOrder) return;

    const grandTotal = currentOrder.grandTotal;
    let cash = 0;
    let credit = 0;

    switch (mode) {
      case 'cash':
        cash = grandTotal;
        credit = 0;
        break;
      case 'credit':
        cash = 0;
        credit = grandTotal;
        break;
      case 'partial':
        cash = cashAmount ?? 0;
        credit = grandTotal - cash;
        // Ensure credit is not negative
        if (credit < 0) {
          cash = grandTotal;
          credit = 0;
        }
        break;
    }

    set({
      currentOrder: {
        ...currentOrder,
        paymentMode: mode,
        cashAmount: cash,
        creditAmount: credit,
        updatedAt: new Date().toISOString(),
      },
    });
  },

  getShopAvailableCredit: () => {
    const { currentOrder } = get();
    if (!currentOrder) return 0;

    const shop = useShopStore.getState().getShopById(currentOrder.shopId);
    if (!shop) return 0;

    // Available credit = Credit Limit - Current Balance
    return Math.max(0, shop.creditLimit - shop.currentBalance);
  },

  updateOrderStatus: async (orderId: string, status: OrderStatus, paymentDetails?: { cashAmount?: number; creditAmount?: number; paymentMode?: PaymentMode }) => {
    const { orders } = get();
    const orderIndex = orders.findIndex((o) => o.id === orderId);
    
    if (orderIndex === -1) {
      console.error('Order not found:', orderId);
      return false;
    }

    const order = orders[orderIndex];
    const updatedOrder: Order = {
      ...order,
      status,
      updatedAt: new Date().toISOString(),
      // Update payment details if provided
      ...(paymentDetails && {
        cashAmount: paymentDetails.cashAmount ?? order.cashAmount,
        creditAmount: paymentDetails.creditAmount ?? order.creditAmount,
        paymentMode: paymentDetails.paymentMode ?? order.paymentMode,
      }),
    };

    // Update local state
    const updatedOrders = [...orders];
    updatedOrders[orderIndex] = updatedOrder;
    set({ orders: updatedOrders });

    // Save to local storage
    await storage.set(STORAGE_KEYS.ORDERS, updatedOrders);

    // Sync to Firebase
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');
      
      const updateData: any = {
        status,
        updatedAt: updatedOrder.updatedAt,
        // Add delivery info if marking as delivered
        ...(status === 'delivered' && {
          deliveredAt: new Date().toISOString(),
          deliveredBy: useAuthStore.getState().user?.id,
          ...(paymentDetails && {
            cashAmount: paymentDetails.cashAmount ?? order.cashAmount,
            creditAmount: paymentDetails.creditAmount ?? order.creditAmount,
            paymentMode: paymentDetails.paymentMode ?? order.paymentMode,
          }),
        }),
      };
      
      await firestoreService.updateDoc(COLLECTIONS.ORDERS, orderId, updateData);
      
      // Create ledger entry when order is delivered (cash-only system)
      if (status === 'delivered') {
        try {
          const { createLedgerEntryOnDelivery } = await import('../services/ledgerService');
          const currentUser = useAuthStore.getState().user;
          const shopStore = useShopStore.getState();
          const shop = shopStore.getShopById(order.shopId);
          
          if (shop && currentUser) {
            // Create ledger entry using new service
            await createLedgerEntryOnDelivery(
              updatedOrder,
              currentUser.id,
              shop.shopName,
              shop.branch
            );
            
            console.log('Ledger entry created on order delivery:', {
                orderNumber: order.orderNumber,
              net_cash: updatedOrder.grandTotal - (updatedOrder.totalDiscount || 0),
            });
          }
        } catch (ledgerError) {
          console.error('Error creating ledger entry on delivery:', ledgerError);
          // Don't fail the delivery if ledger creation fails - it can be fixed later
        }
      }
      
      console.log('Order status updated in Firebase:', orderId, status);
      return true;
    } catch (error) {
      console.error('Error updating order status in Firebase:', error);
      // Keep local update - will sync later
      return true;
    }
  },
}));

// Helper function to calculate order totals
function calculateOrderTotals(items: OrderItem[]): OrderTotals {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const totalDiscount = items.reduce((sum, item) => sum + item.discountAmount, 0);
  const allowedDiscount = items.reduce((sum, item) => {
    const maxAllowed = item.lineTotal * (item.maxAllowedDiscount / 100);
    return sum + Math.min(item.discountAmount, maxAllowed);
  }, 0);
  const unauthorizedDiscount = items.reduce(
    (sum, item) => sum + item.unauthorizedAmount,
    0
  );
  const grandTotal = subtotal - totalDiscount;
  const hasUnauthorizedDiscount = unauthorizedDiscount > 0;

  return {
    subtotal,
    totalDiscount,
    allowedDiscount,
    unauthorizedDiscount,
    grandTotal,
    hasUnauthorizedDiscount,
  };
}
