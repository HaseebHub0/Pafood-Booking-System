import { BaseEntity } from './common';

export type RegionLevel = 'region' | 'area' | 'subarea';

export interface Region extends BaseEntity {
  id: string;
  name: string;
  parentId?: string; // For hierarchical structure (area has region as parent, subarea has area as parent)
  level: RegionLevel;
  isActive: boolean;
  code?: string; // Optional region code for quick reference
  description?: string;
}

export interface RegionFormData {
  name: string;
  parentId?: string;
  level: RegionLevel;
  code?: string;
  description?: string;
}

