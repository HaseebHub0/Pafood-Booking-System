import { BaseEntity } from './common';

export interface BookerLocation extends BaseEntity {
  bookerId: string;
  bookerName: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  lastUpdated: string; // ISO timestamp
  isOnline: boolean; // true if updated within last 2 minutes
  regionId: string;
  branch?: string;
}






