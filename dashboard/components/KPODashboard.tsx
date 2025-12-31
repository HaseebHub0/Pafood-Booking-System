
import React from 'react';
import StatCard from './StatCard';
import { useKPODashboardData } from '../hooks/useKPODashboardData';
import { User } from '../types';
import { formatCurrency } from '../utils/dateUtils';

interface KPODashboardProps {
    user: User;
}

const KPODashboard: React.FC<KPODashboardProps> = ({ user }) => {
    const { data, isLoading, error, refresh } = useKPODashboardData(user);

    // Prepare stat cards data (5 stats)
    const statsData = data ? [
        {
            label: "Total Branch Sales",
            value: formatCurrency(data.stats.totalBranchSales),
            trend: 0,
            icon: "attach_money",
            colorClass: "text-green-600",
            bgClass: "bg-green-500/20"
        },
        {
            label: "Total Returns",
            value: formatCurrency(data.stats.totalReturns),
            trend: 0,
            icon: "keyboard_return",
            colorClass: "text-orange-600",
            bgClass: "bg-orange-500/20"
        },
        {
            label: "Net Cash (Ledger)",
            value: formatCurrency(data.stats.netCash),
            trend: 0,
            icon: "payments",
            colorClass: "text-blue-600",
            bgClass: "bg-blue-500/20"
        },
        {
            label: "Total Orders",
            value: data.stats.totalOrders.toString(),
            trend: 0,
            icon: "receipt_long",
            colorClass: "text-primary",
            bgClass: "bg-primary/20"
        },
        {
            label: "Pending Approval",
            value: data.stats.pendingApproval.toString(),
            trend: 0,
            icon: "hourglass_top",
            colorClass: "text-orange-500",
            bgClass: "bg-orange-500/20"
        },
        {
            label: "Total Credits Outstanding",
            value: formatCurrency(data.creditsSummary?.totalCredits || 0),
            trend: 0,
            icon: "account_balance_wallet",
            colorClass: "text-red-600",
            bgClass: "bg-red-500/20"
        }
    ] : [];

    if (error) {
        return (
            <div className="space-y-8">
                <div className="flex flex-col gap-1">
                    <h2 className="text-3xl font-black tracking-tight text-slate-900">Branch Brain Center</h2>
                    <p className="text-slate-500">Operational control and performance tracking for your distribution unit.</p>
                </div>
                <div className="rounded-xl bg-red-50 p-6 border border-red-200">
                    <p className="text-red-800 font-medium">Error: {error}</p>
                    <button 
                        onClick={refresh}
                        className="mt-4 px-4 py-2 rounded-lg bg-primary text-white font-bold hover:bg-red-700 transition-all"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3 md:space-y-4">
            <div className="flex flex-col gap-0.5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 truncate">Branch Brain Center</h2>
                        <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Operational control and performance tracking for your distribution unit.</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-primary text-white border border-primary/20 whitespace-nowrap">
                            {user.branch} Manager
                        </span>
                        {data?.lastUpdated && (
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                Updated {new Date(data.lastUpdated).toLocaleTimeString()}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {isLoading ? (
                    Array.from({ length: 6 }).map((_, idx) => (
                        <StatCard key={idx} data={{ label: '', value: '', trend: 0, icon: '', colorClass: '', bgClass: '' }} isLoading={true} />
                    ))
                ) : (
                    statsData.map((stat, idx) => (
                        <StatCard key={idx} data={stat} isLoading={isLoading} error={error} />
                    ))
                )}
            </div>

            {/* Credits Summary Section */}
            {data?.creditsSummary && data.creditsSummary.totalCredits > 0 && (
                <div className="rounded-xl md:rounded-2xl bg-white p-4 md:p-6 border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                            <span className="material-symbols-outlined text-red-600 text-[20px] md:text-[24px]">account_balance_wallet</span>
                            Credits by Booker
                        </h3>
                        <a href="#credits" className="text-xs font-bold text-primary hover:underline">View Details</a>
                    </div>
                    <div className="space-y-3">
                        {data.creditsSummary.bookerSummaries.slice(0, 5).map((booker) => (
                            <div key={booker.bookerId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">{booker.bookerName}</p>
                                    <p className="text-xs text-gray-500">{booker.billCount} credit bill{booker.billCount !== 1 ? 's' : ''}</p>
                                </div>
                                <p className="text-sm font-bold text-red-600">{formatCurrency(booker.totalCredit)}</p>
                            </div>
                        ))}
                        {data.creditsSummary.bookerSummaries.length === 0 && (
                            <p className="text-center py-4 text-gray-400 text-sm">No outstanding credits</p>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                <div className="lg:col-span-2 space-y-4 md:space-y-6">
                    {/* Live Sales Performance */}
                    <div className="rounded-xl md:rounded-2xl bg-white p-4 md:p-6 border border-slate-100 shadow-sm">
                        <h3 className="text-base md:text-lg font-bold text-slate-900 mb-4 md:mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-[20px] md:text-[24px]">analytics</span>
                            <span className="hidden sm:inline">Live Sales Performance</span>
                            <span className="sm:hidden">Sales Performance</span>
                        </h3>
                        {isLoading ? (
                            <div className="space-y-6">
                                {Array.from({ length: 3 }).map((_, idx) => (
                                    <div key={idx} className="space-y-2 animate-pulse">
                                        <div className="h-4 bg-slate-200 rounded w-32"></div>
                                        <div className="h-2 bg-slate-100 rounded-full"></div>
                                    </div>
                                ))}
                            </div>
                        ) : data?.salesPerformance && data.salesPerformance.length > 0 ? (
                            <div className="space-y-6">
                                {data.salesPerformance.map(perf => (
                                    <div key={perf.bookerId} className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-sm font-bold text-slate-900">{perf.bookerName}</p>
                                                <p className="text-xs text-slate-500">
                                                    Target: {perf.targetCount} orders • Achieved: {perf.achievedCount} orders
                                                </p>
                                            </div>
                                            <p className="text-sm font-black text-primary">
                                                {perf.progressPercent !== null ? `${perf.progressPercent}%` : '—'}
                                            </p>
                                        </div>
                                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                                            {perf.progressPercent !== null ? (
                                                <div 
                                                    className="h-full bg-primary transition-all duration-1000" 
                                                    style={{ width: `${Math.min(perf.progressPercent, 100)}%` }}
                                                ></div>
                                            ) : (
                                                <div className="h-full bg-slate-200"></div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-slate-400">
                                <p>No sales performance data available</p>
                            </div>
                        )}
                    </div>

                    {/* Recent Branch Activity */}
                    <div className="rounded-xl md:rounded-2xl bg-white p-4 md:p-6 border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-3 md:mb-4">
                            <h3 className="text-base md:text-lg font-bold text-slate-900">Recent Branch Activity</h3>
                            <button className="text-[10px] md:text-xs font-bold text-primary">View Ledger</button>
                        </div>
                        {isLoading ? (
                            <div className="space-y-2">
                                {Array.from({ length: 5 }).map((_, idx) => (
                                    <div key={idx} className="h-8 bg-slate-100 rounded animate-pulse"></div>
                                ))}
                            </div>
                        ) : data?.recentActivity && data.recentActivity.length > 0 ? (
                            <div className="overflow-x-auto -mx-3 md:mx-0">
                                <div className="min-w-full px-3 md:px-0">
                                    {/* Mobile Card View */}
                                    <div className="md:hidden space-y-2">
                                        {data.recentActivity.map(activity => {
                                            const typeColors = {
                                                'Booking': 'bg-blue-50 text-blue-600',
                                                'Payment': 'bg-green-50 text-green-600',
                                                'Return': 'bg-orange-50 text-orange-600',
                                                'Adjustment': 'bg-purple-50 text-purple-600'
                                            };
                                            const colorClass = typeColors[activity.type as keyof typeof typeColors] || 'bg-slate-50 text-slate-600';
                                            return (
                                                <div key={activity.id} className="p-2 rounded-md bg-slate-50 border border-slate-100">
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <span className={`px-1.5 py-0.5 rounded-full ${colorClass} text-[9px] font-semibold`}>
                                                            {activity.type}
                                                        </span>
                                                        <span className="text-xs font-bold whitespace-nowrap ml-2">{formatCurrency(activity.amount)}</span>
                                                    </div>
                                                    <p className="text-xs font-semibold text-slate-900 mb-0.5 truncate">{activity.entity}</p>
                                                    <p className="text-[9px] text-slate-500 font-mono">{activity.time}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {/* Desktop Table View */}
                                    <table className="hidden md:table w-full text-xs">
                                    <thead className="text-[9px] uppercase font-bold text-slate-400">
                                        <tr>
                                            <th className="py-2 px-2 text-left">Time</th>
                                            <th className="py-2 px-2 text-left">Type</th>
                                            <th className="py-2 px-2 text-left">Entity</th>
                                            <th className="py-2 px-2 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {data.recentActivity.map(activity => {
                                            const typeColors = {
                                                'Booking': 'bg-blue-50 text-blue-600',
                                                'Payment': 'bg-green-50 text-green-600',
                                                'Return': 'bg-orange-50 text-orange-600',
                                                'Adjustment': 'bg-purple-50 text-purple-600'
                                            };
                                            const colorClass = typeColors[activity.type as keyof typeof typeColors] || 'bg-slate-50 text-slate-600';
                                            return (
                                                <tr key={activity.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="py-2 px-2 text-slate-500 font-mono text-[10px] whitespace-nowrap">{activity.time}</td>
                                                    <td className="py-2 px-2">
                                                        <span className={`px-1.5 py-0.5 rounded-full ${colorClass} text-[9px] font-semibold`}>
                                                            {activity.type}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-2 font-semibold text-xs truncate max-w-[200px]">{activity.entity}</td>
                                                    <td className="py-2 px-2 text-right font-bold text-xs whitespace-nowrap">{formatCurrency(activity.amount)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-6 text-slate-400">
                                <p className="text-xs">No recent activity</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-3 md:space-y-4">
                    {/* Active Staff On-Field */}
                    <div className="rounded-lg bg-white p-3 border border-slate-100 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-900 mb-3">Active Staff On-Field</h3>
                        {isLoading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 3 }).map((_, idx) => (
                                    <div key={idx} className="flex items-center gap-2.5 animate-pulse">
                                        <div className="size-8 rounded-full bg-slate-200"></div>
                                        <div className="flex-1">
                                            <div className="h-2.5 bg-slate-200 rounded w-20 mb-1"></div>
                                            <div className="h-2 bg-slate-100 rounded w-14"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : data?.activeStaff && data.activeStaff.length > 0 ? (
                            <div className="space-y-2.5">
                                {data.activeStaff.map(staff => (
                                    <div key={staff.id} className="flex items-center gap-2.5">
                                        <div 
                                            className="size-8 rounded-full bg-slate-200 bg-cover bg-center border-2 border-white shadow-sm flex-shrink-0" 
                                            style={{ backgroundImage: staff.avatarUrl ? `url(${staff.avatarUrl})` : undefined }}
                                        ></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-slate-900 truncate">{staff.name}</p>
                                            <p className="text-[10px] text-slate-400 truncate">{staff.area} Route</p>
                                        </div>
                                        <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0"></div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 text-slate-400">
                                <p className="text-xs">No active staff</p>
                            </div>
                        )}
                    </div>

                    {/* Critical Tasks */}
                    <div className="rounded-lg bg-slate-900 p-3 text-white shadow-md">
                        <h4 className="text-sm font-bold mb-3 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-primary text-base">priority_high</span>
                            <span className="truncate">Critical Tasks</span>
                        </h4>
                        {isLoading ? (
                            <div className="space-y-2">
                                {Array.from({ length: 3 }).map((_, idx) => (
                                    <div key={idx} className="h-10 bg-white/5 rounded-lg animate-pulse"></div>
                                ))}
                            </div>
                        ) : data?.criticalTasks ? (
                            <div className="space-y-2">
                                {data.criticalTasks.pendingApprovals > 0 && (
                                    <div className="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
                                        <p className="text-xs truncate flex-1">{data.criticalTasks.pendingApprovals} Orders need approval</p>
                                        <span className="material-symbols-outlined text-xs text-primary flex-shrink-0 ml-2">arrow_forward</span>
                                    </div>
                                )}
                                {data.criticalTasks.pendingLoadForms > 0 && (
                                    <div className="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
                                        <p className="text-xs truncate flex-1">{data.criticalTasks.pendingLoadForms} Load sheets pending</p>
                                        <span className="material-symbols-outlined text-xs text-primary flex-shrink-0 ml-2">arrow_forward</span>
                                    </div>
                                )}
                                {data.criticalTasks.stockMismatches > 0 && (
                                    <div className="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
                                        <p className="text-xs truncate flex-1">{data.criticalTasks.stockMismatches} Stock mismatches</p>
                                        <span className="material-symbols-outlined text-xs text-primary flex-shrink-0 ml-2">arrow_forward</span>
                                    </div>
                                )}
                                {data.criticalTasks.pendingApprovals === 0 && 
                                 data.criticalTasks.pendingLoadForms === 0 && 
                                 data.criticalTasks.stockMismatches === 0 && (
                                    <div className="text-center py-3 text-slate-400">
                                        <p className="text-xs">All tasks completed</p>
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KPODashboard;
