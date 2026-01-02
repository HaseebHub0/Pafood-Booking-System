import { useState, useEffect, useCallback } from 'react';
import { dataService } from '../dataService';
import { getCurrentPeriod, getPreviousPeriod, calculateGrowthPercentage, formatCurrency } from '../utils/dateUtils';
import { formatSalesAmount, formatBookerAmount, getRegionName } from '../utils/metrics';
import { StatItem, ChartData, Region } from '../types';

interface DashboardData {
    stats: StatItem[];
    regionalSales: ChartData[];
    regionalTopSellers: Record<string, Array<{ name: string; sales: number; growth: number }>>;
    creditsSummary?: {
        totalCredits: number;
        totalBills: number;
        bookerSummaries: Array<{ bookerId: string; bookerName: string; totalCredit: number; billCount: number }>;
    };
    lastUpdated: Date | null;
}

interface DashboardState {
    data: DashboardData | null;
    isLoading: boolean;
    error: string | null;
}

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let dashboardCache: { data: DashboardData | null; timestamp: number } | null = null;

/**
 * Clear dashboard cache (useful for manual refresh)
 */
export function clearDashboardCache() {
    dashboardCache = null;
    console.log('Dashboard cache cleared');
}

export function useDashboardData() {
    const [state, setState] = useState<DashboardState>({
        data: null,
        isLoading: true,
        error: null
    });

    const [regions, setRegions] = useState<Region[]>([]);
    const [users, setUsers] = useState<any[]>([]);

    // Load regions and users once
    useEffect(() => {
        const loadStaticData = async () => {
            try {
                console.log('Loading static data (regions and users)...');
                const [regionsData, usersData] = await Promise.all([
                    dataService.getRegions(),
                    dataService.getAllUsers()
                ]);
                console.log('Regions loaded:', regionsData.length);
                console.log('Users loaded:', usersData.length);
                setRegions(regionsData as Region[]);
                setUsers(usersData);
            } catch (error: any) {
                console.error('Error loading static data:', error);
                console.error('Error details:', {
                    message: error.message,
                    code: error.code,
                    stack: error.stack
                });
            }
        };
        loadStaticData();
    }, []);

    const fetchDashboardData = useCallback(async () => {
        // Use request ID to ignore stale responses
        const requestId = Date.now();
        let isCancelled = false;

        // Check cache first
        if (dashboardCache && Date.now() - dashboardCache.timestamp < CACHE_DURATION) {
            console.log('useDashboardData: Using cached data (age:', Math.round((Date.now() - dashboardCache.timestamp) / 1000), 'seconds)');
            setState({
                data: dashboardCache.data,
                isLoading: false,
                error: null
            });
            return;
        }

        // Only set loading, don't clear existing data
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            console.log('useDashboardData: Starting to fetch dashboard data...');
            const currentPeriod = getCurrentPeriod();
            const previousPeriod = getPreviousPeriod();
            console.log('useDashboardData: Current period:', currentPeriod);
            console.log('useDashboardData: Previous period:', previousPeriod);

            // Fetch all metrics in parallel
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useDashboardData.ts:75',message:'About to fetch dashboard data',data:{currentPeriod,previousPeriod},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
            // #endregion
            // For admin overview, show all-time totals (not just current month)
            // This matches the ledger totals (1.2M) instead of just current month (144.1k)
            
            // Create all-time date range (from a very early date to now)
            const allTimeDateRange: DateRange = {
                start: new Date(2020, 0, 1), // Start from 2020
                end: new Date() // Current date
            };
            
            const [
                allTimeSales, // All-time global sales (no date range)
                currentMonthSales, // Current month for growth calculation
                previousMonthSales, // Previous month for growth calculation
                activeRegions,
                allTimeUnauthorizedDiscounts, // All-time unauthorized discounts total
                currentMonthUnauthorizedDiscounts, // Current month for growth calculation
                previousMonthUnauthorizedDiscounts, // Previous month for growth calculation
                totalKPOs,
                regionalSalesAllTime, // All-time regional sales (matches stats)
                regionalSalesPrevious, // Previous month for growth calculation
                creditsSummary // Global credits summary
            ] = await Promise.all([
                dataService.getGlobalSales(undefined, true), // All-time, excludeTestShops = true
                dataService.getGlobalSales(currentPeriod, true), // Current month for growth
                dataService.getGlobalSales(previousPeriod, true), // Previous month for growth
                dataService.getActiveRegions(),
                dataService.getTotalUnauthorizedDiscountsAmount(), // All-time total (ignores dateRange)
                dataService.getTotalUnauthorizedDiscountsAmount(currentPeriod), // Current month for growth
                dataService.getTotalUnauthorizedDiscountsAmount(previousPeriod), // Previous month for growth
                dataService.getTotalKPOs(),
                dataService.getRegionalSalesPerformance(allTimeDateRange), // All-time regional sales
                dataService.getRegionalSalesPerformance(previousPeriod), // Previous month for growth
                dataService.getGlobalCreditsSummary() // Global credits summary
            ]);

            console.log('useDashboardData: Data fetched:');
            console.log('- All-Time Sales:', allTimeSales);
            console.log('- Current Month Sales:', currentMonthSales);
            console.log('- Previous Month Sales:', previousMonthSales);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useDashboardData.ts:93',message:'Dashboard data fetched',data:{allTimeSales,currentMonthSales,previousMonthSales,regionalSalesAllTime,regionalSalesPrevious},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
            // #endregion
            console.log('- Active Regions:', activeRegions);
            console.log('- All-Time Unauthorized Discounts:', allTimeUnauthorizedDiscounts);
            console.log('- Current Month Unauthorized Discounts:', currentMonthUnauthorizedDiscounts);
            console.log('- Previous Month Unauthorized Discounts:', previousMonthUnauthorizedDiscounts);
            console.log('- Total KPOs:', totalKPOs);
            console.log('- Regional Sales All-Time:', regionalSalesAllTime);
            console.log('- Regional Sales Previous:', regionalSalesPrevious);

            // Calculate growth percentages based on current vs previous month
            const salesGrowth = calculateGrowthPercentage(currentMonthSales, previousMonthSales);
            const unauthorizedDiscountsGrowth = calculateGrowthPercentage(
                currentMonthUnauthorizedDiscounts,
                previousMonthUnauthorizedDiscounts
            );
            // KPOs don't change by period, so growth is 0 (or could compare with a previous snapshot)
            const kpoGrowth = 0;

            // Build stats array - show all-time totals for admin overview
            const stats: StatItem[] = [
                {
                    label: "Global Sales",
                    value: formatSalesAmount(allTimeSales), // All-time total (matches ledger 1.2M)
                    trend: salesGrowth, // Growth based on current vs previous month
                    icon: "payments",
                    colorClass: "text-primary",
                    bgClass: "bg-primary/20"
                },
                {
                    label: "Active Regions",
                    value: activeRegions.length.toString(),
                    trend: 0, // Can be calculated if needed
                    icon: "map",
                    colorClass: "text-secondary",
                    bgClass: "bg-secondary/20"
                },
                {
                    label: "Unauthorized Discounts",
                    value: formatCurrency(allTimeUnauthorizedDiscounts), // All-time total (matches bookers table Rs. 65,122)
                    trend: unauthorizedDiscountsGrowth, // Growth based on current vs previous month
                    icon: "gavel",
                    colorClass: "text-orange-500",
                    bgClass: "bg-orange-500/20"
                },
                {
                    label: "Total KPOs",
                    value: totalKPOs.toString(),
                    trend: kpoGrowth,
                    icon: "engineering",
                    colorClass: "text-purple-500",
                    bgClass: "bg-purple-500/20"
                },
                {
                    label: "Total Credits Outstanding",
                    value: formatCurrency(creditsSummary?.totalCredits || 0),
                    trend: 0,
                    icon: "account_balance_wallet",
                    colorClass: "text-red-600",
                    bgClass: "bg-red-500/20"
                }
            ];

            // Build regional sales chart data (using all-time data to match stats)
            // Note: We still fetch previous period for potential future growth calculation
            const regionalSales: ChartData[] = regionalSalesAllTime
                .map(({ regionId, sales, branches }) => ({
                    name: getRegionName(regionId, regions) || regionId,
                    value: sales,
                    regionId: regionId,
                    branches: branches // Include branch breakdown if available
                }))
                .sort((a, b) => b.value - a.value);

            console.log('useDashboardData: Regional sales chart data:', regionalSales);

            // If no active regions found, try to get regions from all orders
            let regionsToUse = activeRegions;
            if (activeRegions.length === 0) {
                console.log('useDashboardData: No active regions found, fetching all regions...');
                const allRegions = await dataService.getRegions();
                regionsToUse = allRegions.map((r: any) => r.id);
                console.log('useDashboardData: Using all regions:', regionsToUse);
            }

            // Build regional top sellers (fetch for all active regions)
            const regionalTopSellers: Record<string, Array<{ name: string; sales: number; growth: number }>> = {};
            
            // Fetch top sellers for each region (only if there are regions)
            const topSellersPromises = regionsToUse.length > 0 
                ? regionsToUse.map(async (regionId) => {
                console.log(`useDashboardData: Fetching top sellers for region: ${regionId}`);
                const [currentTopSellers, previousTopSellers] = await Promise.all([
                    dataService.getRegionalTopSellers(regionId, 5, currentPeriod),
                    dataService.getRegionalTopSellers(regionId, 5, previousPeriod)
                ]);
                
                console.log(`useDashboardData: Region ${regionId} - Current: ${currentTopSellers.length}, Previous: ${previousTopSellers.length}`);

                const sellersMap: Record<string, { name: string; current: number; previous: number }> = {};
                
                currentTopSellers.forEach(seller => {
                    sellersMap[seller.productId] = {
                        name: seller.productName,
                        current: seller.unitsSold,
                        previous: 0
                    };
                });

                previousTopSellers.forEach(seller => {
                    if (!sellersMap[seller.productId]) {
                        sellersMap[seller.productId] = {
                            name: seller.productName,
                            current: 0,
                            previous: 0
                        };
                    }
                    sellersMap[seller.productId].previous = seller.unitsSold;
                });

                return {
                    regionId,
                    sellers: Object.values(sellersMap)
                        .map(seller => ({
                            name: seller.name,
                            sales: seller.current,
                            growth: calculateGrowthPercentage(seller.current, seller.previous)
                        }))
                        .sort((a, b) => b.sales - a.sales)
                        .slice(0, 5)
                };
                })
                : [];

            if (topSellersPromises.length > 0) {
                const topSellersResults = await Promise.all(topSellersPromises);
                topSellersResults.forEach(({ regionId, sellers }) => {
                    regionalTopSellers[regionId] = sellers;
                });
            }

            console.log('useDashboardData: Regional top sellers:', regionalTopSellers);
            console.log('useDashboardData: Final stats:', stats);

            // Check if request was cancelled
            if (isCancelled) {
                console.log('useDashboardData: Request cancelled, ignoring response');
                return;
            }

            const dashboardData = {
                stats,
                regionalSales,
                regionalTopSellers,
                creditsSummary,
                lastUpdated: new Date()
            };

            // Validate data before caching and setting state
            const hasValidData = stats.length > 0 || regionalSales.length > 0;

            if (hasValidData) {
                // Update cache only if data is valid
                dashboardCache = {
                    data: dashboardData,
                    timestamp: Date.now()
                };

                setState({
                    data: dashboardData,
                    isLoading: false,
                    error: null
                });
                
                console.log('useDashboardData: Dashboard data loaded successfully and cached');
            } else {
                console.warn('useDashboardData: Data fetched but appears empty - keeping previous data if available');
                setState(prev => ({
                    ...prev,
                    isLoading: false,
                    error: 'Data fetched but appears empty. Previous data may be shown.'
                }));
            }
        } catch (error: any) {
            // Check if request was cancelled
            if (isCancelled) {
                console.log('useDashboardData: Request cancelled during error handling');
                return;
            }

            console.error('Error fetching dashboard data:', error);
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
    }, [regions, users]);

    useEffect(() => {
        let cancelled = false;

        // Fetch dashboard data (even if regions is empty, we can still show other metrics)
        // Check cache first
        if (dashboardCache && Date.now() - dashboardCache.timestamp < CACHE_DURATION) {
            setState({
                data: dashboardCache.data,
                isLoading: false,
                error: null
            });
        } else {
            fetchDashboardData();
        }

        // Cleanup function
        return () => {
            cancelled = true;
        };
    }, []); // Fetch once on mount

    // Also fetch when regions/users are loaded (for region name mapping)
    // But only if cache is expired
    useEffect(() => {
        let cancelled = false;

        if (regions.length > 0 || users.length > 0) {
            if (!dashboardCache || Date.now() - dashboardCache.timestamp >= CACHE_DURATION) {
                fetchDashboardData();
            }
        }

        // Cleanup function
        return () => {
            cancelled = true;
        };
    }, [regions.length, users.length, fetchDashboardData]); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        ...state,
        refresh: () => {
            clearDashboardCache();
            fetchDashboardData();
        }
    };
}

