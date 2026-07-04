import React, { useState, useEffect } from 'react';
import { 
    getProducts, 
    saveProduct, 
    deleteProduct, 
    updateProductStock, 
    getCategories, 
    saveCategory, 
    deleteCategory,
    deleteProductsBulk,
    updateCategoryName
} from '../services/db';
import { t } from '../services/translations';

export default function Inventory({ showToast }) {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeMobileTab, setActiveMobileTab] = useState('list');

    // Dynamic Categories State
    const [newCategoryName, setNewCategoryName] = useState('');

    // Form Fields State
    const [id, setId] = useState('');
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState('stickers');
    const [stock, setStock] = useState('10');
    const [tag, setTag] = useState('');

    // Variations State
    const [hasVariations, setHasVariations] = useState(false);
    const [variationsList, setVariationsList] = useState([{ name: '', price: '', stock: '10', discount: '0' }]);

    // Table UI State
    const [expandedProductId, setExpandedProductId] = useState(null);

    // Restock Modal Target State
    const [restockTarget, setRestockTarget] = useState(null);
    const [restockAmount, setRestockAmount] = useState('10');

    // Bulk delete and Editing states
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [editingProduct, setEditingProduct] = useState(null);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const data = await getProducts();
            setProducts(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategoriesList = async () => {
        try {
            const data = await getCategories();
            setCategories(data);
            if (data.length > 0 && !data.includes(category)) {
                setCategory(data[0]);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const getCategoryAbbreviation = (cat) => {
        const presets = {
            stickers: "STK",
            keychains: "KCH",
            prints: "PRT",
            washi: "WSH"
        };
        if (presets[cat]) return presets[cat];
        return cat.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3).padEnd(3, 'X');
    };

    const generateNextId = (nameVal, catVal, currentProducts) => {
        const prefix = "KH-";
        const catAbbr = getCategoryAbbreviation(catVal);
        
        // Digit terakhir dari total karakter dari nama barang
        const cleanName = nameVal || '';
        const nameLenDigit = (cleanName.length % 10).toString();
        
        // Digit terakhir (angka satuan) dari hari, bulan, tanggal
        const now = new Date();
        const dayDigit = (now.getDay() % 10).toString(); // Day of week (0-6)
        const monthDigit = ((now.getMonth() + 1) % 10).toString(); // Month (1-12)
        const dateDigit = (now.getDate() % 10).toString(); // Date of month (1-31)
        
        const uniqueNumberPart = `${nameLenDigit}${dayDigit}${monthDigit}${dateDigit}`;
        
        // Filter products matching this prefix to get next sequence
        const matchingPrefix = `${prefix}${catAbbr}-${uniqueNumberPart}`;
        
        const catProducts = currentProducts.filter(p => p.id.startsWith(matchingPrefix));
        let maxNum = 0;
        catProducts.forEach(p => {
            const parts = p.id.split('-');
            const lastPart = parts[parts.length - 1];
            if (lastPart && !isNaN(lastPart)) {
                const num = parseInt(lastPart);
                if (num > maxNum) maxNum = num;
            }
        });
        
        const nextNum = maxNum + 1;
        const suffix = nextNum.toString().padStart(3, '0');
        return `${matchingPrefix}-${suffix}`;
    };

    useEffect(() => {
        if (!loading) {
            const nextId = generateNextId(name, category, products);
            setId(nextId);
        }
    }, [name, category, products, loading]);

    useEffect(() => {
        fetchProducts();
        fetchCategoriesList();
    }, []);

    // Category additions
    const handleAddCategorySubmit = async (e) => {
        e.preventDefault();
        const cleanName = newCategoryName.trim().toLowerCase();
        if (!cleanName) return;

        if (categories.includes(cleanName)) {
            showToast("Kategori tersebut sudah ada!", "⚠️");
            return;
        }

        try {
            await saveCategory(cleanName);
            showToast("Kategori baru berhasil ditambahkan!", "🎉");
            setNewCategoryName('');
            fetchCategoriesList();
        } catch (err) {
            showToast("Gagal menyimpan kategori", "⚠️");
        }
    };

    // Category deletion
    const handleDeleteCategory = async (catName) => {
        if (window.confirm(`Hapus kategori "${catName}"? Kategori produk yang terkait dengan kategori ini tidak akan otomatis berubah.`)) {
            try {
                await deleteCategory(catName);
                showToast("Kategori berhasil dihapus!", "🗑️");
                fetchCategoriesList();
            } catch (err) {
                showToast("Gagal menghapus kategori", "⚠️");
            }
        }
    };

    // Category editing
    const handleEditCategory = async (oldCatName) => {
        const newCatName = prompt(`Ubah nama kategori "${oldCatName}" menjadi:`, oldCatName);
        if (!newCatName) return;
        const cleanNew = newCatName.trim().toLowerCase();
        if (!cleanNew || cleanNew === oldCatName) return;

        if (categories.includes(cleanNew)) {
            showToast("Nama kategori tersebut sudah ada!", "⚠️");
            return;
        }

        try {
            await updateCategoryName(oldCatName, cleanNew);
            showToast("Kategori berhasil diperbarui!", "🎉");
            fetchCategoriesList();
            fetchProducts();
        } catch (err) {
            showToast("Gagal mengubah kategori", "⚠️");
        }
    };

    // Variations input rows handlers for ADD Product
    const handleAddVariationRow = () => {
        setVariationsList(prev => [...prev, { name: '', price: '', stock: '10' }]);
    };

    const handleRemoveVariationRow = (index) => {
        if (variationsList.length <= 1) return;
        setVariationsList(prev => prev.filter((_, i) => i !== index));
    };

    const handleVariationRowChange = (index, field, val) => {
        setVariationsList(prev => prev.map((item, idx) => {
            if (idx === index) {
                return { ...item, [field]: val };
            }
            return item;
        }));
    };

    // Add Product Form submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (categories.length === 0) {
            showToast("Harap tambah kategori terlebih dahulu!", "⚠️");
            return;
        }

        if (!id.trim() || !name.trim()) {
            showToast("Format input kode/nama salah!", "⚠️");
            return;
        }

        // Verify if ID already exists
        const exists = products.find(p => p.id.toUpperCase() === id.trim().toUpperCase());
        if (exists) {
            showToast("Kode barang sudah ada!", "⚠️");
            return;
        }

        let calculatedPrice = parseFloat(price);
        let calculatedStock = parseInt(stock);
        let finalVariations = [];

        if (hasVariations) {
            // Validate variations list
            const invalid = variationsList.some(v => !v.name.trim() || !v.price || isNaN(v.price) || parseFloat(v.price) <= 0 || !v.stock || isNaN(v.stock));
            if (invalid) {
                showToast("Semua baris variasi harus terisi secara valid!", "⚠️");
                return;
            }

            finalVariations = variationsList.map(v => ({
                name: v.name.trim(),
                price: parseFloat(v.price),
                stock: parseInt(v.stock),
                discount: parseFloat(v.discount || 0)
            }));

            // overall price defaults to first variation's price
            calculatedPrice = finalVariations[0].price;
            // overall stock is the sum of variations stock
            calculatedStock = finalVariations.reduce((sum, v) => sum + v.stock, 0);
        } else {
            if (!price || isNaN(price) || parseFloat(price) <= 0) {
                showToast(t.invalidPrice || "Format harga salah!", "⚠️");
                return;
            }
        }

        const newProd = {
            id,
            name,
            price: calculatedPrice,
            discount: 0,
            category,
            stock: calculatedStock,
            tag,
            img: 'assets/mascot.png', // Default placeholder mascot
            variations: finalVariations
        };

        try {
            await saveProduct(newProd);
            showToast(t.addSuccess || "Produk ditambahkan!", "🎉");
            
            // Reset form
            setId('');
            setName('');
            setPrice('');
            setTag('');
            setStock('10');
            setHasVariations(false);
            setVariationsList([{ name: '', price: '', stock: '10' }]);
            
            fetchProducts(); // Refresh table view
        } catch (err) {
            showToast("Gagal menyimpan produk", "⚠️");
        }
    };

    // Open Custom Restock Modal Target
    const handleRestockClick = (product, variationName = null) => {
        setRestockTarget({ product, variationName });
        setRestockAmount('10');
    };

    // Execute Custom Stock addition
    const handleRestockSubmit = async (e) => {
        e.preventDefault();
        const amount = parseInt(restockAmount);
        if (isNaN(amount) || amount <= 0) {
            showToast("Masukkan jumlah stok yang valid!", "⚠️");
            return;
        }

        const product = restockTarget.product;
        const variationName = restockTarget.variationName;

        let newStock;
        if (variationName && product.variations && product.variations.length > 0) {
            const variation = product.variations.find(v => v.name === variationName);
            newStock = variation ? variation.stock + amount : amount;
        } else {
            newStock = product.stock + amount;
        }

        try {
            await updateProductStock(product.id, newStock, variationName);
            showToast(`Stok "${product.name}${variationName ? ` (${variationName})` : ''}" berhasil ditambah (+${amount})!`, "📦");
            setRestockTarget(null);
            setRestockAmount('10');
            fetchProducts();
        } catch (err) {
            showToast("Gagal menambah stok", "⚠️");
        }
    };

    // Delete item
    const handleDelete = async (productId) => {
        if (window.confirm("Apakah Anda yakin ingin menghapus produk ini?")) {
            try {
                await deleteProduct(productId);
                showToast(t.deleteSuccess || "Produk dihapus!", "🗑️");
                // Clear from selection if deleted
                setSelectedProducts(prev => prev.filter(id => id !== productId));
                fetchProducts();
            } catch (err) {
                showToast("Gagal menghapus produk", "⚠️");
            }
        }
    };

    // Bulk Delete Action
    const handleBulkDelete = async () => {
        if (selectedProducts.length === 0) return;
        if (window.confirm(`Apakah Anda yakin ingin menghapus ${selectedProducts.length} produk terpilih?`)) {
            try {
                await deleteProductsBulk(selectedProducts);
                showToast(`${selectedProducts.length} produk berhasil dihapus!`, "🗑️");
                setSelectedProducts([]);
                fetchProducts();
            } catch (err) {
                showToast("Gagal menghapus produk secara massal", "⚠️");
            }
        }
    };

    // Edit Modal Opening and Operations
    const handleOpenEditModal = (product) => {
        setEditingProduct({
            id: product.id,
            name: product.name,
            category: product.category,
            price: product.price.toString(),
            discount: (product.discount || 0).toString(),
            stock: product.stock.toString(),
            tag: product.tag || '',
            hasVariations: product.variations && product.variations.length > 0,
            variationsList: product.variations && product.variations.length > 0 
                ? product.variations.map(v => ({ name: v.name, price: v.price.toString(), stock: v.stock.toString(), discount: (v.discount || 0).toString() })) 
                : [{ name: '', price: '', stock: '10', discount: '0' }]
        });
    };

    const handleEditVariationRowChange = (index, field, val) => {
        setEditingProduct(prev => {
            const updatedList = prev.variationsList.map((item, idx) => {
                if (idx === index) {
                    return { ...item, [field]: val };
                }
                return item;
            });
            return { ...prev, variationsList: updatedList };
        });
    };

    const handleAddEditVariationRow = () => {
        setEditingProduct(prev => ({
            ...prev,
            variationsList: [...prev.variationsList, { name: '', price: '', stock: '10', discount: '0' }]
        }));
    };

    const handleRemoveEditVariationRow = (index) => {
        setEditingProduct(prev => {
            if (prev.variationsList.length <= 1) return prev;
            return {
                ...prev,
                variationsList: prev.variationsList.filter((_, i) => i !== index)
            };
        });
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (!editingProduct.name.trim()) {
            showToast("Format input nama salah!", "⚠️");
            return;
        }

        let calculatedPrice = parseFloat(editingProduct.price);
        let calculatedStock = parseInt(editingProduct.stock);
        let finalVariations = [];

        if (editingProduct.hasVariations) {
            // Validate variations list
            const invalid = editingProduct.variationsList.some(v => !v.name.trim() || !v.price || isNaN(v.price) || parseFloat(v.price) <= 0 || !v.stock || isNaN(v.stock));
            if (invalid) {
                showToast("Semua baris variasi harus terisi secara valid!", "⚠️");
                return;
            }

            finalVariations = editingProduct.variationsList.map(v => ({
                name: v.name.trim(),
                price: parseFloat(v.price),
                stock: parseInt(v.stock),
                discount: parseFloat(v.discount || 0)
            }));

            calculatedPrice = finalVariations[0].price;
            calculatedStock = finalVariations.reduce((sum, v) => sum + v.stock, 0);
        } else {
            if (!editingProduct.price || isNaN(editingProduct.price) || parseFloat(editingProduct.price) <= 0) {
                showToast("Format harga salah!", "⚠️");
                return;
            }
        }

        const updatedProd = {
            id: editingProduct.id,
            name: editingProduct.name,
            price: calculatedPrice,
            discount: editingProduct.hasVariations ? 0 : parseFloat(editingProduct.discount || 0),
            category: editingProduct.category,
            stock: calculatedStock,
            tag: editingProduct.tag,
            img: 'assets/mascot.png', // Default placeholder mascot
            variations: finalVariations
        };

        try {
            await saveProduct(updatedProd);
            showToast("Produk berhasil diperbarui!", "🌸");
            setEditingProduct(null);
            fetchProducts(); // Refresh table view
        } catch (err) {
            showToast("Gagal memperbarui produk", "⚠️");
        }
    };

    // Price formatting helper
    const formatPrice = (priceVal) => {
        return `Rp ${priceVal.toLocaleString('id-ID')}`;
    };

    // Get display category label
    const getCategoryDisplayLabel = (cat) => {
        const labels = {
            stickers: "Stiker",
            keychains: "Gantungan Kunci",
            prints: "Cetak Gambar",
            washi: "Selotip Washi"
        };
        return labels[cat] || (cat.charAt(0).toUpperCase() + cat.slice(1));
    };

    return (
        <div className="inventory-layout flex flex-col gap-3 lg:grid lg:grid-cols-[1fr_2fr] lg:gap-5 h-auto overflow-visible pb-10">
            {/* Mobile View Tab Selector */}
            <div className="lg:hidden flex border-2 border-text rounded-xl overflow-hidden mb-1 shrink-0 bg-white font-title text-xs font-bold shadow-[2px_2px_0px_#32628f] w-full">
                <button 
                    type="button"
                    onClick={() => setActiveMobileTab('list')}
                    className={`flex-grow py-3 text-center border-r-2 border-text transition-colors cursor-pointer ${
                        activeMobileTab === 'list' ? 'bg-yellow' : 'bg-white hover:bg-yellow-light/50'
                    }`}
                >
                    📦 Stok Barang
                </button>
                <button 
                    type="button"
                    onClick={() => setActiveMobileTab('manage')}
                    className={`flex-grow py-3 text-center transition-colors cursor-pointer flex justify-center items-center gap-1.5 ${
                        activeMobileTab === 'manage' ? 'bg-yellow' : 'bg-white hover:bg-yellow-light/50'
                    }`}
                >
                    ⚙️ Kelola & Tambah
                </button>
            </div>

            {/* Left Column: Add Product & Manage Category Card */}
            <div className={`flex flex-col gap-5 h-auto pr-1 ${activeMobileTab === 'manage' ? 'block' : 'hidden lg:flex'}`}>
                
                {/* 1. Add Product Card */}
                <div className="add-product-card bg-yellow-light border-[3px] border-text rounded-2xl shadow-card p-5 relative shrink-0">
                    <div className="washi-tape tape-yellow-1 absolute top-[-10px] left-10 transform rotate-[-3deg] h-6 w-24 border-l border-r border-dashed border-text/25 bg-pink-light"></div>
                    
                    <h3 className="pane-title font-title text-xl text-text mb-4 title-stroke">
                        <i className="fa-solid fa-plus"></i> {t.addItem || "Tambah Barang"}
                    </h3>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-text font-body">
                        {/* Item Code (Automatically Generated) */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[12px] font-bold uppercase">{t.code || "Kode Barang"}</label>
                            <input 
                                type="text" 
                                disabled
                                value={id} 
                                className="border-2 border-text rounded-xl p-2.5 text-sm bg-text/5 text-text/60 font-bold outline-none cursor-not-allowed select-none animate-[pulse_1.5s_infinite_alternate]"
                            />
                            <span className="text-[9.5px] text-text/50 font-bold italic">Dibuat otomatis berdasarkan kategori terpilih.</span>
                        </div>

                        {/* Name */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[12px] font-bold uppercase">{t.name || "Nama Barang"}</label>
                            <input 
                                type="text" 
                                required 
                                placeholder="Contoh: Pembatas Buku Peach" 
                                value={name} 
                                onChange={(e) => setName(e.target.value)}
                                className="border-2 border-text rounded-xl p-2.5 text-sm outline-none focus:bg-white bg-white"
                            />
                        </div>

                        {/* Category selection */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[12px] font-bold uppercase">{t.category || "Kategori"}</label>
                            {categories.length === 0 ? (
                                <div className="text-[11px] font-bold text-pink bg-pink-light/35 border-2 border-text rounded-xl p-2.5">
                                    ⚠️ Harap tambah kategori terlebih dahulu di bawah!
                                </div>
                            ) : (
                                <select 
                                    value={category} 
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="border-2 border-text rounded-xl p-2.5 text-sm outline-none bg-white font-title text-xs cursor-pointer"
                                >
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>{getCategoryDisplayLabel(cat)}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Tag */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[12px] font-bold uppercase">{t.tag || "Tag"}</label>
                            <input 
                                type="text" 
                                placeholder="Contoh: BARU atau TERLARIS (Opsional)" 
                                value={tag} 
                                onChange={(e) => setTag(e.target.value)}
                                className="border-2 border-text rounded-xl p-2.5 text-sm outline-none focus:bg-white bg-white"
                            />
                        </div>

                        {/* Variations Checkbox */}
                        <div className="flex items-center gap-2 mt-1">
                            <input 
                                type="checkbox" 
                                id="has-variations" 
                                checked={hasVariations} 
                                onChange={(e) => setHasVariations(e.target.checked)}
                                className="w-4.5 h-4.5 accent-pink border-2 border-text rounded cursor-pointer"
                            />
                            <label htmlFor="has-variations" className="text-sm font-bold cursor-pointer select-none">
                                Memiliki variasi produk? (Contoh: Warna, Ukuran)
                            </label>
                        </div>

                        {/* Base Price and Stock (Shown only if no variations) */}
                        {!hasVariations ? (
                            <div className="grid grid-cols-2 gap-3 transition-all duration-350">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-bold uppercase">{t.price || "Harga (Rupiah)"}</label>
                                    <input 
                                        type="number" 
                                        required={!hasVariations}
                                        placeholder="Contoh: 45000" 
                                        value={price} 
                                        onChange={(e) => setPrice(e.target.value)}
                                        className="border-2 border-text rounded-xl p-2.5 text-sm outline-none focus:bg-white bg-white font-bold"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-bold uppercase">{t.stock || "Stok"}</label>
                                    <input 
                                        type="number" 
                                        required={!hasVariations}
                                        min="0"
                                        value={stock} 
                                        onChange={(e) => setStock(e.target.value)}
                                        className="border-2 border-text rounded-xl p-2.5 text-sm outline-none focus:bg-white bg-white font-bold"
                                    />
                                </div>
                            </div>
                        ) : (
                            /* Variations dynamic lists */
                            <div className="bg-white border-[3px] border-text rounded-2xl p-4 flex flex-col gap-3.5 shadow-[2px_2px_0px_#32628f] transition-all duration-350 shrink-0">
                                <h5 className="font-title text-[12px] font-bold text-text flex justify-between items-center border-b border-text/15 pb-1.5">
                                    <span>Daftar Variasi Item</span>
                                    <button 
                                        type="button" 
                                        onClick={handleAddVariationRow}
                                        className="text-[11px] bg-blue-light text-text border-2 border-text px-2 py-0.5 rounded-full hover:bg-white font-bold cursor-pointer transition-all"
                                    >
                                        + Tambah Variasi
                                    </button>
                                </h5>

                                <div className="max-h-[220px] overflow-y-auto flex flex-col gap-3 pr-1">
                                    {variationsList.map((row, idx) => (
                                        <div key={idx} className="flex flex-col gap-1.5 bg-yellow-light/20 border border-text/10 rounded-xl p-2.5 relative">
                                            <div className="flex gap-2 items-center">
                                                <div className="flex flex-col gap-1 flex-grow">
                                                    <input 
                                                        type="text" 
                                                        placeholder="Nama (e.g. Merah)" 
                                                        required={hasVariations}
                                                        value={row.name}
                                                        onChange={(e) => handleVariationRowChange(idx, 'name', e.target.value)}
                                                        className="border-2 border-text rounded-lg p-1.5 text-xs outline-none bg-white font-bold"
                                                    />
                                                </div>

                                                <div className="flex flex-col gap-1 w-[80px]">
                                                    <input 
                                                        type="number" 
                                                        placeholder="Harga" 
                                                        required={hasVariations}
                                                        value={row.price}
                                                        onChange={(e) => handleVariationRowChange(idx, 'price', e.target.value)}
                                                        className="border-2 border-text rounded-lg p-1.5 text-xs outline-none bg-white font-title font-bold"
                                                    />
                                                </div>

                                                <div className="flex flex-col gap-1 w-[60px]">
                                                    <input 
                                                        type="number" 
                                                        placeholder="Stok" 
                                                        required={hasVariations}
                                                        value={row.stock}
                                                        onChange={(e) => handleVariationRowChange(idx, 'stock', e.target.value)}
                                                        className="border-2 border-text rounded-lg p-1.5 text-xs outline-none bg-white font-bold"
                                                    />
                                                </div>

                                                {variationsList.length > 1 && (
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleRemoveVariationRow(idx)}
                                                        className="text-pink hover:scale-115 cursor-pointer ml-1 p-0.5"
                                                        title="Hapus Baris"
                                                    >
                                                        <i className="fa-solid fa-xmark text-[14px]"></i>
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 pl-0.5">
                                                <i className="fa-solid fa-tag text-[9px] text-pink"></i>
                                                <input 
                                                    type="number" 
                                                    placeholder="Diskon (Rp)" 
                                                    min="0"
                                                    value={row.discount}
                                                    onChange={(e) => handleVariationRowChange(idx, 'discount', e.target.value)}
                                                    className="border-2 border-pink/40 rounded-lg p-1 text-[10px] outline-none bg-pink-light/15 font-bold w-[100px] focus:border-pink"
                                                />
                                                {parseFloat(row.discount || 0) > 0 && parseFloat(row.price || 0) > 0 && (
                                                    <span className="text-[9px] text-pink font-bold">→ {formatPrice(Math.max(0, parseFloat(row.price) - parseFloat(row.discount)))}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button 
                            type="submit"
                            className="btn bg-pink text-text border-[3px] border-text rounded-full font-title text-[13px] px-6 py-2.5 mt-2 shadow-btn hover:bg-white hover:translate-y-[-3px] active:translate-y-[1px] cursor-pointer transition-all w-full flex items-center justify-center gap-2"
                        >
                            <i className="fa-solid fa-plus"></i> {t.addItem || "Tambah Barang"}
                        </button>
                    </form>
                </div>

                {/* 2. Kelola Kategori Card */}
                <div className="manage-category-card bg-pink-light border-[3px] border-text rounded-2xl shadow-card p-5 relative shrink-0">
                    <div className="washi-tape tape-pink absolute top-[-10px] left-10 transform rotate-[2deg] h-6 w-24 border-l border-r border-dashed border-text/25 bg-yellow-light"></div>
                    
                    <h3 className="pane-title font-title text-xl text-text mb-4 title-stroke">
                        <i className="fa-solid fa-tags"></i> Kelola Kategori
                    </h3>

                    <div className="flex flex-col gap-3.5 text-text font-body">
                        {/* List of current categories */}
                        <div className="bg-white border-2 border-text rounded-xl p-3 flex flex-col gap-2 shadow-[2px_2px_0px_#32628f]">
                            <h5 className="font-title text-[11px] font-bold text-text border-b border-text/10 pb-1.5 flex justify-between items-center">
                                <span>📋 Daftar Kategori Saat Ini</span>
                            </h5>
                            <div className="max-h-[140px] overflow-y-auto flex flex-col gap-1.5 pr-1">
                                {categories.map(cat => (
                                    <div key={cat} className="flex justify-between items-center text-xs py-1 border-b border-dashed border-text/5">
                                        <span className="font-bold text-text/90 capitalize">{getCategoryDisplayLabel(cat)}</span>
                                        <div className="flex gap-2">
                                            <button 
                                                type="button"
                                                onClick={() => handleEditCategory(cat)}
                                                className="text-blue hover:scale-110 cursor-pointer p-0.5"
                                                title="Ubah Kategori"
                                            >
                                                <i className="fa-solid fa-pen text-[10px]"></i>
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => handleDeleteCategory(cat)}
                                                className="text-pink hover:scale-110 cursor-pointer p-0.5"
                                                title="Hapus Kategori"
                                            >
                                                <i className="fa-solid fa-trash-can text-[10px]"></i>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Add category form */}
                        <form onSubmit={handleAddCategorySubmit} className="flex gap-2 mt-1">
                            <input 
                                type="text" 
                                required
                                placeholder="Nama kategori baru..." 
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                className="border-2 border-text rounded-xl p-2.5 text-xs outline-none bg-white flex-grow font-bold focus:bg-yellow-light"
                            />
                            <button 
                                type="submit"
                                className="btn bg-yellow text-text border-[3px] border-text rounded-full font-title text-[12px] px-5 py-2 shadow-btn hover:bg-white hover:translate-y-[-2px] active:translate-y-[1px] cursor-pointer transition-all flex items-center gap-1.5"
                            >
                                <i className="fa-solid fa-plus text-[10px]"></i> Tambah
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Right Column: Inventory List Card */}
            <div className={`inventory-card bg-white border-[3px] border-text rounded-2xl shadow-card p-5 flex flex-col h-auto overflow-visible relative ${activeMobileTab === 'list' ? 'block' : 'hidden lg:flex'}`}>
                <div className="washi-tape tape-history absolute top-[-12px] right-10 transform rotate-[3deg] h-6 w-24 z-5 border-l border-r border-dashed border-text/25 bg-blue-light"></div>
                
                <h3 className="pane-title font-title text-xl text-text mb-4 title-stroke">
                    <i className="fa-solid fa-boxes-stacked"></i> {t.inventory || "Stok Barang"}
                </h3>

                {/* Bulk Delete Bar */}
                {selectedProducts.length > 0 && (
                    <div className="flex justify-between items-center bg-pink-light border-2 border-text rounded-xl p-3 mb-3 text-text font-body animate-[fade_0.2s_ease] shrink-0">
                        <span className="text-xs font-bold">Terpilih: <strong>{selectedProducts.length}</strong> barang</span>
                        <div className="flex gap-2">
                            <button 
                                onClick={handleBulkDelete}
                                className="btn bg-pink text-text border-2 border-text px-3 py-1.5 rounded-full text-xs font-bold font-title hover:bg-white hover:translate-y-[-2px] active:translate-y-[1px] transition-all shadow-btn flex items-center gap-1.5 cursor-pointer"
                            >
                                <i className="fa-solid fa-trash-can text-[10px]"></i> Hapus Terpilih
                            </button>
                            <button 
                                onClick={() => setSelectedProducts([])}
                                className="btn bg-white text-text border-2 border-text px-3 py-1.5 rounded-full text-xs font-bold font-title hover:bg-yellow-light hover:translate-y-[-2px] active:translate-y-[1px] transition-all shadow-btn cursor-pointer"
                            >
                                Batal
                            </button>
                        </div>
                    </div>
                )}

                <div className="table-container flex-grow overflow-y-auto overflow-x-auto max-h-[600px] border-2 border-text rounded-lg">
                    {loading ? (
                        <div className="text-center py-12 font-bold text-text/60">{t.loadingProducts}</div>
                    ) : (
                        <table className="history-table w-full border-collapse text-left text-[13px] text-text">
                            <thead>
                                <tr className="bg-blue-light border-b-2 border-text font-title font-bold">
                                    <th className="p-3 w-10 text-center">
                                        <input 
                                            type="checkbox" 
                                            checked={products.length > 0 && selectedProducts.length === products.length} 
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedProducts(products.map(p => p.id));
                                                } else {
                                                    setSelectedProducts([]);
                                                }
                                            }}
                                            className="w-4 h-4 cursor-pointer accent-pink"
                                        />
                                    </th>
                                    <th className="p-3">{t.code || "Kode"}</th>
                                    <th className="p-3">{t.name || "Nama"}</th>
                                    <th className="p-3">{t.price || "Harga"}</th>
                                    <th className="p-3">{t.stock || "Stok"}</th>
                                    <th className="p-3 text-center">{t.actions || "Aksi"}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map(prod => {
                                    const isLowStock = prod.stock < 10;
                                    const hasVars = prod.variations && prod.variations.length > 0;
                                    const isExpanded = expandedProductId === prod.id;

                                    return (
                                        <React.Fragment key={prod.id}>
                                            <tr className={`hover:bg-yellow-light border-b border-text/15 ${isLowStock ? 'bg-pink-light/30' : ''} ${hasVars ? 'cursor-pointer' : ''}`}
                                                onClick={() => hasVars && setExpandedProductId(isExpanded ? null : prod.id)}
                                            >
                                                {/* Select Checkbox */}
                                                <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedProducts.includes(prod.id)} 
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedProducts(prev => [...prev, prod.id]);
                                                            } else {
                                                                setSelectedProducts(prev => prev.filter(id => id !== prod.id));
                                                            }
                                                        }}
                                                        className="w-4 h-4 cursor-pointer accent-pink"
                                                    />
                                                </td>
                                                <td className="p-3 font-bold text-[11px]">
                                                    {prod.id}
                                                </td>
                                                <td className="p-3 font-bold flex flex-col gap-0.5">
                                                    <span>{prod.name}</span>
                                                    {hasVars && (
                                                        <span className="text-[10px] text-blue font-title">
                                                            {isExpanded ? "▼ Sembunyikan Variasi" : `▶ Lihat ${prod.variations.length} Variasi`}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3 font-title text-[12px] font-bold text-text">
                                                    {(prod.discount || 0) > 0 && !hasVars ? (
                                                        <div className="flex flex-col">
                                                            <span className="line-through opacity-50 text-[10px]">{formatPrice(prod.price)}</span>
                                                            <span className="text-pink">{formatPrice(Math.max(0, prod.price - prod.discount))}</span>
                                                            <span className="text-[8px] bg-pink text-white px-1.5 py-0.5 rounded-full w-fit mt-0.5 font-bold">-{formatPrice(prod.discount)}</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {formatPrice(hasVars ? Math.min(...prod.variations.map(v => v.price)) : prod.price)}
                                                            {hasVars && <span className="text-[9px] block font-body opacity-70">(Mulai dari)</span>}
                                                        </>
                                                    )}
                                                </td>
                                                <td className="p-3 font-bold">
                                                    <span className={`px-2 py-0.5 rounded-full border ${
                                                        isLowStock ? 'bg-pink border-text text-text text-[10px]' : 'bg-transparent border-transparent'
                                                    }`}>
                                                        {prod.stock} {isLowStock && `! ${t.lowStock || 'Tipis!'}`}
                                                    </span>
                                                </td>
                                                <td className="p-3" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex justify-center gap-2">
                                                        {/* Restock Button (Hidden for variations as they restock individually inside expansion) */}
                                                        {!hasVars ? (
                                                            <button 
                                                                onClick={() => handleRestockClick(prod)}
                                                                title="Isi stok barang"
                                                                className="btn bg-yellow text-text border-2 border-text rounded-full font-title text-[10px] px-3 py-1 hover:bg-white cursor-pointer shadow-[1px_1px_0px_#32628f] transition-all flex items-center gap-1"
                                                            >
                                                                <i className="fa-solid fa-box-open"></i> {t.restock || "Isi Stok"}
                                                            </button>
                                                        ) : (
                                                            <button 
                                                                onClick={() => setExpandedProductId(isExpanded ? null : prod.id)}
                                                                className="btn bg-yellow-light text-text border-2 border-text rounded-full font-title text-[10px] px-3 py-1 hover:bg-white cursor-pointer shadow-[1px_1px_0px_#32628f] transition-all flex items-center gap-1"
                                                            >
                                                                <i className="fa-solid fa-layer-group"></i> Variasi
                                                            </button>
                                                        )}

                                                        {/* Edit Button */}
                                                        <button 
                                                            onClick={() => handleOpenEditModal(prod)}
                                                            title="Edit produk"
                                                            className="btn bg-blue-light text-text border-2 border-text rounded-full font-title text-[10px] px-3 py-1 hover:bg-white cursor-pointer shadow-[1px_1px_0px_#32628f] transition-all flex items-center gap-1"
                                                        >
                                                            <i className="fa-solid fa-pen-to-square"></i> Edit
                                                        </button>
                                                        
                                                        {/* Delete Button */}
                                                        <button 
                                                            onClick={() => handleDelete(prod.id)}
                                                            title="Hapus produk"
                                                            className="btn bg-white text-text border-2 border-text rounded-full font-title text-[10px] px-3 py-1 hover:bg-pink-light cursor-pointer shadow-[1px_1px_0px_#32628f] transition-all flex items-center gap-1 text-pink"
                                                        >
                                                            <i className="fa-solid fa-trash-can"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Collapsible Sub-Table showing variations */}
                                            {hasVars && isExpanded && (
                                                <tr className="bg-yellow-light/10 border-b border-text/15">
                                                    <td colSpan="6" className="p-3">
                                                        <div className="bg-white border-2 border-text rounded-xl p-3 shadow-[3px_3px_0px_#32628f] ml-8 my-2 max-w-[500px]">
                                                            <h5 className="font-title text-[11px] font-bold mb-2.5 text-text border-b border-text/10 pb-1 flex items-center gap-1.5">
                                                                <i className="fa-solid fa-layer-group text-blue"></i>
                                                                <span>Daftar Stok Variasi • {prod.name}</span>
                                                            </h5>
                                                            <div className="flex flex-col gap-2">
                                                                {prod.variations.map((v, idx) => {
                                                                    const vHasDiscount = (v.discount || 0) > 0;
                                                                    return (
                                                                    <div key={idx} className={`flex justify-between items-center border rounded-lg p-2 text-xs text-text ${vHasDiscount ? 'bg-pink-light/30 border-pink/30' : 'bg-blue-light/25 border-text/15'}`}>
                                                                        <div className="flex flex-col">
                                                                            <span className="font-bold">{v.name}</span>
                                                                            {vHasDiscount && (
                                                                                <span className="text-[8px] bg-pink text-white px-1.5 py-0.5 rounded-full w-fit mt-0.5 font-bold">SALE -{formatPrice(v.discount)}</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-3">
                                                                            {vHasDiscount ? (
                                                                                <div className="flex flex-col items-end">
                                                                                    <span className="font-title text-[10px] line-through opacity-50">{formatPrice(v.price)}</span>
                                                                                    <span className="font-title font-bold text-pink">{formatPrice(Math.max(0, v.price - v.discount))}</span>
                                                                                </div>
                                                                            ) : (
                                                                                <span className="font-title font-bold text-text/95">{formatPrice(v.price)}</span>
                                                                            )}
                                                                            <span className="font-bold opacity-80">Stok: {v.stock}</span>
                                                                            <button
                                                                                onClick={() => handleRestockClick(prod, v.name)}
                                                                                className="btn bg-yellow text-text border-2 border-text rounded-full font-title text-[9px] px-2.5 py-0.5 hover:bg-white cursor-pointer shadow-[1px_1px_0px_#32628f] transition-all flex items-center gap-1"
                                                                            >
                                                                                <i className="fa-solid fa-box-open text-[8px]"></i> Isi Stok
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Custom Restock Modal overlay */}
            {restockTarget && (
                <div className="fixed inset-0 bg-[#32628F]/50 backdrop-blur-sm z-[10001] flex justify-center items-center p-4 animate-[fade_0.2s_ease]">
                    <div className="bg-white border-[3px] border-text rounded-2xl shadow-card w-[340px] overflow-hidden flex flex-col p-5 text-text relative">
                        <div className="washi-tape tape-yellow-1 absolute top-[-10px] left-10 transform rotate-[-4deg] h-6 w-24 bg-pink-light"></div>
                        
                        <div className="w-full flex justify-between items-center border-b border-text/10 pb-2.5 mb-4 border-dashed">
                            <span className="font-title text-base font-bold text-center w-full">Isi Stok Barang</span>
                            <button 
                                onClick={() => setRestockTarget(null)}
                                className="absolute right-4 text-text hover:text-pink transition-transform hover:scale-110 cursor-pointer"
                            >
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>
                        
                        <div className="text-center mb-4">
                            <h4 className="font-title text-sm font-bold text-text mb-1">{restockTarget.product.name}</h4>
                            {restockTarget.variationName && (
                                <span className="bg-blue-light border border-text/25 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                                    Variasi: {restockTarget.variationName}
                                </span>
                            )}
                        </div>

                        <form onSubmit={handleRestockSubmit} className="w-full flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] font-bold uppercase text-text/80">Jumlah Tambahan Stok</label>
                                <input 
                                    type="number" 
                                    required
                                    min="1"
                                    value={restockAmount}
                                    onChange={(e) => setRestockAmount(e.target.value)}
                                    className="border-2 border-text rounded-xl p-2 text-sm outline-none bg-white font-bold text-center text-lg focus:bg-yellow-light"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-1.5">
                                <button 
                                    type="button"
                                    onClick={() => setRestockTarget(null)}
                                    className="btn bg-white text-text border-[3px] border-text rounded-full font-title text-[12px] px-4 py-2 shadow-btn hover:bg-text/5 cursor-pointer"
                                >
                                    Batal
                                </button>
                                <button 
                                    type="submit"
                                    className="btn bg-pink text-text border-[3px] border-text rounded-full font-title text-[12px] px-4 py-2 shadow-btn hover:bg-white cursor-pointer"
                                >
                                    Simpan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Product Modal overlay */}
            {editingProduct && (
                <div className="fixed inset-0 bg-[#32628F]/50 backdrop-blur-sm z-[10001] flex justify-center items-center p-4 animate-[fade_0.2s_ease]">
                    <div className="bg-white border-[3px] border-text rounded-2xl shadow-card w-[420px] max-h-[90vh] overflow-hidden flex flex-col p-5 text-text relative">
                        <div className="washi-tape tape-yellow-1 absolute top-[-10px] left-10 transform rotate-[-4deg] h-6 w-24 bg-pink-light"></div>
                        
                        <div className="w-full flex justify-between items-center border-b border-text/10 pb-2.5 mb-4 border-dashed">
                            <span className="font-title text-base font-bold text-center w-full">Edit Detail Barang</span>
                            <button 
                                onClick={() => setEditingProduct(null)}
                                className="absolute right-4 text-text hover:text-pink transition-transform hover:scale-110 cursor-pointer"
                            >
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>
                        
                        <form onSubmit={handleEditSubmit} className="w-full flex flex-col gap-3.5 overflow-y-auto pr-1">
                            {/* Product Code (Read Only) */}
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold uppercase text-text/60">Kode Barang (Tidak dapat diubah)</label>
                                <input 
                                    type="text" 
                                    disabled
                                    value={editingProduct.id} 
                                    className="border-2 border-text rounded-xl p-2 text-xs bg-text/5 text-text/50 font-bold outline-none cursor-not-allowed select-none"
                                />
                            </div>

                            {/* Name */}
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold uppercase text-text/80">Nama Barang</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={editingProduct.name}
                                    onChange={(e) => setEditingProduct(prev => ({ ...prev, name: e.target.value }))}
                                    className="border-2 border-text rounded-xl p-2.5 text-xs outline-none bg-white font-bold"
                                />
                            </div>

                            {/* Category */}
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold uppercase text-text/80">Kategori</label>
                                <select 
                                    value={editingProduct.category} 
                                    onChange={(e) => setEditingProduct(prev => ({ ...prev, category: e.target.value }))}
                                    className="border-2 border-text rounded-xl p-2.5 text-xs outline-none bg-white font-title cursor-pointer"
                                >
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>{getCategoryDisplayLabel(cat)}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Tag */}
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold uppercase text-text/80">Tag</label>
                                <input 
                                    type="text" 
                                    placeholder="Contoh: BARU atau TERLARIS (Opsional)" 
                                    value={editingProduct.tag}
                                    onChange={(e) => setEditingProduct(prev => ({ ...prev, tag: e.target.value }))}
                                    className="border-2 border-text rounded-xl p-2.5 text-xs outline-none bg-white"
                                />
                            </div>

                            {/* Variations Checkbox */}
                            <div className="flex items-center gap-2 py-0.5">
                                <input 
                                    type="checkbox" 
                                    id="edit-has-variations" 
                                    checked={editingProduct.hasVariations} 
                                    onChange={(e) => setEditingProduct(prev => ({ 
                                        ...prev, 
                                        hasVariations: e.target.checked,
                                        variationsList: prev.variationsList && prev.variationsList.length > 0 ? prev.variationsList : [{ name: '', price: '', stock: '10' }]
                                    }))}
                                    className="w-4 h-4 accent-pink border-2 border-text rounded cursor-pointer"
                                />
                                <label htmlFor="edit-has-variations" className="text-xs font-bold cursor-pointer select-none">
                                    Memiliki variasi produk? (Contoh: Warna, Ukuran)
                                </label>
                            </div>

                            {/* Base Price and Stock (Shown only if no variations) */}
                            {!editingProduct.hasVariations ? (
                                <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-bold uppercase text-text/80">Harga (Rupiah)</label>
                                        <input 
                                            type="number" 
                                            required={!editingProduct.hasVariations}
                                            value={editingProduct.price}
                                            onChange={(e) => setEditingProduct(prev => ({ ...prev, price: e.target.value }))}
                                            className="border-2 border-text rounded-xl p-2 text-xs outline-none bg-white font-bold"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-bold uppercase text-text/80">Stok</label>
                                        <input 
                                            type="number" 
                                            required={!editingProduct.hasVariations}
                                            min="0"
                                            value={editingProduct.stock}
                                            onChange={(e) => setEditingProduct(prev => ({ ...prev, stock: e.target.value }))}
                                            className="border-2 border-text rounded-xl p-2 text-xs outline-none bg-white font-bold"
                                        />
                                    </div>
                                </div>

                                {/* Per-item Discount Field */}
                                <div className="flex flex-col gap-1 mt-1">
                                    <label className="text-[10px] font-bold uppercase text-pink flex items-center gap-1">
                                        <i className="fa-solid fa-tag"></i> Diskon per Item (Rp) — Cuci Gudang / Wholesale
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            min="0"
                                            max={editingProduct.price || 0}
                                            value={editingProduct.discount}
                                            onChange={(e) => setEditingProduct(prev => ({ ...prev, discount: e.target.value }))}
                                            placeholder="0"
                                            className="border-2 border-pink/60 rounded-xl p-2 text-xs outline-none bg-pink-light/20 font-bold flex-grow focus:border-pink"
                                        />
                                        {parseFloat(editingProduct.discount || 0) > 0 && (
                                            <button 
                                                type="button" 
                                                onClick={() => setEditingProduct(prev => ({ ...prev, discount: '0' }))}
                                                className="text-[9px] bg-white text-pink border-2 border-pink rounded-full px-2.5 py-1 font-bold cursor-pointer hover:bg-pink-light transition-all shrink-0"
                                            >
                                                <i className="fa-solid fa-xmark"></i> Hapus Diskon
                                            </button>
                                        )}
                                    </div>
                                    {parseFloat(editingProduct.discount || 0) > 0 && parseFloat(editingProduct.price || 0) > 0 && (
                                        <div className="text-[10px] text-pink font-bold bg-pink-light/30 rounded-lg px-2.5 py-1.5 mt-0.5 border border-pink/20">
                                            Harga setelah diskon: <span className="text-text">{formatPrice(Math.max(0, parseFloat(editingProduct.price) - parseFloat(editingProduct.discount)))}</span>
                                            <span className="opacity-60 ml-1">(hemat {Math.round((parseFloat(editingProduct.discount) / parseFloat(editingProduct.price)) * 100)}%)</span>
                                        </div>
                                    )}
                                </div>
                                </>
                            ) : (
                                /* Variations dynamic lists */
                                <div className="bg-blue-light/10 border-2 border-text rounded-xl p-3 flex flex-col gap-2 shadow-[2px_2px_0px_#32628f] shrink-0">
                                    <h5 className="font-title text-[10px] font-bold text-text flex justify-between items-center border-b border-text/15 pb-1">
                                        <span>Daftar Variasi Item</span>
                                        <button 
                                            type="button" 
                                            onClick={handleAddEditVariationRow}
                                            className="text-[9px] bg-blue-light text-text border-2 border-text px-2 py-0.5 rounded-full hover:bg-white font-bold cursor-pointer transition-all"
                                        >
                                            + Tambah Variasi
                                        </button>
                                    </h5>

                                    <div className="max-h-[140px] overflow-y-auto flex flex-col gap-2 pr-1">
                                        {editingProduct.variationsList.map((row, idx) => (
                                            <div key={idx} className="flex flex-col gap-1.5 bg-white border border-text/10 rounded-lg p-2 relative">
                                                <div className="flex gap-2 items-center">
                                                    <div className="flex flex-col gap-0.5 flex-grow">
                                                        <input 
                                                            type="text" 
                                                            placeholder="Nama" 
                                                            required={editingProduct.hasVariations}
                                                            value={row.name}
                                                            onChange={(e) => handleEditVariationRowChange(idx, 'name', e.target.value)}
                                                            className="border-2 border-text rounded-lg p-1 text-[11px] outline-none bg-white font-bold"
                                                        />
                                                    </div>

                                                    <div className="flex flex-col gap-0.5 w-[70px]">
                                                        <input 
                                                            type="number" 
                                                            placeholder="Harga" 
                                                            required={editingProduct.hasVariations}
                                                            value={row.price}
                                                            onChange={(e) => handleEditVariationRowChange(idx, 'price', e.target.value)}
                                                            className="border-2 border-text rounded-lg p-1 text-[11px] outline-none bg-white font-bold"
                                                        />
                                                    </div>

                                                    <div className="flex flex-col gap-0.5 w-[55px]">
                                                        <input 
                                                            type="number" 
                                                            placeholder="Stok" 
                                                            required={editingProduct.hasVariations}
                                                            value={row.stock}
                                                            onChange={(e) => handleEditVariationRowChange(idx, 'stock', e.target.value)}
                                                            className="border-2 border-text rounded-lg p-1 text-[11px] outline-none bg-white font-bold"
                                                        />
                                                    </div>

                                                    {editingProduct.variationsList.length > 1 && (
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleRemoveEditVariationRow(idx)}
                                                            className="text-pink hover:scale-115 cursor-pointer ml-1 p-0.5"
                                                            title="Hapus Baris"
                                                        >
                                                            <i className="fa-solid fa-xmark text-[12px]"></i>
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 pl-0.5">
                                                    <i className="fa-solid fa-tag text-[8px] text-pink"></i>
                                                    <input 
                                                        type="number" 
                                                        placeholder="Diskon (Rp)" 
                                                        min="0"
                                                        value={row.discount}
                                                        onChange={(e) => handleEditVariationRowChange(idx, 'discount', e.target.value)}
                                                        className="border-2 border-pink/40 rounded-lg p-0.5 text-[10px] outline-none bg-pink-light/15 font-bold w-[90px] focus:border-pink"
                                                    />
                                                    {parseFloat(row.discount || 0) > 0 && parseFloat(row.price || 0) > 0 && (
                                                        <span className="text-[9px] text-pink font-bold">→ {formatPrice(Math.max(0, parseFloat(row.price) - parseFloat(row.discount)))}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Modal actions */}
                            <div className="grid grid-cols-2 gap-3 mt-3">
                                <button 
                                    type="button"
                                    onClick={() => setEditingProduct(null)}
                                    className="btn bg-white text-text border-[3px] border-text rounded-full font-title text-[12px] px-4 py-2 shadow-btn hover:bg-text/5 cursor-pointer"
                                >
                                    Batal
                                </button>
                                <button 
                                    type="submit"
                                    className="btn bg-pink text-text border-[3px] border-text rounded-full font-title text-[12px] px-4 py-2 shadow-btn hover:bg-white cursor-pointer"
                                >
                                    Simpan Perubahan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
