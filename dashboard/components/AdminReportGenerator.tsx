import React, { useState, useEffect } from 'react';
import { dataService } from '../dataService';
import { formatDate, formatCurrency } from '../utils/dateUtils';
import { generatePDFReport } from '../utils/pdfGenerator';

interface AdminReportGeneratorProps {
    onNavigate: (view: string) => void;
}

const AdminReportGenerator: React.FC<AdminReportGeneratorProps> = ({ onNavigate }) => {
    const [regions, setRegions] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [kpos, setKpos] = useState<any[]>([]);
    const [selectedRegion, setSelectedRegion] = useState<string>('');
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [selectedKPO, setSelectedKPO] = useState<string>('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [reportData, setReportData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [reportType, setReportType] = useState<'all' | 'region' | 'branch' | 'kpo'>('all');

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        if (selectedRegion) {
            loadBranches(selectedRegion);
        } else {
            setBranches([]);
            setSelectedBranch('');
        }
    }, [selectedRegion]);

    const loadInitialData = async () => {
        try {
            const [regionsData, usersData] = await Promise.all([
                dataService.getRegions(),
                dataService.getAllUsers()
            ]);
            setRegions(regionsData);
            const kpoUsers = usersData.filter((u: any) => (u.role || '').toLowerCase() === 'kpo');
            setKpos(kpoUsers);
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    };

    const loadBranches = async (regionId: string) => {
        try {
            const branchesData = await dataService.getBranches(regionId);
            setBranches(branchesData);
        } catch (error) {
            console.error('Error loading branches:', error);
        }
    };

    const generateReport = async () => {
        setIsLoading(true);
        try {
            const filters: any = {};
            
            if (startDate) filters.startDate = new Date(startDate);
            if (endDate) filters.endDate = new Date(endDate);
            if (selectedKPO) filters.kpoId = selectedKPO;
            if (selectedBranch) filters.branchName = selectedBranch;
            if (selectedRegion) filters.regionId = selectedRegion;

            const data = await dataService.getComprehensiveReport(filters);
            setReportData(data);
        } catch (error: any) {
            console.error('Error generating report:', error);
            alert('Error generating report: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const exportToPDF = async () => {
        if (!reportData) return;
        
        try {
            // Determine report title based on filters
            let title = 'Comprehensive Business Report';
            let subtitle = '';
            
            if (selectedKPO) {
                const kpo = kpos.find(k => k.id === selectedKPO);
                subtitle = `KPO: ${kpo?.name || 'N/A'} - ${kpo?.branch || 'N/A'}`;
            } else if (selectedBranch) {
                subtitle = `Branch: ${selectedBranch}`;
            } else if (selectedRegion) {
                const region = regions.find(r => r.id === selectedRegion);
                subtitle = `Region: ${region?.name || 'N/A'}`;
            } else {
                subtitle = 'All Data';
            }

            const pdfData = {
                title,
                subtitle,
                dateRange: {
                    start: startDate ? new Date(startDate) : null,
                    end: endDate ? new Date(endDate) : null
                },
                summary: reportData.summary,
                orders: reportData.orders,
                bookers: reportData.bookers || [],
                kpos: reportData.kpos || []
            };

            const fileName = `report_${new Date().toISOString().split('T')[0]}.pdf`;
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
        
        // Create CSV content
        const headers = ['Order Number', 'Shop Name', 'Booker', 'Branch', 'Amount', 'Status', 'Date'];
        const rows = reportData.orders.map((order: any) => [
            order.orderNumber || order.id,
            order.shopName || 'N/A',
            order.bookerName || 'N/A',
            order.branch || 'N/A',
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
        link.setAttribute('download', `report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-1">
                <h2 className="text-3xl font-black tracking-tight text-slate-900">Report Generator</h2>
                <p className="text-slate-500">Generate comprehensive reports by region, branch, KPO, or all data.</p>
            </div>

            {/* Filters */}
            <div className="glass-panel rounded-3xl bg-white p-6 space-y-6">
                <div className="flex flex-wrap gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
                    <button
                        onClick={() => setReportType('all')}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                            reportType === 'all' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        All Data
                    </button>
                    <button
                        onClick={() => setReportType('region')}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                            reportType === 'region' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        By Region
                    </button>
                    <button
                        onClick={() => setReportType('branch')}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                            reportType === 'branch' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        By Branch
                    </button>
                    <button
                        onClick={() => setReportType('kpo')}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                            reportType === 'kpo' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        By KPO
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {reportType === 'region' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Region</label>
                            <select
                                value={selectedRegion}
                                onChange={(e) => setSelectedRegion(e.target.value)}
                                className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="">Select Region</option>
                                {regions.map(region => (
                                    <option key={region.id} value={region.id}>{region.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {reportType === 'branch' && (
                        <>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Region</label>
                                <select
                                    value={selectedRegion}
                                    onChange={(e) => setSelectedRegion(e.target.value)}
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option value="">Select Region</option>
                                    {regions.map(region => (
                                        <option key={region.id} value={region.id}>{region.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Branch</label>
                                <select
                                    value={selectedBranch}
                                    onChange={(e) => setSelectedBranch(e.target.value)}
                                    disabled={!selectedRegion}
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                                >
                                    <option value="">Select Branch</option>
                                    {branches.map(branch => (
                                        <option key={branch.id} value={branch.name}>{branch.name}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}

                    {reportType === 'kpo' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">KPO</label>
                            <select
                                value={selectedKPO}
                                onChange={(e) => setSelectedKPO(e.target.value)}
                                className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="">Select KPO</option>
                                {kpos.map(kpo => (
                                    <option key={kpo.id} value={kpo.id}>{kpo.name} - {kpo.branch || 'N/A'}</option>
                                ))}
                            </select>
                        </div>
                    )}

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
                        <div className="p-6 rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20">
                            <p className="text-xs text-slate-500 font-bold uppercase mb-1">Delivery Rate</p>
                            <p className="text-3xl font-black text-orange-600">{reportData.summary.deliveryRate.toFixed(1)}%</p>
                            <p className="text-xs text-slate-400 mt-1">{reportData.summary.pendingOrders} pending</p>
                        </div>
                    </div>

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
                                        <th className="px-6 py-4">Branch</th>
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
                                            <td className="px-6 py-4 text-slate-500">{order.branch || 'N/A'}</td>
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

export default AdminReportGenerator;

