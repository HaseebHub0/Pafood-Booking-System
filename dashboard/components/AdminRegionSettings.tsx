import React, { useState } from 'react';
import { View } from '../types';

interface AdminRegionSettingsProps {
    onNavigate: (view: View) => void;
    regionName: string;
}

const AdminRegionSettings: React.FC<AdminRegionSettingsProps> = ({ onNavigate, regionName }) => {
    const [formData, setFormData] = useState({
        name: regionName,
        code: regionName.substring(0, 3).toUpperCase() + '-01',
        manager: 'Ahmed Khan',
        monthlyTarget: 5000000,
        status: 'Active'
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        alert(`Settings saved for ${regionName}`);
        onNavigate('ADMIN_REGIONS');
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
                    <h2 className="text-3xl font-black tracking-tight text-slate-900">Region Settings</h2>
                    <p className="text-slate-500 text-sm">Configure parameters for {regionName}.</p>
                </div>
            </div>

            <div className="glass-panel rounded-2xl p-8 bg-white/90">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div>
                            <h4 className="font-bold text-slate-900">Operational Status</h4>
                            <p className="text-xs text-slate-500">Enable or disable all operations in this region.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={formData.status === 'Active'} onChange={e => setFormData({...formData, status: e.target.checked ? 'Active' : 'Inactive'})} className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600">Region Name</label>
                            <input 
                                type="text" 
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600">Region Code</label>
                            <input 
                                type="text" 
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
                                value={formData.code}
                                onChange={e => setFormData({...formData, code: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600">Regional Manager (KPO)</label>
                            <select 
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary appearance-none"
                                value={formData.manager}
                                onChange={e => setFormData({...formData, manager: e.target.value})}
                            >
                                <option>Ahmed Khan</option>
                                <option>Sarah Jenkins</option>
                                <option>Unassigned</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600">Monthly Revenue Target (PKR)</label>
                            <input 
                                type="number" 
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
                                value={formData.monthlyTarget}
                                onChange={e => setFormData({...formData, monthlyTarget: parseInt(e.target.value)})}
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                        <button 
                            type="button"
                            onClick={() => onNavigate('ADMIN_REGIONS')}
                            className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="px-8 py-3 rounded-xl bg-primary text-white font-bold hover:bg-red-700 transition-all shadow-lg shadow-primary/20"
                        >
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminRegionSettings;