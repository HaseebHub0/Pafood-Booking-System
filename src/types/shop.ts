import { BaseEntity } from './common';

export interface Shop extends BaseEntity {
  shopId: string;              // Manual Shop ID (required by client)
  shopName: string;
  ownerName: string;
  phone: string;
  address: string;
  area: string;
  city: string;
  bookerId: string;
  bookerName?: string;  // Admin tracking: who created this shop
  regionId: string; // Inherited from booker
  branch?: string; // Branch assignment (inherited from booker)
  isActive: boolean;
  // Credit fields removed - Cash-only system
}

export interface ShopFormData {
  shopId: string;             // Manual Shop ID (required by client)
  shopName: string;
  ownerName: string;
  phone: string;
  address: string;
  area: string;
  city: string;
  // creditLimit removed - Cash-only system
}

export type ShopCreateInput = Omit<Shop, keyof BaseEntity | 'bookerId' | 'isActive'>;

