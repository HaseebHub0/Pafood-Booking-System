import React from 'react';
import StatCard from './StatCard';
import SalesChart from './SalesChart';
import RegionTopProducts from './RegionTopProducts';
import { useDashboardData } from '../hooks/useDashboardData';
import { formatRelativeTime } from '../utils/dateUtils';

const AdminDashboard: React.FC = () => {
    const { data, isLoading, error, refresh } = useDashboardData();

    return (
        <div className="space-y-3 md:space-y-4">
            {/* Page Title Area */}
            <div className="flex flex-col gap-0.5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white truncate">Admin Overview</h2>
                        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">Global insights into sales and regional performance.</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {data?.lastUpdated && (
                            <span className="text-[10px] text-slate-400 hidden sm:inline whitespace-nowrap">
                                Last updated: {formatRelativeTime(data.lastUpdated)}
                            </span>
                        )}
                        <button
                            onClick={refresh}
                            disabled={isLoading}
                            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                            <span className="material-symbols-outlined text-sm">refresh</span>
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-red-500 text-sm">error</span>
                        <p className="text-xs text-red-800 dark:text-red-200 font-medium flex-1 min-w-0 break-words">{error}</p>
                        <button
                            onClick={refresh}
                            className="ml-2 text-[10px] font-semibold text-red-600 hover:text-red-800 underline flex-shrink-0"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {isLoading ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                        <StatCard key={idx} data={{ label: '', value: '', trend: 0, icon: '', colorClass: '', bgClass: '' }} isLoading={true} />
                    ))
                ) : data?.stats ? (
                    data.stats.map((stat, idx) => (
                        <StatCard key={idx} data={stat} isLoading={isLoading} error={error} />
                    ))
                ) : null}
            </div>

            {/* Regional Sales Performance Chart - Full Width */}
            <div className="grid grid-cols-1 gap-3 md:gap-4">
                <SalesChart 
                    regionalData={data?.regionalSales || []} 
                    isLoading={isLoading}
                />
            </div>

            {/* Secondary Grid: Top Products (Expanded to full width) */}
            <div className="grid grid-cols-1 gap-3 md:gap-4">
                <RegionTopProducts 
                    regionalTopSellers={data?.regionalTopSellers || {}}
                    isLoading={isLoading}
                />
            </div>
        </div>
    );
};

export default AdminDashboard;