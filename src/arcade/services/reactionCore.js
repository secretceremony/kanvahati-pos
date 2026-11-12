/**
 * Kanvahati Arcade — Reaction Battle Core Engine (reactionCore.js)
 * Pure state machine & authoritative round adjudication for Best-of-3 PvP Reaction Duels.
 * Keeps timing validation, false-start detection, latency compensation, and match scoring deterministic.
 */

import { REACTION_BATTLE_CONFIG } from '../data/gameConfig.js';

export const REACTION_STATES = {
    WAITING: 'waiting',       // Room created; waiting for visitor to join / both players ready
    READY: 'ready',           // Both players connected & ready; host about to start round
    ARMED: 'armed',           // Countdown armed; randomized delay before GO! signal
    GO: 'go',                 // Signal active! Valid taps race for fastest reaction
    ROUND_END: 'round_end',   // Round winner decided; showing reaction times
    FINISHED: 'finished',     // Best-of-3 match complete (2 wins reached)
    CANCELLED: 'cancelled'    // Aborted / disconnected / reset
};

/**
 * Generate short readable 6-char room code (excludes confusing 0/O, 1/I/L)
 */
export function generateRoomCode() {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return code;
}

/**
 * Generate randomized delay between MIN_DELAY_MS and MAX_DELAY_MS
 */
export function generateRandomSignalDelayMs(minMs = REACTION_BATTLE_CONFIG.MIN_DELAY_MS, maxMs = REACTION_BATTLE_CONFIG.MAX_DELAY_MS) {
    return Math.floor(minMs + Math.random() * (maxMs - minMs));
}

/**
 * Create initial Reaction Battle room state
 */
export function createReactionRoom({
    roomCode,
    eventId = 'CF20',
    hostUid = 'host_staff',
    hostName = 'Staff Kanvahati',
    participantName = '',
    hashedIdentifier = null,
    bestOf = REACTION_BATTLE_CONFIG.BEST_OF_ROUNDS
} = {}) {
    const code = (roomCode || generateRoomCode()).toUpperCase();
    return {
        roomCode: code,
        eventId,
        mode: 'reaction_battle',
        status: REACTION_STATES.WAITING,
        revision: 1,
        bestOf,
        winsNeeded: Math.ceil(bestOf / 2),
        currentRound: 1,
        host: {
            uid: hostUid,
            name: hostName,
            ready: false,
            connected: true,
            score: 0,
            lastSeenMs: Date.now()
        },
        visitor: {
            joined: false,
            name: participantName || 'Pengunjung',
            hashedIdentifier,
            clientToken: null,
            ready: false,
            connected: false,
            score: 0,
            lastSeenMs: null
        },
        round: {
            number: 1,
            armedAtMs: null,
            signalDelayMs: null,
            goAtMs: null,
            winner: null,        // 'host' | 'visitor'
            winReason: null,     // 'fastest_reaction' | 'false_start' | 'timeout'
            hostReactionMs: null,
            visitorReactionMs: null,
            hostFalseStart: false,
            visitorFalseStart: false
        },
        roundHistory: [],
        matchWinner: null,       // 'host' | 'visitor'
        outcomeRecorded: false,
        sketchClaimed: false,
        stickerClaimed: false,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now()
    };
}

/**
 * Resolve server-authoritative timestamp from Firestore tap document.
 * Prevents client-clock manipulation by preferring Firestore serverTimestamp
 * (`tap.serverAtMs` / `tap.serverTimestamp.toMillis()`), bounded against local RTT offset.
 */
export function resolveAuthoritativeTapMs(tap, goAtMs) {
    if (!tap) return null;
    let serverMs = null;
    if (typeof tap.serverAt?.toMillis === 'function') {
        serverMs = tap.serverAt.toMillis();
    } else if (typeof tap.serverAt?.seconds === 'number') {
        serverMs = tap.serverAt.seconds * 1000 + Math.floor((tap.serverAt.nanoseconds || 0) / 1000000);
    } else if (typeof tap.serverAtMs === 'number') {
        serverMs = tap.serverAtMs;
    }

    const clientReportedMs = typeof tap.clientAtMs === 'number' ? tap.clientAtMs : null;

    if (serverMs !== null && clientReportedMs !== null) {
        // Allow bounded latency compensation (up to 180ms jitter window) when clock offset is known,
        // otherwise trust serverMs strictly so hacked client clocks cannot report negative 1ms reactions.
        const offset = typeof tap.clockOffsetMs === 'number' ? tap.clockOffsetMs : 0;
        const compensatedClientMs = clientReportedMs + offset;
        const driftFromServer = Math.abs(compensatedClientMs - serverMs);

        if (driftFromServer <= 250) {
            // Reasonable RTT jitter; clamp so a tap after GO never undercuts GO via clock drift
            if (typeof goAtMs === 'number' && serverMs >= goAtMs && compensatedClientMs < goAtMs) {
                return serverMs;
            }
            return compensatedClientMs;
        }
        return serverMs;
    }

    return serverMs ?? clientReportedMs;
}

/**
 * Evaluate a round given current room state and both player taps ({ hostTap, visitorTap }).
 * Handles:
 *  - Early input (tap before goAtMs or during ARMED) -> False start -> immediate round loss
 *  - Dual false start -> earlier false start loses (or host/visitor tiebreak)
 *  - Valid taps after goAtMs -> lowest valid reactionMs wins
 *  - Best-of-3 match progression
 */
export function adjudicateReactionRound(room, { hostTap = null, visitorTap = null, nowMs = Date.now() } = {}) {
    if (!room || (room.status !== REACTION_STATES.ARMED && room.status !== REACTION_STATES.GO)) {
        return room;
    }

    const goAtMs = room.round?.goAtMs;
    const hostMs = resolveAuthoritativeTapMs(hostTap, goAtMs);
    const visitorMs = resolveAuthoritativeTapMs(visitorTap, goAtMs);

    const hostTapped = hostMs !== null && !isNaN(hostMs);
    const visitorTapped = visitorMs !== null && !isNaN(visitorMs);

    if (!hostTapped && !visitorTapped) {
        // Check timeout if in GO state
        if (room.status === REACTION_STATES.GO && goAtMs && (nowMs - goAtMs) >= REACTION_BATTLE_CONFIG.ROUND_TIMEOUT_MS) {
            return finalizeRoundResult(room, {
                winner: null,
                winReason: 'timeout',
                hostReactionMs: null,
                visitorReactionMs: null,
                hostFalseStart: false,
                visitorFalseStart: false
            });
        }
        return room;
    }

    const hostFalseStart = hostTapped && (room.status === REACTION_STATES.ARMED || (goAtMs && hostMs < goAtMs));
    const visitorFalseStart = visitorTapped && (room.status === REACTION_STATES.ARMED || (goAtMs && visitorMs < goAtMs));

    if (hostFalseStart && visitorFalseStart) {
        // Whichever jumped earlier loses
        const winner = hostMs <= visitorMs ? 'visitor' : 'host';
        return finalizeRoundResult(room, {
            winner,
            winReason: 'false_start',
            hostReactionMs: null,
            visitorReactionMs: null,
            hostFalseStart: true,
            visitorFalseStart: true
        });
    }

    if (visitorFalseStart) {
        return finalizeRoundResult(room, {
            winner: 'host',
            winReason: 'false_start',
            hostReactionMs: null,
            visitorReactionMs: null,
            hostFalseStart: false,
            visitorFalseStart: true
        });
    }

    if (hostFalseStart) {
        return finalizeRoundResult(room, {
            winner: 'visitor',
            winReason: 'false_start',
            hostReactionMs: null,
            visitorReactionMs: null,
            hostFalseStart: true,
            visitorFalseStart: false
        });
    }

    // Both or one valid reaction after GO!
    const hostReact = hostTapped ? Math.max(1, Math.round(hostMs - goAtMs)) : null;
    const visitorReact = visitorTapped ? Math.max(1, Math.round(visitorMs - goAtMs)) : null;

    if (hostReact !== null && visitorReact !== null) {
        const winner = visitorReact <= hostReact ? 'visitor' : 'host';
        return finalizeRoundResult(room, {
            winner,
            winReason: 'fastest_reaction',
            hostReactionMs: hostReact,
            visitorReactionMs: visitorReact,
            hostFalseStart: false,
            visitorFalseStart: false
        });
    }

    // Single valid tap wins immediately in head-to-head duel (or wait brief window if desired;
    // immediate winner on first valid tap ensures snappy arcade feedback)
    const winner = visitorReact !== null ? 'visitor' : 'host';
    return finalizeRoundResult(room, {
        winner,
        winReason: 'fastest_reaction',
        hostReactionMs: hostReact,
        visitorReactionMs: visitorReact,
        hostFalseStart: false,
        visitorFalseStart: false
    });
}

function finalizeRoundResult(room, outcome) {
    const prevHostScore = room.host?.score || 0;
    const prevVisitorScore = room.visitor?.score || 0;
    const nextHostScore = outcome.winner === 'host' ? prevHostScore + 1 : prevHostScore;
    const nextVisitorScore = outcome.winner === 'visitor' ? prevVisitorScore + 1 : prevVisitorScore;

    const winsNeeded = room.winsNeeded || REACTION_BATTLE_CONFIG.WINS_NEEDED;
    const matchWinner = nextVisitorScore >= winsNeeded
        ? 'visitor'
        : nextHostScore >= winsNeeded
            ? 'host'
            : (room.currentRound >= (room.bestOf || 3) && nextHostScore !== nextVisitorScore)
                ? (nextVisitorScore > nextHostScore ? 'visitor' : 'host')
                : null;

    const roundEntry = {
        round: room.currentRound,
        winner: outcome.winner,
        winReason: outcome.winReason,
        hostReactionMs: outcome.hostReactionMs,
        visitorReactionMs: outcome.visitorReactionMs,
        hostFalseStart: outcome.hostFalseStart,
        visitorFalseStart: outcome.visitorFalseStart,
        endedAtMs: Date.now()
    };

    return {
        ...room,
        status: matchWinner ? REACTION_STATES.FINISHED : REACTION_STATES.ROUND_END,
        revision: (room.revision || 1) + 1,
        host: {
            ...room.host,
            score: nextHostScore
        },
        visitor: {
            ...room.visitor,
            score: nextVisitorScore
        },
        round: {
            ...room.round,
            winner: outcome.winner,
            winReason: outcome.winReason,
            hostReactionMs: outcome.hostReactionMs,
            visitorReactionMs: outcome.visitorReactionMs,
            hostFalseStart: outcome.hostFalseStart,
            visitorFalseStart: outcome.visitorFalseStart
        },
        roundHistory: [...(room.roundHistory || []), roundEntry],
        matchWinner,
        updatedAtMs: Date.now()
    };
}

/**
 * Prepare next round or rematch cleanly
 */
export function advanceToNextReactionRound(room) {
    if (!room || room.status === REACTION_STATES.FINISHED) return room;
    const nextRoundNum = (room.currentRound || 1) + 1;
    return {
        ...room,
        status: REACTION_STATES.READY,
        revision: (room.revision || 1) + 1,
        currentRound: nextRoundNum,
        round: {
            number: nextRoundNum,
            armedAtMs: null,
            signalDelayMs: null,
            goAtMs: null,
            winner: null,
            winReason: null,
            hostReactionMs: null,
            visitorReactionMs: null,
            hostFalseStart: false,
            visitorFalseStart: false
        },
        updatedAtMs: Date.now()
    };
}

export function resetReactionForRematch(room) {
    if (!room) return room;
    return {
        ...room,
        status: room.visitor?.joined ? REACTION_STATES.READY : REACTION_STATES.WAITING,
        revision: (room.revision || 1) + 1,
        currentRound: 1,
        host: {
            ...room.host,
            score: 0,
            ready: true
        },
        visitor: {
            ...room.visitor,
            score: 0,
            ready: Boolean(room.visitor?.joined)
        },
        round: {
            number: 1,
            armedAtMs: null,
            signalDelayMs: null,
            goAtMs: null,
            winner: null,
            winReason: null,
            hostReactionMs: null,
            visitorReactionMs: null,
            hostFalseStart: false,
            visitorFalseStart: false
        },
        roundHistory: [],
        matchWinner: null,
        outcomeRecorded: false,
        updatedAtMs: Date.now()
    };
}
