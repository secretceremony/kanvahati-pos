import React, { useState, useEffect } from 'react';
import { getTransactionsList } from '../services/db';

export default function CashDrawer({ showToast, activeCashier, onCashierChange }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeMobileTab, setActiveMobileTab] = useState('summary');

    // Parse active cashier name (removing the prefix "Kasir ")
    const parseCashierInfo = () => {
        return activeCashier.replace(/^Kasir\s+/, '').trim();
    };

    const [cashierNameInput, setCashierNameInput] = useState(parseCashierInfo());

    const fetchData = async () => {
        try {
            setLoading(true);
            const txData = await getTransactionsList(true);
            setTransactions(txData);
        } catch (e) {
            console.error("Failed to load transactions", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        setCashierNameInput(parseCashierInfo());
    }, [activeCashier]);

    // Calculate today's sales summary
    const getTodaySalesSummary = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let cashSales = 0;
        let qrisSales = 0;
        let totalQty = 0;
        let totalOrders = 0;

        transactions.forEach(tx => {
            const txTime = new Date(tx.timestamp);
            if (txTime >= today) {
                totalOrders++;
                totalQty += tx.qty;
                if (tx.paymentMethod === 'cash') {
                    cashSales += tx.total;
                } else if (tx.paymentMethod === 'qris') {
                    qrisSales += tx.total;
                }
            }
        });

        return {
            cashSales,
            qrisSales,
            totalSales: cashSales + qrisSales,
            totalQty,
            totalOrders
        };
    };

    const summary = getTodaySalesSummary();

    const handleSaveShiftSettings = (e) => {
        e.preventDefault();
        const cleanName = cashierNameInput.trim();

        if (!cleanName) {
            showToast("Nama kasir tidak boleh kosong!", "⚠️");
            return;
        }

        // Update active cashier in parent component, format as "Kasir Name"
        const formattedCashier = `Kasir ${cleanName}`;
        onCashierChange(formattedCashier);
    };

    const formatMoney = (value) => {
        return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
    };

    return (
        <div className="cash-drawer-layout flex flex-col gap-3 lg:grid lg:grid-cols-[1.1fr_1.9fr] lg:gap-5 h-auto overflow-visible pb-10">
            {/* Mobile View Tab Selector */}
            <div className="lg:hidden flex border-2 border-text rounded-xl overflow-hidden mb-1 shrink-0 bg-white font-title text-xs font-bold shadow-[2px_2px_0px_#32628f] w-full">
                <button 
                    type="button"
                    onClick={() => setActiveMobileTab('summary')}
                    className={`flex-grow py-3 text-center border-r-2 border-text transition-colors cursor-pointer ${
                        activeMobileTab === 'summary' ? 'bg-yellow' : 'bg-white hover:bg-yellow-light/50'
                    }`}
                >
                    📊 Rekap Penjualan
                </button>
                <button 
                    type="button"
                    onClick={() => setActiveMobileTab('settings')}
                    className={`flex-grow py-3 text-center transition-colors cursor-pointer flex justify-center items-center gap-1.5 ${
                        activeMobileTab === 'settings' ? 'bg-yellow' : 'bg-white hover:bg-yellow-light/50'
                    }`}
                >
                    ⚙️ Pengaturan Kasir
                </button>
            </div>

            {/* Left Column: Cashier Config Card */}
            <div className={`flex flex-col gap-5 h-auto pr-1 ${activeMobileTab === 'settings' ? 'block' : 'hidden lg:flex'}`}>
                <div className="starting-cash-card bg-yellow-light border-[3px] border-text rounded-2xl shadow-card p-5 relative shrink-0">
                    <div className="washi-tape tape-yellow-1 absolute top-[-10px] left-10 transform rotate-[-3deg] h-6 w-24 border-l border-r border-dashed border-text/25 bg-pink-light"></div>
                    
                    <h3 className="pane-title font-title text-lg text-text mb-4 title-stroke">
                        <i className="fa-solid fa-user-gear"></i> Pengaturan Kasir
                    </h3>
                    
                    <form onSubmit={handleSaveShiftSettings} className="flex flex-col gap-3.5 text-text font-body">
                        {/* Cashier Name Input */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-bold uppercase">Nama Kasir Bertugas</label>
                            <input 
                                type="text" 
                                required 
                                placeholder="Contoh: Peach" 
                                value={cashierNameInput} 
                                onChange={(e) => setCashierNameInput(e.target.value)}
                                className="border-2 border-text rounded-xl p-2.5 text-sm outline-none bg-white font-bold focus:bg-yellow-light"
                            />
                        </div>
                        
                        <button 
                            type="submit"
                            className="btn bg-pink text-text border-[3px] border-text rounded-full font-title text-[12px] px-5 py-2.5 mt-1 shadow-btn hover:bg-white hover:translate-y-[-2px] active:translate-y-[1px] cursor-pointer transition-all flex items-center justify-center gap-1.5"
                        >
                            <i className="fa-solid fa-floppy-disk"></i> Simpan Pengaturan Kasir
                        </button>
                    </form>
                </div>
            </div>

            {/* Right Column: Today's Sales Summary */}
            <div className={`drawer-details bg-white border-[3px] border-text rounded-2xl shadow-card p-5 flex flex-col h-auto overflow-visible relative ${activeMobileTab === 'summary' ? 'block' : 'hidden lg:flex'}`}>
                <div className="washi-tape tape-history absolute top-[-12px] right-10 transform rotate-[3deg] h-6 w-24 z-5 border-l border-r border-dashed border-text/25 bg-blue-light"></div>
                
                <h3 className="pane-title font-title text-xl text-text mb-1 title-stroke">
                    <i className="fa-solid fa-chart-line"></i> Rekap Penjualan Hari Ini
                </h3>
                <p className="text-[11.5px] opacity-80 text-text mb-5">
                    Laporan penjualan kasir terhitung sejak pukul 00.00 hari ini.
                </p>

                {/* Calculation Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5 shrink-0 font-body text-text">
                    <div className="bg-yellow-light/40 border-2 border-text rounded-xl p-3 flex flex-col justify-between shadow-[2px_2px_0px_#32628f]">
                        <span className="text-[10px] font-bold uppercase opacity-75">Penjualan Tunai</span>
                        <h4 className="font-title text-base font-extrabold mt-1 text-emerald-700">{formatMoney(summary.cashSales)}</h4>
                    </div>
                    <div className="bg-blue-light/30 border-2 border-text rounded-xl p-3 flex flex-col justify-between shadow-[2px_2px_0px_#32628f]">
                        <span className="text-[10px] font-bold uppercase opacity-75">Penjualan QRIS</span>
                        <h4 className="font-title text-base font-extrabold mt-1 text-pink">{formatMoney(summary.qrisSales)}</h4>
                    </div>
                    <div className="bg-yellow border-2 border-text rounded-xl p-3 flex flex-col justify-between shadow-[3px_3px_0px_#32628f] col-span-2 sm:col-span-1">
                        <span className="text-[10.5px] font-title font-bold uppercase text-text/80">Total Pendapatan</span>
                        <h4 className="font-title text-[17px] font-black mt-1 text-text">{formatMoney(summary.totalSales)}</h4>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-text font-body border-t border-text/10 pt-4 mt-2">
                    <div className="bg-text/5 border-2 border-text rounded-xl p-3 text-center">
                        <span className="text-[10.5px] font-bold uppercase opacity-75 block mb-1">Pesanan Diproses</span>
                        <h4 className="font-title text-lg font-bold">{summary.totalOrders} Transaksi</h4>
                    </div>
                    <div className="bg-text/5 border-2 border-text rounded-xl p-3 text-center">
                        <span className="text-[10.5px] font-bold uppercase opacity-75 block mb-1">Barang Terjual</span>
                        <h4 className="font-title text-lg font-bold">{summary.totalQty} Pcs</h4>
                    </div>
                </div>
            </div>
        </div>
    );
}
