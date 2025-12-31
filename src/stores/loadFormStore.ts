import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { LoadForm, LoadFormFormData, LoadStatus } from '../types/loadForm';
import { storage, STORAGE_KEYS } from '../services/storage/asyncStorage';
import { useDeliveryStore } from './deliveryStore';
import { useAuthStore } from './authStore';

interface LoadFormState {
  loadForms: LoadForm[];
  isLoading: boolean;
  error: string | null;
}

interface LoadFormActions {
  loadLoadForms: () => Promise<void>;
  createLoadFormFromDelivery: (deliveryId: string) => Promise<LoadForm | null>;
  confirmLoad: (loadFormId: string, data: LoadFormFormData) => Promise<boolean>;
  markLoaded: (loadFormId: string) => Promise<boolean>;
  getLoadFormByDelivery: (deliveryId: string) => LoadForm | undefined;
  getLoadFormById: (id: string) => LoadForm | undefined;
  getPendingLoadForms: () => LoadForm[];
}

type LoadFormStore = LoadFormState & LoadFormActions;

export const useLoadFormStore = create<LoadFormStore>((set, get) => ({
  // Initial state
  loadForms: [],
  isLoading: false,
  error: null,

  // Actions
  loadLoadForms: async () => {
    set({ isLoading: true, error: null });

    try {
      const storedLoadForms = await storage.get<LoadForm[]>(STORAGE_KEYS.LOAD_FORMS);
      const currentUser = useAuthStore.getState().user;

      let loadFormsList: LoadForm[] = storedLoadForms || [];

      // Filter by salesman if user is salesman
      if (currentUser?.role === 'salesman') {
        loadFormsList = loadFormsList.filter((lf) => lf.confirmedBy === currentUser.id);
      }

      set({ loadForms: loadFormsList, isLoading: false });
    } catch (error) {
      set({
        error: 'Failed to load load forms',
        isLoading: false,
      });
    }
  },

  createLoadFormFromDelivery: async (deliveryId) => {
    const { loadForms } = get();
    const deliveryStore = useDeliveryStore.getState();
    const delivery = deliveryStore.getDeliveryById(deliveryId);

    if (!delivery) {
      set({ error: 'Delivery not found' });
      return null;
    }

    // Check if load form already exists
    const existingLoadForm = loadForms.find((lf) => lf.deliveryId === deliveryId);
    if (existingLoadForm) {
      return existingLoadForm;
    }

    // Convert delivery items to load form items
    const loadFormItems = delivery.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unit: item.unit,
    }));

    const totalQuantity = loadFormItems.reduce((sum, item) => sum + item.quantity, 0);

    const newLoadForm: LoadForm = {
      id: uuidv4(),
      deliveryId: delivery.id,
      orderId: delivery.orderId,
      orderNumber: delivery.orderNumber,
      shopId: delivery.shopId,
      shopName: delivery.shopName,
      items: loadFormItems,
      totalQuantity,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedLoadForms = [...loadForms, newLoadForm];
    await storage.set(STORAGE_KEYS.LOAD_FORMS, updatedLoadForms);
    set({ loadForms: updatedLoadForms });

    return newLoadForm;
  },

  confirmLoad: async (loadFormId, data) => {
    const { loadForms } = get();
    const currentUser = useAuthStore.getState().user;
    const loadFormIndex = loadForms.findIndex((lf) => lf.id === loadFormId);
    
    if (loadFormIndex === -1) return false;

    const loadForm = loadForms[loadFormIndex];
    const updatedItems = loadForm.items.map((item) => ({
      ...item,
      confirmedQuantity: data.confirmedQuantities[item.productId] ?? item.quantity,
    }));

    const updatedLoadForm: LoadForm = {
      ...loadForm,
      items: updatedItems,
      status: 'confirmed',
      confirmedAt: new Date().toISOString(),
      confirmedBy: currentUser?.id || '',
      confirmedByName: currentUser?.name || '',
      loadNotes: data.notes,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedLoadForms = loadForms.map((lf, index) =>
      index === loadFormIndex ? updatedLoadForm : lf
    );
    await storage.set(STORAGE_KEYS.LOAD_FORMS, updatedLoadForms);
    set({ loadForms: updatedLoadForms });

    return true;
  },

  markLoaded: async (loadFormId) => {
    const { loadForms } = get();
    const loadFormIndex = loadForms.findIndex((lf) => lf.id === loadFormId);
    
    if (loadFormIndex === -1) return false;

    const updatedLoadForm: LoadForm = {
      ...loadForms[loadFormIndex],
      status: 'loaded',
      loadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedLoadForms = loadForms.map((lf, index) =>
      index === loadFormIndex ? updatedLoadForm : lf
    );
    await storage.set(STORAGE_KEYS.LOAD_FORMS, updatedLoadForms);
    set({ loadForms: updatedLoadForms });

    return true;
  },

  getLoadFormByDelivery: (deliveryId) => {
    return get().loadForms.find((lf) => lf.deliveryId === deliveryId);
  },

  getLoadFormById: (id) => {
    return get().loadForms.find((lf) => lf.id === id);
  },

  getPendingLoadForms: () => {
    return get().loadForms.filter((lf) => lf.status === 'pending' || lf.status === 'confirmed');
  },
}));

