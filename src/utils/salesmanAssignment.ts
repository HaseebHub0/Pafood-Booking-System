/**
 * Utility function to find salesman by branch
 * Finds a salesman in the same region and branch as the shop
 */

export interface SalesmanAssignment {
  salesmanId: string;
  salesmanName: string;
}

/**
 * Finds a salesman in the same branch as the shop
 * Uses branch-based matching (preferred) or falls back to area-based matching
 * @param shopBranch - The branch of the shop (preferred)
 * @param shopArea - The area of the shop (fallback if branch not available)
 * @param regionId - The region ID
 * @returns Salesman assignment or null if not found
 */
export async function findSalesmanByArea(
  shopBranch: string | undefined,
  shopArea: string | undefined,
  regionId: string
): Promise<SalesmanAssignment | null> {
  try {
    const { firestoreService } = await import('../services/firebase');
    const { COLLECTIONS } = await import('../services/firebase/collections');

    if (!regionId) {
      console.warn('findSalesmanByArea: Missing regionId');
      return null;
    }

    // Get all salesmen in the same region
    const salesmen = await firestoreService.getDocsWhere<any>(
      COLLECTIONS.USERS,
      'regionId',
      '==',
      regionId
    );

    // Filter by role
    const allSalesmen = salesmen.filter(
      (user: any) => user.role?.toLowerCase() === 'salesman'
    );

    if (allSalesmen.length === 0) {
      console.warn(
        `findSalesmanByArea: No salesman found in region ${regionId}`
      );
      return null;
    }

    // Priority 1: Match by branch (if shop has branch)
    if (shopBranch) {
      const branchMatchSalesmen = allSalesmen.filter((user: any) => {
        const userBranch = user.branch || user.area; // Support both branch and area fields
        return userBranch?.toLowerCase() === shopBranch.toLowerCase();
      });

      if (branchMatchSalesmen.length > 0) {
        const salesman = branchMatchSalesmen[0];
        console.log(
          `findSalesmanByArea: Found salesman by branch match: ${salesman.name || salesman.id}`
        );
        return {
          salesmanId: salesman.id,
          salesmanName: salesman.name || salesman.email || 'Unknown Salesman',
        };
      }
    }

    // Priority 2: Match by area (if shop has area but no branch match)
    if (shopArea) {
      const areaMatchSalesmen = allSalesmen.filter((user: any) => {
        const userArea = user.area || user.branch; // Support both area and branch fields
        return userArea?.toLowerCase() === shopArea.toLowerCase();
      });

      if (areaMatchSalesmen.length > 0) {
        const salesman = areaMatchSalesmen[0];
        console.log(
          `findSalesmanByArea: Found salesman by area match: ${salesman.name || salesman.id}`
      );
      return {
        salesmanId: salesman.id,
        salesmanName: salesman.name || salesman.email || 'Unknown Salesman',
      };
      }
    }

    // Fallback: Get first available salesman in region (same branch/area matching not required)
    const salesman = allSalesmen[0];
    console.warn(
      `findSalesmanByArea: No exact branch/area match found, using first available salesman in region: ${salesman.name || salesman.id}`
    );
    return {
      salesmanId: salesman.id,
      salesmanName: salesman.name || salesman.email || 'Unknown Salesman',
    };
  } catch (error) {
    console.error('Error finding salesman by area:', error);
    return null;
  }
}
