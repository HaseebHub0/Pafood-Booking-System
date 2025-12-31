import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../types';
import { dataService } from '../dataService';
import { formatDate, formatCurrency, toSafeDate } from '../utils/dateUtils';

interface KPOLedgersProps {
    user: User;
}

interface LedgerEntry {
    id: string;
    date: any;
    partyName: string;
    description: string;
    type: 'SALE' | 'RETURN';
    reference: string;
    referenceType: string;
    net_cash: number; // Positive for SALE_DELIVERED, negative for RETURN
}

const KPOLedgers: React.FC<KPOLedgersProps> = ({ user }) => {
    const [ledgers, setLedgers] = useState<LedgerEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dateFilter, setDateFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const loadLedgerData = async () => {
            if (!user.branch) {
                setError('No branch assigned to user');
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                setError(null);
                console.log('KPOLedgers: Loading ledger for branch:', user.branch);

                // Get ledger entries from financial service (single source of truth)
                const { getFinancialLedgerEntries } = await import('../services/financialService');
                const allEntries = await getFinancialLedgerEntries(user.branch);

                // Transform to LedgerEntry format (filter only SALE_DELIVERED and RETURN)
                const ledgerEntries: LedgerEntry[] = allEntries
                    .filter(entry => entry.type === 'SALE' || entry.type === 'RETURN' || entry.type === 'SALE_DELIVERED')
                    .map(entry => ({
                    id: entry.id,
                    date: entry.date || entry.timestamp,
                    partyName: entry.partyName || entry.shopName || 'Unknown',
                        description: entry.description || 'Transaction',
                        type: (entry.type === 'SALE_DELIVERED' || entry.type === 'SALE') ? 'SALE' as const : 'RETURN' as const,
                    reference: entry.reference || entry.orderNumber || entry.returnNumber || entry.id,
                        referenceType: entry.referenceType || (entry.type === 'SALE' || entry.type === 'SALE_DELIVERED' ? 'Order' : 'Return'),
                        net_cash: entry.net_cash !== undefined ? entry.net_cash : (entry.amount || 0)
                }));

                // Sort by date (most recent first)
                ledgerEntries.sort((a, b) => {
                    const dateA = toSafeDate(a.date).getTime();
                    const dateB = toSafeDate(b.date).getTime();
                    return dateB - dateA;
                });

                setLedgers(ledgerEntries);
                console.log('KPOLedgers: Processed entries:', ledgerEntries.length);

            } catch (err: any) {
                console.error('KPOLedgers: Error loading data:', err);
                setError(err.message || 'Failed to load ledger data');
            } finally {
                setIsLoading(false);
            }
        };

        loadLedgerData();
    }, [user.branch]);

    // Filter ledgers
    const filteredLedgers = useMemo(() => {
        return ledgers.filter(entry => {
        const matchSearch = entry.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
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

        return matchSearch;
    });
    }, [ledgers, searchQuery, dateFilter]);

    // Calculate summary stats
    // Calculate summary stats from ledger entries
    const totalSales = useMemo(() => {
        return ledgers
            .filter(e => e.type === 'SALE')
            .reduce((sum, e) => sum + (e.net_cash || 0), 0);
    }, [ledgers]);

    const totalReturns = useMemo(() => {
        return Math.abs(ledgers
            .filter(e => e.type === 'RETURN')
            .reduce((sum, e) => sum + (e.net_cash || 0), 0));
    }, [ledgers]);

    const netCash = useMemo(() => {
        return ledgers.reduce((sum, e) => sum + (e.net_cash || 0), 0);
    }, [ledgers]);

    const activeParties = useMemo(() => {
        return new Set(ledgers.map(e => e.partyName)).size;
    }, [ledgers]);

    const getRefTypeBadge = (refType: string) => {
        const typeMap: Record<string, { bg: string; text: string }> = {
            Order: { bg: 'bg-blue-50', text: 'text-blue-600' },
            Payment: { bg: 'bg-green-50', text: 'text-green-600' },
            Return: { bg: 'bg-orange-50', text: 'text-orange-600' },
            Adjustment: { bg: 'bg-purple-50', text: 'text-purple-600' },
        };
        const style = typeMap[refType] || { bg: 'bg-slate-50', text: 'text-slate-600' };
        return (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${style.bg} ${style.text}`}>
                {refType}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-slate-900">Branch Ledger</h2>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        {user.branch}
                    </span>
                </div>
                <p className="text-slate-500 text-sm">View sales, returns, and transaction logs (Cash-only system).</p>
            </div>

            {error && (
                <div className="rounded-xl bg-red-50 p-4 border border-red-200">
                    <p className="text-red-800 font-medium">Error: {error}</p>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="p-6 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 rounded-full bg-green-50 text-green-600">
                        <span className="material-symbols-outlined">attach_money</span>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-bold">Total Sales</p>
                        <p className="text-xl font-bold text-green-600">
                            {isLoading ? '...' : formatCurrency(totalSales)}
                        </p>
                    </div>
                </div>
                <div className="p-6 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 rounded-full bg-orange-50 text-orange-600">
                        <span className="material-symbols-outlined">keyboard_return</span>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-bold">Total Returns</p>
                        <p className="text-xl font-bold text-orange-600">
                            {isLoading ? '...' : formatCurrency(totalReturns)}
                        </p>
                    </div>
                </div>
                <div className="p-6 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 rounded-full bg-blue-50 text-blue-600">
                        <span className="material-symbols-outlined">account_balance</span>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-bold">Net Cash</p>
                        <p className="text-xl font-bold text-blue-600">
                            {isLoading ? '...' : formatCurrency(netCash)}
                        </p>
                    </div>
                </div>
                <div className="p-6 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 rounded-full bg-green-50 text-green-600">
                        <span className="material-symbols-outlined">store</span>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-bold">Active Parties</p>
                        <p className="text-xl font-bold text-slate-900">
                            {isLoading ? '...' : activeParties}
                        </p>
                    </div>
                </div>
                <div className="p-6 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 rounded-full bg-purple-50 text-purple-600">
                        <span className="material-symbols-outlined">receipt_long</span>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-bold">Total Entries</p>
                        <p className="text-xl font-bold text-slate-900">
                            {isLoading ? '...' : ledgers.length}
                        </p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="glass-panel p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between bg-white">
                <div className="flex items-center gap-3 w-full md:w-auto">
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
                    <h3 className="font-bold text-slate-700">General Ledger</h3>
                    <div className="flex gap-2">
                        <button className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded hover:bg-slate-50">
                            Export PDF
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-white border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Date</th>
                                <th className="px-6 py-4 font-semibold">Reference</th>
                                <th className="px-6 py-4 font-semibold">Party Name</th>
                                <th className="px-6 py-4 font-semibold">Description</th>
                                <th className="px-6 py-4 font-semibold text-center">Type</th>
                                <th className="px-6 py-4 font-semibold text-right">Net Cash</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <div className="flex items-center justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                        </div>
                                        <p className="mt-2 text-slate-400 text-sm">Loading ledger...</p>
                                    </td>
                                </tr>
                            ) : filteredLedgers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                        <span className="material-symbols-outlined text-4xl mb-2">receipt_long</span>
                                        <p>No ledger entries found for {user.branch}.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredLedgers.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-slate-500 text-xs">
                                            {formatDate(entry.date)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-mono text-xs text-slate-700">
                                                    {entry.reference?.slice(0, 12) || 'N/A'}
                                                </span>
                                                {getRefTypeBadge(entry.referenceType)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-900">{entry.partyName}</td>
                                        <td className="px-6 py-4 text-slate-600 truncate max-w-[200px]">{entry.description}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                entry.type === 'SALE' ? 'bg-green-100 text-green-800' : 
                                                'bg-orange-100 text-orange-800'
                                            }`}>
                                                {entry.type}
                                            </span>
                                        </td>
                                        <td className={`px-6 py-4 text-right font-bold ${
                                            (entry.net_cash || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                            {formatCurrency(entry.net_cash || 0)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default KPOLedgers;
