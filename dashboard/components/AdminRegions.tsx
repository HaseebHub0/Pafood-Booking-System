
import React, { useState, useEffect } from 'react';
import { View, Branch } from '../types';
import { dataService } from '../dataService';

interface AdminRegionsProps {
    onNavigate: (view: View, id?: string) => void;
}

interface BranchWithKPO extends Branch {
    kpoName?: string;
    kpoEmail?: string;
}

const AdminRegions: React.FC<AdminRegionsProps> = ({ onNavigate }) => {
    const [regions, setRegions] = useState<any[]>([]);
    const [branches, setBranches] = useState<BranchWithKPO[]>([]);
    const [selectedRegion, setSelectedRegion] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleteConfirm, setDeleteConfirm] = useState<{ branch: BranchWithKPO | null; show: boolean }>({ branch: null, show: false });
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteRegionConfirm, setDeleteRegionConfirm] = useState<{ region: any | null; show: boolean }>({ region: null, show: false });
    const [isDeletingRegion, setIsDeletingRegion] = useState(false);

    useEffect(() => {
        const fetchRegions = async () => {
            setLoading(true);
            const data = await dataService.getRegions();
            setRegions(data);
            setLoading(false);
        };
        fetchRegions();
    }, []);

    const handleSelectRegion = async (region: any) => {
        setSelectedRegion(region);
        setLoading(true);
        const branchData = await dataService.getBranches(region.id);
        
        // Fetch KPO details for each branch that has a managerId
        const branchesWithKPO: BranchWithKPO[] = await Promise.all(
            (branchData as Branch[]).map(async (branch) => {
                if (branch.managerId) {
                    try {
                        const kpoUser = await dataService.getUserProfile(branch.managerId);
                        return {
                            ...branch,
                            kpoName: kpoUser?.name || 'Unknown',
                            kpoEmail: kpoUser?.email || ''
                        };
                    } catch (error) {
                        console.error(`Error fetching KPO for branch ${branch.id}:`, error);
                        return {
                            ...branch,
                            kpoName: 'Unknown',
                            kpoEmail: ''
                        };
                    }
                }
                return branch;
            })
        );
        
        setBranches(branchesWithKPO);
        setLoading(false);
    };

    const handleEditBranch = (branch: BranchWithKPO) => {
        // Pass branchId, regionId will be available from selectedRegion
        onNavigate('ADMIN_EDIT_BRANCH', branch.id);
    };

    const handleDeleteBranch = (branch: BranchWithKPO) => {
        setDeleteConfirm({ branch, show: true });
    };

    const confirmDelete = async () => {
        if (!deleteConfirm.branch) return;

        setIsDeleting(true);
        try {
            await dataService.deleteBranch(deleteConfirm.branch.id);
            // Reload branches
            if (selectedRegion) {
                await handleSelectRegion(selectedRegion);
            }
            alert(`Branch "${deleteConfirm.branch.name}" deleted successfully.`);
        } catch (error: any) {
            alert(`Error deleting branch: ${error.message}`);
        } finally {
            setIsDeleting(false);
            setDeleteConfirm({ branch: null, show: false });
        }
    };

    const handleDeleteRegion = (region: any) => {
        setDeleteRegionConfirm({ region, show: true });
    };

    const confirmDeleteRegion = async () => {
        if (!deleteRegionConfirm.region) return;

        setIsDeletingRegion(true);
        try {
            await dataService.deleteRegion(deleteRegionConfirm.region.id);
            // Reload regions
            const data = await dataService.getRegions();
            setRegions(data);
            if (selectedRegion && selectedRegion.id === deleteRegionConfirm.region.id) {
                setSelectedRegion(null);
            }
            alert(`Region "${deleteRegionConfirm.region.name}" deleted successfully.`);
        } catch (error: any) {
            alert(`Error deleting region: ${error.message}`);
        } finally {
            setIsDeletingRegion(false);
            setDeleteRegionConfirm({ region: null, show: false });
        }
    };

    if (loading && !selectedRegion) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Organization Skeleton</h2>
                    <p className="text-slate-500 text-sm">Managing live infrastructure across Firebase.</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => onNavigate('ADMIN_ADD_REGION')}
                        className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition-all shadow-lg"
                    >
                        <span className="material-symbols-outlined text-[20px]">add_location_alt</span>
                        <span>New Region</span>
                    </button>
                </div>
            </div>

            {!selectedRegion ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {regions.map((region) => (
                        <div key={region.id} className="group relative overflow-hidden rounded-3xl glass-panel p-8 transition-all hover:border-primary/20 hover:shadow-2xl hover:-translate-y-1 bg-white">
                            <div className="flex items-center justify-between mb-8">
                                <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                    <span className="material-symbols-outlined text-3xl">map</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="px-3 py-1 rounded-full bg-green-50 text-green-600 text-[10px] font-black uppercase border border-green-100">Live</span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteRegion(region);
                                        }}
                                        className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-all shadow-sm"
                                        title="Delete Region"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                    </button>
                                </div>
                            </div>
                            
                            <h3 className="text-2xl font-black text-slate-900 mb-2">{region.name}</h3>
                            <p className="text-sm text-slate-500 mb-8">System ID: {region.code}</p>
                            
                            <button 
                                onClick={() => handleSelectRegion(region)}
                                className="w-full py-4 rounded-2xl bg-slate-900 text-white font-black hover:bg-black transition-all text-xs uppercase tracking-widest"
                            >
                                Manage Branches
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <button 
                        onClick={() => setSelectedRegion(null)}
                        className="flex items-center gap-2 text-primary font-black hover:gap-4 transition-all"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                        BACK TO GLOBAL VIEW
                    </button>
                    
                    <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl">
                        <div className="flex items-center justify-between mb-10 pb-8 border-b border-slate-100">
                            <div>
                                <h3 className="text-3xl font-black text-slate-900">{selectedRegion.name} Distribution</h3>
                                <p className="text-slate-500 font-medium">Monitoring active branches in this territory.</p>
                            </div>
                            <button 
                                onClick={() => onNavigate('ADMIN_ADD_BRANCH', selectedRegion.id)}
                                className="px-8 py-3.5 rounded-2xl bg-primary text-white font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-primary/20"
                            >
                                Add New Branch
                            </button>
                        </div>

                        {loading ? (
                             <div className="py-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {branches.length === 0 && (
                                    <div className="col-span-full py-20 text-center text-slate-400 border-4 border-dashed border-slate-50 rounded-[2rem]">
                                        <span className="material-symbols-outlined text-5xl mb-4 block opacity-20">inventory_2</span>
                                        No active branches found.
                                    </div>
                                )}
                                {branches.map(branch => (
                                    <div key={branch.id} className="p-8 rounded-[2rem] bg-slate-50 border border-slate-200 hover:bg-white hover:shadow-2xl transition-all relative">
                                        {/* Action Buttons */}
                                        <div className="absolute top-4 right-4 flex gap-2">
                                            <button
                                                onClick={() => handleEditBranch(branch)}
                                                className="p-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all shadow-sm"
                                                title="Edit Branch"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">edit</span>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteBranch(branch)}
                                                className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-all shadow-sm"
                                                title="Delete Branch"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">delete</span>
                                            </button>
                                        </div>

                                        {/* KPO Assignment Header */}
                                        {branch.managerId && branch.kpoName && (
                                            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-lg">
                                                        <span className="material-symbols-outlined">shield_person</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-0.5">Assigned KPO</p>
                                                        <p className="text-base font-black text-slate-900 truncate">{branch.kpoName}</p>
                                                        {branch.kpoEmail && (
                                                            <p className="text-xs text-slate-500 truncate">{branch.kpoEmail}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        
                                        <div className="flex justify-between items-start mb-6 pr-16">
                                            <div>
                                                <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">{branch.code}</p>
                                                <h4 className="text-xl font-bold text-slate-900">{branch.name}</h4>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${branch.managerId ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-300'}`}>
                                                <span className="material-symbols-outlined">{branch.managerId ? 'shield_person' : 'person_off'}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-black text-slate-400 uppercase">KPO Status</p>
                                                <p className={`text-sm font-bold truncate ${branch.managerId ? 'text-slate-900' : 'text-slate-400 italic'}`}>
                                                    {branch.managerId && branch.kpoName 
                                                        ? branch.kpoName 
                                                        : branch.managerId 
                                                        ? "Manager Assigned" 
                                                        : "Waiting for KPO"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Delete Branch Confirmation Modal */}
            {deleteConfirm.show && deleteConfirm.branch && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="h-12 w-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl">warning</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Delete Branch</h3>
                                <p className="text-sm text-slate-500">This action cannot be undone</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-700 mb-6">
                            Are you sure you want to delete <strong>{deleteConfirm.branch.name}</strong> ({deleteConfirm.branch.code})?
                            {deleteConfirm.branch.managerId && (
                                <span className="block mt-2 text-orange-600 text-xs">
                                    ⚠️ This branch has an assigned KPO. Make sure to reassign users first.
                                </span>
                            )}
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setDeleteConfirm({ branch: null, show: false })}
                                disabled={isDeleting}
                                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all disabled:opacity-50"
                            >
                                {isDeleting ? 'Deleting...' : 'Delete Branch'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Region Confirmation Modal */}
            {deleteRegionConfirm.show && deleteRegionConfirm.region && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="h-12 w-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl">warning</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Delete Region</h3>
                                <p className="text-sm text-slate-500">This action cannot be undone</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-700 mb-6">
                            Are you sure you want to delete <strong>{deleteRegionConfirm.region.name}</strong> ({deleteRegionConfirm.region.code})?
                            <span className="block mt-2 text-orange-600 text-xs">
                                ⚠️ Make sure the region has no branches or assigned users before deleting.
                            </span>
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setDeleteRegionConfirm({ region: null, show: false })}
                                disabled={isDeletingRegion}
                                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmDeleteRegion}
                                disabled={isDeletingRegion}
                                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all disabled:opacity-50"
                            >
                                {isDeletingRegion ? 'Deleting...' : 'Delete Region'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminRegions;
