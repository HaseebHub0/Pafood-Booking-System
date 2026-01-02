# Firestore Indexes Required for Dashboard Queries

This document lists all required Firestore composite indexes for optimal query performance.

## How to Create Indexes

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `pakasianfood-field`
3. Navigate to **Firestore Database** > **Indexes** tab
4. Click **Create Index**
5. Enter the collection name and field combinations listed below
6. Click **Create**

Alternatively, Firebase will automatically prompt you to create indexes when you run queries that require them. Click the link in the error message to create the index.

## Required Indexes

### 1. Users Collection

#### Index: `users` - `branch` + `role`
**Purpose**: Optimize queries for fetching bookers and salesmen by branch
**Fields**:
- `branch` (Ascending)
- `role` (Ascending)

**Query Example**:
```typescript
query(
  collections.users,
  where('branch', '==', branchName),
  where('role', '==', 'Booker')
)
```

**Why Needed**: Without this index, Firestore must scan all documents to find matching branch and role combinations.

---

#### Index: `users` - `branchId` + `role`
**Purpose**: Alternative query path if branch is stored as `branchId`
**Fields**:
- `branchId` (Ascending)
- `role` (Ascending)

**Query Example**:
```typescript
query(
  collections.users,
  where('branchId', '==', branchName),
  where('role', '==', 'Salesman')
)
```

---

### 2. Shops Collection

#### Index: `shops` - `branch` + `bookerId`
**Purpose**: Optimize queries for fetching shops by branch and booker
**Fields**:
- `branch` (Ascending)
- `bookerId` (Ascending)

**Query Example**:
```typescript
query(
  collections.shops,
  where('branch', '==', branchName),
  where('bookerId', '==', bookerId)
)
```

---

#### Index: `shops` - `branchId` + `bookerId`
**Purpose**: Alternative query path if branch is stored as `branchId`
**Fields**:
- `branchId` (Ascending)
- `bookerId` (Ascending)

---

#### Index: `shops` - `regionId` + `branch`
**Purpose**: Optimize queries for fetching shops by region and branch
**Fields**:
- `regionId` (Ascending)
- `branch` (Ascending)

---

### 3. Orders Collection

#### Index: `orders` - `branch` + `status`
**Purpose**: Optimize queries for fetching orders by branch and status
**Fields**:
- `branch` (Ascending)
- `status` (Ascending)

**Query Example**:
```typescript
query(
  collections.orders,
  where('branch', '==', branchName),
  where('status', '==', 'submitted')
)
```

---

#### Index: `orders` - `bookerId` + `createdAt`
**Purpose**: Optimize queries for fetching orders by booker with date sorting
**Fields**:
- `bookerId` (Ascending)
- `createdAt` (Descending)

**Query Example**:
```typescript
query(
  collections.orders,
  where('bookerId', '==', bookerId),
  orderBy('createdAt', 'desc')
)
```

---

#### Index: `orders` - `status` + `createdAt`
**Purpose**: Optimize queries for fetching delivered orders with date filtering
**Fields**:
- `status` (Ascending)
- `createdAt` (Descending)

**Query Example**:
```typescript
query(
  collections.orders,
  where('status', '==', 'delivered'),
  where('createdAt', '>=', startDate),
  where('createdAt', '<=', endDate)
)
```

---

#### Index: `orders` - `unauthorizedDiscount` + `createdAt`
**Purpose**: Optimize queries for counting unauthorized discounts by date range
**Fields**:
- `unauthorizedDiscount` (Ascending)
- `createdAt` (Ascending)

**Query Example**:
```typescript
query(
  collections.orders,
  where('unauthorizedDiscount', '>', 0),
  where('createdAt', '>=', startDate),
  where('createdAt', '<=', endDate)
)
```

---

### 4. Ledger Transactions Collection

#### Index: `ledger_transactions` - `type` + `created_at`
**Purpose**: Optimize queries for fetching ledger entries by type and date
**Fields**:
- `type` (Ascending)
- `created_at` (Descending)

**Query Example**:
```typescript
query(
  collection(db, 'ledger_transactions'),
  where('type', '==', 'SALE_DELIVERED'),
  where('created_at', '>=', startDate),
  where('created_at', '<=', endDate)
)
```

---

#### Index: `ledger_transactions` - `created_at`
**Purpose**: Optimize queries for fetching ledger entries by date range only
**Fields**:
- `created_at` (Ascending)

**Query Example**:
```typescript
query(
  collection(db, 'ledger_transactions'),
  where('created_at', '>=', startDate),
  where('created_at', '<=', endDate)
)
```

---

## Index Creation Priority

**High Priority** (Create First):
1. `users` - `branch` + `role`
2. `shops` - `branch` + `bookerId`
3. `orders` - `bookerId` + `createdAt`

**Medium Priority**:
4. `orders` - `branch` + `status`
5. `ledger_transactions` - `type` + `created_at`

**Low Priority** (Optional, for future optimizations):
6. `orders` - `status` + `createdAt`
7. `orders` - `unauthorizedDiscount` + `createdAt`
8. `shops` - `regionId` + `branch`

## Notes

- Indexes are created asynchronously and may take a few minutes to build
- Large collections may take longer to index
- You can check index status in Firebase Console
- Queries will work without indexes but will be slower and may hit query limits
- Single-field indexes are created automatically by Firestore

## Troubleshooting

If you see errors like:
- `The query requires an index`
- `index not found`

1. Click the error link in the console to create the index automatically
2. Or manually create the index using the instructions above
3. Wait for the index to finish building (check status in Firebase Console)

## Cost Considerations

- Indexes use storage space (minimal)
- Indexes improve query performance (reduces reads)
- Composite indexes are required for queries with multiple `where` clauses
- Without indexes, queries may fail or be very slow

