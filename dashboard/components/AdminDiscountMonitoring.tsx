import React, { useState, useEffect } from 'react';
import { dataService } from '../dataService';
import { exportToCSV } from '../utils/csvExporter';

interface BookerDiscountData {
    bookerId: string;
    bookerIds?: string[]; // For grouped bookers
    bookerName: string;
    branch: string;
    region: string;
    regionId?: string; // Store regionId for mapping
    currentMonth: string;
    currentMonthTotal: number;
    allMonths: Record<string, number>;
    totalUnauthorizedDiscount: number;
    orderIds: string[];
    lastResetDate?: string;
    groupedCount?: number; // Number of booker IDs grouped together
}

const AdminDiscountMonitoring: React.FC = () => {
    const [bookers, setBookers] = useState<BookerDiscountData[]>([]);
    const [allBookers, setAllBookers] = useState<BookerDiscountData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [branchFilter, setBranchFilter] = useState<string>('All');
    const [regionFilter, setRegionFilter] = useState<string>('All');
    const [resettingBooker, setResettingBooker] = useState<{ bookerId: string; month: string } | null>(null);
    const [branches, setBranches] = useState<string[]>([]);
    const [regions, setRegions] = useState<string[]>([]);
    const [regionMap, setRegionMap] = useState<Record<string, string>>({}); // regionId -> regionName

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [branchFilter, regionFilter, allBookers]);

    const loadData = async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Load regions first to map regionId to region name
            const regionsData = await dataService.getRegions();
            const regionIdToNameMap = regionsData.reduce((acc, r) => {
                acc[r.id] = r.name;
                return acc;
            }, {} as Record<string, string>);
            setRegionMap(regionIdToNameMap);

            // Get all bookers
            const allUsers = await dataService.getAllUsers();
            const bookerUsers = allUsers.filter(u => u.role?.toLowerCase() === 'booker');

            // Get activity logs once for all bookers (more efficient)
            const activityLogs = await dataService.getActivityLogs(500); // Get more logs to find resets

            // Get discount data for each booker
            const discountPromises = bookerUsers.map(async (booker) => {
                try {
                    const discountData = await dataService.getBookerMonthlyUnauthorizedDiscount(booker.id);
                    
                    // Get last reset date from activity logs - search by booker name in action message
                    const bookerName = booker.name || 'Unknown';
                    const resetLogs = activityLogs.filter((log: any) => {
                        const action = log.action || '';
                        return action.includes('Reset unauthorized discount for booker') && 
                               action.includes(bookerName);
                    });
                    
                    // Get the most recent reset log
                    const resetLog = resetLogs.length > 0 ? resetLogs[0] : null;
                    
                    // Get region name from regionId
                    const regionId = (booker as any).regionId || '';
                    const regionName = regionId ? (regionIdToNameMap[regionId] || 'N/A') : 'N/A';
                    
                    return {
                        bookerId: booker.id,
                        bookerName: bookerName,
                        branch: booker.branch || 'N/A',
                        region: regionName,
                        regionId: regionId,
                        currentMonth: discountData.currentMonth,
                        currentMonthTotal: discountData.currentMonthTotal,
                        allMonths: discountData.allMonths,
                        totalUnauthorizedDiscount: discountData.totalUnauthorizedDiscount,
                        orderIds: discountData.orderIds,
                        lastResetDate: resetLog?.timestamp ? 
                            (resetLog.timestamp.toDate ? resetLog.timestamp.toDate().toLocaleDateString() : 
                             typeof resetLog.timestamp === 'string' ? new Date(resetLog.timestamp).toLocaleDateString() :
                             new Date(resetLog.timestamp.seconds * 1000).toLocaleDateString()) : undefined
                    };
                } catch (err) {
                    console.error(`Error loading discount data for booker ${booker.id}:`, err);
                    return null;
                }
            });

            const discountDataArray = await Promise.all(discountPromises);
            const validData = discountDataArray.filter((d): d is BookerDiscountData => d !== null);
            
            // Only show bookers with unauthorized discounts
            const bookersWithDiscounts = validData.filter(b => b.totalUnauthorizedDiscount > 0);
            
            // Group bookers by name and aggregate totals
            const bookerMap = new Map<string, BookerDiscountData>();
            bookersWithDiscounts.forEach(booker => {
                const existing = bookerMap.get(booker.bookerName);
                if (existing) {
                    // Aggregate totals
                    existing.currentMonthTotal += booker.currentMonthTotal;
                    existing.totalUnauthorizedDiscount += booker.totalUnauthorizedDiscount;
                    
                    // Merge allMonths
                    Object.keys(booker.allMonths).forEach(month => {
                        existing.allMonths[month] = (existing.allMonths[month] || 0) + booker.allMonths[month];
                    });
                    
                    // Merge orderIds (remove duplicates)
                    existing.orderIds = [...new Set([...existing.orderIds, ...booker.orderIds])];
                    
                    // Track multiple IDs
                    if (!existing.bookerIds) {
                        existing.bookerIds = [existing.bookerId];
                    }
                    existing.bookerIds.push(booker.bookerId);
                    existing.groupedCount = (existing.groupedCount || 1) + 1;
                    
                    // Use the most recent lastResetDate if available
                    if (booker.lastResetDate && (!existing.lastResetDate || booker.lastResetDate > existing.lastResetDate)) {
                        existing.lastResetDate = booker.lastResetDate;
                    }
                } else {
                    // First occurrence of this name
                    bookerMap.set(booker.bookerName, {
                        ...booker,
                        bookerIds: [booker.bookerId],
                        groupedCount: 1
                    });
                }
            });
            
            const groupedBookers = Array.from(bookerMap.values());
            
            setAllBookers(groupedBookers);
            
            // Extract unique branches and regions from grouped data
            const uniqueBranches = Array.from(new Set(groupedBookers.map(b => b.branch))).filter(b => b !== 'N/A').sort();
            const uniqueRegions = Array.from(new Set(groupedBookers.map(b => b.region))).filter(r => r !== 'N/A').sort();
            setBranches(uniqueBranches);
            setRegions(uniqueRegions);
        } catch (err: any) {
            console.error('Error loading discount monitoring data:', err);
            setError(err.message || 'Failed to load discount monitoring data');
        } finally {
            setIsLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...allBookers];

        if (branchFilter !== 'All') {
            filtered = filtered.filter(b => b.branch === branchFilter);
        }

        if (regionFilter !== 'All') {
            filtered = filtered.filter(b => b.region === regionFilter);
        }

        // Sort by current month total (descending)
        filtered.sort((a, b) => b.currentMonthTotal - a.currentMonthTotal);

        setBookers(filtered);
    };

    const handleReset = async (bookerId: string, month: string, bookerName: string) => {
        const booker = allBookers.find(b => b.bookerId === bookerId);
        if (!booker) {
            alert('Booker not found');
            return;
        }
        
        const amount = booker.allMonths[month] || 0;
        const bookerIdsToReset = booker.bookerIds || [bookerId];
        const isGrouped = bookerIdsToReset.length > 1;
        
        const confirmMessage = isGrouped 
            ? `Are you sure you want to reset unauthorized discount for ${bookerName}?\n\nThis will reset discounts for ${bookerIdsToReset.length} booker account(s) with this name.\n\nMonth: ${month}\nTotal Amount: Rs. ${amount.toFixed(2)}\n\nThis will mark the discount as deducted from salary.`
            : `Are you sure you want to reset unauthorized discount for ${bookerName}?\n\nMonth: ${month}\nAmount: Rs. ${amount.toFixed(2)}\n\nThis will mark the discount as deducted from salary.`;
        
        if (!window.confirm(confirmMessage)) {
            return;
        }

        try {
            setResettingBooker({ bookerId, month });
            
            // Get current user (Admin)
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            
            // Reset for all booker IDs with the same name
            const resetPromises = bookerIdsToReset.map(id => 
                dataService.resetBookerUnauthorizedDiscount(id, month, currentUser.id || 'admin')
            );
            
            await Promise.all(resetPromises);
            
            // Reload data
            await loadData();
            
            alert(`Unauthorized discount for ${month} has been reset successfully${isGrouped ? ` for ${bookerIdsToReset.length} account(s)` : ''}!`);
        } catch (err: any) {
            console.error('Error resetting discount:', err);
            alert(`Failed to reset discount: ${err.message || 'Unknown error'}`);
        } finally {
            setResettingBooker(null);
        }
    };

    const handleExport = () => {
        const headers = ['Booker Name', 'Branch', 'Region', 'Current Month', 'Current Month Total (PKR)', 'Total Unauthorized (PKR)', 'Last Reset Date'];
        
        const data = bookers.map(b => ({
            'Booker Name': b.bookerName,
            'Branch': b.branch,
            'Region': b.region,
            'Current Month': b.currentMonth,
            'Current Month Total (PKR)': b.currentMonthTotal.toFixed(2),
            'Total Unauthorized (PKR)': b.totalUnauthorizedDiscount.toFixed(2),
            'Last Reset Date': b.lastResetDate || 'Never'
        }));
        
        exportToCSV(data, headers, { filename: `unauthorized_discount_monitoring_${new Date().toISOString().split('T')[0]}` });
    };

    const totalCurrentMonth = bookers.reduce((sum, b) => sum + b.currentMonthTotal, 0);
    const totalAllTime = bookers.reduce((sum, b) => sum + b.totalUnauthorizedDiscount, 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-900">Unauthorized Discount Monitoring</h2>
                    <p className="text-slate-500 mt-1">Monitor and manage unauthorized discounts across all bookers</p>
                    {allBookers.some(b => b.groupedCount && b.groupedCount > 1) && (
                        <p className="text-xs text-slate-400 mt-1 italic">
                            Note: Bookers with duplicate names are grouped and their totals are aggregated
                        </p>
                    )}
                </div>
                {bookers.length > 0 && (
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        <span className="material-symbols-outlined text-[18px]">download</span>
                        Export CSV
                    </button>
                )}
            </div>

            {error && (
                <div className="rounded-xl bg-red-50 p-4 border border-red-200">
                    <p className="text-red-800 font-medium">Error: {error}</p>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-6 rounded-xl bg-white border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-red-50 text-red-600">
                            <span className="material-symbols-outlined">person</span>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase">Bookers with Discounts</p>
                            <p className="text-2xl font-black text-slate-900">{bookers.length}</p>
                        </div>
                    </div>
                </div>
                <div className="p-6 rounded-xl bg-white border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-orange-50 text-orange-600">
                            <span className="material-symbols-outlined">calendar_month</span>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase">Current Month Total</p>
                            <p className="text-2xl font-black text-slate-900">Rs. {totalCurrentMonth.toFixed(2)}</p>
                        </div>
                    </div>
                </div>
                <div className="p-6 rounded-xl bg-white border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-yellow-50 text-yellow-600">
                            <span className="material-symbols-outlined">account_balance</span>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase">All Time Total</p>
                            <p className="text-2xl font-black text-slate-900">Rs. {totalAllTime.toFixed(2)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                    <label className="text-sm font-bold text-slate-700">Branch:</label>
                    <select
                        value={branchFilter}
                        onChange={(e) => setBranchFilter(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="All">All Branches</option>
                        {branches.map(branch => (
                            <option key={branch} value={branch}>{branch}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm font-bold text-slate-700">Region:</label>
                    <select
                        value={regionFilter}
                        onChange={(e) => setRegionFilter(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="All">All Regions</option>
                        {regions.map(region => (
                            <option key={region} value={region}>{region}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Table */}
            {isLoading ? (
                <div className="glass-panel rounded-3xl bg-white p-12 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            ) : bookers.length === 0 ? (
                <div className="glass-panel rounded-3xl bg-white p-12 text-center text-slate-400">
                    <span className="material-symbols-outlined text-4xl mb-2">check_circle</span>
                    <p>No unauthorized discounts found</p>
                </div>
            ) : (
                <div className="glass-panel rounded-3xl bg-white overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400">
                                <tr>
                                    <th className="px-6 py-4">Booker Name</th>
                                    <th className="px-6 py-4">Branch</th>
                                    <th className="px-6 py-4">Region</th>
                                    <th className="px-6 py-4">Current Month</th>
                                    <th className="px-6 py-4 text-right">Current Month Total</th>
                                    <th className="px-6 py-4 text-right">All Time Total</th>
                                    <th className="px-6 py-4">Last Reset</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {bookers.map(booker => (
                                    <tr key={booker.bookerId} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                                                    {booker.bookerName.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-900">{booker.bookerName}</span>
                                                    {booker.groupedCount && booker.groupedCount > 1 && (
                                                        <span className="text-[10px] text-slate-400 mt-0.5" title={`${booker.groupedCount} booker accounts grouped`}>
                                                            {booker.groupedCount} accounts merged
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-slate-700 ${booker.branch === 'N/A' ? 'italic text-slate-400' : ''}`}>
                                                {booker.branch}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-slate-500 ${booker.region === 'N/A' ? 'italic text-slate-400' : ''}`}>
                                                {booker.region}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold">
                                                {booker.currentMonth}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-black text-red-600">Rs. {booker.currentMonthTotal.toFixed(2)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-bold text-slate-900">Rs. {booker.totalUnauthorizedDiscount.toFixed(2)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-500">
                                            {booker.lastResetDate || 'Never'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleReset(booker.bookerId, booker.currentMonth, booker.bookerName)}
                                                    disabled={resettingBooker?.bookerId === booker.bookerId && resettingBooker?.month === booker.currentMonth}
                                                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    {resettingBooker?.bookerId === booker.bookerId && resettingBooker?.month === booker.currentMonth ? 'Resetting...' : 'Reset Current Month'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDiscountMonitoring;

