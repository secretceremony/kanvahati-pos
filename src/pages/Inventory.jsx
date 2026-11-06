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
    updateCategoryName,
    sp_import_products_batch
} from '../services/db';
import * as XLSX from 'xlsx';
import { recordAuditLog } from '../services/audit';
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
    const [id, setId] = useState('');
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState('stickers');
    const [stock, setStock] = useState('10');
    const [tag, setTag] = useState('');

    // Variations State
    const [hasVariations, setHasVariations] = useState(false);
    const [uniformVariantPrice, setUniformVariantPrice] = useState(true);
    const [masterVariantPrice, setMasterVariantPrice] = useState('');
    const [masterVariantDiscount, setMasterVariantDiscount] = useState('0');
    const [variationsList, setVariationsList] = useState([{ name: '', price: '', stock: '10', discount: '0' }]);

    // Table UI State
    const [expandedProductId, setExpandedProductId] = useState(null);

    // Restock Modal Target State
    const [restockTarget, setRestockTarget] = useState(null);
    const [restockAmount, setRestockAmount] = useState('10');

    // Bulk delete and Editing states
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [editingProduct, setEditingProduct] = useState(null);

    // Search, Filter, Sort & Pagination State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterVisibility, setFilterVisibility] = useState('all'); // all, visible, hidden
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
            let listToValidate = variationsList;
            if (uniformVariantPrice) {
                const uPrice = parseFloat(masterVariantPrice);
                const uDiscount = parseFloat(masterVariantDiscount || 0);
                if (isNaN(uPrice) || uPrice <= 0) {
                    showToast("Masukkan harga seragam yang valid untuk variasi!", "⚠️");
                    return;
                }
                listToValidate = variationsList.map(v => ({
                    ...v,
                    price: masterVariantPrice,
                    discount: masterVariantDiscount || '0'
                }));
            }

            // Validate variations list
            const invalid = listToValidate.some(v => !v.name.trim() || !v.price || isNaN(v.price) || parseFloat(v.price) <= 0 || !v.stock || isNaN(v.stock));
            if (invalid) {
                showToast("Semua baris variasi harus terisi secara valid!", "⚠️");
                return;
            }

            finalVariations = listToValidate.map(v => ({
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

        let calculatedPrice = parseFloat(editingProduct.price);
        let calculatedStock = parseInt(editingProduct.stock);
        let finalVariations = [];

        if (editingProduct.hasVariations) {
            let listToValidate = editingProduct.variationsList;
            if (editingProduct.uniformVariantPrice) {
                const uPrice = parseFloat(editingProduct.masterVariantPrice);
                const uDiscount = parseFloat(editingProduct.masterVariantDiscount || 0);
                if (isNaN(uPrice) || uPrice <= 0) {
                    showToast("Masukkan harga seragam yang valid untuk variasi!", "⚠️");
                    return;
                }
                listToValidate = editingProduct.variationsList.map(v => ({
                    ...v,
                    price: editingProduct.masterVariantPrice,
                    discount: editingProduct.masterVariantDiscount || '0'
                }));
            }

            // Validate variations list
            const invalid = listToValidate.some(v => !v.name.trim() || !v.price || isNaN(v.price) || parseFloat(v.price) <= 0 || !v.stock || isNaN(v.stock));
            if (invalid) {
                showToast("Semua baris variasi harus terisi secara valid!", "⚠️");
                return;
            }

            finalVariations = listToValidate.map(v => ({
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
            hiddenFromCatalogue: Boolean(editingProduct.hiddenFromCatalogue),
            img: 'assets/mascot.png', // Default placeholder mascot
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
        } catch (err) {
            showToast("Gagal memperbarui produk", "⚠️");
        }
    };

    // Price formatting helper
    const formatPrice = (priceVal) => {
        return `Rp ${priceVal.toLocaleString('id-ID')}`;
    };

    // Filter, search, and sort products
    const processedProducts = products.filter(p => {
        const matchesSearch = !searchTerm || 
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            p.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
        const matchesVisibility = filterVisibility === 'all' ||
            (filterVisibility === 'visible' && !p.hiddenFromCatalogue) ||
            (filterVisibility === 'hidden' && p.hiddenFromCatalogue);
        return matchesSearch && matchesCategory && matchesVisibility;
    }).sort((a, b) => {
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
        if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
        if (sortBy === 'price_asc') return (a.price || 0) - (b.price || 0);
        if (sortBy === 'price_desc') return (b.price || 0) - (a.price || 0);
        if (sortBy === 'stock_asc') return (a.stock || 0) - (b.stock || 0);
        if (sortBy === 'stock_desc') return (b.stock || 0) - (a.stock || 0);
        return 0;
    });

    // Pagination calculations
    const totalPages = Math.max(1, Math.ceil(processedProducts.length / pageSize));
    const paginatedProducts = processedProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
        } catch (e) {
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
        } catch (e) {
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

    // Parse and handle CSV file for Items
    const handleCsvFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const text = evt.target.result;
                const lines = text.split(String.fromCharCode(10)).filter(line => line.trim() !== "");
                if (lines.length < 2) {
                    showToast("File CSV kosong atau tidak valid!", "⚠️");
                    return;
                }

                const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                const previewRows = [];
                const errors = [];

                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i];
                    // Simple regex CSV splitter handling quotes
                    const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
                    const cleanValues = values.map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

                    const rowObj = {};
                    headers.forEach((h, idx) => {
                        rowObj[h] = cleanValues[idx] !== undefined ? cleanValues[idx] : '';
                    });

                    const name = rowObj["Nama Produk"] || rowObj["name"] || rowObj["Nama"] || cleanValues[1] || '';
                    if (!name) {
                        errors.push(`Baris ${i + 1}: Nama produk kosong.`);
                        continue;
                    }

                    const rawId = rowObj["ID"] || rowObj["id"] || rowObj["ID (Opsional, kosongkan utk auto)"] || cleanValues[0] || '';
                    const category = (rowObj["Kategori"] || rowObj["category"] || cleanValues[2] || 'stickers').trim().toLowerCase();
                    const price = parseFloat(rowObj["Harga"] || rowObj["price"] || cleanValues[3] || 0);
                    const stock = parseInt(rowObj["Stok"] || rowObj["stock"] || cleanValues[4] || 0);
                    const discount = parseFloat(rowObj["Diskon"] || rowObj["discount"] || cleanValues[5] || 0);
                    const tag = rowObj["Tag"] || rowObj["tag"] || cleanValues[6] || '';
                    const hiddenRaw = String(rowObj["Sembunyikan Katalog"] || rowObj["hiddenFromCatalogue"] || cleanValues[7] || '').toUpperCase();
                    const hiddenFromCatalogue = hiddenRaw === 'TRUE' || hiddenRaw === '1' || hiddenRaw === 'YA';
                    const variationsRaw = rowObj["Variasi"] || rowObj["variations"] || cleanValues[8] || '';

                    let parsedVariations = [];
                    if (variationsRaw && variationsRaw.includes(':')) {
                        const varSplits = variationsRaw.split('|');
                        parsedVariations = varSplits.map(vStr => {
                            const [vName, vPrice, vStock, vDisc] = vStr.split(':');
                            return {
                                name: (vName || '').trim(),
                                price: parseFloat(vPrice || price),
                                stock: parseInt(vStock || stock),
                                discount: parseFloat(vDisc || 0)
                            };
                        }).filter(v => v.name);
                    }

                    const assignedId = rawId ? rawId.trim().toUpperCase() : generateNextId(name, category, [...products, ...previewRows]);

                    previewRows.push({
                        id: assignedId,
                        name,
                        category,
                        price: parsedVariations.length > 0 ? Math.min(...parsedVariations.map(v => v.price)) : price,
                        stock: parsedVariations.length > 0 ? parsedVariations.reduce((s, v) => s + v.stock, 0) : stock,
                        discount,
                        tag,
                        hiddenFromCatalogue,
                        variations: parsedVariations,
                        img: 'assets/mascot.png'
                    });
                }

                setImportPreview(previewRows);
                setImportErrors(errors);
                setShowImportModal(true);
            } catch (err) {
                console.error("CSV parse error:", err);
                showToast("Format CSV tidak terbaca. Pastikan format valid!", "⚠️");
            }
        };
        reader.readAsText(file);
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
        } catch (e) {
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
        <div className="inventory-layout flex flex-col gap-3 lg:grid lg:grid-cols-[1.18fr_1.82fr] lg:gap-6 h-auto overflow-visible pb-12">
            {/* Mobile View Tab Selector */}
            <div className="lg:hidden flex border-2 border-text rounded-xl overflow-hidden mb-1 shrink-0 bg-white font-title text-xs font-bold shadow-[2px_2px_0px_#181818] w-full">
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
                                                    type="number"
                                                    required={hasVariations && uniformVariantPrice}
                                                    placeholder="Contoh: 7000"
                                                    value={masterVariantPrice}
                                                    onChange={(e) => setMasterVariantPrice(e.target.value)}
                                                    className="border-2 border-text rounded-lg p-1 text-xs outline-none bg-white font-title font-bold"
                                                />
                                            </div>
                                            <div className="w-[110px] flex flex-col gap-0.5">
                                                <label className="text-[10px] font-bold uppercase text-pink">Diskon (Rp)</label>
                                                <input 
                                                    type="number"
                                                    min="0"
                                                    placeholder="0"
                                                    value={masterVariantDiscount}
                                                    onChange={(e) => setMasterVariantDiscount(e.target.value)}
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
                                                            type="number" 
                                                            placeholder="Harga" 
                                                            required={hasVariations && !uniformVariantPrice}
                                                            value={row.price}
                                                            onChange={(e) => handleVariationRowChange(idx, 'price', e.target.value)}
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
                                                        type="number" 
                                                        placeholder="Diskon (Rp)" 
                                                        min="0"
                                                        value={row.discount}
                                                        onChange={(e) => handleVariationRowChange(idx, 'discount', e.target.value)}
                                                        className="border-2 border-pink/40 rounded-lg p-0.5 text-[10px] outline-none bg-pink-light/15 font-bold w-[90px] focus:border-pink"
                                                    />
                                                    {parseFloat(row.discount || 0) > 0 && parseFloat(row.price || 0) > 0 && (
                                                        <span className="text-[9px] text-pink font-bold">→ {formatPrice(Math.max(0, parseFloat(row.price) - parseFloat(row.discount)))}</span>
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
            <div className={`inventory-card bg-white border-[3px] border-text rounded-2xl shadow-pop overflow-hidden flex flex-col h-auto relative ${activeMobileTab === 'list' ? 'block' : 'hidden lg:flex'}`}>
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

                    {/* Quick Action Toolbar: CSV Import, XLSX Template, Empty Slot */}
                    <div className="flex flex-wrap items-center gap-2">
                        <label 
                            className="btn bg-pink text-text border-2 border-text rounded-full px-3 py-1.5 text-xs font-title font-bold shadow-[2px_2px_0px_#181818] hover:bg-white hover:translate-y-[-1px] active:translate-y-[1px] transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Import produk via file CSV"
                        >
                            <i className="fa-solid fa-file-csv"></i> Import CSV
                            <input 
                                type="file" 
                                accept=".csv" 
                                onChange={handleCsvFileUpload} 
                                className="hidden" 
                            />
                        </label>

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
                        <div className="sm:col-span-5 relative flex items-center">
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
                        <div className="sm:col-span-3">
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
                        <div className="flex items-center gap-1.5 font-tag font-bold">
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

                <div className="table-container flex-grow overflow-y-auto max-h-[720px] pb-10 pr-0.5">
                    {loading ? (
                        <div className="text-center py-12 font-bold text-text/60">{t.loadingProducts}</div>
                    ) : (
                        <>
                            {/* 1. Mobile Card List (< lg) */}
                            <div className="block lg:hidden space-y-3">
                                {paginatedProducts.map(prod => (
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
                                ))}
                            </div>

                            {/* 2. Desktop Table (>= lg) */}
                            <div className="hidden lg:block border-2 border-text rounded-lg overflow-x-auto">
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
                                {paginatedProducts.map(prod => {
                                    const isLowStock = prod.stock <= 5;
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
                                                <td className="p-3 font-bold text-[11px] whitespace-nowrap">
                                                    {prod.id}
                                                    {prod.tag && (
                                                        <span className="block text-[9px] font-normal opacity-70">
                                                            Tag: {prod.tag}
                                                        </span>
                                                    )}
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
                                                        {/* Hide from Catalogue Toggle */}
                                                        <button 
                                                            onClick={() => handleToggleCatalogueVisibility(prod)}
                                                            title={prod.hiddenFromCatalogue ? "Tampilkan di katalog POS" : "Sembunyikan dari katalog POS"}
                                                            className={`btn border-2 border-text rounded-full font-title text-[10px] px-2.5 py-1 cursor-pointer shadow-[1px_1px_0px_#181818] transition-all flex items-center gap-1 ${
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
                                                                title="Isi stok barang"
                                                                className="btn bg-yellow text-text border-2 border-text rounded-full font-title text-[10px] px-3 py-1 hover:bg-white cursor-pointer shadow-[1px_1px_0px_#181818] transition-all flex items-center gap-1"
                                                            >
                                                                <i className="fa-solid fa-box-open"></i> {t.restock || "Isi Stok"}
                                                            </button>
                                                        )}

                                                        {/* Edit Button */}
                                                        <button 
                                                            onClick={() => handleOpenEditModal(prod)}
                                                            title="Edit produk"
                                                            className="btn bg-blue-light text-text border-2 border-text rounded-full font-title text-[10px] px-3 py-1 hover:bg-white cursor-pointer shadow-[1px_1px_0px_#181818] transition-all flex items-center gap-1"
                                                        >
                                                            <i className="fa-solid fa-pen-to-square"></i> Edit
                                                        </button>
                                                        
                                                        {/* Delete Button */}
                                                        <button 
                                                            onClick={() => handleDelete(prod.id)}
                                                            title="Hapus produk"
                                                            className="btn bg-white text-text border-2 border-text rounded-full font-title text-[10px] px-3 py-1 hover:bg-pink-light cursor-pointer shadow-[1px_1px_0px_#181818] transition-all flex items-center gap-1 text-pink"
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
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                            </div>

                            {/* Pagination Controls Bar */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-3 border-t-2 border-text/10 shrink-0 font-body text-xs">
                                <span className="text-text/70">
                                    Menampilkan <strong>{processedProducts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> - <strong>{Math.min(currentPage * pageSize, processedProducts.length)}</strong> dari <strong>{processedProducts.length}</strong> produk
                                </span>

                                <div className="flex items-center gap-1.5 font-tag font-bold">
                                    <button
                                        type="button"
                                        disabled={currentPage <= 1}
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        className={`px-3 py-1.5 rounded-lg border-2 border-text transition-all ${
                                            currentPage <= 1 
                                                ? 'bg-gray-100 text-gray-400 border-gray-300 opacity-60 cursor-not-allowed' 
                                                : 'bg-white text-text hover:bg-yellow shadow-[1.5px_1.5px_0px_#181818] active:translate-y-[1px] cursor-pointer'
                                        }`}
                                    >
                                        <i className="fa-solid fa-chevron-left text-[10px]"></i> Sebelumnya
                                    </button>

                                    <span className="bg-yellow-light border border-text px-3 py-1.5 rounded-lg font-bold">
                                        Hal {currentPage} / {totalPages}
                                    </span>

                                    <button
                                        type="button"
                                        disabled={currentPage >= totalPages}
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        className={`px-3 py-1.5 rounded-lg border-2 border-text transition-all ${
                                            currentPage >= totalPages 
                                                ? 'bg-gray-100 text-gray-400 border-gray-300 opacity-60 cursor-not-allowed' 
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

            {/* Custom Restock Modal overlay */}
            {restockTarget && (
                <div className="fixed inset-0 bg-[#181818]/50 backdrop-blur-sm z-[10001] flex justify-center items-center p-4 animate-[fade_0.2s_ease]">
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
                                                        type="number" 
                                                        required={!editingProduct.hasVariations}
                                                        value={editingProduct.price}
                                                        onChange={(e) => setEditingProduct(prev => ({ ...prev, price: e.target.value }))}
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
                                                    type="number" 
                                                    min="0"
                                                    value={editingProduct.discount}
                                                    onChange={(e) => setEditingProduct(prev => ({ ...prev, discount: e.target.value }))}
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
                                                            type="number"
                                                            required={editingProduct.hasVariations && editingProduct.uniformVariantPrice}
                                                            placeholder="Contoh: 7000"
                                                            value={editingProduct.masterVariantPrice}
                                                            onChange={(e) => setEditingProduct(prev => ({ ...prev, masterVariantPrice: e.target.value }))}
                                                            className="border-2 border-text rounded-lg p-1 text-xs outline-none bg-white font-title font-bold"
                                                        />
                                                    </div>
                                                    <div className="w-[110px] flex flex-col gap-0.5">
                                                        <label className="text-[10px] font-bold uppercase text-pink">Diskon (Rp)</label>
                                                        <input 
                                                            type="number"
                                                            min="0"
                                                            placeholder="0"
                                                            value={editingProduct.masterVariantDiscount}
                                                            onChange={(e) => setEditingProduct(prev => ({ ...prev, masterVariantDiscount: e.target.value }))}
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
                                                                        type="number" 
                                                                        required={editingProduct.hasVariations && !editingProduct.uniformVariantPrice}
                                                                        value={row.price}
                                                                        onChange={(e) => handleEditVariationRowChange(idx, 'price', e.target.value)}
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
                                                                    type="number" 
                                                                    placeholder="Diskon khusus (Rp)" 
                                                                    min="0"
                                                                    value={row.discount}
                                                                    onChange={(e) => handleEditVariationRowChange(idx, 'discount', e.target.value)}
                                                                    className="border border-pink/40 rounded-md p-1 text-[11px] outline-none bg-pink-light/15 font-bold w-[120px]"
                                                                />
                                                                {parseFloat(row.discount || 0) > 0 && parseFloat(row.price || 0) > 0 && (
                                                                    <span className="text-[11px] text-pink font-bold">
                                                                        → {formatPrice(Math.max(0, parseFloat(row.price) - parseFloat(row.discount)))}
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
