import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  onSnapshot,
  QueryConstraint,
  DocumentData,
  QuerySnapshot,
  Unsubscribe,
  enableNetwork,
  disableNetwork,
  waitForPendingWrites,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLLECTIONS, CollectionName } from './collections';

/**
 * Convert Firestore Timestamp to ISO string
 */
export const timestampToISO = (timestamp: any): string => {
  if (!timestamp) return new Date().toISOString();
  if (timestamp.toDate) {
    return timestamp.toDate().toISOString();
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  return timestamp;
};

/**
 * Convert ISO string to Firestore Timestamp
 */
export const isoToTimestamp = (isoString: string): Timestamp => {
  return Timestamp.fromDate(new Date(isoString));
};

/**
 * Convert Firestore document to app entity
 */
export const convertFirestoreDoc = <T extends { [key: string]: any }>(
  docData: DocumentData,
  id: string
): T => {
  const data = { ...docData };
  
  // Convert Timestamps to ISO strings
  Object.keys(data).forEach((key) => {
    if (data[key] && typeof data[key] === 'object') {
      if (data[key].toDate) {
        data[key] = data[key].toDate().toISOString();
      } else if (data[key] instanceof Date) {
        data[key] = data[key].toISOString();
      }
    }
  });
  
  return { ...data, id } as unknown as T;
};

/**
 * Query manager to prevent duplicate queries and handle errors
 */
interface QueryKey {
  collection: string;
  constraints: string;
}

class QueryManager {
  private activeQueries: Map<string, Promise<any>> = new Map();
  private activeListeners: Map<string, { count: number; unsubscribe?: () => void }> = new Map();
  private queryQueue: Map<string, Array<{ resolve: (value: any) => void; reject: (error: any) => void }>> = new Map();
  private isProcessing: Set<string> = new Set();
  private lastQueryTime: number = 0;
  private readonly MIN_QUERY_INTERVAL = 100; // Minimum 100ms between any queries (reduced to allow faster data loading)
  private circuitBreakerOpen: boolean = false;
  private circuitBreakerOpenTime: number = 0;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 2000; // 2 seconds before retrying after b815 error
  private globalQueryLock: Promise<void> = Promise.resolve(); // Serialize ALL queries globally
  private globalListenerLock: Promise<void> = Promise.resolve(); // Serialize ALL listener attachments globally
  private lastListenerTime: number = 0;
  private readonly MIN_LISTENER_INTERVAL = 300; // Minimum 300ms between listener attachments
  
  getQueryKey(collection: string, constraints: QueryConstraint[]): string {
    const constraintsStr = constraints.map(c => {
      // Create a string representation of the constraint
      if ('fieldPath' in c && 'opStr' in c && 'value' in c) {
        return `${c.fieldPath}_${c.opStr}_${c.value}`;
      }
      return JSON.stringify(c);
    }).join('|');
    return `${collection}:${constraintsStr}`;
  }
  
  async executeQuery<T>(
    collection: string,
    constraints: QueryConstraint[],
    queryFn: () => Promise<T>
  ): Promise<T> {
    const key = this.getQueryKey(collection, constraints);
    
    // Check circuit breaker - if open, wait for recovery timeout
    if (this.circuitBreakerOpen) {
      const timeSinceOpen = Date.now() - this.circuitBreakerOpenTime;
      if (timeSinceOpen < this.CIRCUIT_BREAKER_TIMEOUT) {
        const waitTime = this.CIRCUIT_BREAKER_TIMEOUT - timeSinceOpen;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.circuitBreakerOpen = false; // Reset after waiting
      } else {
        this.circuitBreakerOpen = false; // Timeout expired, reset
      }
    }
    
    // If query is already in progress, return the existing promise
    if (this.activeQueries.has(key)) {
      console.log(`[QueryManager] Reusing existing query: ${key}`);
      return this.activeQueries.get(key)!;
    }
    
    // If query is being processed, queue this request
    if (this.isProcessing.has(key)) {
      return new Promise<T>((resolve, reject) => {
        if (!this.queryQueue.has(key)) {
          this.queryQueue.set(key, []);
        }
        this.queryQueue.get(key)!.push({ resolve, reject });
      });
    }
    
    // Mark as processing
    this.isProcessing.add(key);
    
    // Serialize ALL queries globally using a lock chain to prevent concurrent execution
    const previousLock = this.globalQueryLock;
    let releaseLock: () => void;
    this.globalQueryLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    
    // Wait for previous query to complete
    await previousLock;
    
    // Global throttle: Ensure minimum interval between ANY queries to prevent watch stream conflicts
    const now = Date.now();
    const timeSinceLastQuery = now - this.lastQueryTime;
    if (timeSinceLastQuery < this.MIN_QUERY_INTERVAL) {
      const delayNeeded = this.MIN_QUERY_INTERVAL - timeSinceLastQuery;
      await new Promise(resolve => setTimeout(resolve, delayNeeded));
    }
    this.lastQueryTime = Date.now();
    
    // Create new query promise
    const queryPromise = queryFn()
      .then((result) => {
        // Resolve all queued requests with the same result
        const queued = this.queryQueue.get(key);
        if (queued && queued.length > 0) {
          queued.forEach(({ resolve }) => resolve(result));
          this.queryQueue.delete(key);
        }
        
        // Remove from active queries and processing when done
        this.activeQueries.delete(key);
        this.isProcessing.delete(key);
        releaseLock!(); // Release global lock
        return result;
      })
      .catch((error) => {
        // If b815 error, open circuit breaker and reset network to recover watch stream
        // Check for b815 in multiple formats since error message format can vary
        const errorMsg = error?.message || '';
        const isB815Error = error?.code === 'b815' || 
                          errorMsg.includes('b815') || 
                          errorMsg.includes('ID: b815') ||
                          errorMsg.includes('(ID: b815)');
        if (isB815Error) {
          this.circuitBreakerOpen = true;
          this.circuitBreakerOpenTime = Date.now();
          
          // Reset network to recover from watch stream corruption (async, don't block)
          (async () => {
            try {
              await disableNetwork(db);
              await new Promise(resolve => setTimeout(resolve, 300));
              await enableNetwork(db);
            } catch (e) {
              // Ignore network reset errors
            }
          })();
        }
        
        // Reject all queued requests
        const queued = this.queryQueue.get(key);
        if (queued && queued.length > 0) {
          queued.forEach(({ reject }) => reject(error));
          this.queryQueue.delete(key);
        }
        
        // Remove from active queries and processing on error
        this.activeQueries.delete(key);
        this.isProcessing.delete(key);
        releaseLock!(); // Release global lock even on error
        throw error;
      });
    
    this.activeQueries.set(key, queryPromise);
    return queryPromise;
  }
  
  trackListener(key: string, unsubscribe: () => void): void {
    const existing = this.activeListeners.get(key);
    if (existing) {
      existing.count++;
    } else {
      this.activeListeners.set(key, { count: 1, unsubscribe });
    }
  }
  
  untrackListener(key: string): void {
    const existing = this.activeListeners.get(key);
    if (existing) {
      existing.count--;
      if (existing.count <= 0) {
        this.activeListeners.delete(key);
      }
    }
  }
  
  getListenerCount(key: string): number {
    return this.activeListeners.get(key)?.count || 0;
  }
  
  clear() {
    this.activeQueries.clear();
    this.activeListeners.clear();
    this.queryQueue.clear();
    this.isProcessing.clear();
  }
}

/**
 * Firestore Service Class
 */
class FirestoreService {
  private networkInitialized: boolean = false;
  private queryManager: QueryManager = new QueryManager();
  
  /**
   * Handle Firestore internal assertion errors with retry logic
   */
  private async handleFirestoreError<T>(
    operation: () => Promise<T>,
    retries: number = 2,
    delay: number = 100
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a Firestore internal assertion error (ca9 for reads/listens, c050 for writes, b815 for async queue)
        const isInternalError = error.message?.includes('INTERNAL ASSERTION FAILED') ||
                                error.message?.includes('Unexpected state') ||
                                error.code === 'ca9' ||
                                error.code === 'c050' ||
                                error.code === 'b815' ||
                                (error.message && error.message.includes('ID: ca9')) ||
                                (error.message && error.message.includes('ID: c050')) ||
                                (error.message && error.message.includes('ID: b815'));
        
        // b815 errors are async queue related - don't retry immediately, let circuit breaker handle it
        // Check for b815 in multiple ways since error format can vary
        const isB815Error = error.code === 'b815' || 
                          (error.message && (
                            error.message.includes('ID: b815') || 
                            error.message.includes('b815') ||
                            error.message.includes('(ID: b815)')
                          ));
        
        // For b815 errors, don't retry - let circuit breaker handle recovery
        if (isB815Error) {
          // Don't retry b815 errors - throw immediately to trigger circuit breaker
          throw error;
        }
        
        const baseDelay = delay;
        const maxRetries = retries;
        
        if (isInternalError && attempt < maxRetries) {
          const waitTime = baseDelay * Math.pow(2, attempt); // Exponential backoff
          console.warn(`[Firestore] Internal assertion error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${waitTime}ms...`, {
            errorCode: error.code,
          });
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        // If not an internal error or out of retries, throw
        throw error;
      }
    }
    
    throw lastError;
  }

  /**
   * Ensure Firestore network is enabled
   */
  private async ensureNetworkEnabled(): Promise<void> {
    if (this.networkInitialized) {
      return; // Already initialized, skip to avoid blocking
    }

    try {
      // Just enable network, don't disable first (causes blocking)
      await enableNetwork(db);
      this.networkInitialized = true;
      console.log('[Firestore] Network enabled');
    } catch (error: any) {
      // If already enabled (failed-precondition), that's fine
      if (error.code === 'failed-precondition') {
        this.networkInitialized = true;
        console.log('[Firestore] Network already enabled');
      } else {
        console.warn('[Firestore] Network enable warning:', error.message);
        // Still mark as initialized to avoid infinite loops
        this.networkInitialized = true;
      }
    }
  }

  /**
   * Get a single document by ID
   * Uses getDocFromServer to force network request and avoid offline cache issues
   */
  async getDoc<T extends { [key: string]: any }>(collectionName: CollectionName, docId: string): Promise<T | null> {
    try {
      // Ensure network is enabled before making requests
      await this.ensureNetworkEnabled();

      const docRef = doc(db, collectionName, docId);
      
      // Use getDocFromServer to force network request (bypasses cache)
      // This ensures we get fresh data and don't get stuck in offline mode
      let docSnap;
      try {
        docSnap = await getDocFromServer(docRef);
      } catch (serverError: any) {
        // Check if it's a Firestore internal assertion error (b815, ca9, c050)
        const errorMsg = serverError?.message || '';
        const isInternalError = serverError?.code === 'b815' || 
                              serverError?.code === 'ca9' ||
                              serverError?.code === 'c050' ||
                              errorMsg.includes('b815') ||
                              errorMsg.includes('ca9') ||
                              errorMsg.includes('c050') ||
                              errorMsg.includes('INTERNAL ASSERTION FAILED');
        
        // If it's an internal error, use regular getDoc directly (don't log)
        // If it's a network error, log and fallback
        if (!isInternalError) {
        console.log('[Firestore] getDocFromServer failed, trying regular getDoc:', serverError.message);
        }
        docSnap = await getDoc(docRef);
      }
      
      if (!docSnap.exists()) {
        return null;
      }
      
      return convertFirestoreDoc<T>(docSnap.data(), docSnap.id);
    } catch (error: any) {
      console.error(`Error getting document ${docId} from ${collectionName}:`, error);
      
      // If offline error, try to enable network and retry once
      const isOfflineError = error.message?.includes('offline') || 
                            error.message?.includes('Failed to get document') ||
                            error.message?.includes('client is offline') ||
                            error.code === 'unavailable';
      
      if (isOfflineError) {
        console.log('[Firestore] Offline error detected, enabling network and retrying...');
        try {
          this.networkInitialized = false;
          await this.ensureNetworkEnabled();
          
          // Retry with regular getDoc (avoid getDocFromServer if watch stream is corrupted)
          const docRef = doc(db, collectionName, docId);
          // Use regular getDoc instead of getDocFromServer to avoid watch stream conflicts
          const docSnap = await getDoc(docRef);
          
          if (!docSnap.exists()) {
            return null;
          }
          
          return convertFirestoreDoc<T>(docSnap.data(), docSnap.id);
        } catch (retryError: any) {
          console.error(`Retry failed for document ${docId}:`, retryError);
          throw new Error(`Failed to get document: ${retryError.message || 'Network unavailable'}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Get all documents from a collection
   */
  async getDocs<T extends { [key: string]: any }>(
    collectionName: CollectionName,
    constraints: QueryConstraint[] = []
  ): Promise<T[]> {
    await this.ensureNetworkEnabled();
    
    return this.queryManager.executeQuery(
      collectionName,
      constraints,
      async () => {
        return this.handleFirestoreError(async () => {
      const collectionRef = collection(db, collectionName);
      const q = query(collectionRef, ...constraints);
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map((doc) =>
        convertFirestoreDoc<T>(doc.data(), doc.id)
      );
        });
    }
    );
  }

  /**
   * Get documents with filters
   */
  async getDocsWhere<T extends { [key: string]: any }>(
    collectionName: CollectionName,
    field: string,
    operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'array-contains' | 'in' | 'array-contains-any',
    value: any,
    orderByField?: string,
    orderDirection: 'asc' | 'desc' = 'desc',
    limitCount?: number
  ): Promise<T[]> {
    // Validate query value to prevent Firestore internal assertion errors
    if (value === null || value === undefined) {
      const errorMsg = `[Firestore] Invalid query value for field "${field}": value is null or undefined`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    // Empty strings can cause Firestore internal assertion errors
    if (typeof value === 'string' && value.trim() === '') {
      const errorMsg = `[Firestore] Invalid query value for field "${field}": value is empty string`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    // Log query parameters for debugging
    console.log(`[Firestore] Executing query: ${collectionName} where ${field} ${operator}`, {
      value: typeof value === 'string' ? value.substring(0, 50) : value,
      orderBy: orderByField,
      limit: limitCount,
    });
    
      const constraints: QueryConstraint[] = [where(field, operator, value)];
      
      if (orderByField) {
        constraints.push(orderBy(orderByField, orderDirection));
      }
      
      if (limitCount) {
        constraints.push(limit(limitCount));
      }
      
      return this.getDocs<T>(collectionName, constraints);
  }

  /**
   * Create or update a document
   */
  async setDoc<T extends { id: string; [key: string]: any }>(
    collectionName: CollectionName,
    data: T,
    merge: boolean = false
  ): Promise<void> {
    await this.ensureNetworkEnabled();
    
    return this.handleFirestoreError(async () => {
      const { id, ...docData } = data;
      const docRef = doc(db, collectionName, id);
      
      // Convert ISO strings to Timestamps and filter out undefined values
      const firestoreData: any = {};
      Object.keys(docData).forEach((key) => {
        const value = docData[key];
        
        // Skip undefined values (Firestore doesn't accept them)
        if (value === undefined) {
          return;
        }
        
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
          // Check if it's an ISO date string
          try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              firestoreData[key] = isoToTimestamp(value);
            } else {
              firestoreData[key] = value;
            }
          } catch {
            firestoreData[key] = value;
          }
        } else {
          firestoreData[key] = value;
        }
      });
      
      await setDoc(docRef, firestoreData, { merge });
    });
  }

  /**
   * Update a document
   */
  async updateDoc(
    collectionName: CollectionName,
    docId: string,
    data: Partial<any>
  ): Promise<void> {
    await this.ensureNetworkEnabled();
    
    return this.handleFirestoreError(async () => {
      const docRef = doc(db, collectionName, docId);
      
      // Convert ISO strings to Timestamps
      const firestoreData: any = {};
      Object.keys(data).forEach((key) => {
        const value = data[key];
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
          try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              firestoreData[key] = isoToTimestamp(value);
            } else {
              firestoreData[key] = value;
            }
          } catch {
            firestoreData[key] = value;
          }
        } else {
          firestoreData[key] = value;
        }
      });
      
      await updateDoc(docRef, firestoreData);
    });
  }

  /**
   * Delete a document
   */
  async deleteDoc(collectionName: CollectionName, docId: string): Promise<void> {
    await this.ensureNetworkEnabled();
    
    return this.handleFirestoreError(async () => {
      const docRef = doc(db, collectionName, docId);
      await deleteDoc(docRef);
    });
  }

  /**
   * Batch write operations
   */
  async batchWrite(operations: Array<{
    type: 'set' | 'update' | 'delete';
    collection: CollectionName;
    docId: string;
    data?: any;
  }>): Promise<void> {
    try {
      const batch = writeBatch(db);
      
      operations.forEach((op) => {
        const docRef = doc(db, op.collection, op.docId);
        
        switch (op.type) {
          case 'set':
            if (op.data) {
              const { id, ...docData } = op.data;
              batch.set(docRef, docData);
            }
            break;
          case 'update':
            if (op.data) {
              batch.update(docRef, op.data);
            }
            break;
          case 'delete':
            batch.delete(docRef);
            break;
        }
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error in batch write:', error);
      throw error;
    }
  }

  /**
   * Subscribe to real-time updates
   */
  subscribeToCollection<T extends { [key: string]: any }>(
    collectionName: CollectionName,
    constraints: QueryConstraint[],
    callback: (data: T[]) => void
  ): Unsubscribe {
    const collectionRef = collection(db, collectionName);
    const q = query(collectionRef, ...constraints);
    
    // Create listener key for tracking
    const listenerKey = this.queryManager.getQueryKey(collectionName, constraints);
    const existingCount = this.queryManager.getListenerCount(listenerKey);
    
    // Log listener attachment
    const constraintsStr = constraints.map(c => JSON.stringify(c)).join(', ');
    console.log(`[Firestore] Attaching listener to collection: ${collectionName}`, {
      constraints: constraintsStr,
      timestamp: new Date().toISOString(),
      listenerKey,
      existingCount,
    });
    
    let isUnsubscribed = false;
    let isProcessingSnapshot = false;
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        if (isUnsubscribed) {
          return;
        }
        
        isProcessingSnapshot = true;
        try {
      const data = snapshot.docs.map((doc) =>
        convertFirestoreDoc<T>(doc.data(), doc.id)
      );
          console.log(`[Firestore] Snapshot update for ${collectionName}: ${data.length} documents`);
          callback(data);
        } catch (error: any) {
          console.error(`[Firestore] Error processing snapshot for ${collectionName}:`, error);
          callback([]);
        } finally {
          isProcessingSnapshot = false;
        }
      },
      (error: any) => {
        // Handle Firestore internal assertion errors (ca9, c050, b815)
        const isInternalError = error.message?.includes('INTERNAL ASSERTION FAILED') ||
                                error.message?.includes('Unexpected state') ||
                                error.code === 'ca9' ||
                                error.code === 'c050' ||
                                error.code === 'b815' ||
                                (error.message && error.message.includes('ID: ca9')) ||
                                (error.message && error.message.includes('ID: c050')) ||
                                (error.message && error.message.includes('ID: b815'));
        
        if (isInternalError) {
          console.warn(`[Firestore] Internal assertion error in listener for ${collectionName}. This is usually temporary.`, {
            errorCode: error.code,
            errorMessage: error.message?.substring(0, 200),
          });
          return;
        }
        
        console.error(`[Firestore] Snapshot error for ${collectionName}:`, error);
      }
    );
    
    // Track listener
    this.queryManager.trackListener(listenerKey, unsubscribe);
    
    // Return wrapped unsubscribe with logging
    return () => {
      isUnsubscribed = true;
      console.log(`[Firestore] Detaching listener from collection: ${collectionName}`, {
        listenerKey,
        wasProcessing: isProcessingSnapshot,
      });
      
      // Wait if processing snapshot to avoid race condition
      if (isProcessingSnapshot) {
        setTimeout(() => {
          unsubscribe();
          this.queryManager.untrackListener(listenerKey);
        }, 100);
      } else {
        unsubscribe();
        this.queryManager.untrackListener(listenerKey);
      }
    };
  }

  /**
   * Subscribe to a single document
   */
  subscribeToDoc<T extends { [key: string]: any }>(
    collectionName: CollectionName,
    docId: string,
    callback: (data: T | null) => void
  ): Unsubscribe {
    // Validate docId before creating listener
    if (!docId || docId.trim() === '') {
      console.error(`[Firestore] Invalid docId for subscribeToDoc: ${collectionName}/${docId}`);
      callback(null);
      // Return a no-op unsubscribe function
      return () => {};
    }
    
    const docRef = doc(db, collectionName, docId);
    const listenerKey = `${collectionName}/${docId}`;
    const existingCount = this.queryManager.getListenerCount(listenerKey);
    
    // Log listener attachment
    console.log(`[Firestore] Attaching listener to document: ${collectionName}/${docId}`, {
      timestamp: new Date().toISOString(),
      listenerKey,
      existingCount,
    });
    
    let isUnsubscribed = false;
    let isProcessingSnapshot = false;
    
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (isUnsubscribed) {
          return;
        }
        
        isProcessingSnapshot = true;
        try {
      if (docSnap.exists()) {
            console.log(`[Firestore] Document snapshot update for ${collectionName}/${docId}`);
        callback(convertFirestoreDoc<T>(docSnap.data(), docSnap.id));
      } else {
            console.log(`[Firestore] Document does not exist: ${collectionName}/${docId}`);
            callback(null);
          }
        } catch (error: any) {
          console.error(`[Firestore] Error processing document snapshot for ${collectionName}/${docId}:`, error);
        callback(null);
        } finally {
          isProcessingSnapshot = false;
        }
      },
      (error: any) => {
        // Handle Firestore internal assertion errors (ca9, c050, b815)
        const isInternalError = error.message?.includes('INTERNAL ASSERTION FAILED') ||
                                error.message?.includes('Unexpected state') ||
                                error.code === 'ca9' ||
                                error.code === 'c050' ||
                                error.code === 'b815' ||
                                (error.message && error.message.includes('ID: ca9')) ||
                                (error.message && error.message.includes('ID: c050')) ||
                                (error.message && error.message.includes('ID: b815'));
        
        if (isInternalError) {
          console.warn(`[Firestore] Internal assertion error in document listener for ${collectionName}/${docId}. This is usually temporary.`, {
            errorCode: error.code,
            errorMessage: error.message?.substring(0, 200),
          });
          return;
        }
        
        console.error(`[Firestore] Document snapshot error for ${collectionName}/${docId}:`, error);
      }
    );
    
    // Track listener
    this.queryManager.trackListener(listenerKey, unsubscribe);
    
    // Return wrapped unsubscribe with logging
    return () => {
      isUnsubscribed = true;
      console.log(`[Firestore] Detaching listener from document: ${collectionName}/${docId}`, {
        listenerKey,
        wasProcessing: isProcessingSnapshot,
      });
      
      // Wait if processing snapshot to avoid race condition
      if (isProcessingSnapshot) {
        setTimeout(() => {
          unsubscribe();
          this.queryManager.untrackListener(listenerKey);
        }, 100);
      } else {
        unsubscribe();
        this.queryManager.untrackListener(listenerKey);
      }
    };
  }
}

export const firestoreService = new FirestoreService();
export default firestoreService;


