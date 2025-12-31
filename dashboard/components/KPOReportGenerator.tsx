import React, { useState } from 'react';
import { dataService } from '../dataService';
import { formatDate, formatCurrency } from '../utils/dateUtils';
import { generatePDFReport } from '../utils/pdfGenerator';

interface KPOReportGeneratorProps {
    user: any;
    onNavigate: (view: string) => void;
}

const KPOReportGenerator: React.FC<KPOReportGeneratorProps> = ({ user, onNavigate }) => {
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [reportData, setReportData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    const generateReport = async () => {
        if (!user?.branch) {
            alert('Branch information not available');
            return;
        }

        setIsLoading(true);
        try {
            const filters: any = {};
            if (startDate) filters.startDate = new Date(startDate);
            if (endDate) filters.endDate = new Date(endDate);

            const data = await dataService.getBranchReport(user.branch, filters);
            setReportData(data);
        } catch (error: any) {
            console.error('Error generating report:', error);
            alert('Error generating report: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const exportToPDF = async () => {
        if (!reportData || !user?.branch) return;
        
        try {
            const pdfData = {
                title: 'Branch Report',
                subtitle: `Branch: ${user.branch}`,
                dateRange: {
                    start: startDate ? new Date(startDate) : null,
                    end: endDate ? new Date(endDate) : null
                },
                summary: reportData.summary,
                orders: reportData.orders,
                bookerPerformance: reportData.bookerPerformance || []
            };

            const fileName = `${user.branch.replace(/\s+/g, '_')}_report_${new Date().toISOString().split('T')[0]}.pdf`;
            await generatePDFReport(pdfData, fileName);
        } catch (error: any) {
            console.error('Error generating PDF:', error);
            // Error is already shown in pdfGenerator, but we can add additional handling if needed
            if (!error.message?.includes('refresh')) {
                alert('Error generating PDF: ' + (error.message || 'Unknown error'));
            }
        }
    };

    const exportToExcel = () => {
        if (!reportData) return;
        
        const headers = ['Order Number', 'Shop Name', 'Booker', 'Amount', 'Status', 'Date'];
        const rows = reportData.orders.map((order: any) => [
            order.orderNumber || order.id,
            order.shopName || 'N/A',
            order.bookerName || 'N/A',
            order.grandTotal || order.totalAmount || 0,
            order.status || 'N/A',
            order.createdAt?.toDate ? formatDate(order.createdAt.toDate()) : 'N/A'
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${user.branch}_report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-1">
                <h2 className="text-3xl font-black tracking-tight text-slate-900">Branch Report Generator</h2>
                <p className="text-slate-500">Generate comprehensive reports for {user?.branch || 'your branch'}.</p>
            </div>

            {/* Filters */}
            <div className="glass-panel rounded-3xl bg-white p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={generateReport}
                        disabled={isLoading}
                        className="px-6 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Generating...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined">analytics</span>
                                Generate Report
                            </>
                        )}
                    </button>
                    {reportData && (
                        <>
                            <button
                                onClick={exportToPDF}
                                className="px-6 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-black transition-all flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined">picture_as_pdf</span>
                                Export PDF
                            </button>
                            <button
                                onClick={exportToExcel}
                                className="px-6 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 transition-all flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined">table_chart</span>
                                Export Excel
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Report Results */}
            {reportData && (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="p-6 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                            <p className="text-xs text-slate-500 font-bold uppercase mb-1">Total Orders</p>
                            <p className="text-3xl font-black text-primary">{reportData.summary.totalOrders}</p>
                            <p className="text-xs text-slate-400 mt-1">{reportData.summary.deliveredOrders} delivered</p>
                        </div>
                        <div className="p-6 rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20">
                            <p className="text-xs text-slate-500 font-bold uppercase mb-1">Total Sales</p>
                            <p className="text-3xl font-black text-green-600">{formatCurrency(reportData.summary.totalSales)}</p>
                            <p className="text-xs text-slate-400 mt-1">Avg: {formatCurrency(reportData.summary.averageOrderValue)}</p>
                        </div>
                        <div className="p-6 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
                            <p className="text-xs text-slate-500 font-bold uppercase mb-1">Cash Collected</p>
                            <p className="text-3xl font-black text-blue-600">{formatCurrency(reportData.summary.totalCash)}</p>
                            <p className="text-xs text-slate-400 mt-1">{formatCurrency(reportData.summary.totalCredit)} credit</p>
                        </div>
                        <div className="p-6 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20">
                            <p className="text-xs text-slate-500 font-bold uppercase mb-1">Staff</p>
                            <p className="text-3xl font-black text-purple-600">{reportData.summary.totalBookers} Bookers</p>
                            <p className="text-xs text-slate-400 mt-1">{reportData.summary.totalSalesmen} Salesmen</p>
                        </div>
                    </div>

                    {/* Booker Performance */}
                    {reportData.bookerPerformance && reportData.bookerPerformance.length > 0 && (
                        <div className="glass-panel rounded-3xl bg-white overflow-hidden shadow-sm">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                                <h3 className="font-bold text-slate-900">Booker Performance</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400">
                                        <tr>
                                            <th className="px-6 py-4">Booker Name</th>
                                            <th className="px-6 py-4 text-center">Total Orders</th>
                                            <th className="px-6 py-4 text-center">Delivered</th>
                                            <th className="px-6 py-4 text-right">Total Sales</th>
                                            <th className="px-6 py-4 text-right">Avg Order Value</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {reportData.bookerPerformance.map((booker: any) => (
                                            <tr key={booker.bookerId} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4 font-bold text-slate-900">{booker.bookerName}</td>
                                                <td className="px-6 py-4 text-center font-mono">{booker.totalOrders}</td>
                                                <td className="px-6 py-4 text-center font-mono text-green-600">{booker.deliveredOrders}</td>
                                                <td className="px-6 py-4 text-right font-bold text-slate-900">{formatCurrency(booker.totalSales)}</td>
                                                <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(booker.averageOrderValue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Detailed Table */}
                    <div className="glass-panel rounded-3xl bg-white overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                            <h3 className="font-bold text-slate-900">Order Details</h3>
                            <p className="text-xs text-slate-500">{reportData.orders.length} orders</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">Order #</th>
                                        <th className="px-6 py-4">Shop</th>
                                        <th className="px-6 py-4">Booker</th>
                                        <th className="px-6 py-4 text-right">Amount</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {reportData.orders.slice(0, 100).map((order: any) => (
                                        <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-mono font-bold text-slate-900">{order.orderNumber || order.id.slice(0, 8)}</td>
                                            <td className="px-6 py-4 text-slate-700">{order.shopName || 'N/A'}</td>
                                            <td className="px-6 py-4 text-slate-600">{order.bookerName || 'N/A'}</td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-900">{formatCurrency(order.grandTotal || order.totalAmount || 0)}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                                                    order.status === 'delivered' ? 'bg-green-100 text-green-600' :
                                                    order.status === 'submitted' ? 'bg-yellow-100 text-yellow-600' :
                                                    'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {order.status || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-500">
                                                {order.createdAt?.toDate ? formatDate(order.createdAt.toDate()) : 'N/A'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KPOReportGenerator;

