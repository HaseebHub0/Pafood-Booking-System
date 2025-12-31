import React, { useState, useEffect } from 'react';
import { View, User } from '../types';
import { dataService } from '../dataService';

interface AdminUsersProps {
    onNavigate: (view: View, id?: string) => void;
}

const AdminUsers: React.FC<AdminUsersProps> = ({ onNavigate }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedKPO, setSelectedKPO] = useState<User | null>(null);
    const [kpoDetails, setKpoDetails] = useState<any>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        const loadUsers = async () => {
            try {
                setIsLoading(true);
                setError(null);
                console.log('AdminUsers: Fetching KPOs...');
                const usersData = await dataService.getAllUsers();
                // Filter to show only KPOs
                const kpos = usersData.filter(u => (u.role || '').toLowerCase() === 'kpo');
                console.log('AdminUsers: KPOs fetched:', kpos.length);
                setUsers(kpos);
            } catch (err: any) {
                console.error('AdminUsers: Error loading users:', err);
                setError(err.message || 'Failed to load users');
            } finally {
                setIsLoading(false);
            }
        };
        loadUsers();
    }, []);

    const handleViewKPODetails = async (kpo: User) => {
        setLoadingDetails(true);
        try {
            const details = await dataService.getKPODetails(kpo.id);
            setKpoDetails(details);
        } catch (err: any) {
            console.error('Error loading KPO details:', err);
            setError(err.message || 'Failed to load KPO details');
        } finally {
            setLoadingDetails(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white drop-shadow-sm">KPO Management</h2>
                    <p className="text-slate-500 dark:text-slate-300 text-sm">Manage KPO accounts and view their performance.</p>
                </div>
                <button 
                    onClick={() => onNavigate('ADMIN_ADD_USER')}
                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-black hover:bg-primary/90 hover:scale-105 transition-all shadow-lg shadow-primary/20"
                >
                    <span className="material-symbols-outlined text-[20px]">person_add</span>
                    <span>Add KPO</span>
                </button>
            </div>

            {error && (
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                        Error: {error}
                    </p>
                </div>
            )}

            <div className="rounded-2xl glass-panel overflow-hidden">
                {isLoading ? (
                    <div className="p-12 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </div>
                ) : users.length === 0 ? (
                    <div className="p-12 flex items-center justify-center text-slate-400">
                        <div className="text-center">
                            <span className="material-symbols-outlined text-4xl mb-2">group</span>
                            <p className="text-sm">No KPOs found</p>
                        </div>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                        <thead className="bg-white/5 text-xs uppercase text-slate-700 dark:text-slate-300 backdrop-blur-sm">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Name</th>
                                <th className="px-6 py-4 font-semibold">Email</th>
                                <th className="px-6 py-4 font-semibold">Branch</th>
                                <th className="px-6 py-4 font-semibold">Region</th>
                                <th className="px-6 py-4 font-semibold">Status</th>
                                <th className="px-6 py-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {users.map((u) => (
                                <tr key={u.id} className="hover:bg-white/5 transition-colors cursor-pointer" onClick={() => {
                                    setSelectedKPO(u);
                                    handleViewKPODetails(u);
                                }}>
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{u.name}</td>
                                    <td className="px-6 py-4 text-slate-500">{u.email}</td>
                                    <td className="px-6 py-4">{u.branch || '-'}</td>
                                    <td className="px-6 py-4">{u.region || '-'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${(u as any).status === 'Active' || !(u as any).status ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                            <span className={`h-1.5 w-1.5 rounded-full ${(u as any).status === 'Active' || !(u as any).status ? 'bg-green-400' : 'bg-red-400'} shadow-[0_0_8px_currentColor]`}></span>
                                            {(u as any).status || 'Active'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                        <button 
                                            onClick={() => onNavigate('ADMIN_EDIT_USER', u.id)}
                                            className="text-primary font-medium text-xs hover:underline mr-3 hover:text-primary/80"
                                        >
                                            Edit
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setSelectedKPO(u);
                                                handleViewKPODetails(u);
                                            }}
                                            className="text-primary font-medium text-xs hover:underline mr-3 hover:text-primary/80"
                                        >
                                            Details
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* KPO Details Modal */}
            {selectedKPO && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => {
                    setSelectedKPO(null);
                    setKpoDetails(null);
                }}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="h-16 w-16 rounded-full bg-slate-200 dark:bg-slate-700 bg-cover bg-center border-2 border-white dark:border-slate-600 shadow-lg" style={{ backgroundImage: `url(${selectedKPO.avatarUrl})` }}></div>
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">{selectedKPO.name}</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{selectedKPO.email}</p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{selectedKPO.branch} • {selectedKPO.region} • KPO</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    setSelectedKPO(null);
                                    setKpoDetails(null);
                                }}
                                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {loadingDetails ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                                </div>
                            ) : kpoDetails ? (
                                <>
                                    {/* Performance Summary */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="glass-panel p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                                            <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase mb-1">Total Orders</p>
                                            <p className="text-2xl font-black text-blue-900 dark:text-blue-100">{kpoDetails.performance.totalOrders || 0}</p>
                                        </div>
                                        <div className="glass-panel p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
                                            <p className="text-xs font-bold text-green-700 dark:text-green-300 uppercase mb-1">Total Sales</p>
                                            <p className="text-2xl font-black text-green-900 dark:text-green-100">Rs. {(kpoDetails.performance.totalSalesAmount || 0).toLocaleString()}</p>
                                        </div>
                                        <div className="glass-panel p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800">
                                            <p className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase mb-1">Bookers</p>
                                            <p className="text-2xl font-black text-purple-900 dark:text-purple-100">{kpoDetails.performance.totalBookers || 0}</p>
                                        </div>
                                        <div className="glass-panel p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800">
                                            <p className="text-xs font-bold text-orange-700 dark:text-orange-300 uppercase mb-1">Salesmen</p>
                                            <p className="text-2xl font-black text-orange-900 dark:text-orange-100">{kpoDetails.performance.totalSalesmen || 0}</p>
                                        </div>
                                    </div>

                                    {/* Recent Activities */}
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Recent Activities</h3>
                                        {kpoDetails.recentActivities.length > 0 ? (
                                            <div className="space-y-2">
                                                {kpoDetails.recentActivities.map((activity: any, idx: number) => (
                                                    <div key={idx} className="glass-panel p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                                                                activity.type === 'order' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-green-50 dark:bg-green-900/20'
                                                            }`}>
                                                                <span className={`material-symbols-outlined text-[20px] ${
                                                                    activity.type === 'order' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'
                                                                }`}>
                                                                    {activity.type === 'order' ? 'receipt_long' : 'local_shipping'}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-900 dark:text-white">{activity.shopName || 'Unknown Shop'}</p>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400">{activity.orderNumber}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="font-bold text-slate-900 dark:text-white">Rs. {activity.amount.toLocaleString()}</p>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                {activity.date?.toDate ? new Date(activity.date.toDate()).toLocaleDateString() : 
                                                                 activity.date ? new Date(activity.date).toLocaleDateString() : 'N/A'}
                                                            </p>
                                                            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                activity.status === 'delivered' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' :
                                                                activity.status === 'submitted' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400' :
                                                                'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                                            }`}>
                                                                {activity.status.toUpperCase()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                                                <span className="material-symbols-outlined text-4xl mb-2 opacity-20">inbox</span>
                                                <p>No recent activities</p>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                                    <p>Failed to load details</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminUsers;