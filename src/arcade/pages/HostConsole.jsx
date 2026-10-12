import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { GAME_DEFINITIONS, ARCADE_GLOBAL_RULES } from '../data/gameConfig.js';
import { 
    getQuestions, 
    getQuestionSecret, 
    updateSessionState, 
    checkParticipantStatus,
    registerParticipantAtomic,
    startSessionAtomic, 
    recordGameOutcome, 
    claimSketchPrize,
    claimStickerPrize,
    seedQuestionBankIfEmpty,
    subscribeEventParticipants,
    claimSketchPrizeByKey 
} from '../services/arcadeDb.js';
import { 
    createIdleSession, 
    prepareSession, 
    startSession, 
    recordCorrectAnswer, 
    recordIncorrectAnswer, 
    recordTimeout, 
    resetSession, 
    calculateRemainingSeconds,
    pickRandomQuestion,
    SESSION_STATES 
} from '../services/arcadeCore.js';
import ChallengeControls from '../components/ChallengeControls.jsx';

export default function HostConsole({ currentUser, userRole, showToast }) {
    // 1. Event & Station Selection State
    const [eventId, setEventId] = useState('CF20');
    const [stationId, setStationId] = useState('station-1');

    // 2. Participant Registration State
    const [rawIdentifier, setRawIdentifier] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [participantStatus, setParticipantStatus] = useState(null); // { checked, hasPlayed, record }
    const [checkingParticipant, setCheckingParticipant] = useState(false);

    // 3. Challenge & Question Selection State
    const [selectedGameId, setSelectedGameId] = useState('G01');
    const [questionsPool, setQuestionsPool] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [secretData, setSecretData] = useState(null);
    const [loadingQuestions, setLoadingQuestions] = useState(true);

    // 4. Session State & Timer
    const [session, setSession] = useState(() => createIdleSession('CF20', 'station-1'));
    const [sessionId, setSessionId] = useState(null);
    const [sessionRevision, setSessionRevision] = useState(1);
    const [remainingSeconds, setRemainingSeconds] = useState(30);
    const [submittingAction, setSubmittingAction] = useState(false);

    // 5. Prize Claim Local State
    const [sketchClaimed, setSketchClaimed] = useState(false);
    const [stickerClaimed, setStickerClaimed] = useState(false);

    // 6. Played Participants History State
    const [playedParticipants, setPlayedParticipants] = useState([]);
    const [participantFilter, setParticipantFilter] = useState('');

    // Timer interval reference
    const timerIntervalRef = useRef(null);

    // Check Role-Based Access: Must be admin or arcade_host
    const hasHostAccess = userRole === 'admin' || userRole === 'arcade_host';

    // Subscribe to played participants for current event
    useEffect(() => {
        const unsubscribe = subscribeEventParticipants(
            eventId,
            (list) => {
                setPlayedParticipants(list);
            },
            (err) => {
                console.warn("Participant subscription error:", err);
            }
        );
        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, [eventId]);

    // Handler: Direct Claim Live Sketch from Table
    const handleClaimSketchDirect = async (participantKey) => {
        try {
            await claimSketchPrizeByKey(participantKey);
            showToast?.("Hadiah Live Sketch berhasil diklaim!", "🎨");
        } catch (e) {
            console.error("Claim sketch error:", e);
            showToast?.(e.message || "Gagal mengklaim hadiah", "⚠️");
        }
    };

    // Load questions on mount or game change
    useEffect(() => {
        let isMounted = true;
        async function loadGameData() {
            setLoadingQuestions(true);
            try {
                await seedQuestionBankIfEmpty();
                const qList = await getQuestions(selectedGameId);
                if (isMounted) {
                    setQuestionsPool(qList);
                    if (qList.length > 0) {
                        const randomQ = pickRandomQuestion(qList);
                        setCurrentQuestion(randomQ);
                        if (randomQ) {
                            const sec = await getQuestionSecret(randomQ.id);
                            setSecretData(sec);
                            if (session.status === SESSION_STATES.IDLE || session.status === SESSION_STATES.READY) {
                                syncReadyStateToDisplay(randomQ, selectedGameId);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error("Failed loading questions:", e);
                showToast?.("Gagal memuat bank soal", "⚠️");
            } finally {
                if (isMounted) setLoadingQuestions(false);
            }
        }

        loadGameData();
        return () => { isMounted = false; };
    }, [selectedGameId]);

    // Timer countdown effect during PLAYING state
    useEffect(() => {
        if (session.status === SESSION_STATES.PLAYING && session.startedAtMs) {
            timerIntervalRef.current = setInterval(() => {
                const remaining = calculateRemainingSeconds(
                    session.startedAtMs, 
                    session.timerDurationSec || 30, 
                    Date.now()
                );
                setRemainingSeconds(remaining);

                if (remaining <= 0) {
                    clearInterval(timerIntervalRef.current);
                    handleSessionTimeout();
                }
            }, 150);
        } else {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            if (session.status === SESSION_STATES.IDLE || session.status === SESSION_STATES.READY) {
                setRemainingSeconds(session.timerDurationSec || 30);
            }
        }

        return () => {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, [session.status, session.startedAtMs]);

    // Handler: Check participant eligibility
    const handleCheckParticipant = async () => {
        if (!rawIdentifier.trim()) {
            showToast?.("Masukkan identitas / handle peserta!", "⚠️");
            return;
        }

        setCheckingParticipant(true);
        try {
            const status = await checkParticipantStatus(eventId, rawIdentifier);
            setParticipantStatus({ checked: true, ...status });
            if (status.hasPlayed) {
                showToast?.(`Peserta sudah bermain di event ini! (${status.record?.playedAt ? new Date(status.record.playedAt).toLocaleTimeString() : ''})`, "🚫");
            } else {
                showToast?.("Peserta memenuhi syarat (Belum pernah bermain).", "✅");
            }
        } catch (e) {
            console.error("Check participant failed", e);
            showToast?.("Gagal memeriksa status peserta", "⚠️");
        } finally {
            setCheckingParticipant(false);
        }
    };

    // Helper: Push READY state preview to Display
    const syncReadyStateToDisplay = async (q = currentQuestion, gId = selectedGameId) => {
        if (!q || session.status === SESSION_STATES.PLAYING) return;
        try {
            const nextRev = sessionRevision + 1;
            setSessionRevision(nextRev);
            const participantTag = displayName.trim() || rawIdentifier.trim() || "Pengunjung Booth";
            await updateSessionState(eventId, stationId, {
                sessionId: sessionId || `ready_${Date.now()}`,
                revision: nextRev,
                status: SESSION_STATES.READY,
                gameId: gId,
                gameTitle: GAME_DEFINITIONS[gId]?.title,
                displayPrompt: q.displayPrompt,
                mediaUrl: q.mediaUrl || null,
                revealedMediaUrl: null,
                displayItems: q.options || null,
                trait: q.trait || null,
                letter: q.letter || null,
                characterName: q.characterName || null,
                phrasePrompt: q.phrasePrompt || null,
                cardReferenceCode: q.cardReferenceCode || null,
                currentProgress: 0,
                targetProgress: q.targetCount || GAME_DEFINITIONS[gId]?.targetCount || 1,
                timerDurationSec: 30,
                participantDisplayTag: participantTag,
                result: null
            });
        } catch (e) {
            console.warn("Sync ready preview failed:", e);
        }
    };

    // Handler: Randomize question within current challenge
    const handlePickRandomQuestion = async () => {
        if (questionsPool.length === 0 || session.status === SESSION_STATES.PLAYING) return;
        const nextQ = pickRandomQuestion(questionsPool, currentQuestion ? [currentQuestion.id] : []);
        if (nextQ) {
            setCurrentQuestion(nextQ);
            const sec = await getQuestionSecret(nextQ.id);
            setSecretData(sec);
            showToast?.(`Soal diacak: ${nextQ.id}`, "🎲");
            if (session.status === SESSION_STATES.IDLE || session.status === SESSION_STATES.READY) {
                await syncReadyStateToDisplay(nextQ, selectedGameId);
            }
        }
    };

    // Handler: Pick specific question directly by clicking pill
    const handleSelectQuestion = async (q) => {
        if (!q || session.status === SESSION_STATES.PLAYING) return;
        setCurrentQuestion(q);
        const sec = await getQuestionSecret(q.id);
        setSecretData(sec);
        showToast?.(`Soal dipilih: ${q.id}`, "🎯");
        if (session.status === SESSION_STATES.IDLE || session.status === SESSION_STATES.READY) {
            await syncReadyStateToDisplay(q, selectedGameId);
        }
    };

    // Handler: Randomize both challenge and question
    const handlePickRandomChallenge = async () => {
        if (session.status === SESSION_STATES.PLAYING) return;
        const keys = Object.keys(GAME_DEFINITIONS);
        const otherKeys = keys.filter(k => k !== selectedGameId);
        const nextGameId = otherKeys[Math.floor(Math.random() * otherKeys.length)] || keys[0];
        setSelectedGameId(nextGameId);
        showToast?.(`Tantangan diacak: ${GAME_DEFINITIONS[nextGameId].title}`, "🎲");
    };

    // Handler: Start Game Session (Transitions to PLAYING)
    const handleStartGame = async () => {
        if (!rawIdentifier.trim()) {
            showToast?.("Wajib mengisi identitas peserta sebelum memulai!", "⚠️");
            return;
        }
        if (participantStatus?.hasPlayed) {
            showToast?.("Peserta ini sudah pernah bermain pada event ini!", "🚫");
            return;
        }
        if (!currentQuestion) {
            showToast?.("Pilih soal terlebih dahulu!", "⚠️");
            return;
        }

        setSubmittingAction(true);
        try {
            const participantTag = displayName.trim() || rawIdentifier.trim();
            const now = Date.now();
            const prep = prepareSession(session, selectedGameId, currentQuestion, participantTag);
            const started = startSession(prep, now);
            const newSessionId = `sess_${now}_${Math.random().toString(36).substring(2, 7)}`;
            const rev = 1;

            setSessionId(newSessionId);
            setSessionRevision(rev);
            setSession(started);
            setRemainingSeconds(started.timerDurationSec || 30);
            setSketchClaimed(false);
            setStickerClaimed(false);

            // Single atomic transaction: Register participant AND set active session in Firestore
            await startSessionAtomic(
                eventId, 
                stationId, 
                rawIdentifier, 
                participantTag, 
                selectedGameId,
                {
                    sessionId: newSessionId,
                    revision: rev,
                    status: SESSION_STATES.PLAYING,
                    gameId: selectedGameId,
                    gameTitle: started.gameTitle,
                    displayPrompt: currentQuestion.displayPrompt,
                    mediaUrl: currentQuestion.mediaUrl || null,
                    revealedMediaUrl: currentQuestion.revealedMediaUrl || null,
                    displayItems: currentQuestion.options || null,
                    trait: currentQuestion.trait || null,
                    letter: currentQuestion.letter || null,
                    characterName: currentQuestion.characterName || null,
                    phrasePrompt: currentQuestion.phrasePrompt || null,
                    cardReferenceCode: currentQuestion.cardReferenceCode || null,
                    currentProgress: 0,
                    targetProgress: started.targetProgress || currentQuestion.targetCount || 1,
                    timerDurationSec: started.timerDurationSec || 30,
                    participantDisplayTag: participantTag,
                    result: null
                }
            );

            showToast?.("Permainan DIMULAI! Timer 30 detik aktif.", "⏱️");
        } catch (error) {
            console.error("Start game failed:", error);
            showToast?.(error.message || "Gagal memulai sesi permainan", "⚠️");
        } finally {
            setSubmittingAction(false);
        }
    };

    // Helper: Build structured answer data for revelation on Display and Host
    const formatRevealedAnswer = (gId, q, sec) => {
        if (!q) return null;
        switch (gId) {
            case 'G01':
                return {
                    title: "Aturan & Kunci Jawaban Valid",
                    text: "Sebutkan 10 judul anime bebas dalam 30 detik",
                    subtitle: "Contoh: One Piece, Naruto, Bleach, Attack on Titan, Jujutsu Kaisen, Spy x Family, Demon Slayer, Haikyuu, Death Note, Gintama",
                    explanation: "Semua judul anime resmi valid; judul franchise yang sama hanya dihitung 1."
                };
            case 'G02':
                return {
                    title: "Contoh Karakter Valid",
                    text: sec?.referenceAnswers?.slice(0, 8)?.join(', ') || "Karakter sesuai ciri",
                    subtitle: `Ciri Target: ${q.trait || 'Sesuai Soal'}`
                };
            case 'G03':
                return {
                    title: "Referensi Genre & Contoh Populer",
                    text: "Shounen, Isekai, Romance, Mecha, Sports, Slice of Life, dll.",
                    subtitle: "Contoh: Naruto, Re:Zero, Kaguya-sama, Gundam, Haikyuu!!"
                };
            case 'G04':
                return {
                    title: "Judul Anime Resmi",
                    text: sec?.answerKey || "Judul Anime",
                    subtitle: sec?.alternativeAnswers ? `Alternatif: ${sec.alternativeAnswers.join(', ')}` : null
                };
            case 'G05':
                return {
                    title: "Judul Anime & Lagu",
                    text: sec?.answerKey || "Judul Anime",
                    subtitle: sec?.songTitle ? `Lagu: ${sec.songTitle}` : null
                };
            case 'G06':
                return {
                    title: `Contoh Karakter Awalan "${q.letter || sec?.letter || 'A'}"`,
                    text: sec?.referenceAnswers?.slice(0, 8)?.join(', ') || "Karakter dengan awalan huruf ini"
                };
            case 'G07':
                return {
                    title: "Karakter Rahasia",
                    text: sec?.characterName || sec?.answerKey || "Nama Karakter",
                    subtitle: sec?.animeOrigin ? `Asal Anime: ${sec.animeOrigin}` : null
                };
            case 'G08':
                return {
                    title: "Karakter & Pose Ikonik",
                    text: q.characterName || sec?.targetCharacter || "Karakter Anime",
                    subtitle: q.phrasePrompt || sec?.idealCatchphrase || "Pose sesuai contoh gambar"
                };
            case 'G09':
                return {
                    title: `Karakter Impostor (Pilihan #${(sec?.impostorIndex ?? 0) + 1})`,
                    text: `${sec?.impostorCharacter || q?.options?.[sec?.impostorIndex || 0]} (${sec?.impostorFranchise || 'Franchise Berbeda'})`,
                    explanation: sec?.explanation || "Berasal dari franchise anime yang berbeda."
                };
            case 'G10':
                return {
                    title: `Judul Anime Fiktif (Pilihan #${(sec?.impostorIndex ?? 0) + 1})`,
                    text: sec?.fictitiousTitle || q?.options?.[sec?.impostorIndex || 0] || "Judul Fiktif",
                    explanation: sec?.explanation || "Judul karangan fiktif, 4 lainnya anime asli."
                };
            default:
                return null;
        }
    };

    // Handler: Correct Answer
    const handleCorrectAnswer = async (incrementBy = 1) => {
        if (session.status !== SESSION_STATES.PLAYING || submittingAction) return;

        try {
            const updated = recordCorrectAnswer(session, incrementBy);
            setSession(updated);
            const nextRev = sessionRevision + 1;
            setSessionRevision(nextRev);

            if (updated.status === SESSION_STATES.WON) {
                // Game Won!
                setSubmittingAction(true);
                const answerReveal = formatRevealedAnswer(selectedGameId, currentQuestion, secretData);
                await recordGameOutcome(eventId, rawIdentifier, 'win', currentUser?.uid || 'host_staff');
                await updateSessionState(eventId, stationId, {
                    sessionId,
                    revision: nextRev,
                    status: SESSION_STATES.WON,
                    result: 'win',
                    currentProgress: updated.currentProgress,
                    revealedMediaUrl: currentQuestion.revealedMediaUrl || null,
                    revealedAnswer: answerReveal,
                    completedAt: new Date().toISOString()
                });
                setStickerClaimed(true); // Sticker is automatic
                showToast?.("SELAMAT! Target tercapai, Peserta MENANG! 🎉", "🏆");
            } else {
                // Update progress in session
                await updateSessionState(eventId, stationId, {
                    sessionId,
                    revision: nextRev,
                    currentProgress: updated.currentProgress
                });
                showToast?.(`+${incrementBy} Benar (${updated.currentProgress}/${updated.targetProgress})`, "✨");
            }
        } catch (e) {
            console.error("Correct answer handler error:", e);
        } finally {
            setSubmittingAction(false);
        }
    };

    // Handler: Incorrect Answer (Instant Loss)
    const handleIncorrectAnswer = async (reason = "Jawaban salah") => {
        if (session.status !== SESSION_STATES.PLAYING || submittingAction) return;

        setSubmittingAction(true);
        try {
            const lost = recordIncorrectAnswer(session, reason);
            setSession(lost);
            const nextRev = sessionRevision + 1;
            setSessionRevision(nextRev);

            const answerReveal = formatRevealedAnswer(selectedGameId, currentQuestion, secretData);
            await recordGameOutcome(eventId, rawIdentifier, 'lose', currentUser?.uid || 'host_staff');
            await updateSessionState(eventId, stationId, {
                sessionId,
                revision: nextRev,
                status: SESSION_STATES.LOST,
                result: 'lose',
                disqualificationReason: reason,
                revealedMediaUrl: currentQuestion.revealedMediaUrl || null,
                revealedAnswer: answerReveal,
                completedAt: new Date().toISOString()
            });
            setStickerClaimed(true); // Sticker is automatic for all participants
            showToast?.(`Peserta GAGAL: ${reason}`, "💔");
        } catch (e) {
            console.error("Incorrect answer error:", e);
        } finally {
            setSubmittingAction(false);
        }
    };

    // Handler: Timeout (Auto Loss)
    const handleSessionTimeout = async () => {
        if (session.status !== SESSION_STATES.PLAYING) return;

        try {
            const timedOut = recordTimeout(session);
            setSession(timedOut);
            const nextRev = sessionRevision + 1;
            setSessionRevision(nextRev);

            const answerReveal = formatRevealedAnswer(selectedGameId, currentQuestion, secretData);
            await recordGameOutcome(eventId, rawIdentifier, 'lose', currentUser?.uid || 'host_staff');
            await updateSessionState(eventId, stationId, {
                sessionId,
                revision: nextRev,
                status: SESSION_STATES.LOST,
                result: 'lose',
                disqualificationReason: "Waktu habis (30 detik)",
                revealedMediaUrl: currentQuestion.revealedMediaUrl || null,
                revealedAnswer: answerReveal,
                completedAt: new Date().toISOString()
            });
            setStickerClaimed(true);
            showToast?.("Waktu HABIS! Sesi selesai.", "⏰");
        } catch (e) {
            console.error("Timeout handling error:", e);
        }
    };

    // Handler: Claim Live Sketch Commission
    const handleClaimSketch = async () => {
        if (session.status !== SESSION_STATES.WON || sketchClaimed || submittingAction) return;
        setSubmittingAction(true);
        try {
            await claimSketchPrize(eventId, rawIdentifier);
            setSketchClaimed(true);
            showToast?.("Hadiah Live Sketch Commission berhasil diklaim! 🎨", "🎁");
        } catch (e) {
            showToast?.(e.message || "Gagal mengklaim hadiah sketch", "⚠️");
        } finally {
            setSubmittingAction(false);
        }
    };

    // Handler: Claim Sticker Freebie
    const handleClaimSticker = async () => {
        if (stickerClaimed || submittingAction) return;
        setSubmittingAction(true);
        try {
            await claimStickerPrize(eventId, rawIdentifier);
            setStickerClaimed(true);
            showToast?.("Sticker Freebie telah diserahkan! 🌸", "🎁");
        } catch (e) {
            showToast?.(e.message || "Gagal mengklaim sticker", "⚠️");
        } finally {
            setSubmittingAction(false);
        }
    };

    // Handler: Reset Session for Next Participant
    const handleResetSession = async () => {
        const idle = resetSession(session);
        setSession(idle);
        setRemainingSeconds(30);
        setRawIdentifier('');
        setDisplayName('');
        setParticipantStatus(null);
        setSketchClaimed(false);
        setStickerClaimed(false);
        const nextRev = sessionRevision + 1;
        setSessionRevision(nextRev);
        setSessionId(null);

        // Reset Firestore session
        try {
            await updateSessionState(eventId, stationId, {
                sessionId: null,
                revision: nextRev,
                status: SESSION_STATES.IDLE,
                gameId: null,
                gameTitle: null,
                displayPrompt: "Menunggu peserta berikutnya...",
                mediaUrl: null,
                revealedMediaUrl: null,
                displayItems: null,
                trait: null,
                letter: null,
                characterName: null,
                phrasePrompt: null,
                cardReferenceCode: null,
                currentProgress: 0,
                targetProgress: 1,
                startedAt: null,
                participantDisplayTag: null,
                result: null
            });
            showToast?.("Sesi di-reset untuk peserta berikutnya.", "🧹");
        } catch (e) {
            console.error("Reset session sync failed", e);
        }
    };

    // --- ACCESS DENIED VIEW ---
    if (!hasHostAccess) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center text-text">
                <div className="bg-white border-[3px] border-text rounded-2xl shadow-card p-8 max-w-md w-full relative">
                    <div className="washi-tape tape-yellow-1 absolute top-[-10px] left-1/2 -translate-x-1/2 h-6 w-24 bg-pink-light"></div>
                    <i className="fa-solid fa-lock text-4xl text-pink mb-3"></i>
                    <h2 className="font-title text-xl font-bold mb-2">Akses Terbatas</h2>
                    <p className="text-sm opacity-80 mb-5">
                        Halaman Host Console hanya dapat diakses oleh staf dengan peran <strong>ADMIN</strong> atau <strong>ARCADE_HOST</strong>.
                    </p>
                    <div className="bg-yellow-light border border-text/20 p-2.5 rounded-lg text-xs font-bold mb-5">
                        Peran Anda saat ini: <span className="uppercase text-pink">{userRole || 'GUEST'}</span>
                    </div>
                    <Link
                        to="/"
                        className="btn bg-pink text-text border-2 border-text rounded-full font-title text-xs px-6 py-2.5 shadow-btn hover:bg-white transition-all inline-flex items-center gap-2"
                    >
                        <i className="fa-solid fa-arrow-left"></i>
                        <span>Kembali ke Terminal POS</span>
                    </Link>
                </div>
            </div>
        );
    }

    const isSessionActive = session.status === SESSION_STATES.PLAYING;
    const isSessionFinished = session.status === SESSION_STATES.WON || session.status === SESSION_STATES.LOST;

    // Filter participants list by search query
    const filteredParticipants = playedParticipants.filter(p => {
        if (!participantFilter.trim()) return true;
        const q = participantFilter.toLowerCase();
        return (
            (p.displayName && p.displayName.toLowerCase().includes(q)) ||
            (p.hashedIdentifier && p.hashedIdentifier.toLowerCase().includes(q)) ||
            (p.gameId && p.gameId.toLowerCase().includes(q))
        );
    });

    return (
        <div className="arcade-host-console flex flex-col gap-5 max-w-[1350px] mx-auto pb-12 font-body text-text">
            
            {/* Top Toolbar: Event, Station, & Status Header */}
            <div className="bg-white border-[3px] border-text rounded-2xl shadow-card p-4 flex flex-wrap justify-between items-center gap-3 relative">
                <div className="washi-tape tape-history absolute top-[-10px] left-8 transform rotate-[-2deg] h-5 w-20 bg-pink-light"></div>
                
                <div className="flex items-center gap-3">
                    <div className="bg-pink text-text border-2 border-text rounded-xl p-2.5 flex items-center justify-center shadow-[2px_2px_0px_#32628f]">
                        <i className="fa-solid fa-gamepad text-xl"></i>
                    </div>
                    <div>
                        <h1 className="font-title text-lg md:text-xl font-bold leading-tight">Host Console • Kanvahati Arcade</h1>
                        <p className="text-xs opacity-75">Panel Kontrol Operator Game & Validasi Hadiah Booth</p>
                    </div>
                </div>

                {/* Event & Station Selector */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 border-2 border-text rounded-lg px-2.5 py-1 bg-yellow-light text-xs font-bold">
                        <span className="opacity-70">Event:</span>
                        <input 
                            type="text" 
                            value={eventId} 
                            disabled={isSessionActive}
                            onChange={(e) => setEventId(e.target.value.toUpperCase())}
                            className="w-16 bg-white border border-text/40 rounded px-1.5 py-0.5 text-center font-title"
                        />
                    </div>
                    <div className="flex items-center gap-1.5 border-2 border-text rounded-lg px-2.5 py-1 bg-blue-light text-xs font-bold">
                        <span className="opacity-70">Stasiun:</span>
                        <select 
                            value={stationId} 
                            disabled={isSessionActive}
                            onChange={(e) => setStationId(e.target.value)}
                            className="bg-white border border-text/40 rounded px-1.5 py-0.5 font-title cursor-pointer"
                        >
                            <option value="station-1">Station 1</option>
                            <option value="station-2">Station 2</option>
                            <option value="station-3">Station 3</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-1.5 border-2 border-text rounded-lg px-2.5 py-1 bg-pink-light text-[11px] font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                        <span>{eventId}_{stationId}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            if (isSessionActive && !window.confirm("Sesi permainan sedang aktif. Yakin ingin membatalkan dan mereset ke status IDLE?")) {
                                return;
                            }
                            handleResetSession();
                        }}
                        className="btn bg-rose-200 hover:bg-rose-300 text-rose-900 border-2 border-text rounded-lg px-2.5 py-1 text-xs font-title font-bold flex items-center gap-1.5 shadow-[2px_2px_0px_#32628f] cursor-pointer transition-transform hover:scale-105"
                        title="Reset sesi stasiun ke IDLE kapan saja"
                    >
                        <i className="fa-solid fa-rotate-left text-rose-700"></i>
                        <span>Reset Sesi</span>
                    </button>
                    <Link
                        to={`/arcade/display?event=${eventId}&station=${stationId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn bg-white hover:bg-yellow-light border-2 border-text rounded-lg px-2.5 py-1 text-xs font-title font-bold flex items-center gap-1.5 shadow-[2px_2px_0px_#32628f] cursor-pointer transition-transform hover:scale-105"
                        title="Buka tampilan layar pengunjung di tab/jendela baru"
                    >
                        <i className="fa-solid fa-display text-pink"></i>
                        <span>Buka Display</span>
                    </Link>
                    <Link
                        to="/arcade/questions"
                        className="btn bg-white hover:bg-pink-light border-2 border-text rounded-lg px-2.5 py-1 text-xs font-title font-bold flex items-center gap-1.5 shadow-[2px_2px_0px_#32628f] cursor-pointer transition-transform hover:scale-105"
                        title="Kelola Bank Soal & Aset Media"
                    >
                        <i className="fa-solid fa-database text-yellow-600"></i>
                        <span>Kelola Soal</span>
                    </Link>
                </div>
            </div>

            {/* Main Console Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                
                {/* LEFT COLUMN: Participant Registration & Challenge Selector (4 Cols) */}
                <div className="lg:col-span-5 flex flex-col gap-5">
                    
                    {/* Participant Registration Card */}
                    <div className="bg-white border-[3px] border-text rounded-2xl shadow-card p-4 relative">
                        <div className="washi-tape tape-yellow-1 absolute top-[-8px] right-8 h-4 w-16 bg-yellow"></div>
                        <h3 className="font-title text-sm font-bold mb-2.5 flex items-center gap-2">
                            <i className="fa-solid fa-user-check text-pink"></i>
                            <span>1. Registrasi Peserta (Minimal PII)</span>
                        </h3>

                        <div className="flex flex-col gap-2.5 text-xs">
                            <div>
                                <label className="font-bold opacity-80 block mb-1">Handle IG / Nomor Antrean *</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        placeholder="@instagram / No. 12"
                                        disabled={isSessionActive}
                                        value={rawIdentifier}
                                        onChange={(e) => {
                                            setRawIdentifier(e.target.value);
                                            setParticipantStatus(null);
                                        }}
                                        className="flex-grow border-2 border-text rounded-xl px-3 py-2 bg-yellow-light/20 outline-none focus:bg-yellow-light"
                                    />
                                    <button
                                        type="button"
                                        disabled={isSessionActive || checkingParticipant}
                                        onClick={handleCheckParticipant}
                                        className="btn bg-blue-light text-text border-2 border-text rounded-xl px-3 py-2 font-title font-bold shadow-[2px_2px_0px_#32628f] hover:bg-yellow cursor-pointer disabled:opacity-50"
                                    >
                                        {checkingParticipant ? <i className="fa-solid fa-spinner fa-spin"></i> : "Cek"}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="font-bold opacity-80 block mb-1">Nama Panggilan (Opsional)</label>
                                <input 
                                    type="text" 
                                    placeholder="Nama Peserta di Booth"
                                    disabled={isSessionActive}
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="w-full border-2 border-text rounded-xl px-3 py-2 bg-yellow-light/20 outline-none focus:bg-yellow-light"
                                />
                            </div>

                            {/* Eligibility Verification Banner */}
                            {participantStatus?.checked && (
                                <div className={`p-2.5 rounded-xl border-2 font-bold text-[11px] flex items-center gap-2 ${
                                    participantStatus.hasPlayed 
                                        ? 'bg-rose-100 border-rose-500 text-rose-800' 
                                        : 'bg-green-100 border-green-600 text-green-800'
                                }`}>
                                    <i className={`fa-solid ${participantStatus.hasPlayed ? 'fa-ban' : 'fa-circle-check'} text-base`}></i>
                                    <span>
                                        {participantStatus.hasPlayed 
                                            ? `Sudah bermain di event ini! (${participantStatus.record?.gameId || 'Sesi Sebelumnya'})`
                                            : "Peserta memenuhi syarat (Belum pernah bermain)."
                                        }
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Challenge Selector Card */}
                    <div className="bg-white border-[3px] border-text rounded-2xl shadow-card p-4 relative flex-grow">
                        <div className="flex justify-between items-center mb-2.5">
                            <h3 className="font-title text-sm font-bold flex items-center gap-2">
                                <i className="fa-solid fa-list-check text-pink"></i>
                                <span>2. Pilih Challenge (10 Pilihan)</span>
                            </h3>
                            <span className="text-[11px] font-title font-bold text-text/60">
                                {selectedGameId} Terpilih
                            </span>
                        </div>

                        {/* 10 Challenge Badges */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            {Object.values(GAME_DEFINITIONS).map((game) => {
                                const isSelected = selectedGameId === game.id;
                                return (
                                    <button
                                        key={game.id}
                                        type="button"
                                        disabled={isSessionActive}
                                        onClick={() => setSelectedGameId(game.id)}
                                        className={`border-2 border-text rounded-xl p-2 text-left transition-all cursor-pointer ${
                                            isSelected 
                                                ? 'bg-pink text-text shadow-[2px_2px_0px_#32628f] font-bold' 
                                                : 'bg-white hover:bg-yellow-light text-text/80'
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="font-title text-[11px]">{game.id}</span>
                                            <span className="text-[9px] bg-white/70 border border-text/20 px-1 rounded">{game.targetCount}x</span>
                                        </div>
                                        <div className="text-[11px] font-title truncate leading-tight mt-0.5">{game.title}</div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Selected Challenge Details */}
                        {GAME_DEFINITIONS[selectedGameId] && (
                            <div className="bg-yellow-light border-2 border-text rounded-xl p-3 text-xs">
                                <div className="font-title font-bold text-pink mb-1">
                                    {GAME_DEFINITIONS[selectedGameId].id} • {GAME_DEFINITIONS[selectedGameId].title}
                                </div>
                                <p className="text-[11.5px] opacity-90 leading-relaxed mb-2">
                                    {GAME_DEFINITIONS[selectedGameId].hostInstruction}
                                </p>
                                <div className="flex justify-between items-center pt-2 border-t border-text/10">
                                    <span className="text-[10px] font-bold opacity-75">
                                        Pool Soal: {questionsPool.length} variasi tersedia
                                    </span>
                                    <span className="text-[10px] font-title font-bold text-pink">
                                        Target: {GAME_DEFINITIONS[selectedGameId].targetCount} Jawaban
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: Active Game Session, Timer & Evaluation Controls (7 Cols) */}
                <div className="lg:col-span-7 flex flex-col gap-5">
                    
                    {/* Live Game Session Card */}
                    <div className="bg-white border-[3px] border-text rounded-2xl shadow-card p-5 relative">
                        <div className="washi-tape tape-ticket absolute top-[-10px] right-12 h-5 w-24"></div>

                        {/* Header Status & Big Timer */}
                        <div className="flex flex-col sm:flex-row justify-between items-center pb-4 mb-4 border-b-2 border-text/10 gap-3">
                            <div>
                                <span className="text-[10px] uppercase font-extrabold tracking-wider opacity-60 block">Status Sesi Stasiun:</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`px-3 py-1 rounded-full border-2 border-text font-title text-xs font-bold uppercase tracking-wider ${
                                        session.status === SESSION_STATES.IDLE ? 'bg-slate-200 text-slate-700' :
                                        session.status === SESSION_STATES.READY ? 'bg-yellow text-text' :
                                        session.status === SESSION_STATES.PLAYING ? 'bg-pink text-text animate-pulse' :
                                        session.status === SESSION_STATES.WON ? 'bg-green-400 text-text' :
                                        'bg-rose-300 text-text'
                                    }`}>
                                        {session.status}
                                    </span>
                                    {session.participantTag && (
                                        <span className="font-title text-sm font-bold text-text truncate max-w-[180px]">
                                             👤 {session.participantTag}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Big 30-Second Timer Display */}
                            <div className="flex items-center gap-3">
                                <div className={`flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-[3px] border-text shadow-[4px_4px_0px_#32628f] transition-all ${
                                    remainingSeconds <= 10 && isSessionActive ? 'bg-rose-200 animate-bounce' : 'bg-yellow-light'
                                }`}>
                                    <span className={`font-title text-4xl font-extrabold ${
                                        remainingSeconds <= 10 && isSessionActive ? 'text-rose-600' : 'text-text'
                                    }`}>
                                        {remainingSeconds}
                                    </span>
                                    <span className="text-[9px] font-bold uppercase tracking-wider opacity-60">Detik</span>
                                </div>
                            </div>
                        </div>

                        {/* Unified Question Controller Bar (Satu Tempat Acak Soal) */}
                        <div className="bg-yellow-light/40 border-2 border-text rounded-2xl p-3 mb-4">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                                <button
                                    type="button"
                                    disabled={isSessionActive || loadingQuestions}
                                    onClick={handlePickRandomQuestion}
                                    className="btn bg-yellow hover:bg-yellow-light text-text border-2 border-text rounded-xl px-4 py-2 font-title text-xs md:text-sm font-bold shadow-[2px_2px_0px_#32628f] hover:translate-y-[-1px] active:translate-y-[1px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 flex-grow"
                                    title="Acak soal dalam challenge ini"
                                >
                                    <i className="fa-solid fa-dice text-lg text-pink"></i>
                                    <span>Acak Soal Baru 🎲</span>
                                    <span className="text-[10px] bg-white border border-text/30 px-2 py-0.5 rounded-full font-bold">
                                        {questionsPool.length} Soal
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    disabled={isSessionActive}
                                    onClick={handlePickRandomChallenge}
                                    className="btn bg-white hover:bg-pink-light text-text border-2 border-text rounded-xl px-3 py-2 font-title text-xs font-bold shadow-[2px_2px_0px_#32628f] hover:translate-y-[-1px] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                                    title="Ganti ke tantangan acak lainnya"
                                >
                                    <i className="fa-solid fa-shuffle text-pink"></i>
                                    <span>Acak Challenge</span>
                                </button>
                            </div>

                            {/* Direct Question Selector Pills */}
                            {questionsPool.length > 1 && (
                                <div className="flex items-center gap-1.5 pt-2 mt-2 border-t border-text/10 overflow-x-auto">
                                    <span className="text-[10px] font-bold opacity-70 shrink-0">Pilih Soal:</span>
                                    {questionsPool.map((q, idx) => {
                                        const isCurrent = currentQuestion?.id === q.id;
                                        return (
                                            <button
                                                key={q.id}
                                                type="button"
                                                disabled={isSessionActive}
                                                onClick={() => handleSelectQuestion(q)}
                                                className={`px-2.5 py-1 rounded-lg border-2 text-[11px] font-title font-bold transition-all shrink-0 cursor-pointer ${
                                                    isCurrent
                                                        ? 'bg-pink text-text border-text shadow-[1.5px_1.5px_0px_#32628f]'
                                                        : 'bg-white text-text/70 border-text/30 hover:border-text hover:text-text'
                                                } disabled:opacity-50`}
                                            >
                                                Soal #{idx + 1}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* PREVIEW OF QUESTIONS & ANSWERS (Before Clicking Start / Host Inspection) */}
                        {!isSessionActive && !isSessionFinished && currentQuestion && (
                            <div className="bg-[#fffdf8] border-[3px] border-text rounded-2xl p-4 shadow-[4px_4px_0px_#32628f] mb-4">
                                {/* Header */}
                                <div className="flex items-center justify-between pb-2.5 mb-3 border-b-2 border-dashed border-text/20">
                                    <div className="flex items-center gap-2">
                                        <span className="bg-yellow border-2 border-text text-text p-1.5 rounded-lg text-xs font-black shadow-[1.5px_1.5px_0px_#32628f]">
                                            <i className="fa-solid fa-eye text-navy"></i>
                                        </span>
                                        <div>
                                            <h4 className="font-title text-xs sm:text-sm font-bold text-navy">
                                                Preview Soal & Kunci Jawaban Host
                                            </h4>
                                            <span className="text-[10px] text-text/70 block">
                                                Periksa tampilan soal peserta dan kunci jawaban sebelum menekan Mulai
                                            </span>
                                        </div>
                                    </div>
                                    <span className="bg-pink-light border border-text/40 px-2 py-0.5 rounded text-[10px] font-title font-bold text-text shrink-0">
                                        {selectedGameId} • {currentQuestion.id}
                                    </span>
                                </div>

                                {/* 1. Tampilan Layar Peserta (Display Preview) */}
                                <div className="bg-blue-light/40 border-2 border-text rounded-xl p-3 mb-3">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[10px] uppercase font-bold text-navy tracking-wider flex items-center gap-1.5">
                                            <i className="fa-solid fa-desktop text-pink"></i>
                                            <span>Tampilan Layar Pengunjung (Display):</span>
                                        </span>
                                        <span className="text-[10px] bg-white border border-text/30 px-2 py-0.5 rounded font-bold">
                                            Target: {currentQuestion.targetCount || GAME_DEFINITIONS[selectedGameId]?.targetCount} Jawaban
                                        </span>
                                    </div>
                                    <p className="font-title text-sm font-bold text-text mb-2 leading-snug">
                                        "{currentQuestion.displayPrompt}"
                                    </p>

                                    {/* Game-specific display preview elements */}
                                    {selectedGameId === 'G04' && currentQuestion.mediaUrl && (
                                        <div className="flex items-center gap-3 bg-white border border-text/30 p-2 rounded-xl">
                                            <img src={currentQuestion.mediaUrl} alt="Cropped Preview" className="w-16 h-16 object-contain rounded border border-text/20 bg-slate-50" />
                                            <span className="text-xs text-text/80">Gambar potongan (cropped) yang tampil di layar pengunjung saat bermain.</span>
                                        </div>
                                    )}

                                    {selectedGameId === 'G06' && currentQuestion.letter && (
                                        <div className="inline-flex items-center gap-2 bg-pink border border-text rounded-lg px-3 py-1 font-title font-black text-sm text-text">
                                            <span>Huruf Target:</span>
                                            <span className="text-xl">"{currentQuestion.letter}"</span>
                                        </div>
                                    )}

                                    {selectedGameId === 'G02' && currentQuestion.trait && (
                                        <div className="inline-flex items-center gap-2 bg-yellow border border-text rounded-lg px-3 py-1 text-xs font-bold text-text">
                                            <span>Ciri Target:</span>
                                            <span className="font-black text-pink">"{currentQuestion.trait}"</span>
                                        </div>
                                    )}

                                    {(selectedGameId === 'G09' || selectedGameId === 'G10') && currentQuestion.options && (
                                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mt-2">
                                            {currentQuestion.options.map((opt, i) => (
                                                <div key={i} className="bg-white border border-text/30 rounded-lg p-1.5 text-center text-[11px] font-bold">
                                                    <span className="text-[9px] text-text/60 block">#{i + 1}</span>
                                                    <span className="truncate block leading-tight">{opt}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {selectedGameId === 'G08' && currentQuestion.mediaUrl && (
                                        <div className="flex items-center gap-3 bg-white border border-text/30 p-2 rounded-xl mt-2">
                                            <img src={currentQuestion.mediaUrl} alt="Pose Preview" className="w-16 h-16 object-contain rounded border border-text/20 bg-slate-50" />
                                            <div className="text-xs">
                                                <strong className="block text-navy">{currentQuestion.characterName}</strong>
                                                <span className="text-text/80">{currentQuestion.phrasePrompt || "Pose sesuai referensi gambar"}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 2. Kunci Jawaban & Panduan Host (Secret Key Preview) */}
                                <div className="bg-yellow-light/70 border-2 border-dashed border-text/70 rounded-xl p-3">
                                    <div className="flex items-center gap-1.5 mb-2 font-title text-xs font-black text-pink uppercase tracking-wider">
                                        <i className="fa-solid fa-key text-yellow-600"></i>
                                        <span>Kunci Jawaban Host (Rahasia Operator):</span>
                                    </div>

                                    {selectedGameId === 'G01' && (
                                        <div className="text-xs space-y-1">
                                            <p className="font-bold text-navy">🎯 10 Judul Anime Bebas (Tanpa Batas Tema/Genre):</p>
                                            <p className="text-text/80 text-[11px]">
                                                Semua judul anime resmi valid. Sequel/franchise yang sama hanya dihitung 1 judul (misal: Naruto & Naruto Shippuden = 1).
                                            </p>
                                        </div>
                                    )}

                                    {selectedGameId === 'G02' && (
                                        <div className="text-xs space-y-1.5">
                                            <div className="font-bold text-navy">
                                                Target: <span className="text-pink font-extrabold">{currentQuestion.trait}</span>
                                            </div>
                                            {secretData?.referenceAnswers && (
                                                <div>
                                                    <span className="font-bold text-text/70 text-[11px] block">Contoh Jawaban Valid:</span>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {secretData.referenceAnswers.map((ans, i) => (
                                                            <span key={i} className="bg-white border border-text/30 px-2 py-0.5 rounded text-[10.5px] font-bold text-text">
                                                                {ans}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {selectedGameId === 'G03' && (
                                        <div className="text-xs space-y-1.5">
                                            <p className="font-bold text-navy">🎯 3 Pasang Genre & Anime Valid:</p>
                                            <p className="text-text/80 text-[11px]">Peserta harus menyebutkan 3 genre berbeda lengkap dengan 1 anime contoh untuk masing-masing genre.</p>
                                            {secretData?.popularGenreReferences && (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-1 bg-white p-2 rounded-lg border border-text/20 max-h-28 overflow-y-auto">
                                                    {Object.entries(secretData.popularGenreReferences).map(([g, a]) => (
                                                        <div key={g} className="text-[10px]">
                                                            <strong className="text-pink">{g}:</strong> {Array.isArray(a) ? a.slice(0, 2).join(', ') : a}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {selectedGameId === 'G04' && (
                                        <div className="text-xs space-y-2">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                <div>
                                                    <span className="text-[10px] text-text/70 uppercase font-bold block">Judul Anime Resmi:</span>
                                                    <span className="font-title text-base font-black text-navy">{secretData?.answerKey || "Judul Anime"}</span>
                                                    {secretData?.alternativeAnswers && (
                                                        <span className="block text-[11px] text-pink font-bold mt-0.5">
                                                            Alternatif: {secretData.alternativeAnswers.join(', ')}
                                                        </span>
                                                    )}
                                                </div>
                                                {currentQuestion.revealedMediaUrl && (
                                                    <div className="shrink-0 flex items-center gap-2 bg-white p-1.5 rounded-xl border border-text/30">
                                                        <img src={currentQuestion.revealedMediaUrl} alt="Uncropped Preview" className="w-16 h-16 object-contain rounded" />
                                                        <span className="text-[10px] text-text/70 pr-2">Gambar Asli (Uncropped)</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {selectedGameId === 'G05' && (
                                        <div className="text-xs space-y-1.5">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div>
                                                    <span className="text-[10px] text-text/70 uppercase font-bold block">Judul Anime:</span>
                                                    <span className="font-title text-base font-black text-pink">{secretData?.answerKey || "Judul Anime"}</span>
                                                </div>
                                                {secretData?.songTitle && (
                                                    <div className="text-right">
                                                        <span className="text-[10px] text-text/70 uppercase font-bold block">Lagu Pembuka:</span>
                                                        <span className="font-bold text-navy">{secretData.songTitle}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="bg-white border border-text/30 rounded-lg p-2 text-[11px] flex items-center justify-between">
                                                <span>🎵 Klip Audio: {secretData?.startSeconds || currentQuestion.startSeconds || 45}s – {(secretData?.startSeconds || currentQuestion.startSeconds || 45) + 5}s (5 Detik)</span>
                                                <span className="text-text/60">YouTube ID: {currentQuestion.youtubeId || secretData?.youtubeId}</span>
                                            </div>
                                        </div>
                                    )}

                                    {selectedGameId === 'G06' && (
                                        <div className="text-xs space-y-1.5">
                                            <div className="font-bold text-navy">
                                                Huruf Awalan: <span className="text-pink font-black text-sm">"{currentQuestion.letter || secretData?.letter}"</span>
                                            </div>
                                            {secretData?.referenceAnswers && (
                                                <div>
                                                    <span className="font-bold text-text/70 text-[11px] block">Contoh Karakter Valid:</span>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {secretData.referenceAnswers.map((ans, i) => (
                                                            <span key={i} className="bg-white border border-text/30 px-2 py-0.5 rounded text-[10.5px] font-bold text-text">
                                                                {ans}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {selectedGameId === 'G07' && (
                                        <div className="text-xs space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <span className="text-[10px] text-text/70 uppercase font-bold block">Karakter Rahasia:</span>
                                                    <span className="font-title text-base font-black text-navy">{secretData?.characterName || "Nama Karakter"}</span>
                                                    {secretData?.animeOrigin && <span className="text-xs text-pink font-bold ml-1.5">({secretData.animeOrigin})</span>}
                                                </div>
                                            </div>
                                            {currentQuestion.hints && (
                                                <div className="space-y-1 mt-1 bg-white p-2 rounded-xl border border-text/30">
                                                    <span className="text-[10.5px] font-bold text-text/80 block">3 Petunjuk yang Dibacakan Panitia:</span>
                                                    {currentQuestion.hints.map((h, i) => (
                                                        <div key={i} className="text-[11px] pl-2 border-l-2 border-pink">
                                                            <strong>#{i + 1}:</strong> "{h}"
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {selectedGameId === 'G08' && (
                                        <div className="text-xs space-y-1.5">
                                            <div>
                                                <span className="text-[10px] text-text/70 uppercase font-bold block">Target Karakter:</span>
                                                <span className="font-title text-base font-black text-pink">{currentQuestion.characterName || secretData?.targetCharacter}</span>
                                            </div>
                                            <div className="bg-white border border-text/30 p-2 rounded-lg text-[11px]">
                                                <strong>Panduan Penilaian Pose:</strong> {currentQuestion.phrasePrompt || secretData?.idealCatchphrase || "Kemiripan gestur atau catchphrase"}
                                            </div>
                                        </div>
                                    )}

                                    {selectedGameId === 'G09' && (
                                        <div className="text-xs space-y-2">
                                            <div className="font-bold text-navy flex items-center justify-between">
                                                <span>Pilihan Karakter (Impostor Berwarna Hijau):</span>
                                                <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-400 text-[10px]">
                                                    Impostor #{ (secretData?.impostorIndex ?? 0) + 1 }
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5">
                                                {currentQuestion.options?.map((opt, i) => {
                                                    const isImp = i === (secretData?.impostorIndex ?? 0);
                                                    return (
                                                        <div key={i} className={`p-2 rounded-lg border text-center ${
                                                            isImp ? 'bg-emerald-200 border-emerald-600 font-black text-emerald-950 shadow-sm' : 'bg-white border-text/30 text-text/75 font-medium'
                                                        }`}>
                                                            <span className="text-[9px] block">#{i + 1}</span>
                                                            <span className="text-xs truncate block">{opt}</span>
                                                            {isImp && <span className="text-[9px] text-emerald-800 block mt-0.5">[IMPOSTOR]</span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {secretData?.explanation && (
                                                <p className="text-[11px] text-text/80 bg-white p-2 rounded border border-text/20">
                                                    <strong>Alasan:</strong> {secretData.explanation}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {selectedGameId === 'G10' && (
                                        <div className="text-xs space-y-2">
                                            <div className="font-bold text-navy flex items-center justify-between">
                                                <span>Pilihan Judul Anime (Fiktif Berwarna Hijau):</span>
                                                <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-400 text-[10px]">
                                                    Fiktif #{ (secretData?.impostorIndex ?? 0) + 1 }
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5">
                                                {currentQuestion.options?.map((opt, i) => {
                                                    const isImp = i === (secretData?.impostorIndex ?? 0);
                                                    return (
                                                        <div key={i} className={`p-2 rounded-lg border text-center ${
                                                            isImp ? 'bg-emerald-200 border-emerald-600 font-black text-emerald-950 shadow-sm' : 'bg-white border-text/30 text-text/75 font-medium'
                                                        }`}>
                                                            <span className="text-[9px] block">#{i + 1}</span>
                                                            <span className="text-xs truncate block leading-tight">{opt}</span>
                                                            {isImp && <span className="text-[9px] text-emerald-800 block mt-0.5">[FIKTIF]</span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {secretData?.explanation && (
                                                <p className="text-[11px] text-text/80 bg-white p-2 rounded border border-text/20">
                                                    <strong>Alasan:</strong> {secretData.explanation}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Action Buttons: START GAME vs EVALUATION CONTROLS */}
                        {!isSessionActive && !isSessionFinished && (
                            <div className="pt-2">
                                <button
                                    type="button"
                                    disabled={submittingAction || participantStatus?.hasPlayed}
                                    onClick={handleStartGame}
                                    className="btn bg-pink text-text border-[3px] border-text rounded-2xl w-full py-4 font-title text-lg font-extrabold shadow-btn hover:bg-white hover:translate-y-[-2px] active:translate-y-[2px] transition-all cursor-pointer flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <i className="fa-solid fa-play text-xl"></i>
                                    <span>MULAI TANTANGAN (30 DETIK)</span>
                                </button>
                                <p className="text-[11px] text-center opacity-70 mt-2 font-medium">
                                    Klik tombol di atas saat peserta sudah siap. Timer 30 detik akan langsung berjalan serentak.
                                </p>
                            </div>
                        )}

                        {/* Challenge-Specific Controls during PLAYING state */}
                        {isSessionActive && (
                            <>
                                <ChallengeControls
                                    gameId={selectedGameId}
                                    question={currentQuestion}
                                    secret={secretData}
                                    session={session}
                                    onCorrect={handleCorrectAnswer}
                                    onIncorrect={handleIncorrectAnswer}
                                    disabled={submittingAction}
                                />
                                <div className="flex justify-end pt-2 border-t border-text/10 mt-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (window.confirm("Yakin ingin membatalkan permainan dan mereset sesi ini ke IDLE?")) {
                                                handleResetSession();
                                            }
                                        }}
                                        className="btn bg-rose-100 hover:bg-rose-200 text-rose-800 border-2 border-text rounded-xl px-3 py-1.5 font-title text-xs font-bold flex items-center gap-1.5 shadow-[1.5px_1.5px_0px_#32628f] cursor-pointer transition-all"
                                    >
                                        <i className="fa-solid fa-rotate-left"></i>
                                        <span>Batalkan & Reset Sesi</span>
                                    </button>
                                </div>
                            </>
                        )}

                        {/* Outcome & Prize Claim Panel when session WON or LOST */}
                        {isSessionFinished && (
                            <div className="flex flex-col gap-4 mt-2 animate-[ticketSlide_0.3s_ease-out]">
                                {/* Banner */}
                                <div className={`border-[3px] border-text rounded-2xl p-4 text-center shadow-[4px_4px_0px_#32628f] ${
                                    session.status === SESSION_STATES.WON 
                                        ? 'bg-green-300 text-text' 
                                        : 'bg-rose-200 text-text'
                                }`}>
                                    <i className={`fa-solid ${session.status === SESSION_STATES.WON ? 'fa-trophy' : 'fa-heart-crack'} text-3xl mb-1`}></i>
                                    <h4 className="font-title text-xl font-extrabold">
                                        {session.status === SESSION_STATES.WON ? "SELAMAT! TARGET TERCAPAI 🎉" : "SESI BERAKHIR / COBA LAGI 💔"}
                                    </h4>
                                    <p className="text-xs font-semibold opacity-85 mt-1">
                                        {session.disqualificationReason || (session.status === SESSION_STATES.WON ? "Peserta berhasil menyelesaikan tantangan tepat waktu!" : "Waktu habis atau jawaban salah.")}
                                    </p>
                                </div>

                                {/* Prize Claim Section */}
                                <div className="bg-white border-2 border-text rounded-xl p-4 shadow-[2px_2px_0px_#32628f]">
                                    <span className="font-title text-xs font-bold uppercase tracking-wider block mb-2 text-text">
                                        <i className="fa-solid fa-gift text-pink mr-1"></i> Penyerahan Hadiah Booth:
                                    </span>

                                    <div className="space-y-2.5">
                                        {/* Free Frame Live Sketch (Winner Only) */}
                                        {session.status === SESSION_STATES.WON && (
                                            <div className="flex items-center justify-between p-2.5 rounded-xl border-2 border-text bg-yellow-light/50">
                                                <div>
                                                    <span className="font-title text-xs font-bold block">1. Free Frame Live Sketch Commission</span>
                                                    <span className="text-[10px] opacity-75">Khusus Pemenang Arcade</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={sketchClaimed || submittingAction}
                                                    onClick={handleClaimSketch}
                                                    className={`px-3 py-1.5 rounded-lg border-2 border-text font-title text-xs font-bold shadow-[1.5px_1.5px_0px_#32628f] cursor-pointer transition-all ${
                                                        sketchClaimed ? 'bg-green-400 text-text cursor-default' : 'bg-pink text-text hover:bg-white'
                                                    }`}
                                                >
                                                    {sketchClaimed ? "✓ Sudah Diserahkan" : "Serahkan Hadiah"}
                                                </button>
                                            </div>
                                        )}

                                        {/* Sticker Freebie (All Participants) */}
                                        <div className="flex items-center justify-between p-2.5 rounded-xl border-2 border-text bg-blue-light/50">
                                            <div>
                                                <span className="font-title text-xs font-bold block">2. Sticker Freebie</span>
                                                <span className="text-[10px] opacity-75">Seluruh Peserta (Menang & Kalah)</span>
                                            </div>
                                            <button
                                                type="button"
                                                disabled={stickerClaimed || submittingAction}
                                                onClick={handleClaimSticker}
                                                className={`px-3 py-1.5 rounded-lg border-2 border-text font-title text-xs font-bold shadow-[1.5px_1.5px_0px_#32628f] cursor-pointer transition-all ${
                                                    stickerClaimed ? 'bg-green-400 text-text cursor-default' : 'bg-yellow text-text hover:bg-white'
                                                }`}
                                            >
                                                {stickerClaimed ? "✓ Sudah Diserahkan" : "Serahkan Sticker"}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Next Session Reset Button */}
                                <button
                                    type="button"
                                    onClick={handleResetSession}
                                    className="btn bg-white text-text border-[3px] border-text rounded-2xl py-3 font-title text-sm font-bold shadow-btn hover:bg-yellow active:translate-y-[2px] transition-all cursor-pointer flex items-center justify-center gap-2"
                                >
                                    <i className="fa-solid fa-rotate-right"></i>
                                    <span>SIAPKAN SESI BERIKUTNYA</span>
                                </button>
                            </div>
                        )}

                    </div>
                </div>

            </div>

            {/* ========================================================================= */}
            {/* SECTION: LIST OF PEOPLE WHO HAVE PLAYED (Arcade Participants Table)       */}
            {/* ========================================================================= */}
            <div className="bg-white border-[3px] border-text rounded-2xl shadow-card p-5 relative mt-2">
                <div className="washi-tape tape-yellow-1 absolute top-[-10px] left-12 h-5 w-28 bg-blue-light"></div>

                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b-2 border-text/10">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="bg-pink text-text border-2 border-text p-1.5 rounded-xl shadow-[2px_2px_0px_#32628f]">
                                <i className="fa-solid fa-users text-sm"></i>
                            </span>
                            <h2 className="font-title text-base sm:text-lg font-bold text-text">
                                Daftar Peserta yang Sudah Bermain • Event {eventId}
                            </h2>
                        </div>
                        <p className="text-xs text-text/70 mt-0.5">
                            Riwayat sesi, hasil menang/kalah, dan status klaim hadiah booth arcade.
                        </p>
                    </div>

                    {/* Search & Refresh Controls */}
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text/50"></i>
                            <input
                                type="text"
                                placeholder="Cari peserta / handle..."
                                value={participantFilter}
                                onChange={(e) => setParticipantFilter(e.target.value)}
                                className="pl-8 pr-3 py-1.5 text-xs bg-yellow-light/20 border-2 border-text rounded-xl focus:bg-white outline-none w-48 sm:w-60 font-body text-text"
                            />
                        </div>
                    </div>
                </div>

                {/* Summary Stats Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
                    <div className="bg-yellow-light border-2 border-text rounded-xl p-2.5 text-center shadow-[2px_2px_0px_#32628f]">
                        <span className="text-[10px] font-bold text-text/70 uppercase block">Total Bermain</span>
                        <span className="font-title text-lg font-extrabold text-navy">{playedParticipants.length}</span>
                    </div>
                    <div className="bg-emerald-100 border-2 border-text rounded-xl p-2.5 text-center shadow-[2px_2px_0px_#32628f]">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase block">Menang (Grand Prize)</span>
                        <span className="font-title text-lg font-extrabold text-emerald-700">
                            {playedParticipants.filter(p => p.result === 'win').length}
                        </span>
                    </div>
                    <div className="bg-rose-100 border-2 border-text rounded-xl p-2.5 text-center shadow-[2px_2px_0px_#32628f]">
                        <span className="text-[10px] font-bold text-rose-800 uppercase block">Kalah / Belum Berhasil</span>
                        <span className="font-title text-lg font-extrabold text-rose-700">
                            {playedParticipants.filter(p => p.result === 'lose').length}
                        </span>
                    </div>
                    <div className="bg-pink-light border-2 border-text rounded-xl p-2.5 text-center shadow-[2px_2px_0px_#32628f]">
                        <span className="text-[10px] font-bold text-text/70 uppercase block">Sketch Terklaim</span>
                        <span className="font-title text-lg font-extrabold text-pink">
                            {playedParticipants.filter(p => p.sketchClaimed).length}
                        </span>
                    </div>
                </div>

                {/* Table */}
                <div className="border-2 border-text rounded-xl overflow-x-auto bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-yellow-light/60 border-b-2 border-text font-title font-bold text-navy">
                                <th className="p-3 w-12 text-center">#</th>
                                <th className="p-3">Waktu</th>
                                <th className="p-3">Peserta</th>
                                <th className="p-3">Stasiun</th>
                                <th className="p-3">Tantangan</th>
                                <th className="p-3 text-center">Hasil</th>
                                <th className="p-3 text-center">Hadiah</th>
                                <th className="p-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-text/15 font-body">
                            {filteredParticipants.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="p-6 text-center text-text/60 italic font-medium">
                                        {playedParticipants.length === 0 
                                            ? `Belum ada peserta yang bermain pada event ${eventId}. Mulai sesi pertama di atas!` 
                                            : "Tidak ada peserta yang cocok dengan filter pencarian."
                                        }
                                    </td>
                                </tr>
                            ) : (
                                filteredParticipants.map((p, idx) => {
                                    const isWin = p.result === 'win';
                                    const isLose = p.result === 'lose';
                                    return (
                                        <tr key={p.id || p.participantKey || idx} className="hover:bg-yellow-light/20 transition-colors">
                                            <td className="p-3 text-center font-bold text-text/60">{idx + 1}</td>
                                            <td className="p-3 whitespace-nowrap">
                                                <span className="font-bold text-text block">
                                                    {p.playedAt ? new Date(p.playedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                </span>
                                                <span className="text-[10px] text-text/60">
                                                    {p.playedAt ? new Date(p.playedAt).toLocaleDateString([], { day: 'numeric', month: 'short' }) : ''}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <span className="font-title font-bold text-navy block text-sm">
                                                    {p.displayName || "Peserta Booth"}
                                                </span>
                                                <span className="text-[10px] text-text/60 font-mono">
                                                    ID: {p.hashedIdentifier ? `${p.hashedIdentifier.substring(0, 8)}...` : '-'}
                                                </span>
                                            </td>
                                            <td className="p-3 font-bold text-text/80 whitespace-nowrap">
                                                {p.stationId || 'Station 1'}
                                            </td>
                                            <td className="p-3">
                                                <span className="bg-blue-light/50 border border-text/30 px-2 py-0.5 rounded font-title text-[11px] font-bold text-text inline-block">
                                                    {p.gameId}: {GAME_DEFINITIONS[p.gameId]?.title || p.gameId || 'Arcade'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center whitespace-nowrap">
                                                {isWin && (
                                                    <span className="bg-emerald-100 text-emerald-800 border-2 border-emerald-600 px-2.5 py-1 rounded-full font-title text-[11px] font-black inline-flex items-center gap-1 shadow-sm">
                                                        <span>🏆 MENANG</span>
                                                    </span>
                                                )}
                                                {isLose && (
                                                    <span className="bg-rose-100 text-rose-800 border-2 border-rose-500 px-2.5 py-1 rounded-full font-title text-[11px] font-black inline-flex items-center gap-1 shadow-sm">
                                                        <span>💔 KALAH</span>
                                                    </span>
                                                )}
                                                {!isWin && !isLose && (
                                                    <span className="bg-yellow text-text border border-text px-2 py-0.5 rounded-full font-title text-[10px] font-bold">
                                                        ⏱️ Bermain
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 text-center whitespace-nowrap">
                                                <div className="flex flex-col items-center gap-1">
                                                    {p.stickerClaimed && (
                                                        <span className="text-[10px] font-bold text-pink bg-pink-light/60 px-2 py-0.5 rounded-full border border-pink/50">
                                                            🌸 Sticker ✓
                                                        </span>
                                                    )}
                                                    {isWin && (
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                                            p.sketchClaimed 
                                                                ? 'bg-yellow text-text border-text' 
                                                                : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                                        }`}>
                                                            🎨 Sketch {p.sketchClaimed ? '✓' : '(Belum Klaim)'}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3 text-center whitespace-nowrap">
                                                {isWin && !p.sketchClaimed ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleClaimSketchDirect(p.participantKey || p.id)}
                                                        className="btn bg-yellow hover:bg-yellow-light text-text border-2 border-text rounded-lg px-2.5 py-1 text-[11px] font-title font-bold shadow-[1.5px_1.5px_0px_#32628f] cursor-pointer"
                                                    >
                                                        Klaim Sketch
                                                    </button>
                                                ) : (
                                                    <span className="text-[11px] text-text/40 font-bold">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
