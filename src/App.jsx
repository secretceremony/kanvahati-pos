import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';

const Register = React.lazy(() => import('./pages/Register'));
const Logs = React.lazy(() => import('./pages/Logs'));
const Stats = React.lazy(() => import('./pages/Stats'));
const Inventory = React.lazy(() => import('./pages/Inventory'));
const CashDrawer = React.lazy(() => import('./pages/CashDrawer'));
const Bundles = React.lazy(() => import('./pages/Bundles'));
import Login from './pages/Login';

import ReceiptModal from './components/ReceiptModal';
import SystemBanner from './components/SystemBanner';
import { t } from './services/translations';

function Navigation() {
    const location = useLocation();
    const currentPath = location.pathname;

    return (
        <div className="header-nav flex flex-wrap gap-2 justify-center flex-grow">
            <Link 
                to="/"
                className={`nav-tab font-title text-[13px] sm:text-[14px] font-bold text-text bg-white border-2 rounded-lg px-3 sm:px-4 py-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                    currentPath === '/' ? 'bg-yellow border-text shadow-[3px_3px_0px_#32628f] translate-y-[-1px] translate-x-[-1px]' : 'border-transparent hover:bg-blue-light hover:border-text'
                }`}
            >
                <i className="fa-solid fa-calculator"></i> {t.terminal}
            </Link>
            <Link 
                to="/kas"
                className={`nav-tab font-title text-[13px] sm:text-[14px] font-bold text-text bg-white border-2 rounded-lg px-3 sm:px-4 py-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                    currentPath === '/kas' ? 'bg-yellow border-text shadow-[3px_3px_0px_#32628f] translate-y-[-1px] translate-x-[-1px]' : 'border-transparent hover:bg-blue-light hover:border-text'
                }`}
            >
                <i className="fa-solid fa-vault"></i> {t.cashDrawer || "Modal Kas"}
            </Link>
            <Link 
                to="/riwayat"
                className={`nav-tab font-title text-[13px] sm:text-[14px] font-bold text-text bg-white border-2 rounded-lg px-3 sm:px-4 py-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                    currentPath === '/riwayat' ? 'bg-yellow border-text shadow-[3px_3px_0px_#32628f] translate-y-[-1px] translate-x-[-1px]' : 'border-transparent hover:bg-blue-light hover:border-text'
                }`}
            >
                <i className="fa-solid fa-clock-rotate-left"></i> {t.logs}
            </Link>
            <Link 
                to="/statistik"
                className={`nav-tab font-title text-[13px] sm:text-[14px] font-bold text-text bg-white border-2 rounded-lg px-3 sm:px-4 py-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                    currentPath === '/statistik' ? 'bg-yellow border-text shadow-[3px_3px_0px_#32628f] translate-y-[-1px] translate-x-[-1px]' : 'border-transparent hover:bg-blue-light hover:border-text'
                }`}
            >
                <i className="fa-solid fa-chart-line"></i> {t.stats}
            </Link>
            <Link 
                to="/stok"
                className={`nav-tab font-title text-[13px] sm:text-[14px] font-bold text-text bg-white border-2 rounded-lg px-3 sm:px-4 py-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                    currentPath === '/stok' ? 'bg-yellow border-text shadow-[3px_3px_0px_#32628f] translate-y-[-1px] translate-x-[-1px]' : 'border-transparent hover:bg-blue-light hover:border-text'
                }`}
            >
                <i className="fa-solid fa-boxes-stacked"></i> {t.inventory}
            </Link>
            <Link 
                to="/promo"
                className={`nav-tab font-title text-[13px] sm:text-[14px] font-bold text-text bg-white border-2 rounded-lg px-3 sm:px-4 py-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                    currentPath === '/promo' ? 'bg-yellow border-text shadow-[3px_3px_0px_#32628f] translate-y-[-1px] translate-x-[-1px]' : 'border-transparent hover:bg-blue-light hover:border-text'
                }`}
            >
                <i className="fa-solid fa-tags"></i> {t.promo}
            </Link>
        </div>
    );
}

export default function App() {
    const [activeTransaction, setActiveTransaction] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', icon: '✨' });
    const [activeCashier, setActiveCashier] = useState(() => {
        return localStorage.getItem('kanvahati_cashier') || "Kasir Peach 🌸";
    });
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setIsAuthenticated(!!user);
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleCashierChange = (newName) => {
        if (newName && newName.trim()) {
            const formatted = newName.trim().startsWith("Kasir ") ? newName.trim() : `Kasir ${newName.trim()}`;
            setActiveCashier(formatted);
            localStorage.setItem('kanvahati_cashier', formatted);
            showToast(`Nama kasir diubah ke ${formatted}`, "🌸");
        }
    };

    const showToast = (message, icon = '✨') => {
        setToast({ show: true, message, icon });
        setTimeout(() => {
            setToast(prev => ({ ...prev, show: false }));
        }, 2200);
    };

    const handleCheckoutSuccess = (transaction) => {
        setActiveTransaction(transaction);
    };

    const handleReprint = (transaction) => {
        setActiveTransaction(transaction);
    };

    const handlePrintReceipt = () => {
        showToast(t.reprinting);
        setActiveTransaction(null);
    };

    const handleCloseReceipt = () => {
        setActiveTransaction(null);
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-blue-light/20 font-body text-text">
                <div className="text-center">
                    <i className="fa-solid fa-spinner fa-spin text-2xl text-text/60 mb-3"></i>
                    <p className="text-sm font-bold opacity-60">Memuat...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <>
                <Login 
                    onLoginSuccess={() => {
                        setIsAuthenticated(true);
                    }}
                    showToast={showToast}
                />
                {/* Toast Alerts */}
                <div className={`cute-toast fixed bottom-[25px] left-1/2 transform translate-x-[-50%] bg-yellow-light border-[3px] border-text rounded-full px-5 py-2.5 flex items-center gap-2.5 shadow-btn z-[10000] font-title text-[13.5px] font-bold pointer-events-none transition-transform duration-400 ${
                    toast.show ? 'translate-y-0 opacity-100' : 'translate-y-[100px] opacity-0'
                }`}>
                    <span className="toast-icon text-[15px]">{toast.icon}</span>
                    <span className="toast-message text-text">{toast.message}</span>
                </div>
            </>
        );
    }

    return (
        <BrowserRouter>
            <div className="pos-app max-w-7xl mx-auto h-full flex flex-col pt-3 lg:pt-5 px-3 lg:px-5 relative z-10">
                <SystemBanner />
                
                {/* Storefront Canopy Header */}
                <header className="pos-header bg-white border-[3px] border-text rounded-[24px] shadow-card mt-3 mb-5 overflow-hidden shrink-0">
                    <div className="canopy-stripes h-3 bg-[repeating-linear-gradient(90deg,var(--color-pink)_0px,var(--color-pink)_35px,var(--color-white)_35px,var(--color-white)_70px)] border-b-[3px] border-text"></div>
                    <div className="header-content flex flex-col md:flex-row justify-between items-center p-3 md:px-5 gap-3">
                        
                        {/* Logo Section */}
                        <div className="pos-logo flex flex-wrap items-center gap-3">
                            <img 
                                src="/kanvahati-logo.png" 
                                alt="Kanvahati Logo" 
                                className="h-10 object-contain"
                            />
                            <span className="badge-terminal bg-blue-light border-2 border-text rounded-full px-2.5 py-0.5 text-[11px] font-bold text-text">
                                Terminal #01
                            </span>
                                                        {/* Cashier Selector */}
                            <div className="flex items-center gap-2 border-2 border-text rounded-full px-3 py-0.5 bg-yellow-light/30 text-text">
                                <span className="text-[10px] font-bold opacity-70 uppercase">Kasir:</span>
                                <span className="text-[11.5px] font-bold font-title">{activeCashier}</span>
                                <button 
                                    onClick={() => {
                                        const cleanName = activeCashier.replace(/^Kasir\s+/, '');
                                        const newName = prompt("Ubah nama kasir:", cleanName);
                                        handleCashierChange(newName);
                                    }}
                                    className="text-text hover:text-pink hover:scale-110 cursor-pointer text-[10px] flex items-center"
                                    title="Ubah nama kasir"
                                >
                                    <i className="fa-solid fa-pen-to-square"></i>
                                </button>
                            </div>
                            
                            {/* Logout button */}
                            <button 
                                onClick={async () => {
                                    if (window.confirm("Apakah Anda yakin ingin logout?")) {
                                        try {
                                            await signOut(auth);
                                            showToast("Anda telah keluar.", "🔒");
                                        } catch (error) {
                                            showToast("Gagal logout. Coba lagi.", "⚠️");
                                        }
                                    }
                                }}
                                className="text-pink bg-white border-2 border-text rounded-full p-1.5 hover:bg-pink-light hover:scale-110 transition-all cursor-pointer flex items-center justify-center text-xs shadow-[1.5px_1.5px_0px_#32628f] shrink-0"
                                title="Keluar / Logout"
                            >
                                <i className="fa-solid fa-right-from-bracket"></i>
                            </button>
                        </div>

                        {/* Tab Navigation buttons */}
                        <Navigation />

                    </div>
                </header>

                {/* Content Tabs Body */}
                <main className="pos-body flex-grow overflow-visible relative pb-8">
                    <React.Suspense fallback={<div className="text-center py-12 font-bold text-text/60">Memuat Halaman...</div>}>
                        <Routes>
                            <Route path="/" element={<Register onCheckoutSuccess={handleCheckoutSuccess} showToast={showToast} activeCashier={activeCashier} />} />
                            <Route path="/kas" element={<CashDrawer showToast={showToast} activeCashier={activeCashier} onCashierChange={handleCashierChange} />} />
                            <Route path="/riwayat" element={<Logs onReprint={handleReprint} showToast={showToast} />} />
                            <Route path="/statistik" element={<Stats />} />
                            <Route path="/stok" element={<Inventory showToast={showToast} />} />
                            <Route path="/promo" element={<Bundles />} />
                        </Routes>
                    </React.Suspense>
                </main>

                {/* Receipt Modal */}
                <ReceiptModal 
                    transaction={activeTransaction} 
                    onClose={handleCloseReceipt} 
                    onPrint={handlePrintReceipt}
                />

                {/* Toast Alerts */}
                <div className={`cute-toast fixed bottom-[25px] left-1/2 transform translate-x-[-50%] bg-yellow-light border-[3px] border-text rounded-full px-5 py-2.5 flex items-center gap-2.5 shadow-btn z-[10000] font-title text-[13.5px] font-bold pointer-events-none transition-transform duration-400 ${
                    toast.show ? 'translate-y-0 opacity-100' : 'translate-y-[100px] opacity-0'
                }`}>
                    <span className="toast-icon text-[15px]">{toast.icon}</span>
                    <span className="toast-message text-text">{toast.message}</span>
                </div>



            </div>
        </BrowserRouter>
    );
}
