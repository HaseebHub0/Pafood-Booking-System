export const STORAGE_KEYS = {
  AUTH_TOKEN: '@auth_token',
  CURRENT_USER: '@current_user',
  SHOPS: '@shops',
  ORDERS: '@orders',
  PRODUCTS: '@products',
  DISCOUNT_POLICY: '@discount_policy',
  PENDING_SYNC: '@pending_sync',
  LAST_SYNC: '@last_sync',
  LEDGER_TRANSACTIONS: '@ledger_transactions',
  ROUTES: '@routes',
  VISITS: '@visits',
  TARGETS: '@targets',
  COMMISSIONS: '@commissions',
  DELIVERIES: '@deliveries',
  INVOICES: '@invoices',
  BILLS: '@bills',
  RETURNS: '@returns',
  LOAD_FORMS: '@load_forms',
  EDIT_REQUESTS: '@edit_requests',
  MAPPINGS: '@mappings',
  REGIONS: '@regions',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

