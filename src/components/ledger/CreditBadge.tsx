import React from 'react';

// CreditBadge and CreditStatusDot are deprecated in cash-only system
// These components are kept as stubs for backward compatibility
// They render nothing since credit/balance features are removed

interface CreditBadgeProps {
  balance?: number;
  creditLimit?: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  style?: any;
}

/**
 * @deprecated CreditBadge is deprecated in cash-only system
 * This component renders nothing and is kept for backward compatibility
 */
export const CreditBadge: React.FC<CreditBadgeProps> = () => {
  return null;
};

/**
 * @deprecated CreditStatusDot is deprecated in cash-only system
 * This component renders nothing and is kept for backward compatibility
 */
export const CreditStatusDot: React.FC<{
  balance?: number;
  creditLimit?: number;
  size?: number;
}> = () => {
  return null;
};

