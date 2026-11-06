import React, { useState, useEffect } from 'react';
import { getTransactionsList, deleteTransactionAndRefund } from '../services/db';
import { recordAuditLog } from '../services/audit';
import { t } from '../services/translations';

export default function Logs({ onReprint, showToast, currentUser, userRole }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    // Grouping, Filtering, Sorting & Pagination State
    const [groupBy, setGroupBy] = useState('daily'); // 'none', 'daily', 'weekly', 'monthly'
    const [filterCashier, setFilterCashier] = useState('all');
    const [filterPayment, setFilterPayment] = useState('all'); // 'all', 'cash', 'qris'
    const [filterTimeRange, setFilterTimeRange] = useState('all'); // 'all', 'today', 'yesterday', '7days', 'this_month'
    const [pageSize, setPageSize] = useState(20); // 20, 40, 60
    const [currentPage, setCurrentPage] = useState(1);

    const isSuperAdmin = userRole === 'super_admin';

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            const data = await getTransactionsList();
            setTransactions(data);
        } catch (e) {
            console.error("Failed to load transactions", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, []);

    const handleDeleteTransaction = async (tx) => {
        if (!isSuperAdmin) {
            showToast("Hanya Super Admin yang diizinkan menghapus transaksi!", "🔒");
            return;
        }

        const reason = window.prompt(`HAPUS PERMANEN TRANSAKSI ${tx.id}?\n\nPerhatian: Stok akan dikembalikan dan rekaman transaksi akan dihapus permanen.\nMasukkan alasan penghapusan:`);
        if (!reason || !reason.trim()) {
            showToast("Penghapusan dibatalkan: Alasan wajib diisi.", "⚠️");
            return;
        }

        try {
            const success = await deleteTransactionAndRefund(tx.id);
            if (success) {
                await recordAuditLog({
                    action: 'TRANSACTION_DELETE',
                    summary: `Transaksi ${tx.id} senilai ${formatLogMoney(tx.total)} dihapus permanen oleh ${currentUser?.displayName || currentUser?.email}`,
                    actor: {
                        uid: currentUser?.uid,
                        email: currentUser?.email,
                        displayName: currentUser?.displayName || 'Super Admin',
                        role: userRole
                    },
                    details: {
                        transactionId: tx.id,
                        total: tx.total,
                        itemsCount: tx.qty,
                        items: tx.items,
                        reason: reason.trim()
                    }
                });

                showToast(`Transaksi ${tx.id} berhasil dihapus permanen!`, "🗑️");
                fetchTransactions();
            } else {
                showToast("Gagal menghapus transaksi.", "⚠️");
            }
        } catch (err) {
            console.error(err);
            showToast("Terjadi kesalahan saat menghapus transaksi.", "⚠️");
        }
    };

    const handleRefund = async (txId) => {
        if (window.confirm(`Batalkan transaksi ${txId}? Semua barang dalam transaksi ini akan dikembalikan ke stok katalog.`)) {
            try {
                const success = await deleteTransactionAndRefund(txId);
                if (success) {
                    showToast(`Transaksi ${txId} berhasil dibatalkan & stok dikembalikan!`, "🧹");
                    fetchTransactions();
                } else {
                    showToast("Gagal membatalkan transaksi.", "⚠️");
                }
            } catch (err) {
                showToast("Terjadi kesalahan saat membatalkan transaksi.", "⚠️");
            }
        }
    };

    const formatLogMoney = (value) => {
        return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
    };

    // Extract unique cashiers
    const uniqueCashiers = Array.from(new Set(transactions.map(t => (t.cashier || 'Staf').replace(/^Kasir\s+/i, '')))).filter(Boolean);

    // Apply filtering
    const filteredTransactions = transactions.filter(tx => {
        // Cashier filter
        const txCashier = (tx.cashier || 'Staf').replace(/^Kasir\s+/i, '');
        if (filterCashier !== 'all' && txCashier !== filterCashier) return false;

        // Payment filter
        if (filterPayment !== 'all' && tx.paymentMethod !== filterPayment) return false;

        // Time range filter
        if (filterTimeRange !== 'all') {
            const txDate = new Date(tx.timestamp);
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            if (filterTimeRange === 'today') {
                if (txDate < startOfToday) return false;
            } else if (filterTimeRange === 'yesterday') {
                const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
                if (txDate < startOfYesterday || txDate >= startOfToday) return false;
            } else if (filterTimeRange === '7days') {
                const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
                if (txDate < sevenDaysAgo) return false;
            } else if (filterTimeRange === 'this_month') {
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                if (txDate < startOfMonth) return false;
            }
        }

        return true;
    });

    // Pagination calculations
    const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
    const paginatedTransactions = filteredTransactions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // Grouping helper for display
    const getGroupKey = (timestamp) => {
        const d = new Date(timestamp);
        if (groupBy === 'daily') {
            return d.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        }
        if (groupBy === 'weekly') {
            // ISO week helper
            const startOfYear = new Date(d.getFullYear(), 0, 1);
            const weekNo = Math.ceil((((d - startOfYear) / 86400000) + startOfYear.getDay() + 1) / 7);
            return `Minggu ke-${weekNo} • ${d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}`;
        }
        if (groupBy === 'monthly') {
            return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        }
        return null;
    };

    // Group paginated transactions into ordered sections
    const groupedSections = [];
    if (groupBy === 'none') {
        groupedSections.push({ groupTitle: null, items: paginatedTransactions });
    } else {
        const groupMap = new Map();
        paginatedTransactions.forEach(tx => {
            const key = getGroupKey(tx.timestamp);
            if (!groupMap.has(key)) {
                groupMap.set(key, []);
            }
            groupMap.get(key).push(tx);
        });

        groupMap.forEach((items, groupTitle) => {
            const groupTotal = items.reduce((sum, i) => sum + (i.total || 0), 0);
            const groupQty = items.reduce((sum, i) => sum + (i.qty || 0), 0);
            groupedSections.push({ groupTitle, items, groupTotal, groupQty });
        });
    }

    return (
        <div className="history-layout lg:h-full h-auto">
            <div className="history-card bg-white border-[2.5px] border-text rounded-2xl shadow-card overflow-hidden lg:h-full h-auto relative flex flex-col">
                {/* Retro Window Header */}
                <div className="retro-window-header">
                    <div className="retro-dots">
                        <span className="retro-dot retro-dot-red"></span>
                        <span className="retro-dot retro-dot-yellow"></span>
                        <span className="retro-dot retro-dot-blue"></span>
                        <span className="font-tag text-[9.5px] font-black uppercase tracking-wider text-text ml-1">Riwayat Transaksi</span>
                    </div>
                    <span className="text-[10px] font-tag font-bold opacity-75">{transactions.length} Transaksi</span>
                </div>

                <div className="p-4 sm:p-6 flex flex-col flex-grow">
                <h3 className="pane-title font-title text-2xl text-text mb-1 title-stroke">
                    <i className="fa-solid fa-clock-rotate-left"></i> Riwayat Transaksi
                </h3>
                <p className="pane-subtitle text-[13px] opacity-80 mb-4 text-text">
                    Lihat, cetak ulang, atau batalkan/refund transaksi belanja hari ini.
                </p>

                {/* Filter and Grouping Bar */}
                <div className="bg-yellow-light/35 border-2 border-text rounded-2xl p-3.5 mb-4 shadow-[2.5px_2.5px_0px_#181818] flex flex-col gap-3 font-body">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* 1. Cashier Filter */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold uppercase text-text/70 font-tag tracking-wider">Filter Kasir / Staf</label>
                            <select 
                                value={filterCashier}
                                onChange={(e) => { setFilterCashier(e.target.value); setCurrentPage(1); }}
                                className="border-2 border-text rounded-xl p-2 text-xs bg-white font-title font-bold outline-none cursor-pointer"
                            >
                                <option value="all">Semua Staf Kasir</option>
                                {uniqueCashiers.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        {/* 2. Payment Method Filter */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold uppercase text-text/70 font-tag tracking-wider">Metode Bayar</label>
                            <select 
                                value={filterPayment}
                                onChange={(e) => { setFilterPayment(e.target.value); setCurrentPage(1); }}
                                className="border-2 border-text rounded-xl p-2 text-xs bg-white font-title font-bold outline-none cursor-pointer"
                            >
                                <option value="all">Semua Metode (Cash & QRIS)</option>
                                <option value="cash">Tunai (Cash)</option>
                                <option value="qris">QRIS Digital</option>
                            </select>
                        </div>

                        {/* 3. Time Range Filter */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold uppercase text-text/70 font-tag tracking-wider">Rentang Waktu</label>
                            <select 
                                value={filterTimeRange}
                                onChange={(e) => { setFilterTimeRange(e.target.value); setCurrentPage(1); }}
                                className="border-2 border-text rounded-xl p-2 text-xs bg-white font-title font-bold outline-none cursor-pointer"
                            >
                                <option value="all">Semua Riwayat</option>
                                <option value="today">Hari Ini</option>
                                <option value="yesterday">Kemarin</option>
                                <option value="7days">7 Hari Terakhir</option>
                                <option value="this_month">Bulan Ini</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-dashed border-text/15 text-xs">
                        {/* Grouping Mode Pill Selector */}
                        <div className="flex items-center gap-1.5 font-tag font-bold">
                            <span className="text-[10px] uppercase text-text/60 mr-1">Grouping:</span>
                            {[
                                { id: 'daily', label: 'Per Hari' },
                                { id: 'weekly', label: 'Per Minggu' },
                                { id: 'monthly', label: 'Per Bulan' },
                                { id: 'none', label: 'Flat List' }
                            ].map(g => (
                                <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => setGroupBy(g.id)}
                                    className={`px-2.5 py-1 rounded-full border text-[10px] cursor-pointer transition-all ${
                                        groupBy === g.id 
                                            ? 'bg-yellow text-text border-text font-black shadow-[1.5px_1.5px_0px_#181818]' 
                                            : 'bg-white text-text/70 border-text/30 hover:border-text'
                                    }`}
                                >
                                    {g.label}
                                </button>
                            ))}
                        </div>

                        {/* Page Size Selector */}
                        <div className="flex items-center gap-1.5 font-tag font-bold ml-auto">
                            <span className="text-[10px] uppercase text-text/60">Tampilkan:</span>
                            {[20, 40, 60].map(sz => (
                                <button
                                    key={sz}
                                    type="button"
                                    onClick={() => { setPageSize(sz); setCurrentPage(1); }}
                                    className={`px-2.5 py-0.5 rounded border text-[10px] cursor-pointer transition-all ${
                                        pageSize === sz 
                                            ? 'bg-pink text-white border-text font-black shadow-[1.5px_1.5px_0px_#181818]' 
                                            : 'bg-white text-text border-text/30 hover:border-text'
                                    }`}
                                >
                                    {sz}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                
                <div className="table-container flex-grow overflow-y-auto max-h-[500px] lg:max-h-none">
                    {loading ? (
                        <div className="text-center py-12 font-bold text-text/60">{t.loadingLogs}</div>
                    ) : filteredTransactions.length === 0 ? (
                        <div className="history-empty flex flex-col items-center justify-center py-12 text-text/40 gap-2 border-2 border-dashed border-text/20 rounded-xl bg-yellow-light/10">
                            <i className="fa-solid fa-folder-open text-4xl"></i>
                            <p className="text-sm font-bold">Tidak ada transaksi yang cocok dengan filter.</p>
                        </div>
                    ) : (
                        <>
                            {/* 1. Mobile Card List (< lg) */}
                            <div className="block lg:hidden space-y-4">
                                {groupedSections.map((section, sIdx) => (
                                    <div key={sIdx} className="space-y-2.5">
                                        {section.groupTitle && (
                                            <div className="bg-pink-light/40 border border-text/20 px-3 py-1.5 rounded-lg flex justify-between items-center text-xs font-title font-bold text-text">
                                                <span>📅 {section.groupTitle}</span>
                                                <span className="text-[11px] text-pink font-bold">{formatLogMoney(section.groupTotal)} ({section.groupQty} pcs)</span>
                                            </div>
                                        )}
                                        {section.items.map(tx => (
                                            <div key={tx.id} className="bg-yellow-light/20 border-2 border-text rounded-xl p-3.5 shadow-[2px_2px_0px_#181818] flex flex-col gap-2.5">
                                                {/* Card Top: Order ID & Time */}
                                                <div className="flex justify-between items-center border-b border-dashed border-text/20 pb-2">
                                                    <span className="font-bold text-xs bg-blue-light border border-text rounded-md px-2 py-0.5 font-mono">{tx.id}</span>
                                                    <span className="text-[11px] opacity-70 font-mono">{new Date(tx.timestamp).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>

                                                {/* Card Body: User, Qty, Payment, Total */}
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div>
                                                        <span className="text-[10px] opacity-60 uppercase block font-bold">User</span>
                                                        <span className="font-bold font-title">{(tx.cashier || 'Staf').replace(/^Kasir\s+/i, '')}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] opacity-60 uppercase block font-bold">Barang</span>
                                                        <span className="font-bold">{tx.qty} pcs</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] opacity-60 uppercase block font-bold">Metode</span>
                                                        <span className="font-bold capitalize text-pink font-title">
                                                            {tx.paymentMethod === 'cash' ? t.cash : t.qris}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] opacity-60 uppercase block font-bold">Total Belanja</span>
                                                        <span className="font-bold text-sm text-text font-title">{formatLogMoney(tx.total)}</span>
                                                    </div>
                                                </div>

                                                {/* Card Actions: Quick Buttons */}
                                                <div className="flex gap-2 pt-2 border-t border-dashed border-text/20">
                                                    <button 
                                                        onClick={() => onReprint(tx)}
                                                        className="btn flex-1 bg-white text-text border-2 border-text rounded-full font-title text-[11px] py-1.5 shadow-[1.5px_1.5px_0px_#181818] active:translate-y-[1px] flex items-center justify-center gap-1 font-bold"
                                                    >
                                                        <i className="fa-solid fa-print"></i> Struk
                                                    </button>
                                                    <button 
                                                        onClick={() => handleRefund(tx.id)}
                                                        className="btn flex-1 bg-white text-pink border-2 border-text rounded-full font-title text-[11px] py-1.5 shadow-[1.5px_1.5px_0px_#181818] active:translate-y-[1px] flex items-center justify-center gap-1 font-bold"
                                                    >
                                                        <i className="fa-solid fa-rotate-left"></i> Refund
                                                    </button>
                                                    {isSuperAdmin && (
                                                        <button 
                                                            onClick={() => handleDeleteTransaction(tx)}
                                                            className="btn bg-rose-500 text-white border-2 border-text rounded-full font-title text-[11px] px-3 py-1.5 shadow-[1.5px_1.5px_0px_#181818] active:translate-y-[1px] flex items-center justify-center gap-1"
                                                            title="Hapus permanen"
                                                        >
                                                            <i className="fa-solid fa-trash-can"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>

                            {/* 2. Desktop Table (>= lg) */}
                            <div className="hidden lg:block border-2 border-text rounded-lg overflow-x-auto">
                                <table className="history-table w-full border-collapse text-left text-[13.5px] text-text">
                                    <thead>
                                        <tr className="bg-blue-light border-b-2 border-text font-title font-bold">
                                            <th className="p-3">{t.orderId}</th>
                                            <th className="p-3">{t.timestamp}</th>
                                            <th className="p-3">User</th>
                                            <th className="p-3">{t.itemsCount}</th>
                                            <th className="p-3">Pembayaran</th>
                                            <th className="p-3">Total</th>
                                            <th className="p-3 text-center">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupedSections.map((section, sIdx) => (
                                            <React.Fragment key={sIdx}>
                                                {section.groupTitle && (
                                                    <tr className="bg-pink-light/40 border-b-2 border-text font-title font-bold text-xs">
                                                        <td colSpan="5" className="p-2.5 pl-4 text-text">
                                                            📅 {section.groupTitle}
                                                        </td>
                                                        <td colSpan="2" className="p-2.5 text-pink text-right pr-4">
                                                            Total Sub-Sesi: {formatLogMoney(section.groupTotal)} ({section.groupQty} pcs)
                                                        </td>
                                                    </tr>
                                                )}
                                                {section.items.map(tx => (
                                                    <tr key={tx.id} className="hover:bg-yellow-light border-b border-text/15">
                                                        <td className="p-3 font-mono font-bold text-xs">{tx.id}</td>
                                                        <td className="p-3">{new Date(tx.timestamp).toLocaleString('id-ID')}</td>
                                                        <td className="p-3">
                                                            <span className="inline-flex items-center gap-1 font-bold bg-yellow-light/60 border border-text px-2 py-0.5 rounded-full text-xs">
                                                                <i className="fa-solid fa-user text-[10px] opacity-70"></i>
                                                                {(tx.cashier || 'Staf').replace(/^Kasir\s+/i, '')}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 font-bold">{tx.qty} barang</td>
                                                        <td className="p-3 capitalize font-bold text-pink">
                                                            {tx.paymentMethod === 'cash' ? t.cash : t.qris}
                                                        </td>
                                                        <td className="p-3 font-bold font-title">{formatLogMoney(tx.total)}</td>
                                                        <td className="p-3">
                                                            <div className="flex justify-center gap-2">
                                                                <button 
                                                                    onClick={() => onReprint(tx)}
                                                                    className="btn bg-white text-text border-2 border-text rounded-full font-title text-[11px] px-3 py-1 hover:bg-blue-light cursor-pointer shadow-[1.5px_1.5px_0px_#181818] transition-all flex items-center gap-1"
                                                                >
                                                                    <i className="fa-solid fa-print"></i> Struk
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleRefund(tx.id)}
                                                                    className="btn bg-white text-pink border-2 border-text rounded-full font-title text-[11px] px-3 py-1 hover:bg-pink-light cursor-pointer shadow-[1.5px_1.5px_0px_#181818] transition-all flex items-center gap-1"
                                                                    title="Batalkan transaksi & kembalikan stok"
                                                                >
                                                                    <i className="fa-solid fa-rotate-left"></i> Refund
                                                                </button>
                                                                {isSuperAdmin && (
                                                                    <button 
                                                                        onClick={() => handleDeleteTransaction(tx)}
                                                                        className="btn bg-rose-500 text-white border-2 border-text rounded-full font-title text-[11px] px-2.5 py-1 hover:bg-rose-600 cursor-pointer shadow-[1.5px_1.5px_0px_#181818] transition-all flex items-center gap-1"
                                                                        title="Hapus permanen transaksi (Super Admin)"
                                                                    >
                                                                        <i className="fa-solid fa-trash-can"></i>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Bar */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-3 border-t-2 border-text/10 shrink-0 font-body text-xs">
                                <span className="text-text/70">
                                    Menampilkan <strong>{filteredTransactions.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> - <strong>{Math.min(currentPage * pageSize, filteredTransactions.length)}</strong> dari <strong>{filteredTransactions.length}</strong> transaksi
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
        </div>
    );
}
