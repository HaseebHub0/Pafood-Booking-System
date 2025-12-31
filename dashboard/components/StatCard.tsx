import React from 'react';
import { StatItem } from '../types';

interface StatCardProps {
    data: StatItem;
    isLoading?: boolean;
    error?: string | null;
}

const StatCard: React.FC<StatCardProps> = ({ data, isLoading = false, error = null }) => {
    if (error) {
        return (
            <div className="group relative overflow-hidden rounded-lg glass-panel p-3 shadow-md border border-red-200">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <div className={`rounded-md p-1.5 backdrop-blur-md ${data.bgClass} ${data.colorClass}`}>
                            <span className="material-symbols-outlined text-base">{data.icon}</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-tight">{data.label}</p>
                        <p className="text-[10px] text-red-500 mt-0.5">Error loading data</p>
                    </div>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="group relative overflow-hidden rounded-lg glass-panel p-3 shadow-md animate-pulse">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <div className="rounded-md p-1.5 bg-slate-200 w-8 h-8"></div>
                        <div className="rounded-full bg-slate-200 w-12 h-4"></div>
                    </div>
                    <div>
                        <div className="h-2.5 bg-slate-200 rounded w-16 mb-1.5"></div>
                        <div className="h-5 bg-slate-200 rounded w-20"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="group relative overflow-hidden rounded-lg glass-panel p-3 shadow-md transition-all hover:shadow-lg hover:border-primary/30">
            {/* Glossy gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
            
            <div className="relative z-10 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div className={`rounded-md p-1.5 backdrop-blur-md ${data.bgClass} ${data.colorClass}`}>
                        <span className="material-symbols-outlined text-base">{data.icon}</span>
                    </div>
                    {data.trend !== 0 && (
                        <span className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold backdrop-blur-md border ${
                            data.trend > 0 
                                ? "bg-green-500/10 text-green-400 border-green-500/20" 
                                : "bg-red-500/10 text-red-400 border-red-500/20"
                        }`}>
                            <span className="material-symbols-outlined text-[10px]">
                                {data.trend > 0 ? "trending_up" : "trending_down"}
                            </span>
                            {Math.abs(data.trend)}%
                        </span>
                    )}
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-tight truncate">{data.label}</p>
                    {data.type === 'split' && data.splitValues ? (
                        <div className="flex items-end gap-1 mt-0.5">
                            <p className="text-lg font-bold text-slate-900 dark:text-white drop-shadow-sm leading-none">{data.splitValues.left}</p>
                            <span className="text-[10px] text-slate-400 mb-0.5">/</span>
                            <p className="text-sm font-semibold text-slate-400 mb-0.5 leading-none">{data.splitValues.right}</p>
                        </div>
                    ) : (
                        <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 drop-shadow-sm break-words leading-tight">{data.value}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StatCard;