
export type UserRole = 'Admin' | 'KPO' | 'Booker' | 'Salesman';
export type View = 
    | 'LOGIN' 
    | 'ADMIN_DASHBOARD' 
    | 'ADMIN_REGIONS' 
    | 'ADMIN_BRANCHES'
    | 'ADMIN_ADD_REGION'
    | 'ADMIN_ADD_BRANCH'
    | 'ADMIN_EDIT_BRANCH'
    | 'ADMIN_REGION_ACTIVITY' 
    | 'ADMIN_REGION_SETTINGS' 
    | 'ADMIN_USERS' 
    | 'ADMIN_ADD_USER'
    | 'ADMIN_EDIT_USER' 
    | 'ADMIN_PRODUCTS'
    | 'ADMIN_EDIT_PRODUCT'
    | 'ADMIN_REPORTS'
    | 'ADMIN_REPORT_GENERATOR'
    | 'ADMIN_DISCOUNT_MONITORING'
    | 'ADMIN_LEDGERS' 
    | 'ADMIN_ACCOUNTS' 
    | 'KPO_DASHBOARD' 
    | 'KPO_BOOKINGS' 
    | 'KPO_LEDGERS' 
    | 'KPO_USER_MANAGEMENT'
    | 'KPO_SHOPS'
    | 'KPO_TARGETS'
    | 'KPO_LOCATION_TRACKING'
    | 'KPO_RETURNS'
    | 'KPO_EDIT_REQUESTS'
    | 'KPO_REPORT_GENERATOR'
    | 'ACCESS_DENIED';

export interface MenuItem {
    label: string;
    icon: string;
    view: View;
}

// Added Region interface to fix import error in dataService.ts
export interface Region {
    id: string;
    name: string;
    code: string;
}

export interface Branch {
    id: string;
    regionId: string;
    name: string;
    code: string;
    managerId?: string;
}

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    avatarUrl: string;
    region?: string; 
    branch?: string; 
    area?: string; 
    maxDiscount?: number; 
}

export interface Shop {
    id: string;
    name: string;
    ownerName: string;
    contact: string;
    region: string;
    area: string;
    addedByBookerId: string;
    address: string;
    status: 'Active' | 'Inactive';
}

export interface Product {
    id: string;
    name: string;
    sku: string;
    category: string;
    price: string;
    minPrice: string;
    discountPolicy: string;
    stock: number;
    status: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

export interface Booking {
    id: string;
    date: string;
    bookerName: string;
    bookerId: string;
    shopName: string;
    region: string;
    branch: string;
    area: string;
    items: { productName: string; qty: number; price: number }[];
    discountApplied: number;
    totalAmount: number;
    status: 'New' | 'Approved' | 'Rejected' | 'Billed' | 'Dispatched';
    paymentType: 'Cash' | 'Credit';
}

export interface BookerTarget {
    bookerId: string;
    bookerName: string;
    month: string;
    ordersTarget: number;
    ordersAchieved: number;
    shopsTarget: number;
    shopsAchieved: number;
    amountTarget: number;
    amountAchieved: number;
}

export interface StatItem {
    label: string;
    value: string;
    trend: number;
    icon: string;
    colorClass: string;
    bgClass: string;
    type?: 'split';
    splitValues?: {
        left: string;
        right: string;
    };
}

export interface TopBooker {
    name: string;
    orders: number;
    amount: string;
    avatarUrl: string;
}

export interface Transaction {
    id: string;
    region: string;
    date: string;
    salesman: {
        name: string;
        avatarUrl: string;
    };
    amount: string;
    status: 'Completed' | 'Pending' | 'Cancelled';
}

export interface LedgerEntry {
    id: string;
    partyName: string;
    type: 'Debit' | 'Credit';
    amount: number;
    date: string;
    description: string;
    region: string;
}

export interface ChartData {
    name: string;
    value: number;
}