import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Route, RouteFormData, RouteStatus, RouteShop, calculateRouteStats } from '../types/route';
import { storage, STORAGE_KEYS } from '../services/storage/asyncStorage';
import { useAuthStore } from './authStore';
import { useShopStore } from './shopStore';

interface RouteState {
  routes: Route[];
  currentRoute: Route | null;
  isLoading: boolean;
  error: string | null;
}

interface RouteActions {
  loadRoutes: () => Promise<void>;
  createRoute: (data: RouteFormData) => Promise<Route>;
  updateRoute: (id: string, data: Partial<RouteFormData>) => Promise<boolean>;
  deleteRoute: (id: string) => Promise<boolean>;
  startRoute: (id: string) => Promise<boolean>;
  completeRoute: (id: string) => Promise<boolean>;
  updateShopStatus: (routeId: string, shopId: string, status: RouteShop['status'], notes?: string) => Promise<boolean>;
  getRouteById: (id: string) => Route | undefined;
  getRoutesByDate: (date: string) => Route[];
  getActiveRoute: () => Route | null;
  setCurrentRoute: (route: Route | null) => void;
  calculateRouteStats: (routeId: string) => ReturnType<typeof calculateRouteStats> | null;
}

type RouteStore = RouteState & RouteActions;

export const useRouteStore = create<RouteStore>((set, get) => ({
  // Initial state
  routes: [],
  currentRoute: null,
  isLoading: false,
  error: null,

  // Actions
  loadRoutes: async () => {
    set({ isLoading: true, error: null });

    try {
      const storedRoutes = await storage.get<Route[]>(STORAGE_KEYS.ROUTES);
      const currentUser = useAuthStore.getState().user;

      let routesList: Route[] = storedRoutes || [];

      // Filter routes by current user's bookerId
      if (currentUser) {
        routesList = routesList.filter((route) => route.bookerId === currentUser.id);
      }

      set({ routes: routesList, isLoading: false });
    } catch (error) {
      set({
        error: 'Failed to load routes',
        isLoading: false,
      });
    }
  },

  createRoute: async (data) => {
    const { routes } = get();
    const currentUser = useAuthStore.getState().user;
    const shopStore = useShopStore.getState();

    // Build route shops from shop IDs
    const routeShops: RouteShop[] = data.shopIds.map((shopId, index) => {
      const shop = shopStore.getShopById(shopId);
      return {
        shopId,
        shopName: shop?.shopName || 'Unknown Shop',
        sequence: index + 1,
        status: 'pending',
      };
    });

    const newRoute: Route = {
      id: uuidv4(),
      routeName: data.routeName,
      bookerId: currentUser?.id || '',
      bookerName: currentUser?.name || '',
      date: data.date,
      shops: routeShops,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedRoutes = [...routes, newRoute];
    await storage.set(STORAGE_KEYS.ROUTES, updatedRoutes);
    set({ routes: updatedRoutes, currentRoute: newRoute });

    return newRoute;
  },

  updateRoute: async (id, data) => {
    const { routes } = get();
    const shopStore = useShopStore.getState();

    const routeIndex = routes.findIndex((r) => r.id === id);
    if (routeIndex === -1) {
      set({ error: 'Route not found' });
      return false;
    }

    const existingRoute = routes[routeIndex];
    let updatedShops = existingRoute.shops;

    // If shopIds changed, rebuild shops array
    if (data.shopIds && data.shopIds.length > 0) {
      updatedShops = data.shopIds.map((shopId, index) => {
        const existingShop = existingRoute.shops.find((s) => s.shopId === shopId);
        const shop = shopStore.getShopById(shopId);
        
        return existingShop || {
          shopId,
          shopName: shop?.shopName || 'Unknown Shop',
          sequence: index + 1,
          status: 'pending',
        };
      });
    }

    const updatedRoute: Route = {
      ...existingRoute,
      routeName: data.routeName || existingRoute.routeName,
      date: data.date || existingRoute.date,
      shops: updatedShops,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedRoutes = routes.map((r, index) => (index === routeIndex ? updatedRoute : r));
    await storage.set(STORAGE_KEYS.ROUTES, updatedRoutes);
    set({ routes: updatedRoutes, currentRoute: updatedRoute });

    return true;
  },

  deleteRoute: async (id) => {
    const { routes } = get();
    const updatedRoutes = routes.filter((r) => r.id !== id);
    await storage.set(STORAGE_KEYS.ROUTES, updatedRoutes);
    set({ routes: updatedRoutes, currentRoute: null });
    return true;
  },

  startRoute: async (id) => {
    const { routes } = get();
    const routeIndex = routes.findIndex((r) => r.id === id);
    if (routeIndex === -1) return false;

    const updatedRoute: Route = {
      ...routes[routeIndex],
      status: 'active',
      startTime: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedRoutes = routes.map((r, index) => (index === routeIndex ? updatedRoute : r));
    await storage.set(STORAGE_KEYS.ROUTES, updatedRoutes);
    set({ routes: updatedRoutes, currentRoute: updatedRoute });

    return true;
  },

  completeRoute: async (id) => {
    const { routes } = get();
    const routeIndex = routes.findIndex((r) => r.id === id);
    if (routeIndex === -1) return false;

    const route = routes[routeIndex];
    const startTime = route.startTime ? new Date(route.startTime).getTime() : Date.now();
    const endTime = Date.now();
    const actualDuration = Math.round((endTime - startTime) / 60000); // Minutes

    const updatedRoute: Route = {
      ...route,
      status: 'completed',
      endTime: new Date().toISOString(),
      actualDuration,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedRoutes = routes.map((r, index) => (index === routeIndex ? updatedRoute : r));
    await storage.set(STORAGE_KEYS.ROUTES, updatedRoutes);
    set({ routes: updatedRoutes, currentRoute: updatedRoute });

    return true;
  },

  updateShopStatus: async (routeId, shopId, status, notes) => {
    const { routes } = get();
    const routeIndex = routes.findIndex((r) => r.id === routeId);
    if (routeIndex === -1) return false;

    const route = routes[routeIndex];
    const updatedShops = route.shops.map((shop) => {
      if (shop.shopId === shopId) {
        const now = new Date().toISOString();
        return {
          ...shop,
          status,
          notes,
          actualArrival: status === 'visited' ? now : shop.actualArrival,
        };
      }
      return shop;
    });

    const updatedRoute: Route = {
      ...route,
      shops: updatedShops,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedRoutes = routes.map((r, index) => (index === routeIndex ? updatedRoute : r));
    await storage.set(STORAGE_KEYS.ROUTES, updatedRoutes);
    set({ routes: updatedRoutes, currentRoute: updatedRoute });

    return true;
  },

  getRouteById: (id) => {
    return get().routes.find((route) => route.id === id);
  },

  getRoutesByDate: (date) => {
    return get().routes.filter((route) => route.date === date);
  },

  getActiveRoute: () => {
    return get().routes.find((route) => route.status === 'active') || null;
  },

  setCurrentRoute: (route) => {
    set({ currentRoute: route });
  },

  calculateRouteStats: (routeId) => {
    const route = get().getRouteById(routeId);
    if (!route) return null;
    return calculateRouteStats(route);
  },
}));

