import React, { useState, useEffect } from 'react';
import { View, Product } from '../types';
import { dataService } from '../dataService';

interface AdminEditProductProps {
    onNavigate: (view: View) => void;
    productId: string | null;
}

const AdminEditProduct: React.FC<AdminEditProductProps> = ({ onNavigate, productId }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        category: '',
        price: '',
        minPrice: '',
        discountPolicy: '',
        stock: 0,
        status: 'In Stock' as 'In Stock' | 'Low Stock' | 'Out of Stock'
    });

    useEffect(() => {
        const loadProduct = async () => {
            if (!productId) {
                setError('No product ID provided');
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                setError(null);
                const product = await dataService.getProductById(productId);
                
                if (product) {
                    setFormData({
                        name: product.name || '',
                        sku: product.sku || '',
                        category: product.category || '',
                        price: product.price || '',
                        minPrice: product.minPrice || product.price || '',
                        discountPolicy: product.discountPolicy || '',
                        stock: product.stock || 0,
                        status: product.status || 'In Stock'
                    });
                } else {
                    setError('Product not found');
                }
            } catch (err: any) {
                console.error('Error loading product:', err);
                setError(err.message || 'Failed to load product');
            } finally {
                setIsLoading(false);
            }
        };

        loadProduct();
    }, [productId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!productId) {
            setError('No product ID provided');
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            await dataService.updateProduct(productId, {
                name: formData.name,
                sku: formData.sku,
                category: formData.category,
                price: formData.price,
                minPrice: formData.minPrice,
                discountPolicy: formData.discountPolicy,
                stock: formData.stock,
                status: formData.status
            } as Partial<Product>);

            alert(`Product "${formData.name}" updated successfully!`);
            onNavigate('ADMIN_PRODUCTS');
        } catch (err: any) {
            console.error('Error updating product:', err);
            setError(err.message || 'Failed to update product');
        } finally {
            setIsLoading(false);
        }
    };

    if (!productId) {
        return (
            <div className="max-w-3xl mx-auto space-y-8">
                <div className="rounded-xl bg-red-50 p-4 border border-red-200">
                    <p className="text-red-800">Error: No product selected</p>
                </div>
            </div>
        );
    }

    if (isLoading && !formData.name) {
        return (
            <div className="max-w-3xl mx-auto space-y-8">
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => onNavigate('ADMIN_PRODUCTS')}
                    className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h2 className="text-3xl font-bold text-slate-900 drop-shadow-sm">Edit Product: {formData.name || productId}</h2>
            </div>

            {error && (
                <div className="rounded-xl bg-red-50 p-4 border border-red-200">
                    <p className="text-red-800 font-medium">{error}</p>
                </div>
            )}

            <div className="glass-panel rounded-2xl p-8 bg-white/90">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2 space-y-2">
                            <label className="text-sm font-medium text-slate-600">Product Name</label>
                            <input 
                                type="text" 
                                required
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                placeholder="e.g. Pak Cola 1.5L"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600">SKU Code</label>
                            <input 
                                type="text" 
                                required
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                value={formData.sku}
                                onChange={e => setFormData({...formData, sku: e.target.value})}
                                placeholder="e.g. bev-cola-1.5"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600">Category</label>
                            <input 
                                type="text" 
                                required
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                value={formData.category}
                                onChange={e => setFormData({...formData, category: e.target.value})}
                                placeholder="e.g. Beverages"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600">Standard Price (PKR)</label>
                            <input 
                                type="text" 
                                required
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                value={formData.price}
                                onChange={e => setFormData({...formData, price: e.target.value})}
                                placeholder="e.g. 220"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600">Minimum Floor Price (PKR)</label>
                            <input 
                                type="text" 
                                required
                                className="w-full rounded-xl border border-red-200 bg-red-50/30 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-red-400 focus:ring-1 focus:ring-red-400 transition-all"
                                value={formData.minPrice}
                                onChange={e => setFormData({...formData, minPrice: e.target.value})}
                                placeholder="e.g. 210"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600">Stock Available</label>
                            <input 
                                type="number" 
                                required
                                min="0"
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                value={formData.stock}
                                onChange={e => setFormData({...formData, stock: parseInt(e.target.value) || 0})}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600">Status</label>
                            <select 
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                value={formData.status}
                                onChange={e => setFormData({...formData, status: e.target.value as 'In Stock' | 'Low Stock' | 'Out of Stock'})}
                            >
                                <option value="In Stock">In Stock</option>
                                <option value="Low Stock">Low Stock</option>
                                <option value="Out of Stock">Out of Stock</option>
                            </select>
                        </div>

                        <div className="md:col-span-2 space-y-2">
                            <label className="text-sm font-medium text-slate-600">Discount Policy</label>
                            <textarea 
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                rows={3}
                                value={formData.discountPolicy}
                                onChange={e => setFormData({...formData, discountPolicy: e.target.value})}
                                placeholder="e.g. Max 5% Bulk Discount"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button 
                            type="button"
                            onClick={() => onNavigate('ADMIN_PRODUCTS')}
                            className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={isLoading}
                            className="px-8 py-3 rounded-xl bg-primary text-white font-bold hover:bg-red-700 hover:scale-105 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Updating...' : 'Update Product'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminEditProduct;

