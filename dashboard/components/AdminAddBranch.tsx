import React, { useState, useEffect } from 'react';
import { View } from '../types';
import { dataService } from '../dataService';

interface AdminAddBranchProps {
    onNavigate: (view: View) => void;
    regionId: string | null;
}

const AdminAddBranch: React.FC<AdminAddBranchProps> = ({ onNavigate, regionId }) => {
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        regionId: regionId || '',
        managerId: ''
    });
    const [regions, setRegions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadRegions = async () => {
            try {
                const regionsData = await dataService.getRegions();
                setRegions(regionsData);
            } catch (error) {
                console.error('Error loading regions:', error);
            }
        };
        loadRegions();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.regionId) {
            setError('Please select a region');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await dataService.addBranch({
                name: formData.name,
                code: formData.code,
                regionId: formData.regionId,
                managerId: formData.managerId || null,
                isActive: true
            });

            alert(`Branch "${formData.name}" created successfully under ${formData.regionId} Region.`);
            onNavigate('ADMIN_REGIONS');
        } catch (err: any) {
            console.error('Error creating branch:', err);
            setError(err.message || 'Failed to create branch. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => onNavigate('ADMIN_REGIONS')}
                    className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div className="flex flex-col">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Create Branch</h2>
                    <p className="text-slate-500">Adding a new distribution unit to the system.</p>
                </div>
            </div>

            <div className="glass-panel rounded-3xl p-10 bg-white">
                {error && (
                    <div className="mb-6 rounded-xl bg-red-50 dark:bg-red-900/20 p-4 border border-red-200">
                        <p className="text-sm text-red-800 dark:text-red-200 font-medium">{error}</p>
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Parent Region</label>
                            <select 
                                disabled={!!regionId}
                                required
                                className="w-full rounded-2xl border-slate-200 bg-slate-50 p-4 text-slate-900 focus:ring-primary focus:border-primary transition-all disabled:opacity-60"
                                value={formData.regionId}
                                onChange={e => setFormData({...formData, regionId: e.target.value})}
                            >
                                <option value="">Select Region...</option>
                                {regions.map(r => (
                                    <option key={r.id} value={r.id}>
                                        {r.name} {r.code ? `(${r.code})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Branch Code (System ID)</label>
                            <input 
                                type="text" 
                                required
                                placeholder="e.g. LHR-GUL-01"
                                className="w-full rounded-2xl border-slate-200 bg-slate-50 p-4 text-slate-900 focus:ring-primary focus:border-primary transition-all"
                                value={formData.code}
                                onChange={e => setFormData({...formData, code: e.target.value})}
                            />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Branch Name</label>
                            <input 
                                type="text" 
                                required
                                placeholder="e.g. Gulberg Distribution Center"
                                className="w-full rounded-2xl border-slate-200 bg-slate-50 p-4 text-slate-900 focus:ring-primary focus:border-primary transition-all"
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10 flex items-start gap-4">
                        <span className="material-symbols-outlined text-primary">info</span>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            Every branch must be assigned to at least one KPO (Regional Manager) to begin daily operations such as order billing and inventory sync.
                        </p>
                    </div>

                    <div className="flex justify-end gap-4 pt-4">
                        <button 
                            type="button"
                            onClick={() => onNavigate('ADMIN_REGIONS')}
                            className="px-8 py-4 rounded-2xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={isLoading}
                            className="px-10 py-4 rounded-2xl bg-slate-900 text-white font-bold hover:bg-black transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Creating...' : 'Confirm & Build'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminAddBranch;