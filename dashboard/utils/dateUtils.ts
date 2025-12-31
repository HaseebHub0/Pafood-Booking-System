/**
 * Date utility functions for dashboard calculations
 */

export interface DateRange {
    start: Date;
    end: Date;
}

/**
 * Safely convert any date value to a Date object
 * Handles: Date objects, Firestore Timestamps, ISO strings, Unix timestamps
 */
export function toSafeDate(value: any): Date {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    // Firestore Timestamp with toDate method
    if (typeof value?.toDate === 'function') return value.toDate();
    // Firestore Timestamp object with seconds
    if (value?.seconds !== undefined) return new Date(value.seconds * 1000);
    // String or number timestamp
    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
    }
    return new Date();
}

/**
 * Get current period date range (current month)
 */
export function getCurrentPeriod(): DateRange {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
}

/**
 * Get previous period date range (previous month)
 */
export function getPreviousPeriod(): DateRange {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { start, end };
}

/**
 * Get today's date range (start of today to end of today)
 */
export function getTodayRange(): DateRange {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end };
}

/**
 * Get yesterday's date range
 */
export function getYesterdayRange(): DateRange {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
    const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
    return { start, end };
}

/**
 * Format currency amount to PKR format
 */
export function formatCurrency(amount: number): string {
    if (amount >= 1000000) {
        return `PKR ${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
        return `PKR ${(amount / 1000).toFixed(1)}k`;
    }
    return `PKR ${amount.toLocaleString()}`;
}

/**
 * Format date for display
 */
export function formatDate(date: any): string {
    const d = toSafeDate(date);
    return d.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

/**
 * Calculate growth percentage
 */
export function calculateGrowthPercentage(current: number, previous: number): number {
    if (previous === 0) {
        return current > 0 ? 100 : 0;
    }
    return Math.round(((current - previous) / previous) * 100);
}

/**
 * Convert date to Firestore Timestamp-compatible format
 */
export function dateToTimestamp(date: Date): any {
    // For Firestore web SDK v10, we can use Timestamp.fromDate
    // But since we're using the CDN version, we'll return the date object
    // The dataService will handle conversion
    return date;
}

/**
 * Format relative time (e.g., "2 minutes ago")
 */
export function formatRelativeTime(date: any): string {
    const d = toSafeDate(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return formatDate(d);
}

/**
 * Format date and time for display
 */
export function formatDateTime(date: any): string {
    const d = toSafeDate(date);
    return d.toLocaleString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Format time only for display
 */
export function formatTime(date: any): string {
    const d = toSafeDate(date);
    return d.toLocaleTimeString('en-US', { 
        hour: '2-digit',
        minute: '2-digit'
    });
}

