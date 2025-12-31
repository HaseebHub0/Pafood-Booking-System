import { OrderItem, OrderTotals, Product } from '../types';
import { getMaxDiscountForCategory } from '../data';

// Calculate line item totals
export const calculateLineItem = (
  product: Product,
  quantity: number,
  discountPercent: number
): Partial<OrderItem> => {
  const lineTotal = quantity * product.price;
  const discountAmount = lineTotal * (discountPercent / 100);
  const finalAmount = lineTotal - discountAmount;
  const maxAllowedDiscount = getMaxDiscountForCategory(product.category);
  const maxAllowedAmount = lineTotal * (maxAllowedDiscount / 100);
  const isUnauthorizedDiscount = discountPercent > maxAllowedDiscount;
  const unauthorizedAmount = isUnauthorizedDiscount
    ? discountAmount - maxAllowedAmount
    : 0;

  return {
    lineTotal,
    discountAmount,
    finalAmount,
    maxAllowedDiscount,
    isUnauthorizedDiscount,
    unauthorizedAmount,
  };
};

// Calculate order totals
export const calculateOrderTotals = (items: OrderItem[]): OrderTotals => {
  if (items.length === 0) {
    return {
      subtotal: 0,
      totalDiscount: 0,
      allowedDiscount: 0,
      unauthorizedDiscount: 0,
      grandTotal: 0,
      hasUnauthorizedDiscount: false,
    };
  }

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const totalDiscount = items.reduce((sum, item) => sum + item.discountAmount, 0);
  
  const allowedDiscount = items.reduce((sum, item) => {
    const maxAllowed = item.lineTotal * (item.maxAllowedDiscount / 100);
    return sum + Math.min(item.discountAmount, maxAllowed);
  }, 0);
  
  const unauthorizedDiscount = items.reduce(
    (sum, item) => sum + item.unauthorizedAmount,
    0
  );
  
  const grandTotal = subtotal - totalDiscount;
  const hasUnauthorizedDiscount = unauthorizedDiscount > 0;

  return {
    subtotal,
    totalDiscount,
    allowedDiscount,
    unauthorizedDiscount,
    grandTotal,
    hasUnauthorizedDiscount,
  };
};

// Calculate discount amount
export const calculateDiscountAmount = (
  amount: number,
  discountPercent: number
): number => {
  return amount * (discountPercent / 100);
};

// Calculate final amount after discount
export const calculateFinalAmount = (
  amount: number,
  discountPercent: number
): number => {
  return amount - calculateDiscountAmount(amount, discountPercent);
};

// Check if discount exceeds limit
export const isDiscountUnauthorized = (
  givenPercent: number,
  maxAllowedPercent: number
): boolean => {
  return givenPercent > maxAllowedPercent;
};

// Calculate unauthorized discount amount
export const calculateUnauthorizedAmount = (
  lineTotal: number,
  givenPercent: number,
  maxAllowedPercent: number
): number => {
  if (!isDiscountUnauthorized(givenPercent, maxAllowedPercent)) {
    return 0;
  }
  
  const givenAmount = calculateDiscountAmount(lineTotal, givenPercent);
  const allowedAmount = calculateDiscountAmount(lineTotal, maxAllowedPercent);
  
  return givenAmount - allowedAmount;
};

