/**
 * Business logic utilities for dashboard metrics
 */

import { Region } from '../types';
import { formatCurrency, calculateGrowthPercentage } from './dateUtils';

/**
 * Calculate sales growth percentage
 */
export function calculateSalesGrowth(currentSales: number, previousSales: number): number {
    return calculateGrowthPercentage(currentSales, previousSales);
}

/**
 * Format sales amount to display format (e.g., "PKR 12.4M")
 */
export function formatSalesAmount(amount: number): string {
    return formatCurrency(amount);
}

/**
 * Get region name from regionId
 */
export function getRegionName(regionId: string, regions: Region[]): string {
    const region = regions.find(r => r.id === regionId);
    return region?.name || regionId;
}

/**
 * Format number with K/M suffix
 */
export function formatNumber(value: number): string {
    if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}k`;
    }
    return value.toString();
}

/**
 * Format amount for TopBookers display
 */
export function formatBookerAmount(amount: number): string {
    if (amount >= 1000000) {
        return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
        return `${(amount / 1000).toFixed(1)}k`;
    }
    return amount.toString();
}

