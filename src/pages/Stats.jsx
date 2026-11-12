import { useState, useEffect } from 'react';
import { getTransactionsList, getProducts, getCategories } from '../services/db';
import { t } from '../services/translations';

export default function Stats() {
    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalItemsSold: 0,
        totalOrders: 0,
        categorySales: {},
        topProducts: [],
        peakSalesDay: null
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const [txs, prods, cats] = await Promise.all([
                    getTransactionsList(),
                    getProducts(),
                    getCategories()
                ]);
                if (!mounted) return;

                let totalRevenue = 0;
                let totalItemsSold = 0;
                const totalOrders = txs.length;

                const categorySales = {};
                cats.forEach(c => {
                    categorySales[c] = { qty: 0, revenue: 0 };
                });

                const prodsMap = new Map();
                prods.forEach(p => prodsMap.set(p.id, p));

                const prodStatsMap = new Map();
                const dailyStatsMap = new Map();

                txs.forEach(tx => {
                    totalRevenue += tx.total;
                    totalItemsSold += tx.qty;

                    const dateKey = new Date(tx.timestamp).toISOString().split('T')[0];
                    if (!dailyStatsMap.has(dateKey)) {
                        dailyStatsMap.set(dateKey, { date: dateKey, revenue: 0, orders: 0, qty: 0 });
                    }
                    const dStat = dailyStatsMap.get(dateKey);
                    dStat.revenue += tx.total;
                    dStat.orders += 1;
                    dStat.qty += tx.qty;

                    tx.items.forEach(item => {
                        const originalProduct = prodsMap.get(item.id);
                        const category = originalProduct ? originalProduct.category : 'stickers';
                        if (!categorySales[category]) {
                            categorySales[category] = { qty: 0, revenue: 0 };
                        }
                        const itemSubtotal = (item.price || 0) * (item.qty || 1);
                        categorySales[category].qty += item.qty;
                        categorySales[category].revenue += itemSubtotal;

                        const pKey = item.id;
                        if (!prodStatsMap.has(pKey)) {
                            prodStatsMap.set(pKey, {
                                id: item.id,
                                name: item.name,
                                category,
                                qty: 0,
                                revenue: 0
                            });
                        }
                        const pStat = prodStatsMap.get(pKey);
                        pStat.qty += item.qty;
                        pStat.revenue += itemSubtotal;
                    });
                });

                const topProducts = Array.from(prodStatsMap.values())
                    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
                    .slice(0, 5);

                let peakSalesDay = null;
                if (dailyStatsMap.size > 0) {
                    peakSalesDay = Array.from(dailyStatsMap.values()).reduce((max, cur) =>
                        cur.revenue > (max ? max.revenue : 0) ? cur : max
                    , null);
                }

                setStats({
                    totalRevenue,
                    totalItemsSold,
                    totalOrders,
                    categorySales,
                    topProducts,
                    peakSalesDay
                });
            } catch (e) {
                console.error("Failed to load statistics", e);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, []);

    // Find highest category quantity to scale relative percentages
    const qtyValues = Object.values(stats.categorySales).map(c => typeof c === 'object' ? c.qty : c);
    const maxQtyVal = Math.max(...qtyValues, 1);

    // Format stats revenue nicely matching active POS language
    const formatStatsMoney = (value) => {
        return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
    };

    return (
        <div className="stats-layout flex flex-col gap-5 lg:h-full h-auto font-body pb-10">
            {loading ? (
                <div className="text-center py-12 font-bold text-text/60">{t.loadingStats}</div>
            ) : (
                <>
                    {/* Top 3 Core Metric Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Stat Card 1: Revenue (Retro Card) */}
                        <div className="stat-box bg-white border-[2.5px] border-text rounded-2xl shadow-card overflow-hidden text-text flex flex-col">
                            <div className="retro-window-header bg-pink">
                                <span className="font-tag text-[9.5px] font-black uppercase tracking-wider text-text">Total Omset</span>
                                <span className="retro-dot retro-dot-red"></span>
                            </div>
                            <div className="p-4 flex items-center gap-3.5 bg-pink-light/30 flex-grow">
                                <div className="stat-icon text-3xl text-pink"><i className="fa-solid fa-circle-dollar-to-slot"></i></div>
                                <div className="stat-info flex flex-col">
                                    <span className="stat-label text-[10px] font-tag font-bold uppercase opacity-70">{t.revenue}</span>
                                    <h2 className="stat-value font-title text-xl font-bold mt-0.5">{formatStatsMoney(stats.totalRevenue)}</h2>
                                </div>
                            </div>
                        </div>

                        {/* Stat Card 2: Items Sold (Retro Card) */}
                        <div className="stat-box bg-white border-[2.5px] border-text rounded-2xl shadow-card overflow-hidden text-text flex flex-col">
                            <div className="retro-window-header bg-blue">
                                <span className="font-tag text-[9.5px] font-black uppercase tracking-wider text-text">Barang Terjual</span>
                                <span className="retro-dot retro-dot-blue"></span>
                            </div>
                            <div className="p-4 flex items-center gap-3.5 bg-blue-light/30 flex-grow">
                                <div className="stat-icon text-3xl text-blue"><i className="fa-solid fa-boxes-stacked"></i></div>
                                <div className="stat-info flex flex-col">
                                    <span className="stat-label text-[10px] font-tag font-bold uppercase opacity-70">{t.itemsSold}</span>
                                    <h2 className="stat-value font-title text-xl font-bold mt-0.5">{stats.totalItemsSold} pcs</h2>
                                </div>
                            </div>
                        </div>

                        {/* Stat Card 3: Orders Handled (Retro Card) */}
                        <div className="stat-box bg-white border-[2.5px] border-text rounded-2xl shadow-card overflow-hidden text-text flex flex-col">
                            <div className="retro-window-header bg-yellow">
                                <span className="font-tag text-[9.5px] font-black uppercase tracking-wider text-text">Transaksi Diproses</span>
                                <span className="retro-dot retro-dot-yellow"></span>
                            </div>
                            <div className="p-4 flex items-center gap-3.5 bg-yellow-light/50 flex-grow">
                                <div className="stat-icon text-3xl text-text"><i className="fa-solid fa-receipt"></i></div>
                                <div className="stat-info flex flex-col">
                                    <span className="stat-label text-[10px] font-tag font-bold uppercase opacity-70">{t.ordersHandled}</span>
                                    <h2 className="stat-value font-title text-xl font-bold mt-0.5">{stats.totalOrders} Pesanan</h2>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Middle Section: Peak Sales Day Highlight Banner */}
                    {stats.peakSalesDay && (
                        <div className="bg-yellow-light/40 border-[2.5px] border-text rounded-2xl p-4 shadow-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative overflow-hidden">
                            <div className="flex items-center gap-3 z-10">
                                <div className="w-12 h-12 rounded-xl bg-yellow border-2 border-text flex items-center justify-center text-xl shadow-[2px_2px_0px_#181818] shrink-0">
                                    👑
                                </div>
                                <div>
                                    <span className="text-[10px] font-tag font-extrabold uppercase bg-pink text-white px-2 py-0.5 rounded border border-text shadow-[1px_1px_0px_#181818]">
                                        Hari Penjualan Terbanyak (Peak Day)
                                    </span>
                                    <h4 className="font-title text-base sm:text-lg font-bold text-text mt-1">
                                        {new Date(stats.peakSalesDay.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                    </h4>
                                    <p className="text-xs text-text/75 font-body">
                                        Menghasilkan omset harian tertinggi sepanjang operasional booth.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 self-end sm:self-center z-10 bg-white border-2 border-text rounded-xl px-4 py-2 shadow-[2px_2px_0px_#181818]">
                                <div className="text-right">
                                    <span className="text-[10px] uppercase font-bold text-text/60 block">Omset Hari Itu</span>
                                    <span className="font-title font-bold text-base text-pink">{formatStatsMoney(stats.peakSalesDay.revenue)}</span>
                                </div>
                                <div className="border-l-2 border-text/20 pl-3 text-right">
                                    <span className="text-[10px] uppercase font-bold text-text/60 block">Pesanan</span>
                                    <span className="font-bold text-sm text-text">{stats.peakSalesDay.orders} tx ({stats.peakSalesDay.qty} pcs)</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bottom Split Grid: Category Breakdown (Left) & Bestselling Merchandise (Right) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* 1. Category Breakdown Card */}
                        <div className="stats-breakdown-card bg-white border-[2.5px] border-text rounded-2xl shadow-card overflow-hidden flex flex-col">
                            <div className="retro-window-header bg-yellow border-b-[2.5px] border-text px-4 py-2 flex items-center justify-between">
                                <div className="retro-dots flex items-center gap-1.5">
                                    <span className="retro-dot retro-dot-red"></span>
                                    <span className="retro-dot retro-dot-yellow"></span>
                                    <span className="retro-dot retro-dot-blue"></span>
                                    <span className="font-tag text-[10px] font-black uppercase tracking-wider text-text ml-1">Komposisi Penjualan</span>
                                </div>
                                <span className="text-[10px] font-tag font-bold opacity-75">Per Kategori</span>
                            </div>
                            
                            <div className="p-4 sm:p-5 flex flex-col flex-grow bg-[#FFFDF9]">
                                <h3 className="pane-title font-title text-lg text-text mb-4 title-stroke flex items-center gap-2">
                                    <i className="fa-solid fa-chart-pie text-pink"></i>
                                    <span>Penjualan per Kategori</span>
                                </h3>
                                
                                <div className="flex flex-col gap-3.5 justify-center flex-grow">
                                    {Object.entries(stats.categorySales).map(([category, data], index) => {
                                        const qty = typeof data === 'object' ? data.qty : data;
                                        const revenue = typeof data === 'object' ? data.revenue : 0;
                                        const percentage = (qty / maxQtyVal) * 100;
                                        const barColor = index % 3 === 0 ? 'bg-pink' : index % 3 === 1 ? 'bg-yellow' : 'bg-blue';
                                        
                                        const labels = {
                                            stickers: "Stiker",
                                            keychains: "Gantungan Kunci",
                                            prints: "Cetak Gambar",
                                            washi: "Selotip Washi"
                                        };
                                        const displayLabel = labels[category] || (category.charAt(0).toUpperCase() + category.slice(1));

                                        return (
                                            <div key={category} className="flex flex-col gap-1 border-b border-dashed border-text/10 pb-2.5 last:border-none">
                                                <div className="flex justify-between items-center text-xs font-bold">
                                                    <span className="font-title text-text capitalize">{displayLabel}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] text-pink font-title font-bold">{formatStatsMoney(revenue)}</span>
                                                        <span className="bg-yellow-light border border-text px-1.5 py-0.2 rounded text-[10px]">{qty} pcs</span>
                                                    </div>
                                                </div>
                                                <div className="chart-bar-wrap bg-blue-light/40 border-2 border-text rounded-full h-[14px] overflow-hidden relative shadow-[inset_1px_1px_2px_rgba(50,98,143,0.1)]">
                                                    <div 
                                                        className={`chart-bar-fill h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
                                                        style={{ width: `${percentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* 2. Top Bestselling Merchandise Leaderboard Card */}
                        <div className="bestsellers-card bg-white border-[2.5px] border-text rounded-2xl shadow-card overflow-hidden flex flex-col">
                            <div className="retro-window-header bg-pink border-b-[2.5px] border-text px-4 py-2 flex items-center justify-between">
                                <div className="retro-dots flex items-center gap-1.5">
                                    <span className="retro-dot retro-dot-red"></span>
                                    <span className="retro-dot retro-dot-yellow"></span>
                                    <span className="retro-dot retro-dot-blue"></span>
                                    <span className="font-tag text-[10px] font-black uppercase tracking-wider text-text ml-1">Peringkat Produk</span>
                                </div>
                                <span className="text-[10px] font-tag font-bold opacity-75">Top 5 Terlaris</span>
                            </div>

                            <div className="p-4 sm:p-5 flex flex-col flex-grow bg-[#FFFDF9]">
                                <h3 className="pane-title font-title text-lg text-text mb-4 title-stroke flex items-center gap-2">
                                    <i className="fa-solid fa-trophy text-yellow"></i>
                                    <span>Merchandise Paling Banyak Terjual</span>
                                </h3>

                                {stats.topProducts.length === 0 ? (
                                    <div className="text-center py-10 text-xs font-bold text-text/50 border-2 border-dashed border-text/15 rounded-xl bg-yellow-light/10">
                                        Belum ada data penjualan tercatat.
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2.5">
                                        {stats.topProducts.map((p, idx) => (
                                            <div key={p.id} className="bg-white border-2 border-text rounded-xl p-3 flex items-center justify-between gap-3 shadow-[1.5px_1.5px_0px_#181818] hover:translate-x-0.5 transition-all">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`w-7 h-7 rounded-full border-2 border-text font-tag font-black text-xs flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#181818] ${
                                                        idx === 0 ? 'bg-yellow text-text' : idx === 1 ? 'bg-pink text-white' : idx === 2 ? 'bg-blue-light text-text' : 'bg-gray-100 text-text/70'
                                                    }`}>
                                                        #{idx + 1}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h5 className="font-title font-bold text-xs text-text truncate" title={p.name}>{p.name}</h5>
                                                        <span className="text-[10px] font-mono text-text/50 font-bold block">{p.id}</span>
                                                    </div>
                                                </div>

                                                <div className="text-right shrink-0">
                                                    <span className="font-title font-bold text-xs text-pink block">{formatStatsMoney(p.revenue)}</span>
                                                    <span className="bg-yellow-light border border-text px-2 py-0.5 rounded-full text-[10px] font-bold inline-block">
                                                        {p.qty} pcs terjual
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
