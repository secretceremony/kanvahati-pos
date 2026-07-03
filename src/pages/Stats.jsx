import React, { useState, useEffect } from 'react';
import { getTransactionsList, getProducts, getCategories } from '../services/db';
import { t } from '../services/translations';

export default function Stats() {
    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalItemsSold: 0,
        totalOrders: 0,
        categorySales: {}
    });
    const [loading, setLoading] = useState(true);

    const loadStatsData = async () => {
        try {
            setLoading(true);
            const txs = await getTransactionsList();
            const prods = await getProducts();
            const cats = await getCategories();

            let totalRevenue = 0;
            let totalItemsSold = 0;
            const totalOrders = txs.length;

            const categorySales = {};
            cats.forEach(c => {
                categorySales[c] = 0;
            });

            txs.forEach(tx => {
                totalRevenue += tx.total;
                totalItemsSold += tx.qty;

                tx.items.forEach(item => {
                    const originalProduct = prods.find(p => p.id === item.id);
                    const category = originalProduct ? originalProduct.category : 'stickers';
                    categorySales[category] = (categorySales[category] || 0) + item.qty;
                });
            });

            setStats({
                totalRevenue,
                totalItemsSold,
                totalOrders,
                categorySales
            });
        } catch (e) {
            console.error("Failed to load statistics", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStatsData();
    }, []);

    // Find highest category quantity to scale relative percentages
    const qtyValues = Object.values(stats.categorySales);
    const maxQtyVal = Math.max(...qtyValues, 1);

    // Format stats revenue nicely matching active POS language
    const formatStatsMoney = (value) => {
        return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
    };

    return (
        <div className="stats-layout grid grid-cols-1 md:grid-cols-3 md:grid-rows-[auto_1fr] gap-5 lg:h-full h-auto">
            {loading ? (
                <div className="col-span-3 text-center py-12 font-bold text-text/60">{t.loadingStats}</div>
            ) : (
                <>
                    {/* Stat Card 1: Revenue */}
                    <div className="stat-box bg-pink-light border-[3px] border-text rounded-2xl shadow-card p-5 flex items-center gap-4 text-text">
                        <div className="stat-icon text-3xl"><i className="fa-solid fa-circle-dollar-to-slot"></i></div>
                        <div className="stat-info flex flex-col">
                            <span className="stat-label text-[11px] font-bold uppercase opacity-80">{t.revenue}</span>
                            <h2 className="stat-value font-title text-2xl mt-0.5">{formatStatsMoney(stats.totalRevenue)}</h2>
                        </div>
                    </div>

                    {/* Stat Card 2: Items Sold */}
                    <div className="stat-box bg-blue-light border-[3px] border-text rounded-2xl shadow-card p-5 flex items-center gap-4 text-text">
                        <div className="stat-icon text-3xl"><i className="fa-solid fa-boxes-stacked"></i></div>
                        <div className="stat-info flex flex-col">
                            <span className="stat-label text-[11px] font-bold uppercase opacity-80">{t.itemsSold}</span>
                            <h2 className="stat-value font-title text-2xl mt-0.5">{stats.totalItemsSold} pcs</h2>
                        </div>
                    </div>

                    {/* Stat Card 3: Orders Handled */}
                    <div className="stat-box bg-yellow-light border-[3px] border-text rounded-2xl shadow-card p-5 flex items-center gap-4 text-text">
                        <div className="stat-icon text-3xl"><i className="fa-solid fa-receipt"></i></div>
                        <div className="stat-info flex flex-col">
                            <span className="stat-label text-[11px] font-bold uppercase opacity-80">{t.ordersHandled}</span>
                            <h2 className="stat-value font-title text-2xl mt-0.5">{stats.totalOrders}</h2>
                        </div>
                    </div>

                    {/* Category Breakdown Graph */}
                    <div className="stats-breakdown-card col-span-1 md:col-span-3 bg-white border-[3px] border-text rounded-2xl shadow-card p-6 flex flex-col">
                        <h3 className="pane-title font-title text-[22px] text-text"><i className="fa-solid fa-chart-pie"></i> {t.categorySales}</h3>
                        
                        <div className="bar-chart-container flex flex-col gap-4 mt-6 justify-center flex-grow">
                                {Object.entries(stats.categorySales).map(([category, qty], index) => {
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
                                        <div key={category} className="chart-bar-row grid grid-cols-[100px_1fr_60px] items-center gap-4">
                                            <span className="chart-label font-title text-xs text-text capitalize">{displayLabel}</span>
                                        <div className="chart-bar-wrap bg-blue-light border-2 border-text rounded-full h-[18px] overflow-hidden relative shadow-[inset_1px_1px_2px_rgba(50,98,143,0.1)]">
                                            <div 
                                                className={`chart-bar-fill h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
                                                style={{ width: `${percentage}%` }}
                                            ></div>
                                        </div>
                                        <span className="chart-val text-xs font-bold text-right text-text">{qty} pcs</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
