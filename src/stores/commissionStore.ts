import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Commission, CommissionFormData, CommissionStatus, CommissionPeriod } from '../types/commission';
import { storage, STORAGE_KEYS } from '../services/storage/asyncStorage';
import { useAuthStore } from './authStore';
import { sanitizeForFirebase } from '../utils/dataSanitizers';

interface CommissionState {
  commissions: Commission[];
  isLoading: boolean;
  error: string | null;
}

interface CommissionActions {
  loadCommissions: () => Promise<void>;
  addCommission: (data: CommissionFormData) => Promise<Commission>;
  updateCommission: (id: string, data: Partial<CommissionFormData>) => Promise<boolean>;
  deleteCommission: (id: string) => Promise<boolean>;
  getCommissionById: (id: string) => Commission | undefined;
  getCommissionsByBooker: (bookerId: string) => Commission[];
  getCommissionsByPeriod: (period: CommissionPeriod, periodValue: string) => Commission[];
  getCommissionsByStatus: (status: CommissionStatus) => Commission[];
}

type CommissionStore = CommissionState & CommissionActions;

export const useCommissionStore = create<CommissionStore>((set, get) => ({
  // Initial state
  commissions: [],
  isLoading: false,
  error: null,

  // Actions
  loadCommissions: async () => {
    set({ isLoading: true, error: null });

    try {
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) {
        set({ commissions: [], isLoading: false });
        return;
      }

      let commissionsList: Commission[] = [];

      // Try to fetch from Firebase first
      try {
        const { firestoreService } = await import('../services/firebase');
        const { COLLECTIONS } = await import('../services/firebase/collections');
        
        // KPO/Admin can see all commissions, bookers see only their own
        if (currentUser.role?.toLowerCase() === 'kpo' || currentUser.role?.toLowerCase() === 'admin') {
          commissionsList = await firestoreService.getDocs<Commission>(COLLECTIONS.COMMISSIONS);
        } else if (currentUser.role?.toLowerCase() === 'booker') {
          commissionsList = await firestoreService.getDocsWhere<Commission>(
            COLLECTIONS.COMMISSIONS,
            'bookerId',
            '==',
            currentUser.id
          );
        }

        // Convert Firebase commissions to app format
        commissionsList = commissionsList.map((commission: any) => ({
          id: commission.id,
          bookerId: commission.bookerId,
          bookerName: commission.bookerName || '',
          period: commission.period || 'monthly',
          periodValue: commission.periodValue || '',
          targetId: commission.targetId,
          totalSales: commission.totalSales || 0,
          targetAchievement: commission.targetAchievement || 0,
          commissionAmount: commission.commissionAmount || 0,
          status: commission.status || 'pending',
          assignedBy: commission.assignedBy || '',
          assignedByName: commission.assignedByName,
          assignedAt: commission.assignedAt || (commission.assignedAt?.toDate ? commission.assignedAt.toDate().toISOString() : new Date().toISOString()),
          paidAt: commission.paidAt || (commission.paidAt?.toDate ? commission.paidAt.toDate().toISOString() : undefined),
          notes: commission.notes || '',
          createdAt: commission.createdAt || (commission.createdAt?.toDate ? commission.createdAt.toDate().toISOString() : new Date().toISOString()),
          updatedAt: commission.updatedAt || (commission.updatedAt?.toDate ? commission.updatedAt.toDate().toISOString() : new Date().toISOString()),
          syncStatus: 'synced',
        }));

        // Cache in local storage
        await storage.set(STORAGE_KEYS.COMMISSIONS, commissionsList);
      } catch (firebaseError: any) {
        console.warn('Firebase load failed, trying local storage:', firebaseError.message);
        
        // Fallback to local storage
        const storedCommissions = await storage.get<Commission[]>(STORAGE_KEYS.COMMISSIONS);
        commissionsList = storedCommissions || [];
      }

      set({ commissions: commissionsList, isLoading: false });
    } catch (error) {
      set({
        error: 'Failed to load commissions',
        isLoading: false,
      });
    }
  },

  addCommission: async (data) => {
    const { commissions } = get();
    const currentUser = useAuthStore.getState().user;
    
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    // Get booker name if not provided
    let bookerName = data.bookerName;
    if (!bookerName) {
      try {
        const { firestoreService } = await import('../services/firebase');
        const { COLLECTIONS } = await import('../services/firebase/collections');
        const booker = await firestoreService.getDoc(COLLECTIONS.USERS, data.bookerId);
        bookerName = booker?.name || booker?.email || 'Unknown Booker';
      } catch (error) {
        bookerName = 'Unknown Booker';
      }
    }

    const newCommission: Commission = {
      id: uuidv4(),
      bookerId: data.bookerId,
      bookerName: bookerName,
      period: data.period,
      periodValue: data.periodValue,
      targetId: data.targetId,
      totalSales: data.totalSales,
      targetAchievement: data.targetAchievement,
      commissionAmount: data.commissionAmount,
      status: data.status || 'pending',
      assignedBy: currentUser.id,
      assignedByName: currentUser.name || currentUser.email || 'Unknown',
      assignedAt: new Date().toISOString(),
      paidAt: undefined,
      notes: data.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedCommissions = [...commissions, newCommission];
    await storage.set(STORAGE_KEYS.COMMISSIONS, updatedCommissions);
    set({ commissions: updatedCommissions });

    // Try to sync to Firebase
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');

      const sanitizedCommission = sanitizeForFirebase({
        ...newCommission,
        syncStatus: 'synced',
      });

      await firestoreService.setDoc(COLLECTIONS.COMMISSIONS, sanitizedCommission);
      
      const syncedCommission = { ...newCommission, syncStatus: 'synced' as const };
      const syncedCommissions = updatedCommissions.map((c) => (c.id === newCommission.id ? syncedCommission : c));
      await storage.set(STORAGE_KEYS.COMMISSIONS, syncedCommissions);
      set({ commissions: syncedCommissions });
    } catch (error) {
      console.warn('Failed to sync commission to Firebase:', error);
    }

    return newCommission;
  },

  updateCommission: async (id, data) => {
    const { commissions } = get();
    const commissionIndex = commissions.findIndex((c) => c.id === id);
    if (commissionIndex === -1) return false;

    const updatedCommission: Commission = {
      ...commissions[commissionIndex],
      ...data,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedCommissions = commissions.map((c, index) =>
      index === commissionIndex ? updatedCommission : c
    );
    await storage.set(STORAGE_KEYS.COMMISSIONS, updatedCommissions);
    set({ commissions: updatedCommissions });

    // Try to sync to Firebase
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');

      const sanitizedData = sanitizeForFirebase({
        ...updatedCommission,
        syncStatus: 'synced',
      });

      await firestoreService.updateDoc(COLLECTIONS.COMMISSIONS, id, sanitizedData);
      
      const syncedCommission = { ...updatedCommission, syncStatus: 'synced' as const };
      const syncedCommissions = updatedCommissions.map((c) => (c.id === id ? syncedCommission : c));
      await storage.set(STORAGE_KEYS.COMMISSIONS, syncedCommissions);
      set({ commissions: syncedCommissions });
    } catch (error) {
      console.warn('Failed to sync commission update to Firebase:', error);
    }

    return true;
  },

  deleteCommission: async (id) => {
    const { commissions } = get();
    const updatedCommissions = commissions.filter((c) => c.id !== id);
    await storage.set(STORAGE_KEYS.COMMISSIONS, updatedCommissions);
    set({ commissions: updatedCommissions });

    // Try to delete from Firebase
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');
      await firestoreService.deleteDoc(COLLECTIONS.COMMISSIONS, id);
    } catch (error) {
      console.warn('Failed to delete commission from Firebase:', error);
    }

    return true;
  },

  getCommissionById: (id) => {
    return get().commissions.find((commission) => commission.id === id);
  },

  getCommissionsByBooker: (bookerId) => {
    return get().commissions.filter((c) => c.bookerId === bookerId);
  },

  getCommissionsByPeriod: (period, periodValue) => {
    return get().commissions.filter(
      (c) => c.period === period && c.periodValue === periodValue
    );
  },

  getCommissionsByStatus: (status) => {
    return get().commissions.filter((c) => c.status === status);
  },
}));

