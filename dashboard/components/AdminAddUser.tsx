import React, { useState, useEffect } from 'react';
import { View, UserRole, Region, Branch } from '../types';
import { dataService } from '../dataService';

interface AdminAddUserProps {
    onNavigate: (view: View) => void;
}

const AdminAddUser: React.FC<AdminAddUserProps> = ({ onNavigate }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        role: 'KPO' as UserRole,
        regionId: '',
        branchId: '',
        password: ''
    });
    
    const [regions, setRegions] = useState<Region[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [isLoadingRegions, setIsLoadingRegions] = useState(true);
    const [isLoadingBranches, setIsLoadingBranches] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Load regions on mount
    useEffect(() => {
        const loadRegions = async () => {
            try {
                setIsLoadingRegions(true);
                const regionsData = await dataService.getRegions();
                setRegions(regionsData as Region[]);
            } catch (error: any) {
                console.error('Error loading regions:', error);
            } finally {
                setIsLoadingRegions(false);
            }
        };
        loadRegions();
    }, []);

    // Load branches when region is selected
    useEffect(() => {
        const loadBranches = async () => {
            if (!formData.regionId) {
                setBranches([]);
                setFormData(prev => ({ ...prev, branchId: '' }));
                return;
            }
            
            try {
                setIsLoadingBranches(true);
                const branchesData = await dataService.getBranches(formData.regionId);
                setBranches(branchesData as Branch[]);
                // Reset branch selection when region changes
                setFormData(prev => ({ ...prev, branchId: '' }));
            } catch (error: any) {
                console.error('Error loading branches:', error);
                setBranches([]);
            } finally {
                setIsLoadingBranches(false);
            }
        };
        loadBranches();
    }, [formData.regionId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.regionId || !formData.branchId) {
            alert('Please select both Region and Branch for KPO account.');
            return;
        }
        
        try {
            setIsSubmitting(true);
            
            const selectedRegion = regions.find(r => r.id === formData.regionId);
            const selectedBranch = branches.find(b => b.id === formData.branchId);
            
            const userData = {
                name: formData.name,
                email: formData.email,
                password: formData.password,
                role: 'KPO' as UserRole,
                regionId: formData.regionId,
                region: selectedRegion?.name,
                branch: selectedBranch?.name,
            };
            
            await dataService.createUser(userData);
            
            alert(`Account created successfully for ${formData.name} as ${formData.role}.`);
            onNavigate('ADMIN_USERS');
        } catch (error: any) {
            console.error('Error creating user:', error);
            alert(`Failed to create account: ${error.message || 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => onNavigate('ADMIN_USERS')}
                    className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div className="flex flex-col">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Create KPO Account</h2>
                    <p className="text-slate-500">Create a new KPO (Key Performance Officer) account for branch management.</p>
                </div>
            </div>

            <div className="glass-panel rounded-3xl p-10 bg-white shadow-xl border border-slate-100">
                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Full Name</label>
                            <input 
                                type="text" 
                                required
                                className="w-full rounded-2xl border-slate-200 bg-slate-50 p-4 text-slate-900 focus:ring-primary focus:border-primary transition-all"
                                placeholder="e.g. Ahmed Khan"
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                            />
                        </div>
                        {formData.role === 'KPO' && (
                            <>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Assign Region</label>
                                    <select 
                                        required
                                        disabled={isLoadingRegions}
                                        className="w-full rounded-2xl border-slate-200 bg-slate-50 p-4 text-slate-900 focus:ring-primary focus:border-primary transition-all disabled:opacity-50"
                                        value={formData.regionId}
                                        onChange={e => setFormData({...formData, regionId: e.target.value, branchId: ''})}
                                    >
                                        <option value="">{isLoadingRegions ? 'Loading regions...' : 'Select Region...'}</option>
                                        {regions.map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                    {regions.length === 0 && !isLoadingRegions && (
                                        <p className="text-xs text-slate-400 mt-1">No regions available. Please create a region first.</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Assign Branch</label>
                                    <select 
                                        required
                                        disabled={!formData.regionId || isLoadingBranches}
                                        className="w-full rounded-2xl border-slate-200 bg-slate-50 p-4 text-slate-900 focus:ring-primary focus:border-primary transition-all disabled:opacity-50"
                                        value={formData.branchId}
                                        onChange={e => setFormData({...formData, branchId: e.target.value})}
                                    >
                                        <option value="">
                                            {!formData.regionId 
                                                ? 'Select a region first...' 
                                                : isLoadingBranches 
                                                    ? 'Loading branches...' 
                                                    : 'Select Branch...'}
                                        </option>
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                    {formData.regionId && branches.length === 0 && !isLoadingBranches && (
                                        <p className="text-xs text-slate-400 mt-1">No branches available for this region. Please create a branch first.</p>
                                    )}
                                </div>
                            </>
                        )}

                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Login ID (Email/Username)</label>
                                <input 
                                    type="text" 
                                    required
                                    className="w-full rounded-2xl border-slate-200 bg-slate-50 p-4 text-slate-900 focus:ring-primary focus:border-primary transition-all"
                                    placeholder="kpo.lahore"
                                    value={formData.email}
                                    onChange={e => setFormData({...formData, email: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Access Password</label>
                                <input 
                                    type="password" 
                                    required
                                    className="w-full rounded-2xl border-slate-200 bg-slate-50 p-4 text-slate-900 focus:ring-primary focus:border-primary transition-all"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={e => setFormData({...formData, password: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-4 pt-4">
                        <button 
                            type="button"
                            onClick={() => onNavigate('ADMIN_USERS')}
                            className="px-8 py-4 rounded-2xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={isSubmitting}
                            className="px-10 py-4 rounded-2xl bg-primary text-white font-bold hover:bg-red-700 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Creating...' : 'Create Manager Account'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminAddUser;