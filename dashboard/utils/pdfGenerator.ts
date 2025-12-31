// PDF Generator Utility using jsPDF
// This will be loaded dynamically to avoid SSR issues

export interface PDFReportData {
    title: string;
    subtitle?: string;
    dateRange?: {
        start: Date | null;
        end: Date | null;
    };
    summary: {
        totalOrders: number;
        deliveredOrders: number;
        pendingOrders: number;
        totalSales: number;
        totalCash: number;
        totalCredit: number;
        totalDiscount?: number;
        averageOrderValue: number;
        deliveryRate: number;
    };
    orders: any[];
    bookers?: any[];
    kpos?: any[];
    bookerPerformance?: any[];
}

export const generatePDFReport = async (data: PDFReportData, fileName: string = 'report.pdf') => {
    try {
        // Load jsPDF from CDN
        await loadJSPDFFromCDN();
        
        // Wait a bit for the library to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Get jsPDF from global scope - UMD bundle exposes it as window.jspdf.jsPDF
        // @ts-ignore
        const win = window as any;
        let jsPDFLib: any = null;
        
        // Try different ways jsPDF might be available (UMD format)
        // The UMD bundle typically exposes it as: window.jspdf.jsPDF
        if (win.jspdf && win.jspdf.jsPDF && typeof win.jspdf.jsPDF === 'function') {
            jsPDFLib = win.jspdf.jsPDF;
        } else if (win.jsPDF && typeof win.jsPDF === 'function') {
            jsPDFLib = win.jsPDF;
        } else if (win.jspdf && typeof win.jspdf === 'function') {
            jsPDFLib = win.jspdf;
        } else if (win.jspdf && typeof win.jspdf === 'object') {
            // Try nested access
            const keys = Object.keys(win.jspdf);
            const jsPDFKey = keys.find(k => k.toLowerCase() === 'jspdf' || k === 'jsPDF');
            if (jsPDFKey && typeof win.jspdf[jsPDFKey] === 'function') {
                jsPDFLib = win.jspdf[jsPDFKey];
            }
        }
        
        if (!jsPDFLib) {
            console.error('jsPDF not found. Debug info:');
            console.error('- window.jspdf:', win.jspdf);
            console.error('- window.jsPDF:', win.jsPDF);
            console.error('- Available window properties with "pdf":', Object.keys(win).filter(k => k.toLowerCase().includes('pdf')));
            if (win.jspdf) {
                console.error('- window.jspdf keys:', Object.keys(win.jspdf));
            }
            throw new Error('jsPDF library not available. Please refresh the page and try again.');
        }
        
        // Create jsPDF instance
        let doc: any;
        try {
            if (typeof jsPDFLib === 'function') {
                doc = new jsPDFLib({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: 'a4'
                });
            } else {
                throw new Error('jsPDF constructor not found - not a function');
            }
        } catch (constructorError: any) {
            console.error('Error creating jsPDF instance:', constructorError);
            throw new Error('Failed to create PDF document: ' + constructorError.message);
        }

        let yPos = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        const contentWidth = pageWidth - (margin * 2);

        // Header
        doc.setFillColor(59, 130, 246); // Primary blue
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('PAK ASIAN FOODS', margin, 20);
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.text('Business Report', margin, 28);
        
        if (data.subtitle) {
            doc.setFontSize(12);
            doc.text(data.subtitle, margin, 35);
        }

        yPos = 50;

        // Date Range
        if (data.dateRange?.start || data.dateRange?.end) {
            doc.setTextColor(100, 100, 100);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const dateText = `Period: ${data.dateRange.start ? new Date(data.dateRange.start).toLocaleDateString() : 'N/A'} - ${data.dateRange.end ? new Date(data.dateRange.end).toLocaleDateString() : 'N/A'}`;
            doc.text(dateText, margin, yPos);
            yPos += 8;
        }

        // Summary Section
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Summary', margin, yPos);
        yPos += 10;

        // Summary Boxes
        const boxWidth = (contentWidth - 10) / 4;
        const boxHeight = 25;
        let xPos = margin;

        // Total Orders
        doc.setFillColor(59, 130, 246);
        doc.roundedRect(xPos, yPos - 15, boxWidth, boxHeight, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Total Orders', xPos + 5, yPos - 8);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(data.summary.totalOrders.toString(), xPos + 5, yPos + 2);
        xPos += boxWidth + 3;

        // Total Sales
        doc.setFillColor(34, 197, 94);
        doc.roundedRect(xPos, yPos - 15, boxWidth, boxHeight, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Total Sales', xPos + 5, yPos - 8);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        const salesText = formatCurrencyForPDF(data.summary.totalSales);
        doc.text(salesText, xPos + 5, yPos + 2);
        xPos += boxWidth + 3;

        // Cash Collected
        doc.setFillColor(37, 99, 235);
        doc.roundedRect(xPos, yPos - 15, boxWidth, boxHeight, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Cash', xPos + 5, yPos - 8);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        const cashText = formatCurrencyForPDF(data.summary.totalCash);
        doc.text(cashText, xPos + 5, yPos + 2);
        xPos += boxWidth + 3;

        // Delivery Rate
        doc.setFillColor(249, 115, 22);
        doc.roundedRect(xPos, yPos - 15, boxWidth, boxHeight, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Delivery Rate', xPos + 5, yPos - 8);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(data.summary.deliveryRate.toFixed(1) + '%', xPos + 5, yPos + 2);

        yPos += 25;

        // Additional Summary Info
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Delivered Orders: ${data.summary.deliveredOrders}`, margin, yPos);
        doc.text(`Pending Orders: ${data.summary.pendingOrders}`, margin + 60, yPos);
        doc.text(`Credit Amount: ${formatCurrencyForPDF(data.summary.totalCredit)}`, margin + 120, yPos);
        yPos += 10;

        // Booker Performance (if available)
        if (data.bookerPerformance && data.bookerPerformance.length > 0) {
            yPos = checkPageBreak(doc, yPos, 50);
            
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text('Booker Performance', margin, yPos);
            yPos += 8;

            // Table Header
            doc.setFillColor(241, 245, 249);
            doc.rect(margin, yPos - 5, contentWidth, 8, 'F');
            doc.setTextColor(100, 100, 100);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('Booker', margin + 2, yPos);
            doc.text('Orders', margin + 50, yPos);
            doc.text('Delivered', margin + 70, yPos);
            doc.text('Sales', margin + 90, yPos);
            doc.text('Avg Value', margin + 130, yPos);
            yPos += 8;

            // Table Rows
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
            data.bookerPerformance.forEach((booker, index) => {
                yPos = checkPageBreak(doc, yPos, 10);
                
                if (index % 2 === 0) {
                    doc.setFillColor(249, 250, 251);
                    doc.rect(margin, yPos - 5, contentWidth, 7, 'F');
                }

                doc.setFontSize(9);
                doc.text(booker.bookerName || 'N/A', margin + 2, yPos);
                doc.text(booker.totalOrders.toString(), margin + 50, yPos);
                doc.text(booker.deliveredOrders.toString(), margin + 70, yPos);
                doc.text(formatCurrencyForPDF(booker.totalSales), margin + 90, yPos);
                doc.text(formatCurrencyForPDF(booker.averageOrderValue), margin + 130, yPos);
                yPos += 7;
            });
            yPos += 5;
        }

        // Orders Table
        yPos = checkPageBreak(doc, yPos, 50);
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Order Details', margin, yPos);
        yPos += 8;

        // Table Header
        doc.setFillColor(241, 245, 249);
        doc.rect(margin, yPos - 5, contentWidth, 8, 'F');
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Order #', margin + 2, yPos);
        doc.text('Shop', margin + 30, yPos);
        doc.text('Booker', margin + 70, yPos);
        doc.text('Amount', margin + 110, yPos);
        doc.text('Status', margin + 140, yPos);
        doc.text('Date', margin + 165, yPos);
        yPos += 8;

        // Table Rows (limit to first 50 orders for PDF)
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        const ordersToShow = data.orders.slice(0, 50);
        
        ordersToShow.forEach((order, index) => {
            yPos = checkPageBreak(doc, yPos, 10);
            
            if (index % 2 === 0) {
                doc.setFillColor(249, 250, 251);
                doc.rect(margin, yPos - 5, contentWidth, 7, 'F');
            }

            doc.setFontSize(8);
            const orderNum = (order.orderNumber || order.id?.slice(0, 8) || 'N/A').substring(0, 12);
            doc.text(orderNum, margin + 2, yPos);
            doc.text((order.shopName || 'N/A').substring(0, 20), margin + 30, yPos);
            doc.text((order.bookerName || 'N/A').substring(0, 15), margin + 70, yPos);
            doc.text(formatCurrencyForPDF(order.grandTotal || order.totalAmount || 0), margin + 110, yPos);
            doc.text((order.status || 'N/A').substring(0, 10), margin + 140, yPos);
            
            const orderDate = order.createdAt?.toDate 
                ? new Date(order.createdAt.toDate()).toLocaleDateString()
                : order.createdAt?.seconds 
                ? new Date(order.createdAt.seconds * 1000).toLocaleDateString()
                : 'N/A';
            doc.text(orderDate.substring(0, 10), margin + 165, yPos);
            yPos += 7;
        });

        // Footer
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.setFont('helvetica', 'normal');
            doc.text(
                `Page ${i} of ${pageCount} | Generated on ${new Date().toLocaleDateString()}`,
                margin,
                doc.internal.pageSize.getHeight() - 10
            );
        }

        // Save PDF
        doc.save(fileName);
    } catch (error: any) {
        console.error('Error generating PDF:', error);
        console.error('Error details:', {
            message: error?.message,
            stack: error?.stack,
            name: error?.name
        });
        // Show user-friendly error message
        const errorMessage = error?.message || 'Unknown error occurred';
        alert(`PDF generation failed: ${errorMessage}\n\nPlease try:\n1. Refreshing the page\n2. Checking your internet connection\n3. Using browser print (Ctrl+P) as alternative`);
        throw error; // Re-throw to let caller handle it
    }
};

const checkPageBreak = (doc: any, yPos: number, requiredSpace: number): number => {
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    
    if (yPos + requiredSpace > pageHeight - margin) {
        doc.addPage();
        return margin + 10;
    }
    return yPos;
};

const formatCurrencyForPDF = (amount: number): string => {
    if (amount >= 1000000) {
        return `Rs.${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
        return `Rs.${(amount / 1000).toFixed(0)}K`;
    }
    return `Rs.${amount.toFixed(0)}`;
};

const loadJSPDFFromCDN = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        // @ts-ignore
        const win = window as any;
        
        // Check if already loaded - try multiple ways jsPDF might be available
        const isReady = (win.jspdf?.jsPDF && typeof win.jspdf.jsPDF === 'function') ||
                       (win.jsPDF && typeof win.jsPDF === 'function') ||
                       (win.jspdf && typeof win.jspdf === 'function');
        
        if (isReady) {
            resolve();
            return;
        }

        // Check if script is already being loaded
        const existingScript = document.querySelector('script[src*="jspdf"]');
        if (existingScript) {
            // Wait for it to load
            const checkInterval = setInterval(() => {
                const isReady = (win.jspdf?.jsPDF && typeof win.jspdf.jsPDF === 'function') ||
                               (win.jsPDF && typeof win.jsPDF === 'function') ||
                               (win.jspdf && typeof win.jspdf === 'function');
                
                if (isReady) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
            
            setTimeout(() => {
                clearInterval(checkInterval);
                const isReady = (win.jspdf?.jsPDF && typeof win.jspdf.jsPDF === 'function') ||
                               (win.jsPDF && typeof win.jsPDF === 'function') ||
                               (win.jspdf && typeof win.jspdf === 'function');
                
                if (isReady) {
                    resolve();
                } else {
                    // Try loading again
                    console.log('Existing script not working, loading new one...');
                    loadJSPDFScript().then(resolve).catch(reject);
                }
            }, 3000);
            return;
        }

        loadJSPDFScript().then(resolve).catch(reject);
    });
};

const loadJSPDFScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.async = false; // Load synchronously to ensure it's ready
        
        // @ts-ignore
        const win = window as any;
        
        script.onload = () => {
            // Wait for the library to initialize - jsPDF UMD exposes it as window.jspdf.jsPDF
            let attempts = 0;
            const checkReady = setInterval(() => {
                attempts++;
                // Check multiple ways jsPDF might be available
                const isReady = (win.jspdf?.jsPDF && typeof win.jspdf.jsPDF === 'function') ||
                               (win.jsPDF && typeof win.jsPDF === 'function') ||
                               (win.jspdf && typeof win.jspdf === 'function');
                
                if (isReady) {
                    clearInterval(checkReady);
                    resolve();
                } else if (attempts > 30) {
                    clearInterval(checkReady);
                    // Try alternative CDN
                    console.log('Primary CDN loaded but library not accessible, trying alternative...');
                    loadAlternativeJSPDF().then(resolve).catch(reject);
                }
            }, 100);
        };
        
        script.onerror = () => {
            console.log('Primary CDN failed, trying alternative...');
            loadAlternativeJSPDF().then(resolve).catch(reject);
        };
        
        document.head.appendChild(script);
    });
};

const loadAlternativeJSPDF = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
        script.async = false;
        
        // @ts-ignore
        const win = window as any;
        
        script.onload = () => {
            let attempts = 0;
            const checkReady = setInterval(() => {
                attempts++;
                // Check multiple ways jsPDF might be available
                const isReady = (win.jspdf?.jsPDF && typeof win.jspdf.jsPDF === 'function') ||
                               (win.jsPDF && typeof win.jsPDF === 'function') ||
                               (win.jspdf && typeof win.jspdf === 'function');
                
                if (isReady) {
                    clearInterval(checkReady);
                    resolve();
                } else if (attempts > 30) {
                    clearInterval(checkReady);
                    console.error('Alternative CDN also failed. window.jspdf:', win.jspdf);
                    reject(new Error('jsPDF library loaded but not accessible. Please refresh the page.'));
                }
            }, 100);
        };
        
        script.onerror = () => {
            reject(new Error('Failed to load jsPDF from all CDN sources. Please check your internet connection.'));
        };
        
        document.head.appendChild(script);
    });
};

