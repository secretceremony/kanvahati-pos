import React, { useState, useEffect } from 'react';
import { getTransactionsList, deleteTransactionAndRefund } from '../services/db';
import { recordAuditLog } from '../services/audit';
import { t } from '../services/translations';

export default function Logs({ onReprint, showToast, currentUser, userRole }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

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

    return (
        <div className="history-layout lg:h-full h-auto">
            <div className="history-card bg-white border-[3px] border-text rounded-2xl shadow-card p-6 lg:h-full h-auto relative flex flex-col">
                <div className="washi-tape tape-history absolute top-[-12px] left-10 transform rotate-[-3deg] h-6 w-24 z-5 border-l border-r border-dashed border-text/25"></div>
                
                <h3 className="pane-title font-title text-2xl text-text mb-1 title-stroke">
                    <i className="fa-solid fa-clock-rotate-left"></i> Riwayat Transaksi
                </h3>
                <p className="pane-subtitle text-[13px] opacity-80 mb-5 text-text">
                    Lihat, cetak ulang, atau batalkan/refund transaksi belanja hari ini.
                </p>
                
                <div className="table-container flex-grow overflow-y-auto max-h-[500px] lg:max-h-none">
                    {loading ? (
                        <div className="text-center py-12 font-bold text-text/60">{t.loadingLogs}</div>
                    ) : transactions.length === 0 ? (
                        <div className="history-empty flex flex-col items-center justify-center py-12 text-text/40 gap-2">
                            <i className="fa-solid fa-folder-open text-4xl"></i>
                            <p className="text-sm font-bold">{t.emptyLogs}</p>
                        </div>
                    ) : (
                        <>
                            {/* 1. Mobile Card List (< lg) */}
                            <div className="block lg:hidden space-y-3">
                                {transactions.map(tx => (
                                    <div key={tx.id} className="bg-yellow-light/20 border-2 border-text rounded-xl p-3.5 shadow-[2px_2px_0px_#32628f] flex flex-col gap-2.5">
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
                                                className="btn flex-1 bg-white text-text border-2 border-text rounded-full font-title text-[11px] py-1.5 shadow-[1.5px_1.5px_0px_#32628f] active:translate-y-[1px] flex items-center justify-center gap-1 font-bold"
                                            >
                                                <i className="fa-solid fa-print"></i> Struk
                                            </button>
                                            <button 
                                                onClick={() => handleRefund(tx.id)}
                                                className="btn flex-1 bg-white text-pink border-2 border-text rounded-full font-title text-[11px] py-1.5 shadow-[1.5px_1.5px_0px_#32628f] active:translate-y-[1px] flex items-center justify-center gap-1 font-bold"
                                            >
                                                <i className="fa-solid fa-rotate-left"></i> Refund
                                            </button>
                                            {isSuperAdmin && (
                                                <button 
                                                    onClick={() => handleDeleteTransaction(tx)}
                                                    className="btn bg-rose-500 text-white border-2 border-text rounded-full font-title text-[11px] px-3 py-1.5 shadow-[1.5px_1.5px_0px_#32628f] active:translate-y-[1px] flex items-center justify-center gap-1"
                                                    title="Hapus permanen"
                                                >
                                                    <i className="fa-solid fa-trash-can"></i>
                                                </button>
                                            )}
                                        </div>
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
                                            <th className="p-3">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transactions.map(tx => (
                                            <tr key={tx.id} className="hover:bg-yellow-light border-b border-text/15">
                                                <td className="p-3 font-bold">{tx.id}</td>
                                                <td className="p-3">{new Date(tx.timestamp).toLocaleString()}</td>
                                                <td className="p-3">
                                                    <span className="inline-flex items-center gap-1 font-bold bg-yellow-light/60 border border-text px-2 py-0.5 rounded-full text-xs">
                                                        <i className="fa-solid fa-user text-[10px] opacity-70"></i>
                                                        {(tx.cashier || 'Staf').replace(/^Kasir\s+/i, '')}
                                                    </span>
                                                </td>
                                                <td className="p-3">{tx.qty} barang</td>
                                                <td className="p-3 capitalize font-bold text-pink">
                                                    {tx.paymentMethod === 'cash' ? t.cash : t.qris}
                                                </td>
                                                <td className="p-3 font-bold">{formatLogMoney(tx.total)}</td>
                                                <td className="p-3">
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => onReprint(tx)}
                                                            className="btn bg-white text-text border-2 border-text rounded-full font-title text-[11px] px-3.5 py-1.5 hover:bg-blue-light cursor-pointer shadow-[2px_2px_0px_#32628f] transition-all flex items-center gap-1"
                                                        >
                                                            <i className="fa-solid fa-print"></i> Struk
                                                        </button>
                                                        <button 
                                                            onClick={() => handleRefund(tx.id)}
                                                            className="btn bg-white text-pink border-2 border-text rounded-full font-title text-[11px] px-3.5 py-1.5 hover:bg-pink-light cursor-pointer shadow-[2px_2px_0px_#32628f] transition-all flex items-center gap-1"
                                                            title="Batalkan transaksi & kembalikan stok"
                                                        >
                                                            <i className="fa-solid fa-rotate-left"></i> Refund
                                                        </button>
                                                        {isSuperAdmin && (
                                                            <button 
                                                                onClick={() => handleDeleteTransaction(tx)}
                                                                className="btn bg-red-500 text-white border-2 border-text rounded-full font-title text-[11px] px-3 py-1.5 hover:bg-red-600 cursor-pointer shadow-[2px_2px_0px_#32628f] transition-all flex items-center gap-1"
                                                                title="Hapus permanen transaksi (Super Admin)"
                                                            >
                                                                <i className="fa-solid fa-trash-can"></i> Hapus
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
