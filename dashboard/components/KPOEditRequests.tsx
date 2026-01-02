import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { dataService } from '../dataService';
import { formatDate, formatCurrency } from '../utils/dateUtils';

interface KPOEditRequestsProps {
    user: User;
}

interface OrderEditRequest {
    id: string;
    orderNumber: string;
    shopName: string;
    bookerName: string;
    bookerId: string;
    branch: string;
    status: string;
    items: any[];
    subtotal: number;
    totalDiscount: number;
    grandTotal: number;
    createdAt: any;
    updatedAt: any;
    notes?: string;
}

const KPOEditRequests: React.FC<KPOEditRequestsProps> = ({ user }) => {
    const [editRequests, setEditRequests] = useState<OrderEditRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedRequest, setSelectedRequest] = useState<OrderEditRequest | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState<string>('');

    useEffect(() => {
        loadEditRequests();
    }, [user.branch]);

    const loadEditRequests = async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Get all orders for this branch
            const allOrders = await dataService.getBranchOrders(user.branch || '');
            
            // Filter orders with edit_requested status
            const requests = allOrders
                .filter((order: any) => order.status === 'edit_requested' || order.status === 'editRequested')
                .map((order: any) => ({
                    id: order.id,
                    orderNumber: order.orderNumber || order.id,
                    shopName: order.shopName || 'Unknown Shop',
                    bookerName: order.bookerName || 'Unknown Booker',
                    bookerId: order.bookerId || '',
                    branch: order.branch || user.branch || '',
                    status: order.status,
                    items: order.items || [],
                    subtotal: order.subtotal || 0,
                    totalDiscount: order.totalDiscount || 0,
                    grandTotal: order.grandTotal || order.totalAmount || 0,
                    createdAt: order.createdAt,
                    updatedAt: order.updatedAt,
                    notes: order.notes
                }));

            setEditRequests(requests);
        } catch (err: any) {
            console.error('Error loading edit requests:', err);
            setError(err.message || 'Failed to load edit requests');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApprove = async (request: OrderEditRequest) => {
        if (!window.confirm(`Approve edit request for order ${request.orderNumber}?\n\nThis will change the order status back to "submitted" and allow the booker to edit it.`)) {
            return;
        }

        try {
            setProcessingId(request.id);
            
            // Update order status to 'submitted' and set editApproved flag (allows editing)
            // @ts-ignore: CDN import
            const { doc, updateDoc } = await import('firebase/firestore');
            const { db } = await import('../firebase');
            const orderRef = doc(db, 'orders', request.id);
            await updateDoc(orderRef, {
                status: 'submitted',
                editApproved: true,
                editApprovedAt: new Date().toISOString(),
                editApprovedBy: user.id || 'kpo',
                updatedAt: new Date().toISOString()
            });
            
            // Also call updateOrderStatus for activity logging
            await dataService.updateOrderStatus(request.id, 'submitted', user.id || 'kpo');

            // Log activity
            await dataService.logActivity(
                user.id || 'kpo',
                `Approved edit request for order ${request.orderNumber} by ${request.bookerName}`
            );

            // Reload requests
            await loadEditRequests();
            setSelectedRequest(null);
            
            alert(`Edit request for order ${request.orderNumber} has been approved!`);
        } catch (err: any) {
            console.error('Error approving edit request:', err);
            alert(`Failed to approve request: ${err.message || 'Unknown error'}`);
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (request: OrderEditRequest) => {
        if (!rejectReason.trim()) {
            alert('Please provide a reason for rejection');
            return;
        }

        if (!window.confirm(`Reject edit request for order ${request.orderNumber}?\n\nReason: ${rejectReason}`)) {
            return;
        }

        try {
            setProcessingId(request.id);
            
            // Update order status to 'rejected' with rejection note
            await dataService.updateOrderStatus(request.id, 'rejected', user.id || 'kpo');
            
            // Store rejection reason in order notes
            try {
                // @ts-ignore: CDN import
                const { doc, updateDoc } = await import('firebase/firestore');
                const { db } = await import('../firebase');
                const orderRef = doc(db, 'orders', request.id);
                await updateDoc(orderRef, {
                    rejectionReason: rejectReason,
                    notes: (request.notes || '') + `\n[REJECTED: ${rejectReason}]`,
                    updatedAt: new Date().toISOString()
                });
            } catch (err) {
                console.warn('Could not update rejection reason:', err);
            }

            // Log activity
            await dataService.logActivity(
                user.id || 'kpo',
                `Rejected edit request for order ${request.orderNumber} by ${request.bookerName}. Reason: ${rejectReason}`
            );

            // Reload requests
            await loadEditRequests();
            setSelectedRequest(null);
            setRejectReason('');
            
            alert(`Edit request for order ${request.orderNumber} has been rejected.`);
        } catch (err: any) {
            console.error('Error rejecting edit request:', err);
            alert(`Failed to reject request: ${err.message || 'Unknown error'}`);
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Order Edit Requests</h2>
                    <p className="text-slate-500 text-sm">Review and approve/reject order edit requests from bookers</p>
                </div>
                <button
                    onClick={loadEditRequests}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
                >
                    <span className="material-symbols-outlined text-[18px]">refresh</span>
                    Refresh
                </button>
            </div>

            {error && (
                <div className="rounded-xl bg-red-50 p-4 border border-red-200">
                    <p className="text-red-800 font-medium">Error: {error}</p>
                </div>
            )}

            {isLoading ? (
                <div className="glass-panel rounded-3xl bg-white p-12 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            ) : editRequests.length === 0 ? (
                <div className="glass-panel rounded-3xl bg-white p-12 text-center text-slate-400">
                    <span className="material-symbols-outlined text-4xl mb-2">check_circle</span>
                    <p>No pending edit requests</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {editRequests.map((request) => (
                        <div
                            key={request.id}
                            className="glass-panel rounded-xl bg-white border border-slate-200 p-6 hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="px-3 py-1 rounded-lg bg-yellow-100 text-yellow-700 text-xs font-bold">
                                            EDIT REQUESTED
                                        </div>
                                        <span className="font-mono font-bold text-slate-900">{request.orderNumber}</span>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <p className="text-xs text-slate-400 font-bold uppercase mb-1">Shop</p>
                                            <p className="text-sm font-bold text-slate-900">{request.shopName}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400 font-bold uppercase mb-1">Booker</p>
                                            <p className="text-sm font-bold text-slate-900">{request.bookerName}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400 font-bold uppercase mb-1">Items</p>
                                            <p className="text-sm font-bold text-slate-900">{request.items.length} items</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400 font-bold uppercase mb-1">Total</p>
                                            <p className="text-sm font-black text-primary">{formatCurrency(request.grandTotal)}</p>
                                        </div>
                                    </div>

                                    {request.notes && (
                                        <div className="mb-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
                                            <p className="text-xs text-slate-400 font-bold uppercase mb-1">Notes</p>
                                            <p className="text-sm text-slate-700">{request.notes}</p>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                                        <span>Requested: {request.createdAt ? (request.createdAt.toDate ? formatDate(request.createdAt.toDate()) : formatDate(new Date(request.createdAt))) : 'N/A'}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => setSelectedRequest(selectedRequest?.id === request.id ? null : request)}
                                        className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200 transition-colors"
                                    >
                                        {selectedRequest?.id === request.id ? 'Hide Details' : 'View Details'}
                                    </button>
                                    <button
                                        onClick={() => handleApprove(request)}
                                        disabled={processingId === request.id}
                                        className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {processingId === request.id ? 'Processing...' : 'Approve'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedRequest(request);
                                            const reason = window.prompt('Enter rejection reason:');
                                            if (reason) {
                                                setRejectReason(reason);
                                                setTimeout(() => handleReject(request), 100);
                                            }
                                        }}
                                        disabled={processingId === request.id}
                                        className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>

                            {selectedRequest?.id === request.id && (
                                <div className="mt-6 pt-6 border-t border-slate-200">
                                    <h4 className="text-sm font-bold text-slate-900 mb-3">Order Items</h4>
                                    <div className="space-y-2">
                                        {request.items.map((item: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                                                <div className="flex-1">
                                                    <p className="text-sm font-bold text-slate-900">{item.productName || 'Unknown Product'}</p>
                                                    <p className="text-xs text-slate-500">
                                                        Qty: {item.quantity} × {formatCurrency(item.unitPrice || item.price || 0)}
                                                        {item.discountPercent > 0 && (
                                                            <span className="ml-2 text-red-600">
                                                                ({item.discountPercent}% discount)
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-slate-900">{formatCurrency(item.finalAmount || item.lineTotal || 0)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    <div className="mt-4 pt-4 border-t border-slate-200">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm text-slate-600">Subtotal</span>
                                            <span className="text-sm font-bold text-slate-900">{formatCurrency(request.subtotal)}</span>
                                        </div>
                                        {request.totalDiscount > 0 && (
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm text-slate-600">Total Discount</span>
                                                <span className="text-sm font-bold text-red-600">-{formatCurrency(request.totalDiscount)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                                            <span className="text-base font-bold text-slate-900">Grand Total</span>
                                            <span className="text-base font-black text-primary">{formatCurrency(request.grandTotal)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default KPOEditRequests;

