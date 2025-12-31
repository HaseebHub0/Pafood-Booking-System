import { useState, useEffect, useCallback } from 'react';
import { dataService } from '../dataService';
import { getCurrentPeriod, getPreviousPeriod, calculateGrowthPercentage, formatCurrency } from '../utils/dateUtils';
import { formatSalesAmount, formatBookerAmount, getRegionName } from '../utils/metrics';
import { StatItem, ChartData, Region } from '../types';

interface DashboardData {
    stats: StatItem[];
    regionalSales: ChartData[];
    regionalTopSellers: Record<string, Array<{ name: string; sales: number; growth: number }>>;
    lastUpdated: Date | null;
}

interface DashboardState {
    data: DashboardData | null;
    isLoading: boolean;
    error: string | null;
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
            const [
                currentSales,
                previousSales,
                activeRegions,
                currentUnauthorizedDiscounts,
                previousUnauthorizedDiscounts,
                totalKPOs,
                regionalSalesCurrent,
                regionalSalesPrevious
            ] = await Promise.all([
                dataService.getGlobalSales(currentPeriod),
                dataService.getGlobalSales(previousPeriod),
                dataService.getActiveRegions(),
                dataService.getUnauthorizedDiscountsCount(currentPeriod),
                dataService.getUnauthorizedDiscountsCount(previousPeriod),
                dataService.getTotalKPOs(),
                dataService.getRegionalSalesPerformance(currentPeriod),
                dataService.getRegionalSalesPerformance(previousPeriod)
            ]);

            console.log('useDashboardData: Data fetched:');
            console.log('- Current Sales:', currentSales);
            console.log('- Previous Sales:', previousSales);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useDashboardData.ts:93',message:'Dashboard data fetched',data:{currentSales,previousSales,regionalSalesCurrent,regionalSalesPrevious},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
            // #endregion
            console.log('- Active Regions:', activeRegions);
            console.log('- Unauthorized Discounts (current):', currentUnauthorizedDiscounts);
            console.log('- Unauthorized Discounts (previous):', previousUnauthorizedDiscounts);
            console.log('- Total KPOs:', totalKPOs);
            console.log('- Regional Sales Current:', regionalSalesCurrent);
            console.log('- Regional Sales Previous:', regionalSalesPrevious);

            // Calculate growth percentages
            const salesGrowth = calculateGrowthPercentage(currentSales, previousSales);
            const unauthorizedDiscountsGrowth = calculateGrowthPercentage(
                currentUnauthorizedDiscounts,
                previousUnauthorizedDiscounts
            );
            // KPOs don't change by period, so growth is 0 (or could compare with a previous snapshot)
            const kpoGrowth = 0;

            // Build stats array
            const stats: StatItem[] = [
                {
                    label: "Global Sales",
                    value: formatSalesAmount(currentSales),
                    trend: salesGrowth,
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
                    value: currentUnauthorizedDiscounts.toString(),
                    trend: unauthorizedDiscountsGrowth,
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
                }
            ];

            // Build regional sales chart data
            const regionalSalesMap: Record<string, { current: number; previous: number }> = {};
            
            regionalSalesCurrent.forEach(({ regionId, sales }) => {
                if (!regionalSalesMap[regionId]) {
                    regionalSalesMap[regionId] = { current: 0, previous: 0 };
                }
                regionalSalesMap[regionId].current = sales;
            });

            regionalSalesPrevious.forEach(({ regionId, sales }) => {
                if (!regionalSalesMap[regionId]) {
                    regionalSalesMap[regionId] = { current: 0, previous: 0 };
                }
                regionalSalesMap[regionId].previous = sales;
            });

            const regionalSales: ChartData[] = Object.entries(regionalSalesMap)
                .map(([regionId, sales]) => ({
                    name: getRegionName(regionId, regions) || regionId,
                    value: sales.current
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

            setState({
                data: {
                    stats,
                    regionalSales,
                    regionalTopSellers,
                    lastUpdated: new Date()
                },
                isLoading: false,
                error: null
            });
            
            console.log('useDashboardData: Dashboard data loaded successfully');
        } catch (error: any) {
            console.error('Error fetching dashboard data:', error);
            setState({
                data: null,
                isLoading: false,
                error: error.message || 'Failed to load dashboard data'
            });
        }
    }, [regions, users]);

    useEffect(() => {
        // Fetch dashboard data (even if regions is empty, we can still show other metrics)
        fetchDashboardData();
    }, []); // Fetch once on mount

    // Also fetch when regions/users are loaded (for region name mapping)
    useEffect(() => {
        if (regions.length > 0 || users.length > 0) {
            fetchDashboardData();
        }
    }, [regions.length, users.length]); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        ...state,
        refresh: fetchDashboardData
    };
}

