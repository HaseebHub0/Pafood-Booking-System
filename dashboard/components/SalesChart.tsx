import React, { useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChartData } from '../types';
import { formatCurrency } from '../utils/dateUtils';
import BranchPerformanceModal from './BranchPerformanceModal';

// Chart animations CSS
const chartAnimations = `
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.chart-container {
    animation: fadeInUp 0.5s ease-out;
}
`;

const CustomCursor = (props: any) => {
    const { x, y, width, height } = props;
    return (
      <rect x={x} y={y} width={width} height={height} fill="rgba(215, 25, 32, 0.05)" rx={8} />
    );
};

interface SalesChartProps {
    regionalData: ChartData[];
    isLoading?: boolean;
}

const SalesChart: React.FC<SalesChartProps> = ({ regionalData, isLoading = false }) => {
    const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [showBranchPerformance, setShowBranchPerformance] = useState(false);

    if (isLoading) {
        return (
            <div className="rounded-lg bg-white p-3 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div className="h-4 bg-slate-200 rounded w-28 animate-pulse"></div>
                    <div className="h-5 w-5 bg-slate-200 rounded animate-pulse"></div>
                </div>
                <div className="h-56 w-full bg-slate-100 rounded animate-pulse"></div>
            </div>
        );
    }

    if (!regionalData || regionalData.length === 0) {
        return (
            <div className="rounded-lg bg-white p-3 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-slate-900 truncate">Regional Sales Performance</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">Sales by region (delivered orders only)</p>
                    </div>
                    <div className="relative">
                        <button 
                            onClick={() => setShowMenu(!showMenu)}
                            className="p-1 text-slate-500 hover:text-primary transition-colors flex-shrink-0 ml-2"
                        >
                            <span className="material-symbols-outlined text-base">more_horiz</span>
                        </button>
                        {showMenu && (
                            <>
                                <div 
                                    className="fixed inset-0 z-10" 
                                    onClick={() => setShowMenu(false)}
                                ></div>
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 z-20 overflow-hidden">
                                    <button
                                        onClick={() => {
                                            setShowBranchPerformance(true);
                                            setShowMenu(false);
                                        }}
                                        className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">store</span>
                                        Branch-wise Performance
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <div className="h-56 w-full flex items-center justify-center text-slate-400">
                    <div className="text-center">
                        <span className="material-symbols-outlined text-2xl mb-1.5">bar_chart</span>
                        <p className="text-xs">No sales data available</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">No delivered orders found for the current period</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <style>{chartAnimations}</style>
            <div className="rounded-lg bg-white p-3 border border-slate-100 shadow-sm chart-container">
            <div className="flex items-center justify-between mb-3">
                <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-slate-900 truncate">Regional Sales Performance</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Sales by region (delivered orders only)</p>
                </div>
                <div className="relative flex-shrink-0 ml-2">
                    <button 
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-1 text-slate-500 hover:text-primary transition-colors"
                    >
                        <span className="material-symbols-outlined text-base">more_horiz</span>
                    </button>
                    {showMenu && (
                        <>
                            <div 
                                className="fixed inset-0 z-10" 
                                onClick={() => setShowMenu(false)}
                            ></div>
                            <div className="absolute right-0 top-full mt-1.5 w-40 bg-white rounded-lg shadow-xl border border-slate-200 z-20 overflow-hidden">
                                <button
                                    onClick={() => {
                                        setShowBranchPerformance(true);
                                        setShowMenu(false);
                                    }}
                                    className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
                                >
                                    <span className="material-symbols-outlined text-sm">store</span>
                                    <span className="truncate">Branch-wise Performance</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
            
            <div className="h-56 w-full overflow-x-auto">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                        data={regionalData} 
                        barSize={40} 
                        margin={{ top: 15, right: 20, left: 15, bottom: 50 }}
                        onMouseMove={(state: any) => {
                            if (state.isTooltipActive) {
                              setActiveIndex(state.activeTooltipIndex);
                            } else {
                              setActiveIndex(null);
                            }
                        }}
                        onMouseLeave={() => setActiveIndex(null)}
                    >
                        <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
                            dy={8}
                            angle={-45}
                            textAnchor="end"
                            height={75}
                        />
                        <Tooltip 
                            cursor={<CustomCursor />}
                            contentStyle={{ 
                                backgroundColor: '#ffffff', 
                                border: '1px solid #e2e8f0', 
                                borderRadius: '8px',
                                color: '#1e293b',
                                boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)',
                                transition: 'all 0.2s ease',
                                fontSize: '11px',
                                padding: '6px 8px'
                            }}
                            animationDuration={200}
                            formatter={(value: number) => formatCurrency(value)}
                            itemStyle={{ color: '#D71920', fontWeight: 'bold', fontSize: '11px' }}
                        />
                        <Bar 
                            dataKey="value" 
                            radius={[8, 8, 0, 0]}
                            isAnimationActive={true}
                            animationBegin={0}
                            animationDuration={800}
                            animationEasing="ease-out"
                        >
                            {regionalData.map((entry, index) => (
                                <Cell 
                                    key={`cell-${index}`} 
                                    fill={activeIndex === index ? '#D71920' : '#fee2e2'} 
                                    className="transition-all duration-300 cursor-pointer"
                                    style={{ 
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        transform: activeIndex === index ? 'scaleY(1.05)' : 'scaleY(1)',
                                        transformOrigin: 'bottom'
                                    }}
                                    onMouseEnter={() => setActiveIndex(index)}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            
            {showBranchPerformance && (
                <BranchPerformanceModal 
                    onClose={() => setShowBranchPerformance(false)}
                />
            )}
        </div>
        </>
    );
};

export default SalesChart;