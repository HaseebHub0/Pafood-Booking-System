import { BaseEntity } from './common';

export type CommissionStatus = 'pending' | 'approved' | 'paid';

export type CommissionPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Commission extends BaseEntity {
  id: string;
  bookerId: string;
  bookerName: string;
  period: CommissionPeriod;
  periodValue: string; // e.g., "2024-12" for monthly, "2024-12-09" for daily
  targetId?: string; // Optional reference to target that triggered this commission
  totalSales: number; // Total sales for the period
  targetAchievement: number; // Achievement percentage (0-100+)
  commissionAmount: number; // Commission amount assigned by KPO
  status: CommissionStatus;
  assignedBy: string; // KPO/Admin user ID who assigned the commission
  assignedByName?: string; // For display purposes
  assignedAt: string; // ISO timestamp
  paidAt?: string; // ISO timestamp when commission was paid
  notes?: string; // Additional notes
}

export interface CommissionFormData {
  bookerId: string;
  period: CommissionPeriod;
  periodValue: string;
  targetId?: string;
  totalSales: number;
  targetAchievement: number;
  commissionAmount: number;
  status: CommissionStatus;
  notes?: string;
}

