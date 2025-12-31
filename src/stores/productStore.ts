import { create } from 'zustand';
import { Product, ProductCategory } from '../types';
import { storage, STORAGE_KEYS } from '../services/storage/asyncStorage';

interface ProductState {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  selectedCategory: ProductCategory | 'all';
}

interface ProductActions {
  loadProducts: () => Promise<void>;
  setSelectedCategory: (category: ProductCategory | 'all') => void;
  getProductById: (id: string) => Product | undefined;
  searchProducts: (query: string) => Product[];
  getFilteredProducts: () => Product[];
}

type ProductStore = ProductState & ProductActions;

export const useProductStore = create<ProductStore>((set, get) => ({
  // Initial state
  products: [],
  isLoading: false,
  error: null,
  selectedCategory: 'all',

  // Actions
  loadProducts: async () => {
    set({ isLoading: true, error: null });

    try {
      // Try Firebase first
      try {
        const { firestoreService } = await import('../services/firebase');
        const { COLLECTIONS } = await import('../services/firebase/collections');
        
        const productsList = await firestoreService.getDocs<Product>(COLLECTIONS.PRODUCTS);

        // Update local storage cache
        await storage.set(STORAGE_KEYS.PRODUCTS, productsList);
        set({ products: productsList, isLoading: false });
      } catch (firebaseError) {
        console.warn('Firebase load failed, trying local storage:', firebaseError);
        
        // Fallback to local storage
        const storedProducts = await storage.get<Product[]>(STORAGE_KEYS.PRODUCTS);
        const productsList = storedProducts || [];
        set({ products: productsList, isLoading: false });
      }
    } catch (error) {
      set({
        error: 'Failed to load products',
        isLoading: false,
      });
    }
  },

  setSelectedCategory: (category: ProductCategory | 'all') => {
    set({ selectedCategory: category });
  },

  getProductById: (id: string) => {
    return get().products.find((product) => product.id === id);
  },

  searchProducts: (query: string) => {
    const { products, selectedCategory } = get();
    const lowerQuery = query.toLowerCase();

    return products.filter((product) => {
      const matchesQuery =
        product.name.toLowerCase().includes(lowerQuery) ||
        product.sku.toLowerCase().includes(lowerQuery);

      const matchesCategory =
        selectedCategory === 'all' || product.category === selectedCategory;

      return matchesQuery && matchesCategory && product.isActive;
    });
  },

  getFilteredProducts: () => {
    const { products, selectedCategory } = get();

    if (selectedCategory === 'all') {
      return products.filter((p) => p.isActive);
    }

    return products.filter(
      (product) => product.category === selectedCategory && product.isActive
    );
  },
}));

