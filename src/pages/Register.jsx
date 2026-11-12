import { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import { getProducts, saveTransaction, getCategories, getBundles, getQrisConfig, fn_validate_cart_stock_integrity } from '../services/db';
import { generateCheckoutDynamicQris, queryDanaPaymentStatus } from '../services/danaQris';
import { resolveProductImageUrl } from '../utils/imageHelper';
import { calculateTicketTotals, formatRupiah, sanitizeIntegerInput, toIntRupiah } from '../utils/currency';
import { t } from '../services/translations';
import BundleSuggestionBanner from '../components/BundleSuggestionBanner';

// Sparkle burst effect (defined outside component so React purity rules stay clean)
const triggerSparkles = (x, y) => {
    const particlesList = ['✦', '★', '✧', '•'];
    const count = 5 + Math.floor(Math.random() * 4);

    for (let i = 0; i < count; i++) {
        const particle = document.createElement('span');
        particle.className = 'click-particle text-text';
        particle.innerText = particlesList[Math.floor(Math.random() * particlesList.length)];

        const angle = Math.random() * Math.PI * 2;
        const velocity = 2 + Math.random() * 3;
        const size = 12 + Math.random() * 12;

        particle.style.position = 'fixed';
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.fontSize = `${size}px`;

        document.body.appendChild(particle);

        particle.animate([
            { transform: 'translate(-50%, -50%) translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
            {
                transform: `translate(-50%, -50%) translate(${Math.cos(angle) * velocity * 22}px, ${Math.sin(angle) * velocity * 22}px) scale(0.4) rotate(${Math.random() * 360}deg)`,
                opacity: 0
            }
        ], {
            duration: 600,
            easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)',
            fill: 'forwards'
        }).onfinish = () => particle.remove();
    }
};

export default function Register({ onCheckoutSuccess, showToast, activeCashier }) {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const [ticket, setTicket] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [loading, setLoading] = useState(true);
    
    // Bundles & Transaction Discount state
    const [availableBundles, setAvailableBundles] = useState([]);
    const [dismissedBundles, setDismissedBundles] = useState(new Set());
    const [transactionDiscountInput, setTransactionDiscountInput] = useState('');
    
    // QRIS scan overlay visibility & dynamic QRIS state
    const [showQrisModal, setShowQrisModal] = useState(false);
    const [qrisConfig, setQrisConfig] = useState(null);
    const [dynamicQrisData, setDynamicQrisData] = useState(null);
    const [qrisDataUrl, setQrisDataUrl] = useState('');
    const [qrisLoading, setQrisLoading] = useState(false);
    const [qrisError, setQrisError] = useState('');
    const [qrisCheckStatus, setQrisCheckStatus] = useState('');
    const [showStaticQrisFallback, setShowStaticQrisFallback] = useState(false);

    // Cash Payment Tender Modal state (Angsul / Kembalian calculator)
    const [showCashModal, setShowCashModal] = useState(false);
    const [cashReceivedInput, setCashReceivedInput] = useState('');

    // Variation selector state
    const [variationProduct, setVariationProduct] = useState(null);
    const [selectedVarQuantities, setSelectedVarQuantities] = useState({});

    // Multiplier for single item quick addition (e.g. 1x, 2x, 5x, 10x)
    const [quickMultiplier, setQuickMultiplier] = useState(1);

    // Mobile layout toggle state
    const [activeMobileTab, setActiveMobileTab] = useState('catalog');

    // Fetch products and categories list from DB Layer (utilizes in-memory and persistent cache)
    const fetchData = async (forceRefetch = false) => {
        try {
            setLoading(true);
            const [prodsData, catsData, bundlesData, qrisCfg] = await Promise.all([
                getProducts(forceRefetch),
                getCategories(forceRefetch),
                getBundles(forceRefetch),
                getQrisConfig(forceRefetch)
            ]);
            setProducts(prodsData);
            setCategories(catsData);
            setAvailableBundles(bundlesData.filter(b => b.isActive));
            setQrisConfig(qrisCfg);
        } catch (e) {
            console.error("Failed to load catalog data", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const [prodsData, catsData, bundlesData, qrisCfg] = await Promise.all([
                    getProducts(false),
                    getCategories(false),
                    getBundles(false),
                    getQrisConfig(false)
                ]);
                if (!mounted) return;
                setProducts(prodsData);
                setCategories(catsData);
                setAvailableBundles(bundlesData.filter(b => b.isActive));
                setQrisConfig(qrisCfg);
            } catch (e) {
                console.error("Failed to load catalog data", e);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, []);

    // Add Item to ticket (supports variation selection)
    const handleAddToTicket = (e, product, selectedVar = null) => {
        if (e && e.clientX) triggerSparkles(e.clientX, e.clientY);

        // Check if item has variations and one is not yet selected
        if (product.variations && product.variations.length > 0 && !selectedVar) {
            const initialQtyMap = {};
            product.variations.forEach(v => {
                initialQtyMap[v.name] = 0;
            });
            setSelectedVarQuantities(initialQtyMap);
            setVariationProduct(product);
            return;
        }

        const varName = selectedVar ? selectedVar.name : null;
        const basePrice = selectedVar ? selectedVar.price : product.price;
        const itemDiscount = selectedVar ? (selectedVar.discount || 0) : (product.discount || 0);
        const finalPrice = Math.max(0, basePrice - itemDiscount);
        const maxStock = selectedVar ? selectedVar.stock : product.stock;
        const displayName = selectedVar ? `${product.name} (${selectedVar.name})` : product.name;

        if (maxStock <= 0) {
            showToast(t.stockOut || "Stok habis!", "⚠️");
            return;
        }

        const existing = ticket.find(item => item.id === product.id && item.variationName === varName);
        const addAmount = Math.max(1, quickMultiplier || 1);

        if (existing) {
            const nextQty = Math.min(maxStock, existing.qty + addAmount);
            if (existing.qty < maxStock) {
                showToast(`"${displayName}" (+${addAmount})`, "✨");
                setTicket(prev => prev.map(item => 
                    (item.id === product.id && item.variationName === varName) 
                        ? { ...item, qty: nextQty } 
                        : item
                ));
            } else {
                showToast(t.stockOut, "⚠️");
            }
        } else {
            const initialQty = Math.min(maxStock, addAmount);
            showToast(`"${displayName}" (${initialQty} pcs) ${t.added}`, "🌸");
            setTicket(prev => [...prev, {
                id: product.id,
                name: displayName,
                price: finalPrice,
                originalPrice: basePrice,
                discount: itemDiscount,
                qty: initialQty,
                maxStock: maxStock,
                variationName: varName
            }]);
        }

        // Close selector if it was open
        setVariationProduct(null);
        setSelectedVarQuantities({});
    };

    // Multi-variation batch add to ticket
    const handleBatchAddVariations = (e) => {
        if (e && e.clientX) triggerSparkles(e.clientX, e.clientY);
        if (!variationProduct || !variationProduct.variations) return;

                let addedCount = 0;
        let totalItemsAdded = 0;

        setTicket(prevTicket => {
            let updated = [...prevTicket];

            variationProduct.variations.forEach(v => {
                const addQty = selectedVarQuantities[v.name] || 0;
                if (addQty <= 0) return;

                const basePrice = v.price || 0;
                const itemDiscount = v.discount || 0;
                const finalPrice = Math.max(0, basePrice - itemDiscount);
                const maxStock = v.stock || 0;
                const displayName = `${variationProduct.name} (${v.name})`;

                const existingIdx = updated.findIndex(it => it.id === variationProduct.id && it.variationName === v.name);
                if (existingIdx > -1) {
                    const existing = updated[existingIdx];
                    const targetQty = Math.min(maxStock, existing.qty + addQty);
                    updated[existingIdx] = {
                        ...existing,
                        qty: targetQty
                    };
                } else {
                    const targetQty = Math.min(maxStock, addQty);
                    updated.push({
                        id: variationProduct.id,
                        name: displayName,
                        price: finalPrice,
                        originalPrice: basePrice,
                        discount: itemDiscount,
                        qty: targetQty,
                        maxStock: maxStock,
                        variationName: v.name
                    });
                }

                addedCount += 1;
                totalItemsAdded += addQty;
            });

            return updated;
        });

        if (totalItemsAdded > 0) {
            showToast(`${totalItemsAdded} item (${addedCount} variasi) ditambahkan! 🌸`, "✨");
        }

        setVariationProduct(null);
        setSelectedVarQuantities({});
    };

    const handleVarQtyChange = (varName, delta, maxStock) => {
        setSelectedVarQuantities(prev => {
            const current = prev[varName] || 0;
            const updated = Math.max(0, Math.min(maxStock, current + delta));
            return {
                ...prev,
                [varName]: updated
            };
        });
    };

    // Adjust ticket quantities
    const handleUpdateQty = (productId, variationName, delta) => {
        setTicket(prev => {
            return prev.map(item => {
                if (item.id === productId && item.variationName === variationName) {
                    if (item.isBundle) return item; // Disallow +/- for bundles
                    const newQty = item.qty + delta;
                    if (newQty <= 0) return null;
                    if (newQty > item.maxStock) {
                        showToast(t.stockOut, "⚠️");
                        return { ...item, qty: item.maxStock };
                    }
                    return { ...item, qty: newQty };
                }
                return item;
            }).filter(Boolean);
        });
    };

    // Remove item (handles undo for bundles)
    const handleRemoveItem = (productId, variationName) => {
        setTicket(prev => {
            const itemToRemove = prev.find(item => item.id === productId && item.variationName === variationName);
            if (itemToRemove && itemToRemove.isBundle) {
                // Restore individual items
                let newTicket = prev.filter(item => !(item.id === productId && item.variationName === variationName));
                
                itemToRemove.bundleItems.forEach(bItem => {
                    const originalProduct = products.find(p => p.id === bItem.productId);
                    if (!originalProduct) return;
                    
                    const existingIdx = newTicket.findIndex(t => t.id === bItem.productId && t.variationName === bItem.variationName);
                    if (existingIdx > -1) {
                        newTicket[existingIdx].qty += bItem.qty;
                    } else {
                        newTicket.push({
                            id: bItem.productId,
                            name: originalProduct.name,
                            price: originalProduct.price, // fallback if no variation
                            qty: bItem.qty,
                            variationName: bItem.variationName,
                            maxStock: originalProduct.stock // This isn't perfect for variations but fine for restore
                        });
                        // Recalculate price/stock if it's a variation
                        if (bItem.variationName && originalProduct.variations) {
                            const variation = originalProduct.variations.find(v => v.name === bItem.variationName);
                            if (variation) {
                                newTicket[newTicket.length-1].price = variation.price;
                                newTicket[newTicket.length-1].maxStock = variation.stock;
                            }
                        }
                    }
                });
                showToast("Promo dibatalkan", "🔙");
                return newTicket;
            }
            
            showToast("Barang dihapus.", "🗑️");
            return prev.filter(item => !(item.id === productId && item.variationName === variationName));
        });
    };

    // Clear ticket
    const handleClearTicket = () => {
        if (ticket.length === 0) return;
        setTicket([]);
        setDismissedBundles(new Set()); // Reset dismissed banners
        setTransactionDiscountInput('');
        showToast(t.cleared, "🧹");
    };

    // Begin Checkout Flow
    const handleCheckoutPress = async () => {
        if (ticket.length === 0) {
            showToast(t.emptyTicket, "⚠️");
            return;
        }

        const currentTotals = calculateTotals();

        if (paymentMethod === 'qris') {
            setShowQrisModal(true);
            setShowStaticQrisFallback(qrisConfig?.mode === 'static_image');
            setQrisError('');
            setQrisCheckStatus('');
            setQrisDataUrl('');
            setDynamicQrisData(null);

            if (qrisConfig?.mode === 'static_image') {
                return;
            }

            setQrisLoading(true);
            try {
                const cfg = qrisConfig || (await getQrisConfig());
                const generated = await generateCheckoutDynamicQris({
                    amountIdr: currentTotals.total,
                    config: cfg
                });
                const qrPngUrl = await QRCode.toDataURL(generated.qrContent, {
                    width: 280,
                    margin: 1,
                    color: { dark: '#171717', light: '#FFFFFF' },
                    errorCorrectionLevel: 'M'
                });
                setDynamicQrisData(generated);
                setQrisDataUrl(qrPngUrl);
            } catch (err) {
                console.error('Dynamic QRIS generation error:', err);
                setQrisError(err.message || 'Gagal membuat QRIS dinamis');
                setShowStaticQrisFallback(true);
            } finally {
                setQrisLoading(false);
            }
        } else {
            // Open Cash Tender Modal for change calculation
            setCashReceivedInput(String(currentTotals.total)); // Pre-fill with exact amount
            setShowCashModal(true);
        }
    };

    const handleCheckDanaStatus = async () => {
        if (!dynamicQrisData?.partnerReferenceNo || !qrisConfig?.danaProxyUrl) return;
        setQrisCheckStatus('checking');
        try {
            const res = await queryDanaPaymentStatus({
                config: qrisConfig,
                partnerReferenceNo: dynamicQrisData.partnerReferenceNo,
                referenceNo: dynamicQrisData.referenceNo,
                amountIdr: totals.total
            });
            setQrisCheckStatus(res.status);
            if (res.status === 'PAID') {
                showToast('Pembayaran DANA QRIS terkonfirmasi LUNAS!', '✅');
                await completeCheckout({
                    qrisRef: dynamicQrisData.partnerReferenceNo,
                    qrisSource: 'dana_snap'
                });
            } else if (res.status === 'PENDING') {
                showToast('Pembayaran belum masuk (PENDING).', '⏳');
            } else if (res.status === 'CANCELLED') {
                showToast('QRIS dibatalkan / kedaluwarsa.', '⚠️');
            }
        } catch {
            setQrisCheckStatus('error');
            showToast('Gagal memeriksa status ke server DANA.', '⚠️');
        }
    };

    // Execute checkout and write to database
    const completeCheckout = async (cashDetails = null) => {
        const totals = calculateTotals();
        setShowQrisModal(false);
        setShowCashModal(false);
        
        // Expand bundles before saving to DB
        let expandedItems = [];
        ticket.forEach(item => {
            if (item.isBundle) {
                item.bundleItems.forEach(bItem => {
                    const product = products.find(p => p.id === bItem.productId);
                    if (product) {
                        let price = product.price;
                        if (bItem.variationName && product.variations) {
                            const variation = product.variations.find(v => v.name === bItem.variationName);
                            if (variation) price = variation.price;
                        }
                        expandedItems.push({
                            id: bItem.productId,
                            name: product.name,
                            price: price,
                            qty: bItem.qty,
                            variationName: bItem.variationName,
                            fromBundle: item.id
                        });
                    }
                });
            } else {
                expandedItems.push(item);
            }
        });

        // Execute pre-flight stored function validation before opening modal or committing
        const integrityCheck = await fn_validate_cart_stock_integrity(expandedItems);
        if (!integrityCheck.valid) {
            showToast(integrityCheck.reason, "⚠️");
            return;
        }

        try {
            const transaction = await saveTransaction(expandedItems, totals, paymentMethod, activeCashier, totals.appliedBundles, cashDetails);
            setTicket([]);
            setDismissedBundles(new Set());
            setTransactionDiscountInput('');
            setCashReceivedInput('');
            await fetchData(); // Refresh stock variables in grids
            onCheckoutSuccess(transaction);
            showToast(t.paymentSuccess, "🎉");
        } catch {
            showToast("Gagal menyimpan transaksi ke database!", "⚠️");
        }
    };

    // Calculate totals helper (strict integer Rupiah, zero decimals)
    const calculateTotals = () => calculateTicketTotals(ticket, products, transactionDiscountInput);

    const totals = calculateTotals();

    // Bundle Detection Logic (computed via useMemo instead of setState inside useEffect)
    const suggestedBundles = useMemo(() => {
        if (availableBundles.length === 0 || products.length === 0) return [];

        const nonBundleItems = ticket.filter(item => !item.isBundle);
        const suggestions = [];

        availableBundles.forEach(bundle => {
            if (dismissedBundles.has(bundle.id)) return;

            let meetsRequirements = true;
            for (const reqItem of bundle.items) {
                const matchingItems = nonBundleItems.filter(i =>
                    i.id === reqItem.productId &&
                    (reqItem.variationName ? i.variationName === reqItem.variationName : true)
                );

                const totalMatchingQty = matchingItems.reduce((sum, i) => sum + i.qty, 0);

                if (totalMatchingQty < reqItem.qty) {
                    meetsRequirements = false;
                    break;
                }
            }

            if (meetsRequirements) {
                let originalPrice = 0;
                bundle.items.forEach(reqItem => {
                    const prod = products.find(p => p.id === reqItem.productId);
                    if (prod) {
                        let price = prod.price;
                        if (reqItem.variationName && prod.variations) {
                            const variation = prod.variations.find(v => v.name === reqItem.variationName);
                            if (variation) price = variation.price;
                        }
                        originalPrice += price * reqItem.qty;
                    }
                });

                suggestions.push({
                    ...bundle,
                    originalPrice
                });
            }
        });

        return suggestions;
    }, [ticket, availableBundles, dismissedBundles, products]);

    const handleApplyBundle = (bundle) => {
        setTicket(prev => {
            let newTicket = [...prev];
            let success = true;
            let exactItemsConsumed = [];
            
            // Reduce quantities across potentially multiple variations
            for (const reqItem of bundle.items) {
                let qtyNeeded = reqItem.qty;
                
                for (let i = 0; i < newTicket.length; i++) {
                    if (qtyNeeded <= 0) break;
                    let item = newTicket[i];
                    
                    if (!item.isBundle && item.id === reqItem.productId && (reqItem.variationName ? item.variationName === reqItem.variationName : true)) {
                        let qtyToTake = Math.min(item.qty, qtyNeeded);
                        
                        exactItemsConsumed.push({
                            productId: item.id,
                            variationName: item.variationName,
                            qty: qtyToTake
                        });
                        
                        newTicket[i] = { ...item, qty: item.qty - qtyToTake };
                        qtyNeeded -= qtyToTake;
                    }
                }
                
                if (qtyNeeded > 0) {
                    success = false; // Should not happen based on detector
                }
            }
            
            // Clean up rows that hit 0 qty
            newTicket = newTicket.filter(item => item.qty > 0);
            
            if (success) {
                // Add bundle row
                // Ensure unique ID for multiple instances of same bundle
                const instanceId = `${bundle.id}-${Date.now()}`;
                newTicket.push({
                    id: bundle.id,
                    instanceId: instanceId, // internal React key use
                    name: `🎁 ${bundle.name}`,
                    price: bundle.bundlePrice,
                    qty: 1, // Always 1
                    isBundle: true,
                    bundleItems: exactItemsConsumed
                });
                showToast("Promo berhasil diterapkan!", "🎉");
                return newTicket;
            }
            return prev;
        });
    };

    const handleDismissBundle = (bundleId) => {
        setDismissedBundles(prev => {
            const next = new Set(prev);
            next.add(bundleId);
            return next;
        });
    };

    // Format all money values strictly in integer IDR Rupiah
    const formatDisplayMoney = (value) => formatRupiah(value);

    // Filters matching search/categories
    const filteredProducts = products.filter(product => {
        if (product.hiddenFromCatalogue) return false;
        const matchesCategory = activeCategory === 'all' || product.category === activeCategory;
        const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             product.id.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    // Translate category headers
    const getCategoryDisplayLabel = (cat) => {
        const labels = {
            all: "Semua",
            stickers: "Stiker",
            keychains: "Gantungan Kunci",
            prints: "Cetak Gambar",
            washi: "Selotip Washi"
        };
        return labels[cat] || (cat.charAt(0).toUpperCase() + cat.slice(1));
    };

    return (
        <div className="terminal-layout grid grid-cols-1 lg:grid-cols-[1.8fr_1.2fr] gap-5 h-auto pb-10">
            {/* Mobile View Tab Selector */}
            <div className="lg:hidden flex border-2 border-text rounded-xl overflow-hidden mb-1 shrink-0 bg-white font-tag text-xs font-extrabold uppercase shadow-[2px_2px_0px_#181818] w-full">
                <button 
                    type="button"
                    onClick={() => setActiveMobileTab('catalog')}
                    className={`flex-grow py-2.5 text-center border-r-2 border-text transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                        activeMobileTab === 'catalog' ? 'bg-yellow text-text' : 'bg-white text-text/70 hover:bg-yellow-light/50'
                    }`}
                >
                    <i className="fa-solid fa-box-open text-xs"></i> Katalog Produk
                </button>
                <button 
                    type="button"
                    onClick={() => setActiveMobileTab('cart')}
                    className={`flex-grow py-2.5 text-center transition-colors cursor-pointer flex justify-center items-center gap-1.5 ${
                        activeMobileTab === 'cart' ? 'bg-yellow text-text' : 'bg-white text-text/70 hover:bg-yellow-light/50'
                    }`}
                >
                    <i className="fa-solid fa-cart-shopping text-xs"></i> Keranjang ({totals.qty})
                </button>
            </div>
            
            {/* Catalog Grid Panel (Left) */}
            <div className={`catalog-panel flex flex-col h-auto min-h-[400px] bg-white border-[2.5px] border-text rounded-2xl shadow-card overflow-hidden ${activeMobileTab === 'catalog' ? 'block' : 'hidden lg:flex'}`}>
                {/* Retro Window Header */}
                <div className="retro-window-header">
                    <div className="retro-dots hidden sm:flex">
                        <span className="retro-dot retro-dot-red"></span>
                        <span className="retro-dot retro-dot-yellow"></span>
                        <span className="retro-dot retro-dot-blue"></span>
                        <span className="font-tag text-[9.5px] font-black uppercase tracking-wider text-text ml-1">Katalog Barang</span>
                    </div>
                    <span className="sm:hidden font-tag text-[10px] font-black uppercase tracking-wider text-text">Katalog Barang</span>
                    <span className="text-[10px] font-tag font-bold opacity-75">{filteredProducts.length} PRODUK</span>
                </div>

                <div className="p-3 sm:p-4 flex flex-col flex-grow">
                <div className="catalog-controls flex flex-col gap-3 mb-4 shrink-0">
                    <div className="search-box relative flex items-center">
                        <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-text/70 pointer-events-none"></i>
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t.searchPlaceholder}
                            className="w-full font-body border-2 border-text rounded-xl py-2 pl-10 pr-4 text-sm text-text placeholder:text-gray-600 placeholder:font-medium outline-none focus:bg-yellow-light/40"
                        />
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="category-filters flex flex-nowrap overflow-x-auto pb-1.5 gap-2 scrollbar-none -mx-1 px-1 flex-grow">
                            {['all', ...categories].map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={`filter-btn font-tag text-[11px] font-extrabold uppercase border-2 border-text rounded-md px-3 py-1 text-text cursor-pointer transition-all shrink-0 whitespace-nowrap shadow-[1.5px_1.5px_0px_#181818] ${
                                        activeCategory === cat ? 'bg-yellow' : 'bg-white hover:bg-yellow-light'
                                    }`}
                                >
                                    {getCategoryDisplayLabel(cat)}
                                </button>
                            ))}
                        </div>

                        {/* Quick Qty Multiplier for Single items */}
                        <div className="flex items-center gap-1 shrink-0 bg-white border-2 border-text rounded-xl p-1 shadow-[1.5px_1.5px_0px_#181818] self-start sm:self-auto">
                            <span className="font-tag text-[9.5px] font-black uppercase text-text/70 px-1.5">Qty:</span>
                            {[1, 2, 3, 5].map(num => (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={() => setQuickMultiplier(num)}
                                    className={`px-2 py-0.5 rounded-lg border font-title font-bold text-xs transition-all cursor-pointer ${
                                        quickMultiplier === num 
                                            ? 'bg-pink text-text border-text shadow-[1px_1px_0px_#181818]' 
                                            : 'bg-white text-text/70 border-transparent hover:text-text'
                                    }`}
                                >
                                    +{num}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="product-grid-container flex-grow overflow-y-auto pr-1">
                    {loading ? (
                        <div className="text-center py-12 font-bold text-text/60">{t.loadingProducts}</div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="text-center py-12 font-bold text-text/60">{t.noProducts}</div>
                    ) : (
                        <div className="product-grid grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {filteredProducts.map(product => {
                                const hasVars = product.variations && product.variations.length > 0;
                                const hasDiscount = !hasVars && (product.discount || 0) > 0;
                                const hasVarDiscount = hasVars && product.variations.some(v => (v.discount || 0) > 0);
                                const effectivePrice = hasDiscount ? Math.max(0, product.price - product.discount) : product.price;
                                
                                // For variations: compute lowest effective price
                                const varMinOrigPrice = hasVars ? Math.min(...product.variations.map(v => v.price)) : 0;
                                const varMinEffPrice = hasVars ? Math.min(...product.variations.map(v => Math.max(0, v.price - (v.discount || 0)))) : 0;
                                
                                return (
                                    <div 
                                        key={product.id}
                                        onClick={(e) => handleAddToTicket(e, product)}
                                        className={`pos-product-card sticker-cutout rounded-xl p-3 flex flex-col justify-between cursor-pointer select-none relative transition-all duration-150 hover:bg-white active:translate-y-[1px] ${
                                            (product.stock || 0) <= 0
                                                ? 'bg-gray-100 opacity-70'
                                                : (hasDiscount || hasVarDiscount) ? 'bg-pink-light/50 border-pink' : hasVars ? 'bg-blue-light/40' : 'bg-yellow-light/60'
                                        }`}
                                    >
                                        {(hasDiscount || hasVarDiscount) && (
                                            <div className="absolute -top-2 -right-2 bg-pink text-white text-[9px] font-black px-2 py-0.5 rounded-md border-2 border-text shadow-[1.5px_1.5px_0px_#171717] z-10 rotate-6">
                                                ★ SALE!
                                            </div>
                                        )}
                                        {(() => {
                                            const imgUrl = resolveProductImageUrl(product.img);
                                            return imgUrl ? (
                                                <div className="w-full aspect-[4/3] rounded-lg border-2 border-text/80 bg-white overflow-hidden mb-2 relative">
                                                    <img
                                                        src={imgUrl}
                                                        alt={product.name}
                                                        loading="lazy"
                                                        decoding="async"
                                                        className="w-full h-full object-cover"
                                                    />
                                                    {(product.stock || 0) <= 0 && (
                                                        <span className="absolute bottom-1 right-1 bg-rose-600 text-white text-[9px] font-tag font-black px-1.5 py-0.5 rounded border border-text uppercase">
                                                            Habis
                                                        </span>
                                                    )}
                                                </div>
                                            ) : null;
                                        })()}
                                        <div className="flex justify-between items-center gap-1 mb-1">
                                            <span className="text-[10px] font-extrabold opacity-75 font-tag tracking-wider truncate">{product.id}</span>
                                            <span className={`text-[9.5px] font-tag font-extrabold px-1.5 py-0.2 rounded border shrink-0 ${
                                                (product.stock || 0) <= 0
                                                    ? 'bg-rose-100 text-rose-800 border-rose-500'
                                                    : (product.stock || 0) <= 5
                                                        ? 'bg-yellow text-text border-text'
                                                        : 'bg-white/80 text-text/75 border-text/30'
                                            }`}>
                                                {(product.stock || 0) <= 0 ? 'Habis' : `Stok ${product.stock}`}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 mb-1 min-h-[18px]">
                                            {hasVars && (
                                                <span className="bg-yellow border-[1.5px] border-text rounded-md px-1.5 py-0.2 text-[9px] font-black text-text uppercase shrink-0 shadow-[1px_1px_0px_#171717]">
                                                    Variasi
                                                </span>
                                            )}
                                            {product.tag && (
                                                <span className="bg-white border border-text/50 rounded px-1.5 py-0.2 text-[8.5px] font-bold text-text/80 uppercase truncate">
                                                    {product.tag}
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="card-name font-title text-[13.5px] leading-snug mb-2 text-text font-bold line-clamp-2">{product.name}</h4>
                                        <div className="card-row flex justify-between items-center border-t-2 border-dashed border-text/25 pt-2 mt-auto gap-1.5">
                                            <span className="card-price font-title text-[13.5px] font-bold text-text">
                                                {hasDiscount ? (
                                                    <>
                                                        <span className="line-through opacity-50 text-[11px] block">{formatDisplayMoney(product.price)}</span>
                                                        <span className="text-pink">{formatDisplayMoney(effectivePrice)}</span>
                                                    </>
                                                ) : hasVarDiscount ? (
                                                    <>
                                                        <span className="line-through opacity-50 text-[11px] block">{formatDisplayMoney(varMinOrigPrice)}</span>
                                                        <span className="text-pink">{formatDisplayMoney(varMinEffPrice)}</span>
                                                        <span className="text-[9.5px] block font-body opacity-70 font-normal">(Mulai dari)</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        {formatDisplayMoney(hasVars ? varMinOrigPrice : product.price)}
                                                        {hasVars && <span className="text-[9.5px] block font-body opacity-70 font-normal">(Mulai dari)</span>}
                                                    </>
                                                )}
                                            </span>
                                            <span className="bg-white border-2 border-text rounded-lg min-w-[36px] min-h-[36px] px-2.5 py-1 text-[11px] font-title font-bold text-text shadow-[1.5px_1.5px_0px_#181818] flex items-center justify-center gap-1 shrink-0">
                                                <i className="fa-solid fa-plus text-[10px] text-pink"></i>
                                                <span className="hidden sm:inline">Pilih</span>
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                </div>
            </div>

            {/* Ticket Order Panel (Right) */}
            <div className={`ticket-panel flex flex-col h-auto min-h-[450px] bg-white border-[3px] border-text rounded-2xl shadow-pop overflow-hidden ${activeMobileTab === 'cart' ? 'block' : 'hidden lg:flex'}`}>
                {/* Retro Window Header for Ticket */}
                <div className="retro-window-header bg-yellow border-b-[2.5px] border-text px-3.5 py-2 flex items-center justify-between">
                    <div className="retro-dots hidden sm:flex items-center gap-1.5">
                        <span className="retro-dot retro-dot-red"></span>
                        <span className="retro-dot retro-dot-yellow"></span>
                        <span className="retro-dot retro-dot-blue"></span>
                        <span className="font-tag text-[10px] font-black uppercase tracking-wider text-text ml-1.5">Pesanan Aktif</span>
                    </div>
                    <span className="sm:hidden font-tag text-[10px] font-black uppercase tracking-wider text-text">Pesanan Aktif</span>
                    <span className="text-[10px] font-tag font-black uppercase bg-white border border-text px-2 py-0.5 rounded shadow-[1px_1px_0px_#171717]">{totals.qty} PRODUK</span>
                </div>

                <div className="p-4 flex flex-col flex-grow bg-[#FFFDF9]">
                <div className="ticket-header flex justify-between items-center mb-3 pb-2 border-b-2 border-dashed border-text/25 shrink-0">
                    <h3 className="font-title text-[17px] text-text flex items-center gap-2">
                        <span className="bg-pink text-white text-xs px-2 py-0.5 rounded-md border border-text shadow-[1px_1px_0px_#171717]">★</span>
                        <span>{t.activeOrder}</span>
                    </h3>
                    <button 
                        onClick={handleClearTicket}
                        disabled={ticket.length === 0}
                        className={`btn-clear-ticket border-[1.5px] rounded-md px-2.5 py-1 font-tag text-[10px] font-black uppercase flex items-center gap-1 transition-all ${
                            ticket.length === 0
                                ? 'bg-gray-100 text-gray-600 border-gray-400 opacity-80 cursor-not-allowed select-none shadow-none'
                                : 'bg-white border-text text-text cursor-pointer hover:bg-pink hover:text-white shadow-[1px_1px_0px_#171717]'
                        }`}
                    >
                        <i className="fa-solid fa-trash-can"></i> {t.clear}
                    </button>
                </div>
                
                <div className="ticket-items-container flex-grow overflow-y-auto max-h-[250px] lg:max-h-[350px] mb-4 pr-1">
                    {ticket.length === 0 ? (
                        <div className="ticket-empty flex flex-col items-center justify-center text-center h-full text-text/50 gap-2.5 py-8 border-2 border-dashed border-text/15 rounded-xl bg-yellow-light/20">
                            <i className="fa-solid fa-basket-shopping text-4xl text-text/40"></i>
                            <p className="text-xs font-tag font-bold tracking-wide">{t.emptyTicket}</p>
                        </div>
                    ) : (
                        <div className="ticket-items-list flex flex-col gap-2.5">
                            {ticket.map(item => (
                                <div key={item.instanceId || `${item.id}-${item.variationName || 'base'}`} className={`ticket-item-row flex items-center bg-white border-2 rounded-xl p-2.5 gap-2.5 shadow-[2px_2px_0px_#171717] transition-all hover:translate-x-0.5 ${item.discount > 0 ? 'border-pink bg-pink-light/20' : 'border-text'}`}>
                                    <div className="flex flex-col flex-grow min-w-0">
                                        <span className={`t-item-name font-title text-[12px] truncate ${item.isBundle ? 'text-pink font-bold' : 'text-text'}`} title={item.name}>
                                            {item.name}
                                        </span>
                                        {item.discount > 0 && (
                                            <span className="text-[9px] text-pink font-extrabold font-tag">-{formatDisplayMoney(item.discount)}/pcs</span>
                                        )}
                                    </div>
                                    <div className={`t-qty-control flex items-center border-2 border-text rounded-full overflow-hidden h-6.5 bg-white shrink-0 shadow-[1px_1px_0px_#171717] ${item.isBundle ? 'opacity-50' : ''}`}>
                                        <button 
                                            onClick={() => handleUpdateQty(item.id, item.variationName, -1)}
                                            disabled={item.isBundle}
                                            className="t-qty-btn bg-none border-none w-5 h-full cursor-pointer text-[10px] font-black text-text hover:bg-yellow disabled:cursor-not-allowed"
                                        >
                                            -
                                        </button>
                                        <span className="t-qty-num px-1.5 text-[11px] font-black min-w-4 text-center text-text">{item.qty}</span>
                                        <button 
                                            onClick={() => handleUpdateQty(item.id, item.variationName, 1)}
                                            disabled={item.isBundle}
                                            className="t-qty-btn bg-none border-none w-5 h-full cursor-pointer text-[10px] font-black text-text hover:bg-yellow disabled:cursor-not-allowed"
                                        >
                                            +
                                        </button>
                                    </div>
                                    <span className="t-item-price text-[12px] font-title font-bold min-w-[55px] text-right text-text">
                                        {formatDisplayMoney(item.price * item.qty)}
                                    </span>
                                    <button 
                                        onClick={() => handleRemoveItem(item.id, item.variationName)}
                                        className="t-item-remove bg-none border-none text-text/50 hover:text-pink cursor-pointer text-xs p-1 hover:scale-115 shrink-0"
                                    >
                                        <i className="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="ticket-footer border-t-2 border-dashed border-text/20 pt-3 shrink-0 relative">
                    <BundleSuggestionBanner 
                        bundles={suggestedBundles} 
                        onApply={handleApplyBundle} 
                        onDismiss={handleDismissBundle} 
                    />
                    <div className="bill-summary flex flex-col gap-1.5 mb-3 text-text">
                        <div className="summary-line flex justify-between text-xs">
                            <span>{t.itemsCount}:</span>
                            <span>{totals.qty}</span>
                        </div>
                        {totals.totalItemDiscount > 0 && (
                            <div className="summary-line flex justify-between text-xs text-pink font-bold">
                                <span><i className="fa-solid fa-tag"></i> Diskon Item:</span>
                                <span>-{formatDisplayMoney(totals.totalItemDiscount)} (sudah terpotong)</span>
                            </div>
                        )}
                        {totals.appliedBundles && totals.appliedBundles.length > 0 && (
                            <div className="summary-line flex justify-between text-xs text-pink font-bold">
                                <span>Total Diskon Promo:</span>
                                <span>-{formatDisplayMoney(totals.bundleDiscount)}</span>
                            </div>
                        )}

                        {/* Optional Transaction-Level Discount (only shown / active when cashier enters > 0) */}
                        <div className="flex items-center justify-between gap-2 pt-1">
                            <label htmlFor="tx-discount-input" className="text-[11px] font-tag font-bold uppercase tracking-wide text-text/75 flex items-center gap-1 shrink-0">
                                <i className="fa-solid fa-percent text-[10px] text-pink"></i>
                                <span>Diskon Transaksi:</span>
                            </label>
                            <div className="relative flex items-center w-[140px]">
                                <span className="absolute left-2 text-[11px] font-title font-bold text-text/60 pointer-events-none">Rp</span>
                                <input
                                    id="tx-discount-input"
                                    type="text"
                                    inputMode="numeric"
                                    disabled={ticket.length === 0}
                                    value={transactionDiscountInput}
                                    onChange={(e) => setTransactionDiscountInput(sanitizeIntegerInput(e.target.value))}
                                    placeholder="0"
                                    className="w-full border-2 border-text rounded-lg py-1 pl-7 pr-6 text-xs font-title font-bold text-right bg-white outline-none focus:bg-yellow-light/30 disabled:opacity-50"
                                />
                                {transactionDiscountInput && (
                                    <button
                                        type="button"
                                        onClick={() => setTransactionDiscountInput('')}
                                        title="Hapus diskon transaksi"
                                        className="absolute right-1.5 text-[10px] text-text/50 hover:text-pink cursor-pointer"
                                    >
                                        <i className="fa-solid fa-xmark"></i>
                                    </button>
                                )}
                            </div>
                        </div>

                        {totals.transactionDiscount > 0 && (
                            <div className="summary-line flex justify-between text-xs text-pink font-bold">
                                <span>Potongan Transaksi:</span>
                                <span>-{formatDisplayMoney(totals.transactionDiscount)}</span>
                            </div>
                        )}

                        <div className="summary-line font-bold flex justify-between text-[16px] border-t border-text/15 pt-1.5">
                            <span>{t.totalAmount}:</span>
                            <span>{formatDisplayMoney(totals.total)}</span>
                        </div>
                    </div>

                    {/* Payment methods: Cash / QRIS only */}
                    <div className="payment-section mb-3 text-text">
                        <span className="section-label font-tag text-[10.5px] font-black uppercase tracking-wider block mb-1.5">{t.paymentMethod}</span>
                        <div className="payment-options grid grid-cols-2 gap-3">
                            {['cash', 'qris'].map(method => (
                                <label key={method} className="payment-opt cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="payment-method" 
                                        value={method} 
                                        checked={paymentMethod === method}
                                        onChange={() => setPaymentMethod(method)}
                                        className="hidden" 
                                    />
                                    <div className={`payment-card border-2 border-text rounded-xl p-2.5 text-center bg-white font-tag text-[11px] font-black uppercase shadow-[2px_2px_0px_#171717] flex flex-col items-center gap-1.5 transition-all ${
                                        paymentMethod === method ? 'bg-yellow shadow-[1px_1px_0px_#171717] translate-y-0.5' : 'hover:bg-yellow-light/50'
                                    }`}>
                                        <i className={`fa-solid ${
                                            method === 'cash' ? 'fa-money-bill-wave' : 'fa-qrcode'
                                        } text-base`}></i>
                                        <span>{method === 'cash' ? t.cash : t.qris}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <button 
                        onClick={handleCheckoutPress}
                        disabled={ticket.length === 0 || totals.total <= 0}
                        className={`btn btn-primary btn-block border-[2.5px] border-text rounded-xl font-tag text-[13px] font-black uppercase tracking-wider px-6 py-3 transition-all flex items-center justify-center gap-2 w-full ${
                            ticket.length === 0 || totals.total <= 0
                                ? 'bg-gray-200 text-gray-600 border-gray-500 opacity-85 cursor-not-allowed select-none shadow-none'
                                : 'bg-pink text-text shadow-[3px_3px_0px_#171717] hover:bg-white hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_#171717] active:translate-y-[1px] active:shadow-[1px_1px_0px_#171717] cursor-pointer'
                        }`}
                    >
                        <span>{t.process} 🛒</span>
                    </button>
                </div>
                </div>
            </div>

            {/* Variation Selection Bubble Modal (Touch & Mobile Optimized Multi-Variation Selector) */}
            {variationProduct && (
                <div className="fixed inset-0 bg-[#181818]/50 backdrop-blur-sm z-[10001] flex justify-center items-center p-3 sm:p-4">
                    <div className="bg-white border-[3px] border-text rounded-2xl shadow-card w-[94vw] max-w-[420px] max-h-[88vh] overflow-hidden flex flex-col p-4 sm:p-5 text-text relative">
                        <div className="washi-tape tape-yellow-1 absolute top-[-10px] left-8 transform rotate-[-4deg] h-6 w-24 bg-pink-light"></div>
                        
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pb-1 border-b border-text/15 mb-3">
                    <div className="flex items-center gap-2.5 w-full">
                        {resolveProductImageUrl(variationProduct.img) && (
                            <img
                                src={resolveProductImageUrl(variationProduct.img)}
                                alt={variationProduct.name}
                                className="w-11 h-11 rounded-lg border-2 border-text object-cover shrink-0 bg-white"
                            />
                        )}
                        <div className="min-w-0 flex-grow">
                            <span className="font-tag text-[10px] font-black uppercase tracking-wider text-pink block">Multi-Selection</span>
                            <h3 className="font-title text-base font-bold text-text truncate" title={variationProduct.name}>
                                {variationProduct.name}
                            </h3>
                        </div>
                    </div>
                    <button 
                        onClick={() => {
                            setVariationProduct(null);
                            setSelectedVarQuantities({});
                        }}
                        className="w-8 h-8 rounded-full border-2 border-text bg-yellow-light hover:bg-yellow flex items-center justify-center text-text hover:text-pink transition-transform hover:scale-105 cursor-pointer shadow-[1px_1px_0px_#181818] shrink-0 self-end sm:self-center"
                    >
                        <i className="fa-solid fa-xmark text-sm"></i>
                    </button>
                </div>
                        
                        <p className="text-[11px] font-body text-text/70 mb-2.5">
                            Tentukan jumlah tiap opsi variasi yang dibeli:
                        </p>

                        {/* Scrollable Variations List */}
                        <div className="flex flex-col gap-2 w-full flex-grow overflow-y-auto pr-1 mb-3 max-h-[48vh]">
                            {variationProduct.variations.map((v, idx) => {
                                const isOut = v.stock <= 0;
                                const vDiscount = v.discount || 0;
                                const vHasDiscount = vDiscount > 0;
                                const effectiveVPrice = Math.max(0, v.price - vDiscount);
                                const selectedQty = selectedVarQuantities[v.name] || 0;

                                return (
                                    <div
                                        key={idx}
                                        className={`flex flex-col sm:flex-row sm:items-center justify-between border-2 rounded-xl p-2.5 gap-2 transition-all ${
                                            isOut 
                                                ? 'bg-text/5 opacity-55 border-text/30' 
                                                : selectedQty > 0
                                                    ? 'bg-yellow-light/40 border-text shadow-[1.5px_1.5px_0px_#181818]'
                                                    : 'bg-white border-text/40 hover:border-text'
                                        }`}
                                    >
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-title text-xs font-bold text-text truncate">{v.name}</span>
                                                {isOut && <span className="text-[9px] bg-gray-200 text-gray-700 font-bold px-1.5 py-0.2 rounded border border-text/30">Habis</span>}
                                                {vHasDiscount && <span className="text-[8px] bg-pink text-white px-1.5 py-0.2 rounded font-tag font-bold">SALE!</span>}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5 text-xs">
                                                <span className="font-title font-bold text-pink text-xs">{formatDisplayMoney(effectiveVPrice)}</span>
                                                {vHasDiscount && (
                                                    <span className="text-[10px] line-through text-text/40">{formatDisplayMoney(v.price)}</span>
                                                )}
                                                <span className="text-[10px] text-text/60 font-mono">Sisa: {v.stock}</span>
                                            </div>
                                        </div>

                                        {/* Stepper Controls (Touch friendly) */}
                                        <div className="flex items-center justify-end gap-2 shrink-0 self-end sm:self-center">
                                            <button
                                                type="button"
                                                disabled={isOut || selectedQty <= 0}
                                                onClick={() => handleVarQtyChange(v.name, -1, v.stock)}
                                                className={`w-8 h-8 rounded-lg border-2 border-text font-title font-black flex items-center justify-center text-sm transition-all ${
                                                    selectedQty > 0 
                                                        ? 'bg-pink text-text shadow-[1px_1px_0px_#181818] active:translate-y-[1px] cursor-pointer' 
                                                        : 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed opacity-50'
                                                }`}
                                            >
                                                -
                                            </button>
                                            <span className="w-8 text-center font-title font-bold text-sm text-text select-none">
                                                {selectedQty}
                                            </span>
                                            <button
                                                type="button"
                                                disabled={isOut || selectedQty >= v.stock}
                                                onClick={() => handleVarQtyChange(v.name, 1, v.stock)}
                                                className={`w-8 h-8 rounded-lg border-2 border-text font-title font-black flex items-center justify-center text-sm transition-all ${
                                                    !isOut && selectedQty < v.stock
                                                        ? 'bg-yellow text-text shadow-[1px_1px_0px_#181818] active:translate-y-[1px] cursor-pointer' 
                                                        : 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed opacity-50'
                                                }`}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Sticky Action Footer */}
                        {(() => {
                            const totalSelectedQty = Object.values(selectedVarQuantities).reduce((sum, q) => sum + (q || 0), 0);
                            const totalSelectedPrice = variationProduct.variations.reduce((sum, v) => {
                                const q = selectedVarQuantities[v.name] || 0;
                                const effPrice = Math.max(0, (v.price || 0) - (v.discount || 0));
                                return sum + (effPrice * q);
                            }, 0);

                            return (
                                <div className="border-t-2 border-dashed border-text/20 pt-2.5 mt-auto flex flex-col gap-2">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-tag font-bold uppercase text-[10px] text-text/70">
                                            {totalSelectedQty} Item Dipilih
                                        </span>
                                        <span className="font-title font-bold text-sm text-pink">
                                            {formatDisplayMoney(totalSelectedPrice)}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={totalSelectedQty <= 0}
                                        onClick={handleBatchAddVariations}
                                        className={`w-full py-2.5 rounded-xl border-2 border-text font-title font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                                            totalSelectedQty > 0
                                                ? 'bg-pink text-text shadow-[2px_2px_0px_#181818] hover:bg-white active:translate-y-[1px] active:shadow-none cursor-pointer'
                                                : 'bg-gray-200 text-gray-400 border-gray-400 cursor-not-allowed opacity-60'
                                        }`}
                                    >
                                        <i className="fa-solid fa-cart-plus"></i>
                                        <span>+ Masukkan ke Keranjang</span>
                                    </button>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Cash Payment & Change (Angsul) Calculation Modal */}
            {showCashModal && (
                <div className="fixed inset-0 bg-[#181818]/50 backdrop-blur-sm z-[10001] flex justify-center items-center p-3 sm:p-4">
                    <div className="bg-white border-[3px] border-text rounded-2xl shadow-card w-[94vw] max-w-[380px] overflow-hidden flex flex-col p-4 sm:p-5 text-text relative">
                        <div className="washi-tape tape-yellow-1 absolute top-[-10px] left-8 transform rotate-[-4deg] h-6 w-24 bg-yellow"></div>
                        
                        {/* Header */}
                        <div className="w-full flex justify-between items-center border-b border-text/15 pb-2 mb-3">
                            <div>
                                <span className="font-tag text-[10px] font-black uppercase tracking-wider text-pink block">Pembayaran Tunai</span>
                                <h3 className="font-title text-base font-bold text-text">
                                    Hitung Kembalian (Angsul)
                                </h3>
                            </div>
                            <button 
                                onClick={() => setShowCashModal(false)}
                                className="w-8 h-8 rounded-full border-2 border-text bg-yellow-light hover:bg-yellow flex items-center justify-center text-text hover:text-pink transition-transform hover:scale-105 cursor-pointer shadow-[1px_1px_0px_#181818]"
                            >
                                <i className="fa-solid fa-xmark text-sm"></i>
                            </button>
                        </div>

                        {/* Bill Total Card */}
                        <div className="bg-blue-light/35 border-2 border-text rounded-xl p-3 flex justify-between items-center mb-3.5">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-text/70 block font-tag">Total Tagihan</span>
                                <span className="font-title font-extrabold text-lg text-text">
                                    {formatDisplayMoney(totals.total)}
                                </span>
                            </div>
                            <span className="bg-white border border-text px-2 py-0.5 rounded font-tag text-[10px] font-bold">
                                {totals.qty} barang
                            </span>
                        </div>

                        {/* Input Cash Received */}
                        <div className="flex flex-col gap-1.5 mb-3">
                            <label className="text-[11px] font-bold uppercase text-text/80 font-tag tracking-wider flex justify-between">
                                <span>Uang Diterima dari Pembeli:</span>
                                <span className="text-pink font-bold">{formatDisplayMoney(toIntRupiah(cashReceivedInput))}</span>
                            </label>
                            <div className="relative flex items-center">
                                <span className="absolute left-3 font-title font-bold text-sm text-text/60">Rp</span>
                                <input 
                                    type="text"
                                    inputMode="numeric"
                                    autoFocus
                                    placeholder="0"
                                    value={cashReceivedInput}
                                    onChange={(e) => setCashReceivedInput(sanitizeIntegerInput(e.target.value))}
                                    className="w-full border-2 border-text rounded-xl py-2 pl-9 pr-3 text-base font-title font-bold text-text outline-none focus:bg-yellow-light/20 bg-white"
                                />
                            </div>
                        </div>

                        {/* Quick Nominal Chips */}
                        <div className="flex flex-wrap gap-1.5 mb-3.5">
                            <button
                                type="button"
                                onClick={() => setCashReceivedInput(String(totals.total))}
                                className="text-[10.5px] font-tag font-bold bg-yellow border border-text rounded-lg px-2 py-1 shadow-[1px_1px_0px_#181818] hover:bg-white transition-all cursor-pointer"
                            >
                                Uang Pas
                            </button>
                            {[10000, 20000, 50000, 100000].map(nominal => (
                                <button
                                    key={nominal}
                                    type="button"
                                    onClick={() => setCashReceivedInput(String(nominal))}
                                    className="text-[10.5px] font-tag font-bold bg-white border border-text rounded-lg px-2 py-1 shadow-[1px_1px_0px_#181818] hover:bg-yellow-light transition-all cursor-pointer"
                                >
                                    {nominal >= 1000 ? `${nominal / 1000}k` : nominal}
                                </button>
                            ))}
                            {/* Nearest ceiling denomination if applicable */}
                            {totals.total > 0 && totals.total % 10000 !== 0 && (
                                <button
                                    type="button"
                                    onClick={() => setCashReceivedInput(String(Math.ceil(totals.total / 10000) * 10000))}
                                    className="text-[10.5px] font-tag font-bold bg-pink-light border border-text rounded-lg px-2 py-1 shadow-[1px_1px_0px_#181818] hover:bg-white transition-all cursor-pointer text-text"
                                >
                                    Bulat {Math.ceil(totals.total / 10000) * 10}k
                                </button>
                            )}
                        </div>

                        {/* Change / Shortage Display Box */}
                        {(() => {
                            const received = toIntRupiah(cashReceivedInput);
                            const change = received - totals.total;
                            const isSufficient = change >= 0;

                            return (
                                <div className={`border-2 rounded-xl p-3 mb-4 text-center transition-all ${
                                    isSufficient 
                                        ? 'bg-emerald-50 border-emerald-600 shadow-[2px_2px_0px_#166534]' 
                                        : 'bg-rose-50 border-rose-500 shadow-[2px_2px_0px_#9f1239]'
                                }`}>
                                    <span className="text-[10px] uppercase font-bold tracking-wider block font-tag">
                                        {isSufficient ? 'Kembalian / Angsul:' : 'Uang Masih Kurang:'}
                                    </span>
                                    <span className={`font-title font-extrabold text-xl block mt-0.5 ${
                                        isSufficient ? 'text-emerald-800' : 'text-rose-700'
                                    }`}>
                                        {formatDisplayMoney(Math.abs(change))}
                                    </span>
                                </div>
                            );
                        })()}

                        {/* Submit Action Button */}
                        {(() => {
                            const received = toIntRupiah(cashReceivedInput);
                            const change = Math.max(0, received - totals.total);
                            const isSufficient = received >= totals.total;

                            return (
                                <button 
                                    type="button"
                                    disabled={!isSufficient}
                                    onClick={() => completeCheckout({ cashReceived: received, change })}
                                    className={`w-full py-2.5 rounded-xl border-[2.5px] border-text font-title font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                                        isSufficient
                                            ? 'bg-pink text-text shadow-[2.5px_2.5px_0px_#181818] hover:bg-white active:translate-y-[1px] active:shadow-none cursor-pointer'
                                            : 'bg-gray-200 text-gray-400 border-gray-400 cursor-not-allowed opacity-60 shadow-none'
                                    }`}
                                >
                                    <i className="fa-solid fa-check-circle"></i>
                                    <span>Konfirmasi & Simpan Transaksi</span>
                                </button>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Interactive Dynamic QRIS Scan Overlay Modal */}
            {showQrisModal && (
                <div className="fixed inset-0 bg-[#181818]/50 backdrop-blur-sm z-[10001] flex justify-center items-center p-4">
                    <div className="bg-white border-[3px] border-text rounded-2xl shadow-card w-[94vw] max-w-[360px] overflow-hidden flex flex-col items-center p-5 text-text relative">
                        <div className="washi-tape tape-ticket absolute top-[-10px] left-10 transform rotate-[-4deg] h-6 w-24"></div>
                        
                        <div className="w-full flex justify-between items-center border-b border-text/10 pb-2.5 mb-3">
                            <span className="font-title text-base font-bold text-center w-full">{t.qrisScan}</span>
                            <button 
                                onClick={() => setShowQrisModal(false)}
                                className="absolute right-4 text-text hover:text-pink transition-transform hover:scale-110 cursor-pointer"
                            >
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>

                        {/* Dynamic / Static mode badge */}
                        <div className="flex items-center justify-center gap-1.5 mb-3 flex-wrap">
                            <span className={`text-[10px] font-tag font-extrabold uppercase px-2.5 py-0.5 rounded-full border border-text ${
                                showStaticQrisFallback
                                    ? 'bg-yellow-light text-text'
                                    : dynamicQrisData?.source === 'dana_snap'
                                        ? 'bg-blue-light text-text'
                                        : 'bg-emerald-100 text-emerald-900'
                            }`}>
                                {showStaticQrisFallback
                                    ? 'QRIS Statis (Input Manual)'
                                    : dynamicQrisData?.source === 'dana_snap'
                                        ? 'DANA SNAP Dynamic QRIS'
                                        : 'QRIS Dinamis (Nominal Otomatis)'}
                            </span>
                            {dynamicQrisData?.merchantName && !showStaticQrisFallback && (
                                <span className="text-[10px] font-tag font-bold bg-pink-light border border-text/40 px-2 py-0.5 rounded-full">
                                    {dynamicQrisData.merchantName}
                                </span>
                            )}
                        </div>
                        
                        {/* QRIS Code Graphic */}
                        <div className="border-[3px] border-text p-2 rounded-xl bg-white mb-3 relative shadow-[4px_4px_0px_#181818] w-[220px] h-[220px] flex items-center justify-center overflow-hidden">
                            {qrisLoading ? (
                                <div className="flex flex-col items-center gap-2 text-xs font-bold text-text/70">
                                    <i className="fa-solid fa-spinner fa-spin text-2xl text-pink"></i>
                                    <span>Membuat QR Dinamis...</span>
                                </div>
                            ) : showStaticQrisFallback || !qrisDataUrl ? (
                                <img src="/qris.png" alt="QRIS Code" className="w-full h-full object-contain" />
                            ) : (
                                <img src={qrisDataUrl} alt="Dynamic QRIS Code" className="w-full h-full object-contain" />
                            )}
                        </div>

                        {qrisError && (
                            <p className="text-[10.5px] text-rose-700 font-bold text-center mb-2">
                                {qrisError} (Menampilkan fallback QRIS statis)
                            </p>
                        )}

                        {/* Invoice billing details */}
                        <div className="w-full bg-blue-light border-2 border-text rounded-xl p-3 text-center mb-3 font-bold text-sm">
                            <div>Total: <span className="text-pink font-title font-extrabold text-lg">{formatDisplayMoney(totals.total)}</span></div>
                            {dynamicQrisData?.partnerReferenceNo && !showStaticQrisFallback && (
                                <div className="text-[10px] font-mono text-text/70 mt-0.5">
                                    Ref: {dynamicQrisData.partnerReferenceNo}
                                </div>
                            )}
                        </div>

                        <p className="text-[11px] text-center opacity-85 leading-relaxed mb-3">
                            {showStaticQrisFallback
                                ? t.scanPrompt
                                : 'Nominal sudah terkunci otomatis di kode QR. Pindai dengan DANA, GoPay, OVO, ShopeePay, atau Mobile Banking.'}
                        </p>

                        <div className="flex flex-col gap-2 w-full">
                            {dynamicQrisData?.source === 'dana_snap' && qrisConfig?.danaProxyUrl && !showStaticQrisFallback && (
                                <button
                                    type="button"
                                    disabled={qrisCheckStatus === 'checking'}
                                    onClick={handleCheckDanaStatus}
                                    className="btn bg-yellow text-text border-2 border-text rounded-full font-title text-xs px-4 py-2 shadow-[2px_2px_0px_#181818] hover:bg-white transition-all w-full cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                    <i className={`fa-solid ${qrisCheckStatus === 'checking' ? 'fa-spinner fa-spin' : 'fa-magnifying-glass-dollar'}`}></i>
                                    <span>{qrisCheckStatus === 'checking' ? 'Mengecek DANA...' : 'Cek Status Pembayaran DANA'}</span>
                                </button>
                            )}

                            <button 
                                type="button"
                                onClick={() => completeCheckout(dynamicQrisData && !showStaticQrisFallback ? {
                                    qrisRef: dynamicQrisData.partnerReferenceNo,
                                    qrisSource: dynamicQrisData.source
                                } : null)}
                                className="btn bg-pink text-text border-[3px] border-text rounded-full font-title text-[13px] px-6 py-2.5 shadow-btn hover:bg-white hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_#181818] transition-all w-full cursor-pointer"
                            >
                                Lunas & Simpan Transaksi
                            </button>

                            {qrisDataUrl && (
                                <button
                                    type="button"
                                    onClick={() => setShowStaticQrisFallback(prev => !prev)}
                                    className="text-[11px] font-bold text-text/70 hover:text-pink underline cursor-pointer py-1"
                                >
                                    {showStaticQrisFallback ? 'Gunakan QRIS Dinamis' : 'Gunakan Gambar QRIS Statis (/qris.png)'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
