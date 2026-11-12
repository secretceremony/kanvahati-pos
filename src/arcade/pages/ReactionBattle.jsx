import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { REACTION_BATTLE_CONFIG } from '../data/gameConfig.js';
import { REACTION_STATES } from '../services/reactionCore.js';
import { getEstimatedServerClockOffset } from '../services/arcadeSync.js';
import {
    createReactionBattleRoom,
    subscribeReactionRoom,
    subscribeReactionTaps,
    joinReactionRoomAsVisitor,
    setReactionPlayerReady,
    armReactionRound,
    triggerReactionGoSignal,
    submitReactionTap,
    commitReactionAdjudication,
    nextReactionRound,
    rematchReactionRoom,
    recordReactionMatchOutcome,
    cancelReactionRoom
} from '../services/reactionSync.js';

/**
 * Reaction Battle PvP Page
 * - Host mode (staff authenticated via /arcade/reaction): create room, share QR/code, arm rounds, tap duel, rematch, log prize.
 * - Visitor mode (/arcade/reaction?room=CODE&role=visitor): mobile/tablet tap pad for the visitor!
 */
export default function ReactionBattle({ currentUser, userRole, showToast }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const urlRoom = (searchParams.get('room') || '').toUpperCase();
    const urlRole = searchParams.get('role');
    const urlEvent = (searchParams.get('event') || 'CF20').toUpperCase();

    const isStaff = userRole === 'admin' || userRole === 'super_admin' || userRole === 'arcade_host';
    const isVisitorView = urlRole === 'visitor' || (!isStaff && Boolean(urlRoom));

    const [eventId, setEventId] = useState(urlEvent);
    const [roomCode, setRoomCode] = useState(urlRoom);
    const [joinCodeInput, setJoinCodeInput] = useState(urlRoom);
    const [visitorNameInput, setVisitorNameInput] = useState('');
    const [visitorIdentifierInput, setVisitorIdentifierInput] = useState('');
    const [room, setRoom] = useState(null);
    const [taps, setTaps] = useState({ hostTap: null, visitorTap: null });
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [clockOffsetMs, setClockOffsetMs] = useState(0);
    const [busy, setBusy] = useState(false);

    const goTimerRef = useRef(null);
    const timeoutTimerRef = useRef(null);

    // 1. Calibrate server clock offset
    useEffect(() => {
        let mounted = true;
        getEstimatedServerClockOffset().then((offset) => {
            if (mounted) setClockOffsetMs(offset);
        });
        return () => { mounted = false; };
    }, []);

    // 2. Subscribe to room & taps
    useEffect(() => {
        if (!roomCode) return;
        const unsubRoom = subscribeReactionRoom(roomCode, (data) => {
            setRoom(data);
        });
        const unsubTaps = subscribeReactionTaps(roomCode, (tapState) => {
            setTaps(tapState);
        });

        const joinUrl = `${window.location.origin}/arcade/reaction?room=${roomCode}&role=visitor&event=${eventId}`;
        QRCode.toDataURL(joinUrl, { width: 220, margin: 1, color: { dark: '#171717', light: '#FFFFFF' } })
            .then(setQrDataUrl)
            .catch(() => {});

        return () => {
            unsubRoom();
            unsubTaps();
        };
    }, [roomCode, eventId]);

    // 3. Latch tap per round using round+status key (no effect setState needed)
    const roundKey = `${room?.currentRound || 0}-${room?.status || ''}`;
    const [tappedRoundKey, setTappedRoundKey] = useState('');
    const hasTappedThisRound = tappedRoundKey === roundKey;

    // 4. Host-side round scheduler (ARMED -> GO) and adjudication on taps
    const roomStatus = room?.status;
    const roomRound = room?.currentRound;
    const roomGoAtMs = room?.round?.goAtMs;
    const roomOutcomeRecorded = room?.outcomeRecorded;
    const roomMatchWinner = room?.matchWinner;
    const roomEventId = room?.eventId;
    const roomVisitorName = room?.visitor?.name;
    const roomHostScore = room?.host?.score || 0;
    const roomVisitorScore = room?.visitor?.score || 0;

    useEffect(() => {
        if (isVisitorView || !roomCode || !roomStatus) return;

        if (goTimerRef.current) clearTimeout(goTimerRef.current);
        if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);

        if (roomStatus === REACTION_STATES.ARMED && roomGoAtMs) {
            const nowAdj = Date.now() + clockOffsetMs;
            const msUntilGo = Math.max(0, roomGoAtMs - nowAdj);
            goTimerRef.current = setTimeout(() => {
                triggerReactionGoSignal(roomCode, roomRound).catch(() => {});
            }, msUntilGo);
        }

        if (roomStatus === REACTION_STATES.GO && roomGoAtMs) {
            const nowAdj = Date.now() + clockOffsetMs;
            const elapsed = Math.max(0, nowAdj - roomGoAtMs);
            const msLeft = Math.max(250, REACTION_BATTLE_CONFIG.ROUND_TIMEOUT_MS - elapsed);
            timeoutTimerRef.current = setTimeout(() => {
                commitReactionAdjudication(roomCode, taps).catch(() => {});
            }, msLeft);
        }

        return () => {
            if (goTimerRef.current) clearTimeout(goTimerRef.current);
            if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
        };
    }, [roomStatus, roomRound, roomGoAtMs, isVisitorView, roomCode, clockOffsetMs, taps]);

    // 5. Host automatically adjudicates as soon as a valid/false-start tap arrives during ARMED or GO
    useEffect(() => {
        if (isVisitorView || !roomCode) return;
        if (roomStatus !== REACTION_STATES.ARMED && roomStatus !== REACTION_STATES.GO) return;

        const rNum = roomRound || 1;
        const hValid = taps.hostTap && !taps.hostTap.cleared && taps.hostTap.round === rNum;
        const vValid = taps.visitorTap && !taps.visitorTap.cleared && taps.visitorTap.round === rNum;
        if (hValid || vValid) {
            commitReactionAdjudication(roomCode, taps).catch(() => {});
        }
    }, [taps, roomStatus, roomRound, isVisitorView, roomCode]);

    // 6. Auto-record finished match outcome once
    useEffect(() => {
        if (isVisitorView || roomStatus !== REACTION_STATES.FINISHED || roomOutcomeRecorded) return;
        recordReactionMatchOutcome({
            roomCode,
            eventId: roomEventId || eventId,
            rawIdentifier: visitorIdentifierInput,
            displayName: roomVisitorName || visitorNameInput || 'Pengunjung',
            matchWinner: roomMatchWinner,
            hostScore: roomHostScore,
            visitorScore: roomVisitorScore,
            staffUid: currentUser?.uid || 'host_staff'
        }).catch((e) => console.warn('Outcome record skipped:', e));
    }, [roomStatus, roomOutcomeRecorded, roomMatchWinner, roomEventId, roomVisitorName, roomHostScore, roomVisitorScore, isVisitorView, roomCode, eventId, visitorIdentifierInput, visitorNameInput, currentUser?.uid]);

    // --- Handlers ---
    const handleCreateRoom = async () => {
        if (!isStaff) return;
        setBusy(true);
        try {
            const created = await createReactionBattleRoom({
                eventId,
                hostUid: currentUser?.uid || 'host_staff',
                hostName: currentUser?.displayName || 'Staff Kanvahati',
                participantName: visitorNameInput || 'Pengunjung',
                rawIdentifier: visitorIdentifierInput
            });
            setRoomCode(created.roomCode);
            setSearchParams({ event: eventId, room: created.roomCode });
            showToast?.(`Room Reaction Battle ${created.roomCode} dibuat!`, '⚡');
        } catch (e) {
            showToast?.(e.message || 'Gagal membuat room', '⚠️');
        } finally {
            setBusy(false);
        }
    };

    const handleVisitorJoin = async (e) => {
        e?.preventDefault();
        const code = (joinCodeInput || roomCode || '').trim().toUpperCase();
        if (!code) {
            showToast?.('Masukkan kode room terlebih dahulu!', '⚠️');
            return;
        }
        setBusy(true);
        try {
            await joinReactionRoomAsVisitor(code, visitorNameInput || 'Pengunjung');
            setRoomCode(code);
            setSearchParams({ room: code, role: 'visitor', event: eventId });
            showToast?.(`Berhasil masuk Room ${code}!`, '🎮');
        } catch (err) {
            showToast?.(err.message || 'Gagal masuk ke room', '⚠️');
        } finally {
            setBusy(false);
        }
    };

    const handleToggleReady = async (myRole) => {
        if (!roomCode || !room) return;
        const currentReady = myRole === 'host' ? room.host?.ready : room.visitor?.ready;
        await setReactionPlayerReady(roomCode, myRole, !currentReady);
    };

    const handleArmRound = async () => {
        if (!roomCode) return;
        setBusy(true);
        try {
            await armReactionRound(roomCode, clockOffsetMs);
        } catch (e) {
            showToast?.(e.message || 'Gagal memulai ronde', '⚠️');
        } finally {
            setBusy(false);
        }
    };

    const handleTap = async () => {
        if (!room || !roomCode || hasTappedThisRound) return;
        if (room.status !== REACTION_STATES.ARMED && room.status !== REACTION_STATES.GO) return;
        setTappedRoundKey(roundKey);
        const myRole = isVisitorView ? 'visitor' : 'host';
        try {
            await submitReactionTap(roomCode, myRole, room.currentRound || 1, clockOffsetMs);
        } catch (e) {
            setTappedRoundKey('');
            showToast?.(e.message || 'Gagal mengirim tap', '⚠️');
        }
    };

    const handleNextRound = async () => {
        if (!roomCode) return;
        await nextReactionRound(roomCode);
    };

    const handleRematch = async () => {
        if (!roomCode) return;
        await rematchReactionRoom(roomCode);
        showToast?.('Rematch dimulai! Skor direset 0-0.', '🔄');
    };

    const handleCloseRoom = async () => {
        if (!roomCode) return;
        await cancelReactionRoom(roomCode);
        setRoomCode('');
        setRoom(null);
        setQrDataUrl('');
        setSearchParams({ event: eventId });
    };

    const myRole = isVisitorView ? 'visitor' : 'host';
    const joinUrl = roomCode ? `${window.location.origin}/arcade/reaction?room=${roomCode}&role=visitor&event=${eventId}` : '';

    // =========================================================================
    // VISITOR JOIN SCREEN (no room joined yet)
    // =========================================================================
    if (isVisitorView && (!roomCode || !room)) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center p-4 font-body text-text">
                <form
                    onSubmit={handleVisitorJoin}
                    className="w-full max-w-md bg-white border-[3px] border-text rounded-3xl shadow-pop p-6 flex flex-col gap-4"
                >
                    <div className="text-center">
                        <span className="inline-block bg-yellow border-2 border-text rounded-full px-3 py-0.5 text-[11px] font-tag font-black uppercase mb-2">
                            ⚡ Reaction Battle PvP
                        </span>
                        <h1 className="font-title text-2xl font-bold text-text">Gabung Duel Reaksi!</h1>
                        <p className="text-xs text-text/70 mt-1">Masukkan kode room 6-huruf dari panitia booth Kanvahati.</p>
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase block mb-1">Kode Room</label>
                        <input
                            type="text"
                            maxLength={8}
                            value={joinCodeInput}
                            onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                            placeholder="Contoh: K7M4PX"
                            className="w-full border-2 border-text rounded-xl px-4 py-3 font-title text-xl tracking-widest text-center uppercase bg-yellow-light/30 outline-none focus:bg-white"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase block mb-1">Nama Kamu</label>
                        <input
                            type="text"
                            value={visitorNameInput}
                            onChange={(e) => setVisitorNameInput(e.target.value)}
                            placeholder="Contoh: Mika-chan"
                            className="w-full border-2 border-text rounded-xl px-3 py-2.5 text-sm bg-white outline-none"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={busy}
                        className="btn bg-pink text-text border-[3px] border-text rounded-2xl py-3.5 font-title text-base font-bold shadow-btn hover:bg-yellow cursor-pointer"
                    >
                        {busy ? 'Menghubungkan...' : 'Masuk Arena ⚡'}
                    </button>
                </form>
            </div>
        );
    }

    // =========================================================================
    // MAIN ARENA VIEW (HOST & VISITOR DUAL-DEVICE)
    // =========================================================================
    const hostScore = room?.host?.score || 0;
    const visitorScore = room?.visitor?.score || 0;
    const roundState = room?.status || REACTION_STATES.WAITING;
    const isArmed = roundState === REACTION_STATES.ARMED;
    const isGo = roundState === REACTION_STATES.GO;

    return (
        <div className="reaction-battle-page max-w-[1100px] mx-auto flex flex-col gap-5 pb-12 font-body text-text">
            {/* Top Mode & Navigation Bar */}
            <div className="bg-white border-[3px] border-text rounded-2xl shadow-card p-4 flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-3">
                    <div className="bg-yellow border-2 border-text rounded-xl p-2.5 shadow-[2px_2px_0px_#181818]">
                        <i className="fa-solid fa-bolt text-xl text-pink"></i>
                    </div>
                    <div>
                        <h1 className="font-title text-lg md:text-xl font-bold leading-tight">
                            Reaction Battle • Best of 3 PvP
                        </h1>
                        <p className="text-xs text-text/75">
                            {isVisitorView ? 'Mode Pengunjung — Tunggu sinyal HIJAU sebelum tap!' : 'Duel Reaksi Staff vs Pengunjung (2 Perangkat Real-time)'}
                        </p>
                    </div>
                </div>

                {!isVisitorView && (
                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            to="/arcade/host"
                            className="btn bg-blue-light hover:bg-yellow border-2 border-text rounded-xl px-3 py-1.5 text-xs font-title font-bold shadow-[2px_2px_0px_#181818]"
                        >
                            <i className="fa-solid fa-gamepad mr-1.5"></i>Quiz Challenge
                        </Link>
                        <Link
                            to="/arcade/questions"
                            className="btn bg-white hover:bg-pink-light border-2 border-text rounded-xl px-3 py-1.5 text-xs font-title font-bold shadow-[2px_2px_0px_#181818]"
                        >
                            <i className="fa-solid fa-database mr-1.5"></i>Bank Soal
                        </Link>
                    </div>
                )}
            </div>

            {/* Host Room Setup Card when no room created */}
            {!isVisitorView && !room && (
                <div className="bg-white border-[3px] border-text rounded-2xl shadow-card p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="flex flex-col gap-3">
                        <h2 className="font-title text-base font-bold">Buat Room Duel Baru (Staff)</h2>
                        <div className="grid grid-cols-2 gap-2.5">
                            <div>
                                <label className="text-[11px] font-bold uppercase block mb-1">Event ID</label>
                                <input
                                    type="text"
                                    value={eventId}
                                    onChange={(e) => setEventId(e.target.value.toUpperCase())}
                                    className="w-full border-2 border-text rounded-xl px-3 py-2 text-sm font-title bg-yellow-light/20"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold uppercase block mb-1">Handle / No. Antrean</label>
                                <input
                                    type="text"
                                    value={visitorIdentifierInput}
                                    onChange={(e) => setVisitorIdentifierInput(e.target.value)}
                                    placeholder="@ig / No. 12"
                                    className="w-full border-2 border-text rounded-xl px-3 py-2 text-sm bg-white"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold uppercase block mb-1">Nama Pengunjung</label>
                            <input
                                type="text"
                                value={visitorNameInput}
                                onChange={(e) => setVisitorNameInput(e.target.value)}
                                placeholder="Nama Penantang"
                                className="w-full border-2 border-text rounded-xl px-3 py-2 text-sm bg-white"
                            />
                        </div>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={handleCreateRoom}
                            className="btn bg-pink text-text border-[3px] border-text rounded-2xl py-3 font-title text-sm font-bold shadow-btn hover:bg-yellow cursor-pointer"
                        >
                            {busy ? 'Membuat Room...' : 'Buat Room Reaction Battle ⚡'}
                        </button>
                    </div>

                    <div className="bg-yellow-light/40 border-2 border-dashed border-text/40 rounded-2xl p-4 flex flex-col justify-center gap-2 text-xs">
                        <span className="font-title font-bold text-sm">Aturan Reaction Battle (Best of 3):</span>
                        <ul className="list-disc pl-4 space-y-1 text-text/80">
                            <li>Staff membuat room dan pengunjung scan QR atau masukkan kode 6-huruf di HP/tablet mereka.</li>
                            <li>Setelah kedua pemain menekan <strong>Siap</strong>, Staff memulai ronde (sinyal acak 1.8–5.2 detik).</li>
                            <li>Tap sebelum lampu <strong>HIJAU (GO!)</strong> dihitung <strong>False Start</strong> dan langsung kalah ronde.</li>
                            <li>Pemenang Best-of-3 (2 kemenangan) berhak atas hadiah booth sesuai kuota event!</li>
                        </ul>
                    </div>
                </div>
            )}

            {/* Active Room Arena */}
            {room && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* Left: Room Code, QR Join & Scoreboard */}
                    <div className="lg:col-span-4 flex flex-col gap-4">
                        <div className="bg-white border-[3px] border-text rounded-2xl shadow-card p-4 flex flex-col items-center text-center gap-3">
                            <div className="w-full flex justify-between items-center border-b border-dashed border-text/20 pb-2">
                                <span className="text-[11px] font-tag font-extrabold uppercase text-text/60">Kode Room</span>
                                <span className="font-title text-xl font-black tracking-widest bg-yellow border-2 border-text rounded-xl px-3 py-0.5">
                                    {room.roomCode}
                                </span>
                            </div>

                            {!isVisitorView && qrDataUrl && (
                                <div className="flex flex-col items-center gap-1.5">
                                    <img src={qrDataUrl} alt="QR Join Reaction Battle" className="w-40 h-40 border-2 border-text rounded-xl p-1 bg-white" />
                                    <span className="text-[10.5px] text-text/70">Scan di HP/Tablet Pengunjung untuk join</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            navigator.clipboard?.writeText(joinUrl);
                                            showToast?.('Link join disalin!', '📋');
                                        }}
                                        className="text-[11px] font-title font-bold text-blue underline cursor-pointer"
                                    >
                                        Salin Link Pengunjung
                                    </button>
                                </div>
                            )}

                            {/* Best of 3 Scoreboard */}
                            <div className="w-full grid grid-cols-3 items-center bg-blue-light/25 border-2 border-text rounded-2xl p-3">
                                <div>
                                    <span className="text-[10px] font-bold uppercase block opacity-70 truncate">{room.visitor?.name || 'Pengunjung'}</span>
                                    <span className="font-title text-3xl font-black text-pink">{visitorScore}</span>
                                    <span className="text-[9.5px] block font-bold">
                                        {room.visitor?.joined ? (room.visitor?.ready ? '✓ Siap' : 'Terhubung') : 'Menunggu'}
                                    </span>
                                </div>
                                <div className="font-title text-sm font-bold text-text/60">
                                    Ronde {room.currentRound}/{room.bestOf}
                                    <span className="block text-[10px]">VS</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase block opacity-70 truncate">{room.host?.name || 'Staff'}</span>
                                    <span className="font-title text-3xl font-black text-text">{hostScore}</span>
                                    <span className="text-[9.5px] block font-bold">
                                        {room.host?.ready ? '✓ Siap' : 'Standby'}
                                    </span>
                                </div>
                            </div>

                            {/* Ready Toggle before round */}
                            {(roundState === REACTION_STATES.WAITING || roundState === REACTION_STATES.READY) && (
                                <button
                                    type="button"
                                    onClick={() => handleToggleReady(myRole)}
                                    className={`w-full btn border-2 border-text rounded-xl py-2.5 font-title text-xs font-bold shadow-[2px_2px_0px_#181818] cursor-pointer ${
                                        (myRole === 'host' ? room.host?.ready : room.visitor?.ready)
                                            ? 'bg-emerald-300 text-text'
                                            : 'bg-yellow text-text hover:bg-white'
                                    }`}
                                >
                                    {(myRole === 'host' ? room.host?.ready : room.visitor?.ready) ? '✓ Saya Sudah Siap!' : 'Tekan SIAP Duel'}
                                </button>
                            )}
                        </div>

                        {/* Round History */}
                        {room.roundHistory?.length > 0 && (
                            <div className="bg-white border-[3px] border-text rounded-2xl shadow-card p-4">
                                <h3 className="font-title text-xs font-bold uppercase mb-2">Riwayat Ronde</h3>
                                <div className="space-y-1.5 text-xs">
                                    {room.roundHistory.map((r, i) => (
                                        <div key={i} className="flex justify-between items-center bg-yellow-light/25 border border-text/20 rounded-lg px-2.5 py-1.5">
                                            <span className="font-bold">Ronde #{r.round}</span>
                                            <span>
                                                {r.winner === 'visitor' ? `🏆 ${room.visitor?.name}` : r.winner === 'host' ? '🛡️ Staff' : '⏰ Seri'}
                                                {r.winReason === 'false_start' && ' (False Start)'}
                                            </span>
                                            <span className="font-mono text-[11px] font-bold">
                                                {r.visitorReactionMs ? `${r.visitorReactionMs}ms` : r.hostReactionMs ? `${r.hostReactionMs}ms` : '-'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Interactive Reaction Tap Pad & Controls */}
                    <div className="lg:col-span-8 flex flex-col gap-4">
                        <div className="bg-white border-[3px] border-text rounded-3xl shadow-pop p-5 flex flex-col items-center justify-center min-h-[360px] gap-5">
                            {/* Main Touch / Click Reaction Pad */}
                            <button
                                type="button"
                                onPointerDown={handleTap}
                                disabled={!isArmed && !isGo}
                                className={`w-full min-h-[230px] rounded-3xl border-[4px] border-text shadow-[6px_6px_0px_#181818] flex flex-col items-center justify-center p-6 transition-all select-none ${
                                    isGo
                                        ? 'bg-emerald-400 text-text scale-[1.01] cursor-pointer active:translate-y-1'
                                        : isArmed
                                            ? 'bg-rose-400 text-white cursor-pointer'
                                            : roundState === REACTION_STATES.FINISHED
                                                ? (room.matchWinner === myRole ? 'bg-yellow text-text' : 'bg-pink-light text-text')
                                                : 'bg-blue-light/30 text-text/75 cursor-default'
                                }`}
                            >
                                {roundState === REACTION_STATES.WAITING && (
                                    <>
                                        <span className="text-4xl mb-2">⏳</span>
                                        <span className="font-title text-xl font-bold">Menunggu Kedua Pemain Siap</span>
                                        <span className="text-xs mt-1">Tekan tombol SIAP untuk memulai ronde {room.currentRound}.</span>
                                    </>
                                )}
                                {roundState === REACTION_STATES.READY && (
                                    <>
                                        <span className="text-4xl mb-2">⚡</span>
                                        <span className="font-title text-2xl font-bold">Kedua Pemain SIAP!</span>
                                        <span className="text-xs mt-1">
                                            {isVisitorView ? 'Host akan memulai hitungan acak sebentar lagi...' : 'Tekan "Mulai Ronde" di bawah untuk mengirim sinyal acak.'}
                                        </span>
                                    </>
                                )}
                                {isArmed && (
                                    <>
                                        <span className="text-5xl mb-2 animate-pulse">🛑</span>
                                        <span className="font-title text-2xl sm:text-3xl font-black">TAHAN... JANGAN TAP!</span>
                                        <span className="text-xs mt-1 font-bold">Tap lebih awal = False Start (Kalah Ronde)</span>
                                    </>
                                )}
                                {isGo && (
                                    <>
                                        <span className="text-5xl mb-2 animate-bounce">🟢</span>
                                        <span className="font-title text-3xl sm:text-4xl font-black">TAP SEKARANG!!</span>
                                        <span className="text-xs mt-1 font-bold">Siapa tercepat menang ronde!</span>
                                    </>
                                )}
                                {roundState === REACTION_STATES.ROUND_END && (
                                    <>
                                        <span className="text-4xl mb-2">{room.round?.winner === 'visitor' ? '🎉' : '⚡'}</span>
                                        <span className="font-title text-2xl font-bold">
                                            {room.round?.winner === 'visitor'
                                                ? `${room.visitor?.name || 'Pengunjung'} Menang Ronde ${room.currentRound}!`
                                                : room.round?.winner === 'host'
                                                    ? `Staff Menang Ronde ${room.currentRound}!`
                                                    : 'Waktu Habis!'}
                                        </span>
                                        <span className="text-xs mt-2 font-mono font-bold bg-white/80 px-3 py-1 rounded-full border border-text">
                                            {room.round?.winReason === 'false_start'
                                                ? (room.round?.visitorFalseStart ? 'Pengunjung False Start!' : 'Staff False Start!')
                                                : `Pengunjung: ${room.round?.visitorReactionMs ? `${room.round.visitorReactionMs}ms` : '-'} | Staff: ${room.round?.hostReactionMs ? `${room.round.hostReactionMs}ms` : '-'}`}
                                        </span>
                                    </>
                                )}
                                {roundState === REACTION_STATES.FINISHED && (
                                    <>
                                        <span className="text-5xl mb-2">🏆</span>
                                        <span className="font-title text-2xl sm:text-3xl font-black">
                                            {room.matchWinner === 'visitor'
                                                ? `PEMENANG: ${room.visitor?.name || 'PENGUNJUNG'}!`
                                                : 'STAFF MENANG MATCH!'}
                                        </span>
                                        <span className="text-sm font-bold mt-1">
                                            Skor Akhir: {visitorScore} – {hostScore}
                                        </span>
                                    </>
                                )}
                            </button>

                            {/* Host Controls Row */}
                            {!isVisitorView && (
                                <div className="w-full flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-text/15">
                                    <div className="flex flex-wrap gap-2">
                                        {roundState === REACTION_STATES.READY && (
                                            <button
                                                type="button"
                                                disabled={busy}
                                                onClick={handleArmRound}
                                                className="btn bg-pink text-text border-2 border-text rounded-xl px-4 py-2 font-title text-xs font-bold shadow-[2px_2px_0px_#181818] hover:bg-yellow cursor-pointer"
                                            >
                                                Mulai Ronde #{room.currentRound} ⚡
                                            </button>
                                        )}
                                        {roundState === REACTION_STATES.ROUND_END && (
                                            <button
                                                type="button"
                                                onClick={handleNextRound}
                                                className="btn bg-yellow text-text border-2 border-text rounded-xl px-4 py-2 font-title text-xs font-bold shadow-[2px_2px_0px_#181818] hover:bg-white cursor-pointer"
                                            >
                                                Lanjut Ronde #{(room.currentRound || 1) + 1} →
                                            </button>
                                        )}
                                        {roundState === REACTION_STATES.FINISHED && (
                                            <button
                                                type="button"
                                                onClick={handleRematch}
                                                className="btn bg-yellow text-text border-2 border-text rounded-xl px-4 py-2 font-title text-xs font-bold shadow-[2px_2px_0px_#181818] hover:bg-white cursor-pointer"
                                            >
                                                🔄 Rematch (Reset 0–0)
                                            </button>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleCloseRoom}
                                        className="btn bg-rose-100 hover:bg-rose-200 text-rose-800 border-2 border-text rounded-xl px-3 py-2 font-title text-xs font-bold cursor-pointer"
                                    >
                                        Tutup Room
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
