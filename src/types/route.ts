import { BaseEntity } from './common';

export type RouteStatus = 'draft' | 'active' | 'completed' | 'cancelled';

export interface RouteShop {
  shopId: string;
  shopName: string;
  sequence: number; // Order in the route
  estimatedArrival?: string; // ISO timestamp
  actualArrival?: string; // ISO timestamp
  status: 'pending' | 'visited' | 'skipped';
  notes?: string;
}

export interface Route extends BaseEntity {
  routeName: string;
  bookerId: string;
  bookerName: string;
  date: string; // YYYY-MM-DD
  shops: RouteShop[];
  status: RouteStatus;
  startTime?: string; // ISO timestamp when route started
  endTime?: string; // ISO timestamp when route completed
  estimatedDuration?: number; // Minutes
  actualDuration?: number; // Minutes
  totalDistance?: number; // Meters
  notes?: string;
}

export interface RouteFormData {
  routeName: string;
  date: string;
  shopIds: string[]; // Shop IDs in order
}

export interface RouteStats {
  totalShops: number;
  visitedShops: number;
  skippedShops: number;
  pendingShops: number;
  completionPercent: number;
  totalDistance: number;
  estimatedTimeRemaining: number; // Minutes
}

// Helper to calculate route stats
export const calculateRouteStats = (route: Route): RouteStats => {
  const visitedShops = route.shops.filter((s) => s.status === 'visited').length;
  const skippedShops = route.shops.filter((s) => s.status === 'skipped').length;
  const pendingShops = route.shops.filter((s) => s.status === 'pending').length;
  const totalShops = route.shops.length;
  
  const completionPercent =
    totalShops > 0 ? ((visitedShops + skippedShops) / totalShops) * 100 : 0;

  return {
    totalShops,
    visitedShops,
    skippedShops,
    pendingShops,
    completionPercent,
    totalDistance: route.totalDistance || 0,
    estimatedTimeRemaining: route.estimatedDuration || 0,
  };
};

