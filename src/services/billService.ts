/**
 * Bill Service - Handles bill creation and payment status updates
 * 
 * This service creates bills from deliveries and manages payment status
 * based on cash received and credit amounts.
 */

import { Bill, BillPaymentStatus, BillCreditStatus, generateBillNumber } from '../types/bill';
import { Delivery } from '../types/delivery';
import { Order } from '../types/order';
import { useBillStore } from '../stores/billStore';

/**
 * Create a bill from a delivery
 * 
 * @param delivery - The delivery record
 * @param order - The order record
 * @param collectedAmount - Amount collected at delivery time
 * @returns The created bill or null if creation fails
 */
export async function createBillFromDelivery(
  delivery: Delivery,
  order: Order,
  collectedAmount: number
): Promise<Bill | null> {
  try {
    const billStore = useBillStore.getState();
    const totalAmount = delivery.totalAmount;
    const paidAmount = collectedAmount;
    const remainingCredit = totalAmount - paidAmount;

    // Determine payment status
    let paymentStatus: BillPaymentStatus;
    let creditStatus: BillCreditStatus;

    if (paidAmount === 0) {
      paymentStatus = 'UNPAID';
      creditStatus = 'FULL_CREDIT';
    } else if (paidAmount < totalAmount) {
      paymentStatus = 'PARTIALLY_PAID';
      creditStatus = 'PARTIAL';
    } else {
      paymentStatus = 'PAID';
      creditStatus = 'NONE';
    }

    // Get shop information for customer name
    const { useShopStore } = await import('../stores/shopStore');
    const shopStore = useShopStore.getState();
    const shop = shopStore.getShopById(delivery.shopId);
    const customerName = shop?.ownerName || delivery.shopName;

    // Get booker name if available
    const bookerName = order.bookerName || undefined;

    // Create bill
    const bill = await billStore.createBill({
      billNumber: generateBillNumber(),
      orderId: order.id,
      orderNumber: order.orderNumber,
      deliveryId: delivery.id,
      invoiceId: undefined, // Will be set when invoice is generated
      bookerId: order.bookerId,
      bookerName,
      salesmanId: delivery.salesmanId,
      salesmanName: delivery.salesmanName,
      shopId: delivery.shopId,
      shopName: delivery.shopName,
      customerName,
      totalAmount,
      paidAmount,
      remainingCredit,
      paymentStatus,
      creditStatus,
      billedAt: new Date().toISOString(),
      paidAt: paymentStatus === 'PAID' ? new Date().toISOString() : undefined,
      regionId: delivery.regionId,
      branch: shop?.branch,
      notes: `Bill created from delivery - Order ${order.orderNumber}`,
    });

    console.log('Bill created from delivery:', {
      billNumber: bill?.billNumber,
      orderNumber: order.orderNumber,
      paymentStatus,
      creditStatus,
      remainingCredit,
    });

    return bill;
  } catch (error: any) {
    console.error('Error creating bill from delivery:', error);
    return null;
  }
}

/**
 * Update bill payment status when additional payment is collected
 * 
 * @param billId - The bill ID
 * @param additionalPaidAmount - Additional amount paid
 * @returns True if update was successful, false otherwise
 */
export async function updateBillPaymentStatus(
  billId: string,
  additionalPaidAmount: number
): Promise<boolean> {
  try {
    const billStore = useBillStore.getState();
    const bill = billStore.getBillById(billId);

    if (!bill) {
      console.error('Bill not found:', billId);
      return false;
    }

    // Calculate new amounts
    const newPaidAmount = bill.paidAmount + additionalPaidAmount;
    const newRemainingCredit = Math.max(0, bill.totalAmount - newPaidAmount);

    // Update bill status
    const success = await billStore.updateBillStatus(
      billId,
      newPaidAmount,
      newRemainingCredit
    );

    if (success) {
      console.log('Bill payment status updated:', {
        billNumber: bill.billNumber,
        newPaidAmount,
        newRemainingCredit,
      });
    }

    return success;
  } catch (error: any) {
    console.error('Error updating bill payment status:', error);
    return false;
  }
}

/**
 * Get bill by order ID
 * 
 * @param orderId - The order ID
 * @returns The bill or null if not found
 */
export function getBillByOrder(orderId: string): Bill | undefined {
  const billStore = useBillStore.getState();
  return billStore.getBillByOrder(orderId);
}

