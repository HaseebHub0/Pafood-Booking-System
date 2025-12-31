import React, { useState, useEffect } from 'react';
import { dataService } from '../dataService';
import { Region } from '../types';

// Add CSS animations
const progressBarStyle = `
@keyframes slideInProgress {
    from {
        width: 0%;
    }
}

@keyframes fadeInLeft {
    from {
        opacity: 0;
        transform: translateX(-20px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

.product-item {
    animation: fadeInLeft 0.5s ease-out both;
}
`;

interface RegionTopProductsProps {
    regionalTopSellers: Record<string, Array<{ name: string; sales: number; growth: number }>>;
    isLoading?: boolean;
}

const RegionTopProducts: React.FC<RegionTopProductsProps> = ({ regionalTopSellers, isLoading = false }) => {
    const [regions, setRegions] = useState<Region[]>([]);
    const [activeRegionId, setActiveRegionId] = useState<string | null>(null);

    useEffect(() => {
        const loadRegions = async () => {
            const regionsData = await dataService.getRegions();
            setRegions(regionsData as Region[]);
            // Set first available region as active
            if (regionsData.length > 0 && Object.keys(regionalTopSellers).length > 0) {
                const firstRegionId = Object.keys(regionalTopSellers)[0];
                setActiveRegionId(firstRegionId);
            } else if (regionsData.length > 0) {
                setActiveRegionId(regionsData[0].id);
            }
        };
        loadRegions();
    }, [regionalTopSellers]);

    // Get data for the selected region
    const products = activeRegionId ? (regionalTopSellers[activeRegionId] || []) : [];

    // Find max value for progress bar calculation
    const maxSales = products.length > 0 ? Math.max(...products.map(p => p.sales)) : 0;

    // Get available region IDs that have data
    const availableRegionIds = Object.keys(regionalTopSellers).filter(id => 
        regionalTopSellers[id] && regionalTopSellers[id].length > 0
    );

    if (isLoading) {
        return (
            <div className="rounded-lg bg-white p-3 border border-slate-100 shadow-sm flex flex-col h-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                        <div className="h-4 bg-slate-200 rounded w-28 mb-1.5 animate-pulse"></div>
                        <div className="h-2.5 bg-slate-200 rounded w-36 animate-pulse"></div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                        {Array.from({ length: 4 }).map((_, idx) => (
                            <div key={idx} className="h-6 bg-slate-200 rounded w-14 animate-pulse"></div>
                        ))}
                    </div>
                </div>
                <div className="space-y-2.5">
                    {Array.from({ length: 5 }).map((_, idx) => (
                        <div key={idx} className="flex items-center gap-2.5 animate-pulse">
                            <div className="h-6 w-6 rounded-full bg-slate-200 flex-shrink-0"></div>
                            <div className="flex-1 min-w-0">
                                <div className="h-2.5 bg-slate-200 rounded w-20 mb-1.5"></div>
                                <div className="h-1.5 bg-slate-200 rounded"></div>
                            </div>
                            <div className="h-2.5 bg-slate-200 rounded w-12 flex-shrink-0"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (availableRegionIds.length === 0) {
        return (
            <div className="rounded-lg bg-white p-3 border border-slate-100 shadow-sm flex flex-col h-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-slate-900 truncate">Regional Top Sellers</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">Top 5 performing SKUs by volume (delivered orders only).</p>
                    </div>
                </div>
                <div className="flex items-center justify-center h-40 text-slate-400">
                    <div className="text-center">
                        <span className="material-symbols-outlined text-2xl mb-1.5">inventory_2</span>
                        <p className="text-xs">No product data available</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <style>{progressBarStyle}</style>
            <div className="rounded-lg bg-white p-3 border border-slate-100 shadow-sm flex flex-col h-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-slate-900 truncate">Regional Top Sellers</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Top 5 performing SKUs by volume (delivered orders only).</p>
                </div>
                
                {/* Scrollable Tabs for Regions */}
                <div className="flex gap-1.5 overflow-x-auto pb-1.5 sm:pb-0 no-scrollbar max-w-full flex-shrink-0">
                    {availableRegionIds.map(regionId => {
                        const region = regions.find(r => r.id === regionId);
                        const regionName = region?.name || regionId;
                        return (
                            <button
                                key={regionId}
                                onClick={() => setActiveRegionId(regionId)}
                                className={`px-2 py-1 rounded-md text-[10px] font-semibold whitespace-nowrap transition-all duration-300 ${
                                    activeRegionId === regionId 
                                        ? 'bg-primary text-white shadow-sm shadow-primary/20' 
                                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                }`}
                            >
                                {regionName}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
                {products.length === 0 ? (
                    <div className="flex items-center justify-center h-28 text-slate-400">
                        <p className="text-xs">No products available for this region</p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {products.map((product, index) => (
                            <div 
                                key={index} 
                                className="group flex items-center gap-2.5 product-item"
                                style={{ 
                                    animationDelay: `${index * 100}ms`
                                }}
                            >
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500 group-hover:bg-primary group-hover:text-white transition-all duration-300 flex-shrink-0">
                                    {index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-1 gap-2">
                                        <span className="text-xs font-semibold text-slate-700 truncate group-hover:text-primary transition-colors duration-300">{product.name}</span>
                                        <span className={`text-[10px] font-semibold flex-shrink-0 transition-all duration-300 ${product.growth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {product.growth > 0 ? '+' : ''}{product.growth}%
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                                        <div 
                                            className="h-full rounded-full bg-primary/80 transition-all duration-700 ease-out group-hover:bg-primary" 
                                            style={{ 
                                                width: maxSales > 0 ? `${(product.sales / maxSales) * 100}%` : '0%',
                                                animation: `slideInProgress 0.7s ease-out ${index * 100}ms both`
                                            }}
                                        ></div>
                                    </div>
                                </div>
                                <div className="w-14 text-right flex-shrink-0">
                                    <span className="block text-xs font-bold text-slate-900 group-hover:text-primary transition-colors duration-300">{product.sales.toLocaleString()}</span>
                                    <span className="block text-[9px] text-slate-400 uppercase">Units</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
        </>
    );
};

export default RegionTopProducts;