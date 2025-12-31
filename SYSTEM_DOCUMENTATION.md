# 📚 PAFood Order Booking System - Complete System Documentation

## 🎯 System Overview

PAFood Order Booking System ek comprehensive field sales management system hai jo mobile app (React Native) aur web dashboard (React) dono platforms par kaam karta hai. System Firebase (Firestore + Auth) use karta hai backend ke liye.

---

## 👥 User Roles & Permissions

### 1. **Admin** (Super Admin)
**Access:** Full system access
**Dashboard:** Web Panel
**Key Features:**
- KPO creation aur management
- Products management (add, edit, delete)
- Global compliance reports
- Unauthorized discount monitoring
- Regional performance analytics
- Report generation (all branches/regions/KPOs)

**Workflow:**
1. Login → Admin Dashboard
2. KPO create karein
3. Products manage karein
4. Reports generate karein
5. Unauthorized discounts monitor karein

---

### 2. **KPO** (Key Point Officer / Branch Manager)
**Access:** Branch-level access
**Dashboard:** Web Panel
**Key Features:**
- Order approval/rejection
- Booker aur Salesman management
- Shop management
- Target assignment (daily/monthly)
- Order edit request approval
- Shop edit request approval
- Stock returns approval
- Branch reports generation
- Ledger management

**Workflow:**
1. Login → KPO Dashboard
2. Pending orders approve/reject karein
3. Staff (Bookers/Salesmen) manage karein
4. Targets assign karein
5. Edit requests handle karein
6. Returns approve karein
7. Branch reports generate karein

---

### 3. **Booker** (Order Booker)
**Access:** Order booking only
**App:** Mobile App (React Native)
**Key Features:**
- Shop creation
- Order booking
- Product selection
- Discount application (with policy enforcement)
- Order submission
- Order edit request
- Target performance tracking
- Visit reporting

**Workflow:**
1. Login → Booker Dashboard
2. Shop create karein (agar naya hai)
3. Order create karein:
   - Shop select
   - Products add
   - Quantity set
   - Discount apply (policy ke according)
4. Order submit karein
5. Edit request bhejein (agar zarurat ho)
6. Target progress dekhein

---

### 4. **Salesman** (Delivery Person)
**Access:** Delivery aur payment collection
**App:** Mobile App (React Native)
**Key Features:**
- Delivery management
- Payment collection (cash/credit)
- Invoice generation
- Stock returns
- Daily reconciliation
- Route execution

**Workflow:**
1. Login → Salesman Dashboard
2. Pending deliveries dekhein
3. Delivery mark karein (delivered/failed)
4. Payment collect karein
5. Invoice generate karein
6. Stock returns create karein
7. Daily report submit karein

---

## 🔄 Complete System Workflow

### **Order Booking Flow (Booker → KPO → Salesman)**

```
1. BOOKER (Mobile App)
   ├─ Shop create karta hai (agar naya)
   ├─ Order create karta hai
   │  ├─ Products select
   │  ├─ Quantity set
   │  ├─ Discount apply (policy check)
   │  └─ Unauthorized discount warning (agar zyada ho)
   ├─ Order submit → Status: "submitted"
   └─ Firebase sync → "orders" collection

2. KPO (Web Dashboard)
   ├─ Order receive karta hai (status: "submitted")
   ├─ Review karta hai
   ├─ Approve → Status: "finalized" → "billed"
   └─ Reject → Status: "rejected"

3. SYSTEM (Auto)
   ├─ Order finalized hone par
   ├─ Delivery record create → "deliveries" collection
   ├─ Status: "assigned" / "pending"
   └─ Salesman ko assign

4. SALESMAN (Mobile App)
   ├─ Delivery receive karta hai
   ├─ Delivery mark karta hai:
   │  ├─ "delivered" → Invoice generate
   │  ├─ "failed" → Reason capture
   │  └─ "returned" → Return record
   ├─ Payment collect karta hai:
   │  ├─ Cash → Ledger update
   │  ├─ Credit → Ledger balance update
   │  └─ Partial → Both update
   └─ Invoice generate (auto)

5. SYSTEM (Auto)
   ├─ Delivery complete hone par
   ├─ Ledger transaction create
   ├─ Shop balance update
   └─ Sales stats update
```

---

## 💾 Firebase Collections Structure

### **Core Collections:**

#### 1. **users** Collection
```javascript
{
  id: "user-id",
  name: "User Name",
  email: "user@email.com",
  role: "Admin" | "KPO" | "Booker" | "Salesman",
  region: "Lahore",
  branch: "Branch Name",
  regionId: "region-id",
  branchId: "branch-id",
  status: "active",
  phone: "+92 300 XXXXXXX",
  
  // Booker-specific
  maxDiscount: 10,
  maxDiscountPercent: 10,
  monthlyUnauthorizedDiscounts: { "2024-12": 500 },
  totalUnauthorizedDiscount: 500,
  
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### 2. **orders** Collection
```javascript
{
  id: "order-id",
  orderNumber: "ORD-2024-XXXXX",
  shopId: "shop-id",
  shopName: "Shop Name",
  bookerId: "booker-id",
  bookerName: "Booker Name",
  branch: "Branch Name",
  regionId: "region-id",
  
  items: [
    {
      id: "item-id",
      productId: "product-id",
      productName: "Product Name",
      quantity: 10,
      unitPrice: 100,
      discountPercent: 5,
      discountAmount: 50,
      lineTotal: 950,
      finalAmount: 950
    }
  ],
  
  subtotal: 1000,
  totalDiscount: 50,
  grandTotal: 950,
  unauthorizedDiscount: 0, // Agar policy se zyada ho
  
  status: "draft" | "submitted" | "edit_requested" | 
          "finalized" | "billed" | "delivered" | "rejected",
  
  paymentMode: "cash",
  cashAmount: 950,
  creditAmount: 0,
  
  createdAt: Timestamp,
  updatedAt: Timestamp,
  syncStatus: "synced" | "pending"
}
```

#### 3. **deliveries** Collection
```javascript
{
  id: "delivery-id",
  orderId: "order-id",
  orderNumber: "ORD-2024-XXXXX",
  shopId: "shop-id",
  shopName: "Shop Name",
  salesmanId: "salesman-id",
  salesmanName: "Salesman Name",
  branch: "Branch Name",
  
  items: [
    {
      productId: "product-id",
      productName: "Product Name",
      quantity: 10,
      unitPrice: 100
    }
  ],
  
  status: "pending" | "assigned" | "in_transit" | 
          "delivered" | "failed" | "returned",
  
  deliveredAt: Timestamp,
  paymentCollected: true,
  paymentMode: "cash" | "credit" | "partial",
  amountCollected: 950,
  
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### 4. **shops** Collection
```javascript
{
  id: "shop-id",
  shopName: "Shop Name",
  ownerName: "Owner Name",
  phone: "+92 300 XXXXXXX",
  address: "Full Address",
  city: "City",
  area: "Area",
  bookerId: "booker-id",
  bookerName: "Booker Name",
  branch: "Branch Name",
  region: "Region Name",
  
  creditLimit: 50000,
  currentBalance: 0,
  status: "active",
  
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### 5. **products** Collection
```javascript
{
  id: "product-id",
  sku: "PROD-001",
  name: "Product Name",
  category: "Category",
  price: 100,
  minPrice: 90,
  discountPolicy: "Max 5%",
  stock: 1000,
  status: "active"
}
```

#### 6. **ledger_transactions** Collection
```javascript
{
  id: "transaction-id",
  shopId: "shop-id",
  shopName: "Shop Name",
  type: "SALE" | "PAYMENT",
  amount: 950, // Positive for SALE, Negative for PAYMENT
  balanceBefore: 0,
  balanceAfter: 950,
  paymentMode: "cash" | "credit",
  orderId: "order-id",
  notes: "Transaction notes",
  date: Timestamp,
  createdAt: Timestamp
}
```

#### 7. **targets** Collection
```javascript
{
  id: "target-id",
  bookerId: "booker-id",
  bookerName: "Booker Name",
  branch: "Branch Name",
  period: "daily" | "monthly",
  periodValue: "2024-12-25" | "2024-12",
  
  ordersTarget: 50,
  ordersAchieved: 45,
  shopsTarget: 5,
  shopsAchieved: 4,
  recoveryTarget: 100000, // Optional
  recoveryAchieved: 95000,
  
  startDate: Timestamp,
  endDate: Timestamp,
  status: "active" | "completed",
  createdAt: Timestamp
}
```

#### 8. **stock_returns** Collection
```javascript
{
  id: "return-id",
  returnNumber: "RET-2024-XXXXX",
  shopId: "shop-id",
  shopName: "Shop Name",
  salesmanId: "salesman-id",
  salesmanName: "Salesman Name",
  branch: "Branch Name",
  
  items: [
    {
      productId: "product-id",
      productName: "Product Name",
      quantity: 5,
      reason: "expired" | "damaged" | "wrong_product" | "defective"
    }
  ],
  
  totalValue: 500,
  status: "pending_kpo_approval" | "approved" | "rejected" | "processed",
  notes: "Return notes",
  
  createdAt: Timestamp,
  approvedAt: Timestamp,
  updatedAt: Timestamp
}
```

#### 9. **edit_requests** Collection
```javascript
{
  id: "request-id",
  shopId: "shop-id", // For shop edit requests
  orderId: "order-id", // For order edit requests (if applicable)
  shopName: "Shop Name",
  
  requestedChanges: {
    shopName: "New Name",
    ownerName: "New Owner",
    // ... other fields
  },
  
  currentValues: {
    shopName: "Old Name",
    ownerName: "Old Owner",
    // ... other fields
  },
  
  status: "pending" | "approved" | "rejected",
  requestedBy: "booker-id",
  requestedByName: "Booker Name",
  requestedAt: Timestamp,
  
  approvedBy: "kpo-id",
  approvedByName: "KPO Name",
  approvedAt: Timestamp,
  rejectedReason: "Reason if rejected"
}
```

#### 10. **activity_logs** Collection
```javascript
{
  id: "log-id",
  userId: "user-id",
  action: "Order created" | "Discount reset" | "Target assigned",
  timestamp: Timestamp
}
```

---

## 🔐 Discount System & Salary Deduction

### **How It Works:**

1. **Discount Policy:**
   - Har booker ko `maxDiscount` / `maxDiscountPercent` assign hota hai
   - Product level par bhi discount policy ho sakti hai
   - System automatically check karta hai allowed limit

2. **Unauthorized Discount Detection:**
   ```
   Order create karte waqt:
   ├─ Item discount calculate
   ├─ Max allowed discount check
   ├─ Agar zyada ho:
   │  ├─ Warning show: "Excess discount will be deducted from salary"
   │  ├─ Booker ko confirmation chahiye
   │  ├─ Unauthorized amount calculate
   │  └─ Track karo monthly
   └─ Order submit (even with unauthorized discount)
   ```

3. **Monthly Tracking:**
   - Har booker ke `users` document me:
     - `monthlyUnauthorizedDiscounts`: { "2024-12": 500 }
     - `totalUnauthorizedDiscount`: 500
   - KPO dashboard me dikhta hai
   - Admin dashboard me bhi visible

4. **Salary Deduction Reset:**
   - KPO admin user details me jata hai
   - Month select karta hai
   - "Reset After Salary Deduction" click karta hai
   - System:
     - Month ka amount `totalUnauthorizedDiscount` se subtract karta hai
     - Month ko `monthlyUnauthorizedDiscounts` se remove karta hai
     - Activity log me record karta hai

---

## 🎯 Target System

### **Target Types:**

1. **Orders Target:**
   - Booker ko daily/monthly orders ka target
   - System count karta hai: ALL orders (submitted, finalized, billed, delivered)
   - Excludes: cancelled, rejected orders
   - Progress: (Achieved Orders / Target Orders) × 100

2. **New Shops Target:**
   - Booker ko new shops create karne ka target
   - System count karta hai: Shops created in period
   - Progress: (Achieved Shops / Target Shops) × 100

3. **Recovery Target (Optional):**
   - Payment collection target
   - System sum karta hai: Payments collected for booker's shops
   - Progress: (Achieved Amount / Target Amount) × 100

### **Target Assignment Flow:**

```
KPO Dashboard → Targets Section
├─ Booker select
├─ Period select (Daily/Monthly)
├─ Date select (for daily)
├─ Targets set:
│  ├─ Orders Target: 50
│  ├─ Shops Target: 5
│  └─ Recovery Target: 100000 (optional)
└─ Save → Firebase "targets" collection

System Auto:
├─ Real-time progress calculate
├─ Achievement percentage update
├─ Completion record (agar 100% ho)
└─ Dashboard me display
```

---

## 📊 Reports & Analytics

### **Admin Reports:**

1. **Compliance Reports:**
   - Unauthorized Discounts: All orders with unauthorized discounts
   - Policy Violations: Discount breaches, credit limit breaches
   - Approval Delays: Orders taking >60 min for approval
   - KPO Performance: Billing TAT, daily orders, accuracy rate
   - Audit Logs: System activity history

2. **Report Generator:**
   - Filter by: Region, Branch, KPO, Date Range
   - Generate: Combined report, Regional report, Branch report, KPO report
   - Export: CSV format
   - Includes: Orders, Sales, Bookers, Salesmen performance

3. **Discount Monitoring:**
   - All bookers with unauthorized discounts
   - Current month total
   - All-time total
   - Reset functionality
   - Export to CSV

### **KPO Reports:**

1. **Branch Report Generator:**
   - Filter by: Date Range, Booker, Salesman
   - Generate: Branch-specific report
   - Export: CSV format
   - Includes: Orders, Sales, Deliveries, Payments

---

## 🔄 Data Flow Between Mobile App & Dashboard

### **Real-time Sync:**

1. **Order Creation (Mobile → Firebase → Dashboard):**
   ```
   Booker App:
   ├─ Order create → Local storage
   ├─ Submit → Firebase "orders" collection
   ├─ Status: "submitted"
   └─ Sync status: "synced"
   
   Firebase:
   └─ Real-time update
   
   KPO Dashboard:
   ├─ onSnapshot listener
   ├─ New order detect
   └─ UI update (pending orders list)
   ```

2. **Order Approval (Dashboard → Firebase → Mobile):**
   ```
   KPO Dashboard:
   ├─ Order approve → Firebase update
   ├─ Status: "finalized" → "billed"
   └─ Activity log
   
   Firebase:
   └─ Real-time update
   
   System Auto:
   ├─ Delivery record create
   ├─ Status: "assigned"
   └─ Salesman ko assign
   
   Salesman App:
   ├─ onSnapshot listener
   ├─ New delivery detect
   └─ UI update (pending deliveries)
   ```

3. **Delivery Update (Mobile → Firebase → Dashboard):**
   ```
   Salesman App:
   ├─ Delivery mark → Firebase update
   ├─ Status: "delivered"
   ├─ Payment collect → Ledger update
   └─ Invoice generate
   
   Firebase:
   ├─ "deliveries" collection update
   ├─ "ledger_transactions" collection update
   └─ "orders" collection update (status: "delivered")
   
   KPO Dashboard:
   ├─ Real-time stats update
   ├─ Sales amount update
   └─ Ledger balance update
   ```

---

## 📱 Mobile App Features Detail

### **Booker App Features:**

1. **Shop Management:**
   - Shop list (assigned shops)
   - New shop creation
   - Shop details view
   - Shop edit request (KPO approval ke liye)

2. **Order Booking:**
   - Shop selection
   - Product catalog
   - Quantity input
   - Discount application
   - Order summary
   - Order submission
   - Order history
   - Order edit request

3. **Targets & Performance:**
   - Current targets (orders, shops, recovery)
   - Achievement progress
   - Performance metrics
   - Completion history

4. **Visit Reporting:**
   - Visit start/end
   - GPS location capture
   - Shop visited/skipped status
   - Order created link

### **Salesman App Features:**

1. **Delivery Management:**
   - Pending deliveries list
   - Delivery details
   - Delivery status update
   - Delivery history

2. **Payment Collection:**
   - Cash collection
   - Credit collection
   - Partial payment
   - Payment history

3. **Invoice Management:**
   - Auto-generation on delivery
   - Invoice details
   - Customer signature (optional)
   - Invoice sharing

4. **Stock Returns:**
   - Return creation
   - Return items selection
   - Return reason
   - Return status tracking
   - Return approval wait

5. **Daily Reconciliation:**
   - Cash submission
   - Stock submission
   - Return notes
   - Expenses tracking

---

## 🌐 Dashboard Features Detail

### **Admin Dashboard:**

1. **KPO Management:**
   - KPO list
   - KPO creation
   - KPO details (performance, activities)
   - KPO reports

2. **Product Management:**
   - Product list (table format)
   - Product creation
   - Product edit
   - Product delete
   - Stock management

3. **Compliance Monitoring:**
   - Unauthorized discounts
   - Policy violations
   - Approval delays
   - Audit logs
   - Export functionality

4. **Report Generation:**
   - Comprehensive reports
   - Regional reports
   - Branch reports
   - KPO reports
   - CSV export

### **KPO Dashboard:**

1. **Order Control:**
   - Pending orders
   - Order details
   - Order approval/rejection
   - Order edit
   - Booker-wise filter
   - Search functionality

2. **Edit Requests:**
   - Order edit requests
   - Shop edit requests
   - Side-by-side comparison
   - Approve/Reject functionality

3. **Staff Management:**
   - Bookers list
   - Salesmen list
   - Staff creation
   - Staff edit
   - Staff details (performance, discounts)

4. **Target Management:**
   - Target assignment (daily/monthly)
   - Target progress tracking
   - Completion history
   - Performance metrics

5. **Shop Management:**
   - Shop list
   - Shop details
   - Shop ledger summary
   - Shop edit requests

6. **Returns Management:**
   - Pending returns
   - Return approval/rejection
   - Return history

7. **Ledger Management:**
   - Branch ledger
   - Shop-wise ledger
   - Transaction history
   - Balance tracking

---

## 🔗 System Integration Points

### **1. Order → Delivery Integration:**
```
Order "finalized" → Auto create Delivery
├─ Copy order items
├─ Assign to salesman (based on route/area)
├─ Status: "assigned"
└─ Salesman app me dikhta hai
```

### **2. Delivery → Invoice Integration:**
```
Delivery "delivered" → Auto generate Invoice
├─ Copy delivery items
├─ Calculate totals
├─ Payment mode set
└─ Invoice number generate
```

### **3. Delivery → Ledger Integration:**
```
Delivery "delivered" + Payment → Ledger Transaction
├─ SALE transaction (positive amount)
├─ Shop balance update
├─ Payment transaction (if credit)
└─ Balance before/after track
```

### **4. Order → Discount Tracking:**
```
Order submit → Unauthorized Discount Check
├─ Calculate unauthorized amount
├─ Update booker's monthlyUnauthorizedDiscounts
├─ Update totalUnauthorizedDiscount
└─ Activity log
```

### **5. Target → Achievement Tracking:**
```
Target assigned → Real-time Progress Calculation
├─ Fetch orders (for orders target)
├─ Fetch shops (for shops target)
├─ Fetch payments (for recovery target)
├─ Calculate achievement percentage
└─ Update target document
```

---

## 🔄 State Management

### **Mobile App (Zustand Stores):**

1. **authStore:** User authentication state
2. **orderStore:** Order creation, submission, history
3. **shopStore:** Shop list, creation, management
4. **productStore:** Product catalog
5. **deliveryStore:** Delivery list, status updates
6. **ledgerStore:** Payment collection, transactions
7. **invoiceStore:** Invoice generation, management
8. **targetStore:** Target tracking, performance
9. **visitStore:** Visit reporting
10. **returnStore:** Stock returns

### **Dashboard (React State + Custom Hooks):**

1. **dataService:** Centralized Firebase operations
2. **useKPODashboardData:** KPO dashboard data hook
3. **useAdminDashboardData:** Admin dashboard data hook
4. **Local state:** Component-specific state management

---

## 📡 Real-time Updates

### **Firebase onSnapshot Listeners:**

1. **Orders:** KPO dashboard me new orders detect
2. **Deliveries:** Salesman app me new deliveries detect
3. **Returns:** KPO dashboard me new returns detect
4. **Targets:** Real-time progress updates
5. **Notifications:** Real-time notification updates

---

## 🔒 Security & Permissions

### **Firebase Security Rules (Conceptual):**

```javascript
// Users can read their own data
allow read: if request.auth != null && 
  (resource.data.id == request.auth.uid || 
   resource.data.role == 'Admin');

// KPO can manage their branch data
allow write: if request.auth != null && 
  (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'KPO' &&
   resource.data.branch == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.branch);

// Admin can do everything
allow read, write: if request.auth != null && 
  get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'Admin';
```

---

## 🚀 Deployment & Setup

### **Prerequisites:**
1. Firebase project setup
2. Firestore database
3. Firebase Authentication enabled
4. Security rules configured

### **Initial Setup:**
1. Run `node scripts/seedAdmin.js` - Admin user create
2. Run `node scripts/seedFirebase.js` - Regions, branches, users
3. Run `node scripts/seedProducts.js` - Products add
4. Configure Firestore security rules
5. Deploy dashboard (Vercel/Netlify)
6. Build mobile app (Expo)

---

## 📝 Key Features Summary

✅ **Complete Order Lifecycle:** Draft → Submit → Approve → Deliver → Invoice → Payment
✅ **Real-time Sync:** Mobile app aur dashboard dono real-time updates
✅ **Discount Control:** Policy enforcement, unauthorized tracking, salary deduction
✅ **Target Management:** Daily/monthly targets, real-time progress, completion tracking
✅ **Comprehensive Reports:** Admin aur KPO dono ke liye detailed reports
✅ **Edit Request System:** Order aur shop edit requests with approval workflow
✅ **Stock Returns:** Complete return workflow with KPO approval
✅ **Ledger System:** Complete financial tracking with shop-wise balances
✅ **Multi-role Support:** Admin, KPO, Booker, Salesman - har role ke liye specific features
✅ **Mobile & Web:** Dono platforms par full functionality

---

## 🔧 Technical Stack

- **Frontend (Mobile):** React Native, Expo, Zustand
- **Frontend (Dashboard):** React, TypeScript, Tailwind CSS
- **Backend:** Firebase (Firestore, Auth)
- **State Management:** Zustand (Mobile), React Hooks (Dashboard)
- **Real-time:** Firebase onSnapshot
- **Storage:** AsyncStorage (Mobile), LocalStorage (Dashboard)

---

**Document Version:** 1.0  
**Last Updated:** December 2024  
**System Status:** Production Ready ✅



