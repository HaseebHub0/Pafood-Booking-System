import React, { useState, useEffect } from 'react';
import { dataService } from '../dataService';
import { exportToCSV } from '../utils/csvExporter';

interface BookerDiscountData {
    bookerId: string;
    bookerName: string;
    branch: string;
    region: string;
    currentMonth: string;
    currentMonthTotal: number;
    allMonths: Record<string, number>;
    totalUnauthorizedDiscount: number;
    orderIds: string[];
    lastResetDate?: string;
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

            // Get all bookers
            const allUsers = await dataService.getAllUsers();
            const bookerUsers = allUsers.filter(u => u.role?.toLowerCase() === 'booker');

            // Get discount data for each booker
            const discountPromises = bookerUsers.map(async (booker) => {
                try {
                    const discountData = await dataService.getBookerMonthlyUnauthorizedDiscount(booker.id);
                    
                    // Get last reset date from activity logs (if available)
                    const activityLogs = await dataService.getActivityLogs(100);
                    const resetLog = activityLogs.find((log: any) => 
                        log.action?.includes('Reset unauthorized discount') && 
                        log.userId === booker.id
                    );
                    
                    return {
                        bookerId: booker.id,
                        bookerName: booker.name || 'Unknown',
                        branch: booker.branch || 'N/A',
                        region: booker.region || 'N/A',
                        currentMonth: discountData.currentMonth,
                        currentMonthTotal: discountData.currentMonthTotal,
                        allMonths: discountData.allMonths,
                        totalUnauthorizedDiscount: discountData.totalUnauthorizedDiscount,
                        orderIds: discountData.orderIds,
                        lastResetDate: resetLog?.timestamp ? 
                            (resetLog.timestamp.toDate ? resetLog.timestamp.toDate().toLocaleDateString() : 
                             new Date(resetLog.timestamp).toLocaleDateString()) : undefined
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
            
            setAllBookers(bookersWithDiscounts);
            
            // Extract unique branches and regions
            const uniqueBranches = Array.from(new Set(bookersWithDiscounts.map(b => b.branch))).sort();
            const uniqueRegions = Array.from(new Set(bookersWithDiscounts.map(b => b.region))).sort();
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
        const amount = allBookers.find(b => b.bookerId === bookerId)?.allMonths[month] || 0;
        
        const confirmMessage = `Are you sure you want to reset unauthorized discount for ${bookerName}?\n\nMonth: ${month}\nAmount: Rs. ${amount.toFixed(2)}\n\nThis will mark the discount as deducted from salary.`;
        
        if (!window.confirm(confirmMessage)) {
            return;
        }

        try {
            setResettingBooker({ bookerId, month });
            
            // Get current user (Admin)
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            await dataService.resetBookerUnauthorizedDiscount(bookerId, month, currentUser.id || 'admin');
            
            // Reload data
            await loadData();
            
            alert(`Unauthorized discount for ${month} has been reset successfully!`);
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
                                                <span className="font-bold text-slate-900">{booker.bookerName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-700">{booker.branch}</td>
                                        <td className="px-6 py-4 text-slate-500">{booker.region}</td>
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

