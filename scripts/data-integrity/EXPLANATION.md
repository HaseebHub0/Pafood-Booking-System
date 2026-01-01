# Data Cleanup Explanation

## What Was Wrong?

### Historical Data Inconsistencies

The Firestore database has accumulated duplicate records due to earlier logic bugs that have since been fixed. These inconsistencies include:

1. **Duplicate SALE Ledger Entries**
   - **Cause**: Order edit operations were creating new ledger entries instead of updating existing ones
   - **Impact**: Multiple SALE entries for the same orderId, causing financial reporting errors
   - **Example**: Order `ORD-2024-12345` has 3 SALE entries instead of 1

2. **Duplicate Deliveries**
   - **Cause**: Missing idempotency checks when creating deliveries
   - **Impact**: Multiple delivery records for the same orderId
   - **Example**: Order `ORD-2024-12345` has 2 delivery records

3. **Missing Critical Fields**
   - **Cause**: Some ledger entries were created without required fields (region_id, branch_id)
   - **Impact**: Incomplete data that cannot be properly categorized or reported
   - **Example**: SALE entry exists but has no `region_id`

### Root Causes (Now Fixed)

The following bugs have been fixed in the application code:

1. **Order Edit Flow**: Previously, editing an order could trigger creation of new ledger entries. Now fixed with idempotency checks.

2. **Delivery Creation**: Previously, deliveries could be created multiple times. Now fixed with existence checks before creation.

3. **Ledger Entry Creation**: Previously, ledger entries were created without checking for duplicates. Now fixed with idempotency checks in `ledgerService.ts`.

## What Gets Deleted?

### Safe to Delete

1. **Duplicate SALE Entries** (Keeping Earliest)
   - **Rule**: For each orderId with multiple SALE entries, keep the earliest `created_at` entry
   - **Delete**: All later duplicate SALE entries
   - **Example**:
     - Order `ORD-2024-12345` has 3 SALE entries:
       - Entry A: `created_at: 2024-01-15T10:00:00Z` (KEEP)
       - Entry B: `created_at: 2024-01-15T11:00:00Z` (DELETE)
       - Entry C: `created_at: 2024-01-15T12:00:00Z` (DELETE)

2. **Incomplete SALE Entries** (If Complete Ones Exist)
   - **Rule**: If an order has both complete and incomplete SALE entries, keep the earliest complete entry
   - **Delete**: All incomplete entries (missing region_id or branch_id)
   - **Example**:
     - Order `ORD-2024-12345` has:
       - Entry A: Complete (has region_id, branch_id) (KEEP)
       - Entry B: Incomplete (missing region_id) (DELETE)

3. **Duplicate Deliveries** (Keeping Delivered or Earliest)
   - **Rule**: For each orderId with multiple deliveries:
     - If one has status `delivered`, keep that one
     - Otherwise, keep the earliest `createdAt` delivery
   - **Delete**: All other duplicate deliveries
   - **Example**:
     - Order `ORD-2024-12345` has 2 deliveries:
       - Delivery A: `status: delivered`, `createdAt: 2024-01-15T10:00:00Z` (KEEP)
       - Delivery B: `status: pending`, `createdAt: 2024-01-15T09:00:00Z` (DELETE)

### Never Deleted

1. **RETURN Entries**
   - **Rule**: RETURN entries are ALWAYS preserved
   - **Reason**: Returns are critical for financial accuracy and must never be deleted
   - **Example**: Even if there are multiple RETURN entries for an order, none are deleted

2. **Single SALE Entries**
   - **Rule**: If an order has only one SALE entry, it is never deleted
   - **Reason**: Only duplicates are removed, not unique entries

3. **Single Deliveries**
   - **Rule**: If an order has only one delivery, it is never deleted
   - **Reason**: Only duplicates are removed, not unique entries

## Why It's Safe?

### 1. Financial Integrity Preserved

- **Earliest Entry Kept**: The first SALE entry (earliest `created_at`) is always preserved
- **No Data Loss**: Financial data from the original entry is maintained
- **RETURN Entries Protected**: Returns are never deleted, ensuring accurate financial calculations

### 2. Comprehensive Logging

- **Every Operation Logged**: All deletions are logged with:
  - OrderId
  - Document ID
  - Reason for deletion
  - Amount (for ledger entries)
  - Timestamp
- **Audit Trail**: Complete audit trail in JSON format for review

### 3. Dry-Run by Default

- **Safe by Default**: DRY_RUN mode is enabled by default
- **No Accidental Deletes**: Data is only deleted when explicitly disabled
- **Review First**: Analysis report must be reviewed before cleanup

### 4. Idempotent Operations

- **Safe to Re-run**: Scripts can be run multiple times safely
- **Same Result**: Running cleanup multiple times produces the same result
- **No Side Effects**: No unintended data modifications

### 5. Batch-Safe Processing

- **Transaction-Safe**: Operations are batched (max 500 per batch)
- **Atomic Operations**: Each batch is committed as a single transaction
- **Error Handling**: Errors in one batch don't affect others

### 6. Read-First Approach

- **Analysis Before Action**: Analysis script runs first (read-only)
- **Review Required**: Analysis report must be reviewed before cleanup
- **Informed Decisions**: All deletions are based on analysis findings

## Safety Rules Enforced

### Ledger Entry Cleanup Rules

✅ **Always Keep**:
- Earliest SALE entry (by `created_at`)
- All RETURN entries
- Complete entries (if incomplete ones exist)

❌ **Never Delete**:
- RETURN entries
- Single SALE entries (only duplicates)
- Earliest SALE entry

### Delivery Cleanup Rules

✅ **Always Keep**:
- Delivery with status `delivered` (if exists)
- Earliest delivery (if no delivered status)

❌ **Never Delete**:
- Single deliveries (only duplicates)
- Delivered deliveries (if they're the only one)

## Verification After Cleanup

After cleanup, the verification script confirms:

1. **One SALE Per Order**: Each order has exactly one SALE entry
2. **Financial Integrity**: `SUM(SALE.net_cash) - SUM(RETURN.net_cash) = Net Cash`
3. **Delivery Integrity**: One delivery per orderId

## Example Cleanup Scenario

### Before Cleanup

**Order: ORD-2024-12345**
- SALE Entry A: `created_at: 2024-01-15T10:00:00Z`, `net_cash: 5000`, `region_id: region1`
- SALE Entry B: `created_at: 2024-01-15T11:00:00Z`, `net_cash: 5000`, `region_id: region1`
- Delivery A: `status: pending`, `createdAt: 2024-01-15T10:00:00Z`
- Delivery B: `status: delivered`, `createdAt: 2024-01-15T11:00:00Z`

### After Cleanup

**Order: ORD-2024-12345**
- SALE Entry A: `created_at: 2024-01-15T10:00:00Z` (KEPT - earliest)
- SALE Entry B: `created_at: 2024-01-15T11:00:00Z` (DELETED - duplicate)
- Delivery B: `status: delivered` (KEPT - delivered status)
- Delivery A: `status: pending` (DELETED - duplicate)

### Result

- ✅ Financial data preserved (earliest SALE entry kept)
- ✅ Delivery data preserved (delivered delivery kept)
- ✅ No duplicates remaining
- ✅ Data integrity maintained

## Summary

The cleanup process is **safe** because:

1. **Preserves Financial Data**: Earliest entries are kept, ensuring no financial data loss
2. **Protects Critical Data**: RETURN entries are never deleted
3. **Comprehensive Logging**: Every operation is logged for audit
4. **Dry-Run by Default**: No data is deleted unless explicitly enabled
5. **Idempotent**: Can be run multiple times safely
6. **Verified**: Post-cleanup verification confirms data integrity

The cleanup removes **only duplicate and incomplete entries** while **preserving all critical financial data** and maintaining **complete audit trails**.

