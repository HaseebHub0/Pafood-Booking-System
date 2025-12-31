
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { dataService } from '../dataService';
import { formatCurrency } from '../utils/dateUtils';

interface BookerTarget {
    bookerId: string;
    bookerName: string;
    ordersTarget: number;
    ordersAchieved: number;
    shopsTarget: number;
    shopsAchieved: number;
    amountTarget: number;
    amountAchieved: number;
    recoveryTarget: number; // Payment collection target
    recoveryAchieved: number; // Payment collection achieved
    averageOrderValue?: number;
    conversionRate?: number;
    ordersGrowth?: number;
    salesGrowth?: number;
    commissionAmount?: number; // Total commission earned
    commissionStatus?: 'pending' | 'approved' | 'paid'; // Latest commission status
}

interface KPOTargetsProps {
    user: User;
}

const KPOTargets: React.FC<KPOTargetsProps> = ({ user }) => {
    const [bookers, setBookers] = useState<any[]>([]);
    const [targets, setTargets] = useState<Record<string, BookerTarget>>({});
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingData, setEditingData] = useState<{
        ordersTarget: number;
        shopsTarget: number;
        recoveryTarget: number;
    }>({ ordersTarget: 0, shopsTarget: 0, recoveryTarget: 0 });
    const [isSaving, setIsSaving] = useState(false);
    const [targetPeriod, setTargetPeriod] = useState<'daily' | 'monthly'>('monthly');
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10)); // For daily targets
    const [showCompletions, setShowCompletions] = useState(false);
    const [completions, setCompletions] = useState<any[]>([]);
    const [completionsLoading, setCompletionsLoading] = useState(false);

    const currentPeriod = targetPeriod === 'daily' 
        ? selectedDate // YYYY-MM-DD
        : new Date().toISOString().slice(0, 7); // YYYY-MM

    useEffect(() => {
        const loadData = async () => {
            if (!user.branch) {
                setError('No branch assigned');
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                setError(null);

                // Load bookers
                const branchBookers = await dataService.getBranchBookers(user.branch);
                setBookers(branchBookers);

                // Load targets and calculate achievements
                const targetsData: Record<string, BookerTarget> = {};

                for (const booker of branchBookers) {
                    // Get existing targets
                    const existingTargets = await dataService.getBranchBookerTargets(user.branch, currentPeriod, targetPeriod);
                    // Booker targets are: orders (not sales) and new_shops
                    const ordersTarget = existingTargets.find(t => t.bookerId === booker.id && t.targetType === 'orders');
                    const shopsTarget = existingTargets.find(t => t.bookerId === booker.id && t.targetType === 'new_shops');
                    const recoveryTarget = existingTargets.find(t => t.bookerId === booker.id && t.targetType === 'recovery');

                    // Calculate achievements
                    const achievements = await dataService.calculateBookerAchievements(booker.id, currentPeriod, targetPeriod);
                    
                    // Check and record completions for orders target
                    if (ordersTarget && ordersTarget.id) {
                        const achievementPercent = ordersTarget.targetCount > 0 
                            ? (achievements.ordersCount / ordersTarget.targetCount) * 100 
                            : 0;
                        if (achievementPercent >= 100 && ordersTarget.status !== 'achieved' && ordersTarget.status !== 'exceeded') {
                            await dataService.recordTargetCompletion(
                                ordersTarget.id,
                                booker.id,
                                booker.name || 'Unknown',
                                'orders',
                                targetPeriod,
                                currentPeriod,
                                achievements.ordersCount,
                                ordersTarget.targetCount
                            );
                        }
                    }
                    
                    // Check and record completions for shops target
                    if (shopsTarget && shopsTarget.id) {
                        const achievementPercent = shopsTarget.targetCount > 0 
                            ? (achievements.shopsCount / shopsTarget.targetCount) * 100 
                            : 0;
                        if (achievementPercent >= 100 && shopsTarget.status !== 'achieved' && shopsTarget.status !== 'exceeded') {
                            await dataService.recordTargetCompletion(
                                shopsTarget.id,
                                booker.id,
                                booker.name || 'Unknown',
                                'new_shops',
                                targetPeriod,
                                currentPeriod,
                                achievements.shopsCount,
                                shopsTarget.targetCount
                            );
                        }
                    }
                    
                    // Get previous period for comparison (only for monthly)
                    let prevAchievements = { ordersCount: 0, shopsCount: 0 };
                    if (targetPeriod === 'monthly') {
                        const prevMonth = new Date();
                        prevMonth.setMonth(prevMonth.getMonth() - 1);
                        const prevMonthStr = prevMonth.toISOString().slice(0, 7);
                        prevAchievements = await dataService.calculateBookerAchievements(booker.id, prevMonthStr, 'monthly');
                    }

                    targetsData[booker.id] = {
                        bookerId: booker.id,
                        bookerName: booker.name || 'Unknown',
                        ordersTarget: ordersTarget?.targetCount || 0,
                        ordersAchieved: achievements.ordersCount,
                        shopsTarget: shopsTarget?.targetCount || 0,
                        shopsAchieved: achievements.shopsCount,
                        amountTarget: 0, // Not used for bookers
                        amountAchieved: 0, // Not used for bookers
                        recoveryTarget: recoveryTarget?.targetAmount || 0,
                        recoveryAchieved: achievements.recoveryAmount || 0,
                        averageOrderValue: achievements.averageOrderValue,
                        conversionRate: achievements.conversionRate,
                        ordersGrowth: prevAchievements.ordersCount > 0 
                            ? ((achievements.ordersCount - prevAchievements.ordersCount) / prevAchievements.ordersCount) * 100 
                            : 0,
                        salesGrowth: 0 // Not used for bookers
                    };
                }

                setTargets(targetsData);
            } catch (err: any) {
                console.error('Error loading targets:', err);
                setError(err.message || 'Failed to load targets');
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [user.branch, currentPeriod, targetPeriod]);

    const handleEdit = (bookerId: string) => {
        const target = targets[bookerId];
        if (target) {
            setEditingData({
                ordersTarget: target.ordersTarget,
                shopsTarget: target.shopsTarget,
                recoveryTarget: target.recoveryTarget
            });
            setIsEditing(bookerId);
        }
    };

    const handleSave = async (bookerId: string) => {
        try {
            setIsSaving(true);
            setError(null);

            const booker = bookers.find(b => b.id === bookerId);
            if (!booker) {
                setError('Booker not found');
                return;
            }

            // Create/update orders target (not sales - bookers book orders, not sales)
            if (editingData.ordersTarget > 0) {
                await dataService.createOrUpdateTarget({
                    bookerId: bookerId,
                    bookerName: booker.name,
                    targetType: 'orders',
                    period: targetPeriod,
                    periodValue: currentPeriod,
                    targetCount: editingData.ordersTarget
                });
            }

            // Create/update shops target
            if (editingData.shopsTarget > 0) {
                await dataService.createOrUpdateTarget({
                    bookerId: bookerId,
                    bookerName: booker.name,
                    targetType: 'new_shops',
                    period: targetPeriod,
                    periodValue: currentPeriod,
                    targetCount: editingData.shopsTarget
                });
            }

            // Create/update recovery target (optional)
            if (editingData.recoveryTarget > 0) {
                await dataService.createOrUpdateTarget({
                    bookerId: bookerId,
                    bookerName: booker.name,
                    targetType: 'recovery',
                    period: targetPeriod,
                    periodValue: currentPeriod,
                    targetAmount: editingData.recoveryTarget
                });
            }

            // Reload data
            const existingTargets = await dataService.getBranchBookerTargets(user.branch || '', currentPeriod, targetPeriod);
            const achievements = await dataService.calculateBookerAchievements(bookerId, currentPeriod, targetPeriod);
            
            const ordersTarget = existingTargets.find(t => t.bookerId === bookerId && t.targetType === 'orders');
            const shopsTarget = existingTargets.find(t => t.bookerId === bookerId && t.targetType === 'new_shops');
            const recoveryTarget = existingTargets.find(t => t.bookerId === bookerId && t.targetType === 'recovery');

            setTargets(prev => ({
                ...prev,
                [bookerId]: {
                    bookerId: bookerId,
                    bookerName: booker.name || 'Unknown',
                    ordersTarget: ordersTarget?.targetCount || 0,
                    ordersAchieved: achievements.ordersCount,
                    shopsTarget: shopsTarget?.targetCount || 0,
                    shopsAchieved: achievements.shopsCount,
                    amountTarget: 0, // Not used for bookers
                    amountAchieved: 0, // Not used for bookers
                    recoveryTarget: recoveryTarget?.targetAmount || 0,
                    recoveryAchieved: achievements.recoveryAmount || 0,
                    averageOrderValue: achievements.averageOrderValue,
                    conversionRate: achievements.conversionRate,
                    ordersGrowth: 0,
                    salesGrowth: 0
                }
            }));

            setIsEditing(null);
            alert('Targets updated successfully!');
        } catch (err: any) {
            console.error('Error saving targets:', err);
            setError(err.message || 'Failed to save targets');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Performance Targets</h2>
                        <p className="text-slate-500 text-sm">Set monthly goals for order bookers in {user.branch}.</p>
                    </div>
                </div>
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Performance Targets</h2>
                        <p className="text-slate-500 text-sm">Set monthly goals for order bookers in {user.branch}.</p>
                    </div>
                </div>
                <div className="rounded-xl bg-red-50 p-6 border border-red-200">
                    <p className="text-red-800 font-medium">Error: {error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Performance Targets</h2>
                    <p className="text-slate-500 text-sm">Set {targetPeriod} goals for order bookers in {user.branch}.</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Completion History Button */}
                    <button
                        onClick={async () => {
                            if (!showCompletions) {
                                setCompletionsLoading(true);
                                const branchCompletions = await dataService.getBranchCompletions(user.branch || '', 50);
                                setCompletions(branchCompletions);
                                setCompletionsLoading(false);
                            }
                            setShowCompletions(!showCompletions);
                        }}
                        className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-lg">history</span>
                        Completion History
                    </button>
                    {/* Period Toggle */}
                    <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                        <button
                            onClick={() => setTargetPeriod('daily')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                targetPeriod === 'daily'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Daily
                        </button>
                        <button
                            onClick={() => setTargetPeriod('monthly')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                targetPeriod === 'monthly'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Monthly
                        </button>
                    </div>
                    {/* Date Picker for Daily */}
                    {targetPeriod === 'daily' && (
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                    )}
                </div>
            </div>

            {/* Completion History */}
            {showCompletions && (
                <div className="glass-panel bg-white rounded-2xl p-6 border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-900">Target Completion History</h3>
                        <button
                            onClick={() => setShowCompletions(false)}
                            className="text-slate-400 hover:text-slate-600"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    {completionsLoading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                            <p className="mt-2 text-slate-400 text-sm">Loading completions...</p>
                        </div>
                    ) : completions.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-sm">No completions recorded yet.</div>
                    ) : (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {completions.map((completion: any) => {
                                const completedDate = completion.completedAt?.toDate 
                                    ? completion.completedAt.toDate().toLocaleDateString()
                                    : completion.completedAt 
                                    ? new Date(completion.completedAt).toLocaleDateString()
                                    : 'N/A';
                                
                                return (
                                    <div key={completion.id} className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-slate-900">{completion.bookerName}</p>
                                                <p className="text-sm text-slate-500 capitalize">
                                                    {completion.targetType.replace('_', ' ')} • {completion.period}
                                                </p>
                                                <p className="text-xs text-slate-400 mt-1">{completedDate}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-green-600">
                                                    {completion.achievementPercent?.toFixed(1) || 0}%
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {completion.achievedValue?.toLocaleString() || 0} / {completion.targetValue?.toLocaleString() || 0}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {bookers.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-12 text-center border border-dashed border-slate-200">
                    <p className="text-slate-400">No bookers found in this branch. Create bookers first.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {bookers.map(booker => {
                        const target = targets[booker.id];
                        if (!target) return null;

                        return (
                            <div key={booker.id} className="glass-panel p-8 rounded-3xl bg-white shadow-sm hover:shadow-xl transition-all border border-slate-100">
                                <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
                                    <div className="flex items-center gap-4">
                                        <div className="size-14 rounded-2xl bg-slate-200 bg-cover bg-center border-2 border-white shadow-lg" style={{ backgroundImage: booker.avatarUrl ? `url(${booker.avatarUrl})` : undefined }}></div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900">{booker.name}</h3>
                                            <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">{booker.area || 'N/A'} Sector</p>
                                        </div>
                                    </div>
                                    {isEditing === booker.id ? (
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => setIsEditing(null)}
                                                disabled={isSaving}
                                                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 disabled:opacity-50"
                                            >
                                                Cancel
                                            </button>
                                            <button 
                                                onClick={() => handleSave(booker.id)}
                                                disabled={isSaving}
                                                className="px-6 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-black transition-all disabled:opacity-50"
                                            >
                                                {isSaving ? 'Saving...' : 'Save Changes'}
                                            </button>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => handleEdit(booker.id)}
                                            className="px-6 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all"
                                        >
                                            Update Targets
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <span className="material-symbols-outlined text-sm">receipt_long</span>
                                            <p className="text-[10px] font-black uppercase tracking-widest">Order Volume</p>
                                        </div>
                                        <div className="flex items-end gap-2">
                                            <p className="text-3xl font-black text-slate-900">{target.ordersAchieved}</p>
                                            <span className="text-slate-300 text-sm mb-1">/</span>
                                            {isEditing === booker.id ? (
                                                <input 
                                                    type="number" 
                                                    className="w-20 p-1 border-b-2 border-primary focus:outline-none font-bold text-slate-900" 
                                                    value={editingData.ordersTarget}
                                                    onChange={e => setEditingData({...editingData, ordersTarget: parseInt(e.target.value) || 0})}
                                                />
                                            ) : (
                                                <p className="text-xl font-bold text-slate-300 mb-0.5">{target.ordersTarget}</p>
                                            )}
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-blue-500 transition-all" 
                                                style={{ width: `${Math.min(((target.ordersAchieved / (target.ordersTarget || 1)) * 100), 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <span className="material-symbols-outlined text-sm">storefront</span>
                                            <p className="text-[10px] font-black uppercase tracking-widest">New Shop In-take</p>
                                        </div>
                                        <div className="flex items-end gap-2">
                                            <p className="text-3xl font-black text-slate-900">{target.shopsAchieved}</p>
                                            <span className="text-slate-300 text-sm mb-1">/</span>
                                            {isEditing === booker.id ? (
                                                <input 
                                                    type="number" 
                                                    className="w-20 p-1 border-b-2 border-primary focus:outline-none font-bold text-slate-900" 
                                                    value={editingData.shopsTarget}
                                                    onChange={e => setEditingData({...editingData, shopsTarget: parseInt(e.target.value) || 0})}
                                                />
                                            ) : (
                                                <p className="text-xl font-bold text-slate-300 mb-0.5">{target.shopsTarget}</p>
                                            )}
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-green-500 transition-all" 
                                                style={{ width: `${Math.min(((target.shopsAchieved / (target.shopsTarget || 1)) * 100), 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <span className="material-symbols-outlined text-sm">trending_up</span>
                                            <p className="text-[10px] font-black uppercase tracking-widest">Performance Metrics</p>
                                        </div>
                                        <div className="space-y-3">
                                            {target.conversionRate !== undefined && target.conversionRate > 0 && (
                                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Conversion Rate</p>
                                                    <p className="text-lg font-black text-slate-900">{target.conversionRate.toFixed(1)} orders/shop</p>
                                                </div>
                                            )}
                                            {target.averageOrderValue !== undefined && target.averageOrderValue > 0 && (
                                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Avg Order Value</p>
                                                    <p className="text-lg font-black text-slate-900">PKR {target.averageOrderValue.toLocaleString()}</p>
                                                </div>
                                            )}
                                            {target.ordersGrowth !== undefined && target.ordersGrowth !== 0 && (
                                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Orders Growth</p>
                                                    <p className={`text-lg font-black ${target.ordersGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {target.ordersGrowth >= 0 ? '+' : ''}{target.ordersGrowth.toFixed(1)}%
                                                    </p>
                                                </div>
                                            )}
                                            {(!target.conversionRate || target.conversionRate === 0) && 
                                             (!target.averageOrderValue || target.averageOrderValue === 0) && 
                                             (!target.ordersGrowth || target.ordersGrowth === 0) && (
                                                <p className="text-xs text-slate-400 italic text-center py-4">No metrics available yet</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
                                            <p className="text-[10px] font-black uppercase tracking-widest">Recovery (PKR)</p>
                                            <span className="text-[8px] text-slate-300">(Optional)</span>
                                        </div>
                                        <div className="flex items-end gap-2">
                                            <p className="text-3xl font-black text-slate-900">
                                                {target.recoveryAchieved >= 1000000 
                                                    ? `${(target.recoveryAchieved / 1000000).toFixed(1)}M`
                                                    : target.recoveryAchieved >= 1000
                                                    ? `${(target.recoveryAchieved / 1000).toFixed(0)}k`
                                                    : target.recoveryAchieved
                                                }
                                            </p>
                                            <span className="text-slate-300 text-sm mb-1">/</span>
                                            {isEditing === booker.id ? (
                                                <input 
                                                    type="number" 
                                                    className="w-32 p-1 border-b-2 border-primary focus:outline-none font-bold text-slate-900" 
                                                    value={editingData.recoveryTarget}
                                                    onChange={e => setEditingData({...editingData, recoveryTarget: parseInt(e.target.value) || 0})}
                                                    placeholder="Amount"
                                                />
                                            ) : (
                                                <p className="text-xl font-bold text-slate-300 mb-0.5">
                                                    {target.recoveryTarget >= 1000000 
                                                        ? `${(target.recoveryTarget / 1000000).toFixed(1)}M`
                                                        : target.recoveryTarget >= 1000
                                                        ? `${(target.recoveryTarget / 1000).toFixed(0)}k`
                                                        : target.recoveryTarget || 0
                                                    }
                                                </p>
                                            )}
                                        </div>
                                        {target.recoveryTarget > 0 && (
                                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full transition-all ${
                                                        (target.recoveryAchieved / target.recoveryTarget) >= 1 ? 'bg-green-500' :
                                                        (target.recoveryAchieved / target.recoveryTarget) >= 0.7 ? 'bg-yellow-500' : 'bg-purple-500'
                                                    }`}
                                                    style={{ width: `${Math.min(((target.recoveryAchieved / target.recoveryTarget) * 100), 100)}%` }}
                                                ></div>
                                            </div>
                                        )}
                                        {target.recoveryTarget === 0 && (
                                            <p className="text-xs text-slate-400 italic">No recovery target set</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default KPOTargets;
