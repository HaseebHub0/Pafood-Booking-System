import { BaseEntity } from './common';

export interface SalesmanBookerMapping extends BaseEntity {
  id: string;
  salesmanId: string;
  salesmanName: string;
  bookerIds: string[]; // One salesman can serve multiple bookers
  bookerNames?: string[]; // For display purposes
  regionId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MappingFormData {
  salesmanId: string;
  bookerIds: string[];
  regionId: string;
}

