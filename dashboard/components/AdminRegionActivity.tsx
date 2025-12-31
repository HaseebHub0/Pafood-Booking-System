import React from 'react';
import { View } from '../types';
import { TRANSACTIONS, MOCK_STAFF_LIST } from '../constants';
import StatCard from './StatCard';

interface AdminRegionActivityProps {
    onNavigate: (view: View) => void;
    regionName: string;
}

const AdminRegionActivity: React.FC<AdminRegionActivityProps> = ({ onNavigate, regionName }) => {
    // Filter data for region
    const filteredTrx = TRANSACTIONS.filter(t => t.region === regionName);
    const regionStaff = MOCK_STAFF_LIST.filter(s => s.region === regionName);
    
    // Mock Stats for specific region
    const regionStats = [
        { label: "Today's Sales", value: "PKR 245k", trend: 12, icon: "payments", colorClass: "text-primary", bgClass: "bg-primary/20" },
        { label: "Active Routes", value: "8/12", trend: 0, icon: "local_shipping", colorClass: "text-blue-500", bgClass: "bg-blue-500/20" },
        { label: "Pending Orders", value: "15", trend: -5, icon: "receipt_long", colorClass: "text-orange-500", bgClass: "bg-orange-500/20" },
        { label: "Booker Visits", value: "85%", trend: 4, icon: "person_pin_circle", colorClass: "text-green-500", bgClass: "bg-green-500/20" },
    ];

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => onNavigate('ADMIN_REGIONS')}
                    className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div className="flex flex-col">
                    <h2 className="text-3xl font-black tracking-tight text-slate-900">{regionName} Activity</h2>
                    <p className="text-slate-500 text-sm">Real-time operational dashboard.</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {regionStats.map((stat, idx) => (
                    <StatCard key={idx} data={stat} />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Staff On Duty - Now takes more space since map is removed */}
                <div className="lg:col-span-3 glass-panel p-6 rounded-xl bg-white flex flex-col min-h-[300px]">
                    <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">engineering</span>
                        Staff on Duty - {regionName}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {regionStaff.length === 0 && <p className="text-slate-400 text-sm col-span-full py-10 text-center">No staff found for this region.</p>}
                        {regionStaff.map((staff) => (
                            <div key={staff.id} className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 border border-slate-100 transition-all shadow-sm">
                                <div className="h-12 w-12 rounded-full bg-slate-200 bg-cover bg-center border-2 border-white shadow-sm" style={{ backgroundImage: `url(${staff.avatarUrl})` }}></div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-900 truncate">{staff.name}</p>
                                    <p className="text-xs text-slate-500">{staff.role} • {staff.area}</p>
                                </div>
                                <div className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Region Transactions */}
            <div className="rounded-xl glass-panel bg-white overflow-hidden shadow-sm border border-slate-100">
                <div className="p-6 border-b border-slate-100 bg-slate-50/30">
                    <h3 className="font-bold text-slate-900">Recent Transactions in {regionName}</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-500">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-700">
                            <tr>
                                <th className="px-6 py-4">ID</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Salesman</th>
                                <th className="px-6 py-4">Amount</th>
                                <th className="px-6 py-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredTrx.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">No transactions found for this region.</td></tr>
                            ) : filteredTrx.map((trx) => (
                                <tr key={trx.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-900">{trx.id}</td>
                                    <td className="px-6 py-4">{trx.date}</td>
                                    <td className="px-6 py-4">{trx.salesman.name}</td>
                                    <td className="px-6 py-4 font-bold text-slate-900">{trx.amount}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                                            trx.status === 'Completed' ? "bg-green-100 text-green-700" :
                                            trx.status === 'Pending' ? "bg-yellow-100 text-yellow-700" :
                                            "bg-red-100 text-red-700"
                                        }`}>
                                            {trx.status}
                                        </span>
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

export default AdminRegionActivity;