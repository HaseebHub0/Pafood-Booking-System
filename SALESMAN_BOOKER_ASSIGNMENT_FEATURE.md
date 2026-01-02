# Salesman-Booker Assignment Feature Implementation

## Overview
This feature allows KPO users to assign bookers to salesmen when creating salesmen. Shops and orders created by those bookers will automatically be linked to the assigned salesman.

## Implementation Steps

### ✅ Completed
1. Added `salesmanId` and `salesmanName` fields to Shop type
2. Added `salesmanId` and `salesmanName` fields to Order type

### 🔄 In Progress
3. Update KPO user management form to allow assigning bookers when creating salesman
4. Add function to create/update mappings in dataService
5. Update shopStore to auto-assign salesmanId when shop is created
6. Update orderStore to auto-assign salesmanId when order is created
7. Update shopStore and orderStore queries to filter by salesmanId for salesmen

## Files to Modify

### Dashboard
- `dashboard/components/KPOUserManagement.tsx` - Add booker selection UI for salesman creation
- `dashboard/dataService.ts` - Add createOrUpdateMapping function

### Mobile App
- `src/stores/shopStore.ts` - Auto-assign salesmanId in addShop
- `src/stores/orderStore.ts` - Auto-assign salesmanId in submitOrder
- `src/stores/shopStore.ts` - Update loadShops to filter by salesmanId for salesmen
- `src/stores/orderStore.ts` - Already filters by mapping (verify it works with salesmanId)

## Logic Flow

### When KPO Creates Salesman:
1. KPO fills form (name, email, password)
2. KPO selects bookers to assign (new UI component)
3. On submit:
   - Create user in Firestore
   - Create/update mapping document in mappings collection
   - Mapping contains: salesmanId, salesmanName, bookerIds[], regionId

### When Booker Creates Shop:
1. Booker creates shop
2. System looks up mapping by bookerId
3. If mapping exists, set salesmanId and salesmanName on shop
4. Shop is saved with salesmanId

### When Booker Creates Order:
1. Booker creates/submits order
2. System looks up mapping by bookerId
3. If mapping exists, set salesmanId and salesmanName on order
4. Order is saved with salesmanId

### When Salesman Views Shops/Orders:
1. Salesman logs in
2. System looks up mapping by salesmanId
3. Get assigned bookerIds
4. Filter shops/orders where bookerId in assigned bookerIds OR salesmanId == current salesmanId










