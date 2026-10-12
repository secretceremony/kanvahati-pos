/**
 * Kanvahati Arcade — Real-Time Synchronization Service (arcadeSync.js)
 * Manages Firestore onSnapshot subscriptions for Visitor Display,
 * clock skew compensation, dual-device state reconciliation, and network reconnection.
 */

import { db } from '../../firebase.js';
import { doc, onSnapshot } from 'firebase/firestore';

let cachedClockOffsetMs = null;
let lastOffsetCheckTime = 0;

/**
 * Estimate clock skew between local machine and authoritative time (Server HTTP Date)
 * Skew = ServerTime - LocalTime (positive if local clock is behind, negative if ahead)
 */
export async function getEstimatedServerClockOffset() {
    // Return cached offset if checked recently (within 5 minutes)
    const now = Date.now();
    if (cachedClockOffsetMs !== null && (now - lastOffsetCheckTime < 300000)) {
        return cachedClockOffsetMs;
    }

    if (typeof window === 'undefined' || typeof fetch === 'undefined') {
        return 0;
    }

    try {
        const start = performance.now();
        // Ping local origin / static asset to read HTTP Date header
        const res = await fetch(window.location.origin + '/kanvahati-logo.png', {
            method: 'HEAD',
            cache: 'no-store'
        });
        const end = performance.now();
        const roundTripEstimate = (end - start) / 2;

        const serverDateHeader = res.headers.get('date');
        if (serverDateHeader) {
            const serverTimeMs = new Date(serverDateHeader).getTime() + roundTripEstimate;
            cachedClockOffsetMs = serverTimeMs - Date.now();
            lastOffsetCheckTime = now;
            return cachedClockOffsetMs;
        }
    } catch (e) {
        // If offline or fetch fails, fallback gracefully to 0
    }

    cachedClockOffsetMs = 0;
    return 0;
}

/**
 * Calculate synchronized remaining countdown seconds for Display and Host.
 * Handles Firestore server timestamp delays, pending writes, and device clock skew.
 * 
 * @param {Object} session Active arcade session object
 * @param {number} clockOffset Estimated server time offset in ms
 * @param {number|null} snapshotReceivePerfTime performance.now() when doc snapshot was received
 * @returns {{ remainingSeconds: number, isExpired: boolean, progressPercent: number }}
 */
export function calculateSynchronizedRemaining(session, clockOffset = 0, snapshotReceivePerfTime = null) {
    const totalDuration = session?.timerDurationSec || 30;
    const normalizedStatus = (session?.status || '').toLowerCase();

    if (!session || normalizedStatus !== 'playing') {
        return {
            remainingSeconds: totalDuration,
            isExpired: false,
            progressPercent: 0
        };
    }

    // Resolve startedAt timestamp
    let startedMs = null;
    if (session.startedAt) {
        if (typeof session.startedAt.toMillis === 'function') {
            startedMs = session.startedAt.toMillis();
        } else if (typeof session.startedAt === 'number') {
            startedMs = session.startedAt;
        } else if (session.startedAt.seconds) {
            startedMs = session.startedAt.seconds * 1000 + Math.floor((session.startedAt.nanoseconds || 0) / 1000000);
        } else if (typeof session.startedAt === 'string') {
            startedMs = new Date(session.startedAt).getTime();
        }
    }

    // Fallback to client timestamp estimate if serverTimestamp is pending
    if (!startedMs || isNaN(startedMs)) {
        startedMs = session.startedAtMs || Date.now();
    }

    // Calculate elapsed time using clock-compensated now
    const adjustedNow = Date.now() + clockOffset;
    let elapsedMs = adjustedNow - startedMs;

    // Sanity check: If clock skew is wild (> 60s or negative by > 3s) and we have local performance marker
    if ((elapsedMs < -3000 || elapsedMs > 90000) && snapshotReceivePerfTime !== null && typeof performance !== 'undefined') {
        const localElapsedMs = performance.now() - snapshotReceivePerfTime;
        elapsedMs = Math.max(0, localElapsedMs);
    }

    const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
    const remainingSeconds = Math.max(0, totalDuration - elapsedSeconds);
    const isExpired = remainingSeconds <= 0;
    const progressPercent = Math.min(100, Math.max(0, (elapsedSeconds / totalDuration) * 100));

    return {
        remainingSeconds,
        isExpired,
        progressPercent
    };
}

/**
 * Sanitize session data before exposing to Display view
 * Strips any potential secret keys, answers, or sensitive PII
 */
export function sanitizeDisplaySession(rawSession) {
    if (!rawSession) return null;

    const normalizedStatus = (rawSession.status || 'idle').toLowerCase();
    const isFinished = normalizedStatus === 'won' || normalizedStatus === 'lost';

    // Explicitly allowed display attributes
    const safeProjection = {
        stationKey: rawSession.stationKey || null,
        eventId: rawSession.eventId || null,
        stationId: rawSession.stationId || null,
        sessionId: rawSession.sessionId || null,
        revision: rawSession.revision || 1,
        status: normalizedStatus,
        gameId: rawSession.gameId || null,
        gameTitle: rawSession.gameTitle || null,
        displayPrompt: rawSession.displayPrompt || null,
        mediaUrl: rawSession.mediaUrl || null,
        revealedMediaUrl: isFinished 
            ? rawSession.revealedMediaUrl || null 
            : null,
        revealedAnswer: isFinished
            ? rawSession.revealedAnswer || null
            : null,
        displayItems: rawSession.displayItems || null,
        trait: rawSession.trait || null,
        letter: rawSession.letter || null,
        characterName: (rawSession.gameId === 'G07' && !isFinished) ? null : (rawSession.characterName || null),
        phrasePrompt: rawSession.phrasePrompt || null,
        cardReferenceCode: rawSession.cardReferenceCode || null,
        currentProgress: rawSession.currentProgress || 0,
        targetProgress: rawSession.targetProgress || rawSession.targetCount || 1,
        timerDurationSec: rawSession.timerDurationSec || 30,
        startedAt: rawSession.startedAt || null,
        startedAtMs: rawSession.startedAtMs || null,
        participantDisplayTag: rawSession.participantDisplayTag || "Peserta Booth",
        result: rawSession.result || null,
        disqualificationReason: rawSession.disqualificationReason || null,
        completedAt: rawSession.completedAt || null
    };

    return safeProjection;
}

/**
 * Subscribe to real-time session changes on a designated Event and Station.
 * 
 * @param {string} eventId 
 * @param {string} stationId 
 * @param {Function} onSessionUpdate Callback with (session, meta)
 * @param {Function} onError Callback with error
 * @returns {Function} Unsubscribe function
 */
export function subscribeToStationSession(eventId, stationId, onSessionUpdate, onError) {
    if (!eventId || !stationId) {
        return () => {};
    }

    const stationKey = `${eventId}_${stationId}`;
    const sessionDocRef = doc(db, "arcade_sessions", stationKey);

    let highestRevisionSeen = -1;
    let currentSessionId = null;

    const unsubscribeFirestore = onSnapshot(
        sessionDocRef,
        (snapshot) => {
            const receivePerfTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
            const fromCache = snapshot.metadata.fromCache;
            const hasPendingWrites = snapshot.metadata.hasPendingWrites;

            if (!snapshot.exists()) {
                onSessionUpdate(null, {
                    exists: false,
                    stationKey,
                    fromCache,
                    hasPendingWrites,
                    receivePerfTime
                });
                return;
            }

            const rawData = snapshot.data();
            const safeData = sanitizeDisplaySession(rawData);

            // Stale update rejection:
            // If the sessionId is the same, reject any update that has a lower revision
            if (safeData.sessionId && safeData.sessionId === currentSessionId) {
                if (safeData.revision && safeData.revision < highestRevisionSeen) {
                    console.warn(`[ArcadeSync] Dropped stale update rev ${safeData.revision} < ${highestRevisionSeen}`);
                    return;
                }
            } else if (safeData.sessionId && safeData.sessionId !== currentSessionId) {
                currentSessionId = safeData.sessionId;
                highestRevisionSeen = safeData.revision || 1;
            }

            if (safeData.revision) {
                highestRevisionSeen = Math.max(highestRevisionSeen, safeData.revision);
            }

            onSessionUpdate(safeData, {
                exists: true,
                stationKey,
                fromCache,
                hasPendingWrites,
                receivePerfTime
            });
        },
        (error) => {
            console.error(`[ArcadeSync] Snapshot error for ${stationKey}:`, error);
            if (typeof onError === 'function') {
                onError(error);
            }
        }
    );

    return () => {
        unsubscribeFirestore();
    };
}
