# Firestore Internal Assertion Error Fixes

## Root Cause Analysis

The Firestore internal assertion errors (`ID: ca9`, `ID: c050`, `ID: b815`) were caused by multiple issues:

### 1. **Invalid Query Values**
- **Problem**: Queries were executed with `null`, `undefined`, or empty string (`''`) values
- **Location**: `mappingStore.ts` line 58: `currentUser?.id || ''` could result in empty string queries
- **Impact**: Firestore SDK throws internal assertion errors when query values are invalid

### 2. **Duplicate Concurrent Queries**
- **Problem**: `loadMappings()` was called concurrently from multiple stores (shopStore, orderStore, deliveryStore)
- **Impact**: Multiple identical queries running simultaneously caused race conditions and internal state conflicts

### 3. **Missing Query Validation**
- **Problem**: No validation before executing Firestore queries
- **Impact**: Queries with invalid parameters triggered Firestore internal errors

### 4. **Improper Loading Sequence**
- **Problem**: Stores were loading data in parallel without proper sequencing
- **Impact**: Dependencies (mappings → shops → orders) were not respected, causing query conflicts

### 5. **No Listener Lifecycle Management**
- **Problem**: Missing logging and validation for snapshot listeners
- **Impact**: Difficult to debug listener attachment/detachment issues

## Fixes Implemented

### 1. **mappingStore.ts - Query Deduplication & Validation**

```typescript
// Added:
- Promise-based deduplication to prevent concurrent loadMappings() calls
- Strict validation guards for user ID, regionId before queries
- Proper error handling with fallback to local storage
- Defensive logging for all query operations
```

**Key Changes:**
- Added `_loadPromise` to track ongoing loads and prevent duplicates
- Added `isValidQueryValue()` helper to validate query parameters
- Added role-based validation before executing queries
- Improved error messages with context

### 2. **firestore.ts - Query Value Validation**

```typescript
// Added to getDocsWhere():
- Validation to reject null, undefined, or empty string values
- Detailed logging of query parameters before execution
- Clear error messages when invalid values are detected
```

**Key Changes:**
- Throws descriptive errors instead of allowing invalid queries
- Logs query parameters for debugging
- Prevents Firestore internal assertion errors at the source

### 3. **firestore.ts - Listener Lifecycle Management**

```typescript
// Enhanced subscribeToCollection() and subscribeToDoc():
- Logging for listener attach/detach events
- Validation of docId before creating listeners
- Enhanced error handling for ca9, c050, b815 errors
- Wrapped unsubscribe functions with logging
```

**Key Changes:**
- Logs when listeners are attached/detached
- Validates docId before creating document listeners
- Handles all known Firestore internal assertion error IDs
- Returns no-op unsubscribe for invalid docIds

### 4. **shopStore.ts & orderStore.ts - Guard Clauses**

```typescript
// Added:
- Validation of user.id before querying mappings
- Check if mappings are already loaded before reloading
- Proper error handling with fallback strategies
- Enhanced logging with store context
```

**Key Changes:**
- Guards against undefined/null user IDs
- Checks mapping store state before loading
- Validates regionId before querying
- Improved error messages with context

### 5. **DashboardScreen - Proper Loading Sequence**

```typescript
// Updated useEffect to load sequentially:
1. Load mappings first (needed for filtering)
2. Load shops (depends on mappings)
3. Load orders (depends on mappings)
4. Load deliveries (depends on orders)
5. Load payments and bills
```

**Key Changes:**
- Sequential loading for salesmen to prevent conflicts
- Proper delays between operations
- Dependency-aware loading order
- Enhanced logging for debugging

## Safe Loading Pattern

### For Salesman Role:
```
1. User Authentication → Get user.id, user.regionId, user.branch
2. Load Mappings → Get assigned booker IDs
3. Load Shops → Filter by assigned booker IDs
4. Load Orders → Filter by assigned booker IDs and regionId
5. Load Deliveries → Filter by salesman ID
6. Load Payments & Bills → Filter by salesman ID
```

### Best Practices:

1. **Always validate query values**:
   ```typescript
   if (!isValidQueryValue(userId)) {
     throw new Error('Invalid userId for query');
   }
   ```

2. **Prevent duplicate queries**:
   ```typescript
   if (isLoading && _loadPromise) {
     return _loadPromise; // Reuse existing promise
   }
   ```

3. **Sequence dependent operations**:
   ```typescript
   await loadMappings();
   await loadShops(); // Depends on mappings
   await loadOrders(); // Depends on mappings
   ```

4. **Guard against undefined values**:
   ```typescript
   if (!currentUser?.id || currentUser.id.trim() === '') {
     return []; // Don't query with invalid ID
   }
   ```

5. **Log query parameters**:
   ```typescript
   console.log('[Store] Query params:', { field, value, collection });
   ```

## Testing Checklist

- [x] Salesman can load shops without errors
- [x] Salesman can load orders without errors
- [x] Mappings load only once even if called multiple times
- [x] Invalid user IDs don't trigger Firestore errors
- [x] Empty regionId doesn't cause assertion errors
- [x] Listeners are properly attached/detached
- [x] Loading sequence respects dependencies

## Monitoring

Watch for these log messages to verify fixes:
- `[MappingStore] Loading mappings for user:` - Shows query parameters
- `[Firestore] Executing query:` - Shows all query executions
- `[Firestore] Attaching listener to collection:` - Shows listener lifecycle
- `[Dashboard] Starting sequential load for salesman` - Shows loading sequence

## Error Prevention

The fixes prevent Firestore internal assertion errors by:
1. **Validating all query values** before execution
2. **Deduplicating concurrent queries** to prevent race conditions
3. **Sequencing dependent operations** to avoid conflicts
4. **Guarding against undefined/null values** at every level
5. **Proper listener lifecycle management** with validation

These changes ensure that Firestore queries are only executed with valid parameters and in the correct sequence, preventing the internal assertion errors that were occurring.


