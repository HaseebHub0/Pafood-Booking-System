import React, { useState, useEffect } from 'react';
import { dataService } from '../dataService';
import { formatDate, formatRelativeTime, formatCurrency } from '../utils/dateUtils';
import { 
    exportUnauthorizedDiscounts, 
    exportPolicyViolations, 
    exportApprovalDelays, 
    exportAuditLogs 
} from '../utils/csvExporter';

const AdminReports: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'KPO' | 'DISCOUNTS' | 'VIOLATIONS' | 'DELAYS' | 'AUDIT'>('KPO');
    const [unauthorizedDiscounts, setUnauthorizedDiscounts] = useState<any[]>([]);
    const [policyViolations, setPolicyViolations] = useState<any[]>([]);
    const [approvalDelays, setApprovalDelays] = useState<any[]>([]);
    const [kpoPerformance, setKpoPerformance] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [users, setUsers] = useState<any[]>([]);

    useEffect(() => {
        const loadData = async () => {
            try {
                setIsLoading(true);
                setError(null);
                
                const [discountsData, kpoData, logsData, usersData, violationsData, delaysData] = await Promise.all([
                    dataService.getUnauthorizedDiscounts(),
                    dataService.getKPOPerformance(),
                    dataService.getActivityLogs(50),
                    dataService.getAllUsers(),
                    dataService.getPolicyViolations(),
                    dataService.getApprovalDelays(60) // 60 minute threshold
                ]);
                
                setUsers(usersData);
                
                // Transform unauthorized discounts
                const transformedDiscounts = discountsData.map((order: any) => {
                    const booker = usersData.find(u => u.id === order.bookerId);
                    return {
                        id: order.orderNumber || order.id,
                        bookerName: order.bookerName || booker?.name || 'Unknown',
                        branch: order.branch || 'N/A',
                        discountApplied: order.unauthorizedDiscount || 0,
                        maxAllowed: order.allowedDiscount || 0,
                        orderId: order.id
                    };
                });
                setUnauthorizedDiscounts(transformedDiscounts);
                
                // Set policy violations (all types)
                setPolicyViolations(violationsData);
                
                // Set approval delays
                setApprovalDelays(delaysData);
                
                setKpoPerformance(kpoData);
                
                // Transform audit logs
                const transformedLogs = logsData.map((log: any) => {
                    const user = usersData.find(u => u.id === log.userId);
                    return {
                        id: log.id,
                        user: user?.name || 'System',
                        action: log.action || 'Unknown action',
                        timestamp: log.timestamp ? formatRelativeTime(log.timestamp) : 'Unknown',
                        status: 'Success' // Default status
                    };
                });
                setAuditLogs(transformedLogs);
            } catch (err: any) {
                console.error('Error loading reports:', err);
                setError(err.message || 'Failed to load report data');
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, []);

    const getSeverityBadge = (severity: string) => {
        const colors: Record<string, { bg: string; text: string }> = {
            High: { bg: 'bg-red-100', text: 'text-red-600' },
            Medium: { bg: 'bg-orange-100', text: 'text-orange-600' },
            Low: { bg: 'bg-yellow-100', text: 'text-yellow-600' },
        };
        const style = colors[severity] || colors.Medium;
        return (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${style.bg} ${style.text}`}>
                {severity}
            </span>
        );
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-1">
                <h2 className="text-3xl font-black tracking-tight text-slate-900">Global Reports & Compliance</h2>
                <p className="text-slate-500">System-wide monitoring of operational policy and performance.</p>
            </div>

            {error && (
                <div className="rounded-xl bg-red-50 p-4 border border-red-200">
                    <p className="text-red-800 font-medium">Error: {error}</p>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-6 rounded-xl bg-white border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-red-50 text-red-600">
                            <span className="material-symbols-outlined">gavel</span>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase">Unauthorized Discounts</p>
                            <p className="text-2xl font-black text-slate-900">{unauthorizedDiscounts.length}</p>
                        </div>
                    </div>
                </div>
                <div className="p-6 rounded-xl bg-white border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-orange-50 text-orange-600">
                            <span className="material-symbols-outlined">warning</span>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase">Policy Violations</p>
                            <p className="text-2xl font-black text-slate-900">{policyViolations.length}</p>
                        </div>
                    </div>
                </div>
                <div className="p-6 rounded-xl bg-white border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-yellow-50 text-yellow-600">
                            <span className="material-symbols-outlined">schedule</span>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase">Approval Delays</p>
                            <p className="text-2xl font-black text-slate-900">{approvalDelays.length}</p>
                        </div>
                    </div>
                </div>
                <div className="p-6 rounded-xl bg-white border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-50 text-green-600">
                            <span className="material-symbols-outlined">check_circle</span>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase">Active KPOs</p>
                            <p className="text-2xl font-black text-slate-900">{kpoPerformance.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sub Tabs */}
            <div className="flex flex-wrap gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
                <button 
                    onClick={() => setActiveTab('KPO')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                        activeTab === 'KPO' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                >
                    KPO Performance
                </button>
                <button 
                    onClick={() => setActiveTab('DISCOUNTS')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1 ${
                        activeTab === 'DISCOUNTS' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                >
                    Unauthorized Discounts
                    {unauthorizedDiscounts.length > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-red-500 text-white rounded-full">{unauthorizedDiscounts.length}</span>
                    )}
                </button>
                <button 
                    onClick={() => setActiveTab('VIOLATIONS')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1 ${
                        activeTab === 'VIOLATIONS' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                >
                    Policy Violations
                    {policyViolations.length > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-orange-500 text-white rounded-full">{policyViolations.length}</span>
                    )}
                </button>
                <button 
                    onClick={() => setActiveTab('DELAYS')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1 ${
                        activeTab === 'DELAYS' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                >
                    Approval Delays
                    {approvalDelays.length > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-yellow-500 text-white rounded-full">{approvalDelays.length}</span>
                    )}
                </button>
                <button 
                    onClick={() => setActiveTab('AUDIT')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                        activeTab === 'AUDIT' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                >
                    Audit Logs
                </button>
            </div>

            {activeTab === 'KPO' && (
                <div className="glass-panel rounded-3xl bg-white overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                        <h3 className="font-bold text-slate-900">Regional Manager Efficiency</h3>
                        <button className="text-xs font-bold text-primary flex items-center gap-1">
                            Export Detailed Audit <span className="material-symbols-outlined text-[16px]">download</span>
                        </button>
                    </div>
                    {isLoading ? (
                        <div className="p-12 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                        </div>
                    ) : kpoPerformance.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                            <p>No KPO performance data available</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400">
                                <tr>
                                    <th className="px-6 py-4">Manager (KPO)</th>
                                    <th className="px-6 py-4">Branch</th>
                                    <th className="px-6 py-4 text-center">Billing TAT</th>
                                    <th className="px-6 py-4 text-center">Daily Orders</th>
                                    <th className="px-6 py-4 text-right">Accuracy Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {kpoPerformance.map((kpo) => {
                                    const initials = kpo.kpoName?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'KPO';
                                    return (
                                        <tr key={kpo.kpoId} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                                                        {initials}
                                                    </div>
                                                    <span className="font-bold text-slate-900">{kpo.kpoName}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500">{kpo.branch}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center gap-1 text-green-600 font-bold">
                                                    <span className="material-symbols-outlined text-sm">bolt</span> {kpo.avgBillingTime}m
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center font-mono">{kpo.dailyOrders}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-bold text-slate-900">{kpo.accuracyRate}%</span>
                                                    <span className="text-[10px] text-green-500">Above Target</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {activeTab === 'DISCOUNTS' && (
                <div className="space-y-6">
                    <div className="p-6 rounded-3xl bg-orange-50 border border-orange-100 flex items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                            <div className="h-16 w-16 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/20">
                                <span className="material-symbols-outlined text-3xl">gavel</span>
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-orange-900">Unauthorized Discounts Detected</h4>
                                <p className="text-orange-700 text-sm">System found {unauthorizedDiscounts.length} bookings exceeding booker's max discount ceiling.</p>
                            </div>
                        </div>
                        {unauthorizedDiscounts.length > 0 && (
                            <button
                                onClick={() => exportUnauthorizedDiscounts(unauthorizedDiscounts)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 transition-colors shadow-sm"
                            >
                                <span className="material-symbols-outlined text-[18px]">download</span>
                                Export CSV
                            </button>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="glass-panel rounded-3xl bg-white p-12 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                        </div>
                    ) : unauthorizedDiscounts.length === 0 ? (
                        <div className="glass-panel rounded-3xl bg-white p-12 text-center text-slate-400">
                            <span className="material-symbols-outlined text-4xl mb-2">check_circle</span>
                            <p>No unauthorized discounts found</p>
                        </div>
                    ) : (
                        <div className="glass-panel rounded-3xl bg-white overflow-hidden shadow-sm">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">Order ID</th>
                                        <th className="px-6 py-4">Booker Name</th>
                                        <th className="px-6 py-4">Branch</th>
                                        <th className="px-6 py-4">Applied</th>
                                        <th className="px-6 py-4">Policy Limit</th>
                                        <th className="px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {unauthorizedDiscounts.map(b => (
                                        <tr key={b.id} className="hover:bg-red-50/30 transition-colors">
                                            <td className="px-6 py-4 font-mono font-bold text-slate-900">{b.id}</td>
                                            <td className="px-6 py-4 text-slate-700">{b.bookerName}</td>
                                            <td className="px-6 py-4 text-slate-500">{b.branch}</td>
                                            <td className="px-6 py-4 font-black text-red-600">{b.discountApplied}%</td>
                                            <td className="px-6 py-4 text-slate-400">{b.maxAllowed}%</td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[10px] font-bold hover:bg-black transition-all">Flag Transaction</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'VIOLATIONS' && (
                <div className="space-y-6">
                    <div className="p-6 rounded-3xl bg-red-50 border border-red-100 flex items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                            <div className="h-16 w-16 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/20">
                                <span className="material-symbols-outlined text-3xl">warning</span>
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-red-900">Policy Violations Report</h4>
                                <p className="text-red-700 text-sm">
                                    {policyViolations.length} violations including unauthorized discounts and credit limit breaches.
                                </p>
                            </div>
                        </div>
                        {policyViolations.length > 0 && (
                            <button
                                onClick={() => exportPolicyViolations(policyViolations)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors shadow-sm"
                            >
                                <span className="material-symbols-outlined text-[18px]">download</span>
                                Export CSV
                            </button>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="glass-panel rounded-3xl bg-white p-12 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                        </div>
                    ) : policyViolations.length === 0 ? (
                        <div className="glass-panel rounded-3xl bg-white p-12 text-center text-slate-400">
                            <span className="material-symbols-outlined text-4xl mb-2">verified</span>
                            <p>No policy violations found</p>
                        </div>
                    ) : (
                        <div className="glass-panel rounded-3xl bg-white overflow-hidden shadow-sm">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">Order ID</th>
                                        <th className="px-6 py-4">Type</th>
                                        <th className="px-6 py-4">Booker</th>
                                        <th className="px-6 py-4">Branch</th>
                                        <th className="px-6 py-4">Severity</th>
                                        <th className="px-6 py-4">Details</th>
                                        <th className="px-6 py-4 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {policyViolations.map((v, idx) => (
                                        <tr key={v.id || idx} className="hover:bg-red-50/30 transition-colors">
                                            <td className="px-6 py-4 font-mono font-bold text-slate-900">{v.orderId?.slice(0, 12) || 'N/A'}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                    v.type === 'Unauthorized Discount' ? 'bg-red-50 text-red-600' :
                                                    v.type === 'Credit Limit Breach' ? 'bg-orange-50 text-orange-600' :
                                                    'bg-slate-50 text-slate-600'
                                                }`}>
                                                    {v.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-700">{v.bookerName}</td>
                                            <td className="px-6 py-4 text-slate-500">{v.branch}</td>
                                            <td className="px-6 py-4">{getSeverityBadge(v.severity)}</td>
                                            <td className="px-6 py-4 text-xs text-slate-600 max-w-[200px] truncate">{v.details}</td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-900">
                                                {formatCurrency(v.amount || 0)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'DELAYS' && (
                <div className="space-y-6">
                    <div className="p-6 rounded-3xl bg-yellow-50 border border-yellow-100 flex items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                            <div className="h-16 w-16 rounded-full bg-yellow-500 text-white flex items-center justify-center shadow-lg shadow-yellow-500/20">
                                <span className="material-symbols-outlined text-3xl">schedule</span>
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-yellow-900">Approval Delays Report</h4>
                                <p className="text-yellow-700 text-sm">
                                    {approvalDelays.length} orders took longer than 60 minutes for KPO approval.
                                </p>
                            </div>
                        </div>
                        {approvalDelays.length > 0 && (
                            <button
                                onClick={() => exportApprovalDelays(approvalDelays)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-600 text-white text-sm font-bold hover:bg-yellow-700 transition-colors shadow-sm"
                            >
                                <span className="material-symbols-outlined text-[18px]">download</span>
                                Export CSV
                            </button>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="glass-panel rounded-3xl bg-white p-12 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                        </div>
                    ) : approvalDelays.length === 0 ? (
                        <div className="glass-panel rounded-3xl bg-white p-12 text-center text-slate-400">
                            <span className="material-symbols-outlined text-4xl mb-2">speed</span>
                            <p>All orders approved within SLA</p>
                        </div>
                    ) : (
                        <div className="glass-panel rounded-3xl bg-white overflow-hidden shadow-sm">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">Order ID</th>
                                        <th className="px-6 py-4">Booker</th>
                                        <th className="px-6 py-4">Branch</th>
                                        <th className="px-6 py-4">Created At</th>
                                        <th className="px-6 py-4">Approved At</th>
                                        <th className="px-6 py-4 text-right">Delay</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {approvalDelays.map((d, idx) => (
                                        <tr key={d.id || idx} className="hover:bg-yellow-50/30 transition-colors">
                                            <td className="px-6 py-4 font-mono font-bold text-slate-900">{d.orderId?.slice(0, 12) || 'N/A'}</td>
                                            <td className="px-6 py-4 text-slate-700">{d.bookerName}</td>
                                            <td className="px-6 py-4 text-slate-500">{d.branch}</td>
                                            <td className="px-6 py-4 text-xs text-slate-500">{formatDate(d.createdAt)}</td>
                                            <td className="px-6 py-4 text-xs text-slate-500">{formatDate(d.finalizedAt)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`font-bold ${
                                                    d.delayMinutes > 120 ? 'text-red-600' :
                                                    d.delayMinutes > 60 ? 'text-orange-600' :
                                                    'text-yellow-600'
                                                }`}>
                                                    {d.delayHours}h
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'AUDIT' && (
              <div className="glass-panel rounded-3xl bg-white overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                      <h3 className="font-bold text-slate-900">System Activity Logs</h3>
                      {auditLogs.length > 0 ? (
                          <button 
                              onClick={() => exportAuditLogs(auditLogs)}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-600 text-white text-sm font-bold hover:bg-slate-700 transition-colors shadow-sm"
                          >
                              <span className="material-symbols-outlined text-[18px]">download</span>
                              Export CSV
                          </button>
                      ) : (
                          <button className="text-xs font-bold text-slate-500 flex items-center gap-1">
                              Download Archive <span className="material-symbols-outlined text-[16px]">history</span>
                          </button>
                      )}
                  </div>
                  {isLoading ? (
                      <div className="p-12 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                      </div>
                  ) : auditLogs.length === 0 ? (
                      <div className="p-12 text-center text-slate-400">
                          <p>No activity logs available</p>
                      </div>
                  ) : (
                      <div className="divide-y divide-slate-100">
                          {auditLogs.map(log => (
                            <div key={log.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${log.status === 'Success' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                                        <span className="material-symbols-outlined text-xl">{log.status === 'Success' ? 'task_alt' : 'warning'}</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">{log.action}</p>
                                        <p className="text-xs text-slate-400">Performed by {log.user} • {log.id}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-medium text-slate-500">{log.timestamp}</p>
                                    <span className={`text-[10px] font-black uppercase ${log.status === 'Success' ? 'text-green-500' : 'text-orange-500'}`}>{log.status}</span>
                                </div>
                            </div>
                          ))}
                      </div>
                  )}
              </div>
            )}
        </div>
    );
};

export default AdminReports;
