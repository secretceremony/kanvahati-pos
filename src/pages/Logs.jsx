import React, { useState, useEffect } from 'react';
import { getTransactionsList, deleteTransactionAndRefund } from '../services/db';
import { t } from '../services/translations';

export default function Logs({ onReprint, showToast }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

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
                
                <div className="table-container flex-grow overflow-y-auto overflow-x-auto max-h-[500px] lg:max-h-none border-2 border-text rounded-lg">
                    {loading ? (
                        <div className="text-center py-12 font-bold text-text/60">{t.loadingLogs}</div>
                    ) : transactions.length === 0 ? (
                        <div className="history-empty flex flex-col items-center justify-center py-12 text-text/40 gap-2">
                            <i className="fa-solid fa-folder-open text-4xl"></i>
                            <p className="text-sm font-bold">{t.emptyLogs}</p>
                        </div>
                    ) : (
                        <table className="history-table w-full border-collapse text-left text-[13.5px] text-text">
                            <thead>
                                <tr className="bg-blue-light border-b-2 border-text font-title font-bold">
                                    <th className="p-3">{t.orderId}</th>
                                    <th className="p-3">{t.timestamp}</th>
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
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
