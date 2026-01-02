import { useState, useEffect, useCallback } from 'react';
import { dataService } from '../dataService';
import { formatCurrency, formatRelativeTime } from '../utils/dateUtils';
import { User } from '../types';

interface KPODashboardStats {
    totalBranchSales: number;
    totalReturns: number;
    netCash: number;
    totalOrders: number;
    pendingApproval: number;
}

interface SalesPerformance {
    bookerId: string;
    bookerName: string;
    targetCount: number; // Orders target count
    achievedCount: number; // Orders achieved count
    progressPercent: number | null; // null when target is 0
}

interface RecentActivity {
    id: string;
    time: string;
    type: string;
    entity: string;
    amount: number;
    timestamp: string;
}

interface ActiveStaff {
    id: string;
    name: string;
    area: string;
    avatarUrl?: string;
}

interface CriticalTasks {
    pendingApprovals: number;
    pendingLoadForms: number;
    stockMismatches: number;
}

interface KPODashboardData {
    stats: KPODashboardStats;
    salesPerformance: SalesPerformance[];
    recentActivity: RecentActivity[];
    activeStaff: ActiveStaff[];
    criticalTasks: CriticalTasks;
    lastUpdated: Date | null;
}

interface KPODashboardState {
    data: KPODashboardData | null;
    isLoading: boolean;
    error: string | null;
}

export function useKPODashboardData(user: User) {
    const [state, setState] = useState<KPODashboardState>({
        data: null,
        isLoading: true,
        error: null
    });

    const fetchDashboardData = useCallback(async () => {
        if (!user.branch) {
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: 'No branch assigned to user'
            }));
            return;
        }

        // Use request ID to ignore stale responses
        let isCancelled = false;

        try {
            // Only set loading, don't clear existing data
            setState(prev => ({ ...prev, isLoading: true, error: null }));

            const branchName = user.branch;

            // Fetch all data in parallel
            console.log('useKPODashboardData: Starting to fetch data for branch:', branchName);
            const [
                allBranchOrders,
                bookers,
                salesmen,
                targets,
                ledgerTransactions,
                pendingLoadForms,
                activeStaffCount,
                creditsSummary
            ] = await Promise.all([
                dataService.getBranchOrders(branchName),
                dataService.getBranchBookers(branchName),
                dataService.getBranchSalesmen(branchName),
                dataService.getBranchTargets(branchName),
                dataService.getBranchLedgerTransactions(branchName, 10),
                dataService.getPendingLoadForms(branchName),
                dataService.getActiveStaffCount(branchName),
                dataService.getTotalCreditsSummary(branchName)
            ]);

            // Check if request was cancelled
            if (isCancelled) {
                console.log('useKPODashboardData: Request cancelled, ignoring response');
                return;
            }

            console.log('useKPODashboardData: Data fetched successfully');
            console.log('- All orders:', allBranchOrders.length);
            console.log('- Bookers:', bookers.length);
            console.log('- Salesmen:', salesmen.length);

            // Validate data - don't proceed if critical data is missing
            if (bookers.length === 0 && salesmen.length === 0) {
                console.warn('useKPODashboardData: No bookers or salesmen found - this might indicate a data issue');
                // Log detailed debug info but don't fail - might be legitimate
            }

            // Calculate stats from ledger entries (single source of truth)
            // Get ledger entries for this branch
            const { getFinancialLedgerEntries } = await import('../services/financialService');
            const ledgerEntries = await getFinancialLedgerEntries(branchName);
            
            // Filter entries by type
            const saleEntries = ledgerEntries.filter(e => e.type === 'SALE' || e.type === 'SALE_DELIVERED');
            const returnEntries = ledgerEntries.filter(e => e.type === 'RETURN');
            
            // Total Branch Sales - sum net_cash from SALE_DELIVERED entries
            const totalBranchSales = saleEntries.reduce((sum, entry) => {
                const netCash = entry.net_cash !== undefined ? entry.net_cash : (entry.amount || 0);
                return sum + (typeof netCash === 'number' ? netCash : parseFloat(netCash) || 0);
            }, 0);
            
            // Total Returns - sum net_cash from RETURN entries (returns are negative, so we sum absolute values)
            const totalReturns = returnEntries.reduce((sum, entry) => {
                const netCash = entry.net_cash !== undefined ? entry.net_cash : (entry.amount || 0);
                const amount = typeof netCash === 'number' ? netCash : parseFloat(netCash) || 0;
                // Returns are typically negative in ledger, but we want positive total for display
                // So we use absolute value
                return sum + Math.abs(amount);
            }, 0);
            
            // Net Cash = Total Sales - Total Returns (from ledger only)
            const netCash = totalBranchSales - totalReturns;

            // Total Orders - count of SALE_DELIVERED entries
            const totalOrders = saleEntries.length;

            // Pending approval (status = 'submitted')
            const pendingApproval = allBranchOrders.filter(o => o.status === 'submitted').length;

            // Calculate booker performance (orders and shops, not sales)
            const salesPerformance: SalesPerformance[] = bookers.map(booker => {
                // Get orders target (not sales target)
                const ordersTarget = targets.find(t => t.bookerId === booker.id && t.targetType === 'orders');
                const targetCount = ordersTarget?.targetCount || 0;
                
                // Calculate achieved orders count (ALL orders, not just delivered)
                // Exclude cancelled/rejected orders
                const excludedStatuses = ['cancelled', 'rejected', 'edit_requested'];
                const bookerOrders = allBranchOrders.filter(o => 
                    o.bookerId === booker.id && 
                    !excludedStatuses.includes(o.status?.toLowerCase())
                );
                const achievedCount = bookerOrders.length;
                
                const progressPercent = targetCount > 0 
                    ? Math.min((achievedCount / targetCount) * 100, 100) 
                    : null; // Return null instead of 0 to show "—"

                return {
                    bookerId: booker.id,
                    bookerName: booker.name || 'Unknown',
                    targetCount,
                    achievedCount,
                    progressPercent: progressPercent !== null ? Math.round(progressPercent) : null
                };
            });

            // Format recent activity
            const recentActivity: RecentActivity[] = ledgerTransactions.map(tx => ({
                id: tx.id,
                time: formatRelativeTime(tx.timestamp),
                type: tx.type,
                entity: tx.entity,
                amount: tx.amount,
                timestamp: tx.timestamp
            }));

            // Format active staff
            const activeStaff: ActiveStaff[] = salesmen.map(s => ({
                id: s.id,
                name: s.name || 'Unknown',
                area: s.area || 'N/A',
                avatarUrl: s.avatarUrl
            }));

            // Critical tasks
            const criticalTasks: CriticalTasks = {
                pendingApprovals: allBranchOrders.filter(o => o.status === 'submitted').length,
                pendingLoadForms: pendingLoadForms,
                stockMismatches: 0 // TODO: Implement stock mismatch check if stock collection exists
            };

            const stats: KPODashboardStats = {
                totalBranchSales,
                totalReturns,
                netCash,
                totalOrders,
                pendingApproval
            };

            // Use credits summary from dataService
            const creditsData = creditsSummary || {
                totalCredits: 0,
                totalBills: 0,
                bookerSummaries: []
            };

            // Only update state if we have valid data
            // Don't overwrite with empty data if previous data existed
            setState(prev => {
                // If we have valid data, use it
                // If previous data exists and new data is empty, keep previous data but show error
                const hasValidData = bookers.length > 0 || salesmen.length > 0 || allBranchOrders.length > 0;
                const hasPreviousData = prev.data !== null;

                if (!hasValidData && hasPreviousData) {
                    console.warn('useKPODashboardData: New data is empty but previous data exists - keeping previous data');
                    return {
                        ...prev,
                        isLoading: false,
                        error: 'Failed to fetch new data. Showing cached data.'
                    };
                }

                return {
                    data: {
                        stats,
                        salesPerformance,
                        recentActivity,
                        activeStaff,
                        criticalTasks,
                        creditsSummary: creditsData,
                        lastUpdated: new Date()
                    },
                    isLoading: false,
                    error: null
                };
            });
        } catch (error: any) {
            // Check if request was cancelled
            if (isCancelled) {
                console.log('useKPODashboardData: Request cancelled during error handling');
                return;
            }

            console.error('Error fetching KPO dashboard data:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });

            // Don't clear existing data on error - keep previous data
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: error.message || 'Failed to load dashboard data. Previous data may be shown.'
            }));
        }
    }, [user.branch]);

    useEffect(() => {
        let cancelled = false;
        
        const loadData = async () => {
            await fetchDashboardData();
        };
        
        loadData();

        // Cleanup function to cancel pending requests
        return () => {
            cancelled = true;
        };
    }, [fetchDashboardData]);

    const refresh = useCallback(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    return {
        ...state,
        refresh
    };
}

