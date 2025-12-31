import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  Target,
  TargetFormData,
  TargetType,
  TargetPeriod,
  PerformanceMetrics,
  calculateAchievement,
} from '../types/targets';
import { storage, STORAGE_KEYS } from '../services/storage/asyncStorage';
import { useAuthStore } from './authStore';
import { useOrderStore } from './orderStore';
import { useShopStore } from './shopStore';
import { useVisitStore } from './visitStore';
import { useLedgerStore } from './ledgerStore';
import { firestoreService } from '../services/firebase';
import { COLLECTIONS } from '../services/firebase/collections';
import { query, where, Timestamp } from 'firebase/firestore';

interface TargetState {
  targets: Target[];
  isLoading: boolean;
  error: string | null;
}

interface TargetActions {
  loadTargets: () => Promise<void>;
  createTarget: (data: TargetFormData) => Promise<Target>;
  updateTarget: (id: string, data: Partial<TargetFormData>) => Promise<boolean>;
  deleteTarget: (id: string) => Promise<boolean>;
  getTargetById: (id: string) => Target | undefined;
  getTargetsByPeriod: (period: TargetPeriod, periodValue: string) => Target[];
  getCurrentTargets: () => Target[];
  calculatePerformanceMetrics: () => Promise<PerformanceMetrics>;
  updateTargetProgress: () => Promise<void>;
}

type TargetStore = TargetState & TargetActions;

export const useTargetStore = create<TargetStore>((set, get) => ({
  // Initial state
  targets: [],
  isLoading: false,
  error: null,

  // Actions
  loadTargets: async () => {
    set({ isLoading: true, error: null });

    try {
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) {
        set({ targets: [], isLoading: false });
        return;
      }

      let targetsList: Target[] = [];

      // Try to fetch from Firebase first
      try {
        console.log('Loading targets from Firebase for booker:', currentUser.id);
        const firebaseTargets = await firestoreService.getDocsWhere<Target>(
          COLLECTIONS.TARGETS,
          'bookerId',
          '==',
          currentUser.id
        );
        
        // Convert Firebase targets to app format
        targetsList = firebaseTargets.map((target: any) => {
          // Convert Timestamps to ISO strings
          const converted: Target = {
            id: target.id,
            bookerId: target.bookerId || currentUser.id,
            bookerName: target.bookerName || currentUser.name || '',
            targetType: target.targetType,
            period: target.period || 'monthly',
            periodValue: target.periodValue || '',
            targetAmount: target.targetAmount || 0,
            targetCount: target.targetCount || 0,
            currentAmount: target.currentAmount || 0,
            currentCount: target.currentCount || 0,
            status: target.status || 'not_started',
            achievementPercent: target.achievementPercent || 0,
            startDate: target.startDate || (target.startDate?.toDate ? target.startDate.toDate().toISOString() : new Date().toISOString()),
            endDate: target.endDate || (target.endDate?.toDate ? target.endDate.toDate().toISOString() : new Date().toISOString()),
            notes: target.notes || '',
            createdAt: target.createdAt || (target.createdAt?.toDate ? target.createdAt.toDate().toISOString() : new Date().toISOString()),
            updatedAt: target.updatedAt || (target.updatedAt?.toDate ? target.updatedAt.toDate().toISOString() : new Date().toISOString()),
            syncStatus: 'synced',
          };
          return converted;
        });
        
        console.log(`Loaded ${targetsList.length} targets from Firebase`);
        
        // Cache in local storage
        await storage.set(STORAGE_KEYS.TARGETS, targetsList);
      } catch (firebaseError: any) {
        console.warn('Firebase load failed, using local storage:', firebaseError.message);
        
        // Fallback to local storage
        const storedTargets = await storage.get<Target[]>(STORAGE_KEYS.TARGETS);
        targetsList = (storedTargets || []).filter((target) => target.bookerId === currentUser.id);
      }

      set({ targets: targetsList, isLoading: false });
      
      // Auto-update progress when loading (with real Firebase data)
      await get().updateTargetProgress();
    } catch (error: any) {
      console.error('Error loading targets:', error);
      set({
        error: error.message || 'Failed to load targets',
        isLoading: false,
      });
    }
  },

  createTarget: async (data) => {
    const { targets } = get();
    const currentUser = useAuthStore.getState().user;

    const newTarget: Target = {
      id: uuidv4(),
      bookerId: currentUser?.id || '',
      bookerName: currentUser?.name || '',
      targetType: data.targetType,
      period: data.period,
      periodValue: data.periodValue,
      targetAmount: data.targetAmount,
      targetCount: data.targetCount,
      currentAmount: 0,
      currentCount: 0,
      status: 'not_started',
      achievementPercent: 0,
      startDate: data.startDate,
      endDate: data.endDate,
      notes: data.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedTargets = [...targets, newTarget];
    await storage.set(STORAGE_KEYS.TARGETS, updatedTargets);
    set({ targets: updatedTargets });

    // Update progress
    await get().updateTargetProgress();

    return newTarget;
  },

  updateTarget: async (id, data) => {
    const { targets } = get();
    const targetIndex = targets.findIndex((t) => t.id === id);
    if (targetIndex === -1) return false;

    const updatedTarget: Target = {
      ...targets[targetIndex],
      ...data,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedTargets = targets.map((t, index) => (index === targetIndex ? updatedTarget : t));
    await storage.set(STORAGE_KEYS.TARGETS, updatedTargets);
    set({ targets: updatedTargets });

    await get().updateTargetProgress();
    return true;
  },

  deleteTarget: async (id) => {
    const { targets } = get();
    const updatedTargets = targets.filter((t) => t.id !== id);
    await storage.set(STORAGE_KEYS.TARGETS, updatedTargets);
    set({ targets: updatedTargets });
    return true;
  },

  getTargetById: (id) => {
    return get().targets.find((target) => target.id === id);
  },

  getTargetsByPeriod: (period, periodValue) => {
    return get().targets.filter(
      (target) => target.period === period && target.periodValue === periodValue
    );
  },

  getCurrentTargets: () => {
    const now = new Date();
    const currentUser = useAuthStore.getState().user;
    
    return get().targets.filter((target) => {
      if (target.bookerId !== currentUser?.id) return false;
      
      const startDate = new Date(target.startDate);
      const endDate = new Date(target.endDate);
      return now >= startDate && now <= endDate;
    });
  },

  calculatePerformanceMetrics: async () => {
    const currentTargets = get().getCurrentTargets();
    const currentUser = useAuthStore.getState().user;
    
    if (!currentUser) {
      return {
        totalSales: 0,
        salesTarget: 0,
        salesAchievement: 0,
        newShopsCreated: 0,
        newShopsTarget: 0,
        shopsAchievement: 0,
        recoveryAmount: undefined,
        recoveryTarget: undefined,
        recoveryAchievement: undefined,
        totalVisits: 0,
        visitsTarget: undefined,
        visitsAchievement: undefined,
        overallAchievement: 0,
      };
    }

    // Get current month for calculations
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Calculate achievements from Firebase (similar to dashboard)
    let salesAmount = 0;
    let ordersCount = 0;
    let shopsCount = 0;
    let recoveryAmount = 0;

    try {
      // Fetch ALL orders for this booker in current month (not just delivered - bookers book orders)
      const orders = await firestoreService.getDocsWhere<any>(
        COLLECTIONS.ORDERS,
        'bookerId',
        '==',
        currentUser.id
      );
      
      const [year, month] = currentMonth.split('-');
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
      
      // Filter orders by date and status (count all active orders, exclude cancelled/rejected)
      const excludedStatuses = ['cancelled', 'rejected', 'edit_requested'];
      const periodOrders = orders.filter((order: any) => {
        // Exclude cancelled/rejected orders
        if (excludedStatuses.includes(order.status?.toLowerCase())) {
          return false;
        }
        
        // Filter by date (use createdAt for booker orders - when they created the order)
        const orderDate = order.createdAt 
          ? (order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt))
          : new Date();
        
        return orderDate >= startDate && orderDate <= endDate;
      });
      
      // Calculate sales amount only for delivered orders (for reference, not for targets)
      const deliveredOrders = periodOrders.filter((o: any) => o.status?.toLowerCase() === 'delivered');
      salesAmount = deliveredOrders.reduce((sum: number, order: any) => 
        sum + parseFloat(String(order.grandTotal || order.totalAmount || 0)), 0
      );
      ordersCount = periodOrders.length; // Count ALL orders, not just delivered

      // Fetch shops created by this booker in current month
      const shops = await firestoreService.getDocsWhere<any>(
        COLLECTIONS.SHOPS,
        'bookerId',
        '==',
        currentUser.id
      );
      
      const periodShops = shops.filter((shop: any) => {
        const shopDate = shop.createdAt 
          ? (shop.createdAt?.toDate ? shop.createdAt.toDate() : new Date(shop.createdAt))
          : new Date();
        return shopDate >= startDate && shopDate <= endDate;
      });
      
      shopsCount = periodShops.length;

      // Fetch payments (recovery) for this booker's shops in current month
      try {
        const bookerShopIds = shops.map((s: any) => s.id);
        
        if (bookerShopIds.length > 0) {
          // Get all payments and filter
          const allPayments = await firestoreService.getDocs<any>(COLLECTIONS.LEDGER_TRANSACTIONS, []);
          
          const periodPayments = allPayments.filter((payment: any) => {
            if (payment.type !== 'PAYMENT' || !bookerShopIds.includes(payment.shopId)) {
              return false;
            }
            
            const paymentDate = payment.date?.toDate 
              ? payment.date.toDate()
              : payment.date?.seconds 
              ? new Date(payment.date.seconds * 1000)
              : payment.createdAt?.toDate 
              ? payment.createdAt.toDate()
              : null;
            
            return paymentDate && paymentDate >= startDate && paymentDate <= endDate;
          });
          
          recoveryAmount = periodPayments.reduce((sum: number, payment: any) => 
            sum + Math.abs(payment.amount || 0), 0
          );
        }
      } catch (e) {
        console.warn('Error calculating recovery amount:', e);
      }
    } catch (error: any) {
      console.error('Error fetching performance data from Firebase:', error);
      // Fallback to local data
      const orderStore = useOrderStore.getState();
      const shopStore = useShopStore.getState();
      const ledgerStore = useLedgerStore.getState();
      
      const periodOrders = orderStore.orders.filter((o) => {
        if (o.status !== 'delivered') return false;
        const orderDate = new Date(o.createdAt);
        const orderMonth = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
        return orderMonth === currentMonth;
      });
      
      salesAmount = periodOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
      ordersCount = periodOrders.length;
      
      const periodShops = shopStore.shops.filter((s) => {
        const shopDate = new Date(s.createdAt);
        const shopMonth = `${shopDate.getFullYear()}-${String(shopDate.getMonth() + 1).padStart(2, '0')}`;
        return shopMonth === currentMonth;
      });
      shopsCount = periodShops.length;
    }

    // Get targets (bookers have orders target, not sales target)
    const ordersTarget = currentTargets.find((t) => t.targetType === 'orders');
    const shopsTarget = currentTargets.find((t) => t.targetType === 'new_shops');
    const recoveryTarget = currentTargets.find((t) => t.targetType === 'recovery');
    const visitsTarget = currentTargets.find((t) => t.targetType === 'visits');

    // Calculate achievements (use orders count, not sales amount)
    const ordersAchievement = ordersTarget
      ? calculateAchievement(ordersCount, ordersTarget.targetCount || 0).percent
      : 0;
    
    const shopsAchievement = shopsTarget
      ? calculateAchievement(shopsCount, shopsTarget.targetCount || 0).percent
      : 0;
    
    const recoveryAchievement = recoveryTarget && recoveryTarget.targetAmount
      ? calculateAchievement(recoveryAmount, recoveryTarget.targetAmount).percent
      : undefined;

    // Get visits (from local store for now)
    const visitStore = useVisitStore.getState();
    const today = new Date().toISOString().split('T')[0];
    const todayVisits = visitStore.getVisitsByDate(today);
    const visitsAchievement = visitsTarget
      ? calculateAchievement(todayVisits.length, visitsTarget.targetCount || 0).percent
      : undefined;

    // Calculate overall achievement (weighted average)
    const weights = { orders: 0.4, shops: 0.3, recovery: 0.2, visits: 0.1 };
    let overallAchievement = ordersAchievement * weights.orders + shopsAchievement * weights.shops;
    if (recoveryAchievement !== undefined) {
      overallAchievement += recoveryAchievement * weights.recovery;
    }
    if (visitsAchievement !== undefined) {
      overallAchievement += visitsAchievement * weights.visits;
    }

    return {
      totalSales: salesAmount, // Keep for reference, but not used for targets
      salesTarget: 0, // Not used for bookers
      salesAchievement: ordersAchievement, // Map to orders achievement
      newShopsCreated: shopsCount,
      newShopsTarget: shopsTarget?.targetCount || 0,
      shopsAchievement,
      recoveryAmount: recoveryAchievement !== undefined ? recoveryAmount : undefined,
      recoveryTarget: recoveryTarget?.targetAmount,
      recoveryAchievement,
      totalVisits: todayVisits.length,
      visitsTarget: visitsTarget?.targetCount,
      visitsAchievement,
      overallAchievement,
    };
  },

  updateTargetProgress: async () => {
    const { targets } = get();
    const currentUser = useAuthStore.getState().user;

    if (!currentUser) return;

    const now = new Date();

    try {
      // Fetch real data from Firebase for each target
      const updatedTargets = await Promise.all(targets.map(async (target) => {
        // Only update active targets
        const startDate = new Date(target.startDate);
        const endDate = new Date(target.endDate);
        if (now < startDate || now > endDate) return target;

        let currentAmount = target.currentAmount || 0;
        let currentCount = target.currentCount || 0;

        const [year, month] = target.periodValue.split('-');
        const periodStartDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const periodEndDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);

        try {
          switch (target.targetType) {
            case 'orders':
              // Fetch ALL orders for this booker in the period (not just delivered)
              const orders = await firestoreService.getDocsWhere<any>(
                COLLECTIONS.ORDERS,
                'bookerId',
                '==',
                currentUser.id
              );
              
              // Filter orders by date and status (count all active orders, exclude cancelled/rejected)
              const excludedStatuses = ['cancelled', 'rejected', 'edit_requested'];
              const periodOrders = orders.filter((order: any) => {
                // Exclude cancelled/rejected orders
                if (excludedStatuses.includes(order.status?.toLowerCase())) {
                  return false;
                }
                
                // Filter by date (use createdAt for booker orders)
                const orderDate = order.createdAt 
                  ? (order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt))
                  : new Date();
                
                return orderDate >= periodStartDate && orderDate <= periodEndDate;
              });
              
              currentCount = periodOrders.length; // Count orders, not sales amount
              break;

            case 'new_shops':
              // Fetch shops created by this booker in the period
              const shops = await firestoreService.getDocsWhere<any>(
                COLLECTIONS.SHOPS,
                'bookerId',
                '==',
                currentUser.id
              );
              
              const periodShops = shops.filter((shop: any) => {
                const shopDate = shop.createdAt 
                  ? (shop.createdAt?.toDate ? shop.createdAt.toDate() : new Date(shop.createdAt))
                  : new Date();
                return shopDate >= periodStartDate && shopDate <= periodEndDate;
              });
              
              currentCount = periodShops.length;
              break;

            case 'recovery':
              // Fetch payments for this booker's shops in the period
              const allShops = await firestoreService.getDocsWhere<any>(
                COLLECTIONS.SHOPS,
                'bookerId',
                '==',
                currentUser.id
              );
              const bookerShopIds = allShops.map((s: any) => s.id);
              
              if (bookerShopIds.length > 0) {
                const allPayments = await firestoreService.getDocs<any>(COLLECTIONS.LEDGER_TRANSACTIONS, []);
                
                const periodPayments = allPayments.filter((payment: any) => {
                  if (payment.type !== 'PAYMENT' || !bookerShopIds.includes(payment.shopId)) {
                    return false;
                  }
                  
                  const paymentDate = payment.date?.toDate 
                    ? payment.date.toDate()
                    : payment.date?.seconds 
                    ? new Date(payment.date.seconds * 1000)
                    : payment.createdAt?.toDate 
                    ? payment.createdAt.toDate()
                    : null;
                  
                  return paymentDate && paymentDate >= periodStartDate && paymentDate <= periodEndDate;
                });
                
                currentAmount = periodPayments.reduce((sum: number, payment: any) => 
                  sum + Math.abs(payment.amount || 0), 0
                );
              }
              break;

            case 'visits':
              // Use local visit store for visits
              const visitStore = useVisitStore.getState();
              const periodVisits = visitStore.visits.filter((v) => {
                const visitDate = (v.startTime || v.createdAt).split('T')[0];
                return visitDate >= target.startDate && visitDate <= target.endDate;
              });
              currentCount = periodVisits.filter((v) => v.status === 'completed').length;
              break;
          }
        } catch (error: any) {
          console.warn(`Error updating progress for target ${target.id}:`, error.message);
          // Keep existing values on error
        }

        const targetValue = target.targetType === 'recovery' 
          ? (target.targetAmount || 0)
          : (target.targetCount || 0);
        const currentValue = target.targetType === 'recovery' 
          ? currentAmount 
          : currentCount;
        
        const { percent, status } = calculateAchievement(currentValue, targetValue);

        return {
          ...target,
          currentAmount,
          currentCount,
          achievementPercent: percent,
          status,
          updatedAt: new Date().toISOString(),
        };
      }));

      await storage.set(STORAGE_KEYS.TARGETS, updatedTargets);
      set({ targets: updatedTargets });
    } catch (error: any) {
      console.error('Error updating target progress:', error);
    }
  },
}));

