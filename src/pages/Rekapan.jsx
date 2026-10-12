import React, { useState, useEffect, useMemo } from 'react';
import { getTransactionsList, getProducts } from '../services/db';
import { t } from '../services/translations';
import * as XLSX from 'xlsx';

// Helper: format currency
const formatMoney = (value) => `Rp ${Math.round(value).toLocaleString('id-ID')}`;

// Helper: get start of day
const startOfDay = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

// Helper: get start of week (Monday)
const startOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

// Helper: get start of month
const startOfMonth = (date) => {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
};

// Helper: format date range label
const formatPeriodLabel = (date, mode) => {
    const d = new Date(date);
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    
    if (mode === 'daily') {
        return d.toLocaleDateString('id-ID', options);
    }
    if (mode === 'weekly') {
        const weekStart = startOfWeek(d);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const startStr = weekStart.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        const endStr = weekEnd.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        return `${startStr} – ${endStr}`;
    }
    if (mode === 'monthly') {
        return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    }
    return '';
};

// Group key for a date based on mode
const getGroupKey = (dateStr, mode) => {
    const d = new Date(dateStr);
    if (mode === 'daily') {
        return startOfDay(d).toISOString();
    }
    if (mode === 'weekly') {
        return startOfWeek(d).toISOString();
    }
    if (mode === 'monthly') {
        return startOfMonth(d).toISOString();
    }
    return d.toISOString();
};

export default function Rekapan({ showToast }) {
    const [transactions, setTransactions] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState('daily'); // 'daily' | 'weekly' | 'monthly'
    const [expandedPeriod, setExpandedPeriod] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const [txs, prods] = await Promise.all([
                    getTransactionsList(),
                    getProducts()
                ]);
                setTransactions(txs);
                setProducts(prods);
            } catch (e) {
                console.error("Failed to load recap data", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // Group transactions by period
    const groupedData = useMemo(() => {
        const groups = {};

        transactions.forEach(tx => {
            const key = getGroupKey(tx.timestamp, mode);
            if (!groups[key]) {
                groups[key] = {
                    key,
                    transactions: [],
                    totalRevenue: 0,
                    totalItems: 0,
                    totalOrders: 0,
                    paymentBreakdown: { cash: 0, qris: 0 },
                    categorySales: {},
                    topProducts: {}
                };
            }
            const g = groups[key];
            g.transactions.push(tx);
            g.totalRevenue += tx.total;
            g.totalItems += tx.qty;
            g.totalOrders += 1;
            
            // Payment breakdown
            if (tx.paymentMethod === 'cash') {
                g.paymentBreakdown.cash += tx.total;
            } else {
                g.paymentBreakdown.qris += tx.total;
            }

            // Category + product breakdown
            tx.items.forEach(item => {
                const prod = products.find(p => p.id === item.id);
                const cat = prod ? prod.category : 'lainnya';
                g.categorySales[cat] = (g.categorySales[cat] || 0) + item.qty;
                
                const prodName = item.name || (prod ? prod.name : item.id);
                if (!g.topProducts[prodName]) {
                    g.topProducts[prodName] = { qty: 0, revenue: 0 };
                }
                g.topProducts[prodName].qty += item.qty;
                g.topProducts[prodName].revenue += (item.price || 0) * item.qty;
            });
        });

        // Sort by date descending
        return Object.values(groups).sort((a, b) => new Date(b.key) - new Date(a.key));
    }, [transactions, products, mode]);

    // Category label helper
    const categoryLabel = (cat) => {
        const labels = {
            stickers: "Stiker",
            keychains: "Gantungan Kunci",
            prints: "Cetak Gambar",
            washi: "Selotip Washi",
            lainnya: "Lainnya"
        };
        return labels[cat] || (cat.charAt(0).toUpperCase() + cat.slice(1));
    };

    // Export one period to XLSX
    const exportPeriodToXLSX = (group) => {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Ringkasan
        const summaryData = [
            ['Rekapan Transaksi Kanvahati POS'],
            ['Periode', formatPeriodLabel(group.key, mode)],
            ['Mode', mode === 'daily' ? 'Harian' : mode === 'weekly' ? 'Mingguan' : 'Bulanan'],
            [],
            ['RINGKASAN'],
            ['Total Pendapatan', group.totalRevenue],
            ['Total Pesanan', group.totalOrders],
            ['Total Barang Terjual', group.totalItems],
            ['Rata-rata per Pesanan', group.totalOrders > 0 ? Math.round(group.totalRevenue / group.totalOrders) : 0],
            [],
            ['PEMBAYARAN'],
            ['Tunai (Cash)', group.paymentBreakdown.cash],
            ['QRIS', group.paymentBreakdown.qris],
            [],
            ['PENJUALAN PER KATEGORI'],
            ['Kategori', 'Jumlah (pcs)'],
            ...Object.entries(group.categorySales).map(([cat, qty]) => [categoryLabel(cat), qty])
        ];
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        // Set column widths
        wsSummary['!cols'] = [{ wch: 30 }, { wch: 25 }];
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

        // Sheet 2: Detail Transaksi
        const detailHeader = ['ID Pesanan', 'Waktu', 'Kasir', 'Pembayaran', 'Jumlah Barang', 'Total (Rp)'];
        const detailRows = group.transactions.map(tx => [
            tx.id,
            new Date(tx.timestamp).toLocaleString('id-ID'),
            tx.cashier || '-',
            tx.paymentMethod === 'cash' ? 'Tunai' : 'QRIS',
            tx.qty,
            tx.total
        ]);
        const wsDetail = XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows]);
        wsDetail['!cols'] = [
            { wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 16 }
        ];
        XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail Transaksi');

        // Sheet 3: Detail Barang
        const itemHeader = ['ID Pesanan', 'Kode Barang', 'Nama Barang', 'Variasi', 'Qty', 'Harga Satuan (Rp)', 'Diskon (Rp)', 'Subtotal (Rp)'];
        const itemRows = [];
        group.transactions.forEach(tx => {
            tx.items.forEach(item => {
                itemRows.push([
                    tx.id,
                    item.id,
                    item.name || '-',
                    item.variationName || '-',
                    item.qty,
                    item.originalPrice || item.price,
                    item.discount || 0,
                    (item.price || 0) * item.qty
                ]);
            });
        });
        const wsItems = XLSX.utils.aoa_to_sheet([itemHeader, ...itemRows]);
        wsItems['!cols'] = [
            { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 6 }, { wch: 18 }, { wch: 14 }, { wch: 16 }
        ];
        XLSX.utils.book_append_sheet(wb, wsItems, 'Detail Barang');

        // Sheet 4: Produk Terlaris
        const topHeader = ['Nama Produk', 'Qty Terjual', 'Total Pendapatan (Rp)'];
        const topRows = Object.entries(group.topProducts)
            .sort((a, b) => b[1].qty - a[1].qty)
            .map(([name, data]) => [name, data.qty, data.revenue]);
        const wsTop = XLSX.utils.aoa_to_sheet([topHeader, ...topRows]);
        wsTop['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 22 }];
        XLSX.utils.book_append_sheet(wb, wsTop, 'Produk Terlaris');

        // Generate filename
        const dateStr = new Date(group.key).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
        const modeLabel = mode === 'daily' ? 'Harian' : mode === 'weekly' ? 'Mingguan' : 'Bulanan';
        const fileName = `Rekapan_${modeLabel}_${dateStr}_Kanvahati.xlsx`;

        XLSX.writeFile(wb, fileName);
        if (showToast) showToast(`Rekapan berhasil diexport! 📊`, '📥');
    };

    // Export ALL periods to a single XLSX
    const exportAllToXLSX = () => {
        if (groupedData.length === 0) return;
        
        const wb = XLSX.utils.book_new();
        const modeLabel = mode === 'daily' ? 'Harian' : mode === 'weekly' ? 'Mingguan' : 'Bulanan';

        // Sheet 1: Overview of all periods
        const overviewHeader = ['Periode', 'Total Pesanan', 'Barang Terjual', 'Total Pendapatan (Rp)', 'Tunai (Rp)', 'QRIS (Rp)', 'Rata-rata/Pesanan (Rp)'];
        const overviewRows = groupedData.map(g => [
            formatPeriodLabel(g.key, mode),
            g.totalOrders,
            g.totalItems,
            g.totalRevenue,
            g.paymentBreakdown.cash,
            g.paymentBreakdown.qris,
            g.totalOrders > 0 ? Math.round(g.totalRevenue / g.totalOrders) : 0
        ]);
        const wsOverview = XLSX.utils.aoa_to_sheet([
            [`Rekapan ${modeLabel} — Kanvahati POS`],
            [`Diekspor: ${new Date().toLocaleString('id-ID')}`],
            [],
            overviewHeader,
            ...overviewRows
        ]);
        wsOverview['!cols'] = [
            { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 22 }
        ];
        XLSX.utils.book_append_sheet(wb, wsOverview, 'Ringkasan');

        // Sheet 2: All transactions detail
        const detailHeader = ['Periode', 'ID Pesanan', 'Waktu', 'Kasir', 'Pembayaran', 'Jumlah Barang', 'Total (Rp)'];
        const detailRows = [];
        groupedData.forEach(g => {
            g.transactions.forEach(tx => {
                detailRows.push([
                    formatPeriodLabel(g.key, mode),
                    tx.id,
                    new Date(tx.timestamp).toLocaleString('id-ID'),
                    tx.cashier || '-',
                    tx.paymentMethod === 'cash' ? 'Tunai' : 'QRIS',
                    tx.qty,
                    tx.total
                ]);
            });
        });
        const wsDetail = XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows]);
        wsDetail['!cols'] = [
            { wch: 28 }, { wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 16 }
        ];
        XLSX.utils.book_append_sheet(wb, wsDetail, 'Semua Transaksi');

        const fileName = `Rekapan_${modeLabel}_Semua_Kanvahati.xlsx`;
        XLSX.writeFile(wb, fileName);
        if (showToast) showToast(`Semua rekapan berhasil diexport! 📊`, '📥');
    };

    const toggleExpand = (key) => {
        setExpandedPeriod(prev => prev === key ? null : key);
    };

    // Grand totals
    const grandTotals = useMemo(() => {
        return groupedData.reduce((acc, g) => ({
            revenue: acc.revenue + g.totalRevenue,
            orders: acc.orders + g.totalOrders,
            items: acc.items + g.totalItems,
        }), { revenue: 0, orders: 0, items: 0 });
    }, [groupedData]);

    const modeButtons = [
        { key: 'daily', label: 'Harian', icon: 'fa-calendar-day' },
        { key: 'weekly', label: 'Mingguan', icon: 'fa-calendar-week' },
        { key: 'monthly', label: 'Bulanan', icon: 'fa-calendar' }
    ];

    return (
        <div className="rekapan-layout lg:h-full h-auto flex flex-col gap-5">
            {/* Header Card */}
            <div className="bg-white border-[3px] border-text rounded-2xl shadow-card p-6 relative">
                <div className="washi-tape tape-rekapan absolute top-[-12px] left-10 transform rotate-[-2deg] h-6 w-28 z-5 border-l border-r border-dashed border-text/25 bg-yellow"></div>

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h3 className="pane-title font-title text-2xl text-text mb-1 title-stroke">
                            <i className="fa-solid fa-file-invoice-dollar"></i> Rekapan Riwayat
                        </h3>
                        <p className="pane-subtitle text-[13px] opacity-80 text-text">
                            Rangkuman transaksi per hari, minggu, atau bulan. Export ke Excel (.xlsx) kapan saja.
                        </p>
                    </div>

                    {/* Mode Switcher */}
                    <div className="flex gap-2 flex-wrap">
                        {modeButtons.map(m => (
                            <button
                                key={m.key}
                                onClick={() => { setMode(m.key); setExpandedPeriod(null); }}
                                className={`font-title text-[12.5px] font-bold border-2 rounded-full px-4 py-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                                    mode === m.key
                                        ? 'bg-yellow border-text shadow-[3px_3px_0px_#32628f] text-text'
                                        : 'bg-white border-text/30 text-text/60 hover:bg-blue-light hover:border-text hover:text-text'
                                }`}
                            >
                                <i className={`fa-solid ${m.icon}`}></i> {m.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 font-bold text-text/60">Memuat rekapan...</div>
            ) : transactions.length === 0 ? (
                <div className="bg-white border-[3px] border-text rounded-2xl shadow-card p-12 flex flex-col items-center justify-center text-text/40 gap-2">
                    <i className="fa-solid fa-folder-open text-4xl"></i>
                    <p className="text-sm font-bold">Belum ada transaksi tercatat.</p>
                </div>
            ) : (
                <>
                    {/* Grand Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-pink-light border-[3px] border-text rounded-2xl shadow-card p-4 flex items-center gap-3 text-text">
                            <div className="text-2xl"><i className="fa-solid fa-coins"></i></div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold uppercase opacity-70">Total Pendapatan</span>
                                <h2 className="font-title text-lg">{formatMoney(grandTotals.revenue)}</h2>
                            </div>
                        </div>
                        <div className="bg-blue-light border-[3px] border-text rounded-2xl shadow-card p-4 flex items-center gap-3 text-text">
                            <div className="text-2xl"><i className="fa-solid fa-receipt"></i></div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold uppercase opacity-70">Total Pesanan</span>
                                <h2 className="font-title text-lg">{grandTotals.orders} pesanan</h2>
                            </div>
                        </div>
                        <div className="bg-yellow-light border-[3px] border-text rounded-2xl shadow-card p-4 flex items-center gap-3 text-text">
                            <div className="text-2xl"><i className="fa-solid fa-boxes-stacked"></i></div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold uppercase opacity-70">Total Barang</span>
                                <h2 className="font-title text-lg">{grandTotals.items} pcs</h2>
                            </div>
                        </div>
                    </div>

                    {/* Export All Button */}
                    <div className="flex justify-end">
                        <button
                            onClick={exportAllToXLSX}
                            className="font-title text-[12.5px] font-bold bg-green-100 text-green-800 border-2 border-green-700 rounded-full px-5 py-2.5 flex items-center gap-2 transition-all cursor-pointer hover:bg-green-200 shadow-[3px_3px_0px_#166534]"
                        >
                            <i className="fa-solid fa-file-excel"></i> Export Semua ke Excel
                        </button>
                    </div>

                    {/* Period Cards */}
                    <div className="flex flex-col gap-4 pb-4">
                        {groupedData.map((group) => {
                            const isExpanded = expandedPeriod === group.key;
                            const avgPerOrder = group.totalOrders > 0 ? Math.round(group.totalRevenue / group.totalOrders) : 0;
                            
                            // Sort top products
                            const sortedProducts = Object.entries(group.topProducts)
                                .sort((a, b) => b[1].qty - a[1].qty)
                                .slice(0, 5);

                            return (
                                <div key={group.key} className="bg-white border-[3px] border-text rounded-2xl shadow-card overflow-hidden transition-all">
                                    {/* Period Header (clickable) */}
                                    <button
                                        onClick={() => toggleExpand(group.key)}
                                        className="w-full p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:bg-blue-light/30 transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl border-2 border-text flex items-center justify-center text-sm font-bold shrink-0 ${
                                                mode === 'daily' ? 'bg-pink-light' : mode === 'weekly' ? 'bg-blue-light' : 'bg-yellow-light'
                                            }`}>
                                                <i className={`fa-solid ${mode === 'daily' ? 'fa-calendar-day' : mode === 'weekly' ? 'fa-calendar-week' : 'fa-calendar'}`}></i>
                                            </div>
                                            <div>
                                                <h4 className="font-title text-[15px] text-text title-stroke">
                                                    {formatPeriodLabel(group.key, mode)}
                                                </h4>
                                                <p className="text-[11.5px] text-text/60 font-bold">
                                                    {group.totalOrders} pesanan · {group.totalItems} barang
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="font-title text-lg text-text">{formatMoney(group.totalRevenue)}</span>
                                            <i className={`fa-solid fa-chevron-down text-text/40 text-xs transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}></i>
                                        </div>
                                    </button>

                                    {/* Expanded Detail */}
                                    {isExpanded && (
                                        <div className="border-t-[3px] border-text bg-blue-light/10 p-5 flex flex-col gap-5"
                                            style={{ animation: 'fadeSlideIn 0.3s ease-out' }}
                                        >
                                            {/* Stats Grid */}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                <div className="bg-white border-2 border-text rounded-xl p-3 text-center">
                                                    <p className="text-[10px] font-bold uppercase opacity-60">Pendapatan</p>
                                                    <p className="font-title text-[15px] text-text">{formatMoney(group.totalRevenue)}</p>
                                                </div>
                                                <div className="bg-white border-2 border-text rounded-xl p-3 text-center">
                                                    <p className="text-[10px] font-bold uppercase opacity-60">Pesanan</p>
                                                    <p className="font-title text-[15px] text-text">{group.totalOrders}</p>
                                                </div>
                                                <div className="bg-white border-2 border-text rounded-xl p-3 text-center">
                                                    <p className="text-[10px] font-bold uppercase opacity-60">Barang</p>
                                                    <p className="font-title text-[15px] text-text">{group.totalItems} pcs</p>
                                                </div>
                                                <div className="bg-white border-2 border-text rounded-xl p-3 text-center">
                                                    <p className="text-[10px] font-bold uppercase opacity-60">Rata-rata</p>
                                                    <p className="font-title text-[15px] text-text">{formatMoney(avgPerOrder)}</p>
                                                </div>
                                            </div>

                                            {/* Payment + Category + Top Products - 3 columns on desktop */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {/* Payment Breakdown */}
                                                <div className="bg-white border-2 border-text rounded-xl p-4">
                                                    <h5 className="font-title text-[13px] text-text mb-3 title-stroke">
                                                        <i className="fa-solid fa-wallet"></i> Pembayaran
                                                    </h5>
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[12px] font-bold flex items-center gap-1.5">
                                                                <span className="w-3 h-3 rounded-full bg-blue border border-text inline-block"></span> Tunai
                                                            </span>
                                                            <span className="text-[12px] font-bold">{formatMoney(group.paymentBreakdown.cash)}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[12px] font-bold flex items-center gap-1.5">
                                                                <span className="w-3 h-3 rounded-full bg-pink border border-text inline-block"></span> QRIS
                                                            </span>
                                                            <span className="text-[12px] font-bold">{formatMoney(group.paymentBreakdown.qris)}</span>
                                                        </div>
                                                        {/* Mini bar */}
                                                        {group.totalRevenue > 0 && (
                                                            <div className="mt-2 h-3 rounded-full border-2 border-text overflow-hidden flex bg-blue-light">
                                                                <div className="bg-blue h-full transition-all" style={{ width: `${(group.paymentBreakdown.cash / group.totalRevenue) * 100}%` }}></div>
                                                                <div className="bg-pink h-full transition-all" style={{ width: `${(group.paymentBreakdown.qris / group.totalRevenue) * 100}%` }}></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Category Breakdown */}
                                                <div className="bg-white border-2 border-text rounded-xl p-4">
                                                    <h5 className="font-title text-[13px] text-text mb-3 title-stroke">
                                                        <i className="fa-solid fa-tags"></i> Per Kategori
                                                    </h5>
                                                    <div className="flex flex-col gap-1.5">
                                                        {Object.entries(group.categorySales)
                                                            .sort((a, b) => b[1] - a[1])
                                                            .map(([cat, qty]) => (
                                                                <div key={cat} className="flex justify-between items-center text-[12px]">
                                                                    <span className="font-bold capitalize">{categoryLabel(cat)}</span>
                                                                    <span className="bg-blue-light border border-text rounded-full px-2 py-0.5 text-[10px] font-bold">{qty} pcs</span>
                                                                </div>
                                                            ))
                                                        }
                                                    </div>
                                                </div>

                                                {/* Top Products */}
                                                <div className="bg-white border-2 border-text rounded-xl p-4">
                                                    <h5 className="font-title text-[13px] text-text mb-3 title-stroke">
                                                        <i className="fa-solid fa-trophy"></i> Produk Terlaris
                                                    </h5>
                                                    <div className="flex flex-col gap-1.5">
                                                        {sortedProducts.map(([name, data], idx) => (
                                                            <div key={name} className="flex justify-between items-center text-[12px] gap-2">
                                                                <span className="font-bold truncate flex items-center gap-1.5">
                                                                    {idx === 0 && <span className="text-yellow">🥇</span>}
                                                                    {idx === 1 && <span>🥈</span>}
                                                                    {idx === 2 && <span>🥉</span>}
                                                                    {name}
                                                                </span>
                                                                <span className="bg-pink-light border border-text rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0">{data.qty} pcs</span>
                                                            </div>
                                                        ))}
                                                        {sortedProducts.length === 0 && (
                                                            <p className="text-[11px] text-text/40 italic">Tidak ada data</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Transaction Table */}
                                            <div className="bg-white border-2 border-text rounded-xl overflow-hidden">
                                                <div className="p-3 border-b-2 border-text bg-yellow-light/50 flex items-center justify-between">
                                                    <h5 className="font-title text-[13px] text-text title-stroke">
                                                        <i className="fa-solid fa-list"></i> Daftar Transaksi
                                                    </h5>
                                                    <span className="text-[11px] font-bold text-text/60">{group.transactions.length} transaksi</span>
                                                </div>
                                                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                                                    <table className="w-full border-collapse text-[12.5px] text-text">
                                                        <thead>
                                                            <tr className="bg-blue-light/50 border-b-2 border-text font-title font-bold sticky top-0">
                                                                <th className="p-2.5 text-left">ID</th>
                                                                <th className="p-2.5 text-left">Waktu</th>
                                                                <th className="p-2.5 text-left">Kasir</th>
                                                                <th className="p-2.5 text-left">Bayar</th>
                                                                <th className="p-2.5 text-right">Barang</th>
                                                                <th className="p-2.5 text-right">Total</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {group.transactions.map(tx => (
                                                                <tr key={tx.id} className="hover:bg-yellow-light/50 border-b border-text/10">
                                                                    <td className="p-2.5 font-bold">{tx.id}</td>
                                                                    <td className="p-2.5 whitespace-nowrap">{new Date(tx.timestamp).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</td>
                                                                    <td className="p-2.5">{tx.cashier || '-'}</td>
                                                                    <td className="p-2.5 capitalize font-bold text-pink">
                                                                        {tx.paymentMethod === 'cash' ? 'Tunai' : 'QRIS'}
                                                                    </td>
                                                                    <td className="p-2.5 text-right">{tx.qty}</td>
                                                                    <td className="p-2.5 text-right font-bold">{formatMoney(tx.total)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* Export This Period Button */}
                                            <div className="flex justify-end">
                                                <button
                                                    onClick={() => exportPeriodToXLSX(group)}
                                                    className="font-title text-[12px] font-bold bg-white text-text border-2 border-text rounded-full px-4 py-2 flex items-center gap-2 transition-all cursor-pointer hover:bg-yellow-light shadow-[2px_2px_0px_#32628f]"
                                                >
                                                    <i className="fa-solid fa-download"></i> Export Periode Ini (.xlsx)
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
