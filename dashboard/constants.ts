
import { Booking, ChartData, LedgerEntry, MenuItem, Product, Shop, StatItem, TopBooker, Transaction, User, Branch, BookerTarget } from "./types";

export const REGIONS = ["Lahore", "Karachi", "Islamabad", "Faisalabad", "Multan", "Peshawar", "Quetta"];

export const REGION_AREAS: Record<string, string[]> = {
    "Lahore": ["Gulberg", "DHA", "Model Town", "Johar Town", "Cavalry Ground"],
    "Karachi": ["Clifton", "DHA", "Gulshan-e-Iqbal", "North Nazimabad", "PECHS"],
    "Islamabad": ["F-6", "F-7", "G-11", "I-8", "Blue Area"],
    "Faisalabad": ["D Ground", "People's Colony", "Samanabad"],
    "Multan": ["Gulgasht", "Bosan Road", "Shah Rukn-e-Alam"],
    "Peshawar": ["Hayatabad", "University Road", "Town"],
    "Quetta": ["Cantt", "Jinnah Road", "Satellite Town"]
};

export const MOCK_BRANCHES: Branch[] = [
    { id: "BR1", regionId: "Lahore", name: "Gulberg Branch", code: "LHR-GUL", managerId: "u2" },
    { id: "BR2", regionId: "Lahore", name: "DHA Branch", code: "LHR-DHA" },
    { id: "BR3", regionId: "Karachi", name: "Clifton Branch", code: "KHI-CLF" },
];

export const MOCK_USERS: Record<string, User> = {
    "admin": {
        id: "u1",
        name: "Super Admin",
        email: "admin@system.com",
        role: "Admin",
        avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuB2izBufbuzC6lpjExamvHDjZSsOgtpScL9ARhcyQz2zAR03GWauj13AibgdurqWO6x0Hv50cELF39K8y02qcwgPsGmY9aBomAy1WACjk52znUqUjbArnK42mAi9MhX-pnbqp3ea1Gyb7W8iRLiC5QxLBTAU9DBEzTcXzQ2C0Bfb4eGi2swhCXHud-q4XKYnSEtaX0-ZSaJX_XeMqZjWwr7uNGbzXxNrJrCAWgUKwfCAI48kyxpXmhI8evUbwcSnLRjVl8AuPOeZA"
    },
    "kpo": {
        id: "u2",
        name: "Ahmed Khan",
        email: "kpo@system.com",
        role: "KPO",
        region: "Lahore",
        branch: "Gulberg Branch",
        avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDY9iJ4OPMTgUIz08FBfwGdvkumbQYzHJ70v9gD7eT-rcm4f3QOXYF0IeOQMoETVmgKbbAlHpCU0FQhaNuCCxCPqqXAVtS0R-A7Ar3GS5uowwf7CIcXbZRlHrZWxQc7TMmNZQ6i-Ua-T7G7O4w6wuDY597XXPrblQt8UIlwlZr3JB05to3L3-onpgA6NR-1hXeOq_gueXuUWgWuy5eebrH4kIIK-7qkMZnSTHuRSEXDYt05E-e4O2wNxGOt7Gnj11HFiH3YabQM6g"
    }
};

export const ADMIN_MENU: MenuItem[] = [
    { label: "Overview", icon: "dashboard", view: 'ADMIN_DASHBOARD' },
    { label: "Org Structure", icon: "account_tree", view: 'ADMIN_REGIONS' },
    { label: "Users & Roles", icon: "group", view: 'ADMIN_USERS' },
    { label: "Products & Pricing", icon: "inventory_2", view: 'ADMIN_PRODUCTS' },
    { label: "Compliance Reports", icon: "analytics", view: 'ADMIN_REPORTS' },
    { label: "Report Generator", icon: "summarize", view: 'ADMIN_REPORT_GENERATOR' },
    { label: "Discount Monitoring", icon: "gavel", view: 'ADMIN_DISCOUNT_MONITORING' },
    { label: "Ledgers", icon: "account_balance_wallet", view: 'ADMIN_LEDGERS' },
];

export const MOCK_PRODUCTS: Product[] = [
    { id: "P001", name: "Pak Cola 1.5L", sku: "bev-cola-1.5", category: "Beverages", price: "220", minPrice: "210", discountPolicy: "Max 5% Bulk", stock: 1200, status: "In Stock" },
    { id: "P002", name: "Mango Juice 1L", sku: "bev-mng-1.0", category: "Beverages", price: "350", minPrice: "340", discountPolicy: "No Discount", stock: 850, status: "In Stock" },
];

export const MOCK_REGIONAL_TOP_PRODUCTS: Record<string, {name: string, sales: number, growth: number}[]> = {
    "Lahore": [
        { name: "Pak Cola 1.5L", sales: 15420, growth: 12 },
        { name: "Mango Juice 1L", sales: 12300, growth: 8 },
        { name: "Chili Chips L", sales: 9800, growth: -2 },
        { name: "Mineral Water 500ml", sales: 8500, growth: 15 },
        { name: "Lemon Soda 500ml", sales: 6200, growth: 5 },
    ],
    "Default": [
        { name: "Pak Cola 1.5L", sales: 5000, growth: 5 },
        { name: "Mineral Water 500ml", sales: 4500, growth: 3 },
        { name: "Mango Juice 1L", sales: 3000, growth: 0 },
        { name: "Salted Chips", sales: 2800, growth: -2 },
        { name: "Orange Soda", sales: 2000, growth: 1 },
    ]
};

export const STATS_DATA: StatItem[] = [
    { label: "Global Sales", value: "PKR 12.4M", trend: 15, icon: "payments", colorClass: "text-primary", bgClass: "bg-primary/20" },
    { label: "Active Regions", value: "7", trend: 0, icon: "map", colorClass: "text-secondary", bgClass: "bg-secondary/20" },
    { label: "Unauthorized Discounts", value: "14", trend: 8, icon: "gavel", colorClass: "text-orange-500", bgClass: "bg-orange-500/20" },
    { label: "Total KPOs", value: "24", trend: 2, icon: "engineering", colorClass: "text-purple-500", bgClass: "bg-purple-500/20" },
];

export const REGIONAL_DATA: ChartData[] = [
    { name: 'Lahore', value: 85 },
    { name: 'Karachi', value: 95 },
    { name: 'Islamabad', value: 65 },
    { name: 'Faisalabad', value: 55 },
];

export const TRANSACTIONS: Transaction[] = [
    { id: "#TRX-9821", region: "Lahore", date: "Oct 24, 2023", salesman: { name: "Ali Hassan", avatarUrl: "https://i.pravatar.cc/150?u=S1" }, amount: "PKR 45,000", status: "Completed" },
];

export const MOCK_LEDGERS: LedgerEntry[] = [
    { id: "L001", partyName: "Bismillah Store", type: "Credit", amount: 18000, date: "2023-10-20", description: "Bill #INV-8821 Payment", region: "Lahore" },
];

export const KPO_MENU: MenuItem[] = [
    { label: "Brain Center", icon: "dashboard", view: 'KPO_DASHBOARD' },
    { label: "Operational Staff", icon: "badge", view: 'KPO_USER_MANAGEMENT' },
    { label: "Booker Targets", icon: "ads_click", view: 'KPO_TARGETS' },
    { label: "Location Tracking", icon: "location_on", view: 'KPO_LOCATION_TRACKING' },
    { label: "Order Control", icon: "receipt_long", view: 'KPO_BOOKINGS' },
    { label: "Edit Requests", icon: "edit_note", view: 'KPO_EDIT_REQUESTS' },
    { label: "Returns & Cash", icon: "payments", view: 'KPO_RETURNS' },
    { label: "Shops Database", icon: "storefront", view: 'KPO_SHOPS' },
    { label: "Branch Ledger", icon: "menu_book", view: 'KPO_LEDGERS' },
    { label: "Branch Reports", icon: "summarize", view: 'KPO_REPORT_GENERATOR' },
];

export const KPO_STATS_DATA: StatItem[] = [
    { label: "Today's Orders", value: "42", trend: 5, icon: "receipt_long", colorClass: "text-primary", bgClass: "bg-primary/20" },
    { label: "Pending Approval", value: "12", trend: -10, icon: "hourglass_top", colorClass: "text-orange-500", bgClass: "bg-orange-500/20" },
    { label: "Total Cash Today", value: "PKR 185k", trend: 8, icon: "payments", colorClass: "text-green-500", bgClass: "bg-green-500/20" },
];

export const MOCK_STAFF_LIST: User[] = [
    { id: "S1", name: "Ali Hassan", role: "Salesman", region: "Lahore", branch: "Gulberg Branch", area: "Gulberg", email: "ali@paf.com", avatarUrl: "https://i.pravatar.cc/150?u=S1" },
    { id: "B1", name: "Bilal Ahmed", role: "Booker", region: "Lahore", branch: "Gulberg Branch", area: "Gulberg", email: "bilal@paf.com", avatarUrl: "https://i.pravatar.cc/150?u=B1", maxDiscount: 5 },
];

export const MOCK_SHOPS: Shop[] = [
    { id: "SH1", name: "Bismillah General Store", ownerName: "Haji Aslam", contact: "0300-1234567", region: "Lahore", area: "Gulberg", addedByBookerId: "B1", address: "Main Market", status: "Active" },
];

export const TOP_BOOKERS: TopBooker[] = [
    { name: "Bilal Ahmed", orders: 145, amount: "1.2M", avatarUrl: "https://i.pravatar.cc/150?u=B1" },
];

export const MOCK_BOOKINGS: Booking[] = [
    {
        id: "BK-2023-001",
        date: "2023-10-25",
        bookerName: "Bilal Ahmed",
        bookerId: "B1",
        shopName: "Bismillah General Store",
        region: "Lahore",
        branch: "Gulberg Branch",
        area: "Gulberg",
        items: [{ productName: "Pak Cola 1.5L", qty: 50, price: 220 }],
        discountApplied: 8,
        totalAmount: 11000,
        status: "New",
        paymentType: "Cash"
    },
    {
        id: "BK-2023-002",
        date: "2023-10-25",
        bookerName: "Bilal Ahmed",
        bookerId: "B1",
        shopName: "Lahore Mart",
        region: "Lahore",
        branch: "Gulberg Branch",
        area: "Gulberg",
        items: [{ productName: "Mango Juice 1L", qty: 10, price: 350 }],
        discountApplied: 0,
        totalAmount: 3500,
        status: "Approved",
        paymentType: "Credit"
    }
];

export const MOCK_BOOKER_TARGETS: BookerTarget[] = [
    {
        bookerId: "B1",
        bookerName: "Bilal Ahmed",
        month: "October 2023",
        ordersTarget: 500,
        ordersAchieved: 420,
        shopsTarget: 50,
        shopsAchieved: 45,
        amountTarget: 2500000,
        amountAchieved: 2100000
    }
];
