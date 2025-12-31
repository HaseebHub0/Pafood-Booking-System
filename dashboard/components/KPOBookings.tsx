import React, { useState, useEffect } from 'react';
import { User, Booking, Product } from '../types';
import { dataService } from '../dataService';
import { formatCurrency } from '../utils/dateUtils';

interface KPOBookingsProps {
    user: User;
}

// Helper to get amount from order (handles both totalAmount and grandTotal)
const getOrderAmount = (order: any): number => {
    return order?.grandTotal ?? order?.totalAmount ?? 0;
};

// Helper to format date from Firestore timestamp or string
const formatOrderDate = (order: any): string => {
    const dateVal = order?.createdAt || order?.date;
    if (!dateVal) return 'N/A';
    
    // Handle Firestore Timestamp
    if (dateVal?.toDate) {
        return dateVal.toDate().toLocaleDateString();
    }
    // Handle string date
    if (typeof dateVal === 'string') {
        return new Date(dateVal).toLocaleDateString();
    }
    return 'N/A';
};

// Helper to normalize status for display
// Maps Firebase OrderStatus values to display-friendly names
const normalizeStatus = (status: string): string => {
    if (!status) return 'submitted';
    const s = status.toLowerCase();
    // New/pending orders from booker
    if (s === 'new' || s === 'submitted' || s === 'draft') return 'submitted';
    // KPO has approved/finalized
    if (s === 'approved' || s === 'finalized') return 'approved';
    // Bill generated
    if (s === 'billed') return 'billed';
    // Load form generated, ready for salesman
    if (s === 'dispatched' || s === 'load_form_ready' || s === 'assigned') return 'dispatched';
    // Salesman has delivered
    if (s === 'delivered') return 'delivered';
    return s;
};

const KPOBookings: React.FC<KPOBookingsProps> = ({ user }) => {
    const [bookings, setBookings] = useState<any[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [bills, setBills] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
    const [expandedBooker, setExpandedBooker] = useState<string | null>(null);

    // New item state
    const [newItemId, setNewItemId] = useState('');
    const [newItemQty, setNewItemQty] = useState(1);

    // Filter states
    const [statusFilter, setStatusFilter] = useState('All');
    const [bookerFilter, setBookerFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    // Load real orders and products from Firebase
    useEffect(() => {
        const loadData = async () => {
            if (!user.branch) {
                console.error('KPOBookings: No branch assigned to KPO user');
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                console.log('KPOBookings: Loading orders and products for branch:', user.branch);
                
                // Load orders, products, and bills in parallel
                const [branchOrders, productsData, billsData] = await Promise.all([
                    dataService.getBranchOrders(user.branch),
                    dataService.getAllProducts(),
                    dataService.getBillsByBranch(user.branch)
                ]);
                
                console.log('KPOBookings: Loaded orders:', branchOrders.length);
                console.log('KPOBookings: Loaded products:', productsData.length);
                console.log('KPOBookings: Loaded bills:', billsData.length);
                
                setBookings(branchOrders);
                setProducts(productsData);
                setBills(billsData);
            } catch (error: any) {
                console.error('KPOBookings: Error loading data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [user.branch]);

    // Get unique bookers from bookings
    const uniqueBookers = React.useMemo(() => {
        const bookers = new Set<string>();
        bookings.forEach(b => {
            const bookerName = b.bookerName || b.booker?.name || 'N/A';
            if (bookerName !== 'N/A') {
                bookers.add(bookerName);
            }
        });
        return Array.from(bookers).sort();
    }, [bookings]);

    // Filter bookings by normalized status, booker, and search query
    const filteredBookings = React.useMemo(() => {
        let filtered = bookings;

        // Filter by status
        if (statusFilter !== 'All') {
            filtered = filtered.filter(b => normalizeStatus(b.status) === statusFilter.toLowerCase());
        }

        // Filter by booker
        if (bookerFilter !== 'All') {
            filtered = filtered.filter(b => {
                const bookerName = b.bookerName || b.booker?.name || 'N/A';
                return bookerName === bookerFilter;
            });
        }

        // Filter by search query (order number, shop name, or booker name)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(b => {
                const orderNum = (b.orderNumber || b.id || '').toLowerCase();
                const shopName = (b.shopName || '').toLowerCase();
                const bookerName = (b.bookerName || b.booker?.name || '').toLowerCase();
                return orderNum.includes(query) || shopName.includes(query) || bookerName.includes(query);
            });
        }

        return filtered;
    }, [bookings, statusFilter, bookerFilter, searchQuery]);

    const handleUpdateQty = (idx: number, newQty: number) => {
        if (!selectedBooking) return;
        const updatedItems = [...selectedBooking.items];
        updatedItems[idx].qty = newQty;
        // Recalculate total
        const newTotal = updatedItems.reduce((acc, item) => acc + (item.qty * item.price), 0);
        setSelectedBooking({ ...selectedBooking, items: updatedItems, totalAmount: newTotal });
    };

    const handleRemoveItem = (idx: number) => {
        if (!selectedBooking) return;
        const updatedItems = selectedBooking.items.filter((_, i) => i !== idx);
        const newTotal = updatedItems.reduce((acc, item) => acc + (item.qty * item.price), 0);
        setSelectedBooking({ ...selectedBooking, items: updatedItems, totalAmount: newTotal });
    };

    const handleAddItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBooking || !newItemId) return;

        const product = products.find(p => p.id === newItemId);
        if (!product) {
            alert('Product not found. Please select a valid product.');
            return;
        }

        const updatedItems = [...selectedBooking.items, { 
            productId: product.id,
            productName: product.name, 
            qty: newItemQty, 
            price: Number(product.price) 
        }];

        const newTotal = updatedItems.reduce((acc, item) => acc + (item.qty * item.price), 0);
        setSelectedBooking({ ...selectedBooking, items: updatedItems, totalAmount: newTotal });
        
        // Reset form
        setNewItemId('');
        setNewItemQty(1);
    };

    const handleFinalize = async () => {
        if (!selectedBooking) return;
        
        try {
            // Save to Firebase - update status to 'finalized' (which means approved)
            await dataService.updateOrderStatus(selectedBooking.id, 'finalized', user.id);
            console.log('Order approved and saved to Firebase:', selectedBooking.id);
            
            // Update local state
            const updatedList = bookings.map(b => 
                b.id === selectedBooking.id 
                    ? { ...selectedBooking, status: 'finalized' } 
                    : b
            );
            setBookings(updatedList);
            setSelectedBooking(null);
            alert(`Order ${selectedBooking.orderNumber || selectedBooking.id} Approved! Ready for billing.`);
        } catch (error: any) {
            console.error('Error approving order:', error);
            alert('Failed to approve order. Please try again.');
        }
    };

    const handleGenerateBill = async (bookingId: string) => {
        try {
            // Save to Firebase
            await dataService.updateOrderStatus(bookingId, 'billed', user.id);
            console.log('Bill generated and saved to Firebase:', bookingId);
            
            const updatedList = bookings.map(b => 
                b.id === bookingId ? { ...b, status: 'billed' } : b
            );
            setBookings(updatedList);
            setSelectedBooking(null);
            alert(`Bill Generated for order. Sent to printing.`);
        } catch (error: any) {
            console.error('Error generating bill:', error);
            alert('Failed to generate bill. Please try again.');
        }
    };

    const handleGenerateLoadForm = async (bookingId: string) => {
        try {
            // Save to Firebase - use 'load_form_ready' which is a valid OrderStatus
            await dataService.updateOrderStatus(bookingId, 'load_form_ready', user.id);
            console.log('Load form generated and saved to Firebase:', bookingId);
            
            const updatedList = bookings.map(b => 
                b.id === bookingId ? { ...b, status: 'load_form_ready' } : b
            );
            setBookings(updatedList);
            
            // Get order, delivery, and load form data for PDF
            const booking = updatedList.find(b => b.id === bookingId);
            if (booking) {
                // Create a mock load form structure from order items
                const loadForm = {
                    id: `LF-${bookingId}`,
                    loadFormNumber: `LF-${booking.orderNumber || bookingId}`,
                    items: (booking.items || []).map((item: any) => ({
                        productName: item.productName || item.productNameEn || 'N/A',
                        quantity: item.quantity || 0,
                        unit: item.unit || 'Pcs'
                    })),
                    notes: ''
                };
                
                // Create a mock delivery structure
                const delivery = {
                    id: `DEL-${bookingId}`,
                    salesmanName: booking.salesmanName || 'N/A',
                    salesmanPhone: booking.salesmanPhone || 'N/A',
                    shopAddress: booking.shopAddress || 'N/A',
                    createdAt: booking.createdAt || new Date().toISOString()
                };
                
                // Generate and print PDF load form
                printLoadForm(loadForm, delivery, booking);
            }
            
            setSelectedBooking(null);
        } catch (error: any) {
            console.error('Error generating load form:', error);
            alert('Failed to generate load form. Please try again.');
        }
    };

    // Calculate booker-wise booking summary
    const bookerBookingSummary = React.useMemo(() => {
        const bookerMap = new Map<string, {
            bookerId: string;
            bookerName: string;
            totalBills: number;
            totalBookingAmount: number;
            bills: Array<{
                billNumber: string;
                orderNumber: string;
                customerName: string;
                totalAmount: number;
                paymentStatus: string;
            }>;
        }>();

        bills.forEach((bill: any) => {
            const bookerId = bill.bookerId || 'unknown';
            const bookerName = bill.bookerName || 'Unknown Booker';
            
            if (!bookerMap.has(bookerId)) {
                bookerMap.set(bookerId, {
                    bookerId,
                    bookerName,
                    totalBills: 0,
                    totalBookingAmount: 0,
                    bills: [],
                });
            }
            
            const summary = bookerMap.get(bookerId)!;
            summary.totalBills++;
            summary.totalBookingAmount += bill.totalAmount || 0;
            summary.bills.push({
                billNumber: bill.billNumber,
                orderNumber: bill.orderNumber,
                customerName: bill.customerName || bill.shopName,
                totalAmount: bill.totalAmount,
                paymentStatus: bill.paymentStatus === 'PAID' ? 'PAID' : 
                              bill.paymentStatus === 'PARTIALLY_PAID' ? 'PARTIAL' : 'CREDIT',
            });
        });

        return Array.from(bookerMap.values()).sort((a, b) => 
            b.totalBookingAmount - a.totalBookingAmount
        );
    }, [bills]);

    return (
        <div className="space-y-3 md:space-y-4">
             <div className="flex flex-col gap-0.5">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">Order Processing</h2>
                <p className="text-[11px] sm:text-xs text-slate-500">Review, Edit, and Finalize bookings for {user.region}.</p>
            </div>

            {/* Total Booking Section */}
            {bookerBookingSummary.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3">
                    <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-primary text-base">receipt_long</span>
                        <span className="truncate">Total Booking - Booker Summary</span>
                    </h3>
                    <div className="space-y-2">
                        {bookerBookingSummary.map((booker) => (
                            <div key={booker.bookerId} className="border border-slate-200 rounded-md overflow-hidden">
                                <div
                                    className="bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2 cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-colors"
                                    onClick={() => setExpandedBooker(expandedBooker === booker.bookerId ? null : booker.bookerId)}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                                                {booker.bookerName.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-gray-900 text-xs truncate">{booker.bookerName}</p>
                                                <p className="text-[10px] text-gray-600">{booker.totalBills} bill{booker.totalBills !== 1 ? 's' : ''}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <div className="text-right">
                                                <p className="text-[10px] text-gray-600">Total Booking</p>
                                                <p className="text-sm font-bold text-gray-900 whitespace-nowrap">
                                                    {formatCurrency(booker.totalBookingAmount)}
                                                </p>
                                            </div>
                                            <span className="text-gray-400 text-xs">
                                                {expandedBooker === booker.bookerId ? '▼' : '▶'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {expandedBooker === booker.bookerId && (
                                    <div className="border-t border-slate-200 bg-white">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Bill Number</th>
                                                        <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Customer Name</th>
                                                        <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase">Amount</th>
                                                        <th className="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-500 uppercase">Payment Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200">
                                                    {booker.bills.map((bill, idx) => (
                                                        <tr key={idx} className="hover:bg-gray-50">
                                                            <td className="px-2 py-1.5 font-medium text-gray-900 text-xs whitespace-nowrap">{bill.billNumber}</td>
                                                            <td className="px-2 py-1.5 text-gray-700 text-xs truncate max-w-[150px]">{bill.customerName}</td>
                                                            <td className="px-2 py-1.5 text-right font-medium text-gray-900 text-xs whitespace-nowrap">{formatCurrency(bill.totalAmount)}</td>
                                                            <td className="px-2 py-1.5 text-center">
                                                                <span className={`inline-flex px-1.5 py-0.5 text-[9px] font-semibold rounded-full ${
                                                                    bill.paymentStatus === 'PAID' 
                                                                        ? 'bg-green-100 text-green-800' 
                                                                        : bill.paymentStatus === 'PARTIAL'
                                                                        ? 'bg-yellow-100 text-yellow-800'
                                                                        : 'bg-red-100 text-red-800'
                                                                }`}>
                                                                    {bill.paymentStatus}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Filters and Search */}
            <div className="space-y-2">
                {/* Search and Booker Filter Row */}
                <div className="flex gap-2 items-center">
                    {/* Search Input */}
                    <div className="flex-1 relative min-w-0">
                        <span className="material-symbols-outlined absolute left-2 top-1/2 transform -translate-y-1/2 text-slate-400 text-sm">
                            search
                        </span>
                        <input
                            type="text"
                            placeholder="Search by order number, shop name, or booker..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        />
                    </div>
                    {/* Booker Filter Dropdown */}
                    <div className="w-36 sm:w-40 flex-shrink-0">
                        <select
                            value={bookerFilter}
                            onChange={(e) => setBookerFilter(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs rounded-md border border-slate-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white"
                        >
                            <option value="All">All Bookers</option>
                            {uniqueBookers.map(booker => (
                                <option key={booker} value={booker}>{booker}</option>
                            ))}
                        </select>
                    </div>
                </div>
                {/* Status filters matching normalized statuses */}
                <div className="flex gap-1.5 flex-wrap">
                    {['All', 'Submitted', 'Approved', 'Billed', 'Dispatched', 'Delivered'].map(status => (
                        <button 
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors whitespace-nowrap ${
                                statusFilter === status 
                                ? 'bg-primary text-white shadow-sm' 
                                : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
                            }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {/* Split View: List & Detail */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 h-[600px]">
                
                {/* List Panel */}
                <div className="lg:col-span-1 glass-panel bg-white/80 rounded-lg overflow-hidden flex flex-col">
                    <div className="p-2.5 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="font-semibold text-slate-700 text-xs">Orders ({filteredBookings.length})</h3>
                    </div>
                    <div className="overflow-y-auto flex-1 p-1 space-y-1">
                        {isLoading && (
                            <div className="text-center p-6">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                                <p className="mt-2 text-slate-400 text-[10px]">Loading orders...</p>
                            </div>
                        )}
                        {!isLoading && filteredBookings.length === 0 && (
                            <div className="text-center p-6 text-slate-400 text-xs">No orders found.</div>
                        )}
                        {filteredBookings.map(booking => {
                            const status = normalizeStatus(booking.status);
                            return (
                            <div 
                                key={booking.id}
                                onClick={() => setSelectedBooking(booking)}
                                className={`p-2 rounded-md border cursor-pointer transition-all hover:shadow-sm ${
                                    selectedBooking?.id === booking.id 
                                    ? 'bg-red-50 border-primary ring-1 ring-primary' 
                                    : 'bg-white border-slate-200 hover:border-red-200'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-0.5 gap-1">
                                    <span className="font-semibold text-slate-900 text-[10px] truncate flex-1">{booking.orderNumber || booking.id?.slice(0, 8)}</span>
                                    <span className={`text-[9px] uppercase font-semibold px-1 py-0.5 rounded-full flex-shrink-0 ${
                                        status === 'submitted' ? 'bg-blue-100 text-blue-600' :
                                        status === 'approved' ? 'bg-yellow-100 text-yellow-600' :
                                        status === 'billed' ? 'bg-purple-100 text-purple-600' :
                                        status === 'dispatched' ? 'bg-orange-100 text-orange-600' :
                                        status === 'delivered' ? 'bg-green-100 text-green-600' :
                                        'bg-slate-100 text-slate-600'
                                    }`}>{status}</span>
                                </div>
                                <div className="text-[9px] text-slate-500 mb-1">
                                    <p className="font-medium text-slate-700 truncate">{booking.shopName || 'Unknown Shop'}</p>
                                    <p className="truncate">{booking.bookerName || 'N/A'}</p>
                                </div>
                                <div className="flex justify-between items-center text-[9px]">
                                    <span className="font-mono">{formatOrderDate(booking)}</span>
                                    <span className="font-bold text-slate-900">PKR {getOrderAmount(booking).toLocaleString()}</span>
                                </div>
                            </div>
                        );})}
                    </div>
                </div>

                {/* Detail Panel (Workspace) */}
                <div className="lg:col-span-2 glass-panel bg-white rounded-lg p-3 flex flex-col relative">
                    {!selectedBooking ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                            <span className="material-symbols-outlined text-3xl mb-1.5 opacity-20">receipt_long</span>
                            <p className="text-xs">Select an order to view details</p>
                        </div>
                    ) : (
                        <>
                             <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-3 gap-3">
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-sm font-bold text-slate-900 truncate">{selectedBooking.shopName || 'Unknown Shop'}</h2>
                                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">{selectedBooking.area || selectedBooking.shopArea || 'N/A'} | Booker: {selectedBooking.bookerName || 'N/A'}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total Amount</p>
                                    <p className="text-lg font-bold text-primary whitespace-nowrap">PKR {getOrderAmount(selectedBooking).toLocaleString()}</p>
                                </div>
                             </div>

                             {/* Editable Items Table */}
                             <div className="flex-1 overflow-y-auto mb-3 pr-1">
                                <table className="w-full text-xs text-left">
                                    <thead className="text-[10px] text-slate-500 uppercase bg-slate-50 sticky top-0">
                                        <tr>
                                            <th className="px-2 py-1.5">Item</th>
                                            <th className="px-2 py-1.5 w-20">Price</th>
                                            <th className="px-2 py-1.5 w-20">Qty</th>
                                            <th className="px-2 py-1.5 w-20">Discount</th>
                                            <th className="px-2 py-1.5 text-right">Total</th>
                                            {normalizeStatus(selectedBooking.status) === 'submitted' && <th className="px-1 py-1.5 w-8"></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(selectedBooking.items || []).map((item: any, idx: number) => {
                                            const qty = item.quantity ?? item.qty ?? 0;
                                            const price = item.unitPrice ?? item.price ?? 0;
                                            const lineTotal = item.lineTotal ?? item.finalAmount ?? (qty * price);
                                            const discount = item.discountPercent ?? 0;
                                            
                                            return (
                                            <tr key={idx} className="group hover:bg-slate-50">
                                                <td className="px-2 py-2 font-medium text-slate-900 text-xs truncate max-w-[200px]">{item.productName}</td>
                                                <td className="px-2 py-2 text-xs whitespace-nowrap">{price.toLocaleString()}</td>
                                                <td className="px-2 py-2">
                                                    {normalizeStatus(selectedBooking.status) === 'submitted' ? (
                                                        <input 
                                                            type="number" 
                                                            value={qty}
                                                            onChange={(e) => handleUpdateQty(idx, parseInt(e.target.value) || 0)}
                                                            className="w-16 px-1.5 py-1 text-xs border border-slate-300 rounded focus:ring-primary focus:border-primary"
                                                        />
                                                    ) : (
                                                        <span className="font-mono text-xs">{qty}</span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-2">
                                                    <span className={`font-mono text-xs ${discount > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                                                        {discount}%
                                                    </span>
                                                </td>
                                                <td className="px-2 py-2 text-right font-semibold text-xs whitespace-nowrap">{lineTotal.toLocaleString()}</td>
                                                {normalizeStatus(selectedBooking.status) === 'submitted' && (
                                                    <td className="px-1 py-2 text-right">
                                                        <button 
                                                            onClick={() => handleRemoveItem(idx)}
                                                            className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                            title="Remove Item"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">delete</span>
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );})}
                                    </tbody>
                                </table>

                                {/* Add Item Form - Only for submitted orders */}
                                {normalizeStatus(selectedBooking.status) === 'submitted' && (
                                    <div className="mt-3 p-2.5 rounded-md bg-slate-50 border border-dashed border-slate-300">
                                        <p className="text-[10px] font-semibold text-slate-500 uppercase mb-2">Add Product to Order</p>
                                        <form onSubmit={handleAddItem} className="flex gap-2 items-center">
                                            <div className="flex-1 min-w-0">
                                                <select 
                                                    required
                                                    value={newItemId} 
                                                    onChange={(e) => setNewItemId(e.target.value)}
                                                    className="w-full text-xs rounded-md border-slate-300 py-1.5 pl-2 pr-2 focus:ring-primary focus:border-primary"
                                                >
                                                    <option value="">Select Product...</option>
                                                    {products.length > 0 ? (
                                                        products.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name} - PKR {p.price}</option>
                                                        ))
                                                    ) : (
                                                        <option value="">Loading products...</option>
                                                    )}
                                                </select>
                                            </div>
                                            <div className="w-16 flex-shrink-0">
                                                <input 
                                                    type="number" 
                                                    min="1"
                                                    value={newItemQty}
                                                    onChange={(e) => setNewItemQty(parseInt(e.target.value))}
                                                    className="w-full text-xs rounded-md border-slate-300 py-1.5 px-2 focus:ring-primary focus:border-primary"
                                                    placeholder="Qty"
                                                />
                                            </div>
                                            <button 
                                                type="submit"
                                                className="bg-slate-900 text-white p-1.5 rounded-md hover:bg-slate-700 transition-colors flex items-center justify-center flex-shrink-0"
                                                title="Add Item"
                                            >
                                                <span className="material-symbols-outlined text-base">add</span>
                                            </button>
                                        </form>
                                    </div>
                                )}
                             </div>

                             {/* Actions Footer */}
                             <div className="border-t border-slate-100 pt-3 mt-auto">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                                        {/* Payment Mode Display */}
                                        <div className="text-xs text-slate-600">
                                            <span className="font-semibold">Payment: </span>
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                                selectedBooking.paymentMode === 'cash' ? 'bg-green-100 text-green-700' :
                                                selectedBooking.paymentMode === 'credit' ? 'bg-blue-100 text-blue-700' :
                                                'bg-yellow-100 text-yellow-700'
                                            }`}>
                                                {selectedBooking.paymentMode || 'N/A'}
                                            </span>
                                            {selectedBooking.cashAmount > 0 && (
                                                <span className="ml-1.5 text-green-600 text-[10px] whitespace-nowrap">Cash: PKR {selectedBooking.cashAmount?.toLocaleString()}</span>
                                            )}
                                            {selectedBooking.creditAmount > 0 && (
                                                <span className="ml-1.5 text-blue-600 text-[10px] whitespace-nowrap">Credit: PKR {selectedBooking.creditAmount?.toLocaleString()}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-1.5 flex-shrink-0">
                                        {normalizeStatus(selectedBooking.status) === 'submitted' && (
                                            <button 
                                                onClick={handleFinalize}
                                                className="bg-primary hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold shadow-sm transition-all whitespace-nowrap"
                                            >
                                                Finalize & Approve
                                            </button>
                                        )}
                                        {normalizeStatus(selectedBooking.status) === 'approved' && (
                                            <button 
                                                onClick={() => handleGenerateBill(selectedBooking.id)}
                                                className="bg-slate-900 hover:bg-black text-white px-3 py-1.5 rounded-md text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap"
                                            >
                                                <span className="material-symbols-outlined text-xs">print</span>
                                                Generate Bill
                                            </button>
                                        )}
                                        {normalizeStatus(selectedBooking.status) === 'billed' && (
                                            <button 
                                                onClick={() => handleGenerateLoadForm(selectedBooking.id)}
                                                className="bg-secondary hover:bg-green-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap"
                                            >
                                                <span className="material-symbols-outlined text-xs">local_shipping</span>
                                                Generate Load Form
                                            </button>
                                        )}
                                    </div>
                                </div>
                             </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default KPOBookings;