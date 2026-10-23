import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GAME_DEFINITIONS } from '../data/gameConfig.js';
import { 
    getAllQuestionsAdmin, 
    getQuestionSecret, 
    saveQuestion, 
    toggleQuestionStatus 
} from '../services/arcadeDb.js';

export default function QuestionBankManager({ currentUser, userRole, showToast }) {
    const [selectedGameFilter, setSelectedGameFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'active' | 'inactive'
    const [questions, setQuestions] = useState([]);
    const [secretsMap, setSecretsMap] = useState({});
    const [loading, setLoading] = useState(true);

    // Modal state for Add / Edit
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingQuestionId, setEditingQuestionId] = useState(null);
    const [formData, setFormData] = useState({
        id: '',
        gameId: 'G01',
        displayPrompt: '',
        targetCount: 10,
        rulesDetail: '',
        status: 'active',
        // Specific fields
        trait: '',
        mediaUrl: '',
        revealedMediaUrl: '',
        letter: '',
        cardReferenceCode: '',
        characterName: '',
        phrasePrompt: '',
        options: ['', '', '', '', ''],
        // Secret fields
        answerKey: '',
        alternativeAnswers: '',
        referenceAnswers: '',
        verificationGuide: '',
        impostorIndex: 0,
        fictitiousTitle: '',
        secretCharacter: '',
        songTitle: ''
    });

    const isAdminOrHost = userRole === 'admin' || userRole === 'super_admin' || userRole === 'arcade_host';

    // Load questions and secrets
    const loadData = async () => {
        setLoading(true);
        try {
            const list = await getAllQuestionsAdmin();
            setQuestions(list);

            // Fetch secrets for each question
            const secrets = {};
            for (const q of list) {
                const s = await getQuestionSecret(q.id);
                if (s) secrets[q.id] = s;
            }
            setSecretsMap(secrets);
        } catch (e) {
            console.error("Failed loading questions:", e);
            showToast?.("Gagal memuat bank soal", "⚠️");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Filtered list
    const filteredQuestions = questions.filter(q => {
        const matchGame = selectedGameFilter === 'ALL' || q.gameId === selectedGameFilter;
        const matchStatus = statusFilter === 'ALL' || q.status === statusFilter;
        return matchGame && matchStatus;
    });

    // Asset audit calculations
    const assetAudit = {
        totalQuestions: questions.length,
        activeCount: questions.filter(q => q.status === 'active').length,
        inactiveCount: questions.filter(q => q.status === 'inactive').length,
        croppedImagesCount: questions.filter(q => q.gameId === 'G04').length,
        audioClipsCount: questions.filter(q => q.gameId === 'G05').length,
        placeholderCount: questions.filter(q => 
            (q.mediaUrl && q.mediaUrl.includes('placeholder')) || 
            (q.mediaUrl && q.mediaUrl.includes('data:audio'))
        ).length
    };

    // Open Modal for Add
    const handleOpenAdd = () => {
        const gameId = selectedGameFilter === 'ALL' ? 'G01' : selectedGameFilter;
        const targetCount = GAME_DEFINITIONS[gameId]?.targetCount || 1;
        const autoId = `Q-${gameId}-${String(Date.now()).slice(-4)}`;

        setEditingQuestionId(null);
        setFormData({
            id: autoId,
            gameId,
            displayPrompt: GAME_DEFINITIONS[gameId]?.displayInstruction || '',
            targetCount,
            rulesDetail: '',
            status: 'active',
            trait: '',
            mediaUrl: gameId === 'G04' ? '/arcade/cropped_placeholder.svg' : '',
            revealedMediaUrl: gameId === 'G04' ? '/arcade/revealed_placeholder.svg' : '',
            letter: 'A',
            cardReferenceCode: `CARD-${gameId}-001`,
            characterName: '',
            phrasePrompt: '',
            options: ['', '', '', '', ''],
            answerKey: '',
            alternativeAnswers: '',
            referenceAnswers: '',
            verificationGuide: '',
            impostorIndex: 0,
            fictitiousTitle: '',
            secretCharacter: '',
            songTitle: ''
        });
        setIsModalOpen(true);
    };

    // Open Modal for Edit
    const handleOpenEdit = (q) => {
        const secret = secretsMap[q.id] || {};
        setEditingQuestionId(q.id);
        setFormData({
            id: q.id,
            gameId: q.gameId,
            displayPrompt: q.displayPrompt || '',
            targetCount: q.targetCount || GAME_DEFINITIONS[q.gameId]?.targetCount || 1,
            rulesDetail: q.rulesDetail || '',
            status: q.status || 'active',
            trait: q.trait || '',
            mediaUrl: q.mediaUrl || '',
            revealedMediaUrl: q.revealedMediaUrl || '',
            letter: q.letter || 'A',
            cardReferenceCode: q.cardReferenceCode || '',
            characterName: q.characterName || '',
            phrasePrompt: q.phrasePrompt || '',
            options: q.options ? [...q.options] : ['', '', '', '', ''],
            answerKey: secret.answerKey || '',
            alternativeAnswers: secret.alternativeAnswers ? secret.alternativeAnswers.join(', ') : '',
            referenceAnswers: secret.referenceAnswers ? secret.referenceAnswers.join('\n') : '',
            verificationGuide: secret.verificationGuide || '',
            impostorIndex: secret.impostorIndex !== undefined ? secret.impostorIndex : 0,
            fictitiousTitle: secret.fictitiousTitle || '',
            secretCharacter: secret.secretCharacter || '',
            songTitle: secret.songTitle || ''
        });
        setIsModalOpen(true);
    };

    // Toggle status
    const handleToggleStatus = async (q) => {
        const nextStatus = q.status === 'active' ? 'inactive' : 'active';
        try {
            await toggleQuestionStatus(q.id, nextStatus);
            showToast?.(`Status soal ${q.id} diubah ke ${nextStatus.toUpperCase()}`, "🔄");
            loadData();
        } catch (e) {
            console.error("Toggle status failed:", e);
            showToast?.("Gagal mengubah status soal", "⚠️");
        }
    };

    // Save Question & Secret
    const handleSave = async (e) => {
        e.preventDefault();

        // Validation
        if (!formData.id.trim()) {
            showToast?.("ID soal wajib diisi!", "⚠️");
            return;
        }
        if (!formData.displayPrompt.trim()) {
            showToast?.("Instruksi / display prompt wajib diisi!", "⚠️");
            return;
        }

        // Duplicate ID check for new question
        if (!editingQuestionId) {
            const exists = questions.some(q => q.id.toLowerCase() === formData.id.trim().toLowerCase());
            if (exists) {
                showToast?.(`ID '${formData.id}' sudah digunakan! Gunakan ID lain.`, "🚫");
                return;
            }
        }

        try {
            const questionPayload = {
                id: formData.id.trim(),
                gameId: formData.gameId,
                gameTitle: GAME_DEFINITIONS[formData.gameId]?.title || formData.gameId,
                displayPrompt: formData.displayPrompt.trim(),
                targetCount: Number(formData.targetCount) || 1,
                status: formData.status
            };

            if (formData.rulesDetail) questionPayload.rulesDetail = formData.rulesDetail.trim();
            if (formData.trait) questionPayload.trait = formData.trait.trim();
            if (formData.mediaUrl) questionPayload.mediaUrl = formData.mediaUrl.trim();
            if (formData.revealedMediaUrl) questionPayload.revealedMediaUrl = formData.revealedMediaUrl.trim();
            if (formData.letter) questionPayload.letter = formData.letter.trim().toUpperCase();
            if (formData.cardReferenceCode) questionPayload.cardReferenceCode = formData.cardReferenceCode.trim();
            if (formData.characterName) questionPayload.characterName = formData.characterName.trim();
            if (formData.phrasePrompt) questionPayload.phrasePrompt = formData.phrasePrompt.trim();
            if (formData.gameId === 'G09' || formData.gameId === 'G10') {
                questionPayload.options = formData.options.map(opt => opt.trim()).filter(Boolean);
            }

            const secretPayload = {};
            if (formData.answerKey) secretPayload.answerKey = formData.answerKey.trim();
            if (formData.songTitle) secretPayload.songTitle = formData.songTitle.trim();
            if (formData.secretCharacter) secretPayload.secretCharacter = formData.secretCharacter.trim();
            if (formData.verificationGuide) secretPayload.verificationGuide = formData.verificationGuide.trim();
            if (formData.alternativeAnswers) {
                secretPayload.alternativeAnswers = formData.alternativeAnswers.split(',').map(s => s.trim()).filter(Boolean);
            }
            if (formData.referenceAnswers) {
                secretPayload.referenceAnswers = formData.referenceAnswers.split('\n').map(s => s.trim()).filter(Boolean);
            }
            if (formData.gameId === 'G09' || formData.gameId === 'G10') {
                secretPayload.impostorIndex = Number(formData.impostorIndex) || 0;
                if (formData.fictitiousTitle) secretPayload.fictitiousTitle = formData.fictitiousTitle.trim();
            }

            await saveQuestion(questionPayload, secretPayload);
            showToast?.(`Soal ${formData.id} berhasil disimpan!`, "💾");
            setIsModalOpen(false);
            loadData();
        } catch (err) {
            console.error("Save question error:", err);
            showToast?.(err.message || "Gagal menyimpan soal", "⚠️");
        }
    };

    if (!isAdminOrHost) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center text-text">
                <div className="bg-white border-[3px] border-text rounded-2xl shadow-card p-8 max-w-md w-full relative">
                    <div className="washi-tape tape-yellow-1 absolute top-[-10px] left-1/2 -translate-x-1/2 h-6 w-24 bg-pink-light"></div>
                    <i className="fa-solid fa-lock text-4xl text-pink mb-3"></i>
                    <h2 className="font-title text-xl font-bold mb-2">Akses Khusus Admin</h2>
                    <p className="text-sm opacity-80 mb-5">
                        Question Bank Management hanya dapat diakses oleh akun dengan peran <strong>ADMIN</strong> atau <strong>ARCADE_HOST</strong>.
                    </p>
                    <Link
                        to="/arcade/host"
                        className="btn bg-pink text-text border-2 border-text rounded-full font-title text-xs px-6 py-2.5 shadow-btn hover:bg-white transition-all inline-flex items-center gap-2"
                    >
                        <i className="fa-solid fa-arrow-left"></i>
                        <span>Kembali ke Host Console</span>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="question-bank-manager flex flex-col gap-5 max-w-[1350px] mx-auto pb-12 font-body text-text">
            
            {/* Header Toolbar */}
            <div className="bg-white border-[3px] border-text rounded-2xl shadow-card p-4 flex flex-wrap justify-between items-center gap-3 relative">
                <div className="washi-tape tape-history absolute top-[-10px] left-8 transform rotate-[-2deg] h-5 w-24 bg-yellow"></div>
                
                <div className="flex items-center gap-3">
                    <div className="bg-yellow text-text border-2 border-text rounded-xl p-2.5 flex items-center justify-center shadow-[2px_2px_0px_#32628f]">
                        <i className="fa-solid fa-database text-xl"></i>
                    </div>
                    <div>
                        <h1 className="font-title text-lg md:text-xl font-bold leading-tight">Question Bank & Media Management</h1>
                        <p className="text-xs opacity-75">Kelola Soal, Kunci Jawaban, dan Status Media 10 Challenge Arcade</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleOpenAdd}
                        className="btn bg-pink text-text border-2 border-text rounded-xl px-3.5 py-2 text-xs font-title font-bold flex items-center gap-1.5 shadow-[2px_2px_0px_#32628f] hover:bg-white transition-all cursor-pointer"
                    >
                        <i className="fa-solid fa-plus"></i>
                        <span>Tambah Soal</span>
                    </button>
                    <Link
                        to="/arcade/host"
                        className="btn bg-white hover:bg-yellow-light border-2 border-text rounded-xl px-3 py-2 text-xs font-title font-bold flex items-center gap-1.5 shadow-[2px_2px_0px_#32628f]"
                    >
                        <i className="fa-solid fa-gamepad text-pink"></i>
                        <span>Host Console</span>
                    </Link>
                </div>
            </div>

            {/* Asset Audit & Production Readiness Summary Box */}
            <div className="bg-blue-light/20 border-[3px] border-text rounded-2xl p-4 shadow-card">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-title text-sm md:text-base font-bold flex items-center gap-2">
                        <i className="fa-solid fa-clipboard-check text-pink"></i>
                        <span>Audit Kelengkapan Aset & Bank Soal (Production Readiness)</span>
                    </h3>
                    <span className="text-[11px] font-bold bg-yellow border border-text rounded-full px-2.5 py-0.5">
                        Phase 4 QA
                    </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                    <div className="bg-white border-2 border-text rounded-xl p-2.5 shadow-[2px_2px_0px_#32628f] text-center">
                        <span className="opacity-70 block text-[10px] uppercase font-bold">Total Soal</span>
                        <span className="font-title text-lg font-black">{assetAudit.totalQuestions}</span>
                    </div>
                    <div className="bg-white border-2 border-text rounded-xl p-2.5 shadow-[2px_2px_0px_#32628f] text-center">
                        <span className="opacity-70 block text-[10px] uppercase font-bold text-green-700">Soal Aktif</span>
                        <span className="font-title text-lg font-black text-green-600">{assetAudit.activeCount}</span>
                    </div>
                    <div className="bg-white border-2 border-text rounded-xl p-2.5 shadow-[2px_2px_0px_#32628f] text-center">
                        <span className="opacity-70 block text-[10px] uppercase font-bold text-red-700">Soal Nonaktif</span>
                        <span className="font-title text-lg font-black text-red-600">{assetAudit.inactiveCount}</span>
                    </div>
                    <div className="bg-white border-2 border-text rounded-xl p-2.5 shadow-[2px_2px_0px_#32628f] text-center">
                        <span className="opacity-70 block text-[10px] uppercase font-bold">Crop Image (G04)</span>
                        <span className="font-title text-lg font-black text-blue">{assetAudit.croppedImagesCount}</span>
                    </div>
                    <div className="bg-white border-2 border-text rounded-xl p-2.5 shadow-[2px_2px_0px_#32628f] text-center">
                        <span className="opacity-70 block text-[10px] uppercase font-bold">Audio Clip (G05)</span>
                        <span className="font-title text-lg font-black text-pink">{assetAudit.audioClipsCount}</span>
                    </div>
                    <div className="bg-yellow-light/80 border-2 border-text rounded-xl p-2.5 shadow-[2px_2px_0px_#32628f] text-center">
                        <span className="opacity-70 block text-[10px] uppercase font-bold text-amber-800">Aset Testing/Mock</span>
                        <span className="font-title text-lg font-black text-amber-700">{assetAudit.placeholderCount}</span>
                    </div>
                </div>

                <div className="mt-3 text-[11px] bg-white border border-text/30 rounded-xl p-2.5 text-text/80 leading-relaxed flex items-center gap-2">
                    <i className="fa-solid fa-circle-info text-pink text-sm shrink-0"></i>
                    <span>
                        <strong>Catatan Persiapan Event:</strong> Aset gambar crop G04 dan klip audio G05 saat ini menggunakan <em>synthetic testing placeholder</em> untuk memastikan kompatibilitas teknis. Sebelum event convention, panitia wajib melengkapi aset gambar resmi berlisensi/artist-safe dan cuplikan audio legal melalui panel ini.
                    </span>
                </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase opacity-70">Pilih Tantangan:</span>
                <button
                    onClick={() => setSelectedGameFilter('ALL')}
                    className={`px-3 py-1 rounded-xl text-xs font-title font-bold border-2 border-text transition-all ${
                        selectedGameFilter === 'ALL' ? 'bg-pink text-text shadow-[2px_2px_0px_#32628f]' : 'bg-white hover:bg-yellow-light'
                    }`}
                >
                    Semua ({questions.length})
                </button>
                {Object.keys(GAME_DEFINITIONS).map(gId => {
                    const count = questions.filter(q => q.gameId === gId).length;
                    return (
                        <button
                            key={gId}
                            onClick={() => setSelectedGameFilter(gId)}
                            className={`px-2.5 py-1 rounded-xl text-xs font-title font-bold border-2 border-text transition-all ${
                                selectedGameFilter === gId ? 'bg-yellow text-text shadow-[2px_2px_0px_#32628f]' : 'bg-white hover:bg-pink-light'
                            }`}
                        >
                            {gId} ({count})
                        </button>
                    );
                })}

                <div className="ml-auto flex items-center gap-1.5 text-xs font-bold">
                    <span className="opacity-70">Status:</span>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-white border-2 border-text rounded-lg px-2 py-0.5 text-xs font-title cursor-pointer"
                    >
                        <option value="ALL">Semua</option>
                        <option value="active">Aktif</option>
                        <option value="inactive">Nonaktif</option>
                    </select>
                </div>
            </div>

            {/* Questions Grid */}
            {loading ? (
                <div className="text-center py-16 font-title font-bold text-base opacity-60">
                    <i className="fa-solid fa-spinner fa-spin mr-2"></i> Memuat data soal...
                </div>
            ) : filteredQuestions.length === 0 ? (
                <div className="bg-white border-[3px] border-text rounded-2xl p-8 text-center shadow-card">
                    <span className="text-3xl mb-2 block">📭</span>
                    <h3 className="font-title text-base font-bold mb-1">Belum Ada Soal</h3>
                    <p className="text-xs opacity-75 mb-4">Tidak ada soal untuk filter tantangan yang dipilih.</p>
                    <button
                        onClick={handleOpenAdd}
                        className="btn bg-pink border-2 border-text rounded-xl px-4 py-2 text-xs font-title font-bold"
                    >
                        Tambah Soal Baru
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredQuestions.map(q => {
                        const secret = secretsMap[q.id];
                        const isPlaceholder = q.mediaUrl && (q.mediaUrl.includes('placeholder') || q.mediaUrl.includes('data:audio'));

                        return (
                            <div 
                                key={q.id}
                                className={`bg-white border-[3px] border-text rounded-2xl p-4 shadow-card flex flex-col justify-between relative transition-all ${
                                    q.status === 'inactive' ? 'opacity-65 bg-gray-50' : ''
                                }`}
                            >
                                <div>
                                    {/* Top Card Badges */}
                                    <div className="flex justify-between items-center mb-2.5">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-pink text-text border-2 border-text rounded-lg px-2 py-0.5 text-xs font-title font-bold">
                                                {q.gameId} • {GAME_DEFINITIONS[q.gameId]?.title}
                                            </span>
                                            <span className="text-[11px] font-bold opacity-60 font-mono">
                                                {q.id}
                                            </span>
                                        </div>
                                        <span className={`border-2 border-text rounded-full px-2 py-0.2 text-[10px] font-title font-bold ${
                                            q.status === 'active' ? 'bg-green-200 text-green-900' : 'bg-red-200 text-red-900'
                                        }`}>
                                            {q.status === 'active' ? 'AKTIF' : 'NONAKTIF'}
                                        </span>
                                    </div>

                                    {/* Prompt */}
                                    <h3 className="font-title text-sm font-bold text-text mb-2">
                                        {q.displayPrompt}
                                    </h3>

                                    {/* Challenge Specific Badges */}
                                    <div className="flex flex-wrap gap-1.5 mb-3 text-[11px]">
                                        {q.trait && (
                                            <span className="bg-yellow-light border border-text/40 rounded px-2 py-0.5 font-bold">
                                                Ciri: {q.trait}
                                            </span>
                                        )}
                                        {q.letter && (
                                            <span className="bg-yellow-light border border-text/40 rounded px-2 py-0.5 font-bold">
                                                Huruf: {q.letter}
                                            </span>
                                        )}
                                        {q.characterName && (
                                            <span className="bg-pink-light border border-text/40 rounded px-2 py-0.5 font-bold">
                                                Karakter: {q.characterName}
                                            </span>
                                        )}
                                        {q.cardReferenceCode && (
                                            <span className="bg-blue-light border border-text/40 rounded px-2 py-0.5 font-bold">
                                                Ref: {q.cardReferenceCode}
                                            </span>
                                        )}
                                        {q.mediaUrl && (
                                            <span className={`border border-text/40 rounded px-2 py-0.5 font-bold ${
                                                isPlaceholder ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-900'
                                            }`}>
                                                {isPlaceholder ? '⚠️ Media Testing' : '✅ Media Produksi'}
                                            </span>
                                        )}
                                    </div>

                                    {/* Secret Key Summary Box */}
                                    {secret && (
                                        <div className="bg-yellow-light/40 border border-dashed border-text/40 rounded-xl p-2.5 text-xs text-text/85 mb-3">
                                            <span className="font-bold text-[10px] uppercase block text-text/60 mb-0.5">
                                                🔒 Kunci Jawaban Host:
                                            </span>
                                            {secret.answerKey && (
                                                <div className="font-title font-bold text-pink">{secret.answerKey}</div>
                                            )}
                                            {secret.songTitle && (
                                                <div className="text-[11px] font-medium">{secret.songTitle}</div>
                                            )}
                                            {secret.secretCharacter && (
                                                <div className="font-title font-bold">{secret.secretCharacter}</div>
                                            )}
                                            {secret.impostorIndex !== undefined && q.options && (
                                                <div className="text-[11px]">
                                                    Impostor #{secret.impostorIndex + 1}: <strong>{q.options[secret.impostorIndex]}</strong>
                                                </div>
                                            )}
                                            {secret.verificationGuide && (
                                                <div className="text-[10px] opacity-75 mt-1">{secret.verificationGuide}</div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex justify-end items-center gap-2 pt-2 border-t border-text/15">
                                    <button
                                        onClick={() => handleToggleStatus(q)}
                                        className={`px-2.5 py-1 rounded-lg border border-text text-xs font-bold transition-all ${
                                            q.status === 'active' 
                                                ? 'bg-red-50 text-red-700 hover:bg-red-100' 
                                                : 'bg-green-50 text-green-700 hover:bg-green-100'
                                        }`}
                                    >
                                        {q.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                                    </button>
                                    <button
                                        onClick={() => handleOpenEdit(q)}
                                        className="btn bg-white hover:bg-yellow-light border border-text rounded-lg px-3 py-1 text-xs font-title font-bold flex items-center gap-1 shadow-sm"
                                    >
                                        <i className="fa-solid fa-pen-to-square text-xs"></i>
                                        <span>Edit</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal Form for Add/Edit */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white border-[4px] border-text rounded-3xl p-6 max-w-xl w-full shadow-[8px_8px_0px_#32628f] my-8 relative">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b-2 border-text/15">
                            <h2 className="font-title text-base sm:text-lg font-bold">
                                {editingQuestionId ? `Edit Soal: ${formData.id}` : 'Tambah Soal Baru'}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-text hover:text-pink text-lg"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="flex flex-col gap-3.5 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold block mb-1">ID Soal</label>
                                    <input 
                                        type="text" 
                                        required
                                        disabled={!!editingQuestionId}
                                        value={formData.id} 
                                        onChange={(e) => setFormData({...formData, id: e.target.value})}
                                        className="w-full border-2 border-text rounded-lg p-2 font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold block mb-1">Challenge</label>
                                    <select
                                        value={formData.gameId}
                                        disabled={!!editingQuestionId}
                                        onChange={(e) => {
                                            const gId = e.target.value;
                                            setFormData({
                                                ...formData, 
                                                gameId: gId,
                                                targetCount: GAME_DEFINITIONS[gId]?.targetCount || 1,
                                                displayPrompt: GAME_DEFINITIONS[gId]?.displayInstruction || ''
                                            });
                                        }}
                                        className="w-full border-2 border-text rounded-lg p-2 font-title"
                                    >
                                        {Object.keys(GAME_DEFINITIONS).map(gId => (
                                            <option key={gId} value={gId}>{gId} - {GAME_DEFINITIONS[gId].title}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="font-bold block mb-1">Display Prompt / Instruksi Pengunjung</label>
                                <textarea
                                    required
                                    rows="2"
                                    value={formData.displayPrompt}
                                    onChange={(e) => setFormData({...formData, displayPrompt: e.target.value})}
                                    className="w-full border-2 border-text rounded-lg p-2 font-body"
                                />
                            </div>

                            {/* Challenge Specific Fields */}
                            {formData.gameId === 'G02' && (
                                <div>
                                    <label className="font-bold block mb-1">Ciri Karakter Target (Trait)</label>
                                    <input 
                                        type="text" 
                                        value={formData.trait} 
                                        onChange={(e) => setFormData({...formData, trait: e.target.value})}
                                        placeholder="misal: Rambut Putih / Perak"
                                        className="w-full border-2 border-text rounded-lg p-2"
                                    />
                                </div>
                            )}

                            {formData.gameId === 'G04' && (
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="font-bold block mb-1">Media URL (Cropped)</label>
                                        <input 
                                            type="text" 
                                            value={formData.mediaUrl} 
                                            onChange={(e) => setFormData({...formData, mediaUrl: e.target.value})}
                                            className="w-full border-2 border-text rounded-lg p-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="font-bold block mb-1">Media URL (Revealed)</label>
                                        <input 
                                            type="text" 
                                            value={formData.revealedMediaUrl} 
                                            onChange={(e) => setFormData({...formData, revealedMediaUrl: e.target.value})}
                                            className="w-full border-2 border-text rounded-lg p-2"
                                        />
                                    </div>
                                </div>
                            )}

                            {formData.gameId === 'G05' && (
                                <div>
                                    <label className="font-bold block mb-1">Audio Media URL / Data URI</label>
                                    <input 
                                        type="text" 
                                        value={formData.mediaUrl} 
                                        onChange={(e) => setFormData({...formData, mediaUrl: e.target.value})}
                                        placeholder="/arcade/audio/op1.mp3 atau Data URI"
                                        className="w-full border-2 border-text rounded-lg p-2"
                                    />
                                </div>
                            )}

                            {formData.gameId === 'G06' && (
                                <div>
                                    <label className="font-bold block mb-1">Huruf Awalan</label>
                                    <input 
                                        type="text" 
                                        maxLength="1"
                                        value={formData.letter} 
                                        onChange={(e) => setFormData({...formData, letter: e.target.value.toUpperCase()})}
                                        className="w-16 border-2 border-text rounded-lg p-2 text-center font-title font-bold text-base"
                                    />
                                </div>
                            )}

                            {formData.gameId === 'G08' && (
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="font-bold block mb-1">Nama Karakter</label>
                                        <input 
                                            type="text" 
                                            value={formData.characterName} 
                                            onChange={(e) => setFormData({...formData, characterName: e.target.value})}
                                            className="w-full border-2 border-text rounded-lg p-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="font-bold block mb-1">Catchphrase</label>
                                        <input 
                                            type="text" 
                                            value={formData.phrasePrompt} 
                                            onChange={(e) => setFormData({...formData, phrasePrompt: e.target.value})}
                                            className="w-full border-2 border-text rounded-lg p-2"
                                        />
                                    </div>
                                </div>
                            )}

                            {(formData.gameId === 'G09' || formData.gameId === 'G10') && (
                                <div>
                                    <label className="font-bold block mb-1">5 Opsi Pilihan ({formData.gameId === 'G09' ? 'Karakter' : 'Judul Anime'})</label>
                                    <div className="grid grid-cols-1 gap-1.5">
                                        {formData.options.map((opt, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <span className="w-5 text-center font-bold">{i + 1}.</span>
                                                <input 
                                                    type="text" 
                                                    value={opt}
                                                    onChange={(e) => {
                                                        const copy = [...formData.options];
                                                        copy[i] = e.target.value;
                                                        setFormData({...formData, options: copy});
                                                    }}
                                                    className="w-full border-2 border-text rounded-lg p-1.5"
                                                    placeholder={`Opsi #${i + 1}`}
                                                />
                                                <label className="flex items-center gap-1 text-[11px] whitespace-nowrap">
                                                    <input 
                                                        type="radio" 
                                                        name="impostorSelect" 
                                                        checked={formData.impostorIndex === i}
                                                        onChange={() => setFormData({...formData, impostorIndex: i})}
                                                    />
                                                    <span>Impostor</span>
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Secret Section */}
                            <div className="bg-yellow-light/50 border-2 border-text/40 rounded-xl p-3">
                                <h4 className="font-title font-bold text-xs mb-2 text-pink">
                                    🔒 Kunci Rahasia Host (arcade_secrets)
                                </h4>
                                {(formData.gameId === 'G04' || formData.gameId === 'G05') && (
                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                        <div>
                                            <label className="font-bold block mb-0.5">Kunci Jawaban Resmi</label>
                                            <input 
                                                type="text" 
                                                value={formData.answerKey} 
                                                onChange={(e) => setFormData({...formData, answerKey: e.target.value})}
                                                className="w-full border-2 border-text rounded-lg p-1.5"
                                            />
                                        </div>
                                        <div>
                                            <label className="font-bold block mb-0.5">Alternatif Judul (Koma)</label>
                                            <input 
                                                type="text" 
                                                value={formData.alternativeAnswers} 
                                                onChange={(e) => setFormData({...formData, alternativeAnswers: e.target.value})}
                                                placeholder="Judul lain 1, Judul lain 2"
                                                className="w-full border-2 border-text rounded-lg p-1.5"
                                            />
                                        </div>
                                    </div>
                                )}
                                {(formData.gameId === 'G02' || formData.gameId === 'G06') && (
                                    <div className="mb-2">
                                        <label className="font-bold block mb-0.5">Referensi Jawaban Benar (1 per baris)</label>
                                        <textarea
                                            rows="2"
                                            value={formData.referenceAnswers}
                                            onChange={(e) => setFormData({...formData, referenceAnswers: e.target.value})}
                                            className="w-full border-2 border-text rounded-lg p-1.5"
                                        />
                                    </div>
                                )}
                                {formData.gameId === 'G07' && (
                                    <div className="mb-2">
                                        <label className="font-bold block mb-0.5">Karakter Rahasia Kartu Fisik</label>
                                        <input 
                                            type="text" 
                                            value={formData.secretCharacter} 
                                            onChange={(e) => setFormData({...formData, secretCharacter: e.target.value})}
                                            className="w-full border-2 border-text rounded-lg p-1.5"
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="font-bold block mb-0.5">Panduan Verifikasi Host</label>
                                    <input 
                                        type="text" 
                                        value={formData.verificationGuide} 
                                        onChange={(e) => setFormData({...formData, verificationGuide: e.target.value})}
                                        className="w-full border-2 border-text rounded-lg p-1.5"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 border-2 border-text rounded-xl font-title font-bold bg-white"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="btn bg-pink text-text border-2 border-text rounded-xl px-5 py-2 font-title font-bold shadow-[2px_2px_0px_#32628f]"
                                >
                                    Simpan Soal
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
