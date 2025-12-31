import React, { useState, useEffect } from 'react';
// Fix: Use MOCK_STAFF_LIST instead of non-existent MOCK_STAFF
import { MOCK_STAFF_LIST } from '../constants';
import { User } from '../types';

interface KPOSalesmanMappingProps {
    user: User;
}

// Fix: Extend User type to include local state property
interface AssignedBooker extends User {
    assignedTo?: string | null;
}

const KPOSalesmanMapping: React.FC<KPOSalesmanMappingProps> = ({ user }) => {
    // Fix: Filter salesmen from MOCK_STAFF_LIST
    const [salesmen, setSalesmen] = useState<User[]>(MOCK_STAFF_LIST.filter(s => s.role === 'Salesman' && s.region === user.region));
    // Fix: Filter bookers from MOCK_STAFF_LIST and cast to AssignedBooker
    const [bookers, setBookers] = useState<AssignedBooker[]>(
        MOCK_STAFF_LIST.filter(b => b.role === 'Booker' && b.region === user.region).map(b => ({ ...b, assignedTo: null }))
    );
    const [selectedSalesmanId, setSelectedSalesmanId] = useState<string | null>(null);

    // Filter bookers based on region (already done via init) 
    // In a real app, this would be a useEffect fetching data

    const handleAssignmentChange = (bookerId: string, isChecked: boolean) => {
        if (!selectedSalesmanId) return;

        setBookers(currentBookers => 
            currentBookers.map(booker => {
                if (booker.id === bookerId) {
                    // If checking, assign to selected salesman
                    // If unchecking, set assignedTo to null (or leave as is depending on logic, here we unassign)
                    return { ...booker, assignedTo: isChecked ? selectedSalesmanId : null };
                }
                // If this booker was already assigned to the current salesman and we are clicking another salesman? 
                // The prompt says "One salesman can be linked to multiple order bookers".
                // Usually a booker is assigned to ONE salesman. 
                // If I assign Booker A to Salesman 2, they should be removed from Salesman 1.
                
                if (isChecked && booker.id === bookerId) {
                     return { ...booker, assignedTo: selectedSalesmanId };
                }
                
                return booker;
            })
        );
    };

    const selectedSalesman = salesmen.find(s => s.id === selectedSalesmanId);

    // Calculate stats
    const getAssignedCount = (sId: string) => bookers.filter(b => b.assignedTo === sId).length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-slate-900">Route Mapping</h2>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        {user.region} Region
                    </span>
                </div>
                <p className="text-slate-500 text-sm">Assign Order Bookers to Salesmen for automatic delivery routing.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
                
                {/* Left Panel: Salesmen List */}
                <div className="lg:col-span-1 glass-panel bg-white/80 rounded-2xl overflow-hidden flex flex-col border border-slate-200">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="font-bold text-slate-700">1. Select Salesman</h3>
                        <p className="text-xs text-slate-400">Choose a delivery person to assign routes.</p>
                    </div>
                    <div className="overflow-y-auto flex-1 p-2 space-y-2">
                        {salesmen.map(salesman => (
                            <div 
                                key={salesman.id}
                                onClick={() => setSelectedSalesmanId(salesman.id)}
                                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${
                                    selectedSalesmanId === salesman.id 
                                    ? 'bg-red-50 border-primary ring-1 ring-primary shadow-sm' 
                                    : 'bg-white border-slate-200 hover:border-red-200'
                                }`}
                            >
                                {/* Fix: Use avatarUrl instead of avatar */}
                                <div className="h-10 w-10 rounded-full bg-slate-200 bg-cover bg-center border border-white shadow-sm" style={{ backgroundImage: `url(${salesman.avatarUrl})` }}></div>
                                <div className="flex-1">
                                    <p className={`font-bold text-sm ${selectedSalesmanId === salesman.id ? 'text-primary' : 'text-slate-900'}`}>{salesman.name}</p>
                                    <p className="text-xs text-slate-500">{getAssignedCount(salesman.id)} Bookers Assigned</p>
                                </div>
                                <span className="material-symbols-outlined text-slate-300">chevron_right</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Panel: Booker Assignment */}
                <div className="lg:col-span-2 glass-panel bg-white rounded-2xl p-0 flex flex-col relative border border-slate-200 overflow-hidden">
                    {!selectedSalesmanId ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/30">
                            <span className="material-symbols-outlined text-4xl mb-2 opacity-20">alt_route</span>
                            <p>Select a salesman from the left to manage their route.</p>
                        </div>
                    ) : (
                        <>
                             <div className="p-6 border-b border-slate-100 bg-white">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">Assign Bookers to {selectedSalesman?.name}</h3>
                                        <p className="text-sm text-slate-500">Check the bookers whose orders will be delivered by this salesman.</p>
                                    </div>
                                    {/* Fix: Use avatarUrl instead of avatar */}
                                    <div className="h-10 w-10 rounded-full bg-slate-200 bg-cover bg-center border-2 border-white shadow-md" style={{ backgroundImage: `url(${selectedSalesman?.avatarUrl})` }}></div>
                                </div>
                             </div>

                             <div className="flex-1 overflow-y-auto p-2 bg-slate-50/30">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2">
                                    {bookers.map(booker => {
                                        const isAssignedToCurrent = booker.assignedTo === selectedSalesmanId;
                                        const isAssignedToOther = booker.assignedTo && booker.assignedTo !== selectedSalesmanId;
                                        const assignedSalesmanName = isAssignedToOther ? salesmen.find(s => s.id === booker.assignedTo)?.name : null;

                                        return (
                                            <label 
                                                key={booker.id} 
                                                className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                                                    isAssignedToCurrent 
                                                    ? 'bg-white border-primary shadow-md' 
                                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                                } ${isAssignedToOther ? 'opacity-70 bg-slate-50' : ''}`}
                                            >
                                                <div className="relative flex items-center">
                                                    <input 
                                                        type="checkbox" 
                                                        className="h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary transition-all"
                                                        checked={isAssignedToCurrent}
                                                        onChange={(e) => handleAssignmentChange(booker.id, e.target.checked)}
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <p className={`font-bold text-sm ${isAssignedToCurrent ? 'text-primary' : 'text-slate-700'}`}>
                                                        {booker.name}
                                                    </p>
                                                    {isAssignedToOther && (
                                                        <p className="text-xs text-orange-500 flex items-center gap-1 mt-0.5">
                                                            <span className="material-symbols-outlined text-[10px]">link</span>
                                                            Assigned to {assignedSalesmanName}
                                                        </p>
                                                    )}
                                                    {isAssignedToCurrent && (
                                                        <p className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
                                                            <span className="material-symbols-outlined text-[10px]">check_circle</span>
                                                            Linked
                                                        </p>
                                                    )}
                                                    {!booker.assignedTo && (
                                                        <p className="text-xs text-slate-400 mt-0.5">Unassigned</p>
                                                    )}
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                             </div>

                             <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
                                <button className="px-6 py-2 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-red-700 transition-all flex items-center gap-2">
                                    <span className="material-symbols-outlined">save</span>
                                    Save Mapping
                                </button>
                             </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default KPOSalesmanMapping;