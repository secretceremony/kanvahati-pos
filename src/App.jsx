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
const SuperAdminHub = React.lazy(() => import('./pages/SuperAdminHub'));

import Login from './pages/Login';
import ReceiptModal from './components/ReceiptModal';
import SystemBanner from './components/SystemBanner';
import { t } from './services/translations';
import { subscribeAuthState, logoutUser } from './services/auth';

function Sidebar({ userRole, activeCashier, onLogout, isOpen, onClose }) {
    const location = useLocation();
    const currentPath = location.pathname;
    const isSuperAdmin = userRole === 'super_admin';
    const canAccessArcade = userRole === 'admin' || isSuperAdmin || userRole === 'arcade_host';

    // Dropdown state for Laporan & Data
    const isReportPath = ['/riwayat', '/statistik', '/rekapan'].includes(currentPath);
    const [reportsOpen, setReportsOpen] = useState(isReportPath);

    useEffect(() => {
        if (isReportPath) setReportsOpen(true);
    }, [currentPath]);

    const linkStyle = (path, matchPrefix = false) => {
        const isActive = matchPrefix ? currentPath.startsWith(path) : currentPath === path;
        return `flex items-center gap-2.5 px-3.5 py-2 rounded-xl font-title text-[13px] font-bold border-2 transition-all cursor-pointer ${
            isActive
                ? 'bg-yellow text-text border-text shadow-[2px_2px_0px_#32628f] translate-x-1'
                : 'bg-white/80 text-text/80 border-transparent hover:bg-yellow-light/60 hover:border-text hover:text-text'
        }`;
    };

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div 
                    onClick={onClose} 
                    className="fixed inset-0 bg-text/40 backdrop-blur-sm z-40 lg:hidden"
                />
            )}

            <aside className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r-[3px] border-text shadow-[4px_0px_0px_#32628f] flex flex-col justify-between transition-transform duration-300 lg:translate-x-0 ${
                isOpen ? 'translate-x-0' : '-translate-x-full'
            }`}>
                {/* Brand & Canopy Banner */}
                <div>
                    <div className={`canopy-stripes h-3 border-b-[3px] border-text ${
                        isSuperAdmin
                            ? 'bg-[repeating-linear-gradient(90deg,#9333ea_0px,#9333ea_30px,var(--color-white)_30px,var(--color-white)_60px)]'
                            : 'bg-[repeating-linear-gradient(90deg,var(--color-pink)_0px,var(--color-pink)_30px,var(--color-white)_30px,var(--color-white)_60px)]'
                    }`}></div>
                    
                    <div className="p-4 border-b-2 border-text/10 flex items-center justify-between">
                        <Link to="/" onClick={onClose} className="flex-grow flex items-center justify-center py-1">
                            <img src="/kanvahati-logo.png" alt="Kanvahati Logo" className="h-11 object-contain" />
                        </Link>
                        {/* Close button on mobile */}
                        <button 
                            onClick={onClose}
                            className="lg:hidden p-1.5 text-text hover:text-pink text-sm cursor-pointer ml-2"
                        >
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    {/* Navigation Groups */}
                    <div className="p-3.5 space-y-4 overflow-y-auto max-h-[calc(100vh-170px)]">
                        {/* Kategori 1: Kasir & Penjualan */}
                        <div>
                            <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-text/50">
                                Kasir & Penjualan
                            </div>
                            <div className="space-y-1">
                                <Link to="/" onClick={onClose} className={linkStyle('/')}>
                                    <i className="fa-solid fa-calculator w-4 text-center"></i>
                                    <span>{t.terminal}</span>
                                </Link>
                                <Link to="/stok" onClick={onClose} className={linkStyle('/stok')}>
                                    <i className="fa-solid fa-boxes-stacked w-4 text-center"></i>
                                    <span>{t.inventory}</span>
                                </Link>
                                <Link to="/promo" onClick={onClose} className={linkStyle('/promo')}>
                                    <i className="fa-solid fa-tags w-4 text-center"></i>
                                    <span>{t.promo || "Promo"}</span>
                                </Link>
                            </div>
                        </div>

                        {/* Kategori 2: User & Kas */}
                        <div>
                            <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-text/50">
                                Akun & Keuangan
                            </div>
                            <div className="space-y-1">
                                <Link to="/kas" onClick={onClose} className={linkStyle('/kas')}>
                                    <i className="fa-solid fa-vault w-4 text-center"></i>
                                    <span>{t.cashDrawer || "Modal Kas"}</span>
                                </Link>
                            </div>
                        </div>

                        {/* Kategori 3: Laporan & Data (Dropdown) */}
                        <div>
                            <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-text/50">
                                Laporan & Data
                            </div>
                            <div className="space-y-1">
                                <button
                                    type="button"
                                    onClick={() => setReportsOpen(prev => !prev)}
                                    className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl font-title text-[13px] font-bold border-2 transition-all cursor-pointer ${
                                        isReportPath
                                            ? 'bg-yellow-light/60 border-text text-text'
                                            : 'bg-white/80 text-text/80 border-transparent hover:bg-yellow-light/40 hover:text-text'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <i className="fa-solid fa-folder-closed w-4 text-center"></i>
                                        <span>Laporan Penjualan</span>
                                    </div>
                                    <i className={`fa-solid fa-chevron-down text-xs transition-transform duration-200 ${reportsOpen ? 'rotate-180' : ''}`}></i>
                                </button>

                                {reportsOpen && (
                                    <div className="pl-4 pt-1 space-y-1 border-l-2 border-text/20 ml-3">
                                        <Link to="/riwayat" onClick={onClose} className={linkStyle('/riwayat')}>
                                            <i className="fa-solid fa-clock-rotate-left w-4 text-center"></i>
                                            <span>{t.logs}</span>
                                        </Link>
                                        <Link to="/statistik" onClick={onClose} className={linkStyle('/statistik')}>
                                            <i className="fa-solid fa-chart-line w-4 text-center"></i>
                                            <span>{t.stats}</span>
                                        </Link>
                                        <Link to="/rekapan" onClick={onClose} className={linkStyle('/rekapan')}>
                                            <i className="fa-solid fa-file-invoice-dollar w-4 text-center"></i>
                                            <span>{t.recap || "Rekapan"}</span>
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Kategori 4: Arcade Zone */}
                        {canAccessArcade && (
                            <div>
                                <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-text/50">
                                    Arcade Zone
                                </div>
                                <div className="space-y-1">
                                    <Link 
                                        to="/arcade/host" 
                                        onClick={onClose} 
                                        className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl font-title text-[13px] font-bold border-2 transition-all cursor-pointer ${
                                            currentPath === '/arcade/host'
                                                ? 'bg-pink text-text border-text shadow-[2px_2px_0px_#32628f] translate-x-1'
                                                : 'bg-white/80 text-text/80 border-transparent hover:bg-pink-light hover:border-text hover:text-text'
                                        }`}
                                    >
                                        <i className="fa-solid fa-gamepad w-4 text-center"></i>
                                        <span>Host Console</span>
                                    </Link>
                                    <Link 
                                        to="/arcade/questions" 
                                        onClick={onClose} 
                                        className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl font-title text-[13px] font-bold border-2 transition-all cursor-pointer ${
                                            currentPath === '/arcade/questions'
                                                ? 'bg-pink text-text border-text shadow-[2px_2px_0px_#32628f] translate-x-1'
                                                : 'bg-white/80 text-text/80 border-transparent hover:bg-pink-light hover:border-text hover:text-text'
                                        }`}
                                    >
                                        <i className="fa-solid fa-book-open w-4 text-center"></i>
                                        <span>Bank Soal</span>
                                    </Link>
                                </div>
                            </div>
                        )}

                        {/* Kategori 5: Super Admin Hub */}
                        {isSuperAdmin && (
                            <div>
                                <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-text/50">
                                    Super Admin
                                </div>
                                <div className="space-y-1">
                                    <Link 
                                        to="/admin" 
                                        onClick={onClose} 
                                        className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl font-title text-[13px] font-bold border-2 transition-all cursor-pointer shadow-[2px_2px_0px_#32628f] ${
                                            currentPath === '/admin'
                                                ? 'bg-purple-700 text-white border-text translate-x-1'
                                                : 'bg-purple-600 text-white border-text hover:bg-purple-700'
                                        }`}
                                    >
                                        <i className="fa-solid fa-shield-halved w-4 text-center"></i>
                                        <span>Admin Hub</span>
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Profile Footer */}
                <div className="p-3 pb-6 border-t-2 border-text/10 bg-yellow-light/20 flex items-center justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border border-text self-start leading-none mb-1 ${
                            isSuperAdmin ? 'bg-purple-200 text-purple-950 font-black' : 'bg-pink-light text-text'
                        }`}>
                            {isSuperAdmin ? '👑 SUPER ADMIN' : (userRole || 'KASIR')}
                        </span>
                        <span className="text-xs font-bold font-title text-text truncate">
                            {activeCashier}
                        </span>
                    </div>

                    <button
                        onClick={onLogout}
                        className="text-pink bg-white border-2 border-text rounded-full p-2 hover:bg-pink-light transition-all cursor-pointer text-xs shadow-[1.5px_1.5px_0px_#32628f] shrink-0"
                        title="Keluar / Logout"
                    >
                        <i className="fa-solid fa-right-from-bracket"></i>
                    </button>
                </div>
            </aside>
        </>
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

    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Dynamic Page Title mapping
    const getPageTitle = (pathname) => {
        switch (pathname) {
            case '/': return 'Kasir';
            case '/stok': return 'Stok Barang';
            case '/promo': return 'Promo Bundle';
            case '/kas': return 'Akun Kasir';
            case '/riwayat': return 'Riwayat Transaksi';
            case '/statistik': return 'Statistik';
            case '/rekapan': return 'Rekapan Penjualan';
            case '/arcade/host': return 'Arcade Host';
            case '/arcade/questions': return 'Bank Soal';
            case '/admin': return 'Admin Hub';
            default:
                if (pathname.startsWith('/riwayat')) return 'Riwayat Transaksi';
                if (pathname.startsWith('/arcade/questions')) return 'Bank Soal';
                if (pathname.startsWith('/arcade')) return 'Arcade Host';
                return 'Kasir';
        }
    };

    const pageTitle = getPageTitle(location.pathname);

    return (
        <div className="pos-app-layout min-h-screen bg-blue-light/10 flex">
            {/* Sidebar Navigation */}
            <Sidebar 
                userRole={userRole} 
                activeCashier={activeCashier} 
                onLogout={async () => {
                    if (window.confirm("Apakah Anda yakin ingin logout?")) {
                        await logoutUser();
                        showToast("Sesi telah ditutup. Anda telah keluar.", "🔒");
                    }
                }}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            {/* Main Content Container with left margin on Desktop */}
            <div className="flex-1 flex flex-col min-h-screen w-full lg:pl-64">
                <div className="pos-container max-w-[1350px] w-full mx-auto px-3 sm:px-6 my-4 sm:my-5 flex flex-col flex-grow h-auto pb-12">
                    <SystemBanner />
                    
                    {/* Top Bar on Mobile & Desktop */}
                    <header className="pos-header bg-white border-[3px] border-text rounded-[20px] shadow-card mb-5 overflow-hidden shrink-0">
                        <div className={`canopy-stripes h-2.5 border-b-[3px] border-text ${
                            userRole === 'super_admin'
                                ? 'bg-[repeating-linear-gradient(90deg,#9333ea_0px,#9333ea_30px,var(--color-white)_30px,var(--color-white)_60px)]'
                                : 'bg-[repeating-linear-gradient(90deg,var(--color-pink)_0px,var(--color-pink)_30px,var(--color-white)_30px,var(--color-white)_60px)]'
                        }`}></div>

                        <div className="header-content flex justify-between items-center px-3 sm:px-4 py-2 sm:py-2.5 gap-2">
                            {/* Left: Mobile hamburger & Dynamic Page Title */}
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                <button
                                    onClick={() => setSidebarOpen(true)}
                                    className="lg:hidden p-1.5 sm:p-2 rounded-xl border-2 border-text bg-yellow text-text shadow-[2px_2px_0px_#32628f] hover:bg-yellow-light cursor-pointer text-xs sm:text-sm shrink-0"
                                    title="Buka Menu"
                                >
                                    <i className="fa-solid fa-bars"></i>
                                </button>

                                {/* Dynamic Page Title in Theme font-title (DynaPuff) */}
                                <h2 className="font-title text-sm sm:text-lg font-bold text-text tracking-wide title-stroke truncate">
                                    {pageTitle}
                                </h2>
                            </div>

                            {/* Right: User Badge & Role (Positioned to the right of Page Title) */}
                            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                                <span className={`badge-role border-2 border-text rounded-full px-2 sm:px-2.5 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                                    userRole === 'super_admin' ? 'bg-purple-200 text-purple-950 font-black' : 'bg-pink-light text-text'
                                }`}>
                                    <span className="inline sm:hidden">{userRole === 'super_admin' ? '👑 ADMIN' : (userRole || 'KASIR')}</span>
                                    <span className="hidden sm:inline">{userRole === 'super_admin' ? '👑 SUPER ADMIN' : (userRole || 'KASIR')}</span>
                                </span>
                                
                                <div className="flex items-center gap-1 sm:gap-2 border-2 border-text rounded-full px-2 sm:px-3 py-0.5 bg-yellow-light/30 text-text shrink-0">
                                    <span className="hidden sm:inline font-body text-[10px] font-bold opacity-70 uppercase">User:</span>
                                    <span className="font-title text-[10.5px] sm:text-[11.5px] font-bold truncate max-w-[90px] sm:max-w-none">{activeCashier}</span>
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* Content Tabs Body */}
                    <main className="pos-body flex-grow overflow-visible relative pb-8">
                        <React.Suspense fallback={<div className="text-center py-12 font-bold text-text/60">Memuat Halaman...</div>}>
                            <Routes>
                                <Route path="/" element={<Register onCheckoutSuccess={handleCheckoutSuccess} showToast={showToast} activeCashier={activeCashier} />} />
                                <Route path="/kas" element={<CashDrawer showToast={showToast} activeCashier={activeCashier} onCashierChange={handleCashierChange} currentUser={currentUser} userRole={userRole} />} />
                                <Route path="/riwayat" element={<Logs onReprint={handleReprint} showToast={showToast} currentUser={currentUser} userRole={userRole} />} />
                                <Route path="/statistik" element={<Stats />} />
                                <Route path="/stok" element={<Inventory showToast={showToast} currentUser={currentUser} userRole={userRole} />} />
                                <Route path="/promo" element={<Bundles showToast={showToast} currentUser={currentUser} userRole={userRole} />} />
                                <Route path="/rekapan" element={<Rekapan showToast={showToast} />} />
                                <Route path="/arcade/host" element={<HostConsole currentUser={currentUser} userRole={userRole} showToast={showToast} />} />
                                <Route path="/arcade/questions" element={<QuestionBankManager currentUser={currentUser} userRole={userRole} showToast={showToast} />} />
                                <Route path="/admin" element={
                                    userRole === 'super_admin' ? (
                                        <SuperAdminHub currentUser={currentUser} userRole={userRole} showToast={showToast} />
                                    ) : (
                                        <Navigate to="/" replace />
                                    )
                                } />
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
            </div>
        </div>
    );
}

export default function App() {
    const [activeTransaction, setActiveTransaction] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', icon: '✨' });
    // Firebase Auth State
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [activeCashier, setActiveCashier] = useState('User');
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
            setActiveCashier(mockUser.displayName);
            setAuthLoading(false);
            return;
        }

        const unsubscribe = subscribeAuthState(({ user, role, displayName, isAuthenticated }) => {
            setCurrentUser(user);
            setUserRole(role);
            if (displayName) {
                setActiveCashier(displayName);
            }
            setAuthLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleCashierChange = (newName) => {
        if (newName && newName.trim()) {
            const formatted = newName.trim().replace(/^Kasir\s+/i, '');
            setActiveCashier(formatted);
            showToast(`User diubah ke ${formatted}`, "🌸");
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
