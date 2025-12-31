import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  DailyReport,
  ProductSaleEntry,
  ShopkeeperRecord,
  ExpenseEntry,
  CashDeposit,
  ReportTotals,
  ReportStatus,
  emptyCashDeposit,
  emptyTotals,
  calculateCashDepositTotal,
  DailyReportFormData,
} from '../types';
import { storage, STORAGE_KEYS } from '../services/storage/asyncStorage';
import { useAuthStore } from './authStore';

// Add new storage key for reports
const REPORTS_STORAGE_KEY = 'daily_reports';

interface DailyReportState {
  reports: DailyReport[];
  currentReport: DailyReport | null;
  isLoading: boolean;
  error: string | null;
}

interface DailyReportActions {
  loadReports: () => Promise<void>;
  createReport: (data: DailyReportFormData) => void;
  updateHeaderInfo: (data: Partial<DailyReportFormData>) => void;
  updateProductSale: (productId: string, quantity: number) => void;
  addShopkeeperRecord: (record: Omit<ShopkeeperRecord, 'id'>) => void;
  updateShopkeeperRecord: (id: string, data: Partial<ShopkeeperRecord>) => void;
  removeShopkeeperRecord: (id: string) => void;
  addExpense: (description: string, amount: number) => void;
  updateExpense: (id: string, data: Partial<ExpenseEntry>) => void;
  removeExpense: (id: string) => void;
  updateTotals: (totals: Partial<ReportTotals>) => void;
  updateCashDeposit: (denomination: keyof CashDeposit, count: number) => void;
  calculateTotals: () => ReportTotals;
  saveDraft: () => Promise<void>;
  submitReport: () => Promise<{ success: boolean; message: string }>;
  getReportById: (id: string) => DailyReport | undefined;
  getReportsByStatus: (status: ReportStatus | 'all') => DailyReport[];
  clearCurrentReport: () => void;
  setCurrentReport: (report: DailyReport) => void;
  initializeProductSales: () => void;
}

type DailyReportStore = DailyReportState & DailyReportActions;

const generateReportNumber = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `DSR-${year}${month}${day}-${random}`;
};

export const useDailyReportStore = create<DailyReportStore>((set, get) => ({
  // Initial state
  reports: [],
  currentReport: null,
  isLoading: false,
  error: null,

  // Actions
  loadReports: async () => {
    set({ isLoading: true, error: null });

    try {
      const storedReports = await storage.get<DailyReport[]>(REPORTS_STORAGE_KEY);
      set({ reports: storedReports || [], isLoading: false });
    } catch (error) {
      set({
        error: 'Failed to load reports',
        isLoading: false,
      });
    }
  },

  createReport: (data: DailyReportFormData) => {
    const currentUser = useAuthStore.getState().user;

    const newReport: DailyReport = {
      id: uuidv4(),
      reportNumber: generateReportNumber(),
      date: data.date || new Date().toISOString().split('T')[0],
      routeName: data.routeName,
      bookerName: data.bookerName || currentUser?.name || '',
      bookerId: currentUser?.id || '',
      salesmanName: data.salesmanName,
      productSales: [],
      shopkeeperRecords: [],
      expenses: [],
      totals: { ...emptyTotals },
      cashDeposit: { ...emptyCashDeposit },
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    set({ currentReport: newReport });
    
    // Initialize product sales with all products
    get().initializeProductSales();
  },

  initializeProductSales: async () => {
    const { currentReport } = get();
    if (!currentReport) return;

    try {
      // Get products from store
      const { useProductStore } = await import('./productStore');
      const productStore = useProductStore.getState();
      
      // Load products if not already loaded
      if (productStore.products.length === 0) {
        await productStore.loadProducts();
      }

      // Initialize with all products
      const productSales: ProductSaleEntry[] = productStore.products.map((product) => ({
        productId: product.id,
        productName: product.nameEn || product.name,
        productNameUrdu: product.name,
        unit: product.unit,
        price: product.price,
        quantity: 0,
        amount: 0,
      }));

      set({
        currentReport: {
          ...currentReport,
          productSales,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Error initializing product sales:', error);
    }
  },

  updateHeaderInfo: (data: Partial<DailyReportFormData>) => {
    const { currentReport } = get();
    if (!currentReport) return;

    set({
      currentReport: {
        ...currentReport,
        ...data,
        updatedAt: new Date().toISOString(),
      },
    });
  },

  updateProductSale: (productId: string, quantity: number) => {
    const { currentReport } = get();
    if (!currentReport) return;

    const updatedSales = currentReport.productSales.map((sale) => {
      if (sale.productId === productId) {
        return {
          ...sale,
          quantity,
          amount: quantity * sale.price,
        };
      }
      return sale;
    });

    // Calculate new total sale
    const totalSale = updatedSales.reduce((sum, sale) => sum + sale.amount, 0);

    set({
      currentReport: {
        ...currentReport,
        productSales: updatedSales,
        totals: {
          ...currentReport.totals,
          totalSale,
        },
        updatedAt: new Date().toISOString(),
      },
    });
  },

  addShopkeeperRecord: (record: Omit<ShopkeeperRecord, 'id'>) => {
    const { currentReport } = get();
    if (!currentReport) return;

    const newRecord: ShopkeeperRecord = {
      id: uuidv4(),
      ...record,
    };

    const updatedRecords = [...currentReport.shopkeeperRecords, newRecord];
    
    // Calculate totals
    const credit = updatedRecords.reduce((sum, r) => sum + r.credit, 0);
    const cashReceived = updatedRecords.reduce((sum, r) => sum + r.cashReceived, 0);

    set({
      currentReport: {
        ...currentReport,
        shopkeeperRecords: updatedRecords,
        totals: {
          ...currentReport.totals,
          credit,
          cashReceived,
        },
        updatedAt: new Date().toISOString(),
      },
    });
  },

  updateShopkeeperRecord: (id: string, data: Partial<ShopkeeperRecord>) => {
    const { currentReport } = get();
    if (!currentReport) return;

    const updatedRecords = currentReport.shopkeeperRecords.map((record) =>
      record.id === id ? { ...record, ...data } : record
    );

    // Calculate totals
    const credit = updatedRecords.reduce((sum, r) => sum + r.credit, 0);
    const cashReceived = updatedRecords.reduce((sum, r) => sum + r.cashReceived, 0);

    set({
      currentReport: {
        ...currentReport,
        shopkeeperRecords: updatedRecords,
        totals: {
          ...currentReport.totals,
          credit,
          cashReceived,
        },
        updatedAt: new Date().toISOString(),
      },
    });
  },

  removeShopkeeperRecord: (id: string) => {
    const { currentReport } = get();
    if (!currentReport) return;

    const updatedRecords = currentReport.shopkeeperRecords.filter(
      (record) => record.id !== id
    );

    // Calculate totals
    const credit = updatedRecords.reduce((sum, r) => sum + r.credit, 0);
    const cashReceived = updatedRecords.reduce((sum, r) => sum + r.cashReceived, 0);

    set({
      currentReport: {
        ...currentReport,
        shopkeeperRecords: updatedRecords,
        totals: {
          ...currentReport.totals,
          credit,
          cashReceived,
        },
        updatedAt: new Date().toISOString(),
      },
    });
  },

  addExpense: (description: string, amount: number) => {
    const { currentReport } = get();
    if (!currentReport) return;

    const newExpense: ExpenseEntry = {
      id: uuidv4(),
      description,
      amount,
    };

    const updatedExpenses = [...currentReport.expenses, newExpense];
    const totalExpenses = updatedExpenses.reduce((sum, e) => sum + e.amount, 0);

    set({
      currentReport: {
        ...currentReport,
        expenses: updatedExpenses,
        totals: {
          ...currentReport.totals,
          expenses: totalExpenses,
        },
        updatedAt: new Date().toISOString(),
      },
    });
  },

  updateExpense: (id: string, data: Partial<ExpenseEntry>) => {
    const { currentReport } = get();
    if (!currentReport) return;

    const updatedExpenses = currentReport.expenses.map((expense) =>
      expense.id === id ? { ...expense, ...data } : expense
    );

    const totalExpenses = updatedExpenses.reduce((sum, e) => sum + e.amount, 0);

    set({
      currentReport: {
        ...currentReport,
        expenses: updatedExpenses,
        totals: {
          ...currentReport.totals,
          expenses: totalExpenses,
        },
        updatedAt: new Date().toISOString(),
      },
    });
  },

  removeExpense: (id: string) => {
    const { currentReport } = get();
    if (!currentReport) return;

    const updatedExpenses = currentReport.expenses.filter(
      (expense) => expense.id !== id
    );

    const totalExpenses = updatedExpenses.reduce((sum, e) => sum + e.amount, 0);

    set({
      currentReport: {
        ...currentReport,
        expenses: updatedExpenses,
        totals: {
          ...currentReport.totals,
          expenses: totalExpenses,
        },
        updatedAt: new Date().toISOString(),
      },
    });
  },

  updateTotals: (totals: Partial<ReportTotals>) => {
    const { currentReport } = get();
    if (!currentReport) return;

    const updatedTotals = {
      ...currentReport.totals,
      ...totals,
    };

    // Calculate net cash
    updatedTotals.netCash =
      updatedTotals.totalSale -
      updatedTotals.fuel -
      updatedTotals.cutRate -
      updatedTotals.expenses -
      updatedTotals.credit;

    set({
      currentReport: {
        ...currentReport,
        totals: updatedTotals,
        updatedAt: new Date().toISOString(),
      },
    });
  },

  updateCashDeposit: (denomination: keyof CashDeposit, count: number) => {
    const { currentReport } = get();
    if (!currentReport) return;

    const updatedDeposit: CashDeposit = {
      ...currentReport.cashDeposit,
      [denomination]: count,
    };

    // Recalculate total
    updatedDeposit.total = calculateCashDepositTotal(updatedDeposit);

    set({
      currentReport: {
        ...currentReport,
        cashDeposit: updatedDeposit,
        updatedAt: new Date().toISOString(),
      },
    });
  },

  calculateTotals: () => {
    const { currentReport } = get();
    if (!currentReport) return { ...emptyTotals };

    const totalSale = currentReport.productSales.reduce(
      (sum, sale) => sum + sale.amount,
      0
    );
    const credit = currentReport.shopkeeperRecords.reduce(
      (sum, r) => sum + r.credit,
      0
    );
    const cashReceived = currentReport.shopkeeperRecords.reduce(
      (sum, r) => sum + r.cashReceived,
      0
    );
    const expenses = currentReport.expenses.reduce(
      (sum, e) => sum + e.amount,
      0
    );

    const netCash =
      totalSale -
      currentReport.totals.fuel -
      currentReport.totals.cutRate -
      expenses -
      credit;

    return {
      totalSale,
      fuel: currentReport.totals.fuel,
      cutRate: currentReport.totals.cutRate,
      expenses,
      credit,
      cashReceived,
      netCash,
    };
  },

  saveDraft: async () => {
    const { currentReport, reports } = get();
    if (!currentReport) return;

    const existingIndex = reports.findIndex((r) => r.id === currentReport.id);
    let updatedReports: DailyReport[];

    const reportToSave = {
      ...currentReport,
      status: 'draft' as const,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending' as const,
    };

    if (existingIndex >= 0) {
      updatedReports = reports.map((r, index) =>
        index === existingIndex ? reportToSave : r
      );
    } else {
      updatedReports = [...reports, reportToSave];
    }

    await storage.set(REPORTS_STORAGE_KEY, updatedReports);
    set({ reports: updatedReports, currentReport: reportToSave });
  },

  submitReport: async () => {
    const { currentReport, reports } = get();
    if (!currentReport) {
      return { success: false, message: 'No report to submit' };
    }

    // Validate report
    const hasProductSales = currentReport.productSales.some((s) => s.quantity > 0);
    if (!hasProductSales) {
      return { success: false, message: 'Please enter at least one product sale' };
    }

    const existingIndex = reports.findIndex((r) => r.id === currentReport.id);
    const totals = get().calculateTotals();

    const reportToSubmit: DailyReport = {
      ...currentReport,
      totals,
      status: 'submitted',
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    let updatedReports: DailyReport[];
    if (existingIndex >= 0) {
      updatedReports = reports.map((r, index) =>
        index === existingIndex ? reportToSubmit : r
      );
    } else {
      updatedReports = [...reports, reportToSubmit];
    }

    await storage.set(REPORTS_STORAGE_KEY, updatedReports);
    set({ reports: updatedReports, currentReport: null });

    return { success: true, message: 'Report submitted successfully!' };
  },

  getReportById: (id: string) => {
    return get().reports.find((report) => report.id === id);
  },

  getReportsByStatus: (status: ReportStatus | 'all') => {
    const { reports } = get();
    if (status === 'all') return reports;
    return reports.filter((report) => report.status === status);
  },

  clearCurrentReport: () => {
    set({ currentReport: null });
  },

  setCurrentReport: (report: DailyReport) => {
    set({ currentReport: { ...report } });
  },
}));

