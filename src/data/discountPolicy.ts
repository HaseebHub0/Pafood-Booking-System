import { User } from '../types';

export interface CategoryDiscount {
  maxPercent: number;
  notes: string;
}

export interface DiscountPolicy {
  version: string;
  effectiveDate: string;
  defaultMaxDiscount: number;
  categoryLimits: Record<string, CategoryDiscount>;
  warningThreshold: number;
  salaryDeductionEnabled: boolean;
}

export const discountPolicy: DiscountPolicy = {
  version: '1.0',
  effectiveDate: '2024-01-01',
  defaultMaxDiscount: 5,
  categoryLimits: {
    nimco: { maxPercent: 5, notes: 'Standard nimco products' },
    snacks: { maxPercent: 5, notes: 'Snack items' },
    peanuts: { maxPercent: 5, notes: 'Peanut products' },
    sweets: { maxPercent: 5, notes: 'Sweet items' },
    bulk: { maxPercent: 10, notes: 'Bulk/Wholesale products' },
    other: { maxPercent: 5, notes: 'Other products' },
  },
  warningThreshold: 0,
  salaryDeductionEnabled: true,
};

// Get max discount for a product category
export const getMaxDiscountForCategory = (category: string): number => {
  return discountPolicy.categoryLimits[category]?.maxPercent || discountPolicy.defaultMaxDiscount;
};

// Get effective max discount considering both product and booker limits
export const getEffectiveMaxDiscount = (
  productCategory: string,
  productMaxDiscount: number,
  user: User | null
): number => {
  // Get product-level max discount
  const categoryMax = getMaxDiscountForCategory(productCategory);
  const productMax = Math.min(productMaxDiscount, categoryMax);
  
  // If no user, return product max
  if (!user) {
    return productMax;
  }
  
  // Return minimum of product max and booker's max discount percent
  return Math.min(productMax, user.maxDiscountPercent);
};

// Calculate unauthorized discount for a single item
export const calculateUnauthorizedDiscount = (
  givenDiscountPercent: number,
  lineTotal: number,
  effectiveMaxDiscount: number
): { isUnauthorized: boolean; unauthorizedAmount: number } => {
  if (givenDiscountPercent <= effectiveMaxDiscount) {
    return { isUnauthorized: false, unauthorizedAmount: 0 };
  }
  
  const givenAmount = lineTotal * (givenDiscountPercent / 100);
  const allowedAmount = lineTotal * (effectiveMaxDiscount / 100);
  const unauthorizedAmount = givenAmount - allowedAmount;
  
  return { isUnauthorized: true, unauthorizedAmount };
};

// Check if total order discount exceeds booker's max amount limit
export const checkOrderDiscountLimit = (
  totalDiscount: number,
  user: User | null
): { exceedsLimit: boolean; excessAmount: number } => {
  if (!user) {
    return { exceedsLimit: false, excessAmount: 0 };
  }
  
  // If maxDiscountAmount is 0 or undefined/null, skip amount limit check
  // Only check percentage limit in that case
  if (!user.maxDiscountAmount || user.maxDiscountAmount === 0) {
    return { exceedsLimit: false, excessAmount: 0 };
  }
  
  if (totalDiscount <= user.maxDiscountAmount) {
    return { exceedsLimit: false, excessAmount: 0 };
  }
  
  return {
    exceedsLimit: true,
    excessAmount: totalDiscount - user.maxDiscountAmount,
  };
};
