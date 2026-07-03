import React, { useState, useEffect } from 'react';
import { getProducts, saveTransaction, getCategories } from '../services/db';
import { t } from '../services/translations';

export default function Register({ onCheckoutSuccess, showToast, activeCashier }) {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const [ticket, setTicket] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [loading, setLoading] = useState(true);
    
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
            const [prodsData, catsData] = await Promise.all([
                getProducts(),
                getCategories()
            ]);
            setProducts(prodsData);
            setCategories(catsData);
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
        const finalPrice = selectedVar ? selectedVar.price : product.price;
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

    // Remove item
    const handleRemoveItem = (productId, variationName) => {
        setTicket(prev => prev.filter(item => !(item.id === productId && item.variationName === variationName)));
        showToast("Barang dihapus.", "🗑️");
    };

    // Clear ticket
    const handleClearTicket = () => {
        if (ticket.length === 0) return;
        setTicket([]);
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

        try {
            const transaction = await saveTransaction(ticket, totals, paymentMethod, activeCashier);
            setTicket([]);
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
        
        ticket.forEach(item => {
            qty += item.qty;
            subtotal += item.price * item.qty;
        });
        
        const total = subtotal; // Grand total is exactly equal to subtotal
        return { qty, subtotal, total };
    };

    const totals = calculateTotals();

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
            all: "🌟 Semua",
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
            <div className="lg:hidden flex border-2 border-text rounded-xl overflow-hidden mb-1 shrink-0 bg-white font-title text-xs font-bold shadow-[2px_2px_0px_#32628f] w-full">
                <button 
                    type="button"
                    onClick={() => setActiveMobileTab('catalog')}
                    className={`flex-grow py-3 text-center border-r-2 border-text transition-colors cursor-pointer ${
                        activeMobileTab === 'catalog' ? 'bg-yellow' : 'bg-white hover:bg-yellow-light/50'
                    }`}
                >
                    🛍️ Katalog Produk
                </button>
                <button 
                    type="button"
                    onClick={() => setActiveMobileTab('cart')}
                    className={`flex-grow py-3 text-center transition-colors cursor-pointer flex justify-center items-center gap-1.5 ${
                        activeMobileTab === 'cart' ? 'bg-yellow' : 'bg-white hover:bg-yellow-light/50'
                    }`}
                >
                    🛒 Keranjang ({totals.qty})
                </button>
            </div>
            
            {/* Catalog Grid Panel (Left) */}
            <div className={`catalog-panel flex flex-col h-auto min-h-[400px] bg-white border-[3px] border-text rounded-2xl shadow-card p-4 overflow-visible ${activeMobileTab === 'catalog' ? 'block' : 'hidden lg:flex'}`}>
                <div className="catalog-controls flex flex-col gap-3 mb-4 shrink-0">
                    <div className="search-box relative flex items-center">
                        <i className="fa-solid fa-magnifying-glass absolute left-3.5 text-text"></i>
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t.searchPlaceholder}
                            className="w-full font-body border-[3px] border-text rounded-xl py-2 pl-10 pr-4 text-sm text-text outline-none focus:bg-yellow-light"
                        />
                    </div>
                    
                    <div className="category-filters flex flex-wrap gap-2">
                        {['all', ...categories].map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`filter-btn font-title text-[12px] font-bold bg-white border-2 border-text rounded-full px-3.5 py-1.5 text-text cursor-pointer transition-all ${
                                    activeCategory === cat ? 'bg-blue shadow-[2px_2px_0px_#32628f] translate-y-[-1px] translate-x-[-1px]' : 'hover:bg-pink-light'
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
                                return (
                                    <div 
                                        key={product.id}
                                        onClick={(e) => handleAddToTicket(e, product)}
                                        className={`pos-product-card border-2 border-text rounded-xl p-3.5 flex flex-col justify-between cursor-pointer select-none relative transition-all duration-200 hover:translate-y-[-3px] hover:shadow-[3px_3px_0px_#32628f] hover:bg-white active:translate-y-[1px] active:shadow-[1px_1px_0px_#32628f] ${
                                            hasVars ? 'bg-blue-light/35' : 'bg-yellow-light'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start gap-2 mb-1.5">
                                            <span className="text-[10px] font-bold opacity-60 font-body truncate">{product.id}</span>
                                            {hasVars && (
                                                <span className="bg-pink-light border border-text rounded-full px-1.5 py-0.2 text-[8.5px] font-extrabold text-text uppercase shrink-0">
                                                    Variasi
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="card-name font-title text-[13.5px] leading-tight mb-2.5 text-text font-bold line-clamp-2">{product.name}</h4>
                                        <div className="card-row flex justify-between items-center border-t border-dashed border-text/25 pt-2 mt-auto">
                                            <span className="card-price font-title text-[13px] font-bold text-text">
                                                {formatDisplayMoney(hasVars ? Math.min(...product.variations.map(v => v.price)) : product.price)}
                                                {hasVars && <span className="text-[9px] block font-body opacity-70 font-normal">(Mulai dari)</span>}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Ticket Order Panel (Right) */}
            <div className={`ticket-panel flex flex-col h-auto min-h-[450px] bg-yellow-light border-[3px] border-text rounded-2xl shadow-card p-4 overflow-visible relative ${activeMobileTab === 'cart' ? 'block' : 'hidden lg:flex'}`}>
                <div className="washi-tape tape-ticket absolute top-[-10px] left-1/2 transform translate-x-[-50%] rotate-[2deg] h-6 w-24 z-5 border-l border-r border-dashed border-text/25"></div>
                
                <div className="ticket-header flex justify-between items-center mb-3 pb-2 border-b-2 border-dashed border-text/20 shrink-0">
                    <h3 className="font-title text-[18px] text-text"><i className="fa-solid fa-receipt"></i> {t.activeOrder}</h3>
                    <button 
                        onClick={handleClearTicket}
                        className="btn-clear-ticket bg-none border-none text-text font-title text-[11px] font-bold cursor-pointer flex items-center gap-1 hover:text-pink hover:scale-105"
                    >
                        <i className="fa-solid fa-trash-can"></i> {t.clear}
                    </button>
                </div>
                
                <div className="ticket-items-container flex-grow overflow-y-auto max-h-[250px] lg:max-h-[350px] mb-4">
                    {ticket.length === 0 ? (
                        <div className="ticket-empty flex flex-col items-center justify-center text-center h-full text-text/50 gap-2">
                            <i className="fa-solid fa-basket-shopping text-4xl"></i>
                            <p className="text-xs font-bold">{t.emptyTicket}</p>
                        </div>
                    ) : (
                        <div className="ticket-items-list flex flex-col gap-2.5">
                            {ticket.map(item => (
                                <div key={`${item.id}-${item.variationName || 'base'}`} className="ticket-item-row flex items-center bg-white border-2 border-text rounded-lg p-2.5 gap-2.5 shadow-[2px_2px_0px_#32628f]">
                                    <span className="t-item-name font-title text-[12px] flex-grow truncate text-text" title={item.name}>
                                        {item.name}
                                    </span>
                                    <div className="t-qty-control flex items-center border-[1.5px] border-text rounded-full overflow-hidden h-6 bg-white shrink-0">
                                        <button 
                                            onClick={() => handleUpdateQty(item.id, item.variationName, -1)}
                                            className="t-qty-btn bg-none border-none w-5 h-full cursor-pointer text-[10px] font-bold text-text hover:bg-blue-light"
                                        >
                                            -
                                        </button>
                                        <span className="t-qty-num px-1 text-[11px] font-bold min-w-4 text-center text-text">{item.qty}</span>
                                        <button 
                                            onClick={() => handleUpdateQty(item.id, item.variationName, 1)}
                                            className="t-qty-btn bg-none border-none w-5 h-full cursor-pointer text-[10px] font-bold text-text hover:bg-blue-light"
                                        >
                                            +
                                        </button>
                                    </div>
                                    <span className="t-item-price text-[12px] font-bold min-w-[55px] text-right text-text">
                                        {formatDisplayMoney(item.price * item.qty)}
                                    </span>
                                    <button 
                                        onClick={() => handleRemoveItem(item.id, item.variationName)}
                                        className="t-item-remove bg-none border-none text-pink cursor-pointer text-xs p-0.5 hover:scale-115 shrink-0"
                                    >
                                        <i className="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="ticket-footer border-t-2 border-dashed border-text/20 pt-3 shrink-0">
                    <div className="bill-summary flex flex-col gap-1.5 mb-3 text-text">
                        <div className="summary-line flex justify-between text-xs">
                            <span>{t.itemsCount}:</span>
                            <span>{totals.qty}</span>
                        </div>
                        <div className="summary-line font-bold flex justify-between text-[16px] border-t border-text/15 pt-1.5">
                            <span>{t.totalAmount}:</span>
                            <span>{formatDisplayMoney(totals.total)}</span>
                        </div>
                    </div>

                    {/* Payment methods: Cash / QRIS only */}
                    <div className="payment-section mb-3 text-text">
                        <span className="section-label font-title text-[11px] font-bold block mb-1.5">{t.paymentMethod}</span>
                        <div className="payment-options grid grid-cols-2 gap-4">
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
                                    <div className={`payment-card border-2 border-text rounded-lg p-2 text-center bg-white font-title text-[12px] font-bold shadow-[2px_2px_0px_#32628f] flex flex-col items-center gap-1.5 transition-all ${
                                        paymentMethod === method ? 'bg-yellow translate-y-[1px] translate-x-[1px] shadow-[1px_1px_0px_#32628f]' : ''
                                    }`}>
                                        <i className={`fa-solid ${
                                            method === 'cash' ? 'fa-money-bill-wave' : 'fa-qrcode'
                                        } text-lg`}></i>
                                        <span>{method === 'cash' ? t.cash : t.qris}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <button 
                        onClick={handleCheckoutPress}
                        className="btn btn-primary btn-block bg-pink text-text border-[3px] border-text rounded-full font-title text-[14px] px-6 py-2.5 shadow-btn hover:bg-white hover:translate-y-[-3px] hover:shadow-[5px_5px_0px_#32628f] active:translate-y-[1px] active:shadow-[2px_2px_0px_#32628f] transition-all cursor-pointer flex items-center justify-center gap-2 bounce-hover w-full"
                    >
                        <span>{t.process} 🛒</span>
                    </button>
                </div>
            </div>

            {/* Variation Selection Bubble Modal */}
            {variationProduct && (
                <div className="fixed inset-0 bg-[#32628F]/50 backdrop-blur-sm z-[10001] flex justify-center items-center p-4">
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
                                return (
                                    <button
                                        key={idx}
                                        disabled={isOut}
                                        onClick={(e) => handleAddToTicket(e, variationProduct, v)}
                                        className={`flex justify-between items-center border-2 border-text rounded-xl p-3 font-title text-xs text-text transition-all ${
                                            isOut 
                                                ? 'bg-text/5 opacity-55 cursor-not-allowed border-text/30' 
                                                : 'bg-yellow-light hover:bg-yellow cursor-pointer shadow-[2px_2px_0px_#32628f] hover:translate-y-[-2px] active:translate-y-[0px] active:shadow-[1px_1px_0px_#32628f]'
                                        }`}
                                    >
                                        <span className="font-bold">{v.name} {isOut && " (Habis)"}</span>
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-pink">{formatDisplayMoney(v.price)}</span>
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
                <div className="fixed inset-0 bg-[#32628F]/50 backdrop-blur-sm z-[10001] flex justify-center items-center p-4">
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
                        <div className="border-[3px] border-text p-1.5 rounded-xl bg-white mb-4 relative shadow-[4px_4px_0px_#32628f] w-[200px] h-[200px] flex items-center justify-center overflow-hidden">
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
                            className="btn bg-pink text-text border-[3px] border-text rounded-full font-title text-[13px] px-6 py-2 shadow-btn hover:bg-white hover:translate-y-[-3px] hover:shadow-[5px_5px_0px_#32628f] transition-all w-full cursor-pointer"
                        >
                            Lunas
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
