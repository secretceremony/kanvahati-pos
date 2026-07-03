import React, { useState, useEffect } from 'react';
import { getBundles, saveBundle, deleteBundle, getProducts } from '../services/db';
import { t } from '../services/translations';

export default function Bundles() {
    const [bundles, setBundles] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingBundle, setEditingBundle] = useState(null);
    
    // Form state
    const [formData, setFormData] = useState({
        name: '',
        bundlePrice: '',
        isActive: true,
        items: []
    });

    const loadData = async () => {
        setLoading(true);
        const [loadedBundles, loadedProducts] = await Promise.all([
            getBundles(),
            getProducts()
        ]);
        setBundles(loadedBundles);
        setProducts(loadedProducts);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleOpenModal = (bundle = null) => {
        if (bundle) {
            setEditingBundle(bundle);
            setFormData({
                name: bundle.name,
                bundlePrice: bundle.bundlePrice.toString(),
                isActive: bundle.isActive,
                items: bundle.items.map(i => ({...i}))
            });
        } else {
            setEditingBundle(null);
            setFormData({
                name: '',
                bundlePrice: '',
                isActive: true,
                items: [{ productId: '', variationName: '', qty: 1 }]
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingBundle(null);
    };

    const handleAddItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [...prev.items, { productId: '', variationName: '', qty: 1 }]
        }));
    };

    const handleRemoveItem = (index) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const handleItemChange = (index, field, value) => {
        setFormData(prev => {
            const newItems = [...prev.items];
            newItems[index] = { ...newItems[index], [field]: value };
            
            // Auto-reset variation if product changes
            if (field === 'productId') {
                newItems[index].variationName = '';
            }
            return { ...prev, items: newItems };
        });
    };

    const calculateOriginalPrice = (items) => {
        let total = 0;
        items.forEach(item => {
            if (!item.productId) return;
            const product = products.find(p => p.id === item.productId);
            if (product) {
                let price = product.price;
                if (item.variationName && product.variations && product.variations.length > 0) {
                    const variation = product.variations.find(v => v.name === item.variationName);
                    if (variation) price = variation.price;
                }
                total += price * (parseInt(item.qty) || 1);
            }
        });
        return total;
    };

    const handleSave = async (e) => {
        e.preventDefault();
        
        // Validation
        if (!formData.name.trim()) return alert("Nama bundle harus diisi");
        if (!formData.bundlePrice || parseFloat(formData.bundlePrice) <= 0) return alert("Harga bundle tidak valid");
        
        const validItems = formData.items.filter(i => i.productId && parseInt(i.qty) > 0);
        const totalQty = validItems.reduce((sum, i) => sum + parseInt(i.qty), 0);
        if (totalQty < 2) return alert("Bundle minimal harus memiliki kuantitas total 2 produk");

        const bundleToSave = {
            id: editingBundle ? editingBundle.id : undefined,
            name: formData.name,
            bundlePrice: parseFloat(formData.bundlePrice),
            isActive: formData.isActive,
            items: validItems,
            createdAt: editingBundle ? editingBundle.createdAt : new Date().toISOString()
        };

        await saveBundle(bundleToSave);
        handleCloseModal();
        loadData();
    };

    const handleDelete = async (id) => {
        if (window.confirm("Apakah Anda yakin ingin menghapus bundle ini?")) {
            await deleteBundle(id);
            loadData();
        }
    };

    const formatMoney = (value) => {
        return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
    };

    return (
        <div className="bundles-layout lg:h-full h-auto p-4 md:p-6 bg-white border-[3px] border-text rounded-2xl shadow-card relative">
            <div className="washi-tape tape-yellow-1 absolute top-[-10px] left-1/2 transform translate-x-[-50%] rotate-[-2deg] h-6 w-28 bg-yellow-light border-l border-r border-dashed border-text/25"></div>
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="font-title text-2xl text-text title-stroke"><i className="fa-solid fa-tags"></i> Kelola {t.bundles}</h2>
                    <p className="text-sm opacity-80 mt-1">Buat paket promosi yang otomatis muncul di terminal kasir.</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="btn bg-pink text-text border-[3px] border-text rounded-full font-title text-[14px] px-5 py-2.5 shadow-btn hover:bg-white hover:translate-y-[-3px] transition-all cursor-pointer flex items-center gap-2"
                >
                    <i className="fa-solid fa-plus"></i> {t.addBundle}
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 font-bold text-text/60">Memuat Bundle...</div>
            ) : bundles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-text/40 gap-3 border-2 border-dashed border-text/30 rounded-xl bg-blue-light/10">
                    <i className="fa-solid fa-gift text-5xl"></i>
                    <p className="font-bold">Belum ada bundle/promo yang dibuat.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {bundles.map(bundle => {
                        const originalPrice = calculateOriginalPrice(bundle.items);
                        const discount = originalPrice - bundle.bundlePrice;
                        
                        return (
                            <div key={bundle.id} className={`bundle-card border-[3px] border-text rounded-2xl p-5 relative transition-all flex flex-col ${bundle.isActive ? 'bg-white shadow-[6px_6px_0px_#32628f]' : 'bg-gray-100 opacity-60'}`}>
                                {!bundle.isActive && (
                                    <div className="absolute top-2 right-2 bg-text text-white text-[10px] font-bold px-2 py-1 rounded-full">{t.inactive}</div>
                                )}
                                <h3 className="font-title text-xl text-text leading-tight mb-2 pr-12">{bundle.name}</h3>
                                
                                <div className="mb-4">
                                    <span className="text-xs opacity-60 line-through mr-2">{formatMoney(originalPrice)}</span>
                                    <span className="font-bold text-pink text-lg">{formatMoney(bundle.bundlePrice)}</span>
                                    {discount > 0 && (
                                        <div className="inline-block ml-2 bg-yellow-light border-2 border-text text-[10px] font-bold px-2 py-0.5 rounded-full transform -rotate-2">
                                            HEMAT {formatMoney(discount)}
                                        </div>
                                    )}
                                </div>

                                <div className="bg-blue-light/30 border-2 border-text/20 rounded-xl p-3 mb-4 flex-grow">
                                    <h4 className="text-[11px] font-bold uppercase mb-2 opacity-80">{t.bundleItems}:</h4>
                                    <ul className="text-sm space-y-1">
                                        {bundle.items.map((item, idx) => {
                                            const prod = products.find(p => p.id === item.productId);
                                            return (
                                                <li key={idx} className="flex items-start gap-2">
                                                    <i className="fa-solid fa-check text-pink mt-1 text-[10px]"></i>
                                                    <span className="flex-grow">
                                                        {prod ? prod.name : 'Produk Dihapus'} 
                                                        {item.variationName && <span className="text-xs opacity-70 ml-1">({item.variationName})</span>}
                                                    </span>
                                                    <span className="font-bold">x{item.qty}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>

                                <div className="flex gap-2 mt-auto">
                                    <button 
                                        onClick={() => handleOpenModal(bundle)}
                                        className="flex-1 bg-blue-light border-2 border-text rounded-full py-1.5 text-xs font-bold shadow-[2px_2px_0px_#32628f] hover:bg-white transition-colors cursor-pointer"
                                    >
                                        Edit
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(bundle.id)}
                                        className="bg-white text-pink border-2 border-text rounded-full px-3 py-1.5 text-xs shadow-[2px_2px_0px_#32628f] hover:bg-pink-light transition-colors cursor-pointer"
                                    >
                                        <i className="fa-solid fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal Form */}
            {showModal && (
                <div className="fixed inset-0 bg-text/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white border-[3px] border-text rounded-2xl w-full max-w-[600px] max-h-[90vh] flex flex-col shadow-[8px_8px_0px_#32628f] overflow-hidden animate-[ticketSlide_0.3s_ease-out]">
                        <div className="p-5 border-b-[3px] border-text bg-pink-light flex justify-between items-center shrink-0">
                            <h2 className="font-title text-xl text-text title-stroke">
                                {editingBundle ? "Edit Bundle" : t.addBundle}
                            </h2>
                            <button onClick={handleCloseModal} className="text-text hover:text-pink transition-colors cursor-pointer">
                                <i className="fa-solid fa-xmark text-xl"></i>
                            </button>
                        </div>
                        
                        <div className="p-5 overflow-y-auto flex-grow">
                            <form id="bundle-form" onSubmit={handleSave} className="flex flex-col gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold uppercase">{t.bundleName}</label>
                                    <input 
                                        type="text" 
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        className="w-full border-2 border-text rounded-xl p-2 text-sm outline-none focus:bg-yellow-light/30"
                                        placeholder="Misal: Paket Hemat Back to School"
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold uppercase">Status Bundle</label>
                                    <label className="flex items-center gap-2 cursor-pointer w-fit">
                                        <input 
                                            type="checkbox" 
                                            checked={formData.isActive}
                                            onChange={e => setFormData({...formData, isActive: e.target.checked})}
                                            className="w-4 h-4 cursor-pointer accent-pink"
                                        />
                                        <span className="text-sm font-bold">{formData.isActive ? t.active : t.inactive}</span>
                                    </label>
                                </div>

                                <div className="border-t-2 border-text/10 pt-4 mt-2">
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="text-xs font-bold uppercase">{t.bundleItems}</label>
                                        <button type="button" onClick={handleAddItem} className="text-[11px] font-bold text-pink hover:underline cursor-pointer">
                                            + Tambah Produk
                                        </button>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        {formData.items.map((item, index) => {
                                            const selectedProd = products.find(p => p.id === item.productId);
                                            const hasVariations = selectedProd && selectedProd.variations && selectedProd.variations.length > 0;
                                            
                                            return (
                                                <div key={index} className="flex flex-wrap gap-2 items-start bg-blue-light/10 p-3 border-2 border-text/30 rounded-xl relative">
                                                    <div className="flex-grow min-w-[200px]">
                                                        <select 
                                                            required
                                                            value={item.productId}
                                                            onChange={e => handleItemChange(index, 'productId', e.target.value)}
                                                            className="w-full border-2 border-text rounded-lg p-1.5 text-sm bg-white cursor-pointer"
                                                        >
                                                            <option value="">-- Pilih Produk --</option>
                                                            {products.map(p => (
                                                                <option key={p.id} value={p.id}>{p.name} ({formatMoney(p.price)})</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    
                                                    {hasVariations && (
                                                        <div className="w-[120px]">
                                                            <select
                                                                value={item.variationName || ""}
                                                                onChange={e => handleItemChange(index, 'variationName', e.target.value)}
                                                                className="w-full border-2 border-text rounded-lg p-1.5 text-sm bg-white cursor-pointer"
                                                            >
                                                                <option value="">Semua Variasi (Campur)</option>
                                                                {selectedProd.variations.map(v => (
                                                                    <option key={v.name} value={v.name}>{v.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                    
                                                    <div className="w-[80px] flex items-center gap-2">
                                                        <span className="text-xs font-bold">Qty:</span>
                                                        <input 
                                                            type="number" 
                                                            min="1"
                                                            required
                                                            value={item.qty}
                                                            onChange={e => handleItemChange(index, 'qty', parseInt(e.target.value) || 1)}
                                                            className="w-full border-2 border-text rounded-lg p-1.5 text-sm bg-white text-center outline-none focus:border-pink"
                                                        />
                                                    </div>
                                                    
                                                    {formData.items.length > 1 && (
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleRemoveItem(index)}
                                                            className="text-pink hover:text-red-500 absolute -top-2 -right-2 bg-white border-2 border-text rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-sm cursor-pointer"
                                                        >
                                                            <i className="fa-solid fa-xmark"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="border-t-2 border-text/10 pt-4 mt-2">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold uppercase">{t.bundlePrice}</label>
                                        <div className="flex gap-4 items-center">
                                            <input 
                                                type="number" 
                                                required
                                                min="0"
                                                value={formData.bundlePrice}
                                                onChange={e => setFormData({...formData, bundlePrice: e.target.value})}
                                                className="w-full border-2 border-text rounded-xl p-2 text-lg font-bold outline-none focus:bg-yellow-light/30"
                                                placeholder="Contoh: 55000"
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Live Preview Harga */}
                                    <div className="mt-4 p-4 bg-yellow-light/40 border-2 border-dashed border-text/40 rounded-xl">
                                        <h4 className="text-[10px] font-bold uppercase opacity-70 mb-2">Simulasi Harga</h4>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm">Harga Asli (Satuan):</span>
                                            <span className="font-bold line-through opacity-70">{formatMoney(calculateOriginalPrice(formData.items))}</span>
                                        </div>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm">Harga Bundle:</span>
                                            <span className="font-bold text-pink">{formatMoney(parseFloat(formData.bundlePrice) || 0)}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-t border-text/20 pt-2 text-sm font-bold">
                                            <span>Pelanggan Hemat:</span>
                                            <span className="bg-yellow border-2 border-text px-2 py-0.5 rounded-full text-[11px] transform -rotate-2">
                                                {formatMoney(Math.max(0, calculateOriginalPrice(formData.items) - (parseFloat(formData.bundlePrice) || 0)))}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                        
                        <div className="p-4 border-t-[3px] border-text bg-gray-50 flex justify-end gap-3 shrink-0">
                            <button 
                                type="button"
                                onClick={handleCloseModal}
                                className="px-4 py-2 text-sm font-bold rounded-full border-2 border-transparent hover:bg-gray-200 transition-colors cursor-pointer"
                            >
                                Batal
                            </button>
                            <button 
                                type="submit"
                                form="bundle-form"
                                className="bg-pink text-text px-6 py-2 rounded-full border-[3px] border-text font-bold text-sm shadow-[3px_3px_0px_#32628f] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#32628f] transition-all cursor-pointer"
                            >
                                Simpan Bundle
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
