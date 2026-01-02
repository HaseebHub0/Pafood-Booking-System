/**
 * Utility functions for filtering test shops from calculations
 */

/**
 * Check if a shop name indicates it's a test shop
 * @param shopName - The shop name to check
 * @returns true if the shop is a test shop
 */
export function isTestShop(shopName: string | undefined | null): boolean {
    if (!shopName) return false;
    const lower = shopName.toLowerCase().trim();
    return lower.includes('connection-test') || 
           lower.includes('test-') || 
           lower.startsWith('test') ||
           lower.includes('demo') ||
           lower.includes('sample');
}

/**
 * Filter out test shops from an array of items with shopName property
 * @param items - Array of items with optional shopName property
 * @returns Filtered array without test shops
 */
export function filterTestShops<T extends { shopName?: string }>(items: T[]): T[] {
    return items.filter(item => !isTestShop(item.shopName));
}

/**
 * Filter out test shops from an array of items with shopName property (alternative field names)
 * @param items - Array of items with optional shop name in various fields
 * @returns Filtered array without test shops
 */
export function filterTestShopsFlexible<T extends { shopName?: string; shop_name?: string; name?: string }>(items: T[]): T[] {
    return items.filter(item => {
        const shopName = item.shopName || item.shop_name || item.name;
        return !isTestShop(shopName);
    });
}



