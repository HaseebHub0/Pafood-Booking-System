import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { dataService } from '../dataService';
import { formatCurrency, getCurrentPeriod } from '../utils/dateUtils';

// Chart animations CSS
const chartAnimations = `
@keyframes fadeInZoom {
    from {
        opacity: 0;
        transform: scale(0.95);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}

.chart-animated {
    animation: fadeInZoom 0.5s ease-out;
}
`;

interface BranchPerformanceModalProps {
    onClose: () => void;
}

interface BranchData {
    branchId: string;
    branchName: string;
    sales: number;
}

const CustomCursor = (props: any) => {
    const { x, y, width, height } = props;
    return (
      <rect x={x} y={y} width={width} height={height} fill="rgba(215, 25, 32, 0.05)" rx={8} />
    );
};

const BranchPerformanceModal: React.FC<BranchPerformanceModalProps> = ({ onClose }) => {
    const [branchData, setBranchData] = useState<BranchData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [selectedRegion, setSelectedRegion] = useState<string>('all');
    const [regions, setRegions] = useState<any[]>([]);

    useEffect(() => {
        const loadRegions = async () => {
            try {
                const regionsData = await dataService.getRegions();
                console.log('BranchPerformanceModal: Loaded regions:', regionsData);
                setRegions(regionsData);
            } catch (err: any) {
                console.error('Error loading regions:', err);
                setError('Failed to load regions');
            }
        };
        loadRegions();
    }, []);

    useEffect(() => {
        const loadBranchPerformance = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const dateRange = getCurrentPeriod();
                console.log('BranchPerformanceModal: Loading branch performance for region:', selectedRegion === 'all' ? 'all' : selectedRegion);
                console.log('BranchPerformanceModal: Date range:', dateRange);
                const data = await dataService.getBranchSalesPerformance(
                    dateRange,
                    selectedRegion === 'all' ? undefined : selectedRegion
                );
                console.log('BranchPerformanceModal: Loaded branch data:', data);
                console.log('BranchPerformanceModal: Number of branches with sales:', data.length);
                if (data.length === 0) {
                    console.warn('BranchPerformanceModal: No branch data returned. Check console for getBranchSalesPerformance logs.');
                }
                setBranchData(data);
            } catch (err: any) {
                console.error('Error loading branch performance:', err);
                setError(err.message || 'Failed to load branch performance data');
            } finally {
                setIsLoading(false);
            }
        };
        loadBranchPerformance();
    }, [selectedRegion]);

    const chartData = branchData.map(branch => ({
        name: branch.branchName.length > 15 ? branch.branchName.substring(0, 15) + '...' : branch.branchName,
        fullName: branch.branchName,
        value: branch.sales
    }));

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900">Branch-wise Sales Performance</h2>
                        <p className="text-sm text-slate-500 mt-1">Sales by branch (delivered orders only)</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Filter */}
                <div className="p-4 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-slate-700">Filter by Region:</label>
                        <select
                            value={selectedRegion}
                            onChange={(e) => {
                                console.log('BranchPerformanceModal: Region changed to:', e.target.value);
                                setSelectedRegion(e.target.value);
                            }}
                            className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-w-[200px]"
                            >
                            <option value="all">All Regions</option>
                            {regions.length === 0 ? (
                                <option disabled>Loading regions...</option>
                            ) : (
                                regions.map((region) => (
                                    <option key={region.id} value={region.id}>
                                        {region.name} ({region.code})
                                    </option>
                                ))
                            )}
                        </select>
                        {regions.length > 0 && (
                            <span className="text-xs text-slate-500">
                                {selectedRegion === 'all' 
                                    ? `${regions.length} regions` 
                                    : `Filtered: ${regions.find(r => r.id === selectedRegion)?.name || 'Unknown'}`
                                }
                            </span>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center">
                                <span className="material-symbols-outlined text-4xl text-red-500 mb-2">error</span>
                                <p className="text-red-600 font-medium">{error}</p>
                            </div>
                        </div>
                    ) : chartData.length === 0 ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center text-slate-400">
                                <span className="material-symbols-outlined text-4xl mb-2">bar_chart</span>
                                <p className="text-sm font-medium mb-1">No branch sales data available</p>
                                <p className="text-xs text-slate-400">
                                    {selectedRegion === 'all' 
                                        ? 'No delivered orders found in the current period for any branch.'
                                        : `No delivered orders found in the current period for branches in this region.`
                                    }
                                </p>
                                <p className="text-xs text-slate-400 mt-2">
                                    Try selecting a different region or check if there are delivered orders in this time period.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="h-96 w-full chart-animated">
                            <style>{chartAnimations}</style>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart 
                                    data={chartData} 
                                    barSize={50} 
                                    margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
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
                                        tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                                        dy={10}
                                        angle={-45}
                                        textAnchor="end"
                                        height={120}
                                    />
                                    <Tooltip 
                                        cursor={<CustomCursor />}
                                        contentStyle={{ 
                                            backgroundColor: '#ffffff', 
                                            border: '1px solid #e2e8f0', 
                                            borderRadius: '12px',
                                            color: '#1e293b',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                            transition: 'all 0.2s ease'
                                        }}
                                        animationDuration={200}
                                        formatter={(value: number) => formatCurrency(value)}
                                        labelFormatter={(label, payload) => {
                                            if (payload && payload[0]) {
                                                return payload[0].payload.fullName;
                                            }
                                            return label;
                                        }}
                                        itemStyle={{ color: '#D71920', fontWeight: 'bold' }}
                                    />
                                    <Bar 
                                        dataKey="value" 
                                        radius={[8, 8, 0, 0]}
                                        isAnimationActive={true}
                                        animationBegin={0}
                                        animationDuration={1000}
                                        animationEasing="ease-out"
                                    >
                                        {chartData.map((entry, index) => (
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
                    )}

                    {/* Summary Table */}
                    {!isLoading && !error && branchData.length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-lg font-bold text-slate-900 mb-4">Summary</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50">
                                            <th className="px-4 py-3 text-left text-xs font-black text-slate-700 uppercase tracking-wider border-b border-slate-200">Branch Name</th>
                                            <th className="px-4 py-3 text-right text-xs font-black text-slate-700 uppercase tracking-wider border-b border-slate-200">Sales Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {branchData.map((branch, index) => (
                                            <tr key={branch.branchId} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3 text-sm font-medium text-slate-900 border-b border-slate-100">
                                                    {branch.branchName}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right border-b border-slate-100">
                                                    {formatCurrency(branch.sales)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-primary/10">
                                            <td className="px-4 py-3 text-sm font-black text-slate-900">Total</td>
                                            <td className="px-4 py-3 text-sm font-black text-primary text-right">
                                                {formatCurrency(branchData.reduce((sum, b) => sum + b.sales, 0))}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BranchPerformanceModal;

