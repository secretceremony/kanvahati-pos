import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';

const Register = React.lazy(() => import('./pages/Register'));
const Logs = React.lazy(() => import('./pages/Logs'));
const Stats = React.lazy(() => import('./pages/Stats'));
const Inventory = React.lazy(() => import('./pages/Inventory'));
const CashDrawer = React.lazy(() => import('./pages/CashDrawer'));
const Bundles = React.lazy(() => import('./pages/Bundles'));
const Rekapan = React.lazy(() => import('./pages/Rekapan'));
const HostConsole = React.lazy(() => import('./arcade/pages/HostConsole'));
const VisitorDisplay = React.lazy(() => import('./arcade/pages/VisitorDisplay'));
const QuestionBankManager = React.lazy(() => import('./arcade/pages/QuestionBankManager'));

import Login from './pages/Login';
import ReceiptModal from './components/ReceiptModal';
import SystemBanner from './components/SystemBanner';
import { t } from './services/translations';
import { subscribeAuthState, logoutUser } from './services/auth';

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
                <i className="fa-solid fa-tags"></i> {t.promo || "Promo"}
            </Link>
            <Link 
                to="/rekapan"
                className={`nav-tab font-title text-[13px] sm:text-[14px] font-bold text-text bg-white border-2 rounded-lg px-3 sm:px-4 py-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                    currentPath === '/rekapan' ? 'bg-yellow border-text shadow-[3px_3px_0px_#32628f] translate-y-[-1px] translate-x-[-1px]' : 'border-transparent hover:bg-blue-light hover:border-text'
                }`}
            >
                <i className="fa-solid fa-file-invoice-dollar"></i> {t.recap || "Rekapan"}
            </Link>
            <Link 
                to="/arcade/host"
                className={`nav-tab font-title text-[13px] sm:text-[14px] font-bold text-text bg-white border-2 rounded-lg px-3 sm:px-4 py-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                    currentPath.startsWith('/arcade') ? 'bg-pink border-text shadow-[3px_3px_0px_#32628f] translate-y-[-1px] translate-x-[-1px]' : 'border-transparent hover:bg-pink-light hover:border-text'
                }`}
            >
                <i className="fa-solid fa-gamepad"></i> Arcade
            </Link>
        </div>
    );
}

function MainRoutes({
    currentUser,
    userRole,
    activeCashier,
    handleCashierChange,
    handleCheckoutSuccess,
    handleReprint,
    activeTransaction,
    handleCloseReceipt,
    handlePrintReceipt,
    showToast
}) {
    const location = useLocation();
    const isDisplayRoute = location.pathname === '/arcade/display';

    // If role is arcade_display and not on /arcade/display, force redirect to /arcade/display
    if (userRole === 'arcade_display' && !isDisplayRoute) {
        return <Navigate to="/arcade/display" replace />;
    }

    if (isDisplayRoute) {
        return (
            <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center font-title font-bold text-lg bg-[#f6f9fc]">Memuat Layar Display...</div>}>
                <VisitorDisplay currentUser={currentUser} userRole={userRole} showToast={showToast} />
            </React.Suspense>
        );
    }

    return (
        <div className="pos-container max-w-[1350px] mx-auto px-4 my-5 flex flex-col min-h-screen h-auto pb-12">
            <SystemBanner />
            {/* Storefront Canopy Header */}
            <header className="pos-header bg-white border-[3px] border-text rounded-[24px] shadow-card mb-5 overflow-hidden shrink-0">
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
                        <span className="badge-role bg-pink-light border-2 border-text rounded-full px-2.5 py-0.5 text-[10px] font-bold text-text uppercase tracking-wider">
                            {userRole || 'KASIR'}
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
                                    await logoutUser();
                                    showToast("Sesi telah ditutup. Anda telah keluar.", "🔒");
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
                        <Route path="/rekapan" element={<Rekapan showToast={showToast} />} />
                        <Route path="/arcade/host" element={<HostConsole currentUser={currentUser} userRole={userRole} showToast={showToast} />} />
                        <Route path="/arcade/questions" element={<QuestionBankManager currentUser={currentUser} userRole={userRole} showToast={showToast} />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </React.Suspense>
            </main>

            {/* Receipt Modal */}
            <ReceiptModal 
                transaction={activeTransaction} 
                onClose={handleCloseReceipt} 
                onPrint={handlePrintReceipt}
            />
        </div>
    );
}

export default function App() {
    const [activeTransaction, setActiveTransaction] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', icon: '✨' });
    const [activeCashier, setActiveCashier] = useState(() => {
        return localStorage.getItem('kanvahati_cashier') || "Kasir Peach 🌸";
    });
    
    // Firebase Auth State
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        // Support QA automated testing / demo role parameter
        const search = typeof window !== 'undefined' ? window.location.search : '';
        const params = new URLSearchParams(search);
        const demoRole = params.get('demoRole');

        if (demoRole) {
            const mockUser = {
                uid: `${demoRole}_test_uid`,
                email: `${demoRole}@kanvahati.internal`,
                displayName: `QA ${demoRole.toUpperCase()}`
            };
            setCurrentUser(mockUser);
            setUserRole(demoRole);
            setAuthLoading(false);
            return;
        }

        const unsubscribe = subscribeAuthState(({ user, role, isAuthenticated }) => {
            setCurrentUser(user);
            setUserRole(role);
            setAuthLoading(false);
            if (user && user.email) {
                // If cashier name not explicitly modified, set to user's display / email
                const emailPrefix = user.email.split('@')[0];
                const cleanPrefix = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
                const currentStored = localStorage.getItem('kanvahati_cashier');
                if (!currentStored || currentStored === "Kasir Peach 🌸") {
                    const defaultName = `Kasir ${cleanPrefix}`;
                    setActiveCashier(defaultName);
                    localStorage.setItem('kanvahati_cashier', defaultName);
                }
            }
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
                <div className="flex flex-col items-center gap-3">
                    <i className="fa-solid fa-spinner fa-spin text-3xl text-pink"></i>
                    <span className="font-title text-base font-bold">Memverifikasi sesi staf...</span>
                </div>
            </div>
        );
    }

    if (!currentUser) {
        return (
            <>
                <Login 
                    onLoginSuccess={(user, role) => {
                        setCurrentUser(user);
                        setUserRole(role);
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
            <MainRoutes 
                currentUser={currentUser}
                userRole={userRole}
                activeCashier={activeCashier}
                handleCashierChange={handleCashierChange}
                handleCheckoutSuccess={handleCheckoutSuccess}
                handleReprint={handleReprint}
                activeTransaction={activeTransaction}
                handleCloseReceipt={handleCloseReceipt}
                handlePrintReceipt={handlePrintReceipt}
                showToast={showToast}
            />

            {/* Toast Alerts */}
            <div className={`cute-toast fixed bottom-[25px] left-1/2 transform translate-x-[-50%] bg-yellow-light border-[3px] border-text rounded-full px-5 py-2.5 flex items-center gap-2.5 shadow-btn z-[10000] font-title text-[13.5px] font-bold pointer-events-none transition-transform duration-400 ${
                toast.show ? 'translate-y-0 opacity-100' : 'translate-y-[100px] opacity-0'
            }`}>
                <span className="toast-icon text-[15px]">{toast.icon}</span>
                <span className="toast-message text-text">{toast.message}</span>
            </div>
        </BrowserRouter>
    );
}
