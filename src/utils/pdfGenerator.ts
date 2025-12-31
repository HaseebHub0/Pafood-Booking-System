import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Invoice } from '../types/invoice';

/**
 * Generate PDF invoice HTML content
 */
export const generateInvoiceHTML = (invoice: Invoice): string => {
  const invoiceDate = new Date(invoice.invoiceDate).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const dueDate = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString('en-PK', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'N/A';

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
          .invoice-title {
            font-size: 18px;
            color: #666;
            margin-top: 10px;
          }
          .invoice-info {
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
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">PAFood Distribution</div>
          <div class="invoice-title">INVOICE</div>
        </div>

        <div class="invoice-info">
          <div class="info-section">
            <div class="info-label">Invoice Number:</div>
            <div class="info-value">${invoice.invoiceNumber}</div>
            
            <div class="info-label">Invoice Date:</div>
            <div class="info-value">${invoiceDate}</div>
            
            ${invoice.dueDate ? `
            <div class="info-label">Due Date:</div>
            <div class="info-value">${dueDate}</div>
            ` : ''}
          </div>

          <div class="info-section">
            <div class="info-label">Bill To:</div>
            <div class="info-value">
              <strong>${invoice.shopName}</strong><br>
              ${invoice.ownerName}<br>
              ${invoice.shopAddress}<br>
              Phone: ${invoice.shopPhone}
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Sr.</th>
              <th>Product</th>
              <th class="text-center">Quantity</th>
              <th class="text-right">Unit Price</th>
              <th class="text-right">Discount</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items
              .map(
                (item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${item.productName}</td>
                <td class="text-center">${item.quantity} ${item.unit}</td>
                <td class="text-right">Rs. ${item.unitPrice.toLocaleString()}</td>
                <td class="text-right">${item.discountPercent}%</td>
                <td class="text-right">Rs. ${item.lineTotal.toLocaleString()}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span class="total-label">Subtotal:</span>
            <span>Rs. ${invoice.subtotal.toLocaleString()}</span>
          </div>
          ${invoice.totalDiscount > 0 ? `
          <div class="total-row">
            <span class="total-label">Total Discount:</span>
            <span>-Rs. ${invoice.totalDiscount.toLocaleString()}</span>
          </div>
          ` : ''}
          ${invoice.taxAmount ? `
          <div class="total-row">
            <span class="total-label">Tax:</span>
            <span>Rs. ${invoice.taxAmount.toLocaleString()}</span>
          </div>
          ` : ''}
          <div class="total-row grand-total">
            <span>Grand Total:</span>
            <span>Rs. ${invoice.grandTotal.toLocaleString()}</span>
          </div>
        </div>

        <div class="payment-info">
          <div class="info-label">Payment Mode:</div>
          <div class="info-value">
            ${invoice.paymentMode.toUpperCase()}
            ${invoice.paymentMode === 'partial' || invoice.paymentMode === 'credit' ? `
              <br>Cash: Rs. ${invoice.cashAmount.toLocaleString()}
              <br>Credit: Rs. ${invoice.creditAmount.toLocaleString()}
            ` : ''}
          </div>
          ${invoice.paidAmount ? `
          <div style="margin-top: 10px;">
            <div class="info-label">Paid Amount:</div>
            <div class="info-value">Rs. ${invoice.paidAmount.toLocaleString()}</div>
          </div>
          ` : ''}
        </div>

        ${invoice.notes ? `
        <div style="margin-top: 20px;">
          <div class="info-label">Notes:</div>
          <div class="info-value">${invoice.notes}</div>
        </div>
        ` : ''}

        <div class="footer">
          <p>Thank you for your business!</p>
          <p>Generated on ${new Date().toLocaleString('en-PK')}</p>
        </div>
      </body>
    </html>
  `;
};

/**
 * Generate and print PDF invoice
 */
export const printInvoice = async (invoice: Invoice): Promise<void> => {
  try {
    const html = generateInvoiceHTML(invoice);
    
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    await Print.printAsync({
      uri,
      printerUrl: undefined, // Use default printer
    });
  } catch (error) {
    console.error('Error printing invoice:', error);
    throw new Error('Failed to print invoice');
  }
};

/**
 * Generate bill HTML content
 */
export const generateBillHTML = (order: any, shop: any): string => {
  const orderDate = new Date(order.createdAt || order.orderDate || new Date()).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const itemsRows = order.items.map((item: any) => `
    <tr>
      <td>${item.productName || item.productNameEn || 'N/A'}</td>
      <td class="text-center">${item.quantity}</td>
      <td class="text-right">PKR ${item.unitPrice.toLocaleString()}</td>
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
          ${order.totalDiscount > 0 ? `
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
          ${order.cashAmount > 0 ? `<div class="info-value">Cash: PKR ${order.cashAmount.toLocaleString()}</div>` : ''}
          ${order.creditAmount > 0 ? `<div class="info-value">Credit: PKR ${order.creditAmount.toLocaleString()}</div>` : ''}
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
 * Generate and print PDF bill
 */
export const printBill = async (order: any, shop: any): Promise<void> => {
  try {
    const html = generateBillHTML(order, shop);
    
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    await Print.printAsync({
      uri,
      printerUrl: undefined, // Use default printer
    });
  } catch (error) {
    console.error('Error printing bill:', error);
    throw new Error('Failed to print bill');
  }
};

/**
 * Generate and share PDF bill
 */
export const shareBill = async (order: any, shop: any): Promise<void> => {
  try {
    const html = generateBillHTML(order, shop);
    
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri);
    } else {
      console.warn('Sharing is not available on this platform');
    }
  } catch (error) {
    console.error('Error sharing bill:', error);
    throw new Error('Failed to share bill');
  }
};

/**
 * Generate and share PDF invoice
 */
export const shareInvoice = async (invoice: Invoice): Promise<void> => {
  try {
    const html = generateInvoiceHTML(invoice);
    
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share Invoice ${invoice.invoiceNumber}`,
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Error sharing invoice:', error);
    throw new Error('Failed to share invoice');
  }
};

