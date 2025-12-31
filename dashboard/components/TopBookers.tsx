import React from 'react';
import { TopBooker } from '../types';

interface TopBookersProps {
    topBookers: TopBooker[];
    isLoading?: boolean;
}

const TopBookers: React.FC<TopBookersProps> = ({ topBookers, isLoading = false }) => {
    if (isLoading) {
        return (
            <div className="lg:col-span-1 flex flex-col gap-6">
                <div className="rounded-xl bg-white dark:bg-surface-dark p-6 border border-slate-100 dark:border-slate-800 flex-1">
                    <div className="flex items-center justify-between mb-4">
                        <div className="h-6 bg-slate-200 rounded w-24 animate-pulse"></div>
                        <div className="h-4 bg-slate-200 rounded w-16 animate-pulse"></div>
                    </div>
                    <div className="space-y-4">
                        {Array.from({ length: 5 }).map((_, idx) => (
                            <div key={idx} className="flex items-center gap-3 animate-pulse">
                                <div className="size-10 rounded-full bg-slate-200"></div>
                                <div className="flex-1 min-w-0">
                                    <div className="h-4 bg-slate-200 rounded w-24 mb-2"></div>
                                    <div className="h-3 bg-slate-200 rounded w-16"></div>
                                </div>
                                <div className="h-4 bg-slate-200 rounded w-12"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!topBookers || topBookers.length === 0) {
        return (
            <div className="lg:col-span-1 flex flex-col gap-6">
                <div className="rounded-xl bg-white dark:bg-surface-dark p-6 border border-slate-100 dark:border-slate-800 flex-1">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Top Bookers</h3>
                        <a className="text-xs font-bold text-primary hover:text-primary/80" href="#">View All</a>
                    </div>
                    <div className="flex items-center justify-center h-32 text-slate-400">
                        <div className="text-center">
                            <span className="material-symbols-outlined text-4xl mb-2">person</span>
                            <p className="text-sm">No booker data available</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="rounded-xl bg-white dark:bg-surface-dark p-6 border border-slate-100 dark:border-slate-800 flex-1">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Top Bookers</h3>
                    <a className="text-xs font-bold text-primary hover:text-primary/80" href="#">View All</a>
                </div>
                <div className="space-y-4">
                    {topBookers.map((booker, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                            <div 
                                className="relative size-10 rounded-full bg-slate-200 dark:bg-slate-700 bg-cover bg-center"
                                style={{ backgroundImage: `url("${booker.avatarUrl}")` }}
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{booker.name}</p>
                                <p className="text-xs text-slate-500 truncate">{booker.orders} orders</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-primary">PKR {booker.amount}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TopBookers;