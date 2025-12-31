import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { dataService } from '../dataService';

interface KPOUserManagementProps {
    user: User;
}

const KPOUserManagement: React.FC<KPOUserManagementProps> = ({ user }) => {
    const [staffList, setStaffList] = useState<User[]>([]);
    const [activeTab, setActiveTab] = useState<'Salesman' | 'Booker'>('Salesman');
    const [showForm, setShowForm] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [formRole, setFormRole] = useState<'Salesman' | 'Booker'>('Salesman'); // Store role when form opens
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
    const [staffDetails, setStaffDetails] = useState<any>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [unauthorizedDiscountData, setUnauthorizedDiscountData] = useState<any>(null);
    const [loadingDiscount, setLoadingDiscount] = useState(false);
    const [resettingMonth, setResettingMonth] = useState<string | null>(null);
    
    // Form State
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        maxDiscount: 0
    });

    // Load staff list on mount and when tab changes
    useEffect(() => {
        const loadStaff = async () => {
            try {
                setIsLoading(true);
                setError(null);
                
                // Get bookers or salesmen based on active tab
                const staff = activeTab === 'Booker' 
                    ? await dataService.getBranchBookers(user.branch || '')
                    : await dataService.getBranchSalesmen(user.branch || '');
                
                setStaffList(staff as User[]);
            } catch (err: any) {
                console.error('Error loading staff:', err);
                setError(err.message || 'Failed to load staff');
            } finally {
                setIsLoading(false);
            }
        };

        if (user.branch) {
            loadStaff();
        }
    }, [activeTab, user.branch]);

    const handleEdit = (staff: User) => {
        setEditingUserId(staff.id);
        setFormData({
            name: staff.name || '',
            email: staff.email || '',
            password: '', // Don't pre-fill password
            maxDiscount: staff.maxDiscount || 0
        });
        setShowForm(true);
        setError(null);
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingUserId(null);
        setFormRole('Salesman'); // Reset form role
        setError(null);
        setFormData({ name: '', email: '', password: '', maxDiscount: 0 });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!user.branch || !user.region) {
            alert('Error: KPO branch or region not found');
            return;
        }

        // Validate form data
        if (!formData.name || !formData.email) {
            setError('Please fill all required fields');
            return;
        }

        // Password only required for new users
        if (!editingUserId && !formData.password) {
            setError('Password is required for new users');
            return;
        }

        // Use formRole instead of activeTab to ensure correct role even if tab changed
        const currentRole = editingUserId ? activeTab : formRole; // For edit, use current tab; for create, use stored role
        
        // Validate booker-specific requirements
        if (currentRole === 'Booker') {
            if (formData.maxDiscount === 0 || formData.maxDiscount === null || formData.maxDiscount === undefined) {
                setError('Please set max discount percentage for booker');
                return;
            }
        }

        console.log('Form submission - activeTab:', activeTab, 'formRole:', formRole, 'currentRole:', currentRole, 'editingUserId:', editingUserId);

        try {
            setIsSubmitting(true);
            setError(null);

            // Normalize email (trim and lowercase)
            const normalizedEmail = formData.email.trim().toLowerCase();

            if (editingUserId) {
                // Update existing user
                console.log('Updating user:', editingUserId);
                
                const updateData: any = {
                    name: formData.name.trim(),
                    maxDiscount: currentRole === 'Booker' ? Number(formData.maxDiscount) : undefined
                };

                // Note: Email is disabled in edit mode, so we don't update it
                // If email update is needed, it requires Firebase Auth update which is more complex

                // Only update password if provided
                if (formData.password) {
                    // Note: Password update requires Firebase Auth update, not just Firestore
                    // For now, we'll skip password update via this method
                    // You might need to implement a separate password reset flow
                }

                await dataService.updateUser(editingUserId, updateData);
                console.log('User updated successfully');

            // Reload staff list based on the role that was created/updated
            const staff = currentRole === 'Booker' 
                ? await dataService.getBranchBookers(user.branch)
                : await dataService.getBranchSalesmen(user.branch);
                
                setStaffList(staff as User[]);
                handleCancel();
                alert(`${activeTab} updated successfully!`);
            } else {
                // Create new user
                console.log('Creating user with data:', {
                    name: formData.name,
                    email: formData.email,
                    role: activeTab,
                    region: user.region,
                    branch: user.branch
                });
                
                // Check if email already exists in Firestore
                try {
                    const existingUsers = await dataService.getAllUsers();
                    const emailExists = existingUsers.some(u => u.email?.toLowerCase() === normalizedEmail);
                    if (emailExists) {
                        setError('This email is already registered. Please use a different email.');
                        setIsSubmitting(false);
                        return;
                    }
                } catch (checkError: any) {
                    console.warn('Could not check existing users:', checkError);
                    // Continue with creation attempt
                }

                // Prepare user data with KPO's region and branch
                // Use formRole to ensure correct role even if user switched tabs
                const userRole = currentRole === 'Booker' ? 'Booker' : 'Salesman';
                console.log('Creating user with role:', userRole, 'formRole:', formRole, 'currentRole:', currentRole);
                
                const userData: any = {
                    name: formData.name.trim(),
                    email: normalizedEmail,
                    password: formData.password,
                    role: userRole, // Use the stored formRole
                    region: user.region,
                    branch: user.branch,
                    maxDiscount: currentRole === 'Booker' ? Number(formData.maxDiscount) : undefined,
                    createdBy: user.id // Track who created this user
                };
                
                console.log('User data being sent:', { ...userData, password: '***' });

                // If user has regionId, include it
                if ((user as any).regionId) {
                    userData.regionId = (user as any).regionId;
                }

                console.log('Calling dataService.createUser...');
                // Create user via dataService
                const createdUser = await dataService.createUser(userData);
                console.log('User created successfully:', createdUser);

                // Reload staff list based on the role that was created
                console.log('Reloading staff list for role:', currentRole);
                const staff = currentRole === 'Booker' 
                    ? await dataService.getBranchBookers(user.branch)
                    : await dataService.getBranchSalesmen(user.branch);
                
                console.log('Staff list reloaded:', staff.length);
                setStaffList(staff as User[]);
                handleCancel();
                alert(`${activeTab} created successfully!`);
            }
        } catch (err: any) {
            console.error('Error saving user:', err);
            setError(err.message || 'Failed to save user. Please check console for details.');
            setIsSubmitting(false);
        }
    };

    const handleViewDetails = async (staff: User) => {
        setSelectedStaff(staff);
        setLoadingDetails(true);
        setLoadingDiscount(true);
        try {
            // Normalize role to match expected format (capitalize first letter)
            const normalizedRole = staff.role 
                ? (staff.role.charAt(0).toUpperCase() + staff.role.slice(1).toLowerCase()) as 'Booker' | 'Salesman'
                : 'Salesman';
            
            console.log('Loading staff details for:', { id: staff.id, name: staff.name, role: staff.role, normalizedRole });
            const details = await dataService.getStaffMemberDetails(staff.id, normalizedRole);
            console.log('Staff details loaded:', details);
            setStaffDetails(details);
            
            // Load unauthorized discount data for bookers
            if (normalizedRole === 'Booker' || staff.role?.toLowerCase() === 'booker') {
                const discountData = await dataService.getBookerMonthlyUnauthorizedDiscount(staff.id);
                setUnauthorizedDiscountData(discountData);
            }
        } catch (err: any) {
            console.error('Error loading staff details:', err);
            setError(err.message || 'Failed to load staff details');
        } finally {
            setLoadingDetails(false);
            setLoadingDiscount(false);
        }
    };

    const handleCloseDetails = () => {
        setSelectedStaff(null);
        setStaffDetails(null);
        setUnauthorizedDiscountData(null);
    };

    const handleResetUnauthorizedDiscount = async (month: string) => {
        if (!selectedStaff) return;
        
        const confirmMessage = `Are you sure you want to reset unauthorized discount for ${month}?\n\nThis will mark the discount as deducted from salary. Amount: Rs. ${(unauthorizedDiscountData?.allMonths[month] || 0).toFixed(2)}`;
        
        if (typeof window !== 'undefined' && !window.confirm(confirmMessage)) {
            return;
        }

        try {
            setResettingMonth(month);
            await dataService.resetBookerUnauthorizedDiscount(selectedStaff.id, month, user.id);
            
            // Reload discount data
            const discountData = await dataService.getBookerMonthlyUnauthorizedDiscount(selectedStaff.id);
            setUnauthorizedDiscountData(discountData);
            
            if (typeof window !== 'undefined') {
                alert(`Unauthorized discount for ${month} has been reset successfully!`);
            }
        } catch (err: any) {
            console.error('Error resetting discount:', err);
            setError(err.message || 'Failed to reset unauthorized discount');
        } finally {
            setResettingMonth(null);
        }
    };

    const handleDelete = async (staff: User) => {
        const confirmMessage = `Are you sure you want to delete ${staff.name}?\n\nThis action cannot be undone and will remove all access for this ${activeTab.toLowerCase()}.`;
        
        // Use browser confirm dialog
        if (typeof window !== 'undefined' && !window.confirm(confirmMessage)) {
            return;
        }

        try {
            setIsLoading(true);
            setError(null);
            
            await dataService.deleteUser(staff.id);
            
            // Reload staff list
            const updatedStaff = activeTab === 'Booker' 
                ? await dataService.getBranchBookers(user.branch || '')
                : await dataService.getBranchSalesmen(user.branch || '');
            
            setStaffList(updatedStaff as User[]);
            
            // Show success message
            if (typeof window !== 'undefined') {
                alert(`${activeTab} "${staff.name}" deleted successfully!`);
            }
        } catch (err: any) {
            console.error('Error deleting user:', err);
            setError(err.message || 'Failed to delete user');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredStaff = staffList.filter(s => s.role === activeTab);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Staff Management</h2>
                    <p className="text-slate-500 text-sm">Create Salesmen & Bookers and assign them to specific areas.</p>
                </div>
                <button 
                    onClick={() => {
                        console.log('Add button clicked, activeTab:', activeTab);
                        setEditingUserId(null);
                        setFormRole(activeTab); // Store the role when form opens
                        setShowForm(true);
                        setError(null);
                        setFormData({ name: '', email: '', password: '', maxDiscount: 0 });
                    }}
                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
                >
                    <span className="material-symbols-outlined text-[20px]">person_add</span>
                    <span>Add {activeTab}</span>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
                <button 
                    onClick={() => setActiveTab('Salesman')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                        activeTab === 'Salesman' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Salesmen
                </button>
                <button 
                    onClick={() => setActiveTab('Booker')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                        activeTab === 'Booker' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Order Bookers
                </button>
            </div>

            {/* Creation/Edit Form Modal (Inline) */}
            {showForm && (
                <div className="glass-panel rounded-2xl p-6 bg-white border-l-4 border-l-primary animate-in fade-in slide-in-from-top-4">
                    <div className="flex justify-between items-start mb-6">
                        <h3 className="text-lg font-bold text-slate-900">
                            {editingUserId ? `Edit ${activeTab}` : `Create New ${activeTab}`}
                        </h3>
                        <button 
                            onClick={handleCancel}
                            className="text-slate-400 hover:text-slate-600"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">Full Name</label>
                            <input 
                                required
                                type="text" 
                                className="w-full rounded-xl bg-slate-50 border-slate-200 p-3 text-slate-900 focus:ring-primary focus:border-primary"
                                placeholder={`e.g. ${activeTab === 'Salesman' ? 'Ali Hassan' : 'Bilal Ahmed'}`}
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">Email / Username</label>
                            <input 
                                required
                                type="email" 
                                disabled={!!editingUserId}
                                className="w-full rounded-xl bg-slate-50 border-slate-200 p-3 text-slate-900 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="user@system.com"
                                value={formData.email}
                                onChange={e => setFormData({...formData, email: e.target.value})}
                            />
                            {editingUserId && (
                                <p className="text-[10px] text-slate-400">Email cannot be changed</p>
                            )}
                        </div>
                        
                        {formRole === 'Booker' && (
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-slate-500">Max Discount % Allowed</label>
                                <div className="relative">
                                    <input 
                                        required
                                        type="number" 
                                        min="0"
                                        max="100"
                                        className="w-full rounded-xl bg-slate-50 border-slate-200 p-3 text-slate-900 focus:ring-primary focus:border-primary pr-8"
                                        placeholder="0"
                                        value={formData.maxDiscount}
                                        onChange={e => setFormData({...formData, maxDiscount: Number(e.target.value)})}
                                    />
                                    <span className="absolute right-4 top-3.5 text-slate-400 font-bold">%</span>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">
                                Password {editingUserId && '(Leave empty to keep current)'}
                            </label>
                            <input 
                                required={!editingUserId}
                                type="password" 
                                className="w-full rounded-xl bg-slate-50 border-slate-200 p-3 text-slate-900 focus:ring-primary focus:border-primary"
                                placeholder={editingUserId ? "Enter new password (optional)" : "Enter password"}
                                value={formData.password}
                                onChange={e => setFormData({...formData, password: e.target.value})}
                            />
                        </div>

                        {error && (
                            <div className="md:col-span-2 rounded-xl bg-red-50 p-4 border border-red-200">
                                <p className="text-red-800 text-sm font-medium">{error}</p>
                            </div>
                        )}

                        <div className="md:col-span-2 flex justify-end gap-3 pt-4">
                            <button 
                                type="button" 
                                onClick={handleCancel}
                                disabled={isSubmitting}
                                className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="px-6 py-3 rounded-xl bg-primary text-white font-bold hover:bg-red-700 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting 
                                    ? (editingUserId ? 'Updating...' : 'Creating...') 
                                    : (editingUserId ? 'Update' : 'Create & Assign')
                                }
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {error && (
                <div className="rounded-xl bg-red-50 p-4 border border-red-200">
                    <p className="text-red-800 font-medium">Error: {error}</p>
                </div>
            )}

            {/* Staff List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    <div className="col-span-full py-12 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                        <p className="mt-4 text-slate-400">Loading staff...</p>
                    </div>
                ) : staffList.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        No {activeTab}s found. Create one to get started.
                    </div>
                ) : (
                    staffList.map((staff) => (
                    <div 
                        key={staff.id} 
                        className="glass-panel p-5 rounded-2xl bg-white relative overflow-hidden group hover:border-primary/30 transition-all cursor-pointer"
                        onClick={() => handleViewDetails(staff)}
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-full bg-slate-200 bg-cover bg-center border border-white shadow-sm" style={{ backgroundImage: `url(${staff.avatarUrl})` }}></div>
                                <div>
                                    <h3 className="font-bold text-slate-900">{staff.name}</h3>
                                    <p className="text-xs text-slate-500">{staff.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => handleEdit(staff)}
                                    className="text-slate-300 hover:text-primary transition-colors"
                                    title="Edit user"
                                >
                                    <span className="material-symbols-outlined">edit</span>
                                </button>
                                <button 
                                    onClick={() => handleDelete(staff)}
                                    className="text-slate-300 hover:text-red-500 transition-colors"
                                    title="Delete user"
                                >
                                    <span className="material-symbols-outlined">delete</span>
                                </button>
                            </div>
                        </div>
                        
                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                                <span className="text-xs font-bold text-slate-500 uppercase">Assigned Area</span>
                                <span className="text-sm font-bold text-slate-900 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[16px] text-primary">location_on</span>
                                    {staff.area}
                                </span>
                            </div>

                            {staff.role === 'Booker' && (
                                <div className="flex justify-between items-center p-2 rounded-lg bg-green-50 border border-green-100">
                                    <span className="text-xs font-bold text-green-700 uppercase">Max Discount</span>
                                    <span className="text-sm font-bold text-green-700">{staff.maxDiscount}%</span>
                                </div>
                            )}

                            {staff.role === 'Salesman' && (
                                <div className="flex justify-between items-center p-2 rounded-lg bg-blue-50 border border-blue-100">
                                    <span className="text-xs font-bold text-blue-700 uppercase">Delivery Route</span>
                                    <span className="text-xs font-bold text-blue-700">Active</span>
                                </div>
                            )}
                        </div>
                        
                        {staff.role === 'Salesman' && (
                             <div className="mt-4 pt-4 border-t border-slate-100">
                                <p className="text-xs text-slate-400 text-center">
                                    Automatically linked to all bookers in {staff.area}
                                </p>
                             </div>
                        )}
                    </div>
                    ))
                )}
            </div>

            {/* Staff Detail Modal */}
            {selectedStaff && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleCloseDetails}>
                    <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="h-16 w-16 rounded-full bg-slate-200 bg-cover bg-center border-2 border-white shadow-lg" style={{ backgroundImage: `url(${selectedStaff.avatarUrl})` }}></div>
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900">{selectedStaff.name}</h2>
                                    <p className="text-sm text-slate-500">{selectedStaff.email}</p>
                                    <p className="text-xs text-slate-400 mt-1">{selectedStaff.area} • {selectedStaff.role}</p>
                                </div>
                            </div>
                            <button 
                                onClick={handleCloseDetails}
                                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {loadingDetails ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                                </div>
                            ) : staffDetails ? (
                                <>
                                    {/* Performance Summary */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {selectedStaff.role === 'Booker' ? (
                                            <>
                                                <div className="glass-panel p-4 rounded-xl bg-blue-50 border border-blue-100">
                                                    <p className="text-xs font-bold text-blue-700 uppercase mb-1">Total Orders</p>
                                                    <p className="text-2xl font-black text-blue-900">{staffDetails.performance.totalOrders || 0}</p>
                                                </div>
                                                <div className="glass-panel p-4 rounded-xl bg-green-50 border border-green-100">
                                                    <p className="text-xs font-bold text-green-700 uppercase mb-1">Active Shops</p>
                                                    <p className="text-2xl font-black text-green-900">{staffDetails.performance.activeShopsCount || 0}</p>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="glass-panel p-4 rounded-xl bg-blue-50 border border-blue-100">
                                                <p className="text-xs font-bold text-blue-700 uppercase mb-1">Total Deliveries</p>
                                                <p className="text-2xl font-black text-blue-900">{staffDetails.performance.totalDeliveries || 0}</p>
                                            </div>
                                        )}
                                        <div className="glass-panel p-4 rounded-xl bg-primary/10 border border-primary/20">
                                            <p className="text-xs font-bold text-primary uppercase mb-1">Total Sales</p>
                                            <p className="text-2xl font-black text-primary">Rs. {(staffDetails.performance.totalSalesAmount || 0).toLocaleString()}</p>
                                        </div>
                                        <div className="glass-panel p-4 rounded-xl bg-purple-50 border border-purple-100">
                                            <p className="text-xs font-bold text-purple-700 uppercase mb-1">Completion Rate</p>
                                            <p className="text-2xl font-black text-purple-900">{(staffDetails.performance.completionRate || 0).toFixed(1)}%</p>
                                        </div>
                                    </div>

                                    {/* Unauthorized Discount Section (Bookers only) */}
                                    {selectedStaff.role === 'Booker' && (
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 mb-4">Unauthorized Discounts</h3>
                                            {loadingDiscount ? (
                                                <div className="text-center py-8">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                                                </div>
                                            ) : unauthorizedDiscountData && unauthorizedDiscountData.currentMonthTotal > 0 ? (
                                                <div className="space-y-4">
                                                    <div className="glass-panel p-4 rounded-xl bg-red-50 border border-red-200">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <p className="text-sm font-bold text-red-700 uppercase">Current Month ({unauthorizedDiscountData.currentMonth})</p>
                                                            <p className="text-xl font-black text-red-900">Rs. {unauthorizedDiscountData.currentMonthTotal.toFixed(2)}</p>
                                                        </div>
                                                        <p className="text-xs text-red-600 mb-3">This amount will be deducted from salary</p>
                                                        <button
                                                            onClick={() => handleResetUnauthorizedDiscount(unauthorizedDiscountData.currentMonth)}
                                                            disabled={resettingMonth === unauthorizedDiscountData.currentMonth}
                                                            className="w-full py-2 px-4 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                        >
                                                            {resettingMonth === unauthorizedDiscountData.currentMonth ? 'Resetting...' : 'Reset After Salary Deduction'}
                                                        </button>
                                                    </div>
                                                    
                                                    {Object.keys(unauthorizedDiscountData.allMonths).length > 1 && (
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-700 mb-2">All Months:</p>
                                                            <div className="space-y-2">
                                                                {Object.entries(unauthorizedDiscountData.allMonths).map(([month, amount]: [string, any]) => (
                                                                    month !== unauthorizedDiscountData.currentMonth && (
                                                                        <div key={month} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                                                                            <span className="text-sm font-medium text-slate-700">{month}</span>
                                                                            <div className="flex items-center gap-3">
                                                                                <span className="text-sm font-bold text-slate-900">Rs. {amount.toFixed(2)}</span>
                                                                                <button
                                                                                    onClick={() => handleResetUnauthorizedDiscount(month)}
                                                                                    disabled={resettingMonth === month}
                                                                                    className="px-3 py-1 rounded-lg bg-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                                                >
                                                                                    {resettingMonth === month ? 'Resetting...' : 'Reset'}
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm font-bold text-slate-700">Total Unauthorized Discount:</span>
                                                            <span className="text-lg font-black text-slate-900">Rs. {unauthorizedDiscountData.totalUnauthorizedDiscount.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                                                    <span className="material-symbols-outlined text-4xl mb-2 opacity-20">check_circle</span>
                                                    <p>No unauthorized discounts recorded</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Recent Activities */}
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 mb-4">Recent Activities</h3>
                                        {staffDetails.recentActivities.length > 0 ? (
                                            <div className="space-y-2">
                                                {staffDetails.recentActivities.map((activity: any, idx: number) => (
                                                    <div key={idx} className="glass-panel p-4 rounded-xl bg-white border border-slate-100 flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                                                                activity.type === 'order' ? 'bg-blue-50' : 'bg-green-50'
                                                            }`}>
                                                                <span className={`material-symbols-outlined text-[20px] ${
                                                                    activity.type === 'order' ? 'text-blue-600' : 'text-green-600'
                                                                }`}>
                                                                    {activity.type === 'order' ? 'receipt_long' : 'local_shipping'}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-900">{activity.shopName || 'Unknown Shop'}</p>
                                                                <p className="text-xs text-slate-500">{activity.orderNumber}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="font-bold text-slate-900">Rs. {activity.amount.toLocaleString()}</p>
                                                            <p className="text-xs text-slate-500">
                                                                {activity.date?.toDate ? new Date(activity.date.toDate()).toLocaleDateString() : 
                                                                 activity.date ? new Date(activity.date).toLocaleDateString() : 'N/A'}
                                                            </p>
                                                            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                activity.status === 'delivered' ? 'bg-green-50 text-green-600' :
                                                                activity.status === 'submitted' ? 'bg-yellow-50 text-yellow-600' :
                                                                'bg-slate-50 text-slate-600'
                                                            }`}>
                                                                {activity.status.toUpperCase()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-slate-400">
                                                <span className="material-symbols-outlined text-4xl mb-2 opacity-20">inbox</span>
                                                <p>No recent activities</p>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-12 text-slate-400">
                                    <p>Failed to load details</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KPOUserManagement;