import React, { useState } from 'react';
import { View } from '../types';
import { dataService } from '../dataService';

interface AdminAddRegionProps {
    onNavigate: (view: View) => void;
}

const AdminAddRegion: React.FC<AdminAddRegionProps> = ({ onNavigate }) => {
    const [formData, setFormData] = useState({
        name: '',
        code: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            await dataService.addRegion({
                name: formData.name,
                code: formData.code,
                isActive: true
            });

            alert(`Region "${formData.name}" (${formData.code}) created successfully. Use the Users module to assign a KPO.`);
            onNavigate('ADMIN_REGIONS');
        } catch (err: any) {
            console.error('Error creating region:', err);
            setError(err.message || 'Failed to create region. Please try again.');
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
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Add New Region</h2>
                    <p className="text-slate-500">Define a new geographical territory for the system.</p>
                </div>
            </div>

            <div className="glass-panel rounded-3xl p-10 bg-white shadow-xl border border-slate-100">
                {error && (
                    <div className="mb-6 rounded-xl bg-red-50 dark:bg-red-900/20 p-4 border border-red-200">
                        <p className="text-sm text-red-800 dark:text-red-200 font-medium">{error}</p>
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Region Name</label>
                            <input 
                                type="text" 
                                required
                                className="w-full rounded-2xl border-slate-200 bg-slate-50 p-4 text-slate-900 focus:ring-primary focus:border-primary transition-all"
                                placeholder="e.g. Faisalabad Region"
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Region Code</label>
                            <input 
                                type="text" 
                                required
                                className="w-full rounded-2xl border-slate-200 bg-slate-50 p-4 text-slate-900 focus:ring-primary focus:border-primary transition-all"
                                placeholder="e.g. FSD-04"
                                value={formData.code}
                                onChange={e => setFormData({...formData, code: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-start gap-4">
                        <span className="material-symbols-outlined text-blue-600">info</span>
                        <div className="text-sm text-blue-800 leading-relaxed">
                            <p className="font-bold mb-1">Skeleton Creation</p>
                            <p>As System Owner, you only define the region structure here. After creation, navigate to <strong>Users & Roles</strong> to create a KPO account and assign them to this specific region.</p>
                        </div>
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
                            className="px-10 py-4 rounded-2xl bg-slate-900 text-white font-bold hover:bg-black transition-all shadow-xl shadow-slate-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Creating...' : 'Confirm Region'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminAddRegion;