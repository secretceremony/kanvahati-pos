import React, { useState, useEffect } from 'react';
import { fetchAuditLogs } from '../services/audit';
import { fetchAllStaffRoles, assignStaffRole, removeStaffRole, seedDesignatedStaff, registerAuthUser } from '../services/staffRoles';

export default function SuperAdminHub({ currentUser, userRole, showToast }) {
    const [activeTab, setActiveTab] = useState('staff'); // 'staff' | 'audit'
    
    // Staff roles state
    const [staffList, setStaffList] = useState([]);
    const [staffLoading, setStaffLoading] = useState(true);
    const [staffForm, setStaffForm] = useState({ uid: '', email: '', displayName: '', role: 'cashier', password: '' });
    const [isEditingStaff, setIsEditingStaff] = useState(false);

    // Audit logs state
    const [auditLogs, setAuditLogs] = useState([]);
    const [auditLoading, setAuditLoading] = useState(true);
    const [auditFilter, setAuditFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    const loadStaff = async () => {
        setStaffLoading(true);
        try {
            const list = await fetchAllStaffRoles();
            setStaffList(list);
        } catch (e) {
            console.error(e);
            showToast("Gagal memuat daftar staf", "⚠️");
        } finally {
            setStaffLoading(false);
        }
    };

    const loadAudit = async () => {
        setAuditLoading(true);
        try {
            const logs = await fetchAuditLogs(150);
            setAuditLogs(logs);
        } catch (e) {
            console.error(e);
            showToast("Gagal memuat log audit", "⚠️");
        } finally {
            setAuditLoading(false);
        }
    };

    useEffect(() => {
        loadStaff();
        loadAudit();
    }, []);

    const handleSaveStaff = async (e) => {
        e.preventDefault();
        if (!staffForm.email.trim()) {
            showToast("Email staf wajib diisi!", "⚠️");
            return;
        }

        try {
            let authUid = null;
            if (staffForm.password && staffForm.password.trim()) {
                try {
                    authUid = await registerAuthUser(staffForm.email, staffForm.password);
                } catch (authErr) {
                    showToast(`Peringatan Auth: ${authErr.message}`, "⚠️");
                }
            }

            // Target UID from Auth or email-safe fallback
            const targetUid = staffForm.uid.trim() || authUid || `staff_${staffForm.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
            await assignStaffRole({
                uid: targetUid,
                email: staffForm.email,
                displayName: staffForm.displayName,
                role: staffForm.role,
                actor: {
                    uid: currentUser?.uid,
                    email: currentUser?.email,
                    displayName: currentUser?.displayName || 'Super Admin',
                    role: userRole
                }
            });

            showToast(`Akun & peran ${staffForm.displayName || staffForm.email} berhasil disimpan!`, "✨");
            setStaffForm({ uid: '', email: '', displayName: '', role: 'cashier', password: '' });
            setIsEditingStaff(false);
            loadStaff();
            loadAudit();
        } catch (err) {
            console.error(err);
            showToast("Gagal menyimpan akun staf", "⚠️");
        }
    };

    const handleDeleteStaff = async (staff) => {
        if (window.confirm(`Cabut akses staf ${staff.displayName || staff.email}?`)) {
            try {
                await removeStaffRole(staff.uid, staff.email, {
                    uid: currentUser?.uid,
                    email: currentUser?.email,
                    displayName: currentUser?.displayName || 'Super Admin',
                    role: userRole
                });
                showToast(`Akses ${staff.email} berhasil dicabut`, "🗑️");
                loadStaff();
                loadAudit();
            } catch (err) {
                console.error(err);
                showToast("Gagal mencabut akses staf", "⚠️");
            }
        }
    };

    const filteredAuditLogs = auditLogs.filter(log => {
        const matchesType = auditFilter === 'ALL' || log.action === auditFilter;
        const matchesSearch = !searchQuery.trim() || 
            (log.summary && log.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (log.actor?.email && log.actor.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (log.actor?.displayName && log.actor.displayName.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesType && matchesSearch;
    });

    const getActionBadgeColor = (action) => {
        switch (action) {
            case 'PRICE_CHANGE': return 'bg-yellow-light text-text border-text';
            case 'DISCOUNT_CHANGE': return 'bg-pink-light text-text border-text';
            case 'ITEM_ADD': return 'bg-blue-light text-text border-text';
            case 'ITEM_DELETE': return 'bg-rose-200 text-text border-text';
            case 'TRANSACTION_DELETE': return 'bg-rose-300 text-text border-text font-black';
            case 'ROLE_CHANGE': return 'bg-yellow text-text border-text';
            case 'ROLE_DELETE': return 'bg-rose-200 text-text border-text';
            default: return 'bg-white text-text border-text';
        }
    };

    return (
        <div className="superadmin-hub-layout w-full h-auto flex flex-col gap-5 font-body text-text pb-10">
            {/* Top Bar: Title & Navigation Tabs */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border-[3px] border-text rounded-2xl shadow-card p-4 sm:px-6 relative shrink-0">
                <div className="washi-tape tape-yellow-1 absolute top-[-10px] left-10 transform rotate-[-2deg] h-5 w-24 bg-yellow-light border-l border-r border-dashed border-text/25"></div>

                <div>
                    <h3 className="font-title text-xl text-text title-stroke flex items-center gap-2">
                        <i className="fa-solid fa-shield-halved text-pink"></i> Kontrol Kredensial & Audit
                    </h3>
                    <p className="text-xs opacity-75 mt-0.5">
                        Kelola akun resmi tim dan pantau jejak perubahan harga, promo, serta transaksi.
                    </p>
                </div>
                
                {/* Hub Navigation Tabs */}
                <div className="flex gap-2 bg-yellow-light/40 border-2 border-text p-1.5 rounded-full font-title text-xs shrink-0">
                    <button
                        type="button"
                        onClick={() => setActiveTab('staff')}
                        className={`px-4 py-1.5 rounded-full cursor-pointer transition-all ${
                            activeTab === 'staff' 
                                ? 'bg-yellow text-text border-2 border-text shadow-[2px_2px_0px_#32628f]' 
                                : 'text-text hover:bg-white border-2 border-transparent'
                        }`}
                    >
                        <i className="fa-solid fa-users-gear mr-1"></i> Manajemen Staf ({staffList.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('audit')}
                        className={`px-4 py-1.5 rounded-full cursor-pointer transition-all ${
                            activeTab === 'audit' 
                                ? 'bg-yellow text-text border-2 border-text shadow-[2px_2px_0px_#32628f]' 
                                : 'text-text hover:bg-white border-2 border-transparent'
                        }`}
                    >
                        <i className="fa-solid fa-receipt mr-1"></i> Jejak Audit ({auditLogs.length})
                    </button>
                </div>
            </div>

            {/* TAB 1: MANAJEMEN STAF (GRID 1:2 SEJAJAR SEPERTI HALAMAN STOK & KAS) */}
            {activeTab === 'staff' && (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-5 items-start">
                    {/* Form Input Staf */}
                    <div className="bg-yellow-light border-[3px] border-text rounded-2xl p-5 shadow-card relative shrink-0">
                        <div className="washi-tape tape-history absolute top-[-10px] left-8 transform rotate-[-2deg] h-5 w-20 border-l border-r border-dashed border-text/25 bg-pink-light"></div>

                        <h4 className="font-title text-base mb-3 flex items-center gap-2 title-stroke text-text">
                            <i className="fa-solid fa-user-plus"></i>
                            {isEditingStaff ? 'Edit Kredensial Staf' : 'Tambah / Konfigurasi Akun'}
                        </h4>
                        <form onSubmit={handleSaveStaff} className="flex flex-col gap-3 font-body">
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1">Email Kredensial *</label>
                                <input 
                                    type="email" 
                                    value={staffForm.email} 
                                    onChange={(e) => setStaffForm(prev => ({ ...prev, email: e.target.value }))}
                                    placeholder="nama@kanvahati.internal" 
                                    className="w-full bg-white border-2 border-text rounded-xl px-3 py-2 text-sm focus:outline-none focus:bg-yellow-light/30"
                                    required
                                    disabled={isEditingStaff}
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1">Nama Pengguna (Tampil di POS) *</label>
                                <input 
                                    type="text" 
                                    value={staffForm.displayName} 
                                    onChange={(e) => setStaffForm(prev => ({ ...prev, displayName: e.target.value }))}
                                    placeholder="Misal: Tenma / Jun / Shu" 
                                    className="w-full bg-white border-2 border-text rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:bg-yellow-light/30"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1">Peran Akses (Role) *</label>
                                <select 
                                    value={staffForm.role}
                                    onChange={(e) => setStaffForm(prev => ({ ...prev, role: e.target.value }))}
                                    className="w-full bg-white border-2 border-text rounded-xl px-3 py-2 text-sm font-bold cursor-pointer focus:outline-none"
                                >
                                    <option value="super_admin">👑 Super Admin (Full Control + Hapus Tx)</option>
                                    <option value="admin">💼 Admin Kasir (POS, Stok, Promo, Rekapan)</option>
                                    <option value="cashier">🌸 Kasir (Terminal POS Saja)</option>
                                    <option value="arcade_host">🎮 Arcade Host (Stasiun Game & Soal)</option>
                                    <option value="arcade_display">📺 Arcade Display (Layar Kiosk)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1">
                                    {isEditingStaff ? 'Setel Ulang Password (Opsional)' : 'Password Akun Baru (Min. 6 Karakter)'}
                                </label>
                                <input 
                                    type="password" 
                                    value={staffForm.password || ''} 
                                    onChange={(e) => setStaffForm(prev => ({ ...prev, password: e.target.value }))}
                                    placeholder={isEditingStaff ? "Kosongkan jika tidak diubah" : "Contoh: kanvahati123"} 
                                    className="w-full bg-white border-2 border-text rounded-xl px-3 py-2 text-sm focus:outline-none focus:bg-yellow-light/30"
                                />
                            </div>
                            <div className="flex gap-2 mt-2">
                                <button
                                    type="submit"
                                    className="btn flex-1 bg-pink text-text border-[3px] border-text rounded-full font-title text-xs py-2.5 px-4 shadow-btn hover:bg-white hover:translate-y-[-2px] active:translate-y-[1px] cursor-pointer transition-all flex items-center justify-center gap-1.5 font-bold"
                                >
                                    <i className="fa-solid fa-floppy-disk"></i>
                                    {isEditingStaff ? 'Perbarui Peran' : 'Simpan Kredensial'}
                                </button>
                                {isEditingStaff && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsEditingStaff(false);
                                            setStaffForm({ uid: '', email: '', displayName: '', role: 'cashier' });
                                        }}
                                        className="btn bg-white text-text border-[3px] border-text rounded-full font-title text-xs py-2.5 px-3 hover:bg-yellow-light active:translate-y-[1px] cursor-pointer transition-all"
                                    >
                                        Batal
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* Daftar Akun Terdaftar */}
                    <div className="border-[3px] border-text rounded-2xl overflow-hidden shadow-card bg-white">
                        <div className="bg-blue-light border-b-2 border-text p-3 sm:px-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <span className="font-title text-sm font-bold text-text title-stroke">Daftar Akun Tim Resmi</span>
                            <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
                                <button 
                                    onClick={async () => {
                                        setStaffLoading(true);
                                        await seedDesignatedStaff({
                                            uid: currentUser?.uid,
                                            email: currentUser?.email,
                                            displayName: currentUser?.displayName || 'Super Admin',
                                            role: userRole
                                        });
                                        await loadStaff();
                                        showToast("Kredensial tim resmi berhasil disinkronkan!", "🌱");
                                    }} 
                                    className="text-[11px] sm:text-xs bg-white border-2 border-text px-2.5 py-1 rounded-full font-title font-bold text-text hover:bg-yellow shadow-[1.5px_1.5px_0px_#32628f] cursor-pointer transition-all flex items-center"
                                    title="Sinkronkan akun bawaan"
                                >
                                    <i className="fa-solid fa-seedling mr-1 text-green-600"></i> Sinkron Bawaan
                                </button>
                                <button 
                                    onClick={loadStaff} 
                                    className="text-[11px] sm:text-xs bg-white border-2 border-text px-2.5 py-1 rounded-full font-title font-bold text-text hover:bg-yellow shadow-[1.5px_1.5px_0px_#32628f] cursor-pointer transition-all flex items-center"
                                >
                                    <i className="fa-solid fa-arrows-rotate mr-1"></i> Segarkan
                                </button>
                            </div>
                        </div>
                        <div className="max-h-[550px] overflow-y-auto p-3 sm:p-0">
                            {staffLoading ? (
                                <div className="text-center py-10 font-bold text-text/60 font-body">Memuat peran staf...</div>
                            ) : staffList.length === 0 ? (
                                <div className="text-center py-10 text-text/60 font-bold font-body">Belum ada akun di koleksi staff_roles.</div>
                            ) : (
                                <>
                                    {/* 1. Mobile Card List (< lg) */}
                                    <div className="block lg:hidden space-y-2.5">
                                        {staffList.map(st => (
                                            <div key={st.uid || st.email} className="bg-yellow-light/20 border-2 border-text rounded-xl p-3 shadow-[1.5px_1.5px_0px_#32628f] flex flex-col gap-2">
                                                <div className="flex justify-between items-start gap-2">
                                                    <div>
                                                        <div className="font-bold font-title text-sm flex items-center gap-1.5">
                                                            <i className={`fa-solid ${
                                                                st.role === 'super_admin' ? 'fa-crown text-yellow-500' :
                                                                st.role === 'admin' ? 'fa-user-tie text-blue-500' :
                                                                st.role?.includes('arcade') ? 'fa-gamepad text-green-500' :
                                                                'fa-user text-text/60'
                                                            }`}></i>
                                                            {st.displayName || '-'}
                                                        </div>
                                                        <div className="font-mono text-xs opacity-75 mt-0.5 break-all">{st.email}</div>
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded-full font-bold border-2 border-text uppercase tracking-wider text-[9px] font-title shrink-0 ${
                                                        st.role === 'super_admin' ? 'bg-purple-200 text-purple-950 font-black' :
                                                        st.role === 'admin' ? 'bg-blue-light text-text' :
                                                        st.role?.includes('arcade') ? 'bg-pink-light text-text' :
                                                        'bg-yellow-light text-text'
                                                    }`}>
                                                        {st.role}
                                                    </span>
                                                </div>

                                                <div className="flex justify-end gap-2 pt-1 border-t border-dashed border-text/15">
                                                    <button
                                                        onClick={() => {
                                                            setIsEditingStaff(true);
                                                            setStaffForm({
                                                                uid: st.uid || '',
                                                                email: st.email || '',
                                                                displayName: st.displayName || '',
                                                                role: st.role || 'cashier'
                                                            });
                                                        }}
                                                        className="btn flex-1 bg-white border-2 border-text rounded-full py-1 text-xs font-bold font-title shadow-[1px_1px_0px_#32628f] flex items-center justify-center gap-1"
                                                    >
                                                        <i className="fa-solid fa-pen"></i> Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteStaff(st)}
                                                        className="btn bg-white border-2 border-text rounded-full px-3 py-1 text-xs font-bold font-title text-rose-700 shadow-[1px_1px_0px_#32628f] flex items-center justify-center gap-1"
                                                    >
                                                        <i className="fa-solid fa-trash"></i> Hapus
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* 2. Desktop Table (>= lg) */}
                                    <div className="hidden lg:block overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-[13px] font-body">
                                            <thead>
                                                <tr className="bg-yellow-light/40 border-b-2 border-text font-title font-bold text-xs">
                                                    <th className="p-3">Pengguna</th>
                                                    <th className="p-3">Email</th>
                                                    <th className="p-3">Peran (Role)</th>
                                                    <th className="p-3 text-right">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-text/10">
                                                {staffList.map(st => (
                                                    <tr key={st.uid || st.email} className="hover:bg-yellow-light/30 transition-colors">
                                                        <td className="p-3 font-bold font-title flex items-center gap-2">
                                                            <i className={`fa-solid ${
                                                                st.role === 'super_admin' ? 'fa-crown text-yellow-500' :
                                                                st.role === 'admin' ? 'fa-user-tie text-blue-500' :
                                                                st.role?.includes('arcade') ? 'fa-gamepad text-green-500' :
                                                                'fa-user text-text/60'
                                                            }`}></i>
                                                            {st.displayName || '-'}
                                                        </td>
                                                        <td className="p-3 font-mono text-xs">{st.email}</td>
                                                        <td className="p-3">
                                                            <span className={`px-2.5 py-0.5 rounded-full font-bold border-2 border-text uppercase tracking-wider text-[10px] font-title ${
                                                                st.role === 'super_admin' ? 'bg-purple-200 text-purple-950 font-black' :
                                                                st.role === 'admin' ? 'bg-blue-light text-text' :
                                                                st.role?.includes('arcade') ? 'bg-pink-light text-text' :
                                                                'bg-yellow-light text-text'
                                                            }`}>
                                                                {st.role}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            <div className="flex justify-end gap-1.5">
                                                                <button
                                                                    onClick={() => {
                                                                        setIsEditingStaff(true);
                                                                        setStaffForm({
                                                                            uid: st.uid || '',
                                                                            email: st.email || '',
                                                                            displayName: st.displayName || '',
                                                                            role: st.role || 'cashier',
                                                                            password: ''
                                                                        });
                                                                    }}
                                                                    className="btn px-2.5 py-1 bg-white border-2 border-text rounded-full hover:bg-yellow-light text-text cursor-pointer shadow-[1.5px_1.5px_0px_#32628f] text-xs font-title"
                                                                    title="Edit peran & password"
                                                                >
                                                                    <i className="fa-solid fa-pen"></i>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteStaff(st)}
                                                                    className="btn px-2.5 py-1 bg-white border-2 border-text rounded-full hover:bg-rose-200 text-rose-700 cursor-pointer shadow-[1.5px_1.5px_0px_#32628f] text-xs font-title"
                                                                    title="Cabut akses"
                                                                >
                                                                    <i className="fa-solid fa-trash"></i>
                                                                </button>
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
            )}

            {/* TAB 2: JEJAK AUDIT (AUDIT TRAIL) */}
            {activeTab === 'audit' && (
                <div className="flex flex-col gap-4">
                    {/* Filter & Search Bar */}
                    <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-yellow-light border-[3px] border-text p-3.5 rounded-2xl shadow-card">
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                            <span className="text-xs font-bold uppercase tracking-wider text-text/70 font-title">Filter:</span>
                            {['ALL', 'PRICE_CHANGE', 'DISCOUNT_CHANGE', 'ITEM_ADD', 'ITEM_DELETE', 'TRANSACTION_DELETE', 'ROLE_CHANGE'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => setAuditFilter(type)}
                                    className={`px-3 py-1 rounded-full text-xs font-title font-bold border-2 border-text cursor-pointer transition-all shrink-0 ${
                                        auditFilter === type 
                                            ? 'bg-pink text-text shadow-[2px_2px_0px_#32628f]' 
                                            : 'bg-white text-text hover:bg-yellow-light'
                                    }`}
                                >
                                    {type === 'ALL' ? 'Semua' : type}
                                </button>
                            ))}
                        </div>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Cari nama / email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-white border-2 border-text rounded-full pl-8 pr-4 py-1.5 text-xs w-full md:w-60 font-body focus:outline-none focus:bg-yellow-light/30"
                            />
                            <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-text/40 text-xs"></i>
                        </div>
                    </div>

                    {/* Feed List */}
                    <div className="border-[3px] border-text rounded-2xl overflow-hidden shadow-card bg-white">
                        {auditLoading ? (
                            <div className="text-center py-12 font-bold text-text/60 font-body">Memuat log audit...</div>
                        ) : filteredAuditLogs.length === 0 ? (
                            <div className="text-center py-12 text-text/50 font-bold font-body">
                                Tidak ada log audit yang sesuai kriteria.
                            </div>
                        ) : (
                            <div className="divide-y divide-text/15 max-h-[600px] overflow-y-auto">
                                {filteredAuditLogs.map((log, index) => (
                                    <div key={log.id || index} className="p-4 hover:bg-yellow-light/20 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs transition-colors font-body">
                                        <div className="flex items-start gap-3 flex-1">
                                            <span className={`px-2.5 py-1 rounded-full border-2 text-[10px] font-title font-bold shrink-0 uppercase shadow-[1px_1px_0px_#32628f] ${getActionBadgeColor(log.action)}`}>
                                                {log.action}
                                            </span>
                                            <div>
                                                <p className="font-bold text-text text-sm font-title leading-snug">{log.summary}</p>
                                                <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-text/75">
                                                    <span>
                                                        <i className="fa-solid fa-user mr-1 opacity-70"></i>
                                                        <strong>{log.actor?.displayName || 'Staf'}</strong> ({log.actor?.email})
                                                    </span>
                                                    <span>
                                                        <i className="fa-solid fa-tag mr-1 opacity-70"></i>
                                                        Role: <span className="font-title uppercase font-bold text-pink">{log.actor?.role}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right text-text/60 font-mono text-[11px] shrink-0">
                                            <i className="fa-regular fa-clock mr-1"></i>
                                            {log.timestamp ? new Date(log.timestamp).toLocaleString('id-ID') : '-'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
