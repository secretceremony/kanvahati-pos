/**
 * Kanvahati Arcade — Reaction Battle Firestore & Realtime Sync Service
 * Handles room creation, visitor join/heartbeat, server-timestamped tap submission,
 * and authoritative Host adjudication across two devices.
 */

import { db } from '../../firebase.js';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    onSnapshot,
    runTransaction,
    serverTimestamp
} from 'firebase/firestore';
import {
    REACTION_STATES,
    createReactionRoom,
    generateRoomCode,
    generateRandomSignalDelayMs,
    adjudicateReactionRound,
    advanceToNextReactionRound,
    resetReactionForRematch
} from './reactionCore.js';
import { hashIdentifier } from './arcadeDb.js';

const ROOMS_COL = 'reaction_rooms';
const TAPS_SUBCOL = 'taps';

/**
 * Create a new Reaction Battle room (Host / Admin only)
 */
export async function createReactionBattleRoom({
    eventId = 'CF20',
    hostUid = 'host_staff',
    hostName = 'Staff Kanvahati',
    participantName = '',
    rawIdentifier = ''
} = {}) {
    const roomCode = generateRoomCode();
    const hashedIdentifier = rawIdentifier.trim() ? await hashIdentifier(rawIdentifier) : null;
    const room = createReactionRoom({
        roomCode,
        eventId,
        hostUid,
        hostName,
        participantName,
        hashedIdentifier
    });

    await setDoc(doc(db, ROOMS_COL, roomCode), {
        ...room,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    return room;
}

/**
 * Subscribe to a Reaction Battle room in real time
 */
export function subscribeReactionRoom(roomCode, onUpdate, onError) {
    if (!roomCode) return () => {};
    const cleanCode = roomCode.trim().toUpperCase();
    return onSnapshot(
        doc(db, ROOMS_COL, cleanCode),
        (snap) => {
            if (!snap.exists()) {
                onUpdate(null);
                return;
            }
            onUpdate({ id: snap.id, ...snap.data() });
        },
        (err) => {
            console.warn('[ReactionSync] Room snapshot error:', err);
            onError?.(err);
        }
    );
}

/**
 * Subscribe to both tap documents (`host` and `visitor`) inside a room
 */
export function subscribeReactionTaps(roomCode, onTapsUpdate) {
    if (!roomCode) return () => {};
    const cleanCode = roomCode.trim().toUpperCase();
    let hostTap = null;
    let visitorTap = null;

    const emit = () => onTapsUpdate({ hostTap, visitorTap });

    const unsubHost = onSnapshot(doc(db, ROOMS_COL, cleanCode, TAPS_SUBCOL, 'host'), (snap) => {
        hostTap = snap.exists() ? snap.data() : null;
        emit();
    });
    const unsubVisitor = onSnapshot(doc(db, ROOMS_COL, cleanCode, TAPS_SUBCOL, 'visitor'), (snap) => {
        visitorTap = snap.exists() ? snap.data() : null;
        emit();
    });

    return () => {
        unsubHost();
        unsubVisitor();
    };
}

/**
 * Visitor joins room via 6-char room code or QR link
 * Note: works with either authenticated staff/kiosk or visitor device token.
 */
export async function joinReactionRoomAsVisitor(roomCode, visitorName = 'Pengunjung', clientToken = null) {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    if (!cleanCode) throw new Error('Kode room tidak valid!');

    const roomRef = doc(db, ROOMS_COL, cleanCode);
    const token = clientToken || `vis_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    return await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) {
            throw new Error(`Room '${cleanCode}' tidak ditemukan!`);
        }
        const room = snap.data();
        if (room.status === REACTION_STATES.CANCELLED) {
            throw new Error('Room ini telah dibatalkan oleh Host.');
        }

        const nextStatus = room.status === REACTION_STATES.WAITING
            ? (room.host?.ready ? REACTION_STATES.READY : REACTION_STATES.WAITING)
            : room.status;

        const updates = {
            status: nextStatus,
            revision: (room.revision || 1) + 1,
            visitor: {
                ...(room.visitor || {}),
                joined: true,
                name: (visitorName || room.visitor?.name || 'Pengunjung').trim(),
                clientToken: room.visitor?.clientToken || token,
                ready: false,
                connected: true,
                score: room.visitor?.score || 0,
                lastSeenMs: Date.now()
            },
            updatedAt: serverTimestamp(),
            updatedAtMs: Date.now()
        };

        tx.update(roomRef, updates);
        return { ...room, ...updates, visitorToken: updates.visitor.clientToken };
    });
}

/**
 * Set player ready flag (`host` or `visitor`)
 */
export async function setReactionPlayerReady(roomCode, role, ready = true) {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    const roomRef = doc(db, ROOMS_COL, cleanCode);

    return await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) throw new Error('Room tidak ditemukan!');
        const room = snap.data();

        const nextHost = role === 'host' ? { ...room.host, ready, connected: true, lastSeenMs: Date.now() } : room.host;
        const nextVisitor = role === 'visitor' ? { ...room.visitor, ready, connected: true, lastSeenMs: Date.now() } : room.visitor;

        let nextStatus = room.status;
        if (room.status === REACTION_STATES.WAITING || room.status === REACTION_STATES.READY) {
            nextStatus = (nextHost?.ready && nextVisitor?.joined && nextVisitor?.ready)
                ? REACTION_STATES.READY
                : REACTION_STATES.WAITING;
        }

        const updates = {
            status: nextStatus,
            revision: (room.revision || 1) + 1,
            host: nextHost,
            visitor: nextVisitor,
            updatedAt: serverTimestamp(),
            updatedAtMs: Date.now()
        };
        tx.update(roomRef, updates);
        return { ...room, ...updates };
    });
}

/**
 * Host arms the round with a randomized delay and server-synced goAtMs target.
 * Clears previous round tap docs before arming.
 */
export async function armReactionRound(roomCode, clockOffsetMs = 0) {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    const delayMs = generateRandomSignalDelayMs();
    const armedAtMs = Date.now() + clockOffsetMs;
    const goAtMs = armedAtMs + delayMs;

    // Clear previous round tap docs
    await Promise.all([
        setDoc(doc(db, ROOMS_COL, cleanCode, TAPS_SUBCOL, 'host'), { cleared: true, round: 0 }),
        setDoc(doc(db, ROOMS_COL, cleanCode, TAPS_SUBCOL, 'visitor'), { cleared: true, round: 0 })
    ]);

    const roomRef = doc(db, ROOMS_COL, cleanCode);
    await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) throw new Error('Room tidak ditemukan!');
        const room = snap.data();

        tx.update(roomRef, {
            status: REACTION_STATES.ARMED,
            revision: (room.revision || 1) + 1,
            round: {
                number: room.currentRound || 1,
                armedAtMs,
                signalDelayMs: delayMs,
                goAtMs,
                winner: null,
                winReason: null,
                hostReactionMs: null,
                visitorReactionMs: null,
                hostFalseStart: false,
                visitorFalseStart: false
            },
            updatedAt: serverTimestamp(),
            updatedAtMs: Date.now()
        });
    });

    return { armedAtMs, delayMs, goAtMs };
}

/**
 * Transition room from ARMED -> GO when randomized delay elapses (Host triggers)
 */
export async function triggerReactionGoSignal(roomCode, expectedRoundNumber) {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    const roomRef = doc(db, ROOMS_COL, cleanCode);

    return await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) return null;
        const room = snap.data();
        if (room.status !== REACTION_STATES.ARMED || (room.currentRound || 1) !== expectedRoundNumber) {
            return room;
        }
        tx.update(roomRef, {
            status: REACTION_STATES.GO,
            revision: (room.revision || 1) + 1,
            updatedAt: serverTimestamp(),
            updatedAtMs: Date.now()
        });
        return { ...room, status: REACTION_STATES.GO };
    });
}

/**
 * Submit a player tap (`host` or `visitor`).
 * Writes Firestore serverTimestamp() so winner adjudication cannot be spoofed by client clocks.
 */
export async function submitReactionTap(roomCode, role, roundNumber, clockOffsetMs = 0) {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    const tapRef = doc(db, ROOMS_COL, cleanCode, TAPS_SUBCOL, role === 'host' ? 'host' : 'visitor');

    await setDoc(tapRef, {
        cleared: false,
        role,
        round: roundNumber,
        clientAtMs: Date.now(),
        clockOffsetMs,
        serverAt: serverTimestamp(),
        serverAtMs: Date.now() + clockOffsetMs
    });
}

/**
 * Host runs authoritative adjudication on current round taps and commits result atomically.
 */
export async function commitReactionAdjudication(roomCode, { hostTap, visitorTap } = {}) {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    const roomRef = doc(db, ROOMS_COL, cleanCode);

    return await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) return null;
        const room = snap.data();

        if (room.status !== REACTION_STATES.ARMED && room.status !== REACTION_STATES.GO) {
            return room;
        }

        const currentRound = room.currentRound || 1;
        const validHostTap = hostTap && !hostTap.cleared && hostTap.round === currentRound ? hostTap : null;
        const validVisitorTap = visitorTap && !visitorTap.cleared && visitorTap.round === currentRound ? visitorTap : null;

        const nextRoom = adjudicateReactionRound(room, {
            hostTap: validHostTap,
            visitorTap: validVisitorTap,
            nowMs: Date.now()
        });

        if (nextRoom === room) return room;

        tx.update(roomRef, {
            status: nextRoom.status,
            revision: nextRoom.revision,
            host: nextRoom.host,
            visitor: nextRoom.visitor,
            round: nextRoom.round,
            roundHistory: nextRoom.roundHistory,
            matchWinner: nextRoom.matchWinner,
            updatedAt: serverTimestamp(),
            updatedAtMs: Date.now()
        });

        return nextRoom;
    });
}

/**
 * Advance to next round (Host)
 */
export async function nextReactionRound(roomCode) {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    const roomRef = doc(db, ROOMS_COL, cleanCode);

    await Promise.all([
        setDoc(doc(db, ROOMS_COL, cleanCode, TAPS_SUBCOL, 'host'), { cleared: true, round: 0 }),
        setDoc(doc(db, ROOMS_COL, cleanCode, TAPS_SUBCOL, 'visitor'), { cleared: true, round: 0 })
    ]);

    return await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) return null;
        const nextRoom = advanceToNextReactionRound(snap.data());
        tx.update(roomRef, {
            status: nextRoom.status,
            revision: nextRoom.revision,
            currentRound: nextRoom.currentRound,
            round: nextRoom.round,
            updatedAt: serverTimestamp(),
            updatedAtMs: Date.now()
        });
        return nextRoom;
    });
}

/**
 * Rematch / clean reset inside same room (Host)
 */
export async function rematchReactionRoom(roomCode) {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    const roomRef = doc(db, ROOMS_COL, cleanCode);

    await Promise.all([
        setDoc(doc(db, ROOMS_COL, cleanCode, TAPS_SUBCOL, 'host'), { cleared: true, round: 0 }),
        setDoc(doc(db, ROOMS_COL, cleanCode, TAPS_SUBCOL, 'visitor'), { cleared: true, round: 0 })
    ]);

    return await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) return null;
        const nextRoom = resetReactionForRematch(snap.data());
        tx.update(roomRef, {
            status: nextRoom.status,
            revision: nextRoom.revision,
            currentRound: nextRoom.currentRound,
            host: nextRoom.host,
            visitor: nextRoom.visitor,
            round: nextRoom.round,
            roundHistory: nextRoom.roundHistory,
            matchWinner: nextRoom.matchWinner,
            outcomeRecorded: false,
            updatedAt: serverTimestamp(),
            updatedAtMs: Date.now()
        });
        return nextRoom;
    });
}

/**
 * Record finished Reaction Battle match outcome into arcade_participants (idempotent per room)
 */
export async function recordReactionMatchOutcome({
    roomCode,
    eventId,
    rawIdentifier,
    displayName,
    matchWinner,
    hostScore,
    visitorScore,
    staffUid = 'host_staff'
}) {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    const roomRef = doc(db, ROOMS_COL, cleanCode);
    const hasId = Boolean(rawIdentifier && rawIdentifier.trim());
    const hashed = hasId ? await hashIdentifier(rawIdentifier) : `guest_${cleanCode}`;
    const participantKey = `${eventId}_${hashed}`;
    const participantDocRef = doc(db, 'arcade_participants', participantKey);

    return await runTransaction(db, async (tx) => {
        const [roomSnap, partSnap] = await Promise.all([
            tx.get(roomRef),
            tx.get(participantDocRef)
        ]);

        if (roomSnap.exists() && roomSnap.data().outcomeRecorded) {
            return partSnap.exists() ? partSnap.data() : null;
        }

        const result = matchWinner === 'visitor' ? 'win' : 'lose';
        const nowIso = new Date().toISOString();
        const prev = partSnap.exists() ? partSnap.data() : {};
        const prevModes = Array.isArray(prev.modesPlayed) ? prev.modesPlayed : (prev.mode ? [prev.mode] : []);

        const record = {
            participantKey,
            eventId,
            stationId: `reaction_${cleanCode}`,
            displayName: (displayName || prev.displayName || 'Pengunjung').trim(),
            hashedIdentifier: hashed,
            gameId: 'REACTION',
            mode: 'reaction_battle',
            modesPlayed: Array.from(new Set([...prevModes, 'reaction_battle'])),
            playCount: (prev.playCount || 0) + 1,
            sessionId: `rx_${cleanCode}`,
            playedAt: prev.playedAt || nowIso,
            completedAt: nowIso,
            status: result === 'win' ? 'won' : 'lost',
            result,
            reactionScore: `${visitorScore}-${hostScore}`,
            evaluatedByStaff: staffUid,
            stickerClaimed: true,
            stickerClaimedAt: prev.stickerClaimedAt || nowIso,
            sketchClaimed: Boolean(prev.sketchClaimed),
            sketchClaimedAt: prev.sketchClaimedAt || null
        };

        tx.set(participantDocRef, record, { merge: true });
        if (roomSnap.exists()) {
            tx.update(roomRef, {
                outcomeRecorded: true,
                participantKey,
                updatedAt: serverTimestamp()
            });
        }
        return record;
    });
}

/**
 * Mark room cancelled / disconnected cleanly
 */
export async function cancelReactionRoom(roomCode) {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    const roomRef = doc(db, ROOMS_COL, cleanCode);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return;
    await updateDoc(roomRef, {
        status: REACTION_STATES.CANCELLED,
        revision: (snap.data().revision || 1) + 1,
        updatedAt: serverTimestamp(),
        updatedAtMs: Date.now()
    });
}
