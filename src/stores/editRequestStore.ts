import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { ShopEditRequest, EditRequestFormData, EditRequestStatus } from '../types/editRequest';
import { storage, STORAGE_KEYS } from '../services/storage/asyncStorage';
import { useAuthStore } from './authStore';
import { useShopStore } from './shopStore';

interface EditRequestState {
  editRequests: ShopEditRequest[];
  isLoading: boolean;
  error: string | null;
}

interface EditRequestActions {
  loadEditRequests: () => Promise<void>;
  createEditRequest: (data: EditRequestFormData) => Promise<ShopEditRequest>;
  approveRequest: (requestId: string, approvedBy: string, notes?: string) => Promise<boolean>;
  rejectRequest: (requestId: string, rejectedBy: string, reason: string) => Promise<boolean>;
  getRequestById: (id: string) => ShopEditRequest | undefined;
  getRequestsByShop: (shopId: string) => ShopEditRequest[];
  getRequestsByStatus: (status: EditRequestStatus) => ShopEditRequest[];
  getPendingRequests: () => ShopEditRequest[];
}

type EditRequestStore = EditRequestState & EditRequestActions;

export const useEditRequestStore = create<EditRequestStore>((set, get) => ({
  // Initial state
  editRequests: [],
  isLoading: false,
  error: null,

  // Actions
  loadEditRequests: async () => {
    set({ isLoading: true, error: null });

    try {
      const storedRequests = await storage.get<ShopEditRequest[]>(STORAGE_KEYS.EDIT_REQUESTS);
      const currentUser = useAuthStore.getState().user;

      let requestsList: ShopEditRequest[] = storedRequests || [];

      // Filter by booker if user is booker
      if (currentUser?.role === 'booker') {
        requestsList = requestsList.filter((req) => req.requestedBy === currentUser.id);
      }

      set({ editRequests: requestsList, isLoading: false });
    } catch (error) {
      set({
        error: 'Failed to load edit requests',
        isLoading: false,
      });
    }
  },

  createEditRequest: async (data) => {
    const { editRequests } = get();
    const currentUser = useAuthStore.getState().user;
    const shopStore = useShopStore.getState();
    const shop = shopStore.getShopById(data.shopId);

    if (!shop) {
      set({ error: 'Shop not found' });
      throw new Error('Shop not found');
    }

    // Build current values object
    const currentValues: ShopEditRequest['currentValues'] = {
      shopName: shop.shopName,
      ownerName: shop.ownerName,
      phone: shop.phone,
      city: shop.city,
      area: shop.area,
      address: shop.address,
      creditLimit: shop.creditLimit,
    };

    // Only include changed fields in requestedChanges
    const requestedChanges: ShopEditRequest['requestedChanges'] = {};
    Object.keys(data.changes).forEach((key) => {
      const typedKey = key as keyof typeof data.changes;
      if (data.changes[typedKey] !== undefined && data.changes[typedKey] !== currentValues[typedKey]) {
        requestedChanges[typedKey] = data.changes[typedKey] as any;
      }
    });

    // Check if there are any actual changes
    if (Object.keys(requestedChanges).length === 0) {
      set({ error: 'No changes detected' });
      throw new Error('No changes detected');
    }

    const newRequest: ShopEditRequest = {
      id: uuidv4(),
      shopId: shop.id,
      shopName: shop.shopName,
      requestedChanges,
      currentValues,
      status: 'pending',
      requestedBy: currentUser?.id || '',
      requestedByName: currentUser?.name || '',
      requestedAt: new Date().toISOString(),
      requestNotes: data.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedRequests = [...editRequests, newRequest];
    await storage.set(STORAGE_KEYS.EDIT_REQUESTS, updatedRequests);
    set({ editRequests: updatedRequests });

    return newRequest;
  },

  approveRequest: async (requestId, approvedBy, notes) => {
    const { editRequests } = get();
    const requestIndex = editRequests.findIndex((req) => req.id === requestId);
    
    if (requestIndex === -1) return false;

    const request = editRequests[requestIndex];
    const shopStore = useShopStore.getState();

    // Apply changes to shop
    await shopStore.updateShop(request.shopId, request.requestedChanges as any);

    const updatedRequest: ShopEditRequest = {
      ...request,
      status: 'approved',
      approvedBy,
      approvedByName: 'KPO', // Would be fetched from user store
      approvedAt: new Date().toISOString(),
      approvalNotes: notes,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedRequests = editRequests.map((req, index) =>
      index === requestIndex ? updatedRequest : req
    );
    await storage.set(STORAGE_KEYS.EDIT_REQUESTS, updatedRequests);
    set({ editRequests: updatedRequests });

    return true;
  },

  rejectRequest: async (requestId, rejectedBy, reason) => {
    const { editRequests } = get();
    const requestIndex = editRequests.findIndex((req) => req.id === requestId);
    
    if (requestIndex === -1) return false;

    const updatedRequest: ShopEditRequest = {
      ...editRequests[requestIndex],
      status: 'rejected',
      approvedBy: rejectedBy, // Reusing field
      approvedByName: 'KPO',
      approvedAt: new Date().toISOString(),
      rejectedReason: reason,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedRequests = editRequests.map((req, index) =>
      index === requestIndex ? updatedRequest : req
    );
    await storage.set(STORAGE_KEYS.EDIT_REQUESTS, updatedRequests);
    set({ editRequests: updatedRequests });

    return true;
  },

  getRequestById: (id) => {
    return get().editRequests.find((req) => req.id === id);
  },

  getRequestsByShop: (shopId) => {
    return get()
      .editRequests.filter((req) => req.shopId === shopId)
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  },

  getRequestsByStatus: (status) => {
    return get().editRequests.filter((req) => req.status === status);
  },

  getPendingRequests: () => {
    return get().editRequests.filter((req) => req.status === 'pending');
  },
}));

