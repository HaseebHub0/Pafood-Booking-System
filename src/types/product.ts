export type ProductCategory = 'nimco' | 'snacks' | 'peanuts' | 'sweets' | 'bulk' | 'other';

export interface Product {
  id: string;
  name: string;        // Urdu name
  nameEn: string;      // English name
  sku: string;
  category: ProductCategory;
  unit: string;        // Pcs, 1 Kg, 5 Kg, 250 Gram, etc.
  price: number;
  maxDiscount: number;
  image: string;
  isActive: boolean;
}
