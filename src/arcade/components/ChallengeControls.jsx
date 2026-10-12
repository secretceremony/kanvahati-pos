import React, { useState, useEffect, useRef } from 'react';

/**
 * Clean helper to normalize titles/names for duplicate prevention
 */
function normalizeAnswer(str) {
    return (str || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .trim();
}

/**
 * Challenge-Specific Evaluation Controls for Host Console (Antislop UI)
 * Features real-time duplicate input prevention, YouTube 5-second embed player,
 * 3-hint panitia reader, 3-genre rubric checklist, and clear host answer keys.
 */
export default function ChallengeControls({ 
    gameId, 
    question, 
    secret, 
    session, 
    onCorrect, 
    onIncorrect,
    disabled = false 
}) {
    // --- State for Duplicate Prevention (G01, G02, G06) ---
    const [inputValue, setInputValue] = useState('');
    const [enteredItems, setEnteredItems] = useState([]);
    const [duplicateWarning, setDuplicateWarning] = useState('');

    // --- State for G03: 3 Genres & Examples ---
    const [genreChecklist, setGenreChecklist] = useState({
        slot1_genre: false, slot1_anime: false,
        slot2_genre: false, slot2_anime: false,
        slot3_genre: false, slot3_anime: false
    });

    // --- State for G05: YouTube 5-second player ---
    const [ytPlaying, setYtPlaying] = useState(false);
    const [ytCountdown, setYtCountdown] = useState(5);
    const [ytShowVideo, setYtShowVideo] = useState(false);
    const ytTimerRef = useRef(null);

    // --- State for G07: Three-Hint panitia reader ---
    const [revealedHintIndex, setRevealedHintIndex] = useState(1); // 1, 2, or 3

    // Reset local states when question or session changes
    useEffect(() => {
        setInputValue('');
        setEnteredItems([]);
        setDuplicateWarning('');
        setGenreChecklist({
            slot1_genre: false, slot1_anime: false,
            slot2_genre: false, slot2_anime: false,
            slot3_genre: false, slot3_anime: false
        });
        setYtPlaying(false);
        setYtCountdown(5);
        setRevealedHintIndex(1);
        if (ytTimerRef.current) clearInterval(ytTimerRef.current);
    }, [question?.id, session?.status]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (ytTimerRef.current) clearInterval(ytTimerRef.current);
        };
    }, []);

    if (!question) {
        return <div className="text-sm opacity-70 p-4">Pilih soal terlebih dahulu untuk memuat kontrol penilaian.</div>;
    }

    const isPlaying = session?.status === 'playing';

    // Handler to add item with duplicate validation
    const handleAddItem = (typeLabel = 'item') => {
        if (!inputValue.trim() || !isPlaying || disabled) return;
        const norm = normalizeAnswer(inputValue);

        // Check duplicate
        const isDuplicate = enteredItems.some(it => normalizeAnswer(it) === norm);
        if (isDuplicate) {
            setDuplicateWarning(`"${inputValue.trim()}" sudah pernah dimasukkan! ${typeLabel} tidak boleh diulang.`);
            return;
        }

        // Additional letter validation for G06
        if (gameId === 'G06') {
            const targetLetter = (question.letter || 'A').toUpperCase();
            const firstChar = inputValue.trim().charAt(0).toUpperCase();
            if (firstChar !== targetLetter) {
                setDuplicateWarning(`"${inputValue.trim()}" tidak diawali dengan huruf "${targetLetter}"!`);
                return;
            }
        }

        setDuplicateWarning('');
        const updated = [...enteredItems, inputValue.trim()];
        setEnteredItems(updated);
        setInputValue('');
        onCorrect(1);
    };

    // Handler to remove misclicked/mistyped item
    const handleRemoveItem = (idx) => {
        if (!isPlaying || disabled) return;
        const updated = enteredItems.filter((_, i) => i !== idx);
        setEnteredItems(updated);
        setDuplicateWarning('');
    };

    // Handler for G03 3-genre checklist
    const toggleGenreCheck = (key) => {
        if (!isPlaying || disabled) return;
        const updated = { ...genreChecklist, [key]: !genreChecklist[key] };
        setGenreChecklist(updated);

        // When all 6 components (3 genres + 3 anime) are checked -> WIN!
        const allChecked = Object.values(updated).every(Boolean);
        if (allChecked) {
            onCorrect(3);
        }
    };

    // Handler for YouTube 5-second playback
    const startYouTubePlay = () => {
        setYtPlaying(true);
        setYtCountdown(5);
        if (ytTimerRef.current) clearInterval(ytTimerRef.current);

        ytTimerRef.current = setInterval(() => {
            setYtCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(ytTimerRef.current);
                    setYtPlaying(false);
                    return 5;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const stopYouTubePlay = () => {
        if (ytTimerRef.current) clearInterval(ytTimerRef.current);
        setYtPlaying(false);
        setYtCountdown(5);
    };

    // =========================================================================
    // G01: Anime Speedrun (Input + Duplicate Prevention)
    // =========================================================================
    if (gameId === 'G01') {
        const currentCount = session?.currentProgress || enteredItems.length;
        return (
            <div className="flex flex-col gap-4">
                <div className="bg-white border-2 border-text rounded-2xl p-4 shadow-[3px_3px_0px_#32628f]">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-title text-sm font-bold text-text">Progres Judul Anime:</span>
                        <span className="font-title text-2xl font-extrabold text-pink">
                            {currentCount} / 10
                        </span>
                    </div>

                    <div className="w-full bg-blue-light border-2 border-text rounded-full h-4 overflow-hidden mb-3">
                        <div 
                            className="bg-pink h-full transition-all duration-300"
                            style={{ width: `${(Math.min(currentCount, 10) / 10) * 100}%` }}
                        ></div>
                    </div>

                    {/* Anti-Duplicate Input Field */}
                    <div className="mb-3">
                        <form 
                            onSubmit={(e) => { e.preventDefault(); handleAddItem('Judul anime'); }}
                            className="flex gap-2"
                        >
                            <input
                                type="text"
                                disabled={!isPlaying || disabled}
                                value={inputValue}
                                onChange={(e) => { setInputValue(e.target.value); setDuplicateWarning(''); }}
                                placeholder="Ketik judul anime yang diucapkan peserta..."
                                className="flex-grow bg-[#f6f9fc] border-2 border-text rounded-xl px-3 py-2 text-sm font-body text-text focus:outline-none focus:ring-2 focus:ring-pink disabled:opacity-50"
                            />
                            <button
                                type="submit"
                                disabled={!isPlaying || disabled || !inputValue.trim()}
                                className="btn bg-pink text-text border-2 border-text rounded-xl px-4 py-2 font-title text-xs font-bold shadow-[2px_2px_0px_#32628f] hover:bg-white active:translate-y-[1px] disabled:opacity-50 cursor-pointer"
                            >
                                <i className="fa-solid fa-plus mr-1"></i> Tambah
                            </button>
                        </form>

                        {/* Duplicate Alert */}
                        {duplicateWarning && (
                            <div className="mt-2 bg-rose-100 border-2 border-rose-400 text-rose-800 text-xs font-bold rounded-lg p-2.5 flex items-center gap-2">
                                <i className="fa-solid fa-triangle-exclamation text-rose-600"></i>
                                <span>{duplicateWarning}</span>
                            </div>
                        )}
                    </div>

                    {/* Spoken Anime Chips */}
                    {enteredItems.length > 0 && (
                        <div className="mb-3">
                            <span className="text-[11px] font-bold text-text/70 block mb-1">Judul yang Sudah Diinput (Bebas Duplikat):</span>
                            <div className="flex flex-wrap gap-1.5">
                                {enteredItems.map((item, idx) => (
                                    <span 
                                        key={idx}
                                        className="bg-yellow-light border border-text/40 rounded-lg px-2.5 py-1 text-xs font-bold text-text inline-flex items-center gap-1.5 shadow-[1px_1px_0px_#32628f]"
                                    >
                                        <span>#{idx + 1} {item}</span>
                                        {isPlaying && (
                                            <button 
                                                type="button" 
                                                onClick={() => handleRemoveItem(idx)}
                                                className="text-rose-500 hover:text-rose-700 cursor-pointer"
                                                title="Hapus jika salah input"
                                            >
                                                &times;
                                            </button>
                                        )}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="text-[11.5px] bg-yellow-light border border-text/30 p-2.5 rounded-xl text-text leading-relaxed">
                        <i className="fa-solid fa-info-circle text-navy mr-1"></i>
                        <strong>Aturan:</strong> Season/sequel franchise yang sama hanya dihitung 1 judul (misal: <em>Naruto</em> & <em>Naruto Shippuden</em> dihitung 1).
                    </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        type="button"
                        disabled={!isPlaying || disabled}
                        onClick={() => onCorrect(1)}
                        className="btn bg-green-400 text-text border-[3px] border-text rounded-xl p-3.5 font-title text-base font-bold shadow-btn hover:bg-green-300 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fa-solid fa-plus text-lg"></i>
                        <span>+1 Judul Cepat (Lisan)</span>
                    </button>
                    <button
                        type="button"
                        disabled={!isPlaying || disabled}
                        onClick={() => onIncorrect("Judul duplikat atau bukan anime")}
                        className="btn bg-rose-300 text-text border-[3px] border-text rounded-xl p-3.5 font-title text-base font-bold shadow-btn hover:bg-rose-400 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fa-solid fa-ban text-lg"></i>
                        <span>Salah / Duplikat (Gagal)</span>
                    </button>
                </div>
            </div>
        );
    }

    // =========================================================================
    // G02: Character Hunt (Input + Duplicate Prevention + Trait Rubric)
    // =========================================================================
    if (gameId === 'G02') {
        const currentCount = session?.currentProgress || enteredItems.length;
        return (
            <div className="flex flex-col gap-4">
                <div className="bg-white border-2 border-text rounded-2xl p-4 shadow-[3px_3px_0px_#32628f]">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-title text-sm font-bold text-text">
                            Ciri Target: <span className="text-pink font-extrabold">{question.trait || "Sesuai Soal"}</span>
                        </span>
                        <span className="font-title text-2xl font-extrabold text-pink">
                            {currentCount} / 5
                        </span>
                    </div>

                    <div className="w-full bg-blue-light border-2 border-text rounded-full h-4 overflow-hidden mb-3">
                        <div 
                            className="bg-pink h-full transition-all duration-300"
                            style={{ width: `${(Math.min(currentCount, 5) / 5) * 100}%` }}
                        ></div>
                    </div>

                    {/* Anti-Duplicate Character Input */}
                    <div className="mb-3">
                        <form 
                            onSubmit={(e) => { e.preventDefault(); handleAddItem('Karakter'); }}
                            className="flex gap-2"
                        >
                            <input
                                type="text"
                                disabled={!isPlaying || disabled}
                                value={inputValue}
                                onChange={(e) => { setInputValue(e.target.value); setDuplicateWarning(''); }}
                                placeholder="Ketik nama karakter yang disebutkan peserta..."
                                className="flex-grow bg-[#f6f9fc] border-2 border-text rounded-xl px-3 py-2 text-sm font-body text-text focus:outline-none focus:ring-2 focus:ring-pink disabled:opacity-50"
                            />
                            <button
                                type="submit"
                                disabled={!isPlaying || disabled || !inputValue.trim()}
                                className="btn bg-pink text-text border-2 border-text rounded-xl px-4 py-2 font-title text-xs font-bold shadow-[2px_2px_0px_#32628f] hover:bg-white active:translate-y-[1px] disabled:opacity-50 cursor-pointer"
                            >
                                <i className="fa-solid fa-plus mr-1"></i> Tambah
                            </button>
                        </form>

                        {duplicateWarning && (
                            <div className="mt-2 bg-rose-100 border-2 border-rose-400 text-rose-800 text-xs font-bold rounded-lg p-2.5 flex items-center gap-2">
                                <i className="fa-solid fa-triangle-exclamation text-rose-600"></i>
                                <span>{duplicateWarning}</span>
                            </div>
                        )}
                    </div>

                    {/* Spoken Character Chips */}
                    {enteredItems.length > 0 && (
                        <div className="mb-3">
                            <span className="text-[11px] font-bold text-text/70 block mb-1">Karakter yang Sudah Diinput (Bebas Duplikat):</span>
                            <div className="flex flex-wrap gap-1.5">
                                {enteredItems.map((item, idx) => (
                                    <span 
                                        key={idx}
                                        className="bg-green-100 border border-text/40 rounded-lg px-2.5 py-1 text-xs font-bold text-text inline-flex items-center gap-1.5 shadow-[1px_1px_0px_#32628f]"
                                    >
                                        <span>#{idx + 1} {item}</span>
                                        {isPlaying && (
                                            <button 
                                                type="button" 
                                                onClick={() => handleRemoveItem(idx)}
                                                className="text-rose-500 hover:text-rose-700 cursor-pointer"
                                                title="Hapus jika salah input"
                                            >
                                                &times;
                                            </button>
                                        )}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Reference Sheet for Host */}
                    {secret?.referenceAnswers && (
                        <div className="bg-yellow-light border border-text/30 p-2.5 rounded-xl text-[11.5px] text-text">
                            <span className="font-bold uppercase tracking-wider block mb-1">Referensi Karakter Valid untuk Host:</span>
                            <div className="flex flex-wrap gap-1">
                                {secret.referenceAnswers.map((item, idx) => (
                                    <span key={idx} className="bg-white/80 border border-text/20 rounded px-1.5 py-0.5 text-[11px]">
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        type="button"
                        disabled={!isPlaying || disabled}
                        onClick={() => onCorrect(1)}
                        className="btn bg-green-400 text-text border-[3px] border-text rounded-xl p-3.5 font-title text-base font-bold shadow-btn hover:bg-green-300 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fa-solid fa-check text-lg"></i>
                        <span>+1 Karakter Cocok</span>
                    </button>
                    <button
                        type="button"
                        disabled={!isPlaying || disabled}
                        onClick={() => onIncorrect("Karakter tidak memiliki ciri khas yang diminta")}
                        className="btn bg-rose-300 text-text border-[3px] border-text rounded-xl p-3.5 font-title text-base font-bold shadow-btn hover:bg-rose-400 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fa-solid fa-xmark text-lg"></i>
                        <span>Karakter Salah (Gagal)</span>
                    </button>
                </div>
            </div>
        );
    }

    // =========================================================================
    // G03: Anime Genre Explorer (3 Genre & Anime Contoh)
    // =========================================================================
    if (gameId === 'G03') {
        const countChecked = Object.values(genreChecklist).filter(Boolean).length;
        return (
            <div className="flex flex-col gap-4">
                <div className="bg-white border-2 border-text rounded-2xl p-4 shadow-[3px_3px_0px_#32628f]">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-title text-sm font-bold text-text">Validasi 3 Genre Anime & Contohnya:</span>
                        <span className="font-title text-sm font-bold text-pink">{countChecked} / 6 Komponen Valid</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mb-3">
                        {/* Slot 1 */}
                        <div className="border-2 border-text rounded-xl p-2.5 bg-yellow-light/40">
                            <span className="font-title text-xs font-bold block mb-1.5 text-text">Pasang #1</span>
                            <div className="space-y-1.5 text-xs font-body">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={genreChecklist.slot1_genre} 
                                        onChange={() => toggleGenreCheck('slot1_genre')} 
                                        className="w-4 h-4 accent-pink"
                                    />
                                    <span>Genre 1 Valid</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={genreChecklist.slot1_anime} 
                                        onChange={() => toggleGenreCheck('slot1_anime')} 
                                        className="w-4 h-4 accent-pink"
                                    />
                                    <span>Contoh Anime 1 Tepat</span>
                                </label>
                            </div>
                        </div>

                        {/* Slot 2 */}
                        <div className="border-2 border-text rounded-xl p-2.5 bg-blue-light/40">
                            <span className="font-title text-xs font-bold block mb-1.5 text-text">Pasang #2</span>
                            <div className="space-y-1.5 text-xs font-body">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={genreChecklist.slot2_genre} 
                                        onChange={() => toggleGenreCheck('slot2_genre')} 
                                        className="w-4 h-4 accent-pink"
                                    />
                                    <span>Genre 2 Valid (Beda)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={genreChecklist.slot2_anime} 
                                        onChange={() => toggleGenreCheck('slot2_anime')} 
                                        className="w-4 h-4 accent-pink"
                                    />
                                    <span>Contoh Anime 2 Tepat</span>
                                </label>
                            </div>
                        </div>

                        {/* Slot 3 */}
                        <div className="border-2 border-text rounded-xl p-2.5 bg-pink-light/40">
                            <span className="font-title text-xs font-bold block mb-1.5 text-text">Pasang #3</span>
                            <div className="space-y-1.5 text-xs font-body">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={genreChecklist.slot3_genre} 
                                        onChange={() => toggleGenreCheck('slot3_genre')} 
                                        className="w-4 h-4 accent-pink"
                                    />
                                    <span>Genre 3 Valid (Beda)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={genreChecklist.slot3_anime} 
                                        onChange={() => toggleGenreCheck('slot3_anime')} 
                                        className="w-4 h-4 accent-pink"
                                    />
                                    <span>Contoh Anime 3 Tepat</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Host Reference Guide */}
                    {secret?.popularGenreReferences && (
                        <div className="bg-yellow-light border border-text/30 p-2.5 rounded-xl text-[11px] text-text max-h-32 overflow-y-auto">
                            <span className="font-bold block mb-1 uppercase tracking-wider">Panduan Referensi Genre Populer Host:</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                {Object.entries(secret.popularGenreReferences).map(([genre, animes]) => (
                                    <div key={genre}>
                                        <strong>{genre}:</strong> {Array.isArray(animes) ? animes.slice(0, 3).join(', ') : animes}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        type="button"
                        disabled={!isPlaying || disabled || countChecked < 6}
                        onClick={() => onCorrect(3)}
                        className="btn bg-green-400 text-text border-[3px] border-text rounded-xl p-3.5 font-title text-base font-bold shadow-btn hover:bg-green-300 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fa-solid fa-trophy text-lg"></i>
                        <span>3 Pasang Genre & Anime Lengkap (Menang)</span>
                    </button>
                    <button
                        type="button"
                        disabled={!isPlaying || disabled}
                        onClick={() => onIncorrect("Genre duplikat atau contoh anime tidak sesuai")}
                        className="btn bg-rose-300 text-text border-[3px] border-text rounded-xl p-3.5 font-title text-base font-bold shadow-btn hover:bg-rose-400 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fa-solid fa-xmark text-lg"></i>
                        <span>Genre / Contoh Salah (Gagal)</span>
                    </button>
                </div>
            </div>
        );
    }

    // =========================================================================
    // G04: Guess the Anime: Cropped Edition
    // =========================================================================
    if (gameId === 'G04') {
        return (
            <div className="flex flex-col gap-4">
                <div className="bg-white border-2 border-text rounded-2xl p-4 shadow-[3px_3px_0px_#32628f]">
                    <div className="flex flex-col sm:flex-row gap-4 items-center mb-3">
                        <div className="w-32 h-32 border-2 border-text rounded-xl overflow-hidden bg-white shrink-0 shadow-[2px_2px_0px_#32628f] p-1 flex items-center justify-center">
                            <img 
                                src={question.mediaUrl || "/arcade/guesses/attack_on_titan.png"} 
                                alt="Cropped Preview" 
                                className="max-w-full max-h-full object-contain"
                            />
                        </div>
                        <div className="flex-grow">
                            <span className="font-title text-xs font-bold uppercase tracking-wider block text-text/70 mb-1">Kunci Jawaban Host:</span>
                            <div className="font-title text-lg font-extrabold text-pink mb-1">
                                {secret?.answerKey || "Judul Anime"}
                            </div>
                            {secret?.alternativeAnswers && (
                                <div className="text-xs opacity-80">
                                    <strong>Alternatif:</strong> {secret.alternativeAnswers.join(', ')}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        type="button"
                        disabled={!isPlaying || disabled}
                        onClick={() => onCorrect(1)}
                        className="btn bg-green-400 text-text border-[3px] border-text rounded-xl p-3.5 font-title text-base font-bold shadow-btn hover:bg-green-300 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fa-solid fa-check text-lg"></i>
                        <span>Tebakan Benar (Menang)</span>
                    </button>
                    <button
                        type="button"
                        disabled={!isPlaying || disabled}
                        onClick={() => onIncorrect("Tebakan judul anime salah")}
                        className="btn bg-rose-300 text-text border-[3px] border-text rounded-xl p-3.5 font-title text-base font-bold shadow-btn hover:bg-rose-400 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fa-solid fa-xmark text-lg"></i>
                        <span>Tebakan Salah (Gagal)</span>
                    </button>
                </div>
            </div>
        );
    }

    // =========================================================================
    // G05: Guess the Anime Opening (YouTube Embed with 5s Timestamp Player)
    // =========================================================================
    if (gameId === 'G05') {
        const ytId = question.youtubeId || secret?.youtubeId || "ZRtdQ81jPUQ";
        const startSec = question.startSeconds || secret?.startSeconds || 45;
        const endSec = startSec + 5;
        const embedUrl = `https://www.youtube-nocookie.com/embed/${ytId}?start=${startSec}&end=${endSec}&autoplay=1&enablejsapi=1`;

        return (
            <div className="flex flex-col gap-4">
                {/* Audio Cassette Player Card */}
                <div className="bg-[#fffdfa] border-[3px] border-text rounded-3xl p-5 shadow-[4px_4px_0px_#32628f]">
                    {/* Header & Answer Key */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-dashed border-text/20">
                        <div>
                            <span className="font-title text-[11px] font-bold uppercase tracking-wider text-text/70 block mb-0.5">
                                Kunci Jawaban Host:
                            </span>
                            <div className="font-title text-xl font-black text-pink">
                                {secret?.answerKey || "Judul Anime"}
                            </div>
                            {secret?.songTitle && (
                                <div className="text-xs font-bold text-navy mt-0.5">
                                    🎵 Lagu: {secret.songTitle}
                                </div>
                            )}
                        </div>
                        <div className="text-left sm:text-right">
                            <span className="bg-yellow-light border border-text/40 rounded-lg px-2.5 py-1 text-[11px] font-bold text-text inline-flex items-center gap-1 shadow-sm">
                                <i className="fa-solid fa-stopwatch text-navy"></i>
                                <span>Durasi Klip: Tepat 5 Detik ({startSec}s – {endSec}s)</span>
                            </span>
                        </div>
                    </div>

                    {/* Retro Cassette / Audio Interface */}
                    <div className="my-4 bg-blue-light/40 border-2 border-text rounded-2xl p-4 flex flex-col items-center">
                        <div className="w-full flex items-center justify-between px-2 mb-3">
                            <span className="font-title text-xs font-bold text-text flex items-center gap-1.5">
                                <i className="fa-solid fa-headphones text-pink"></i>
                                <span>Audio Opening Player</span>
                            </span>
                            <span className="text-[11px] font-bold text-text/70">
                                {ytPlaying ? `Sedang Memutar (${ytCountdown}s)` : 'Siap Diputar'}
                            </span>
                        </div>

                        {/* Cassette Graphic & Animated Equalizer */}
                        <div className="w-full max-w-sm bg-white border-2 border-text rounded-xl p-3 shadow-[2px_2px_0px_#32628f] flex items-center justify-between gap-3 mb-3">
                            {/* Reel 1 */}
                            <div className={`w-10 h-10 rounded-full border-2 border-text bg-yellow flex items-center justify-center shrink-0 ${ytPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '2s' }}>
                                <div className="w-3 h-3 rounded-full bg-white border border-text"></div>
                            </div>

                            {/* Sound wave equalizer */}
                            <div className="flex-1 flex items-center justify-center gap-1 h-8 px-2 overflow-hidden">
                                {[12, 24, 32, 18, 28, 14, 26, 30, 20, 16].map((h, i) => (
                                    <div 
                                        key={i} 
                                        className={`w-1.5 rounded-full border border-text/40 transition-all duration-150 ${
                                            ytPlaying ? 'bg-pink animate-pulse' : 'bg-gray-300 h-2'
                                        }`}
                                        style={ytPlaying ? { 
                                            height: `${h}px`, 
                                            animationDelay: `${i * 100}ms`,
                                            animationDuration: '600ms'
                                        } : { height: '8px' }}
                                    ></div>
                                ))}
                            </div>

                            {/* Reel 2 */}
                            <div className={`w-10 h-10 rounded-full border-2 border-text bg-pink flex items-center justify-center shrink-0 ${ytPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '2s' }}>
                                <div className="w-3 h-3 rounded-full bg-white border border-text"></div>
                            </div>
                        </div>

                        {/* Audio Progress Bar during 5s Playback */}
                        {ytPlaying && (
                            <div className="w-full max-w-sm bg-white border-2 border-text rounded-full h-3 overflow-hidden mb-3">
                                <div 
                                    className="bg-pink h-full transition-all duration-1000 ease-linear"
                                    style={{ width: `${((5 - ytCountdown) / 5) * 100}%` }}
                                ></div>
                            </div>
                        )}

                        {/* Audio Control Buttons */}
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            {ytPlaying ? (
                                <button
                                    type="button"
                                    onClick={stopYouTubePlay}
                                    className="btn bg-rose-400 text-text border-[3px] border-text rounded-xl px-5 py-2.5 font-title text-sm font-bold shadow-btn hover:bg-rose-500 active:translate-y-[2px] flex items-center gap-2 cursor-pointer transition-all"
                                >
                                    <i className="fa-solid fa-stop text-base"></i>
                                    <span>Hentikan Audio ({ytCountdown}s)</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={startYouTubePlay}
                                    className="btn bg-yellow text-text border-[3px] border-text rounded-xl px-5 py-2.5 font-title text-sm font-bold shadow-btn hover:bg-yellow-light active:translate-y-[2px] flex items-center gap-2 cursor-pointer transition-all"
                                >
                                    <i className="fa-solid fa-play text-base text-navy"></i>
                                    <span>Putar Audio Opening (5 Detik)</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => setYtShowVideo(v => !v)}
                                className="text-[11px] font-bold text-text/70 underline hover:text-text cursor-pointer ml-1"
                            >
                                {ytShowVideo ? 'Sembunyikan Video' : 'Lihat Layar Video'}
                            </button>
                        </div>

                        {/* YouTube Embed Player (Docked / Toggled) */}
                        <div 
                            className={`w-full max-w-sm mt-3 overflow-hidden transition-all duration-300 ${
                                ytShowVideo ? 'max-h-56 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
                            }`}
                        >
                            {ytPlaying && (
                                <div className="border-2 border-text rounded-xl overflow-hidden bg-black aspect-video">
                                    <iframe
                                        src={embedUrl}
                                        title="YouTube Opening Audio Source"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        className="w-full h-full"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Audio stream container when video view is hidden */}
                        {ytPlaying && !ytShowVideo && (
                            <div className="w-1 h-1 overflow-hidden opacity-10 pointer-events-none">
                                <iframe
                                    src={embedUrl}
                                    title="YouTube Opening Audio Stream"
                                    allow="autoplay"
                                    width="1"
                                    height="1"
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        type="button"
                        disabled={!isPlaying || disabled}
                        onClick={() => onCorrect(1)}
                        className="btn bg-green-400 text-text border-[3px] border-text rounded-xl p-3.5 font-title text-base font-bold shadow-btn hover:bg-green-300 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fa-solid fa-check text-lg"></i>
                        <span>Tebakan Benar (Menang)</span>
                    </button>
                    <button
                        type="button"
                        disabled={!isPlaying || disabled}
                        onClick={() => onIncorrect("Tebakan anime opening salah")}
                        className="btn bg-rose-300 text-text border-[3px] border-text rounded-xl p-3.5 font-title text-base font-bold shadow-btn hover:bg-rose-400 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fa-solid fa-xmark text-lg"></i>
                        <span>Tebakan Salah (Gagal)</span>
                    </button>
                </div>
            </div>
        );
    }

    // =========================================================================
    // G06: Character Alphabet Rush (Input + Duplicate + Letter Validation)
    // =========================================================================
    if (gameId === 'G06') {
        const letter = (question.letter || secret?.letter || "S").toUpperCase();
        const currentCount = session?.currentProgress || enteredItems.length;

        return (
            <div className="flex flex-col gap-4">
                <div className="bg-white border-2 border-text rounded-2xl p-4 shadow-[3px_3px_0px_#32628f]">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                            <span className="font-title text-sm font-bold text-text">Huruf Target:</span>
                            <span className="bg-yellow border-2 border-text px-3 py-1 rounded-xl font-title text-2xl font-extrabold text-text shadow-[2px_2px_0px_#32628f]">
                                {letter}
                            </span>
                        </div>
                        <span className="font-title text-2xl font-extrabold text-pink">
                            {currentCount} / 5
                        </span>
                    </div>

                    <div className="w-full bg-blue-light border-2 border-text rounded-full h-4 overflow-hidden mb-3">
                        <div 
                            className="bg-pink h-full transition-all duration-300"
                            style={{ width: `${(Math.min(currentCount, 5) / 5) * 100}%` }}
                        ></div>
                    </div>

                    {/* Anti-Duplicate Input with Letter Validation */}
                    <div className="mb-3">
                        <form 
                            onSubmit={(e) => { e.preventDefault(); handleAddItem(`Karakter awalan ${letter}`); }}
                            className="flex gap-2"
                        >
                            <input
                                type="text"
                                disabled={!isPlaying || disabled}
                                value={inputValue}
                                onChange={(e) => { setInputValue(e.target.value); setDuplicateWarning(''); }}
                                placeholder={`Ketik karakter berawalan "${letter}"...`}
                                className="flex-grow bg-[#f6f9fc] border-2 border-text rounded-xl px-3 py-2 text-sm font-body text-text focus:outline-none focus:ring-2 focus:ring-pink disabled:opacity-50"
                            />
                            <button
                                type="submit"
                                disabled={!isPlaying || disabled || !inputValue.trim()}
                                className="btn bg-pink text-text border-2 border-text rounded-xl px-4 py-2 font-title text-xs font-bold shadow-[2px_2px_0px_#32628f] hover:bg-white active:translate-y-[1px] disabled:opacity-50 cursor-pointer"
                            >
                                <i className="fa-solid fa-plus mr-1"></i> Tambah
                            </button>
                        </form>

                        {duplicateWarning && (
                            <div className="mt-2 bg-rose-100 border-2 border-rose-400 text-rose-800 text-xs font-bold rounded-lg p-2.5 flex items-center gap-2">
                                <i className="fa-solid fa-triangle-exclamation text-rose-600"></i>
                                <span>{duplicateWarning}</span>
                            </div>
                        )}
                    </div>

                    {/* Spoken Chips */}
                    {enteredItems.length > 0 && (
                        <div className="mb-3">
                            <span className="text-[11px] font-bold text-text/70 block mb-1">Karakter Awalan "{letter}" yang Diinput:</span>
                            <div className="flex flex-wrap gap-1.5">
                                {enteredItems.map((item, idx) => (
                                    <span 
                                        key={idx}
                                        className="bg-yellow-light border border-text/40 rounded-lg px-2.5 py-1 text-xs font-bold text-text inline-flex items-center gap-1.5 shadow-[1px_1px_0px_#32628f]"
                                    >
                                        <span>#{idx + 1} {item}</span>
                                        {isPlaying && (
                                            <button 
                                                type="button" 
                                                onClick={() => handleRemoveItem(idx)}
                                                className="text-rose-500 hover:text-rose-700 cursor-pointer"
                                                title="Hapus jika salah input"
                                            >
                                                &times;
                                            </button>
                                        )}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Reference Names for Host */}
                    {secret?.referenceAnswers && (
                        <div className="bg-yellow-light border border-text/30 p-2.5 rounded-xl text-[11px] text-text">
                            <span className="font-bold uppercase tracking-wider block mb-1">Contoh Karakter Awalan "{letter}" (Host Only):</span>
                            <div className="flex flex-wrap gap-1">
                                {secret.referenceAnswers.map((item, idx) => (
                                    <span key={idx} className="bg-white/80 border border-text/20 rounded px-1.5 py-0.5 text-[11px]">
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        type="button"
                        disabled={!isPlaying || disabled}
                        onClick={() => onCorrect(1)}
                        className="btn bg-green-400 text-text border-[3px] border-text rounded-xl p-3.5 font-title text-base font-bold shadow-btn hover:bg-green-300 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fa-solid fa-check text-lg"></i>
                        <span>+1 Karakter Awalan "{letter}"</span>
                    </button>
                    <button
                        type="button"
                        disabled={!isPlaying || disabled}
                        onClick={() => onIncorrect(`Bukan karakter berawalan huruf ${letter} atau duplikat`)}
                        className="btn bg-rose-300 text-text border-[3px] border-text rounded-xl p-3.5 font-title text-base font-bold shadow-btn hover:bg-rose-400 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fa-solid fa-xmark text-lg"></i>
                        <span>Karakter Salah (Gagal)</span>
                    </button>
                </div>
            </div>
        );
    }

    // =========================================================================
    // G07: Three-Hint Character (Panitia Bacakan 3 Petunjuk ke Peserta)
    // =========================================================================
    if (gameId === 'G07') {
        const hints = question.hints || secret?.hints || [
            "Guru di SMA Jujutsu Tokyo yang berambut putih tegak",
            "Selalu memakai penutup mata hitam atau kacamata hitam",
            "Pengguna teknik kutukan Tak Terbatas (Mugen)"
        ];
        const secretChar = secret?.characterName || secret?.answerKey || "Satoru Gojo";
        const secretAnime = secret?.animeOrigin || "Jujutsu Kaisen";

        return (
            <div className="flex flex-col gap-4">
                <div className="bg-white border-2 border-text rounded-2xl p-4 shadow-[3px_3px_0px_#32628f]">
                    <div className="bg-pink-light border-2 border-text rounded-xl p-3 mb-3 text-text">
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-title text-xs font-bold uppercase tracking-wider">
                                <i className="fa-solid fa-bullhorn mr-1.5"></i>
                                Panitia Membacakan Petunjuk ke Peserta:
                            </span>
                            <span className="bg-white border border-text px-2 py-0.5 rounded text-[11px] font-bold">
                                Petunjuk Aktif: {revealedHintIndex} / 3
                            </span>
                        </div>
                        <p className="text-xs opacity-80 leading-relaxed">
                            Bacakan ciri-ciri di bawah kepada peserta satu per satu. Peserta harus menebak nama karakternya sebelum 30 detik!
                        </p>
                    </div>

                    {/* 3 Hints Cards for Host */}
                    <div className="space-y-2 mb-3">
                        {hints.map((hintText, idx) => {
                            const isRevealed = (idx + 1) <= revealedHintIndex;
                            return (
                                <div 
                                    key={idx}
                                    className={`border-2 border-text rounded-xl p-3 transition-all ${
                                        isRevealed ? 'bg-yellow-light/60 shadow-[2px_2px_0px_#32628f]' : 'bg-slate-50 opacity-50'
                                    }`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-title text-xs font-bold text-text">
                                            Petunjuk #{idx + 1}
                                        </span>
                                        {!isRevealed && (
                                            <button
                                                type="button"
                                                onClick={() => setRevealedHintIndex(idx + 1)}
                                                className="btn bg-pink text-text border border-text rounded px-2 py-0.5 text-[10px] font-bold cursor-pointer"
                                            >
                                                Buka Petunjuk Ini
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-xs font-body font-bold text-text">
                                        "{hintText}"
                                    </p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Secret Answer Box (Host Only) */}
                    <div className="bg-green-100 border-2 border-text rounded-xl p-3 text-text">
                        <span className="font-title text-[11px] font-bold text-green-800 uppercase block mb-0.5">
                            Kunci Jawaban Karakter (Host Only):
                        </span>
                        <div className="font-title text-base font-extrabold text-text">
                            {secretChar} <span className="text-xs opacity-75 font-normal">({secretAnime})</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        type="button"
                        disabled={!isPlaying || disabled}
                        onClick={() => onCorrect(1)}
                        className="btn bg-green-400 text-text border-[3px] border-text rounded-xl p-3.5 font-title text-base font-bold shadow-btn hover:bg-green-300 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fa-solid fa-check text-lg"></i>
                        <span>Peserta Berhasil Menebak (Menang)</span>
                    </button>
                    <button
                        type="button"
                        disabled={!isPlaying || disabled}
                        onClick={() => onIncorrect("Peserta salah menebak nama karakter")}
                        className="btn bg-rose-300 text-text border-[3px] border-text rounded-xl p-3.5 font-title text-base font-bold shadow-btn hover:bg-rose-400 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fa-solid fa-xmark text-lg"></i>
                        <span>Tebakan Salah (Gagal)</span>
                    </button>
                </div>
            </div>
        );
    }

    // =========================================================================
    // G08: Act Like That Character! (Pose Demonstration)
    // =========================================================================
    if (gameId === 'G08') {
        return (
            <div className="flex flex-col gap-4">
                <div className="bg-white border-2 border-text rounded-2xl p-4 shadow-[3px_3px_0px_#32628f]">
                    <div className="flex flex-col sm:flex-row gap-4 items-center mb-3">
                        {question.mediaUrl && (
                            <div className="w-28 h-28 border-2 border-text rounded-xl overflow-hidden bg-white shrink-0 shadow-[2px_2px_0px_#32628f] p-1 flex items-center justify-center">
                                <img 
                                    src={question.mediaUrl} 
                                    alt="Pose Reference" 
                                    className="max-w-full max-h-full object-contain"
                                />
                            </div>
                        )}
                        <div className="flex-grow">
                            <span className="font-title text-xs font-bold uppercase tracking-wider block text-text/70 mb-1">Target Karakter & Pose Host:</span>
                            <div className="font-title text-base font-extrabold text-pink mb-1">
                                {question.characterName || secret?.targetCharacter || "Karakter Ikonik"}
                            </div>
                            <div className="text-xs bg-yellow-light border border-text/30 p-2 rounded-lg text-text font-bold">
                                {question.phrasePrompt || secret?.idealCatchphrase || "Pose sesuai gambar"}
                            </div>
                        </div>
                    </div>
                    <div className="text-[11px] opacity-80">
                        <i className="fa-solid fa-info-circle mr-1"></i>
                        <strong>Kriteria Penilaian:</strong> Nilai kemiripan gestur pose atau catchphrase, bukan faktor malu peserta.
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        type="button"
                        disabled={!isPlaying || disabled}
                        onClick={() => onCorrect(1)}
                        className="btn bg-green-400 text-text border-[3px] border-text rounded-xl p-3.5 font-title text-base font-bold shadow-btn hover:bg-green-300 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fa-solid fa-wand-magic-sparkles text-lg"></i>
                        <span>Lulus (Demonstrasi Berhasil)</span>
                    </button>
                    <button
                        type="button"
                        disabled={!isPlaying || disabled}
                        onClick={() => onIncorrect("Gagal memeragakan pose atau menolak demonstrasi")}
                        className="btn bg-rose-300 text-text border-[3px] border-text rounded-xl p-3.5 font-title text-base font-bold shadow-btn hover:bg-rose-400 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fa-solid fa-xmark text-lg"></i>
                        <span>Gagal Demonstrasi</span>
                    </button>
                </div>
            </div>
        );
    }

    // =========================================================================
    // G09: Find the Impostor: Character Edition
    // =========================================================================
    if (gameId === 'G09') {
        const options = question.options || [];
        const impostorIndex = secret?.impostorIndex ?? 2;

        return (
            <div className="flex flex-col gap-4">
                <div className="bg-white border-2 border-text rounded-2xl p-4 shadow-[3px_3px_0px_#32628f]">
                    <span className="font-title text-xs font-bold uppercase tracking-wider block text-text/70 mb-2">5 Opsi Karakter (Impostor Berlatar Hijau Host):</span>
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mb-3">
                        {options.map((opt, idx) => {
                            const isImpostor = idx === impostorIndex;
                            return (
                                <div 
                                    key={idx}
                                    className={`border-2 border-text rounded-xl p-2.5 text-center font-title text-xs font-bold shadow-[2px_2px_0px_#32628f] ${
                                        isImpostor ? 'bg-green-300 text-text ring-2 ring-green-600' : 'bg-white text-text'
                                    }`}
                                >
                                    <span className="block text-[10px] opacity-70 mb-0.5">#{idx + 1}</span>
                                    <span>{opt}</span>
                                    {isImpostor && <span className="block text-[9px] text-green-800 font-extrabold mt-0.5">[IMPOSTOR]</span>}
                                </div>
                            );
                        })}
                    </div>
                    {secret?.explanation && (
                        <div className="text-[11px] bg-yellow-light border border-text/30 p-2 rounded-xl text-text">
                            <strong>Alasan:</strong> {secret.explanation}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        type="button"
                        disabled={!isPlaying || disabled}
                        onClick={() => onCorrect(1)}
                        className="btn bg-green-400 text-text border-[3px] border-text rounded-xl p-3.5 font-title text-base font-bold shadow-btn hover:bg-green-300 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fa-solid fa-check text-lg"></i>
                        <span>Peserta Menunjuk #{impostorIndex + 1} (Menang)</span>
                    </button>
                    <button
                        type="button"
                        disabled={!isPlaying || disabled}
                        onClick={() => onIncorrect("Peserta menunjuk karakter yang salah")}
                        className="btn bg-rose-300 text-text border-[3px] border-text rounded-xl p-3.5 font-title text-base font-bold shadow-btn hover:bg-rose-400 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fa-solid fa-xmark text-lg"></i>
                        <span>Peserta Salah Menunjuk</span>
                    </button>
                </div>
            </div>
        );
    }

    // =========================================================================
    // G10: Find the Impostor: Anime Edition (4 Real Anime + 1 Fictitious Title)
    // =========================================================================
    if (gameId === 'G10') {
        const options = question.options || [];
        const impostorIndex = secret?.impostorIndex ?? 3;

        return (
            <div className="flex flex-col gap-4">
                <div className="bg-white border-2 border-text rounded-2xl p-4 shadow-[3px_3px_0px_#32628f]">
                    <span className="font-title text-xs font-bold uppercase tracking-wider block text-text/70 mb-2">5 Judul Anime (Judul Fiktif Berlatar Hijau Host):</span>
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mb-3">
                        {options.map((opt, idx) => {
                            const isImpostor = idx === impostorIndex;
                            return (
                                <div 
                                    key={idx}
                                    className={`border-2 border-text rounded-xl p-2.5 text-center font-title text-xs font-bold shadow-[2px_2px_0px_#32628f] ${
                                        isImpostor ? 'bg-green-300 text-text ring-2 ring-green-600' : 'bg-white text-text'
                                    }`}
                                >
                                    <span className="block text-[10px] opacity-70 mb-0.5">#{idx + 1}</span>
                                    <span className="leading-tight block">{opt}</span>
                                    {isImpostor && <span className="block text-[9px] text-green-800 font-extrabold mt-0.5">[FIKTIF]</span>}
                                </div>
                            );
                        })}
                    </div>
                    {secret?.explanation && (
                        <div className="text-[11px] bg-yellow-light border border-text/30 p-2 rounded-xl text-text">
                            <strong>Alasan:</strong> {secret.explanation}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        type="button"
                        disabled={!isPlaying || disabled}
                        onClick={() => onCorrect(1)}
                        className="btn bg-green-400 text-text border-[3px] border-text rounded-xl p-3.5 font-title text-base font-bold shadow-btn hover:bg-green-300 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fa-solid fa-check text-lg"></i>
                        <span>Peserta Menunjuk Judul Fiktif #{impostorIndex + 1} (Menang)</span>
                    </button>
                    <button
                        type="button"
                        disabled={!isPlaying || disabled}
                        onClick={() => onIncorrect("Peserta menunjuk anime asli bukan judul fiktif")}
                        className="btn bg-rose-300 text-text border-[3px] border-text rounded-xl p-3.5 font-title text-base font-bold shadow-btn hover:bg-rose-400 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fa-solid fa-xmark text-lg"></i>
                        <span>Peserta Salah Menunjuk</span>
                    </button>
                </div>
            </div>
        );
    }

    return null;
}
