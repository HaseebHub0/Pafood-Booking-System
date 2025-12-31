import { BaseEntity } from './common';
import { LocationCoordinates } from '../services/location';

export type VisitStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export type VisitType = 'order' | 'follow_up' | 'payment_collection' | 'other';

export interface Visit extends BaseEntity {
  shopId: string;
  shopName: string;
  routeId?: string; // Optional reference to route
  routeName?: string;
  bookerId: string;
  bookerName: string;
  visitType: VisitType;
  status: VisitStatus;
  
  // Timing
  scheduledTime?: string; // ISO timestamp
  startTime?: string; // ISO timestamp when visit started
  endTime?: string; // ISO timestamp when visit ended
  duration?: number; // Minutes
  
  // Location
  location?: LocationCoordinates;
  locationAccuracy?: number; // Meters
  distanceFromShop?: number; // Meters (calculated distance)
  
  // Visit details
  orderCreated?: boolean;
  orderId?: string;
  orderNumber?: string;
  notes?: string;
  photos?: string[]; // Photo URIs (future feature)
  
  // Skip reason (if skipped)
  skipReason?: 'shop_closed' | 'owner_not_available' | 'no_order' | 'other';
  skipNotes?: string;
}

export interface VisitFormData {
  shopId: string;
  visitType: VisitType;
  scheduledTime?: string;
  notes?: string;
}

export interface VisitStats {
  totalVisits: number;
  completedVisits: number;
  skippedVisits: number;
  pendingVisits: number;
  ordersCreated: number;
  totalDuration: number; // Minutes
  averageVisitDuration: number; // Minutes
}

export interface DailyVisitSummary {
  date: string;
  totalShops: number;
  visitedShops: number;
  skippedShops: number;
  ordersCreated: number;
  totalSales: number;
  visitStats: VisitStats;
  visits: Visit[];
}

// Helper to calculate visit stats
export const calculateVisitStats = (visits: Visit[]): VisitStats => {
  const completedVisits = visits.filter((v) => v.status === 'completed');
  const skippedVisits = visits.filter((v) => v.status === 'skipped');
  const pendingVisits = visits.filter((v) => v.status === 'pending' || v.status === 'in_progress');
  const ordersCreated = visits.filter((v) => v.orderCreated).length;
  
  const totalDuration = completedVisits.reduce((sum, v) => sum + (v.duration || 0), 0);
  const averageVisitDuration =
    completedVisits.length > 0 ? totalDuration / completedVisits.length : 0;

  return {
    totalVisits: visits.length,
    completedVisits: completedVisits.length,
    skippedVisits: skippedVisits.length,
    pendingVisits: pendingVisits.length,
    ordersCreated,
    totalDuration,
    averageVisitDuration,
  };
};

