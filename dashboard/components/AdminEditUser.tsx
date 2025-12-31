import React, { useState, useEffect } from 'react';
import { View, UserRole, User } from '../types';
import { REGION_AREAS } from '../constants';
import { dataService } from '../dataService';

interface AdminEditUserProps {
    onNavigate: (view: View) => void;
    userId: string | null;
}

const AdminEditUser: React.FC<AdminEditUserProps> = ({ onNavigate, userId }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        role: 'Booker' as UserRole,
        region: '',
        area: '',
        status: 'Active' as 'Active' | 'Inactive',
        regionId: '',
        branch: '',
        phone: ''
    });
    const [regions, setRegions] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [loadingBranches, setLoadingBranches] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            if (!userId) {
                setError('No user ID provided');
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                setError(null);
                
                // Load regions
                const regionsData = await dataService.getRegions();
                setRegions(regionsData);
                
                // Load user data
                const user = await dataService.getUserProfile(userId);
                if (user) {
                    const userRegionId = (user as any).regionId || '';
                    setFormData({
                        name: user.name || '',
                        email: user.email || '',
                        role: user.role || 'Booker',
                        region: user.region || '',
                        area: user.area || '',
                        status: (user as any).status === 'Active' || !(user as any).status ? 'Active' : 'Inactive',
                        regionId: userRegionId,
                        branch: user.branch || '',
                        phone: (user as any).phone || ''
                    });

                    // Load branches if user has a region
                    if (userRegionId) {
                        const branchesData = await dataService.getBranches(userRegionId);
                        setBranches(branchesData);
                    }
                } else {
                    setError('User not found');
                }
            } catch (err: any) {
                console.error('Error loading user:', err);
                setError(err.message || 'Failed to load user');
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [userId]);

    // Load branches when region changes
    useEffect(() => {
        const loadBranches = async () => {
            if (formData.regionId) {
                try {
                    setLoadingBranches(true);
                    const branchesData = await dataService.getBranches(formData.regionId);
                    setBranches(branchesData);
                    
                    // Reset branch if current branch is not in new branches list
                    if (formData.branch && !branchesData.find((b: any) => b.name === formData.branch || b.id === formData.branch)) {
                        setFormData(prev => ({ ...prev, branch: '' }));
                    }
                } catch (err: any) {
                    console.error('Error loading branches:', err);
                } finally {
                    setLoadingBranches(false);
                }
            } else {
                setBranches([]);
                setFormData(prev => ({ ...prev, branch: '' }));
            }
        };

        loadBranches();
    }, [formData.regionId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!userId) {
            setError('No user ID provided');
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            await dataService.updateUser(userId, {
                name: formData.name,
                email: formData.email,
                role: formData.role,
                region: formData.region,
                regionId: formData.regionId,
                area: formData.area,
                branch: formData.branch,
                phone: formData.phone,
                status: formData.status
            } as Partial<User>);

            alert(`User ${formData.name} Updated Successfully!`);
            onNavigate('ADMIN_USERS');
        } catch (err: any) {
            console.error('Error updating user:', err);
            setError(err.message || 'Failed to update user');
        } finally {
            setIsLoading(false);
        }
    };


    if (!userId) {
        return (
            <div className="max-w-3xl mx-auto space-y-8">
                <div className="rounded-xl bg-red-50 p-4 border border-red-200">
                    <p className="text-red-800">Error: No user selected</p>
                </div>
            </div>
        );
    }

    if (isLoading && !formData.name) {
        return (
            <div className="max-w-3xl mx-auto space-y-8">
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => onNavigate('ADMIN_USERS')}
                    className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h2 className="text-3xl font-bold text-slate-900 drop-shadow-sm">Edit User: {formData.name || userId}</h2>
            </div>

            {error && (
                <div className="rounded-xl bg-red-50 p-4 border border-red-200">
                    <p className="text-red-800 font-medium">{error}</p>
                </div>
            )}

            <div className="glass-panel rounded-2xl p-8 bg-white/90">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Status Toggle - Unique to Edit Mode */}
                    <div className="flex justify-end">
                        <label className="flex items-center cursor-pointer gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                            <span className="text-sm font-medium text-slate-600">Account Status</span>
                            <div className="relative">
                                <input 
                                    type="checkbox" 
                                    className="sr-only" 
                                    checked={formData.status === 'Active'}
                                    onChange={(e) => setFormData({...formData, status: e.target.checked ? 'Active' : 'Inactive'})}
                                />
                                <div className={`block w-10 h-6 rounded-full transition-colors ${formData.status === 'Active' ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.status === 'Active' ? 'translate-x-4' : ''}`}></div>
                            </div>
                            <span className={`text-sm font-bold ${formData.status === 'Active' ? 'text-green-600' : 'text-slate-500'}`}>
                                {formData.status}
                            </span>
                        </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600">Full Name</label>
                            <input 
                                type="text" 
                                required
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600">Email Address</label>
                            <input 
                                type="email" 
                                required
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                value={formData.email}
                                onChange={e => setFormData({...formData, email: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600">Role</label>
                            <select 
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
                                value={formData.role}
                                onChange={e => setFormData({...formData, role: e.target.value})}
                            >
                                <option value="Admin">Admin</option>
                                <option value="KPO">KPO (Regional Manager)</option>
                                <option value="Booker">Order Booker</option>
                                <option value="Salesman">Salesman (Delivery)</option>
                            </select>
                        </div>
                        
                        {formData.role !== 'Admin' && (
                            <>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-600">Assigned Region</label>
                                    <select 
                                        required
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
                                        value={formData.regionId || ''}
                                        onChange={(e) => {
                                            const selectedRegion = regions.find(r => r.id === e.target.value);
                                            setFormData({ 
                                                ...formData, 
                                                regionId: e.target.value,
                                                region: selectedRegion?.name || '',
                                                area: '',
                                                branch: '' // Reset branch when region changes
                                            });
                                        }}
                                    >
                                        <option value="">Select Region...</option>
                                        {regions.map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                {/* Branch selection for KPO role */}
                                {formData.role === 'KPO' && formData.regionId && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-600">Assigned Branch</label>
                                        <select 
                                            required
                                            disabled={loadingBranches || !formData.regionId}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                                            value={formData.branch}
                                            onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                                        >
                                            <option value="">{loadingBranches ? 'Loading branches...' : 'Select Branch...'}</option>
                                            {branches.map(b => (
                                                <option key={b.id} value={b.name}>{b.name}</option>
                                            ))}
                                        </select>
                                        {branches.length === 0 && !loadingBranches && formData.regionId && (
                                            <p className="text-xs text-slate-400">No branches available for this region</p>
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        {formData.role === 'Salesman' && formData.region && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-600">Assigned Area (Route)</label>
                                <select 
                                    required
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
                                    value={formData.area}
                                    onChange={e => setFormData({...formData, area: e.target.value})}
                                >
                                    <option value="">Select Area...</option>
                                    {REGION_AREAS[formData.region]?.map(area => (
                                        <option key={area} value={area}>{area}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        
                        <div className="md:col-span-2 space-y-2">
                             <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex gap-3">
                                <span className="material-symbols-outlined text-yellow-600">info</span>
                                <div className="text-sm text-yellow-800">
                                    <p className="font-bold">Password Reset</p>
                                    <p>Leave the password field empty to keep the current password.</p>
                                </div>
                             </div>
                        </div>

                        <div className="md:col-span-2 space-y-2">
                            <label className="text-sm font-medium text-slate-600">New Password (Optional)</label>
                            <input 
                                type="password" 
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                placeholder="Enter only to reset"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button 
                            type="button"
                            onClick={() => onNavigate('ADMIN_USERS')}
                            className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={isLoading}
                            className="px-8 py-3 rounded-xl bg-primary text-white font-bold hover:bg-red-700 hover:scale-105 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Updating...' : 'Update User'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminEditUser;