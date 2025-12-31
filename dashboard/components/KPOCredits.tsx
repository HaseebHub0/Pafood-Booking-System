import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { dataService } from '../dataService';
import { formatCurrency, formatDate } from '../utils/dateUtils';

interface KPOCreditsProps {
    user: User;
}

interface CreditBill {
    id: string;
    billNumber: string;
    orderNumber: string;
    customerName: string;
    totalAmount: number;
    paidAmount: number;
    remainingCredit: number;
    creditStatus: 'PARTIAL' | 'FULL_CREDIT' | 'NONE';
    paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';
    billedAt: string;
    bookerId: string;
    bookerName?: string;
}

interface BookerCreditSummary {
    bookerId: string;
    bookerName: string;
    totalBills: number;
    totalCredit: number;
    bills: CreditBill[];
}

const KPOCredits: React.FC<KPOCreditsProps> = ({ user }) => {
    const [bookerCredits, setBookerCredits] = useState<BookerCreditSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedBooker, setSelectedBooker] = useState<string | null>(null);
    const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
    const [creditStatusFilter, setCreditStatusFilter] = useState<'all' | 'PARTIAL' | 'FULL_CREDIT'>('all');

    useEffect(() => {
        loadCredits();
    }, [user.branch, dateFilter, creditStatusFilter]);

    const loadCredits = async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Get all bills for the branch
            const bills = await dataService.getBillsByBranch(user.branch || '');
            
            // Filter by date
            let filteredBills = bills;
            if (dateFilter !== 'all') {
                const now = new Date();
                const filterDate = new Date();
                
                switch (dateFilter) {
                    case 'today':
                        filterDate.setHours(0, 0, 0, 0);
                        filteredBills = bills.filter(b => new Date(b.billedAt) >= filterDate);
                        break;
                    case 'week':
                        filterDate.setDate(now.getDate() - 7);
                        filteredBills = bills.filter(b => new Date(b.billedAt) >= filterDate);
                        break;
                    case 'month':
                        filterDate.setMonth(now.getMonth() - 1);
                        filteredBills = bills.filter(b => new Date(b.billedAt) >= filterDate);
                        break;
                }
            }

            // Filter by credit status
            if (creditStatusFilter !== 'all') {
                filteredBills = filteredBills.filter(b => 
                    b.creditStatus === creditStatusFilter && b.remainingCredit > 0
                );
            } else {
                // Only show bills with credit
                filteredBills = filteredBills.filter(b => b.remainingCredit > 0);
            }

            // Group by booker
            const bookerMap = new Map<string, BookerCreditSummary>();
            
            filteredBills.forEach((bill: any) => {
                const bookerId = bill.bookerId || 'unknown';
                const bookerName = bill.bookerName || 'Unknown Booker';
                
                if (!bookerMap.has(bookerId)) {
                    bookerMap.set(bookerId, {
                        bookerId,
                        bookerName,
                        totalBills: 0,
                        totalCredit: 0,
                        bills: [],
                    });
                }
                
                const summary = bookerMap.get(bookerId)!;
                summary.totalBills++;
                summary.totalCredit += bill.remainingCredit;
                summary.bills.push({
                    id: bill.id,
                    billNumber: bill.billNumber,
                    orderNumber: bill.orderNumber,
                    customerName: bill.customerName || bill.shopName,
                    totalAmount: bill.totalAmount,
                    paidAmount: bill.paidAmount,
                    remainingCredit: bill.remainingCredit,
                    creditStatus: bill.creditStatus,
                    paymentStatus: bill.paymentStatus,
                    billedAt: bill.billedAt,
                    bookerId: bill.bookerId,
                    bookerName: bill.bookerName,
                });
            });

            // Convert to array and sort by total credit descending
            const summaries = Array.from(bookerMap.values()).sort((a, b) => 
                b.totalCredit - a.totalCredit
            );

            setBookerCredits(summaries);
        } catch (err: any) {
            console.error('Error loading credits:', err);
            setError(err.message || 'Failed to load credits');
        } finally {
            setIsLoading(false);
        }
    };

    const totalCredits = bookerCredits.reduce((sum, b) => sum + b.totalCredit, 0);
    const totalBills = bookerCredits.reduce((sum, b) => sum + b.totalBills, 0);

    if (isLoading) {
        return (
            <div className="p-3">
                <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <p className="mt-3 text-gray-600 text-xs">Loading credits...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-3">
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-red-800 text-xs mb-2 break-words">{error}</p>
                    <button
                        onClick={loadCredits}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-semibold hover:bg-red-700 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-3 space-y-3 md:space-y-4">
            <div className="mb-3">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 mb-1 truncate">Total Credits Dashboard</h1>
                <p className="text-[11px] sm:text-xs text-gray-600">Booker-wise credit tracking and outstanding balances</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mb-3">
                <div className="bg-white rounded-lg shadow-sm p-3 border border-slate-100">
                    <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] text-gray-600">Total Credits Outstanding</p>
                            <p className="text-lg font-bold text-gray-900 mt-0.5 truncate">
                                {formatCurrency(totalCredits)}
                            </p>
                        </div>
                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                            <span className="text-base">💰</span>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-3 border border-slate-100">
                    <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] text-gray-600">Total Credit Bills</p>
                            <p className="text-lg font-bold text-gray-900 mt-0.5">{totalBills}</p>
                        </div>
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                            <span className="text-base">📋</span>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-3 border border-slate-100">
                    <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] text-gray-600">Bookers with Credits</p>
                            <p className="text-lg font-bold text-gray-900 mt-0.5">{bookerCredits.length}</p>
                        </div>
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                            <span className="text-base">👥</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm p-3 mb-3 border border-slate-100">
                <div className="flex flex-wrap gap-3">
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-[10px] font-semibold text-gray-700 mb-1">Date Range</label>
                        <select
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value as any)}
                            className="border border-gray-300 rounded-md px-2 py-1.5 text-xs w-full focus:ring-primary focus:border-primary outline-none"
                        >
                            <option value="all">All Time</option>
                            <option value="today">Today</option>
                            <option value="week">Last 7 Days</option>
                            <option value="month">Last 30 Days</option>
                        </select>
                    </div>
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-[10px] font-semibold text-gray-700 mb-1">Credit Status</label>
                        <select
                            value={creditStatusFilter}
                            onChange={(e) => setCreditStatusFilter(e.target.value as any)}
                            className="border border-gray-300 rounded-md px-2 py-1.5 text-xs w-full focus:ring-primary focus:border-primary outline-none"
                        >
                            <option value="all">All Credits</option>
                            <option value="PARTIAL">Partial Credit</option>
                            <option value="FULL_CREDIT">Full Credit</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Booker-wise Credit List */}
            {bookerCredits.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center border border-slate-100">
                    <p className="text-gray-600 text-sm">No credit bills found</p>
                    <p className="text-gray-500 text-xs mt-1.5">All bills have been paid or no bills match the filters</p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {bookerCredits.map((booker) => (
                        <div key={booker.bookerId} className="bg-white rounded-lg shadow-sm overflow-hidden border border-slate-100">
                            {/* Booker Header */}
                            <div
                                className="bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2 cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-colors"
                                onClick={() => setSelectedBooker(selectedBooker === booker.bookerId ? null : booker.bookerId)}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                                            {booker.bookerName.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-semibold text-gray-900 text-xs truncate">{booker.bookerName}</h3>
                                            <p className="text-[10px] text-gray-600 truncate">Booker ID: {booker.bookerId}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        <div className="text-right">
                                            <p className="text-[10px] text-gray-600">Total Bills</p>
                                            <p className="text-sm font-bold text-gray-900 whitespace-nowrap">{booker.totalBills}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-gray-600">Total Credit</p>
                                            <p className="text-sm font-bold text-red-600 whitespace-nowrap">
                                                {formatCurrency(booker.totalCredit)}
                                            </p>
                                        </div>
                                        <span className="text-gray-400 text-xs">
                                            {selectedBooker === booker.bookerId ? '▼' : '▶'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Bill Details (Collapsible) */}
                            {selectedBooker === booker.bookerId && (
                                <div className="border-t border-gray-200">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-2 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">
                                                        Bill Number
                                                    </th>
                                                    <th className="px-2 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">
                                                        Customer Name
                                                    </th>
                                                    <th className="px-2 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase">
                                                        Total Bill Amount
                                                    </th>
                                                    <th className="px-2 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase">
                                                        Paid Amount
                                                    </th>
                                                    <th className="px-2 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase">
                                                        Remaining Credit
                                                    </th>
                                                    <th className="px-2 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase">
                                                        Credit Status
                                                    </th>
                                                    <th className="px-2 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase">
                                                        Payment Status
                                                    </th>
                                                    <th className="px-2 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">
                                                        Bill Date
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {booker.bills.map((bill) => (
                                                    <tr key={bill.id} className="hover:bg-gray-50">
                                                        <td className="px-2 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                                                            {bill.billNumber}
                                                        </td>
                                                        <td className="px-2 py-2 text-xs text-gray-700 truncate max-w-[150px]">
                                                            {bill.customerName}
                                                        </td>
                                                        <td className="px-2 py-2 whitespace-nowrap text-xs text-right text-gray-900 font-medium">
                                                            {formatCurrency(bill.totalAmount)}
                                                        </td>
                                                        <td className="px-2 py-2 whitespace-nowrap text-xs text-right text-green-600 font-medium">
                                                            {formatCurrency(bill.paidAmount)}
                                                        </td>
                                                        <td className="px-2 py-2 whitespace-nowrap text-xs text-right text-red-600 font-bold">
                                                            {formatCurrency(bill.remainingCredit)}
                                                        </td>
                                                        <td className="px-2 py-2 whitespace-nowrap text-center">
                                                            <span className={`inline-flex px-1.5 py-0.5 text-[9px] font-semibold rounded-full ${
                                                                bill.creditStatus === 'FULL_CREDIT' 
                                                                    ? 'bg-red-100 text-red-800' 
                                                                    : 'bg-yellow-100 text-yellow-800'
                                                            }`}>
                                                                {bill.creditStatus === 'FULL_CREDIT' ? 'FULL CREDIT' : 'PARTIAL'}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-2 whitespace-nowrap text-center">
                                                            <span className={`inline-flex px-1.5 py-0.5 text-[9px] font-semibold rounded-full ${
                                                                bill.paymentStatus === 'PAID' 
                                                                    ? 'bg-green-100 text-green-800' 
                                                                    : bill.paymentStatus === 'PARTIALLY_PAID'
                                                                    ? 'bg-yellow-100 text-yellow-800'
                                                                    : 'bg-red-100 text-red-800'
                                                            }`}>
                                                                {bill.paymentStatus === 'PAID' ? 'PAID' : 
                                                                 bill.paymentStatus === 'PARTIALLY_PAID' ? 'PARTIAL' : 'UNPAID'}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500">
                                                            {formatDate(bill.billedAt)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default KPOCredits;

