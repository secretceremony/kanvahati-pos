import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { APP_VERSION } from '../config';
import { isUsingFirebase } from '../services/db';

export default function SystemBanner() {
    const [dataUpdateAvailable, setDataUpdateAvailable] = useState(false);
    const [versionUpdateAvailable, setVersionUpdateAvailable] = useState(false);
    const [announcement, setAnnouncement] = useState("");
    const [initialLoadTime] = useState(Date.now());

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

    if (!dataUpdateAvailable && !versionUpdateAvailable && !announcement) return null;

    return (
        <div className="w-full relative z-[1000]">
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
                        className="bg-white border-2 border-text text-xs font-bold px-3 py-1 rounded-full shadow-[2px_2px_0px_#32628f] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#32628f] transition-all cursor-pointer"
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
                        className="bg-white border-2 border-text text-xs font-bold px-3 py-1 rounded-full shadow-[2px_2px_0px_#32628f] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#32628f] transition-all cursor-pointer flex items-center gap-1.5"
                    >
                        <i className="fa-solid fa-cloud-arrow-down"></i> Muat Ulang
                    </button>
                </div>
            )}
        </div>
    );
}
