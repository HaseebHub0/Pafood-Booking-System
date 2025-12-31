import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { dataService } from '../dataService';
import { formatDate, formatCurrency } from '../utils/dateUtils';

interface KPOReturnsProps {
    user: User;
}

interface StockReturn {
    id: string;
    returnNumber: string;
    shopId: string;
    shopName: string;
    ownerName?: string;
    salesmanId: string;
    salesmanName: string;
    items: Array<{
        productId: string;
        productName: string;
        quantity: number;
        unitPrice: number;
        reason?: string;
    }>;
    totalValue: number;
    status: 'pending' | 'pending_kpo_approval' | 'approved' | 'rejected' | 'processed';
    notes?: string;
    rejectionReason?: string;
    createdAt: any;
}

const KPOReturns: React.FC<KPOReturnsProps> = ({ user }) => {
    const [returns, setReturns] = useState<StockReturn[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedReturn, setSelectedReturn] = useState<StockReturn | null>(null);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [cashSummary, setCashSummary] = useState({ cash: 0, credit: 0 });
    const [activeTab, setActiveTab] = useState<'returns' | 'credit-outstanding'>('returns');
    const [outstandingData, setOutstandingData] = useState<any[]>([]);

    // Load returns from Firebase
    useEffect(() => {
        const loadReturns = async () => {
            if (!user.branch) {
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                console.log('KPOReturns: Loading returns for branch:', user.branch);
                
                const branchReturns = await dataService.getBranchStockReturns(user.branch);
                console.log('KPOReturns: Loaded returns:', branchReturns.length);
                
                setReturns(branchReturns);

                // Calculate cash summary from today's delivered orders
                const cashToday = await dataService.getBranchCashToday(user.branch);
                // Get credit from orders - we need to calculate this
                const todayOrders = await dataService.getBranchOrders(user.branch);
                const deliveredOrders = todayOrders.filter(o => o.status === 'delivered');
                const totalCredit = deliveredOrders.reduce((sum, o) => sum + (o.creditAmount || 0), 0);
                
                setCashSummary({ cash: cashToday, credit: totalCredit });
            } catch (error: any) {
                console.error('KPOReturns: Error loading returns:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadReturns();
    }, [user.branch]);

    const handleApprove = async (returnItem: StockReturn) => {
        if (!confirm(`Approve return ${returnItem.returnNumber || returnItem.id}?\n\nThis will update stock and ledger.`)) {
            return;
        }

        setIsProcessing(true);
        try {
            const success = await dataService.approveStockReturn(returnItem.id, user.id);
            if (success) {
                // Update local state
                setReturns(returns.map(r => 
                    r.id === returnItem.id ? { ...r, status: 'approved' as const } : r
                ));
                setSelectedReturn(null);
                alert('Stock return approved successfully!');
            } else {
                alert('Failed to approve return. Please try again.');
            }
        } catch (error: any) {
            console.error('Error approving return:', error);
            alert('Error approving return: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!selectedReturn || !rejectionReason.trim()) {
            alert('Please provide a rejection reason.');
            return;
        }

        setIsProcessing(true);
        try {
            const success = await dataService.rejectStockReturn(selectedReturn.id, user.id, rejectionReason);
            if (success) {
                // Update local state
                setReturns(returns.map(r => 
                    r.id === selectedReturn.id ? { ...r, status: 'rejected' as const, rejectionReason } : r
                ));
                setSelectedReturn(null);
                setShowRejectModal(false);
                setRejectionReason('');
                alert('Stock return rejected.');
            } else {
                alert('Failed to reject return. Please try again.');
            }
        } catch (error: any) {
            console.error('Error rejecting return:', error);
            alert('Error rejecting return: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const pendingReturns = returns.filter(r => r.status === 'pending' || r.status === 'pending_kpo_approval');
    const processedReturns = returns.filter(r => r.status === 'approved' || r.status === 'rejected' || r.status === 'processed');

    const getStatusBadge = (status: string) => {
        const statusMap: Record<string, { bg: string; text: string; label: string }> = {
            pending: { bg: 'bg-orange-100', text: 'text-orange-600', label: 'Pending' },
            pending_kpo_approval: { bg: 'bg-yellow-100', text: 'text-yellow-600', label: 'Awaiting Approval' },
            approved: { bg: 'bg-green-100', text: 'text-green-600', label: 'Approved' },
            rejected: { bg: 'bg-red-100', text: 'text-red-600', label: 'Rejected' },
            processed: { bg: 'bg-blue-100', text: 'text-blue-600', label: 'Processed' },
        };
        const s = statusMap[status] || statusMap.pending;
        return (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${s.bg} ${s.text}`}>
                {s.label}
            </span>
        );
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Returns & Credit</h2>
                    <p className="text-slate-500 text-sm">Manage returns and track outstanding credit in {user.branch}.</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                    <button
                        onClick={() => setActiveTab('returns')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            activeTab === 'returns'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Returns
                    </button>
                    <button
                        onClick={() => setActiveTab('credit-outstanding')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            activeTab === 'credit-outstanding'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Credit Outstanding
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'returns' && (
                <div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Pending Returns - Left Panel */}
                <div className="lg:col-span-2 glass-panel rounded-3xl bg-white border border-slate-100 overflow-hidden shadow-sm">
                    <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <div>
                            <h3 className="font-black text-slate-900">Stock Returns</h3>
                            <p className="text-xs text-slate-500">{pendingReturns.length} pending approval</p>
                        </div>
                        <span className="material-symbols-outlined text-slate-400">inventory_2</span>
                    </div>
                    
                    <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                        {isLoading ? (
                            <div className="p-12 text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                                <p className="mt-2 text-slate-400 text-sm">Loading returns...</p>
                            </div>
                        ) : returns.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <span className="material-symbols-outlined text-4xl mb-2">inventory</span>
                                <p>No stock returns found</p>
                            </div>
                        ) : (
                            returns.map(ret => (
                                <div 
                                    key={ret.id} 
                                    onClick={() => setSelectedReturn(ret)}
                                    className={`p-6 hover:bg-slate-50 transition-all cursor-pointer ${
                                        selectedReturn?.id === ret.id ? 'bg-red-50 border-l-4 border-primary' : ''
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="text-sm font-black text-slate-900">{ret.shopName}</p>
                                            <p className="text-xs text-slate-500">
                                                {ret.items?.length || 0} item(s) • {ret.salesmanName || 'Unknown'}
                                            </p>
                                        </div>
                                        {getStatusBadge(ret.status)}
                                    </div>
                                    <div className="flex justify-between items-center mt-3">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            {ret.returnNumber || ret.id?.slice(0, 8)}
                                        </p>
                                        <p className="font-bold text-slate-900">
                                            {formatCurrency(ret.totalValue || 0)}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Panel - Details or Cash Summary */}
                <div className="space-y-6">
                    {/* Selected Return Detail */}
                    {selectedReturn ? (
                        <div className="glass-panel rounded-3xl bg-white border border-slate-100 overflow-hidden shadow-sm">
                            <div className="p-6 bg-slate-50 border-b border-slate-100">
                                <h3 className="font-black text-slate-900">Return Details</h3>
                                <p className="text-xs text-slate-500">{selectedReturn.returnNumber || selectedReturn.id}</p>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase">Shop</p>
                                    <p className="font-bold text-slate-900">{selectedReturn.shopName}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase">Salesman</p>
                                    <p className="text-slate-700">{selectedReturn.salesmanName}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Items</p>
                                    <div className="space-y-2">
                                        {(selectedReturn.items || []).map((item, idx) => (
                                            <div key={idx} className="flex justify-between text-sm bg-slate-50 p-2 rounded">
                                                <span>{item.productName}</span>
                                                <span className="font-mono">× {item.quantity}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-slate-100">
                                    <div className="flex justify-between">
                                        <p className="text-xs font-bold text-slate-400 uppercase">Total Value</p>
                                        <p className="text-xl font-black text-primary">
                                            {formatCurrency(selectedReturn.totalValue || 0)}
                                        </p>
                                    </div>
                                </div>

                                {selectedReturn.notes && (
                                    <div className="pt-4 border-t border-slate-100">
                                        <p className="text-xs font-bold text-slate-400 uppercase">Notes</p>
                                        <p className="text-sm text-slate-700">{selectedReturn.notes}</p>
                                    </div>
                                )}

                                {selectedReturn.rejectionReason && (
                                    <div className="pt-4 border-t border-slate-100">
                                        <p className="text-xs font-bold text-red-400 uppercase">Rejection Reason</p>
                                        <p className="text-sm text-red-700">{selectedReturn.rejectionReason}</p>
                                    </div>
                                )}

                                {/* Action buttons - only for pending returns */}
                                {(selectedReturn.status === 'pending' || selectedReturn.status === 'pending_kpo_approval') && (
                                    <div className="pt-4 border-t border-slate-100 flex gap-3">
                                        <button 
                                            onClick={() => handleApprove(selectedReturn)}
                                            disabled={isProcessing}
                                            className="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 transition-all disabled:opacity-50"
                                        >
                                            {isProcessing ? 'Processing...' : 'Approve'}
                                        </button>
                                        <button 
                                            onClick={() => setShowRejectModal(true)}
                                            disabled={isProcessing}
                                            className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all disabled:opacity-50"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="glass-panel rounded-3xl bg-slate-100 p-8 text-center text-slate-400">
                            <span className="material-symbols-outlined text-4xl mb-2">touch_app</span>
                            <p>Select a return to view details</p>
                        </div>
                    )}

                    {/* Cash Summary */}
                    <div className="glass-panel rounded-3xl bg-white border border-slate-100 overflow-hidden shadow-sm">
                        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-black text-slate-900">Today's Collection</h3>
                            <span className="material-symbols-outlined text-slate-400">payments</span>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Cash (Delivered)</p>
                                    <p className="text-2xl font-black text-green-600">{formatCurrency(cashSummary.cash)}</p>
                                </div>
                                <div className="size-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                                    <span className="material-symbols-outlined">payments</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Credit (Delivered)</p>
                                    <p className="text-2xl font-black text-orange-600">{formatCurrency(cashSummary.credit)}</p>
                                </div>
                                <div className="size-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                                    <span className="material-symbols-outlined">description</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Rejection Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
                        <h3 className="text-lg font-black text-slate-900 mb-4">Reject Return</h3>
                        <p className="text-sm text-slate-500 mb-4">
                            Please provide a reason for rejecting this return request.
                        </p>
                        <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Enter rejection reason..."
                            className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-primary focus:border-primary"
                            rows={4}
                        />
                        <div className="flex gap-3 mt-4">
                            <button 
                                onClick={() => {
                                    setShowRejectModal(false);
                                    setRejectionReason('');
                                }}
                                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-all"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleReject}
                                disabled={isProcessing || !rejectionReason.trim()}
                                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all disabled:opacity-50"
                            >
                                {isProcessing ? 'Processing...' : 'Confirm Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
                </div>
            )}

            {activeTab === 'credit-outstanding' && (
                <div className="glass-panel bg-white rounded-2xl p-6 border border-slate-200">
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Outstanding Credit by Shop</h3>
                        <p className="text-sm text-slate-500">Total outstanding balance across all shops</p>
                    </div>

                    {outstandingData.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <span className="material-symbols-outlined text-6xl mb-4 opacity-20">account_balance_wallet</span>
                            <p className="text-lg font-medium">No outstanding credit</p>
                            <p className="text-sm mt-2">All payments have been collected</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {outstandingData
                                .sort((a, b) => b.outstandingBalance - a.outstandingBalance)
                                .map((shop) => (
                                    <div key={shop.shopId} className="p-4 rounded-xl border border-slate-200 hover:shadow-md transition-shadow">
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <h4 className="font-bold text-slate-900">{shop.shopName}</h4>
                                                <p className="text-sm text-slate-500">
                                                    Booked by: {shop.bookerName} • {shop.totalOrders} order{shop.totalOrders !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-black text-red-600">
                                                    PKR {shop.outstandingBalance.toLocaleString()}
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    Total: PKR {shop.totalAmount.toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-red-500 transition-all"
                                                style={{ width: `${Math.min((shop.outstandingBalance / shop.totalAmount) * 100, 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            
                            <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-700">Total Outstanding:</span>
                                    <span className="text-2xl font-black text-red-600">
                                        PKR {outstandingData.reduce((sum, shop) => sum + shop.outstandingBalance, 0).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default KPOReturns;
