/**
 * CSV Export Utility
 * Provides reusable CSV export functionality for reports
 */

export interface CSVExportOptions {
    filename?: string;
    includeBOM?: boolean; // UTF-8 BOM for Excel compatibility
    delimiter?: string;
}

/**
 * Export data array to CSV file
 * @param data Array of objects to export
 * @param headers Column headers (keys from data objects)
 * @param options Export options
 */
export const exportToCSV = (
    data: any[],
    headers: string[],
    options: CSVExportOptions = {}
): void => {
    const {
        filename = `export_${new Date().toISOString().split('T')[0]}`,
        includeBOM = true,
        delimiter = ','
    } = options;

    // Escape CSV values (handle quotes, commas, newlines)
    const escapeCSVValue = (value: any): string => {
        if (value === null || value === undefined) {
            return '';
        }
        
        const stringValue = String(value);
        
        // If value contains delimiter, quote, or newline, wrap in quotes and escape quotes
        if (stringValue.includes(delimiter) || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        
        return stringValue;
    };

    // Build CSV rows
    const csvRows: string[] = [];
    
    // Add headers
    csvRows.push(headers.map(escapeCSVValue).join(delimiter));
    
    // Add data rows
    data.forEach(row => {
        const values = headers.map(header => {
            // Support nested properties (e.g., "booker.name")
            const value = header.split('.').reduce((obj, key) => obj?.[key], row);
            return escapeCSVValue(value);
        });
        csvRows.push(values.join(delimiter));
    });

    // Join all rows
    const csvContent = csvRows.join('\n');
    
    // Add UTF-8 BOM for Excel compatibility (optional)
    const blobContent = includeBOM ? '\ufeff' + csvContent : csvContent;
    
    // Create blob and download
    const blob = new Blob([blobContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
};

/**
 * Export unauthorized discounts to CSV
 */
export const exportUnauthorizedDiscounts = (discounts: any[]): void => {
    const headers = ['Order Number', 'Booker Name', 'Branch', 'Unauthorized Amount (PKR)', 'Max Allowed (PKR)', 'Date'];
    
    const data = discounts.map(d => ({
        'Order Number': d.id || d.orderId || 'N/A',
        'Booker Name': d.bookerName || 'Unknown',
        'Branch': d.branch || 'N/A',
        'Unauthorized Amount (PKR)': d.discountApplied || d.unauthorizedDiscount || 0,
        'Max Allowed (PKR)': d.maxAllowed || 0,
        'Date': d.createdAt ? (d.createdAt.toDate ? d.createdAt.toDate().toLocaleDateString() : new Date(d.createdAt).toLocaleDateString()) : 'N/A'
    }));
    
    exportToCSV(data, headers, { filename: `unauthorized_discounts_${new Date().toISOString().split('T')[0]}` });
};

/**
 * Export policy violations to CSV
 */
export const exportPolicyViolations = (violations: any[]): void => {
    const headers = ['Type', 'Booker Name', 'Branch', 'Details', 'Severity', 'Date'];
    
    const data = violations.map(v => ({
        'Type': v.type || 'Unknown',
        'Booker Name': v.bookerName || 'Unknown',
        'Branch': v.branch || 'N/A',
        'Details': v.details || v.description || 'N/A',
        'Severity': v.severity || 'Medium',
        'Date': v.timestamp ? (v.timestamp.toDate ? v.timestamp.toDate().toLocaleDateString() : new Date(v.timestamp).toLocaleDateString()) : 'N/A'
    }));
    
    exportToCSV(data, headers, { filename: `policy_violations_${new Date().toISOString().split('T')[0]}` });
};

/**
 * Export approval delays to CSV
 */
export const exportApprovalDelays = (delays: any[]): void => {
    const headers = ['Order ID', 'Booker Name', 'Branch', 'Created At', 'Approved At', 'Delay (Hours)', 'Delay (Minutes)'];
    
    const data = delays.map(d => ({
        'Order ID': d.orderId?.slice(0, 12) || 'N/A',
        'Booker Name': d.bookerName || 'Unknown',
        'Branch': d.branch || 'N/A',
        'Created At': d.createdAt ? (d.createdAt.toDate ? d.createdAt.toDate().toLocaleString() : new Date(d.createdAt).toLocaleString()) : 'N/A',
        'Approved At': d.finalizedAt ? (d.finalizedAt.toDate ? d.finalizedAt.toDate().toLocaleString() : new Date(d.finalizedAt).toLocaleString()) : 'N/A',
        'Delay (Hours)': d.delayHours || 0,
        'Delay (Minutes)': d.delayMinutes || 0
    }));
    
    exportToCSV(data, headers, { filename: `approval_delays_${new Date().toISOString().split('T')[0]}` });
};

/**
 * Export audit logs to CSV
 */
export const exportAuditLogs = (logs: any[]): void => {
    const headers = ['User', 'Action', 'Status', 'Timestamp', 'ID'];
    
    const data = logs.map(log => ({
        'User': log.user || 'System',
        'Action': log.action || 'Unknown action',
        'Status': log.status || 'Success',
        'Timestamp': log.timestamp || 'Unknown',
        'ID': log.id || 'N/A'
    }));
    
    exportToCSV(data, headers, { filename: `audit_logs_${new Date().toISOString().split('T')[0]}` });
};

