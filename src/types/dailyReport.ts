import { BaseEntity } from './common';

export type ReportStatus = 'draft' | 'submitted';

export interface ProductSaleEntry {
  productId: string;
  productName: string;
  productNameUrdu: string;
  unit: string;
  price: number;
  quantity: number;
  amount: number;
}

export interface ShopkeeperRecord {
  id: string;
  shopName: string;
  credit: number;
  cashReceived: number;
}

export interface ExpenseEntry {
  id: string;
  description: string;
  amount: number;
}

export interface ReportTotals {
  totalSale: number;
  fuel: number;
  cutRate: number;
  expenses: number;
  credit: number;
  cashReceived: number;
  netCash: number;
}

export interface CashDeposit {
  note5000: number;
  note1000: number;
  note500: number;
  note100: number;
  note50: number;
  note20: number;
  note10: number;
  coins: number;
  total: number;
}

export interface DailyReport extends BaseEntity {
  reportNumber: string;
  date: string;
  routeName: string;
  bookerName: string;
  bookerId: string;
  salesmanName: string;
  salesmanId?: string;
  productSales: ProductSaleEntry[];
  shopkeeperRecords: ShopkeeperRecord[];
  expenses: ExpenseEntry[];
  totals: ReportTotals;
  cashDeposit: CashDeposit;
  status: ReportStatus;
  notes?: string;
}

// Form data for creating a report
export interface DailyReportFormData {
  routeName: string;
  bookerName: string;
  salesmanName: string;
  date: string;
}

// Initial empty cash deposit
export const emptyCashDeposit: CashDeposit = {
  note5000: 0,
  note1000: 0,
  note500: 0,
  note100: 0,
  note50: 0,
  note20: 0,
  note10: 0,
  coins: 0,
  total: 0,
};

// Initial empty totals
export const emptyTotals: ReportTotals = {
  totalSale: 0,
  fuel: 0,
  cutRate: 0,
  expenses: 0,
  credit: 0,
  cashReceived: 0,
  netCash: 0,
};

// Calculate cash deposit total
export const calculateCashDepositTotal = (deposit: CashDeposit): number => {
  return (
    deposit.note5000 * 5000 +
    deposit.note1000 * 1000 +
    deposit.note500 * 500 +
    deposit.note100 * 100 +
    deposit.note50 * 50 +
    deposit.note20 * 20 +
    deposit.note10 * 10 +
    deposit.coins
  );
};

