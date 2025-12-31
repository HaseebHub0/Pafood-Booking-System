import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Invoice, InvoiceFormData, InvoiceStatus, generateInvoiceNumber } from '../types/invoice';
import { storage, STORAGE_KEYS } from '../services/storage/asyncStorage';
import { useOrderStore } from './orderStore';
import { useDeliveryStore } from './deliveryStore';
import { useShopStore } from './shopStore';

interface InvoiceState {
  invoices: Invoice[];
  isLoading: boolean;
  error: string | null;
}

interface InvoiceActions {
  loadInvoices: () => Promise<void>;
  generateInvoiceFromOrder: (orderId: string, deliveryId?: string) => Promise<Invoice | null>;
  generateInvoiceFromDelivery: (deliveryId: string) => Promise<Invoice | null>;
  updateInvoiceSignature: (id: string, signature: string, signedBy?: string) => Promise<boolean>;
  markInvoicePaid: (id: string, paidAmount: number, paymentReference?: string) => Promise<boolean>;
  getInvoiceById: (id: string) => Invoice | undefined;
  getInvoiceByOrder: (orderId: string) => Invoice | undefined;
  getInvoicesByShop: (shopId: string) => Invoice[];
  getInvoicesByStatus: (status: InvoiceStatus) => Invoice[];
}

type InvoiceStore = InvoiceState & InvoiceActions;

export const useInvoiceStore = create<InvoiceStore>((set, get) => ({
  // Initial state
  invoices: [],
  isLoading: false,
  error: null,

  // Actions
  loadInvoices: async () => {
    set({ isLoading: true, error: null });

    try {
      const storedInvoices = await storage.get<Invoice[]>(STORAGE_KEYS.INVOICES);
      set({ invoices: storedInvoices || [], isLoading: false });
    } catch (error) {
      set({
        error: 'Failed to load invoices',
        isLoading: false,
      });
    }
  },

  generateInvoiceFromOrder: async (orderId, deliveryId) => {
    const { invoices } = get();
    const orderStore = useOrderStore.getState();
    const shopStore = useShopStore.getState();

    // Check if invoice already exists
    const existingInvoice = invoices.find((inv) => inv.orderId === orderId);
    if (existingInvoice) {
      return existingInvoice;
    }

    const order = orderStore.getOrderById(orderId);
    if (!order) {
      set({ error: 'Order not found' });
      return null;
    }

    const shop = shopStore.getShopById(order.shopId);
    if (!shop) {
      set({ error: 'Shop not found' });
      return null;
    }

    // Convert order items to invoice items
    const invoiceItems = order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      productNameUrdu: item.productNameUrdu,
      quantity: item.quantity,
      unit: item.unit || 'Pcs',
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
      discountAmount: item.discountAmount,
      lineTotal: item.finalAmount,
    }));

    const delivery = deliveryId ? useDeliveryStore.getState().getDeliveryById(deliveryId) : null;

    const newInvoice: Invoice = {
      id: uuidv4(),
      invoiceNumber: generateInvoiceNumber(),
      orderId: order.id,
      orderNumber: order.orderNumber,
      shopId: shop.id,
      shopName: shop.shopName,
      ownerName: shop.ownerName,
      shopAddress: shop.address,
      shopPhone: shop.phone,
      deliveryId: deliveryId,
      deliveredAt: delivery?.deliveredAt,
      items: invoiceItems,
      subtotal: order.subtotal,
      totalDiscount: order.totalDiscount,
      grandTotal: order.grandTotal,
      paymentMode: order.paymentMode,
      cashAmount: order.cashAmount,
      creditAmount: order.creditAmount,
      status: 'generated',
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: order.paymentMode === 'credit' 
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 30 days
        : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedInvoices = [...invoices, newInvoice];
    await storage.set(STORAGE_KEYS.INVOICES, updatedInvoices);
    set({ invoices: updatedInvoices });

    // Update delivery to mark invoice as generated
    if (deliveryId) {
      const deliveryStore = useDeliveryStore.getState();
      const delivery = deliveryStore.getDeliveryById(deliveryId);
      if (delivery) {
        // Note: Would need to add updateInvoiceGenerated method to deliveryStore
      }
    }

    return newInvoice;
  },

  generateInvoiceFromDelivery: async (deliveryId) => {
    const deliveryStore = useDeliveryStore.getState();
    const delivery = deliveryStore.getDeliveryById(deliveryId);
    
    if (!delivery) {
      set({ error: 'Delivery not found' });
      return null;
    }

    if (!delivery.orderId) {
      set({ error: 'Order ID not found in delivery' });
      return null;
    }

    return get().generateInvoiceFromOrder(delivery.orderId, deliveryId);
  },

  updateInvoiceSignature: async (id, signature, signedBy) => {
    const { invoices } = get();
    const invoiceIndex = invoices.findIndex((inv) => inv.id === id);
    if (invoiceIndex === -1) return false;

    const updatedInvoice: Invoice = {
      ...invoices[invoiceIndex],
      customerSignature: signature,
      signedAt: new Date().toISOString(),
      signedBy: signedBy || invoices[invoiceIndex].shopName,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedInvoices = invoices.map((inv, index) =>
      index === invoiceIndex ? updatedInvoice : inv
    );
    await storage.set(STORAGE_KEYS.INVOICES, updatedInvoices);
    set({ invoices: updatedInvoices });

    return true;
  },

  markInvoicePaid: async (id, paidAmount, paymentReference) => {
    const { invoices } = get();
    const invoiceIndex = invoices.findIndex((inv) => inv.id === id);
    if (invoiceIndex === -1) return false;

    const invoice = invoices[invoiceIndex];
    const updatedInvoice: Invoice = {
      ...invoice,
      status: 'paid',
      paidAmount,
      paidAt: new Date().toISOString(),
      paymentReference,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedInvoices = invoices.map((inv, index) =>
      index === invoiceIndex ? updatedInvoice : inv
    );
    await storage.set(STORAGE_KEYS.INVOICES, updatedInvoices);
    set({ invoices: updatedInvoices });

    return true;
  },

  getInvoiceById: (id) => {
    return get().invoices.find((invoice) => invoice.id === id);
  },

  getInvoiceByOrder: (orderId) => {
    return get().invoices.find((invoice) => invoice.orderId === orderId);
  },

  getInvoicesByShop: (shopId) => {
    return get()
      .invoices.filter((invoice) => invoice.shopId === shopId)
      .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
  },

  getInvoicesByStatus: (status) => {
    return get().invoices.filter((invoice) => invoice.status === status);
  },
}));

