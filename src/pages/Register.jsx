import React, { useState, useEffect } from 'react';
import { getProducts, saveTransaction, getCategories, getBundles } from '../services/db';
import { t } from '../services/translations';
import BundleSuggestionBanner from '../components/BundleSuggestionBanner';

export default function Register({ onCheckoutSuccess, showToast, activeCashier }) {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const [ticket, setTicket] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [loading, setLoading] = useState(true);
    
    // Bundles state
    const [availableBundles, setAvailableBundles] = useState([]);
    const [suggestedBundles, setSuggestedBundles] = useState([]);
    const [dismissedBundles, setDismissedBundles] = useState(new Set());
    
    // QRIS scan overlay visibility state
    const [showQrisModal, setShowQrisModal] = useState(false);

    // Variation selector state
    const [variationProduct, setVariationProduct] = useState(null);

    // Mobile layout toggle state
    const [activeMobileTab, setActiveMobileTab] = useState('catalog');

    // Fetch products and categories list from DB Layer
    const fetchData = async () => {
        try {
            setLoading(true);
            const [prodsData, catsData, bundlesData] = await Promise.all([
                getProducts(),
                getCategories(),
                getBundles()
            ]);
            setProducts(prodsData);
            setCategories(catsData);
            setAvailableBundles(bundlesData.filter(b => b.isActive));
        } catch (e) {
            console.error("Failed to load catalog data", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Sparkle burst effect (using clean geometric stars instead of emojis)
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

    // Add Item to ticket (supports variation selection)
    const handleAddToTicket = (e, product, selectedVar = null) => {
        if (e && e.clientX) triggerSparkles(e.clientX, e.clientY);

        // Check if item has variations and one is not yet selected
        if (product.variations && product.variations.length > 0 && !selectedVar) {
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
        if (existing) {
            if (existing.qty < maxStock) {
                showToast(`"${displayName}" ${t.increased}`, "✨");
                setTicket(prev => prev.map(item => 
                    (item.id === product.id && item.variationName === varName) 
                        ? { ...item, qty: item.qty + 1 } 
                        : item
                ));
            } else {
                showToast(t.stockOut, "⚠️");
            }
        } else {
            showToast(`"${displayName}" ${t.added}`, "🌸");
            setTicket(prev => [...prev, {
                id: product.id,
                name: displayName,
                price: finalPrice,
                originalPrice: basePrice,
                discount: itemDiscount,
                qty: 1,
                maxStock: maxStock,
                variationName: varName
            }]);
        }

        // Close selector if it was open
        setVariationProduct(null);
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
        showToast(t.cleared, "🧹");
    };

    // Begin Checkout Flow
    const handleCheckoutPress = () => {
        if (ticket.length === 0) {
            showToast(t.emptyTicket, "⚠️");
            return;
        }

        if (paymentMethod === 'qris') {
            setShowQrisModal(true); // Pop up QRIS scan layout first
        } else {
            completeCheckout(); // Proceed directly for Cash
        }
    };

    // Execute checkout and write to database
    const completeCheckout = async () => {
        const totals = calculateTotals();
        setShowQrisModal(false);
        
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

        try {
            const transaction = await saveTransaction(expandedItems, totals, paymentMethod, activeCashier, totals.appliedBundles);
            setTicket([]);
            setDismissedBundles(new Set());
            await fetchData(); // Refresh stock variables in grids
            onCheckoutSuccess(transaction);
            showToast(t.paymentSuccess, "🎉");
        } catch (e) {
            showToast("Gagal menyimpan transaksi ke database!", "⚠️");
        }
    };

    // Calculate totals helper
    const calculateTotals = () => {
        let qty = 0;
        let subtotal = 0;
        let totalItemDiscount = 0;
        let appliedBundles = [];
        
        ticket.forEach(item => {
            if (item.isBundle) {
                qty += item.bundleItems.reduce((sum, b) => sum + b.qty, 0); // count individual items
                
                // Calculate discount for display
                let originalPrice = 0;
                item.bundleItems.forEach(bItem => {
                    const prod = products.find(p => p.id === bItem.productId);
                    if (prod) {
                        let price = prod.price;
                        if (bItem.variationName && prod.variations) {
                            const variation = prod.variations.find(v => v.name === bItem.variationName);
                            if (variation) price = variation.price;
                        }
                        originalPrice += price * bItem.qty;
                    }
                });
                
                appliedBundles.push({
                    bundleId: item.id,
                    bundleName: item.name.replace('🎁 ', ''),
                    originalPrice,
                    bundlePrice: item.price,
                    discount: Math.max(0, originalPrice - item.price)
                });
                
                subtotal += originalPrice; // Add the original price to the subtotal
            } else {
                qty += item.qty;
                subtotal += item.price * item.qty;
                if ((item.discount || 0) > 0) {
                    totalItemDiscount += item.discount * item.qty;
                }
            }
        });
        
        const totalDiscount = appliedBundles.reduce((sum, b) => sum + b.discount, 0);
        const total = subtotal - totalDiscount;
        return { qty, subtotal, total, appliedBundles, totalItemDiscount };
    };

    const totals = calculateTotals();

    // Bundle Detection Logic
    useEffect(() => {
        if (availableBundles.length === 0 || products.length === 0) return;
        
        const nonBundleItems = ticket.filter(item => !item.isBundle);
        let suggestions = [];
        
        availableBundles.forEach(bundle => {
            if (dismissedBundles.has(bundle.id)) return;
            
            // Check if all requirements are met
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
                // Calculate original price for banner display
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
        
        setSuggestedBundles(suggestions);
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

    // Format all money values strictly in IDR Rupiah
    const formatDisplayMoney = (value) => {
        return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
    };

    // Filters matching search/categories
    const filteredProducts = products.filter(product => {
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
                    <div className="retro-dots">
                        <span className="retro-dot retro-dot-red"></span>
                        <span className="retro-dot retro-dot-yellow"></span>
                        <span className="retro-dot retro-dot-blue"></span>
                        <span className="font-tag text-[9.5px] font-black uppercase tracking-wider text-text ml-1">Katalog Barang</span>
                    </div>
                    <span className="text-[10px] font-tag font-bold opacity-75">{filteredProducts.length} Items</span>
                </div>

                <div className="p-4 flex flex-col flex-grow">
                <div className="catalog-controls flex flex-col gap-3 mb-4 shrink-0">
                    <div className="search-box relative flex items-center">
                        <i className="fa-solid fa-magnifying-glass absolute left-3.5 text-text"></i>
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t.searchPlaceholder}
                            className="w-full font-body border-2 border-text rounded-xl py-2 pl-10 pr-4 text-sm text-text outline-none focus:bg-yellow-light/40"
                        />
                    </div>
                    
                    <div className="category-filters flex flex-nowrap overflow-x-auto pb-1.5 gap-2 scrollbar-none -mx-1 px-1">
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
                                        className={`pos-product-card sticker-cutout rounded-xl p-3.5 flex flex-col justify-between cursor-pointer select-none relative transition-all duration-150 hover:bg-white active:translate-y-[1px] ${
                                            (hasDiscount || hasVarDiscount) ? 'bg-pink-light/50 border-pink' : hasVars ? 'bg-blue-light/40' : 'bg-yellow-light/60'
                                        }`}
                                    >
                                        {(hasDiscount || hasVarDiscount) && (
                                            <div className="absolute -top-2 -right-2 bg-pink text-white text-[9px] font-black px-2 py-0.5 rounded-md border-2 border-text shadow-[1.5px_1.5px_0px_#171717] z-10 rotate-6">
                                                ★ SALE!
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center gap-1 mb-1 pr-6">
                                            <span className="text-[10px] font-extrabold opacity-70 font-tag tracking-wider truncate">{product.id}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 mb-1.5 min-h-[18px]">
                                            {hasVars && (
                                                <span className="bg-yellow border-[1.5px] border-text rounded-md px-1.5 py-0.2 text-[8.5px] font-black text-text uppercase shrink-0 shadow-[1px_1px_0px_#171717]">
                                                    Variasi
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="card-name font-title text-[13.5px] leading-tight mb-2.5 text-text font-bold line-clamp-2">{product.name}</h4>
                                        <div className="card-row flex justify-between items-center border-t-2 border-dashed border-text/25 pt-2 mt-auto">
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
                                                        <span className="text-[9px] block font-body opacity-70 font-normal">(Mulai dari)</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        {formatDisplayMoney(hasVars ? varMinOrigPrice : product.price)}
                                                        {hasVars && <span className="text-[9px] block font-body opacity-70 font-normal">(Mulai dari)</span>}
                                                    </>
                                                )}
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
                    <div className="retro-dots flex items-center gap-1.5">
                        <span className="retro-dot retro-dot-red"></span>
                        <span className="retro-dot retro-dot-yellow"></span>
                        <span className="retro-dot retro-dot-blue"></span>
                        <span className="font-tag text-[10px] font-black uppercase tracking-wider text-text ml-1.5">Pesanan Aktif</span>
                    </div>
                    <span className="text-[10px] font-tag font-black uppercase bg-white border border-text px-2 py-0.5 rounded shadow-[1px_1px_0px_#171717]">{ticket.length} Macam</span>
                </div>

                <div className="p-4 flex flex-col flex-grow bg-[#FFFDF9]">
                <div className="ticket-header flex justify-between items-center mb-3 pb-2 border-b-2 border-dashed border-text/25 shrink-0">
                    <h3 className="font-title text-[17px] text-text flex items-center gap-2">
                        <span className="bg-pink text-white text-xs px-2 py-0.5 rounded-md border border-text shadow-[1px_1px_0px_#171717]">★</span>
                        <span>{t.activeOrder}</span>
                    </h3>
                    <button 
                        onClick={handleClearTicket}
                        className="btn-clear-ticket bg-white border-[1.5px] border-text rounded-md px-2 py-1 text-text font-tag text-[10px] font-black uppercase cursor-pointer flex items-center gap-1 hover:bg-pink hover:text-white transition-all shadow-[1px_1px_0px_#171717]"
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
                                <span><i className="fa-solid fa-tag"></i> Diskon Item (Cuci Gudang):</span>
                                <span>-{formatDisplayMoney(totals.totalItemDiscount)} (sudah terpotong)</span>
                            </div>
                        )}
                        {totals.appliedBundles && totals.appliedBundles.length > 0 && (
                            <div className="summary-line flex justify-between text-xs text-pink font-bold">
                                <span>Total Diskon Promo:</span>
                                <span>-{formatDisplayMoney(totals.appliedBundles.reduce((s, b) => s + b.discount, 0))}</span>
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
                        className="btn btn-primary btn-block bg-pink text-text border-[2.5px] border-text rounded-xl font-tag text-[13px] font-black uppercase tracking-wider px-6 py-3 shadow-[3px_3px_0px_#171717] hover:bg-white hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_#171717] active:translate-y-[1px] active:shadow-[1px_1px_0px_#171717] transition-all cursor-pointer flex items-center justify-center gap-2 w-full"
                    >
                        <span>{t.process} 🛒</span>
                    </button>
                </div>
                </div>
            </div>

            {/* Variation Selection Bubble Modal */}
            {variationProduct && (
                <div className="fixed inset-0 bg-[#181818]/50 backdrop-blur-sm z-[10001] flex justify-center items-center p-4">
                    <div className="bg-white border-[3px] border-text rounded-2xl shadow-card w-[340px] overflow-hidden flex flex-col p-5 text-text relative">
                        <div className="washi-tape tape-yellow-1 absolute top-[-10px] left-10 transform rotate-[-4deg] h-6 w-24 bg-pink-light"></div>
                        
                        <div className="w-full flex justify-between items-center border-b border-text/10 pb-2.5 mb-4">
                            <span className="font-title text-base font-bold text-center w-full">Pilih Variasi Produk</span>
                            <button 
                                onClick={() => setVariationProduct(null)}
                                className="absolute right-4 text-text hover:text-pink transition-transform hover:scale-110 cursor-pointer"
                            >
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>
                        
                        <h4 className="font-title text-sm font-bold text-text mb-3 text-center">{variationProduct.name}</h4>

                        <div className="flex flex-col gap-2.5 w-full max-h-[220px] overflow-y-auto pr-1 mb-2">
                            {variationProduct.variations.map((v, idx) => {
                                const isOut = v.stock <= 0;
                                const vDiscount = v.discount || 0;
                                const vHasDiscount = vDiscount > 0;
                                const effectiveVPrice = Math.max(0, v.price - vDiscount);
                                return (
                                    <button
                                        key={idx}
                                        disabled={isOut}
                                        onClick={(e) => handleAddToTicket(e, variationProduct, v)}
                                        className={`flex justify-between items-center border-2 rounded-xl p-3 font-title text-xs text-text transition-all ${
                                            isOut 
                                                ? 'bg-text/5 opacity-55 cursor-not-allowed border-text/30' 
                                                : vHasDiscount
                                                    ? 'bg-pink-light/30 border-pink hover:bg-pink-light cursor-pointer shadow-[2px_2px_0px_#181818] hover:translate-y-[-2px] active:translate-y-[0px] active:shadow-[1px_1px_0px_#181818]'
                                                    : 'bg-yellow-light hover:bg-yellow cursor-pointer shadow-[2px_2px_0px_#181818] hover:translate-y-[-2px] active:translate-y-[0px] active:shadow-[1px_1px_0px_#181818]'
                                        }`}
                                    >
                                        <div className="flex flex-col items-start">
                                            <span className="font-bold">{v.name} {isOut && " (Habis)"}</span>
                                            {vHasDiscount && <span className="text-[8px] bg-pink text-white px-1.5 py-0.5 rounded-full font-bold mt-0.5">SALE!</span>}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {vHasDiscount ? (
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] line-through opacity-50">{formatDisplayMoney(v.price)}</span>
                                                    <span className="font-bold text-pink">{formatDisplayMoney(effectiveVPrice)}</span>
                                                </div>
                                            ) : (
                                                <span className="font-bold text-pink">{formatDisplayMoney(v.price)}</span>
                                            )}
                                            <span className="bg-white border border-text/30 px-1.5 py-0.5 rounded text-[10px]">Stok: {v.stock}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Interactive QRIS Scan Overlay Modal */}
            {showQrisModal && (
                <div className="fixed inset-0 bg-[#181818]/50 backdrop-blur-sm z-[10001] flex justify-center items-center p-4">
                    <div className="bg-white border-[3px] border-text rounded-2xl shadow-card w-[340px] overflow-hidden flex flex-col items-center p-5 text-text relative">
                        <div className="washi-tape tape-ticket absolute top-[-10px] left-10 transform rotate-[-4deg] h-6 w-24"></div>
                        
                        <div className="w-full flex justify-between items-center border-b border-text/10 pb-2.5 mb-4">
                            <span className="font-title text-base font-bold text-center w-full">{t.qrisScan}</span>
                            <button 
                                onClick={() => setShowQrisModal(false)}
                                className="absolute right-4 text-text hover:text-pink transition-transform hover:scale-110 cursor-pointer"
                            >
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>
                        
                        {/* QRIS Code Graphic */}
                        <div className="border-[3px] border-text p-1.5 rounded-xl bg-white mb-4 relative shadow-[4px_4px_0px_#181818] w-[200px] h-[200px] flex items-center justify-center overflow-hidden">
                            <img src="/qris.png" alt="QRIS Code" className="w-full h-full object-contain" />
                        </div>

                        {/* Invoice billing details */}
                        <div className="w-full bg-blue-light border-2 border-text rounded-lg p-3 text-center mb-4 font-bold text-sm">
                            <div>Total: <span className="text-pink font-title font-extrabold text-base">{formatDisplayMoney(totals.total)}</span></div>
                        </div>

                        <p className="text-[11px] text-center opacity-85 leading-relaxed mb-5">
                            {t.scanPrompt}
                        </p>

                        <button 
                            onClick={completeCheckout}
                            className="btn bg-pink text-text border-[3px] border-text rounded-full font-title text-[13px] px-6 py-2 shadow-btn hover:bg-white hover:translate-y-[-3px] hover:shadow-[5px_5px_0px_#181818] transition-all w-full cursor-pointer"
                        >
                            Lunas
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
