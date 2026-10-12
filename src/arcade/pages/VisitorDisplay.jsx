import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GAME_DEFINITIONS } from '../data/gameConfig.js';
import { 
    subscribeToStationSession, 
    calculateSynchronizedRemaining, 
    getEstimatedServerClockOffset 
} from '../services/arcadeSync.js';

export default function VisitorDisplay({ currentUser, userRole, showToast }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const eventId = searchParams.get('event') || 'CF20';
    const stationId = searchParams.get('station') || 'station-1';

    // Real-Time Session State from Firestore
    const [sessionData, setSessionData] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'online' | 'offline' | 'connecting'
    const [lastSyncTime, setLastSyncTime] = useState(null);
    const [clockOffsetMs, setClockOffsetMs] = useState(0);

    // Synchronized Countdown State
    const [remainingSeconds, setRemainingSeconds] = useState(30);
    const [timerProgress, setTimerProgress] = useState(0);

    // Fullscreen state
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef(null);
    const snapshotMetaRef = useRef({ receivePerfTime: Date.now() });

    // 1. Clock skew calibration on mount
    useEffect(() => {
        let isMounted = true;
        getEstimatedServerClockOffset().then(offset => {
            if (isMounted) {
                setClockOffsetMs(offset);
            }
        });
        return () => { isMounted = false; };
    }, []);

    // 2. Fullscreen event listener
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // 3. Online / Offline network listeners
    useEffect(() => {
        const handleOnline = () => setConnectionStatus('online');
        const handleOffline = () => setConnectionStatus('offline');
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // 4. Real-time Firestore onSnapshot Subscription
    useEffect(() => {
        setConnectionStatus('connecting');
        const unsubscribe = subscribeToStationSession(
            eventId,
            stationId,
            (safeData, meta) => {
                setSessionData(safeData);
                setConnectionStatus('online');
                setLastSyncTime(new Date());
                snapshotMetaRef.current = meta || { receivePerfTime: performance.now() };
            },
            (error) => {
                console.error("[Display] Subscription error:", error);
                setConnectionStatus('offline');
            }
        );

        return () => {
            unsubscribe();
        };
    }, [eventId, stationId]);

    const demoStatus = searchParams.get('demoStatus');
    const demoGame = searchParams.get('demoGame');
    const demoProgress = searchParams.get('demoProgress') ? Number(searchParams.get('demoProgress')) : 0;

    const currentStatus = (demoStatus || sessionData?.status || 'idle').toLowerCase();
    const activeGameId = demoGame || sessionData?.gameId || 'G01';
    const currentGameDef = GAME_DEFINITIONS[activeGameId] || null;

    const effectiveSession = demoStatus ? {
        ...(sessionData || {}),
        status: currentStatus,
        gameId: activeGameId,
        gameTitle: currentGameDef?.title || 'Tantangan Anime',
        displayPrompt: currentGameDef?.displayInstruction || 'Tantangan Seru Arcade!',
        targetProgress: currentGameDef?.targetCount || 1,
        currentProgress: demoProgress,
        timerDurationSec: 30,
        participantDisplayTag: searchParams.get('demoTag') || 'Mika-chan',
        revealedMediaUrl: '/arcade/revealed_placeholder.svg',
        mediaUrl: '/arcade/cropped_placeholder.svg',
        trait: 'Rambut Putih / Perak',
        letter: 'S',
        characterName: 'Sailor Moon (Usagi Tsukino)',
        phrasePrompt: 'Dengan kekuatan bulan, aku akan menghukummu!',
        cardReferenceCode: 'CARD-G07-001',
        disqualificationReason: 'Waktu Habis (30 detik)',
        options: [
            "Monkey D. Luffy",
            "Roronoa Zoro",
            "Naruto Uzumaki",
            "Vinsmoke Sanji",
            "Nami"
        ]
    } : sessionData;

    // 5. Synchronized Countdown Animation Frame Loop
    useEffect(() => {
        let animFrameId;

        const updateTimer = () => {
            const activeSessionObj = effectiveSession || sessionData;
            const normStatus = (activeSessionObj?.status || '').toLowerCase();

            if (activeSessionObj && normStatus === 'playing') {
                const sync = calculateSynchronizedRemaining(
                    activeSessionObj,
                    clockOffsetMs,
                    snapshotMetaRef.current?.receivePerfTime || null
                );
                setRemainingSeconds(sync.remainingSeconds);
                setTimerProgress(sync.progressPercent);
            } else {
                setRemainingSeconds(activeSessionObj?.timerDurationSec || 30);
                setTimerProgress(0);
            }
            animFrameId = requestAnimationFrame(updateTimer);
        };

        animFrameId = requestAnimationFrame(updateTimer);
        return () => cancelAnimationFrame(animFrameId);
    }, [sessionData, effectiveSession, clockOffsetMs]);

    // Fullscreen Toggle Handler
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            if (containerRef.current?.requestFullscreen) {
                containerRef.current.requestFullscreen().catch(err => {
                    console.warn("Fullscreen request error:", err);
                });
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    return (
        <div 
            ref={containerRef}
            className="visitor-display-root min-h-screen w-full bg-[#f6f9fc] flex flex-col font-body text-text relative overflow-x-hidden select-none"
            style={{
                backgroundImage: 'radial-gradient(#87BAE9 1.2px, transparent 1.2px), radial-gradient(#F79DC3 1.2px, #f6f9fc 1.2px)',
                backgroundSize: '40px 40px',
                backgroundPosition: '0 0, 20px 20px'
            }}
        >
            {/* Top Kiosk Bar */}
            <header className="kiosk-header w-full bg-white/95 backdrop-blur-sm border-b-[3px] border-text px-4 py-2.5 flex justify-between items-center shadow-[0_4px_0px_#32628f] z-40 shrink-0">
                <div className="flex items-center gap-3">
                    <img 
                        src="/kanvahati-logo.png" 
                        alt="Kanvahati Logo" 
                        className="h-8 md:h-10 object-contain drop-shadow-sm"
                    />
                    <div className="flex items-center gap-2">
                        <span className="font-title text-sm md:text-base font-bold text-text tracking-wide">
                            KANVAHATI ARCADE
                        </span>
                        <span className="hidden sm:inline-block bg-yellow text-text border-2 border-text rounded-full px-2.5 py-0.5 text-[11px] font-title font-bold shadow-[1.5px_1.5px_0px_#32628f]">
                            {eventId} • {stationId.toUpperCase()}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                    {/* Connection Status Indicator */}
                    <div className={`connection-pill flex items-center gap-1.5 border-2 border-text rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-[1.5px_1.5px_0px_#32628f] ${
                        connectionStatus === 'online' ? 'bg-green-100 text-green-800' :
                        connectionStatus === 'connecting' ? 'bg-yellow-light text-amber-800' : 'bg-red-100 text-red-800'
                    }`}>
                        <span className={`w-2 h-2 rounded-full ${
                            connectionStatus === 'online' ? 'bg-green-500 animate-pulse' :
                            connectionStatus === 'connecting' ? 'bg-amber-500' : 'bg-red-500'
                        }`}></span>
                        <span className="hidden md:inline font-title">
                            {connectionStatus === 'online' ? 'ONLINE' : connectionStatus === 'connecting' ? 'CONNECTING' : 'OFFLINE'}
                        </span>
                    </div>

                    {/* Station Switcher (Dropdown for testing or booth setup) */}
                    <select
                        value={stationId}
                        onChange={(e) => setSearchParams({ event: eventId, station: e.target.value })}
                        className="bg-white border-2 border-text rounded-lg px-2 py-0.5 text-[11px] font-title font-bold text-text cursor-pointer hover:bg-yellow-light"
                        title="Pilih Stasiun Kiosk"
                    >
                        <option value="station-1">Stasiun 1</option>
                        <option value="station-2">Stasiun 2</option>
                        <option value="station-3">Stasiun 3</option>
                    </select>

                    {/* Fullscreen Button */}
                    <button
                        onClick={toggleFullscreen}
                        className="btn bg-pink text-text border-2 border-text rounded-lg px-2.5 py-1 text-xs font-title font-bold flex items-center gap-1.5 shadow-[2px_2px_0px_#32628f] hover:bg-white transition-all cursor-pointer"
                        title={isFullscreen ? "Keluar Fullscreen" : "Layar Penuh (Kiosk)"}
                    >
                        <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'}`}></i>
                        <span className="hidden sm:inline">{isFullscreen ? 'Keluar' : 'Fullscreen'}</span>
                    </button>
                </div>
            </header>

            {/* Offline Alert Warning Banner */}
            {connectionStatus === 'offline' && (
                <div className="bg-red-500 text-white font-title text-xs md:text-sm font-bold py-1.5 px-4 text-center border-b-2 border-text shadow-md flex items-center justify-center gap-2">
                    <i className="fa-solid fa-triangle-exclamation animate-bounce"></i>
                    <span>Koneksi terputus! Mencoba menghubungkan kembali ke Host Console...</span>
                </div>
            )}

            {/* Main Stage View Area */}
            <main className="flex-grow flex flex-col justify-center items-center p-3 sm:p-6 md:p-8 max-w-[1280px] mx-auto w-full relative">
                
                {/* 1. IDLE STATE: Attractive Booth Welcome Screen */}
                {currentStatus === 'idle' && (
                    <IdleScreen eventId={eventId} stationId={stationId} />
                )}

                {/* 2. READY STATE: Challenge Preview / Introduction */}
                {currentStatus === 'ready' && (
                    <ReadyScreen session={effectiveSession} gameDef={currentGameDef} />
                )}

                {/* 3. PLAYING STATE: Live 30s Challenge Stage */}
                {currentStatus === 'playing' && (
                    <PlayingScreen 
                        session={effectiveSession} 
                        gameDef={currentGameDef} 
                        remainingSeconds={demoStatus ? 24 : remainingSeconds}
                        timerProgress={demoStatus ? 20 : timerProgress}
                    />
                )}

                {/* 4. WON STATE: Celebratory Winning Showcase */}
                {currentStatus === 'won' && (
                    <WonScreen session={effectiveSession} gameDef={currentGameDef} />
                )}

                {/* 5. LOST STATE: Consolation / Next Time Screen */}
                {currentStatus === 'lost' && (
                    <LostScreen session={effectiveSession} gameDef={currentGameDef} />
                )}

            </main>

            {/* Kiosk Footer: Subtle Branding */}
            <footer className="w-full text-center py-2 text-[11px] font-bold opacity-60 text-text tracking-wider shrink-0">
                KANVAHATI ARTIST CIRCLE • ARCADE LIVE BOOTH EXPERIENCE
            </footer>
        </div>
    );
}

/**
 * -------------------------------------------------------------
 * 1. IDLE SCREEN COMPONENT
 * -------------------------------------------------------------
 */
function IdleScreen({ eventId, stationId }) {
    return (
        <div className="w-full max-w-4xl flex flex-col items-center text-center animate-[fadeIn_0.5s_ease-out]">
            {/* Header Kawaii Badge */}
            <div className="inline-flex items-center gap-2 bg-yellow border-[3px] border-text rounded-full px-4 py-1.5 shadow-[3px_3px_0px_#32628f] mb-4">
                <span className="text-base">✨</span>
                <span className="font-title text-xs sm:text-sm font-bold uppercase tracking-wider">
                    Anime & Fandom Mini-Challenge
                </span>
                <span className="text-base">✨</span>
            </div>

            {/* Main Title Banner */}
            <h1 className="font-title text-3xl sm:text-5xl md:text-6xl text-text font-black mb-3 tracking-tight leading-tight drop-shadow-[2px_2px_0px_#FAF0C4]">
                KANVAHATI ARCADE 🎮
            </h1>
            <p className="font-body text-sm sm:text-base md:text-lg text-text/80 max-w-2xl mb-8 font-medium">
                Uji wawasan anime dan fandom favoritmu dalam 30 detik! Dapatkan hadiah spesial live sketch dan freebies eksklusif dari Kanvahati!
            </p>

            {/* 4 Feature Info Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 w-full mb-8">
                <div className="bg-white border-[3px] border-text rounded-2xl p-4 shadow-[4px_4px_0px_#32628f] flex flex-col items-center">
                    <span className="text-3xl mb-2">🎲</span>
                    <h3 className="font-title text-sm sm:text-base font-bold text-text mb-1">10 Tantangan</h3>
                    <p className="text-[11px] text-text/70 leading-snug">Speedrun, Guess OP, Dere Rubric, Impostor, dll.</p>
                </div>
                <div className="bg-white border-[3px] border-text rounded-2xl p-4 shadow-[4px_4px_0px_#32628f] flex flex-col items-center">
                    <span className="text-3xl mb-2">⏱️</span>
                    <h3 className="font-title text-sm sm:text-base font-bold text-text mb-1">Batas 30 Detik</h3>
                    <p className="text-[11px] text-text/70 leading-snug">Timer cepat tanpa jeda, tanpa hint bantuan teman.</p>
                </div>
                <div className="bg-white border-[3px] border-text rounded-2xl p-4 shadow-[4px_4px_0px_#32628f] flex flex-col items-center">
                    <span className="text-3xl mb-2">🎨</span>
                    <h3 className="font-title text-sm sm:text-base font-bold text-text mb-1">Hadiah Menang</h3>
                    <p className="text-[11px] text-text/70 leading-snug">Free Frame Live Sketch Commission + Sticker!</p>
                </div>
                <div className="bg-white border-[3px] border-text rounded-2xl p-4 shadow-[4px_4px_0px_#32628f] flex flex-col items-center">
                    <span className="text-3xl mb-2">🎁</span>
                    <h3 className="font-title text-sm sm:text-base font-bold text-text mb-1">Hadiah Kalah</h3>
                    <p className="text-[11px] text-text/70 leading-snug">Semua peserta tetap mendapat Sticker Freebie!</p>
                </div>
            </div>

            {/* Waiting for Host Callout Pulse Card */}
            <div className="w-full max-w-lg bg-pink-light/60 border-[3px] border-text rounded-2xl p-5 shadow-[4px_4px_0px_#32628f] flex items-center justify-center gap-3 animate-pulse">
                <i className="fa-solid fa-gamepad text-2xl text-pink animate-bounce"></i>
                <div className="text-left">
                    <div className="font-title text-sm sm:text-base font-bold text-text">
                        Menunggu Panitia Memulai Sesi...
                    </div>
                    <div className="text-xs text-text/75">
                        Daftarkan namamu ke Host di booth untuk bersiap memulai tantangan!
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * -------------------------------------------------------------
 * 2. READY SCREEN COMPONENT (Challenge Introduction)
 * -------------------------------------------------------------
 */
function ReadyScreen({ session, gameDef }) {
    const gameId = session?.gameId || 'G01';
    const gameTitle = session?.gameTitle || gameDef?.title || 'Tantangan Anime';

    return (
        <div className="w-full max-w-3xl flex flex-col items-center text-center animate-[scaleUp_0.4s_cubic-bezier(0.175,0.885,0.32,1.15)]">
            {/* Booth Status Badge (No Personal Names on Display) */}
            <div className="inline-flex items-center gap-2 bg-blue-light border-[3px] border-text rounded-full px-5 py-1.5 shadow-[3px_3px_0px_#32628f] mb-4">
                <i className="fa-solid fa-gamepad text-sm"></i>
                <span className="font-title text-sm sm:text-base font-bold text-text uppercase tracking-wider">
                    GILIRAN BERMAIN
                </span>
            </div>

            {/* Challenge Title Card */}
            <div className="w-full bg-white border-[4px] border-text rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0px_#32628f] relative mb-6">
                <div className="washi-tape tape-yellow-1 absolute top-[-14px] left-1/2 -translate-x-1/2 h-7 w-32 bg-yellow"></div>
                
                <span className="inline-block bg-pink text-text border-2 border-text rounded-full px-3 py-1 font-title text-xs font-bold mb-3 shadow-[1.5px_1.5px_0px_#32628f]">
                    {gameId} • 30 DETIK
                </span>
                
                <h2 className="font-title text-2xl sm:text-4xl text-text font-black mb-4">
                    {gameTitle}
                </h2>

                {/* Instruction Box */}
                <div className="bg-yellow-light/50 border-2 border-text rounded-2xl p-4 sm:p-5 text-sm sm:text-lg font-medium text-text mb-4">
                    {session?.displayPrompt || gameDef?.displayInstruction}
                </div>

                {/* Target badge */}
                <div className="flex justify-center items-center gap-4 text-xs sm:text-sm font-bold opacity-80">
                    <span className="flex items-center gap-1.5">
                        <i className="fa-solid fa-bullseye text-pink"></i>
                        Target: {session?.targetProgress || gameDef?.targetCount || 1}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <i className="fa-solid fa-clock text-blue"></i>
                        Durasi: 30 Detik
                    </span>
                </div>
            </div>

            {/* Countdown Ready Pulsing Card */}
            <div className="inline-flex items-center gap-3 bg-yellow border-[3px] border-text rounded-full px-6 py-2.5 shadow-[4px_4px_0px_#32628f] animate-bounce">
                <i className="fa-solid fa-flag-checkered text-xl text-text"></i>
                <span className="font-title text-sm sm:text-base font-bold text-text">
                    BERSIAP! Game akan segera dimulai oleh Host...
                </span>
            </div>
        </div>
    );
}

/**
 * -------------------------------------------------------------
 * 3. PLAYING SCREEN COMPONENT (Dedicated 10 Challenges UI)
 * -------------------------------------------------------------
 */
function PlayingScreen({ session, gameDef, remainingSeconds, timerProgress }) {
    const isUrgent = remainingSeconds <= 10;
    const gameId = session?.gameId || 'G01';
    const currentProgress = session?.currentProgress || 0;
    const targetProgress = session?.targetProgress || gameDef?.targetCount || 1;

    return (
        <div className="w-full max-w-4xl flex flex-col items-center">
            
            {/* Top Challenge Header & Live Timer Grid */}
            <div className="w-full flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                {/* Challenge Info Badge */}
                <div className="bg-white border-[3px] border-text rounded-2xl px-5 py-2.5 shadow-[4px_4px_0px_#32628f] flex items-center gap-3 w-full sm:w-auto">
                    <div className="w-10 h-10 rounded-xl bg-pink border-2 border-text flex items-center justify-center font-title font-black text-text shadow-[1.5px_1.5px_0px_#32628f] text-sm shrink-0">
                        {gameId}
                    </div>
                    <div>
                        <div className="font-title text-base sm:text-lg font-bold text-text leading-tight">
                            {session?.gameTitle || gameDef?.title}
                        </div>
                        <div className="text-xs text-text/70 font-semibold">
                            Target: <span className="text-pink font-bold">{targetProgress}</span> • Batas Waktu: 30 Detik
                        </div>
                    </div>
                </div>

                {/* Big 30-Second Countdown Timer Card */}
                <div className={`countdown-card border-[3px] border-text rounded-2xl px-6 py-2 shadow-[4px_4px_0px_#32628f] flex items-center gap-3 transition-colors duration-300 w-full sm:w-auto justify-center ${
                    isUrgent ? 'bg-red-400 text-white animate-pulse' : 'bg-yellow text-text'
                }`}>
                    <i className={`fa-solid fa-stopwatch text-2xl ${isUrgent ? 'animate-spin' : ''}`}></i>
                    <div className="flex flex-col items-center">
                        <span className="font-title text-3xl sm:text-4xl font-black tracking-tight leading-none">
                            {remainingSeconds}s
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-85">
                            {remainingSeconds > 0 ? 'Sisa Waktu' : 'Waktu Habis'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Dedicated Challenge Center Stage */}
            <div className="w-full bg-white border-[4px] border-text rounded-3xl p-5 sm:p-7 shadow-[8px_8px_0px_#32628f] relative mb-6">
                <div className="washi-tape tape-yellow-1 absolute top-[-14px] left-1/2 -translate-x-1/2 h-7 w-32 bg-pink-light"></div>

                {/* Render Challenge-Specific View */}
                {gameId === 'G01' && (
                    <G01DisplayView session={session} currentProgress={currentProgress} targetProgress={targetProgress} />
                )}
                {gameId === 'G02' && (
                    <G02DisplayView session={session} currentProgress={currentProgress} targetProgress={targetProgress} />
                )}
                {gameId === 'G03' && (
                    <G03DisplayView session={session} currentProgress={currentProgress} targetProgress={targetProgress} />
                )}
                {gameId === 'G04' && (
                    <G04DisplayView session={session} />
                )}
                {gameId === 'G05' && (
                    <G05DisplayView session={session} />
                )}
                {gameId === 'G06' && (
                    <G06DisplayView session={session} currentProgress={currentProgress} targetProgress={targetProgress} />
                )}
                {gameId === 'G07' && (
                    <G07DisplayView session={session} currentProgress={currentProgress} />
                )}
                {gameId === 'G08' && (
                    <G08DisplayView session={session} />
                )}
                {gameId === 'G09' && (
                    <G09DisplayView session={session} />
                )}
                {gameId === 'G10' && (
                    <G10DisplayView session={session} />
                )}
            </div>

            {/* Timer Progress Bar */}
            <div className="w-full bg-white border-2 border-text rounded-full h-4 overflow-hidden shadow-[2px_2px_0px_#32628f] p-0.5">
                <div 
                    className={`h-full rounded-full transition-all duration-200 ${
                        isUrgent ? 'bg-red-500' : 'bg-pink'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, 100 - timerProgress))}%` }}
                ></div>
            </div>
        </div>
    );
}

/**
 * G01: Anime Speedrun — 10 Anime Instruction & Progress 0/10
 */
function G01DisplayView({ session, currentProgress, targetProgress }) {
    return (
        <div className="flex flex-col items-center text-center">
            <h3 className="font-title text-xl sm:text-2xl font-bold text-text mb-2">
                {session?.displayPrompt || "Sebutkan 10 judul anime berbeda secara lisan!"}
            </h3>
            <p className="text-xs sm:text-sm text-text/70 mb-6 bg-yellow-light/60 border border-text/20 rounded-xl px-4 py-1.5">
                💡 Aturan: Sequel atau season dari franchise yang sama dihitung sebagai 1 anime.
            </p>

            {/* 10 Bubble Counter Slots */}
            <div className="w-full max-w-xl">
                <div className="flex justify-between items-center mb-2 px-1">
                    <span className="font-title text-xs font-bold text-text">Progres Jawaban</span>
                    <span className="font-title text-sm font-bold text-pink">{currentProgress} / 10 Anime</span>
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                    {Array.from({ length: 10 }).map((_, idx) => {
                        const isDone = idx < currentProgress;
                        return (
                            <div 
                                key={idx}
                                className={`h-11 rounded-xl border-2 border-text flex items-center justify-center font-title font-bold text-sm shadow-[2px_2px_0px_#32628f] transition-all ${
                                    isDone ? 'bg-green-400 text-white scale-105' : 'bg-blue-light/30 text-text/40'
                                }`}
                            >
                                {isDone ? '✓' : idx + 1}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/**
 * G02: Character Hunt — Trait & Progress 0/5
 */
function G02DisplayView({ session, currentProgress, targetProgress }) {
    const trait = session?.trait || "Rambut Putih / Perak";
    return (
        <div className="flex flex-col items-center text-center">
            <h3 className="font-title text-lg sm:text-xl font-bold text-text mb-2">
                Sebutkan 5 karakter anime dengan ciri target:
            </h3>
            
            {/* Big Trait Badge */}
            <div className="bg-yellow border-[3px] border-text rounded-2xl px-6 py-3 shadow-[4px_4px_0px_#32628f] mb-6">
                <span className="font-title text-2xl sm:text-3xl font-black text-text">
                    "{trait}"
                </span>
            </div>

            {/* 5 Progress Slots */}
            <div className="w-full max-w-md">
                <div className="flex justify-between items-center mb-2 px-1">
                    <span className="font-title text-xs font-bold text-text">Karakter Terverifikasi</span>
                    <span className="font-title text-sm font-bold text-pink">{currentProgress} / 5</span>
                </div>
                <div className="grid grid-cols-5 gap-3">
                    {Array.from({ length: 5 }).map((_, idx) => {
                        const isDone = idx < currentProgress;
                        return (
                            <div 
                                key={idx}
                                className={`h-12 rounded-xl border-2 border-text flex items-center justify-center font-title font-bold text-base shadow-[2px_2px_0px_#32628f] transition-all ${
                                    isDone ? 'bg-green-400 text-white scale-105' : 'bg-blue-light/30 text-text/40'
                                }`}
                            >
                                {isDone ? '✓' : idx + 1}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/**
 * G03: Anime Genre Explorer — 3 Genres & Anime Examples
 */
function G03DisplayView({ session, currentProgress, targetProgress }) {
    return (
        <div className="flex flex-col items-center text-center">
            <h3 className="font-title text-xl sm:text-2xl font-bold text-text mb-2">
                Sebutkan 3 Genre Anime Berbeda Beserta Contohnya!
            </h3>
            <p className="text-xs sm:text-sm text-text/80 max-w-lg mb-6 bg-pink-light/40 border border-text/20 rounded-xl p-3">
                Sebutkan <strong>3 genre berbeda</strong> (misal: Isekai, Shounen, Mecha) dan berikan minimal <strong>1 contoh anime</strong> untuk tiap genre!
            </p>

            {/* 3 Genre Slots */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl">
                {[1, 2, 3].map((num) => {
                    const isDone = currentProgress >= num;
                    return (
                        <div 
                            key={num}
                            className={`p-3.5 rounded-2xl border-[3px] border-text shadow-[4px_4px_0px_#32628f] flex flex-col items-center transition-all ${
                                isDone ? 'bg-green-100 border-green-800' : 'bg-white'
                            }`}
                        >
                            <span className="font-title text-xs font-bold mb-1">Pasang #{num}</span>
                            <span className={`font-title text-sm font-black ${isDone ? 'text-green-600' : 'text-text/30'}`}>
                                {isDone ? '✓ GENRE & ANIME VALID' : '⏳ MENUNGGU'}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * G04: Guess the Anime: Cropped Edition — Mystery Cropped Image Only
 */
function G04DisplayView({ session }) {
    const croppedUrl = session?.mediaUrl || "/arcade/cropped_placeholder.svg";
    return (
        <div className="flex flex-col items-center text-center">
            <h3 className="font-title text-xl sm:text-2xl font-bold text-text mb-2">
                Tebak Judul Anime Dari Potongan Gambar Ini!
            </h3>
            <p className="text-xs text-text/70 mb-4">Sebutkan judul anime secara langsung kepada panitia.</p>

            {/* Cropped Image Box */}
            <div className="w-full max-w-md bg-white border-[3px] border-text rounded-2xl overflow-hidden shadow-[5px_5px_0px_#32628f] flex items-center justify-center relative p-3">
                <img 
                    src={croppedUrl} 
                    alt="Potongan Gambar Misteri" 
                    className="w-full max-h-[300px] object-contain rounded-xl border border-text/20 bg-slate-50"
                />
                <span className="absolute bottom-4 right-4 bg-yellow border-2 border-text px-2 py-0.5 rounded text-[10px] font-title font-bold text-text shadow-[1.5px_1.5px_0px_#32628f]">
                    🔍 TEBAK GAMBAR
                </span>
            </div>
        </div>
    );
}

/**
 * G05: Guess the Anime Opening — Audio Visualizer Badge (No Double Audio)
 */
function G05DisplayView({ session }) {
    return (
        <div className="flex flex-col items-center text-center">
            <h3 className="font-title text-xl sm:text-2xl font-bold text-text mb-2">
                Tebak Judul Anime dari Cuplikan Musik Pembuka!
            </h3>
            <p className="text-xs text-text/70 mb-6">Dengarkan audio 3–5 detik yang diputar di booth panitia.</p>

            {/* Audio Wave / Record Graphic */}
            <div className="w-full max-w-md bg-yellow-light/60 border-[3px] border-text rounded-2xl p-6 shadow-[5px_5px_0px_#32628f] flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-pink border-[3px] border-text flex items-center justify-center shadow-[3px_3px_0px_#32628f] mb-4 animate-spin" style={{ animationDuration: '4s' }}>
                    <div className="w-6 h-6 rounded-full bg-white border-2 border-text"></div>
                </div>

                {/* Animated Sound Wave Bars */}
                <div className="flex items-center gap-1.5 h-10 mb-3">
                    {[16, 28, 40, 20, 36, 18, 30, 42, 24, 32, 18].map((h, i) => (
                        <div 
                            key={i} 
                            className="w-2 bg-pink border border-text rounded-full animate-pulse"
                            style={{ 
                                height: `${h}px`, 
                                animationDelay: `${i * 120}ms`,
                                animationDuration: '800ms'
                            }}
                        ></div>
                    ))}
                </div>

                <span className="font-title text-xs font-bold text-text uppercase tracking-wider bg-white border border-text rounded-full px-3 py-1">
                    🔊 Audio Diputar di Booth Panitia
                </span>
            </div>
        </div>
    );
}

/**
 * G06: Character Alphabet Rush — Big Letter Badge & Progress 0/5
 */
function G06DisplayView({ session, currentProgress, targetProgress }) {
    const letter = session?.letter || "S";
    return (
        <div className="flex flex-col items-center text-center">
            <h3 className="font-title text-lg sm:text-xl font-bold text-text mb-2">
                Sebutkan 5 karakter anime berawalan huruf:
            </h3>

            {/* Giant Alphabet Badge */}
            <div className="w-24 h-24 rounded-3xl bg-pink border-[4px] border-text flex items-center justify-center shadow-[6px_6px_0px_#32628f] mb-6 animate-bounce">
                <span className="font-title text-5xl font-black text-text">
                    {letter}
                </span>
            </div>

            {/* 5 Progress Slots */}
            <div className="w-full max-w-md">
                <div className="flex justify-between items-center mb-2 px-1">
                    <span className="font-title text-xs font-bold text-text">Karakter Awalan "{letter}"</span>
                    <span className="font-title text-sm font-bold text-pink">{currentProgress} / 5</span>
                </div>
                <div className="grid grid-cols-5 gap-3">
                    {Array.from({ length: 5 }).map((_, idx) => {
                        const isDone = idx < currentProgress;
                        return (
                            <div 
                                key={idx}
                                className={`h-12 rounded-xl border-2 border-text flex items-center justify-center font-title font-bold text-base shadow-[2px_2px_0px_#32628f] transition-all ${
                                    isDone ? 'bg-green-400 text-white scale-105' : 'bg-blue-light/30 text-text/40'
                                }`}
                            >
                                {isDone ? '✓' : idx + 1}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/**
 * G07: Three-Hint Character — Physical Card Notice & Hint Counter
 */
/**
 * G07: Three-Hint Character — Panitia Reads 3 Hints to Participant
 */
function G07DisplayView({ session, currentProgress }) {
    return (
        <div className="flex flex-col items-center text-center">
            <h3 className="font-title text-xl sm:text-2xl font-bold text-text mb-2">
                Dengarkan 3 Ciri-Ciri Karakter dari Panitia!
            </h3>
            
            <div className="w-full max-w-md bg-yellow border-[3px] border-text rounded-2xl p-4 shadow-[4px_4px_0px_#32628f] mb-6">
                <p className="text-xs sm:text-sm text-text font-medium leading-relaxed">
                    Panitia akan membacakan maksimal <strong>3 ciri khas / petunjuk</strong> secara lisan. 
                    <br/><span className="text-pink font-bold">Tebak nama karakternya dengan tepat sebelum batas waktu habis!</span>
                </p>
            </div>

            {/* 3 Hint Indicator Cards */}
            <div className="w-full max-w-md grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[1, 2, 3].map((num) => (
                    <div 
                        key={num}
                        className="py-3 px-2 rounded-2xl border-2 border-text bg-white shadow-[2px_2px_0px_#32628f] flex flex-col items-center"
                    >
                        <span className="font-title text-xs font-bold text-text mb-0.5">Petunjuk #{num}</span>
                        <span className="text-[11px] text-text/60">📢 Dibacakan Host</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * G08: Act Like That Character! — Pose Reference Image (NO CHARACTER NAME ON DISPLAY)
 */
function G08DisplayView({ session }) {
    const phrase = session?.phrasePrompt || null;
    const poseImageUrl = session?.mediaUrl || null;

    return (
        <div className="flex flex-col items-center text-center max-w-xl mx-auto">
            <h3 className="font-title text-xl sm:text-2xl font-bold text-text mb-3">
                Tirukan Pose Karakter Berikut Ini!
            </h3>

            {/* Pose Reference Image Showcase */}
            {poseImageUrl && (
                <div className="w-full max-w-xs sm:max-w-sm rounded-3xl border-[4px] border-text overflow-hidden shadow-[6px_6px_0px_#32628f] mb-4 bg-white p-2.5 relative">
                    <img 
                        src={poseImageUrl} 
                        alt="Anime Pose Reference" 
                        className="w-full max-h-[360px] object-contain rounded-2xl mx-auto"
                    />
                    <div className="absolute top-4 right-4 bg-yellow border-2 border-text px-2.5 py-0.5 rounded-full text-[10px] font-title font-bold shadow-[2px_2px_0px_#32628f]">
                        📸 CONTOH POSE
                    </div>
                </div>
            )}

            {/* Phrase / Pose Description Guide (No Character Name) */}
            {phrase && (
                <div className="w-full max-w-md bg-yellow-light border-2 border-dashed border-text rounded-2xl p-3 text-center shadow-sm">
                    <span className="text-xs font-bold text-text/60 uppercase block mb-0.5">Panduan Gerakan / Pose:</span>
                    <span className="font-title text-sm sm:text-base font-bold text-text italic">
                        "{phrase}"
                    </span>
                </div>
            )}
        </div>
    );
}

/**
 * G09: Find the Impostor: Character Edition — 5 Neutral Character Cards (NO SPOILERS)
 */
function G09DisplayView({ session }) {
    const options = session?.displayItems || [
        "Monkey D. Luffy",
        "Roronoa Zoro",
        "Naruto Uzumaki",
        "Vinsmoke Sanji",
        "Nami"
    ];

    return (
        <div className="flex flex-col items-center text-center">
            <h3 className="font-title text-lg sm:text-xl font-bold text-text mb-2">
                Cari 1 Karakter yang Berasal dari Franchise Berbeda!
            </h3>
            <p className="text-xs text-text/70 mb-5">Tunjuk atau sebutkan pilihan Anda kepada panitia.</p>

            {/* 5 Options Grid: Strictly Neutral, NO SPOILERS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-2xl">
                {options.map((opt, idx) => (
                    <div 
                        key={idx}
                        className="bg-white border-[3px] border-text rounded-2xl p-3.5 shadow-[3px_3px_0px_#32628f] flex items-center gap-3 text-left"
                    >
                        <div className="w-8 h-8 rounded-xl bg-yellow border-2 border-text flex items-center justify-center font-title font-bold text-sm shrink-0">
                            {idx + 1}
                        </div>
                        <span className="font-title text-sm font-bold text-text">{opt}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * G10: Find the Impostor: Anime Edition — 5 Neutral Anime Title Cards (NO SPOILERS)
 */
function G10DisplayView({ session }) {
    const options = session?.displayItems || [
        "Bocchi the Rock!",
        "K-On!",
        "Chainsaw Man",
        "Cyber Samurai Chronicle: Neo Tokyo",
        "Spy x Family"
    ];

    return (
        <div className="flex flex-col items-center text-center">
            <h3 className="font-title text-lg sm:text-xl font-bold text-text mb-2">
                Cari 1 Judul Anime Fiktif (Palsu)!
            </h3>
            <p className="text-xs text-text/70 mb-5">4 judul adalah anime asli, 1 judul adalah karangan fiktif.</p>

            {/* 5 Neutral Title Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-2xl">
                {options.map((opt, idx) => (
                    <div 
                        key={idx}
                        className="bg-white border-[3px] border-text rounded-2xl p-3.5 shadow-[3px_3px_0px_#32628f] flex items-center gap-3 text-left"
                    >
                        <div className="w-8 h-8 rounded-xl bg-pink border-2 border-text flex items-center justify-center font-title font-bold text-sm shrink-0">
                            {idx + 1}
                        </div>
                        <span className="font-title text-sm font-bold text-text">{opt}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * -------------------------------------------------------------
 * 4. WON SCREEN COMPONENT (Celebration & Prize Showcase)
 * -------------------------------------------------------------
 */
function WonScreen({ session, gameDef }) {
    return (
        <div className="w-full max-w-3xl flex flex-col items-center text-center animate-[popIn_0.5s_cubic-bezier(0.175,0.885,0.32,1.15)]">
            
            {/* Victory Badge */}
            <div className="inline-flex items-center gap-2 bg-yellow border-[3px] border-text rounded-full px-5 py-1.5 shadow-[3px_3px_0px_#32628f] mb-3 animate-bounce">
                <span className="text-xl">🏆</span>
                <span className="font-title text-sm sm:text-base font-bold text-text uppercase tracking-wider">
                    MISI TERCAPAI • LUAR BIASA!
                </span>
                <span className="text-xl">🎉</span>
            </div>

            {/* Winner Header (Universal, No Personal Names on Display) */}
            <h1 className="font-title text-3xl sm:text-5xl text-text font-black mb-1">
                SELAMAT! <span className="text-pink">KAMU MENANG</span>! 🎉
            </h1>
            <p className="text-sm sm:text-base text-text/80 font-medium mb-6">
                Kamu berhasil menaklukkan tantangan <strong>{session?.gameTitle || 'Arcade'}</strong>!
            </p>

            {/* Prize Showcase Card */}
            <div className="w-full bg-white border-[4px] border-text rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0px_#32628f] relative mb-6">
                <div className="washi-tape tape-yellow-1 absolute top-[-14px] left-1/2 -translate-x-1/2 h-7 w-36 bg-green-300"></div>

                <h3 className="font-title text-lg sm:text-xl font-bold text-text mb-4">
                    🎁 Hadiah Kemenangan Anda:
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                    {/* Sketch Commission */}
                    <div className="bg-yellow-light/60 border-[3px] border-text rounded-2xl p-4 shadow-[3px_3px_0px_#32628f] flex items-start gap-3">
                        <span className="text-3xl shrink-0">🎨</span>
                        <div>
                            <div className="font-title text-sm font-bold text-text">Free Frame Live Sketch</div>
                            <div className="text-xs text-text/75 mt-0.5">
                                Dapatkan 1 free live sketch commission langsung dari artist Kanvahati!
                            </div>
                        </div>
                    </div>

                    {/* Sticker Freebie */}
                    <div className="bg-pink-light/60 border-[3px] border-text rounded-2xl p-4 shadow-[3px_3px_0px_#32628f] flex items-start gap-3">
                        <span className="text-3xl shrink-0">🌸</span>
                        <div>
                            <div className="font-title text-sm font-bold text-text">Sticker Freebie Eksklusif</div>
                            <div className="text-xs text-text/75 mt-0.5">
                                1 lembar sticker merchandise edisi spesial Kanvahati.
                            </div>
                        </div>
                    </div>
                </div>

                {/* Evaluation: Correct Answer Confirmation Card */}
                {session?.revealedAnswer && (
                    <div className="mt-5 pt-4 border-t-2 border-dashed border-text/20 w-full max-w-xl mx-auto flex flex-col gap-3">
                        <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-4 text-left shadow-[3px_3px_0px_#32628f]">
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="bg-emerald-600 text-white text-[11px] font-title font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                                    ✅ JAWABAN TEPAT & BENAR
                                </span>
                                <span className="text-xs font-bold text-emerald-800">
                                    {session.revealedAnswer.title || "Kunci Jawaban Resmi"}:
                                </span>
                            </div>
                            <div className="font-title text-base sm:text-xl font-black text-emerald-950 pl-1 break-words">
                                {session.revealedAnswer.text}
                            </div>
                            {session.revealedAnswer.subtitle && (
                                <div className="text-xs sm:text-sm font-bold text-emerald-700 pl-1 mt-1">
                                    {session.revealedAnswer.subtitle}
                                </div>
                            )}
                            {session.revealedAnswer.explanation && (
                                <div className="text-xs text-emerald-800/85 pl-1 mt-1.5 italic bg-white/70 p-2 rounded-xl border border-emerald-200">
                                    ℹ️ {session.revealedAnswer.explanation}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Revealed Image for G04 if available */}
                {session?.revealedMediaUrl && (
                    <div className="mt-5 pt-4 border-t-2 border-dashed border-text/20 flex flex-col items-center">
                        <span className="text-xs font-bold text-text/70 mb-2">Potongan Gambar Utuh:</span>
                        <img 
                            src={session.revealedMediaUrl} 
                            alt="Revealed Full Anime" 
                            className="max-h-40 rounded-xl border-2 border-text shadow-sm"
                        />
                    </div>
                )}
            </div>

            {/* Waiting for Reset Notice */}
            <div className="inline-flex items-center gap-2 text-xs font-bold text-text/60">
                <i className="fa-solid fa-spinner fa-spin"></i>
                <span>Tunjukkan layar ini ke panitia untuk klaim hadiah. Menunggu reset sesi...</span>
            </div>
        </div>
    );
}

/**
 * -------------------------------------------------------------
 * 5. LOST SCREEN COMPONENT (Consolation & Next Time)
 * -------------------------------------------------------------
 */
function LostScreen({ session, gameDef }) {
    const reason = session?.disqualificationReason || "Waktu Habis / Belum Tepat";

    return (
        <div className="w-full max-w-3xl flex flex-col items-center text-center animate-[shake_0.5s_ease-in-out]">
            
            {/* Consolation Badge */}
            <div className="inline-flex items-center gap-2 bg-pink border-[3px] border-text rounded-full px-5 py-1.5 shadow-[3px_3px_0px_#32628f] mb-3">
                <span className="text-xl">🥺</span>
                <span className="font-title text-sm sm:text-base font-bold text-text uppercase tracking-wider">
                    BELUM BERHASIL
                </span>
                <span className="text-xl">✨</span>
            </div>

            {/* Header (Universal, No Personal Names on Display) */}
            <h1 className="font-title text-3xl sm:text-5xl text-text font-black mb-2">
                SEMANGAT! <span className="text-blue">COBA LAGI NANTI</span>! ✨
            </h1>
            <p className="text-sm sm:text-base text-text/80 font-medium mb-1">
                {reason}
            </p>
            <p className="text-xs text-text/60 mb-6">
                Terima kasih banyak sudah berani mencoba tantangan Kanvahati Arcade!
            </p>

            {/* Consolation Prize Showcase Card */}
            <div className="w-full bg-white border-[4px] border-text rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0px_#32628f] relative mb-6">
                <div className="washi-tape tape-yellow-1 absolute top-[-14px] left-1/2 -translate-x-1/2 h-7 w-36 bg-yellow"></div>

                <h3 className="font-title text-lg sm:text-xl font-bold text-text mb-4">
                    🎁 Hadiah Penghiburan Anda:
                </h3>

                <div className="bg-pink-light/60 border-[3px] border-text rounded-2xl p-4 shadow-[3px_3px_0px_#32628f] flex items-center justify-center gap-4 text-left max-w-md mx-auto mb-4">
                    <span className="text-4xl shrink-0">🌸</span>
                    <div>
                        <div className="font-title text-sm sm:text-base font-bold text-text">Sticker Freebie Kanvahati</div>
                        <div className="text-xs text-text/75 mt-0.5">
                            Semua peserta yang telah berpartisipasi tetap berhak membawa pulang 1 sticker freebie!
                        </div>
                    </div>
                </div>

                {/* Evaluation: Comparison between False Answer and Correct Answer */}
                <div className="mt-5 pt-4 border-t-2 border-dashed border-text/20 w-full max-w-xl mx-auto flex flex-col gap-3">
                    {/* 1. False Answer / Failed Reason */}
                    <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 text-left shadow-[3px_3px_0px_#32628f]">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="bg-rose-500 text-white text-[11px] font-title font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                                ❌ JAWABAN SALAH / GAGAL
                            </span>
                            <span className="text-xs font-bold text-rose-800">
                                Evaluasi Sesi:
                            </span>
                        </div>
                        <p className="font-title text-sm sm:text-base font-bold text-rose-900 pl-1 leading-snug">
                            {reason}
                        </p>
                    </div>

                    {/* 2. Correct Answer Key */}
                    {session?.revealedAnswer && (
                        <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-4 text-left shadow-[3px_3px_0px_#32628f]">
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="bg-emerald-600 text-white text-[11px] font-title font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                                    ✅ KUNCI JAWABAN YANG BENAR
                                </span>
                                <span className="text-xs font-bold text-emerald-800">
                                    {session.revealedAnswer.title || "Kunci Jawaban Resmi"}:
                                </span>
                            </div>
                            <div className="font-title text-base sm:text-xl font-black text-emerald-950 pl-1 break-words">
                                {session.revealedAnswer.text}
                            </div>
                            {session.revealedAnswer.subtitle && (
                                <div className="text-xs sm:text-sm font-bold text-emerald-700 pl-1 mt-1">
                                    {session.revealedAnswer.subtitle}
                                </div>
                            )}
                            {session.revealedAnswer.explanation && (
                                <div className="text-xs text-emerald-800/85 pl-1 mt-1.5 italic bg-white/70 p-2 rounded-xl border border-emerald-200">
                                    ℹ️ {session.revealedAnswer.explanation}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Revealed Image for G04 if available */}
                {session?.revealedMediaUrl && (
                    <div className="mt-5 pt-4 border-t-2 border-dashed border-text/20 flex flex-col items-center">
                        <span className="text-xs font-bold text-text/70 mb-2">Jawaban Potongan Gambar Sebenarnya:</span>
                        <img 
                            src={session.revealedMediaUrl} 
                            alt="Revealed Full Anime" 
                            className="max-h-40 rounded-xl border-2 border-text shadow-sm"
                        />
                    </div>
                )}
            </div>

            {/* Waiting for Reset Notice */}
            <div className="inline-flex items-center gap-2 text-xs font-bold text-text/60">
                <i className="fa-solid fa-spinner fa-spin"></i>
                <span>Tunjukkan layar ini ke panitia untuk mengambil sticker freebie. Menunggu reset sesi...</span>
            </div>
        </div>
    );
}
