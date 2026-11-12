import { Fragment, useState, useEffect, useMemo } from 'react';
import { 
    getProducts, 
    saveProduct, 
    deleteProduct, 
    adjustProductStock,
    getCategories, 
    saveCategory, 
    deleteCategory,
    deleteProductsBulk,
    updateCategoryName,
    sp_import_products_batch
} from '../services/db';
import * as XLSX from 'xlsx';
import { recordAuditLog } from '../services/audit';
import { compressImageFile, resolveProductImageUrl } from '../utils/imageHelper';
import { formatRupiah, sanitizeIntegerInput, toIntRupiah } from '../utils/currency';
import { t } from '../services/translations';
import ProductCardMobile from '../components/inventory/ProductCardMobile';

export default function Inventory({ showToast, currentUser, userRole }) {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeMobileTab, setActiveMobileTab] = useState('list');

    // Dynamic Categories State
    const [newCategoryName, setNewCategoryName] = useState('');

    // Form Fields State
    const [manualId, setManualId] = useState('');
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState('stickers');
    const [stock, setStock] = useState('10');
    const [tag, setTag] = useState('');
    const [productImg, setProductImg] = useState('');
    const [imgCompressing, setImgCompressing] = useState(false);

    // Variations State
    const [hasVariations, setHasVariations] = useState(false);
    const [uniformVariantPrice, setUniformVariantPrice] = useState(true);
    const [masterVariantPrice, setMasterVariantPrice] = useState('');
    const [masterVariantDiscount, setMasterVariantDiscount] = useState('0');
    const [variationsList, setVariationsList] = useState([{ name: '', price: '', stock: '10', discount: '0' }]);

    // Table UI State
    const [expandedProductId, setExpandedProductId] = useState(null);

    // Restock / Stock Adjust Modal Target State
    const [restockTarget, setRestockTarget] = useState(null);
    const [restockAmount, setRestockAmount] = useState('10');
    const [stockAdjustMode, setStockAdjustMode] = useState('add'); // 'add' | 'sub' | 'set'
    const [stockAdjustReason, setStockAdjustReason] = useState('Restok');

    // Bulk delete and Editing states
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [editingProduct, setEditingProduct] = useState(null);

    // Search, Filter, Sort & Pagination State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterVisibility, setFilterVisibility] = useState('all'); // all, visible, hidden
    const [filterStockHealth, setFilterStockHealth] = useState('all'); // all, low, out
    const [sortBy, setSortBy] = useState('name_asc'); // name_asc, name_desc, price_asc, price_desc, stock_asc, stock_desc
    const [pageSize, setPageSize] = useState(20); // 20, 40, 60
    const [currentPage, setCurrentPage] = useState(1);

    // CSV Import Modal state
    const [showImportModal, setShowImportModal] = useState(false);
    const [importPreview, setImportPreview] = useState([]);
    const [importErrors, setImportErrors] = useState([]);

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

    const id = manualId || (loading ? '' : generateNextId(name, category, products));

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const [prodData, catData] = await Promise.all([getProducts(), getCategories()]);
                if (!mounted) return;
                setProducts(prodData);
                setCategories(catData);
                if (catData.length > 0) {
                    setCategory(prev => (catData.includes(prev) ? prev : catData[0]));
                }
            } catch (e) {
                console.error(e);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
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
        } catch {
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
            } catch {
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
            showToast("Kategori berhasil diperbarui!", "✨");
            fetchCategoriesList();
            fetchProducts();
        } catch {
            showToast("Gagal mengubah nama kategori", "⚠️");
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

    const handleImageFileSelect = async (file, onDone) => {
        if (!file) return;
        setImgCompressing(true);
        try {
            const compressed = await compressImageFile(file);
            onDone(compressed);
            showToast('Gambar produk berhasil dikompres & dipasang!', '🖼️');
        } catch (err) {
            showToast(err.message || 'Gagal memproses gambar', '⚠️');
        } finally {
            setImgCompressing(false);
        }
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

        let calculatedPrice = toIntRupiah(price);
        let calculatedStock = parseInt(stock, 10) || 0;
        let finalVariations = [];

        if (hasVariations) {
            let listToValidate = variationsList;
            if (uniformVariantPrice) {
                const uPrice = toIntRupiah(masterVariantPrice);
                if (!masterVariantPrice || uPrice <= 0) {
                    showToast("Masukkan harga seragam yang valid untuk variasi!", "⚠️");
                    return;
                }
                listToValidate = variationsList.map(v => ({
                    ...v,
                    price: String(uPrice),
                    discount: String(toIntRupiah(masterVariantDiscount || 0))
                }));
            }

            // Validate variations list
            const invalid = listToValidate.some(v => !v.name.trim() || !v.price || toIntRupiah(v.price) <= 0 || v.stock === '' || isNaN(v.stock));
            if (invalid) {
                showToast("Semua baris variasi harus terisi secara valid!", "⚠️");
                return;
            }

            finalVariations = listToValidate.map(v => ({
                name: v.name.trim(),
                price: toIntRupiah(v.price),
                stock: parseInt(v.stock, 10) || 0,
                discount: toIntRupiah(v.discount || 0)
            }));

            // overall price defaults to first variation's price
            calculatedPrice = finalVariations[0].price;
            // overall stock is the sum of variations stock
            calculatedStock = finalVariations.reduce((sum, v) => sum + v.stock, 0);
        } else {
            if (!price || calculatedPrice <= 0) {
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
            img: productImg.trim() || 'assets/mascot.png',
            variations: finalVariations
        };

        try {
            await saveProduct(newProd);
            await recordAuditLog({
                action: 'ITEM_ADD',
                summary: `Produk "${newProd.name}" (${newProd.id}) ditambahkan dengan harga ${formatPrice(newProd.price)} & stok ${newProd.stock}`,
                actor: {
                    uid: currentUser?.uid,
                    email: currentUser?.email,
                    displayName: currentUser?.displayName || 'Staf',
                    role: userRole
                },
                details: {
                    productId: newProd.id,
                    name: newProd.name,
                    price: newProd.price,
                    stock: newProd.stock,
                    category: newProd.category,
                    variations: newProd.variations
                }
            });

            showToast(t.addSuccess || "Produk ditambahkan!", "🎉");
            
            // Reset form
            setManualId('');
            setName('');
            setPrice('');
            setTag('');
            setProductImg('');
            setStock('10');
            setHasVariations(false);
            setVariationsList([{ name: '', price: '', stock: '10' }]);
            
            fetchProducts(); // Refresh table view
        } catch {
            showToast("Gagal menyimpan produk", "⚠️");
        }
    };

    // Open Custom Restock / Stock Adjust Modal Target
    const handleRestockClick = (product, variationName = null) => {
        setRestockTarget({ product, variationName });
        setStockAdjustMode('add');
        setRestockAmount('10');
        setStockAdjustReason('Restok');
    };

    // Execute Unified Stock Adjustment (Add, Subtract, or Set Exact Opname) with Audit Trail
    const handleRestockSubmit = async (e) => {
        e.preventDefault();
        const amount = parseInt(restockAmount, 10);
        if (isNaN(amount) || amount < 0 || (stockAdjustMode !== 'set' && amount <= 0)) {
            showToast("Masukkan jumlah stok yang valid!", "⚠️");
            return;
        }

        const product = restockTarget.product;
        const variationName = restockTarget.variationName;
        const mode = stockAdjustMode === 'set' ? 'set' : 'delta';
        const value = stockAdjustMode === 'sub' ? -amount : amount;

        try {
            const res = await adjustProductStock(product.id, { mode, value, variationName });
            const targetLabel = `${product.name}${variationName ? ` (${variationName})` : ''}`;
            await recordAuditLog({
                action: 'STOCK_ADJUST',
                summary: `Stok "${targetLabel}" diubah ${res.prevStock} -> ${res.nextStock} (${stockAdjustReason || stockAdjustMode})`,
                actor: {
                    uid: currentUser?.uid,
                    email: currentUser?.email,
                    displayName: currentUser?.displayName || 'Staf',
                    role: userRole
                },
                details: {
                    productId: product.id,
                    variationName,
                    mode: stockAdjustMode,
                    inputAmount: amount,
                    prevStock: res.prevStock,
                    nextStock: res.nextStock,
                    reason: stockAdjustReason
                }
            });
            showToast(`Stok "${targetLabel}" sekarang ${res.nextStock} pcs!`, "📦");
            setRestockTarget(null);
            setRestockAmount('10');
            fetchProducts();
        } catch {
            showToast("Gagal memperbarui stok", "⚠️");
        }
    };

    // Delete item
    const handleDelete = async (productId) => {
        if (window.confirm("Apakah Anda yakin ingin menghapus produk ini?")) {
            try {
                const prod = products.find(p => p.id === productId);
                await deleteProduct(productId);
                await recordAuditLog({
                    action: 'ITEM_DELETE',
                    summary: `Produk "${prod?.name || productId}" dihapus dari katalog`,
                    actor: {
                        uid: currentUser?.uid,
                        email: currentUser?.email,
                        displayName: currentUser?.displayName || 'Staf',
                        role: userRole
                    },
                    details: { productId, deletedProduct: prod }
                });
                showToast(t.deleteSuccess || "Produk dihapus!", "🗑️");
                // Clear from selection if deleted
                setSelectedProducts(prev => prev.filter(id => id !== productId));
                fetchProducts();
            } catch {
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
            } catch {
                showToast("Gagal menghapus produk terpilih", "⚠️");
            }
        }
    };

    // Edit Modal Opening and Operations
    const handleOpenEditModal = (product) => {
        const hasVars = product.variations && product.variations.length > 0;
        let isUniform = true;
        let firstPrice = '';
        let firstDiscount = '0';

        if (hasVars) {
            firstPrice = product.variations[0]?.price?.toString() || '';
            firstDiscount = (product.variations[0]?.discount || 0).toString();
            isUniform = product.variations.every(v => v.price === product.variations[0]?.price && (v.discount || 0) === (product.variations[0]?.discount || 0));
        }

        setEditingProduct({
            id: product.id,
            name: product.name,
            category: product.category,
            price: product.price.toString(),
            discount: (product.discount || 0).toString(),
            stock: product.stock.toString(),
            tag: product.tag || '',
            img: product.img || '',
            hiddenFromCatalogue: Boolean(product.hiddenFromCatalogue),
            hasVariations: hasVars,
            uniformVariantPrice: isUniform,
            masterVariantPrice: firstPrice,
            masterVariantDiscount: firstDiscount,
            variationsList: hasVars 
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

        let calculatedPrice = toIntRupiah(editingProduct.price);
        let calculatedStock = parseInt(editingProduct.stock, 10) || 0;
        let finalVariations = [];

        if (editingProduct.hasVariations) {
            let listToValidate = editingProduct.variationsList;
            if (editingProduct.uniformVariantPrice) {
                const uPrice = toIntRupiah(editingProduct.masterVariantPrice);
                if (!editingProduct.masterVariantPrice || uPrice <= 0) {
                    showToast("Masukkan harga seragam yang valid untuk variasi!", "⚠️");
                    return;
                }
                listToValidate = editingProduct.variationsList.map(v => ({
                    ...v,
                    price: String(uPrice),
                    discount: String(toIntRupiah(editingProduct.masterVariantDiscount || 0))
                }));
            }

            // Validate variations list
            const invalid = listToValidate.some(v => !v.name.trim() || !v.price || toIntRupiah(v.price) <= 0 || v.stock === '' || isNaN(v.stock));
            if (invalid) {
                showToast("Semua baris variasi harus terisi secara valid!", "⚠️");
                return;
            }

            finalVariations = listToValidate.map(v => ({
                name: v.name.trim(),
                price: toIntRupiah(v.price),
                stock: parseInt(v.stock, 10) || 0,
                discount: toIntRupiah(v.discount || 0)
            }));

            calculatedPrice = finalVariations[0].price;
            calculatedStock = finalVariations.reduce((sum, v) => sum + v.stock, 0);
        } else {
            if (!editingProduct.price || calculatedPrice <= 0) {
                showToast("Format harga salah!", "⚠️");
                return;
            }
        }

        const updatedProd = {
            id: editingProduct.id,
            name: editingProduct.name,
            price: calculatedPrice,
            discount: editingProduct.hasVariations ? 0 : toIntRupiah(editingProduct.discount || 0),
            category: editingProduct.category,
            stock: calculatedStock,
            tag: editingProduct.tag,
            hiddenFromCatalogue: Boolean(editingProduct.hiddenFromCatalogue),
            img: (editingProduct.img && editingProduct.img.trim()) ? editingProduct.img.trim() : 'assets/mascot.png',
            variations: finalVariations
        };

        try {
            const oldProduct = products.find(p => p.id === updatedProd.id);
            const isPriceChanged = oldProduct && (
                oldProduct.price !== updatedProd.price || 
                JSON.stringify(oldProduct.variations?.map(v => ({ n: v.name, p: v.price }))) !== 
                JSON.stringify(updatedProd.variations?.map(v => ({ n: v.name, p: v.price })))
            );
            const isDiscountChanged = oldProduct && (
                (oldProduct.discount || 0) !== (updatedProd.discount || 0) ||
                JSON.stringify(oldProduct.variations?.map(v => ({ n: v.name, d: v.discount }))) !== 
                JSON.stringify(updatedProd.variations?.map(v => ({ n: v.name, d: v.discount })))
            );

            await saveProduct(updatedProd);

            if (isPriceChanged) {
                await recordAuditLog({
                    action: 'PRICE_CHANGE',
                    summary: `Harga produk "${updatedProd.name}" diubah dari ${formatPrice(oldProduct.price)} menjadi ${formatPrice(updatedProd.price)}`,
                    actor: {
                        uid: currentUser?.uid,
                        email: currentUser?.email,
                        displayName: currentUser?.displayName || 'Staf',
                        role: userRole
                    },
                    details: {
                        productId: updatedProd.id,
                        oldPrice: oldProduct.price,
                        newPrice: updatedProd.price,
                        oldVariations: oldProduct.variations,
                        newVariations: updatedProd.variations
                    }
                });
            }

            if (isDiscountChanged) {
                await recordAuditLog({
                    action: 'DISCOUNT_CHANGE',
                    summary: `Diskon produk "${updatedProd.name}" diubah dari Rp ${oldProduct.discount || 0} menjadi Rp ${updatedProd.discount || 0}`,
                    actor: {
                        uid: currentUser?.uid,
                        email: currentUser?.email,
                        displayName: currentUser?.displayName || 'Staf',
                        role: userRole
                    },
                    details: {
                        productId: updatedProd.id,
                        oldDiscount: oldProduct.discount,
                        newDiscount: updatedProd.discount
                    }
                });
            }

            if (!isPriceChanged && !isDiscountChanged) {
                await recordAuditLog({
                    action: 'ITEM_UPDATE',
                    summary: `Data produk "${updatedProd.name}" diperbarui`,
                    actor: {
                        uid: currentUser?.uid,
                        email: currentUser?.email,
                        displayName: currentUser?.displayName || 'Staf',
                        role: userRole
                    },
                    details: { productId: updatedProd.id, updatedFields: updatedProd }
                });
            }

            showToast("Produk berhasil diperbarui!", "🌸");
            setEditingProduct(null);
            fetchProducts(); // Refresh table view
        } catch {
            showToast("Gagal memperbarui produk", "⚠️");
        }
    };

    // Price formatting helper (strictly integer Rupiah)
    const formatPrice = (priceVal) => formatRupiah(priceVal);

    // Stock health counters (replaces unused trigger check)
    const stockSummary = useMemo(() => {
        const outCount = products.filter(p => (p.stock || 0) <= 0).length;
        const lowCount = products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= 5).length;
        return { outCount, lowCount };
    }, [products]);

    // Filter, search, and sort products
    const processedProducts = products.filter(p => {
        const matchesSearch = !searchTerm || 
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            p.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
        const matchesVisibility = filterVisibility === 'all' ||
            (filterVisibility === 'visible' && !p.hiddenFromCatalogue) ||
            (filterVisibility === 'hidden' && p.hiddenFromCatalogue);
        const matchesStockHealth = filterStockHealth === 'all' ||
            (filterStockHealth === 'out' && (p.stock || 0) <= 0) ||
            (filterStockHealth === 'low' && (p.stock || 0) > 0 && (p.stock || 0) <= 5);
        return matchesSearch && matchesCategory && matchesVisibility && matchesStockHealth;
    }).sort((a, b) => {
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
        if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
        if (sortBy === 'price_asc') return (a.price || 0) - (b.price || 0);
        if (sortBy === 'price_desc') return (b.price || 0) - (a.price || 0);
        if (sortBy === 'stock_asc') return (a.stock || 0) - (b.stock || 0);
        if (sortBy === 'stock_desc') return (b.stock || 0) - (a.stock || 0);
        return 0;
    });

    // Pagination calculations (clamp activePage so deleting/filtering never leaves blank page)
    const totalPages = Math.max(1, Math.ceil(processedProducts.length / pageSize));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const paginatedProducts = processedProducts.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

    // Export current live inventory to XLSX
    const handleExportStockXlsx = () => {
        const rows = products.map(p => ({
            "ID (Opsional, kosongkan utk auto)": p.id,
            "Nama Produk": p.name,
            "Kategori": p.category,
            "Harga": p.price,
            "Stok": p.stock,
            "Diskon (Opsional)": p.discount || 0,
            "Tag (Opsional)": p.tag || '',
            "Sembunyikan Katalog (TRUE/FALSE)": p.hiddenFromCatalogue ? 'TRUE' : 'FALSE',
            "Variasi Format (Nama:Harga:Stok:Diskon|...)": (p.variations || [])
                .map(v => `${v.name}:${v.price}:${v.stock}:${v.discount || 0}`)
                .join('|')
        }));
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Stok Barang');
        XLSX.writeFile(wb, `Kanvahati_Stok_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('Stok saat ini berhasil diexport ke XLSX!', '📊');
    };

    // Toggle hide from catalogue
    const handleToggleCatalogueVisibility = async (product) => {
        const newHiddenState = !product.hiddenFromCatalogue;
        const updated = { ...product, hiddenFromCatalogue: newHiddenState };
        try {
            await saveProduct(updated);
            await recordAuditLog({
                action: 'CATALOGUE_VISIBILITY_CHANGE',
                summary: `Produk "${product.name}" (${product.id}) ${newHiddenState ? 'disembunyikan dari' : 'ditampilkan di'} katalog POS`,
                actor: {
                    uid: currentUser?.uid,
                    email: currentUser?.email,
                    displayName: currentUser?.displayName || 'Staf',
                    role: userRole
                },
                details: { productId: product.id, hiddenFromCatalogue: newHiddenState }
            });
            showToast(`"${product.name}" ${newHiddenState ? 'disembunyikan dari' : 'ditampilkan di'} katalog!`, "👁️");
            fetchProducts();
        } catch {
            showToast("Gagal mengubah status visibilitas katalog", "⚠️");
        }
    };

    // Add Empty Slot quick button
    const handleAddEmptySlot = async () => {
        const slotCat = categories.length > 0 ? categories[0] : 'stickers';
        const nextId = generateNextId("EMPTY SLOT", slotCat, products);
        const emptySlotItem = {
            id: nextId,
            name: "[Empty Slot]",
            price: 0,
            discount: 0,
            category: slotCat,
            stock: 0,
            tag: "SLOT",
            hiddenFromCatalogue: true,
            img: 'assets/mascot.png',
            variations: []
        };

        try {
            await saveProduct(emptySlotItem);
            await recordAuditLog({
                action: 'EMPTY_SLOT_ADD',
                summary: `Slot kosong dibuat: "${emptySlotItem.name}" (${emptySlotItem.id})`,
                actor: {
                    uid: currentUser?.uid,
                    email: currentUser?.email,
                    displayName: currentUser?.displayName || 'Staf',
                    role: userRole
                },
                details: { emptySlotItem }
            });
            showToast(`Slot kosong (${emptySlotItem.id}) berhasil dibuat!`, "🔲");
            fetchProducts();
        } catch {
            showToast("Gagal membuat slot kosong", "⚠️");
        }
    };

    // Download XLSX Template for items
    const handleDownloadItemsTemplate = () => {
        const templateRows = [
            {
                "ID (Opsional, kosongkan utk auto)": "KH-STK-001",
                "Nama Produk": "Chibi Sakura Sticker",
                "Kategori": "stickers",
                "Harga": 15000,
                "Stok": 50,
                "Diskon (Opsional)": 0,
                "Tag (Opsional)": "BARU",
                "Sembunyikan Katalog (TRUE/FALSE)": "FALSE",
                "Variasi Format (Nama:Harga:Stok:Diskon|...)": ""
            },
            {
                "ID (Opsional, kosongkan utk auto)": "KH-KCH-002",
                "Nama Produk": "Cat Acrylic Keychain",
                "Kategori": "keychains",
                "Harga": 25000,
                "Stok": 30,
                "Diskon (Opsional)": 2000,
                "Tag (Opsional)": "BESTSELLER",
                "Sembunyikan Katalog (TRUE/FALSE)": "FALSE",
                "Variasi Format (Nama:Harga:Stok:Diskon|...)": "White:25000:15:0|Black:25000:15:0"
            }
        ];

        const categoriesSheetRows = (categories.length > 0 ? categories : ['stickers', 'keychains', 'prints', 'washi']).map(c => ({
            "Kategori Tersedia": c,
            "Label": getCategoryDisplayLabel(c)
        }));

        const wb = XLSX.utils.book_new();
        const wsTemplate = XLSX.utils.json_to_sheet(templateRows);
        const wsCategories = XLSX.utils.json_to_sheet(categoriesSheetRows);

        XLSX.utils.book_append_sheet(wb, wsTemplate, "Template Produk");
        XLSX.utils.book_append_sheet(wb, wsCategories, "Referensi Kategori");

        XLSX.writeFile(wb, "kanvahati_template_items.xlsx");
        showToast("Template XLSX Produk berhasil diunduh!", "📊");
    };

    // Parse and handle CSV or XLSX file for Items
    const handleCsvFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isSpreadsheet = /\.(xlsx|xls)$/i.test(file.name);
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const wb = isSpreadsheet
                    ? XLSX.read(new Uint8Array(evt.target.result), { type: 'array' })
                    : XLSX.read(evt.target.result, { type: 'string' });
                const firstSheet = wb.SheetNames[0];
                const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { defval: '' });

                if (!rawRows || rawRows.length === 0) {
                    showToast("File kosong atau tidak memiliki baris data!", "⚠️");
                    return;
                }

                const existingMap = new Map(products.map(p => [p.id.toUpperCase(), p]));
                const previewRows = [];
                const errors = [];

                rawRows.forEach((rowObj, idx) => {
                    const rowNum = idx + 2;
                    const name = String(rowObj["Nama Produk"] || rowObj["name"] || rowObj["Nama"] || '').trim();
                    if (!name) {
                        errors.push(`Baris ${rowNum}: Nama produk kosong.`);
                        return;
                    }

                    const rawId = String(rowObj["ID"] || rowObj["id"] || rowObj["ID (Opsional, kosongkan utk auto)"] || '').trim();
                    const category = String(rowObj["Kategori"] || rowObj["category"] || 'stickers').trim().toLowerCase() || 'stickers';
                    const price = toIntRupiah(rowObj["Harga"] || rowObj["price"] || 0);
                    const stockVal = parseInt(rowObj["Stok"] || rowObj["stock"] || 0, 10) || 0;
                    const discount = toIntRupiah(rowObj["Diskon"] || rowObj["Diskon (Opsional)"] || rowObj["discount"] || 0);
                    const tag = String(rowObj["Tag"] || rowObj["Tag (Opsional)"] || rowObj["tag"] || '').trim();
                    const hiddenRaw = String(rowObj["Sembunyikan Katalog"] || rowObj["Sembunyikan Katalog (TRUE/FALSE)"] || rowObj["hiddenFromCatalogue"] || '').toUpperCase();
                    const hiddenFromCatalogue = hiddenRaw === 'TRUE' || hiddenRaw === '1' || hiddenRaw === 'YA';
                    const variationsRaw = String(rowObj["Variasi"] || rowObj["Variasi Format (Nama:Harga:Stok:Diskon|...)"] || rowObj["variations"] || '').trim();

                    let parsedVariations = [];
                    if (variationsRaw && variationsRaw.includes(':')) {
                        const varSplits = variationsRaw.split('|');
                        parsedVariations = varSplits.map(vStr => {
                            const [vName, vPrice, vStock, vDisc] = vStr.split(':');
                            return {
                                name: (vName || '').trim(),
                                price: toIntRupiah(vPrice || price),
                                stock: parseInt(vStock || stockVal, 10) || 0,
                                discount: toIntRupiah(vDisc || 0)
                            };
                        }).filter(v => v.name);
                    }

                    const assignedId = rawId ? rawId.toUpperCase() : generateNextId(name, category, [...products, ...previewRows]);
                    const existing = existingMap.get(assignedId);

                    previewRows.push({
                        id: assignedId,
                        name,
                        category,
                        price: parsedVariations.length > 0 ? Math.min(...parsedVariations.map(v => v.price)) : price,
                        stock: parsedVariations.length > 0 ? parsedVariations.reduce((s, v) => s + v.stock, 0) : stockVal,
                        discount,
                        tag,
                        hiddenFromCatalogue,
                        variations: parsedVariations,
                        img: existing?.img || 'assets/mascot.png',
                        _importAction: existing ? 'UPDATE' : 'BARU'
                    });
                });

                setImportPreview(previewRows);
                setImportErrors(errors);
                setShowImportModal(true);
            } catch {
                showToast("Format CSV/XLSX tidak terbaca. Pastikan format valid!", "⚠️");
            }
        };
        if (isSpreadsheet) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
        e.target.value = ''; // Reset input
    };

    // Execute Stored Procedure Batch Import
    const handleExecuteImportProducts = async () => {
        if (importPreview.length === 0) return;
        try {
            const res = await sp_import_products_batch(importPreview);
            if (res.success) {
                await recordAuditLog({
                    action: 'ITEM_BULK_IMPORT',
                    summary: `Import CSV berhasil: ${res.count} produk ditambahkan/diperbarui secara atomik`,
                    actor: {
                        uid: currentUser?.uid,
                        email: currentUser?.email,
                        displayName: currentUser?.displayName || 'Staf',
                        role: userRole
                    },
                    details: { importedCount: res.count }
                });
                showToast(`${res.count} produk berhasil diimport via SP Transaction!`, "🎉");
                setShowImportModal(false);
                setImportPreview([]);
                setImportErrors([]);
                fetchProducts();
            }
        } catch {
            showToast("Gagal melakukan batch import produk", "⚠️");
        }
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
        <div className="inventory-layout flex flex-col gap-3 xl:grid xl:grid-cols-[minmax(320px,0.88fr)_minmax(0,1.7fr)] xl:gap-5 h-auto overflow-visible pb-12">
            {/* Mobile & Tablet (< xl) View Tab Selector */}
            <div className="xl:hidden flex border-2 border-text rounded-xl overflow-hidden mb-1 shrink-0 bg-white font-title text-xs font-bold shadow-[2px_2px_0px_#181818] w-full">
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
            <div className={`min-w-0 flex flex-col gap-5 h-auto ${activeMobileTab === 'manage' ? 'block' : 'hidden xl:flex'}`}>
                
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

                        {/* Product Image Upload / URL */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[12px] font-bold uppercase">Foto Merch (Opsional)</label>
                            <div className="flex items-center gap-2.5 bg-white border-2 border-text rounded-xl p-2">
                                <div className="w-12 h-12 rounded-lg border-2 border-text/30 bg-yellow-light/25 flex items-center justify-center overflow-hidden shrink-0">
                                    {resolveProductImageUrl(productImg) ? (
                                        <img src={resolveProductImageUrl(productImg)} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <i className="fa-regular fa-image text-text/40 text-lg"></i>
                                    )}
                                </div>
                                <div className="flex flex-col gap-1.5 flex-grow min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <label className="bg-blue-light hover:bg-yellow border border-text rounded-lg px-2.5 py-1 text-[11px] font-title font-bold cursor-pointer">
                                            {imgCompressing ? 'Memproses...' : 'Upload Foto'}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handleImageFileSelect(e.target.files?.[0], setProductImg)}
                                            />
                                        </label>
                                        {productImg && (
                                            <button
                                                type="button"
                                                onClick={() => setProductImg('')}
                                                className="text-[10px] font-bold text-rose-700 hover:underline cursor-pointer"
                                            >
                                                Hapus Foto
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Atau tempel URL gambar (https://...)"
                                        value={productImg.startsWith('data:image/') ? '' : productImg}
                                        onChange={(e) => setProductImg(e.target.value)}
                                        className="border border-text/30 rounded-lg px-2 py-1 text-[11px] outline-none bg-yellow-light/15 w-full"
                                    />
                                </div>
                            </div>
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
                                        type="text"
                                        inputMode="numeric"
                                        required={!hasVariations}
                                        placeholder="Contoh: 45000" 
                                        value={price} 
                                        onChange={(e) => setPrice(sanitizeIntegerInput(e.target.value))}
                                        className="border-2 border-text rounded-xl p-2.5 text-sm outline-none focus:bg-white bg-white font-bold"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[12px] font-bold uppercase">{t.stock || "Stok"}</label>
                                        <button 
                                            type="button" 
                                            onClick={() => setStock('0')}
                                            className="text-[10px] bg-yellow-light hover:bg-yellow border border-text rounded-md px-1.5 py-0.2 font-tag font-extrabold cursor-pointer transition-all shadow-[1px_1px_0px_#181818]"
                                            title="Set stok ke 0"
                                        >
                                            Set 0
                                        </button>
                                    </div>
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
                            <div className="bg-white border-[3px] border-text rounded-2xl p-4 flex flex-col gap-3.5 shadow-[2px_2px_0px_#181818] transition-all duration-350 shrink-0">
                                <div className="flex flex-col gap-2 border-b border-text/15 pb-2.5">
                                    <div className="flex justify-between items-center">
                                        <h5 className="font-title text-[12px] font-bold text-text">Daftar Variasi Item</h5>
                                        <div className="flex items-center gap-1.5">
                                            <button 
                                                type="button" 
                                                onClick={() => setVariationsList(prev => prev.map(v => ({ ...v, stock: '0' })))}
                                                className="text-[10px] bg-yellow-light hover:bg-yellow text-text border border-text px-2 py-0.5 rounded-full font-tag font-extrabold cursor-pointer transition-all shadow-[1px_1px_0px_#181818]"
                                                title="Set semua stok opsi ke 0"
                                            >
                                                Stok 0 Semua
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={handleAddVariationRow}
                                                className="text-[11px] bg-blue-light text-text border-2 border-text px-2.5 py-0.5 rounded-full hover:bg-white font-bold cursor-pointer transition-all shadow-[1px_1px_0px_#181818]"
                                            >
                                                + Tambah Variasi
                                            </button>
                                        </div>
                                    </div>

                                    {/* Pricing Mode Toggle */}
                                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-yellow-light/30 border border-text/20 rounded-xl font-tag text-[10.5px] font-extrabold">
                                        <button
                                            type="button"
                                            onClick={() => setUniformVariantPrice(true)}
                                            className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                                                uniformVariantPrice 
                                                    ? 'bg-yellow text-text border-text shadow-[1px_1px_0px_#181818]' 
                                                    : 'bg-white text-text/70 border-transparent hover:text-text'
                                            }`}
                                        >
                                            Harga Seragam
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setUniformVariantPrice(false)}
                                            className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                                                !uniformVariantPrice 
                                                    ? 'bg-yellow text-text border-text shadow-[1px_1px_0px_#181818]' 
                                                    : 'bg-white text-text/70 border-transparent hover:text-text'
                                            }`}
                                        >
                                            Harga Beda Tiap Opsi
                                        </button>
                                    </div>

                                    {/* Master Uniform Price Input */}
                                    {uniformVariantPrice && (
                                        <div className="bg-pink-light/30 border-2 border-dashed border-pink/60 rounded-xl p-2.5 flex items-center gap-2.5">
                                            <div className="flex-grow flex flex-col gap-0.5">
                                                <label className="text-[10px] font-bold uppercase text-text/80">Harga Semua Opsi (Rp)</label>
                                                <input 
                                                    type="text"
                                                    inputMode="numeric"
                                                    required={hasVariations && uniformVariantPrice}
                                                    placeholder="Contoh: 7000"
                                                    value={masterVariantPrice}
                                                    onChange={(e) => setMasterVariantPrice(sanitizeIntegerInput(e.target.value))}
                                                    className="border-2 border-text rounded-lg p-1 text-xs outline-none bg-white font-title font-bold"
                                                />
                                            </div>
                                            <div className="w-[110px] flex flex-col gap-0.5">
                                                <label className="text-[10px] font-bold uppercase text-pink">Diskon (Rp)</label>
                                                <input 
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="0"
                                                    value={masterVariantDiscount}
                                                    onChange={(e) => setMasterVariantDiscount(sanitizeIntegerInput(e.target.value))}
                                                    className="border-2 border-pink/50 rounded-lg p-1 text-xs outline-none bg-white font-bold"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="max-h-[220px] overflow-y-auto flex flex-col gap-3 pr-1">
                                    {variationsList.map((row, idx) => (
                                        <div key={idx} className="flex flex-col gap-1.5 bg-yellow-light/20 border border-text/10 rounded-xl p-2.5 relative">
                                            <div className="flex gap-2 items-center">
                                                <div className="flex flex-col gap-1 flex-grow">
                                                    <input 
                                                        type="text" 
                                                        placeholder="Nama (e.g. Merah / Till)" 
                                                        required={hasVariations}
                                                        value={row.name}
                                                        onChange={(e) => handleVariationRowChange(idx, 'name', e.target.value)}
                                                        className="border-2 border-text rounded-lg p-1.5 text-xs outline-none bg-white font-bold"
                                                    />
                                                </div>

                                                {!uniformVariantPrice && (
                                                    <div className="flex flex-col gap-1 w-[95px] sm:w-[110px]">
                                                        <input 
                                                            type="text"
                                                            inputMode="numeric"
                                                            placeholder="Harga" 
                                                            required={hasVariations && !uniformVariantPrice}
                                                            value={row.price}
                                                            onChange={(e) => handleVariationRowChange(idx, 'price', sanitizeIntegerInput(e.target.value))}
                                                            className="border-2 border-text rounded-lg p-1.5 text-xs outline-none bg-white font-title font-bold"
                                                        />
                                                    </div>
                                                )}

                                                <div className="flex flex-col gap-1 w-[70px] sm:w-[85px]">
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

                                            {!uniformVariantPrice && (
                                                <div className="flex items-center gap-1.5 pl-0.5">
                                                    <i className="fa-solid fa-tag text-[9px] text-pink"></i>
                                                    <input 
                                                        type="text"
                                                        inputMode="numeric"
                                                        placeholder="Diskon (Rp)" 
                                                        value={row.discount}
                                                        onChange={(e) => handleVariationRowChange(idx, 'discount', sanitizeIntegerInput(e.target.value))}
                                                        className="border-2 border-pink/40 rounded-lg p-0.5 text-[10px] outline-none bg-pink-light/15 font-bold w-[90px] focus:border-pink"
                                                    />
                                                    {toIntRupiah(row.discount) > 0 && toIntRupiah(row.price) > 0 && (
                                                        <span className="text-[9px] text-pink font-bold">→ {formatPrice(Math.max(0, toIntRupiah(row.price) - toIntRupiah(row.discount)))}</span>
                                                    )}
                                                </div>
                                            )}
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
                <div className="manage-category-card bg-pink-light/30 border-[2.5px] border-text rounded-2xl shadow-card p-5 relative shrink-0">
                    <div className="washi-tape tape-yellow-1 absolute top-[-10px] left-10 transform rotate-[-2deg] h-5 w-24 bg-pink border-l border-r border-dashed border-text/25"></div>
                        
                    <h3 className="pane-title font-title text-base text-text mb-4 title-stroke">
                        <i className="fa-solid fa-tags text-pink"></i> Kelola Kategori Produk
                    </h3>

                    <div className="flex flex-col gap-3.5 text-text font-body">
                        {/* List of current categories */}
                        <div className="bg-white border-2 border-text rounded-xl p-3 flex flex-col gap-2 shadow-[2px_2px_0px_#181818]">
                            <h5 className="font-title text-[11px] font-bold text-text border-b border-text/10 pb-1.5 flex justify-between items-center">
                                <span>📋 Daftar Kategori Saat Ini</span>
                            </h5>
                            <div className="max-h-[140px] overflow-y-auto flex flex-col gap-1.5 pr-1">
                                {categories.length === 0 ? (
                                    <div className="text-center py-4 text-xs font-bold text-text/50 border border-dashed border-text/20 rounded-lg bg-yellow-light/20">
                                        <span>Belum ada kategori tersimpan. Tambahkan di bawah!</span>
                                    </div>
                                ) : (
                                    categories.map(cat => (
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
                                    ))
                                )}
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

            {/* Right Column: Inventory List Card (Retro OS Window) */}
            <div className={`inventory-card min-w-0 bg-white border-[3px] border-text rounded-2xl shadow-pop overflow-hidden flex flex-col h-auto relative ${activeMobileTab === 'list' ? 'block' : 'hidden xl:flex'}`}>
                <div className="retro-window-header bg-blue border-b-[2.5px] border-text px-3.5 py-2 flex items-center justify-between">
                    <div className="retro-dots flex items-center gap-1.5">
                        <span className="retro-dot retro-dot-red"></span>
                        <span className="retro-dot retro-dot-yellow"></span>
                        <span className="retro-dot retro-dot-blue"></span>
                        <span className="font-tag text-[10px] font-black uppercase tracking-wider text-text ml-1.5">Katalog & Stok</span>
                    </div>
                    <span className="text-[10px] font-tag font-black uppercase bg-yellow px-2 py-0.5 rounded border border-text shadow-[1px_1px_0px_#171717]">{products.length} SKU</span>
                </div>
                
                <div className="p-4 sm:p-5 flex flex-col flex-grow bg-[#FFFDF9]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <h3 className="pane-title font-title text-xl text-text title-stroke flex items-center gap-2">
                        <span className="bg-yellow text-text text-sm p-1.5 rounded-lg border border-text shadow-[1.5px_1.5px_0px_#171717]">📦</span>
                        <span>{t.inventory || "Stok Barang"}</span>
                    </h3>

                    {/* Quick Action Toolbar: CSV/XLSX Import, Export Stok, Template, Empty Slot */}
                    <div className="flex flex-wrap items-center gap-2">
                        <label 
                            className="btn bg-pink text-text border-2 border-text rounded-full px-3 py-1.5 text-xs font-title font-bold shadow-[2px_2px_0px_#181818] hover:bg-white hover:translate-y-[-1px] active:translate-y-[1px] transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Import produk via file CSV atau XLSX"
                        >
                            <i className="fa-solid fa-file-import"></i> Import CSV/XLSX
                            <input 
                                type="file" 
                                accept=".csv,.xlsx,.xls" 
                                onChange={handleCsvFileUpload} 
                                className="hidden" 
                            />
                        </label>

                        <button 
                            type="button"
                            onClick={handleExportStockXlsx}
                            className="btn bg-emerald-100 text-emerald-900 border-2 border-text rounded-full px-3 py-1.5 text-xs font-title font-bold shadow-[2px_2px_0px_#181818] hover:bg-white hover:translate-y-[-1px] active:translate-y-[1px] transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Export seluruh stok saat ini ke .xlsx"
                        >
                            <i className="fa-solid fa-file-export"></i> Export Stok
                        </button>

                        <button 
                            type="button"
                            onClick={handleDownloadItemsTemplate}
                            className="btn bg-yellow text-text border-2 border-text rounded-full px-3 py-1.5 text-xs font-title font-bold shadow-[2px_2px_0px_#181818] hover:bg-white hover:translate-y-[-1px] active:translate-y-[1px] transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Unduh format spreadsheet .xlsx"
                        >
                            <i className="fa-solid fa-file-excel"></i> Template XLSX
                        </button>

                        <button 
                            type="button"
                            onClick={handleAddEmptySlot}
                            className="btn bg-blue-light text-text border-2 border-text rounded-full px-3 py-1.5 text-xs font-title font-bold shadow-[2px_2px_0px_#181818] hover:bg-white hover:translate-y-[-1px] active:translate-y-[1px] transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Buat placeholder slot kosong baru"
                        >
                            <i className="fa-solid fa-square-plus"></i> + Empty Slot
                        </button>
                    </div>
                </div>

                {/* Search, Filter, Sort & View Controls */}
                <div className="bg-yellow-light/30 border-2 border-text rounded-xl p-3 mb-3.5 flex flex-col gap-2.5 shrink-0 shadow-[2px_2px_0px_#181818]">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        {/* Search Input */}
                        <div className="sm:col-span-4 relative flex items-center">
                            <i className="fa-solid fa-magnifying-glass absolute left-3 text-text/60 text-xs"></i>
                            <input 
                                type="text"
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                placeholder="Cari nama atau kode SKU..."
                                className="w-full border-2 border-text rounded-xl py-1.5 pl-8 pr-3 text-xs outline-none bg-white font-medium focus:bg-yellow-light/20"
                            />
                            {searchTerm && (
                                <button 
                                    onClick={() => setSearchTerm('')} 
                                    className="absolute right-2.5 text-xs text-text/50 hover:text-pink"
                                >
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            )}
                        </div>

                        {/* Category Filter */}
                        <div className="sm:col-span-4">
                            <select 
                                value={filterCategory}
                                onChange={(e) => { setFilterCategory(e.target.value); setCurrentPage(1); }}
                                className="w-full border-2 border-text rounded-xl py-1.5 px-2 text-xs outline-none bg-white font-title font-bold cursor-pointer"
                            >
                                <option value="all">Semua Kategori</option>
                                {categories.map(c => (
                                    <option key={c} value={c}>{getCategoryDisplayLabel(c)}</option>
                                ))}
                            </select>
                        </div>

                        {/* Sort Order Selector */}
                        <div className="sm:col-span-4">
                            <select 
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="w-full border-2 border-text rounded-xl py-1.5 px-2 text-xs outline-none bg-white font-title font-bold cursor-pointer"
                            >
                                <option value="name_asc">Urutkan: Nama (A-Z)</option>
                                <option value="name_desc">Urutkan: Nama (Z-A)</option>
                                <option value="price_asc">Urutkan: Harga Terendah</option>
                                <option value="price_desc">Urutkan: Harga Tertinggi</option>
                                <option value="stock_asc">Urutkan: Stok Tersedikit</option>
                                <option value="stock_desc">Urutkan: Stok Terbanyak</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-dashed border-text/15 text-xs">
                        {/* Visibility Pill Filters */}
                        <div className="flex flex-wrap items-center gap-1.5 font-tag font-bold">
                            <span className="text-[10px] text-text/60 uppercase mr-1">Visibilitas:</span>
                            <button
                                onClick={() => { setFilterVisibility('all'); setCurrentPage(1); }}
                                className={`px-2.5 py-0.5 rounded-full border text-[10px] cursor-pointer transition-all ${
                                    filterVisibility === 'all' ? 'bg-yellow text-text border-text font-black shadow-[1px_1px_0px_#181818]' : 'bg-white text-text/70 border-text/30 hover:border-text'
                                }`}
                            >
                                Semua
                            </button>
                            <button
                                onClick={() => { setFilterVisibility('visible'); setCurrentPage(1); }}
                                className={`px-2.5 py-0.5 rounded-full border text-[10px] cursor-pointer transition-all ${
                                    filterVisibility === 'visible' ? 'bg-emerald-100 text-emerald-800 border-text font-black shadow-[1px_1px_0px_#181818]' : 'bg-white text-text/70 border-text/30 hover:border-text'
                                }`}
                            >
                                Visible
                            </button>
                            <button
                                onClick={() => { setFilterVisibility('hidden'); setCurrentPage(1); }}
                                className={`px-2.5 py-0.5 rounded-full border text-[10px] cursor-pointer transition-all ${
                                    filterVisibility === 'hidden' ? 'bg-pink text-text border-text font-black shadow-[1px_1px_0px_#181818]' : 'bg-white text-text/70 border-text/30 hover:border-text'
                                }`}
                            >
                                Hidden
                            </button>

                            <span className="text-[10px] text-text/60 uppercase ml-2 mr-1">Kesehatan Stok:</span>
                            <button
                                onClick={() => { setFilterStockHealth('all'); setCurrentPage(1); }}
                                className={`px-2.5 py-0.5 rounded-full border text-[10px] cursor-pointer transition-all ${
                                    filterStockHealth === 'all' ? 'bg-blue-light text-text border-text font-black shadow-[1px_1px_0px_#181818]' : 'bg-white text-text/70 border-text/30 hover:border-text'
                                }`}
                            >
                                Semua ({products.length})
                            </button>
                            <button
                                onClick={() => { setFilterStockHealth('low'); setCurrentPage(1); }}
                                className={`px-2.5 py-0.5 rounded-full border text-[10px] cursor-pointer transition-all ${
                                    filterStockHealth === 'low' ? 'bg-yellow text-text border-text font-black shadow-[1px_1px_0px_#181818]' : 'bg-white text-amber-800 border-amber-400 hover:border-text'
                                }`}
                            >
                                Tipis ({stockSummary.lowCount})
                            </button>
                            <button
                                onClick={() => { setFilterStockHealth('out'); setCurrentPage(1); }}
                                className={`px-2.5 py-0.5 rounded-full border text-[10px] cursor-pointer transition-all ${
                                    filterStockHealth === 'out' ? 'bg-rose-200 text-rose-950 border-text font-black shadow-[1px_1px_0px_#181818]' : 'bg-white text-rose-700 border-rose-400 hover:border-text'
                                }`}
                            >
                                Habis ({stockSummary.outCount})
                            </button>
                        </div>

                        {/* Page Size Selector */}
                        <div className="flex items-center gap-1.5 font-tag font-bold ml-auto">
                            <span className="text-[10px] text-text/60 uppercase">Tampilkan:</span>
                            {[20, 40, 60].map(sz => (
                                <button
                                    key={sz}
                                    onClick={() => { setPageSize(sz); setCurrentPage(1); }}
                                    className={`px-2 py-0.5 rounded border text-[10px] cursor-pointer transition-all ${
                                        pageSize === sz ? 'bg-pink text-white border-text font-black shadow-[1px_1px_0px_#181818]' : 'bg-white text-text border-text/30 hover:border-text'
                                    }`}
                                >
                                    {sz}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

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

                <div className="table-container flex-grow pb-4">
                    {loading ? (
                        <div className="text-center py-12 font-bold text-text/60">{t.loadingProducts}</div>
                    ) : (
                        <>
                            {/* 1. Mobile Card List (< md) */}
                            <div className="block md:hidden space-y-3">
                                {paginatedProducts.length === 0 ? (
                                    <div className="border-2 border-dashed border-text/30 rounded-xl p-8 text-center text-text/60 text-xs font-bold bg-yellow-light/20">
                                        {products.length === 0 ? 'Belum ada produk di katalog stok.' : 'Tidak ada produk yang cocok dengan filter.'}
                                    </div>
                                ) : (
                                    paginatedProducts.map(prod => (
                                        <ProductCardMobile
                                            key={prod.id}
                                            product={prod}
                                            selected={selectedProducts.includes(prod.id)}
                                            onSelect={(checked) => {
                                                if (checked) {
                                                    setSelectedProducts(prev => [...prev, prod.id]);
                                                } else {
                                                    setSelectedProducts(prev => prev.filter(id => id !== prod.id));
                                                }
                                            }}
                                            onRestock={(varName) => handleRestockClick(prod, varName)}
                                            onEdit={() => handleOpenEditModal(prod)}
                                            onDelete={() => handleDelete(prod.id)}
                                            onToggleVisibility={() => handleToggleCatalogueVisibility(prod)}
                                            expanded={expandedProductId === prod.id}
                                            onToggleExpand={() => setExpandedProductId(expandedProductId === prod.id ? null : prod.id)}
                                            formatPrice={formatPrice}
                                            getCategoryDisplayLabel={getCategoryDisplayLabel}
                                        />
                                    ))
                                )}
                            </div>

                            {/* 2. Desktop & Tablet Table (>= md) */}
                            <div className="hidden md:block border-2 border-text rounded-xl overflow-x-auto overflow-y-auto max-h-[680px] bg-white">
                                <table className="history-table w-full min-w-[640px] border-collapse text-left text-[13px] text-text">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-blue-light border-b-2 border-text font-title font-bold">
                                    <th className="p-2.5 w-10 text-center">
                                        <input 
                                            type="checkbox" 
                                            checked={processedProducts.length > 0 && processedProducts.every(p => selectedProducts.includes(p.id))} 
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedProducts(processedProducts.map(p => p.id));
                                                } else {
                                                    setSelectedProducts([]);
                                                }
                                            }}
                                            className="w-4 h-4 cursor-pointer accent-pink"
                                        />
                                    </th>
                                    <th className="p-2.5 w-[135px] whitespace-nowrap">{t.code || "Kode"}</th>
                                    <th className="p-2.5 min-w-[180px]">{t.name || "Nama"}</th>
                                    <th className="p-2.5 w-[105px] whitespace-nowrap">{t.price || "Harga"}</th>
                                    <th className="p-2.5 w-[85px] whitespace-nowrap">{t.stock || "Stok"}</th>
                                    <th className="p-2.5 w-[195px] text-center whitespace-nowrap">{t.actions || "Aksi"}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedProducts.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="p-10 text-center text-text/60 bg-yellow-light/15">
                                            <div className="flex flex-col items-center gap-1.5">
                                                <i className="fa-solid fa-box-open text-2xl text-text/35"></i>
                                                <span className="font-title font-bold text-sm text-text/75">
                                                    {products.length === 0 ? 'Belum ada produk di stok barang' : 'Tidak ada produk yang cocok dengan filter'}
                                                </span>
                                                <span className="text-[11px] text-text/55">
                                                    {products.length === 0 ? 'Tambahkan produk lewat panel kiri atau import CSV/XLSX.' : 'Coba ubah kata kunci pencarian atau filter di atas.'}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                paginatedProducts.map(prod => {
                                    const isLowStock = prod.stock <= 5;
                                    const hasVars = prod.variations && prod.variations.length > 0;
                                    const isExpanded = expandedProductId === prod.id;

                                    return (
                                        <Fragment key={prod.id}>
                                            <tr className={`hover:bg-yellow-light border-b border-text/15 ${isLowStock ? 'bg-pink-light/30' : ''} ${hasVars ? 'cursor-pointer' : ''}`}
                                                onClick={() => hasVars && setExpandedProductId(isExpanded ? null : prod.id)}
                                            >
                                                {/* Select Checkbox */}
                                                <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
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
                                                <td className="p-2.5 font-bold text-[11px] whitespace-nowrap">
                                                    {prod.id}
                                                    {prod.tag && (
                                                        <span className="block text-[9px] font-normal opacity-70 truncate max-w-[120px]">
                                                            Tag: {prod.tag}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-2.5 font-bold">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        {resolveProductImageUrl(prod.img) ? (
                                                            <img
                                                                src={resolveProductImageUrl(prod.img)}
                                                                alt={prod.name}
                                                                loading="lazy"
                                                                decoding="async"
                                                                className="w-9 h-9 rounded-lg border border-text object-cover shrink-0 bg-white"
                                                            />
                                                        ) : (
                                                            <div className="w-9 h-9 rounded-lg border border-dashed border-text/30 bg-yellow-light/20 flex items-center justify-center shrink-0 text-text/35">
                                                                <i className="fa-regular fa-image text-xs"></i>
                                                            </div>
                                                        )}
                                                        <div className="flex flex-col gap-0.5 min-w-0">
                                                            <span className="truncate">{prod.name}</span>
                                                            {hasVars && (
                                                                <span className="text-[10px] text-blue font-title">
                                                                    {isExpanded ? "▼ Sembunyikan Variasi" : `▶ Lihat ${prod.variations.length} Variasi`}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-2.5 font-title text-[12px] font-bold text-text whitespace-nowrap">
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
                                                <td className="p-2.5 font-bold whitespace-nowrap">
                                                    <span className={`px-2 py-0.5 rounded-full border ${
                                                        isLowStock ? 'bg-pink border-text text-text text-[10px]' : 'bg-transparent border-transparent'
                                                    }`}>
                                                        {prod.stock} {isLowStock && `! ${t.lowStock || 'Tipis!'}`}
                                                    </span>
                                                </td>
                                                <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex justify-center items-center gap-1.5 whitespace-nowrap">
                                                        {/* Hide from Catalogue Toggle */}
                                                        <button 
                                                            onClick={() => handleToggleCatalogueVisibility(prod)}
                                                            title={prod.hiddenFromCatalogue ? "Tampilkan di katalog POS" : "Sembunyikan dari katalog POS"}
                                                            className={`btn border-2 border-text rounded-full font-title text-[10px] px-2 py-1 cursor-pointer shadow-[1px_1px_0px_#181818] transition-all flex items-center gap-1 ${
                                                                prod.hiddenFromCatalogue ? 'bg-pink text-text hover:bg-white' : 'bg-white text-text hover:bg-yellow-light'
                                                            }`}
                                                        >
                                                            <i className={`fa-solid ${prod.hiddenFromCatalogue ? 'fa-eye-slash text-rose-700' : 'fa-eye text-emerald-700'}`}></i>
                                                            <span>{prod.hiddenFromCatalogue ? "Hidden" : "Visible"}</span>
                                                        </button>

                                                        {/* Restock Button (Hidden for variations as they restock individually inside expansion) */}
                                                        {!hasVars && (
                                                            <button 
                                                                onClick={() => handleRestockClick(prod)}
                                                                title="Isi / sesuaikan stok barang"
                                                                className="btn bg-yellow text-text border-2 border-text rounded-full font-title text-[10px] px-2.5 py-1 hover:bg-white cursor-pointer shadow-[1px_1px_0px_#181818] transition-all flex items-center gap-1"
                                                            >
                                                                <i className="fa-solid fa-box-open"></i> Stok
                                                            </button>
                                                        )}

                                                        {/* Edit Button */}
                                                        <button 
                                                            onClick={() => handleOpenEditModal(prod)}
                                                            title="Edit produk"
                                                            className="btn bg-blue-light text-text border-2 border-text rounded-full font-title text-[10px] px-2.5 py-1 hover:bg-white cursor-pointer shadow-[1px_1px_0px_#181818] transition-all flex items-center gap-1"
                                                        >
                                                            <i className="fa-solid fa-pen-to-square"></i> Edit
                                                        </button>
                                                        
                                                        {/* Delete Button */}
                                                        <button 
                                                            onClick={() => handleDelete(prod.id)}
                                                            title="Hapus produk"
                                                            className="btn bg-white text-pink border-2 border-text rounded-full font-title text-[10px] px-2 py-1 hover:bg-pink-light cursor-pointer shadow-[1px_1px_0px_#181818] transition-all flex items-center gap-1"
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
                                                        <div className="bg-white border-2 border-text rounded-xl p-3 shadow-[3px_3px_0px_#181818] ml-8 my-2 max-w-[500px]">
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
                                                                                className="btn bg-yellow text-text border-2 border-text rounded-full font-title text-[9px] px-2.5 py-0.5 hover:bg-white cursor-pointer shadow-[1px_1px_0px_#181818] transition-all flex items-center gap-1"
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
                                        </Fragment>
                                    );
                                })
                                )}
                            </tbody>
                        </table>
                            </div>

                            {/* Pagination Controls Bar */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-3 border-t-2 border-text/10 shrink-0 font-body text-xs">
                                <span className="text-text/70">
                                    Menampilkan <strong>{processedProducts.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}</strong> - <strong>{Math.min(safeCurrentPage * pageSize, processedProducts.length)}</strong> dari <strong>{processedProducts.length}</strong> produk
                                </span>

                                <div className="flex items-center gap-1.5 font-tag font-bold">
                                    <button
                                        type="button"
                                        disabled={safeCurrentPage <= 1}
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        className={`px-3 py-1.5 rounded-lg border-2 border-text transition-all ${
                                            safeCurrentPage <= 1 
                                                ? 'bg-gray-100 text-gray-500 border-gray-400 opacity-75 cursor-not-allowed' 
                                                : 'bg-white text-text hover:bg-yellow shadow-[1.5px_1.5px_0px_#181818] active:translate-y-[1px] cursor-pointer'
                                        }`}
                                    >
                                        <i className="fa-solid fa-chevron-left text-[10px]"></i> Sebelumnya
                                    </button>

                                    <span className="bg-yellow-light border border-text px-3 py-1.5 rounded-lg font-bold">
                                        Hal {safeCurrentPage} / {totalPages}
                                    </span>

                                    <button
                                        type="button"
                                        disabled={safeCurrentPage >= totalPages}
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        className={`px-3 py-1.5 rounded-lg border-2 border-text transition-all ${
                                            safeCurrentPage >= totalPages 
                                                ? 'bg-gray-100 text-gray-500 border-gray-400 opacity-75 cursor-not-allowed' 
                                                : 'bg-white text-text hover:bg-yellow shadow-[1.5px_1.5px_0px_#181818] active:translate-y-[1px] cursor-pointer'
                                        }`}
                                    >
                                        Berikutnya <i className="fa-solid fa-chevron-right text-[10px]"></i>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
                </div>
            </div>

            {/* Custom Unified Stock Adjust Modal overlay (Add / Subtract / Opname) */}
            {restockTarget && (
                <div className="fixed inset-0 bg-[#181818]/50 backdrop-blur-sm z-[10001] flex justify-center items-center p-4 animate-[fade_0.2s_ease]">
                    <div className="bg-white border-[3px] border-text rounded-2xl shadow-card w-[94vw] max-w-[380px] overflow-hidden flex flex-col p-5 text-text relative">
                        <div className="washi-tape tape-yellow-1 absolute top-[-10px] left-10 transform rotate-[-4deg] h-6 w-24 bg-pink-light"></div>
                        
                        <div className="w-full flex justify-between items-center border-b border-text/10 pb-2.5 mb-3 border-dashed">
                            <span className="font-title text-base font-bold text-center w-full">Kelola Stok Barang</span>
                            <button 
                                onClick={() => setRestockTarget(null)}
                                className="absolute right-4 text-text hover:text-pink transition-transform hover:scale-110 cursor-pointer"
                            >
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>
                        
                        <div className="text-center mb-3">
                            <h4 className="font-title text-sm font-bold text-text mb-1">{restockTarget.product.name}</h4>
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                {restockTarget.variationName && (
                                    <span className="bg-blue-light border border-text/25 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                                        Variasi: {restockTarget.variationName}
                                    </span>
                                )}
                                <span className="bg-yellow-light border border-text/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                                    Stok Saat Ini: {
                                        restockTarget.variationName
                                            ? (restockTarget.product.variations?.find(v => v.name === restockTarget.variationName)?.stock || 0)
                                            : (restockTarget.product.stock || 0)
                                    } pcs
                                </span>
                            </div>
                        </div>

                        {/* Mode Selector Tabs */}
                        <div className="grid grid-cols-3 gap-1.5 p-1 bg-yellow-light/40 border-2 border-text rounded-xl mb-3 font-tag text-[10px] font-extrabold">
                            {[
                                { id: 'add', label: '+ Tambah' },
                                { id: 'sub', label: '- Kurangi' },
                                { id: 'set', label: '= Set Opname' }
                            ].map(m => (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => {
                                        setStockAdjustMode(m.id);
                                        setStockAdjustReason(m.id === 'add' ? 'Restok' : m.id === 'sub' ? 'Rusak / Freebie' : 'Stock Opname');
                                    }}
                                    className={`py-1.5 rounded-lg border cursor-pointer transition-all ${
                                        stockAdjustMode === m.id
                                            ? 'bg-yellow text-text border-text shadow-[1px_1px_0px_#181818]'
                                            : 'bg-white text-text/70 border-transparent hover:text-text'
                                    }`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleRestockSubmit} className="w-full flex flex-col gap-3">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] font-bold uppercase text-text/80">
                                    {stockAdjustMode === 'add' ? 'Jumlah Tambahan (+)' : stockAdjustMode === 'sub' ? 'Jumlah Pengurangan (-)' : 'Set Stok Akhir (=)'}
                                </label>
                                <input 
                                    type="number" 
                                    required
                                    min={stockAdjustMode === 'set' ? '0' : '1'}
                                    value={restockAmount}
                                    onChange={(e) => setRestockAmount(e.target.value)}
                                    className="border-2 border-text rounded-xl p-2 outline-none bg-white font-bold text-center text-lg focus:bg-yellow-light"
                                />
                                <div className="flex justify-center gap-1.5 flex-wrap">
                                    {(stockAdjustMode === 'set' ? [0, 5, 10, 25, 50] : [1, 5, 10, 25, 50]).map(preset => (
                                        <button
                                            key={preset}
                                            type="button"
                                            onClick={() => setRestockAmount(String(preset))}
                                            className="text-[10px] font-tag font-bold bg-blue-light/50 hover:bg-yellow border border-text rounded-lg px-2.5 py-0.5 cursor-pointer"
                                        >
                                            {stockAdjustMode === 'set' ? `=${preset}` : stockAdjustMode === 'sub' ? `-${preset}` : `+${preset}`}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10.5px] font-bold uppercase text-text/70">Catatan / Alasan (Tercatat di Audit)</label>
                                <input
                                    type="text"
                                    value={stockAdjustReason}
                                    onChange={(e) => setStockAdjustReason(e.target.value)}
                                    placeholder="Restok / Opname / Freebie / Rusak"
                                    className="border-2 border-text rounded-xl px-3 py-1.5 text-xs outline-none bg-white font-medium focus:bg-yellow-light/20"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-1">
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

            {/* Edit Product Modal overlay (Wide 2-Column Responsive Layout) */}
            {editingProduct && (
                <div className="fixed inset-0 bg-[#181818]/60 backdrop-blur-sm z-[10001] flex justify-center items-center p-3 sm:p-5 animate-[fade_0.2s_ease]">
                    <div className="bg-white border-[3px] border-text rounded-2xl shadow-card w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-4 sm:p-6 text-text relative">
                        <div className="washi-tape tape-yellow-1 absolute top-[-10px] left-10 transform rotate-[-3deg] h-6 w-28 bg-pink-light"></div>
                        
                        <div className="w-full flex justify-between items-center border-b-2 border-text/10 pb-3 mb-4 border-dashed shrink-0">
                            <span className="font-title text-base sm:text-lg font-bold flex items-center gap-2">
                                <i className="fa-solid fa-pen-to-square text-pink"></i>
                                <span>Edit Detail Barang • <span className="font-mono text-xs text-text/60">{editingProduct.id}</span></span>
                            </span>
                            <button 
                                onClick={() => setEditingProduct(null)}
                                className="text-text hover:text-pink transition-transform hover:scale-110 cursor-pointer p-1"
                            >
                                <i className="fa-solid fa-xmark text-xl"></i>
                            </button>
                        </div>
                        
                        <form onSubmit={handleEditSubmit} className="w-full flex flex-col flex-grow overflow-hidden">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 flex-grow overflow-y-auto pr-1 pb-2">
                                {/* Left Column: Core Metadata */}
                                <div className="flex flex-col gap-3">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[11px] font-bold uppercase text-text/60">Kode Barang</label>
                                        <input 
                                            type="text" 
                                            disabled
                                            value={editingProduct.id} 
                                            className="border-2 border-text rounded-xl p-2.5 text-xs bg-text/5 text-text/50 font-bold outline-none cursor-not-allowed select-none"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <label className="text-[11px] font-bold uppercase text-text/80">Nama Barang</label>
                                        <input 
                                            type="text" 
                                            required 
                                            value={editingProduct.name}
                                            onChange={(e) => setEditingProduct(prev => ({ ...prev, name: e.target.value }))}
                                            className="border-2 border-text rounded-xl p-2.5 text-xs outline-none bg-white font-bold focus:bg-yellow-light/30"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[11px] font-bold uppercase text-text/80">Kategori</label>
                                            <select 
                                                value={editingProduct.category} 
                                                onChange={(e) => setEditingProduct(prev => ({ ...prev, category: e.target.value }))}
                                                className="border-2 border-text rounded-xl p-2 text-xs outline-none bg-white font-title cursor-pointer"
                                            >
                                                {categories.map(cat => (
                                                    <option key={cat} value={cat}>{getCategoryDisplayLabel(cat)}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <label className="text-[11px] font-bold uppercase text-text/80">Tag</label>
                                            <input 
                                                type="text" 
                                                placeholder="BARU / TERLARIS" 
                                                value={editingProduct.tag}
                                                onChange={(e) => setEditingProduct(prev => ({ ...prev, tag: e.target.value }))}
                                                className="border-2 border-text rounded-xl p-2 text-xs outline-none bg-white"
                                            />
                                        </div>
                                    </div>

                                    {/* Edit Image Upload / URL */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[11px] font-bold uppercase text-text/80">Foto Merch (Opsional)</label>
                                        <div className="flex items-center gap-2.5 bg-yellow-light/15 border-2 border-text/30 rounded-xl p-2">
                                            <div className="w-12 h-12 rounded-lg border-2 border-text/30 bg-white flex items-center justify-center overflow-hidden shrink-0">
                                                {resolveProductImageUrl(editingProduct.img) ? (
                                                    <img src={resolveProductImageUrl(editingProduct.img)} alt={editingProduct.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <i className="fa-regular fa-image text-text/40 text-lg"></i>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-1 flex-grow min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <label className="bg-blue-light hover:bg-yellow border border-text rounded-lg px-2.5 py-0.5 text-[10.5px] font-title font-bold cursor-pointer">
                                                        {imgCompressing ? 'Memproses...' : (resolveProductImageUrl(editingProduct.img) ? 'Ganti Foto' : 'Upload Foto')}
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={(e) => handleImageFileSelect(e.target.files?.[0], (url) => setEditingProduct(prev => ({ ...prev, img: url })))}
                                                        />
                                                    </label>
                                                    {resolveProductImageUrl(editingProduct.img) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditingProduct(prev => ({ ...prev, img: '' }))}
                                                            className="text-[10px] font-bold text-rose-700 hover:underline cursor-pointer"
                                                        >
                                                            Hapus Foto
                                                        </button>
                                                    )}
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="Atau tempel URL gambar (https://...)"
                                                    value={(editingProduct.img || '').startsWith('data:image/') || editingProduct.img === 'assets/mascot.png' ? '' : (editingProduct.img || '')}
                                                    onChange={(e) => setEditingProduct(prev => ({ ...prev, img: e.target.value }))}
                                                    className="border border-text/30 rounded-lg px-2 py-1 text-[11px] outline-none bg-white w-full"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Hide from Catalogue Toggle */}
                                    <div className="flex items-center gap-2 py-1 bg-yellow-light/30 border border-text/15 rounded-xl px-3 mt-1">
                                        <input 
                                            type="checkbox" 
                                            id="edit-hidden-from-catalogue" 
                                            checked={editingProduct.hiddenFromCatalogue} 
                                            onChange={(e) => setEditingProduct(prev => ({ 
                                                ...prev, 
                                                hiddenFromCatalogue: e.target.checked 
                                            }))}
                                            className="w-4 h-4 accent-pink border-2 border-text rounded cursor-pointer"
                                        />
                                        <label htmlFor="edit-hidden-from-catalogue" className="text-xs font-bold cursor-pointer select-none flex items-center gap-1.5">
                                            <i className="fa-solid fa-eye-slash text-pink"></i>
                                            <span>Sembunyikan dari katalog kasir POS</span>
                                        </label>
                                    </div>

                                    {/* Variations Checkbox */}
                                    <div className="flex items-center gap-2 py-1 bg-blue-light/30 border border-text/15 rounded-xl px-3">
                                        <input 
                                            type="checkbox" 
                                            id="edit-has-variations" 
                                            checked={editingProduct.hasVariations} 
                                            onChange={(e) => setEditingProduct(prev => ({ 
                                                ...prev, 
                                                hasVariations: e.target.checked,
                                                variationsList: prev.variationsList && prev.variationsList.length > 0 ? prev.variationsList : [{ name: '', price: '', stock: '10', discount: '0' }]
                                            }))}
                                            className="w-4 h-4 accent-pink border-2 border-text rounded cursor-pointer"
                                        />
                                        <label htmlFor="edit-has-variations" className="text-xs font-bold cursor-pointer select-none">
                                            Memiliki variasi produk? (Contoh: Warna, Ukuran)
                                        </label>
                                    </div>

                                    {/* Base Price & Stock (Only if NO variations) */}
                                    {!editingProduct.hasVariations && (
                                        <div className="bg-yellow-light/20 border-2 border-text/15 rounded-xl p-3 flex flex-col gap-2.5 mt-1">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-[10px] font-bold uppercase text-text/80">Harga (Rp)</label>
                                                    <input 
                                                        type="text"
                                                        inputMode="numeric"
                                                        required={!editingProduct.hasVariations}
                                                        value={editingProduct.price}
                                                        onChange={(e) => setEditingProduct(prev => ({ ...prev, price: sanitizeIntegerInput(e.target.value) }))}
                                                        className="border-2 border-text rounded-xl p-2 text-xs outline-none bg-white font-bold"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex justify-between items-center">
                                                        <label className="text-[10px] font-bold uppercase text-text/80">Stok</label>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setEditingProduct(prev => ({ ...prev, stock: '0' }))}
                                                            className="text-[9px] bg-yellow-light hover:bg-yellow border border-text rounded px-1.5 py-0.2 font-tag font-extrabold cursor-pointer transition-all shadow-[1px_1px_0px_#181818]"
                                                            title="Set stok ke 0"
                                                        >
                                                            Set 0
                                                        </button>
                                                    </div>
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

                                            <div className="flex flex-col gap-1">
                                                <label className="text-[10px] font-bold uppercase text-pink">Diskon per Item (Rp)</label>
                                                <input 
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={editingProduct.discount}
                                                    onChange={(e) => setEditingProduct(prev => ({ ...prev, discount: sanitizeIntegerInput(e.target.value) }))}
                                                    placeholder="0"
                                                    className="border-2 border-pink/60 rounded-xl p-2 text-xs outline-none bg-white font-bold"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right Column: Dedicated Wide Variations Workspace */}
                                <div className="flex flex-col gap-2">
                                    {editingProduct.hasVariations ? (
                                        <div className="bg-blue-light/15 border-2 border-text rounded-2xl p-4 flex flex-col gap-3 shadow-[2px_2px_0px_#181818] h-full">
                                            <div className="flex justify-between items-center border-b border-text/15 pb-2">
                                                <div>
                                                    <h5 className="font-title text-sm font-bold text-text flex items-center gap-1.5">
                                                        <i className="fa-solid fa-layer-group text-blue"></i>
                                                        <span>Daftar Variasi Item</span>
                                                    </h5>
                                                    <span className="text-[10px] text-text/60">Atur harga, stok, dan diskon untuk masing-masing opsi.</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setEditingProduct(prev => ({
                                                            ...prev,
                                                            variationsList: prev.variationsList.map(v => ({ ...v, stock: '0' }))
                                                        }))}
                                                        className="text-[10px] bg-yellow-light hover:bg-yellow text-text border border-text px-2.5 py-1 rounded-full font-tag font-extrabold cursor-pointer transition-all shadow-[1px_1px_0px_#181818]"
                                                        title="Set semua stok opsi ke 0"
                                                    >
                                                        Stok 0 Semua
                                                    </button>
                                                    <button 
                                                        type="button" 
                                                        onClick={handleAddEditVariationRow}
                                                        className="btn bg-blue-light text-text border-2 border-text px-3 py-1 rounded-full text-xs font-title font-bold hover:bg-white shadow-[1.5px_1.5px_0px_#181818] transition-all cursor-pointer"
                                                    >
                                                        + Tambah Opsi
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Pricing Mode Toggle for Edit Modal */}
                                            <div className="grid grid-cols-2 gap-1.5 p-1 bg-yellow-light/30 border border-text/20 rounded-xl font-tag text-[10.5px] font-extrabold">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingProduct(prev => ({ ...prev, uniformVariantPrice: true }))}
                                                    className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                                                        editingProduct.uniformVariantPrice 
                                                            ? 'bg-yellow text-text border-text shadow-[1px_1px_0px_#181818]' 
                                                            : 'bg-white text-text/70 border-transparent hover:text-text'
                                                    }`}
                                                >
                                                    Harga Seragam
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingProduct(prev => ({ ...prev, uniformVariantPrice: false }))}
                                                    className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                                                        !editingProduct.uniformVariantPrice 
                                                            ? 'bg-yellow text-text border-text shadow-[1px_1px_0px_#181818]' 
                                                            : 'bg-white text-text/70 border-transparent hover:text-text'
                                                    }`}
                                                >
                                                    Harga Beda Tiap Opsi
                                                </button>
                                            </div>

                                            {/* Master Price Input when Uniform Mode is active */}
                                            {editingProduct.uniformVariantPrice && (
                                                <div className="bg-pink-light/30 border-2 border-dashed border-pink/60 rounded-xl p-2.5 flex items-center gap-2.5">
                                                    <div className="flex-grow flex flex-col gap-0.5">
                                                        <label className="text-[10px] font-bold uppercase text-text/80">Harga Semua Opsi (Rp)</label>
                                                        <input 
                                                            type="text"
                                                            inputMode="numeric"
                                                            required={editingProduct.hasVariations && editingProduct.uniformVariantPrice}
                                                            placeholder="Contoh: 7000"
                                                            value={editingProduct.masterVariantPrice}
                                                            onChange={(e) => setEditingProduct(prev => ({ ...prev, masterVariantPrice: sanitizeIntegerInput(e.target.value) }))}
                                                            className="border-2 border-text rounded-lg p-1 text-xs outline-none bg-white font-title font-bold"
                                                        />
                                                    </div>
                                                    <div className="w-[110px] flex flex-col gap-0.5">
                                                        <label className="text-[10px] font-bold uppercase text-pink">Diskon (Rp)</label>
                                                        <input 
                                                            type="text"
                                                            inputMode="numeric"
                                                            placeholder="0"
                                                            value={editingProduct.masterVariantDiscount}
                                                            onChange={(e) => setEditingProduct(prev => ({ ...prev, masterVariantDiscount: sanitizeIntegerInput(e.target.value) }))}
                                                            className="border-2 border-pink/50 rounded-lg p-1 text-xs outline-none bg-white font-bold"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <div className="overflow-y-auto max-h-[380px] flex flex-col gap-2.5 pr-1">
                                                {editingProduct.variationsList.map((row, idx) => (
                                                    <div key={idx} className="bg-white border-2 border-text/20 rounded-xl p-3 flex flex-col gap-2 shadow-[1.5px_1.5px_0px_#181818]">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-grow">
                                                                <label className="text-[9px] font-bold uppercase text-text/60 block mb-0.5">Nama Opsi</label>
                                                                <input 
                                                                    type="text" 
                                                                    placeholder="e.g. Putih / Ukuran L" 
                                                                    required={editingProduct.hasVariations}
                                                                    value={row.name}
                                                                    onChange={(e) => handleEditVariationRowChange(idx, 'name', e.target.value)}
                                                                    className="w-full border-2 border-text rounded-lg p-1.5 text-xs outline-none bg-white font-bold"
                                                                />
                                                            </div>

                                                            {!editingProduct.uniformVariantPrice && (
                                                                <div className="w-[110px]">
                                                                    <label className="text-[9px] font-bold uppercase text-text/60 block mb-0.5">Harga (Rp)</label>
                                                                    <input 
                                                                        type="text"
                                                                        inputMode="numeric"
                                                                        required={editingProduct.hasVariations && !editingProduct.uniformVariantPrice}
                                                                        value={row.price}
                                                                        onChange={(e) => handleEditVariationRowChange(idx, 'price', sanitizeIntegerInput(e.target.value))}
                                                                        className="w-full border-2 border-text rounded-lg p-1.5 text-xs outline-none bg-white font-title font-bold"
                                                                    />
                                                                </div>
                                                            )}

                                                            <div className="w-[85px]">
                                                                <label className="text-[9px] font-bold uppercase text-text/60 block mb-0.5">Stok</label>
                                                                <input 
                                                                    type="number" 
                                                                    required={editingProduct.hasVariations}
                                                                    value={row.stock}
                                                                    onChange={(e) => handleEditVariationRowChange(idx, 'stock', e.target.value)}
                                                                    className="w-full border-2 border-text rounded-lg p-1.5 text-xs outline-none bg-white font-bold"
                                                                />
                                                            </div>

                                                            {editingProduct.variationsList.length > 1 && (
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => handleRemoveEditVariationRow(idx)}
                                                                    className="text-pink hover:scale-115 cursor-pointer mt-4 p-1"
                                                                    title="Hapus Opsi"
                                                                >
                                                                    <i className="fa-solid fa-trash-can text-sm"></i>
                                                                </button>
                                                            )}
                                                        </div>

                                                        {!editingProduct.uniformVariantPrice && (
                                                            <div className="flex items-center gap-2 border-t border-dashed border-text/15 pt-1.5 text-xs">
                                                                <i className="fa-solid fa-tag text-[10px] text-pink"></i>
                                                                <input 
                                                                    type="text"
                                                                    inputMode="numeric"
                                                                    placeholder="Diskon khusus (Rp)" 
                                                                    value={row.discount}
                                                                    onChange={(e) => handleEditVariationRowChange(idx, 'discount', sanitizeIntegerInput(e.target.value))}
                                                                    className="border border-pink/40 rounded-md p-1 text-[11px] outline-none bg-pink-light/15 font-bold w-[120px]"
                                                                />
                                                                {toIntRupiah(row.discount) > 0 && toIntRupiah(row.price) > 0 && (
                                                                    <span className="text-[11px] text-pink font-bold">
                                                                        → {formatPrice(Math.max(0, toIntRupiah(row.price) - toIntRupiah(row.discount)))}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="border-2 border-dashed border-text/25 rounded-2xl p-6 flex flex-col items-center justify-center text-center h-full bg-yellow-light/15 text-text/60">
                                            <i className="fa-solid fa-layer-group text-3xl mb-2 text-text/40"></i>
                                            <h6 className="font-title text-sm font-bold text-text">Item Tunggal (Tanpa Variasi)</h6>
                                            <p className="text-xs text-text/70 mt-1 max-w-xs font-body">Centang opsi "Memiliki variasi produk" di sebelah kiri jika produk ini memiliki pilihan model, warna, atau ukuran.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Modal actions */}
                            <div className="flex justify-end gap-3 mt-4 pt-3 border-t-2 border-text/10 shrink-0">
                                <button 
                                    type="button" 
                                    onClick={() => setEditingProduct(null)}
                                    className="btn bg-white text-text border-2 border-text rounded-full font-title text-xs px-5 py-2.5 shadow-[2px_2px_0px_#181818] hover:bg-yellow-light cursor-pointer font-bold"
                                >
                                    Batal
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn bg-pink text-text border-[2.5px] border-text rounded-full font-title text-xs px-6 py-2.5 shadow-[2.5px_2.5px_0px_#181818] hover:bg-white active:translate-y-[1px] active:shadow-none cursor-pointer font-bold"
                                >
                                    Simpan Perubahan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CSV Import Preview Modal overlay (Retro OS Pop Brutalism) */}
            {showImportModal && (
                <div className="fixed inset-0 bg-[#181818]/60 backdrop-blur-sm z-[10001] flex justify-center items-center p-4 animate-[fade_0.2s_ease]">
                    <div className="bg-white border-[3px] border-text rounded-2xl shadow-card w-full max-w-[700px] max-h-[85vh] overflow-hidden flex flex-col text-text relative">
                        <div className="retro-window-header bg-pink border-b-[2.5px] border-text px-4 py-2.5 flex items-center justify-between">
                            <div className="retro-dots flex items-center gap-1.5">
                                <span className="retro-dot retro-dot-red"></span>
                                <span className="retro-dot retro-dot-yellow"></span>
                                <span className="retro-dot retro-dot-blue"></span>
                                <span className="font-tag text-xs font-black uppercase tracking-wider text-text ml-2">Preview Import CSV Produk</span>
                            </div>
                            <button 
                                onClick={() => setShowImportModal(false)}
                                className="text-text hover:text-white transition-transform hover:scale-110 cursor-pointer"
                            >
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>

                        <div className="p-4 sm:p-5 flex flex-col gap-3 overflow-y-auto">
                            <div className="flex items-center justify-between bg-yellow-light/40 border-2 border-text rounded-xl p-3">
                                <div>
                                    <span className="font-title text-sm font-bold block text-text">Daftar Produk Terdeteksi</span>
                                    <span className="text-xs font-body text-text/80">
                                        Total <strong>{importPreview.length}</strong> produk siap di-commit via Stored Procedure Transaction.
                                    </span>
                                </div>
                                <span className="bg-pink text-text font-tag text-xs font-black px-2.5 py-1 rounded-full border border-text shadow-[1px_1px_0px_#181818]">
                                    {importPreview.length} ROWS
                                </span>
                            </div>

                            {importErrors.length > 0 && (
                                <div className="bg-pink-light/40 border-2 border-rose-600 rounded-xl p-3 text-xs text-rose-900 font-bold">
                                    <div className="flex items-center gap-1.5 mb-1 text-rose-800">
                                        <i className="fa-solid fa-triangle-exclamation"></i>
                                        <span>Catatan Baris Diabaikan:</span>
                                    </div>
                                    <ul className="list-disc list-inside space-y-0.5">
                                        {importErrors.map((err, idx) => (
                                            <li key={idx}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="border-2 border-text rounded-xl overflow-x-auto max-h-[300px]">
                                <table className="w-full text-left text-xs border-collapse font-body">
                                    <thead className="bg-blue-light border-b-2 border-text font-title">
                                        <tr>
                                            <th className="p-2 border-r border-text/20">ID</th>
                                            <th className="p-2 border-r border-text/20">Nama</th>
                                            <th className="p-2 border-r border-text/20">Kategori</th>
                                            <th className="p-2 border-r border-text/20">Harga</th>
                                            <th className="p-2 border-r border-text/20">Stok</th>
                                            <th className="p-2">Katalog</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-text/15">
                                        {importPreview.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-yellow-light/20">
                                                <td className="p-2 font-mono font-bold border-r border-text/10">{item.id}</td>
                                                <td className="p-2 font-bold border-r border-text/10">
                                                    {item.name}
                                                    {item.variations.length > 0 && (
                                                        <span className="block text-[10px] text-blue font-title">({item.variations.length} Variasi)</span>
                                                    )}
                                                </td>
                                                <td className="p-2 border-r border-text/10">{item.category}</td>
                                                <td className="p-2 font-mono border-r border-text/10">{formatPrice(item.price)}</td>
                                                <td className="p-2 font-mono font-bold border-r border-text/10">{item.stock}</td>
                                                <td className="p-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                                        item.hiddenFromCatalogue ? 'bg-pink-light text-rose-800 border-rose-400' : 'bg-emerald-100 text-emerald-800 border-emerald-400'
                                                    }`}>
                                                        {item.hiddenFromCatalogue ? 'Hidden' : 'Visible'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-2">
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setShowImportModal(false);
                                        setImportPreview([]);
                                        setImportErrors([]);
                                    }}
                                    className="btn bg-white text-text border-[3px] border-text rounded-full font-title text-[12px] px-4 py-2.5 shadow-btn hover:bg-yellow-light cursor-pointer"
                                >
                                    Batalkan
                                </button>
                                <button 
                                    type="button" 
                                    onClick={handleExecuteImportProducts}
                                    className="btn bg-pink text-text border-[3px] border-text rounded-full font-title text-[12px] px-4 py-2.5 shadow-btn hover:bg-white cursor-pointer flex items-center justify-center gap-2"
                                >
                                    <i className="fa-solid fa-cloud-arrow-up"></i>
                                    Commit Stored Procedure ({importPreview.length})
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
