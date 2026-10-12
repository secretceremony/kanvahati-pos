/**
 * Kanvahati Arcade — Core Game Logic & State Machine (arcadeCore.js)
 * Implements session transitions, drift-compensated countdown, progress tracking, and validation.
 */

import { GAME_DEFINITIONS, ARCADE_GLOBAL_RULES } from '../data/gameConfig.js';

export const SESSION_STATES = {
    IDLE: 'idle',
    READY: 'ready',
    PLAYING: 'playing',
    WON: 'won',
    LOST: 'lost'
};

/**
 * Create initial idle session object
 */
export function createIdleSession(eventId = 'CF20', stationId = 'station-1') {
    return {
        stationKey: `${eventId}_${stationId}`,
        eventId,
        stationId,
        status: SESSION_STATES.IDLE,
        gameId: null,
        gameTitle: null,
        question: null,
        currentProgress: 0,
        targetProgress: 0,
        timerDurationSec: ARCADE_GLOBAL_RULES.TIME_LIMIT_SECONDS,
        startedAtMs: null,
        endsAtMs: null,
        participantTag: null,
        result: null,
        disqualificationReason: null
    };
}

/**
 * Randomize a question from question list, avoiding recent questions
 */
export function pickRandomQuestion(questionsList, excludeIds = []) {
    if (!questionsList || questionsList.length === 0) return null;
    
    const available = questionsList.filter(q => !excludeIds.includes(q.id));
    const pool = available.length > 0 ? available : questionsList;
    const randomIndex = Math.floor(Math.random() * pool.length);
    return pool[randomIndex];
}

/**
 * Transition: Prepare session with selected game and participant (READY)
 */
export function prepareSession(session, gameId, question, participantTag) {
    if (session.status === SESSION_STATES.PLAYING) {
        throw new Error("CANNOT_PREPARE: Sesi permainan masih berlangsung!");
    }

    const gameDef = GAME_DEFINITIONS[gameId];
    if (!gameDef) {
        throw new Error(`UNKNOWN_GAME: Challenge '${gameId}' tidak ditemukan!`);
    }

    return {
        ...session,
        status: SESSION_STATES.READY,
        gameId,
        gameTitle: gameDef.title,
        question,
        currentProgress: 0,
        targetProgress: gameDef.targetCount,
        timerDurationSec: gameDef.timeLimitSec,
        startedAtMs: null,
        endsAtMs: null,
        participantTag: participantTag || 'Peserta #01',
        result: null,
        disqualificationReason: null
    };
}

/**
 * Transition: Start 30s game timer (PLAYING)
 */
export function startSession(session, serverNowMs = Date.now()) {
    if (session.status !== SESSION_STATES.READY) {
        throw new Error(`INVALID_TRANSITION: Permainan hanya dapat dimulai dari status READY (saat ini: ${session.status})`);
    }

    const durationSec = session.timerDurationSec || ARCADE_GLOBAL_RULES.TIME_LIMIT_SECONDS;
    return {
        ...session,
        status: SESSION_STATES.PLAYING,
        startedAtMs: serverNowMs,
        endsAtMs: serverNowMs + (durationSec * 1000),
        currentProgress: 0,
        result: null
    };
}

/**
 * Calculate remaining seconds with clock drift and latency compensation
 */
export function calculateRemainingSeconds(startedAtMs, durationSec, currentServerEstimateMs = Date.now()) {
    if (!startedAtMs) return durationSec;
    const elapsedSeconds = (currentServerEstimateMs - startedAtMs) / 1000;
    const remaining = Math.max(0, Math.ceil(durationSec - elapsedSeconds));
    return remaining;
}

/**
 * Increment progress upon correct host verification
 * Transitions to WON if target count is achieved
 */
export function recordCorrectAnswer(session, incrementBy = 1) {
    assertSessionIsPlaying(session);

    const nextProgress = session.currentProgress + incrementBy;
    const isTargetMet = nextProgress >= session.targetProgress;

    if (isTargetMet) {
        return {
            ...session,
            currentProgress: session.targetProgress,
            status: SESSION_STATES.WON,
            result: 'win',
            completedAtMs: Date.now()
        };
    }

    return {
        ...session,
        currentProgress: nextProgress
    };
}

/**
 * Instant loss when host marks wrong answer, rule violation, or duplicate franchise
 */
export function recordIncorrectAnswer(session, reason = "Jawaban salah / pelanggaran aturan") {
    assertSessionIsPlaying(session);

    return {
        ...session,
        status: SESSION_STATES.LOST,
        result: 'lose',
        disqualificationReason: reason,
        completedAtMs: Date.now()
    };
}

/**
 * Automatic loss when 30 seconds timer expires
 */
export function recordTimeout(session) {
    if (session.status !== SESSION_STATES.PLAYING) {
        return session; // Ignore if already won or lost
    }

    return {
        ...session,
        status: SESSION_STATES.LOST,
        result: 'lose',
        disqualificationReason: "Waktu habis (Timeout 30 detik)",
        completedAtMs: Date.now()
    };
}

/**
 * Reset session back to IDLE for next player
 */
export function resetSession(session) {
    return createIdleSession(session.eventId, session.stationId);
}

/**
 * Helper to ensure terminal states (WON / LOST) cannot be modified
 */
function assertSessionIsPlaying(session) {
    if (session.status === SESSION_STATES.WON || session.status === SESSION_STATES.LOST) {
        throw new Error(`IMMUTABLE_TERMINAL_STATE: Hasil sesi sudah final (${session.status.toUpperCase()}) dan tidak dapat diubah lagi! (SESSION_NOT_PLAYING)`);
    }
    if (session.status !== SESSION_STATES.PLAYING) {
        throw new Error(`INVALID_STATE: Aksi hanya dapat dilakukan saat sesi berstatus PLAYING (saat ini: ${session.status}) (SESSION_NOT_PLAYING)`);
    }
}
