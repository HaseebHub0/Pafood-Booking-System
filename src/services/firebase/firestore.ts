import {
  collection,
  doc,
  getDoc,
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
  
  return { ...data, id } as T;
};

/**
 * Firestore Service Class
 */
class FirestoreService {
  /**
   * Get a single document by ID
   */
  async getDoc<T>(collectionName: CollectionName, docId: string): Promise<T | null> {
    try {
      const docRef = doc(db, collectionName, docId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      return convertFirestoreDoc<T>(docSnap.data(), docSnap.id);
    } catch (error) {
      console.error(`Error getting document ${docId} from ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Get all documents from a collection
   */
  async getDocs<T>(
    collectionName: CollectionName,
    constraints: QueryConstraint[] = []
  ): Promise<T[]> {
    try {
      const collectionRef = collection(db, collectionName);
      const q = query(collectionRef, ...constraints);
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map((doc) =>
        convertFirestoreDoc<T>(doc.data(), doc.id)
      );
    } catch (error) {
      console.error(`Error getting documents from ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Get documents with filters
   */
  async getDocsWhere<T>(
    collectionName: CollectionName,
    field: string,
    operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'array-contains' | 'in' | 'array-contains-any',
    value: any,
    orderByField?: string,
    orderDirection: 'asc' | 'desc' = 'desc',
    limitCount?: number
  ): Promise<T[]> {
    try {
      const constraints: QueryConstraint[] = [where(field, operator, value)];
      
      if (orderByField) {
        constraints.push(orderBy(orderByField, orderDirection));
      }
      
      if (limitCount) {
        constraints.push(limit(limitCount));
      }
      
      return this.getDocs<T>(collectionName, constraints);
    } catch (error) {
      console.error(`Error getting documents with filter from ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Create or update a document
   */
  async setDoc<T extends { id: string; [key: string]: any }>(
    collectionName: CollectionName,
    data: T,
    merge: boolean = false
  ): Promise<void> {
    try {
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
    } catch (error) {
      console.error(`Error setting document in ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Update a document
   */
  async updateDoc(
    collectionName: CollectionName,
    docId: string,
    data: Partial<any>
  ): Promise<void> {
    try {
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
    } catch (error) {
      console.error(`Error updating document ${docId} in ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Delete a document
   */
  async deleteDoc(collectionName: CollectionName, docId: string): Promise<void> {
    try {
      const docRef = doc(db, collectionName, docId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`Error deleting document ${docId} from ${collectionName}:`, error);
      throw error;
    }
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
  subscribeToCollection<T>(
    collectionName: CollectionName,
    constraints: QueryConstraint[],
    callback: (data: T[]) => void
  ): Unsubscribe {
    const collectionRef = collection(db, collectionName);
    const q = query(collectionRef, ...constraints);
    
    return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      const data = snapshot.docs.map((doc) =>
        convertFirestoreDoc<T>(doc.data(), doc.id)
      );
      callback(data);
    });
  }

  /**
   * Subscribe to a single document
   */
  subscribeToDoc<T>(
    collectionName: CollectionName,
    docId: string,
    callback: (data: T | null) => void
  ): Unsubscribe {
    const docRef = doc(db, collectionName, docId);
    
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(convertFirestoreDoc<T>(docSnap.data(), docSnap.id));
      } else {
        callback(null);
      }
    });
  }
}

export const firestoreService = new FirestoreService();
export default firestoreService;


