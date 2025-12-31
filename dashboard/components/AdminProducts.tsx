import React, { useState, useEffect } from 'react';
import { Product, View } from '../types';
import { dataService } from '../dataService';

interface AdminProductsProps {
    onNavigate: (view: View, id?: string) => void;
}

const AdminProducts: React.FC<AdminProductsProps> = ({ onNavigate }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
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
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const loadProducts = async () => {
            try {
                setIsLoading(true);
                setError(null);
                console.log('AdminProducts: Fetching products...');
                const productsData = await dataService.getAllProducts();
                console.log('AdminProducts: Products fetched:', productsData.length);
                setProducts(productsData);
            } catch (err: any) {
                console.error('AdminProducts: Error loading products:', err);
                setError(err.message || 'Failed to load products');
            } finally {
                setIsLoading(false);
            }
        };
        loadProducts();
    }, []);

    const handleAddProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.name || !formData.sku || !formData.price || !formData.minPrice) {
            setError('Please fill all required fields');
            return;
        }

        try {
            setIsSubmitting(true);
            setError(null);

            const productData: Omit<Product, 'id'> = {
                name: formData.name,
                sku: formData.sku,
                category: formData.category || 'General',
                price: formData.price,
                minPrice: formData.minPrice,
                discountPolicy: formData.discountPolicy || '',
                stock: formData.stock || 0,
                status: formData.status
            };

            await dataService.addProduct(productData);
            
            // Reset form
            setFormData({
                name: '',
                sku: '',
                category: '',
                price: '',
                minPrice: '',
                discountPolicy: '',
                stock: 0,
                status: 'In Stock'
            });
            setIsAdding(false);
            
            // Reload products
            const productsData = await dataService.getAllProducts();
            setProducts(productsData);
            
            alert('Product added successfully!');
        } catch (err: any) {
            console.error('Error adding product:', err);
            setError(err.message || 'Failed to add product');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteProduct = async (productId: string, productName: string) => {
        if (!window.confirm(`Are you sure you want to delete "${productName}"?\n\nThis action cannot be undone.`)) {
            return;
        }

        try {
            setIsDeleting(productId);
            setError(null);
            
            await dataService.deleteProduct(productId);
            
            // Reload products
            const productsData = await dataService.getAllProducts();
            setProducts(productsData);
            
            alert('Product deleted successfully!');
        } catch (err: any) {
            console.error('Error deleting product:', err);
            setError(err.message || 'Failed to delete product');
        } finally {
            setIsDeleting(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Price & Policy Control</h2>
                    <p className="text-slate-500 text-sm">Define floor prices and unauthorized discount barriers.</p>
                </div>
                <button 
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white hover:bg-red-700 transition-all shadow-lg shadow-primary/20"
                >
                    <span className="material-symbols-outlined">{isAdding ? 'close' : 'add_box'}</span>
                    <span>{isAdding ? 'Cancel' : 'New SKU'}</span>
                </button>
            </div>

            {error && (
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                        Error: {error}
                    </p>
                </div>
            )}

            {/* Add Product Form */}
            {isAdding && (
                <div className="glass-panel rounded-2xl p-6 bg-white border-l-4 border-l-primary animate-in fade-in slide-in-from-top-4">
                    <div className="flex justify-between items-start mb-6">
                        <h3 className="text-lg font-bold text-slate-900">Add New Product</h3>
                        <button 
                            onClick={() => {
                                setIsAdding(false);
                                setFormData({
                                    name: '',
                                    sku: '',
                                    category: '',
                                    price: '',
                                    minPrice: '',
                                    discountPolicy: '',
                                    stock: 0,
                                    status: 'In Stock'
                                });
                                setError(null);
                            }}
                            className="text-slate-400 hover:text-slate-600"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    
                    <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2 space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">Product Name *</label>
                            <input 
                                required
                                type="text" 
                                className="w-full rounded-xl bg-slate-50 border-slate-200 p-3 text-slate-900 focus:ring-primary focus:border-primary"
                                placeholder="e.g. Pak Cola 1.5L"
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">SKU Code *</label>
                            <input 
                                required
                                type="text" 
                                className="w-full rounded-xl bg-slate-50 border-slate-200 p-3 text-slate-900 focus:ring-primary focus:border-primary"
                                placeholder="e.g. bev-cola-1.5"
                                value={formData.sku}
                                onChange={e => setFormData({...formData, sku: e.target.value})}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">Category</label>
                            <input 
                                type="text" 
                                className="w-full rounded-xl bg-slate-50 border-slate-200 p-3 text-slate-900 focus:ring-primary focus:border-primary"
                                placeholder="e.g. Beverages"
                                value={formData.category}
                                onChange={e => setFormData({...formData, category: e.target.value})}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">Standard Price (PKR) *</label>
                            <input 
                                required
                                type="text" 
                                className="w-full rounded-xl bg-slate-50 border-slate-200 p-3 text-slate-900 focus:ring-primary focus:border-primary"
                                placeholder="e.g. 220"
                                value={formData.price}
                                onChange={e => setFormData({...formData, price: e.target.value})}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">Minimum Floor Price (PKR) *</label>
                            <input 
                                required
                                type="text" 
                                className="w-full rounded-xl bg-red-50 border-red-200 p-3 text-slate-900 focus:ring-red-400 focus:border-red-400"
                                placeholder="e.g. 210"
                                value={formData.minPrice}
                                onChange={e => setFormData({...formData, minPrice: e.target.value})}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">Stock Available</label>
                            <input 
                                type="number" 
                                min="0"
                                className="w-full rounded-xl bg-slate-50 border-slate-200 p-3 text-slate-900 focus:ring-primary focus:border-primary"
                                value={formData.stock}
                                onChange={e => setFormData({...formData, stock: parseInt(e.target.value) || 0})}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">Status</label>
                            <select 
                                className="w-full rounded-xl bg-slate-50 border-slate-200 p-3 text-slate-900 focus:ring-primary focus:border-primary"
                                value={formData.status}
                                onChange={e => setFormData({...formData, status: e.target.value as 'In Stock' | 'Low Stock' | 'Out of Stock'})}
                            >
                                <option value="In Stock">In Stock</option>
                                <option value="Low Stock">Low Stock</option>
                                <option value="Out of Stock">Out of Stock</option>
                            </select>
                                </div>

                        <div className="md:col-span-2 space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">Discount Policy</label>
                            <textarea 
                                className="w-full rounded-xl bg-slate-50 border-slate-200 p-3 text-slate-900 focus:ring-primary focus:border-primary"
                                rows={3}
                                value={formData.discountPolicy}
                                onChange={e => setFormData({...formData, discountPolicy: e.target.value})}
                                placeholder="e.g. Max 5% Bulk Discount"
                            />
                            </div>

                        <div className="md:col-span-2 flex justify-end gap-3 pt-4">
                            <button 
                                type="button" 
                                onClick={() => {
                                    setIsAdding(false);
                                    setFormData({
                                        name: '',
                                        sku: '',
                                        category: '',
                                        price: '',
                                        minPrice: '',
                                        discountPolicy: '',
                                        stock: 0,
                                        status: 'In Stock'
                                    });
                                    setError(null);
                                }}
                                disabled={isSubmitting}
                                className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="px-6 py-3 rounded-xl bg-primary text-white font-bold hover:bg-red-700 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? 'Adding...' : 'Add Product'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {isLoading ? (
                <div className="glass-panel bg-white rounded-xl overflow-hidden border border-slate-200">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">SKU</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Product Name</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Category</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Price</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Min Price</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Stock</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {Array.from({ length: 5 }).map((_, idx) => (
                                <tr key={idx} className="animate-pulse">
                                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
                                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-12"></div></td>
                                    <td className="px-4 py-3"><div className="h-5 bg-slate-200 rounded-full w-16"></div></td>
                                    <td className="px-4 py-3 text-right"><div className="h-6 bg-slate-200 rounded w-20 ml-auto"></div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : products.length === 0 ? (
                <div className="p-12 flex items-center justify-center text-slate-400">
                    <div className="text-center">
                        <span className="material-symbols-outlined text-4xl mb-2">inventory_2</span>
                        <p className="text-sm">No products found</p>
                        <p className="text-xs mt-2">Add your first product to get started</p>
                    </div>
                </div>
            ) : (
                <div className="glass-panel bg-white rounded-xl overflow-hidden border border-slate-200">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-600 uppercase">SKU</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-600 uppercase">Product Name</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-600 uppercase">Category</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-600 uppercase">Price</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-600 uppercase">Min Price</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-600 uppercase">Stock</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-600 uppercase">Status</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-600 uppercase">Policy</th>
                                    <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-600 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                    {products.map((p) => (
                                    <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-4 py-2.5">
                                            <span className="text-xs font-mono text-slate-600">{p.sku || 'N/A'}</span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className="text-sm font-bold text-slate-900">{p.name}</span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className="text-xs text-slate-600">{p.category || '-'}</span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className="text-sm font-bold text-slate-900">PKR {p.price || '0'}</span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className="text-sm font-bold text-red-600">PKR {p.minPrice || p.price || '0'}</span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className="text-xs font-medium text-slate-700">{p.stock || 0}</span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                                p.status === 'In Stock' ? 'bg-green-50 text-green-600 border-green-100' : 
                                                p.status === 'Low Stock' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                                                'bg-red-50 text-red-600 border-red-100'
                                }`}>
                                    {p.status || 'In Stock'}
                                </span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className="text-xs text-slate-600 max-w-xs truncate block" title={p.discountPolicy || 'No policy'}>
                                                {p.discountPolicy || '-'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center justify-end gap-2">
                                <button 
                                    onClick={() => onNavigate('ADMIN_EDIT_PRODUCT', p.id)}
                                                    className="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                                >
                                                    Edit
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteProduct(p.id, p.name)}
                                                    disabled={isDeleting === p.id}
                                                    className="px-3 py-1.5 rounded-md bg-red-50 text-xs font-bold text-red-600 hover:bg-red-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isDeleting === p.id ? '...' : 'Delete'}
                                </button>
                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                </div>
            )}
        </div>
    );
};

export default AdminProducts;
