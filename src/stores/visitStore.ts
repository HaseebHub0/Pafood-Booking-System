import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  Visit,
  VisitFormData,
  VisitStatus,
  VisitType,
  DailyVisitSummary,
  calculateVisitStats,
} from '../types/visit';
import { storage, STORAGE_KEYS } from '../services/storage/asyncStorage';
import { useAuthStore } from './authStore';
import { useShopStore } from './shopStore';
import { getCurrentLocation, LocationCoordinates } from '../services/location';

interface VisitState {
  visits: Visit[];
  currentVisit: Visit | null;
  isLoading: boolean;
  error: string | null;
}

interface VisitActions {
  loadVisits: () => Promise<void>;
  startVisit: (data: VisitFormData) => Promise<Visit | null>;
  completeVisit: (visitId: string, orderCreated?: boolean, orderId?: string, notes?: string) => Promise<boolean>;
  skipVisit: (visitId: string, reason: Visit['skipReason'], notes?: string) => Promise<boolean>;
  updateVisitNotes: (visitId: string, notes: string) => Promise<boolean>;
  getVisitById: (id: string) => Visit | undefined;
  getVisitsByDate: (date: string) => Visit[];
  getVisitsByShop: (shopId: string) => Visit[];
  getDailySummary: (date: string) => DailyVisitSummary | null;
  getCurrentVisit: () => Visit | null;
  setCurrentVisit: (visit: Visit | null) => void;
}

type VisitStore = VisitState & VisitActions;

export const useVisitStore = create<VisitStore>((set, get) => ({
  // Initial state
  visits: [],
  currentVisit: null,
  isLoading: false,
  error: null,

  // Actions
  loadVisits: async () => {
    set({ isLoading: true, error: null });

    try {
      const storedVisits = await storage.get<Visit[]>(STORAGE_KEYS.VISITS);
      const currentUser = useAuthStore.getState().user;

      let visitsList: Visit[] = storedVisits || [];

      // Filter visits by current user's bookerId and region
      if (currentUser) {
        const shopStore = useShopStore.getState();
        visitsList = visitsList.filter((visit) => {
          if (currentUser.role === 'booker' && visit.bookerId !== currentUser.id) {
            return false;
          }
          // Check region
          const shop = shopStore.getShopById(visit.shopId);
          if (shop && currentUser.role !== 'admin' && currentUser.role !== 'owner') {
            return shop.regionId === currentUser.regionId;
          }
          return true;
        });
      }

      set({ visits: visitsList, isLoading: false });
    } catch (error) {
      set({
        error: 'Failed to load visits',
        isLoading: false,
      });
    }
  },

  startVisit: async (data) => {
    const { visits } = get();
    const currentUser = useAuthStore.getState().user;
    const shopStore = useShopStore.getState();

    const shop = shopStore.getShopById(data.shopId);
    if (!shop) {
      set({ error: 'Shop not found' });
      return null;
    }

    // Get current location
    const location = await getCurrentLocation();

    const newVisit: Visit = {
      id: uuidv4(),
      shopId: data.shopId,
      shopName: shop.shopName,
      bookerId: currentUser?.id || '',
      bookerName: currentUser?.name || '',
      visitType: data.visitType,
      status: 'in_progress',
      scheduledTime: data.scheduledTime,
      startTime: new Date().toISOString(),
      location: location || undefined,
      locationAccuracy: location?.accuracy,
      notes: data.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedVisits = [...visits, newVisit];
    await storage.set(STORAGE_KEYS.VISITS, updatedVisits);
    set({ visits: updatedVisits, currentVisit: newVisit });

    return newVisit;
  },

  completeVisit: async (visitId, orderCreated = false, orderId, notes) => {
    const { visits, currentVisit } = get();
    const visitIndex = visits.findIndex((v) => v.id === visitId);
    if (visitIndex === -1) return false;

    const visit = visits[visitIndex];
    const startTime = visit.startTime ? new Date(visit.startTime).getTime() : Date.now();
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 60000); // Minutes

    // Get final location
    const finalLocation = await getCurrentLocation();

    const updatedVisit: Visit = {
      ...visit,
      status: 'completed',
      endTime: new Date().toISOString(),
      duration,
      location: finalLocation || visit.location,
      locationAccuracy: finalLocation?.accuracy || visit.locationAccuracy,
      orderCreated,
      orderId,
      orderNumber: orderId ? `ORD-${orderId.slice(-6)}` : undefined,
      notes: notes || visit.notes,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedVisits = visits.map((v, index) => (index === visitIndex ? updatedVisit : v));
    await storage.set(STORAGE_KEYS.VISITS, updatedVisits);
    
    // Clear current visit if it's the one being completed
    const newCurrentVisit = currentVisit?.id === visitId ? null : currentVisit;
    set({ visits: updatedVisits, currentVisit: newCurrentVisit });

    return true;
  },

  skipVisit: async (visitId, reason, notes) => {
    const { visits } = get();
    const visitIndex = visits.findIndex((v) => v.id === visitId);
    if (visitIndex === -1) return false;

    const visit = visits[visitIndex];
    const updatedVisit: Visit = {
      ...visit,
      status: 'skipped',
      endTime: new Date().toISOString(),
      skipReason: reason,
      skipNotes: notes,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedVisits = visits.map((v, index) => (index === visitIndex ? updatedVisit : v));
    await storage.set(STORAGE_KEYS.VISITS, updatedVisits);
    set({ visits: updatedVisits });

    return true;
  },

  updateVisitNotes: async (visitId, notes) => {
    const { visits } = get();
    const visitIndex = visits.findIndex((v) => v.id === visitId);
    if (visitIndex === -1) return false;

    const updatedVisit: Visit = {
      ...visits[visitIndex],
      notes,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedVisits = visits.map((v, index) => (index === visitIndex ? updatedVisit : v));
    await storage.set(STORAGE_KEYS.VISITS, updatedVisits);
    set({ visits: updatedVisits });

    return true;
  },

  getVisitById: (id) => {
    return get().visits.find((visit) => visit.id === id);
  },

  getVisitsByDate: (date) => {
    return get()
      .visits.filter((visit) => {
        const visitDate = visit.startTime || visit.createdAt;
        return visitDate.split('T')[0] === date;
      })
      .sort((a, b) => {
        const timeA = a.startTime || a.createdAt;
        const timeB = b.startTime || b.createdAt;
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      });
  },

  getVisitsByShop: (shopId) => {
    return get()
      .visits.filter((visit) => visit.shopId === shopId)
      .sort((a, b) => {
        const timeA = a.startTime || a.createdAt;
        const timeB = b.startTime || b.createdAt;
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      });
  },

  getDailySummary: (date) => {
    const visits = get().getVisitsByDate(date);
    const shopStore = useShopStore.getState();
    const shops = shopStore.shops;

    const visitedShopIds = new Set(
      visits.filter((v) => v.status === 'completed').map((v) => v.shopId)
    );
    const skippedShopIds = new Set(
      visits.filter((v) => v.status === 'skipped').map((v) => v.shopId)
    );

    const visitStats = calculateVisitStats(visits);

    // Calculate total sales from orders created during visits
    const ordersWithVisits = visits
      .filter((v) => v.orderCreated && v.orderId)
      .map((v) => v.orderId);

    // Note: This would need integration with orderStore to get actual sales amounts
    const totalSales = 0; // Placeholder - would calculate from orders

    return {
      date,
      totalShops: shops.length,
      visitedShops: visitedShopIds.size,
      skippedShops: skippedShopIds.size,
      ordersCreated: visitStats.ordersCreated,
      totalSales,
      visitStats,
      visits,
    };
  },

  getCurrentVisit: () => {
    return get().currentVisit;
  },

  setCurrentVisit: (visit) => {
    set({ currentVisit: visit });
  },
}));

