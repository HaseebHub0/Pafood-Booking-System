# Firestore Data Cleanup and Integrity System

This directory contains scripts for analyzing, cleaning, and verifying Firestore data integrity. These scripts help identify and safely remove duplicate ledger entries and deliveries while maintaining financial integrity.

## ⚠️ Important Safety Notes

- **All scripts are read-only by default** - Analysis and verification scripts never modify data
- **Cleanup script has DRY_RUN mode enabled by default** - No data is deleted unless explicitly disabled
- **Always run analysis first** - Review the analysis report before running cleanup
- **Backup your data** - Consider exporting Firestore data before running cleanup
- **Test in development first** - Verify scripts work correctly in a test environment

## Prerequisites

1. **Node.js and npm** installed
2. **Firebase project access** - Scripts use Firebase SDK (not Admin SDK)
3. **Dependencies** - Install required packages:
   ```bash
   npm install
   ```
   This will install `tsx` (TypeScript executor) and `@types/node` automatically.

## Scripts Overview

### 1. `analyze-data.ts` - Data Analysis (Read-Only)

**Purpose**: Analyzes Firestore data to identify:
- Duplicate SALE entries per orderId
- Missing critical fields in ledger entries
- Duplicate deliveries per orderId

**Usage**:
```bash
npm run data:analyze
```

**Output**:
- Console summary with statistics
- `analysis-report-{timestamp}.json` file with detailed findings

**What it does**:
- Scans `ledger_transactions` collection
- Groups entries by `order_id` and `type`
- Identifies duplicate SALE entries
- Identifies entries with missing `order_id`, `region_id`, or `branch_id`
- Scans `deliveries` collection
- Identifies duplicate deliveries per orderId

**Safety**: ✅ Read-only, never modifies data

---

### 2. `cleanup-duplicates.ts` - Duplicate Cleanup (With DRY_RUN)

**Purpose**: Safely removes duplicate entries based on analysis report

**Usage**:
```bash
# Dry run (safe, no deletes) - DEFAULT
DRY_RUN=true npm run data:cleanup

# Actual cleanup (after review)
DRY_RUN=false npm run data:cleanup
```

**Output**:
- Console progress and summary
- `cleanup-{dryrun|executed}-{timestamp}.json` log file

**What it does**:
- Loads the most recent analysis report
- For duplicate SALE entries:
  - Keeps: Earliest `created_at` entry
  - Deletes: All later duplicates
  - Never deletes: RETURN entries, single SALE entries
- For duplicate deliveries:
  - Keeps: Status = 'delivered' (if exists), else earliest `createdAt`
  - Deletes: All others
- Processes deletions in batches (max 500 per batch)

**Safety Rules**:
- ✅ Always keeps earliest SALE entry
- ✅ Always keeps RETURN entries
- ✅ Always keeps delivered delivery (if exists)
- ✅ Batch operations (max 500)
- ❌ NEVER deletes if only one entry exists
- ❌ NEVER deletes RETURN entries

**Safety**: ⚠️ Modifies data when DRY_RUN=false

---

### 3. `verify-integrity.ts` - Post-Cleanup Verification

**Purpose**: Verifies data integrity after cleanup

**Usage**:
```bash
npm run data:verify
```

**Output**:
- Console summary with pass/fail status
- `integrity-report-{timestamp}.json` file

**What it verifies**:
1. **One SALE Per Order**: Each order has exactly one SALE entry
2. **Financial Integrity**: Calculates `SUM(SALE.net_cash) - SUM(RETURN.net_cash) = Net Cash`
3. **Delivery Integrity**: One delivery per orderId, orderId matches order.id

**Safety**: ✅ Read-only, never modifies data

---

## Complete Workflow

### Step 1: Analysis (Read-Only)
```bash
npm run data:analyze
```

**Review the output**:
- Check `analysis-report-{timestamp}.json`
- Understand what will be deleted
- Verify no critical data will be lost

### Step 2: Cleanup (Dry Run First)
```bash
# First, run in dry-run mode
DRY_RUN=true npm run data:cleanup

# Review the cleanup log: cleanup-dryrun-{timestamp}.json
# If satisfied, run actual cleanup:
DRY_RUN=false npm run data:cleanup
```

**Review the cleanup log**:
- Check `cleanup-{dryrun|executed}-{timestamp}.json`
- Verify all deletions are correct
- Ensure no unintended data was removed

### Step 3: Verification
```bash
npm run data:verify
```

**Review the integrity report**:
- Check `integrity-report-{timestamp}.json`
- Verify all checks pass
- Confirm data integrity

---

## Configuration

Configuration is in `config.ts`:

```typescript
export const CONFIG = {
  DRY_RUN: process.env.DRY_RUN !== 'false', // Default: true (safe)
  BATCH_SIZE: 500, // Firestore batch limit
  COLLECTIONS: {
    LEDGER: 'ledger_transactions',
    DELIVERIES: 'deliveries',
    ORDERS: 'orders'
  }
};
```

## File Structure

```
scripts/data-integrity/
├── config.ts                # Shared configuration and types
├── analyze-data.ts          # Step 1: Analysis (read-only)
├── cleanup-duplicates.ts    # Step 2: Cleanup (with DRY_RUN)
├── verify-integrity.ts      # Step 3: Verification
└── README.md                # This file
```

## Output Files

All output files are saved in the project root directory:

- `analysis-report-{timestamp}.json` - Analysis findings
- `cleanup-{dryrun|executed}-{timestamp}.json` - Cleanup operation log
- `integrity-report-{timestamp}.json` - Verification results

## Troubleshooting

### "No analysis report found"
- Run `analyze-data.ts` first before running cleanup

### "Permission denied" or "Missing or insufficient permissions"
- **Option 1**: Authenticate with admin credentials:
  ```bash
  REQUIRE_AUTH=true npm run data:analyze
  ```
  Then enter admin email and password when prompted.

- **Option 2**: Temporarily update Firestore security rules:
  - Go to Firebase Console > Firestore > Rules
  - For analysis/verification (read-only):
    ```
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        match /{document=**} {
          allow read: if true;
        }
      }
    }
    ```
  - For cleanup (read/write):
    ```
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        match /{document=**} {
          allow read, write: if true;
        }
      }
    }
    ```
  - **Remember to revert rules after cleanup!**

### "Batch size exceeded"
- The script automatically handles batching (max 500 operations)
- If you see this error, it's a bug - please report it

### "TypeScript errors"
- Ensure dependencies are installed:
  ```bash
  npm install
  ```
  This installs `tsx`, `@types/node`, and other required packages.

## Safety Features

1. **DRY_RUN Mode**: Default enabled, prevents accidental deletes
2. **Comprehensive Logging**: Every operation logged to JSON file
3. **Idempotent Operations**: Can be run multiple times safely
4. **Batch Processing**: Respects Firestore limits (500 operations per batch)
5. **Financial Integrity**: Never deletes RETURN entries, always keeps earliest SALE
6. **Read-First Approach**: Analysis before cleanup

## What Was Wrong?

Historical data inconsistencies were caused by:
- Order edit operations creating duplicate ledger entries
- Missing idempotency checks when creating deliveries
- Missing idempotency checks when creating ledger SALE entries

## What Gets Deleted?

**Safe to delete**:
- Duplicate SALE entries (keeping earliest)
- Duplicate deliveries (keeping delivered or earliest)
- Incomplete SALE entries (if complete ones exist)

**Never deleted**:
- RETURN entries (always preserved)
- Single SALE entries (only duplicates are removed)
- Single deliveries (only duplicates are removed)

## Why It's Safe?

1. **Earliest entry preserved**: Financial data from the first entry is kept
2. **RETURN entries never deleted**: Returns are always preserved for financial accuracy
3. **Comprehensive logging**: Every deletion is logged with reason
4. **Dry-run by default**: No data is deleted unless explicitly enabled
5. **Idempotent**: Running multiple times produces the same result
6. **Batch-safe**: Operations are batched and transaction-safe

## Support

If you encounter issues:
1. Check the console output for error messages
2. Review the JSON report files for details
3. Ensure you're running scripts in the correct order
4. Verify Firebase configuration is correct

---

**Remember**: Always backup your data before running cleanup operations!

