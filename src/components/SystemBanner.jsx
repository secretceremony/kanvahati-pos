import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { APP_VERSION } from '../config';
import { isUsingFirebase, syncQueuedTransactions } from '../services/db';

export default function SystemBanner() {
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const [pendingSyncCount, setPendingSyncCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [dataUpdateAvailable, setDataUpdateAvailable] = useState(false);
    const [versionUpdateAvailable, setVersionUpdateAvailable] = useState(false);
    const [announcement, setAnnouncement] = useState("");
    const [initialLoadTime] = useState(Date.now());

    useEffect(() => {
        const updateNetworkStatus = async () => {
            const online = navigator.onLine;
            setIsOnline(online);
            if (online) {
                const res = await syncQueuedTransactions();
                setPendingSyncCount(res.remaining);
            }
        };

        const checkQueue = () => {
            const rawQueue = localStorage.getItem('kanvahati_pos_pending_transactions_queue');
            if (rawQueue) {
                try {
                    const parsed = JSON.parse(rawQueue);
                    setPendingSyncCount(Array.isArray(parsed) ? parsed.length : 0);
                } catch {
                    setPendingSyncCount(0);
                }
            } else {
                setPendingSyncCount(0);
            }
        };

        checkQueue();
        window.addEventListener('online', updateNetworkStatus);
        window.addEventListener('offline', updateNetworkStatus);

        const interval = setInterval(async () => {
            checkQueue();
            if (navigator.onLine) {
                await syncQueuedTransactions();
                checkQueue();
            }
        }, 15000);

        return () => {
            window.removeEventListener('online', updateNetworkStatus);
            window.removeEventListener('offline', updateNetworkStatus);
            clearInterval(interval);
        };
    }, []);

    const handleManualSync = async () => {
        setIsSyncing(true);
        try {
            const res = await syncQueuedTransactions();
            setPendingSyncCount(res.remaining);
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        if (!isUsingFirebase()) return;

        const unsubscribe = onSnapshot(doc(db, "system", "config"), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();

                // 1. Check for data updates (products, bundles, etc)
                if (data.lastDataUpdate && data.lastDataUpdate > initialLoadTime) {
                    setDataUpdateAvailable(true);
                }

                // 2. Check for App Version updates
                if (data.appVersion) {
                    // Semver comparison
                    const isNewer = (v1, v2) => {
                        const a = v1.split('.').map(Number);
                        const b = v2.split('.').map(Number);
                        for (let i = 0; i < Math.max(a.length, b.length); i++) {
                            if ((a[i] || 0) > (b[i] || 0)) return true;
                            if ((a[i] || 0) < (b[i] || 0)) return false;
                        }
                        return false;
                    };

                    if (isNewer(APP_VERSION, data.appVersion)) {
                        // This client is running a NEWER version (just deployed). Update Firestore!
                        setDoc(doc(db, "system", "config"), { appVersion: APP_VERSION }, { merge: true });
                    } else if (isNewer(data.appVersion, APP_VERSION)) {
                        // This client is running an OLDER version. Show banner!
                        setVersionUpdateAvailable(true);
                    }
                } else {
                    // First time initialization
                    setDoc(doc(db, "system", "config"), { appVersion: APP_VERSION }, { merge: true });
                }

                // 3. System Announcement
                if (data.announcement) {
                    setAnnouncement(data.announcement);
                } else {
                    setAnnouncement("");
                }
            }
        });

        return () => unsubscribe();
    }, [initialLoadTime]);

    const handleReload = () => {
        window.location.reload();
    };

    if (!dataUpdateAvailable && !versionUpdateAvailable && !announcement && isOnline && pendingSyncCount === 0) return null;

    return (
        <div className="w-full relative z-[1000]">
            {!isOnline && (
                <div className="bg-[#ff477e] text-white border-b-2 border-text text-center py-2 px-4 text-xs sm:text-sm font-bold flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <i className="fa-solid fa-wifi-slash"></i>
                        <span>Mode Offline: Transaksi tersimpan lokal dan akan disinkronkan saat terhubung kembali.</span>
                    </div>
                    {pendingSyncCount > 0 && (
                        <span className="bg-white text-text px-2 py-0.5 rounded-full text-[11px] font-black">
                            {pendingSyncCount} transaksi tertunda
                        </span>
                    )}
                </div>
            )}

            {isOnline && pendingSyncCount > 0 && (
                <div className="bg-yellow-light border-b-2 border-text text-text py-2 px-4 flex justify-between items-center text-xs sm:text-sm font-bold">
                    <div className="flex items-center gap-2">
                        <i className="fa-solid fa-cloud-arrow-up text-pink"></i>
                        <span>Ada {pendingSyncCount} transaksi offline yang belum sinkron ke cloud.</span>
                    </div>
                    <button
                        onClick={handleManualSync}
                        disabled={isSyncing}
                        className="bg-white border-2 border-text text-xs font-bold px-3 py-1 rounded-full shadow-[2px_2px_0px_#181818] hover:translate-y-[-1px] transition-all cursor-pointer flex items-center gap-1.5"
                    >
                        {isSyncing ? (
                            <>
                                <i className="fa-solid fa-spinner fa-spin"></i> Menyinkronkan...
                            </>
                        ) : (
                            <>
                                <i className="fa-solid fa-rotate"></i> Sinkron Sekarang
                            </>
                        )}
                    </button>
                </div>
            )}

            {announcement && (
                <div className="bg-text text-white text-center py-2 px-4 text-sm font-bold flex items-center justify-center gap-2">
                    <i className="fa-solid fa-bullhorn"></i> {announcement}
                </div>
            )}
            
            {versionUpdateAvailable && (
                <div className="bg-yellow border-b-[3px] border-text text-text py-2 px-4 flex justify-between items-center animate-[ticketSlide_0.3s_ease-out]">
                    <div className="flex items-center gap-2 font-bold text-sm">
                        <i className="fa-solid fa-rocket"></i> Versi aplikasi baru tersedia!
                    </div>
                    <button 
                        onClick={handleReload}
                        className="bg-white border-2 border-text text-xs font-bold px-3 py-1 rounded-full shadow-[2px_2px_0px_#181818] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#181818] transition-all cursor-pointer"
                    >
                        Refresh Halaman
                    </button>
                </div>
            )}

            {dataUpdateAvailable && !versionUpdateAvailable && (
                <div className="bg-blue-light border-b-[3px] border-text text-text py-2 px-4 flex justify-between items-center animate-[ticketSlide_0.3s_ease-out]">
                    <div className="flex items-center gap-2 font-bold text-sm">
                        <i className="fa-solid fa-rotate"></i> Data produk/promo terbaru tersedia.
                    </div>
                    <button 
                        onClick={handleReload}
                        className="bg-white border-2 border-text text-xs font-bold px-3 py-1 rounded-full shadow-[2px_2px_0px_#181818] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#181818] transition-all cursor-pointer flex items-center gap-1.5"
                    >
                        <i className="fa-solid fa-cloud-arrow-down"></i> Muat Ulang
                    </button>
                </div>
            )}
        </div>
    );
}
