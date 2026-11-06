import React, { useState, useEffect } from 'react';
import { getBundles, saveBundle, deleteBundle, getProducts, sp_import_bundles_batch } from '../services/db';
import * as XLSX from 'xlsx';
import { recordAuditLog } from '../services/audit';
import { t } from '../services/translations';

export default function Bundles({ showToast, currentUser, userRole }) {
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

    // CSV Import Modal state for Bundles
    const [showImportModal, setShowImportModal] = useState(false);
    const [importPreview, setImportPreview] = useState([]);
    const [importErrors, setImportErrors] = useState([]);

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

        const isNew = !editingBundle;
        const oldBundle = editingBundle;
        await saveBundle(bundleToSave);

        await recordAuditLog({
            action: isNew ? 'DISCOUNT_CHANGE' : 'DISCOUNT_CHANGE',
            summary: isNew 
                ? `Bundle/Promo baru "${bundleToSave.name}" dibuat dengan harga ${formatMoney(bundleToSave.bundlePrice)}`
                : `Bundle/Promo "${bundleToSave.name}" diubah: harga ${oldBundle ? formatMoney(oldBundle.bundlePrice) : '-'} -> ${formatMoney(bundleToSave.bundlePrice)}, status: ${bundleToSave.isActive ? 'Aktif' : 'Nonaktif'}`,
            actor: {
                uid: currentUser?.uid,
                email: currentUser?.email,
                displayName: currentUser?.displayName || 'Staf',
                role: userRole
            },
            details: {
                bundleId: bundleToSave.id,
                name: bundleToSave.name,
                bundlePrice: bundleToSave.bundlePrice,
                isActive: bundleToSave.isActive,
                items: bundleToSave.items
            }
        });

        if (showToast) showToast(isNew ? "Bundle promo berhasil dibuat!" : "Bundle promo diperbarui!", "🏷️");
        handleCloseModal();
        loadData();
    };

    const handleDelete = async (id) => {
        if (window.confirm("Apakah Anda yakin ingin menghapus bundle ini?")) {
            const bundleToDelete = bundles.find(b => b.id === id);
            await deleteBundle(id);
            await recordAuditLog({
                action: 'DISCOUNT_CHANGE',
                summary: `Bundle/Promo "${bundleToDelete?.name || id}" dihapus`,
                actor: {
                    uid: currentUser?.uid,
                    email: currentUser?.email,
                    displayName: currentUser?.displayName || 'Staf',
                    role: userRole
                },
                details: { bundleId: id, deletedBundle: bundleToDelete }
            });
            if (showToast) showToast("Bundle promo dihapus!", "🗑️");
            loadData();
        }
    };

    // Download XLSX Template for Bundles
    const handleDownloadBundlesTemplate = () => {
        const templateRows = [
            {
                "ID (Opsional, kosongkan utk auto)": "BDL-1001",
                "Nama Bundle": "Paket Wibu Hemat",
                "Harga Bundle (Rp)": 35000,
                "Status Aktif (TRUE/FALSE)": "TRUE",
                "Item Bundle Format (ProductID:Qty:Variasi|...)": "STICKER-01:2|KEYCHAIN-01:1:Matcha"
            },
            {
                "ID (Opsional, kosongkan utk auto)": "BDL-1002",
                "Nama Bundle": "Duo Artprint Special",
                "Harga Bundle (Rp)": 120000,
                "Status Aktif (TRUE/FALSE)": "TRUE",
                "Item Bundle Format (ProductID:Qty:Variasi|...)": "PRINT-01:1|PRINT-02:1"
            }
        ];

        const productRefRows = products.map(p => ({
            "Product ID": p.id,
            "Nama Produk": p.name,
            "Harga": p.price,
            "Variasi Tersedia": p.variations && p.variations.length > 0 
                ? p.variations.map(v => v.name).join(', ') 
                : '-'
        }));

        const wb = XLSX.utils.book_new();
        const wsTemplate = XLSX.utils.json_to_sheet(templateRows);
        const wsProducts = XLSX.utils.json_to_sheet(productRefRows);

        XLSX.utils.book_append_sheet(wb, wsTemplate, "Template Bundle");
        XLSX.utils.book_append_sheet(wb, wsProducts, "Referensi Produk");

        XLSX.writeFile(wb, "kanvahati_template_bundles.xlsx");
        if (showToast) showToast("Template XLSX Bundle berhasil diunduh!", "📊");
    };

    // Handle CSV Import for Bundles
    const handleCsvFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const text = evt.target.result;
                const lines = text.split(String.fromCharCode(10)).filter(line => line.trim() !== "");
                if (lines.length < 2) {
                    if (showToast) showToast("File CSV kosong atau tidak valid!", "⚠️");
                    return;
                }

                const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                const previewRows = [];
                const errors = [];

                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i];
                    const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
                    const cleanValues = values.map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

                    const rowObj = {};
                    headers.forEach((h, idx) => {
                        rowObj[h] = cleanValues[idx] !== undefined ? cleanValues[idx] : '';
                    });

                    const name = rowObj["Nama Bundle"] || rowObj["name"] || rowObj["Nama"] || cleanValues[1] || '';
                    if (!name) {
                        errors.push(`Baris ${i + 1}: Nama bundle kosong.`);
                        continue;
                    }

                    const rawId = rowObj["ID"] || rowObj["id"] || rowObj["ID (Opsional, kosongkan utk auto)"] || cleanValues[0] || '';
                    const bundlePrice = parseFloat(rowObj["Harga Bundle (Rp)"] || rowObj["bundlePrice"] || cleanValues[2] || 0);
                    const activeRaw = String(rowObj["Status Aktif (TRUE/FALSE)"] || rowObj["isActive"] || cleanValues[3] || 'TRUE').toUpperCase();
                    const isActive = activeRaw === 'TRUE' || activeRaw === '1' || activeRaw === 'YA';
                    const itemsRaw = rowObj["Item Bundle Format (ProductID:Qty:Variasi|...)"] || rowObj["items"] || cleanValues[4] || '';

                    if (!itemsRaw) {
                        errors.push(`Baris ${i + 1}: Kolom item bundle kosong.`);
                        continue;
                    }

                    const itemTokens = itemsRaw.split('|');
                    const parsedItems = itemTokens.map(tok => {
                        const parts = tok.split(':');
                        const pId = (parts[0] || '').trim();
                        const pQty = parseInt(parts[1] || 1);
                        const pVar = parts[2] ? parts[2].trim() : null;
                        return { productId: pId, qty: pQty, variationName: pVar };
                    }).filter(it => it.productId);

                    if (parsedItems.length === 0) {
                        errors.push(`Baris ${i + 1}: Tidak ada item valid dalam bundle.`);
                        continue;
                    }

                    previewRows.push({
                        id: rawId ? rawId.trim() : "BDL-" + Math.floor(100000 + Math.random() * 900000),
                        name,
                        bundlePrice,
                        isActive,
                        items: parsedItems,
                        createdAt: new Date().toISOString()
                    });
                }

                setImportPreview(previewRows);
                setImportErrors(errors);
                setShowImportModal(true);
            } catch (err) {
                console.error("CSV parse error for bundles:", err);
                if (showToast) showToast("Format CSV bundle gagal diproses!", "⚠️");
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // Execute Stored Procedure Batch Import for Bundles
    const handleExecuteImportBundles = async () => {
        if (importPreview.length === 0) return;
        try {
            const res = await sp_import_bundles_batch(importPreview);
            if (res.success) {
                await recordAuditLog({
                    action: 'DISCOUNT_CHANGE',
                    summary: `Batch Import Bundle via SP: ${res.count} paket promo berhasil diimport`,
                    actor: {
                        uid: currentUser?.uid,
                        email: currentUser?.email,
                        displayName: currentUser?.displayName || 'Staf',
                        role: userRole
                    },
                    details: { importedCount: res.count }
                });
                if (showToast) showToast(`${res.count} bundle promo berhasil diimport via SP Transaction!`, "🎉");
                setShowImportModal(false);
                setImportPreview([]);
                setImportErrors([]);
                loadData();
            }
        } catch (e) {
            if (showToast) showToast("Gagal melakukan batch import bundle", "⚠️");
        }
    };

    const formatMoney = (value) => {
        return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
    };

    return (
        <div className="bundles-layout lg:h-full h-auto p-4 md:p-6 bg-white border-[3px] border-text rounded-2xl shadow-pop relative overflow-hidden">
            {/* Retro Window Header */}
            <div className="retro-window-header -mx-4 md:-mx-6 -mt-4 md:-mt-6 mb-5 bg-pink border-b-[2.5px] border-text px-4 py-2 flex items-center justify-between">
                <div className="retro-dots flex items-center gap-1.5">
                    <span className="retro-dot retro-dot-red"></span>
                    <span className="retro-dot retro-dot-yellow"></span>
                    <span className="retro-dot retro-dot-blue"></span>
                    <span className="font-tag text-[10px] font-black uppercase tracking-wider text-text ml-1.5">Paket Promosi</span>
                </div>
                <span className="text-[10px] font-tag font-black uppercase bg-yellow px-2 py-0.5 rounded border border-text shadow-[1px_1px_0px_#171717]">{bundles.length} Bundle</span>
            </div>
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="font-title text-2xl text-text title-stroke"><i className="fa-solid fa-tags text-pink"></i> Kelola {t.bundles}</h2>
                    <p className="text-sm opacity-80 mt-1 font-body">Buat paket promosi yang otomatis muncul di terminal kasir.</p>
                </div>
                
                {/* Bundle Action Toolbar: CSV Import, XLSX Template, Add Bundle */}
                <div className="flex flex-wrap items-center gap-2">
                    <label 
                        className="btn bg-pink text-text border-2 border-text rounded-full px-3.5 py-1.5 text-xs font-title font-bold shadow-[2px_2px_0px_#181818] hover:bg-white hover:translate-y-[-1px] active:translate-y-[1px] transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Import bundle via file CSV"
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
                        onClick={handleDownloadBundlesTemplate}
                        className="btn bg-yellow text-text border-2 border-text rounded-full px-3.5 py-1.5 text-xs font-title font-bold shadow-[2px_2px_0px_#181818] hover:bg-white hover:translate-y-[-1px] active:translate-y-[1px] transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Unduh format spreadsheet bundle .xlsx"
                    >
                        <i className="fa-solid fa-file-excel"></i> Template XLSX
                    </button>

                    <button 
                        onClick={() => handleOpenModal()}
                        className="btn bg-blue-light text-text border-[2.5px] border-text rounded-full font-title text-[13px] px-4 py-1.5 shadow-btn hover:bg-white hover:translate-y-[-1px] active:translate-y-[1px] transition-all cursor-pointer flex items-center gap-1.5 font-bold"
                    >
                        <i className="fa-solid fa-plus"></i> {t.addBundle}
                    </button>
                </div>
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
                            <div key={bundle.id} className={`bundle-card border-[3px] border-text rounded-2xl p-5 relative transition-all flex flex-col ${bundle.isActive ? 'bg-white shadow-[6px_6px_0px_#181818]' : 'bg-gray-100 opacity-60'}`}>
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
                                        className="flex-1 bg-blue-light border-2 border-text rounded-full py-1.5 text-xs font-bold shadow-[2px_2px_0px_#181818] hover:bg-white transition-colors cursor-pointer"
                                    >
                                        Edit
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(bundle.id)}
                                        className="bg-white text-pink border-2 border-text rounded-full px-3 py-1.5 text-xs shadow-[2px_2px_0px_#181818] hover:bg-pink-light transition-colors cursor-pointer"
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
                    <div className="bg-white border-[3px] border-text rounded-2xl w-full max-w-[600px] max-h-[90vh] flex flex-col shadow-[8px_8px_0px_#181818] overflow-hidden animate-[ticketSlide_0.3s_ease-out]">
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
                                className="bg-pink text-text px-6 py-2 rounded-full border-[3px] border-text font-bold text-sm shadow-[3px_3px_0px_#181818] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#181818] transition-all cursor-pointer"
                            >
                                Simpan Bundle
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CSV Import Preview Modal for Bundles */}
            {showImportModal && (
                <div className="fixed inset-0 bg-[#181818]/60 backdrop-blur-sm z-[10001] flex justify-center items-center p-4 animate-[fade_0.2s_ease]">
                    <div className="bg-white border-[3px] border-text rounded-2xl shadow-card w-full max-w-[650px] max-h-[85vh] overflow-hidden flex flex-col text-text relative">
                        <div className="retro-window-header bg-yellow border-b-[2.5px] border-text px-4 py-2.5 flex items-center justify-between">
                            <div className="retro-dots flex items-center gap-1.5">
                                <span className="retro-dot retro-dot-red"></span>
                                <span className="retro-dot retro-dot-yellow"></span>
                                <span className="retro-dot retro-dot-blue"></span>
                                <span className="font-tag text-xs font-black uppercase tracking-wider text-text ml-2">Preview Import CSV Bundle</span>
                            </div>
                            <button 
                                onClick={() => setShowImportModal(false)}
                                className="text-text hover:text-white transition-transform hover:scale-110 cursor-pointer"
                            >
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>

                        <div className="p-4 sm:p-5 flex flex-col gap-3 overflow-y-auto font-body">
                            <div className="flex items-center justify-between bg-yellow-light/40 border-2 border-text rounded-xl p-3">
                                <div>
                                    <span className="font-title text-sm font-bold block text-text">Daftar Bundle Promosi</span>
                                    <span className="text-xs text-text/80">
                                        Total <strong>{importPreview.length}</strong> bundle siap di-commit via Stored Procedure Transaction.
                                    </span>
                                </div>
                                <span className="bg-pink text-text font-tag text-xs font-black px-2.5 py-1 rounded-full border border-text shadow-[1px_1px_0px_#181818]">
                                    {importPreview.length} BUNDLES
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
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-blue-light border-b-2 border-text font-title">
                                        <tr>
                                            <th className="p-2 border-r border-text/20">ID</th>
                                            <th className="p-2 border-r border-text/20">Nama Bundle</th>
                                            <th className="p-2 border-r border-text/20">Harga Promo</th>
                                            <th className="p-2 border-r border-text/20">Jml Item</th>
                                            <th className="p-2">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-text/15">
                                        {importPreview.map((b, idx) => (
                                            <tr key={idx} className="hover:bg-yellow-light/20">
                                                <td className="p-2 font-mono font-bold border-r border-text/10">{b.id}</td>
                                                <td className="p-2 font-bold border-r border-text/10">{b.name}</td>
                                                <td className="p-2 font-mono font-bold text-pink border-r border-text/10">{formatMoney(b.bundlePrice)}</td>
                                                <td className="p-2 border-r border-text/10">
                                                    {b.items.map(it => `${it.productId} (x${it.qty})`).join(', ')}
                                                </td>
                                                <td className="p-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                                        b.isActive ? 'bg-emerald-100 text-emerald-800 border-emerald-400' : 'bg-gray-200 text-gray-700 border-gray-400'
                                                    }`}>
                                                        {b.isActive ? 'Aktif' : 'Nonaktif'}
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
                                    onClick={handleExecuteImportBundles}
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
