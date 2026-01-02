// Use unified Firebase SDK from npm package (v12.6.0) instead of CDN
import { 
    getDocs, 
    getDoc,
    getDocFromServer,
    enableNetwork,
    addDoc, 
    updateDoc, 
    deleteDoc,
    doc, 
    setDoc,
    query, 
    where, 
    serverTimestamp,
    orderBy,
    limit,
    onSnapshot,
    Timestamp,
    collection
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, collections, auth } from './firebase';
import { User, Region, Branch, Booking, Product, Shop } from './types';
import { DateRange } from './utils/dateUtils';

export const dataService = {
    // Regions & Branches
    async getRegions() {
        try {
            const snapshot = await getDocs(query(collections.regions, orderBy('name')));
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error: any) {
            console.error("Firestore Error [getRegions]:", error.message);
            return [];
        }
    },

    async addRegion(data: any) {
        try {
            const docRef = await addDoc(collections.regions, { ...data, createdAt: serverTimestamp() });
            return docRef.id; // Return document ID
        } catch (error: any) {
            console.error("Firestore Error [addRegion]:", error.message);
            throw error;
        }
    },

    async deleteRegion(regionId: string) {
        try {
            const regionRef = doc(db, 'regions', regionId);
            const regionSnap = await getDoc(regionRef);
            
            if (!regionSnap.exists()) {
                throw new Error('Region not found');
            }

            const regionData = regionSnap.data();
            const regionName = regionData.name || regionId;
            
            // Check if region has branches
            const branches = await this.getBranches(regionId);
            
            if (branches.length > 0) {
                throw new Error(`Cannot delete region. It has ${branches.length} branch(es). Please delete or reassign branches first.`);
            }

            // Check if region has users assigned
            const allUsers = await this.getAllUsers();
            const regionUsers = allUsers.filter((user: any) => user.regionId === regionId);
            
            if (regionUsers.length > 0) {
                throw new Error(`Cannot delete region. It has ${regionUsers.length} user(s) assigned. Please reassign users first.`);
            }

            await deleteDoc(regionRef);
            await this.logActivity('system', `Deleted region ${regionName}`);
            return true;
        } catch (error: any) {
            console.error("Firestore Error [deleteRegion]:", error.message);
            throw error;
        }
    },

    async getBranches(regionId: string) {
        try {
            const q = query(collections.branches, where("regionId", "==", regionId));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error: any) {
            console.error("Firestore Error [getBranches]:", error.message);
            return [];
        }
    },

    async addBranch(data: any) {
        try {
            const docRef = await addDoc(collections.branches, { ...data, createdAt: serverTimestamp() });
            return docRef.id; // Return document ID
        } catch (error: any) {
            console.error("Firestore Error [addBranch]:", error.message);
            throw error;
        }
    },

    async updateBranch(branchId: string, data: any) {
        try {
            const branchRef = doc(db, 'branches', branchId);
            await updateDoc(branchRef, {
                ...data,
                updatedAt: serverTimestamp()
            });
            await this.logActivity('system', `Updated branch ${data.name || branchId}`);
            return true;
        } catch (error: any) {
            console.error("Firestore Error [updateBranch]:", error.message);
            throw error;
        }
    },

    async deleteBranch(branchId: string) {
        try {
            const branchRef = doc(db, 'branches', branchId);
            const branchSnap = await getDoc(branchRef);
            
            if (!branchSnap.exists()) {
                throw new Error('Branch not found');
            }

            const branchData = branchSnap.data();
            
            // Check if branch has assigned KPO or users
            const branchName = branchData.name || branchId;
            const bookers = await this.getBranchBookers(branchName);
            const salesmen = await this.getBranchSalesmen(branchName);
            
            if (bookers.length > 0 || salesmen.length > 0) {
                throw new Error(`Cannot delete branch. It has ${bookers.length} bookers and ${salesmen.length} salesmen assigned. Please reassign them first.`);
            }

            await deleteDoc(branchRef);
            await this.logActivity('system', `Deleted branch ${branchName}`);
            return true;
        } catch (error: any) {
            console.error("Firestore Error [deleteBranch]:", error.message);
            throw error;
        }
    },

    /**
     * Fetch profile by UID (Direct Lookup)
     * This works with your rule: match /users/{userId} { allow read: if auth.uid == userId }
     */
    async getUserProfile(uid: string) {
        try {
            // Ensure network is enabled before fetching
            try {
                await enableNetwork(db);
                console.log('[Dashboard] Network enabled for getUserProfile');
            } catch (networkError: any) {
                // If already enabled, that's fine
                if (networkError.code !== 'failed-precondition') {
                    console.warn('[Dashboard] Network enable warning:', networkError.message);
                }
            }

            const userRef = doc(db, 'users', uid);
            
            // Try getDocFromServer first (forces network request)
            let userSnap;
            try {
                userSnap = await getDocFromServer(userRef);
            } catch (serverError: any) {
                // Check if it's a Firestore internal assertion error
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
                    console.log('[Dashboard] getDocFromServer failed, trying regular getDoc:', serverError.message);
                }
                userSnap = await getDoc(userRef);
            }
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                console.log('getUserProfile - Raw data from Firestore:', userData);
                console.log('getUserProfile - Role from Firestore:', userData.role, 'Type:', typeof userData.role);
                
                // Normalize role to ensure correct case
                let normalizedRole = userData.role;
                if (typeof userData.role === 'string') {
                    const roleLower = userData.role.toLowerCase();
                    if (roleLower === 'booker') {
                        normalizedRole = 'Booker';
                    } else if (roleLower === 'salesman') {
                        normalizedRole = 'Salesman';
                    } else if (roleLower === 'kpo') {
                        normalizedRole = 'KPO';
                    } else if (roleLower === 'admin') {
                        normalizedRole = 'Admin';
                    }
                }
                
                // Map maxDiscount to maxDiscountPercent if needed (for app compatibility)
                if (userData.maxDiscount !== undefined && userData.maxDiscount !== null && !userData.maxDiscountPercent) {
                    userData.maxDiscountPercent = userData.maxDiscount;
                }
                
                const user = { 
                    id: userSnap.id, 
                    ...userData,
                    role: normalizedRole
                } as User;
                
                console.log('getUserProfile - Returning user with normalized role:', user.role);
                return user;
            }
            return null;
        } catch (error: any) {
            console.error("Firestore Error [getUserProfile]:", error.message);
            throw error;
        }
    },

    async createUser(userData: any) {
        try {
            // Normalize email (trim and lowercase)
            const normalizedEmail = (userData.email || '').trim().toLowerCase();
            
            if (!normalizedEmail) {
                throw new Error('Email is required');
            }

            // First create Firebase Auth user
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                normalizedEmail,
                userData.password || 'TempPassword123!' // Default password if not provided
            );
            
            const userId = userCredential.user.uid; // Use Auth UID as document ID
            
            // Create user document in Firestore with Auth UID as document ID
            // Remove undefined values to avoid Firestore errors
            // Normalize role to ensure correct case
            let userRole = userData.role || 'Booker'; // Default to Booker if not specified
            if (typeof userRole === 'string') {
                const roleLower = userRole.toLowerCase();
                if (roleLower === 'booker') {
                    userRole = 'Booker';
                } else if (roleLower === 'salesman') {
                    userRole = 'Salesman';
                } else if (roleLower === 'kpo') {
                    userRole = 'KPO';
                } else if (roleLower === 'admin') {
                    userRole = 'Admin';
                }
            }
            
            console.log('Creating Firestore document with role:', userRole, 'from userData.role:', userData.role);
            
            const userDoc: any = {
                id: userId,
                email: normalizedEmail, // Use normalized email
                name: (userData.name || '').trim(),
                role: userRole, // Ensure role is set correctly with proper case
                region: userData.region || '',
                branch: userData.branch || '',
                phone: userData.phone || '',
                status: userData.status || 'Active',
                createdAt: serverTimestamp(),
                createdBy: userData.createdBy || 'system'
            };
            
            console.log('Firestore document being created:', { ...userDoc, createdAt: 'timestamp' });

            // Only add fields that have values (not undefined)
            if (userData.regionId) {
                userDoc.regionId = userData.regionId;
            }
            if (userData.area) {
                userDoc.area = userData.area;
            }
            
            // Map maxDiscount to maxDiscountPercent for app compatibility
            // Dashboard uses maxDiscount, app uses maxDiscountPercent
            if (userData.maxDiscount !== undefined && userData.maxDiscount !== null) {
                userDoc.maxDiscount = userData.maxDiscount;
                userDoc.maxDiscountPercent = userData.maxDiscount; // Also set for app
            }
            if (userData.maxDiscountPercent !== undefined && userData.maxDiscountPercent !== null) {
                userDoc.maxDiscountPercent = userData.maxDiscountPercent;
            }
            // maxDiscountAmount is optional - if not set, amount limit check will be skipped
            if (userData.maxDiscountAmount !== undefined && userData.maxDiscountAmount !== null) {
                userDoc.maxDiscountAmount = userData.maxDiscountAmount;
            }
            
            // Use setDoc with Auth UID as document ID (not addDoc)
            await setDoc(doc(db, 'users', userId), userDoc);
            
            await this.logActivity(userData.createdBy || 'system', `Created user: ${userData.name} (${userData.role})`);
            return { id: userId, ...userDoc };
        } catch (error: any) {
            console.error("Firestore Error [createUser]:", error);
            console.error("Error code:", error.code);
            console.error("Error message:", error.message);
            
            // Provide user-friendly error messages
            if (error.code === 'auth/email-already-in-use') {
                throw new Error('This email is already registered. Please use a different email address.');
            } else if (error.code === 'auth/invalid-email') {
                throw new Error('Invalid email address. Please check the email format.');
            } else if (error.code === 'auth/weak-password') {
                throw new Error('Password is too weak. Please use a stronger password (at least 6 characters).');
            } else {
                throw new Error(error.message || 'Failed to create user. Please try again.');
            }
        }
    },

    /**
     * Delete a user (KPO can delete salesmen and bookers)
     */
    async deleteUser(userId: string): Promise<boolean> {
        try {
            console.log('deleteUser: Deleting user:', userId);
            
            // Delete user document from Firestore
            const userRef = doc(db, 'users', userId);
            await deleteDoc(userRef);
            
            // Note: We don't delete the Firebase Auth user here as that requires admin privileges
            // The Auth user will remain but won't have access to the system without the Firestore document
            
            await this.logActivity('system', `Deleted user: ${userId}`);
            console.log('deleteUser: User deleted successfully');
            return true;
        } catch (error: any) {
            console.error("Firestore Error [deleteUser]:", error.message);
            throw new Error(error.message || 'Failed to delete user');
        }
    },

    // Orders & Compliance
    async getOrders(branchId: string) {
        try {
            const q = query(collections.orders, where("branchId", "==", branchId), orderBy("date", "desc"));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error: any) {
            console.error("Firestore Error [getOrders]:", error.message);
            return [];
        }
    },

    async updateOrderStatus(orderId: string, status: string, userId: string) {
        try {
            const orderRef = doc(db, 'orders', orderId);
            await updateDoc(orderRef, { status, updatedAt: serverTimestamp() });
            await this.logActivity(userId, `Updated order ${orderId} status to ${status}`);
        } catch (error: any) {
            console.error("Firestore Error [updateOrderStatus]:", error.message);
        }
    },

    // Logging
    async logActivity(userId: string, action: string) {
        try {
            return await addDoc(collections.activityLogs, {
                userId,
                action,
                timestamp: serverTimestamp()
            });
        } catch (error: any) {
            console.warn("Log Activity failed:", error.message);
        }
    },

    // Real-time listener for Live Dashboard
    subscribeToActivity(callback: (data: any[]) => void) {
        const q = query(collections.activityLogs, orderBy("timestamp", "desc"), limit(10));
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard/dataService.ts:379',message:'subscribeToActivity onSnapshot called',data:{collection:'activityLogs'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
        // #endregion
        return onSnapshot(q, 
            (snapshot) => {
                try {
                    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    callback(logs);
                } catch (error: any) {
                    console.error("Firestore Subscription Error (processing):", error.message);
                    callback([]);
                }
            },
            (error: any) => {
                // Handle Firestore internal assertion errors
                const isInternalError = error.message?.includes('INTERNAL ASSERTION FAILED') ||
                                        error.message?.includes('Unexpected state') ||
                                        error.code === 'ca9' ||
                                        error.code === 'c050' ||
                                        error.code === 'b815' ||
                                        (error.message && error.message.includes('ID: ca9')) ||
                                        (error.message && error.message.includes('ID: c050')) ||
                                        (error.message && error.message.includes('ID: b815'));
                
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard/dataService.ts:391',message:'subscribeToActivity error callback',data:{isInternalError,errorMessage:error?.message?.substring(0,200),errorCode:error?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'})}).catch(()=>{});
                // #endregion
                
                if (isInternalError) {
                    console.warn("Firestore Internal Assertion Error in activity log listener. This is usually temporary and will recover.");
                    // Don't throw - let the listener continue
                    return;
                }
                
                console.error("Firestore Subscription Error:", error.message);
            }
        );
    },

    // Dashboard API Methods
    /**
     * Get global sales for a date range (ONLY delivered orders)
     */
    async getGlobalSales(dateRange: DateRange): Promise<number> {
        try {
            // Use financial service for single source of truth
            const { getGlobalSales } = await import('./services/financialService');
            return await getGlobalSales(dateRange);
        } catch (error: any) {
            console.error("Firestore Error [getGlobalSales]:", error.message);
            return 0;
        }
    },

    /**
     * Get active regions (regions with at least one delivered order)
     */
    async getActiveRegions(): Promise<string[]> {
        try {
            console.log('getActiveRegions: Fetching active regions...');
            // Try with delivered orders first
            try {
                const q = query(
                    collections.orders,
                    where("status", "==", "delivered")
                );
                
                const snapshot = await getDocs(q);
                const regionIds = new Set<string>();
                
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.regionId) {
                        regionIds.add(data.regionId);
                    }
                });
                
                console.log(`getActiveRegions: Found ${regionIds.size} active regions from delivered orders`);
                return Array.from(regionIds);
            } catch (queryError: any) {
                console.warn('getActiveRegions: Query failed, trying fallback:', queryError.message);
                // Fallback: Get delivered orders from last 90 days only (not all orders)
                const ninetyDaysAgo = new Date();
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                const startTimestamp = Timestamp.fromDate(ninetyDaysAgo);
                
                const fallbackQuery = query(
                    collections.orders,
                    where('status', '==', 'delivered'),
                    where('createdAt', '>=', startTimestamp)
                );
                const allOrdersSnap = await getDocs(fallbackQuery);
                const regionIds = new Set<string>();
                
                allOrdersSnap.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.regionId) {
                        regionIds.add(data.regionId);
                    }
                });
                
                console.log(`getActiveRegions: Fallback found ${regionIds.size} active regions`);
                return Array.from(regionIds);
            }
        } catch (error: any) {
            console.error("Firestore Error [getActiveRegions]:", error.message);
            return [];
        }
    },

    /**
     * Get count of unauthorized discounts for a date range
     */
    async getUnauthorizedDiscountsCount(dateRange: DateRange): Promise<number> {
        try {
            console.log('getUnauthorizedDiscountsCount: Fetching for date range:', dateRange);
            const startTimestamp = Timestamp.fromDate(dateRange.start);
            const endTimestamp = Timestamp.fromDate(dateRange.end);
            
            // Try query with date range first
            try {
                const q = query(
                    collections.orders,
                    where("unauthorizedDiscount", ">", 0),
                    where("createdAt", ">=", startTimestamp),
                    where("createdAt", "<=", endTimestamp)
                );
                
                const snapshot = await getDocs(q);
                console.log(`getUnauthorizedDiscountsCount: Found ${snapshot.size} unauthorized discounts`);
                return snapshot.size;
            } catch (queryError: any) {
                console.warn('getUnauthorizedDiscountsCount: Query failed, trying fallback:', queryError.message);
                // Fallback: Get orders with unauthorized discounts within date range
                const startTimestamp = Timestamp.fromDate(dateRange.start);
                const endTimestamp = Timestamp.fromDate(dateRange.end);
                
                const allOrdersQuery = query(
                    collections.orders,
                    where("unauthorizedDiscount", ">", 0),
                    where("createdAt", ">=", startTimestamp),
                    where("createdAt", "<=", endTimestamp)
                );
                const allSnapshot = await getDocs(allOrdersQuery);
                
                console.log(`getUnauthorizedDiscountsCount: Fallback found ${allSnapshot.size} unauthorized discounts`);
                return allSnapshot.size;
            }
        } catch (error: any) {
            console.error("Firestore Error [getUnauthorizedDiscountsCount]:", error.message);
            return 0;
        }
    },

    /**
     * Get total amount of unauthorized discounts across all bookers
     * Groups bookers by name to handle duplicates and filters test shops
     * @param dateRange - Optional date range. If provided, filters by monthlyUnauthorizedDiscounts for that month.
     *                    If not provided, returns all-time totalUnauthorizedDiscount.
     * @returns Total amount in PKR
     */
    async getTotalUnauthorizedDiscountsAmount(dateRange?: DateRange): Promise<number> {
        try {
            console.log('getTotalUnauthorizedDiscountsAmount: Fetching total unauthorized discount amount', { dateRange });
            
            // Import test shop filter
            const { isTestShop } = await import('./utils/shopFilters');
            
            // Get all bookers
            const allUsers = await this.getAllUsers();
            const bookerUsers = allUsers.filter(u => u.role?.toLowerCase() === 'booker');
            
            console.log(`getTotalUnauthorizedDiscountsAmount: Found ${bookerUsers.length} bookers`);
            
            // Get all orders to check for test shops
            let allOrders: any[] = [];
            try {
                const ordersSnapshot = await getDocs(collections.orders);
                allOrders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (ordersError: any) {
                console.warn('getTotalUnauthorizedDiscountsAmount: Could not fetch orders for test shop filtering:', ordersError.message);
            }
            
            // Determine which month to filter by (if dateRange provided)
            let targetMonth: string | null = null;
            if (dateRange) {
                // Use the start date to determine the month (format: "YYYY-MM")
                const month = dateRange.start.getMonth() + 1;
                const year = dateRange.start.getFullYear();
                targetMonth = `${year}-${String(month).padStart(2, '0')}`;
                console.log(`getTotalUnauthorizedDiscountsAmount: Filtering by month: ${targetMonth}`);
            }
            
            // Group bookers by name and sum their totals
            const bookerMap = new Map<string, { total: number; bookerIds: string[] }>();
            
            for (const booker of bookerUsers) {
                try {
                    // Get booker's discount data from user document
                    const userRef = doc(db, 'users', booker.id);
                    const userDoc = await getDoc(userRef);
                    
                    if (!userDoc.exists()) {
                        continue;
                    }
                    
                    const userData = userDoc.data();
                    
                    // Get discount amount based on dateRange
                    let discountAmount = 0;
                    if (targetMonth && userData.monthlyUnauthorizedDiscounts) {
                        // Filter by specific month
                        discountAmount = userData.monthlyUnauthorizedDiscounts[targetMonth] || 0;
                    } else {
                        // All-time total
                        discountAmount = userData.totalUnauthorizedDiscount || 0;
                    }
                    
                    if (discountAmount <= 0) {
                        continue; // Skip bookers with no unauthorized discounts for this period
                    }
                    
                    // Check if this booker has any orders from test shops
                    // If all their orders are from test shops, exclude them
                    const bookerOrders = allOrders.filter(o => o.bookerId === booker.id);
                    const hasNonTestShopOrders = bookerOrders.length === 0 || 
                        bookerOrders.some((o: any) => !isTestShop(o.shopName));
                    
                    if (!hasNonTestShopOrders && bookerOrders.length > 0) {
                        console.log(`getTotalUnauthorizedDiscountsAmount: Excluding booker ${booker.name} (only test shop orders)`);
                        continue; // Skip bookers with only test shop orders
                    }
                    
                    // Group by name to handle duplicates
                    const bookerName = booker.name || 'Unknown';
                    const existing = bookerMap.get(bookerName);
                    
                    if (existing) {
                        // Aggregate totals for duplicate names
                        existing.total += discountAmount;
                        existing.bookerIds.push(booker.id);
                    } else {
                        bookerMap.set(bookerName, {
                            total: discountAmount,
                            bookerIds: [booker.id]
                        });
                    }
                } catch (bookerError: any) {
                    console.warn(`getTotalUnauthorizedDiscountsAmount: Error processing booker ${booker.id}:`, bookerError.message);
                    continue;
                }
            }
            
            // Sum all totals
            const totalAmount = Array.from(bookerMap.values()).reduce((sum, booker) => sum + booker.total, 0);
            
            const periodLabel = targetMonth ? `for month ${targetMonth}` : 'all-time';
            console.log(`getTotalUnauthorizedDiscountsAmount: Total amount ${periodLabel}: Rs. ${totalAmount.toFixed(2)} from ${bookerMap.size} unique booker names`);
            
            return totalAmount;
        } catch (error: any) {
            console.error("Firestore Error [getTotalUnauthorizedDiscountsAmount]:", error.message);
            return 0;
        }
    },

    /**
     * Get total KPOs count
     */
    async getTotalKPOs(): Promise<number> {
        try {
            console.log('getTotalKPOs: Fetching KPO count...');
            // Try with role filter first
            try {
                const q = query(
                    collections.users,
                    where("role", "==", "KPO")
                );
                
                const snapshot = await getDocs(q);
                console.log(`getTotalKPOs: Found ${snapshot.size} KPOs`);
                return snapshot.size;
            } catch (queryError: any) {
                console.warn('getTotalKPOs: Query failed, trying fallback:', queryError.message);
                // Fallback: Get all users and filter
                const allUsersSnap = await getDocs(collections.users);
                const kpos = allUsersSnap.docs.filter(doc => {
                    const data = doc.data();
                    return (data.role || '').toLowerCase() === 'kpo';
                });
                
                console.log(`getTotalKPOs: Fallback found ${kpos.length} KPOs`);
                return kpos.length;
            }
        } catch (error: any) {
            console.error("Firestore Error [getTotalKPOs]:", error.message);
            return 0;
        }
    },

    /**
     * Get branch-wise sales performance grouped by branch (ONLY delivered orders)
     * Branch info comes from the booker's user data, not directly from orders
     */
    async getBranchSalesPerformance(dateRange: DateRange, regionId?: string): Promise<Array<{ branchId: string; branchName: string; sales: number }>> {
        try {
            console.log('getBranchSalesPerformance: Fetching for date range:', dateRange, regionId ? `region: ${regionId}` : 'all regions');
            const startTimestamp = Timestamp.fromDate(dateRange.start);
            const endTimestamp = Timestamp.fromDate(dateRange.end);
            
            // Get all branches (filter by region if provided)
            let branches: any[] = [];
            if (regionId) {
                branches = await this.getBranches(regionId);
            } else {
                // Get all branches from all regions
                const allRegions = await this.getRegions();
                const allBranchesPromises = allRegions.map((r: any) => this.getBranches(r.id));
                const allBranchesArrays = await Promise.all(allBranchesPromises);
                branches = allBranchesArrays.flat();
            }
            
            // Create branch name to ID mapping (case-insensitive, trimmed)
            const branchMap: Record<string, { id: string; name: string }> = {};
            const branchNameLowerMap: Record<string, string> = {}; // lowercase name -> original name
            branches.forEach(branch => {
                const branchName = (branch.name || '').trim();
                const branchNameLower = branchName.toLowerCase();
                branchMap[branchName] = { id: branch.id, name: branchName };
                branchNameLowerMap[branchNameLower] = branchName;
            });
            
            // Get all users to map bookerId to branch
            const allUsers = await this.getAllUsers();
            const bookerBranchMap: Record<string, string> = {}; // bookerId -> branchName (normalized)
            allUsers.forEach((user: any) => {
                const userRole = (user.role || '').toString().toLowerCase();
                const userBranch = (user.branch || '').trim();
                
                if (userBranch && (userRole === 'booker' || userRole === 'Booker')) {
                    // Normalize branch name - try to find matching branch (case-insensitive)
                    const branchNameLower = userBranch.toLowerCase();
                    const normalizedBranchName = branchNameLowerMap[branchNameLower] || userBranch;
                    
                    bookerBranchMap[user.id] = normalizedBranchName;
                    console.log(`getBranchSalesPerformance: Mapped booker ${user.id} (${user.name || 'Unknown'}) to branch: "${userBranch}" -> normalized: "${normalizedBranchName}"`);
                }
            });
            
            console.log(`getBranchSalesPerformance: Found ${branches.length} branches and ${Object.keys(bookerBranchMap).length} bookers with branches`);
            console.log('getBranchSalesPerformance: Branch names:', branches.map(b => b.name));
            console.log('getBranchSalesPerformance: Booker branch map:', bookerBranchMap);
            
            // Try query with date range first
            try {
                let q;
                if (regionId) {
                    q = query(
                        collections.orders,
                        where("status", "==", "delivered"),
                        where("regionId", "==", regionId),
                        where("createdAt", ">=", startTimestamp),
                        where("createdAt", "<=", endTimestamp)
                    );
                } else {
                    q = query(
                        collections.orders,
                        where("status", "==", "delivered"),
                        where("createdAt", ">=", startTimestamp),
                        where("createdAt", "<=", endTimestamp)
                    );
                }
                
                const snapshot = await getDocs(q);
                console.log(`getBranchSalesPerformance: Found ${snapshot.docs.length} delivered orders`);
                
                const branchSales: Record<string, number> = {};
                let ordersWithoutBranch = 0;
                let ordersWithoutBooker = 0;
                
                snapshot.docs.forEach((doc, index) => {
                    const data = doc.data();
                    const bookerId = data.bookerId;
                    const sales = data.grandTotal || data.totalAmount || 0;
                    const orderRegionId = data.regionId;
                    
                    // Try multiple methods to get branch
                    let branchName: string | null = null;
                    let branchId: string | null = null;
                    
                    // METHOD 1: Try to get branch from order's branchId or branch field directly
                    const orderBranchId = data.branchId;
                    const orderBranch = data.branch;
                    
                    if (orderBranchId) {
                        // Direct branchId match
                        const branch = branches.find(b => b.id === orderBranchId);
                        if (branch) {
                            branchName = branch.name.trim();
                            branchId = branch.id;
                        }
                    } else if (orderBranch) {
                        // Try to match branch name from order
                        const orderBranchTrimmed = orderBranch.trim();
                        const orderBranchLower = orderBranchTrimmed.toLowerCase();
                        const normalizedBranchName = branchNameLowerMap[orderBranchLower] || orderBranchTrimmed;
                        const branchInfo = branchMap[normalizedBranchName];
                        if (branchInfo) {
                            branchName = normalizedBranchName;
                            branchId = branchInfo.id;
                        }
                    }
                    
                    // METHOD 2: Fallback to booker mapping if order doesn't have branch info
                    if (!branchName && bookerId) {
                        branchName = bookerBranchMap[bookerId] || null;
                        if (branchName) {
                            const branchInfo = branchMap[branchName];
                            if (branchInfo) {
                                branchId = branchInfo.id;
                            } else {
                                // Try case-insensitive lookup
                                const branchNameLower = branchName.toLowerCase();
                                const normalizedName = branchNameLowerMap[branchNameLower];
                                if (normalizedName && branchMap[normalizedName]) {
                                    branchName = normalizedName;
                                    branchId = branchMap[normalizedName].id;
                                }
                            }
                        }
                    }
                    
                    if (index < 5) { // Log first 5 orders for debugging
                        console.log(`getBranchSalesPerformance: Order ${index + 1} - bookerId: ${bookerId}, orderBranchId: ${orderBranchId}, orderBranch: ${orderBranch}, mappedBranch: ${branchName || 'NONE'}`);
                    }
                    
                    if (!branchId) {
                        if (!bookerId) {
                            ordersWithoutBooker++;
                        } else {
                            ordersWithoutBranch++;
                        }
                        if (index < 5) {
                            console.log(`getBranchSalesPerformance: Order ${index + 1} - Could not map to branch. bookerId: ${bookerId}, orderBranchId: ${orderBranchId}, orderBranch: ${orderBranch}`);
                        }
                        return;
                    }
                    
                    branchSales[branchId] = (branchSales[branchId] || 0) + sales;
                    
                    if (index < 5) {
                        console.log(`getBranchSalesPerformance: Order ${index + 1} mapped to branch: ${branchName} (${branchId}), sales: ${sales}`);
                    }
                });
                
                console.log(`getBranchSalesPerformance: Found sales for ${Object.keys(branchSales).length} branches`);
                console.log(`getBranchSalesPerformance: Orders without bookerId: ${ordersWithoutBooker}, Orders without branch mapping: ${ordersWithoutBranch}`);
                return Object.entries(branchSales).map(([branchId, sales]) => {
                    const branch = branches.find(b => b.id === branchId);
                    return {
                        branchId,
                        branchName: branch?.name || branchId,
                        sales
                    };
                }).sort((a, b) => b.sales - a.sales);
            } catch (queryError: any) {
                console.warn('getBranchSalesPerformance: Date range query failed, trying fallback:', queryError.message);
                // Fallback: Get all delivered orders and filter in memory
                let allOrdersQuery;
                if (regionId) {
                    allOrdersQuery = query(
                        collections.orders,
                        where("status", "==", "delivered"),
                        where("regionId", "==", regionId)
                    );
                } else {
                    allOrdersQuery = query(
                        collections.orders,
                        where("status", "==", "delivered")
                    );
                }
                const allSnapshot = await getDocs(allOrdersQuery);
                console.log(`getBranchSalesPerformance (fallback): Found ${allSnapshot.docs.length} delivered orders`);
                
                const branchSales: Record<string, number> = {};
                const startTime = dateRange.start.getTime();
                const endTime = dateRange.end.getTime();
                let ordersInRange = 0;
                let ordersWithoutBranch = 0;
                let ordersWithoutBooker = 0;
                
                allSnapshot.docs.forEach((doc, index) => {
                    const data = doc.data();
                    const orderTime = data.createdAt?.toDate ? data.createdAt.toDate().getTime() : 
                                     data.createdAt?.seconds ? data.createdAt.seconds * 1000 :
                                     new Date(data.createdAt || data.date).getTime();
                    
                    if (orderTime >= startTime && orderTime <= endTime) {
                        ordersInRange++;
                        const bookerId = data.bookerId;
                        const sales = data.grandTotal || data.totalAmount || 0;
                        
                        // Try multiple methods to get branch (same as main query)
                        let branchName: string | null = null;
                        let branchId: string | null = null;
                        
                        // METHOD 1: Try to get branch from order's branchId or branch field directly
                        const orderBranchId = data.branchId;
                        const orderBranch = data.branch;
                        
                        if (orderBranchId) {
                            const branch = branches.find(b => b.id === orderBranchId);
                            if (branch) {
                                branchName = branch.name.trim();
                                branchId = branch.id;
                            }
                        } else if (orderBranch) {
                            const orderBranchTrimmed = orderBranch.trim();
                            const orderBranchLower = orderBranchTrimmed.toLowerCase();
                            const normalizedBranchName = branchNameLowerMap[orderBranchLower] || orderBranchTrimmed;
                            const branchInfo = branchMap[normalizedBranchName];
                            if (branchInfo) {
                                branchName = normalizedBranchName;
                                branchId = branchInfo.id;
                            }
                        }
                        
                        // METHOD 2: Fallback to booker mapping
                        if (!branchName && bookerId) {
                            branchName = bookerBranchMap[bookerId] || null;
                            if (branchName) {
                                const branchInfo = branchMap[branchName];
                                if (branchInfo) {
                                    branchId = branchInfo.id;
                                } else {
                                    const branchNameLower = branchName.toLowerCase();
                                    const normalizedName = branchNameLowerMap[branchNameLower];
                                    if (normalizedName && branchMap[normalizedName]) {
                                        branchName = normalizedName;
                                        branchId = branchMap[normalizedName].id;
                                    }
                                }
                            }
                        }
                        
                        if (!branchId) {
                            if (!bookerId) {
                                ordersWithoutBooker++;
                            } else {
                                ordersWithoutBranch++;
                            }
                            return;
                        }
                        
                        branchSales[branchId] = (branchSales[branchId] || 0) + sales;
                    }
                });
                
                console.log(`getBranchSalesPerformance (fallback): Orders in date range: ${ordersInRange}`);
                console.log(`getBranchSalesPerformance (fallback): Orders without bookerId: ${ordersWithoutBooker}, Orders without branch mapping: ${ordersWithoutBranch}`);
                
                console.log(`getBranchSalesPerformance: Fallback found sales for ${Object.keys(branchSales).length} branches`);
                return Object.entries(branchSales).map(([branchId, sales]) => {
                    const branch = branches.find(b => b.id === branchId);
                    return {
                        branchId,
                        branchName: branch?.name || branchId,
                        sales
                    };
                }).sort((a, b) => b.sales - a.sales);
            }
        } catch (error: any) {
            console.error("Firestore Error [getBranchSalesPerformance]:", error.message);
            return [];
        }
    },

    /**
     * Get regional sales performance grouped by region (ONLY delivered orders)
     */
    async getRegionalSalesPerformance(dateRange: DateRange): Promise<Array<{ regionId: string; sales: number; branches?: Array<{ branchId: string; branchName: string; sales: number }> }>> {
        try {
            console.log('getRegionalSalesPerformance: Fetching regional sales for date range:', dateRange);
            
            // METHOD 1: Branch-based aggregation (ensures all branch sales are included)
            // Get all regions and their branches, then aggregate sales by branch, then sum by region
            let regionSalesFromBranches: Record<string, { sales: number; branches: Array<{ branchId: string; branchName: string; sales: number }> }> = {};
            
            try {
                const allRegions = await this.getRegions();
                console.log(`getRegionalSalesPerformance: Found ${allRegions.length} regions`);
                
                // Get branch sales performance for all regions
                const branchSalesData = await this.getBranchSalesPerformance(dateRange);
                console.log(`getRegionalSalesPerformance: Found sales for ${branchSalesData.length} branches`);
                
                // Group branches by region and sum their sales
                for (const region of allRegions) {
                    const regionBranches = await this.getBranches(region.id);
                    const regionBranchIds = new Set(regionBranches.map(b => b.id));
                    
                    // Find all branch sales for this region
                    const branchesInRegion = branchSalesData.filter(bs => regionBranchIds.has(bs.branchId));
                    const regionTotal = branchesInRegion.reduce((sum, b) => sum + b.sales, 0);
                    
                    if (regionTotal > 0 || branchesInRegion.length > 0) {
                        regionSalesFromBranches[region.id] = {
                            sales: regionTotal,
                            branches: branchesInRegion
                        };
                    }
                }
                
                console.log(`getRegionalSalesPerformance: Branch-based aggregation found sales for ${Object.keys(regionSalesFromBranches).length} regions`);
            } catch (branchError: any) {
                console.warn('getRegionalSalesPerformance: Branch-based aggregation failed:', branchError.message);
                // Continue with direct regionId aggregation
            }
            
            // METHOD 2: Direct regionId aggregation (from ledger/orders with explicit regionId)
            // Query ledger_transactions for SALE_DELIVERED and SALE entries
            const saleDeliveredQuery = query(
                collection(db, 'ledger_transactions'),
                where('type', '==', 'SALE_DELIVERED')
            );
            const saleDeliveredSnapshot = await getDocs(saleDeliveredQuery);
            let entries = saleDeliveredSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Also query for legacy SALE type
            const saleQuery = query(
                collection(db, 'ledger_transactions'),
                where('type', '==', 'SALE')
            );
            const saleSnapshot = await getDocs(saleQuery);
            const saleEntries = saleSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            entries = [...entries, ...saleEntries];
            
            // Filter by date range
            const startTime = dateRange.start.getTime();
            const endTime = dateRange.end.getTime();
            entries = entries.filter(entry => {
                const entryDate = entry.created_at?.toDate ? entry.created_at.toDate().getTime() :
                                  entry.created_at?.seconds ? entry.created_at.seconds * 1000 :
                                  entry.date?.toDate ? entry.date.toDate().getTime() :
                                  entry.date?.seconds ? entry.date.seconds * 1000 :
                                  entry.createdAt?.toDate ? entry.createdAt.toDate().getTime() :
                                  entry.createdAt?.seconds ? entry.createdAt.seconds * 1000 :
                                  new Date(entry.created_at || entry.date || entry.createdAt || 0).getTime();
                return entryDate >= startTime && entryDate <= endTime;
            });
            
            // Filter test shops from ledger entries
            const { isTestShop } = await import('./utils/shopFilters');
            const entriesBeforeFilter = entries.length;
            entries = entries.filter(entry => {
                const shopName = entry.shop_name || entry.shopName || entry.shop?.shopName;
                return !isTestShop(shopName);
            });
            if (entriesBeforeFilter > entries.length) {
                console.log(`getRegionalSalesPerformance: Filtered ${entriesBeforeFilter - entries.length} test shop entries`);
            }
            
            // Group by region_id and sum net_cash
            const regionSales: Record<string, number> = {};
            entries.forEach(entry => {
                const regionId = entry.region_id || entry.regionId || '';
                if (regionId) {
                    const netCash = entry.net_cash !== undefined ? entry.net_cash : (entry.amount || 0);
                    const sales = typeof netCash === 'number' ? netCash : parseFloat(netCash) || 0;
                    regionSales[regionId] = (regionSales[regionId] || 0) + sales;
                }
            });
            
            console.log(`getRegionalSalesPerformance: Direct regionId aggregation found sales for ${Object.keys(regionSales).length} regions from ${entries.length} ledger entries`);
            
            // ALWAYS check orders as fallback (for migration/compatibility)
            let fallbackRegionSales: Record<string, number> = {};
            try {
                const q = query(
                    collections.orders,
                    where("status", "==", "delivered")
                );
                const snapshot = await getDocs(q);
                const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                const startTime = dateRange.start.getTime();
                const endTime = dateRange.end.getTime();
                let ordersInRange = orders.filter(order => {
                    const orderTime = order.deliveredAt?.toDate ? order.deliveredAt.toDate().getTime() :
                                     order.deliveredAt?.seconds ? order.deliveredAt.seconds * 1000 :
                                     order.createdAt?.toDate ? order.createdAt.toDate().getTime() :
                                     order.createdAt?.seconds ? order.createdAt.seconds * 1000 :
                                     new Date(order.deliveredAt || order.createdAt || order.date || 0).getTime();
                    return orderTime >= startTime && orderTime <= endTime;
                });
                
                // Filter test shops from orders
                const ordersBeforeFilter = ordersInRange.length;
                ordersInRange = ordersInRange.filter(order => {
                    const shopName = order.shopName || order.shop?.shopName;
                    return !isTestShop(shopName);
                });
                if (ordersBeforeFilter > ordersInRange.length) {
                    console.log(`getRegionalSalesPerformance: Filtered ${ordersBeforeFilter - ordersInRange.length} test shop orders`);
                }
                
                ordersInRange.forEach(order => {
                    const regionId = order.regionId;
                    const sales = order.grandTotal || order.totalAmount || 0;
                    if (regionId) {
                        fallbackRegionSales[regionId] = (fallbackRegionSales[regionId] || 0) + sales;
                    }
                });
                
                console.log(`getRegionalSalesPerformance: Orders fallback - found sales for ${Object.keys(fallbackRegionSales).length} regions from ${ordersInRange.length} orders`);
            } catch (fallbackError: any) {
                console.error('getRegionalSalesPerformance Orders Fallback Error:', fallbackError);
                // Continue with other methods
            }
            
            // MERGE: Combine all three methods (branch-based, ledger direct, orders fallback)
            // Use branch-based aggregation as primary (most accurate), fallback to ledger/orders if branch data is missing
            const finalRegionSales: Record<string, { sales: number; branches?: Array<{ branchId: string; branchName: string; sales: number }> }> = {};
            
            // Get all unique region IDs from all methods
            const allRegionIds = new Set([
                ...Object.keys(regionSalesFromBranches),
                ...Object.keys(regionSales),
                ...Object.keys(fallbackRegionSales)
            ]);
            
            for (const regionId of allRegionIds) {
                const branchSales = regionSalesFromBranches[regionId]?.sales || 0;
                const ledgerSales = regionSales[regionId] || 0;
                const ordersSales = fallbackRegionSales[regionId] || 0;
                
                // Prefer branch-based aggregation as it's most accurate
                // Only use ledger/orders as fallback if branch data is missing or significantly lower
                // (which might indicate incomplete branch data)
                let finalSales = branchSales;
                let finalBranches = regionSalesFromBranches[regionId]?.branches;
                
                // If branch sales is 0 or very low compared to ledger/orders, use the higher value
                // This handles cases where branch mapping might have failed
                if (branchSales === 0 || (branchSales < ledgerSales * 0.5 && ledgerSales > 0)) {
                    // Use ledger if available, otherwise orders
                    finalSales = ledgerSales > 0 ? ledgerSales : ordersSales;
                    finalBranches = undefined; // No branch breakdown available from fallback
                } else if (branchSales > 0) {
                    // Branch data is primary - use it
                    finalSales = branchSales;
                    finalBranches = regionSalesFromBranches[regionId]?.branches;
                } else {
                    // No branch data, use ledger or orders
                    finalSales = ledgerSales > 0 ? ledgerSales : ordersSales;
                }
                
                finalRegionSales[regionId] = {
                    sales: finalSales,
                    ...(finalBranches && { branches: finalBranches })
                };
            }
            
            const totalFromBranches = Object.values(regionSalesFromBranches).reduce((sum, r) => sum + r.sales, 0);
            const totalFromLedger = Object.values(regionSales).reduce((sum, s) => sum + s, 0);
            const totalFromOrders = Object.values(fallbackRegionSales).reduce((sum, s) => sum + s, 0);
            const finalTotal = Object.values(finalRegionSales).reduce((sum, r) => sum + r.sales, 0);
            
            console.log(`getRegionalSalesPerformance: Final totals - Branch-based: ${totalFromBranches}, Ledger: ${totalFromLedger}, Orders: ${totalFromOrders}, Final: ${finalTotal}`);
            
            return Object.entries(finalRegionSales).map(([regionId, data]) => ({
                regionId,
                sales: data.sales,
                ...(data.branches && { branches: data.branches })
            }));
        } catch (error: any) {
            console.error("Firestore Error [getRegionalSalesPerformance]:", error.message);
            return [];
        }
    },

    /**
     * Get top bookers by sales amount (ONLY delivered orders)
     */
    async getTopBookers(limitCount: number, dateRange: DateRange): Promise<Array<{ bookerId: string; bookerName: string; orders: number; totalSales: number }>> {
        try {
            const startTimestamp = Timestamp.fromDate(dateRange.start);
            const endTimestamp = Timestamp.fromDate(dateRange.end);
            
            // Only count DELIVERED orders for actual sales
            const q = query(
                collections.orders,
                where("status", "==", "delivered"),
                where("createdAt", ">=", startTimestamp),
                where("createdAt", "<=", endTimestamp)
            );
            
            const snapshot = await getDocs(q);
            const bookerStats: Record<string, { name: string; orders: number; totalSales: number }> = {};
            
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const bookerId = data.bookerId;
                const bookerName = data.bookerName || "Unknown";
                const sales = data.grandTotal || 0;
                
                if (bookerId) {
                    if (!bookerStats[bookerId]) {
                        bookerStats[bookerId] = { name: bookerName, orders: 0, totalSales: 0 };
                    }
                    bookerStats[bookerId].orders += 1;
                    bookerStats[bookerId].totalSales += sales;
                }
            });
            
            return Object.entries(bookerStats)
                .map(([bookerId, stats]) => ({
                    bookerId,
                    bookerName: stats.name,
                    orders: stats.orders,
                    totalSales: stats.totalSales
                }))
                .sort((a, b) => b.totalSales - a.totalSales)
                .slice(0, limitCount);
        } catch (error: any) {
            console.error("Firestore Error [getTopBookers]:", error.message);
            return [];
        }
    },

    /**
     * Get regional top sellers (SKUs) for a specific region (ONLY delivered orders)
     */
    async getRegionalTopSellers(regionId: string, limitCount: number, dateRange: DateRange): Promise<Array<{ productId: string; productName: string; unitsSold: number }>> {
        try {
            console.log(`getRegionalTopSellers: Fetching for region ${regionId}, date range:`, dateRange);
            const startTimestamp = Timestamp.fromDate(dateRange.start);
            const endTimestamp = Timestamp.fromDate(dateRange.end);
            
            // Try query with date range first
            try {
                const q = query(
                    collections.orders,
                    where("regionId", "==", regionId),
                    where("status", "==", "delivered"),
                    where("createdAt", ">=", startTimestamp),
                    where("createdAt", "<=", endTimestamp)
                );
                
                const snapshot = await getDocs(q);
                const productStats: Record<string, { name: string; units: number }> = {};
                
                // Import test shop filter
                const { isTestShop } = await import('./utils/shopFilters');
                
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    
                    // Filter test shops
                    const shopName = data.shopName || data.shop?.shopName;
                    if (isTestShop(shopName)) {
                        return; // Skip test shop orders
                    }
                    
                    const items = data.items || [];
                    
                    items.forEach((item: any) => {
                        const productId = item.productId;
                        const productName = item.productName || item.name || "Unknown";
                        const quantity = item.quantity || item.qty || 0;
                        
                        if (productId) {
                            if (!productStats[productId]) {
                                productStats[productId] = { name: productName, units: 0 };
                            }
                            productStats[productId].units += quantity;
                        }
                    });
                });
                
                const result = Object.entries(productStats)
                    .map(([productId, stats]) => ({
                        productId,
                        productName: stats.name,
                        unitsSold: stats.units
                    }))
                    .sort((a, b) => b.unitsSold - a.unitsSold)
                    .slice(0, limitCount);
                
                console.log(`getRegionalTopSellers: Found ${result.length} top products for region ${regionId}`);
                return result;
            } catch (queryError: any) {
                console.warn(`getRegionalTopSellers: Query failed for region ${regionId}, trying fallback:`, queryError.message);
                // Fallback: Get all delivered orders for region and filter in memory
                const allOrdersQuery = query(
                    collections.orders,
                    where("regionId", "==", regionId),
                    where("status", "==", "delivered")
                );
                const allSnapshot = await getDocs(allOrdersQuery);
                
                const productStats: Record<string, { name: string; units: number }> = {};
                const startTime = dateRange.start.getTime();
                const endTime = dateRange.end.getTime();
                
                // Import test shop filter
                const { isTestShop } = await import('./utils/shopFilters');
                
                allSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    
                    // Filter test shops
                    const shopName = data.shopName || data.shop?.shopName;
                    if (isTestShop(shopName)) {
                        return; // Skip test shop orders
                    }
                    
                    const orderTime = data.createdAt?.toDate ? data.createdAt.toDate().getTime() : 
                                     data.createdAt?.seconds ? data.createdAt.seconds * 1000 :
                                     new Date(data.createdAt || data.date).getTime();
                    
                    if (orderTime >= startTime && orderTime <= endTime) {
                        const items = data.items || [];
                        
                        items.forEach((item: any) => {
                            const productId = item.productId;
                            const productName = item.productName || item.name || "Unknown";
                            const quantity = item.quantity || item.qty || 0;
                            
                            if (productId) {
                                if (!productStats[productId]) {
                                    productStats[productId] = { name: productName, units: 0 };
                                }
                                productStats[productId].units += quantity;
                            }
                        });
                    }
                });
                
                const result = Object.entries(productStats)
                    .map(([productId, stats]) => ({
                        productId,
                        productName: stats.name,
                        unitsSold: stats.units
                    }))
                    .sort((a, b) => b.unitsSold - a.unitsSold)
                    .slice(0, limitCount);
                
                console.log(`getRegionalTopSellers: Fallback found ${result.length} top products for region ${regionId}`);
                return result;
            }
        } catch (error: any) {
            console.error("Firestore Error [getRegionalTopSellers]:", error.message);
            return [];
        }
    },

    /**
     * Get recent transactions from ledger_transactions
     */
    async getRecentTransactions(limitCount: number, paymentType?: 'cash' | 'credit'): Promise<any[]> {
        try {
            let q;
            
            if (paymentType) {
                // Map paymentType to paymentMode
                const paymentMode = paymentType === 'cash' ? 'cash' : 'credit';
                q = query(
                    collection(db, 'ledger_transactions'),
                    where("type", "==", "SALE"),
                    where("paymentMode", "==", paymentMode),
                    orderBy("date", "desc"),
                    limit(limitCount)
                );
            } else {
                q = query(
                    collection(db, 'ledger_transactions'),
                    where("type", "==", "SALE"),
                    orderBy("date", "desc"),
                    limit(limitCount)
                );
            }
            
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error: any) {
            console.error("Firestore Error [getRecentTransactions]:", error.message);
            return [];
        }
    },

    /**
     * Get all users (for fetching booker avatars and salesman info)
     */
    async getAllUsers(): Promise<User[]> {
        try {
            console.log("Fetching users from Firestore...");
            const snapshot = await getDocs(collections.users);
            console.log(`Found ${snapshot.size} users`);
            const users = snapshot.docs.map(doc => {
                const data = doc.data();
                return { 
                    id: doc.id, 
                    ...data,
                    avatarUrl: data.avatarUrl || `https://i.pravatar.cc/150?u=${doc.id}`
                } as User;
            });
            console.log("Users fetched successfully:", users.length);
            return users;
        } catch (error: any) {
            console.error("Firestore Error [getAllUsers]:", error);
            console.error("Error details:", {
                code: error.code,
                message: error.message,
                stack: error.stack
            });
            // Return empty array instead of throwing to prevent dashboard crash
            return [];
        }
    },

    /**
     * Get all products (for product name lookup)
     */
    async getAllProducts(): Promise<Product[]> {
        try {
            console.log("Fetching products from Firestore...");
            const snapshot = await getDocs(collections.products);
            console.log(`Found ${snapshot.size} products`);
            const products = snapshot.docs.map(doc => {
                const data = doc.data();
                return { 
                    id: doc.id, 
                    ...data,
                    // Ensure required fields have defaults
                    status: data.status || 'In Stock',
                    stock: data.stock || 0,
                    price: data.price || '0',
                    minPrice: data.minPrice || data.price || '0'
                } as Product;
            });
            console.log("Products fetched successfully:", products.length);
            return products;
        } catch (error: any) {
            console.error("Firestore Error [getAllProducts]:", error);
            console.error("Error details:", {
                code: error.code,
                message: error.message,
                stack: error.stack
            });
            // Return empty array instead of throwing to prevent dashboard crash
            return [];
        }
    },

    /**
     * Get a single product by ID
     */
    async getProductById(productId: string): Promise<Product | null> {
        try {
            const productRef = doc(db, 'products', productId);
            const productSnap = await getDoc(productRef);
            
            if (productSnap.exists()) {
                const data = productSnap.data();
                return { 
                    id: productSnap.id, 
                    ...data,
                    status: data.status || 'In Stock',
                    stock: data.stock || 0,
                    price: data.price || '0',
                    minPrice: data.minPrice || data.price || '0'
                } as Product;
            }
            return null;
        } catch (error: any) {
            console.error("Firestore Error [getProductById]:", error.message);
            throw error;
        }
    },

    /**
     * Update a product
     */
    async updateProduct(productId: string, productData: Partial<Product>): Promise<void> {
        try {
            const productRef = doc(db, 'products', productId);
            await updateDoc(productRef, {
                ...productData,
                updatedAt: serverTimestamp()
            });
            await this.logActivity('system', `Updated product: ${productData.name || productId}`);
        } catch (error: any) {
            console.error("Firestore Error [updateProduct]:", error.message);
            throw error;
        }
    },

    /**
     * Add a new product
     */
    async addProduct(productData: Omit<Product, 'id'>): Promise<string> {
        try {
            const docRef = await addDoc(collections.products, {
                ...productData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            await this.logActivity('system', `Added product: ${productData.name}`);
            return docRef.id;
        } catch (error: any) {
            console.error("Firestore Error [addProduct]:", error.message);
            throw error;
        }
    },

    /**
     * Delete a product
     */
    async deleteProduct(productId: string): Promise<void> {
        try {
            const productRef = doc(db, 'products', productId);
            await deleteDoc(productRef);
            await this.logActivity('system', `Deleted product: ${productId}`);
        } catch (error: any) {
            console.error("Firestore Error [deleteProduct]:", error.message);
            throw error;
        }
    },

    /**
     * Get unauthorized discounts with full order details
     */
    async getUnauthorizedDiscounts(): Promise<any[]> {
        try {
            const q = query(
                collections.orders,
                where("unauthorizedDiscount", ">", 0),
                orderBy("unauthorizedDiscount", "desc")
            );
            
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error: any) {
            console.error("Firestore Error [getUnauthorizedDiscounts]:", error.message);
            return [];
        }
    },

    /**
     * Get all ledger transactions
     */
    /**
     * Get all ledger transactions across all regions (aggregated from multiple sources)
     * Includes: Orders (Credit), Payments (Debit), Returns (Debit)
     */
    async getAllLedgerTransactions(): Promise<any[]> {
        try {
            // Use financial service for single source of truth
            // This ensures ONLY delivery and payment entries are included (no bookings)
            const { getFinancialLedgerEntries } = await import('./services/financialService');
            return await getFinancialLedgerEntries();
        } catch (error: any) {
            console.error("Firestore Error [getAllLedgerTransactions]:", error.message);
            return [];
        }
    },

    /**
     * Get activity logs (audit logs)
     */
    async getActivityLogs(limitCount: number = 50): Promise<any[]> {
        try {
            const q = query(
                collections.activityLogs,
                orderBy("timestamp", "desc"),
                limit(limitCount)
            );
            
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error: any) {
            console.error("Firestore Error [getActivityLogs]:", error.message);
            return [];
        }
    },

    /**
     * Get KPO performance data with real statistics
     */
    async getKPOPerformance(): Promise<any[]> {
        try {
            console.log('getKPOPerformance: Fetching KPO performance data...');
            
            // Get all KPO users
            let kpoUsers: any[] = [];
            try {
            const kpoQuery = query(
                collections.users,
                where("role", "==", "KPO")
            );
            const kpoSnapshot = await getDocs(kpoQuery);
                kpoUsers = kpoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log(`getKPOPerformance: Found ${kpoUsers.length} KPOs`);
            } catch (queryError: any) {
                console.warn('getKPOPerformance: KPO query failed, trying fallback:', queryError.message);
                // Fallback: Get all users and filter
                const allUsersSnap = await getDocs(collections.users);
                kpoUsers = allUsersSnap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(user => (user.role || '').toLowerCase() === 'kpo');
                console.log(`getKPOPerformance: Fallback found ${kpoUsers.length} KPOs`);
            }
            
            // Get orders from last 90 days only (not all orders) to reduce reads
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            const startTimestamp = Timestamp.fromDate(ninetyDaysAgo);
            
            const recentOrdersQuery = query(
                collections.orders,
                where('createdAt', '>=', startTimestamp)
            );
            const allOrdersSnap = await getDocs(recentOrdersQuery);
            const allOrders = allOrdersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`getKPOPerformance: Total orders in last 90 days: ${allOrders.length}`);
            
            // Get orders for each KPO's branch
            const kpoPerformance = await Promise.all(
                kpoUsers.map(async (kpo) => {
                    const kpoId = kpo.id;
                    const branchName = kpo.branch || '';
                    
                    console.log(`getKPOPerformance: Processing KPO ${kpo.name} (${kpoId}), branch: ${branchName}`);
                    
                    // Get all orders for this KPO's branch (via bookers in branch)
                    let branchOrders: any[] = [];
                    
                    if (branchName) {
                        // Get bookers in this branch
                        const bookers = await this.getBranchBookers(branchName);
                        const bookerIds = bookers.map(b => b.id);
                        
                        console.log(`getKPOPerformance: Found ${bookerIds.length} bookers in branch ${branchName}`);
                        
                        // Filter orders by bookerId
                        branchOrders = allOrders.filter(order => bookerIds.includes(order.bookerId));
                        
                        console.log(`getKPOPerformance: Found ${branchOrders.length} orders for branch ${branchName}`);
                    }
                    
                    // Also get orders finalized by this KPO
                    const finalizedOrders = allOrders.filter(order => order.finalizedBy === kpoId);
                    console.log(`getKPOPerformance: Found ${finalizedOrders.length} orders finalized by KPO ${kpoId}`);
                    
                    // Calculate today's orders (orders created today)
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const todayEnd = new Date(today);
                    todayEnd.setHours(23, 59, 59, 999);
                    
                    const todayOrders = branchOrders.filter(order => {
                        const orderTime = order.createdAt;
                        if (!orderTime) return false;
                        
                        const orderDate = orderTime?.toDate ? orderTime.toDate() : 
                                         orderTime?.seconds ? new Date(orderTime.seconds * 1000) :
                                         new Date(orderTime);
                        
                        return orderDate >= today && orderDate <= todayEnd;
                    });
                    
                    // Calculate average billing TAT (Turn Around Time)
                    // TAT = time between order creation and finalization
                    let avgBillingTime = 0;
                    let billingTimes: number[] = [];
                    
                    finalizedOrders.forEach(order => {
                        const createdTime = order.createdAt;
                        const finalizedTime = order.finalizedAt;
                        
                        if (createdTime && finalizedTime) {
                            const created = createdTime?.toDate ? createdTime.toDate() : 
                                          createdTime?.seconds ? new Date(createdTime.seconds * 1000) :
                                          new Date(createdTime);
                            const finalized = finalizedTime?.toDate ? finalizedTime.toDate() : 
                                           finalizedTime?.seconds ? new Date(finalizedTime.seconds * 1000) :
                                           new Date(finalizedTime);
                            
                            const diffMs = finalized.getTime() - created.getTime();
                            const diffMinutes = Math.round(diffMs / 60000); // Convert to minutes
                            
                            if (diffMinutes > 0 && diffMinutes < 10080) { // Less than 7 days (reasonable limit)
                                billingTimes.push(diffMinutes);
                            }
                        }
                    });
                    
                    if (billingTimes.length > 0) {
                        avgBillingTime = Math.round(billingTimes.reduce((sum, time) => sum + time, 0) / billingTimes.length);
                    }
                    
                    // Calculate accuracy rate based on orders without unauthorized discounts
                    const ordersWithUnauthorizedDiscount = branchOrders.filter(o => (o.unauthorizedDiscount || 0) > 0).length;
                    const accuracyRate = branchOrders.length > 0 
                        ? Math.round(((branchOrders.length - ordersWithUnauthorizedDiscount) / branchOrders.length) * 100 * 10) / 10
                        : 100;
                    
                    console.log(`getKPOPerformance: KPO ${kpo.name} - Daily Orders: ${todayOrders.length}, Total Orders: ${branchOrders.length}, Avg TAT: ${avgBillingTime}m, Accuracy: ${accuracyRate}%`);
                    
                    return {
                        kpoId,
                        kpoName: kpo.name || 'Unknown',
                        branch: branchName || 'N/A',
                        dailyOrders: todayOrders.length,
                        totalOrders: branchOrders.length,
                        accuracyRate: accuracyRate,
                        avgBillingTime: avgBillingTime
                    };
                })
            );
            
            console.log(`getKPOPerformance: Returning performance data for ${kpoPerformance.length} KPOs`);
            return kpoPerformance;
        } catch (error: any) {
            console.error("Firestore Error [getKPOPerformance]:", error.message);
            console.error("Error stack:", error.stack);
            return [];
        }
    },

    /**
     * Update user
     */
    async updateUser(userId: string, userData: Partial<User>): Promise<void> {
        try {
            const userRef = doc(db, 'users', userId);
            
            // Remove undefined values to avoid Firestore errors
            const updateData: any = {
                updatedAt: serverTimestamp()
            };

            // Only add fields that have values (not undefined)
            if (userData.name !== undefined) updateData.name = userData.name.trim();
            if (userData.email !== undefined) updateData.email = (userData.email || '').trim().toLowerCase();
            if (userData.role !== undefined) updateData.role = userData.role;
            if (userData.region !== undefined) updateData.region = userData.region || '';
            if (userData.branch !== undefined) updateData.branch = userData.branch || '';
            if (userData.area !== undefined) updateData.area = userData.area || '';
            if ((userData as any).phone !== undefined) updateData.phone = (userData as any).phone || '';
            if ((userData as any).status !== undefined) updateData.status = (userData as any).status;
            if (userData.maxDiscount !== undefined && userData.maxDiscount !== null) {
                updateData.maxDiscount = userData.maxDiscount;
            }
            if ((userData as any).regionId !== undefined) {
                updateData.regionId = (userData as any).regionId;
            }

            await updateDoc(userRef, updateData);
            await this.logActivity('system', `Updated user: ${userData.name || userId}`);
        } catch (error: any) {
            console.error("Firestore Error [updateUser]:", error.message);
            throw error;
        }
    },

    /**
     * Helper function to get users by branch and role with case-insensitive role matching
     * Tries optimized Firestore queries first, falls back to loading all users if needed
     * Handles both 'branch' and 'branchId' fields
     */
    async getUsersByBranchAndRole(branchName: string, roleName: string): Promise<{ users: any[]; error?: string; debugInfo?: any }> {
        const roleVariations = [roleName, roleName.toLowerCase(), roleName.toUpperCase(), roleName.charAt(0).toUpperCase() + roleName.slice(1).toLowerCase()];
        const debugInfo: any = {
            branchName,
            roleName,
            attempts: []
        };

        // Try optimized Firestore queries first
        for (const roleVariant of roleVariations) {
            try {
                // Try query with 'branch' field
                const branchQuery = query(
                    collections.users,
                    where('branch', '==', branchName),
                    where('role', '==', roleVariant)
                );
                const branchSnapshot = await getDocs(branchQuery);
                const branchUsers = branchSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                debugInfo.attempts.push({
                    method: 'query_branch',
                    roleVariant,
                    resultCount: branchUsers.length,
                    success: branchUsers.length > 0
                });

                if (branchUsers.length > 0) {
                    console.log(`getUsersByBranchAndRole: Found ${branchUsers.length} users using branch query with role "${roleVariant}"`);
                    return { users: branchUsers, debugInfo };
                }

                // Try query with 'branchId' field
                const branchIdQuery = query(
                    collections.users,
                    where('branchId', '==', branchName),
                    where('role', '==', roleVariant)
                );
                const branchIdSnapshot = await getDocs(branchIdQuery);
                const branchIdUsers = branchIdSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                debugInfo.attempts.push({
                    method: 'query_branchId',
                    roleVariant,
                    resultCount: branchIdUsers.length,
                    success: branchIdUsers.length > 0
                });

                if (branchIdUsers.length > 0) {
                    console.log(`getUsersByBranchAndRole: Found ${branchIdUsers.length} users using branchId query with role "${roleVariant}"`);
                    return { users: branchIdUsers, debugInfo };
                }
            } catch (queryError: any) {
                debugInfo.attempts.push({
                    method: 'query',
                    roleVariant,
                    error: queryError.message,
                    errorCode: queryError.code
                });
                console.warn(`getUsersByBranchAndRole: Query failed for role "${roleVariant}":`, queryError.message);
            }
        }

        // Fallback: Load all users and filter in memory
        try {
            console.log('getUsersByBranchAndRole: All queries returned 0 results, falling back to loading all users');
            const allUsersSnapshot = await getDocs(collections.users);
            const allUsers = allUsersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            console.log(`getUsersByBranchAndRole: Loaded ${allUsers.length} total users for filtering`);

            // Filter by branch (check both fields) and role (case-insensitive)
            const filteredUsers = allUsers.filter(user => {
                const userBranch = user.branch || '';
                const userBranchId = user.branchId || '';
                const userRole = (user.role || '').toLowerCase();
                const targetRole = roleName.toLowerCase();
                
                const branchMatches = userBranch === branchName || userBranchId === branchName;
                const roleMatches = userRole === targetRole;
                
                return branchMatches && roleMatches;
            });

            // Debug: Show what branches and roles exist
            if (filteredUsers.length === 0) {
                const allBranches = [...new Set(allUsers.map(u => u.branch).filter(Boolean))];
                const allBranchIds = [...new Set(allUsers.map(u => u.branchId).filter(Boolean))];
                const allRoles = [...new Set(allUsers.map(u => u.role).filter(Boolean))];
                
                debugInfo.fallbackInfo = {
                    totalUsers: allUsers.length,
                    availableBranches: allBranches,
                    availableBranchIds: allBranchIds,
                    availableRoles: allRoles,
                    usersInBranch: allUsers.filter(u => (u.branch || u.branchId) === branchName).length
                };

                console.warn('getUsersByBranchAndRole: No users found after fallback');
                console.warn('Available branches:', allBranches);
                console.warn('Available branchIds:', allBranchIds);
                console.warn('Available roles:', allRoles);
                console.warn(`Users in branch "${branchName}":`, allUsers.filter(u => (u.branch || u.branchId) === branchName).map(u => ({ id: u.id, name: u.name, role: u.role, branch: u.branch, branchId: u.branchId })));
            }

            debugInfo.attempts.push({
                method: 'fallback_memory',
                resultCount: filteredUsers.length,
                success: filteredUsers.length > 0
            });

            return { users: filteredUsers, debugInfo };
        } catch (error: any) {
            const errorMsg = `Failed to fetch users: ${error.message}`;
            console.error('getUsersByBranchAndRole Error:', error);
            debugInfo.attempts.push({
                method: 'fallback_memory',
                error: error.message,
                errorCode: error.code
            });
            return { users: [], error: errorMsg, debugInfo };
        }
    },

    /**
     * Get all bookers assigned to a branch
     * Uses optimized helper function with fallback logic
     */
    async getBranchBookers(branchName: string): Promise<any[]> {
        try {
            console.log('getBranchBookers: Fetching bookers for branch:', branchName);
            const result = await this.getUsersByBranchAndRole(branchName, 'Booker');
            
            if (result.error) {
                console.error('getBranchBookers Error:', result.error);
                // Don't return empty array - log error but return what we found
            }
            
            console.log(`getBranchBookers: Found ${result.users.length} bookers for branch "${branchName}"`);
            if (result.debugInfo) {
                console.log('getBranchBookers Debug Info:', result.debugInfo);
            }
            
            return result.users;
        } catch (error: any) {
            console.error("Firestore Error [getBranchBookers]:", error.message);
            console.error("Error code:", error.code);
            console.error("Error stack:", error.stack);
            // Return empty array only as last resort
            return [];
        }
    },

    /**
     * Get all salesmen assigned to a branch
     * Uses optimized helper function with fallback logic
     */
    async getBranchSalesmen(branchName: string): Promise<any[]> {
        try {
            console.log('getBranchSalesmen: Fetching salesmen for branch:', branchName);
            const result = await this.getUsersByBranchAndRole(branchName, 'Salesman');
            
            if (result.error) {
                console.error('getBranchSalesmen Error:', result.error);
                // Don't return empty array - log error but return what we found
            }
            
            console.log(`getBranchSalesmen: Found ${result.users.length} salesmen for branch "${branchName}"`);
            if (result.debugInfo) {
                console.log('getBranchSalesmen Debug Info:', result.debugInfo);
            }
            
            return result.users;
        } catch (error: any) {
            console.error("Firestore Error [getBranchSalesmen]:", error.message);
            console.error("Error code:", error.code);
            console.error("Error stack:", error.stack);
            // Return empty array only as last resort
            return [];
        }
    },

    /**
     * Get orders for bookers in a branch
     */
    /**
     * Get all shops from Firestore
     * Handles both 'branch' and 'branchId' fields for branch filtering
     */
    async getAllShops(regionId?: string, branch?: string): Promise<any[]> {
        try {
            console.log('getAllShops: Fetching shops from Firestore', { regionId, branch });
            
            // If branch filter provided, try both branch and branchId fields
            if (branch) {
                let shops: any[] = [];
                let foundViaBranch = false;
                let foundViaBranchId = false;
                
                // Try query with 'branch' field first
                try {
                    let q = query(collections.shops);
                    if (regionId) {
                        q = query(q, where('regionId', '==', regionId));
                    }
                    q = query(q, where('branch', '==', branch));
                    
                    const snapshot = await getDocs(q);
                    shops = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    foundViaBranch = shops.length > 0;
                    console.log(`getAllShops: Found ${shops.length} shops using 'branch' field for branch "${branch}"`);
                } catch (branchError: any) {
                    console.warn('getAllShops: Query with "branch" field failed:', branchError.message);
                }
                
                // If no results, try 'branchId' field
                if (shops.length === 0) {
                    try {
                        let q = query(collections.shops);
                        if (regionId) {
                            q = query(q, where('regionId', '==', regionId));
                        }
                        q = query(q, where('branchId', '==', branch));
                        
                        const snapshot = await getDocs(q);
                        shops = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        foundViaBranchId = shops.length > 0;
                        console.log(`getAllShops: Found ${shops.length} shops using 'branchId' field for branch "${branch}"`);
                    } catch (branchIdError: any) {
                        console.warn('getAllShops: Query with "branchId" field failed:', branchIdError.message);
                    }
                }
                
                // If still no results, fallback to loading all and filtering in memory
                if (shops.length === 0) {
                    console.log('getAllShops: Both branch queries returned 0 results, falling back to memory filter');
                    const allShopsSnapshot = await getDocs(collections.shops);
                    const allShops = allShopsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    
                    shops = allShops.filter(shop => {
                        const shopBranch = shop.branch || '';
                        const shopBranchId = shop.branchId || '';
                        const branchMatches = shopBranch === branch || shopBranchId === branch;
                        const regionMatches = !regionId || shop.regionId === regionId;
                        return branchMatches && regionMatches;
                    });
                    
                    console.log(`getAllShops: Found ${shops.length} shops after memory filter`);
                    
                    // Debug info if still no results
                    if (shops.length === 0) {
                        const allBranches = [...new Set(allShops.map(s => s.branch).filter(Boolean))];
                        const allBranchIds = [...new Set(allShops.map(s => s.branchId).filter(Boolean))];
                        console.warn('getAllShops: No shops found. Available branches:', allBranches);
                        console.warn('getAllShops: Available branchIds:', allBranchIds);
                    }
                }
                
                return shops;
            }
            
            // No branch filter - use standard query
            let q = query(collections.shops);
            if (regionId) {
                q = query(q, where('regionId', '==', regionId));
            }
            
            const snapshot = await getDocs(q);
            const shops = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`getAllShops: Found ${shops.length} shops${regionId ? ` in region ${regionId}` : ''}`);
            return shops;
        } catch (error: any) {
            console.error("Firestore Error [getAllShops]:", error.message);
            console.error("Error code:", error.code);
            console.error("Error stack:", error.stack);
            // Return empty array only as last resort
            return [];
        }
    },

    /**
     * Get shop ledger summary (balance, credit limit, transaction count, order count)
     */
    async getShopLedgerSummary(shopId: string): Promise<{
        currentBalance: number;
        creditLimit: number;
        recentTransactionsCount: number;
        totalOrdersCount: number;
        paymentStatus: 'paid' | 'partial' | 'pending';
    }> {
        try {
            // Get shop data
            const shopDoc = await getDoc(doc(collections.shops, shopId));
            if (!shopDoc.exists()) {
                throw new Error('Shop not found');
            }
            const shopData = shopDoc.data();
            
            // Get all orders for this shop
            const ordersQuery = query(
                collections.orders,
                where("shopId", "==", shopId)
            );
            const ordersSnap = await getDocs(ordersQuery);
            const orders = ordersSnap.docs.map(doc => doc.data());
            
            // Calculate current balance (unpaid credit from delivered orders)
            const deliveredOrders = orders.filter(o => o.status === 'delivered');
            const currentBalance = deliveredOrders.reduce((sum, order) => {
                const creditAmt = parseFloat(String(order.creditAmount || 0));
                const paymentStatus = order.paymentStatus || 'pending';
                if (paymentStatus === 'pending' || paymentStatus === 'partial') {
                    return sum + creditAmt;
                }
                return sum;
            }, 0);
            
            // Get credit limit from shop data
            const creditLimit = parseFloat(String(shopData.creditLimit || 0));
            
            // Count recent transactions (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const recentTransactions = orders.filter(order => {
                const orderDate = order.deliveredAt?.toDate ? order.deliveredAt.toDate() : 
                                 order.updatedAt?.toDate ? order.updatedAt.toDate() :
                                 order.createdAt?.toDate ? order.createdAt.toDate() : null;
                return orderDate && orderDate >= thirtyDaysAgo;
            });
            
            // Determine payment status
            let paymentStatus: 'paid' | 'partial' | 'pending' = 'paid';
            if (currentBalance > 0) {
                const hasPartialPayments = deliveredOrders.some(o => o.paymentStatus === 'partial');
                paymentStatus = hasPartialPayments ? 'partial' : 'pending';
            }
            
            return {
                currentBalance,
                creditLimit,
                recentTransactionsCount: recentTransactions.length,
                totalOrdersCount: orders.length,
                paymentStatus
            };
        } catch (error: any) {
            console.error("Firestore Error [getShopLedgerSummary]:", error.message);
            return {
                currentBalance: 0,
                creditLimit: 0,
                recentTransactionsCount: 0,
                totalOrdersCount: 0,
                paymentStatus: 'paid'
            };
        }
    },

    /**
     * Get staff member details (performance, activities, summary)
     */
    async getStaffMemberDetails(userId: string, role: 'Booker' | 'Salesman'): Promise<{
        user: any;
        performance: {
            totalOrders?: number;
            totalDeliveries?: number;
            totalSalesAmount: number;
            activeShopsCount?: number;
            completionRate: number;
        };
        recentActivities: any[];
    }> {
        try {
            console.log(`getStaffMemberDetails: Fetching details for ${role} ${userId}`);
            
            // Get user profile
            const userDoc = await getDoc(doc(collections.users, userId));
            if (!userDoc.exists()) {
                throw new Error('User not found');
            }
            const userData = { id: userDoc.id, ...userDoc.data() };
            console.log(`getStaffMemberDetails: User found - ${userData.name}, branch: ${userData.branch}`);
            
            let performance: any = {
                totalOrders: 0,
                totalDeliveries: 0,
                totalSalesAmount: 0,
                activeShopsCount: 0,
                completionRate: 0
            };
            let recentActivities: any[] = [];
            
            if (role === 'Booker') {
                // Try query with bookerId first
                let orders: any[] = [];
                try {
                const ordersQuery = query(
                    collections.orders,
                    where("bookerId", "==", userId),
                    orderBy("createdAt", "desc"),
                    limit(100)
                );
                const ordersSnap = await getDocs(ordersQuery);
                    orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    console.log(`getStaffMemberDetails [Booker]: Found ${orders.length} orders via query`);
                } catch (queryError: any) {
                    console.warn('getStaffMemberDetails [Booker]: Query failed, trying fallback:', queryError.message);
                    // Fallback: Get all orders and filter in memory
                    const allOrdersSnap = await getDocs(collections.orders);
                    orders = allOrdersSnap.docs
                        .map(doc => ({ id: doc.id, ...doc.data() }))
                        .filter(order => order.bookerId === userId)
                        .sort((a, b) => {
                            const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 
                                         a.createdAt?.seconds ? a.createdAt.seconds * 1000 :
                                         new Date(a.createdAt || 0).getTime();
                            const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 
                                         b.createdAt?.seconds ? b.createdAt.seconds * 1000 :
                                         new Date(b.createdAt || 0).getTime();
                            return bTime - aTime;
                        })
                        .slice(0, 100);
                    console.log(`getStaffMemberDetails [Booker]: Fallback found ${orders.length} orders`);
                }
                
                // Get shops for this booker
                let shops: any[] = [];
                try {
                const shopsQuery = query(
                    collections.shops,
                    where("bookerId", "==", userId)
                );
                const shopsSnap = await getDocs(shopsQuery);
                    shops = shopsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    console.log(`getStaffMemberDetails [Booker]: Found ${shops.length} shops`);
                } catch (shopError: any) {
                    console.warn('getStaffMemberDetails [Booker]: Shop query failed, trying fallback:', shopError.message);
                    // Fallback: Get all shops and filter
                    const allShopsSnap = await getDocs(collections.shops);
                    shops = allShopsSnap.docs
                        .map(doc => ({ id: doc.id, ...doc.data() }))
                        .filter(shop => shop.bookerId === userId);
                    console.log(`getStaffMemberDetails [Booker]: Fallback found ${shops.length} shops`);
                }
                
                // Calculate performance
                const deliveredOrders = orders.filter(o => o.status === 'delivered');
                const totalSales = deliveredOrders.reduce((sum, order) => {
                    return sum + parseFloat(String(order.grandTotal || order.totalAmount || 0));
                }, 0);
                
                console.log(`getStaffMemberDetails [Booker]: Performance - Total: ${orders.length}, Delivered: ${deliveredOrders.length}, Sales: ${totalSales}`);
                
                performance = {
                    totalOrders: orders.length,
                    totalSalesAmount: totalSales,
                    activeShopsCount: shops.filter(s => s.isActive || s.status === 'Active').length,
                    completionRate: orders.length > 0 ? (deliveredOrders.length / orders.length) * 100 : 0
                };
                
                // Recent activities (last 10 orders)
                recentActivities = orders.slice(0, 10).map(order => ({
                    type: 'order',
                    id: order.id,
                    orderNumber: order.orderNumber,
                    shopName: order.shopName,
                    amount: order.grandTotal || order.totalAmount || 0,
                    status: order.status,
                    date: order.createdAt
                }));
            } else if (role === 'Salesman') {
                // Try to get deliveries from deliveries collection first
                let deliveries: any[] = [];
                let orders: any[] = [];
                
                try {
                    // Try deliveries collection without orderBy first (in case index is missing)
                    const deliveriesCollection = collection(db, 'deliveries');
                    let deliveriesQuery;
                    
                    try {
                        // Try with orderBy
                        deliveriesQuery = query(
                            deliveriesCollection,
                            where("salesmanId", "==", userId),
                    orderBy("createdAt", "desc"),
                            limit(100)
                );
                        const deliveriesSnap = await getDocs(deliveriesQuery);
                        deliveries = deliveriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        console.log(`getStaffMemberDetails [Salesman]: Found ${deliveries.length} deliveries via query with orderBy`);
                    } catch (orderByError: any) {
                        console.warn('getStaffMemberDetails [Salesman]: Query with orderBy failed, trying without:', orderByError.message);
                        // Try without orderBy
                        deliveriesQuery = query(
                            deliveriesCollection,
                            where("salesmanId", "==", userId),
                            limit(100)
                        );
                        const deliveriesSnap = await getDocs(deliveriesQuery);
                        deliveries = deliveriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        // Sort manually
                        deliveries.sort((a, b) => {
                            const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 
                                         a.createdAt?.seconds ? a.createdAt.seconds * 1000 :
                                         new Date(a.createdAt || 0).getTime();
                            const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 
                                         b.createdAt?.seconds ? b.createdAt.seconds * 1000 :
                                         new Date(b.createdAt || 0).getTime();
                            return bTime - aTime;
                        });
                        console.log(`getStaffMemberDetails [Salesman]: Found ${deliveries.length} deliveries via query without orderBy`);
                    }
                    
                    // Get corresponding orders for these deliveries
                    if (deliveries.length > 0) {
                        const orderIds = deliveries.map(d => d.orderId).filter(Boolean);
                        console.log(`getStaffMemberDetails [Salesman]: Looking for ${orderIds.length} orders`);
                        
                        if (orderIds.length > 0) {
                            // Try to get orders by IDs (batch if needed)
                            const allOrdersSnap = await getDocs(collections.orders);
                            orders = allOrdersSnap.docs
                                .map(doc => ({ id: doc.id, ...doc.data() }))
                                .filter(order => {
                                    // Must match orderId AND be in salesman's branch
                                    if (!orderIds.includes(order.id)) return false;
                                    // Filter by branch to ensure only orders from salesman's branch
                                    if (userData.branch && order.branch !== userData.branch) return false;
                                    return true;
                                });
                            console.log(`getStaffMemberDetails [Salesman]: Found ${orders.length} orders matching delivery orderIds and branch filter`);
                        }
                    }
                } catch (deliveryError: any) {
                    console.warn('getStaffMemberDetails [Salesman]: Deliveries query failed, trying orders fallback:', deliveryError.message);
                    
                    // Fallback: Get all orders and filter by salesmanId or branch
                    const allOrdersSnap = await getDocs(collections.orders);
                const allOrders = allOrdersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                    // Filter orders assigned to this salesman - MUST be in salesman's branch
                    orders = allOrders.filter(order => {
                        // First check: order must be in salesman's branch
                        if (userData.branch && order.branch !== userData.branch) return false;
                    // Check if order has salesmanId field
                    if (order.salesmanId === userId) return true;
                        // Check if order has delivery-related status (for fallback matching)
                        if (order.status === 'load_form_ready' || order.status === 'assigned' || order.status === 'delivered') {
                        return true;
                    }
                    return false;
                });
                
                    console.log(`getStaffMemberDetails [Salesman]: Fallback found ${orders.length} orders`);
                }
                
                // Also try to get deliveries without orderBy as additional fallback
                if (orders.length === 0 && deliveries.length === 0) {
                    try {
                        const deliveriesCollection = collection(db, 'deliveries');
                        const allDeliveriesSnap = await getDocs(deliveriesCollection);
                        const allDeliveries = allDeliveriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        deliveries = allDeliveries.filter(d => d.salesmanId === userId);
                        console.log(`getStaffMemberDetails [Salesman]: Found ${deliveries.length} deliveries via full scan`);
                        
                        if (deliveries.length > 0) {
                            const orderIds = deliveries.map(d => d.orderId).filter(Boolean);
                            const allOrdersSnap = await getDocs(collections.orders);
                            orders = allOrdersSnap.docs
                                .map(doc => ({ id: doc.id, ...doc.data() }))
                                .filter(order => {
                                    // Must match orderId AND be in salesman's branch
                                    if (!orderIds.includes(order.id)) return false;
                                    // Filter by branch to ensure only orders from salesman's branch
                                    if (userData.branch && order.branch !== userData.branch) return false;
                                    return true;
                                });
                        }
                    } catch (e: any) {
                        console.warn('getStaffMemberDetails [Salesman]: Full scan also failed:', e.message);
                    }
                }
                
                const deliveredOrders = orders.filter(o => o.status === 'delivered');
                const totalSales = deliveredOrders.reduce((sum, order) => {
                    return sum + parseFloat(String(order.grandTotal || order.totalAmount || 0));
                }, 0);
                
                console.log(`getStaffMemberDetails [Salesman]: Performance - Total: ${orders.length}, Delivered: ${deliveredOrders.length}, Sales: ${totalSales}`);
                
                performance = {
                    totalDeliveries: orders.length,
                    totalSalesAmount: totalSales,
                    completionRate: orders.length > 0 ? (deliveredOrders.length / orders.length) * 100 : 0
                };
                
                // Recent activities (last 10 deliveries)
                recentActivities = orders.slice(0, 10).map(order => ({
                    type: 'delivery',
                    id: order.id,
                    orderNumber: order.orderNumber,
                    shopName: order.shopName,
                    amount: order.grandTotal || order.totalAmount || 0,
                    status: order.status,
                    date: order.deliveredAt || order.updatedAt || order.createdAt
                }));
            }
            
            console.log(`getStaffMemberDetails: Returning performance data:`, performance);
            
            return {
                user: userData,
                performance,
                recentActivities
            };
        } catch (error: any) {
            console.error("Firestore Error [getStaffMemberDetails]:", error.message);
            console.error("Error stack:", error.stack);
            return {
                user: null,
                performance: {
                    totalOrders: 0,
                    totalDeliveries: 0,
                    totalSalesAmount: 0,
                    activeShopsCount: 0,
                    completionRate: 0
                },
                recentActivities: []
            };
        }
    },

    /**
     * Get KPO details (performance, activities, summary)
     */
    async getKPODetails(kpoId: string): Promise<{
        user: any;
        performance: {
            totalOrders: number;
            totalSalesAmount: number;
            totalBookers: number;
            totalSalesmen: number;
        };
        recentActivities: any[];
    }> {
        try {
            console.log(`getKPODetails: Fetching details for KPO ${kpoId}`);
            
            // Get KPO profile
            const userDoc = await getDoc(doc(collections.users, kpoId));
            if (!userDoc.exists()) {
                throw new Error('KPO not found');
            }
            const userData = { id: userDoc.id, ...userDoc.data() };
            console.log(`getKPODetails: KPO found - ${userData.name}, branch: ${userData.branch}`);
            
            const branchName = userData.branch || '';
            
            // Get bookers in this branch
            const bookers = await this.getBranchBookers(branchName);
            const totalBookers = bookers.length;
            
            // Get salesmen in this branch
            const salesmen = await this.getBranchSalesmen(branchName);
            const totalSalesmen = salesmen.length;
            
            // Get orders for this branch
            const branchOrders = await this.getBranchOrders(branchName);
            const totalOrders = branchOrders.length;
            
            // Calculate total sales from delivered orders
            const deliveredOrders = branchOrders.filter(o => o.status === 'delivered');
            const totalSales = deliveredOrders.reduce((sum, order) => {
                return sum + parseFloat(String(order.grandTotal || order.totalAmount || 0));
            }, 0);
            
            console.log(`getKPODetails: Performance - Orders: ${totalOrders}, Sales: ${totalSales}, Bookers: ${totalBookers}, Salesmen: ${totalSalesmen}`);
            
            // Recent activities (last 10 orders)
            const recentActivities = branchOrders.slice(0, 10).map(order => ({
                type: 'order',
                id: order.id,
                orderNumber: order.orderNumber,
                shopName: order.shopName,
                amount: order.grandTotal || order.totalAmount || 0,
                status: order.status,
                date: order.createdAt
            }));
            
            return {
                user: userData,
                performance: {
                    totalOrders,
                    totalSalesAmount: totalSales,
                    totalBookers,
                    totalSalesmen
                },
                recentActivities
            };
        } catch (error: any) {
            console.error("Firestore Error [getKPODetails]:", error.message);
            console.error("Error stack:", error.stack);
            return {
                user: null,
                performance: {
                    totalOrders: 0,
                    totalSalesAmount: 0,
                    totalBookers: 0,
                    totalSalesmen: 0
                },
                recentActivities: []
            };
        }
    },

    async getBranchOrders(branchName: string, dateRange?: DateRange): Promise<any[]> {
        try {
            console.log('getBranchOrders: Fetching orders for branch:', branchName);
            // First get all bookers in the branch
            const bookers = await this.getBranchBookers(branchName);
            if (bookers.length === 0) {
                console.log('getBranchOrders: No bookers found in this branch, fetching all orders to debug');
                
                // Debug: Get a sample of orders to see their structure
                const debugQuery = query(collections.orders, orderBy("createdAt", "desc"), limit(5));
                const debugSnapshot = await getDocs(debugQuery);
                if (debugSnapshot.docs.length > 0) {
                    console.log('Sample orders in database:');
                    debugSnapshot.docs.forEach(doc => {
                        const data = doc.data();
                        console.log('  Order:', { id: doc.id, bookerId: data.bookerId, status: data.status, shopName: data.shopName });
                    });
                } else {
                    console.log('No orders found in database at all');
                }
                
                return [];
            }

            const bookerIds = bookers.map(b => b.id);
            console.log(`getBranchOrders: Searching orders for ${bookerIds.length} bookers:`, bookerIds);
            
            // Get all orders and filter by bookerId (avoid composite index issues)
            const allOrdersSnapshot = await getDocs(query(collections.orders, orderBy("createdAt", "desc")));
            let allOrders = allOrdersSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(order => bookerIds.includes(order.bookerId));

            console.log(`getBranchOrders: Total orders found for branch bookers: ${allOrders.length}`);
            
            if (allOrders.length === 0 && allOrdersSnapshot.docs.length > 0) {
                // Debug: Show sample orders and their bookerIds
                console.log('getBranchOrders: Orders exist but none match branch bookers. Sample order bookerIds:');
                allOrdersSnapshot.docs.slice(0, 5).forEach(doc => {
                    const data = doc.data();
                    console.log(`  Order ${doc.id}: bookerId = "${data.bookerId}"`);
                });
                console.log('Branch booker IDs:', bookerIds);
            }

            // Apply date filter if provided
            if (dateRange) {
                const startTime = Timestamp.fromDate(dateRange.start);
                const endTime = Timestamp.fromDate(dateRange.end);
                allOrders = allOrders.filter(order => {
                    const orderTime = order.createdAt;
                    if (!orderTime) return false;
                    const orderTimestamp = orderTime instanceof Timestamp ? orderTime : Timestamp.fromDate(new Date(orderTime));
                    return orderTimestamp >= startTime && orderTimestamp <= endTime;
                });
                console.log(`getBranchOrders: After date filter: ${allOrders.length} orders`);
            }

            return allOrders;
        } catch (error: any) {
            console.error("Firestore Error [getBranchOrders]:", error.message);
            console.error("Error stack:", error.stack);
            return [];
        }
    },

    /**
     * Get total cash amount for today from branch orders (ONLY delivered orders)
     */
    async getBranchCashToday(branchName: string): Promise<number> {
        try {
            // Use financial service for single source of truth
            const { getTotalCashToday } = await import('./services/financialService');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dateRange: DateRange = { start: today, end: tomorrow };
            return await getTotalCashToday(branchName, dateRange);
        } catch (error: any) {
            console.error("Firestore Error [getBranchCashToday]:", error.message);
            return 0;
        }
    },

    /**
     * Get recent activity for branch dashboard (NON-FINANCIAL activity log)
     * Includes: Order bookings, Payments, Returns, Deliveries
     * NOTE: This is separate from financial ledgers - use getBranchLedgerTransactions for financial data
     */
    async getBranchRecentActivity(branchName: string, limitCount: number = 10): Promise<any[]> {
        try {
            // Use financial service for recent activity (non-financial)
            const { getRecentActivity } = await import('./services/financialService');
            return await getRecentActivity(branchName, limitCount);
        } catch (error: any) {
            console.error("Firestore Error [getBranchRecentActivity]:", error.message);
            return [];
        }
    },

    /**
     * Get recent ledger transactions for branch (legacy - now uses getBranchRecentActivity)
     */
    async getBranchLedgerTransactions(branchName: string, limitCount: number = 10): Promise<any[]> {
        try {
            // Use financial service for financial ledger entries (deliveries and payments only)
            const { getFinancialLedgerEntries } = await import('./services/financialService');
            const entries = await getFinancialLedgerEntries(branchName);
            return entries.slice(0, limitCount);
        } catch (error: any) {
            console.error("Firestore Error [getBranchLedgerTransactions]:", error.message);
            return [];
        }
    },

    /**
     * Get monthly targets for bookers in branch
     */
    async getBranchTargets(branchName: string): Promise<any[]> {
        try {
            const bookers = await this.getBranchBookers(branchName);
            if (bookers.length === 0) return [];

            const bookerIds = bookers.map(b => b.id);
            const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

            // Get targets for current month
            const q = query(
                collection(db, 'targets'),
                where("bookerId", "in", bookerIds.length > 10 ? bookerIds.slice(0, 10) : bookerIds),
                where("periodValue", "==", currentMonth)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error: any) {
            console.error("Firestore Error [getBranchTargets]:", error.message);
            return [];
        }
    },

    /**
     * Get pending load forms for branch
     */
    async getPendingLoadForms(branchName: string): Promise<number> {
        try {
            // Get salesmen in branch
            const salesmen = await this.getBranchSalesmen(branchName);
            if (salesmen.length === 0) return 0;

            const salesmanIds = salesmen.map(s => s.id);
            let pendingCount = 0;

            // Check load forms assigned to branch salesmen
            for (let i = 0; i < salesmanIds.length; i += 10) {
                const batch = salesmanIds.slice(i, i + 10);
                const q = query(
                    collection(db, 'load_forms'),
                    where("confirmedBy", "in", batch),
                    where("status", "in", ["pending", "confirmed"])
                );
                const snapshot = await getDocs(q);
                pendingCount += snapshot.size;
            }

            return pendingCount;
        } catch (error: any) {
            console.error("Firestore Error [getPendingLoadForms]:", error.message);
            return 0;
        }
    },

    /**
     * Count active staff (salesmen with active routes/check-ins)
     */
    async getActiveStaffCount(branchName: string): Promise<number> {
        try {
            const salesmen = await this.getBranchSalesmen(branchName);
            if (salesmen.length === 0) return 0;

            const salesmanIds = salesmen.map(s => s.id);
            let activeCount = 0;

            // Check for active routes
            for (let i = 0; i < salesmanIds.length; i += 10) {
                const batch = salesmanIds.slice(i, i + 10);
                const q = query(
                    collection(db, 'routes'),
                    where("salesmanId", "in", batch),
                    where("status", "==", "active")
                );
                const snapshot = await getDocs(q);
                activeCount += snapshot.size;
            }

            return activeCount;
        } catch (error: any) {
            console.error("Firestore Error [getActiveStaffCount]:", error.message);
            return 0;
        }
    },

    /**
     * Get targets for bookers in a branch
     */
    async getBranchBookerTargets(branchName: string, periodValue?: string, period?: 'daily' | 'monthly'): Promise<any[]> {
        try {
            const bookers = await this.getBranchBookers(branchName);
            if (bookers.length === 0) return [];

            const bookerIds = bookers.map(b => b.id);
            const targetPeriod = period || 'monthly';
            const currentPeriod = periodValue || (targetPeriod === 'daily' 
                ? new Date().toISOString().slice(0, 10) // YYYY-MM-DD
                : new Date().toISOString().slice(0, 7)); // YYYY-MM

            let allTargets: any[] = [];

            // Get targets for bookers (batch queries if more than 10)
            for (let i = 0; i < bookerIds.length; i += 10) {
                const batch = bookerIds.slice(i, i + 10);
                const q = query(
                    collection(db, 'targets'),
                    where("bookerId", "in", batch),
                    where("periodValue", "==", currentPeriod),
                    where("period", "==", targetPeriod)
                );
                const snapshot = await getDocs(q);
                const targets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                allTargets = [...allTargets, ...targets];
            }

            return allTargets;
        } catch (error: any) {
            console.error("Firestore Error [getBranchBookerTargets]:", error.message);
            return [];
        }
    },

    /**
     * Create or update target for a booker
     */
    async createOrUpdateTarget(targetData: any): Promise<string> {
        try {
            const { bookerId, periodValue, targetType, period = 'monthly' } = targetData;
            
            // Check if target already exists
            const q = query(
                collection(db, 'targets'),
                where("bookerId", "==", bookerId),
                where("periodValue", "==", periodValue),
                where("targetType", "==", targetType),
                where("period", "==", period)
            );
            const snapshot = await getDocs(q);

            let startDate: Date;
            let endDate: Date;

            if (period === 'daily') {
                // Daily target: periodValue is "YYYY-MM-DD"
                const [year, month, day] = periodValue.split('-');
                startDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0);
                endDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 23, 59, 59, 999);
            } else {
                // Monthly target: periodValue is "YYYY-MM"
                const [year, month] = periodValue.split('-');
                startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
            }

            const targetDoc: any = {
                bookerId: targetData.bookerId,
                bookerName: targetData.bookerName,
                targetType: targetData.targetType,
                period: period,
                periodValue: periodValue,
                currentAmount: targetData.currentAmount || 0,
                currentCount: targetData.currentCount || 0,
                status: 'not_started',
                achievementPercent: 0,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                updatedAt: serverTimestamp()
            };

            // Only add fields that have values (not undefined)
            if (targetData.targetAmount !== undefined && targetData.targetAmount !== null) {
                targetDoc.targetAmount = targetData.targetAmount;
            }
            if (targetData.targetCount !== undefined && targetData.targetCount !== null) {
                targetDoc.targetCount = targetData.targetCount;
            }
            if (targetData.notes) {
                targetDoc.notes = targetData.notes;
            }

            if (snapshot.empty) {
                // Create new target
                targetDoc.createdAt = serverTimestamp();
                const docRef = await addDoc(collection(db, 'targets'), targetDoc);
                await this.logActivity('system', `Created ${period} target for ${targetData.bookerName}`);
                return docRef.id;
            } else {
                // Update existing target
                const existingTarget = snapshot.docs[0];
                await updateDoc(doc(db, 'targets', existingTarget.id), targetDoc);
                await this.logActivity('system', `Updated ${period} target for ${targetData.bookerName}`);
                return existingTarget.id;
            }
        } catch (error: any) {
            console.error("Firestore Error [createOrUpdateTarget]:", error.message);
            throw error;
        }
    },

    /**
     * Calculate achieved amounts for a booker from orders and payments
     */
    async calculateBookerAchievements(bookerId: string, periodValue: string, period: 'daily' | 'monthly' = 'monthly'): Promise<{ 
        salesAmount: number; 
        ordersCount: number; 
        shopsCount: number;
        recoveryAmount: number; // Payment collection amount
        averageOrderValue: number;
        conversionRate: number;
    }> {
        try {
            let startDate: Date;
            let endDate: Date;

            if (period === 'daily') {
                // Daily: periodValue is "YYYY-MM-DD"
                const [year, month, day] = periodValue.split('-');
                startDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0);
                endDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 23, 59, 59, 999);
            } else {
                // Monthly: periodValue is "YYYY-MM"
            const [year, month] = periodValue.split('-');
                startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
            }

            // Get ALL orders for this booker in the period (not just delivered - bookers book orders, not deliver them)
            // Count orders that are submitted, finalized, billed, load_form_ready, assigned, or delivered
            const q = query(
                collections.orders,
                where("bookerId", "==", bookerId)
            );
            const snapshot = await getDocs(q);
            
            const orders = snapshot.docs.map(doc => doc.data());
            
            // Filter orders by date and status (count all active orders, not just delivered)
            // Exclude only cancelled/rejected orders
            const excludedStatuses = ['cancelled', 'rejected', 'edit_requested'];
            const periodOrders = orders.filter(order => {
                // Exclude cancelled/rejected orders
                if (excludedStatuses.includes(order.status?.toLowerCase())) {
                    return false;
                }
                
                // Filter by date (use createdAt for booker orders - when they created the order)
                const orderDate = order.createdAt 
                    ? (order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt))
                    : new Date();
                return orderDate >= startDate && orderDate <= endDate;
            });

            // Calculate sales amount only for delivered orders (for reference, not for targets)
            const deliveredOrders = periodOrders.filter(o => o.status?.toLowerCase() === 'delivered');
            const salesAmount = deliveredOrders.reduce((sum, order) => sum + (order.grandTotal || order.totalAmount || 0), 0);
            const ordersCount = periodOrders.length; // Count ALL orders, not just delivered
            const averageOrderValue = ordersCount > 0 ? salesAmount / ordersCount : 0;

            // Get shops created by this booker in the period
            const shopsQ = query(
                collections.shops,
                where("bookerId", "==", bookerId)
            );
            const shopsSnapshot = await getDocs(shopsQ);
            const shops = shopsSnapshot.docs.map(doc => doc.data());
            
            const periodShops = shops.filter(shop => {
                const shopDate = shop.createdAt ? new Date(shop.createdAt) : new Date();
                return shopDate >= startDate && shopDate <= endDate;
            });
            const shopsCount = periodShops.length;
            
            // Conversion rate: orders per shop (if shops > 0)
            const conversionRate = shopsCount > 0 ? (ordersCount / shopsCount) * 100 : 0;

            // Calculate recovery (payment collection) for this booker's shops
            let recoveryAmount = 0;
            try {
                // Get all shops created by this booker
                const bookerShopIds = shops.map(s => s.id);
                
                if (bookerShopIds.length > 0) {
                    // Get payments collected for these shops in the period
                    // Batch queries if more than 10 shops
                    for (let i = 0; i < bookerShopIds.length; i += 10) {
                        const batch = bookerShopIds.slice(i, i + 10);
                        try {
                            const paymentsQ = query(
                                collection(db, 'ledger_transactions'),
                                where("shopId", "in", batch),
                                where("type", "==", "PAYMENT")
                            );
                            const paymentsSnap = await getDocs(paymentsQ);
                            
                            paymentsSnap.docs.forEach(doc => {
                                const payment = doc.data();
                                const paymentDate = payment.date?.toDate 
                                    ? payment.date.toDate()
                                    : payment.date?.seconds 
                                    ? new Date(payment.date.seconds * 1000)
                                    : payment.createdAt?.toDate 
                                    ? payment.createdAt.toDate()
                                    : null;
                                
                                if (paymentDate && paymentDate >= startDate && paymentDate <= endDate) {
                                    recoveryAmount += Math.abs(payment.amount || 0); // Amount is negative in ledger, so use abs
                                }
                            });
                        } catch (e) {
                            // Fallback: get all payments and filter
                            const allPaymentsSnap = await getDocs(collection(db, 'ledger_transactions'));
                            allPaymentsSnap.docs.forEach(doc => {
                                const payment = doc.data();
                                if (payment.type === 'PAYMENT' && batch.includes(payment.shopId)) {
                                    const paymentDate = payment.date?.toDate 
                                        ? payment.date.toDate()
                                        : payment.date?.seconds 
                                        ? new Date(payment.date.seconds * 1000)
                                        : payment.createdAt?.toDate 
                                        ? payment.createdAt.toDate()
                                        : null;
                                    
                                    if (paymentDate && paymentDate >= startDate && paymentDate <= endDate) {
                                        recoveryAmount += Math.abs(payment.amount || 0);
                                    }
                                }
                            });
                            break; // Only need to do this once
                        }
                    }
                }
            } catch (e) {
                console.warn('Error calculating recovery amount:', e);
            }

            return { 
                salesAmount, 
                ordersCount, 
                shopsCount,
                recoveryAmount,
                averageOrderValue,
                conversionRate
            };
        } catch (error: any) {
            console.error("Firestore Error [calculateBookerAchievements]:", error.message);
            return { 
                salesAmount: 0, 
                ordersCount: 0, 
                shopsCount: 0,
                recoveryAmount: 0,
                averageOrderValue: 0,
                conversionRate: 0
            };
        }
    },

    /**
     * Record target completion when a booker achieves their target
     */
    async recordTargetCompletion(targetId: string, bookerId: string, bookerName: string, targetType: string, period: string, periodValue: string, achievedValue: number, targetValue: number): Promise<void> {
        try {
            // Check if completion already exists
            const q = query(
                collection(db, 'target_completions'),
                where("targetId", "==", targetId),
                where("bookerId", "==", bookerId)
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                // Create new completion record
                const completionDoc = {
                    targetId,
                    bookerId,
                    bookerName,
                    targetType,
                    period,
                    periodValue,
                    achievedValue,
                    targetValue,
                    achievementPercent: (achievedValue / targetValue) * 100,
                    completedAt: serverTimestamp(),
                    createdAt: serverTimestamp()
                };
                await addDoc(collection(db, 'target_completions'), completionDoc);
                await this.logActivity('system', `${bookerName} completed ${targetType} target (${period})`);
            }
        } catch (error: any) {
            console.error("Firestore Error [recordTargetCompletion]:", error.message);
        }
    },

    /**
     * Get target completion history for a booker
     */
    async getBookerCompletions(bookerId: string, limitCount: number = 50): Promise<any[]> {
        try {
            const q = query(
                collection(db, 'target_completions'),
                where("bookerId", "==", bookerId),
                orderBy("completedAt", "desc"),
                limit(limitCount)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error: any) {
            console.error("Firestore Error [getBookerCompletions]:", error.message);
            return [];
        }
    },

    /**
     * Get commissions for a booker
     */
    async getBookerCommissions(bookerId: string, period?: 'daily' | 'monthly', periodValue?: string): Promise<any[]> {
        try {
            let q;
            if (period && periodValue) {
                q = query(
                    collection(db, 'commissions'),
                    where("bookerId", "==", bookerId),
                    where("period", "==", period),
                    where("periodValue", "==", periodValue),
                    orderBy("assignedAt", "desc")
                );
            } else {
                q = query(
                    collection(db, 'commissions'),
                    where("bookerId", "==", bookerId),
                    orderBy("assignedAt", "desc")
                );
            }
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error: any) {
            console.error("Firestore Error [getBookerCommissions]:", error.message);
            return [];
        }
    },

    /**
     * Get all commissions for a branch
     */
    async getBranchCommissions(branchName: string, period?: 'daily' | 'monthly', periodValue?: string): Promise<any[]> {
        try {
            const bookers = await this.getBranchBookers(branchName);
            if (bookers.length === 0) return [];

            const bookerIds = bookers.map(b => b.id);
            let allCommissions: any[] = [];

            // Build query
            let q;
            if (period && periodValue) {
                q = query(
                    collection(db, 'commissions'),
                    where("bookerId", "in", bookerIds.length > 10 ? bookerIds.slice(0, 10) : bookerIds),
                    where("period", "==", period),
                    where("periodValue", "==", periodValue),
                    orderBy("assignedAt", "desc")
                );
            } else {
                q = query(
                    collection(db, 'commissions'),
                    where("bookerId", "in", bookerIds.length > 10 ? bookerIds.slice(0, 10) : bookerIds),
                    orderBy("assignedAt", "desc")
                );
            }
            
            // Handle batches if more than 10 bookers
            for (let i = 0; i < bookerIds.length; i += 10) {
                const batch = bookerIds.slice(i, i + 10);
                if (period && periodValue) {
                    q = query(
                        collection(db, 'commissions'),
                        where("bookerId", "in", batch),
                        where("period", "==", period),
                        where("periodValue", "==", periodValue),
                        orderBy("assignedAt", "desc")
                    );
                } else {
                    q = query(
                        collection(db, 'commissions'),
                        where("bookerId", "in", batch),
                        orderBy("assignedAt", "desc")
                    );
                }
                const snapshot = await getDocs(q);
                const commissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                allCommissions = [...allCommissions, ...commissions];
            }

            return allCommissions;
        } catch (error: any) {
            console.error("Firestore Error [getBranchCommissions]:", error.message);
            return [];
        }
    },

    /**
     * Create or update commission
     */
    async createOrUpdateCommission(commissionData: any): Promise<string> {
        try {
            const { bookerId, periodValue, period = 'monthly' } = commissionData;
            
            // Check if commission already exists
            const q = query(
                collection(db, 'commissions'),
                where("bookerId", "==", bookerId),
                where("periodValue", "==", periodValue),
                where("period", "==", period)
            );
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                // Update existing commission
                const existingCommission = snapshot.docs[0];
                await updateDoc(existingCommission.ref, {
                    ...commissionData,
                    updatedAt: serverTimestamp()
                });
                return existingCommission.id;
            } else {
                // Create new commission
                const docRef = await addDoc(collection(db, 'commissions'), {
                    ...commissionData,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    assignedAt: serverTimestamp()
                });
                return docRef.id;
            }
        } catch (error: any) {
            console.error("Firestore Error [createOrUpdateCommission]:", error.message);
            throw error;
        }
    },

    /**
     * Get all completions for a branch
     */
    async getBranchCompletions(branchName: string, limitCount: number = 100): Promise<any[]> {
        try {
            const bookers = await this.getBranchBookers(branchName);
            if (bookers.length === 0) return [];

            const bookerIds = bookers.map(b => b.id);
            let allCompletions: any[] = [];

            // Get completions for bookers (batch queries if more than 10)
            for (let i = 0; i < bookerIds.length; i += 10) {
                const batch = bookerIds.slice(i, i + 10);
                const q = query(
                    collection(db, 'target_completions'),
                    where("bookerId", "in", batch),
                    orderBy("completedAt", "desc"),
                    limit(limitCount)
                );
                const snapshot = await getDocs(q);
                const completions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                allCompletions = [...allCompletions, ...completions];
            }

            // Sort by completedAt descending
            allCompletions.sort((a, b) => {
                const aTime = a.completedAt?.toDate ? a.completedAt.toDate().getTime() : 0;
                const bTime = b.completedAt?.toDate ? b.completedAt.toDate().getTime() : 0;
                return bTime - aTime;
            });

            return allCompletions.slice(0, limitCount);
        } catch (error: any) {
            console.error("Firestore Error [getBranchCompletions]:", error.message);
            return [];
        }
    },

    // ==================== STOCK RETURNS ====================

    /**
     * Get pending stock returns for a branch
     */
    async getBranchStockReturns(branchName: string): Promise<any[]> {
        try {
            console.log('getBranchStockReturns: Fetching returns for branch:', branchName);
            
            // Get all salesmen in the branch
            const salesmen = await this.getBranchSalesmen(branchName);
            const salesmanIds = salesmen.map(s => s.id);
            
            if (salesmanIds.length === 0) {
                console.log('No salesmen found in branch, returning empty');
                return [];
            }

            // Try to fetch from stock_returns collection
            const allReturns: any[] = [];
            
            // Firebase 'in' query has a limit of 10, batch the queries
            for (let i = 0; i < salesmanIds.length; i += 10) {
                const batch = salesmanIds.slice(i, i + 10);
                try {
                    const q = query(
                        collection(db, 'stock_returns'),
                        where("salesmanId", "in", batch),
                        orderBy("createdAt", "desc")
                    );
                    const snapshot = await getDocs(q);
                    const returns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    allReturns.push(...returns);
                } catch (e) {
                    // If collection doesn't exist or index is missing, fetch all and filter
                    console.warn('Querying stock_returns by salesmanId failed, trying fallback');
                    const allSnapshot = await getDocs(collection(db, 'stock_returns'));
                    const all = allSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    const filtered = all.filter(r => batch.includes(r.salesmanId));
                    allReturns.push(...filtered);
                    break; // Only need to do this once
                }
            }

            console.log(`getBranchStockReturns: Found ${allReturns.length} returns`);
            return allReturns;
        } catch (error: any) {
            console.error("Firestore Error [getBranchStockReturns]:", error.message);
            return [];
        }
    },

    /**
     * Approve a stock return - updates status and creates ledger entry
     */
    async approveStockReturn(returnId: string, userId: string): Promise<boolean> {
        try {
            const returnRef = doc(db, 'stock_returns', returnId);
            const returnSnap = await getDoc(returnRef);
            
            if (!returnSnap.exists()) {
                console.error('Stock return not found:', returnId);
                return false;
            }

            const returnData = returnSnap.data();

            // Update return status
            await updateDoc(returnRef, {
                status: 'approved',
                approvedBy: userId,
                approvedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // Create ledger entry for the return
            await this.createStockReturnLedgerEntry(returnId, returnData, userId);

            await this.logActivity(userId, `Approved stock return ${returnData.returnNumber || returnId}`);
            
            console.log('Stock return approved:', returnId);
            return true;
        } catch (error: any) {
            console.error("Firestore Error [approveStockReturn]:", error.message);
            return false;
        }
    },

    /**
     * Reject a stock return with reason
     */
    async rejectStockReturn(returnId: string, userId: string, reason: string): Promise<boolean> {
        try {
            const returnRef = doc(db, 'stock_returns', returnId);
            const returnSnap = await getDoc(returnRef);
            
            if (!returnSnap.exists()) {
                console.error('Stock return not found:', returnId);
                return false;
            }

            const returnData = returnSnap.data();

            // Update return status
            await updateDoc(returnRef, {
                status: 'rejected',
                rejectedBy: userId,
                rejectedAt: serverTimestamp(),
                rejectionReason: reason,
                updatedAt: serverTimestamp()
            });

            await this.logActivity(userId, `Rejected stock return ${returnData.returnNumber || returnId}: ${reason}`);
            
            console.log('Stock return rejected:', returnId);
            return true;
        } catch (error: any) {
            console.error("Firestore Error [rejectStockReturn]:", error.message);
            return false;
        }
    },

    /**
     * Create a ledger entry for an approved stock return (Cash-only system)
     * Uses new ledger structure with gross_amount, net_cash, etc.
     */
    async createStockReturnLedgerEntry(returnId: string, returnData: any, userId: string): Promise<void> {
        try {
            // Get shop info for region_id and branch_id
            let regionId = returnData.regionId || '';
            let branchId = returnData.branch || '';
            
            if (!regionId || !branchId) {
                try {
                    const shopDoc = await getDoc(doc(db, 'shops', returnData.shopId));
                    if (shopDoc.exists()) {
                        const shopData = shopDoc.data();
                        regionId = regionId || shopData.regionId || '';
                        branchId = branchId || shopData.branch || '';
                    }
                } catch (e) {
                    console.warn('Could not fetch shop info for ledger entry:', e);
                }
            }

            // Create ledger entry with new structure
            const ledgerEntryId = `return_${returnId}_${Date.now()}`;
            const gross_amount = 0;
            const discount_allowed = 0;
            const discount_given = 0;
            const unauthorized_discount = 0;
            const net_cash = -(returnData.totalValue || 0); // Negative for return

            const ledgerEntry = {
                id: ledgerEntryId,
                ledger_id: ledgerEntryId,
                created_at: serverTimestamp(),
                region_id: regionId,
                branch_id: branchId,
                party_id: returnData.shopId,
                type: 'RETURN',
                gross_amount,
                discount_allowed,
                discount_given,
                unauthorized_discount,
                net_cash,
                created_by: userId,
                return_number: returnData.returnNumber || returnId,
                notes: `Stock return: ${returnData.items?.length || 0} items returned`,
                
                // Legacy fields for compatibility
                shopId: returnData.shopId,
                shopName: returnData.shopName || 'Unknown',
                date: serverTimestamp(),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            await setDoc(doc(db, 'ledger_transactions', ledgerEntryId), ledgerEntry);
            console.log('Ledger entry created for return:', returnId, 'net_cash:', net_cash);
        } catch (error: any) {
            console.error("Firestore Error [createStockReturnLedgerEntry]:", error.message);
        }
    },

    /**
     * Get branch ledger entries with running balance (real data)
     */
    async getBranchLedgerEntries(branchName: string): Promise<any[]> {
        try {
            // Use financial service for single source of truth
            // This ensures ONLY delivery and payment entries are included (no bookings)
            const { getFinancialLedgerEntries } = await import('./services/financialService');
            return await getFinancialLedgerEntries(branchName);
        } catch (error: any) {
            console.error("Firestore Error [getBranchLedgerEntries]:", error.message);
            return [];
        }
    },

    // ==================== COMPLIANCE REPORTS ====================

    /**
     * Get policy violations (orders with excessive discounts, credit limit breaches)
     */
    async getPolicyViolations(dateRange?: DateRange): Promise<any[]> {
        try {
            const violations: any[] = [];
            
            // Get all orders with unauthorized discounts
            const discountViolations = await this.getUnauthorizedDiscounts();
            discountViolations.forEach(order => {
                violations.push({
                    id: order.id,
                    type: 'Unauthorized Discount',
                    orderId: order.orderNumber || order.id,
                    bookerName: order.bookerName || 'Unknown',
                    branch: order.branch || 'N/A',
                    severity: 'High',
                    details: `Discount ${order.unauthorizedDiscount}% exceeds allowed ${order.allowedDiscount || 0}%`,
                    date: order.createdAt,
                    amount: order.grandTotal || order.totalAmount || 0
                });
            });

            // Get orders with credit limit violations (orders where creditAmount exceeds shop's limit)
            try {
                const ordersQuery = query(
                    collections.orders,
                    where("paymentMode", "in", ["credit", "split"])
                );
                const ordersSnap = await getDocs(ordersQuery);
                
                // Get all shops for credit limit check
                const shopsSnap = await getDocs(collections.shops);
                const shopLimits: Record<string, number> = {};
                shopsSnap.docs.forEach(doc => {
                    const data = doc.data();
                    shopLimits[doc.id] = data.creditLimit || 50000; // Default limit
                });

                ordersSnap.docs.forEach(doc => {
                    const order = doc.data();
                    const shopLimit = shopLimits[order.shopId] || 50000;
                    const creditAmount = order.creditAmount || 0;
                    
                    if (creditAmount > shopLimit) {
                        violations.push({
                            id: doc.id,
                            type: 'Credit Limit Breach',
                            orderId: order.orderNumber || doc.id,
                            bookerName: order.bookerName || 'Unknown',
                            branch: order.branch || 'N/A',
                            severity: 'Medium',
                            details: `Credit PKR ${creditAmount.toLocaleString()} exceeds shop limit of PKR ${shopLimit.toLocaleString()}`,
                            date: order.createdAt,
                            amount: creditAmount
                        });
                    }
                });
            } catch (e) {
                console.warn('Could not check credit limit violations');
            }

            return violations;
        } catch (error: any) {
            console.error("Firestore Error [getPolicyViolations]:", error.message);
            return [];
        }
    },

    /**
     * Get approval delays (time between order creation and KPO approval)
     */
    async getApprovalDelays(thresholdMinutes: number = 60): Promise<any[]> {
        try {
            const delays: any[] = [];
            
            // Get finalized orders
            const ordersQuery = query(
                collections.orders,
                where("status", "in", ["finalized", "billed", "load_form_ready", "delivered"])
            );
            const ordersSnap = await getDocs(ordersQuery);

            const toTimestamp = (val: any): number => {
                if (!val) return 0;
                if (val?.toDate) return val.toDate().getTime();
                if (val?.seconds) return val.seconds * 1000;
                return new Date(val).getTime() || 0;
            };

            ordersSnap.docs.forEach(doc => {
                const order = doc.data();
                const createdTime = toTimestamp(order.createdAt);
                const finalizedTime = toTimestamp(order.finalizedAt);
                
                if (createdTime && finalizedTime) {
                    const delayMs = finalizedTime - createdTime;
                    const delayMinutes = Math.round(delayMs / 60000);
                    
                    if (delayMinutes > thresholdMinutes) {
                        delays.push({
                            id: doc.id,
                            orderId: order.orderNumber || doc.id,
                            bookerName: order.bookerName || 'Unknown',
                            branch: order.branch || 'N/A',
                            createdAt: order.createdAt,
                            finalizedAt: order.finalizedAt,
                            delayMinutes: delayMinutes,
                            delayHours: (delayMinutes / 60).toFixed(1)
                        });
                    }
                }
            });

            // Sort by delay (longest first)
            delays.sort((a, b) => b.delayMinutes - a.delayMinutes);

            return delays;
        } catch (error: any) {
            console.error("Firestore Error [getApprovalDelays]:", error.message);
            return [];
        }
    },

    /**
     * Get notifications for a user (Admin or KPO)
     */
    async getNotifications(user: any): Promise<any[]> {
        try {
            console.log(`getNotifications: Fetching notifications for ${user.role} ${user.id}`);
            const notifications: any[] = [];
            
            if (user.role === 'Admin') {
                // Admin notifications: unauthorized discounts, policy violations, approval delays
                const [unauthorizedDiscounts, violations, delays] = await Promise.all([
                    this.getUnauthorizedDiscounts(),
                    this.getPolicyViolations(),
                    this.getApprovalDelays(60)
                ]);
                
                // Add unauthorized discounts as notifications
                unauthorizedDiscounts.slice(0, 5).forEach((order: any) => {
                    notifications.push({
                        id: `discount_${order.id}`,
                        type: 'unauthorized_discount',
                        title: 'Unauthorized Discount Detected',
                        message: `Order ${order.orderNumber || order.id} by ${order.bookerName || 'Unknown'} has ${order.unauthorizedDiscount}% discount`,
                        timestamp: order.createdAt,
                        link: 'ADMIN_REPORTS',
                        severity: 'high',
                        read: false
                    });
                });
                
                // Add policy violations
                violations.slice(0, 5).forEach((violation: any) => {
                    notifications.push({
                        id: `violation_${violation.id}`,
                        type: 'policy_violation',
                        title: 'Policy Violation',
                        message: `${violation.type} in order ${violation.orderId}`,
                        timestamp: violation.date,
                        link: 'ADMIN_REPORTS',
                        severity: violation.severity === 'High' ? 'high' : 'medium',
                        read: false
                    });
                });
                
                // Add approval delays
                delays.slice(0, 5).forEach((delay: any) => {
                    notifications.push({
                        id: `delay_${delay.id}`,
                        type: 'approval_delay',
                        title: 'Approval Delay',
                        message: `Order ${delay.orderId} took ${delay.delayHours}h to approve`,
                        timestamp: delay.finalizedAt,
                        link: 'ADMIN_REPORTS',
                        severity: delay.delayMinutes > 120 ? 'high' : 'medium',
                        read: false
                    });
                });
            } else if (user.role === 'KPO') {
                // KPO notifications: pending approvals, stock returns, critical tasks
                const branchName = user.branch || '';
                
                // Get pending orders (submitted status)
                const branchOrders = await this.getBranchOrders(branchName);
                const pendingOrders = branchOrders.filter(o => o.status === 'submitted');
                
                pendingOrders.slice(0, 5).forEach((order: any) => {
                    notifications.push({
                        id: `approval_${order.id}`,
                        type: 'pending_approval',
                        title: 'Order Pending Approval',
                        message: `Order ${order.orderNumber || order.id} from ${order.shopName || 'Unknown Shop'} needs approval`,
                        timestamp: order.createdAt,
                        link: `KPO_BOOKINGS:${order.id}`,
                        severity: 'high',
                        read: false
                    });
                });
                
                // Get pending stock returns
                const stockReturns = await this.getBranchStockReturns(branchName);
                const pendingReturns = stockReturns.filter(r => r.status === 'pending');
                
                pendingReturns.slice(0, 3).forEach((returnItem: any) => {
                    notifications.push({
                        id: `return_${returnItem.id}`,
                        type: 'stock_return',
                        title: 'Stock Return Pending',
                        message: `Return ${returnItem.returnNumber || returnItem.id} needs approval`,
                        timestamp: returnItem.createdAt,
                        link: 'KPO_RETURNS',
                        severity: 'medium',
                        read: false
                    });
                });
                
                // Critical tasks
                if (pendingOrders.length > 0) {
                    notifications.push({
                        id: 'critical_approvals',
                        type: 'critical_task',
                        title: 'Critical: Pending Approvals',
                        message: `${pendingOrders.length} orders waiting for your approval`,
                        timestamp: new Date(),
                        link: 'KPO_BOOKINGS',
                        severity: 'high',
                        read: false
                    });
                }
            }
            
            // Sort by timestamp (newest first)
            notifications.sort((a, b) => {
                const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 
                            a.timestamp?.seconds ? a.timestamp.seconds * 1000 :
                            new Date(a.timestamp || 0).getTime();
                const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 
                            b.timestamp?.seconds ? b.timestamp.seconds * 1000 :
                            new Date(b.timestamp || 0).getTime();
                return bTime - aTime;
            });
            
            console.log(`getNotifications: Returning ${notifications.length} notifications`);
            return notifications.slice(0, 20); // Limit to 20 most recent
        } catch (error: any) {
            console.error("Firestore Error [getNotifications]:", error.message);
            return [];
        }
    },

    /**
     * Mark notification as read (placeholder - can be implemented with a notifications collection)
     */
    async markNotificationAsRead(notificationId: string): Promise<void> {
        // In a real implementation, you would store read status in Firestore
        // For now, this is a placeholder
        console.log('markNotificationAsRead:', notificationId);
    },

    /**
     * Mark all notifications as read
     */
    async markAllNotificationsAsRead(userId: string): Promise<void> {
        // In a real implementation, you would store read status in Firestore
        console.log('markAllNotificationsAsRead:', userId);
    },

    /**
     * Track unauthorized discount for a booker (called when order is submitted)
     */
    async trackUnauthorizedDiscount(bookerId: string, unauthorizedAmount: number, orderId: string): Promise<void> {
        try {
            if (!bookerId || unauthorizedAmount <= 0) {
                return; // No tracking needed if no unauthorized discount
            }

            console.log(`trackUnauthorizedDiscount: Tracking ${unauthorizedAmount} for booker ${bookerId}, order ${orderId}`);
            
            const userRef = doc(db, 'users', bookerId);
            const userDoc = await getDoc(userRef);
            
            if (!userDoc.exists()) {
                console.warn(`trackUnauthorizedDiscount: Booker ${bookerId} not found`);
                return;
            }

            const userData = userDoc.data();
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; // Format: "2024-01"
            
            // Get current monthly unauthorized discount record
            const monthlyDiscounts = userData.monthlyUnauthorizedDiscounts || {};
            const currentMonthTotal = monthlyDiscounts[currentMonth] || 0;
            
            // Update monthly total
            const updatedMonthlyDiscounts = {
                ...monthlyDiscounts,
                [currentMonth]: currentMonthTotal + unauthorizedAmount
            };
            
            // Get order IDs for this month
            const monthlyOrderIds = userData.monthlyUnauthorizedDiscountOrders || {};
            const currentMonthOrders = monthlyOrderIds[currentMonth] || [];
            
            // Add order ID if not already present
            if (!currentMonthOrders.includes(orderId)) {
                const updatedMonthlyOrders = {
                    ...monthlyOrderIds,
                    [currentMonth]: [...currentMonthOrders, orderId]
                };
                
                await updateDoc(userRef, {
                    monthlyUnauthorizedDiscounts: updatedMonthlyDiscounts,
                    monthlyUnauthorizedDiscountOrders: updatedMonthlyOrders,
                    totalUnauthorizedDiscount: (userData.totalUnauthorizedDiscount || 0) + unauthorizedAmount,
                    updatedAt: serverTimestamp()
                });
            } else {
                // Just update the amount (order already tracked)
                await updateDoc(userRef, {
                    monthlyUnauthorizedDiscounts: updatedMonthlyDiscounts,
                    totalUnauthorizedDiscount: (userData.totalUnauthorizedDiscount || 0) + unauthorizedAmount,
                    updatedAt: serverTimestamp()
                });
            }
            
            console.log(`trackUnauthorizedDiscount: Updated monthly discount for ${currentMonth}: ${updatedMonthlyDiscounts[currentMonth]}`);
        } catch (error: any) {
            console.error("Firestore Error [trackUnauthorizedDiscount]:", error.message);
            // Don't throw - tracking failure shouldn't block order submission
        }
    },

    /**
     * Get monthly unauthorized discount for a booker
     */
    async getBookerMonthlyUnauthorizedDiscount(bookerId: string, month?: string): Promise<{
        currentMonth: string;
        currentMonthTotal: number;
        allMonths: Record<string, number>;
        totalUnauthorizedDiscount: number;
        orderIds: string[];
    }> {
        try {
            const userRef = doc(db, 'users', bookerId);
            const userDoc = await getDoc(userRef);
            
            if (!userDoc.exists()) {
                return {
                    currentMonth: '',
                    currentMonthTotal: 0,
                    allMonths: {},
                    totalUnauthorizedDiscount: 0,
                    orderIds: []
                };
            }

            const userData = userDoc.data();
            const now = new Date();
            const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            const monthlyDiscounts = userData.monthlyUnauthorizedDiscounts || {};
            const monthlyOrders = userData.monthlyUnauthorizedDiscountOrders || {};
            
            return {
                currentMonth: targetMonth,
                currentMonthTotal: monthlyDiscounts[targetMonth] || 0,
                allMonths: monthlyDiscounts,
                totalUnauthorizedDiscount: userData.totalUnauthorizedDiscount || 0,
                orderIds: monthlyOrders[targetMonth] || []
            };
        } catch (error: any) {
            console.error("Firestore Error [getBookerMonthlyUnauthorizedDiscount]:", error.message);
            return {
                currentMonth: '',
                currentMonthTotal: 0,
                allMonths: {},
                totalUnauthorizedDiscount: 0,
                orderIds: []
            };
        }
    },

    /**
     * Reset unauthorized discount for a booker after salary deduction (KPO can call this)
     */
    async resetBookerUnauthorizedDiscount(bookerId: string, month: string, resetBy: string): Promise<boolean> {
        try {
            console.log(`resetBookerUnauthorizedDiscount: Resetting discount for booker ${bookerId}, month ${month}`);
            
            const userRef = doc(db, 'users', bookerId);
            const userDoc = await getDoc(userRef);
            
            if (!userDoc.exists()) {
                throw new Error('Booker not found');
            }

            const userData = userDoc.data();
            const monthlyDiscounts = userData.monthlyUnauthorizedDiscounts || {};
            const monthlyOrders = userData.monthlyUnauthorizedDiscountOrders || {};
            
            const monthAmount = monthlyDiscounts[month] || 0;
            
            if (monthAmount <= 0) {
                console.log(`resetBookerUnauthorizedDiscount: No discount to reset for month ${month}`);
                return true; // Nothing to reset
            }
            
            // Remove the month from records
            const updatedMonthlyDiscounts = { ...monthlyDiscounts };
            delete updatedMonthlyDiscounts[month];
            
            const updatedMonthlyOrders = { ...monthlyOrders };
            delete updatedMonthlyOrders[month];
            
            // Update total (subtract the reset amount)
            const newTotal = Math.max(0, (userData.totalUnauthorizedDiscount || 0) - monthAmount);
            
            await updateDoc(userRef, {
                monthlyUnauthorizedDiscounts: updatedMonthlyDiscounts,
                monthlyUnauthorizedDiscountOrders: updatedMonthlyOrders,
                totalUnauthorizedDiscount: newTotal,
                updatedAt: serverTimestamp()
            });
            
            // Log the reset action
            await this.logActivity(
                resetBy,
                `Reset unauthorized discount for booker ${userData.name || bookerId}, month ${month}, amount: Rs. ${monthAmount.toFixed(2)}`
            );
            
            console.log(`resetBookerUnauthorizedDiscount: Successfully reset Rs. ${monthAmount} for month ${month}`);
            return true;
        } catch (error: any) {
            console.error("Firestore Error [resetBookerUnauthorizedDiscount]:", error.message);
            throw error;
        }
    },

    /**
     * Get comprehensive report data for Admin
     * Supports filtering by region, branch, KPO, and date range
     */
    async getComprehensiveReport(filters: {
        regionId?: string;
        branchName?: string;
        kpoId?: string;
        startDate?: Date;
        endDate?: Date;
    }): Promise<any> {
        try {
            console.log('getComprehensiveReport: Generating report with filters:', filters);
            
            // Get all orders based on filters
            let allOrders: any[] = [];
            const allOrdersSnap = await getDocs(query(collections.orders, orderBy("createdAt", "desc")));
            allOrders = allOrdersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Apply date filter
            if (filters.startDate || filters.endDate) {
                const startTime = filters.startDate ? new Date(filters.startDate).getTime() : 0;
                const endTime = filters.endDate ? new Date(filters.endDate).getTime() : Date.now();
                
                allOrders = allOrders.filter(order => {
                    const orderTime = order.createdAt?.toDate ? order.createdAt.toDate().getTime() : 
                                   order.createdAt?.seconds ? order.createdAt.seconds * 1000 :
                                   new Date(order.createdAt || 0).getTime();
                    return orderTime >= startTime && orderTime <= endTime;
                });
            }

            // Get all users for filtering
            const allUsersSnap = await getDocs(collections.users);
            const allUsers = allUsersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Filter by KPO
            if (filters.kpoId) {
                const kpo = allUsers.find(u => u.id === filters.kpoId);
                if (kpo?.branch) {
                    const bookers = await this.getBranchBookers(kpo.branch);
                    const bookerIds = bookers.map(b => b.id);
                    allOrders = allOrders.filter(order => bookerIds.includes(order.bookerId));
                }
            }

            // Filter by branch
            if (filters.branchName && !filters.kpoId) {
                const bookers = await this.getBranchBookers(filters.branchName);
                const bookerIds = bookers.map(b => b.id);
                allOrders = allOrders.filter(order => bookerIds.includes(order.bookerId));
            }

            // Filter by region
            if (filters.regionId && !filters.branchName && !filters.kpoId) {
                const branches = await this.getBranches(filters.regionId);
                const branchNames = branches.map(b => b.name);
                const allBookers = await Promise.all(branchNames.map(b => this.getBranchBookers(b)));
                const bookerIds = allBookers.flat().map(b => b.id);
                allOrders = allOrders.filter(order => bookerIds.includes(order.bookerId));
            }

            // Calculate statistics
            const deliveredOrders = allOrders.filter(o => o.status === 'delivered');
            const totalSales = deliveredOrders.reduce((sum, order) => {
                return sum + parseFloat(String(order.grandTotal || order.totalAmount || 0));
            }, 0);

            const totalCash = deliveredOrders.reduce((sum, order) => {
                return sum + parseFloat(String(order.cashAmount || 0));
            }, 0);

            const totalCredit = deliveredOrders.reduce((sum, order) => {
                return sum + parseFloat(String(order.creditAmount || 0));
            }, 0);

            const totalDiscount = allOrders.reduce((sum, order) => {
                return sum + parseFloat(String(order.totalDiscount || 0));
            }, 0);

            const unauthorizedDiscounts = allOrders.filter(o => (o.unauthorizedDiscount || 0) > 0);
            const totalUnauthorizedDiscount = unauthorizedDiscounts.reduce((sum, order) => {
                return sum + parseFloat(String(order.unauthorizedDiscount || 0));
            }, 0);

            // Get unique bookers and salesmen
            const bookerIds = [...new Set(allOrders.map(o => o.bookerId).filter(Boolean))];
            const bookers = allUsers.filter(u => bookerIds.includes(u.id));

            // Get KPOs involved
            const kpoIds = [...new Set(allOrders.map(o => o.finalizedBy).filter(Boolean))];
            const kpos = allUsers.filter(u => kpoIds.includes(u.id));

            return {
                summary: {
                    totalOrders: allOrders.length,
                    deliveredOrders: deliveredOrders.length,
                    pendingOrders: allOrders.filter(o => o.status === 'submitted' || o.status === 'finalized').length,
                    totalSales,
                    totalCash,
                    totalCredit,
                    totalDiscount,
                    totalUnauthorizedDiscount,
                    averageOrderValue: deliveredOrders.length > 0 ? totalSales / deliveredOrders.length : 0,
                    deliveryRate: allOrders.length > 0 ? (deliveredOrders.length / allOrders.length) * 100 : 0
                },
                orders: allOrders,
                bookers: bookers,
                kpos: kpos,
                dateRange: {
                    start: filters.startDate || null,
                    end: filters.endDate || null
                }
            };
        } catch (error: any) {
            console.error("Firestore Error [getComprehensiveReport]:", error.message);
            return {
                summary: {
                    totalOrders: 0,
                    deliveredOrders: 0,
                    pendingOrders: 0,
                    totalSales: 0,
                    totalCash: 0,
                    totalCredit: 0,
                    totalDiscount: 0,
                    totalUnauthorizedDiscount: 0,
                    averageOrderValue: 0,
                    deliveryRate: 0
                },
                orders: [],
                bookers: [],
                kpos: [],
                dateRange: { start: null, end: null }
            };
        }
    },

    /**
     * Get branch report data for KPO
     */
    async getBranchReport(branchName: string, filters?: {
        startDate?: Date;
        endDate?: Date;
    }): Promise<any> {
        try {
            console.log('getBranchReport: Generating report for branch:', branchName);
            
            const dateRange = filters?.startDate && filters?.endDate ? {
                start: filters.startDate,
                end: filters.endDate
            } : undefined;

            const orders = await this.getBranchOrders(branchName, dateRange);
            const bookers = await this.getBranchBookers(branchName);
            const salesmen = await this.getBranchSalesmen(branchName);

            const deliveredOrders = orders.filter(o => o.status === 'delivered');
            const totalSales = deliveredOrders.reduce((sum, order) => {
                return sum + parseFloat(String(order.grandTotal || order.totalAmount || 0));
            }, 0);

            const totalCash = deliveredOrders.reduce((sum, order) => {
                return sum + parseFloat(String(order.cashAmount || 0));
            }, 0);

            const totalCredit = deliveredOrders.reduce((sum, order) => {
                return sum + parseFloat(String(order.creditAmount || 0));
            }, 0);

            // Get booker performance
            const bookerPerformance = bookers.map(booker => {
                const bookerOrders = orders.filter(o => o.bookerId === booker.id);
                const bookerDelivered = bookerOrders.filter(o => o.status === 'delivered');
                const bookerSales = bookerDelivered.reduce((sum, order) => {
                    return sum + parseFloat(String(order.grandTotal || order.totalAmount || 0));
                }, 0);

                return {
                    bookerId: booker.id,
                    bookerName: booker.name,
                    totalOrders: bookerOrders.length,
                    deliveredOrders: bookerDelivered.length,
                    totalSales: bookerSales,
                    averageOrderValue: bookerDelivered.length > 0 ? bookerSales / bookerDelivered.length : 0
                };
            });

            return {
                branchName,
                summary: {
                    totalOrders: orders.length,
                    deliveredOrders: deliveredOrders.length,
                    pendingOrders: orders.filter(o => o.status === 'submitted' || o.status === 'finalized').length,
                    totalSales,
                    totalCash,
                    totalCredit,
                    totalBookers: bookers.length,
                    totalSalesmen: salesmen.length,
                    averageOrderValue: deliveredOrders.length > 0 ? totalSales / deliveredOrders.length : 0,
                    deliveryRate: orders.length > 0 ? (deliveredOrders.length / orders.length) * 100 : 0
                },
                orders,
                bookers,
                salesmen,
                bookerPerformance,
                dateRange: {
                    start: filters?.startDate || null,
                    end: filters?.endDate || null
                }
            };
        } catch (error: any) {
            console.error("Firestore Error [getBranchReport]:", error.message);
            return {
                branchName,
                summary: {
                    totalOrders: 0,
                    deliveredOrders: 0,
                    pendingOrders: 0,
                    totalSales: 0,
                    totalCash: 0,
                    totalCredit: 0,
                    totalBookers: 0,
                    totalSalesmen: 0,
                    averageOrderValue: 0,
                    deliveryRate: 0
                },
                orders: [],
                bookers: [],
                salesmen: [],
                bookerPerformance: [],
                dateRange: { start: null, end: null }
            };
        }
    },

    // Bills & Credits
    async getBillsByBranch(branch: string) {
        try {
            const snapshot = await getDocs(
                query(
                    collections.bills,
                    where('branch', '==', branch),
                    orderBy('billedAt', 'desc')
                )
            );
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error: any) {
            console.error("Firestore Error [getBillsByBranch]:", error.message);
            return [];
        }
    },

    async getBillsByBooker(bookerId: string, dateRange?: DateRange) {
        try {
            let q = query(
                collections.bills,
                where('bookerId', '==', bookerId),
                orderBy('billedAt', 'desc')
            );

            if (dateRange?.start && dateRange?.end) {
                q = query(
                    collections.bills,
                    where('bookerId', '==', bookerId),
                    where('billedAt', '>=', dateRange.start),
                    where('billedAt', '<=', dateRange.end),
                    orderBy('billedAt', 'desc')
                );
            }

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error: any) {
            console.error("Firestore Error [getBillsByBooker]:", error.message);
            return [];
        }
    },

    async getCreditsByBooker(bookerId: string) {
        try {
            const snapshot = await getDocs(
                query(
                    collections.bills,
                    where('bookerId', '==', bookerId),
                    where('remainingCredit', '>', 0),
                    orderBy('remainingCredit', 'desc')
                )
            );
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error: any) {
            console.error("Firestore Error [getCreditsByBooker]:", error.message);
            return [];
        }
    },

    async getTotalCreditsSummary(branch?: string) {
        try {
            let q = query(
                collections.bills,
                where('remainingCredit', '>', 0),
                orderBy('remainingCredit', 'desc')
            );

            if (branch) {
                q = query(
                    collections.bills,
                    where('branch', '==', branch),
                    where('remainingCredit', '>', 0),
                    orderBy('remainingCredit', 'desc')
                );
            }

            const snapshot = await getDocs(q);
            const bills = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Group by booker
            const bookerMap = new Map<string, { bookerId: string; bookerName: string; totalCredit: number; billCount: number }>();
            
            bills.forEach((bill: any) => {
                const bookerId = bill.bookerId || 'unknown';
                const bookerName = bill.bookerName || 'Unknown Booker';
                
                if (!bookerMap.has(bookerId)) {
                    bookerMap.set(bookerId, {
                        bookerId,
                        bookerName,
                        totalCredit: 0,
                        billCount: 0,
                    });
                }
                
                const summary = bookerMap.get(bookerId)!;
                summary.totalCredit += bill.remainingCredit || 0;
                summary.billCount++;
            });

            return {
                totalCredits: bills.reduce((sum, b: any) => sum + (b.remainingCredit || 0), 0),
                totalBills: bills.length,
                bookerSummaries: Array.from(bookerMap.values()).sort((a, b) => b.totalCredit - a.totalCredit),
            };
        } catch (error: any) {
            console.error("Firestore Error [getTotalCreditsSummary]:", error.message);
            return {
                totalCredits: 0,
                totalBills: 0,
                bookerSummaries: [],
            };
        }
    },

    /**
     * Get global credits summary across all branches (for admin dashboard)
     */
    async getGlobalCreditsSummary() {
        try {
            // Use getTotalCreditsSummary without branch parameter to get all credits
            return await this.getTotalCreditsSummary();
        } catch (error: any) {
            console.error("Firestore Error [getGlobalCreditsSummary]:", error.message);
            return {
                totalCredits: 0,
                totalBills: 0,
                bookerSummaries: [],
            };
        }
    },

    async getSalesmanPendingCredits(salesmanId: string) {
        try {
            const snapshot = await getDocs(
                query(
                    collections.bills,
                    where('salesmanId', '==', salesmanId),
                    where('remainingCredit', '>', 0),
                    orderBy('billedAt', 'desc')
                )
            );
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error: any) {
            console.error("Firestore Error [getSalesmanPendingCredits]:", error.message);
            return [];
        }
    },

    /**
     * Create or update salesman-booker mapping
     */
    async createOrUpdateMapping(salesmanId: string, salesmanName: string, bookerIds: string[], regionId: string, createdBy: string): Promise<string> {
        try {
            // Get booker names for display
            const allUsers = await this.getAllUsers();
            const bookerNames = bookerIds
                .map(id => {
                    const booker = allUsers.find(u => u.id === id);
                    return booker?.name || 'Unknown';
                })
                .filter(Boolean);

            // Check if mapping already exists for this salesman
            const mappingsCollection = collection(db, 'mappings');
            const existingMappingQuery = query(
                mappingsCollection,
                where('salesmanId', '==', salesmanId),
                where('isActive', '==', true)
            );

            const mappingSnapshot = await getDocs(existingMappingQuery);

            const now = new Date().toISOString();
            const mappingData: any = {
                salesmanId,
                salesmanName,
                bookerIds,
                bookerNames,
                regionId,
                isActive: true,
                updatedAt: now,
            };

            if (mappingSnapshot.empty) {
                // Create new mapping
                const docRef = await addDoc(mappingsCollection, {
                    ...mappingData,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
                await this.logActivity(createdBy, `Created mapping for salesman: ${salesmanName} with ${bookerIds.length} booker(s)`);
                return docRef.id;
            } else {
                // Update existing mapping
                const existingDoc = mappingSnapshot.docs[0];
                await updateDoc(doc(db, 'mappings', existingDoc.id), {
                    ...mappingData,
                    updatedAt: serverTimestamp(),
                });
                await this.logActivity(createdBy, `Updated mapping for salesman: ${salesmanName} with ${bookerIds.length} booker(s)`);
                return existingDoc.id;
            }
        } catch (error: any) {
            console.error("Firestore Error [createOrUpdateMapping]:", error);
            throw new Error(`Failed to save mapping: ${error.message}`);
        }
    },

    /**
     * Get mapping for a salesman
     */
    async getMappingForSalesman(salesmanId: string): Promise<any | null> {
        try {
            const mappingsCollection = collection(db, 'mappings');
            const mappingQuery = query(
                mappingsCollection,
                where('salesmanId', '==', salesmanId),
                where('isActive', '==', true)
            );

            const snapshot = await getDocs(mappingQuery);
            if (snapshot.empty) {
                return null;
            }

            const mappingDoc = snapshot.docs[0];
            return { id: mappingDoc.id, ...mappingDoc.data() };
        } catch (error: any) {
            console.error("Firestore Error [getMappingForSalesman]:", error);
            return null;
        }
    }
};
