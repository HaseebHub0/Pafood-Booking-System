import { BaseEntity } from './common';

export type TargetPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type TargetType = 'orders' | 'new_shops' | 'recovery' | 'visits';

export type TargetStatus = 'not_started' | 'in_progress' | 'achieved' | 'exceeded';

export interface Target extends BaseEntity {
  bookerId: string;
  bookerName: string;
  targetType: TargetType;
  period: TargetPeriod;
  periodValue: string; // e.g., "2024-12" for monthly, "2024-12-09" for daily
  
  // Target values
  targetAmount?: number; // For sales/recovery targets
  targetCount?: number; // For new_shops/visits targets
  
  // Current progress
  currentAmount?: number;
  currentCount?: number;
  
  // Status
  status: TargetStatus;
  achievementPercent: number; // 0-100+
  
  // Dates
  startDate: string; // ISO date
  endDate: string; // ISO date
  
  notes?: string;
}

export interface TargetFormData {
  targetType: TargetType;
  period: TargetPeriod;
  periodValue: string;
  targetAmount?: number;
  targetCount?: number;
  startDate: string;
  endDate: string;
  notes?: string;
}

export interface PerformanceMetrics {
  // Sales metrics
  totalSales: number;
  salesTarget: number;
  salesAchievement: number; // Percentage
  
  // Shop metrics
  newShopsCreated: number;
  newShopsTarget: number;
  shopsAchievement: number; // Percentage
  
  // Recovery metrics (optional)
  recoveryAmount?: number;
  recoveryTarget?: number;
  recoveryAchievement?: number; // Percentage
  
  // Visit metrics
  totalVisits: number;
  visitsTarget?: number;
  visitsAchievement?: number; // Percentage
  
  // Overall performance
  overallAchievement: number; // Weighted average
}

// Helper to calculate achievement percentage
export const calculateAchievement = (
  current: number,
  target: number
): { percent: number; status: TargetStatus } => {
  if (target === 0) {
    return { percent: 0, status: 'not_started' };
  }
  
  const percent = (current / target) * 100;
  
  let status: TargetStatus;
  if (percent === 0) {
    status = 'not_started';
  } else if (percent < 100) {
    status = 'in_progress';
  } else if (percent === 100) {
    status = 'achieved';
  } else {
    status = 'exceeded';
  }
  
  return { percent, status };
};

// Helper to get period display string
export const formatPeriod = (period: TargetPeriod, periodValue: string): string => {
  switch (period) {
    case 'daily':
      return new Date(periodValue).toLocaleDateString('en-PK', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    case 'weekly':
      return `Week of ${periodValue}`;
    case 'monthly':
      const [year, month] = periodValue.split('-');
      return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-PK', {
        month: 'long',
        year: 'numeric',
      });
    case 'yearly':
      return periodValue;
    default:
      return periodValue;
  }
};

