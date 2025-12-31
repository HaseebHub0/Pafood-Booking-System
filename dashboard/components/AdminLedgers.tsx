import React, { useState, useEffect } from 'react';
import { REGIONS } from '../constants';
import { dataService } from '../dataService';
import { formatDate, formatCurrency, toSafeDate } from '../utils/dateUtils';
import { getRegionName } from '../utils/metrics';

interface LedgerEntry {
    id: string;
    partyName: string;
    type: 'SALE' | 'RETURN';
    amount: number;
    date: any;
    description: string;
    regionId: string;
    region: string;
    reference?: string;
    referenceType?: string;
}

const AdminLedgers: React.FC = () => {
    const [regionFilter, setRegionFilter] = useState('All');
    const [dateFilter, setDateFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [ledgers, setLedgers] = useState<LedgerEntry[]>([]);
    const [regions, setRegions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                setIsLoading(true);
                setError(null);
                
                const [ledgerData, regionsData] = await Promise.all([
                    dataService.getAllLedgerTransactions(),
                    dataService.getRegions()
                ]);
                
                setRegions(regionsData);
                
                // Transform ledger transactions to match the expected format
                const transformedLedgers: LedgerEntry[] = ledgerData.map((tx: any) => {
                    const regionName = getRegionName(tx.regionId || '', regionsData);
                    // Map SALE and RETURN types directly (cash-only system)
                    const txType = tx.type === 'SALE' ? 'SALE' : 
                                   tx.type === 'RETURN' ? 'RETURN' : 'SALE';
                    const refType = tx.type === 'SALE' ? 'Order' :
                                    tx.type === 'RETURN' ? 'Return' : 'Transaction';
                    
                    return {
                        id: tx.orderNumber || tx.id,
                        partyName: tx.shopName || 'Unknown',
                        type: txType as 'SALE' | 'RETURN',
                        amount: Math.abs(tx.amount || 0),
                        date: tx.date || tx.createdAt,
                        description: tx.description || tx.notes || `Transaction ${tx.type}`,
                        regionId: tx.regionId || '',
                        region: regionName || 'Unknown',
                        reference: tx.orderNumber || tx.returnNumber || tx.id,
                        referenceType: refType,
                    };
                });
                
                // Sort by date (most recent first)
                transformedLedgers.sort((a, b) => {
                    const dateA = toSafeDate(a.date).getTime();
                    const dateB = toSafeDate(b.date).getTime();
                    return dateB - dateA;
                });
                
                setLedgers(transformedLedgers);
            } catch (err: any) {
                console.error('Error loading ledgers:', err);
                setError(err.message || 'Failed to load ledger data');
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, []);

    const filteredLedgers = ledgers.filter(entry => {
        const matchRegion = regionFilter === 'All' || entry.region === regionFilter;
        const matchSearch = entry.partyName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           entry.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           entry.reference?.toLowerCase().includes(searchQuery.toLowerCase());
        
        // Date filter
        if (dateFilter !== 'All') {
            const entryDate = toSafeDate(entry.date);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            if (dateFilter === 'Today' && entryDate < today) return false;
            if (dateFilter === 'Week') {
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                if (entryDate < weekAgo) return false;
            }
            if (dateFilter === 'Month') {
                const monthAgo = new Date(today);
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                if (entryDate < monthAgo) return false;
            }
        }
        
        return matchRegion && matchSearch;
    });

    const totalSales = filteredLedgers.filter(l => l.type === 'SALE').reduce((acc, curr) => acc + curr.amount, 0);
    const totalReturns = filteredLedgers.filter(l => l.type === 'RETURN').reduce((acc, curr) => acc + curr.amount, 0);
    const netCash = totalSales - totalReturns;

    const getRefTypeBadge = (refType: string | undefined) => {
        const typeMap: Record<string, { bg: string; text: string }> = {
            Order: { bg: 'bg-blue-50', text: 'text-blue-600' },
            Payment: { bg: 'bg-green-50', text: 'text-green-600' },
            Return: { bg: 'bg-orange-50', text: 'text-orange-600' },
            Transaction: { bg: 'bg-slate-50', text: 'text-slate-600' },
        };
        const style = typeMap[refType || 'Transaction'] || typeMap.Transaction;
        return (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${style.bg} ${style.text}`}>
                {refType || 'N/A'}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold text-slate-900">General Ledger</h2>
                <p className="text-slate-500 text-sm">Cash sales and returns across all regions.</p>
            </div>

            {error && (
                <div className="rounded-xl bg-red-50 p-4 border border-red-200">
                    <p className="text-red-800 font-medium">Error: {error}</p>
                </div>
            )}

            {/* Financial Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-xl bg-white border border-slate-100 shadow-sm">
                    <p className="text-xs text-slate-500 uppercase font-bold mb-2">Total Sales</p>
                    <p className="text-2xl font-black text-green-600">{formatCurrency(totalSales)}</p>
                </div>
                <div className="p-6 rounded-xl bg-white border border-slate-100 shadow-sm">
                    <p className="text-xs text-slate-500 uppercase font-bold mb-2">Total Returns</p>
                    <p className="text-2xl font-black text-red-600">{formatCurrency(totalReturns)}</p>
                </div>
                <div className="p-6 rounded-xl bg-slate-900 shadow-sm text-white relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-xs text-slate-400 uppercase font-bold mb-2">Net Cash</p>
                        <p className={`text-2xl font-black ${netCash >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatCurrency(Math.abs(netCash))}
                        </p>
                    </div>
                    <div className="absolute right-0 bottom-0 opacity-10">
                        <span className="material-symbols-outlined text-9xl">account_balance</span>
                    </div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="glass-panel p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between bg-white">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <select 
                        value={regionFilter}
                        onChange={(e) => setRegionFilter(e.target.value)}
                        className="rounded-lg border-slate-200 text-sm py-2 pl-3 pr-8 focus:ring-primary focus:border-primary bg-slate-50"
                    >
                        <option value="All">All Regions</option>
                        {regions.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                    </select>
                    <select 
                         value={dateFilter}
                         onChange={(e) => setDateFilter(e.target.value)}
                         className="rounded-lg border-slate-200 text-sm py-2 pl-3 pr-8 focus:ring-primary focus:border-primary bg-slate-50"
                    >
                        <option value="All">All Time</option>
                        <option value="Today">Today</option>
                        <option value="Week">This Week</option>
                        <option value="Month">This Month</option>
                    </select>
                </div>

                <div className="relative w-full md:w-64">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <span className="material-symbols-outlined text-[18px]">search</span>
                    </span>
                    <input
                        type="text"
                        placeholder="Search Party or Reference..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm focus:ring-primary focus:border-primary"
                    />
                </div>
            </div>

            {/* Ledger Table */}
            <div className="rounded-2xl glass-panel bg-white overflow-hidden border border-slate-200">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700">Transaction History</h3>
                    <div className="flex gap-2">
                        <button className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded hover:bg-slate-50">
                            Export CSV
                        </button>
                        <button className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded hover:bg-slate-50">
                            Export PDF
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-4 py-4 font-semibold">Date</th>
                                <th className="px-4 py-4 font-semibold">Reference</th>
                                <th className="px-4 py-4 font-semibold">Region</th>
                                <th className="px-4 py-4 font-semibold">Party Name</th>
                                <th className="px-4 py-4 font-semibold">Description</th>
                                <th className="px-4 py-4 font-semibold text-center">Type</th>
                                <th className="px-4 py-4 font-semibold text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <div className="flex items-center justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                        </div>
                                        <p className="mt-2 text-slate-400 text-sm">Loading ledger...</p>
                                    </td>
                                </tr>
                            ) : filteredLedgers.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                        <span className="material-symbols-outlined text-4xl mb-2">receipt_long</span>
                                        <p>No ledger entries found matching criteria.</p>
                                    </td>
                                </tr>
                            ) : filteredLedgers.map((entry) => (
                                <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-4 font-mono text-slate-500 text-xs">
                                        {formatDate(entry.date)}
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-mono text-xs text-slate-700">
                                                {entry.reference?.slice(0, 12) || 'N/A'}
                                            </span>
                                            {getRefTypeBadge(entry.referenceType)}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                                            {entry.region}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 font-medium text-slate-900">{entry.partyName}</td>
                                    <td className="px-4 py-4 text-slate-600 truncate max-w-[180px]">{entry.description}</td>
                                    <td className="px-4 py-4 text-center">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            entry.type === 'SALE' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                                        }`}>
                                            {entry.type}
                                        </span>
                                    </td>
                                    <td className={`px-4 py-4 text-right font-bold ${
                                        entry.type === 'SALE' ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                        {entry.type === 'RETURN' ? '-' : ''}{entry.amount.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminLedgers;
