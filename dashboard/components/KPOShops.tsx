import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { dataService } from '../dataService';

interface KPOShopsProps {
    user: User;
}

interface ShopLedgerSummary {
    currentBalance: number;
    creditLimit: number;
    recentTransactionsCount: number;
    totalOrdersCount: number;
    paymentStatus: 'paid' | 'partial' | 'pending';
}

const KPOShops: React.FC<KPOShopsProps> = ({ user }) => {
    const [activeTab, setActiveTab] = useState<'shops' | 'editRequests'>('shops');
    const [shops, setShops] = useState<any[]>([]);
    const [bookers, setBookers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedBookerId, setSelectedBookerId] = useState<string>('All');
    const [ledgerSummaries, setLedgerSummaries] = useState<Record<string, ShopLedgerSummary>>({});
    const [loadingLedgers, setLoadingLedgers] = useState<Record<string, boolean>>({});
    const [editRequests, setEditRequests] = useState<any[]>([]);
    const [loadingRequests, setLoadingRequests] = useState(false);
    const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

    // Load real data from Firebase
    useEffect(() => {
        const loadData = async () => {
            if (!user.branch) {
                console.error('KPOShops: No branch assigned to KPO user');
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                console.log('KPOShops: Loading data for branch:', user.branch);
                
                // Use filtered getAllShops to reduce reads - only get shops for this branch
                const [branchBookers, allShops] = await Promise.all([
                    dataService.getBranchBookers(user.branch),
                    dataService.getAllShops(undefined, user.branch) // Filter by branch
                ]);
                
                console.log('KPOShops: Loaded bookers:', branchBookers.length);
                console.log('KPOShops: Loaded shops for branch:', allShops.length);
                
                // Filter shops by bookers in this branch
                const bookerIds = branchBookers.map(b => b.id);
                const branchShops = allShops.filter(shop => bookerIds.includes(shop.bookerId));
                
                console.log('KPOShops: Shops for this branch:', branchShops.length);
                
                setBookers(branchBookers);
                setShops(branchShops);
                
                // Load ledger summaries for all shops
                const summaries: Record<string, ShopLedgerSummary> = {};
                for (const shop of branchShops) {
                    try {
                        const summary = await dataService.getShopLedgerSummary(shop.id);
                        summaries[shop.id] = summary;
                    } catch (error: any) {
                        console.error(`Error loading ledger for shop ${shop.id}:`, error);
                        summaries[shop.id] = {
                            currentBalance: 0,
                            creditLimit: 0,
                            recentTransactionsCount: 0,
                            totalOrdersCount: 0,
                            paymentStatus: 'paid'
                        };
                    }
                }
                setLedgerSummaries(summaries);
            } catch (error: any) {
                console.error('KPOShops: Error loading data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [user.branch]);

    const filteredShops = shops.filter(shop => {
        const matchesBooker = selectedBookerId === 'All' || shop.bookerId === selectedBookerId;
        return matchesBooker;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-slate-900">Shops Database</h2>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        {user.region} Region
                    </span>
                </div>
                <p className="text-slate-500 text-sm">View and manage shops onboarded by your Order Bookers.</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('shops')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                        activeTab === 'shops' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Shops ({shops.length})
                </button>
                <button
                    onClick={() => setActiveTab('editRequests')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                        activeTab === 'editRequests' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Edit Requests
                    {editRequests.length > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-yellow-500 text-white rounded-full">{editRequests.length}</span>
                    )}
                </button>
            </div>

            {activeTab === 'editRequests' && (
                <div className="space-y-4">
                    {loadingRequests ? (
                        <div className="glass-panel rounded-3xl bg-white p-12 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                        </div>
                    ) : editRequests.length === 0 ? (
                        <div className="glass-panel rounded-3xl bg-white p-12 text-center text-slate-400">
                            <span className="material-symbols-outlined text-4xl mb-2">check_circle</span>
                            <p>No pending shop edit requests</p>
                        </div>
                    ) : (
                        editRequests.map((request: any) => (
                            <div key={request.id} className="glass-panel rounded-xl bg-white border border-slate-200 p-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="px-3 py-1 rounded-lg bg-yellow-100 text-yellow-700 text-xs font-bold">
                                                PENDING
                                            </div>
                                            <span className="font-bold text-slate-900">{request.shopName || 'Unknown Shop'}</span>
                                        </div>
                                        
                                        <div className="mb-4">
                                            <p className="text-xs text-slate-400 font-bold uppercase mb-2">Requested Changes</p>
                                            <div className="space-y-2">
                                                {Object.entries(request.requestedChanges || {}).map(([key, value]: [string, any]) => (
                                                    <div key={key} className="flex items-center gap-4 p-2 rounded-lg bg-slate-50">
                                                        <span className="text-xs font-bold text-slate-600 capitalize w-24">{key}:</span>
                                                        <span className="text-sm text-slate-900 flex-1">{String(value)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        <div className="text-xs text-slate-500">
                                            <p>Requested by: {request.requestedByName || 'Unknown'} • {request.requestedAt ? new Date(request.requestedAt).toLocaleDateString() : 'N/A'}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={() => handleApproveRequest(request.id, request.shopId, request.requestedChanges)}
                                            disabled={processingRequestId === request.id}
                                            className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {processingRequestId === request.id ? 'Processing...' : 'Approve'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                const reason = window.prompt('Enter rejection reason:');
                                                if (reason) {
                                                    handleRejectRequest(request.id, reason);
                                                }
                                            }}
                                            disabled={processingRequestId === request.id}
                                            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'shops' && (
                <>
                    {/* Controls Bar */}
                    <div className="glass-panel p-4 rounded-xl flex items-center bg-white">
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <span className="text-sm font-bold text-slate-700 whitespace-nowrap">Filter by Booker:</span>
                            <select 
                                value={selectedBookerId} 
                                onChange={(e) => setSelectedBookerId(e.target.value)}
                                className="rounded-lg border-slate-200 text-sm py-2 pl-3 pr-8 focus:ring-primary focus:border-primary bg-slate-50 min-w-[200px]"
                            >
                                <option value="All">All Bookers ({bookers.length})</option>
                                {bookers.map(booker => (
                                    <option key={booker.id} value={booker.id}>{booker.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

            {/* Shops Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading && (
                    <div className="col-span-full py-12 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                        <p className="mt-4 text-slate-400">Loading shops...</p>
                    </div>
                )}
                {!isLoading && filteredShops.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        No shops found matching your filters.
                        {bookers.length === 0 && <p className="mt-2 text-xs">No bookers found in this branch.</p>}
                    </div>
                )}
                {!isLoading && filteredShops.map(shop => {
                    const booker = bookers.find(b => b.id === shop.bookerId);
                    return (
                        <div key={shop.id} className="glass-panel p-5 rounded-2xl bg-white relative group hover:border-primary/30 transition-all flex flex-col gap-4">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200">
                                        <span className="material-symbols-outlined">storefront</span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 leading-tight">{shop.shopName || shop.name}</h3>
                                        <p className="text-xs text-slate-500">{shop.area}</p>
                                    </div>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                    (shop.status === 'Active' || shop.isActive) 
                                    ? 'bg-green-50 text-green-600 border-green-200' 
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}>
                                    {shop.isActive ? 'Active' : (shop.status || 'Inactive')}
                                </span>
                            </div>

                            <div className="space-y-2 text-sm text-slate-600">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[16px] text-slate-400">person</span>
                                    <span>{shop.ownerName}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[16px] text-slate-400">call</span>
                                    <span>{shop.contact}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[16px] text-slate-400">location_on</span>
                                    <span className="truncate">{shop.address}</span>
                                </div>
                            </div>

                            {/* Ledger Summary */}
                            {ledgerSummaries[shop.id] && (
                                <div className="pt-3 border-t border-slate-100 space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-500">Current Balance:</span>
                                        <span className={`font-bold ${
                                            ledgerSummaries[shop.id].currentBalance > 0 
                                                ? 'text-orange-600' 
                                                : 'text-green-600'
                                        }`}>
                                            Rs. {ledgerSummaries[shop.id].currentBalance.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-500">Credit Limit:</span>
                                        <span className="font-medium text-slate-700">
                                            Rs. {ledgerSummaries[shop.id].creditLimit.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-500">Orders:</span>
                                        <span className="font-medium text-slate-700">
                                            {ledgerSummaries[shop.id].totalOrdersCount} total
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-500">Recent (30d):</span>
                                        <span className="font-medium text-slate-700">
                                            {ledgerSummaries[shop.id].recentTransactionsCount} transactions
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs pt-1">
                                        <span className="text-slate-500">Payment Status:</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            ledgerSummaries[shop.id].paymentStatus === 'paid'
                                                ? 'bg-green-50 text-green-600'
                                                : ledgerSummaries[shop.id].paymentStatus === 'partial'
                                                ? 'bg-yellow-50 text-yellow-600'
                                                : 'bg-red-50 text-red-600'
                                        }`}>
                                            {ledgerSummaries[shop.id].paymentStatus.toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                            )}
                            
                            <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                                <span className="text-slate-400">Onboarded By:</span>
                                <div className="flex items-center gap-1 font-medium text-slate-700">
                                    {booker ? (
                                        <>
                                            <div className="w-4 h-4 rounded-full bg-slate-200 bg-cover bg-center" style={{ backgroundImage: `url(${booker.avatarUrl})` }}></div>
                                            {booker.name}
                                        </>
                                    ) : (
                                        <span className="text-slate-400">Unknown Booker</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
                </>
            )}
        </div>
    );
};

export default KPOShops;