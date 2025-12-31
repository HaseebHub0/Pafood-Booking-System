/**
 * Firestore Collection Names
 * Centralized collection names for consistency
 */
export const COLLECTIONS = {
  // User Management
  USERS: 'users',
  
  // Shop Management
  SHOPS: 'shops',
  
  // Order Management
  ORDERS: 'orders',
  
  // Product Management
  PRODUCTS: 'products',
  
  // Delivery Management
  DELIVERIES: 'deliveries',
  
  // Ledger & Transactions
  LEDGER_TRANSACTIONS: 'ledger_transactions',
  
  // Invoice Management
  INVOICES: 'invoices',
  
  // Bill Management
  BILLS: 'bills',
  
  // Route Management
  ROUTES: 'routes',
  
  // Visit Tracking
  VISITS: 'visits',
  
  // Stock Returns
  RETURNS: 'returns',
  STOCK_RETURNS: 'stock_returns',
  
  // Load Forms
  LOAD_FORMS: 'load_forms',
  
  // Edit Requests
  EDIT_REQUESTS: 'edit_requests',
  
  // Daily Reports
  DAILY_REPORTS: 'daily_reports',
  
  // Targets
  TARGETS: 'targets',
  
  // Sync Queue
  SYNC_QUEUE: 'sync_queue',
  
  // Regions
  REGIONS: 'regions',
  
  // Branches
  BRANCHES: 'branches',
  
  // Order Items (sub-collection or separate collection)
  ORDER_ITEMS: 'order_items',
  
  // Daily Summaries
  DAILY_SUMMARIES: 'daily_summaries',
  
  // Unauthorized Discounts
  UNAUTHORIZED_DISCOUNTS: 'unauthorized_discounts',
  
  // Activity Logs
  ACTIVITY_LOGS: 'activity_logs',
  
  // Salesman-Booker Mappings
  MAPPINGS: 'mappings',
  
  // Salary Deductions
  SALARY_DEDUCTIONS: 'salary_deductions',
  
  // Outstanding Payments
  OUTSTANDING_PAYMENTS: 'outstanding_payments',
  
  // Commissions
  COMMISSIONS: 'commissions',
  
  // Booker Live Location Tracking
  BOOKER_LOCATIONS: 'booker_locations',
} as const;

export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];


