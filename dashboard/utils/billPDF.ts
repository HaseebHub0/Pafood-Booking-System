/**
 * Generate bill HTML content for web dashboard
 */
export const generateBillHTML = (order: any, shop: any): string => {
    const orderDate = new Date(order.createdAt || order.orderDate || new Date()).toLocaleDateString('en-PK', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

    const itemsRows = (order.items || []).map((item: any) => `
        <tr>
            <td>${item.productName || item.productNameEn || 'N/A'}</td>
            <td class="text-center">${item.quantity || 0}</td>
            <td class="text-right">PKR ${(item.unitPrice || 0).toLocaleString()}</td>
            <td class="text-right">${item.discountPercent || 0}%</td>
            <td class="text-right">PKR ${(item.finalAmount || item.lineTotal || 0).toLocaleString()}</td>
        </tr>
    `).join('');

    return `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        padding: 20px;
                        color: #333;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 30px;
                        border-bottom: 2px solid #DC2626;
                        padding-bottom: 20px;
                    }
                    .company-name {
                        font-size: 24px;
                        font-weight: bold;
                        color: #DC2626;
                        margin-bottom: 5px;
                    }
                    .bill-title {
                        font-size: 18px;
                        color: #666;
                        margin-top: 10px;
                    }
                    .bill-info {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 30px;
                    }
                    .info-section {
                        flex: 1;
                    }
                    .info-label {
                        font-weight: bold;
                        color: #666;
                        margin-bottom: 5px;
                    }
                    .info-value {
                        color: #333;
                        margin-bottom: 10px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }
                    th {
                        background-color: #DC2626;
                        color: white;
                        padding: 12px;
                        text-align: left;
                        font-weight: bold;
                    }
                    td {
                        padding: 10px;
                        border-bottom: 1px solid #ddd;
                    }
                    tr:nth-child(even) {
                        background-color: #f9f9f9;
                    }
                    .text-right {
                        text-align: right;
                    }
                    .text-center {
                        text-align: center;
                    }
                    .totals {
                        margin-top: 20px;
                        margin-left: auto;
                        width: 300px;
                    }
                    .total-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 8px 0;
                    }
                    .total-label {
                        font-weight: bold;
                    }
                    .grand-total {
                        font-size: 20px;
                        font-weight: bold;
                        color: #DC2626;
                        border-top: 2px solid #DC2626;
                        padding-top: 10px;
                        margin-top: 10px;
                    }
                    .payment-info {
                        margin-top: 30px;
                        padding: 15px;
                        background-color: #f5f5f5;
                        border-radius: 5px;
                    }
                    .footer {
                        margin-top: 40px;
                        text-align: center;
                        color: #666;
                        font-size: 12px;
                    }
                    .signature-section {
                        margin-top: 50px;
                        display: flex;
                        justify-content: space-between;
                    }
                    .signature-box {
                        width: 200px;
                        text-align: center;
                    }
                    .signature-line {
                        border-top: 1px solid #333;
                        margin-top: 50px;
                        padding-top: 5px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="company-name">PAFood Distribution</div>
                    <div class="bill-title">BILL</div>
                </div>

                <div class="bill-info">
                    <div class="info-section">
                        <div class="info-label">Order Number:</div>
                        <div class="info-value">${order.orderNumber || order.id}</div>
                        
                        <div class="info-label">Order Date:</div>
                        <div class="info-value">${orderDate}</div>
                    </div>
                    <div class="info-section">
                        <div class="info-label">Shop Name:</div>
                        <div class="info-value">${shop.shopName || 'N/A'}</div>
                        
                        <div class="info-label">Owner:</div>
                        <div class="info-value">${shop.ownerName || 'N/A'}</div>
                        
                        <div class="info-label">Address:</div>
                        <div class="info-value">${shop.address || 'N/A'}</div>
                        
                        <div class="info-label">Phone:</div>
                        <div class="info-value">${shop.phone || 'N/A'}</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th class="text-center">Qty</th>
                            <th class="text-right">Price</th>
                            <th class="text-right">Discount</th>
                            <th class="text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows}
                    </tbody>
                </table>

                <div class="totals">
                    <div class="total-row">
                        <span class="total-label">Subtotal:</span>
                        <span>PKR ${(order.subtotal || order.grandTotal || 0).toLocaleString()}</span>
                    </div>
                    ${(order.totalDiscount || 0) > 0 ? `
                    <div class="total-row">
                        <span class="total-label">Total Discount:</span>
                        <span>PKR ${order.totalDiscount.toLocaleString()}</span>
                    </div>
                    ` : ''}
                    <div class="total-row grand-total">
                        <span>Grand Total:</span>
                        <span>PKR ${(order.grandTotal || order.totalAmount || 0).toLocaleString()}</span>
                    </div>
                </div>

                ${order.paymentMode ? `
                <div class="payment-info">
                    <div class="info-label">Payment Mode:</div>
                    <div class="info-value">${order.paymentMode.toUpperCase()}</div>
                    ${(order.cashAmount || 0) > 0 ? `<div class="info-value">Cash: PKR ${order.cashAmount.toLocaleString()}</div>` : ''}
                    ${(order.creditAmount || 0) > 0 ? `<div class="info-value">Credit: PKR ${order.creditAmount.toLocaleString()}</div>` : ''}
                </div>
                ` : ''}

                ${order.notes ? `
                <div class="payment-info">
                    <div class="info-label">Notes:</div>
                    <div class="info-value">${order.notes}</div>
                </div>
                ` : ''}

                <div class="signature-section">
                    <div class="signature-box">
                        <div class="signature-line">Customer Signature</div>
                    </div>
                    <div class="signature-box">
                        <div class="signature-line">Authorized Signature</div>
                    </div>
                </div>

                <div class="footer">
                    <p>Thank you for your business!</p>
                    <p>Generated on ${new Date().toLocaleDateString('en-PK')}</p>
                </div>
            </body>
        </html>
    `;
};

/**
 * Print bill using browser print dialog
 */
export const printBill = (order: any, shop: any): void => {
    const html = generateBillHTML(order, shop);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    }
};

/**
 * Generate load form HTML content for web dashboard
 */
export const generateLoadFormHTML = (loadForm: any, delivery: any, order: any): string => {
    const deliveryDate = new Date(delivery.createdAt || delivery.deliveryDate || new Date()).toLocaleDateString('en-PK', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

    const itemsRows = (loadForm.items || []).map((item: any) => `
        <tr>
            <td>${item.productName || 'N/A'}</td>
            <td class="text-center">${item.quantity || 0}</td>
            <td class="text-center">${item.unit || 'Pcs'}</td>
        </tr>
    `).join('');

    return `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        padding: 20px;
                        color: #333;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 30px;
                        border-bottom: 2px solid #DC2626;
                        padding-bottom: 20px;
                    }
                    .company-name {
                        font-size: 24px;
                        font-weight: bold;
                        color: #DC2626;
                        margin-bottom: 5px;
                    }
                    .form-title {
                        font-size: 18px;
                        color: #666;
                        margin-top: 10px;
                    }
                    .form-info {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 30px;
                    }
                    .info-section {
                        flex: 1;
                    }
                    .info-label {
                        font-weight: bold;
                        color: #666;
                        margin-bottom: 5px;
                    }
                    .info-value {
                        color: #333;
                        margin-bottom: 10px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }
                    th {
                        background-color: #DC2626;
                        color: white;
                        padding: 12px;
                        text-align: left;
                        font-weight: bold;
                    }
                    td {
                        padding: 10px;
                        border-bottom: 1px solid #ddd;
                    }
                    tr:nth-child(even) {
                        background-color: #f9f9f9;
                    }
                    .text-right {
                        text-align: right;
                    }
                    .text-center {
                        text-align: center;
                    }
                    .delivery-address {
                        margin-top: 30px;
                        padding: 15px;
                        background-color: #f5f5f5;
                        border-radius: 5px;
                    }
                    .footer {
                        margin-top: 40px;
                        text-align: center;
                        color: #666;
                        font-size: 12px;
                    }
                    .signature-section {
                        margin-top: 50px;
                        display: flex;
                        justify-content: space-between;
                    }
                    .signature-box {
                        width: 200px;
                        text-align: center;
                    }
                    .signature-line {
                        border-top: 1px solid #333;
                        margin-top: 50px;
                        padding-top: 5px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="company-name">PAFood Distribution</div>
                    <div class="form-title">LOAD FORM</div>
                </div>

                <div class="form-info">
                    <div class="info-section">
                        <div class="info-label">Load Form Number:</div>
                        <div class="info-value">${loadForm.loadFormNumber || loadForm.id || 'N/A'}</div>
                        
                        <div class="info-label">Order Number:</div>
                        <div class="info-value">${order.orderNumber || order.id || 'N/A'}</div>
                        
                        <div class="info-label">Delivery Date:</div>
                        <div class="info-value">${deliveryDate}</div>
                    </div>
                    <div class="info-section">
                        <div class="info-label">Salesman:</div>
                        <div class="info-value">${delivery.salesmanName || 'N/A'}</div>
                        
                        <div class="info-label">Contact:</div>
                        <div class="info-value">${delivery.salesmanPhone || 'N/A'}</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th class="text-center">Quantity</th>
                            <th class="text-center">Unit</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows}
                    </tbody>
                </table>

                <div class="delivery-address">
                    <div class="info-label">Delivery Address:</div>
                    <div class="info-value">${delivery.shopAddress || order.shopAddress || 'N/A'}</div>
                </div>

                ${loadForm.notes ? `
                <div class="delivery-address">
                    <div class="info-label">Notes:</div>
                    <div class="info-value">${loadForm.notes}</div>
                </div>
                ` : ''}

                <div class="signature-section">
                    <div class="signature-box">
                        <div class="signature-line">Warehouse Manager</div>
                    </div>
                    <div class="signature-box">
                        <div class="signature-line">Salesman</div>
                    </div>
                    <div class="signature-box">
                        <div class="signature-line">Customer</div>
                    </div>
                </div>

                <div class="footer">
                    <p>Please verify all items before delivery</p>
                    <p>Generated on ${new Date().toLocaleDateString('en-PK')}</p>
                </div>
            </body>
        </html>
    `;
};

/**
 * Print load form using browser print dialog
 */
export const printLoadForm = (loadForm: any, delivery: any, order: any): void => {
    const html = generateLoadFormHTML(loadForm, delivery, order);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    }
};

